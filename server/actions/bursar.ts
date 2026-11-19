"use server";

import { revalidatePath } from "next/cache";
import { checkAllocation, checkCharge, checkDecision, checkFeeItem, checkCashUpReview, checkGenerate, checkMatchTarget, checkPlan, checkReason, checkReceiveLine, checkReminder, checkRecordPayment, checkWaiver, type RawFee } from "@/lib/bursar/validate";
import { scopeLabel } from "@/lib/bursar/fees";
import { MAX_STATEMENT_LINES, parseStatement } from "@/lib/bursar/reconcile";
import { formatKwacha } from "@/lib/money";
import { METHOD_LABELS } from "@/lib/cashier/methods";
import type { AccountKind, Outcome, Payment, Statement } from "@/types/bursar";
import { audit, bursar } from "../repositories";
import { getBursarSession } from "../bursar-context";

/**
 * Bursar actions. Each one re-checks everything on the server: the browser is
 * only trusted for the values typed. Ids are always resolved against the
 * signed-in bursar's own school by the repository, so another school's records
 * cannot be reached by changing an id. Every change is audited.
 */

const ID = /^[A-Za-z0-9_-]{1,80}$/;
const bad = (error: string): ActionResult => ({ ok: false, error });
const refresh = () => revalidatePath("/bursar", "layout");

export type ActionResult = Outcome & { fields?: Record<string, string> };

/** Adds a fee to the structure, or changes one. `amount` is the kwacha as typed. */
export async function saveFee(raw: RawFee): Promise<ActionResult> {
  const { ctx, schoolName } = await getBursarSession();
  const groups = await bursar.listGroups(ctx);
  const checked = checkFeeItem(raw ?? {}, { type: ctx.institutionType, groups });
  if (!checked.ok) return { ok: false, error: checked.error, fields: checked.fields };
  const r = await bursar.saveFee(ctx, checked.value, new Date().toISOString());
  if (!r.ok) return r;
  const f = checked.value;
  audit.record({ user: ctx.bursarName, action: f.id ? "Fee changed" : "Fee added", entity: `${f.name} (${scopeLabel(f.scope)}) ${formatKwacha(f.amount)}`, scope: ctx.tenantId, school: schoolName });
  refresh();
  return r;
}

/** Turns a fee on or off. Fees are never deleted, so earlier invoices keep their meaning. */
export async function setFeeActive(id: unknown, active: unknown): Promise<ActionResult> {
  const { ctx, schoolName } = await getBursarSession();
  if (typeof id !== "string" || !ID.test(id)) return bad("That fee is not available.");
  if (typeof active !== "boolean") return bad("Choose on or off.");
  const fee = (await bursar.listFees(ctx)).find((f) => f.id === id);
  const r = await bursar.setFeeActive(ctx, id, active, new Date().toISOString());
  if (r.ok && fee) {
    audit.record({ user: ctx.bursarName, action: active ? "Fee turned on" : "Fee turned off", entity: `${fee.name} (${scopeLabel(fee.scope)})`, scope: ctx.tenantId, school: schoolName });
    refresh();
  }
  return r;
}

const owedByKind = async (ctx: Parameters<typeof bursar.listAccounts>[0], studentNo: string) => {
  const row = (await bursar.listAccounts(ctx)).find((a) => a.no === studentNo);
  return Object.fromEntries((row?.lines ?? []).map((l) => [l.kind, l.owed])) as Partial<Record<AccountKind, number>>;
};

/** One student's statement for the Bursar's own school, or null. A read, but it goes through the session like everything else. */
export async function loadStatement(studentNo: unknown): Promise<Statement | null> {
  const { ctx } = await getBursarSession();
  if (typeof studentNo !== "string" || !/^[A-Za-z0-9-]{1,40}$/.test(studentNo)) return null;
  return (await bursar.getStatement(ctx, studentNo)) ?? null;
}

