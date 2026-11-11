import { cache } from "react";
import { cookies } from "next/headers";
import { tenantTermsType, termsFor, type Division, type Terminology } from "@/config/institution";
import { PLATFORM_DIVISION_COOKIE, PLATFORM_TENANT_COOKIE } from "@/lib/platform-tenant";
import { DEPLOYMENT_MODE } from "@/config/deployment";
import { resolveSelection } from "@/lib/tenant-selection";
import { session, tenantDirectory } from "@/server/repositories";
import type { TenantSummary } from "@/types/platform";

export type TenantSelection = {
  tenants: TenantSummary[];
  /** The school the Platform Admin picked, or undefined for the platform-wide view. */
  selected: TenantSummary | undefined;
  /**
   * The division picked within that school. Undefined means "all divisions",
   * which is also the only option for a school with a single division.
   */
  division: Division | undefined;
};

/**
 * Every school plus the one the Platform Admin picked. A cookie naming an
 * unknown school is ignored.
 * Reads the cookie, so call it inside a <Suspense> boundary.
 */
export const getTenantSelection = cache(async (): Promise<TenantSelection> => {
  const [all, user, store] = await Promise.all([tenantDirectory.list(), session.getCurrentUser(), cookies()]);
  return resolveSelection(
    DEPLOYMENT_MODE,
    all,
    user.tenant.tenantId,
    store.get(PLATFORM_TENANT_COOKIE)?.value,
    store.get(PLATFORM_DIVISION_COOKIE)?.value,
  );
});

/** Term/Semester wording for the selected school (neutral when none is selected). */
export const getPlatformTerms = cache(async (): Promise<Terminology> => {
  const { selected } = await getTenantSelection();
  return termsFor(selected && tenantTermsType(selected.divisions));
});
