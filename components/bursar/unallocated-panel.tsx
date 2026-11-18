"use client";

import { useMemo, useState, useTransition } from "react";
import { Link2 } from "lucide-react";
import { Card, Chip, Dialog, ExportBar, Field, buttonClass, downloadCsv, inputClass, primaryClass } from "@/components/teacher/shared";
import { PrintSheet, PrintTable } from "@/components/platform/print-sheet";
import { ErrorNote } from "./bits";
import { allocatePayment } from "@/server/actions/bursar";
import { UNALLOCATED_COLUMNS, unallocatedRows } from "@/lib/bursar/format";
import type { BursarTerms } from "@/lib/bursar/terms";
import { checkAllocation } from "@/lib/bursar/validate";
import { ngweeToInput } from "@/lib/cashier/format";
import { METHOD_LABELS } from "@/lib/cashier/methods";
import { ACCOUNT_LABELS } from "@/lib/cashier/terms";
import { formatKwacha } from "@/lib/money";
import type { PrintBranding } from "@/lib/print";
import { csvFilename } from "@/lib/table-tools";
import { prettyDate } from "@/lib/teacher/dates";
import type { AccountRow, UnallocatedPayment } from "@/types/bursar";

/** Money that arrived without a student number, waiting to be matched. A payment can be given out in parts. */
export function UnallocatedPanel({ rows, accounts, terms, today, branding }: { rows: UnallocatedPayment[]; accounts: AccountRow[]; terms: BursarTerms; today: string; branding: PrintBranding }) {
  const [target, setTarget] = useState<UnallocatedPayment | null>(null);
  const [studentNo, setStudentNo] = useState("");
  const [account, setAccount] = useState("");
  const [amount, setAmount] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [listing, setListing] = useState(false);
  const [busy, start] = useTransition();

  const owing = useMemo(() => accounts.filter((a) => a.owed > 0), [accounts]);
  const student = accounts.find((a) => a.no === studentNo);
  const lines = (student?.lines ?? []).filter((l) => l.owed > 0);
  const waiting = rows.filter((r) => r.status === "open");
  const total = waiting.reduce((n, r) => n + r.remaining, 0);

  const open = (u: UnallocatedPayment) => {
    setTarget(u);
    setStudentNo("");
    setAccount("");
    setAmount("");
    setErrors({});
    setError(null);
  };

  const pickStudent = (no: string) => {
    setStudentNo(no);
    const first = accounts.find((a) => a.no === no)?.lines.find((l) => l.owed > 0);
    setAccount(first?.kind ?? "");
    setAmount(first && target ? ngweeToInput(Math.min(first.owed, target.remaining)) : "");
    setErrors({});
    setError(null);
  };

  const pickAccount = (kind: string) => {
    setAccount(kind);
    const l = student?.lines.find((x) => x.kind === kind);
    if (l && target) setAmount(ngweeToInput(Math.min(l.owed, target.remaining)));
  };

  const submit = () => {
    if (!target) return;
    const owed = Object.fromEntries((student?.lines ?? []).map((l) => [l.kind, l.owed]));
    const c = checkAllocation({ studentNo, account, amount }, { remaining: target.remaining, owed });
    if (!c.ok) {
      setErrors(c.fields ?? {});
      setError(c.error);
      return;
    }
    start(async () => {
      const r = await allocatePayment(target.id, { studentNo, account, amount });
      if (r.ok) setTarget(null);
      else {
        setErrors(r.fields ?? {});
        setError(r.error);
      }
    });
  };

  const rowsText = unallocatedRows(rows);

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink">Unallocated payments</h2>
          <p className="mt-1 text-sm text-muted" role="status">
            {waiting.length === 0 ? "Everything received has been matched to a student." : `${waiting.length} ${waiting.length === 1 ? "payment" : "payments"} waiting, ${formatKwacha(total)} to allocate.`}
          </p>
        </div>
        <ExportBar disabled={rows.length === 0} onCsv={() => downloadCsv(csvFilename("Unallocated payments", today), [UNALLOCATED_COLUMNS, ...rowsText])} onPrint={() => setListing(true)} />
      </div>

      {rows.length === 0 ? (
        <p className="mt-4 text-[15px] text-muted">No unallocated payments.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-208 text-left text-[15px]">
            <thead>
              <tr className="border-b border-line text-sm text-muted">
                <th className="py-2 pr-3 font-medium">Payment</th>
                <th className="py-2 pr-3 font-medium">Received</th>
                <th className="py-2 pr-3 font-medium">Method and reference</th>
                <th className="py-2 pr-3 text-right font-medium">Amount</th>
                <th className="py-2 pr-3 text-right font-medium">Left</th>
                <th className="py-2 pr-3 font-medium">Sender</th>
                <th className="py-2"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id} className="border-b border-line align-top last:border-0">
                  <td className="py-2 pr-3 font-medium text-ink">{u.no}</td>
                  <td className="whitespace-nowrap py-2 pr-3 text-muted">{prettyDate(u.date)}</td>
                  <td className="py-2 pr-3 text-muted">{METHOD_LABELS[u.method]}<span className="block text-sm">{u.reference}</span></td>
                  <td className="py-2 pr-3 text-right text-ink">{formatKwacha(u.amount)}</td>
                  <td className="py-2 pr-3 text-right text-ink">{formatKwacha(u.remaining)}</td>
                  <td className="py-2 pr-3 text-muted">
                    {u.payer}
                    {u.allocations.length > 0 && (
                      <ul className="mt-1 text-sm">
                        {u.allocations.map((a) => (
                          <li key={a.paymentNo} className={a.reversed ? "line-through" : ""}>{formatKwacha(a.amount)} to {a.studentName} ({a.paymentNo}){a.reversed ? ", reversed" : ""}</li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td className="py-2 text-right">
                    {u.status === "open" ? (
                      <button type="button" onClick={() => open(u)} className={buttonClass} aria-label={`Allocate ${u.no}`}>
                        <Link2 size={16} aria-hidden /> Allocate
                      </button>
                    ) : (
                      <Chip tone="good">Allocated</Chip>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {target && (
        <Dialog title={`Allocate ${target.no}`} subtitle={`${formatKwacha(target.remaining)} left of ${formatKwacha(target.amount)} • ${METHOD_LABELS[target.method]} ${target.reference}`} onClose={() => !busy && setTarget(null)}>
          <form noValidate onSubmit={(e) => { e.preventDefault(); submit(); }} className="space-y-4 px-6 py-5">
            <p className="text-sm text-muted">{target.payer}</p>
            <Field label={terms.member} error={errors.student} required>
              {(p) => (
                <select {...p} value={studentNo} onChange={(e) => pickStudent(e.target.value)} className={inputClass}>
                  <option value="">Choose a {terms.member.toLowerCase()} who owes fees</option>
                  {owing.map((a) => <option key={a.no} value={a.no}>{a.name} ({a.no}), owes {formatKwacha(a.owed)}</option>)}
                </select>
              )}
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Account" error={errors.account} required>
                {(p) => (
                  <select {...p} value={account} onChange={(e) => pickAccount(e.target.value)} disabled={!student} className={inputClass}>
                    {lines.length === 0 && <option value="">Choose a {terms.member.toLowerCase()} first</option>}
                    {lines.map((l) => <option key={l.kind} value={l.kind}>{ACCOUNT_LABELS[l.kind]}, owes {formatKwacha(l.owed)}</option>)}
                  </select>
                )}
              </Field>
              <Field label="Amount (kwacha)" error={errors.amount} help="Give all of it or part of it. The rest stays here." required>
                {(p) => <input {...p} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} />}
              </Field>
            </div>
            {error && <ErrorNote>{error}</ErrorNote>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setTarget(null)} disabled={busy} className={buttonClass}>Cancel</button>
              <button type="submit" disabled={busy} className={primaryClass}>{busy ? "Allocating…" : "Allocate payment"}</button>
            </div>
          </form>
        </Dialog>
      )}

      {listing && (
        <PrintSheet branding={branding} title="Unallocated payments" lines={[`As at ${prettyDate(today)}`]} onClose={() => setListing(false)}>
          <PrintTable columns={UNALLOCATED_COLUMNS} rows={rowsText} />
        </PrintSheet>
      )}
    </Card>
  );
}
