import { dominantColours } from "./logo-colours";

/** Reads a logo in the browser and returns its main colours. Returns [] if the image cannot be read. */
export async function logoColours(src: string, max = 5): Promise<string[]> {
  try {
    const img = new Image();
    img.src = src;
    await img.decode();
    const scale = Math.min(1, 96 / Math.max(img.naturalWidth, img.naturalHeight, 1));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return [];
    ctx.drawImage(img, 0, 0, w, h);
    return dominantColours(ctx.getImageData(0, 0, w, h).data, max);
  } catch {
    return [];
  }
}
