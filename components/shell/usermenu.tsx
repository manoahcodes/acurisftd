"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, LogOut } from "lucide-react";
import { cn } from "@/lib/format";
import type { ResolvedUserMenuEntry } from "@/config/navigation";

type Props = {
  userName: string;
  roleLabel: string;
  entries: ResolvedUserMenuEntry[];
};

export function UserMenu({ userName, roleLabel, entries }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

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
    // Tabbing out of the menu closes it.
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

  const links = entries.filter((e) => e.kind === "link");
  const hasSignOut = entries.some((e) => e.kind === "signout");

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`Account menu for ${userName}, ${roleLabel}`}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-3 rounded-lg p-1 pr-2 hover:bg-canvas"
      >
        <div
          className="flex size-10 items-center justify-center rounded-full bg-avatar text-sm font-semibold text-ink"
          aria-hidden
        >
          {userName.charAt(0).toUpperCase()}
        </div>
        <div className="hidden text-left leading-tight xl:block">
          <div className="text-[15px] font-semibold text-ink">{userName}</div>
          <div className="text-sm text-muted">{roleLabel}</div>
        </div>
        <ChevronDown
          size={14}
          aria-hidden
          className={cn(
            "hidden text-muted transition-transform sm:block",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div
          id={panelId}
          className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-xl border border-line bg-surface shadow-lg"
        >
          <div className="border-b border-line px-4 py-3">
            <div className="text-[15px] font-semibold text-ink">{userName}</div>
            <div className="text-sm text-muted">{roleLabel}</div>
          </div>

          {links.length > 0 && (
            <ul className="py-1">
              {links.map((entry) => (
                <li key={entry.href}>
                  <Link
                    href={entry.href}
                    onClick={() => setOpen(false)}
                    className="block px-4 py-2 text-[15px] text-ink hover:bg-canvas"
                  >
                    {entry.label}
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {hasSignOut && (
            <div className="border-t border-line py-1">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  // TODO: call the real sign-out once authentication exists.
                }}
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-[15px] text-ink hover:bg-canvas"
              >
                <LogOut size={16} aria-hidden />
                Sign out
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}