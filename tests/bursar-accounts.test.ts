import { beforeEach, describe, expect, it } from "vitest";
import { INSTITUTION_TYPES } from "@/config/institution";
import { checkAllocation, checkDecision, checkReason, checkWaiver } from "@/lib/bursar/validate";
import { studentsFor } from "@/lib/cashier/seed";
import { mockBursarRepository as repo, resetMockBursar } from "@/server/repositories/bursar-mock";
import type { BursarContext } from "@/server/repositories/bursar-types";
import { mockCashierRepository as cashier } from "@/server/repositories/cashier-mock";

const NOW = "2026-11-17T09:00:00.000Z";
const ctx = (over: Partial<BursarContext> = {}): BursarContext => ({ tenantId: "t1", bursarId: "b1", bursarName: "Bursar One", institutionType: "high_school", today: "2026-11-17", ...over });

beforeEach(() => resetMockBursar());

describe("the sample accounts add up", () => {
  it("billed minus paid minus waived is what the ledger says is owed, for every student and school type", async () => {
    for (const type of INSTITUTION_TYPES) {
      resetMockBursar();
      const c = ctx({ institutionType: type });
      for (const a of await repo.listAccounts(c)) {
        expect(a.billed - a.paid - a.waived, `${type} ${a.no}`).toBe(a.owed);
        expect(a.lines.reduce((n, l) => n + l.owed, 0)).toBe(a.owed);
        const st = (await repo.getStatement(c, a.no))!;
        expect(st.entries.at(-1)?.balance ?? 0, `${type} ${a.no} statement`).toBe(a.owed);
      }
    }
  });
  it("lists every student on the roll with a status", async () => {
    const accounts = await repo.listAccounts(ctx());
    expect(accounts.map((a) => a.no)).toEqual(studentsFor("high_school").map((s) => s.no));
    expect(accounts.some((a) => a.status === "overdue")).toBe(true);
    expect(accounts.some((a) => a.status === "paid")).toBe(true);
    expect(await repo.getStatement(ctx(), "NOPE-1")).toBeUndefined();
  });
  it("starts with three unallocated payments worth K 2,350 and a pending request or two", async () => {
    const u = await repo.listUnallocated(ctx());
    expect(u).toHaveLength(3);
    expect(u.reduce((n, x) => n + x.remaining, 0)).toBe(235_000);
    const w = await repo.listWaivers(ctx());
    expect(w.filter((x) => x.status === "pending")).toHaveLength(2);
    expect(w[0].status).toBe("pending");
  });
});

describe("reversing a payment", () => {
  const desk = (no: string, amount: number) => cashier.recordPayment({ tenantId: "t1", cashierId: "b1", cashierName: "Bursar One", institutionType: "high_school", today: "2026-11-17" }, { studentNo: no, account: "tuition", method: "cash", amount, reference: "", note: "" }, NOW);
  const NO = studentsFor("high_school")[0].no;

  it("puts a desk receipt back on the account, keeps it listed, and ties the statement", async () => {
    const before = (await repo.listAccounts(ctx())).find((a) => a.no === NO)!;
    const r = await desk(NO, 100_000);
    if (!r.ok || !r.id) throw new Error("no receipt");
    expect((await repo.listAccounts(ctx())).find((a) => a.no === NO)!.owed).toBe(before.owed - 100_000);
    expect((await repo.reversePayment(ctx(), r.id, "Paid into the wrong account", NOW)).ok).toBe(true);
    const after = (await repo.listAccounts(ctx())).find((a) => a.no === NO)!;
    expect(after.owed).toBe(before.owed);
    expect(after.billed - after.paid - after.waived).toBe(after.owed);
    const st = (await repo.getStatement(ctx(), NO))!;
    expect(st.entries.some((e) => e.kind === "reversal" && e.description.includes("wrong account"))).toBe(true);
    expect(st.entries.at(-1)!.balance).toBe(after.owed);
    const p = (await repo.listPayments(ctx())).find((x) => x.id === r.id)!;
    expect(p).toMatchObject({ status: "reversed", reversal: { reason: "Paid into the wrong account", by: "Bursar One" } });
  });
  it("cannot be reversed twice, and the desk can no longer void it", async () => {
    const r = await desk(NO, 50_000);
    if (!r.ok || !r.id) throw new Error("no receipt");
    await repo.reversePayment(ctx(), r.id, "Duplicate", NOW);
    expect(await repo.reversePayment(ctx(), r.id, "Again", NOW)).toMatchObject({ ok: false });
    const voided = await cashier.voidReceipt({ tenantId: "t1", cashierId: "b1", cashierName: "Bursar One", institutionType: "high_school", today: "2026-11-17" }, r.id, "Wrong student", NOW);
    expect(voided.ok).toBe(false);
  });
  it("refuses a pending payment and one that is not in this school", async () => {
    const pending = (await repo.listPayments(ctx())).find((p) => p.status === "pending");
    if (pending) expect(await repo.reversePayment(ctx(), pending.id, "x", NOW)).toMatchObject({ ok: false });
    expect(await repo.reversePayment(ctx(), "rc-99999", "x", NOW)).toMatchObject({ ok: false });
    const first = (await repo.listPayments(ctx())).find((p) => p.status === "success")!;
    expect(await repo.reversePayment(ctx({ tenantId: "t2" }), first.id, "x", NOW)).toMatchObject({ ok: true });
    // Another school has its own copy of the sample, so the same id exists there; reversing it there changes nothing here.
    expect((await repo.listPayments(ctx())).find((p) => p.id === first.id)!.status).toBe("success");
  });
});