/** Reverses a payment (the desk's or the Bursar's) with a required reason. The payment stays listed. */
export async function reversePayment(id: unknown, reason: unknown): Promise<ActionResult> {
  const { ctx, schoolName } = await getBursarSession();
  if (typeof id !== "string" || !ID.test(id)) return bad("That payment is not available.");
  const why = checkReason(reason, "this payment is being reversed");
  if (!why.ok) return { ok: false, error: why.error, fields: why.fields };
  const p = (await bursar.listPayments(ctx)).find((x) => x.id === id);
  const r = await bursar.reversePayment(ctx, id, why.value, new Date().toISOString());
  if (r.ok && p) {
    audit.record({ user: ctx.bursarName, action: "Payment reversed", entity: `${p.no}, ${p.studentName}, ${formatKwacha(p.amount)}: ${why.value}`, scope: ctx.tenantId, school: schoolName });
    refresh();
  }
  return r;
}

/** Gives all or part of an unallocated payment to one student's account. */
export async function allocatePayment(id: unknown, raw: { studentNo?: unknown; account?: unknown; amount?: unknown }): Promise<ActionResult> {
  const { ctx, schoolName } = await getBursarSession();
  if (typeof id !== "string" || !ID.test(id)) return bad("That payment is not available.");
  const u = (await bursar.listUnallocated(ctx)).find((x) => x.id === id);
  if (!u || u.status !== "open") return bad("That payment is not waiting to be allocated.");
  const studentNo = typeof raw?.studentNo === "string" ? raw.studentNo.trim() : "";
  const checked = checkAllocation(raw ?? {}, { remaining: u.remaining, owed: await owedByKind(ctx, studentNo) });
  if (!checked.ok) return { ok: false, error: checked.error, fields: checked.fields };
  const r = await bursar.allocatePayment(ctx, id, checked.value, new Date().toISOString());
  if (r.ok) {
    audit.record({ user: ctx.bursarName, action: "Payment allocated", entity: `${u.no} ${formatKwacha(checked.value.amount)} to ${checked.value.studentNo}`, scope: ctx.tenantId, school: schoolName });
    refresh();
  }
  return r;
}

/** Records a bursary, waiver or discount request. Nothing changes on the account until it is approved. */
export async function requestWaiver(raw: { studentNo?: unknown; kind?: unknown; account?: unknown; amount?: unknown; source?: unknown; reason?: unknown; requestedBy?: unknown }): Promise<ActionResult> {
  const { ctx, terms, schoolName } = await getBursarSession();
  const studentNo = typeof raw?.studentNo === "string" ? raw.studentNo.trim() : "";
  const checked = checkWaiver(raw ?? {}, { kinds: terms.accountKinds, owed: await owedByKind(ctx, studentNo) });
  if (!checked.ok) return { ok: false, error: checked.error, fields: checked.fields };
  const r = await bursar.requestWaiver(ctx, checked.value, new Date().toISOString());
  if (r.ok) {
    audit.record({ user: ctx.bursarName, action: "Waiver requested", entity: `${checked.value.kind} ${formatKwacha(checked.value.amount)} for ${checked.value.studentNo}`, scope: ctx.tenantId, school: schoolName });
    refresh();
  }
  return r;
}

/** Approves or declines a pending request. Approving takes the amount off the account. */
export async function decideWaiver(id: unknown, decision: unknown, note: unknown): Promise<ActionResult> {
  const { ctx, schoolName } = await getBursarSession();
  if (typeof id !== "string" || !ID.test(id)) return bad("That request is not available.");
  const checked = checkDecision(decision, note);
  if (!checked.ok) return { ok: false, error: checked.error, fields: "fields" in checked ? checked.fields : undefined };
  const w = (await bursar.listWaivers(ctx)).find((x) => x.id === id);
  const r = await bursar.decideWaiver(ctx, id, checked.value.decision, checked.value.note, new Date().toISOString());
  if (r.ok && w) {
    audit.record({ user: ctx.bursarName, action: checked.value.decision === "approve" ? "Waiver approved" : "Waiver declined", entity: `${w.no}, ${w.studentName}, ${formatKwacha(w.amount)}${checked.value.note ? `: ${checked.value.note}` : ""}`, scope: ctx.tenantId, school: schoolName });
    refresh();
  }
  return r;
}

export type RecordResult = ActionResult & { payment?: Payment };

