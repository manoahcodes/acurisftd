"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Printer, Search } from "lucide-react";
import { Card, buttonClass, inputClass } from "@/components/teacher/shared";
import { METHOD_LABELS } from "@/lib/cashier/methods";
import { ACCOUNT_LABELS, type CashierTerms } from "@/lib/cashier/terms";
import { timeIn } from "@/lib/cashier/format";
import { prettyDate } from "@/lib/teacher/dates";
import { formatKwacha } from "@/lib/money";
import type { PrintBranding } from "@/lib/print";
import type { Receipt } from "@/types/cashier";
import { StatusChip } from "./bits";
import { ReceiptSheet } from "./receipt-sheet";

export function PrintReceiptView({ receipts, terms, branding }: { receipts: Receipt[]; terms: CashierTerms; branding: PrintBranding }) {
  const params = useSearchParams();
  const fromLink = params.get("receipt");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [openId, setOpenId] = useState<string | null>(() => (receipts.find((r) => r.id === fromLink && r.status !== "pending") ? fromLink : null));

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return receipts.filter((r) => (!status || r.status === status) && (!q || `${r.no} ${r.studentNo} ${r.studentName} ${r.reference}`.toLowerCase().includes(q)));
  }, [receipts, query, status]);
  const open = receipts.find((r) => r.id === openId);

  return (
    <div className="mt-6 space-y-6">
      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-52 flex-1">
            <Search size={16} aria-hidden className="pointer-events-none absolute left-3 top-3 text-muted" />
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Receipt number, ${terms.member.toLowerCase()} or reference`} aria-label="Search receipts" className={`${inputClass} pl-9`} />
          </div>
          <select aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)} className={`${inputClass} w-auto!`}>
            <option value="">All receipts</option>
            <option value="success">Success</option>
            <option value="pending">Pending</option>
            <option value="voided">Voided</option>
          </select>
        </div>
        <p className="mt-3 text-sm text-muted" role="status">{shown.length} {shown.length === 1 ? "receipt" : "receipts"}</p>

        {shown.length === 0 ? (
          <p className="mt-3 text-[15px] text-muted">No receipts match.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-176 text-left text-[15px]">
              <thead>
                <tr className="border-b border-line text-sm text-muted">
                  <th className="py-2 pr-3 font-medium">Receipt</th>
                  <th className="py-2 pr-3 font-medium">Date</th>
                  <th className="py-2 pr-3 font-medium">{terms.member}</th>
                  <th className="py-2 pr-3 font-medium">Account</th>
                  <th className="py-2 pr-3 font-medium">Method</th>
                  <th className="py-2 pr-3 text-right font-medium">Amount</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2"><span className="sr-only">Print</span></th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.id} className="border-b border-line last:border-0">
                    <td className="py-2 pr-3 font-medium text-ink">{r.no}</td>
                    <td className="py-2 pr-3 text-muted">{prettyDate(r.date)} {timeIn(r.at, branding.timezone)}</td>
                    <td className="py-2 pr-3"><span className="block text-ink">{r.studentName}</span><span className="text-sm text-muted">{r.studentNo}</span></td>
                    <td className="py-2 pr-3 text-muted">{ACCOUNT_LABELS[r.account]}</td>
                    <td className="py-2 pr-3 text-muted">{METHOD_LABELS[r.method]}</td>
                    <td className={`py-2 pr-3 text-right ${r.status === "voided" ? "text-muted line-through" : ""}`}>{formatKwacha(r.amount)}</td>
                    <td className="py-2 pr-3"><StatusChip status={r.status} /></td>
                    <td className="py-2 text-right">
                      {r.status === "pending" ? (
                        <span className="text-sm text-muted">Confirm first</span>
                      ) : (
                        <button type="button" onClick={() => setOpenId(r.id)} className={buttonClass} aria-label={`Print receipt ${r.no}`}>
                          <Printer size={16} aria-hidden /> Print
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {open && <ReceiptSheet receipt={open} branding={branding} terms={terms} onClose={() => setOpenId(null)} />}
    </div>
  );
}
