import { isHex } from "./color";
import { cleanCopyrightHolder } from "./copyright";
import {
  BASE_SIZES,
  DENSITIES,
  FONT_KEYS,
  HARMONIES,
  MODES,
  RADII,
  SHADOWS,
  SIDEBAR_STYLES,
} from "./options";
import type { Branding, ThemeFieldErrors, ThemeSettings } from "@/types/theme";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE = /^\+?[0-9 ()-]{7,20}$/;

export const MAX_LOGO_BYTES = 3 * 1024 * 1024;

const clean = (v: unknown): string => (typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "");
const oneOf = <T extends string | number>(list: readonly T[], v: unknown): T | undefined =>
  list.find((x) => String(x) === String(v));

type Result<T> = { ok: true; value: T } | { ok: false; errors: ThemeFieldErrors };

/** Validates a theme from untrusted input (JSON, FormData values). Unknown keys are dropped. */
export function parseThemeSettings(input: Record<string, unknown>): Result<ThemeSettings> {
  const errors: ThemeFieldErrors = {};
  const primary = clean(input.primary).toLowerCase();
  if (!isHex(primary)) errors.primary = "Pick a colour as #rrggbb.";
  // Optional colours: "" means use the generated one.
  const optional = (key: "secondary" | "tertiary") => {
    const v = clean(input[key]).toLowerCase();
    if (v !== "" && !isHex(v)) errors[key] = "Pick a colour as #rrggbb, or leave it empty.";
    return v;
  };
  const secondary = optional("secondary");
  const tertiary = optional("tertiary");
  const harmony = oneOf(HARMONIES, input.harmony);
  if (!harmony) errors.harmony = "Choose a listed colour harmony.";
  const mode = oneOf(MODES, input.mode);
  if (!mode) errors.mode = "Choose light, dark or auto.";
  const sidebarStyle = oneOf(SIDEBAR_STYLES, input.sidebarStyle);
  if (!sidebarStyle) errors.sidebarStyle = "Choose a listed sidebar style.";
  const radius = oneOf(RADII, input.radius);
  if (!radius) errors.radius = "Choose a listed corner style.";
  const density = oneOf(DENSITIES, input.density);
  if (!density) errors.density = "Choose a listed density.";
  const shadow = oneOf(SHADOWS, input.shadow);
  if (!shadow) errors.shadow = "Choose a listed shadow level.";
  const font = oneOf(FONT_KEYS, input.font);
  if (!font) errors.font = "Choose a listed font.";
  const baseFontSize = oneOf(BASE_SIZES, input.baseFontSize);
  if (!baseFontSize) errors.baseFontSize = "Choose a listed text size.";

  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      primary, secondary, tertiary, harmony: harmony!, mode: mode!, sidebarStyle: sidebarStyle!, radius: radius!,
      density: density!, shadow: shadow!, font: font!, baseFontSize: baseFontSize!,
    },
  };
}

function timezones(): string[] {
  try {
    return (Intl as unknown as { supportedValuesOf(k: string): string[] }).supportedValuesOf("timeZone");
  } catch {
    return [];
  }
}

/** Validates branding text. `logoUrl` is passed through untouched: it only ever comes from readLogo. */
export function parseBranding(input: Record<string, unknown>, logoUrl: string): Result<Branding> {
  const errors: ThemeFieldErrors = {};
  const text = (key: keyof Branding, label: string, min: number, max: number) => {
    const v = clean(input[key]);
    if (v.length < min) errors[key] = `${label} is required.`;
    else if (v.length > max) errors[key] = `${label} must be at most ${max} characters.`;
    return v;
  };
  const name = text("name", "Institution name", 1, 120);
  const shortName = text("shortName", "Short name", 1, 12);
  const tagline = text("tagline", "Tagline", 0, 140);
  const copyrightHolder = cleanCopyrightHolder(text("copyrightHolder", "Copyright holder", 0, 120));
  const address = text("address", "Address", 0, 300);
  const welcomeMessage = text("welcomeMessage", "Welcome message", 0, 200);
  const loginBanner = text("loginBanner", "Sign-in banner", 0, 200);
  const documentHeader = text("documentHeader", "Document header", 0, 200);
  const documentFooter = text("documentFooter", "Document footer", 0, 200);
  const signatureLine = text("signatureLine", "Signature line", 0, 80);

  const email = clean(input.email);
  if (email && !EMAIL.test(email)) errors.email = "Enter a valid email address.";
  const phone = clean(input.phone);
  if (phone && !PHONE.test(phone)) errors.phone = "Enter a valid phone number.";
  const timezone = clean(input.timezone);
  const zones = timezones();
  if (!timezone || (zones.length && !zones.includes(timezone))) errors.timezone = "Choose a listed time zone.";

  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      name, shortName, tagline, logoUrl, copyrightHolder, email, phone, address, timezone,
      welcomeMessage, loginBanner, documentHeader, documentFooter, signatureLine,
    },
  };
}

const startsWith = (b: Uint8Array, sig: number[], at = 0) => sig.every((x, i) => b[at + i] === x);

function sniff(b: Uint8Array): "image/png" | "image/jpeg" | "image/webp" | undefined {
  if (startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith(b, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(b, [0x52, 0x49, 0x46, 0x46]) && startsWith(b, [0x57, 0x45, 0x42, 0x50], 8)) return "image/webp";
  return undefined;
}

/**
 * Turns an uploaded logo into a data URL. The type is decided by the file's own
 * bytes, never by its name or the browser's MIME claim, and SVG is refused
 * because it can carry scripts. Returns undefined when no file was chosen.
 */
export async function readLogo(file: unknown): Promise<{ url?: string; error?: string }> {
  if (!(file instanceof File) || file.size === 0) return {};
  if (file.size > MAX_LOGO_BYTES) return { error: "Logo must be 3 MB or smaller." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniff(bytes);
  if (!type) return { error: "Logo must be a PNG, JPEG or WebP image." };
  return { url: `data:${type};base64,${Buffer.from(bytes).toString("base64")}` };
}
