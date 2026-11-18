import { accountRow, statementEntries } from "@/lib/bursar/accounts";
import { groupsFor, sameScope, seedFeeItems } from "@/lib/bursar/fees";
import { seedInvoices, seedPayments, seedUnallocated, seedWaivers } from "@/lib/bursar/seed";
import { studentsFor } from "@/lib/cashier/seed";
import type { AccountKind, FeeItem, Invoice, Payment, UnallocatedPayment, Waiver } from "@/types/bursar";
import { loadSnapshot, saveSnapshot } from "../persistence/store";
import type { BursarContext, BursarRepository } from "./bursar-types";
import type { CashierRepository } from "./cashier-types";
import { addOwed, dueOf, listPlans, markReversed, owedOf, resetLedger, reversalOf, type LedgerScope } from "./ledger-store";

/**
 * Bursar data per school, kept in memory and saved to the SQLite file like the
 * other mocks. What each student owes lives in the shared ledger (./ledger-store);
 * this file keeps the Bursar's own records: the fee structure, invoices, the
 * payments the Bursar records or allocates, unallocated money and waivers. The
 * payments taken at the Cashier's desk are read through the cashier repository.
 */
type State = {
  fees: FeeItem[];
  nextFee: number;
  invoices: Invoice[];
  payments: Payment[];
  unallocated: UnallocatedPayment[];
  waivers: Waiver[];
  nextPayment: number;
  nextWaiver: number;
};

const g = globalThis as unknown as { __acurisBursar?: Map<string, State> };
const KEY = "bursar";
const data = (g.__acurisBursar ??= new Map<string, State>(loadSnapshot<Array<[string, State]>>(KEY) ?? []));
const save = () => saveSnapshot(KEY, [...data]);

const scopeOf = (c: BursarContext) => `${c.tenantId}:${c.institutionType}`;
const ledgerOf = (c: BursarContext): LedgerScope => ({ tenantId: c.tenantId, institutionType: c.institutionType });
const bad = (error: string) => ({ ok: false as const, error });
const pad = (n: number, w: number) => String(n).padStart(w, "0");

function stateOf(ctx: BursarContext): State {
  let s = data.get(scopeOf(ctx));
  if (!s) {
    s = { fees: seedFeeItems(ctx.institutionType), nextFee: 100 } as State;
    data.set(scopeOf(ctx), s);
  }
  // Fill in anything an older saved copy does not have yet.
  const t = ctx.institutionType;
  s.invoices ??= seedInvoices(t);
  s.payments ??= seedPayments(t);
  s.unallocated ??= seedUnallocated();
  s.waivers ??= seedWaivers(t);
  s.nextPayment ??= s.payments.length + 1;
  s.nextWaiver ??= s.waivers.length + 1;
  save();
  return s;
}

