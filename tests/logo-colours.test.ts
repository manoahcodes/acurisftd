import { describe, expect, it } from "vitest";
import { hexToHsl } from "@/lib/theme/color";
import { dominantColours, suggestPalettes, usablePrimary } from "@/lib/theme/logo-colours";

/** RGBA pixels from [r, g, b, a, count] runs. */
const pixels = (...runs: Array<[number, number, number, number, number]>) =>
  Uint8ClampedArray.from(runs.flatMap(([r, g, b, a, n]) => Array.from({ length: n }, () => [r, g, b, a]).flat()));

describe("dominantColours", () => {
  it("ignores white backgrounds and transparency, ranks blue before gold", () => {
    const data = pixels([255, 255, 255, 255, 5000], [0, 0, 0, 0, 5000], [20, 70, 190, 255, 800], [230, 180, 30, 255, 300]);
    const found = dominantColours(data);
    expect(found).toHaveLength(2);
    expect(hexToHsl(found[0]).h).toBeGreaterThan(200); // blue
    expect(hexToHsl(found[1]).h).toBeLessThan(60); // gold
  });
  it("merges near-identical shades and favours colour over grey", () => {
    const data = pixels([20, 70, 190, 255, 300], [24, 74, 186, 255, 300], [128, 128, 128, 255, 900]);
    const found = dominantColours(data);
    expect(found[0]).toMatch(/^#1[0-9a-f]4[0-9a-f]b[0-9a-f]$/);
    expect(found.length).toBeGreaterThanOrEqual(1);
  });
  it("returns nothing for a blank or fully transparent image", () => {
    expect(dominantColours(pixels([255, 255, 255, 255, 100]))).toEqual([]);
    expect(dominantColours(pixels([10, 200, 10, 0, 100]))).toEqual([]);
    expect(dominantColours(new Uint8ClampedArray())).toEqual([]);
  });
  it("respects the limit", () => {
    const data = pixels([255, 0, 0, 255, 100], [0, 255, 0, 255, 90], [0, 0, 255, 255, 80], [255, 255, 0, 255, 70]);
    expect(dominantColours(data, 2)).toHaveLength(2);
  });
});

describe("suggestPalettes", () => {
  it("builds up to three choices from two colours", () => {
    const s = suggestPalettes(["#1446be", "#e6b41e"]);
    expect(s.map((x) => [x.primary, x.secondary])).toEqual([["#1446be", "#e6b41e"], ["#e6b41e", "#1446be"], ["#1446be", ""]]);
  });
  it("handles one colour and none", () => {
    expect(suggestPalettes(["#1446be"]).map((x) => x.harmony)).toEqual(["analogous", "complementary"]);
    expect(suggestPalettes([])).toEqual([]);
  });
  it("pulls a pale colour into a usable range", () => {
    expect(hexToHsl(usablePrimary("#f5e9a8")).l).toBeLessThanOrEqual(59);
    expect(hexToHsl(usablePrimary("#050505")).l).toBeGreaterThanOrEqual(27);
  });
});
