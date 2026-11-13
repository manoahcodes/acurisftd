/**
 * Every choice an admin can make about the look and feel. Each list is closed:
 * the server rejects anything outside it, and the CSS the app injects is built
 * only from these values and generated hex colours, never from free text.
 */
export const HARMONIES = ["analogous", "complementary", "triadic"] as const;
export const MODES = ["light", "dark", "auto"] as const;
/** "dark" tints the sidebar from the brand hue; "brand" makes it a deeper shade of the brand colour. */
export const SIDEBAR_STYLES = ["dark", "brand"] as const;
export const RADII = ["sharp", "rounded", "pill"] as const;
export const DENSITIES = ["compact", "comfortable"] as const;
export const SHADOWS = ["none", "soft", "raised"] as const;
export const BASE_SIZES = [15, 16, 17] as const;

/**
 * Fonts the app can use. Each must also be loaded with next/font in
 * app/layout.tsx under the same CSS variable name (see THEME_INTEGRATION.md).
 */
export const FONTS = {
  inter: { label: "Inter", hint: "Clean, default", variable: "--font-inter" },
  poppins: { label: "Poppins", hint: "Rounded, geometric", variable: "--font-poppins" },
  lato: { label: "Lato", hint: "Warm, professional", variable: "--font-lato" },
  "source-sans-3": { label: "Source Sans 3", hint: "Compact, readable", variable: "--font-source-sans-3" },
  roboto: { label: "Roboto", hint: "Neutral, familiar", variable: "--font-roboto" },
  "open-sans": { label: "Open Sans", hint: "Friendly, very readable", variable: "--font-open-sans" },
  "nunito-sans": { label: "Nunito Sans", hint: "Soft, approachable", variable: "--font-nunito-sans" },
  montserrat: { label: "Montserrat", hint: "Modern, wide", variable: "--font-montserrat" },
  merriweather: { label: "Merriweather", hint: "Serif, traditional", variable: "--font-merriweather" },
  "atkinson-hyperlegible": { label: "Atkinson Hyperlegible", hint: "Accessibility-focused", variable: "--font-atkinson" },
} as const;

export type Harmony = (typeof HARMONIES)[number];
export type Mode = (typeof MODES)[number];
export type SidebarStyle = (typeof SIDEBAR_STYLES)[number];
export type Radius = (typeof RADII)[number];
export type Density = (typeof DENSITIES)[number];
export type Shadow = (typeof SHADOWS)[number];
export type BaseSize = (typeof BASE_SIZES)[number];
export type FontKey = keyof typeof FONTS;
export const FONT_KEYS = Object.keys(FONTS) as FontKey[];

/** Tailwind v4 reads these variables at run time, so overriding them restyles rounded-lg/xl/2xl everywhere. */
export const RADIUS_VARS: Record<Radius, Record<string, string>> = {
  sharp: { "--radius-lg": "2px", "--radius-xl": "4px", "--radius-2xl": "6px" },
  rounded: { "--radius-lg": "8px", "--radius-xl": "12px", "--radius-2xl": "16px" },
  pill: { "--radius-lg": "12px", "--radius-xl": "16px", "--radius-2xl": "24px" },
};

/** Tailwind v4 builds every spacing utility from --spacing, so one number scales the whole layout. */
export const SPACING: Record<Density, string> = {
  compact: "0.22rem",
  comfortable: "0.25rem",
};

export const SHADOW_CSS: Record<Shadow, string> = {
  none: "none",
  soft: "0 1px 2px rgba(15,23,42,0.04)",
  raised: "0 4px 14px rgba(15,23,42,0.12)",
};

export const FALLBACK_FONT_STACK =
  'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
