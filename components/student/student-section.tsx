import { printBrandingOf } from "@/lib/print";
import { student } from "@/server/repositories";
import { getResolvedTheme } from "@/server/queries/theme";
import { getStudentSession } from "@/server/student-context";
import { AssignmentsView } from "./assignments-view";
import { TimetableView } from "./timetable-view";

/** Slugs of the Student pages that are built. */
export const STUDENT_PAGES = ["my-timetable", "assignments"];

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

  return null;
}
