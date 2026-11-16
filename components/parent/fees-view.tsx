"use client";

import { useState } from "react";
import { DetailsList, PrintSheet, PrintTable } from "@/components/platform/print-sheet";
import { Card, Chip, ExportBar, Stat, buttonClass, downloadCsv, useToday } from "@/components/teacher/shared";
import { FEE_POLICY_LABELS, type FeePolicy, type Withheld } from "@/lib/fee-policy";
import { formatKwacha } from "@/lib/money";
import type { FeeStatement, Receipt } from "@/lib/parent/fees";
import type { PrintBranding } from "@/lib/print";
import type { StudentTerms } from "@/lib/student/terms";
import { csvFilename } from "@/lib/table-tools";
import { prettyDate } from "@/lib/teacher/dates";

type Sheet = { kind: "statement" } | { kind: "invoice" } | { kind: "receipt"; receipt: Receipt } | null;

const k = formatKwacha;

/**
 * A child's invoice, receipts and ledger. View, print and CSV only: no payment
 * is taken here; the balance is cleared at the bursar's office.
 */
export function FeesView({ statement: st, childName, studentNumber, group, periodLabel, policy, withheld, terms, branding }: { statement: FeeStatement; childName: string; studentNumber: string; group: string; periodLabel: string; policy: FeePolicy; withheld: Withheld; terms: StudentTerms; branding: PrintBranding }) {
  const today = useToday(branding.timezone);
  const [sheet, setSheet] = useState<Sheet>(null);
  const close = () => setSheet(null);

  const ledgerColumns = ["Date", "Description", "Reference", "Charge", "Payment", "Balance"];
  const ledgerRows = st.ledger.map((r) => [prettyDate(r.date), r.description, r.reference, r.charge ? k(r.charge) : "", r.payment ? k(r.payment) : "", k(r.balance)]);
  const who: Array<[string, string]> = [[terms.member, childName], [`${terms.member} number`, studentNumber], [terms.group, group], [terms.period, periodLabel]];
  const held = [withheld.examCard && "exam card", withheld.results && "report card"].filter(Boolean).join(" and ");

  return (
    <div className="mt-4 space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Billed" value={k(st.billed)} note={periodLabel} />
        <Stat label="Paid" value={k(st.paid)} note={`${st.receipts.length} ${st.receipts.length === 1 ? "receipt" : "receipts"}`} />
        <Stat label="Balance" value={st.balance > 0 ? k(st.balance) : "Cleared"} note={st.dueOn ? `Due ${prettyDate(st.dueOn)}` : undefined} />
        <div className="rounded-xl bg-canvas px-4 py-3">
          <p className="text-sm text-muted">Status</p>
          <p className="mt-1"><Chip tone={st.status === "paid" ? "good" : st.status === "overdue" ? "bad" : "warn"}>{st.status === "paid" ? "Paid in full" : st.status === "overdue" ? "Overdue" : "Due"}</Chip></p>
        </div>
      </div>

      {st.balance > 0 && (
        <Card>
          <h2 className="text-lg font-semibold text-ink">How to clear this balance</h2>
          <p className="mt-1 text-[15px] text-ink">Payments are made at the bursar&apos;s office using {childName.split(" ")[0]}&apos;s {terms.member.toLowerCase()} number ({studentNumber}). Nothing is paid on this page. Keep the receipt; it will appear here once the bursar records it.</p>
          <p className="mt-2 text-sm text-muted">School policy for unpaid fees: {FEE_POLICY_LABELS[policy]}.{held ? ` The ${held} will be available once the balance is cleared.` : ""}</p>
        </Card>
      )}

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-ink">Invoice {st.invoice.number}</h2>
            <p className="text-sm text-muted">Issued {prettyDate(st.invoice.issuedOn)} · due {prettyDate(st.invoice.dueOn)}</p>
          </div>
          <button type="button" onClick={() => setSheet({ kind: "invoice" })} className={buttonClass}>Print invoice</button>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[22rem] text-left text-[15px]">
            <caption className="sr-only">Invoice lines</caption>
            <thead><tr className="text-sm text-muted"><th scope="col" className="py-2 pr-3 font-medium">Item</th><th scope="col" className="py-2 text-right font-medium">Amount</th></tr></thead>
            <tbody className="divide-y divide-line">
              {st.invoice.lines.map((l) => <tr key={l.label}><th scope="row" className="py-2 pr-3 font-normal text-ink">{l.label}</th><td className="py-2 text-right tabular-nums text-ink">{k(l.amount)}</td></tr>)}
              <tr><th scope="row" className="py-2 pr-3 font-semibold text-ink">Total</th><td className="py-2 text-right font-semibold tabular-nums text-ink">{k(st.invoice.total)}</td></tr>
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-ink">Receipts</h2>
        {st.receipts.length === 0 ? (
          <p className="mt-2 text-[15px] text-muted">No payments have been recorded for this {terms.period.toLowerCase()} yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[30rem] text-left text-[15px]">
              <caption className="sr-only">Receipts</caption>
              <thead><tr className="text-sm text-muted">{["Receipt", "Date", "Method", "Amount", ""].map((c, i) => <th key={i} scope="col" className={`py-2 pr-3 font-medium ${c === "Amount" ? "text-right" : ""}`}>{c || <span className="sr-only">Print</span>}</th>)}</tr></thead>
              <tbody className="divide-y divide-line">
                {st.receipts.map((r) => (
                  <tr key={r.number}>
                    <th scope="row" className="py-2 pr-3 font-medium text-ink">{r.number}</th>
                    <td className="py-2 pr-3 text-muted">{prettyDate(r.paidOn)}</td>
                    <td className="py-2 pr-3 text-muted">{r.method}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-ink">{k(r.amount)}</td>
                    <td className="py-2 text-right"><button type="button" onClick={() => setSheet({ kind: "receipt", receipt: r })} className={buttonClass} aria-label={`Print receipt ${r.number}`}>Print</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-ink">Statement of account</h2>
          <ExportBar onCsv={() => downloadCsv(csvFilename(`fee statement ${childName}`, today || "export"), [ledgerColumns, ...ledgerRows])} onPrint={() => setSheet({ kind: "statement" })} />
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[36rem] text-left text-[15px]">
            <caption className="sr-only">Statement of account, oldest first</caption>
            <thead><tr className="text-sm text-muted">{ledgerColumns.map((c) => <th key={c} scope="col" className={`py-2 pr-3 font-medium ${["Charge", "Payment", "Balance"].includes(c) ? "text-right" : ""}`}>{c}</th>)}</tr></thead>
            <tbody className="divide-y divide-line">
              {ledgerRows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={`py-2 pr-3 ${j >= 3 ? "text-right tabular-nums text-ink" : j === 0 ? "text-muted" : "text-ink"}`}>{c}</td>)}</tr>)}
            </tbody>
          </table>
        </div>
      </Card>

      {sheet?.kind === "statement" && (
        <PrintSheet branding={branding} title={`Fee statement, ${periodLabel}`} lines={[`Balance ${st.balance > 0 ? k(st.balance) : "cleared"}`]} onClose={close}>
          <DetailsList details={[...who, ["Billed", k(st.billed)], ["Paid", k(st.paid)], ["Balance", k(st.balance)]]} />
          <div className="mt-6"><PrintTable columns={ledgerColumns} rows={ledgerRows} /></div>
        </PrintSheet>
      )}
      {sheet?.kind === "invoice" && (
        <PrintSheet branding={branding} title={`Invoice ${st.invoice.number}`} lines={[`Issued ${prettyDate(st.invoice.issuedOn)} · due ${prettyDate(st.invoice.dueOn)}`]} onClose={close}>
          <DetailsList details={who} />
          <div className="mt-6"><PrintTable columns={["Item", "Amount"]} rows={[...st.invoice.lines.map((l) => [l.label, k(l.amount)]), ["Total", k(st.invoice.total)]]} /></div>
        </PrintSheet>
      )}
      {sheet?.kind === "receipt" && (
        <PrintSheet branding={branding} title={`Receipt ${sheet.receipt.number}`} signature lines={[`Paid ${prettyDate(sheet.receipt.paidOn)} by ${sheet.receipt.method}`]} onClose={close}>
          <DetailsList details={[...who, ["Invoice", st.invoice.number], ["Amount received", k(sheet.receipt.amount)]]} />
        </PrintSheet>
      )}
    </div>
  );
}
