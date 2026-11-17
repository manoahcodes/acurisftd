import type { InstitutionType } from "@/config/institution";
import { addDays } from "@/lib/teacher/dates";
import type { AccountKind, FeeLine, MethodId, ReceiptStatus } from "@/types/cashier";
import { cashierTermsFor } from "./terms";

/** Sample ledger until the Bursar's records are connected. Whole kwacha, converted to ngwee here. */

const PREFIX: Record<InstitutionType, string> = { primary: "PRI", high_school: "STU", college: "COL", university: "UNI" };

const PEOPLE: Array<{ n: string; name: string }> = [
  { n: "1048", name: "Chisomo Banda" },
  { n: "0832", name: "Mwamba Zulu" },
  { n: "1201", name: "Tionenji Phiri" },
  { n: "1140", name: "Natasha Banda" },
  { n: "0915", name: "Bwalya Mulenga" },
  { n: "1077", name: "Mutale Chanda" },
  { n: "0764", name: "Thandiwe Mwansa" },
  { n: "1189", name: "Kondwani Tembo" },
];
const GROUPS_SCHOOL: Record<"primary" | "high_school", string[]> = {
  primary: ["Grade 3B", "Grade 5A", "Grade 7", "Grade 6A", "Grade 2A", "Grade 4A", "Grade 6C", "Grade 1A"],
  high_school: ["Grade 11A", "Grade 9A", "Grade 12", "Grade 8B", "Grade 10B", "Grade 10A", "Grade 9B", "Grade 8C"],
};
const GROUPS_TERTIARY = ["BSc Computer Science", "BA Accounting & Finance", "BEng Civil Engineering", "BSc Nursing", "BEd Secondary Education", "BSc Computer Science", "BA Accounting & Finance", "BEng Civil Engineering"];

/** Kwacha owed per person on the first three accounts (the fourth, "other", is always nothing owed). */
const OWED: number[][] = [
  [3200, 400, 0],
  [1500, 0, 150],
  [0, 0, 0],
  [2400, 0, 200],
  [850, 250, 0],
  [1200, 0, 100],
  [3000, 500, 0],
  [600, 200, 0],
];
const DUE: Array<string | null> = ["2026-11-27", "2026-11-06", null, "2026-11-27", "2026-11-06", "2026-11-27", "2026-11-27", "2026-11-27"];

export type SeedStudent = { no: string; name: string; group: string; lines: FeeLine[] };

export function studentsFor(type: InstitutionType): SeedStudent[] {
  const terms = cashierTermsFor(type);
  const scale = terms.tertiary ? 3 : 1;
  const groups = terms.tertiary ? GROUPS_TERTIARY : GROUPS_SCHOOL[type as "primary" | "high_school"];
  return PEOPLE.map((p, i) => ({
    no: `${PREFIX[type]}-${p.n}`,
    name: p.name,
    group: groups[i],
    lines: terms.accountKinds.map((kind, k): FeeLine => {
      const owed = k < 3 ? OWED[i][k] * (k === 0 ? scale : 1) * 100 : 0;
      return { kind, owed, dueOn: owed > 0 ? DUE[i] : null };
    }),
  }));
}

export type SeedReceipt = { student: number; kind: number; method: MethodId; kwacha: number; status: ReceiptStatus; time: string; reference: string; daysAgo: number };

/** Payments already taken: today's, and a few from the day before (which has been cashed up). Balances above are after these. */
export const RECEIPT_SEED: SeedReceipt[] = [
  { student: 0, kind: 0, method: "cash", kwacha: 850, status: "success", time: "07:52", reference: "", daysAgo: 0 },
  { student: 1, kind: 0, method: "mtn_money", kwacha: 500, status: "success", time: "08:10", reference: "MP261116.0810.A41", daysAgo: 0 },
  { student: 2, kind: 0, method: "bank_deposit", kwacha: 1200, status: "success", time: "08:35", reference: "ZNC-778213", daysAgo: 0 },
  { student: 3, kind: 0, method: "cash", kwacha: 300, status: "success", time: "09:05", reference: "", daysAgo: 0 },
  { student: 4, kind: 1, method: "cash", kwacha: 250, status: "success", time: "09:40", reference: "", daysAgo: 0 },
  { student: 5, kind: 0, method: "airtel_money", kwacha: 400, status: "success", time: "10:15", reference: "AM-5513902", daysAgo: 0 },
  { student: 6, kind: 1, method: "airtel_money", kwacha: 300, status: "pending", time: "10:48", reference: "AM-5514417", daysAgo: 0 },
  { student: 7, kind: 0, method: "bank_deposit", kwacha: 600, status: "pending", time: "11:02", reference: "ZNC-778290", daysAgo: 0 },
  { student: 1, kind: 2, method: "cash", kwacha: 100, status: "success", time: "11:20", reference: "", daysAgo: 0 },
  { student: 3, kind: 0, method: "cash", kwacha: 1000, status: "success", time: "08:20", reference: "", daysAgo: 1 },
  { student: 5, kind: 0, method: "mtn_money", kwacha: 700, status: "success", time: "09:30", reference: "MP261115.0930.B07", daysAgo: 1 },
  { student: 0, kind: 1, method: "cash", kwacha: 200, status: "success", time: "10:00", reference: "", daysAgo: 1 },
];

/** The day after `today` minus n, as a date; the seeded cash-up is for the day before today. */
export const seedDay = (today: string, daysAgo: number) => addDays(today, -daysAgo);

export const ACCOUNT_ORDER: AccountKind[] = ["tuition", "transport", "meals", "accommodation", "registration", "other"];
