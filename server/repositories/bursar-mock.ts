import { groupsFor, sameScope, seedFeeItems } from "@/lib/bursar/fees";
import { studentsFor } from "@/lib/cashier/seed";
import type { FeeItem } from "@/types/bursar";
import { loadSnapshot, saveSnapshot } from "../persistence/store";
import type { BursarContext, BursarRepository } from "./bursar-types";
import { positionOf, resetLedger, type LedgerScope } from "./ledger-store";

/**
 * Bursar data per school, kept in memory and saved to the SQLite file like the
 * other mocks. What each student owes lives in the shared ledger (./ledger-store);
 * this file keeps the Bursar's own records: the fee structure and, as the pages
 * are built, invoices, adjustments and reconciliation.
 */
type State = {
  fees: FeeItem[];
  nextFee: number;
};

const g = globalThis as unknown as { __acurisBursar?: Map<string, State> };
const KEY = "bursar";
const data = (g.__acurisBursar ??= new Map<string, State>(loadSnapshot<Array<[string, State]>>(KEY) ?? []));
const save = () => saveSnapshot(KEY, [...data]);

const scopeOf = (c: BursarContext) => `${c.tenantId}:${c.institutionType}`;
const ledgerOf = (c: BursarContext): LedgerScope => ({ tenantId: c.tenantId, institutionType: c.institutionType });
const bad = (error: string) => ({ ok: false as const, error });

function stateOf(ctx: BursarContext): State {
  let s = data.get(scopeOf(ctx));
  if (!s) {
    const fees = seedFeeItems(ctx.institutionType);
    s = { fees, nextFee: 100 };
    data.set(scopeOf(ctx), s);
    save();
  }
  return s;
}

export const mockBursarRepository: BursarRepository = {
  async balanceOf(ctx, studentNo) {
    if (!studentsFor(ctx.institutionType).some((s) => s.no === studentNo)) return undefined;
    return positionOf(ledgerOf(ctx), studentNo);
  },

  async listFees(ctx) {
    return stateOf(ctx).fees.map((f) => ({ ...f, scope: { ...f.scope } }));
  },

  async listGroups(ctx) {
    return groupsFor(ctx.institutionType);
  },

  async saveFee(ctx, input, now) {
    const s = stateOf(ctx);
    const clash = s.fees.find((f) => f.id !== input.id && f.name.toLowerCase() === input.name.toLowerCase() && f.kind === input.kind && sameScope(f.scope, input.scope));
    if (clash) return bad("There is already a fee with that name, account and scope. Change that one instead.");
    if (input.id) {
      const f = s.fees.find((x) => x.id === input.id);
      if (!f) return bad("That fee is not in this school's structure.");
      Object.assign(f, { ...input, id: f.id, updatedAt: now, updatedBy: ctx.bursarName });
      save();
      return { ok: true, id: f.id };
    }
    const fee: FeeItem = { ...input, id: `fee-${s.nextFee++}`, updatedAt: now, updatedBy: ctx.bursarName };
    s.fees.push(fee);
    save();
    return { ok: true, id: fee.id };
  },

  async setFeeActive(ctx, id, active, now) {
    const f = stateOf(ctx).fees.find((x) => x.id === id);
    if (!f) return bad("That fee is not in this school's structure.");
    f.active = active;
    f.updatedAt = now;
    f.updatedBy = ctx.bursarName;
    save();
    return { ok: true, id: f.id };
  },
};

/** Test helper: forget everything. */
export const resetMockBursar = () => {
  resetLedger();
  data.clear();
  saveSnapshot(KEY, []);
};
