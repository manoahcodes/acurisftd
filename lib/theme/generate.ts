import { clamp, contrast, ensureContrast, hexToHsl, hslToHex } from "./color";
import type { Harmony, SidebarStyle } from "./options";

/** Keys match the Tailwind `--color-*` tokens in app/globals.css. */
export type Palette = {
  navy: string;
  navyRaised: string;
  navyLine: string;
  brand: string;
  accent: string;
  canvas: string;
  surface: string;
  ink: string;
  muted: string;
  line: string;
  positive: string;
  avatar: string;
};

const WHITE = "#ffffff";
const HUE_SHIFT: Record<Harmony, number> = { analogous: 30, complementary: 180, triadic: 120 };

/**
 * Builds a full, accessible palette from one colour. Text colours are nudged
 * until they meet WCAG AA (ink AAA) on the surface they sit on, so any primary
 * an admin picks produces a readable app.
 */
export function generatePalette(
  primary: string,
  harmony: Harmony,
  sidebar: SidebarStyle,
  mode: "light" | "dark",
): Palette {
  const { h, s } = hexToHsl(primary);
  const sat = clamp(s, 25, 90);

  const navyL = mode === "dark" ? 7 : sidebar === "brand" ? 24 : 14;
  const navy = ensureContrast(hslToHex({ h, s: Math.min(sat, 70), l: navyL }), WHITE, 8);
  const navyL2 = hexToHsl(navy).l;
  const navyRaised = hslToHex({ h, s: Math.min(sat, 65), l: navyL2 + 8 });
  const navyLine = hslToHex({ h, s: Math.min(sat, 55), l: navyL2 + 16 });
  const accent = ensureContrast(hslToHex({ h: h + HUE_SHIFT[harmony], s: 75, l: 55 }), navy, 4.5);

  if (mode === "dark") {
    const canvas = hslToHex({ h, s: 25, l: 8 });
    const surface = hslToHex({ h, s: 22, l: 12 });
    return {
      navy,
      navyRaised,
      navyLine,
      brand: ensureContrast(primary, surface, 4.5),
      accent,
      canvas,
      surface,
      ink: ensureContrast(hslToHex({ h, s: 20, l: 94 }), canvas, 7),
      muted: ensureContrast(hslToHex({ h, s: 15, l: 68 }), canvas, 4.5),
      line: hslToHex({ h, s: 20, l: 22 }),
      positive: ensureContrast("#34d399", surface, 4.5),
      avatar: hslToHex({ h, s: 40, l: 28 }),
    };
  }

  const canvas = hslToHex({ h, s: 30, l: 96 });
  return {
    navy,
    navyRaised,
    navyLine,
    brand: ensureContrast(primary, WHITE, 4.5),
    accent,
    canvas,
    surface: WHITE,
    ink: ensureContrast(hslToHex({ h, s: 60, l: 15 }), canvas, 7),
    muted: ensureContrast(hslToHex({ h, s: 15, l: 45 }), canvas, 4.5),
    line: hslToHex({ h, s: 28, l: 90 }),
    positive: ensureContrast("#0e9f5f", canvas, 4.5),
    avatar: hslToHex({ h, s: 75, l: 90 }),
  };
}

export type AuditCheck = { label: string; ratio: number; min: number; pass: boolean };

/** The contrast checks the editor shows next to the preview. */
export function auditPalette(p: Palette): AuditCheck[] {
  const check = (label: string, fg: string, bg: string, min: number): AuditCheck => {
    const ratio = Math.round(contrast(fg, bg) * 100) / 100;
    return { label, ratio, min, pass: ratio >= min };
  };
  return [
    check("Body text on page", p.ink, p.canvas, 7),
    check("Secondary text on page", p.muted, p.canvas, 4.5),
    check("Brand colour on cards", p.brand, p.surface, 4.5),
    check("Text on sidebar", WHITE, p.navy, 4.5),
    check("Accent on sidebar", p.accent, p.navy, 4.5),
  ];
}
