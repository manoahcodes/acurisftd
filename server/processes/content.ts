import { toCsv } from "@/lib/csv";
import { COURSE_ROWS, LEARNERS, groupNames, type Flavour } from "../repositories/platform-mock/shared";

/** Stable pseudo-random number from text, so the same student always gets the same sample marks. */
function seed(text: string): number {
  let h = 2166136261;
  for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return (h >>> 0) % 1000;
}

const gradeFor = (mark: number) => (mark >= 80 ? "A" : mark >= 70 ? "B" : mark >= 60 ? "C" : mark >= 50 ? "D" : "F");

/** The mock has no stored marks yet, so sample ones are generated per student and course. */
const markFor = (student: string, course: string) => 48 + (seed(`${student}|${course}`) % 46);

/** Student labels read "STU-1048 · Chisomo Banda"; this splits them. */
export const splitStudent = (label: string): { no: string; name: string } => {
  const [no, ...rest] = label.split(" · ");
  return { no: no.trim(), name: rest.join(" · ").trim() };
};

export function transcriptCsv(f: Flavour, students: string[], period: string): string {
  const courses = COURSE_ROWS(f.tertiary, f.primary);
  const rows: string[][] = [["Student no.", "Name", f.terms.period, "Code", f.terms.course, "Mark", "Grade"]];
  for (const label of students) {
    const { no, name } = splitStudent(label);
    for (const [code, title] of courses) {
      const mark = markFor(label, code);
      rows.push([no, name, period, code, title, String(mark), gradeFor(mark)]);
    }
  }
  return toCsv(rows);
}

export function docketsCsv(f: Flavour, dockets: string[][]): string {
  return toCsv([
    ["Docket", "Student no.", "Name", `${f.terms.courses} on docket`, "Venue"],
    ...dockets.map(([docket, student, count, venue]) => {
      const { no, name } = splitStudent(student);
      return [docket, no, name, count, venue];
    }),
  ]);
}

export function reportCsv(kind: "academic" | "finance", name: string, f: Flavour): string {
  if (kind === "finance") {
    const lines = ["Tuition", "Accommodation", "Examination", "Activities", "Other"].map((fee) => {
      const billed = 20000 + (seed(`${name}|${fee}`) % 90) * 1000;
      const paid = Math.round(billed * (0.62 + (seed(`${fee}|${name}`) % 30) / 100));
      return [fee, String(billed), String(paid), String(billed - paid)];
    });
    return toCsv([[`Report: ${name}`], ["Fee", "Billed (K)", "Collected (K)", "Outstanding (K)"], ...lines]);
  }
  const groups = [...new Set(groupNames(f.tertiary, f.primary))];
  const lines = groups.map((g) => {
    const learners = 24 + (seed(`${name}|${g}`) % 40);
    const avg = 55 + (seed(`${g}|${name}`) % 30);
    return [g, String(learners), `${avg}%`, `${Math.min(99, avg + 8)}%`];
  });
  return toCsv([
    [`Report: ${name}`],
    [f.tertiary ? "Programme" : "Class", f.tertiary ? "Students" : "Learners", "Average", "Pass rate"],
    ...lines,
  ]);
}

/** Sample data for each dataset the school can export. */
export function exportCsv(dataset: string, f: Flavour): string {
  const groups = groupNames(f.tertiary, f.primary);
  const students = [
    ["Student no.", "Name", f.tertiary ? "Programme" : "Class", "Guardian", "Phone"],
    ...LEARNERS.map((l, i) => [l.no, l.name, groups[i], `${l.name.split(" ").slice(-1)[0]} family`, `097${String(1000000 + seed(l.no) * 7).slice(0, 7)}`]),
  ];
  const fees = [
    ["Student no.", "Name", "Billed (K)", "Paid (K)", "Balance (K)"],
    ...LEARNERS.map((l) => {
      const billed = 9000 + (seed(l.no) % 12) * 1000;
      const paid = Math.round(billed * (0.5 + (seed(l.name) % 50) / 100));
      return [l.no, l.name, String(billed), String(paid), String(billed - paid)];
    }),
  ];
  const results = [
    ["Student no.", "Name", "Code", f.terms.course, "Mark"],
    ...LEARNERS.slice(0, 6).flatMap((l) =>
      COURSE_ROWS(f.tertiary, f.primary).map(([code, title]) => [l.no, l.name, code, title, String(markFor(l.no, code))]),
    ),
  ];
  switch (dataset) {
    case "Students and guardians":
      return toCsv(students);
    case "Fee accounts and payments":
      return toCsv(fees);
    case "Results and transcripts":
      return toCsv(results);
    default:
      // Full archive: every dataset in one file, each under its own heading.
      return toCsv([["# Students and guardians"], ...students, [""], ["# Fee accounts and payments"], ...fees, [""], ["# Results and transcripts"], ...results]);
  }
}
