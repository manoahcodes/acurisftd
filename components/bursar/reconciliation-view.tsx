"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, FileUp, Flag, Search } from "lucide-react";
import { Card, Chip, Dialog, ExportBar, Field, Stat, buttonClass, downloadCsv, inputClass, primaryClass } from "@/components/teacher/shared";
import { PrintSheet, PrintTable } from "@/components/platform/print-sheet";
import { ErrorNote, textareaClass } from "./bits";
import { ignoreBankLine, importBankLines, matchBankLine, receiveBankLine, restoreBankLine, reviewCashUp } from "@/server/actions/bursar";
import { LINE_STATUS_LABEL, STATEMENT_LINE_COLUMNS, statementLineRows } from "@/lib/bursar/format";
import { candidatesFor, notOnStatement, parseStatement, reconcile, summarise, targetsOf } from "@/lib/bursar/reconcile";
import { enabledMethods, METHOD_LABELS } from "@/lib/cashier/methods";
import { formatKwacha } from "@/lib/money";
import type { PrintBranding } from "@/lib/print";
import { csvFilename } from "@/lib/table-tools";
import { prettyDate } from "@/lib/teacher/dates";
import type { CashUpBook } from "@/server/repositories/bursar-types";
import type { BankLine, LineStatus, LineView, MethodId, Payment, UnallocatedPayment } from "@/types/bursar";

type Tab = "cash" | "bank";
const TONE: Record<LineStatus, "good" | "warn" | "bad" | "info"> = { matched: "good", mismatch: "warn", unmatched: "bad", ignored: "info" };
const CASHUP_COLUMNS = ["Date", "Cashier", "Expected", "Counted", "Difference", "Reason", "Review"];

