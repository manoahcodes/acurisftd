"use client";

import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/format";
import { NavLink } from "./nav-link";
import { NavIcon, type IconName } from "./nav-icons";
import { RailTooltip } from "./rail-tooltip";
import { SidebarStateContext, useSidebarState } from "./sidebar-state";

export type NavGroupItem = { href: string; label: string; icon: IconName; badge?: number };

/**
 * Expandable sidebar section. It opens by itself when the current page is
 * inside it; a manual toggle only holds until the user navigates.
 * When the sidebar is collapsed to its icon rail the section becomes one icon
 * that opens a small menu of its links beside the rail.
 */
export function NavGroup({
  label,
  icon,
  items,
}: {
  label: string;
  icon: IconName;
  items: NavGroupItem[];
}) {
  const pathname = usePathname();
  const { collapsed, expand } = useSidebarState();
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [manual, setManual] = useState<{ path: string; open: boolean } | null>(null);
  // Rail menu: where it sits, and the page it was opened on (navigating closes it).
  const [flyout, setFlyout] = useState<{ path: string; top: number; left: number } | null>(null);

  const hasActive = items.some(
    (i) => pathname === i.href || pathname.startsWith(`${i.href}/`),
  );
  const open = manual && manual.path === pathname ? manual.open : hasActive;
  const pending = items.reduce((sum, i) => sum + (i.badge && i.badge > 0 ? i.badge : 0), 0);
  const flyoutOpen = collapsed && flyout !== null && flyout.path === pathname;

  useEffect(() => {
    if (!flyoutOpen) return;

    const close = () => setFlyout(null);
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
        buttonRef.current?.focus();
      }
    };
    const onFocusIn = (e: FocusEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close();
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("focusin", onFocusIn);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("focusin", onFocusIn);
      window.removeEventListener("resize", close);
    };
  }, [flyoutOpen]);

  if (collapsed) {
    const toggleFlyout = () => {
      if (flyoutOpen) {
        setFlyout(null);
        return;
      }
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      setFlyout({ path: pathname, top: Math.max(8, rect.top), left: rect.right + 8 });
    };

    return (
      <div ref={rootRef} className="relative">
        {/* The menu already names the group, so no tooltip while it is open. */}
        <RailTooltip
          label={label}
          detail={pending > 0 ? `${pending} pending` : undefined}
          suppressed={flyoutOpen}
        >
          <button
            ref={buttonRef}
            type="button"
            aria-haspopup="true"
            aria-expanded={flyoutOpen}
            aria-controls={panelId}
            onClick={toggleFlyout}
            className={cn(
              "relative flex w-full items-center justify-center rounded-lg py-3 transition-colors hover:bg-navy-raised hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
              hasActive || flyoutOpen ? "bg-navy-raised text-white" : "text-slate-200",
            )}
          >
            <NavIcon name={icon} size={20} />
            <span className="sr-only">{label}</span>
            {pending > 0 && (
              <>
                <span
                  aria-hidden
                  className="absolute right-2 top-2 size-2.5 rounded-full bg-brand ring-2 ring-navy"
                />
                <span className="sr-only">, {pending} pending</span>
              </>
            )}
          </button>
        </RailTooltip>

        {flyoutOpen && flyout && (
          // Fixed, so the sidebar's own scrolling cannot clip it. Links inside
          // render in their normal, expanded look.
          <SidebarStateContext.Provider value={{ collapsed: false, expand }}>
            <div
              id={panelId}
              role="group"
              aria-label={label}
              style={{
                top: flyout.top,
                left: flyout.left,
                maxHeight: `calc(100dvh - ${flyout.top}px - 8px)`,
              }}
              className="fixed z-50 w-64 overflow-y-auto rounded-xl border border-navy-line bg-navy p-2 shadow-lg"
            >
              <p className="px-3 pb-1 pt-1.5 text-xs font-semibold uppercase tracking-wider text-accent">
                {label}
              </p>
              <div className="flex flex-col gap-1">
                {items.map((item) => (
                  <NavLink
                    key={item.href}
                    href={item.href}
                    label={item.label}
                    icon={item.icon}
                    badge={item.badge}
                    compact
                  />
                ))}
              </div>
            </div>
          </SidebarStateContext.Provider>
        )}
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setManual({ path: pathname, open: !open })}
        className={cn(
          "flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-[15px] transition-colors hover:bg-navy-raised hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
          hasActive ? "font-semibold text-white" : "text-slate-200",
        )}
      >
        <NavIcon name={icon} />
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <span className="flex shrink-0 items-center gap-2">
          {!open && pending > 0 && (
            <>
              <span
                aria-hidden
                className="min-w-6 rounded-full bg-brand px-2 py-0.5 text-center text-xs font-semibold text-on-brand"
              >
                {pending > 99 ? "99+" : pending}
              </span>
              <span className="sr-only">, {pending} pending</span>
            </>
          )}
          <ChevronDown
            size={14}
            aria-hidden
            className={cn("transition-transform", open && "rotate-180")}
          />
        </span>
      </button>

      <div
        id={panelId}
        hidden={!open}
        className="ml-4 mt-1 flex flex-col gap-1 border-l border-navy-line pl-2"
      >
        {items.map((item) => (
          <NavLink
            key={item.href}
            href={item.href}
            label={item.label}
            icon={item.icon}
            badge={item.badge}
            compact
          />
        ))}
      </div>
    </div>
  );
}
