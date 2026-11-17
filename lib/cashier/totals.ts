import { METHOD_IDS, type DayTotals, type MethodId, type Receipt } from "@/types/cashier";

/** "RC-02641": the printed receipt number. */
export const receiptNo = (n: number) => `RC-${String(n).padStart(5, "0")}`;

const emptyByMethod = () => Object.fromEntries(METHOD_IDS.map((m) => [m, 0])) as Record<MethodId, number>;

/**
 * One day's figures. Voided receipts are listed elsewhere but never counted;
 * pending ones count as transactions but not as money collected yet.
 */
export function dayTotals(receipts: Receipt[], date: string): DayTotals {
  const t: DayTotals = { date, count: 0, collected: 0, pending: 0, pendingAmount: 0, voided: 0, expectedCash: 0, byMethod: emptyByMethod() };
  for (const r of receipts) {
    if (r.date !== date) continue;
    if (r.status === "voided") {
      t.voided += 1;
      continue;
    }
    t.count += 1;
    if (r.status === "pending") {
      t.pending += 1;
      t.pendingAmount += r.amount;
      continue;
    }
    t.collected += r.amount;
    t.byMethod[r.method] += r.amount;
    if (r.method === "cash") t.expectedCash += r.amount;
  }
  return t;
}

/** Newest first. */
export const newestFirst = (a: Receipt, b: Receipt) => b.at.localeCompare(a.at) || b.no.localeCompare(a.no);
