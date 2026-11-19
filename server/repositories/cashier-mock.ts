import { checkCashUp, breakDown } from "@/lib/cashier/validate";
import { dayTotals, newestFirst, receiptNo } from "@/lib/cashier/totals";
import { RECEIPT_SEED, seedDay, studentsFor } from "@/lib/cashier/seed";
import { startsPending } from "@/lib/cashier/methods";
import type { CashUp, Receipt, StudentAccount } from "@/types/cashier";
import { loadSnapshot, saveSnapshot } from "../persistence/store";
import { addOwed, dueOf, owedOf, resetLedger, reversalOf, type LedgerScope } from "./ledger-store";
import type { CashierContext, CashierRepository } from "./cashier-types";

/**
 * Cashier data per school and per cashier, kept in memory and saved to the
 * SQLite file like the Student pages. What each student owes lives in the
 * Bursar's ledger (./ledger-store), so a payment taken here moves the balance
 * the Bursar, Student and Parent pages show. The receipts and cash-ups are what
 * this file saves.
 */
type State = {
  receipts: Receipt[];
  /** Key: date. */
  cashUps: Record<string, CashUp>;
  nextNo: number;
};

const g = globalThis as unknown as { __acurisCashier?: Map<string, State> };
const KEY = "cashier";
const data = (g.__acurisCashier ??= new Map<string, State>(loadSnapshot<Array<[string, State]>>(KEY) ?? []));
const save = () => saveSnapshot(KEY, [...data]);

const scopeOf = (c: CashierContext) => `${c.tenantId}:${c.cashierId}:${c.institutionType}`;
const bad = (error: string) => ({ ok: false as const, error });
const ledgerOf = (c: CashierContext): LedgerScope => ({ tenantId: c.tenantId, institutionType: c.institutionType });
const stamp = (date: string, time: string) => `${date}T${time}:00+02:00`;

function seed(ctx: CashierContext): State {
  const students = studentsFor(ctx.institutionType);
  const s: State = { receipts: [], cashUps: {}, nextNo: 2630 };
  RECEIPT_SEED.forEach((r, i) => {
    const st = students[r.student];
    const date = seedDay(ctx.today, r.daysAgo);
    const no = receiptNo(s.nextNo + i);
    s.receipts.push({
      id: no.toLowerCase(), no, studentNo: st.no, studentName: st.name, group: st.group, account: st.lines[r.kind].kind, method: r.method, amount: r.kwacha * 100,
      reference: r.reference, note: "", status: r.status, at: stamp(date, r.time), date, cashier: ctx.cashierName,
    });
  });
  s.nextNo += RECEIPT_SEED.length;
  // The day before was cashed up, a little short, so the history shows a difference and its reason.
  const yesterday = seedDay(ctx.today, 1);
  const expected = dayTotals(s.receipts, yesterday).expectedCash;
  const counted = Math.max(0, expected - 500);
  s.cashUps[yesterday] = { date: yesterday, counts: breakDown(counted), counted, expected, variance: counted - expected, reason: "Short change given to a parent and not written down.", submittedAt: stamp(yesterday, "16:30"), submittedBy: ctx.cashierName };
  return s;
}

function stateOf(ctx: CashierContext): State {
  let s = data.get(scopeOf(ctx));
  if (!s) {
    s = seed(ctx);
    data.set(scopeOf(ctx), s);
    save();
  }
  return s;
}

const accountsOf = (ctx: CashierContext): StudentAccount[] =>
  studentsFor(ctx.institutionType).map((st) => {
    const lines = st.lines.map((l) => ({ kind: l.kind, owed: owedOf(ledgerOf(ctx), st.no, l.kind), dueOn: dueOf(ledgerOf(ctx), st.no, l.kind) }));
    const due = lines.filter((l) => l.owed > 0 && l.dueOn).map((l) => l.dueOn as string).sort();
    return { no: st.no, name: st.name, group: st.group, lines, total: lines.reduce((n, l) => n + l.owed, 0), dueOn: due[0] ?? null };
  });

const closed = (s: State, date: string) => Boolean(s.cashUps[date]);