/** Reconciliation: check each cashier's cash-up, and match the bank and mobile money statements to the payments in the books. */
export function ReconciliationView({ lines, payments, unallocated, book, today, branding }: { lines: BankLine[]; payments: Payment[]; unallocated: UnallocatedPayment[]; book: CashUpBook; today: string; branding: PrintBranding }) {
  const [tab, setTab] = useState<Tab>("cash");
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");
  const [querying, setQuerying] = useState<{ date: string; cashier: string; note: string } | null>(null);
  const [importing, setImporting] = useState<string | null>(null);
  const [matching, setMatching] = useState<LineView | null>(null);
  const [pick, setPick] = useState("");
  const [ignoring, setIgnoring] = useState<LineView | null>(null);
  const [receiving, setReceiving] = useState<{ view: LineView; method: MethodId; payer: string } | null>(null);
  const [reason, setReason] = useState("");
  const [listing, setListing] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const targets = useMemo(() => targetsOf(payments, unallocated), [payments, unallocated]);
  const views = useMemo(() => reconcile(lines, targets), [lines, targets]);
  const missing = useMemo(() => notOnStatement(targets, views), [targets, views]);
  const sum = useMemo(() => summarise(views, missing), [views, missing]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return views.filter((v) => (!status || v.status === status) && (!q || `${v.line.reference} ${v.line.description} ${v.target?.who ?? ""}`.toLowerCase().includes(q)));
  }, [views, status, query]);
  const rows = statementLineRows(shown);

  const toReview = book.rows.filter((r) => !r.review).length;
  const queried = book.rows.filter((r) => r.review?.status === "queried").length;
  const cashRows = book.rows.map(({ cashUp: c, review }) => [prettyDate(c.date), c.submittedBy, formatKwacha(c.expected), formatKwacha(c.counted), c.variance === 0 ? "None" : formatKwacha(c.variance), c.reason, review ? `${review.status === "verified" ? "Verified" : "Queried"} by ${review.by}${review.note ? `: ${review.note}` : ""}` : "Not reviewed"]);

  const run = (job: () => Promise<{ ok: boolean; error?: string; fields?: Record<string, string> }>, success: string, close: () => void) =>
    start(async () => {
      const r = await job();
      if (r.ok) {
        close();
        setDone(success);
      } else {
        setErrors(r.fields ?? {});
        setError(r.error ?? "That did not work.");
      }
    });

  const open = (fn: () => void) => { setError(null); setErrors({}); setReason(""); fn(); };
  const parsed = importing !== null ? parseStatement(importing, today) : null;
  const candidates = matching ? candidatesFor(matching.line, targets, views) : [];
  const methods = enabledMethods().filter((m) => m.group !== "cash");

  return (
    <div className="mt-6 space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Cash-ups to review" value={String(toReview)} note={queried ? `${queried} queried` : undefined} />
        <Stat label="Days not cashed up" value={String(book.missing.length)} />
        <Stat label="Statement lines needing a look" value={String(sum.mismatched + sum.unmatched)} note={sum.unmatchedAmount ? formatKwacha(sum.unmatchedAmount) : undefined} />
        <Stat label="In the books, not on statement" value={String(sum.notOnStatement)} note={sum.notOnStatementAmount ? formatKwacha(sum.notOnStatementAmount) : undefined} />
      </div>

      {done && <p role="status" className="rounded-lg bg-positive-soft px-3 py-2 text-[15px] text-positive">{done}</p>}

      <div role="tablist" aria-label="Reconciliation sections" className="flex gap-2">
        {([["cash", "Cash-ups"], ["bank", "Bank and mobile money"]] as const).map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => { setTab(id); setDone(null); }} className={tab === id ? primaryClass : buttonClass}>{label}</button>
        ))}
      </div>

      {tab === "cash" ? (
        <div className="space-y-6">
          {book.missing.length > 0 && (
            <Card>
              <h2 className="text-lg font-semibold text-ink">Cash taken but not cashed up</h2>
              <ul className="mt-2 divide-y divide-line">
                {book.missing.map((m) => (
                  <li key={`${m.date}|${m.cashier}`} className="flex flex-wrap items-center justify-between gap-2 py-2 text-[15px]">
                    <span className="text-ink">{prettyDate(m.date)}, {m.cashier}</span>
                    <span className="text-ink">{formatKwacha(m.expectedCash)} <Chip tone="bad">No cash-up</Chip></span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-ink">Daily cash-ups</h2>
                <p className="text-sm text-muted">Each cashier counts the drawer at the end of the day. Verify it, or query a difference.</p>
              </div>
              <ExportBar disabled={cashRows.length === 0} onCsv={() => downloadCsv(csvFilename("Cash-ups", today), [CASHUP_COLUMNS, ...cashRows])} onPrint={() => setListing(true)} />
            </div>
            {book.rows.length === 0 ? (
              <p className="mt-3 text-[15px] text-muted">No cash-ups have been submitted yet.</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-208 text-left text-[15px]">
                  <thead>
                    <tr className="border-b border-line text-sm text-muted">
                      <th className="py-2 pr-3 font-medium">Day</th>
                      <th className="py-2 pr-3 text-right font-medium">Expected</th>
                      <th className="py-2 pr-3 text-right font-medium">Counted</th>
                      <th className="py-2 pr-3 text-right font-medium">Difference</th>
                      <th className="py-2 pr-3 font-medium">Review</th>
                      <th className="py-2"><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {book.rows.map(({ cashUp: c, review }) => (
                      <tr key={`${c.date}|${c.submittedBy}`} className="border-b border-line align-top last:border-0">
                        <td className="py-2 pr-3 text-ink">{prettyDate(c.date)}<span className="block text-sm text-muted">{c.submittedBy}</span></td>
                        <td className="py-2 pr-3 text-right text-ink">{formatKwacha(c.expected)}</td>
                        <td className="py-2 pr-3 text-right text-ink">{formatKwacha(c.counted)}</td>
                        <td className="py-2 pr-3 text-right">{c.variance === 0 ? <Chip tone="good">Balanced</Chip> : <span><Chip tone="bad">{c.variance < 0 ? "Short" : "Over"} {formatKwacha(Math.abs(c.variance))}</Chip>{c.reason && <span className="mt-1 block max-w-56 text-sm text-muted">{c.reason}</span>}</span>}</td>
                        <td className="py-2 pr-3">{review ? <span><Chip tone={review.status === "verified" ? "good" : "warn"}>{review.status === "verified" ? "Verified" : "Queried"}</Chip><span className="mt-1 block max-w-56 text-sm text-muted">{review.by}{review.note ? `: ${review.note}` : ""}</span></span> : <Chip tone="info">Not reviewed</Chip>}</td>
                        <td className="py-2">
                          <div className="flex justify-end gap-2">
                            {review?.status !== "verified" && (
                              <button type="button" disabled={busy} onClick={() => run(() => reviewCashUp({ date: c.date, cashier: c.submittedBy, status: "verified", note: "" }), `Cash-up for ${prettyDate(c.date)} verified.`, () => {})} className={buttonClass} aria-label={`Verify the cash-up for ${prettyDate(c.date)}`}><Check size={16} aria-hidden /> Verify</button>
                            )}
                            <button type="button" onClick={() => open(() => setQuerying({ date: c.date, cashier: c.submittedBy, note: review?.status === "queried" ? review.note : "" }))} className={buttonClass} aria-label={`Query the cash-up for ${prettyDate(c.date)}`}><Flag size={16} aria-hidden /> Query</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      ) : (
        <div className="space-y-6">
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative min-w-56">
                  <Search size={16} aria-hidden className="pointer-events-none absolute left-3 top-3 text-muted" />
                  <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Reference or description" aria-label="Search statement lines" className={`${inputClass} pl-9`} />
                </div>
                <select aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)} className={`${inputClass} w-auto!`}>
                  <option value="">All lines</option>
                  {(Object.keys(LINE_STATUS_LABEL) as LineStatus[]).map((s) => <option key={s} value={s}>{LINE_STATUS_LABEL[s]}</option>)}
                </select>
              </div>
              <div className="flex flex-wrap gap-2">
                <ExportBar disabled={shown.length === 0} onCsv={() => downloadCsv(csvFilename("Statement", today), [STATEMENT_LINE_COLUMNS, ...rows])} onPrint={() => setListing(true)} />
                <button type="button" onClick={() => open(() => setImporting(""))} className={primaryClass}><FileUp size={16} aria-hidden /> Add statement lines</button>
              </div>
            </div>
            <p className="mt-3 text-sm text-muted" role="status">{shown.length} of {views.length} lines • {sum.matched} matched</p>
            {shown.length === 0 ? (
              <p className="mt-3 text-[15px] text-muted">{views.length === 0 ? "No statement lines yet. Add the bank or mobile money statement to start matching." : "No lines match."}</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-208 text-left text-[15px]">
                  <thead>
                    <tr className="border-b border-line text-sm text-muted">
                      <th className="py-2 pr-3 font-medium">Statement line</th>
                      <th className="py-2 pr-3 text-right font-medium">Amount</th>
                      <th className="py-2 pr-3 font-medium">Status</th>
                      <th className="py-2 pr-3 font-medium">In the books</th>
                      <th className="py-2"><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((v) => (
                      <tr key={v.line.id} className="border-b border-line align-top last:border-0">
                        <td className="py-2 pr-3 text-ink">{v.line.reference}<span className="block text-sm text-muted">{prettyDate(v.line.date)}{v.line.description ? ` • ${v.line.description}` : ""}</span></td>
                        <td className="py-2 pr-3 text-right font-medium text-ink">{formatKwacha(v.line.amount)}</td>
                        <td className="py-2 pr-3"><Chip tone={TONE[v.status]}>{LINE_STATUS_LABEL[v.status]}</Chip>{v.line.ignored && <span className="mt-1 block max-w-48 text-sm text-muted">{v.line.ignored.reason}</span>}</td>
                        <td className="py-2 pr-3 text-sm text-muted">
                          {v.target ? <>{v.target.no}, {v.target.who}<span className="block">{METHOD_LABELS[v.target.method]}{v.status === "mismatch" ? `, books show ${formatKwacha(v.target.amount)}` : ""}{v.target.status === "pending" ? ", still pending at the desk" : ""}</span></> : "Nothing"}
                        </td>
                        <td className="py-2">
                          <div className="flex flex-wrap justify-end gap-2">
                            {v.status === "unmatched" && candidatesFor(v.line, targets, views).length > 0 && <button type="button" onClick={() => open(() => { setMatching(v); setPick(""); })} className={buttonClass} aria-label={`Match ${v.line.reference}`}>Match</button>}
                            {v.status === "unmatched" && <button type="button" onClick={() => open(() => setReceiving({ view: v, method: methods.find((m) => m.group === "bank")?.id ?? methods[0].id, payer: v.line.description }))} className={buttonClass} aria-label={`Take in ${v.line.reference} as unallocated`}>Take in</button>}
                            {(v.status === "unmatched" || v.status === "mismatch") && <button type="button" onClick={() => open(() => setIgnoring(v))} className={buttonClass} aria-label={`Set aside ${v.line.reference}`}>Set aside</button>}
                            {(v.status === "ignored" || v.manual) && <button type="button" disabled={busy} onClick={() => run(() => restoreBankLine(v.line.id), "Line put back.", () => {})} className={buttonClass} aria-label={`Undo for ${v.line.reference}`}>Undo</button>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-ink">In the books, not on the statement</h2>
            <p className="text-sm text-muted">Bank and mobile money payments the school has recorded that no statement line accounts for yet.</p>
            {missing.length === 0 ? (
              <p className="mt-3 text-[15px] text-muted">Everything recorded is on the statement.</p>
            ) : (
              <ul className="mt-2 divide-y divide-line">
                {missing.map((t) => (
                  <li key={`${t.kind}:${t.id}`} className="flex flex-wrap items-center justify-between gap-2 py-2 text-[15px]">
                    <span className="text-ink">{t.no}, {t.who}<span className="block text-sm text-muted">{METHOD_LABELS[t.method]} • {t.reference} • {prettyDate(t.date)}</span></span>
                    <span className="text-ink">{formatKwacha(t.amount)} {t.status === "pending" && <Chip tone="warn">Pending</Chip>}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      {querying && (
        <Dialog title="Query cash-up" subtitle={`${querying.cashier}, ${prettyDate(querying.date)}`} onClose={() => !busy && setQuerying(null)}>
          <form noValidate onSubmit={(e) => { e.preventDefault(); run(() => reviewCashUp({ ...querying, status: "queried" }), "Cash-up queried.", () => setQuerying(null)); }} className="space-y-4 px-6 py-5">
            <Field label="What needs explaining" required error={errors.note}>
              {(p) => <textarea {...p} value={querying.note} onChange={(e) => setQuerying({ ...querying, note: e.target.value })} maxLength={210} className={textareaClass} />}
            </Field>
            {error && <ErrorNote>{error}</ErrorNote>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setQuerying(null)} disabled={busy} className={buttonClass}>Cancel</button>
              <button type="submit" disabled={busy} className={primaryClass}>{busy ? "Saving…" : "Query cash-up"}</button>
            </div>
          </form>
        </Dialog>
      )}

      {importing !== null && parsed && (
        <Dialog title="Add statement lines" subtitle="Paste lines from the bank or mobile money statement: date, reference, amount, description. A reference already loaded is skipped." onClose={() => !busy && setImporting(null)} wide>
          <form noValidate onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await importBankLines(importing); if (r.ok) { setImporting(null); setDone(`Added ${r.added} ${r.added === 1 ? "line" : "lines"}.${r.duplicates ? ` ${r.duplicates} already loaded.` : ""}${r.skipped ? ` ${r.skipped} could not be read.` : ""}`); } else setError(r.error); }); }} className="space-y-4 px-6 py-5">
            <Field label="Statement lines" required>
              {(p) => <textarea {...p} value={importing} onChange={(e) => setImporting(e.target.value)} placeholder={"2026-11-16, ZNC-778400, 750.00, ZNC deposit\n16/11/2026, MP261116.1100.D12, K300, MTN MoMo"} className={`${textareaClass} min-h-40 font-mono`} />}
            </Field>
            <div className="rounded-xl bg-canvas px-4 py-3 text-[15px]" role="status" aria-live="polite">
              <p className="font-medium text-ink">{parsed.lines.length} {parsed.lines.length === 1 ? "line" : "lines"} ready{parsed.errors.length > 0 ? `, ${parsed.errors.length} cannot be read` : ""}</p>
              {parsed.errors.slice(0, 4).map((er) => <p key={er.row} className="text-sm text-danger">Row {er.row}: {er.message}</p>)}
            </div>
            {error && <ErrorNote>{error}</ErrorNote>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setImporting(null)} disabled={busy} className={buttonClass}>Cancel</button>
              <button type="submit" disabled={busy || parsed.lines.length === 0} className={primaryClass}>{busy ? "Adding…" : `Add ${parsed.lines.length} ${parsed.lines.length === 1 ? "line" : "lines"}`}</button>
            </div>
          </form>
        </Dialog>
      )}

      {matching && (
        <Dialog title="Match to a payment" subtitle={`${matching.line.reference}, ${formatKwacha(matching.line.amount)}. Only payments for exactly this amount are offered.`} onClose={() => !busy && setMatching(null)}>
          <form noValidate onSubmit={(e) => { e.preventDefault(); const t = candidates.find((c) => `${c.kind}:${c.id}` === pick); if (!t) return setError("Choose a payment."); run(() => matchBankLine(matching.line.id, { kind: t.kind, id: t.id }), "Line matched.", () => setMatching(null)); }} className="space-y-4 px-6 py-5">
            <Field label="Payment" required error={error ?? undefined}>
              {(p) => (
                <select {...p} value={pick} onChange={(e) => setPick(e.target.value)} className={inputClass}>
                  <option value="">Choose a payment</option>
                  {candidates.map((c) => <option key={`${c.kind}:${c.id}`} value={`${c.kind}:${c.id}`}>{c.no}, {c.who}, {METHOD_LABELS[c.method]}, {c.reference}</option>)}
                </select>
              )}
            </Field>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setMatching(null)} disabled={busy} className={buttonClass}>Cancel</button>
              <button type="submit" disabled={busy} className={primaryClass}>{busy ? "Matching…" : "Match"}</button>
            </div>
          </form>
        </Dialog>
      )}

      {receiving && (
        <Dialog title="Take in as unallocated" subtitle={`${receiving.view.line.reference}, ${formatKwacha(receiving.view.line.amount)}. It is added to unallocated payments, ready to give to a student.`} onClose={() => !busy && setReceiving(null)}>
          <form noValidate onSubmit={(e) => { e.preventDefault(); run(() => receiveBankLine(receiving.view.line.id, { method: receiving.method, payer: receiving.payer }), "Deposit taken in. Allocate it from Student accounts.", () => setReceiving(null)); }} className="space-y-4 px-6 py-5">
            <Field label="How it was paid" error={errors.method} required>
              {(p) => (
                <select {...p} value={receiving.method} onChange={(e) => setReceiving({ ...receiving, method: e.target.value as MethodId })} className={inputClass}>
                  {methods.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
              )}
            </Field>
            <Field label="Who sent it" error={errors.payer} help="As shown on the statement.">
              {(p) => <input {...p} value={receiving.payer} onChange={(e) => setReceiving({ ...receiving, payer: e.target.value })} maxLength={60} className={inputClass} />}
            </Field>
            {error && <ErrorNote>{error}</ErrorNote>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setReceiving(null)} disabled={busy} className={buttonClass}>Cancel</button>
              <button type="submit" disabled={busy} className={primaryClass}>{busy ? "Saving…" : "Take in"}</button>
            </div>
          </form>
        </Dialog>
      )}

      {ignoring && (
        <Dialog title="Set statement line aside" subtitle={`${ignoring.line.reference}, ${formatKwacha(ignoring.line.amount)}. It stays on the list with your reason.`} onClose={() => !busy && setIgnoring(null)}>
          <form noValidate onSubmit={(e) => { e.preventDefault(); if (!reason.trim()) return setError("A reason is required."); run(() => ignoreBankLine(ignoring.line.id, reason), "Line set aside.", () => setIgnoring(null)); }} className="space-y-4 px-6 py-5">
            <Field label="Reason" required error={error ?? undefined}>
              {(p) => <textarea {...p} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={210} className={textareaClass} />}
            </Field>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setIgnoring(null)} disabled={busy} className={buttonClass}>Cancel</button>
              <button type="submit" disabled={busy} className={primaryClass}>{busy ? "Saving…" : "Set aside"}</button>
            </div>
          </form>
        </Dialog>
      )}

      {listing && (
        <PrintSheet branding={branding} title={tab === "cash" ? "Daily cash-ups" : "Statement reconciliation"} lines={[`As at ${prettyDate(today)}`]} onClose={() => setListing(false)}>
          <PrintTable columns={tab === "cash" ? CASHUP_COLUMNS : STATEMENT_LINE_COLUMNS} rows={tab === "cash" ? cashRows : rows} />
        </PrintSheet>
      )}
    </div>
  );
}
