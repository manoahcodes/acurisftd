import { hrefForNavLabel } from "@/config/navigation";
import { prettyDate } from "@/lib/teacher/dates";
import type { SearchResult } from "@/types/directory";
import { student } from "../repositories";
import type { StudentContext } from "../repositories/student-types";

const MAX_RESULTS = 8;

/**
 * Search across the signed-in student's own assignments, results, notices,
 * learning resources and courses. Everything comes from repositories scoped to
 * this student, so nothing of anyone else's can appear.
 */
export async function searchStudent(ctx: StudentContext, query: string): Promise<SearchResult[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const [assignments, notices, resources, timetable, results] = await Promise.all([
    student.listAssignments(ctx),
    student.listNotices(ctx),
    student.listResources(ctx),
    student.getTimetable(ctx),
    student.getResults(ctx),
  ]);
  const href = (label: string) => hrefForNavLabel("student", label, "Student search");

  const entries: Array<SearchResult & { text: string }> = [
    ...assignments.map((a) => ({ id: `assignment-${a.id}`, title: a.title, subtitle: `${a.courseName} · Due ${prettyDate(a.dueDate)}`, kind: "Assignment", href: href("Assignments"), text: `${a.title} ${a.courseName} ${a.kind}` })),
    ...results.courses.flatMap((c) => c.items.filter((i) => i.state === "marked").map((i) => ({ id: `result-${i.id}`, title: `${c.courseName}: ${i.title}`, subtitle: `${i.pct}%`, kind: "Result", href: href("Results & grades"), text: `${c.courseName} ${i.title} ${i.kind}` }))),
    ...notices.map((n) => ({ id: `notice-${n.id}`, title: n.title, subtitle: `${n.category} · ${prettyDate(n.postedOn)}${n.read ? "" : " · Unread"}`, kind: "Notice", href: href("School notices"), text: `${n.title} ${n.body} ${n.category}` })),
    ...resources.map((r) => ({ id: `resource-${r.id}`, title: r.title, subtitle: `${r.courseName} · ${r.kind}`, kind: "Resource", href: href("Learning resources"), text: `${r.title} ${r.topic} ${r.courseName} ${r.kind}` })),
    ...timetable.courses.map((c) => ({ id: `course-${c.id}`, title: c.name, subtitle: `${c.teacher} · ${c.room}`, kind: "Timetable", href: href("My timetable"), text: `${c.name} ${c.code} ${c.teacher}` })),
  ];
  return entries
    .filter((e) => e.text.toLowerCase().includes(q))
    .slice(0, MAX_RESULTS)
    .map((e): SearchResult => ({ id: e.id, title: e.title, subtitle: e.subtitle, kind: e.kind, href: e.href }));
}
