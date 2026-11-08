"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/format";
import { NavIcon, type IconName } from "./nav-icons";
import { RailTooltip } from "./rail-tooltip";
import { useSidebarState } from "./sidebar-state";

export function NavLink({
  href,
  label,
  icon,
  exact,
  badge,
  compact,
}: {
  href: string;
  label: string;
  icon: IconName;
  exact?: boolean;
  /** Pending items for this section. Hidden when missing or 0. */
  badge?: number;
  /** Smaller icon, for links nested inside a group. */
  compact?: boolean;
}) {
  const pathname = usePathname();
  const { collapsed } = useSidebarState();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  const count = badge && badge > 0 ? badge : 0;

  return (
    // The rail shows only the icon, so the label moves to a tooltip.
    <RailTooltip label={label} detail={count > 0 ? `${count} pending` : undefined}>
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "relative flex items-center rounded-lg text-[15px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
          collapsed ? "justify-center py-3" : "gap-3 px-4 py-3",
          active
            ? "bg-brand font-semibold text-on-brand"
            : "text-slate-200 hover:bg-navy-raised hover:text-white",
        )}
      >
        <NavIcon name={icon} size={collapsed ? 20 : compact ? 16 : 18} />
        {collapsed ? (
          <span className="sr-only">{label}</span>
        ) : (
          <span className="min-w-0 flex-1 truncate">{label}</span>
        )}
        {count > 0 &&
          (collapsed ? (
            <>
              <span
                aria-hidden
                className={cn(
                  "absolute right-2 top-2 size-2.5 rounded-full ring-2 ring-navy",
                  active ? "bg-on-brand" : "bg-brand",
                )}
              />
              <span className="sr-only">, {count} pending</span>
            </>
          ) : (
            <>
              <span
                aria-hidden
                className={cn(
                  "min-w-6 shrink-0 rounded-full px-2 py-0.5 text-center text-xs font-semibold",
                  active ? "bg-on-brand text-brand" : "bg-brand text-on-brand",
                )}
              >
                {count > 99 ? "99+" : count}
              </span>
              <span className="sr-only">, {count} pending</span>
            </>
          ))}
      </Link>
    </RailTooltip>
  );
}
