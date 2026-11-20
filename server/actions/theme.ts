"use server";

import { revalidatePath } from "next/cache";
import { applyOverride, diffConfig, isEmptyOverride } from "@/lib/theme/merge";
import { parseBranding, parseThemeSettings, readLogo } from "@/lib/theme/validate";
import type { ThemeFormState } from "@/types/theme";
import { requirePlatformAdmin } from "../forms/guard";
import { themes } from "../repositories";
import { getTenantSelection } from "../queries/platform";

const MAX_PRESETS = 20;
const fail = (message: string, errors: ThemeFormState["errors"] = {}): ThemeFormState => ({ ok: false, message, errors });

/**
 * Which page the editor sits on: the Platform Admin's platform settings (the
 * default every school inherits) or a School Admin's school settings.
 * It only chooses between the two; the school itself is never taken from the
 * browser but from the open workspace (cookie checked against the real tenant list).
 */
export type ThemeArea = "platform" | "school";
const areaOf = (v: unknown): ThemeArea => (v === "school" ? "school" : "platform");

/** "platform", or the open school's id; undefined when school branding is asked for with no workspace open. */
async function currentScope(area: ThemeArea): Promise<string | undefined> {
  if (area === "platform") return "platform";
  const { selected } = await getTenantSelection();
  return selected?.id;
}

/** Saves branding and theme for the current scope. Everything is validated again here. */
export async function saveTheme(_prev: ThemeFormState, formData: FormData): Promise<ThemeFormState> {
  await requirePlatformAdmin();
  const scope = await currentScope(areaOf(formData.get("area")));
  if (!scope) return fail("Open a school workspace first.");

  const raw = Object.fromEntries(formData.entries());
  const theme = parseThemeSettings(raw);
  const platform = await themes.getPlatformDefault();
  const existing = scope === "platform" ? platform : applyOverride(platform, await themes.getTenantOverride(scope));

  const logo = await readLogo(formData.get("logo"));
  if (logo.error) return fail("Fix the highlighted fields.", { logo: logo.error });
  // Keep the saved logo unless a new one was uploaded or the admin asked to remove it.
  const logoUrl = formData.get("removeLogo") === "on" ? "" : (logo.url ?? existing.branding.logoUrl);

  const branding = parseBranding(raw, logoUrl);
  const errors = { ...(theme.ok ? {} : theme.errors), ...(branding.ok ? {} : branding.errors) };
  if (!theme.ok || !branding.ok) return fail("Fix the highlighted fields.", errors);

  const config = { theme: theme.value, branding: branding.value };
  if (scope === "platform") await themes.savePlatformDefault(config);
  else {
    // Keep only what differs from the platform default, so everything else keeps following it.
    const override = diffConfig(platform, config);
    if (isEmptyOverride(override)) await themes.clearTenantOverride(scope);
    else await themes.saveTenantOverride(scope, override);
  }

  revalidatePath("/", "layout");
  return { ok: true, message: scope === "platform" ? "Platform default saved." : "School branding saved." };
}

/** Removes the selected school's override so it inherits the platform default again. */
export async function resetTenantTheme(_prev: ThemeFormState, formData: FormData): Promise<ThemeFormState> {
  await requirePlatformAdmin();
  const scope = await currentScope(areaOf(formData.get("area")));
  if (!scope || scope === "platform") return fail("Open a school workspace first.");
  await themes.clearTenantOverride(scope);
  revalidatePath("/", "layout");
  return { ok: true, message: "Now using the platform default." };
}

export async function saveThemePreset(_prev: ThemeFormState, formData: FormData): Promise<ThemeFormState> {
  await requirePlatformAdmin();
  const scope = await currentScope(areaOf(formData.get("area")));
  if (!scope) return fail("Open a school workspace first.");
  const name = String(formData.get("presetName") ?? "").trim().replace(/\s+/g, " ");
  if (name.length < 1 || name.length > 40) return fail("Name the preset (1 to 40 characters).", { form: "Name the preset (1 to 40 characters)." });
  const theme = parseThemeSettings(Object.fromEntries(formData.entries()));
  if (!theme.ok) return fail("Fix the highlighted fields.", theme.errors);
  const existing = await themes.listPresets(scope);
  if (existing.length >= MAX_PRESETS) return fail(`You can keep up to ${MAX_PRESETS} presets.`);
  await themes.savePreset(scope, name, theme.value);
  revalidatePath("/", "layout");
  return { ok: true, message: `Preset "${name}" saved.` };
}

export async function deleteThemePreset(id: string, area: ThemeArea): Promise<ThemeFormState> {
  await requirePlatformAdmin();
  if (!/^[A-Za-z0-9-]{1,64}$/.test(id)) return fail("That preset is not valid.");
  const scope = await currentScope(areaOf(area));
  if (!scope) return fail("Open a school workspace first.");
  await themes.deletePreset(scope, id);
  revalidatePath("/", "layout");
  return { ok: true };
}
