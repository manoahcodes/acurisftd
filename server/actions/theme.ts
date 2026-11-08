"use server";

import { revalidatePath } from "next/cache";
import { parseBranding, parseThemeSettings, readLogo } from "@/lib/theme/validate";
import type { ThemeFormState } from "@/types/theme";
import { requirePlatformAdmin } from "../forms/guard";
import { themes } from "../repositories";
import { getTenantSelection } from "../queries/platform";

const MAX_PRESETS = 20;
const fail = (message: string, errors: ThemeFormState["errors"] = {}): ThemeFormState => ({ ok: false, message, errors });

/**
 * The scope is never taken from the browser: it is the school the Platform
 * Admin has selected (from the cookie, checked against the real tenant list),
 * or the platform default when none is.
 */
async function currentScope() {
  const { selected } = await getTenantSelection();
  return selected?.id ?? "platform";
}

/** Saves branding and theme for the current scope. Everything is validated again here. */
export async function saveTheme(_prev: ThemeFormState, formData: FormData): Promise<ThemeFormState> {
  await requirePlatformAdmin();
  const scope = await currentScope();

  const raw = Object.fromEntries(formData.entries());
  const theme = parseThemeSettings(raw);
  const existing = scope === "platform" ? await themes.getPlatformDefault() : (await themes.getTenantOverride(scope)) ?? (await themes.getPlatformDefault());

  const logo = await readLogo(formData.get("logo"));
  if (logo.error) return fail("Fix the highlighted fields.", { logo: logo.error });
  // Keep the saved logo unless a new one was uploaded or the admin asked to remove it.
  const logoUrl = formData.get("removeLogo") === "on" ? "" : (logo.url ?? existing.branding.logoUrl);

  const branding = parseBranding(raw, logoUrl);
  const errors = { ...(theme.ok ? {} : theme.errors), ...(branding.ok ? {} : branding.errors) };
  if (!theme.ok || !branding.ok) return fail("Fix the highlighted fields.", errors);

  const config = { theme: theme.value, branding: branding.value };
  if (scope === "platform") await themes.savePlatformDefault(config);
  else await themes.saveTenantOverride(scope, config);

  revalidatePath("/", "layout");
  return { ok: true, message: scope === "platform" ? "Platform default saved." : "School branding saved." };
}

/** Removes the selected school's override so it inherits the platform default again. */
export async function resetTenantTheme(): Promise<ThemeFormState> {
  await requirePlatformAdmin();
  const scope = await currentScope();
  if (scope === "platform") return fail("Select a school first.");
  await themes.clearTenantOverride(scope);
  revalidatePath("/", "layout");
  return { ok: true, message: "Now using the platform default." };
}

export async function saveThemePreset(_prev: ThemeFormState, formData: FormData): Promise<ThemeFormState> {
  await requirePlatformAdmin();
  const scope = await currentScope();
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

export async function deleteThemePreset(id: string): Promise<ThemeFormState> {
  await requirePlatformAdmin();
  if (!/^[A-Za-z0-9-]{1,64}$/.test(id)) return fail("That preset is not valid.");
  await themes.deletePreset(await currentScope(), id);
  revalidatePath("/", "layout");
  return { ok: true };
}
