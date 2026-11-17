"use server";

import { revalidatePath } from "next/cache";
import { checkCashUp, checkPayment, checkVoidReason, parseKwacha } from "@/lib/cashier/validate";
import { METHOD_LABELS } from "@/lib/cashier/methods";
import { formatKwacha } from "@/lib/money";
import type { Outcome } from "@/types/cashier";
import { audit, cashier } from "../repositories";
import { getCashierSession } from "../cashier-context";

/**
 * Cashier actions. Each one re-checks everything on the server: the browser is
 * only trusted for the values typed. Receipt and student ids are always resolved
 * against the signed-in cashier's own ledger by the repository, so another
 * cashier's records cannot be reached by changing an id. Every change is audited.
 */

const ID = /^[A-Za-z0-9_-]{1,80}$/;
const bad = (error: string): ActionResult => ({ ok: false, error });
const refresh = () => revalidatePath("/cashier", "layout");

export type ActionResult = Outcome & { fields?: Record<string, string> };

/** Takes a payment. `amount` is the kwacha as typed; it is converted to ngwee here. */
export async function collectPayment(raw: { studentNo: unknown; account: unknown; method: unknown; amount: unknown; reference: unknown; note: unknown }): Promise<ActionResult> {
  const { ctx, schoolName } = await getCashierSession();
  const body = raw ?? ({} as typeof raw);
  const studentNo = typeof body.studentNo === "string" ? body.studentNo : "";
  if (!/^[A-Za-z0-9-]{1,40}$/.test(studentNo)) return { ok: false, error: "Choose who is paying.", fields: { student: "Choose a student." } };
  const student = (await cashier.listStudents(ctx)).find((s) => s.no === studentNo);
  if (!student) return { ok: false, error: "That student is not in this school's records.", fields: { student: "Not found." } };

  const amount = parseKwacha(body.amount);
  if (amount === undefined) return { ok: false, error: "Enter the amount received in kwacha, for example 850 or 850.50.", fields: { amount: "Enter a valid amount." } };
  const owed = Object.fromEntries(student.lines.filter((l) => l.owed > 0).map((l) => [l.kind, l.owed]));
  const checked = checkPayment({ ...body, studentNo, amount }, { owed });
  if (!checked.ok) return { ok: false, error: checked.error, fields: checked.fields };

  const r = await cashier.recordPayment(ctx, checked.value, new Date().toISOString());
  if (!r.ok) return r;
  audit.record({ user: ctx.cashierName, action: "Payment taken", entity: `${student.no} ${formatKwacha(checked.value.amount)} ${METHOD_LABELS[checked.value.method]}`, scope: ctx.tenantId, school: schoolName });
  refresh();
  return r;
}

export async function confirmPayment(receiptId: unknown): Promise<ActionResult> {
  const { ctx, schoolName } = await getCashierSession();
  if (typeof receiptId !== "string" || !ID.test(receiptId)) return bad("That receipt is not available.");
  const r = await cashier.confirmReceipt(ctx, receiptId, new Date().toISOString());
  if (r.ok) {
    audit.record({ user: ctx.cashierName, action: "Payment confirmed", entity: `Receipt ${receiptId}`, scope: ctx.tenantId, school: schoolName });
    refresh();
  }
  return r;
}

/** Voids one of today's receipts. A reason is required and kept in the audit trail. */
export async function voidPayment(receiptId: unknown, reason: unknown): Promise<ActionResult> {
  const { ctx, schoolName } = await getCashierSession();
  if (typeof receiptId !== "string" || !ID.test(receiptId)) return bad("That receipt is not available.");
  const checked = checkVoidReason(reason);
  if (!checked.ok) return { ok: false, error: checked.error, fields: checked.fields };
  const r = await cashier.voidReceipt(ctx, receiptId, checked.value, new Date().toISOString());
  if (r.ok) {
    audit.record({ user: ctx.cashierName, action: "Receipt voided", entity: `Receipt ${receiptId}: ${checked.value}`, scope: ctx.tenantId, school: schoolName });
    refresh();
  }
  return r;
}

/** Submits today's cash-up from the counted notes and coins. This locks the day. */
export async function submitCashUp(raw: { counts: unknown; reason: unknown }): Promise<ActionResult> {
  const { ctx, schoolName } = await getCashierSession();
  const today = await cashier.getDay(ctx, ctx.today);
  const checked = checkCashUp(raw ?? {}, today.expectedCash);
  if (!checked.ok) return { ok: false, error: checked.error, fields: checked.fields };
  const r = await cashier.submitCashUp(ctx, { counts: checked.value.counts, reason: checked.value.reason }, new Date().toISOString());
  if (r.ok) {
    const v = checked.value.variance;
    audit.record({ user: ctx.cashierName, action: "Cash-up submitted", entity: `${ctx.today}: counted ${formatKwacha(checked.value.counted)}, ${v === 0 ? "no difference" : `${v > 0 ? "over" : "short"} ${formatKwacha(Math.abs(v))}`}`, scope: ctx.tenantId, school: schoolName });
    refresh();
  }
  return r;
}
