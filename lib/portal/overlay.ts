import type { PortalOverlay } from "@/types/portal";

/** Colours an overlay may use: a closed list, so no admin-typed text reaches a stylesheet. */
export const OVERLAY_COLORS = {
  navy: { label: "Navy", css: "var(--color-navy)" },
  brand: { label: "School brand colour", css: "var(--color-brand)" },
  black: { label: "Black", css: "#000000" },
} as const;
export type OverlayColor = keyof typeof OVERLAY_COLORS;
export const isOverlayColor = (v: unknown): v is OverlayColor => typeof v === "string" && v in OVERLAY_COLORS;

export const MAX_OVERLAY = 95;
/** What the overlay was before it could be changed. */
export const DEFAULT_OVERLAY: PortalOverlay = { color: "navy", strength: 75 };

/** A usable overlay from anything stored: missing or out-of-range values fall back to the default. */
export function overlayOf(o: Partial<PortalOverlay> | undefined): PortalOverlay {
  const strength = typeof o?.strength === "number" && Number.isFinite(o.strength) ? Math.min(MAX_OVERLAY, Math.max(0, Math.round(o.strength))) : DEFAULT_OVERLAY.strength;
  return { color: isOverlayColor(o?.color) ? o.color : DEFAULT_OVERLAY.color, strength };
}

/** Inline style for the overlay layer. */
export const overlayStyle = (o: Partial<PortalOverlay> | undefined) => {
  const v = overlayOf(o);
  return { backgroundColor: OVERLAY_COLORS[v.color].css, opacity: v.strength / 100 };
};
