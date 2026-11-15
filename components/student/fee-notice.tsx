import { Chip } from "@/components/teacher/shared";
import { feeNotice, withheldMessage } from "@/lib/student/fees";
import type { FeeBalance } from "@/lib/fee-policy";
import type { StudentTerms } from "@/lib/student/terms";
import type { StudentFeeView } from "@/server/queries/student-fees";
import { prettyDate } from "@/lib/teacher/dates";

/** The neutral fee notice shown on My home. Renders nothing when the balance is cleared. */
export function FeeNotice({ view, terms }: { view: StudentFeeView; terms: StudentTerms }) {
  const n = feeNotice(terms, view.fee, view.policy, view.withheld);
  if (!n) return null;
  return (
    <section aria-label="Fee balance" className="mb-6 rounded-2xl border border-line bg-surface p-5">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold text-ink">{n.title}</h2>
        <Chip tone={n.tone}>{view.fee.status === "overdue" ? "Overdue" : "Due"}</Chip>
      </div>
      <p className="mt-1 text-[15px] text-ink">{n.detail}</p>
      {view.fee.dueOn && <p className="mt-1 text-sm text-muted">Due {prettyDate(view.fee.dueOn)}</p>}
    </section>
  );
}

/** Shown in place of a document the school withholds until the balance is cleared. Never a blank screen. */
export function WithheldCard({ what, fee, terms }: { what: string; fee: FeeBalance; terms: StudentTerms }) {
  const m = withheldMessage(terms, fee);
  return (
    <section aria-label={`${what} withheld`} className="rounded-2xl border border-line bg-surface p-5">
      <p className="text-sm font-medium text-muted">{what}</p>
      <h2 className="mt-1 text-lg font-semibold text-ink">{m.title}</h2>
      <p className="mt-1 text-[15px] text-ink">{m.detail}</p>
    </section>
  );
}
