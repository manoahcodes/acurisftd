import { cache } from "react";
import type { RoleKey } from "@/config/navigation";
import { dashboardSchoolFor } from "@/lib/dashboard/school";
import { session } from "@/server/repositories";
import type { TenantContext } from "@/types/dashboard";
import { getTenantSelection } from "./platform";

/**
 * The school the dashboard for this role describes (see lib/dashboard/school.ts).
 * `undefined` is the Platform Admin's platform-wide view. Reads cookies, so call
 * it inside <Suspense>.
 */
export const getDashboardSchool = cache(async (role: RoleKey): Promise<TenantContext | undefined> => {
  const user = await session.getCurrentUser();
  const { selected, division } = await getTenantSelection();
  return dashboardSchoolFor(role, user.tenant, selected, division);
});
