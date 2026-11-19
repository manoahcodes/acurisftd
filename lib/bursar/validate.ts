import type { InstitutionType } from "@/config/institution";
import { parseKwacha, type Checked } from "@/lib/cashier/validate";
import { enabledMethods } from "@/lib/cashier/methods";
import { addDays } from "@/lib/teacher/dates";
import { bursarTermsFor } from "@/lib/bursar/terms";
import { ACCOUNT_KINDS, type AccountKind, type MethodId } from "@/types/cashier";
import { FEE_BILLINGS, FEE_FREQUENCIES, REMINDER_CHANNELS, WAIVER_KINDS, type FeeItemInput, type FeeScope, type GenerateInput, type PlanInput, type RecordPaymentInput, type WaiverInput } from "@/types/bursar";

/** Checks shared by the Bursar's server actions (which must not trust the browser) and its forms. Pure, so they are easy to test. */

export type { Checked };
export const BURSAR_LIMITS = { name: 60, reason: 200, note: 200, fee: 1_000_000_00 };

export const clean = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max + 1) : "");

/** A real calendar date written "YYYY-MM-DD". */
export function isIsoDate(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

export type FeeEnv = { type: InstitutionType; groups: string[] };

type RawScope = { kind?: unknown; from?: unknown; to?: unknown; group?: unknown };
export type RawFee = { id?: unknown; name?: unknown; kind?: unknown; amount?: unknown; scope?: RawScope; frequency?: unknown; billing?: unknown; dueOn?: unknown; effectiveFrom?: unknown; active?: unknown };

const fail = (error: string, field: string, message = error): Checked<never> => ({ ok: false, error, fields: { [field]: message } });

function checkScope(raw: RawScope | undefined, env: FeeEnv): Checked<FeeScope> {
  const tertiary = bursarTermsFor(env.type).tertiary;
  if (!raw || raw.kind === "all") return { ok: true, value: { kind: "all" } };
  if (raw.kind === "grades") {
    if (tertiary) return fail("Fees at a college or university apply to everyone or to one programme.", "scope");
    const from = Number(raw.from);
    const to = Number(raw.to);
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to > 12 || from > to) return fail("Choose grades from 1 to 12, with the first no higher than the last.", "scope", "Choose a valid grade range.");
    return { ok: true, value: { kind: "grades", from, to } };
  }
  if (raw.kind === "group") {
    if (!tertiary) return fail("Fees at a school apply to everyone or to a range of grades.", "scope");
    const group = typeof raw.group === "string" ? raw.group : "";
    if (!env.groups.includes(group)) return fail("Choose one of the programmes on the school's roll.", "scope", "Choose a programme.");
    return { ok: true, value: { kind: "group", group } };
  }
  return fail("Choose who this fee applies to.", "scope", "Choose who it applies to.");
}

/**
 * A fee as typed. The amount is the kwacha as written ("2,600" or "350.50") and
 * is converted to ngwee here with no floating point.
 */
