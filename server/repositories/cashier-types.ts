import type { InstitutionType } from "@/config/institution";
import type { CashUp, DaySummary, DenominationCounts, Outcome, PaymentInput, Receipt, StudentAccount } from "@/types/cashier";

/**
 * Who is asking, and which school day it is. Every method reads and writes only
 * this cashier's own ledger inside this school. A real implementation must
 * enforce that in its queries, not in the UI. `today` is "YYYY-MM-DD" in the
 * school's zone, worked out once per request by the caller, so the repository
 * never reads the clock itself.
 */
export type CashierContext = { tenantId: string; cashierId: string; cashierName: string; institutionType: InstitutionType; today: string };

/**
 * Everything the Cashier pages read and write. The mock keeps it in memory and
 * a SQLite file; swap it in ./index.ts for your own database. `now` is an ISO
 * timestamp from the caller. Money is integer ngwee.
 *
 * Rules the implementation must keep:
 * - A payment cannot exceed what is owed on the account.
 * - Cash is a successful receipt at once; mobile money and bank payments are
 *   pending until the cashier confirms them, and only confirmed ones count as collected.
 * - A receipt can be voided only on the day it was taken, with a reason, and
 *   stays listed. Refunds and later changes belong to the Bursar.
 * - Submitting the cash-up locks that day: no new payments, confirmations or voids.
 */
export interface CashierRepository {
  /** The school's students with what each still owes. SWAP POINT: comes from the Bursar's records. */
  listStudents(ctx: CashierContext): Promise<StudentAccount[]>;

  /** Every receipt, newest first, voided ones included. */
  listReceipts(ctx: CashierContext): Promise<Receipt[]>;
  /**
   * Every cashier's receipts in this school, newest first, for the Bursar's
   * pages. `ctx` says who is asking so a real implementation can authorise it;
   * the mock also makes sure the caller's own desk exists.
   */
  listSchoolReceipts(ctx: CashierContext): Promise<Receipt[]>;
  /** Takes a payment today and returns the new receipt's id. */
  recordPayment(ctx: CashierContext, input: PaymentInput, now: string): Promise<Outcome>;
  /** Marks a pending mobile money or bank receipt as received. */
  confirmReceipt(ctx: CashierContext, receiptId: string, now: string): Promise<Outcome>;
  /** Voids one of today's receipts. The reason is required and kept. */
  voidReceipt(ctx: CashierContext, receiptId: string, reason: string, now: string): Promise<Outcome>;

  /** One day's figures and its cash-up, if submitted. */
  getDay(ctx: CashierContext, date: string): Promise<DaySummary>;
  /** Submitted cash-ups, newest first. */
  listCashUps(ctx: CashierContext): Promise<CashUp[]>;
  /**
   * Submits today's cash-up from the counted denominations. Refused when it was
   * already submitted or receipts are still pending; a reason is required when
   * the count differs from the expected cash.
   */
  submitCashUp(ctx: CashierContext, input: { counts: DenominationCounts; reason: string }, now: string): Promise<Outcome>;
}
