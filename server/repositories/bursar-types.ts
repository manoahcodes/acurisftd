import type { InstitutionType } from "@/config/institution";
import type { AccountRow, AccountKind, FeeItem, FeeItemInput, Invoice, Outcome, Payment, RecordPaymentInput, Statement, UnallocatedPayment, Waiver, WaiverInput } from "@/types/bursar";

/**
 * Who is asking, and which school day it is. The Bursar works on the whole
 * school's fee ledger, so every method reads and writes inside this tenant. A
 * real implementation must enforce that in its queries, not in the UI. `today`
 * is "YYYY-MM-DD" in the school's zone, worked out once per request by the
 * caller, so the repository never reads the clock itself.
 */
export type BursarContext = { tenantId: string; bursarId: string; bursarName: string; institutionType: InstitutionType; today: string };

/**
 * Everything the Bursar pages read and write. The mock keeps it in memory and a
 * SQLite file; swap it in ./index.ts for your own database. `now` is an ISO
 * timestamp from the caller. Money is integer ngwee.
 *
 * Rules the implementation must keep:
 * - What a student owes lives in one ledger (see ledger-store.ts) that the
 *   Cashier, Student and Parent pages also read, so every change here moves the
 *   balance everywhere.
 * - Money is never deleted. A payment is reversed with a reason and stays listed.
 * - A fee is never deleted either: it is made inactive, so old invoices still
 *   point at something. Two fees cannot share a name, account and scope.
 *
 * Methods are added page by page as each Bursar page is built.
 */
export interface BursarRepository {
  /** One student's total owed and earliest due date, or undefined for a number that is not on the school's roll. */
  balanceOf(ctx: BursarContext, studentNo: string): Promise<{ balance: number; dueOn: string | null } | undefined>;

  // Fee structures
  /** The school's fee structure, in the order it was set up. Inactive fees included. */
  listFees(ctx: BursarContext): Promise<FeeItem[]>;
  /** The classes or programmes on the school's roll (what a fee can apply to). */
  listGroups(ctx: BursarContext): Promise<string[]>;
  /** Adds a fee, or changes the one named by `input.id`. Returns the fee's id. */
  saveFee(ctx: BursarContext, input: FeeItemInput, now: string): Promise<Outcome>;
  /** Turns a fee on or off without deleting it. */
  setFeeActive(ctx: BursarContext, id: string, active: boolean, now: string): Promise<Outcome>;

  // Student accounts
  /** Every student's account, in roll order. */
  listAccounts(ctx: BursarContext): Promise<AccountRow[]>;
  /** One student's statement, or undefined for a number that is not on the school's roll. */
  getStatement(ctx: BursarContext, studentNo: string): Promise<Statement | undefined>;
  /** Every payment in the school, whoever took it (the desk, the Bursar, or an allocation), newest first. Reversed ones stay listed; voided receipts do not. */
  listPayments(ctx: BursarContext): Promise<Payment[]>;
  listInvoices(ctx: BursarContext): Promise<Invoice[]>;
  /**
   * Records a payment the Bursar received (a bank deposit, a transfer, cash at
   * the office), dated the day it arrived. It is counted straight away. Not
   * more than the account owes, and a reference cannot be used twice, nor can
   * one that is waiting in unallocated payments. Returns the payment's id.
   */
  recordPayment(ctx: BursarContext, input: RecordPaymentInput, now: string): Promise<Outcome>;
  /**
   * Puts a payment back on the account with a reason. It stays listed as
   * reversed and a second line on the statement shows the money returning. A
   * payment that was allocated from an unallocated one goes back to
   * unallocated, so it can be given to the right student.
   */
  reversePayment(ctx: BursarContext, paymentId: string, reason: string, now: string): Promise<Outcome>;
  /** Money received without a student number: open ones first, then allocated, newest first. */
  listUnallocated(ctx: BursarContext): Promise<UnallocatedPayment[]>;
  /** Gives all or part of an unallocated payment to one student's account. It cannot exceed what is left or what the account owes. */
  allocatePayment(ctx: BursarContext, id: string, to: { studentNo: string; account: AccountKind; amount: number }, now: string): Promise<Outcome>;
  /** Bursaries, waivers and discounts: pending first, then decided, newest first. */
  listWaivers(ctx: BursarContext): Promise<Waiver[]>;
  /** Records a request. Nothing changes on the account until it is approved. */
  requestWaiver(ctx: BursarContext, input: WaiverInput, now: string): Promise<Outcome>;
  /** Approves (takes the amount off the account, if it still owes that much) or declines a pending request. */
  decideWaiver(ctx: BursarContext, id: string, decision: "approve" | "decline", note: string, now: string): Promise<Outcome>;
}
