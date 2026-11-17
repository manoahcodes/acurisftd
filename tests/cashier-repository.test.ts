import { beforeEach, describe, expect, it } from "vitest";
import { INSTITUTION_TYPES } from "@/config/institution";
import { breakDown as breakDownOf } from "@/lib/cashier/validate";
import { mockCashierRepository as repo, resetMockCashier } from "@/server/repositories/cashier-mock";
import type { CashierContext } from "@/server/repositories/cashier-types";
import type { PaymentInput } from "@/types/cashier";

const TODAY = "2026-11-16";
const NOW = "2026-11-16T12:00:00.000Z";
const ctx = (over: Partial<CashierContext> = {}): CashierContext => ({ tenantId: "t1", cashierId: "c1", cashierName: "Cashier One", institutionType: "university", today: TODAY, ...over });
const pay = (over: Partial<PaymentInput> = {}): PaymentInput => ({ studentNo: "UNI-1048", account: "tuition", method: "cash", amount: 100_000, reference: "", note: "", ...over });
const owedOf = async (c: CashierContext, no: string, kind: string) => (await repo.listStudents(c)).find((s) => s.no === no)!.lines.find((l) => l.kind === kind)!.owed;

beforeEach(() => resetMockCashier());

describe("seed", () => {
  it("has students and today's receipts for every school type", async () => {
    for (const type of INSTITUTION_TYPES) {
      const c = ctx({ institutionType: type });
      const students = await repo.listStudents(c);
      expect(students.length).toBeGreaterThanOrEqual(8);
      expect(students.every((s) => s.no.includes("-"))).toBe(true);
      const day = await repo.getDay(c, TODAY);
      expect(day.count).toBeGreaterThan(0);
      expect(day.pending).toBe(2);
      expect(day.cashUp).toBeUndefined();
    }
  });
  it("seeds the receipts relative to today and cashes up the day before", async () => {
    const c = ctx({ today: "2026-12-03" });
    expect((await repo.getDay(c, "2026-12-03")).count).toBeGreaterThan(0);
    const history = await repo.listCashUps(c);
    expect(history).toHaveLength(1);
    expect(history[0].date).toBe("2026-12-02");
    expect(history[0].variance).toBe(-500);
    expect(history[0].reason).not.toBe("");
  });
  it("keeps each cashier's ledger and each school's apart", async () => {
    await repo.recordPayment(ctx(), pay(), NOW);
    expect((await repo.listReceipts(ctx({ cashierId: "c2" }))).length).toBe((await repo.listReceipts(ctx())).length - 1);
    expect(await owedOf(ctx({ tenantId: "t2" }), "UNI-1048", "tuition")).toBe(await owedOf(ctx({ cashierId: "c2" }), "UNI-1048", "tuition"));
  });
  it("words nothing but numbers by school type", async () => {
    expect((await repo.listStudents(ctx({ institutionType: "primary" })))[0].no.startsWith("PRI-")).toBe(true);
    expect((await repo.listStudents(ctx({ institutionType: "college" })))[0].no.startsWith("COL-")).toBe(true);
  });
});

