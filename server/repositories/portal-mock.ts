import { loadSnapshot, saveSnapshot } from "../persistence/store";
import { applyPortalOverride } from "@/lib/portal/merge";
import type { PortalContent, PortalOverride } from "@/types/portal";
import { DEFAULT_PORTAL, type PortalRepository } from "./portal-types";

type Store = { platform: PortalContent; tenants: Map<string, PortalOverride> };
type Saved = { platform: PortalContent; tenants: Array<[string, PortalOverride]> };

const KEY = "portal";

function initial(): Store {
  const saved = loadSnapshot<Saved>(KEY);
  return {
    platform: saved?.platform ?? structuredClone(DEFAULT_PORTAL),
    tenants: new Map<string, PortalOverride>(saved?.tenants ?? []),
  };
}

// Kept on globalThis so a dev-server reload does not wipe what was saved.
const g = globalThis as unknown as { __acurisPortal?: Store };
const store = (g.__acurisPortal ??= initial());
const save = () => saveSnapshot(KEY, { platform: store.platform, tenants: [...store.tenants] } satisfies Saved);

// Stored copies are replaced, never mutated; defaults sit underneath every read so a field added later is never undefined.
const full = (c: PortalContent): PortalContent => ({ ...structuredClone(DEFAULT_PORTAL), ...structuredClone(c) });

export const mockPortalRepository: PortalRepository = {
  async resolve(tenantId) {
    return applyPortalOverride(full(store.platform), store.tenants.get(tenantId));
  },
  async getPlatformDefault() {
    return full(store.platform);
  },
  async getTenantOverride(tenantId) {
    const o = store.tenants.get(tenantId);
    return o ? structuredClone(o) : undefined;
  },
  async savePlatformDefault(content) {
    store.platform = structuredClone(content);
    save();
  },
  async saveTenantOverride(tenantId, override) {
    store.tenants.set(tenantId, structuredClone(override));
    save();
  },
  async clearTenantOverride(tenantId) {
    store.tenants.delete(tenantId);
    save();
  },
};

/** Test helper: back to the built-in defaults. */
export function resetMockPortal() {
  store.platform = structuredClone(DEFAULT_PORTAL);
  store.tenants.clear();
  save();
}
