import { INSTITUTIONS, termsFor, type Terminology } from "@/config/institution";
import { formatKwacha, kwachaToNgwee } from "@/lib/money";
import type { PlatformScreen, TableSection } from "@/types/platform";
import type { PlatformContext } from "../platform-types";

export type Builder = (ctx: PlatformContext) => PlatformScreen;

export const K = (kwacha: number) => formatKwacha(kwachaToNgwee(kwacha));

export const table = (
  title: string,
  columns: string[],
  rows: string[][],
  extra: Partial<Omit<TableSection, "title" | "columns" | "rows">> = {},
): TableSection => ({ title, columns, rows, ...extra });

/** Like table(), with a stable id that forms attach to. */
export const tableOf = (
  id: string,
  ...args: Parameters<typeof table>
): TableSection => ({ ...table(...args), id });

/** What a school's data looks like: tertiary (semesters) or school-level (terms). */
export type Flavour = {
  tertiary: boolean;
  /** Grades 1-7 only (Primary type). */
  primary: boolean;
  terms: Terminology;
  /** "Semester 1 2026" or "Term 1 2026". */
  periodName: (n: number) => string;
  tenantName: string;
};

export function flavour(ctx: PlatformContext): Flavour {
  // A selected division decides the flavour. With all divisions the builders are
  // called once per division (see index.ts), so the first division is only a fallback.
  const type = (ctx.division ?? ctx.tenant?.divisions[0])?.institutionType ?? null;
  const tertiary = type ? INSTITUTIONS[type].level === "tertiary" : true;
  const terms = termsFor(type);
  return {
    tertiary,
    primary: type ? INSTITUTIONS[type].level === "primary" : false,
    terms,
    periodName: (n) => `${terms.period} ${n} 2026`,
    tenantName: ctx.tenant?.name ?? "All tenants",
  };
}

/** Learners shared across the mock screens so the same people appear everywhere. */
export const LEARNERS: Array<{ no: string; name: string }> = [
  { no: "STU-1048", name: "Chisomo Banda" },
  { no: "STU-0832", name: "Mwamba Zulu" },
  { no: "STU-1201", name: "Tionenji Phiri" },
  { no: "STU-1140", name: "Natasha Banda" },
  { no: "STU-0915", name: "Bwalya Mulenga" },
  { no: "STU-1077", name: "Mutale Chanda" },
  { no: "STU-0764", name: "Thandiwe Mwansa" },
  { no: "STU-1189", name: "Kondwani Tembo" },
];

/** Programme (tertiary) or class (school) names, in the same order as LEARNERS. */
export function groupNames(tertiary: boolean, primary = false): string[] {
  if (primary) {
    return ["Grade 1A", "Grade 3B", "Grade 7", "Grade 5B", "Grade 2A", "Grade 4A", "Grade 6C", "Grade 7"];
  }
  return tertiary
    ? [
        "BSc Computer Science",
        "BA Accounting & Finance",
        "BEng Civil Engineering",
        "BSc Nursing",
        "BEd Secondary Education",
        "BSc Computer Science",
        "BA Accounting & Finance",
        "BEng Civil Engineering",
      ]
    : [
        "Grade 10A",
        "Grade 9A",
        "Grade 12",
        "Grade 5B",
        "Grade 11A",
        "Grade 10B",
        "Grade 8C",
        "Grade 12",
      ];
}

export const COURSE_ROWS = (tertiary: boolean, primary = false): Array<[string, string]> =>
  primary
    ? [
        ["MAT", "Mathematics"],
        ["ENG", "English"],
        ["SCI", "Integrated Science"],
        ["SST", "Social Studies"],
        ["CTS", "Creative & Technology Studies"],
      ]
    : tertiary
    ? [
        ["CSC101", "Introduction to Programming"],
        ["ACC201", "Financial Accounting"],
        ["CIV210", "Structural Mechanics"],
        ["NUR120", "Anatomy & Physiology"],
        ["EDU105", "Educational Psychology"],
      ]
    : [
        ["MAT10", "Mathematics"],
        ["ENG10", "English Language"],
        ["PHY10", "Physics"],
        ["BIO10", "Biology"],
        ["ICT10", "ICT"],
      ];
