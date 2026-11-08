import { clamp, contrast, ensureContrast, hexToHsl, hslToHex, isHex } from "./color";
import type { Harmony, SidebarStyle } from "./options";
import type { ThemeSettings } from "@/types/theme";

/** Optional school colours that replace parts of the generated palette. "" means use the generated one. */
export type Extras = { secondary?: string; tertiary?: string };

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
  extras: Extras = {},
): Palette {
  const { h, s } = hexToHsl(primary);
  // The sidebar takes its hue from the tertiary colour when there is one; everything else follows the primary.
  const side = extras.tertiary && isHex(extras.tertiary) ? hexToHsl(extras.tertiary) : { h, s };
  const sideSat = clamp(side.s, 25, 90);

  const navyL = mode === "dark" ? 7 : sidebar === "brand" ? 24 : 14;
  const navy = ensureContrast(hslToHex({ h: side.h, s: Math.min(sideSat, 70), l: navyL }), WHITE, 8);
  const navyL2 = hexToHsl(navy).l;
  const navyRaised = hslToHex({ h: side.h, s: Math.min(sideSat, 65), l: navyL2 + 8 });
  const navyLine = hslToHex({ h: side.h, s: Math.min(sideSat, 55), l: navyL2 + 16 });
  const accentBase = extras.secondary && isHex(extras.secondary) ? extras.secondary : hslToHex({ h: h + HUE_SHIFT[harmony], s: 75, l: 55 });
  const accent = ensureContrast(accentBase, navy, 4.5);

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

/** The palette for a saved theme, including any secondary and tertiary colours. */
export function paletteFor(t: ThemeSettings, mode: "light" | "dark"): Palette {
  return generatePalette(t.primary, t.harmony, t.sidebarStyle, mode, { secondary: t.secondary, tertiary: t.tertiary });
}

/** Plain-language notes where a chosen colour had to change to stay readable. */
export function colourNotes(t: ThemeSettings, mode: "light" | "dark"): string[] {
  const p = paletteFor(t, mode);
  const notes: string[] = [];
  if (isHex(t.primary) && p.brand !== t.primary) notes.push("The primary colour was adjusted to stay readable on cards.");
  if (isHex(t.secondary) && p.accent !== t.secondary) notes.push("The secondary colour was adjusted to stay readable on the sidebar.");
  if (isHex(t.tertiary)) notes.push("The sidebar uses a darker shade of the tertiary colour so white text stays readable.");
  return notes;
}
