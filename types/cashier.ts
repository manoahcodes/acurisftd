/** Shared shapes for the Cashier pages. Money is integer ngwee. Dates are "YYYY-MM-DD" in the school's zone. */

/** What a repository write returns: it worked (with the new id, if any), or why not. */
export type Outcome = { ok: true; id?: string } | { ok: false; error: string };

export const METHOD_IDS = ["cash", "airtel_money", "mtn_money", "zamtel_money", "bank_deposit"] as const;
export type MethodId = (typeof METHOD_IDS)[number];
/** Cash is counted in the drawer; mobile money and bank payments are confirmed against a phone or statement. */
export type MethodGroup = "cash" | "mobile" | "bank";

export const ACCOUNT_KINDS = ["tuition", "transport", "meals", "accommodation", "registration", "other"] as const;
export type AccountKind = (typeof ACCOUNT_KINDS)[number];

/** Pending: mobile money or bank payment not yet confirmed. Voided receipts stay listed but are never counted. */
export type ReceiptStatus = "success" | "pending" | "voided";

export type Receipt = {
  id: string;
  /** Printed number, e.g. "RC-02641". */
  no: string;
  studentNo: string;
  studentName: string;
  group: string;
  account: AccountKind;
  method: MethodId;
  /** Ngwee. */
  amount: number;
  /** Mobile money transaction id or bank slip number. Empty for cash. */
  reference: string;
  note: string;
  status: ReceiptStatus;
  /** ISO time the payment was taken. */
  at: string;
  /** The school day it was taken on. */
  date: string;
  cashier: string;
  void?: { reason: string; at: string; by: string };
};

/** One fee account of one student: what is still owed on it. */
export type FeeLine = { kind: AccountKind; owed: number; dueOn: string | null };

export type StudentAccount = {
  no: string;
  name: string;
  group: string;
  lines: FeeLine[];
  /** Total owed, ngwee. */
  total: number;
  /** Earliest due date among the lines that are still owed. */
  dueOn: string | null;
};

export type PaymentInput = {
  studentNo: string;
  account: AccountKind;
  method: MethodId;
  /** Ngwee. */
  amount: number;
  reference: string;
  note: string;
};

/** Counts per denomination, keyed by the denomination in ngwee (as a string). */
export type DenominationCounts = Record<string, number>;

export type CashUp = {
  date: string;
  counts: DenominationCounts;
  counted: number;
  expected: number;
  variance: number;
  reason: string;
  submittedAt: string;
  submittedBy: string;
};

/** A day's figures, never counting voided receipts. */
export type DayTotals = {
  date: string;
  /** Successful and pending receipts. */
  count: number;
  /** Money collected: successful receipts only. */
  collected: number;
  pending: number;
  pendingAmount: number;
  voided: number;
  /** Successful cash receipts: what should be in the drawer. */
  expectedCash: number;
  byMethod: Record<MethodId, number>;
};

export type DaySummary = DayTotals & { cashUp: CashUp | undefined };
