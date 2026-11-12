import { Suspense } from "react";
import { ROLES, type RoleKey } from "@/config/navigation";
import type { TenantContext } from "@/types/dashboard";
import { CampusControl } from "./campus-control";
import { isMultiTenant } from "@/config/deployment";
import { PREVIEW_SELECTED_SCHOOL } from "@/lib/theme/scope";
import { DemoSchoolControl } from "./demo-school-control";
import { PlatformTenantControl } from "./platform-tenant-control";
import { SidebarFooter } from "./sidebar-footer";
import { SidebarNav } from "./sidebar-nav";
import { SidebarNavLive } from "./sidebar-nav-live";
import { StaticTenantCard } from "./tenant-card";

/**
 * Tenant card, primary nav and footer. Rendered in the desktop sidebar and, as
 * the same element, inside the mobile drawer, so the two can never drift apart.
 */
export function SidebarBody({
  role,
  tenant,
  copyrightHolder,
  timeZone,
}: {
  role: RoleKey;
  tenant: TenantContext;
  /** Name for the school's copyright line, or "" for none (see lib/theme/copyright.ts). */
  copyrightHolder: string;
  timeZone?: string;
}) {
  const config = ROLES[role];

  return (
    <>
      <div className="mt-5">
        {role !== "platform" && PREVIEW_SELECTED_SCHOOL && (
          <Suspense fallback={null}>
            <DemoSchoolControl tenant={tenant} />
          </Suspense>
        )}
        {role === "platform" && isMultiTenant() ? (
          // A platform admin spans every school, so they pick which school to work in
          // (or stay platform-wide) instead of seeing a single campus.
          <Suspense
            fallback={<StaticTenantCard title="All tenants" subtitle="Platform-wide view" />}
          >
            <PlatformTenantControl />
          </Suspense>
        ) : config.campusSwitcher ? (
          // Staff who may work at several campuses can switch between them.
          <Suspense
            fallback={<StaticTenantCard title={tenant.tenantName} subtitle={tenant.campus} />}
          >
            <CampusControl tenant={tenant} />
          </Suspense>
        ) : (
          // Students and parents: a fixed card, nothing to switch.
          <StaticTenantCard title={tenant.tenantName} subtitle={tenant.campus} />
        )}
      </div>

      <div className="mt-7 px-3 text-xs font-semibold uppercase tracking-wider text-accent group-data-[collapsed=true]/sidebar:hidden">
        Workspace
      </div>
      {/* In the collapsed rail a thin rule replaces the heading. */}
      <div
        aria-hidden
        className="mx-2 my-4 hidden border-t border-navy-line group-data-[collapsed=true]/sidebar:block"
      />

      {/* Links show at once; badge counts fill in when they load. */}
      <Suspense fallback={<SidebarNav role={role} />}>
        <SidebarNavLive role={role} />
      </Suspense>

      <SidebarFooter copyrightHolder={copyrightHolder} timeZone={timeZone} />
    </>
  );
}