import type { Branding } from "@/types/theme";

/** The software owner's line. It is fixed: schools cannot change it. */
export const ACURIS_COPYRIGHT_TEXT = "ACURIS by STECIA Digital Technologies.";

// A leading (c) symbol or word, or a 4-digit year or range, or stray punctuation.
const LEADING = /^(?:©|\(c\)|copyright\b|\b\d{4}\b(?:\s*[-–]\s*\b\d{4}\b)?|[\s,.:;–-])+/i;

/**
 * Keeps only the name. The © symbol and year are added by the footer, so
 * anything an admin types in front of the name ("© 2024 ...") or a trailing
 * full stop is removed and the format cannot drift.
 */
export function cleanCopyrightHolder(input: string): string {
  return input.replace(/\s+/g, " ").trim().replace(LEADING, "").replace(/[\s.]+$/, "").trim();
}

/**
 * The school's copyright name: the one set in branding, else the school's name.
 * Returns "" when it would only repeat the software's own name (the platform
 * default is called ACURIS), so the footer then shows just the ACURIS line.
 */
export function copyrightHolderFor(branding: Pick<Branding, "copyrightHolder" | "name">): string {
  const holder = cleanCopyrightHolder(branding.copyrightHolder) || cleanCopyrightHolder(branding.name);
  return holder.toLowerCase() === "acuris" ? "" : holder;
}
