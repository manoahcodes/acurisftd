"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { GripVertical, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/format";
import {
  SIDEBAR_COLLAPSED_COOKIE,
  SIDEBAR_COLLAPSED_WIDTH,
  SIDEBAR_COOKIE,
  SIDEBAR_MAX,
  SIDEBAR_MIN,
  clampSidebarWidth,
} from "@/lib/sidebar-width";
import { RailTooltip } from "./rail-tooltip";
import { SidebarStateContext } from "./sidebar-state";

const KEY_STEP = 16;
const KEY_STEP_BIG = 48;

const setCookie = (name: string, value: string | number) => {
  document.cookie = `${name}=${value}; path=/; max-age=31536000; samesite=lax`;
};

/**
 * Desktop sidebar that can be resized and collapsed.
 *
 * Resize: drag the handle on the right edge, or focus it and use Left/Right
 * (Shift for bigger steps). Double-click or Enter fits the width to the longest
 * visible text. Home / End jump to the smallest / largest width.
 *
 * Collapse: the button in the header (or Ctrl/Cmd+B) shrinks the sidebar to an
 * icon rail. Parts of the sidebar that need to look different when collapsed
 * use the `group-data-[collapsed=true]/sidebar:` Tailwind variant; client
 * components read the same state through SidebarStateContext.
 *
 * Both settings are saved in cookies when a change ends, and the server reads
 * them back, so there is no jump on the next load.
 */
export function ResizableSidebar({
  initialWidth,
  initialCollapsed,
  header,
  children,
}: {
  initialWidth: number;
  initialCollapsed: boolean;
  /** Brand block at the top, next to the collapse button. */
  header: React.ReactNode;
  children: React.ReactNode;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(initialWidth);
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [dragging, setDragging] = useState(false);

  const commit = (px: number) => {
    const next = clampSidebarWidth(px);
    setWidth(next);
    setCookie(SIDEBAR_COOKIE, next);
  };

  const updateCollapsed = (next: boolean) => {
    setCollapsed(next);
    setCookie(SIDEBAR_COLLAPSED_COOKIE, next ? "1" : "0");
  };

  // Ctrl/Cmd+B toggles the sidebar, except while typing in a field.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || e.key.toLowerCase() !== "b") return;
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      e.preventDefault();
      setCollapsed((current) => {
        setCookie(SIDEBAR_COLLAPSED_COOKIE, current ? "0" : "1");
        return !current;
      });
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  /** Measures the longest line of text the sidebar is showing right now. */
  const fitToContent = () => {
    const box = boxRef.current;
    if (!box) return;
    const aside = box.firstElementChild as HTMLElement | null;
    const previous = box.style.width;
    box.style.width = "max-content";
    const wanted = box.getBoundingClientRect().width;
    box.style.width = previous;
    // max-content leaves out a vertical scrollbar, so add its width back.
    const scrollbar = aside ? aside.offsetWidth - aside.clientWidth : 0;
    commit(wanted + scrollbar);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging || !boxRef.current) return;
    setWidth(clampSidebarWidth(e.clientX - boxRef.current.getBoundingClientRect().left));
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setDragging(false);
    setCookie(SIDEBAR_COOKIE, width);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? KEY_STEP_BIG : KEY_STEP;
    switch (e.key) {
      case "ArrowLeft":
        commit(width - step);
        break;
      case "ArrowRight":
        commit(width + step);
        break;
      case "Home":
        commit(SIDEBAR_MIN);
        break;
      case "End":
        commit(SIDEBAR_MAX);
        break;
      case "Enter":
        fitToContent();
        break;
      default:
        return;
    }
    e.preventDefault();
  };

  const state = useMemo(
    () => ({ collapsed, expand: () => updateCollapsed(false) }),
    // updateCollapsed only uses setters and the cookie helper, so it never changes meaning.
    [collapsed],
  );

  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose;
  const toggleLabel = collapsed ? "Expand sidebar" : "Collapse sidebar";

  return (
    <SidebarStateContext.Provider value={state}>
      <div
        ref={boxRef}
        data-collapsed={collapsed}
        style={{ width: collapsed ? SIDEBAR_COLLAPSED_WIDTH : width }}
        className={cn(
          "group/sidebar relative hidden h-full shrink-0 lg:block",
          // Animate collapsing, but never lag behind the pointer while dragging.
          !dragging && "motion-safe:transition-[width] motion-safe:duration-200",
          dragging && "cursor-col-resize select-none",
        )}
      >
        <aside className="flex h-full w-full flex-col overflow-y-auto bg-navy px-3 py-5">
          <div className="flex items-start justify-between gap-2 group-data-[collapsed=true]/sidebar:flex-col group-data-[collapsed=true]/sidebar:items-center group-data-[collapsed=true]/sidebar:gap-3">
            <div className="min-w-0 flex-1">{header}</div>
            <RailTooltip label={toggleLabel} detail="Ctrl+B" always>
              <button
                type="button"
                onClick={() => updateCollapsed(!collapsed)}
                aria-label={toggleLabel}
                aria-expanded={!collapsed}
                aria-keyshortcuts="Control+B Meta+B"
                className="flex size-9 shrink-0 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-navy-raised hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                <ToggleIcon size={18} strokeWidth={1.75} aria-hidden />
              </button>
            </RailTooltip>
          </div>
          {children}
        </aside>

        {/* The resize handle only exists while the sidebar is expanded. */}
        {!collapsed && (
          <RailTooltip label="Drag to resize" detail="Double-click to fit the text" always suppressed={dragging}>
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize sidebar. Drag, use the arrow keys, or double-click to fit the text."
            aria-valuenow={width}
            aria-valuemin={SIDEBAR_MIN}
            aria-valuemax={SIDEBAR_MAX}
            tabIndex={0}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onDoubleClick={fitToContent}
            onKeyDown={onKeyDown}
            className="group absolute inset-y-0 -right-2 z-30 flex w-4 cursor-col-resize touch-none items-center justify-center focus-visible:outline-none"
          >
            {/* The edge line shows on hover, focus and while dragging. */}
            <span
              aria-hidden
              className={cn(
                "absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-brand opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100",
                dragging && "opacity-100",
              )}
            />
            {/* The visible grip is the resize button. */}
            <span
              aria-hidden
              className={cn(
                "relative flex h-10 w-4 items-center justify-center rounded-full border border-navy-line bg-navy-raised text-slate-300 shadow-sm group-hover:border-brand group-hover:text-white group-focus-visible:border-brand group-focus-visible:text-white group-focus-visible:ring-2 group-focus-visible:ring-brand",
                dragging && "border-brand text-white",
              )}
            >
              <GripVertical size={12} />
            </span>
          </div>
          </RailTooltip>
        )}
      </div>
    </SidebarStateContext.Provider>
  );
}
