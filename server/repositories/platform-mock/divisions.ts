import type { Division } from "@/config/institution";
import type { PlatformScreen, TableSection } from "@/types/platform";
import type { PlatformContext } from "../platform-types";
import type { Builder } from "./shared";

/**
 * Pages that hold per-division records. Everything else stays tenant-wide
 * (campuses, platform pages) or is not split yet (receivables, audit trail).
 * Staff are tenant employees, so they are not split either: their access is
 * limited per division by role scope instead (see staff.ts).
 */
const DIVISION_PREFIXES = [
  "finances/",
  "users/",
  "registrations/",
  "academics/",
  "examinations/",
  "hostels/",
  "reports/",
];
const DIVISION_PAGES = ["institution/schools", "institution/departments"];
const NOT_SPLIT = new Set([
  "users/staff",
  "reports/total-receivables",
  "reports/receivables-analysis",
  "reports/audit-trail",
]);

export const isDivisionScoped = (slug: string): boolean =>
  !NOT_SPLIT.has(slug) &&
  (DIVISION_PAGES.includes(slug) || DIVISION_PREFIXES.some((p) => slug.startsWith(p)));

/**
 * Divisions are fully separate, so each has its own student numbers. In the
 * mock this means STU-1048 becomes PRI-1048 / HS-1048.
 */
function numbered(text: string, division: Division): string {
  return text.replace(/\bSTU-(\d+)/g, `${division.code}-$1`);
}

export function renumber(screen: PlatformScreen, division: Division): PlatformScreen {
  return {
    ...screen,
    tables: screen.tables.map((t) => ({ ...t, rows: t.rows.map((row) => row.map((c) => numbered(c, division))) })),
  };
}

/** Joins one screen per division into one, with a Division column in front. */
function merge(parts: Array<[Division, PlatformScreen]>): PlatformScreen {
  const [, first] = parts[0];
  const tableCount = Math.min(...parts.map(([, s]) => s.tables.length));

  const tables: TableSection[] = Array.from({ length: tableCount }, (_, i) => {
    const base = first.tables[i];
    return {
      ...base,
      columns: ["Division", ...base.columns],
      rows: parts.flatMap(([division, screen]) =>
        screen.tables[i].rows.map((row) => [division.name, ...row.map((c) => numbered(c, division))]),
      ),
    };
  });

  return {
    description: `${first.description} Showing every division.`,
    actions: [...new Set(parts.flatMap(([, s]) => s.actions ?? []))],
    // Summary figures are per division, so they are left out of the combined view.
    kpis: undefined,
    tables: tables.map((t, i) => ({
      ...t,
      note: [first.tables[i].note, "Pick a division in the sidebar for its summary figures."]
        .filter(Boolean)
        .join(" "),
    })),
  };
}

/**
 * Builds a screen for a tenant that has several divisions: one division on its
 * own, or all divisions merged. Tenants with one division are built as before.
 */
export function buildForDivisions(build: Builder, ctx: PlatformContext): PlatformScreen {
  const tenant = ctx.tenant;
  if (!tenant || tenant.divisions.length < 2) return build(ctx);

  if (ctx.division) return renumber(build(ctx), ctx.division);

  return merge(tenant.divisions.map((d) => [d, build({ ...ctx, division: d })]));
}
