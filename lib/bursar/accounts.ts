import { statusOf } from "@/lib/fee-policy";
import { ACCOUNT_LABELS } from "@/lib/cashier/terms";
import type { AccountKind } from "@/types/cashier";
import type { AccountRow, Invoice, Payment, StatementEntry, Waiver } from "@/types/bursar";

/** Account and statement maths. Pure, so the repository, the pages and the tests all agree. Money is integer ngwee. */

export type RollStudent = { no: string; name: string; group: string };
export type LedgerLine = { kind: AccountKind; owed: number; dueOn: string | null };

/**
 * One student's account. Billed, paid and waived come from the records; owed
 * comes from the ledger (the one number every role shares). When the records
 * are complete, billed − paid − waived equals owed.
 */
export function accountRow(st: RollStudent, ledger: LedgerLine[], invoices: Invoice[], payments: Payment[], waivers: Waiver[], onPlan: boolean, today: string): AccountRow {
  const mine = invoices.filter((i) => i.studentNo === st.no);
  const paidPayments = payments.filter((p) => p.studentNo === st.no && p.status === "success");
  const approved = waivers.filter((w) => w.studentNo === st.no && w.status === "approved");
  const lines = ledger.map((l) => ({ kind: l.kind, billed: mine.flatMap((i) => i.lines).filter((x) => x.kind === l.kind).reduce((n, x) => n + x.amount, 0), owed: l.owed, dueOn: l.dueOn }));
  const owed = lines.reduce((n, l) => n + l.owed, 0);
  const dues = lines.filter((l) => l.owed > 0 && l.dueOn).map((l) => l.dueOn as string).sort();
  const dueOn = dues[0] ?? null;
  return {
    no: st.no,
    name: st.name,
    group: st.group,
    lines,
    billed: lines.reduce((n, l) => n + l.billed, 0),
    paid: paidPayments.reduce((n, p) => n + p.amount, 0),
    waived: approved.reduce((n, w) => n + w.amount, 0),
    owed,
    dueOn,
    status: statusOf(owed, dueOn, today),
    onPlan,
    pendingWaivers: waivers.filter((w) => w.studentNo === st.no && w.status === "pending").length,
  };
}

/**
 * The student's statement, oldest first, with what was owed after each line.
 * A payment is a credit; reversing it adds a second line that puts the money
 * back, so the payment itself is never deleted. Pending payments are not
 * counted until confirmed.
 */
export function statementEntries(invoices: Invoice[], payments: Payment[], waivers: Waiver[]): StatementEntry[] {
  const raw: Array<Omit<StatementEntry, "balance">> = [];
  for (const i of invoices) raw.push({ id: i.id, date: i.issuedOn, at: `${i.issuedOn}T08:00:00+02:00`, kind: "invoice", description: `Fees, ${i.period}`, reference: i.no, charge: i.total, credit: 0 });
  for (const p of payments) {
    if (p.status === "pending") continue;
    raw.push({ id: p.id, date: p.date, at: p.at, kind: "payment", description: `Payment, ${ACCOUNT_LABELS[p.account]}`, reference: p.no, charge: 0, credit: p.amount, paymentId: p.id });
    if (p.status === "reversed" && p.reversal) raw.push({ id: `${p.id}-rev`, date: p.reversal.at.slice(0, 10), at: p.reversal.at, kind: "reversal", description: `Reversed: ${p.reversal.reason}`, reference: p.no, charge: p.amount, credit: 0, paymentId: p.id });
  }
  for (const w of waivers) if (w.status === "approved" && w.decidedAt) raw.push({ id: w.id, date: w.decidedAt.slice(0, 10), at: w.decidedAt, kind: "waiver", description: `${w.kind === "bursary" ? "Bursary" : w.kind === "discount" ? "Discount" : "Waiver"}: ${w.source}`, reference: w.no, charge: 0, credit: w.amount });
  const first = (e: { kind: string }) => (e.kind === "invoice" ? 0 : 1);
  raw.sort((a, b) => a.at.localeCompare(b.at) || first(a) - first(b));
  let balance = 0;
  return raw.map((e) => ({ ...e, balance: (balance += e.charge - e.credit) }));
}
