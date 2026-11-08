import { isHex } from "./color";
import { paletteFor, type Palette } from "./generate";
import {
  FALLBACK_FONT_STACK,
  FONTS,
  RADIUS_VARS,
  SHADOW_CSS,
  SPACING,
} from "./options";
import type { ThemeSettings } from "@/types/theme";

const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

export function paletteVars(p: Palette): Record<string, string> {
  return Object.fromEntries(Object.entries(p).map(([k, v]) => [`--color-${kebab(k)}`, v]));
}

export function layoutVars(t: ThemeSettings): Record<string, string> {
  return {
    ...RADIUS_VARS[t.radius],
    "--spacing": SPACING[t.density],
    "--shadow-card": SHADOW_CSS[t.shadow],
    "--font-sans": `var(${FONTS[t.font].variable}), ${FALLBACK_FONT_STACK}`,
  };
}

const block = (selector: string, vars: Record<string, string>) =>
  `${selector}{${Object.entries(vars).map(([k, v]) => `${k}:${v}`).join(";")}}`;

/**
 * The CSS the app injects. Built only from validated hex colours and the
 * closed lists in options.ts, so no admin-typed text ever reaches a stylesheet.
 */
export function themeToCss(t: ThemeSettings): string {
  if (!isHex(t.primary)) throw new Error("Theme primary colour must be #rrggbb.");
  const layout = layoutVars(t);
  const light = { ...paletteVars(paletteFor(t, "light")), ...layout };
  const dark = { ...paletteVars(paletteFor(t, "dark")), ...layout };

  const parts: string[] = [];
  if (t.mode === "dark") parts.push(block(":root", dark));
  else {
    parts.push(block(":root", light));
    if (t.mode === "auto") parts.push(`@media (prefers-color-scheme: dark){${block(":root", dark)}}`);
  }
  parts.push(`html{font-size:${t.baseFontSize}px}`);
  return parts.join("\n");
}

/** Inline-style variables for the editor's live preview, scoped to one element. */
export function previewVars(t: ThemeSettings, mode: "light" | "dark"): Record<string, string> {
  return { ...paletteVars(paletteFor(t, mode)), ...layoutVars(t) };
}