describe("allocating unallocated payments", () => {
  const NO = studentsFor("high_school")[0].no;
  it("gives part, then the rest, and moves the balance", async () => {
    const [u] = (await repo.listUnallocated(ctx())).filter((x) => x.amount === 120_000);
    const owedBefore = (await repo.listAccounts(ctx())).find((a) => a.no === NO)!.owed;
    expect((await repo.allocatePayment(ctx(), u.id, { studentNo: NO, account: "tuition", amount: 70_000 }, NOW)).ok).toBe(true);
    let now = (await repo.listUnallocated(ctx())).find((x) => x.id === u.id)!;
    expect(now).toMatchObject({ remaining: 50_000, status: "open" });
    expect((await repo.listAccounts(ctx())).find((a) => a.no === NO)!.owed).toBe(owedBefore - 70_000);
    expect((await repo.allocatePayment(ctx(), u.id, { studentNo: NO, account: "tuition", amount: 50_000 }, NOW)).ok).toBe(true);
    now = (await repo.listUnallocated(ctx())).find((x) => x.id === u.id)!;
    expect(now).toMatchObject({ remaining: 0, status: "allocated" });
    expect(now.allocations).toHaveLength(2);
    expect(await repo.allocatePayment(ctx(), u.id, { studentNo: NO, account: "tuition", amount: 1 }, NOW)).toMatchObject({ ok: false });
    expect((await repo.listUnallocated(ctx())).at(-1)!.status).toBe("allocated");
  });
  it("refuses more than is left, more than is owed, nothing owed, and strangers", async () => {
    const u = (await repo.listUnallocated(ctx()))[0];
    expect(await repo.allocatePayment(ctx(), u.id, { studentNo: NO, account: "tuition", amount: u.remaining + 1 }, NOW)).toMatchObject({ ok: false });
    expect(await repo.allocatePayment(ctx(), u.id, { studentNo: NO, account: "tuition", amount: 99_999_999 }, NOW)).toMatchObject({ ok: false });
    const paid = (await repo.listAccounts(ctx())).find((a) => a.status === "paid")!;
    expect(await repo.allocatePayment(ctx(), u.id, { studentNo: paid.no, account: "tuition", amount: 100 }, NOW)).toMatchObject({ ok: false });
    expect(await repo.allocatePayment(ctx(), u.id, { studentNo: "NOPE", account: "tuition", amount: 100 }, NOW)).toMatchObject({ ok: false });
    expect(await repo.allocatePayment(ctx(), "up-9999", { studentNo: NO, account: "tuition", amount: 100 }, NOW)).toMatchObject({ ok: false });
  });
  it("sends an allocation back to unallocated when it is reversed", async () => {
    const u = (await repo.listUnallocated(ctx()))[0];
    const r = await repo.allocatePayment(ctx(), u.id, { studentNo: NO, account: "tuition", amount: 10_000 }, NOW);
    if (!r.ok || !r.id) throw new Error("no allocation");
    const owed = (await repo.listAccounts(ctx())).find((a) => a.no === NO)!.owed;
    expect((await repo.reversePayment(ctx(), r.id, "Wrong student", NOW)).ok).toBe(true);
    expect((await repo.listAccounts(ctx())).find((a) => a.no === NO)!.owed).toBe(owed + 10_000);
    const back = (await repo.listUnallocated(ctx())).find((x) => x.id === u.id)!;
    expect(back).toMatchObject({ remaining: u.remaining, status: "open" });
    expect(back.allocations[0].reversed).toBe(true);
  });
});