/** Records a payment the Bursar received. Returns the payment so its receipt can be shown at once. */
export async function recordPayment(raw: { studentNo?: unknown; account?: unknown; method?: unknown; amount?: unknown; date?: unknown; reference?: unknown; note?: unknown }): Promise<RecordResult> {
  const { ctx, schoolName } = await getBursarSession();
  const studentNo = typeof raw?.studentNo === "string" ? raw.studentNo.trim() : "";
  const [owed, existing, waiting] = await Promise.all([owedByKind(ctx, studentNo), bursar.listPayments(ctx), bursar.listUnallocated(ctx)]);
  const taken = new Map<string, string>();
  for (const u of waiting) if (u.status === "open") taken.set(u.reference.toLowerCase(), `unallocated payment ${u.no}`);
  for (const p of existing) if (p.reference && p.status !== "reversed") taken.set(p.reference.toLowerCase(), p.no);
  const checked = checkRecordPayment(raw ?? {}, { owed, today: ctx.today, taken });
  if (!checked.ok) return { ok: false, error: checked.error, fields: checked.fields };
  const r = await bursar.recordPayment(ctx, checked.value, new Date().toISOString());
  if (!r.ok) return r;
  const payment = (await bursar.listPayments(ctx)).find((p) => p.id === r.id);
  audit.record({ user: ctx.bursarName, action: "Payment recorded", entity: `${payment?.no ?? r.id}, ${formatKwacha(checked.value.amount)} via ${METHOD_LABELS[checked.value.method]} for ${checked.value.studentNo}`, scope: ctx.tenantId, school: schoolName });
  refresh();
  return { ...r, payment };
}

export type GenerateActionResult = { ok: true; created: number; total: number; skipped: number } | { ok: false; error: string; fields?: Record<string, string> };

/** Makes the period's invoices from the fee structure. Anyone already invoiced for that period is skipped. */
export async function generateInvoices(raw: { period?: unknown; dueOn?: unknown; includeAnnual?: unknown; groups?: unknown }): Promise<GenerateActionResult> {
  const { ctx, schoolName } = await getBursarSession();
  const checked = checkGenerate(raw ?? {}, { groups: await bursar.listGroups(ctx), today: ctx.today });
  if (!checked.ok) return { ok: false, error: checked.error, fields: checked.fields };
  const r = await bursar.generateInvoices(ctx, checked.value, new Date().toISOString());
  if (r.ok) {
    audit.record({ user: ctx.bursarName, action: "Invoices generated", entity: `${checked.value.period}: ${r.created} invoices, ${formatKwacha(r.total)}`, scope: ctx.tenantId, school: schoolName });
    refresh();
  }
  return r;
}

/** Adds one fee to one student for a period. */
export async function chargeFee(raw: { studentNo?: unknown; feeId?: unknown; period?: unknown; dueOn?: unknown }): Promise<ActionResult> {
  const { ctx, schoolName } = await getBursarSession();
  const checked = checkCharge(raw ?? {}, { today: ctx.today });
  if (!checked.ok) return { ok: false, error: checked.error, fields: checked.fields };
  const r = await bursar.chargeFee(ctx, checked.value, new Date().toISOString());
  if (r.ok) {
    audit.record({ user: ctx.bursarName, action: "Fee charged", entity: `${checked.value.feeId} to ${checked.value.studentNo} for ${checked.value.period}`, scope: ctx.tenantId, school: schoolName });
    refresh();
  }
  return r;
}

/** Cancels an unpaid invoice with a reason. It stays on the record. */
export async function cancelInvoice(id: unknown, reason: unknown): Promise<ActionResult> {
  const { ctx, schoolName } = await getBursarSession();
  if (typeof id !== "string" || !ID.test(id)) return bad("That invoice is not available.");
  const why = checkReason(reason, "this invoice is being cancelled");
  if (!why.ok) return { ok: false, error: why.error, fields: why.fields };
  const inv = (await bursar.listInvoices(ctx)).find((i) => i.id === id);
  const r = await bursar.cancelInvoice(ctx, id, why.value, new Date().toISOString());
  if (r.ok && inv) {
    audit.record({ user: ctx.bursarName, action: "Invoice cancelled", entity: `${inv.no}, ${formatKwacha(inv.total)}: ${why.value}`, scope: ctx.tenantId, school: schoolName });
    refresh();
  }
  return r;
}

