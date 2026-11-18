/** Shared shapes for the Bursar pages. Money is integer ngwee. Dates are "YYYY-MM-DD" in the school's zone. */
import type { AccountKind, MethodId } from "./cashier";

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

// ---- Payments, statements, unallocated money and waivers ----


/** Pending: a mobile money or bank payment not yet confirmed (not counted). Reversed: put back on the account, with a reason. */
export type PaymentStatus = "success" | "pending" | "reversed";
/** Taken at the Cashier's desk, recorded by the Bursar, or allocated from an unallocated payment. */
export type PaymentSource = "cashier" | "bursar" | "allocation";

export type Reversal = { reason: string; at: string; by: string };

/** One payment into a student's account, whoever took it. Never deleted: a reversed payment stays listed. */
export type Payment = {
  id: string;
  /** Printed number: "RC-02641" at the desk, "BP-00012" from the Bursar. */
  no: string;
  source: PaymentSource;
  studentNo: string;
  studentName: string;
  group: string;
  account: AccountKind;
  method: MethodId;
  amount: number;
  reference: string;
  note: string;
  status: PaymentStatus;
  at: string;
  date: string;
  by: string;
  /** For an allocation: the unallocated payment it came from. */
  fromUnallocated?: string;
  reversal?: Reversal;
};

export type InvoiceLine = { kind: AccountKind; name: string; amount: number };

export type Invoice = {
  id: string;
  /** "INV-2026-0001". */
  no: string;
  studentNo: string;
  /** "Term 3 2026" or "Semester 2 2026". */
  period: string;
  issuedOn: string;
  dueOn: string;
  lines: InvoiceLine[];
  total: number;
};

/** One slice of an unallocated payment given to a student. Kept for the record even if it is later reversed. */
export type Allocation = { paymentNo: string; studentNo: string; studentName: string; account: AccountKind; amount: number; at: string; by: string; reversed?: boolean };

/** Money that reached the school's account (a bank deposit, a mobile money transfer) without a student number, waiting to be matched. */
export type UnallocatedPayment = {
  id: string;
  no: string;
  date: string;
  method: MethodId;
  amount: number;
  /** Still to allocate, ngwee. */
  remaining: number;
  reference: string;
  /** What the statement says about who sent it. */
  payer: string;
  note: string;
  status: "open" | "allocated";
  allocations: Allocation[];
};

export const WAIVER_KINDS = ["bursary", "waiver", "discount"] as const;
export type WaiverKind = (typeof WAIVER_KINDS)[number];
export type WaiverStatus = "pending" | "approved" | "declined";

/** A bursary, fee waiver or discount. Nothing changes the account until the Bursar approves it. */
export type Waiver = {
  id: string;
  /** "WV-0001". */
  no: string;
  studentNo: string;
  studentName: string;
  kind: WaiverKind;
  account: AccountKind;
  amount: number;
  /** Who funds a bursary, or who asked for a waiver. */
  source: string;
  reason: string;
  status: WaiverStatus;
  requestedBy: string;
  requestedAt: string;
  decidedBy?: string;
  decidedAt?: string;
  decisionNote?: string;
};

/** A request as entered. Amount is ngwee. */
export type WaiverInput = { studentNo: string; kind: WaiverKind; account: AccountKind; amount: number; source: string; reason: string; requestedBy: string };

export type AccountStatus = "paid" | "due" | "overdue";

export type AccountLine = { kind: AccountKind; billed: number; owed: number; dueOn: string | null };

/** One student's fee account across everything: what was billed, paid, waived and is still owed. */
export type AccountRow = {
  no: string;
  name: string;
  group: string;
  lines: AccountLine[];
  billed: number;
  paid: number;
  waived: number;
  /** Still owed in total, from the ledger. */
  owed: number;
  dueOn: string | null;
  status: AccountStatus;
  /** An active payment plan is covering this account. */
  onPlan: boolean;
  pendingWaivers: number;
};

export type StatementEntryKind = "invoice" | "payment" | "reversal" | "waiver";

export type StatementEntry = {
  id: string;
  date: string;
  at: string;
  kind: StatementEntryKind;
  description: string;
  reference: string;
  /** Adds to what is owed. */
  charge: number;
  /** Takes from what is owed. */
  credit: number;
  /** Owed after this entry. */
  balance: number;
  /** The payment this entry is about, so it can be reversed. */
  paymentId?: string;
};

export type Statement = { account: AccountRow; entries: StatementEntry[]; invoices: Invoice[]; payments: Payment[]; waivers: Waiver[]; plan: PaymentPlan | undefined };
