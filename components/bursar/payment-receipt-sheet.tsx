"use client";

import { DetailsList, PrintSheet } from "@/components/platform/print-sheet";
import { paymentStatusLabel, sourceLabel } from "@/lib/bursar/format";
import type { BursarTerms } from "@/lib/bursar/terms";
import { METHOD_LABELS } from "@/lib/cashier/methods";
import { ACCOUNT_LABELS } from "@/lib/cashier/terms";
import { formatKwacha } from "@/lib/money";
import type { PrintBranding } from "@/lib/print";
import { prettyDate } from "@/lib/teacher/dates";
import type { Payment } from "@/types/bursar";

/** A payment as a printable receipt. A reversed one prints with REVERSED and its reason, so it can never pass as a payment. */
export function PaymentReceiptSheet({ payment: p, branding, terms, onClose }: { payment: Payment; branding: PrintBranding; terms: BursarTerms; onClose: () => void }) {
  const reversed = p.status === "reversed";
  return (
    <PrintSheet branding={branding} title={reversed ? `Receipt ${p.no} (REVERSED)` : `Receipt ${p.no}`} lines={[`Received ${prettyDate(p.date)}`]} signature onClose={onClose}>
      {reversed && <p className="mb-4 rounded border-2 border-[#b00020] px-3 py-2 text-lg font-bold text-[#b00020]">REVERSED{p.reversal ? `: ${p.reversal.reason}` : ""}</p>}
      <DetailsList
        details={[
          ["Received from", `${p.studentName} (${p.studentNo})`],
          [terms.group, p.group],
          ["Paid into", ACCOUNT_LABELS[p.account]],
          ["Method", METHOD_LABELS[p.method]],
          ["Reference", p.reference],
          ["Amount", formatKwacha(p.amount)],
          ["Status", paymentStatusLabel(p.status)],
          ["Taken by", `${sourceLabel(p.source)}, ${p.by}`],
          ["Note", p.note],
        ]}
      />
    </PrintSheet>
  );
}
