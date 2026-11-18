"use client";

import { useEffect, useState, useTransition } from "react";
import { Printer, Undo2 } from "lucide-react";
import { Chip, Dialog, Field, buttonClass, primaryClass, Stat } from "@/components/teacher/shared";
import { DetailsList, PrintSheet, PrintTable } from "@/components/platform/print-sheet";
import { AccountChip, ErrorNote, PaymentChip, textareaClass } from "./bits";
import { loadStatement, reversePayment } from "@/server/actions/bursar";
import { STATEMENT_COLUMNS, statementRows } from "@/lib/bursar/format";
import { planProgress } from "@/lib/bursar/plans";
import type { BursarTerms } from "@/lib/bursar/terms";
import { METHOD_LABELS } from "@/lib/cashier/methods";
import { ACCOUNT_LABELS } from "@/lib/cashier/terms";
import { formatKwacha } from "@/lib/money";
import type { PrintBranding } from "@/lib/print";
import { prettyDate } from "@/lib/teacher/dates";
import type { Payment, Statement } from "@/types/bursar";

/** One student's statement: every charge, payment, reversal and waiver, with a way to reverse a payment. */
export function StatementDialog({ studentNo, terms, today, branding, onClose, onChanged }: { studentNo: string; terms: BursarTerms; today: string; branding: PrintBranding; onClose: () => void; onChanged?: () => void }) {
  const [statement, setStatement] = useState<Statement | null | undefined>(undefined);
  const [reversing, setReversing] = useState<Payment | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  const [busy, start] = useTransition();

  useEffect(() => {
    let live = true;
    loadStatement(studentNo).then((s) => live && setStatement(s));
    return () => {
      live = false;
    };
  }, [studentNo]);

  const reload = () => loadStatement(studentNo).then(setStatement);

  const confirm = () => {
    if (!reversing) return;
    if (!reason.trim()) return setError("A reason is required.");
    start(async () => {
      const r = await reversePayment(reversing.id, reason);
      if (!r.ok) return setError(r.error);
      setReversing(null);
      setReason("");
      setError(null);
      await reload();
      onChanged?.();
    });
  };

  const a = statement?.account;
  const progress = statement?.plan && a ? planProgress(statement.plan, a.owed, today) : undefined;
  const byId = new Map((statement?.payments ?? []).map((p) => [p.id, p]));

  // The print sheet sits over the page, so the dialog (which is above everything) steps aside while it is open.
  if (printing && statement && a) {
    return (
      <PrintSheet branding={branding} title={`Fee statement, ${a.name}`} signature onClose={() => setPrinting(false)}>
        <DetailsList details={[["Student number", a.no], [terms.group, a.group], ["Billed", formatKwacha(a.billed)], ["Paid", formatKwacha(a.paid)], ["Owed", formatKwacha(a.owed)], ["Statement date", prettyDate(today)]]} />
        <div className="mt-6"><PrintTable columns={STATEMENT_COLUMNS} rows={statementRows(statement.entries)} /></div>
      </PrintSheet>
    );
  }

  return (
    <Dialog title={a ? a.name : "Statement"} subtitle={a ? `${a.no} • ${a.group}` : undefined} onClose={() => !busy && onClose()} wide>
      <div className="space-y-5 px-6 py-5">
        {statement === undefined && <p className="text-[15px] text-muted" role="status">Loading the statement…</p>}
        {statement === null && <ErrorNote>That student is not on this school&apos;s roll.</ErrorNote>}
        {statement && a && (
          <>
            <div className="grid gap-3 sm:grid-cols-4">
              <Stat label="Billed" value={formatKwacha(a.billed)} />
              <Stat label="Paid" value={formatKwacha(a.paid)} />
              <Stat label="Waived" value={formatKwacha(a.waived)} />
              <Stat label="Owed" value={formatKwacha(a.owed)} note={a.dueOn && a.owed > 0 ? `Due ${prettyDate(a.dueOn)}` : undefined} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <AccountChip account={a} />
              {a.onPlan && <Chip tone={progress?.behind ? "bad" : "info"}>{progress?.behind ? "Behind on payment plan" : "On a payment plan"}</Chip>}
              {a.pendingWaivers > 0 && <Chip tone="warn">{a.pendingWaivers} waiver {a.pendingWaivers === 1 ? "request" : "requests"} pending</Chip>}
              <button type="button" onClick={() => setPrinting(true)} className={`${buttonClass} ml-auto`}>
                <Printer size={16} aria-hidden /> Print statement
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-120 text-left text-[15px]">
                <thead>
                  <tr className="border-b border-line text-sm text-muted">
                    <th className="py-2 pr-3 font-medium">Account</th>
                    <th className="py-2 pr-3 text-right font-medium">Billed</th>
                    <th className="py-2 pr-3 text-right font-medium">Owed</th>
                    <th className="py-2 font-medium">Due</th>
                  </tr>
                </thead>
                <tbody>
                  {a.lines.filter((l) => l.billed > 0 || l.owed > 0).map((l) => (
                    <tr key={l.kind} className="border-b border-line last:border-0">
                      <td className="py-2 pr-3 text-ink">{ACCOUNT_LABELS[l.kind]}</td>
                      <td className="py-2 pr-3 text-right text-muted">{formatKwacha(l.billed)}</td>
                      <td className="py-2 pr-3 text-right text-ink">{formatKwacha(l.owed)}</td>
                      <td className="py-2 text-muted">{l.owed > 0 && l.dueOn ? prettyDate(l.dueOn) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div>
              <h3 className="text-base font-semibold text-ink">Statement</h3>
              {statement.entries.length === 0 ? (
                <p className="mt-2 text-[15px] text-muted">Nothing has been billed or paid yet.</p>
              ) : (
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full min-w-176 text-left text-[15px]">
                    <thead>
                      <tr className="border-b border-line text-sm text-muted">
                        <th className="py-2 pr-3 font-medium">Date</th>
                        <th className="py-2 pr-3 font-medium">Description</th>
                        <th className="py-2 pr-3 font-medium">Reference</th>
                        <th className="py-2 pr-3 text-right font-medium">Charged</th>
                        <th className="py-2 pr-3 text-right font-medium">Paid or credited</th>
                        <th className="py-2 pr-3 text-right font-medium">Owed after</th>
                        <th className="py-2"><span className="sr-only">Actions</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {statement.entries.map((e) => {
                        const p = e.kind === "payment" && e.paymentId ? byId.get(e.paymentId) : undefined;
                        return (
                          <tr key={e.id} className="border-b border-line align-top last:border-0">
                            <td className="whitespace-nowrap py-2 pr-3 text-muted">{prettyDate(e.date)}</td>
                            <td className="py-2 pr-3 text-ink">
                              {e.description}
                              {p && <span className="block text-sm text-muted">{METHOD_LABELS[p.method]} • {p.by}</span>}
                            </td>
                            <td className="py-2 pr-3 text-muted">{e.reference}</td>
                            <td className="py-2 pr-3 text-right text-ink">{e.charge ? formatKwacha(e.charge) : ""}</td>
                            <td className="py-2 pr-3 text-right text-ink">{e.credit ? formatKwacha(e.credit) : ""}</td>
                            <td className="py-2 pr-3 text-right text-ink">{formatKwacha(e.balance)}</td>
                            <td className="py-2 text-right">
                              {p && (p.status === "success" ? (
                                <button type="button" onClick={() => { setReversing(p); setReason(""); setError(null); }} className={buttonClass} aria-label={`Reverse payment ${p.no}`}>
                                  <Undo2 size={16} aria-hidden /> Reverse
                                </button>
                              ) : (
                                <PaymentChip status={p.status} />
                              ))}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {reversing && (
              <form noValidate onSubmit={(e) => { e.preventDefault(); confirm(); }} className="space-y-3 rounded-xl border border-line bg-canvas p-4">
                <p className="text-[15px] font-medium text-ink">Reverse {reversing.no}: {formatKwacha(reversing.amount)} for {ACCOUNT_LABELS[reversing.account]}</p>
                <p className="text-sm text-muted">The payment stays on the record as reversed and the amount goes back on what {a.name} owes.{reversing.fromUnallocated ? " It returns to unallocated payments so it can be given to the right student." : ""}</p>
                <Field label="Reason" required error={error ?? undefined}>
                  {(p) => <textarea {...p} value={reason} onChange={(e) => setReason(e.target.value)} className={textareaClass} maxLength={210} placeholder="For example: paid into the wrong student's account" />}
                </Field>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setReversing(null)} disabled={busy} className={buttonClass}>Cancel</button>
                  <button type="submit" disabled={busy} className={primaryClass}>{busy ? "Reversing…" : "Reverse payment"}</button>
                </div>
              </form>
            )}

            {statement.waivers.length > 0 && (
              <div>
                <h3 className="text-base font-semibold text-ink">Bursaries and waivers</h3>
                <ul className="mt-2 space-y-1 text-[15px]">
                  {statement.waivers.map((w) => (
                    <li key={w.id} className="text-muted">
                      <span className="text-ink">{w.no}</span> • {formatKwacha(w.amount)} on {ACCOUNT_LABELS[w.account]} from {w.source} • {w.status === "pending" ? "pending approval" : w.status}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {statement.plan && progress && (
              <div>
                <h3 className="text-base font-semibold text-ink">Payment plan</h3>
                <p className="mt-1 text-[15px] text-muted">
                  {progress.done ? "Paid in full." : `${formatKwacha(progress.paid)} of ${formatKwacha(statement.plan.startBalance)} paid.${progress.next ? ` Next instalment ${formatKwacha(progress.next.amount)} on ${prettyDate(progress.next.dueOn)}.` : ""}`}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </Dialog>
  );
}
