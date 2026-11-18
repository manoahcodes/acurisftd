"use server";

import { revalidatePath } from "next/cache";
import { checkFeeItem, type RawFee } from "@/lib/bursar/validate";
import { scopeLabel } from "@/lib/bursar/fees";
import { formatKwacha } from "@/lib/money";
import type { Outcome } from "@/types/bursar";
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
