import { describe, expect, it } from "vitest";
import { contrast, ensureContrast, hexToHsl, hslToHex, isHex } from "@/lib/theme/color";
import { auditPalette, colourNotes, generatePalette, paletteFor } from "@/lib/theme/generate";
import { themeToCss } from "@/lib/theme/css";
import { HARMONIES } from "@/lib/theme/options";
import { parseBranding, parseThemeSettings, readLogo } from "@/lib/theme/validate";
import type { ThemeSettings } from "@/types/theme";

const PRIMARIES = ["#6f2c91", "#0b66f5", "#d4a017", "#0f766e", "#e11d48", "#f5c518", "#ffffff", "#000000"];
const base: ThemeSettings = {
  primary: "#0b66f5", secondary: "", tertiary: "", harmony: "analogous", mode: "light", sidebarStyle: "dark",
  radius: "rounded", density: "comfortable", shadow: "soft", font: "inter", baseFontSize: 16,
};

describe("colour maths", () => {
  it("round-trips hex through HSL", () => {
    for (const hex of PRIMARIES) {
      const back = hslToHex(hexToHsl(hex));
      expect(contrast(hex, back)).toBeCloseTo(1, 1);
    }
  });
  it("ensureContrast reaches the target and keeps passing colours", () => {
    expect(ensureContrast("#777777", "#ffffff", 4.5)).not.toBe("#777777");
    expect(contrast(ensureContrast("#777777", "#ffffff", 4.5), "#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(ensureContrast("#000000", "#ffffff", 7)).toBe("#000000");
  });
  it("isHex accepts only #rrggbb", () => {
    expect(isHex("#0b66f5")).toBe(true);
    for (const bad of ["0b66f5", "#fff", "red", "#0b66f5;}", "", 5, null]) expect(isHex(bad)).toBe(false);
  });
});

describe("generatePalette", () => {
  for (const primary of PRIMARIES)
    for (const harmony of HARMONIES)
      for (const mode of ["light", "dark"] as const)
        for (const sidebar of ["dark", "brand"] as const)
          it(`passes the audit: ${primary} ${harmony} ${mode} ${sidebar}`, () => {
            const palette = generatePalette(primary, harmony, sidebar, mode);
            const failed = auditPalette(palette).filter((c) => !c.pass);
            expect(failed).toEqual([]);
          });
  it("is deterministic", () => {
    expect(generatePalette("#6f2c91", "triadic", "brand", "light")).toEqual(
      generatePalette("#6f2c91", "triadic", "brand", "light"),
    );
  });
  it("shifts the accent hue by harmony", () => {
    const a = generatePalette("#0b66f5", "analogous", "dark", "light").accent;
    const c = generatePalette("#0b66f5", "complementary", "dark", "light").accent;
    expect(a).not.toBe(c);
  });
});

describe("themeToCss", () => {
  it("emits colour, layout and size variables", () => {
    const css = themeToCss(base);
    expect(css).toContain("--color-brand:");
    expect(css).toContain("--radius-xl:12px");
    expect(css).toContain("html{font-size:16px}");
    expect(css).not.toContain("prefers-color-scheme");
  });
  it("auto adds a dark media block, dark replaces the root", () => {
    expect(themeToCss({ ...base, mode: "auto" })).toContain("@media (prefers-color-scheme: dark)");
    expect(themeToCss({ ...base, mode: "dark" })).not.toContain("@media");
  });
  it("refuses a primary that is not hex", () => {
    expect(() => themeToCss({ ...base, primary: "red;}body{display:none" })).toThrow();
  });
});

describe("validation", () => {
  it("accepts a valid theme and lowercases the colour", () => {
    const r = parseThemeSettings({ ...base, primary: "#0B66F5", baseFontSize: "17" });
    expect(r.ok && r.value.primary).toBe("#0b66f5");
    expect(r.ok && r.value.baseFontSize).toBe(17);
  });
  it("rejects values outside the closed lists", () => {
    for (const bad of [{ font: "comic-sans" }, { radius: "round" }, { baseFontSize: 40 }, { primary: "#12" }, { mode: "x" }]) {
      expect(parseThemeSettings({ ...base, ...bad }).ok).toBe(false);
    }
  });
  const branding = {
    name: "Zambezi University", shortName: "ZU", tagline: "", email: "a@b.co", phone: "+260 211 000 000",
    address: "", timezone: "Africa/Lusaka", welcomeMessage: "", loginBanner: "", documentHeader: "",
    documentFooter: "", signatureLine: "",
  };
  it("accepts valid branding", () => expect(parseBranding(branding, "").ok).toBe(true));
  it("rejects bad branding", () => {
    for (const bad of [{ name: "" }, { shortName: "x".repeat(13) }, { email: "nope" }, { phone: "abc" }, { timezone: "Mars/Base" }]) {
      expect(parseBranding({ ...branding, ...bad }, "").ok).toBe(false);
    }
  });
});

describe("readLogo", () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
  it("accepts a real PNG", async () => {
    const r = await readLogo(new File([png], "logo.png", { type: "image/png" }));
    expect(r.url?.startsWith("data:image/png;base64,")).toBe(true);
  });
  it("trusts bytes over the claimed type", async () => {
    const svg = new File(["<svg onload=alert(1)>"], "logo.png", { type: "image/png" });
    expect((await readLogo(svg)).error).toBeDefined();
  });
  it("rejects oversize files and ignores an empty field", async () => {
    const big = new File([new Uint8Array(3 * 1024 * 1024 + 1)], "big.png", { type: "image/png" });
    expect((await readLogo(big)).error).toBeDefined();
    expect(await readLogo(new File([], ""))).toEqual({});
    expect(await readLogo(null)).toEqual({});
  });
});

describe("built-in presets", () => {
  it("are valid and pass the contrast audit", async () => {
    const { BUILT_IN_PRESETS } = await import("@/lib/theme/presets");
    for (const p of BUILT_IN_PRESETS) {
      expect(parseThemeSettings({ ...p.theme }).ok).toBe(true);
      const modes = p.theme.mode === "light" ? (["light"] as const) : p.theme.mode === "dark" ? (["dark"] as const) : (["light", "dark"] as const);
      for (const m of modes) {
        expect(auditPalette(generatePalette(p.theme.primary, p.theme.harmony, p.theme.sidebarStyle, m)).filter((c) => !c.pass)).toEqual([]);
      }
    }
  });
});

describe("secondary and tertiary colours", () => {
  const SCHOOL_COLOURS = [
    { primary: "#6f2c91", secondary: "#f5c518", tertiary: "#0f766e" }, // purple, gold, teal
    { primary: "#0b66f5", secondary: "#ffffff", tertiary: "#e11d48" }, // white as accent
    { primary: "#d4a017", secondary: "#000000", tertiary: "#ffff00" }, // extreme values
    { primary: "#e11d48", secondary: "#0b66f5", tertiary: "" },
  ];
  for (const c of SCHOOL_COLOURS)
    for (const mode of ["light", "dark"] as const)
      for (const sidebarStyle of ["dark", "brand"] as const)
        it(`stays readable: ${c.primary}/${c.secondary || "-"}/${c.tertiary || "-"} ${mode} ${sidebarStyle}`, () => {
          const t = { ...base, ...c, sidebarStyle };
          expect(auditPalette(paletteFor(t, mode)).filter((x) => !x.pass)).toEqual([]);
        });

  it("an empty secondary and tertiary change nothing", () => {
    expect(paletteFor(base, "light")).toEqual(generatePalette(base.primary, base.harmony, base.sidebarStyle, "light"));
  });
  it("a secondary colour replaces the generated accent, a tertiary tints the sidebar", () => {
    const plain = paletteFor(base, "light");
    const custom = paletteFor({ ...base, secondary: "#f5c518", tertiary: "#0f766e" }, "light");
    expect(custom.accent).not.toBe(plain.accent);
    expect(custom.navy).not.toBe(plain.navy);
    expect(custom.brand).toBe(plain.brand);
    expect(hexToHsl(custom.navy).h).toBeCloseTo(hexToHsl("#0f766e").h, -1);
  });
  it("a readable secondary colour is kept exactly", () => {
    expect(paletteFor({ ...base, secondary: "#f5c518" }, "light").accent).toBe("#f5c518");
  });
  it("explains adjustments", () => {
    expect(colourNotes({ ...base, secondary: "#000000" }, "light").join(" ")).toContain("secondary");
    expect(colourNotes(base, "light")).toEqual([]);
  });
  it("outputs the colours in the CSS", () => {
    expect(themeToCss({ ...base, secondary: "#f5c518" })).toContain("--color-accent:#f5c518");
  });
  it("validates the optional colours", () => {
    expect(parseThemeSettings({ ...base, secondary: "", tertiary: "" }).ok).toBe(true);
    const r = parseThemeSettings({ ...base, secondary: "#F5C518", tertiary: "#0F766E" });
    expect(r.ok && [r.value.secondary, r.value.tertiary]).toEqual(["#f5c518", "#0f766e"]);
    for (const bad of ["red", "#fff", "#12345g", "#f5c518;}"]) {
      expect(parseThemeSettings({ ...base, secondary: bad }).ok).toBe(false);
      expect(parseThemeSettings({ ...base, tertiary: bad }).ok).toBe(false);
    }
    expect(parseThemeSettings({ ...base, secondary: undefined }).ok).toBe(true);
  });
});
