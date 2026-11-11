import { isMultiTenant, type DeploymentMode } from "@/config/deployment";
import type { Division } from "@/config/institution";
import type { TenantSummary } from "@/types/platform";

export type SelectionResult = {
  tenants: TenantSummary[];
  selected: TenantSummary | undefined;
  division: Division | undefined;
};

/**
 * Which schools the admin can see and which one is selected.
 * - cloud: every school; the cookie picks one (an unknown id is ignored).
 * - dedicated / self_hosted: only the deployment's own school, always selected.
 *   The tenant cookie is ignored, so no other school can ever be reached.
 * The division cookie only counts for a school with several divisions.
 */
export function resolveSelection(
  mode: DeploymentMode,
  all: TenantSummary[],
  ownTenantId: string,
  tenantCookie: string | undefined,
  divisionCookie: string | undefined,
): SelectionResult {
  const multi = isMultiTenant(mode);
  const tenants = multi ? all : all.filter((t) => t.id === ownTenantId);
  const selected = multi ? tenants.find((t) => t.id === tenantCookie) : tenants[0];
  const division =
    selected && selected.divisions.length > 1
      ? selected.divisions.find((d) => d.id === divisionCookie)
      : undefined;
  return { tenants, selected, division };
}
