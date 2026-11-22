"use server";

import { revalidatePath } from "next/cache";
import { applyPortalOverride, diffPortal, isEmptyPortalOverride } from "@/lib/portal/merge";
import { parsePortalContent } from "@/lib/portal/validate";
import { readImage } from "@/lib/theme/validate";
import type { PortalFormState } from "@/types/portal";
import { requirePlatformAdmin } from "../forms/guard";
import { portal } from "../repositories";
import { getTenantSelection } from "../queries/platform";

const MAX_PAYLOAD = 64 * 1024;
/** Two images and the text share one request, which Server Actions cap at 4 MB. */
const MAX_IMAGE_BYTES = 1.5 * 1024 * 1024;
const fail = (message: string, errors: PortalFormState["errors"] = {}): PortalFormState => ({ ok: false, message, errors });

/** Same idea as the theme editor: the page only picks platform or school; the school comes from the open workspace. */
type Area = "platform" | "school";
const areaOf = (v: unknown): Area => (v === "school" ? "school" : "platform");

async function currentScope(area: Area): Promise<string | undefined> {
  if (area === "platform") return "platform";
  const { selected } = await getTenantSelection();
  return selected?.id;
}

/** Saves the portal pages for the current scope. Everything is validated again here. */
export async function savePortal(_prev: PortalFormState, formData: FormData): Promise<PortalFormState> {
  await requirePlatformAdmin();
  const scope = await currentScope(areaOf(formData.get("area")));
  if (!scope) return fail("Open a school workspace first.");

  const payload = formData.get("payload");
  if (typeof payload !== "string" || payload.length > MAX_PAYLOAD) return fail("Those changes could not be read. Reload and try again.");
  let json: unknown;
  try {
    json = JSON.parse(payload);
  } catch {
    return fail("Those changes could not be read. Reload and try again.");
  }

  // Keep each saved image unless a new one was uploaded or the admin asked to remove it.
  const platform = await portal.getPlatformDefault();
  const existing = scope === "platform" ? platform : applyPortalOverride(platform, await portal.getTenantOverride(scope));
  const hero = await readImage(formData.get("heroImage"), MAX_IMAGE_BYTES, "Hero image");
  const about = await readImage(formData.get("aboutImage"), MAX_IMAGE_BYTES, "About image");
  const imageErrors = { ...(hero.error ? { heroImage: hero.error } : {}), ...(about.error ? { aboutImage: about.error } : {}) };
  if (Object.keys(imageErrors).length) return fail("Fix the highlighted fields.", imageErrors);
  const images = {
    heroImage: formData.get("removeHeroImage") === "on" ? "" : (hero.url ?? existing.heroImage),
    aboutImage: formData.get("removeAboutImage") === "on" ? "" : (about.url ?? existing.aboutImage),
  };

  const parsed = parsePortalContent(json, images);
  if (!parsed.ok) return fail("Fix the highlighted fields.", parsed.errors);

  if (scope === "platform") await portal.savePlatformDefault(parsed.value);
  else {
    // Keep only what differs from the platform default, so everything else keeps following it.
    const override = diffPortal(platform, parsed.value);
    if (isEmptyPortalOverride(override)) await portal.clearTenantOverride(scope);
    else await portal.saveTenantOverride(scope, override);
  }

  revalidatePath("/", "layout");
  return { ok: true, message: scope === "platform" ? "Platform default saved." : "Portal pages saved." };
}

/** Removes the open school's changes so its portal follows the platform default again. */
export async function resetPortal(_prev: PortalFormState, formData: FormData): Promise<PortalFormState> {
  await requirePlatformAdmin();
  const scope = await currentScope(areaOf(formData.get("area")));
  if (!scope || scope === "platform") return fail("Open a school workspace first.");
  await portal.clearTenantOverride(scope);
  revalidatePath("/", "layout");
  return { ok: true, message: "Now using the platform default." };
}

