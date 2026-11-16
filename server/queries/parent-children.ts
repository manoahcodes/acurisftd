import { withheldFor, type FeeBalance, type Withheld } from "@/lib/fee-policy";
import { byCourse, figures } from "@/lib/student/attendance";
import type { Child } from "@/types/topbar";
import { student } from "../repositories";
import { childContext, type ParentSession } from "../parent-context";

export type ChildOverview = {
  child: Child;
  group: string;
  /** Share (0-100) of sittings attended this period; null with none. */
  attendanceRate: number | null;
  attendanceRequired: number;
  periodLabel: string;
  /** Average percent so far; null until something is marked. */
  average: number | null;
  overallGrade: string;
  /** Grade-point average at colleges and universities; null at schools. */
  gpa: number | null;
  /** The course with the lowest attendance rate, for a gentle heads-up. */
  weakestCourse: string | null;
  pendingWork: number;
  fee: FeeBalance;
  withheld: Withheld;
};

/** One card per linked child, built from the same records the child sees. */
export async function getChildOverviews(s: ParentSession): Promise<ChildOverview[]> {
  const rows = await Promise.all(
    s.children.map(async (child): Promise<ChildOverview | undefined> => {
      const ctx = childContext(s, child.id);
      if (!ctx) return undefined;
      const [tt, report, attendance, fee, pendingWork] = await Promise.all([student.getTimetable(ctx), student.getResults(ctx), student.getAttendance(ctx), student.getFees(ctx), student.countPending(ctx)]);
      const rate = figures(attendance.entries).rate;
      const weakest = byCourse(attendance.entries).filter((c) => c.rate !== null).sort((a, b) => (a.rate ?? 0) - (b.rate ?? 0))[0];
      return {
        child,
        group: tt.group,
        attendanceRate: rate,
        attendanceRequired: attendance.required,
        periodLabel: report.periodLabel,
        average: report.average,
        overallGrade: report.overallGrade,
        gpa: report.gpa,
        weakestCourse: weakest && weakest.rate !== null && weakest.rate < attendance.required ? weakest.courseName : null,
        pendingWork,
        fee,
        withheld: withheldFor(s.feePolicy, fee),
      };
    }),
  );
  return rows.filter((r): r is ChildOverview => r !== undefined);
}