describe("recordPayment", () => {
  it("takes a cash payment as a successful receipt and lowers the balance", async () => {
    const c = ctx();
    const before = await owedOf(c, "UNI-1048", "tuition");
    const r = await repo.recordPayment(c, pay(), NOW);
    expect(r.ok).toBe(true);
    const receipt = (await repo.listReceipts(c)).find((x) => x.id === (r.ok ? r.id : ""))!;
    expect(receipt).toMatchObject({ status: "success", amount: 100_000, date: TODAY, cashier: "Cashier One", method: "cash" });
    expect(receipt.no).toMatch(/^RC-\d{5}$/);
    expect(await owedOf(c, "UNI-1048", "tuition")).toBe(before - 100_000);
  });
  it("numbers receipts one after another", async () => {
    const a = await repo.recordPayment(ctx(), pay({ amount: 5 }), NOW);
    const b = await repo.recordPayment(ctx(), pay({ amount: 5 }), NOW);
    const list = await repo.listReceipts(ctx());
    const no = (id: string) => Number(list.find((r) => r.id === id)!.no.slice(3));
    expect(no(b.ok ? b.id! : "")).toBe(no(a.ok ? a.id! : "") + 1);
  });
  it("holds a mobile money payment as pending and leaves the balance alone until it is confirmed", async () => {
    const c = ctx();
    const before = await owedOf(c, "UNI-1048", "tuition");
    const r = await repo.recordPayment(c, pay({ method: "mtn_money", reference: "MP1" }), NOW);
    expect(r.ok).toBe(true);
    expect(await owedOf(c, "UNI-1048", "tuition")).toBe(before);
    const day = await repo.getDay(c, TODAY);
    expect(day.pending).toBe(3);
    const confirmed = await repo.confirmReceipt(c, r.ok ? r.id! : "", NOW);
    expect(confirmed.ok).toBe(true);
    expect(await owedOf(c, "UNI-1048", "tuition")).toBe(before - 100_000);
    expect((await repo.getDay(c, TODAY)).pending).toBe(2);
  });
  it("refuses more than is owed, unknown students and accounts with nothing owed", async () => {
    const c = ctx();
    const owed = await owedOf(c, "UNI-1048", "tuition");
    expect((await repo.recordPayment(c, pay({ amount: owed + 1 }), NOW)).ok).toBe(false);
    expect((await repo.recordPayment(c, pay({ studentNo: "ZZZ-1" }), NOW)).ok).toBe(false);
    expect((await repo.recordPayment(c, pay({ account: "other" }), NOW)).ok).toBe(false);
    expect((await repo.recordPayment(c, pay({ studentNo: "UNI-1201" }), NOW)).ok).toBe(false);
  });
  it("lets a balance be paid off exactly but not paid twice", async () => {
    const c = ctx();
    const tuition = await owedOf(c, "UNI-0764", "tuition");
    expect((await repo.recordPayment(c, pay({ studentNo: "UNI-0764", amount: tuition }), NOW)).ok).toBe(true);
    expect(await owedOf(c, "UNI-0764", "tuition")).toBe(0);
    expect((await repo.recordPayment(c, pay({ studentNo: "UNI-0764", amount: 5 }), NOW)).ok).toBe(false);
  });
});

describe("voidReceipt", () => {
  it("voids today's receipt, keeps it listed, restores the balance and leaves it out of the totals", async () => {
    const c = ctx();
    const before = await owedOf(c, "UNI-1048", "tuition");
    const dayBefore = await repo.getDay(c, TODAY);
    const r = await repo.recordPayment(c, pay(), NOW);
    const id = r.ok ? r.id! : "";
    expect((await repo.voidReceipt(c, id, "Wrong account", NOW)).ok).toBe(true);
    const receipt = (await repo.listReceipts(c)).find((x) => x.id === id)!;
    expect(receipt.status).toBe("voided");
    expect(receipt.void).toMatchObject({ reason: "Wrong account", by: "Cashier One" });
    expect(await owedOf(c, "UNI-1048", "tuition")).toBe(before);
    const day = await repo.getDay(c, TODAY);
    expect(day.collected).toBe(dayBefore.collected);
    expect(day.expectedCash).toBe(dayBefore.expectedCash);
    expect(day.voided).toBe(dayBefore.voided + 1);
  });
  it("voids a pending receipt without touching the balance", async () => {
    const c = ctx();
    const before = await owedOf(c, "UNI-1048", "tuition");
    const r = await repo.recordPayment(c, pay({ method: "bank_deposit", reference: "B1" }), NOW);
    expect((await repo.voidReceipt(c, r.ok ? r.id! : "", "Slip was for another student", NOW)).ok).toBe(true);
    expect(await owedOf(c, "UNI-1048", "tuition")).toBe(before);
  });
  it("cannot void twice, an earlier day's receipt, or someone else's", async () => {
    const c = ctx();
    const r = await repo.recordPayment(c, pay(), NOW);
    const id = r.ok ? r.id! : "";
    expect((await repo.voidReceipt(c, id, "x", NOW)).ok).toBe(true);
    expect((await repo.voidReceipt(c, id, "again", NOW)).ok).toBe(false);
    const earlier = (await repo.listReceipts(c)).find((x) => x.date !== TODAY)!;
    expect((await repo.voidReceipt(c, earlier.id, "late", NOW)).ok).toBe(false);
    expect((await repo.voidReceipt(ctx({ cashierId: "c2" }), id, "not mine", NOW)).ok).toBe(false);
    expect((await repo.voidReceipt(c, "rc-missing", "x", NOW)).ok).toBe(false);
  });
  it("cannot confirm a receipt that is not pending, or a pending one whose balance has since been paid", async () => {
    const c = ctx();
    const ok = await repo.recordPayment(c, pay(), NOW);
    expect((await repo.confirmReceipt(c, ok.ok ? ok.id! : "", NOW)).ok).toBe(false);
    const owed = await owedOf(c, "UNI-0764", "tuition");
    const pending = await repo.recordPayment(c, pay({ studentNo: "UNI-0764", amount: owed, method: "mtn_money", reference: "M" }), NOW);
    await repo.recordPayment(c, pay({ studentNo: "UNI-0764", amount: owed }), NOW);
    expect((await repo.confirmReceipt(c, pending.ok ? pending.id! : "", NOW)).ok).toBe(false);
  });
});