export function checkFeeItem(raw: RawFee, env: FeeEnv): Checked<FeeItemInput> {
  const name = clean(raw.name, BURSAR_LIMITS.name);
  if (name.length < 2) return fail("Give the fee a name.", "name", "Enter a name.");
  if (name.length > BURSAR_LIMITS.name) return fail(`The name can be at most ${BURSAR_LIMITS.name} characters.`, "name", `At most ${BURSAR_LIMITS.name} characters.`);

  const kinds = bursarTermsFor(env.type).accountKinds;
  const kind = ACCOUNT_KINDS.find((k): k is AccountKind => k === raw.kind && kinds.includes(k));
  if (!kind) return fail("Choose which account this fee is charged to.", "kind", "Choose an account.");

  const amount = parseKwacha(raw.amount);
  if (amount === undefined) return fail("Enter the fee in kwacha, for example 2600 or 350.50.", "amount", "Enter a valid amount.");
  if (amount > BURSAR_LIMITS.fee) return fail("That fee is too large.", "amount", "Too large.");

  const scope = checkScope(raw.scope, env);
  if (!scope.ok) return scope;

  const frequency = FEE_FREQUENCIES.find((f) => f === raw.frequency);
  if (!frequency) return fail("Choose how often it is charged.", "frequency", "Choose how often.");
  const billing = FEE_BILLINGS.find((b) => b === raw.billing);
  if (!billing) return fail("Choose whether it is charged to everyone it applies to or is optional.", "billing", "Choose one.");

  if (!isIsoDate(raw.effectiveFrom)) return fail("Enter the date this fee takes effect.", "effectiveFrom", "Enter a valid date.");
  if (!isIsoDate(raw.dueOn)) return fail("Enter the date invoices with this fee fall due.", "dueOn", "Enter a valid date.");
  if (raw.dueOn < raw.effectiveFrom) return fail("The due date cannot be before the fee takes effect.", "dueOn", "Not before the effective date.");

  const id = typeof raw.id === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(raw.id) ? raw.id : undefined;
  if (raw.id !== undefined && raw.id !== "" && !id) return fail("That fee is not available.", "id");
  return { ok: true, value: { ...(id ? { id } : {}), name, kind, amount, scope: scope.value, frequency, billing, dueOn: raw.dueOn, effectiveFrom: raw.effectiveFrom, active: raw.active !== false } };
}

/** A reason that is kept with a reversal, a decision or a cancellation, so the audit trail says why. */
export function checkReason(raw: unknown, what: string, required = true): Checked<string> {
  const reason = clean(raw, BURSAR_LIMITS.reason);
  if (required && !reason) return { ok: false, error: `Say why ${what}.`, fields: { reason: "A reason is required." } };
  if (reason.length > BURSAR_LIMITS.reason) return { ok: false, error: `The reason can be at most ${BURSAR_LIMITS.reason} characters.`, fields: { reason: `At most ${BURSAR_LIMITS.reason} characters.` } };
  return { ok: true, value: reason };
}

const STUDENT_NO = /^[A-Za-z0-9-]{1,40}$/;
const kindOf = (v: unknown, kinds: AccountKind[]) => ACCOUNT_KINDS.find((k): k is AccountKind => k === v && kinds.includes(k));

export type Allocate = { studentNo: string; account: AccountKind; amount: number };

/**
 * Part or all of an unallocated payment given to one student account. It cannot
 * be more than is left to allocate, or more than the account owes: money for a
 * student who owes nothing is an advance payment, which is not handled here.
 */
export function checkAllocation(raw: { studentNo?: unknown; account?: unknown; amount?: unknown }, ctx: { remaining: number; owed: Partial<Record<AccountKind, number>> }): Checked<Allocate> {
  const studentNo = typeof raw.studentNo === "string" ? raw.studentNo.trim() : "";
  if (!STUDENT_NO.test(studentNo)) return { ok: false, error: "Choose who this payment is for.", fields: { student: "Choose a student." } };
  const account = ACCOUNT_KINDS.find((k): k is AccountKind => k === raw.account && ctx.owed[k] !== undefined);
  if (!account) return { ok: false, error: "Choose an account to put it on.", fields: { account: "Choose an account." } };
  const amount = parseKwacha(raw.amount);
  if (amount === undefined) return { ok: false, error: "Enter the amount to allocate in kwacha, for example 650 or 650.50.", fields: { amount: "Enter a valid amount." } };
  if (amount > ctx.remaining) return { ok: false, error: "That is more than is left to allocate from this payment.", fields: { amount: "More than is left." } };
  const owed = ctx.owed[account] ?? 0;
  if (owed <= 0) return { ok: false, error: "Nothing is owed on that account.", fields: { account: "Nothing owed on this account." } };
  if (amount > owed) return { ok: false, error: "That is more than is owed on that account.", fields: { amount: "More than is owed." } };
  return { ok: true, value: { studentNo, account, amount } };
}

