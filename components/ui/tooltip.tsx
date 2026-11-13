"use client";

import { useEffect, useRef, useState } from "react";

const HOVER_DELAY_MS = 250;

/** The look shared by every tooltip: the theme's navy surface (always readable with white text, in light and dark mode). */
export const TOOLTIP_CLASS =
  "pointer-events-none fixed z-[70] whitespace-nowrap rounded-lg bg-navy px-3 py-1.5 text-sm font-medium text-white shadow-lg ring-1 ring-navy-line";

/**
 * A themed replacement for the browser's `title` tooltip, which cannot be
 * styled. Shows above the control (below it near the top of the window) on
 * hover after a short delay and on keyboard focus; Escape hides it.
 * It is hidden from screen readers: give the control its own aria-label.
 * The wrapper is an inline box so a disabled button still receives hover.
 */
export function Tooltip({ label, children }: { label: string; children: React.ReactNode }) {
  const wrapRef = useRef<HTMLSpanElement>(null);
  const timer = useRef(0);
  const [pos, setPos] = useState<{ x: number; y: number; below: boolean } | null>(null);

  const hide = () => {
    window.clearTimeout(timer.current);
    setPos(null);
  };
  const show = (delay: number) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const rect = wrapRef.current?.getBoundingClientRect();
      if (!rect) return;
      const below = rect.top < 48;
      const x = Math.min(Math.max(rect.left + rect.width / 2, 90), window.innerWidth - 90);
      setPos({ x, y: below ? rect.bottom + 8 : rect.top - 8, below });
    }, delay);
  };

  useEffect(() => () => window.clearTimeout(timer.current), []);
  const visible = pos !== null;
  useEffect(() => {
    if (!visible) return;
    const off = () => setPos(null);
    window.addEventListener("scroll", off, true);
    return () => window.removeEventListener("scroll", off, true);
  }, [visible]);

  return (
    <span
      ref={wrapRef}
      className="inline-flex"
      onPointerEnter={(e) => e.pointerType !== "touch" && show(HOVER_DELAY_MS)}
      onPointerLeave={hide}
      onPointerDown={hide}
      onFocus={(e) => e.target.matches(":focus-visible") && show(0)}
      onBlur={hide}
      onKeyDown={(e) => e.key === "Escape" && hide()}
    >
      {children}
      {pos && (
        <span
          aria-hidden
          style={{ top: pos.y, left: pos.x }}
          className={`${TOOLTIP_CLASS} ${pos.below ? "-translate-x-1/2" : "-translate-x-1/2 -translate-y-full"}`}
        >
          {label}
        </span>
      )}
    </span>
  );
}
