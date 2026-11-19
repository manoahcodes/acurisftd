import { beforeEach, describe, expect, it } from "vitest";
import { INSTITUTION_TYPES } from "@/config/institution";
import { candidatesFor, missingCashUps, normRef, notOnStatement, parseStatement, reconcile, summarise, targetsOf } from "@/lib/bursar/reconcile";
import { checkCashUpReview, checkReceiveLine } from "@/lib/bursar/validate";
import { mockBursarRepository as repo, resetMockBursar } from "@/server/repositories/bursar-mock";
import type { BursarContext } from "@/server/repositories/bursar-types";
import type { Receipt } from "@/types/cashier";
import type { BankLine } from "@/types/bursar";

const TODAY = "2026-11-17";
const NOW = "2026-11-17T09:00:00.000Z";
const ctx = (over: Partial<BursarContext> = {}): BursarContext => ({ tenantId: "t1", bursarId: "b1", bursarName: "Bursar One", institutionType: "high_school", today: TODAY, ...over });
const view = async (c = ctx()) => {
  const [lines, payments, unallocated] = await Promise.all([repo.listBankLines(c), repo.listPayments(c), repo.listUnallocated(c)]);
  const targets = targetsOf(payments, unallocated);
  const views = reconcile(lines, targets);
  return { lines, targets, views, byRef: (r: string) => views.find((v) => v.line.reference === r)! };
};
const line = (id: string, reference: string, kwacha: number, date = "2026-11-16"): BankLine => ({ id, date, reference, amount: kwacha * 100, description: "", importedAt: NOW, importedBy: "x" });

beforeEach(() => resetMockBursar());

describe("reading a pasted statement", () => {
  it("reads both date styles, K amounts, descriptions with commas, and skips the header", () => {
    const r = parseStatement("Date,Reference,Amount,Description\n2026-11-16, ZNC-1, 750.00, ZNC deposit\n16/11/2026\tMP.2\tK1200\tMoMo, Kitwe\n", TODAY);
    expect(r.errors).toEqual([]);
    expect(r.lines).toEqual([
      { date: "2026-11-16", reference: "ZNC-1", amount: 75_000, description: "ZNC deposit" },
      { date: "2026-11-16", reference: "MP.2", amount: 120_000, description: "MoMo, Kitwe" },
    ]);
  });
  it("reports each unreadable row by number and keeps the good ones", () => {
    const r = parseStatement("2026-11-16,A1,100\nnot a date,A2,100\n2026-11-16,A3,abc\n2026-11-30,A4,100\n2026-11-16,,100\n2026-11-16", TODAY);
    expect(r.lines).toHaveLength(1);
    expect(r.errors.map((e) => e.row)).toEqual([2, 3, 4, 5, 6]);
  });
  it("caps a paste at 200 lines", () => {
    const text = Array.from({ length: 205 }, (_, i) => `2026-11-16,R${i},10`).join("\n");
    const r = parseStatement(text, TODAY);
    expect(r.lines).toHaveLength(200);
    expect(r.errors).toHaveLength(1);
  });
});

describe("matching", () => {
  it("ignores case and spaces in references", () => expect(normRef(" ZNC- 778213 ")).toBe(normRef("znc-778213")));
  it("matches each statement line to the right payment, and flags the rest", async () => {
    const { byRef } = await view();
    for (const r of ["MP261115.0930.B07", "MP261116.0810.A41", "ZNC-778213", "AM-5513902"]) expect(byRef(r).status).toBe("matched");
    expect(byRef("AM-5514417")).toMatchObject({ status: "matched", target: { status: "pending" } });
    expect(byRef("ZNC-778301")).toMatchObject({ status: "matched", target: { kind: "unallocated" } });
    expect(byRef("ZNC-778290")).toMatchObject({ status: "mismatch", target: { amount: 60_000 } });
    expect(byRef("ZNC-778350").status).toBe("unmatched");
    expect(byRef("BANK-CHG-1116").status).toBe("unmatched");
  });
  it("works the same for every kind of school", async () => {
    for (const type of INSTITUTION_TYPES) {
      const { views } = await view(ctx({ institutionType: type }));
      expect(summarise(views, []).matched).toBe(8);
    }
  });
  it("lets one payment be claimed by one line only", () => {
    const targets = [{ kind: "payment" as const, id: "p1", no: "RC-1", date: "2026-11-16", amount: 10_000, method: "bank_deposit" as const, reference: "X1", who: "A", status: "success" as const }];
    const views = reconcile([line("a", "X1", 100), line("b", "x1", 100, "2026-11-17")], targets);
    expect(views.map((v) => v.status)).toEqual(["matched", "unmatched"]);
  });
  it("does not match a reversed payment, so a reversal shows up against the bank", async () => {
    const c = ctx();
    const p = (await repo.listPayments(c)).find((x) => x.reference === "ZNC-778213")!;
    expect((await repo.reversePayment(c, p.id, "Wrong student", NOW)).ok).toBe(true);
    expect((await view(c)).byRef("ZNC-778213").status).toBe("unmatched");
  });
  it("lists what the books have that the statement does not", async () => {
    const { targets, views } = await view();
    expect(notOnStatement(targets, views).map((t) => t.reference)).toEqual(["ZNC-778290"]);
  });
  it("adds up the summary", async () => {
    const { views, targets } = await view();
    const s = summarise(views, notOnStatement(targets, views));
    expect(s).toMatchObject({ lines: 11, matched: 8, mismatched: 1, unmatched: 2, unmatchedAmount: 65_000 + 80_000 + 1_500 });
    expect(s.notOnStatementAmount).toBe(60_000);
  });
});

