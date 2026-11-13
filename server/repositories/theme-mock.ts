import { randomUUID } from "node:crypto";
import { loadSnapshot, saveSnapshot } from "../persistence/store";
import { applyOverride } from "@/lib/theme/merge";
import type { ThemeConfig, ThemeOverride, ThemePreset } from "@/types/theme";
import { DEFAULT_BRANDING, DEFAULT_THEME, type ThemeRepository } from "./theme-types";

type Store = {
  platform: ThemeConfig;
  tenants: Map<string, ThemeOverride>;
  presets: Map<string, ThemePreset[]>;
};

const KEY = "theme";
type Saved = { platform: ThemeConfig; tenants: Array<[string, ThemeOverride]>; presets: Array<[string, ThemePreset[]]> };

function initial(): Store {
  const saved = loadSnapshot<Saved>(KEY);
  return {
    platform: saved?.platform ?? { theme: { ...DEFAULT_THEME }, branding: { ...DEFAULT_BRANDING } },
    tenants: new Map<string, ThemeOverride>(saved?.tenants ?? []),
    presets: new Map<string, ThemePreset[]>(saved?.presets ?? []),
  };
}

// Kept on globalThis so a dev-server reload does not wipe what was saved.
const g = globalThis as unknown as { __acurisTheme?: Store };
const store = (g.__acurisTheme ??= initial());
const save = () => saveSnapshot(KEY, { platform: store.platform, tenants: [...store.tenants], presets: [...store.presets] } satisfies Saved);

// Stored copies are replaced, never mutated, so a cached read never shows half a save.
// Defaults are laid underneath on every read, so a setting added after something was
// saved (the dev server keeps the old store across reloads) never comes back undefined.
const copy = (c: ThemeConfig): ThemeConfig => ({
  theme: { ...DEFAULT_THEME, ...c.theme },
  branding: { ...DEFAULT_BRANDING, ...c.branding },
});
const copyOverride = (o: ThemeOverride): ThemeOverride => ({ theme: { ...o.theme }, branding: { ...o.branding } });

export const mockThemeRepository: ThemeRepository = {
  async resolve(ctx) {
    return applyOverride(copy(store.platform), store.tenants.get(ctx.tenantId));
  },
  async getPlatformDefault() {
    return copy(store.platform);
  },
  async getTenantOverride(tenantId) {
    const o = store.tenants.get(tenantId);
    return o ? copyOverride(o) : undefined;
  },
  async savePlatformDefault(config) {
    store.platform = copy(config);
    save();
  },
  async saveTenantOverride(tenantId, override) {
    store.tenants.set(tenantId, copyOverride(override));
    save();
  },
  async clearTenantOverride(tenantId) {
    store.tenants.delete(tenantId);
    save();
  },
  async listPresets(scope) {
    return (store.presets.get(scope) ?? []).map((p) => ({ ...p, theme: { ...p.theme } }));
  },
  async savePreset(scope, name, theme) {
    const preset: ThemePreset = { id: randomUUID(), name, theme: { ...theme } };
    store.presets.set(scope, [...(store.presets.get(scope) ?? []), preset]);
    save();
    return preset;
  },
  async deletePreset(scope, id) {
    store.presets.set(scope, (store.presets.get(scope) ?? []).filter((p) => p.id !== id));
    save();
  },
};

/** Test helper: back to the built-in defaults. */
export function resetMockTheme() {
  store.platform = { theme: { ...DEFAULT_THEME }, branding: { ...DEFAULT_BRANDING } };
  store.tenants.clear();
  store.presets.clear();
  save();
}