/** A bursary, waiver or discount request. It cannot be for more than the account owes. */
export function checkWaiver(raw: { studentNo?: unknown; kind?: unknown; account?: unknown; amount?: unknown; source?: unknown; reason?: unknown; requestedBy?: unknown }, ctx: { kinds: AccountKind[]; owed: Partial<Record<AccountKind, number>> }): Checked<WaiverInput> {
  const studentNo = typeof raw.studentNo === "string" ? raw.studentNo.trim() : "";
  if (!STUDENT_NO.test(studentNo)) return { ok: false, error: "Choose the student.", fields: { student: "Choose a student." } };
  const kind = WAIVER_KINDS.find((k) => k === raw.kind);
  if (!kind) return { ok: false, error: "Choose a bursary, waiver or discount.", fields: { kind: "Choose one." } };
  const account = kindOf(raw.account, ctx.kinds);
  if (!account) return { ok: false, error: "Choose which account it reduces.", fields: { account: "Choose an account." } };
  const amount = parseKwacha(raw.amount);
  if (amount === undefined) return { ok: false, error: "Enter the amount in kwacha, for example 500.", fields: { amount: "Enter a valid amount." } };
  const owed = ctx.owed[account] ?? 0;
  if (owed <= 0) return { ok: false, error: "Nothing is owed on that account.", fields: { account: "Nothing owed on this account." } };
  if (amount > owed) return { ok: false, error: "That is more than is owed on that account.", fields: { amount: "More than is owed." } };
  const source = clean(raw.source, BURSAR_LIMITS.name);
  if (!source) return { ok: false, error: kind === "bursary" ? "Say who funds the bursary." : "Say who is asking for it.", fields: { source: "Required." } };
  if (source.length > BURSAR_LIMITS.name) return { ok: false, error: `That can be at most ${BURSAR_LIMITS.name} characters.`, fields: { source: `At most ${BURSAR_LIMITS.name} characters.` } };
  const requestedBy = clean(raw.requestedBy, BURSAR_LIMITS.name);
  if (!requestedBy) return { ok: false, error: "Say who requested it.", fields: { requestedBy: "Required." } };
  if (requestedBy.length > BURSAR_LIMITS.name) return { ok: false, error: `That can be at most ${BURSAR_LIMITS.name} characters.`, fields: { requestedBy: `At most ${BURSAR_LIMITS.name} characters.` } };
  const reason = checkReason(raw.reason, "it is being given");
  if (!reason.ok) return reason;
  return { ok: true, value: { studentNo, kind, account, amount, source, reason: reason.value, requestedBy } };
}

/** Approving or declining a request. Declining needs a note so the person who asked knows why. */
export function checkDecision(decision: unknown, note: unknown): Checked<{ decision: "approve" | "decline"; note: string }> {
  if (decision !== "approve" && decision !== "decline") return { ok: false, error: "Choose approve or decline." };
  const n = checkReason(note, "it is being declined", decision === "decline");
  if (!n.ok) return n;
  return { ok: true, value: { decision, note: n.value } };
}

export type RecordContext = {
  owed: Partial<Record<AccountKind, number>>;
  today: string;
  /** References already on a payment or waiting in unallocated payments, lower case, mapped to where (for the message). */
  taken: Map<string, string>;
};

/** How far back a payment can be dated. Older than this is a correction for the books, not a payment. */
export const BACKDATE_DAYS = 120;

/**
 * A payment as the Bursar types it. Unlike the desk, the Bursar can record
 * bank deposits and back-date them to the day they arrived. It still cannot be
 * more than the account owes, a mobile money or bank payment needs a reference,
 * and a reference can only be used once, so the same deposit is not counted twice.
 */
