import type { ThemeSettings } from "@/types/theme";

const base: Omit<ThemeSettings, "primary" | "harmony"> = {
  secondary: "", tertiary: "",
  mode: "light", sidebarStyle: "dark", radius: "rounded", density: "comfortable",
  shadow: "soft", font: "inter", baseFontSize: 16,
};

/** Starting points that ship with the app. Admins can save their own on top of these. */
export const BUILT_IN_PRESETS: { id: string; name: string; theme: ThemeSettings }[] = [
  { id: "royal", name: "Royal blue", theme: { ...base, primary: "#0b66f5", harmony: "analogous" } },
  { id: "heritage", name: "Heritage purple", theme: { ...base, primary: "#6f2c91", harmony: "analogous", font: "lato", radius: "sharp", sidebarStyle: "brand" } },
  { id: "forest", name: "Forest green", theme: { ...base, primary: "#0f766e", harmony: "complementary", font: "source-sans-3" } },
  { id: "crimson", name: "Crimson", theme: { ...base, primary: "#e11d48", harmony: "triadic", font: "poppins", radius: "pill" } },
  { id: "gold", name: "Gold and charcoal", theme: { ...base, primary: "#d4a017", harmony: "complementary", sidebarStyle: "brand", shadow: "none" } },
  { id: "midnight", name: "Midnight", theme: { ...base, primary: "#3b82f6", harmony: "analogous", mode: "dark", shadow: "raised" } },
];

/** One-click colours for the picker. */
export const QUICK_COLOURS = ["#0b66f5", "#6f2c91", "#0f766e", "#e11d48", "#d4a017", "#ea580c", "#0891b2", "#4f46e5"];
