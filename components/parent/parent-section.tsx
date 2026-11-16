import { withheldFor } from "@/lib/fee-policy";
import { ResultsView } from "@/components/student/results-view";
import { STUDENT_SEED } from "@/lib/student/seed";
import { printBrandingOf } from "@/lib/print";
import { AttendanceView } from "@/components/student/attendance-view";
import { Card } from "@/components/teacher/shared";
import { student } from "@/server/repositories";
import { getResolvedTheme } from "@/server/queries/theme";
import { getChildOverviews } from "@/server/queries/parent-children";
import { childContext, getParentSession } from "@/server/parent-context";
import { ChildrenView } from "./children-view";

/** Slugs of the Parent pages that are built. */
export const PARENT_PAGES = ["my-children", "attendance", "academic-progress"];

/** One Parent page. Reads cookies and the session, so render it inside <Suspense>. */
export async function ParentSection({ slug }: { slug: string }) {
  const session = await getParentSession();
  const { terms } = session;

  if (slug === "my-children") {
    const rows = await getChildOverviews(session);
    return <ChildrenView rows={rows} terms={terms} selectedId={session.selected?.id} />;
  }

  const child = session.selected;
  const ctx = child && childContext(session, child.id);
  if (!child || !ctx) {
    return <Card><p className="text-[15px] text-muted">No {terms.member.toLowerCase()} is linked to your account yet.</p></Card>;
  }
  const branding = printBrandingOf((await getResolvedTheme("parent")).branding);

  if (slug === "attendance") {
    const [report, tt] = await Promise.all([student.getAttendance(ctx), student.getTimetable(ctx)]);
    return (
      <>
        <ChildBanner name={child.name} />
        <AttendanceView viewerChild={child.name.split(" ")[0]} report={report} terms={terms} branding={branding} studentName={child.name} studentNumber={STUDENT_SEED[session.ctx.institutionType].number} group={tt.group} />
      </>
    );
  }

  if (slug === "academic-progress") {
    const [report, tt, fee] = await Promise.all([student.getResults(ctx), student.getTimetable(ctx), student.getFees(ctx)]);
    return (
      <>
        <ChildBanner name={child.name} />
        <ResultsView report={report} studentName={child.name} studentNumber={STUDENT_SEED[session.ctx.institutionType].number} group={tt.group} terms={terms} branding={branding} fee={fee} slipWithheld={withheldFor(session.feePolicy, fee).results} slipName="Report card" printPast forParent />
      </>
    );
  }

  return null;
}

/** Says whose records the page shows; the top bar's child switcher changes it. */
function ChildBanner({ name }: { name: string }) {
  return <p className="mt-6 text-[15px] text-muted">Showing <span className="font-semibold text-ink">{name}</span>. Use the child switcher in the top bar to see another child.</p>;
}
