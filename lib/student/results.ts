import { bandsFor, finalPercent, gradeOf, isTertiary, PASS_MARK, percent, round1 } from "@/lib/teacher/grading";
import type { InstitutionType } from "@/config/institution";
import type { CourseResult, PastPeriod, ResultItem, ResultsReport, StudentCourse } from "@/types/student";
import type { AssessmentSeed, PastSeed } from "./seed";

/** Building a student's results. Pure: the repository hands in the raw marks. */

/** Share (0-100) of the final figure that comes from assignments. */
export const COURSEWORK_WEIGHT = 20;

export type CourseworkMark = { courseId: string; mark: number; max: number };

export function itemOf(a: AssessmentSeed): ResultItem {
  const marked = a.state === "marked" && a.mark !== undefined;
  return {
    id: a.id,
    title: a.title,
    kind: a.kind,
    date: a.date,
    maxMarks: a.max,
    weight: a.weight,
    state: a.state,
    mark: marked ? a.mark! : null,
    pct: marked ? percent(a.mark!, a.max) : null,
    classAverage: marked && a.classAverage !== undefined ? a.classAverage : null,
  };
}

export function courseResult(type: InstitutionType, course: StudentCourse, assessments: AssessmentSeed[], coursework: CourseworkMark[]): CourseResult {
  const bands = bandsFor(type);
  const items = assessments.map(itemOf).sort((a, b) => a.date.localeCompare(b.date));
  const works = coursework.filter((w) => w.courseId === course.id && w.max > 0).map((w) => percent(w.mark, w.max));
  const cw = works.length ? round1(works.reduce((n, w) => n + w, 0) / works.length) : null;
  // Excused and upcoming items carry no mark, so they are left out and the rest are re-weighted.
  const final = finalPercent(items.map((i) => ({ pct: i.pct, weight: i.weight })), cw, COURSEWORK_WEIGHT);
  const band = final === null ? null : gradeOf(final, bands);
  return {
    courseId: course.id,
    courseName: course.name,
    code: course.code,
    teacher: course.teacher,
    credits: course.credits,
    items,
    coursework: cw,
    courseworkCount: works.length,
    courseworkWeight: COURSEWORK_WEIGHT,
    final,
    grade: band?.grade ?? "—",
    points: band?.points ?? null,
    remark: band?.remark ?? "",
    passed: final === null ? null : final >= PASS_MARK,
    provisional: items.some((i) => i.state === "upcoming" || i.state === "pending"),
  };
}

/** Credit-weighted grade-point average; courses with no credits count once. Null when nothing counts. */
export function gradePointAverage(rows: Array<{ points: number | null; credits: number | null }>): number | null {
  const counted = rows.filter((r): r is { points: number; credits: number | null } => r.points !== null);
  const weight = counted.reduce((n, r) => n + (r.credits ?? 1), 0);
  if (weight === 0) return null;
  return Math.round((counted.reduce((n, r) => n + r.points * (r.credits ?? 1), 0) / weight) * 100) / 100;
}

export function pastPeriod(type: InstitutionType, seed: PastSeed): PastPeriod {
  const bands = bandsFor(type);
  const courses = seed.courses.map((c) => {
    const band = gradeOf(c.pct, bands);
    return { name: c.name, credits: c.credits, pct: c.pct, grade: band.grade, points: band.points };
  });
  return {
    label: seed.label,
    courses,
    average: round1(courses.reduce((n, c) => n + c.pct, 0) / courses.length),
    gpa: isTertiary(type) ? gradePointAverage(courses) : null,
    credits: courses.reduce((n, c) => n + (c.credits ?? 0), 0),
  };
}

export function buildReport(args: { type: InstitutionType; periodLabel: string; courses: StudentCourse[]; assessments: AssessmentSeed[]; coursework: CourseworkMark[]; history: PastSeed[] }): ResultsReport {
  const { type } = args;
  const bands = bandsFor(type);
  const rows = args.courses.map((c) => courseResult(type, c, args.assessments.filter((a) => a.course === args.courses.indexOf(c)), args.coursework));
  const finals = rows.map((r) => r.final).filter((f): f is number => f !== null);
  const average = finals.length ? round1(finals.reduce((n, f) => n + f, 0) / finals.length) : null;
  const tertiary = isTertiary(type);
  const history = args.history.map((h) => pastPeriod(type, h));
  const gpa = tertiary ? gradePointAverage(rows) : null;
  const allRows = [...history.flatMap((h) => h.courses), ...rows.map((r) => ({ points: r.points, credits: r.credits }))];
  return {
    periodLabel: args.periodLabel,
    courses: rows,
    average,
    overallGrade: average === null ? "—" : gradeOf(average, bands).grade,
    gpa,
    cumulativeGpa: tertiary ? gradePointAverage(allRows) : null,
    creditsPassed: rows.filter((r) => r.passed).reduce((n, r) => n + (r.credits ?? 0), 0),
    creditsTotal: rows.reduce((n, r) => n + (r.credits ?? 0), 0),
    history,
    bands,
    passMark: PASS_MARK,
    provisional: rows.some((r) => r.provisional),
  };
}