/** Agrees a payment plan for what a student owes. The first due date and the split are worked out on the server. */
export async function createPlan(raw: { studentNo?: unknown; count?: unknown; firstDueOn?: unknown; note?: unknown }): Promise<ActionResult> {
  const { ctx, schoolName } = await getBursarSession();
  const studentNo = typeof raw?.studentNo === "string" ? raw.studentNo.trim() : "";
  const row = (await bursar.listAccounts(ctx)).find((a) => a.no === studentNo);
  const hasActivePlan = (await bursar.listPlans(ctx)).some((p) => p.studentNo === studentNo && p.status === "active");
  const checked = checkPlan(raw ?? {}, { owed: row?.owed ?? 0, today: ctx.today, hasActivePlan });
  if (!checked.ok) return { ok: false, error: checked.error, fields: checked.fields };
  const r = await bursar.createPlan(ctx, checked.value, new Date().toISOString());
  if (!r.ok) return r;
  audit.record({ user: ctx.bursarName, action: "Payment plan agreed", entity: `${row?.name ?? studentNo} (${studentNo}) ${checked.value.count} instalments of ${formatKwacha(row?.owed ?? 0)} owed`, scope: ctx.tenantId, school: schoolName });
  refresh();
  return r;
}

/** Ends a plan. A reason is required; the plan stays on the record. */
export async function cancelPlan(planId: unknown, reason: unknown): Promise<ActionResult> {
  const { ctx, schoolName } = await getBursarSession();
  if (typeof planId !== "string" || !ID.test(planId)) return bad("That plan is not available.");
  const why = checkReason(reason, "the plan is being cancelled");
  if (!why.ok) return { ok: false, error: why.error, fields: why.fields };
  const plan = (await bursar.listPlans(ctx)).find((p) => p.id === planId);
  const r = await bursar.cancelPlan(ctx, planId, why.value, new Date().toISOString());
  if (r.ok) {
    audit.record({ user: ctx.bursarName, action: "Payment plan cancelled", entity: `${plan?.studentNo ?? planId}: ${why.value}`, scope: ctx.tenantId, school: schoolName });
    refresh();
  }
  return r;
}

/** Records that a debtor was chased. Nothing is sent from here. */
export async function recordReminder(raw: { studentNo?: unknown; channel?: unknown; note?: unknown }): Promise<ActionResult> {
  const { ctx, schoolName } = await getBursarSession();
  const checked = checkReminder(raw ?? {});
  if (!checked.ok) return { ok: false, error: checked.error, fields: checked.fields };
  const r = await bursar.recordReminder(ctx, checked.value, new Date().toISOString());
  if (r.ok) {
    audit.record({ user: ctx.bursarName, action: "Reminder recorded", entity: `${checked.value.studentNo} by ${checked.value.channel}`, scope: ctx.tenantId, school: schoolName });
    refresh();
  }
  return r;
}

/** Verifies a cashier's cash-up, or queries it. */
export async function reviewCashUp(raw: { date?: unknown; cashier?: unknown; status?: unknown; note?: unknown }): Promise<ActionResult> {
  const { ctx, schoolName } = await getBursarSession();
  const checked = checkCashUpReview(raw ?? {});
  if (!checked.ok) return { ok: false, error: checked.error, fields: checked.fields };
  const r = await bursar.reviewCashUp(ctx, checked.value, new Date().toISOString());
  if (r.ok) {
    audit.record({ user: ctx.bursarName, action: checked.value.status === "verified" ? "Cash-up verified" : "Cash-up queried", entity: `${checked.value.cashier}, ${checked.value.date}${checked.value.note ? `: ${checked.value.note}` : ""}`, scope: ctx.tenantId, school: schoolName });
    refresh();
  }
  return r;
}

export type ImportActionResult = { ok: true; added: number; duplicates: number; skipped: number } | { ok: false; error: string };

