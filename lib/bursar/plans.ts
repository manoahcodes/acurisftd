import type { PaymentPlan, PlanInstalment } from "@/types/bursar";

/**
 * Plan arithmetic. Pure, so the Cashier, Student and Bursar pages all agree.
 * What has been paid on a plan is how much the total owed has fallen since the
 * plan was agreed; instalments are covered in date order.
 */

export const paidOnPlan = (plan: Pick<PaymentPlan, "startBalance">, owedNow: number) => Math.max(0, plan.startBalance - owedNow);

/** The first instalment not yet covered by what has been paid, or null when the plan is paid off. */
export function nextInstalment(plan: Pick<PaymentPlan, "startBalance" | "instalments">, owedNow: number): PlanInstalment | null {
  const paid = paidOnPlan(plan, owedNow);
  let covered = 0;
  for (const i of [...plan.instalments].sort((a, b) => a.dueOn.localeCompare(b.dueOn))) {
    covered += i.amount;
    if (covered > paid) return i;
  }
  return null;
}

/** Due date while on a plan: the next unpaid instalment. Null when every instalment is covered. */
export const planDue = (plan: Pick<PaymentPlan, "startBalance" | "instalments">, owedNow: number): string | null => nextInstalment(plan, owedNow)?.dueOn ?? null;

export type PlanProgress = { paid: number; remaining: number; next: PlanInstalment | null; behind: boolean; done: boolean };

/** Where a plan stands today. Behind means an instalment date has passed with it not yet covered. */
export function planProgress(plan: Pick<PaymentPlan, "startBalance" | "instalments">, owedNow: number, today: string): PlanProgress {
  const next = nextInstalment(plan, owedNow);
  return { paid: paidOnPlan(plan, owedNow), remaining: owedNow, next, behind: Boolean(next && next.dueOn < today && owedNow > 0), done: owedNow <= 0 };
}

const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();

/** The same day `n` months on, or the last day of that month when it is shorter (31 Jan plus a month is 28 Feb). */
export function addMonths(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const total = y * 12 + (m - 1) + n;
  const year = Math.floor(total / 12);
  const month = total % 12;
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(Math.min(d, lastDay(year, month))).padStart(2, "0")}`;
}

/** Equal monthly instalments that add up to exactly the total; any odd ngwee goes on the last one. */
export function buildSchedule(total: number, count: number, firstDueOn: string): PlanInstalment[] {
  const each = Math.floor(total / count);
  return Array.from({ length: count }, (_, i) => ({ dueOn: addMonths(firstDueOn, i), amount: i === count - 1 ? total - each * (count - 1) : each }));
}
