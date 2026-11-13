import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { themeToCss } from "@/lib/theme/css";
import { FONTS, FONT_KEYS } from "@/lib/theme/options";
import { DEFAULT_THEME } from "@/server/repositories/theme-types";

describe("theme fonts", () => {
  it("offers ten fonts, each with its own CSS variable", () => {
    expect(FONT_KEYS).toHaveLength(10);
    expect(new Set(Object.values(FONTS).map((f) => f.variable)).size).toBe(10);
  });
  it("loads every font variable in the root layout", () => {
    const layout = readFileSync("app/layout.tsx", "utf8");
    for (const f of Object.values(FONTS)) expect(layout, f.variable).toContain(`"${f.variable}"`);
  });
  it("applies each font to the theme CSS", () => {
    for (const key of FONT_KEYS) expect(themeToCss({ ...DEFAULT_THEME, font: key })).toContain(`var(${FONTS[key].variable})`);
  });
});
