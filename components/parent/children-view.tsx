import Link from "next/link";
import { Card, Chip, Stat } from "@/components/teacher/shared";
import { hrefFor } from "@/config/navigation";
import { formatKwacha } from "@/lib/money";
import { prettyDate } from "@/lib/teacher/dates";
import type { StudentTerms } from "@/lib/student/terms";
import type { ChildOverview } from "@/server/queries/parent-children";

// Local copies: this is a Server Component, so it cannot call functions exported from a client module.
const rateText = (rate: number | null) => (rate === null ? "—" : `${rate}%`);
const rateTone = (rate: number | null) => (rate === null ? "info" : rate >= 90 ? "good" : rate >= 75 ? "warn" : "bad") as "good" | "warn" | "bad" | "info";
const initials = (name: string) => name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();

/** One card per linked child: who they are, how they are doing, and what is owed. */
export function ChildrenView({ rows, terms, selectedId }: { rows: ChildOverview[]; terms: StudentTerms; selectedId: string | undefined }) {
  if (rows.length === 0) {
    return (
      <Card>
        <h2 className="text-lg font-semibold text-ink">No {terms.member.toLowerCase()}s are linked to your account yet</h2>
        <p className="mt-1 text-[15px] text-muted">Ask the school office to link your child, or send a request from <Link href={hrefFor("parent", "profile")} className="text-brand hover:underline">Profile</Link>.</p>
      </Card>
    );
  }
  return (
    <ul className="grid gap-5 lg:grid-cols-2" aria-label="My children">
      {rows.map((r) => (
        <li key={r.child.id}>
          <Card className="h-full">
            <div className="flex items-center gap-4">
              <span aria-hidden className="grid size-14 shrink-0 place-items-center rounded-full bg-brand text-lg font-bold text-on-brand">{initials(r.child.name)}</span>
              <div className="min-w-0">
                <h2 className="truncate text-xl font-semibold text-ink">{r.child.name}</h2>
                <p className="text-[15px] text-muted">{r.child.grade}</p>
              </div>
              {r.child.id === selectedId && <span className="ml-auto"><Chip tone="info">Selected</Chip></span>}
            </div>

            <dl className="mt-5 grid grid-cols-2 gap-3">
              <Stat label="Attendance" value={rateText(r.attendanceRate)} note={`${r.periodLabel}, school expects ${r.attendanceRequired}%`} />
              <Stat label={terms.tertiary ? "GPA" : "Average"} value={terms.tertiary ? (r.gpa === null ? "—" : r.gpa.toFixed(2)) : r.average === null ? "—" : `${r.average}%`} note={r.overallGrade ? `Grade ${r.overallGrade}` : undefined} />
              <Stat label="Work to hand in" value={String(r.pendingWork)} />
              <Stat label="Fee balance" value={r.fee.balance > 0 ? formatKwacha(r.fee.balance) : "Cleared"} note={r.fee.dueOn ? `Due ${prettyDate(r.fee.dueOn)}` : undefined} />
            </dl>

            <div className="mt-4 flex flex-wrap gap-2">
              <Chip tone={rateTone(r.attendanceRate)}>{r.attendanceRate !== null && r.attendanceRate < r.attendanceRequired ? "Attendance below target" : "Attendance on track"}</Chip>
              {r.fee.status !== "paid" && <Chip tone={r.fee.status === "overdue" ? "bad" : "warn"}>{r.fee.status === "overdue" ? "Fees overdue" : "Fees due"}</Chip>}
              {r.withheld.examCard && <Chip tone="warn">Exam card withheld</Chip>}
              {r.withheld.results && <Chip tone="warn">Result slip withheld</Chip>}
            </div>
            {r.weakestCourse && <p className="mt-3 text-sm text-muted">Most missed {terms.course.toLowerCase()}: {r.weakestCourse}.</p>}

            <nav aria-label={`${r.child.name} pages`} className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[15px]">
              {[["Attendance", "attendance"], ["Academic progress", "academic-progress"], ["Fee statements", "fee-statements"]].map(([label, slug]) => (
                <Link key={slug} href={hrefFor("parent", slug)} className="text-brand hover:underline">{label}</Link>
              ))}
            </nav>
          </Card>
        </li>
      ))}
    </ul>
  );
}