export function createMockBursarRepository(cashier: CashierRepository): BursarRepository {
  const cashierCtx = (c: BursarContext) => ({ tenantId: c.tenantId, cashierId: c.bursarId, cashierName: c.bursarName, institutionType: c.institutionType, today: c.today });
  const roll = (c: BursarContext) => studentsFor(c.institutionType);

  async function payments(ctx: BursarContext): Promise<Payment[]> {
    const s = stateOf(ctx);
    const led = ledgerOf(ctx);
    const byNo = new Map(roll(ctx).map((st) => [st.no, st]));
    const desk: Payment[] = (await cashier.listSchoolReceipts(cashierCtx(ctx)))
      .filter((r) => r.status !== "voided" && byNo.has(r.studentNo))
      .map((r) => {
        const reversal = reversalOf(led, r.id);
        const st = byNo.get(r.studentNo)!;
        return { id: r.id, no: r.no, source: "cashier" as const, studentNo: r.studentNo, studentName: st.name, group: st.group, account: r.account, method: r.method, amount: r.amount, reference: r.reference, note: r.note, status: reversal ? ("reversed" as const) : r.status === "pending" ? ("pending" as const) : ("success" as const), at: r.at, date: r.at.slice(0, 10), by: r.cashier, ...(reversal ? { reversal } : {}) };
      });
    const mine: Payment[] = s.payments.map((p) => {
      const reversal = reversalOf(led, p.id);
      return reversal ? { ...p, status: "reversed" as const, reversal } : { ...p, status: "success" as const, reversal: undefined };
    });
    return [...desk, ...mine].sort((a, b) => b.at.localeCompare(a.at));
  }

  const ledgerLines = (ctx: BursarContext, no: string) => {
    const st = roll(ctx).find((x) => x.no === no);
    return (st?.lines ?? []).map((l) => ({ kind: l.kind as AccountKind, owed: owedOf(ledgerOf(ctx), no, l.kind as AccountKind), dueOn: dueOf(ledgerOf(ctx), no, l.kind as AccountKind) }));
  };

  const onPlan = (ctx: BursarContext, no: string) => listPlans(ledgerOf(ctx)).some((p) => p.studentNo === no && p.status === "active");

  async function accounts(ctx: BursarContext) {
    const s = stateOf(ctx);
    const pay = await payments(ctx);
    return roll(ctx).map((st) => accountRow(st, ledgerLines(ctx, st.no), s.invoices, pay, s.waivers, onPlan(ctx, st.no), ctx.today));
  }

  return {
    async balanceOf(ctx, studentNo) {
      const row = (await accounts(ctx)).find((a) => a.no === studentNo);
      return row ? { balance: row.owed, dueOn: row.dueOn } : undefined;
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

    listAccounts: accounts,

    async getStatement(ctx, studentNo) {
      const s = stateOf(ctx);
      const account = (await accounts(ctx)).find((a) => a.no === studentNo);
      if (!account) return undefined;
      const invs = s.invoices.filter((i) => i.studentNo === studentNo);
      const pays = (await payments(ctx)).filter((p) => p.studentNo === studentNo);
      const waivers = s.waivers.filter((w) => w.studentNo === studentNo);
      return { account, entries: statementEntries(invs, pays, waivers), invoices: invs, payments: pays, waivers, plan: listPlans(ledgerOf(ctx)).find((p) => p.studentNo === studentNo && p.status === "active") };
    },

    listPayments: payments,

    async listInvoices(ctx) {
      return stateOf(ctx).invoices.map((i) => ({ ...i, lines: i.lines.map((l) => ({ ...l })) }));
    },

    async reversePayment(ctx, paymentId, reason, now) {
      const p = (await payments(ctx)).find((x) => x.id === paymentId);
      if (!p) return bad("That payment is not in this school's records.");
      if (p.status === "reversed") return bad("That payment has already been reversed.");
      if (p.status === "pending") return bad("That payment has not been confirmed yet. The cashier confirms or voids it.");
      addOwed(ledgerOf(ctx), p.studentNo, p.account, p.amount);
      markReversed(ledgerOf(ctx), p.id, { reason, at: now, by: ctx.bursarName });
      if (p.fromUnallocated) {
        const u = stateOf(ctx).unallocated.find((x) => x.id === p.fromUnallocated);
        if (u) {
          u.remaining += p.amount;
          u.status = "open";
          const a = u.allocations.find((x) => x.paymentNo === p.no);
          if (a) a.reversed = true;
        }
      }
      save();
      return { ok: true, id: p.id };
    },

    async listUnallocated(ctx) {
      const open = (u: UnallocatedPayment) => (u.status === "open" ? 0 : 1);
      return stateOf(ctx).unallocated.map((u) => ({ ...u, allocations: u.allocations.map((a) => ({ ...a })) })).sort((a, b) => open(a) - open(b) || b.date.localeCompare(a.date) || b.no.localeCompare(a.no));
    },

    async allocatePayment(ctx, id, to, now) {
      const s = stateOf(ctx);
      const u = s.unallocated.find((x) => x.id === id);
      if (!u) return bad("That payment is not in this school's unallocated list.");
      if (u.status !== "open" || u.remaining <= 0) return bad("That payment has already been fully allocated.");
      const st = roll(ctx).find((x) => x.no === to.studentNo);
      if (!st) return bad("That student is not on this school's roll.");
      if (!st.lines.some((l) => l.kind === to.account)) return bad("That account does not exist for this school.");
      if (to.amount > u.remaining) return bad("That is more than is left to allocate from this payment.");
      const owed = owedOf(ledgerOf(ctx), st.no, to.account);
      if (owed <= 0) return bad("Nothing is owed on that account.");
      if (to.amount > owed) return bad("That is more than is owed on that account.");
      const n = s.nextPayment++;
      const p: Payment = { id: `bp-${pad(n, 5)}`, no: `BP-${pad(n, 5)}`, source: "allocation", studentNo: st.no, studentName: st.name, group: st.group, account: to.account, method: u.method, amount: to.amount, reference: u.reference, note: `Allocated from ${u.no}`, status: "success", at: now, date: ctx.today, by: ctx.bursarName, fromUnallocated: u.id };
      s.payments.push(p);
      addOwed(ledgerOf(ctx), st.no, to.account, -to.amount);
      u.remaining -= to.amount;
      if (u.remaining === 0) u.status = "allocated";
      u.allocations.push({ paymentNo: p.no, studentNo: st.no, studentName: st.name, account: to.account, amount: to.amount, at: now, by: ctx.bursarName });
      save();
      return { ok: true, id: p.id };
    },

    async listWaivers(ctx) {
      const rank = (w: Waiver) => (w.status === "pending" ? 0 : 1);
      return stateOf(ctx).waivers.map((w) => ({ ...w })).sort((a, b) => rank(a) - rank(b) || (b.decidedAt ?? b.requestedAt).localeCompare(a.decidedAt ?? a.requestedAt));
    },

    async requestWaiver(ctx, input, now) {
      const s = stateOf(ctx);
      const st = roll(ctx).find((x) => x.no === input.studentNo);
      if (!st) return bad("That student is not on this school's roll.");
      if (!st.lines.some((l) => l.kind === input.account)) return bad("That account does not exist for this school.");
      const owed = owedOf(ledgerOf(ctx), st.no, input.account);
      if (input.amount > owed) return bad("That is more than is owed on that account.");
      const n = s.nextWaiver++;
      const w: Waiver = { id: `wv-${pad(n, 4)}`, no: `WV-${pad(n, 4)}`, studentNo: st.no, studentName: st.name, kind: input.kind, account: input.account, amount: input.amount, source: input.source, reason: input.reason, status: "pending", requestedBy: input.requestedBy, requestedAt: now };
      s.waivers.push(w);
      save();
      return { ok: true, id: w.id };
    },

    async decideWaiver(ctx, id, decision, note, now) {
      const w = stateOf(ctx).waivers.find((x) => x.id === id);
      if (!w) return bad("That request is not in this school's records.");
      if (w.status !== "pending") return bad("That request has already been decided.");
      if (decision === "approve") {
        if (w.amount > owedOf(ledgerOf(ctx), w.studentNo, w.account)) return bad("The account now owes less than this request. Decline it and enter a new one for the right amount.");
        addOwed(ledgerOf(ctx), w.studentNo, w.account, -w.amount);
      }
      Object.assign(w, { status: decision === "approve" ? "approved" : "declined", decidedBy: ctx.bursarName, decidedAt: now, decisionNote: note });
      save();
      return { ok: true, id: w.id };
    },
  };
}

import { mockCashierRepository } from "./cashier-mock";

/** The mock wired to the mock cashier. Tests use this; ./index.ts wires the real cashier repository. */
export const mockBursarRepository = createMockBursarRepository(mockCashierRepository);

/** Test helper: forget everything. */
export const resetMockBursar = () => {
  resetLedger();
  data.clear();
  saveSnapshot(KEY, []);
};