/** Adds pasted statement lines. Lines that cannot be read are reported and left out; the rest are added. */
export async function importBankLines(text: unknown): Promise<ImportActionResult> {
  const { ctx, schoolName } = await getBursarSession();
  if (typeof text !== "string" || !text.trim()) return { ok: false, error: "Paste the statement lines first." };
  if (text.length > 60_000) return { ok: false, error: "That is too much to add at once." };
  const parsed = parseStatement(text, ctx.today);
  if (parsed.lines.length === 0) return { ok: false, error: parsed.errors[0] ? `Row ${parsed.errors[0].row}: ${parsed.errors[0].message}` : "There are no lines to add." };
  const r = await bursar.importBankLines(ctx, parsed.lines.slice(0, MAX_STATEMENT_LINES), new Date().toISOString());
  if (!r.ok) return r;
  audit.record({ user: ctx.bursarName, action: "Statement lines added", entity: `${r.added} added, ${r.duplicates} already loaded, ${parsed.errors.length} unreadable`, scope: ctx.tenantId, school: schoolName });
  refresh();
  return { ok: true, added: r.added, duplicates: r.duplicates, skipped: parsed.errors.length };
}

/** Matches a statement line by hand to a payment or deposit for the same amount. */
export async function matchBankLine(lineId: unknown, target: { kind?: unknown; id?: unknown }): Promise<ActionResult> {
  const { ctx, schoolName } = await getBursarSession();
  if (typeof lineId !== "string" || !ID.test(lineId)) return bad("That statement line is not available.");
  const t = checkMatchTarget(target ?? {});
  if (!t.ok) return bad(t.error);
  const r = await bursar.matchBankLine(ctx, lineId, t.value, new Date().toISOString());
  if (r.ok) {
    audit.record({ user: ctx.bursarName, action: "Statement line matched", entity: `${lineId} to ${t.value.kind} ${t.value.id}`, scope: ctx.tenantId, school: schoolName });
    refresh();
  }
  return r;
}

/** Sets a statement line aside, with a reason. */
export async function ignoreBankLine(lineId: unknown, reason: unknown): Promise<ActionResult> {
  const { ctx, schoolName } = await getBursarSession();
  if (typeof lineId !== "string" || !ID.test(lineId)) return bad("That statement line is not available.");
  const why = checkReason(reason, "the line is being set aside");
  if (!why.ok) return { ok: false, error: why.error, fields: why.fields };
  const r = await bursar.ignoreBankLine(ctx, lineId, why.value, new Date().toISOString());
  if (r.ok) {
    audit.record({ user: ctx.bursarName, action: "Statement line set aside", entity: `${lineId}: ${why.value}`, scope: ctx.tenantId, school: schoolName });
    refresh();
  }
  return r;
}

/** Puts a set-aside line back, or removes a hand match. */
export async function restoreBankLine(lineId: unknown): Promise<ActionResult> {
  const { ctx, schoolName } = await getBursarSession();
  if (typeof lineId !== "string" || !ID.test(lineId)) return bad("That statement line is not available.");
  const r = await bursar.restoreBankLine(ctx, lineId);
  if (r.ok) {
    audit.record({ user: ctx.bursarName, action: "Statement line restored", entity: lineId, scope: ctx.tenantId, school: schoolName });
    refresh();
  }
  return r;
}

/** Takes a deposit that matches nothing in as an unallocated payment. */
export async function receiveBankLine(lineId: unknown, raw: { method?: unknown; payer?: unknown }): Promise<ActionResult> {
  const { ctx, schoolName } = await getBursarSession();
  if (typeof lineId !== "string" || !ID.test(lineId)) return bad("That statement line is not available.");
  const checked = checkReceiveLine(raw ?? {});
  if (!checked.ok) return { ok: false, error: checked.error, fields: checked.fields };
  const r = await bursar.receiveBankLine(ctx, lineId, checked.value);
  if (r.ok) {
    audit.record({ user: ctx.bursarName, action: "Deposit taken in as unallocated", entity: `${lineId} as ${r.id}`, scope: ctx.tenantId, school: schoolName });
    refresh();
  }
  return r;
}
