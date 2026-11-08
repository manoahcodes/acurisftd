import type { Division, InstitutionType } from "@/config/institution";
import type { PlatformScreen, TenantSummary } from "@/types/platform";

/**
 * What a Platform Admin screen is built for: the school they selected (or null
 * for the platform-wide view) plus every school, for cross-tenant roll-ups.
 */
export type PlatformContext = {
  tenant: TenantSummary | null;
  /**
   * The division picked within the tenant. Null means all divisions (and is
   * always null for a tenant with a single division).
   */
  division: Division | null;
  tenants: TenantSummary[];
};

/**
 * Every school on the platform. Platform Admin only: the real implementation
 * must check the session's role, because this list crosses tenant boundaries.
 */
export interface TenantDirectory {
  list(): Promise<TenantSummary[]>;
  /** Adds a school. Throws if its divisions do not share one academic system. */
  create(input: NewTenant): Promise<TenantSummary>;
  /** Changes a school's details. Its divisions are fixed once created. */
  update(id: string, changes: Partial<Pick<TenantSummary, "name" | "plan" | "status" | "campuses">>): Promise<TenantSummary | undefined>;
}

export type NewTenant = Pick<TenantSummary, "name" | "plan" | "status" | "campuses"> & {
  /** At least one institution type; each becomes a division. */
  types: InstitutionType[];
};

export interface PlatformScreenRepository {
  /**
   * `slug` is the page's path below /platform, e.g. "finances/tuition-fees".
   * Returns undefined for pages that have no screen yet.
   * When ctx.tenant is set, scope every query to that tenant. When it is null,
   * return platform-wide aggregates (only for pages whose scope is "either").
   */
  getScreen(ctx: PlatformContext, slug: string): Promise<PlatformScreen | undefined>;
}
