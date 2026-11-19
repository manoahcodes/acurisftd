import { debtorsOf } from "@/lib/bursar/debtors";
import { planProgress } from "@/lib/bursar/plans";
import { reconcile, targetsOf } from "@/lib/bursar/reconcile";
import { methodOf } from "@/lib/cashier/methods";
import type { CashUpBook } from "@/server/repositories/bursar-types";
import type { AccountRow, BankLine, Payment, PaymentPlan, UnallocatedPayment, Waiver } from "@/types/bursar";

/** The headline figures the dashboard, sidebar badges and bell all draw on. Pure, so they always agree. */

export type BursarOverview = {
  collectedToday: number;
  paymentsToday: number;
  /** Today's collections by how they were paid. */
  today: { mobile: number; bank: number; cash: number; mobileCount: number; bankCount: number; cashCount: number };
  owed: number;
  debtors: number;
  overdueDebtors: number;
  overdueAmount: number;
  behindPlans: number;
  openUnallocated: number;
  unallocatedAmount: number;
  pendingWaivers: number;
  pendingWaiverAmount: number;
  cashUpsToReview: number;
  daysNotCashedUp: number;
  statementIssues: number;
  /** What needs a look on Reconciliation in all. */
  reconciliation: number;
};

export type OverviewInput = { accounts: AccountRow[]; payments: Payment[]; unallocated: UnallocatedPayment[]; waivers: Waiver[]; plans: PaymentPlan[]; book: CashUpBook; lines: BankLine[]; today: string };

export function overviewOf(i: OverviewInput): BursarOverview {
  const todays = i.payments.filter((p) => p.status === "success" && p.date === i.today);
  const group = (g: "cash" | "mobile" | "bank") => todays.filter((p) => methodOf(p.method)?.group === g);
  const sum = (ps: Payment[]) => ps.reduce((n, p) => n + p.amount, 0);
  const debtors = debtorsOf(i.accounts, i.plans, [], i.today);
  const overdue = debtors.filter((d) => d.daysOverdue > 0);
  const open = i.unallocated.filter((u) => u.status === "open");
  const pending = i.waivers.filter((w) => w.status === "pending");
  const views = reconcile(i.lines, targetsOf(i.payments, i.unallocated));
  const statementIssues = views.filter((v) => v.status === "mismatch" || v.status === "unmatched").length;
  const toReview = i.book.rows.filter((r) => !r.review || r.review.status === "queried").length;
  return {
    collectedToday: sum(todays),
    paymentsToday: todays.length,
    today: { mobile: sum(group("mobile")), bank: sum(group("bank")), cash: sum(group("cash")), mobileCount: group("mobile").length, bankCount: group("bank").length, cashCount: group("cash").length },
    owed: debtors.reduce((n, d) => n + d.account.owed, 0),
    debtors: debtors.length,
    overdueDebtors: overdue.length,
    overdueAmount: overdue.reduce((n, d) => n + d.account.owed, 0),
    behindPlans: debtors.filter((d) => d.plan && planProgress(d.plan, d.account.owed, i.today).behind).length,
    openUnallocated: open.length,
    unallocatedAmount: open.reduce((n, u) => n + u.remaining, 0),
    pendingWaivers: pending.length,
    pendingWaiverAmount: pending.reduce((n, w) => n + w.amount, 0),
    cashUpsToReview: toReview,
    daysNotCashedUp: i.book.missing.length,
    statementIssues,
    reconciliation: toReview + i.book.missing.length + statementIssues,
  };
}