describe("working a line", () => {
  it("imports new lines, skips a reference already loaded, and matches them on arrival", async () => {
    const c = ctx();
    const r = await repo.importBankLines(c, [{ date: "2026-11-16", reference: "NEW-1", amount: 10_000, description: "" }, { date: "2026-11-16", reference: "zng-778213", amount: 1, description: "" }, { date: "2026-11-16", reference: "ZNC-778213", amount: 1, description: "" }], NOW);
    expect(r).toEqual({ ok: true, added: 2, duplicates: 1 });
    expect(await repo.importBankLines(c, [], NOW)).toMatchObject({ ok: false });
  });
  it("takes an unknown deposit in as unallocated, which then matches itself", async () => {
    const c = ctx();
    const l = (await view(c)).byRef("ZNC-778350").line;
    const r = await repo.receiveBankLine(c, l.id, { method: "bank_deposit", payer: "Mr Banda" });
    expect(r.ok).toBe(true);
    const up = (await repo.listUnallocated(c)).find((u) => u.reference === "ZNC-778350")!;
    expect(up).toMatchObject({ amount: 80_000, remaining: 80_000, payer: "Mr Banda", status: "open" });
    expect((await view(c)).byRef("ZNC-778350")).toMatchObject({ status: "matched", target: { kind: "unallocated" } });
    expect((await repo.receiveBankLine(c, l.id, { method: "bank_deposit", payer: "" })).ok).toBe(false);
  });
  it("will not take in a mismatch, and keeps the reference single-use", async () => {
    const c = ctx();
    const l = (await view(c)).byRef("ZNC-778290").line;
    expect((await repo.receiveBankLine(c, l.id, { method: "bank_deposit", payer: "" })).ok).toBe(false);
  });
  it("sets a line aside with a reason, keeps it listed, and puts it back", async () => {
    const c = ctx();
    const l = (await view(c)).byRef("BANK-CHG-1116").line;
    expect((await repo.ignoreBankLine(c, l.id, "Bank charge", NOW)).ok).toBe(true);
    expect((await view(c)).byRef("BANK-CHG-1116")).toMatchObject({ status: "ignored", line: { ignored: { reason: "Bank charge", by: "Bursar One" } } });
    expect((await repo.ignoreBankLine(c, l.id, "again", NOW)).ok).toBe(false);
    expect((await repo.restoreBankLine(c, l.id)).ok).toBe(true);
    expect((await view(c)).byRef("BANK-CHG-1116").status).toBe("unmatched");
    expect((await repo.restoreBankLine(c, l.id)).ok).toBe(false);
  });
  it("will not set aside a line that is matched", async () => {
    const c = ctx();
    const l = (await view(c)).byRef("ZNC-778213").line;
    expect((await repo.ignoreBankLine(c, l.id, "x", NOW)).ok).toBe(false);
  });
  it("matches by hand only for the same amount, and undoes it", async () => {
    const c = ctx();
    const { byRef, targets, views } = await view(c);
    const l = byRef("ZNC-778350").line;
    expect(candidatesFor(l, targets, views)).toHaveLength(0);
    const mismatch = byRef("ZNC-778290");
    const t = mismatch.target!;
    expect((await repo.matchBankLine(c, mismatch.line.id, { kind: t.kind, id: t.id }, NOW)).ok).toBe(false);
    // Import a line with another reference but the right amount, then match it by hand.
    await repo.importBankLines(c, [{ date: "2026-11-16", reference: "ZNC-OTHER", amount: 60_000, description: "" }], NOW);
    const added = (await view(c)).byRef("ZNC-OTHER");
    expect((await repo.matchBankLine(c, added.line.id, { kind: t.kind, id: t.id }, NOW)).ok).toBe(true);
    expect((await view(c)).byRef("ZNC-OTHER")).toMatchObject({ status: "matched", manual: true });
    expect((await repo.matchBankLine(c, added.line.id, { kind: t.kind, id: t.id }, NOW)).ok).toBe(false);
    expect((await repo.restoreBankLine(c, added.line.id)).ok).toBe(true);
    expect((await view(c)).byRef("ZNC-OTHER").status).toBe("unmatched");
    expect((await repo.matchBankLine(c, "bl-9999", { kind: t.kind, id: t.id }, NOW)).ok).toBe(false);
  });
  it("keeps one school's statement away from another's", async () => {
    await repo.importBankLines(ctx(), [{ date: "2026-11-16", reference: "ONLY-T1", amount: 100, description: "" }], NOW);
    expect((await repo.listBankLines(ctx({ tenantId: "t2" }))).some((l) => l.reference === "ONLY-T1")).toBe(false);
  });
});

