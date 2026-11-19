import type { AccountRow, AgingBucket, Debtor, PaymentPlan, Reminder } from "@/types/bursar";

/** Debtor ageing. Pure. A debtor is anyone who owes anything; ageing counts days past the due date. */

export const BUCKETS: AgingBucket[] = ["current", "d1_30", "d31_60", "d61_90", "d90_plus"];
export const BUCKET_LABEL: Record<AgingBucket, string> = { current: "Not yet due", d1_30: "1–30 days", d31_60: "31–60 days", d61_90: "61–90 days", d90_plus: "Over 90 days" };

/** Whole days from `from` to `to`, both "YYYY-MM-DD". */
export const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

export function bucketOf(daysOverdue: number): AgingBucket {
  if (daysOverdue <= 0) return "current";
  if (daysOverdue <= 30) return "d1_30";
  if (daysOverdue <= 60) return "d31_60";
  if (daysOverdue <= 90) return "d61_90";
  return "d90_plus";
}

/** Everyone who owes, oldest debt first (most days overdue, then the biggest balance). */
export function debtorsOf(accounts: AccountRow[], plans: PaymentPlan[], reminders: Reminder[], today: string): Debtor[] {
  return accounts
    .filter((a) => a.owed > 0)
    .map((account) => {
      const daysOverdue = account.dueOn && account.dueOn < today ? daysBetween(account.dueOn, today) : 0;
      return {
        account,
        daysOverdue,
        bucket: bucketOf(daysOverdue),
        plan: plans.find((p) => p.studentNo === account.no && p.status === "active"),
        lastReminder: reminders.filter((r) => r.studentNo === account.no).sort((a, b) => b.at.localeCompare(a.at))[0],
      };
    })
    .sort((a, b) => b.daysOverdue - a.daysOverdue || b.account.owed - a.account.owed || a.account.name.localeCompare(b.account.name));
}

export type BucketTotal = { bucket: AgingBucket; count: number; amount: number };

export const agingTotals = (debtors: Debtor[]): BucketTotal[] =>
  BUCKETS.map((bucket) => {
    const mine = debtors.filter((d) => d.bucket === bucket);
    return { bucket, count: mine.length, amount: mine.reduce((n, d) => n + d.account.owed, 0) };
  });
