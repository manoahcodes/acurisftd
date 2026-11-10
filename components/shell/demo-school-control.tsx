import { divisionsLabel, tenantSystemLabel } from "@/config/institution";
import { getTenantSelection } from "@/server/queries/platform";
import type { TenantContext } from "@/types/dashboard";
import { TenantSwitcher, type TenantOption } from "./tenant-switcher";

/**
 * DEMO ONLY (see PREVIEW_SELECTED_SCHOOL in lib/theme/scope.ts). The mock
 * session has no login, so nothing says which school a teacher, bursar,
 * parent or student belongs to. This lets each browser pick the school whose
 * branding it should show. The choice is stored in that browser only.
 * Remove it together with the flag once real sessions carry the user's school.
 */
export async function DemoSchoolControl({ tenant }: { tenant: TenantContext }) {
  const { tenants, selected } = await getTenantSelection();

  const options: TenantOption[] = [
    { id: "all", name: "My own school", detail: tenant.tenantName },
    ...tenants.map((t) => ({
      id: t.id,
      name: t.name,
      detail: `${divisionsLabel(t.divisions)} · ${tenantSystemLabel(t.divisions)}`,
    })),
  ];

  return (
    <div className="mb-3">
      <div className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-accent group-data-[collapsed=true]/sidebar:hidden">
        Demo: view as school
      </div>
      <TenantSwitcher options={options} selectedId={selected?.id ?? "all"} />
    </div>
  );
}
