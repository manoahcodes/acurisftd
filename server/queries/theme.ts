import { cache } from "react";
import type { RoleKey } from "@/config/navigation";
import { themes } from "@/server/repositories";
import { getTenantContext } from "@/server/request-context";
import type { ThemeConfig, ThemePreset, ThemeScope } from "@/types/theme";
import { getTenantSelection } from "./platform";

/**
 * The theme the shell should render for this role. Platform Admins see the
 * school they are working in (or the platform default); everyone else sees
 * their own school's theme. Reads cookies/session, so call it inside <Suspense>.
 */
export const getResolvedTheme = cache(async (role: RoleKey): Promise<ThemeConfig> => {
  if (role === "platform") {
    const { selected } = await getTenantSelection();
    return selected ? themes.resolve({ tenantId: selected.id }) : themes.getPlatformDefault();
  }
  return themes.resolve(await getTenantContext());
});

export type ThemeEditorState = {
  scope: ThemeScope;
  scopeLabel: string;
  /** The config being edited: the school's override, else what it inherits. */
  config: ThemeConfig;
  /** True when a school is selected and has no override of its own. */
  inherited: boolean;
  /** The platform default, shown as the "reset to" target. */
  platformDefault: ThemeConfig;
  presets: ThemePreset[];
};

/** Everything the editor needs for the current Platform Admin selection. */
export const getThemeEditorState = cache(async (): Promise<ThemeEditorState> => {
  const { selected } = await getTenantSelection();
  const platformDefault = await themes.getPlatformDefault();
  if (!selected) {
    return {
      scope: "platform",
      scopeLabel: "Platform default",
      config: platformDefault,
      inherited: false,
      platformDefault,
      presets: await themes.listPresets("platform"),
    };
  }
  const override = await themes.getTenantOverride(selected.id);
  return {
    scope: selected.id,
    scopeLabel: selected.name,
    config: override ?? platformDefault,
    inherited: !override,
    platformDefault,
    presets: await themes.listPresets(selected.id),
  };
});
