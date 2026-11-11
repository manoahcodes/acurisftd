import type { RoleKey } from "@/config/navigation";
import type { CurrentUser, Dashboard, TenantContext } from "@/types/dashboard";

/**
 * The only thing the UI knows about your data. Implement these interfaces
 * against your own database and swap the export in ./index.ts.
 *
 * Every method receives the TenantContext so your implementation can scope
 * every query to the current school. Do not skip this.
 */
export interface DashboardRepository {
  getDashboard(role: RoleKey, ctx?: TenantContext): Promise<Dashboard>;
}

export interface SessionProvider {
  getCurrentUser(): Promise<CurrentUser>;
}
