"use client";

import { DetailsList, PrintSheet } from "@/components/platform/print-sheet";
import { ACCOUNT_LABELS, type CashierTerms } from "@/lib/cashier/terms";
import { METHOD_LABELS } from "@/lib/cashier/methods";
import { statusLabel } from "@/lib/cashier/format";
import { formatStamp } from "@/lib/format";
import { formatKwacha } from "@/lib/money";
import type { PrintBranding } from "@/lib/print";
import type { Receipt } from "@/types/cashier";

/** One receipt as a printable page. A voided receipt prints with VOID and its reason, so it can never pass as a payment. */
export function ReceiptSheet({ receipt: r, branding, terms, onClose }: { receipt: Receipt; branding: PrintBranding; terms: CashierTerms; onClose: () => void }) {
  const voided = r.status === "voided";
  return (
    <PrintSheet branding={branding} title={voided ? `Receipt ${r.no} (VOID)` : `Receipt ${r.no}`} lines={[formatStamp(r.at, branding.timezone)]} signature onClose={onClose}>
      {voided && <p className="mb-4 rounded border-2 border-[#b00020] px-3 py-2 text-lg font-bold text-[#b00020]">VOID{r.void ? `: ${r.void.reason}` : ""}</p>}
      <DetailsList
        details={[
          ["Received from", `${r.studentName} (${r.studentNo})`],
          [terms.group, r.group],
          ["Paid into", ACCOUNT_LABELS[r.account]],
          ["Method", METHOD_LABELS[r.method]],
          ["Reference", r.reference],
          ["Amount", formatKwacha(r.amount)],
          ["Status", statusLabel(r.status)],
          ["Received by", r.cashier],
          ["Note", r.note],
        ]}
      />
    </PrintSheet>
  );
}
