"use client";

import { useEffect, useRef, useState } from "react";
import { useSidebarState } from "./sidebar-state";

const HOVER_DELAY_MS = 150;

/**
 * Tooltip that appears to the right of its child, used by the collapsed icon
 * rail where labels are not visible. It shows on hover (after a short delay, so
 * moving down the rail does not flicker) and on keyboard focus.
 *
 * - Only active while the sidebar is collapsed, unless `always` is set.
 * - `suppressed` hides it (for example while the group's menu is open).
 * - It is `position: fixed`, so the sidebar's scrolling cannot clip it.
 * - It is hidden from screen readers: the control already has its own name.
 *
 * The wrapper uses `display: contents`, so it adds no box to the layout. The
 * first child element is the one the tooltip points at.
 */
export function RailTooltip({
  label,
  detail,
  always = false,
  suppressed = false,
  children,
}: {
  label: string;
  /** Optional second line, for example "3 pending". */
  detail?: string;
  always?: boolean;
  suppressed?: boolean;
  children: React.ReactNode;
}) {
  const { collapsed } = useSidebarState();
  const active = (always || collapsed) && !suppressed;
  const wrapRef = useRef<HTMLDivElement>(null);
  const timer = useRef(0);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const hide = () => {
    window.clearTimeout(timer.current);
    setPos(null);
  };

  const show = (delay: number) => {
    window.clearTimeout(timer.current);
    if (!active) return;
    timer.current = window.setTimeout(() => {
      const target = wrapRef.current?.firstElementChild;
      if (!target) return;
      const rect = target.getBoundingClientRect();
      setPos({ top: rect.top + rect.height / 2, left: rect.right + 10 });
    }, delay);
  };

  useEffect(() => () => window.clearTimeout(timer.current), []);

  // A scrolling sidebar would leave the tooltip behind, so hide it on scroll.
  const visible = active && pos !== null;
  useEffect(() => {
    if (!visible) return;
    const onScroll = () => setPos(null);
    window.addEventListener("scroll", onScroll, true);
    return () => window.removeEventListener("scroll", onScroll, true);
  }, [visible]);

  return (
    <div
      ref={wrapRef}
      className="contents"
      onPointerEnter={(e) => {
        if (e.pointerType !== "touch") show(HOVER_DELAY_MS);
      }}
      onPointerLeave={hide}
      onPointerDown={hide}
      onFocus={(e) => {
        // Only for keyboard focus, so clicking a link does not leave a tooltip behind.
        if (e.target.matches(":focus-visible")) show(0);
      }}
      onBlur={hide}
      onKeyDown={(e) => {
        if (e.key === "Escape") hide();
      }}
    >
      {children}
      {visible && pos && (
        <div
          aria-hidden
          style={{ top: pos.top, left: pos.left }}
          className="pointer-events-none fixed z-[70] -translate-y-1/2 whitespace-nowrap rounded-lg bg-navy px-3 py-1.5 text-sm font-medium text-white shadow-lg ring-1 ring-navy-line"
        >
          <span
            aria-hidden
            className="absolute -left-1 top-1/2 size-2 -translate-y-1/2 rotate-45 bg-navy ring-1 ring-navy-line [clip-path:polygon(0_0,0_100%,100%_100%)]"
          />
          <span className="relative">{label}</span>
          {detail && <span className="relative block text-xs font-normal text-slate-300">{detail}</span>}
        </div>
      )}
    </div>
  );
}