describe("cash-ups", () => {
  it("lists the school's cash-ups with their review, and the seeded one is short", async () => {
    const book = await repo.listCashUps(ctx());
    expect(book.rows.length).toBeGreaterThan(0);
    expect(book.rows[0].review).toBeUndefined();
    expect(book.rows[0].cashUp.variance).toBe(-500);
    expect(book.missing).toEqual([]);
  });
  it("verifies, then queries, keeping only the latest review", async () => {
    const c = ctx();
    const { cashUp } = (await repo.listCashUps(c)).rows[0];
    const key = { date: cashUp.date, cashier: cashUp.submittedBy };
    expect((await repo.reviewCashUp(c, { ...key, status: "verified", note: "" }, NOW)).ok).toBe(true);
    expect((await repo.listCashUps(c)).rows[0].review).toMatchObject({ status: "verified", by: "Bursar One" });
    expect((await repo.reviewCashUp(c, { ...key, status: "queried", note: "Where did K5 go?" }, NOW)).ok).toBe(true);
    expect((await repo.listCashUps(c)).rows[0].review).toMatchObject({ status: "queried", note: "Where did K5 go?" });
    expect((await repo.reviewCashUp(c, { date: "2026-01-01", cashier: "Nobody", status: "verified", note: "" }, NOW)).ok).toBe(false);
  });
  it("finds earlier days with cash taken and no cash-up", () => {
    const r = (id: string, date: string, method: Receipt["method"], status: Receipt["status"], cashier = "Ann"): Receipt => ({ id, no: id, studentNo: "S", studentName: "S", group: "G", account: "tuition", method, amount: 10_000, reference: "", note: "", status, at: `${date}T09:00:00Z`, date, cashier });
    const missing = missingCashUps([r("1", "2026-11-16", "cash", "success"), r("2", "2026-11-16", "cash", "success"), r("3", "2026-11-17", "cash", "success"), r("4", "2026-11-15", "mtn_money", "success"), r("5", "2026-11-14", "cash", "voided"), r("6", "2026-11-13", "cash", "success", "Ben")], [{ date: "2026-11-13", counts: {}, counted: 0, expected: 0, variance: 0, reason: "", submittedAt: "", submittedBy: "Ben" }], TODAY);
    expect(missing).toEqual([{ date: "2026-11-16", cashier: "Ann", expectedCash: 20_000 }]);
  });
  it("needs a note to query, and checks inputs", () => {
    expect(checkCashUpReview({ date: "2026-11-16", cashier: "Ann", status: "queried", note: "" }).ok).toBe(false);
    expect(checkCashUpReview({ date: "2026-11-16", cashier: "Ann", status: "verified" }).ok).toBe(true);
    expect(checkCashUpReview({ date: "x", cashier: "Ann", status: "verified" }).ok).toBe(false);
    expect(checkCashUpReview({ date: "2026-11-16", cashier: "Ann", status: "meh" }).ok).toBe(false);
    expect(checkReceiveLine({ method: "cash" }).ok).toBe(false);
    expect(checkReceiveLine({ method: "bank_deposit", payer: "A" }).ok).toBe(true);
  });
});
