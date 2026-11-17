"use client";

import { useMemo, useState, useTransition } from "react";
import { Ban, Check, Printer, Search } from "lucide-react";
import { Card, Dialog, ExportBar, Field, Stat, buttonClass, downloadCsv, inputClass, primaryClass } from "@/components/teacher/shared";
import { PrintSheet, PrintTable } from "@/components/platform/print-sheet";
import { confirmPayment, voidPayment } from "@/server/actions/cashier";
import { enabledMethods, METHOD_LABELS } from "@/lib/cashier/methods";
import { ACCOUNT_LABELS, type CashierTerms } from "@/lib/cashier/terms";
import { receiptRows, RECEIPT_COLUMNS, timeIn } from "@/lib/cashier/format";
import { LIMITS } from "@/lib/cashier/validate";
import { csvFilename } from "@/lib/table-tools";
import { prettyDate } from "@/lib/teacher/dates";
import { formatKwacha } from "@/lib/money";
import type { PrintBranding } from "@/lib/print";
import type { DaySummary, Receipt } from "@/types/cashier";
import { StatusChip } from "./bits";
import { ReceiptSheet } from "./receipt-sheet";

export function TransactionsView({ receipts, day, today, terms, branding }: { receipts: Receipt[]; day: DaySummary; today: string; terms: CashierTerms; branding: PrintBranding }) {
  const [query, setQuery] = useState("");
  const [method, setMethod] = useState("");
  const [status, setStatus] = useState("");
  const [voiding, setVoiding] = useState<Receipt | null>(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [printing, setPrinting] = useState<Receipt | null>(null);
  const [listing, setListing] = useState(false);
  const [busy, start] = useTransition();

  const locked = Boolean(day.cashUp);
  const todays = useMemo(() => receipts.filter((r) => r.date === today), [receipts, today]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return todays.filter((r) => (!method || r.method === method) && (!status || r.status === status) && (!q || `${r.no} ${r.studentNo} ${r.studentName} ${r.reference}`.toLowerCase().includes(q)));
  }, [todays, query, method, status]);

  const confirm = (r: Receipt) => {
    setError(null);
    start(async () => {
      const out = await confirmPayment(r.id);
      if (!out.ok) setError(out.error);
    });
  };

  const submitVoid = () => {
    if (!voiding) return;
    start(async () => {
      const out = await voidPayment(voiding.id, reason);
      if (out.ok) {
        setVoiding(null);
        setReason("");
        setReasonError(undefined);
        setError(null);
      } else {
        setReasonError(out.fields?.reason);
        if (!out.fields?.reason) setError(out.error);
      }
    });
  };

  const rows = receiptRows(shown, branding.timezone);
  const title = "Today's transactions";

  return (
    <div className="mt-6 space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Transactions" value={String(day.count)} note="Voided receipts not counted" />
        <Stat label="Collected" value={formatKwacha(day.collected)} note="Confirmed payments" />
        <Stat label="Pending" value={String(day.pending)} note={day.pending ? `${formatKwacha(day.pendingAmount)} to confirm` : "Nothing to confirm"} />
        <Stat label="Voided" value={String(day.voided)} />
      </div>

      {locked && <p role="status" className="rounded-lg bg-canvas px-4 py-3 text-[15px] text-ink">Today&apos;s cash-up has been submitted, so receipts can no longer be confirmed or voided.</p>}

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-52">
              <Search size={16} aria-hidden className="pointer-events-none absolute left-3 top-3 text-muted" />
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Receipt, ${terms.member.toLowerCase()} or reference`} aria-label="Search today's transactions" className={`${inputClass} pl-9`} />
            </div>
            <select aria-label="Filter by method" value={method} onChange={(e) => setMethod(e.target.value)} className={`${inputClass} w-auto!`}>
              <option value="">All methods</option>
              {enabledMethods().map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
            <select aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)} className={`${inputClass} w-auto!`}>
              <option value="">All statuses</option>
              <option value="success">Success</option>
              <option value="pending">Pending</option>
              <option value="voided">Voided</option>
            </select>
          </div>
          <ExportBar disabled={shown.length === 0} onCsv={() => downloadCsv(csvFilename(title, today), [RECEIPT_COLUMNS, ...rows])} onPrint={() => setListing(true)} />
        </div>
        {error && <p role="alert" className="mt-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
        <p className="mt-3 text-sm text-muted" role="status">{shown.length} of {todays.length} {todays.length === 1 ? "receipt" : "receipts"} today</p>

        {shown.length === 0 ? (
          <p className="mt-3 text-[15px] text-muted">{todays.length === 0 ? "No payments have been taken today." : "No receipts match."}</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-208 text-left text-[15px]">
              <thead>
                <tr className="border-b border-line text-sm text-muted">
                  <th className="py-2 pr-3 font-medium">Receipt</th>
                  <th className="py-2 pr-3 font-medium">Time</th>
                  <th className="py-2 pr-3 font-medium">{terms.member}</th>
                  <th className="py-2 pr-3 font-medium">Account</th>
                  <th className="py-2 pr-3 font-medium">Method</th>
                  <th className="py-2 pr-3 text-right font-medium">Amount</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.id} className="border-b border-line align-top last:border-0">
                    <td className="py-2 pr-3 font-medium text-ink">{r.no}</td>
                    <td className="py-2 pr-3 text-muted">{timeIn(r.at, branding.timezone)}</td>
                    <td className="py-2 pr-3"><span className="block text-ink">{r.studentName}</span><span className="text-sm text-muted">{r.studentNo}</span></td>
                    <td className="py-2 pr-3 text-muted">{ACCOUNT_LABELS[r.account]}</td>
                    <td className="py-2 pr-3 text-muted">{METHOD_LABELS[r.method]}{r.reference && <span className="block text-xs">{r.reference}</span>}</td>
                    <td className={`py-2 pr-3 text-right ${r.status === "voided" ? "text-muted line-through" : ""}`}>{formatKwacha(r.amount)}</td>
                    <td className="py-2 pr-3">
                      <StatusChip status={r.status} />
                      {r.void && <span className="mt-1 block max-w-48 text-xs text-muted">{r.void.reason}</span>}
                    </td>
                    <td className="py-2">
                      <div className="flex flex-wrap justify-end gap-2">
                        {r.status === "pending" && (
                          <button type="button" disabled={locked || busy} onClick={() => confirm(r)} className={buttonClass} aria-label={`Confirm receipt ${r.no}`}>
                            <Check size={16} aria-hidden /> Confirm
                          </button>
                        )}
                        {r.status !== "pending" && (
                          <button type="button" onClick={() => setPrinting(r)} className={buttonClass} aria-label={`Print receipt ${r.no}`}>
                            <Printer size={16} aria-hidden /> Print
                          </button>
                        )}
                        {r.status !== "voided" && (
                          <button type="button" disabled={locked || busy} onClick={() => { setVoiding(r); setReason(""); setReasonError(undefined); setError(null); }} className={buttonClass} aria-label={`Void receipt ${r.no}`}>
                            <Ban size={16} aria-hidden /> Void
                          </button>
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

      {voiding && (
        <Dialog title={`Void receipt ${voiding.no}`} subtitle={`${voiding.studentName} · ${formatKwacha(voiding.amount)} · ${METHOD_LABELS[voiding.method]}`} onClose={() => !busy && setVoiding(null)}>
          <form noValidate onSubmit={(e) => { e.preventDefault(); submitVoid(); }} className="space-y-4 px-6 py-5">
            <p className="text-sm text-muted">The receipt stays on the list marked Voided and is left out of today&apos;s totals{voiding.status === "success" ? ", and the amount is added back to what the account owes" : ""}. Refunds and earlier days are handled by the Bursar.</p>
            <Field label="Reason" error={reasonError} required>
              {(p) => <textarea {...p} value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={LIMITS.reason + 20} className={`${inputClass} h-auto py-2`} />}
            </Field>
            {error && <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setVoiding(null)} disabled={busy} className={buttonClass}>Keep receipt</button>
              <button type="submit" disabled={busy} className={primaryClass}>{busy ? "Voiding…" : "Void receipt"}</button>
            </div>
          </form>
        </Dialog>
      )}

      {printing && <ReceiptSheet receipt={printing} branding={branding} terms={terms} onClose={() => setPrinting(null)} />}
      {listing && (
        <PrintSheet branding={branding} title={title} lines={[prettyDate(today), `${shown.length} receipts`]} onClose={() => setListing(false)}>
          <PrintTable columns={RECEIPT_COLUMNS} rows={rows} />
        </PrintSheet>
      )}
    </div>
  );
}
