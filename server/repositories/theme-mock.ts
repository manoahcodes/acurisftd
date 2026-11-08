import { randomUUID } from "node:crypto";
import type { ThemeConfig, ThemePreset } from "@/types/theme";
import { DEFAULT_BRANDING, DEFAULT_THEME, type ThemeRepository } from "./theme-types";

type Store = {
  platform: ThemeConfig;
  tenants: Map<string, ThemeConfig>;
  presets: Map<string, ThemePreset[]>;
};

// Kept on globalThis so a dev-server reload does not wipe what was saved.
const g = globalThis as unknown as { __acurisTheme?: Store };
const store = (g.__acurisTheme ??= {
  platform: { theme: { ...DEFAULT_THEME }, branding: { ...DEFAULT_BRANDING } },
  tenants: new Map<string, ThemeConfig>(),
  presets: new Map<string, ThemePreset[]>(),
});

// Stored copies are replaced, never mutated, so a cached read never shows half a save.
const copy = (c: ThemeConfig): ThemeConfig => ({ theme: { ...c.theme }, branding: { ...c.branding } });

export const mockThemeRepository: ThemeRepository = {
  async resolve(ctx) {
    return copy(store.tenants.get(ctx.tenantId) ?? store.platform);
  },
  async getPlatformDefault() {
    return copy(store.platform);
  },
  async getTenantOverride(tenantId) {
    const c = store.tenants.get(tenantId);
    return c ? copy(c) : undefined;
  },
  async savePlatformDefault(config) {
    store.platform = copy(config);
  },
  async saveTenantOverride(tenantId, config) {
    store.tenants.set(tenantId, copy(config));
  },
  async clearTenantOverride(tenantId) {
    store.tenants.delete(tenantId);
  },
  async listPresets(scope) {
    return (store.presets.get(scope) ?? []).map((p) => ({ ...p, theme: { ...p.theme } }));
  },
  async savePreset(scope, name, theme) {
    const preset: ThemePreset = { id: randomUUID(), name, theme: { ...theme } };
    store.presets.set(scope, [...(store.presets.get(scope) ?? []), preset]);
    return preset;
  },
  async deletePreset(scope, id) {
    store.presets.set(scope, (store.presets.get(scope) ?? []).filter((p) => p.id !== id));
  },
};

/** Test helper: back to the built-in defaults. */
export function resetMockTheme() {
  store.platform = { theme: { ...DEFAULT_THEME }, branding: { ...DEFAULT_BRANDING } };
  store.tenants.clear();
  store.presets.clear();
}
