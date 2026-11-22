import type { PortalPanel } from "@/types/portal";
import { isOverlayColor, OVERLAY_COLORS } from "./overlay";

/** What the panel looked like before it could be changed. */
export const DEFAULT_PANEL: PortalPanel = { color: "navy", glow: true, grid: true };

/** A usable panel from anything stored: missing or invalid values fall back to the default. */
export function panelOf(p: Partial<PortalPanel> | undefined): PortalPanel {
  return {
    color: isOverlayColor(p?.color) ? p.color : DEFAULT_PANEL.color,
    glow: typeof p?.glow === "boolean" ? p.glow : DEFAULT_PANEL.glow,
    grid: typeof p?.grid === "boolean" ? p.grid : DEFAULT_PANEL.grid,
  };
}

/**
 * Colours for the panel: its background, the text on it (white, or the school's
 * "on brand" colour when the panel is the brand colour, so it stays readable),
 * and the glow (white on a brand panel, where a brand glow would be invisible).
 */
export function panelColours(p: Partial<PortalPanel> | undefined) {
  const v = panelOf(p);
  const brand = v.color === "brand";
  return {
    background: OVERLAY_COLORS[v.color].css,
    text: brand ? "var(--color-on-brand)" : "#ffffff",
    glow: brand ? "#ffffff" : "var(--color-brand)",
    glowOn: v.glow,
    gridOn: v.grid,
  };
}