describe("bursaries and waivers", () => {
  const pending = async () => (await repo.listWaivers(ctx())).find((w) => w.status === "pending")!;
  it("takes the amount off the account only when approved", async () => {
    const w = await pending();
    const owed = () => repo.listAccounts(ctx()).then((a) => a.find((x) => x.no === w.studentNo)!.owed);
    const before = await owed();
    expect(await owed()).toBe(before);
    expect((await repo.decideWaiver(ctx(), w.id, "approve", "Approved by the board", NOW)).ok).toBe(true);
    expect(await owed()).toBe(before - w.amount);
    const done = (await repo.listWaivers(ctx())).find((x) => x.id === w.id)!;
    expect(done).toMatchObject({ status: "approved", decidedBy: "Bursar One", decisionNote: "Approved by the board" });
    const acc = (await repo.listAccounts(ctx())).find((a) => a.no === w.studentNo)!;
    expect(acc.billed - acc.paid - acc.waived).toBe(acc.owed);
    expect(await repo.decideWaiver(ctx(), w.id, "decline", "x", NOW)).toMatchObject({ ok: false });
  });
  it("leaves the account alone when declined", async () => {
    const w = await pending();
    const before = (await repo.listAccounts(ctx())).find((a) => a.no === w.studentNo)!.owed;
    expect((await repo.decideWaiver(ctx(), w.id, "decline", "Not eligible", NOW)).ok).toBe(true);
    expect((await repo.listAccounts(ctx())).find((a) => a.no === w.studentNo)!.owed).toBe(before);
  });
  it("refuses to approve once the account owes less than the request", async () => {
    // WV-0003 asks for the whole of that student's tuition; K 1 paid since leaves less owing than it asks.
    const w = (await repo.listWaivers(ctx())).find((x) => x.no === "WV-0003")!;
    const owed = (await repo.listAccounts(ctx())).find((a) => a.no === w.studentNo)!.lines.find((l) => l.kind === "tuition")!.owed;
    expect(owed).toBe(w.amount);
    await repo.allocatePayment(ctx(), (await repo.listUnallocated(ctx()))[0].id, { studentNo: w.studentNo, account: "tuition", amount: 100 }, NOW);
    expect(await repo.decideWaiver(ctx(), w.id, "approve", "", NOW)).toMatchObject({ ok: false });
    expect((await repo.listWaivers(ctx())).find((x) => x.id === w.id)!.status).toBe("pending");
  });
  it("records a request, and refuses one for more than is owed", async () => {
    const NO = studentsFor("high_school")[1].no;
    const ok = await repo.requestWaiver(ctx(), { studentNo: NO, kind: "discount", account: "tuition", amount: 10_000, source: "Head teacher", reason: "Sibling discount", requestedBy: "Head teacher" }, NOW);
    if (!ok.ok) throw new Error(ok.error);
    expect((await repo.listWaivers(ctx())).find((w) => w.id === ok.id)).toMatchObject({ status: "pending", requestedBy: "Head teacher" });
    expect(await repo.requestWaiver(ctx(), { studentNo: NO, kind: "discount", account: "tuition", amount: 999_999_999, source: "x", reason: "x", requestedBy: "x" }, NOW)).toMatchObject({ ok: false });
    expect(await repo.requestWaiver(ctx(), { studentNo: "NOPE", kind: "discount", account: "tuition", amount: 1, source: "x", reason: "x", requestedBy: "x" }, NOW)).toMatchObject({ ok: false });
  });
});

describe("validation", () => {
  it("needs a reason, trims it and caps it", () => {
    expect(checkReason("  Wrong   student ", "it is reversed")).toEqual({ ok: true, value: "Wrong student" });
    expect(checkReason("   ", "it is reversed")).toMatchObject({ ok: false, fields: { reason: expect.any(String) } });
    expect(checkReason(undefined, "x")).toMatchObject({ ok: false });
    expect(checkReason("x".repeat(500), "x").ok).toBe(false);
    expect(checkReason("", "x", false)).toEqual({ ok: true, value: "" });
  });
  it("checks an allocation against what is left and what is owed", () => {
    const c = { remaining: 65_000, owed: { tuition: 100_000, other: 0 } };
    expect(checkAllocation({ studentNo: "GR11-1042", account: "tuition", amount: "650" }, c)).toEqual({ ok: true, value: { studentNo: "GR11-1042", account: "tuition", amount: 65_000 } });
    for (const raw of [{ studentNo: "", account: "tuition", amount: "1" }, { studentNo: "A B", account: "tuition", amount: "1" }, { studentNo: "X1", account: "meals", amount: "1" }, { studentNo: "X1", account: "tuition", amount: "650.01" }, { studentNo: "X1", account: "other", amount: "1" }, { studentNo: "X1", account: "tuition", amount: "-1" }, { studentNo: "X1", account: "tuition", amount: 650 }]) {
      expect(checkAllocation(raw, c).ok, JSON.stringify(raw)).toBe(false);
    }
  });
  it("checks a waiver request and a decision", () => {
    const c = { kinds: ["tuition", "transport"] as const, owed: { tuition: 50_000 } };
    const good = { studentNo: "X1", kind: "bursary", account: "tuition", amount: "500", source: "Alumni fund", reason: "Award", requestedBy: "Head teacher" };
    expect(checkWaiver(good, { kinds: [...c.kinds], owed: c.owed })).toMatchObject({ ok: true, value: { amount: 50_000, kind: "bursary" } });
    for (const over of [{ kind: "gift" }, { account: "meals" }, { account: "transport" }, { amount: "500.01" }, { source: " " }, { reason: "" }, { requestedBy: "" }, { studentNo: "bad id" }]) {
      expect(checkWaiver({ ...good, ...over }, { kinds: [...c.kinds], owed: c.owed }).ok, JSON.stringify(over)).toBe(false);
    }
    expect(checkDecision("approve", "")).toEqual({ ok: true, value: { decision: "approve", note: "" } });
    expect(checkDecision("decline", "")).toMatchObject({ ok: false });
    expect(checkDecision("decline", "Not eligible")).toMatchObject({ ok: true });
    expect(checkDecision("maybe", "x").ok).toBe(false);
  });
});
