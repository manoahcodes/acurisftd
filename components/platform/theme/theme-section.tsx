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
export async function ThemeSection({ area }: { area: "platform" | "school" }) {
  const s = await getThemeEditorState(area);
  const zones = timezones();
  if (!zones.includes(s.config.branding.timezone)) zones.unshift(s.config.branding.timezone);
  return (
    <ThemeEditor
      // A new key resets the editor's local state when the workspace changes.
      key={`${s.scope}:${s.inherited}`}
      scopeLabel={s.scopeLabel}
      isTenant={s.scope !== "platform"}
      area={area}
      inherited={s.inherited}
      theme={s.config.theme}
      branding={s.config.branding}
      presets={s.presets}
      timezones={zones}
    />
  );
}
