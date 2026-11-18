/** Shared shapes for the Bursar pages. Money is integer ngwee. Dates are "YYYY-MM-DD" in the school's zone. */
import type { AccountKind } from "./cashier";

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

/** Who a fee applies to: everyone, a range of grades (schools), or one programme (colleges and universities). */
export type FeeScope = { kind: "all" } | { kind: "grades"; from: number; to: number } | { kind: "group"; group: string };
/** Charged every term or semester, or once a year. */
export const FEE_FREQUENCIES = ["period", "year"] as const;
export type FeeFrequency = (typeof FEE_FREQUENCIES)[number];
/** Everyone it applies to is billed, or it is optional and only added to the accounts that take it up (hostel, transport). */
export const FEE_BILLINGS = ["everyone", "optional"] as const;
export type FeeBilling = (typeof FEE_BILLINGS)[number];

/** One line of the school's fee structure. Only active fees whose effective date has come are billed. */
export type FeeItem = {
  id: string;
  name: string;
  kind: AccountKind;
  /** Ngwee. */
  amount: number;
  scope: FeeScope;
  frequency: FeeFrequency;
  billing: FeeBilling;
  /** When invoices carrying this fee fall due. */
  dueOn: string;
  effectiveFrom: string;
  active: boolean;
  updatedAt: string;
  updatedBy: string;
};

export type FeeItemInput = Omit<FeeItem, "id" | "updatedAt" | "updatedBy"> & { id?: string };
