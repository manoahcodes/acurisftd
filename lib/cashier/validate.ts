import type { AccountKind, DenominationCounts, MethodId, PaymentInput } from "@/types/cashier";
import { ACCOUNT_KINDS } from "@/types/cashier";
import { enabledMethods, methodOf } from "./methods";

/** Checks shared by the server actions (which must not trust the browser) and the forms. Pure, so they are easy to test. */

export type Checked<T> = { ok: true; value: T } | { ok: false; error: string; fields?: Record<string, string> };

export const LIMITS = { reference: 60, note: 200, reason: 200, amount: 100_000_00 };

/** Notes and coins the drawer is counted in, largest first, in ngwee. */
export const DENOMINATIONS = [20000, 10000, 5000, 2000, 1000, 500, 200, 100, 50, 20, 10, 5] as const;
export const MAX_COUNT_PER_DENOMINATION = 100_000;

export const denominationLabel = (ngwee: number) => (ngwee >= 100 ? `K ${ngwee / 100}` : `${ngwee} ngwee`);

/**
 * Typed kwacha ("850", "1,250.50") to ngwee, with no floating point. Returns
 * undefined for anything that is not a positive amount with at most two decimals.
 */
export function parseKwacha(text: unknown): number | undefined {
  if (typeof text !== "string") return undefined;
  const clean = text.trim().replace(/,/g, "");
  const m = /^(\d{1,9})(?:\.(\d{1,2}))?$/.exec(clean);
  if (!m) return undefined;
  const ngwee = Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0") || "0");
  return ngwee > 0 ? ngwee : undefined;
}

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max + 1) : "");

export type PaymentContext = {
  /** What is still owed on each account of the chosen student, by kind. Absent kinds are not billed. */
  owed: Partial<Record<AccountKind, number>>;
};

/**
 * A payment as typed. The amount is already in ngwee (the form converts, the
 * action converts again from text). It cannot be more than what is owed on the
 * account, and mobile money and bank payments need a reference.
 */
export function checkPayment(raw: { studentNo?: unknown; account?: unknown; method?: unknown; amount?: unknown; reference?: unknown; note?: unknown }, ctx: PaymentContext): Checked<PaymentInput> {
  const studentNo = typeof raw.studentNo === "string" ? raw.studentNo.trim() : "";
  if (!studentNo) return { ok: false, error: "Choose who is paying.", fields: { student: "Choose a student." } };

  const account = ACCOUNT_KINDS.find((k) => k === raw.account);
  if (!account || ctx.owed[account] === undefined) return { ok: false, error: "Choose an account to pay into.", fields: { account: "Choose an account." } };

  const method = enabledMethods().find((m) => m.id === raw.method);
  if (!method) return { ok: false, error: "Choose how the money was paid.", fields: { method: "Choose a payment method." } };

  const amount = raw.amount;
  if (typeof amount !== "number" || !Number.isSafeInteger(amount) || amount <= 0) return { ok: false, error: "Enter the amount received.", fields: { amount: "Enter an amount above zero." } };
  if (amount > LIMITS.amount) return { ok: false, error: "That amount is too large to take at the desk.", fields: { amount: "Too large." } };
  const owed = ctx.owed[account] ?? 0;
  if (owed <= 0) return { ok: false, error: "Nothing is owed on that account.", fields: { account: "Nothing owed on this account." } };
  if (amount > owed) return { ok: false, error: "The amount is more than is owed on that account. Advance payments are handled by the Bursar.", fields: { amount: "More than is owed." } };

  const reference = clean(raw.reference, LIMITS.reference);
  if (reference.length > LIMITS.reference) return { ok: false, error: `The reference can be at most ${LIMITS.reference} characters.`, fields: { reference: `At most ${LIMITS.reference} characters.` } };
  if (method.group !== "cash" && !reference) return { ok: false, error: "Enter the transaction or deposit reference.", fields: { reference: "Required for this method." } };

  const note = clean(raw.note, LIMITS.note);
  if (note.length > LIMITS.note) return { ok: false, error: `The note can be at most ${LIMITS.note} characters.`, fields: { note: `At most ${LIMITS.note} characters.` } };

  return { ok: true, value: { studentNo, account, method: method.id as MethodId, amount, reference: method.group === "cash" ? "" : reference, note } };
}

/** A void needs a reason, so the audit trail says why. */
export function checkVoidReason(raw: unknown): Checked<string> {
  const reason = clean(raw, LIMITS.reason);
  if (!reason) return { ok: false, error: "Say why this receipt is being voided.", fields: { reason: "A reason is required." } };
  if (reason.length > LIMITS.reason) return { ok: false, error: `The reason can be at most ${LIMITS.reason} characters.`, fields: { reason: `At most ${LIMITS.reason} characters.` } };
  return { ok: true, value: reason };
}

/** Counts typed in the cash-up: only known denominations, whole numbers from zero. Missing means zero. */
export function checkCounts(raw: unknown): Checked<DenominationCounts> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, error: "Count the drawer first." };
  const known = new Set<string>(DENOMINATIONS.map(String));
  const out: DenominationCounts = {};
  for (const [k, v] of Object.entries(raw)) {
    if (!known.has(k)) return { ok: false, error: "That denomination is not recognised." };
    if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > MAX_COUNT_PER_DENOMINATION) return { ok: false, error: "Counts must be whole numbers from 0.", fields: { [k]: "Whole number from 0." } };
    if (v > 0) out[k] = v;
  }
  return { ok: true, value: out };
}

/** What the counts add up to, in ngwee. */
export const countedTotal = (counts: DenominationCounts): number => Object.entries(counts).reduce((sum, [k, n]) => sum + Number(k) * n, 0);

/** The fewest notes and coins that make `ngwee` (a multiple of 5 ngwee; any remainder is dropped). */
export function breakDown(ngwee: number): DenominationCounts {
  const out: DenominationCounts = {};
  let left = Math.max(0, Math.floor(ngwee));
  for (const d of DENOMINATIONS) {
    const n = Math.floor(left / d);
    if (n > 0) out[String(d)] = n;
    left -= n * d;
  }
  return out;
}

/**
 * The cash-up as counted. A difference from the expected cash (over or short)
 * needs a reason. Pure: the repository adds the day and the lock.
 */
export function checkCashUp(raw: { counts?: unknown; reason?: unknown }, expected: number): Checked<{ counts: DenominationCounts; counted: number; variance: number; reason: string }> {
  const counts = checkCounts(raw.counts);
  if (!counts.ok) return counts;
  const counted = countedTotal(counts.value);
  const variance = counted - expected;
  const reason = clean(raw.reason, LIMITS.reason);
  if (reason.length > LIMITS.reason) return { ok: false, error: `The reason can be at most ${LIMITS.reason} characters.`, fields: { reason: `At most ${LIMITS.reason} characters.` } };
  if (variance !== 0 && !reason) return { ok: false, error: `The count is ${variance > 0 ? "over" : "short"}. Say why before submitting.`, fields: { reason: "A reason is required when the count differs." } };
  return { ok: true, value: { counts: counts.value, counted, variance, reason: variance === 0 ? "" : reason } };
}

export const isMethod = (v: unknown): v is MethodId => typeof v === "string" && methodOf(v) !== undefined;
