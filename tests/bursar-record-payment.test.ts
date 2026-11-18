import { beforeEach, describe, expect, it } from "vitest";
import { BACKDATE_DAYS, checkRecordPayment } from "@/lib/bursar/validate";
import { studentsFor } from "@/lib/cashier/seed";
import { addDays } from "@/lib/teacher/dates";
import { mockBursarRepository as repo, resetMockBursar } from "@/server/repositories/bursar-mock";
import type { BursarContext } from "@/server/repositories/bursar-types";
import { mockStudentRepository as student } from "@/server/repositories/student-mock";

const TODAY = "2026-11-17";
const NOW = "2026-11-17T09:00:00.000Z";
const ctx = (over: Partial<BursarContext> = {}): BursarContext => ({ tenantId: "t1", bursarId: "b1", bursarName: "Bursar One", institutionType: "high_school", today: TODAY, ...over });
const NO = studentsFor("high_school")[0].no;
const owed = { tuition: 360_000, other: 0 };
const base = { studentNo: NO, account: "tuition", method: "bank_deposit", amount: "1,000", date: TODAY, reference: "ZNC-1", note: "" };
const env = (taken: Array<[string, string]> = []) => ({ owed, today: TODAY, taken: new Map(taken) });

beforeEach(() => resetMockBursar());

describe("checkRecordPayment", () => {
  it("accepts a bank deposit and converts to ngwee", () => {
    expect(checkRecordPayment(base, env())).toEqual({ ok: true, value: { studentNo: NO, account: "tuition", method: "bank_deposit", amount: 100_000, date: TODAY, reference: "ZNC-1", note: "" } });
  });
  it("needs a reference for anything but cash, and drops it for cash", () => {
    expect(checkRecordPayment({ ...base, reference: " " }, env())).toMatchObject({ ok: false, fields: { reference: expect.any(String) } });
    expect(checkRecordPayment({ ...base, method: "cash", reference: "ignored" }, env())).toMatchObject({ ok: true, value: { reference: "" } });
  });
  it("refuses a reference that is already used, whatever its case", () => {
    expect(checkRecordPayment({ ...base, reference: "zNc-1" }, env([["znc-1", "BP-00003"]]))).toMatchObject({ ok: false, error: "That reference is already on BP-00003." });
  });
  it("refuses more than is owed, nothing owed, bad amounts and unknown methods or accounts", () => {
    expect(checkRecordPayment({ ...base, amount: "3,600.01" }, env())).toMatchObject({ ok: false, fields: { amount: expect.any(String) } });
    expect(checkRecordPayment({ ...base, account: "other" }, env())).toMatchObject({ ok: false, fields: { account: expect.any(String) } });
    expect(checkRecordPayment({ ...base, account: "meals" }, env()).ok).toBe(false);
    for (const amount of ["", "0", "-1", "1.234", "x", 100]) expect(checkRecordPayment({ ...base, amount }, env()).ok, String(amount)).toBe(false);
    expect(checkRecordPayment({ ...base, method: "barter" }, env()).ok).toBe(false);
    expect(checkRecordPayment({ ...base, studentNo: "bad no" }, env()).ok).toBe(false);
  });
  it("limits the date to the past 120 days", () => {
    expect(checkRecordPayment({ ...base, date: addDays(TODAY, -BACKDATE_DAYS) }, env()).ok).toBe(true);
    expect(checkRecordPayment({ ...base, date: addDays(TODAY, -BACKDATE_DAYS - 1) }, env())).toMatchObject({ ok: false, fields: { date: expect.any(String) } });
    expect(checkRecordPayment({ ...base, date: "2026-11-18" }, env())).toMatchObject({ ok: false, fields: { date: expect.any(String) } });
    expect(checkRecordPayment({ ...base, date: "2026-02-30" }, env()).ok).toBe(false);
  });
});

describe("recording a payment", () => {
  const input = { studentNo: NO, account: "tuition" as const, method: "bank_deposit" as const, amount: 100_000, date: TODAY, reference: "ZNC-9001", note: "Term fees" };
  const owedNow = async () => (await repo.listAccounts(ctx())).find((a) => a.no === NO)!.owed;

  it("moves the balance for every role and lists the payment", async () => {
    const before = await owedNow();
    const r = await repo.recordPayment(ctx(), input, NOW);
    if (!r.ok) throw new Error(r.error);
    expect(await owedNow()).toBe(before - 100_000);
    expect((await student.getFees({ tenantId: "t1", studentId: "chisomo", institutionType: "high_school", today: TODAY })).balance).toBe(before - 100_000);
    const p = (await repo.listPayments(ctx())).find((x) => x.id === r.id)!;
    expect(p).toMatchObject({ source: "bursar", status: "success", by: "Bursar One", amount: 100_000, reference: "ZNC-9001", date: TODAY, at: NOW });
    const acc = (await repo.listAccounts(ctx())).find((a) => a.no === NO)!;
    expect(acc.billed - acc.paid - acc.waived).toBe(acc.owed);
  });
  it("dates a back-dated payment on the day it arrived, which the statement shows", async () => {
    const r = await repo.recordPayment(ctx(), { ...input, date: "2026-11-10" }, NOW);
    if (!r.ok) throw new Error(r.error);
    const p = (await repo.listPayments(ctx())).find((x) => x.id === r.id)!;
    expect(p.date).toBe("2026-11-10");
    expect((await repo.getStatement(ctx(), NO))!.entries.some((e) => e.date === "2026-11-10" && e.kind === "payment")).toBe(true);
  });
  it("will not count the same reference twice, including one waiting in unallocated payments", async () => {
    expect((await repo.recordPayment(ctx(), input, NOW)).ok).toBe(true);
    expect(await repo.recordPayment(ctx(), { ...input, amount: 100 }, NOW)).toMatchObject({ ok: false });
    const waiting = (await repo.listUnallocated(ctx()))[0];
    expect(await repo.recordPayment(ctx(), { ...input, reference: waiting.reference.toLowerCase() }, NOW)).toMatchObject({ ok: false, error: expect.stringContaining(waiting.no) });
  });
  it("lets a reference be used again once the payment on it is reversed", async () => {
    const r = await repo.recordPayment(ctx(), input, NOW);
    if (!r.ok || !r.id) throw new Error("no payment");
    await repo.reversePayment(ctx(), r.id, "Bounced", NOW);
    expect((await repo.recordPayment(ctx(), input, NOW)).ok).toBe(true);
  });
  it("refuses a stranger, an unknown account, more than owed, and nothing owed", async () => {
    expect(await repo.recordPayment(ctx(), { ...input, studentNo: "NOPE" }, NOW)).toMatchObject({ ok: false });
    expect(await repo.recordPayment(ctx(), { ...input, account: "accommodation" as never }, NOW)).toMatchObject({ ok: false });
    expect(await repo.recordPayment(ctx(), { ...input, amount: 999_999_999, reference: "ZNC-2" }, NOW)).toMatchObject({ ok: false });
    const cleared = (await repo.listAccounts(ctx())).find((a) => a.owed === 0)!;
    expect(await repo.recordPayment(ctx(), { ...input, studentNo: cleared.no, reference: "ZNC-3" }, NOW)).toMatchObject({ ok: false });
  });
  it("keeps one school's payments out of another's", async () => {
    await repo.recordPayment(ctx(), input, NOW);
    expect((await repo.listPayments(ctx({ tenantId: "t2" }))).some((p) => p.reference === "ZNC-9001")).toBe(false);
  });
});