export const mockCashierRepository: CashierRepository = {
  async listStudents(ctx) {
    return accountsOf(ctx);
  },

  async listReceipts(ctx) {
    return [...stateOf(ctx).receipts].sort(newestFirst);
  },

  async listSchoolReceipts(ctx) {
    stateOf(ctx);
    const prefix = `${ctx.tenantId}:`;
    const suffix = `:${ctx.institutionType}`;
    return [...data].filter(([k]) => k.startsWith(prefix) && k.endsWith(suffix)).flatMap(([, st]) => st.receipts).sort(newestFirst);
  },

  async listSchoolCashUps(ctx) {
    stateOf(ctx);
    const prefix = `${ctx.tenantId}:`;
    const suffix = `:${ctx.institutionType}`;
    return [...data].filter(([k]) => k.startsWith(prefix) && k.endsWith(suffix)).flatMap(([, st]) => Object.values(st.cashUps)).sort((a, b) => b.date.localeCompare(a.date) || a.submittedBy.localeCompare(b.submittedBy));
  },

  async recordPayment(ctx, input, now) {
    const s = stateOf(ctx);
    if (closed(s, ctx.today)) return bad("Today's cash-up has been submitted, so no more payments can be taken today.");
    const student = accountsOf(ctx).find((a) => a.no === input.studentNo);
    if (!student) return bad("That student is not in this school's records.");
    const line = student.lines.find((l) => l.kind === input.account);
    if (!line || line.owed <= 0) return bad("Nothing is owed on that account.");
    if (input.amount > line.owed) return bad("The amount is more than is owed on that account.");
    const pending = startsPending(input.method);
    const no = receiptNo(s.nextNo++);
    const receipt: Receipt = {
      id: no.toLowerCase(), no, studentNo: student.no, studentName: student.name, group: student.group, account: input.account, method: input.method, amount: input.amount,
      reference: input.reference, note: input.note, status: pending ? "pending" : "success", at: now, date: ctx.today, cashier: ctx.cashierName,
    };
    s.receipts.push(receipt);
    if (!pending) addOwed(ledgerOf(ctx), student.no, input.account, -input.amount);
    save();
    return { ok: true, id: receipt.id };
  },

  async confirmReceipt(ctx, receiptId) {
    const s = stateOf(ctx);
    const r = s.receipts.find((x) => x.id === receiptId);
    if (!r) return bad("That receipt is not one of yours.");
    if (r.status !== "pending") return bad("Only a pending receipt can be confirmed.");
    if (closed(s, r.date)) return bad("That day's cash-up has been submitted, so the receipt can no longer be changed.");
    if (r.amount > owedOf(ledgerOf(ctx), r.studentNo, r.account)) return bad("The account no longer owes this much, so the receipt cannot be confirmed. Void it instead.");
    addOwed(ledgerOf(ctx), r.studentNo, r.account, -r.amount);
    r.status = "success";
    save();
    return { ok: true, id: r.id };
  },

  async voidReceipt(ctx, receiptId, reason, now) {
    const s = stateOf(ctx);
    const r = s.receipts.find((x) => x.id === receiptId);
    if (!r) return bad("That receipt is not one of yours.");
    if (r.status === "voided") return bad("That receipt is already voided.");
    if (reversalOf(ledgerOf(ctx), r.id)) return bad("The Bursar has already reversed that receipt.");
    if (r.date !== ctx.today) return bad("Only today's receipts can be voided here. Ask the Bursar for earlier ones.");
    if (closed(s, r.date)) return bad("Today's cash-up has been submitted, so the receipt can no longer be voided.");
    if (r.status === "success") addOwed(ledgerOf(ctx), r.studentNo, r.account, r.amount);
    r.status = "voided";
    r.void = { reason, at: now, by: ctx.cashierName };
    save();
    return { ok: true, id: r.id };
  },

  async getDay(ctx, date) {
    const s = stateOf(ctx);
    return { ...dayTotals(s.receipts, date), cashUp: s.cashUps[date] };
  },

  async listCashUps(ctx) {
    return Object.values(stateOf(ctx).cashUps).sort((a, b) => b.date.localeCompare(a.date));
  },

  async submitCashUp(ctx, input, now) {
    const s = stateOf(ctx);
    if (closed(s, ctx.today)) return bad("Today's cash-up has already been submitted.");
    const totals = dayTotals(s.receipts, ctx.today);
    if (totals.pending > 0) return bad(`Confirm or void the ${totals.pending} pending ${totals.pending === 1 ? "receipt" : "receipts"} first.`);
    const checked = checkCashUp(input, totals.expectedCash);
    if (!checked.ok) return bad(checked.error);
    s.cashUps[ctx.today] = { date: ctx.today, counts: checked.value.counts, counted: checked.value.counted, expected: totals.expectedCash, variance: checked.value.variance, reason: checked.value.reason, submittedAt: now, submittedBy: ctx.cashierName };
    save();
    return { ok: true, id: ctx.today };
  },
};

/** Test helper: forget everything. */
export const resetMockCashier = () => {
  resetLedger();
  data.clear();
  saveSnapshot(KEY, []);
};
