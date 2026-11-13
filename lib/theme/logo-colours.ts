import { hexToHsl, hslToHex } from "./color";
import type { Harmony } from "./options";

const hex2 = (n: number) => Math.round(n).toString(16).padStart(2, "0");
const toHex = (r: number, g: number, b: number) => `#${hex2(r)}${hex2(g)}${hex2(b)}`;
const parse = (h: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
const distance = (a: string, b: string) => {
  const [r1, g1, b1] = parse(a);
  const [r2, g2, b2] = parse(b);
  return Math.hypot(r1 - r2, g1 - g2, b1 - b2);
};

/** Colours closer than this (out of about 441) count as the same colour in a logo. */
const SAME_COLOUR = 70;

/**
 * The main colours of an image, most important first. `data` is RGBA pixel data
 * (what canvas getImageData returns). Transparent pixels, near-white and
 * near-black backgrounds are ignored, and saturated colours count for more than
 * greys, so a blue-and-gold crest on white gives blue then gold.
 */
export function dominantColours(data: ArrayLike<number>, max = 5): string[] {
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i + 3 < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const bucket = buckets.get(key);
    if (bucket) { bucket.n++; bucket.r += r; bucket.g += g; bucket.b += b; }
    else buckets.set(key, { n: 1, r, g, b });
  }

  const scored = [...buckets.values()]
    .map(({ n, r, g, b }) => {
      const hex = toHex(r / n, g / n, b / n);
      const { s, l } = hexToHsl(hex);
      if (l > 94 || l < 6) return null; // paper white or ink black
      const score = n * (0.4 + s / 100) * (s < 10 ? 0.15 : 1);
      return { hex, score };
    })
    .filter((x): x is { hex: string; score: number } => x !== null)
    .sort((a, b) => b.score - a.score);

  const picked: string[] = [];
  for (const { hex } of scored) {
    if (picked.every((p) => distance(p, hex) >= SAME_COLOUR)) picked.push(hex);
    if (picked.length === max) break;
  }
  return picked;
}

export type PaletteSuggestion = { label: string; primary: string; secondary: string; harmony: Harmony };

/** Up to three ready-made colour choices built from a logo's colours. An empty secondary means "generate it". */
export function suggestPalettes(colours: string[]): PaletteSuggestion[] {
  const [first, second] = colours;
  if (!first) return [];
  if (!second) {
    return [
      { label: "Logo colour, matching accent", primary: first, secondary: "", harmony: "analogous" },
      { label: "Logo colour, contrasting accent", primary: first, secondary: "", harmony: "complementary" },
    ];
  }
  return [
    { label: "Main colour, second as accent", primary: first, secondary: second, harmony: "analogous" },
    { label: "Second colour, main as accent", primary: second, secondary: first, harmony: "analogous" },
    { label: "Main colour only", primary: first, secondary: "", harmony: "analogous" },
  ];
}

/** Pulls a colour that is too pale or too dark to serve as a brand colour into a usable range (the palette is still contrast-checked later). */
export function usablePrimary(hex: string): string {
  const { h, s, l } = hexToHsl(hex);
  return hslToHex({ h, s: Math.max(s, 35), l: Math.min(Math.max(l, 28), 58) });
}
