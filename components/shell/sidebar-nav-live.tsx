import type { RoleKey } from "@/config/navigation";
import { getNavBadges } from "@/server/queries/sidebar";
import { getPlatformTerms } from "@/server/queries/platform";
import { SidebarNav } from "./sidebar-nav";

/**
 * The nav with live badge counts. Used inside <Suspense> in the sidebar body.
 * For the School Admin the wording also follows the selected school
 * (Term vs Semester), which is read from a cookie, hence the Suspense.
 */
export async function SidebarNavLive({ role }: { role: RoleKey }) {
  const [counts, terms] = await Promise.all([
    getNavBadges(role),
    role === "school-admin" ? getPlatformTerms() : undefined,
  ]);
  return <SidebarNav role={role} counts={counts} terms={terms} />;
}
