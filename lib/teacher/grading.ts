import type { InstitutionType } from "@/config/institution";
import { INSTITUTIONS } from "@/config/institution";
import type { GradeBand } from "@/types/teacher";

/**
 * Grading scales (sample values; a school replaces them with its own).
 * Schools use letters A-F out of 100. Colleges and universities use a 4.0
 * grade-point scale. Highest band first.
 */
const SCHOOL: GradeBand[] = [
  { grade: "A", min: 80, points: 1, remark: "Distinction" },
  { grade: "B", min: 70, points: 2, remark: "Merit" },
  { grade: "C", min: 60, points: 3, remark: "Credit" },
  { grade: "D", min: 50, points: 4, remark: "Pass" },
  { grade: "E", min: 40, points: 5, remark: "Marginal" },
  { grade: "F", min: 0, points: 6, remark: "Fail" },
];

const TERTIARY: GradeBand[] = [
  { grade: "A", min: 80, points: 4, remark: "Excellent" },
  { grade: "B+", min: 70, points: 3.5, remark: "Very good" },
  { grade: "B", min: 60, points: 3, remark: "Good" },
  { grade: "C+", min: 55, points: 2.5, remark: "Fairly good" },
  { grade: "C", min: 50, points: 2, remark: "Pass" },
  { grade: "D", min: 40, points: 1, remark: "Marginal" },
  { grade: "F", min: 0, points: 0, remark: "Fail" },
];

export const isTertiary = (type: InstitutionType) => INSTITUTIONS[type].level === "tertiary";
export const bandsFor = (type: InstitutionType): GradeBand[] => (isTertiary(type) ? TERTIARY : SCHOOL);
/** The lowest percentage that counts as a pass (a school can replace this). */
export const PASS_MARK = 50;

export const percent = (mark: number, max: number): number => Math.round((mark / max) * 1000) / 10;

export function gradeOf(pct: number, bands: GradeBand[]): GradeBand {
  return bands.find((b) => pct >= b.min) ?? bands[bands.length - 1];
}

export type Score = { pct: number | null; weight: number };

/**
 * The final percentage: coursework (assignment marks) counts for
 * `courseworkWeight` percent and the assessments share the rest in proportion
 * to their weights. Items with no mark are left out and the rest re-weighted,
 * so a learner is never marked down for something not yet marked.
 */
export function finalPercent(assessments: Score[], coursework: number | null, courseworkWeight: number): number | null {
  const sat = assessments.filter((a): a is { pct: number; weight: number } => a.pct !== null && a.weight > 0);
  const weights = sat.reduce((n, a) => n + a.weight, 0);
  const assessed = weights > 0 ? sat.reduce((n, a) => n + a.pct * a.weight, 0) / weights : null;
  if (assessed === null && coursework === null) return null;
  if (assessed === null) return round1(coursework!);
  if (coursework === null || courseworkWeight <= 0) return round1(assessed);
  return round1((coursework * courseworkWeight + assessed * (100 - courseworkWeight)) / 100);
}

export const round1 = (n: number) => Math.round(n * 10) / 10;

/** Competition ranking: equal finals share a rank and the next rank is skipped. */
export function rankOf(finals: Array<number | null>): Array<number | null> {
  return finals.map((f) => (f === null ? null : 1 + finals.filter((g) => g !== null && g > f).length));
}
