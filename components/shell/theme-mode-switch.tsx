"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { Check, Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/format";
import { THEME_INSTANT_CLASS, type ModePreference } from "@/lib/theme/mode";
import { setModePreference } from "@/server/actions/theme-mode";

const OPTIONS: { value: ModePreference; label: string; Icon: LucideIcon }[] = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
];

/** Top bar menu for choosing light, dark or the device's setting. */
export function ThemeModeSwitch({ selected }: { selected: ModePreference }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const wasPending = useRef(false);

  // The switch is instant: transitions are off while the new mode is being applied, so every
  // part of the page changes in the same frame instead of easing at different speeds.
  // They come back only after the whole page has been painted in the new mode.
  useEffect(() => {
    const root = document.documentElement;
    if (pending) {
      wasPending.current = true;
      root.classList.add(THEME_INSTANT_CLASS);
      return;
    }
    if (!wasPending.current) return;
    wasPending.current = false;
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => root.classList.remove(THEME_INSTANT_CLASS));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
      root.classList.remove(THEME_INSTANT_CLASS);
    };
  }, [pending]);

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

  const Current = OPTIONS.find((o) => o.value === selected)?.Icon ?? Sun;

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label="Colour mode"
        onClick={() => setOpen((v) => !v)}
        className="flex size-10 items-center justify-center rounded-lg text-ink hover:bg-canvas"
      >
        <Current size={20} aria-hidden />
      </button>

      {open && (
        <div
          id={panelId}
          role="group"
          aria-label="Colour mode"
          className="absolute right-0 top-full z-50 mt-2 w-44 overflow-hidden rounded-xl border border-line bg-surface py-1 shadow-lg"
        >
          {OPTIONS.map(({ value, label, Icon }) => (
            <button
              key={value}
              type="button"
              aria-pressed={selected === value}
              disabled={pending}
              onClick={() => {
                setOpen(false);
                // Off before anything changes, so not even the first repaint can ease.
                document.documentElement.classList.add(THEME_INSTANT_CLASS);
                start(() => setModePreference(value));
              }}
              className={cn(
                "flex w-full items-center gap-2 px-4 py-2 text-left text-[15px] text-ink hover:bg-canvas disabled:opacity-60",
                selected === value && "font-semibold",
              )}
            >
              <Icon size={16} aria-hidden />
              {label}
              {selected === value && <Check size={14} aria-hidden className="ml-auto text-brand" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
