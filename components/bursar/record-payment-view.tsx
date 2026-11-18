"use client";

import { useMemo, useState, useTransition } from "react";
import { Receipt as ReceiptIcon, Search, Undo2 } from "lucide-react";
import { Card, Chip, Dialog, ExportBar, Field, Stat, buttonClass, downloadCsv, inputClass, primaryClass } from "@/components/teacher/shared";
import { PrintSheet, PrintTable } from "@/components/platform/print-sheet";
import { ErrorNote, PaymentChip, textareaClass } from "./bits";
import { PaymentReceiptSheet } from "./payment-receipt-sheet";
import { recordPayment, reversePayment } from "@/server/actions/bursar";
import { PAYMENT_COLUMNS, paymentRows, sourceLabel } from "@/lib/bursar/format";
import type { BursarTerms } from "@/lib/bursar/terms";
import { BACKDATE_DAYS, checkRecordPayment } from "@/lib/bursar/validate";
import { ngweeToInput } from "@/lib/cashier/format";
import { PAYMENT_METHODS, METHOD_LABELS, enabledMethods } from "@/lib/cashier/methods";
import { ACCOUNT_LABELS } from "@/lib/cashier/terms";
import { formatKwacha } from "@/lib/money";
import type { PrintBranding } from "@/lib/print";
import { csvFilename } from "@/lib/table-tools";
import { addDays, prettyDate } from "@/lib/teacher/dates";
import type { AccountRow, Payment } from "@/types/bursar";

type Form = { studentNo: string; account: string; method: string; amount: string; date: string; reference: string; note: string };

