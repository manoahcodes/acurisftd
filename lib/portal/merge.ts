import type { PortalContent, PortalOverride } from "@/types/portal";

const KEYS: (keyof PortalContent)[] = ["websiteUrl", "nav", "hero", "about", "features", "signIn", "register", "footerNote"];
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const clone = <T,>(v: T): T => structuredClone(v);

/** The base with the school's own sections laid on top. Sections are replaced whole, never half-merged. */
export function applyPortalOverride(base: PortalContent, override: PortalOverride | undefined): PortalContent {
  const out = clone(base) as Record<string, unknown>;
  if (override) for (const k of KEYS) if (override[k] !== undefined) out[k] = clone(override[k]);
  return out as PortalContent;
}

/** Only the sections of `next` that differ from `base`, so the rest keep following the platform default. */
export function diffPortal(base: PortalContent, next: PortalContent): PortalOverride {
  const out: Record<string, unknown> = {};
  for (const k of KEYS) if (!same(base[k], next[k])) out[k] = clone(next[k]);
  return out as PortalOverride;
}

export const isEmptyPortalOverride = (o: PortalOverride) => Object.keys(o).length === 0;
