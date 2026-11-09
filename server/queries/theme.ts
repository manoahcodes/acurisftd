import { cache } from "react";
import type { RoleKey } from "@/config/navigation";
import { themes } from "@/server/repositories";
import { getTenantContext } from "@/server/request-context";
import type { ThemeConfig, ThemePreset, ThemeScope } from "@/types/theme";
import { applyOverride } from "@/lib/theme/merge";
import { themeTenantFor } from "@/lib/theme/scope";
import { getTenantSelection } from "./platform";

/**
 * The theme and branding the shell should render for this role (see
 * lib/theme/scope.ts for which school that is). Reads cookies/session, so call
 * it inside <Suspense>.
 */
export const getResolvedTheme = cache(async (role: RoleKey): Promise<ThemeConfig> => {
  const own = await getTenantContext();
  const { selected } = role === "platform" ? { selected: undefined } : await getTenantSelection();
  const tenantId = themeTenantFor(role, own.tenantId, selected?.id);
  return tenantId ? themes.resolve({ tenantId }) : themes.getPlatformDefault();
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
    config: applyOverride(platformDefault, override),
    inherited: !override,
    platformDefault,
    presets: await themes.listPresets(selected.id),
  };
});