/** Record a payment the Bursar received, and see every payment in the school. */
export function RecordPaymentView({ accounts, payments, terms, today, branding }: { accounts: AccountRow[]; payments: Payment[]; terms: BursarTerms; today: string; branding: PrintBranding }) {
  const blank = (): Form => ({ studentNo: "", account: "", method: "bank_deposit", amount: "", date: today, reference: "", note: "" });
  const [form, setForm] = useState<Form>(blank);
  const [search, setSearch] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Payment | null>(null);
  const [reversing, setReversing] = useState<Payment | null>(null);
  const [reason, setReason] = useState("");
  const [reverseError, setReverseError] = useState<string | null>(null);
  const [listing, setListing] = useState(false);
  const [query, setQuery] = useState("");
  const [method, setMethod] = useState("");
  const [status, setStatus] = useState("");
  const [source, setSource] = useState("");
  const [busy, start] = useTransition();

  const student = accounts.find((a) => a.no === form.studentNo);
  const lines = (student?.lines ?? []).filter((l) => l.owed > 0);
  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return accounts.filter((a) => a.owed > 0 && `${a.name} ${a.no}`.toLowerCase().includes(q)).slice(0, 6);
  }, [accounts, search]);
  const isCash = PAYMENT_METHODS.find((m) => m.id === form.method)?.group === "cash";
  const set = (k: keyof Form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const choose = (a: AccountRow) => {
    const first = a.lines.find((l) => l.owed > 0);
    setForm((f) => ({ ...f, studentNo: a.no, account: first?.kind ?? "", amount: first ? ngweeToInput(first.owed) : "" }));
    setSearch("");
    setErrors({});
    setError(null);
  };

  const taken = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of payments) if (p.reference && p.status !== "reversed") m.set(p.reference.toLowerCase(), p.no);
    return m;
  }, [payments]);

  const submit = () => {
    const owed = Object.fromEntries((student?.lines ?? []).map((l) => [l.kind, l.owed]));
    const c = checkRecordPayment(form, { owed, today, taken });
    if (!c.ok) {
      setErrors(c.fields ?? {});
      setError(c.error);
      return;
    }
    start(async () => {
      const r = await recordPayment(form);
      if (!r.ok) {
        setErrors(r.fields ?? {});
        setError(r.error);
        return;
      }
      setForm(blank());
      setErrors({});
      setError(null);
      if (r.payment) setReceipt(r.payment);
    });
  };

  const confirmReverse = () => {
    if (!reversing) return;
    if (!reason.trim()) return setReverseError("A reason is required.");
    start(async () => {
      const r = await reversePayment(reversing.id, reason);
      if (r.ok) setReversing(null);
      else setReverseError(r.error);
    });
  };

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return payments.filter((p) => (!method || p.method === method) && (!status || p.status === status) && (!source || p.source === source) && (!q || `${p.no} ${p.studentName} ${p.studentNo} ${p.reference}`.toLowerCase().includes(q)));
  }, [payments, query, method, status, source]);

  const counted = payments.filter((p) => p.status === "success");
  const todays = counted.filter((p) => p.date === today);
  const total = (rows: Payment[]) => rows.reduce((n, p) => n + p.amount, 0);
  const pendingN = payments.filter((p) => p.status === "pending").length;
  const rows = paymentRows(shown);
  const earliest = addDays(today, -BACKDATE_DAYS);

  return (
    <div className="mt-6 space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Received today" value={formatKwacha(total(todays))} note={`${todays.length} ${todays.length === 1 ? "payment" : "payments"}`} />
        <Stat label="All payments counted" value={formatKwacha(total(counted))} note={`${counted.length} payments`} />
        <Stat label="Waiting for confirmation" value={String(pendingN)} note="At the cashier desk, not counted yet" />
      </div>

      <Card>
        <h2 className="text-lg font-semibold text-ink">Record a payment</h2>
        <p className="mt-1 text-sm text-muted">For money you received yourself, such as a bank deposit, a transfer or cash at the office. It is counted straight away and cannot be more than the account owes.</p>
        <form noValidate onSubmit={(e) => { e.preventDefault(); submit(); }} className="mt-4 space-y-4">
          {student ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-canvas px-4 py-3">
              <div>
                <p className="font-medium text-ink">{student.name} <span className="font-normal text-muted">({student.no}, {student.group})</span></p>
                <p className="text-sm text-muted">Owes {formatKwacha(student.owed)}{student.dueOn ? `, due ${prettyDate(student.dueOn)}` : ""}</p>
              </div>
              <button type="button" onClick={() => setForm((f) => ({ ...f, studentNo: "", account: "", amount: "" }))} className={buttonClass}>Change {terms.member.toLowerCase()}</button>
            </div>
          ) : (
            <Field label={terms.member} error={errors.student} help={`Search by name or number. Only ${terms.members} who owe fees are listed.`} required>
              {(p) => (
                <div className="relative">
                  <Search size={16} aria-hidden className="pointer-events-none absolute left-3 top-3 text-muted" />
                  <input {...p} type="search" value={search} onChange={(e) => setSearch(e.target.value)} className={`${inputClass} pl-9`} autoComplete="off" />
                  {matches.length > 0 && (
                    <ul className="mt-1 divide-y divide-line rounded-lg border border-line bg-surface">
                      {matches.map((a) => (
                        <li key={a.no}>
                          <button type="button" onClick={() => choose(a)} className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-[15px] hover:bg-canvas focus-visible:outline-2 focus-visible:outline-brand">
                            <span className="text-ink">{a.name} <span className="text-muted">({a.no}, {a.group})</span></span>
                            <span className="text-muted">owes {formatKwacha(a.owed)}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {search.trim() && matches.length === 0 && <p className="mt-1 text-sm text-muted">No {terms.member.toLowerCase()} who owes fees matches.</p>}
                </div>
              )}
            </Field>
          )}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Account" error={errors.account} required>
              {(p) => (
                <select {...p} value={form.account} disabled={!student} onChange={(e) => { const l = student?.lines.find((x) => x.kind === e.target.value); setForm((f) => ({ ...f, account: e.target.value, amount: l ? ngweeToInput(l.owed) : f.amount })); }} className={inputClass}>
                  {lines.length === 0 && <option value="">Choose a {terms.member.toLowerCase()} first</option>}
                  {lines.map((l) => <option key={l.kind} value={l.kind}>{ACCOUNT_LABELS[l.kind]}, owes {formatKwacha(l.owed)}</option>)}
                </select>
              )}
            </Field>
            <Field label="Method" error={errors.method} required>
              {(p) => <select {...p} value={form.method} onChange={(e) => set("method", e.target.value)} className={inputClass}>{enabledMethods().map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select>}
            </Field>
            <Field label="Amount (kwacha)" error={errors.amount} required>
              {(p) => <input {...p} inputMode="decimal" value={form.amount} onChange={(e) => set("amount", e.target.value)} className={inputClass} />}
            </Field>
            <Field label="Received on" error={errors.date} required>
              {(p) => <input {...p} type="date" min={earliest} max={today} value={form.date} onChange={(e) => set("date", e.target.value)} className={inputClass} />}
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={isCash ? "Reference (not needed for cash)" : "Transaction or deposit reference"} error={errors.reference} required={!isCash}>
              {(p) => <input {...p} value={isCash ? "" : form.reference} disabled={isCash} onChange={(e) => set("reference", e.target.value)} maxLength={70} className={inputClass} />}
            </Field>
            <Field label="Note (optional)" error={errors.note}>
              {(p) => <input {...p} value={form.note} onChange={(e) => set("note", e.target.value)} maxLength={210} className={inputClass} />}
            </Field>
          </div>
          {error && <ErrorNote>{error}</ErrorNote>}
          <div className="flex justify-end">
            <button type="submit" disabled={busy} className={primaryClass}>{busy ? "Recording…" : "Record payment"}</button>
          </div>
        </form>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-ink">Payments</h2>
            <p className="mt-1 text-sm text-muted">Everything received at the cashier desk or by you. Reversed payments stay listed.</p>
          </div>
          <ExportBar disabled={shown.length === 0} onCsv={() => downloadCsv(csvFilename("Payments", today), [PAYMENT_COLUMNS, ...rows])} onPrint={() => setListing(true)} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <div className="relative min-w-56">
            <Search size={16} aria-hidden className="pointer-events-none absolute left-3 top-3 text-muted" />
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Receipt, name, number or reference" aria-label="Search payments" className={`${inputClass} pl-9`} />
          </div>
          <select aria-label="Filter by method" value={method} onChange={(e) => setMethod(e.target.value)} className={`${inputClass} w-auto!`}>
            <option value="">All methods</option>
            {PAYMENT_METHODS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
          <select aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)} className={`${inputClass} w-auto!`}>
            <option value="">All statuses</option>
            <option value="success">Success</option>
            <option value="pending">Pending</option>
            <option value="reversed">Reversed</option>
          </select>
          <select aria-label="Filter by who took it" value={source} onChange={(e) => setSource(e.target.value)} className={`${inputClass} w-auto!`}>
            <option value="">Anyone</option>
            <option value="cashier">Cashier desk</option>
            <option value="bursar">Bursar</option>
            <option value="allocation">Allocated</option>
          </select>
        </div>
        <p className="mt-3 text-sm text-muted" role="status">{shown.length} of {payments.length} payments</p>
        {shown.length === 0 ? (
          <p className="mt-3 text-[15px] text-muted">No payments match.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-224 text-left text-[15px]">
              <thead>
                <tr className="border-b border-line text-sm text-muted">
                  <th className="py-2 pr-3 font-medium">Receipt</th>
                  <th className="py-2 pr-3 font-medium">{terms.member}</th>
                  <th className="py-2 pr-3 font-medium">Method and reference</th>
                  <th className="py-2 pr-3 text-right font-medium">Amount</th>
                  <th className="py-2 pr-3 font-medium">Taken by</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {shown.map((p) => (
                  <tr key={p.id} className="border-b border-line align-top last:border-0">
                    <td className="py-2 pr-3"><span className="block font-medium text-ink">{p.no}</span><span className="text-sm text-muted">{prettyDate(p.date)}</span></td>
                    <td className="py-2 pr-3 text-ink">{p.studentName}<span className="block text-sm text-muted">{p.studentNo} • {ACCOUNT_LABELS[p.account]}</span></td>
                    <td className="py-2 pr-3 text-muted">{METHOD_LABELS[p.method]}<span className="block text-sm">{p.reference || "—"}</span></td>
                    <td className="py-2 pr-3 text-right text-ink">{formatKwacha(p.amount)}</td>
                    <td className="py-2 pr-3 text-muted">{sourceLabel(p.source)}<span className="block text-sm">{p.by}</span></td>
                    <td className="py-2 pr-3"><PaymentChip status={p.status} />{p.reversal && <span className="mt-1 block max-w-48 text-sm text-muted">{p.reversal.reason}</span>}{p.fromUnallocated && <Chip>From unallocated</Chip>}</td>
                    <td className="py-2">
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => setReceipt(p)} className={buttonClass} aria-label={`Show receipt ${p.no}`}><ReceiptIcon size={16} aria-hidden /> Receipt</button>
                        {p.status === "success" && (
                          <button type="button" onClick={() => { setReversing(p); setReason(""); setReverseError(null); }} className={buttonClass} aria-label={`Reverse payment ${p.no}`}><Undo2 size={16} aria-hidden /> Reverse</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {reversing && (
        <Dialog title={`Reverse ${reversing.no}`} subtitle={`${formatKwacha(reversing.amount)} from ${reversing.studentName}, ${ACCOUNT_LABELS[reversing.account]}`} onClose={() => !busy && setReversing(null)}>
          <form noValidate onSubmit={(e) => { e.preventDefault(); confirmReverse(); }} className="space-y-4 px-6 py-5">
            <p className="text-sm text-muted">The payment stays on the record as reversed and the amount goes back on what {reversing.studentName} owes.{reversing.fromUnallocated ? " It returns to unallocated payments so it can be given to the right student." : ""}</p>
            <Field label="Reason" required error={reverseError ?? undefined}>
              {(p) => <textarea {...p} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={210} className={textareaClass} placeholder="For example: paid into the wrong student's account" />}
            </Field>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setReversing(null)} disabled={busy} className={buttonClass}>Cancel</button>
              <button type="submit" disabled={busy} className={primaryClass}>{busy ? "Reversing…" : "Reverse payment"}</button>
            </div>
          </form>
        </Dialog>
      )}

      {receipt && <PaymentReceiptSheet payment={payments.find((p) => p.id === receipt.id) ?? receipt} branding={branding} terms={terms} onClose={() => setReceipt(null)} />}

      {listing && (
        <PrintSheet branding={branding} title="Payments" lines={[`As at ${prettyDate(today)}`, `${shown.length} payments`]} onClose={() => setListing(false)}>
          <PrintTable columns={PAYMENT_COLUMNS} rows={rows} />
        </PrintSheet>
      )}
    </div>
  );
}
