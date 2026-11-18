/** Shared shapes for the Bursar pages. Money is integer ngwee. Dates are "YYYY-MM-DD" in the school's zone. */
export type { AccountKind, MethodId, Outcome } from "./cashier";

export type PlanInstalment = { dueOn: string; amount: number };

/** A cancelled plan stops changing due dates. A plan that is fully paid off simply stops mattering. */
export type PlanStatus = "active" | "cancelled";

/**
 * An agreed way for a debtor to pay what they owe in instalments. While it is
 * active the next unpaid instalment is the student's due date everywhere (the
 * Cashier, Student and Parent pages), so a student keeping to the plan is not
 * shown as overdue.
 */
export type PaymentPlan = {
  id: string;
  studentNo: string;
  /** What the student owed in total when the plan was agreed, ngwee. */
  startBalance: number;
  instalments: PlanInstalment[];
  note: string;
  status: PlanStatus;
  createdAt: string;
  createdBy: string;
  cancelledAt?: string;
  cancelReason?: string;
};
