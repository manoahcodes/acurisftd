import { CALENDAR_OPENS } from "@/lib/parent/seed";
import { CalendarView } from "./calendar-view";
import { parent } from "@/server/repositories";
import { buildStatement } from "@/lib/parent/fees";
import { FeesView } from "./fees-view";
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
export const PARENT_PAGES = ["my-children", "attendance", "academic-progress", "fee-statements", "school-calendar"];

/** One Parent page. Reads cookies and the session, so render it inside <Suspense>. */
export async function ParentSection({ slug }: { slug: string }) {
  const session = await getParentSession();
  const { terms } = session;

  if (slug === "my-children") {
    const rows = await getChildOverviews(session);
    return <ChildrenView rows={rows} terms={terms} selectedId={session.selected?.id} />;
  }

  if (slug === "school-calendar") {
    const [events, meetings] = await Promise.all([parent.listEvents(session.ctx), parent.listMeetings(session.ctx)]);
    const staff = await Promise.all(session.children.map(async (c) => [c.id, await parent.listStaff(session.ctx, c.id)] as const));
    // The month the sample calendar opens on; the server never reads the clock while prerendering.
    const initialMonth = CALENDAR_OPENS;
    return <CalendarView events={events} meetings={meetings} kids={session.children} staffByChild={Object.fromEntries(staff)} timezone={session.timezone} initialMonth={initialMonth} />;
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

  if (slug === "fee-statements") {
    // SWAP POINT: the Bursar's invoices and receipts replace buildStatement.
    const [fee, tt, results] = await Promise.all([student.getFees(ctx), student.getTimetable(ctx), student.getResults(ctx)]);
    const statement = buildStatement(session.ctx.institutionType, child.id, fee, results.periodLabel);
    return (
      <>
        <ChildBanner name={child.name} />
        <FeesView statement={statement} childName={child.name} studentNumber={STUDENT_SEED[session.ctx.institutionType].number} group={tt.group} periodLabel={results.periodLabel} policy={session.feePolicy} withheld={withheldFor(session.feePolicy, fee)} terms={terms} branding={branding} />
      </>
    );
  }

  return null;
}

/** Says whose records the page shows; the top bar's child switcher changes it. */
function ChildBanner({ name }: { name: string }) {
  return <p className="mt-6 text-[15px] text-muted">Showing <span className="font-semibold text-ink">{name}</span>. Use the child switcher in the top bar to see another child.</p>;
}
