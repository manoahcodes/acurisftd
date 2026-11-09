import Link from "next/link";
import { Suspense } from "react";
import { Plus } from "lucide-react";
import {
  ROLES,
  resolveQuickAction,
  resolveUserMenu,
  type RoleKey,
} from "@/config/navigation";
import type { ModePreference } from "@/lib/theme/mode";
import type { TenantContext } from "@/types/dashboard";
import { AcademicYearControl } from "./academic-year-control";
import { ChildControl } from "./child-control";
import { MobileNav } from "./mobilenav";
import { NotificationsControl } from "./notifications-control";
import { RoleSwitcher } from "./role-switcher";
import { SidebarBody } from "./sidebar-body";
import { SidebarBrand, type ShellBrand } from "./sidebar-brand";
import { ThemeModeSwitch } from "./theme-mode-switch";
import { TopbarSearch } from "./topbarsearch";
import { UserMenu } from "./usermenu";

export function Topbar({
  role,
  userName,
  brand,
  tenant,
  modePreference,
}: {
  role: RoleKey;
  userName: string;
  brand: ShellBrand;
  tenant: TenantContext;
  /** Which colour-mode option to show as selected. */
  modePreference: ModePreference;
}) {
  const { label: roleLabel, topbar } = ROLES[role];
  const { searchPlaceholder, context, childSwitcher } = topbar;
  const quickAction = resolveQuickAction(role);
  const showDevTools = process.env.NODE_ENV !== "production";

  const drawerSkeleton = <div className="h-10 rounded-lg bg-white/10" aria-hidden />;
  const hasDrawerContext = Boolean(childSwitcher) || context.kind !== "none";

  // What the mobile drawer shows in place of the controls hidden below md.
  // From md up the top bar shows them itself, so the drawer hides its copy.
  const drawerContext = hasDrawerContext ? (
    <div className="space-y-2 md:hidden">
      {childSwitcher && (
        <Suspense fallback={drawerSkeleton}>
          <ChildControl variant="drawer" />
        </Suspense>
      )}
      {context.kind === "academicYear" && (
        <Suspense fallback={drawerSkeleton}>
          <AcademicYearControl variant="drawer" />
        </Suspense>
      )}
      {context.kind === "scope" && (
        <div className="rounded-lg bg-white/10 px-3 py-2 text-sm text-white/90">
          {context.label}
        </div>
      )}
    </div>
  ) : null;

  return (
    <header className="flex h-[72px] shrink-0 items-center gap-2 border-b border-line bg-surface px-4 sm:gap-4 sm:px-6 lg:px-8">
      <MobileNav
        brand={<SidebarBrand role={role} userName={userName} brand={brand} />}
        contextSlot={drawerContext}
      >
        <SidebarBody role={role} tenant={tenant} />
      </MobileNav>

      <TopbarSearch role={role} placeholder={searchPlaceholder} />

      {showDevTools && <RoleSwitcher role={role} />}

      {childSwitcher && (
        <Suspense
          fallback={
            <div className="hidden h-10 w-32 rounded-lg bg-canvas md:block" aria-hidden />
          }
        >
          <ChildControl variant="bar" />
        </Suspense>
      )}

      {context.kind === "academicYear" && (
        <Suspense
          fallback={
            <div className="hidden h-10 w-44 rounded-lg bg-canvas md:block" aria-hidden />
          }
        >
          <AcademicYearControl variant="bar" />
        </Suspense>
      )}

      {context.kind === "scope" && (
        <span className="hidden rounded-lg bg-canvas px-3 py-2 text-[15px] font-medium text-ink md:inline-block">
          {context.label}
        </span>
      )}

      {quickAction && (
        <Link
          href={quickAction.href}
          className="hidden items-center gap-2 rounded-lg bg-brand px-4 py-2 text-[15px] font-semibold text-on-brand hover:opacity-90 xl:inline-flex"
        >
          <Plus size={16} aria-hidden />
          {quickAction.label}
        </Link>
      )}

      <ThemeModeSwitch selected={modePreference} />

      <Suspense fallback={<div className="size-10" aria-hidden />}>
        <NotificationsControl role={role} />
      </Suspense>

      <UserMenu
        userName={userName}
        roleLabel={roleLabel}
        entries={resolveUserMenu(role)}
      />
    </header>
  );
}