export function checkRecordPayment(raw: { studentNo?: unknown; account?: unknown; method?: unknown; amount?: unknown; date?: unknown; reference?: unknown; note?: unknown }, ctx: RecordContext): Checked<RecordPaymentInput> {
  const studentNo = typeof raw.studentNo === "string" ? raw.studentNo.trim() : "";
  if (!STUDENT_NO.test(studentNo)) return { ok: false, error: "Choose who is paying.", fields: { student: "Choose a student." } };
  const account = ACCOUNT_KINDS.find((k): k is AccountKind => k === raw.account && ctx.owed[k] !== undefined);
  if (!account) return { ok: false, error: "Choose an account to pay into.", fields: { account: "Choose an account." } };
  const method = enabledMethods().find((m) => m.id === raw.method);
  if (!method) return { ok: false, error: "Choose how the money was paid.", fields: { method: "Choose a payment method." } };
  const amount = parseKwacha(raw.amount);
  if (amount === undefined) return { ok: false, error: "Enter the amount received in kwacha, for example 850 or 850.50.", fields: { amount: "Enter a valid amount." } };
  const owed = ctx.owed[account] ?? 0;
  if (owed <= 0) return { ok: false, error: "Nothing is owed on that account.", fields: { account: "Nothing owed on this account." } };
  if (amount > owed) return { ok: false, error: "That is more than is owed on that account. Advance payments are not handled here.", fields: { amount: "More than is owed." } };
  if (!isIsoDate(raw.date)) return { ok: false, error: "Enter the day the money was received.", fields: { date: "Enter a valid date." } };
  if (raw.date > ctx.today) return { ok: false, error: "A payment cannot be dated in the future.", fields: { date: "Not in the future." } };
  if (raw.date < addDays(ctx.today, -BACKDATE_DAYS)) return { ok: false, error: `A payment can be dated up to ${BACKDATE_DAYS} days back.`, fields: { date: `At most ${BACKDATE_DAYS} days back.` } };
  const reference = clean(raw.reference, BURSAR_LIMITS.name);
  if (reference.length > BURSAR_LIMITS.name) return { ok: false, error: `The reference can be at most ${BURSAR_LIMITS.name} characters.`, fields: { reference: `At most ${BURSAR_LIMITS.name} characters.` } };
  if (method.group !== "cash") {
    if (!reference) return { ok: false, error: "Enter the transaction or deposit reference.", fields: { reference: "Required for this method." } };
    const where = ctx.taken.get(reference.toLowerCase());
    if (where) return { ok: false, error: `That reference is already on ${where}.`, fields: { reference: `Already used on ${where}.` } };
  }
  const note = clean(raw.note, BURSAR_LIMITS.note);
  if (note.length > BURSAR_LIMITS.note) return { ok: false, error: `The note can be at most ${BURSAR_LIMITS.note} characters.`, fields: { note: `At most ${BURSAR_LIMITS.note} characters.` } };
  return { ok: true, value: { studentNo, account, method: method.id, amount, date: raw.date, reference: method.group === "cash" ? "" : reference, note } };
}

/** A period name such as "Term 1 2027". */
export const PERIOD_MAX = 40;

/**
 * An invoice run: a name for the period, when it falls due, whether once-a-year
 * fees go on it, and which classes (none chosen means all). The due date cannot
 * already have passed, or every invoice would be overdue the day it is made.
 */
export function checkGenerate(raw: { period?: unknown; dueOn?: unknown; includeAnnual?: unknown; groups?: unknown }, env: { groups: string[]; today: string }): Checked<GenerateInput> {
  const period = clean(raw.period, PERIOD_MAX);
  if (period.length < 3) return { ok: false, error: "Name the period, for example Term 1 2027.", fields: { period: "Enter a period." } };
  if (period.length > PERIOD_MAX) return { ok: false, error: `The period can be at most ${PERIOD_MAX} characters.`, fields: { period: `At most ${PERIOD_MAX} characters.` } };
  if (!isIsoDate(raw.dueOn)) return { ok: false, error: "Enter the date the invoices fall due.", fields: { dueOn: "Enter a valid date." } };
  if (raw.dueOn < env.today) return { ok: false, error: "The due date cannot be in the past.", fields: { dueOn: "Not in the past." } };
  if (raw.groups !== undefined && !Array.isArray(raw.groups)) return { ok: false, error: "Choose classes from the list.", fields: { groups: "Choose from the list." } };
  const groups = (raw.groups as unknown[] | undefined) ?? [];
  if (groups.some((g) => typeof g !== "string" || !env.groups.includes(g))) return { ok: false, error: "One of those classes is not on the school's roll.", fields: { groups: "Choose from the list." } };
  return { ok: true, value: { period, dueOn: raw.dueOn, includeAnnual: raw.includeAnnual === true, groups: [...new Set(groups as string[])] } };
}

