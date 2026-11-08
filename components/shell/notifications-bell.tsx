"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { cn } from "@/lib/format";
import type { NotificationSummary } from "@/types/topbar";

export function NotificationsBell({ summary }: { summary: NotificationSummary }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  const count = summary.unreadCount;
  const badge = count > 9 ? "9+" : String(count);
  const label = count === 0 ? "Notifications" : `Notifications, ${count} unread`;

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    // Tabbing out of the panel closes it.
    const onFocusIn = (e: FocusEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("focusin", onFocusIn);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("focusin", onFocusIn);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={label}
        onClick={() => setOpen((v) => !v)}
        className="relative flex size-10 items-center justify-center rounded-lg text-ink hover:bg-canvas"
      >
        <Bell size={20} aria-hidden />
        {count > 0 && (
          <span
            aria-hidden
            className="absolute right-1 top-1 flex min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-semibold leading-4 text-white"
          >
            {badge}
          </span>
        )}
      </button>

      {open && (
        <div
          id={panelId}
          className="fixed inset-x-4 top-[76px] z-50 overflow-hidden rounded-xl border border-line bg-surface shadow-lg sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96"
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <div className="text-[15px] font-semibold text-ink">Notifications</div>
            {count > 0 && <div className="text-sm text-muted">{count} unread</div>}
          </div>

          {summary.items.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted">
              You&apos;re all caught up.
            </p>
          ) : (
            <ul className="max-h-96 overflow-y-auto py-1">
              {summary.items.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-canvas"
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "mt-1.5 size-2 shrink-0 rounded-full",
                        item.unread ? "bg-brand" : "bg-transparent",
                      )}
                    />
                    <span className="min-w-0">
                      <span
                        className={cn(
                          "block truncate text-[15px] text-ink",
                          item.unread ? "font-semibold" : "font-medium",
                        )}
                      >
                        {item.title}
                      </span>
                      <span className="block truncate text-sm text-muted">
                        {item.detail}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}