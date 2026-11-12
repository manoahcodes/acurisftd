import type { Division } from "@/config/institution";
import { ALL_DIVISIONS, inScope, onlyDivisions, type RoleScope } from "@/lib/division-scope";
import { mockRecordStore } from "../records-mock";
import type { PlatformContext } from "../platform-types";
import { flavour } from "./shared";

export type StaffRow = {
  name: string;
  no: string;
  role: string;
  level: string;
  department: string;
  status: "Active" | "Pending";
  /** Which divisions this person's role covers. */
  scope: RoleScope;
};

/**
 * Staff of the selected school. Whole-school roles cover every division. In a
 * school with several divisions each division also has a Head whose role is
 * limited to that division: they only see its students, fees, classes and results.
 * With a division selected, only people who can see that division are listed.
 */
export function staffFor(ctx: PlatformContext): StaffRow[] {
  const f = flavour(ctx);
  const divisions = ctx.tenant?.divisions ?? [];

  const wholeSchool: StaffRow[] = [
    { name: "Dr. Alice Mulenga", no: "STF-0001", role: f.tertiary ? "Vice-Chancellor" : "Principal", level: "Level 1 · Executive", department: "Administration", status: "Active", scope: ALL_DIVISIONS },
    { name: "Mrs. Grace Mumba", no: "STF-0012", role: "Registrar", level: "Level 2 · Management", department: "Registry", status: "Active", scope: ALL_DIVISIONS },
    { name: "Mr. Joseph Phiri", no: "STF-0015", role: "Bursar", level: "Level 2 · Management", department: "Finance", status: "Active", scope: ALL_DIVISIONS },
    { name: "Ms. Esther Kunda", no: "STF-0042", role: "Cashier", level: "Level 3 · Operational", department: "Finance", status: "Active", scope: ALL_DIVISIONS },
    { name: "Mr. Peter Daka", no: "STF-0051", role: "Hostel Warden", level: "Level 3 · Operational", department: "Student Affairs", status: "Active", scope: ALL_DIVISIONS },
    { name: "Mrs. Ruth Sakala", no: "STF-0067", role: "Admissions Officer", level: "Level 3 · Operational", department: "Registry", status: "Pending", scope: ALL_DIVISIONS },
  ];

  const heads: StaffRow[] =
    divisions.length > 1
      ? divisions.map((d, i) => ({
          name: ["Mrs. Beatrice Chola", "Mr. Isaac Chanda", "Dr. Moses Kunda"][i % 3],
          no: `STF-01${10 + i}`,
          role: `Head of ${d.name}`,
          level: "Level 2 · Management",
          department: d.name,
          status: "Active",
          scope: onlyDivisions(d.id),
        }))
      : [];

  const all = [...wholeSchool, ...heads];
  return ctx.division ? all.filter((s) => inScope(s.scope, ctx.division!.id)) : all;
}

/** The scope staff records are saved under (the Staff page is not split by division). */
const staffScope = (ctx: PlatformContext) => `${ctx.tenant?.id ?? "all"}:-`;

/** "All divisions" or division names (comma separated) back to a scope. Unknown names are dropped. */
export function parseScope(label: string | undefined, divisions: readonly Division[]): RoleScope {
  if (!label || label === "—" || label === "All divisions") return ALL_DIVISIONS;
  const names = label.split(", ").map((n) => n.trim());
  return onlyDivisions(...divisions.filter((d) => names.includes(d.name)).map((d) => d.id));
}

/**
 * Staff as they are now: the starting list plus anyone added, and changes made,
 * through the Staff form (role, level, department, division access, status).
 * Archived people are left out. The Division access page reads this, so a
 * change to someone's access shows there straight away.
 */
export function effectiveStaffFor(ctx: PlatformContext): StaffRow[] {
  const divisions = ctx.tenant?.divisions ?? [];
  const overlay = mockRecordStore.overlay(staffScope(ctx), "staff");
  const fromCells = (c: Record<string, string>, base?: StaffRow): StaffRow => ({
    name: c["Name"] ?? base?.name ?? "",
    no: c["Staff no."] ?? base?.no ?? "",
    role: c["Role"] ?? base?.role ?? "",
    level: c["Level"] ?? base?.level ?? "",
    department: c["Department"] ?? base?.department ?? "",
    status: ((c["Status"] ?? base?.status) === "Pending" ? "Pending" : "Active"),
    scope: "Division access" in c ? parseScope(c["Division access"], divisions) : (base?.scope ?? ALL_DIVISIONS),
  });

  const everyone = [
    ...(overlay?.added ?? []).map((c) => fromCells(c)),
    ...staffFor({ ...ctx, division: null }),
  ]
    .map((m) => (overlay?.edits[m.no] ? fromCells(overlay.edits[m.no], m) : m))
    .filter((m) => !overlay?.archived?.[m.no]);
  return ctx.division ? everyone.filter((m) => inScope(m.scope, ctx.division!.id)) : everyone;
}
