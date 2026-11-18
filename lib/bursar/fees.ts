import type { InstitutionType } from "@/config/institution";
import { studentsFor } from "@/lib/cashier/seed";
import { bursarTermsFor } from "@/lib/bursar/terms";
import type { AccountKind } from "@/types/cashier";
import type { FeeItem, FeeItemInput, FeeScope } from "@/types/bursar";

/** Fee structure maths and the sample structure. Pure. Money is integer ngwee. */

/** The grade a class belongs to: "Grade 11A" is 11. Undefined for a programme or anything else. */
export function gradeOf(group: string): number | undefined {
  const m = /Grade\s+(\d{1,2})/i.exec(group);
  return m ? Number(m[1]) : undefined;
}

export function scopeMatches(scope: FeeScope, group: string): boolean {
  if (scope.kind === "all") return true;
  if (scope.kind === "group") return scope.group === group;
  const g = gradeOf(group);
  return g !== undefined && g >= scope.from && g <= scope.to;
}

export function scopeLabel(scope: FeeScope, everyone = "Everyone"): string {
  if (scope.kind === "all") return everyone;
  if (scope.kind === "group") return scope.group;
  return scope.from === scope.to ? `Grade ${scope.from}` : `Grades ${scope.from}–${scope.to}`;
}

/** Same scope? Used to refuse two identical fees. */
export const sameScope = (a: FeeScope, b: FeeScope) => scopeLabel(a) === scopeLabel(b);

/** Is this fee billed on the given day? It must be active and past its effective date. */
export const inEffect = (f: Pick<FeeItem, "active" | "effectiveFrom">, today: string) => f.active && f.effectiveFrom <= today;

export type GroupFees = { group: string; required: FeeItem[]; optional: FeeItem[]; perPeriod: number; perYear: number };

/** What one class or programme is charged: the fees in effect that apply to it, split by how often and whether they are optional. */
export function feesForGroup(items: FeeItem[], group: string, today: string): GroupFees {
  const mine = items.filter((f) => inEffect(f, today) && scopeMatches(f.scope, group));
  const required = mine.filter((f) => f.billing === "everyone");
  return {
    group,
    required,
    optional: mine.filter((f) => f.billing === "optional"),
    perPeriod: required.filter((f) => f.frequency === "period").reduce((n, f) => n + f.amount, 0),
    perYear: required.filter((f) => f.frequency === "year").reduce((n, f) => n + f.amount, 0),
  };
}

/** The classes or programmes on the school's roll, in a stable order. */
export function groupsFor(type: InstitutionType): string[] {
  return [...new Set(studentsFor(type).map((s) => s.group))].sort((a, b) => (gradeOf(a) ?? 0) - (gradeOf(b) ?? 0) || a.localeCompare(b));
}

const K = (kwacha: number) => kwacha * 100;
const AT = "2026-01-05T08:00:00+02:00";
const FROM = "2026-01-01";
const DUE = "2026-11-27";

/**
 * The sample fee structure, from the same figures as the Platform Admin's
 * Tuition fees and Other fees pages. Two differences, so every class on the
 * sample roll is billed: Grade 7 tuition is on (the Admin sample shows it
 * pending), and BEd Secondary Education is added (it is on the roll but not in
 * the Admin sample). Transport starts next year, as pending there.
 */
export function seedFeeItems(type: InstitutionType): FeeItem[] {
  const terms = bursarTermsFor(type);
  const kinds = terms.accountKinds;
  const pick = (want: AccountKind) => (kinds.includes(want) ? want : "other");
  const item = (n: number, name: string, kind: AccountKind, kwacha: number, scope: FeeScope, over: Partial<FeeItem> = {}): FeeItem => ({
    id: `fee-${n}`, name, kind, amount: K(kwacha), scope, frequency: "period", billing: "everyone", dueOn: DUE, effectiveFrom: FROM, active: true, updatedAt: AT, updatedBy: "Bursar", ...over,
  });
  const tuition: FeeItem[] = terms.tertiary
    ? [
        item(1, "Tuition", "tuition", 14_500, { kind: "group", group: "BSc Computer Science" }),
        item(2, "Tuition", "tuition", 12_800, { kind: "group", group: "BA Accounting & Finance" }),
        item(3, "Tuition", "tuition", 15_200, { kind: "group", group: "BEng Civil Engineering" }),
        item(4, "Tuition", "tuition", 13_900, { kind: "group", group: "BSc Nursing" }),
        item(5, "Tuition", "tuition", 12_500, { kind: "group", group: "BEd Secondary Education" }),
      ]
    : type === "primary"
      ? [
          item(1, "Tuition", "tuition", 900, { kind: "grades", from: 1, to: 2 }),
          item(2, "Tuition", "tuition", 1_100, { kind: "grades", from: 3, to: 4 }),
          item(3, "Tuition", "tuition", 1_400, { kind: "grades", from: 5, to: 6 }),
          item(4, "Tuition", "tuition", 1_700, { kind: "grades", from: 7, to: 7 }),
        ]
      : [
          item(1, "Tuition", "tuition", 2_100, { kind: "grades", from: 8, to: 9 }),
          item(2, "Tuition", "tuition", 2_600, { kind: "grades", from: 10, to: 11 }),
          item(3, "Tuition", "tuition", 3_000, { kind: "grades", from: 12, to: 12 }),
        ];
  const all: FeeScope = { kind: "all" };
  const other: FeeItem[] = [
    item(10, "Registration", pick("registration"), 350, all),
    item(11, "Examination", "other", 450, all),
    item(12, "Library & ICT levy", "other", 200, all, { frequency: "year" }),
    item(13, terms.tertiary ? "Hostel" : "Boarding", pick("accommodation"), 3_200, all, { billing: "optional" }),
    item(14, "Transport", pick("transport"), 900, all, { billing: "optional", active: false, effectiveFrom: "2027-01-01", dueOn: "2027-02-26" }),
  ];
  return [...tuition, ...other];
}

export type { FeeItemInput };
