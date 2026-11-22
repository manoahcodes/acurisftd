"use server";

import { revalidatePath } from "next/cache";
import { applyPortalOverride, diffPortal, isEmptyPortalOverride } from "@/lib/portal/merge";
import { MAX_SLIDES, parsePortalContent } from "@/lib/portal/validate";
import { readImage } from "@/lib/theme/validate";
import type { PortalFormState } from "@/types/portal";
import { requirePlatformAdmin } from "../forms/guard";
import { portal } from "../repositories";
import { getTenantSelection } from "../queries/platform";

const MAX_PAYLOAD = 64 * 1024;
/** Images and text share one request, which Server Actions cap at 16 MB (see next.config): 9 photos at 1.5 MB. */
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
  // One entry per single-photo slot: a new upload wins, "remove" clears it, otherwise the saved photo stays.
  const slots = ["heroImage", "aboutImage", "signInImage", "registerImage"] as const;
  const labels = { heroImage: "Hero image", aboutImage: "About image", signInImage: "Sign-in image", registerImage: "Register image" };
  const images = {} as Record<(typeof slots)[number], string>;
  const imageErrors: Record<string, string> = {};
  for (const slot of slots) {
    const up = await readImage(formData.get(slot), MAX_IMAGE_BYTES, labels[slot]);
    if (up.error) imageErrors[slot] = up.error;
    images[slot] = formData.get(`remove${slot[0].toUpperCase()}${slot.slice(1)}`) === "on" ? "" : (up.url ?? existing[slot]);
  }
  if (Object.keys(imageErrors).length) return fail("Fix the highlighted fields.", imageErrors);

  // Slides: a new upload for that position wins; otherwise `keep` names which saved slide's photo it keeps.
  const rawSlides = Array.isArray((json as { slides?: unknown })?.slides) ? ((json as { slides: unknown[] }).slides) : [];
  const slideImages: string[] = [];
  const slideErrors: Record<string, string> = {};
  for (let n = 0; n < Math.min(rawSlides.length, MAX_SLIDES); n++) {
    const up = await readImage(formData.get(`slideImage${n}`), MAX_IMAGE_BYTES, "Slide photo");
    if (up.error) slideErrors[`slides.${n}.image`] = up.error;
    const keep = (rawSlides[n] as { keep?: unknown } | null)?.keep;
    const kept = typeof keep === "number" && Number.isInteger(keep) ? existing.slides[keep]?.image : undefined;
    slideImages.push(up.url ?? kept ?? "");
  }
  if (Object.keys(slideErrors).length) return fail("Fix the highlighted fields.", slideErrors);

  const parsed = parsePortalContent(json, { ...images, slideImages });
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

