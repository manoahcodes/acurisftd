import type { ThemeConfig, ThemeOverride } from "@/types/theme";

const entries = <T extends object>(o: T) => Object.entries(o) as [keyof T, T[keyof T]][];

/** The settings in `next` that differ from `base`. Unchanged settings are left out so they keep following the base. */
export function diffConfig(base: ThemeConfig, next: ThemeConfig): ThemeOverride {
  const theme: Record<string, unknown> = {};
  const branding: Record<string, unknown> = {};
  for (const [k, v] of entries(next.theme)) if (v !== base.theme[k]) theme[k] = v;
  for (const [k, v] of entries(next.branding)) if (v !== base.branding[k]) branding[k] = v;
  return { theme, branding } as ThemeOverride;
}

/** The base with the school's own changes laid on top. */
export function applyOverride(base: ThemeConfig, override: ThemeOverride | undefined): ThemeConfig {
  if (!override) return { theme: { ...base.theme }, branding: { ...base.branding } };
  return {
    theme: { ...base.theme, ...override.theme },
    branding: { ...base.branding, ...override.branding },
  };
}

export const isEmptyOverride = (o: ThemeOverride) =>
  Object.keys(o.theme).length === 0 && Object.keys(o.branding).length === 0;
