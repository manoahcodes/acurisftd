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