export type ChargeInput = { studentNo: string; feeId: string; period: string; dueOn: string };

/** Adding one fee, usually an optional one such as hostel or transport, to one student. */
export function checkCharge(raw: { studentNo?: unknown; feeId?: unknown; period?: unknown; dueOn?: unknown }, env: { today: string }): Checked<ChargeInput> {
  const studentNo = typeof raw.studentNo === "string" ? raw.studentNo.trim() : "";
  if (!STUDENT_NO.test(studentNo)) return { ok: false, error: "Choose the student.", fields: { student: "Choose a student." } };
  const feeId = typeof raw.feeId === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(raw.feeId) ? raw.feeId : "";
  if (!feeId) return { ok: false, error: "Choose the fee to charge.", fields: { fee: "Choose a fee." } };
  const period = clean(raw.period, PERIOD_MAX);
  if (period.length < 3 || period.length > PERIOD_MAX) return { ok: false, error: "Name the period, for example Term 1 2027.", fields: { period: "Enter a period." } };
  if (!isIsoDate(raw.dueOn)) return { ok: false, error: "Enter the date it falls due.", fields: { dueOn: "Enter a valid date." } };
  if (raw.dueOn < env.today) return { ok: false, error: "The due date cannot be in the past.", fields: { dueOn: "Not in the past." } };
  return { ok: true, value: { studentNo, feeId, period, dueOn: raw.dueOn } };
}

export const PLAN_COUNTS = { min: 2, max: 12 };
/** How far ahead the first instalment can be. */
export const PLAN_START_DAYS = 90;

/**
 * A payment plan for what a student owes: equal monthly instalments, from two
 * to twelve, the first no earlier than today and no more than 90 days ahead.
 * The student must owe something, and one plan at a time.
 */
export function checkPlan(raw: { studentNo?: unknown; count?: unknown; firstDueOn?: unknown; note?: unknown }, env: { owed: number; today: string; hasActivePlan: boolean }): Checked<PlanInput> {
  const studentNo = typeof raw.studentNo === "string" ? raw.studentNo.trim() : "";
  if (!STUDENT_NO.test(studentNo)) return { ok: false, error: "Choose the student.", fields: { student: "Choose a student." } };
  if (env.owed <= 0) return { ok: false, error: "That student owes nothing, so there is nothing to put on a plan.", fields: { student: "Owes nothing." } };
  if (env.hasActivePlan) return { ok: false, error: "That student already has an active plan. Cancel it first to agree a new one.", fields: { student: "Already on a plan." } };
  const count = typeof raw.count === "number" ? raw.count : Number(raw.count);
  if (!Number.isInteger(count) || count < PLAN_COUNTS.min || count > PLAN_COUNTS.max) return { ok: false, error: `Choose ${PLAN_COUNTS.min} to ${PLAN_COUNTS.max} instalments.`, fields: { count: `${PLAN_COUNTS.min} to ${PLAN_COUNTS.max}.` } };
  if (count > env.owed) return { ok: false, error: "There are not enough ngwee owed to split that many ways.", fields: { count: "Too many instalments." } };
  if (!isIsoDate(raw.firstDueOn)) return { ok: false, error: "Enter the date of the first instalment.", fields: { firstDueOn: "Enter a valid date." } };
  if (raw.firstDueOn < env.today) return { ok: false, error: "The first instalment cannot be in the past.", fields: { firstDueOn: "Not in the past." } };
  if (raw.firstDueOn > addDays(env.today, PLAN_START_DAYS)) return { ok: false, error: `The first instalment must be within ${PLAN_START_DAYS} days.`, fields: { firstDueOn: `Within ${PLAN_START_DAYS} days.` } };
  const note = clean(raw.note, BURSAR_LIMITS.note);
  if (note.length > BURSAR_LIMITS.note) return { ok: false, error: `The note can be at most ${BURSAR_LIMITS.note} characters.`, fields: { note: `At most ${BURSAR_LIMITS.note} characters.` } };
  return { ok: true, value: { studentNo, count, firstDueOn: raw.firstDueOn, note } };
}

