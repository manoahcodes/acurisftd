import type { Branding } from "@/types/theme";

/** What a printed page needs from the school's branding (see Branding in types/theme.ts). */
export type PrintBranding = Pick<Branding, "name" | "logoUrl" | "documentHeader" | "documentFooter" | "signatureLine" | "timezone">;

export const printBrandingOf = (b: Branding): PrintBranding => ({
  name: b.name,
  logoUrl: b.logoUrl,
  documentHeader: b.documentHeader,
  documentFooter: b.documentFooter,
  signatureLine: b.signatureLine,
  timezone: b.timezone,
});

/** A row as "Column: value" pairs for a single-record document (transcript, docket, receipt). */
export function rowDetails(columns: string[], row: string[], skipDivision = true): Array<[string, string]> {
  const start = skipDivision && columns[0] === "Division" ? 1 : 0;
  return columns.slice(start).map((c, i): [string, string] => [c, row[i + start] ?? ""]);
}
