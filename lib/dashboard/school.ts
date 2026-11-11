import { divisionsLabel, type Division } from "@/config/institution";
import type { RoleKey } from "@/config/navigation";
import { PREVIEW_SELECTED_SCHOOL, themeTenantFor } from "@/lib/theme/scope";
import type { TenantContext } from "@/types/dashboard";
import type { TenantSummary } from "@/types/platform";

/**
 * The school a role's dashboard should describe, as a TenantContext.
 *
 * - Platform Admin follows the sidebar selection; `undefined` means the
 *   platform-wide view (no school selected).
 * - Other roles use their own school, or the demo-selected one while
 *   PREVIEW_SELECTED_SCHOOL is on (same rule as the theme).
 * - A selected division decides the wording; otherwise the first division does
 *   (all divisions of a school share one academic system anyway).
 */
export function dashboardSchoolFor(
  role: RoleKey,
  own: TenantContext,
  selected: TenantSummary | undefined,
  division: Division | undefined,
  preview: boolean = PREVIEW_SELECTED_SCHOOL,
): TenantContext | undefined {
  const tenantId = themeTenantFor(role, own.tenantId, selected?.id, preview);
  if (!tenantId) return undefined;
  if (!selected || selected.id !== tenantId) return own;
  const type = (division ?? selected.divisions[0])?.institutionType ?? own.institutionType;
  return {
    tenantId: selected.id,
    tenantName: selected.name,
    campus:
      selected.id === own.tenantId
        ? own.campus
        : selected.campuses > 1
          ? `${selected.campuses} campuses`
          : "Main Campus",
    institutionType: type,
    learners: selected.learners,
    campusCount: selected.campuses,
    divisionsLabel: division ? division.name : divisionsLabel(selected.divisions),
    plan: selected.plan,
    status: selected.status,
  };
}
