import { printBrandingOf } from "@/lib/print";
import { teaching } from "@/server/repositories";
import { getTeacherSession } from "@/server/teacher-context";
import { getResolvedTheme } from "@/server/queries/theme";
import { AssignmentsView } from "./assignments-view";
import { ClassesView } from "./classes-view";
import { RegisterView } from "./register-view";

/** Slugs of the Teacher / Lecturer pages that are built. */
export const TEACHER_PAGES = ["my-classes", "class-register", "assignments"];

/** One Teacher or Lecturer page. Reads cookies and the session, so render it inside <Suspense>. */
export async function TeacherSection({ slug }: { slug: string }) {
  const { ctx, terms } = await getTeacherSession();
  const branding = printBrandingOf((await getResolvedTheme("teacher")).branding);

  if (slug === "my-classes") {
    const summaries = await teaching.listClasses(ctx);
    const classes = (await Promise.all(summaries.map((c) => teaching.getClass(ctx, c.id)))).filter((c) => c !== undefined);
    return <ClassesView classes={classes} terms={terms} branding={branding} />;
  }

  if (slug === "class-register") {
    const summaries = await teaching.listClasses(ctx);
    const sheets = (await Promise.all(summaries.map((c) => teaching.getRegister(ctx, c.id, "")))).filter((s) => s !== undefined);
    const [records, history] = await Promise.all([teaching.listRegisters(ctx), teaching.registerHistory(ctx)]);
    return <RegisterView classes={sheets.map((s) => ({ class: s.class, roster: s.roster }))} records={records} history={history} terms={terms} branding={branding} />;
  }

  if (slug === "assignments") {
    const [rows, classes] = await Promise.all([teaching.listAssignments(ctx), teaching.listClasses(ctx)]);
    const details = (await Promise.all(rows.filter((r) => r.status !== "draft").map((r) => teaching.getAssignment(ctx, r.id)))).filter((d) => d !== undefined);
    return <AssignmentsView rows={rows} details={details} classes={classes} terms={terms} branding={branding} />;
  }

  return null;
}