describe("cash-up", () => {
  const settle = async (c: CashierContext) => {
    for (const r of await repo.listReceipts(c)) if (r.status === "pending") await repo.confirmReceipt(c, r.id, NOW);
  };
  it("is refused while receipts are pending", async () => {
    const c = ctx();
    const day = await repo.getDay(c, TODAY);
    const r = await repo.submitCashUp(c, { counts: {}, reason: "x" }, NOW);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toMatch(/pending/);
    expect(day.expectedCash).toBeGreaterThan(0);
  });
  it("submits a matching count, locks the day and lists it in the history", async () => {
    const c = ctx();
    await settle(c);
    const day = await repo.getDay(c, TODAY);
    const r = await repo.submitCashUp(c, { counts: breakDownOf(day.expectedCash), reason: "" }, NOW);
    expect(r.ok).toBe(true);
    const after = await repo.getDay(c, TODAY);
    expect(after.cashUp).toMatchObject({ expected: day.expectedCash, counted: day.expectedCash, variance: 0, submittedBy: "Cashier One" });
    expect((await repo.listCashUps(c))[0].date).toBe(TODAY);
  });
  it("needs a reason when short or over, and keeps it", async () => {
    const c = ctx();
    await settle(c);
    const day = await repo.getDay(c, TODAY);
    expect((await repo.submitCashUp(c, { counts: breakDownOf(day.expectedCash - 500), reason: "" }, NOW)).ok).toBe(false);
    expect((await repo.submitCashUp(c, { counts: breakDownOf(day.expectedCash - 500), reason: "Gave change" }, NOW)).ok).toBe(true);
    expect((await repo.getDay(c, TODAY)).cashUp).toMatchObject({ variance: -500, reason: "Gave change" });
  });
  it("locks the day: no more payments, confirmations, voids or a second submit", async () => {
    const c = ctx();
    await settle(c);
    const open = (await repo.listReceipts(c)).find((r) => r.date === TODAY && r.status === "success")!;
    const day = await repo.getDay(c, TODAY);
    expect((await repo.submitCashUp(c, { counts: breakDownOf(day.expectedCash), reason: "" }, NOW)).ok).toBe(true);
    expect((await repo.recordPayment(c, pay(), NOW)).ok).toBe(false);
    expect((await repo.voidReceipt(c, open.id, "late", NOW)).ok).toBe(false);
    expect((await repo.submitCashUp(c, { counts: breakDownOf(day.expectedCash), reason: "" }, NOW)).ok).toBe(false);
  });
  it("counts only confirmed cash toward the expected cash", async () => {
    const c = ctx();
    const before = (await repo.getDay(c, TODAY)).expectedCash;
    await repo.recordPayment(c, pay({ method: "mtn_money", reference: "M" }), NOW);
    expect((await repo.getDay(c, TODAY)).expectedCash).toBe(before);
    await repo.recordPayment(c, pay({ amount: 2_000 }), NOW);
    expect((await repo.getDay(c, TODAY)).expectedCash).toBe(before + 2_000);
  });
});
