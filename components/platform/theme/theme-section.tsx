import { getThemeEditorState } from "@/server/queries/theme";
import { ThemeEditor } from "./theme-editor";

function timezones(): string[] {
  try {
    return (Intl as unknown as { supportedValuesOf(k: string): string[] }).supportedValuesOf("timeZone");
  } catch {
    return ["Africa/Lusaka", "UTC"];
  }
}

/** Branding and theme editor for the Platform settings page. Reads cookies: render inside <Suspense>. */
export async function ThemeSection() {
  const s = await getThemeEditorState();
  const zones = timezones();
  if (!zones.includes(s.config.branding.timezone)) zones.unshift(s.config.branding.timezone);
  return (
    <ThemeEditor
      // A new key resets the editor's local state when the Platform Admin switches school.
      key={`${s.scope}:${s.inherited}`}
      scopeLabel={s.scopeLabel}
      isTenant={s.scope !== "platform"}
      inherited={s.inherited}
      theme={s.config.theme}
      branding={s.config.branding}
      presets={s.presets}
      timezones={zones}
    />
  );
}
