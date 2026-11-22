"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/format";
import { previewVars } from "@/lib/theme/css";
import type { PortalView } from "@/types/portal";
import type { ThemeSettings } from "@/types/theme";
import { PortalLanding } from "./portal-landing";
import { PortalRegisterView, PortalSignInView } from "./portal-pages";
import { PortalShell } from "./portal-shell";

const TABS = [
  { key: "landing", label: "Landing" },
  { key: "signin", label: "Sign in" },
  { key: "register", label: "Register" },
] as const;
type Tab = (typeof TABS)[number]["key"];

/** The page is drawn at desktop width, then scaled down to fit the panel. */
const DESIGN_WIDTH = 1280;

/**
 * Live preview of the school's portal pages. It draws the same components the
 * real pages use, with the school's theme applied to this box only, so what you
 * see is what visitors get. It is inert: nothing in it can be clicked or typed into.
 */
export function PortalPreview({ page, theme }: { page: PortalView; theme: ThemeSettings }) {
  const [tab, setTab] = useState<Tab>("landing");
  const [zoom, setZoom] = useState(0.5);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => setZoom(Math.min(1, el.clientWidth / DESIGN_WIDTH));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // The preview never navigates: links are inert, so the base only has to look right.
  const base = "";
  let vars: Record<string, string> = {};
  try {
    vars = previewVars(theme, theme.mode === "dark" ? "dark" : "light");
  } catch {
    // An invalid colour is shown as an error by the form; the preview keeps the last good look.
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-4 shadow-card">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="font-semibold text-ink">Live preview</p>
        <div role="tablist" aria-label="Page to preview" className="flex gap-1 rounded-lg bg-canvas p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-brand",
                tab === t.key ? "bg-surface text-ink shadow-card" : "text-muted hover:text-ink",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div ref={box} className="h-[34rem] overflow-y-auto overflow-x-hidden rounded-xl border border-line bg-canvas">
        <div
          // `zoom` shrinks the layout box too, so the scroll area matches what is drawn.
          style={{ ...vars, width: DESIGN_WIDTH, zoom }}
          className="font-sans text-ink"
          inert
          aria-hidden
        >
          {tab === "landing" && (
            <PortalShell page={page} base={base}>
              <PortalLanding page={page} base={base} />
            </PortalShell>
          )}
          {tab === "signin" && <PortalSignInView page={page} base={base} />}
          {tab === "register" && <PortalRegisterView page={page} base={base} />}
        </div>
      </div>
      <p className="mt-2 text-xs text-muted">Updates as you type. Nothing is saved until you press Save.</p>
    </div>
  );
}
