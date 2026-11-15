import { printBrandingOf } from "@/lib/print";
import { STUDENT_SEED } from "@/lib/student/seed";
import { student } from "@/server/repositories";
import { getResolvedTheme } from "@/server/queries/theme";
import { getStudentSession } from "@/server/student-context";
import { AssignmentsView } from "./assignments-view";
import { AttendanceView } from "./attendance-view";
import { NoticesView } from "./notices-view";
import { ResourcesView } from "./resources-view";
import { ResultsView } from "./results-view";
import { TimetableView } from "./timetable-view";

/** Slugs of the Student pages that are built. */
export const STUDENT_PAGES = ["my-timetable", "assignments", "results-and-grades", "attendance", "learning-resources", "school-notices"];

/** One Student page. Reads cookies and the session, so render it inside <Suspense>. */
export async function StudentSection({ slug }: { slug: string }) {
  const { ctx, terms } = await getStudentSession();
  const branding = printBrandingOf((await getResolvedTheme("student")).branding);

  if (slug === "my-timetable") {
    const timetable = await student.getTimetable(ctx);
    return <TimetableView timetable={timetable} terms={terms} branding={branding} />;
  }

  if (slug === "assignments") {
    const rows = await student.listAssignments(ctx);
    return <AssignmentsView rows={rows} terms={terms} branding={branding} />;
  }

  if (slug === "results-and-grades") {
    const [report, tt] = await Promise.all([student.getResults(ctx), student.getTimetable(ctx)]);
    const who = STUDENT_SEED[ctx.institutionType];
    return <ResultsView report={report} studentName={who.name} studentNumber={who.number} group={tt.group} terms={terms} branding={branding} />;
  }

  if (slug === "attendance") {
    const [report, tt] = await Promise.all([student.getAttendance(ctx), student.getTimetable(ctx)]);
    const who = STUDENT_SEED[ctx.institutionType];
    return <AttendanceView report={report} terms={terms} branding={branding} studentName={who.name} studentNumber={who.number} group={tt.group} />;
  }

  if (slug === "learning-resources") {
    const rows = await student.listResources(ctx);
    return <ResourcesView rows={rows} terms={terms} branding={branding} />;
  }

  if (slug === "school-notices") {
    const rows = await student.listNotices(ctx);
    return <NoticesView rows={rows} timezone={branding.timezone} />;
  }

  return null;
}
