import type { InstitutionType } from "@/config/institution";
import type { FeeBalance } from "@/lib/fee-policy";

/**
 * A child's fee statement for the period under way: one invoice, the receipts
 * against it and a running ledger. Sample data until the Bursar's records are
 * connected (SWAP POINT: build this from the Bursar's invoices and receipts).
 * Money is integer ngwee. It is built so that billed minus paid always equals
 * the child's outstanding balance, so this page and the Student pages agree.
 */

export type InvoiceLine = { label: string; amount: number };
export type Invoice = { number: string; issuedOn: string; dueOn: string; lines: InvoiceLine[]; total: number };
export type Receipt = { number: string; paidOn: string; method: string; amount: number };
export type LedgerRow = { date: string; description: string; reference: string; charge: number; payment: number; balance: number };
export type FeeStatement = { invoice: Invoice; receipts: Receipt[]; ledger: LedgerRow[]; billed: number; paid: number; balance: number; status: FeeBalance["status"]; dueOn: string | null };

const STRUCTURE: Record<InstitutionType, InvoiceLine[]> = {
  primary: [{ label: "Tuition", amount: 450_000 }, { label: "PTA levy", amount: 50_000 }, { label: "Books and stationery", amount: 100_000 }],
  high_school: [{ label: "Tuition", amount: 700_000 }, { label: "Laboratory and sports", amount: 100_000 }, { label: "Examination fees", amount: 60_000 }],
  college: [{ label: "Tuition", amount: 900_000 }, { label: "Registration", amount: 120_000 }, { label: "Workshop and lab", amount: 80_000 }],
  university: [{ label: "Tuition", amount: 1_800_000 }, { label: "Registration", amount: 200_000 }, { label: "Library and ICT", amount: 150_000 }],
};

const ISSUED_ON = "2026-08-28";
const PAID_DATES: Array<[string, string]> = [["2026-09-04", "Bank deposit"], ["2026-10-09", "Mobile money"]];

const code = (childId: string) => childId.replace(/[^a-z0-9]/gi, "").slice(0, 3).toUpperCase().padEnd(3, "X");

export function buildStatement(type: InstitutionType, childId: string, fee: FeeBalance, periodLabel: string): FeeStatement {
  const lines = STRUCTURE[type];
  const total = lines.reduce((n, l) => n + l.amount, 0);
  const paid = Math.max(0, total - fee.balance);
  const c = code(childId);

  const invoice: Invoice = { number: `INV-2026-${c}-${periodLabel.replace(/\D/g, "").slice(0, 1) || "1"}`, issuedOn: ISSUED_ON, dueOn: fee.dueOn ?? "2026-09-30", lines, total };

  // Paid money arrives as up to two receipts: about 60% first, the rest later.
  const first = Math.round(paid * 0.6);
  const amounts = paid === 0 ? [] : first > 0 && paid - first > 0 ? [first, paid - first] : [paid];
  const receipts: Receipt[] = amounts.map((amount, i) => ({ number: `RCT-${c}-${String(i + 1).padStart(4, "0")}`, paidOn: PAID_DATES[i][0], method: PAID_DATES[i][1], amount }));

  let balance = 0;
  const ledger: LedgerRow[] = [{ date: invoice.issuedOn, description: `Fees, ${periodLabel}`, reference: invoice.number, charge: total, payment: 0, balance: (balance += total) }];
  for (const r of receipts) ledger.push({ date: r.paidOn, description: `Payment, ${r.method}`, reference: r.number, charge: 0, payment: r.amount, balance: (balance -= r.amount) });

  return { invoice, receipts, ledger, billed: total, paid, balance: fee.balance > total ? total : fee.balance, status: fee.status, dueOn: fee.dueOn };
}