export function checkReminder(raw: { studentNo?: unknown; channel?: unknown; note?: unknown }): Checked<{ studentNo: string; channel: (typeof REMINDER_CHANNELS)[number]; note: string }> {
  const studentNo = typeof raw.studentNo === "string" ? raw.studentNo.trim() : "";
  if (!STUDENT_NO.test(studentNo)) return { ok: false, error: "Choose the student.", fields: { student: "Choose a student." } };
  const channel = REMINDER_CHANNELS.find((c) => c === raw.channel);
  if (!channel) return { ok: false, error: "Choose how they were contacted.", fields: { channel: "Choose one." } };
  const note = clean(raw.note, BURSAR_LIMITS.note);
  if (note.length > BURSAR_LIMITS.note) return { ok: false, error: `The note can be at most ${BURSAR_LIMITS.note} characters.`, fields: { note: `At most ${BURSAR_LIMITS.note} characters.` } };
  return { ok: true, value: { studentNo, channel, note } };
}

export type ReviewInput = { date: string; cashier: string; status: "verified" | "queried"; note: string };

/** Signing off a cash-up, or querying it. A query must say what is wrong. */
export function checkCashUpReview(raw: { date?: unknown; cashier?: unknown; status?: unknown; note?: unknown }): Checked<ReviewInput> {
  if (!isIsoDate(raw.date)) return { ok: false, error: "Choose the cash-up.", fields: { date: "Choose a cash-up." } };
  const cashier = clean(raw.cashier, BURSAR_LIMITS.name);
  if (!cashier || cashier.length > BURSAR_LIMITS.name) return { ok: false, error: "Choose the cash-up.", fields: { cashier: "Choose a cash-up." } };
  const status = raw.status === "verified" || raw.status === "queried" ? raw.status : undefined;
  if (!status) return { ok: false, error: "Choose verify or query.", fields: { status: "Choose one." } };
  const note = clean(raw.note, BURSAR_LIMITS.note);
  if (status === "queried" && !note) return { ok: false, error: "Say what needs explaining.", fields: { note: "A note is required to query a cash-up." } };
  if (note.length > BURSAR_LIMITS.note) return { ok: false, error: `The note can be at most ${BURSAR_LIMITS.note} characters.`, fields: { note: `At most ${BURSAR_LIMITS.note} characters.` } };
  return { ok: true, value: { date: raw.date, cashier, status, note } };
}

const TARGET_KINDS = ["payment", "unallocated"] as const;
const REF_ID = /^[A-Za-z0-9_-]{1,80}$/;

export function checkMatchTarget(raw: { kind?: unknown; id?: unknown }): Checked<{ kind: (typeof TARGET_KINDS)[number]; id: string }> {
  const kind = TARGET_KINDS.find((k) => k === raw.kind);
  if (!kind || typeof raw.id !== "string" || !REF_ID.test(raw.id)) return { ok: false, error: "Choose the payment to match." };
  return { ok: true, value: { kind, id: raw.id } };
}

/** Taking a deposit that matches nothing in as an unallocated payment, so it can be allocated to a student. */
export function checkReceiveLine(raw: { method?: unknown; payer?: unknown }): Checked<{ method: MethodId; payer: string }> {
  const method = enabledMethods().find((m) => m.id === raw.method && m.group !== "cash");
  if (!method) return { ok: false, error: "Choose whether it came by bank or mobile money.", fields: { method: "Choose one." } };
  const payer = clean(raw.payer, BURSAR_LIMITS.name);
  if (payer.length > BURSAR_LIMITS.name) return { ok: false, error: `That can be at most ${BURSAR_LIMITS.name} characters.`, fields: { payer: `At most ${BURSAR_LIMITS.name} characters.` } };
  return { ok: true, value: { method: method.id, payer } };
}
