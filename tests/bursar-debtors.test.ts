import { beforeEach, describe, expect, it } from "vitest";
import { INSTITUTION_TYPES } from "@/config/institution";
import { BUCKETS, agingTotals, bucketOf, daysBetween, debtorsOf } from "@/lib/bursar/debtors";
import { addMonths, buildSchedule } from "@/lib/bursar/plans";
import { checkPlan, checkReminder } from "@/lib/bursar/validate";
import { mockBursarRepository as repo, resetMockBursar } from "@/server/repositories/bursar-mock";
import type { BursarContext } from "@/server/repositories/bursar-types";

const TODAY = "2026-11-17";
const NOW = "2026-11-17T09:00:00.000Z";
const ctx = (over: Partial<BursarContext> = {}): BursarContext => ({ tenantId: "t1", bursarId: "b1", bursarName: "Bursar One", institutionType: "high_school", today: TODAY, ...over });
const owing = async (c = ctx()) => (await repo.listAccounts(c)).filter((a) => a.owed > 0);

beforeEach(() => resetMockBursar());

describe("ageing", () => {
  it("counts whole days and puts them in the right bucket at each edge", () => {
    expect(daysBetween("2026-11-01", "2026-11-17")).toBe(16);
    expect([0, 1, 30, 31, 60, 61, 90, 91].map(bucketOf)).toEqual(["current", "d1_30", "d1_30", "d31_60", "d31_60", "d61_90", "d61_90", "d90_plus"]);
  });
  it("lists only people who owe, oldest first, and the buckets add up to everything owed", async () => {
    for (const type of INSTITUTION_TYPES) {
      const c = ctx({ institutionType: type });
      const accounts = await repo.listAccounts(c);
      const debtors = debtorsOf(accounts, await repo.listPlans(c), await repo.listReminders(c), TODAY);
      expect(debtors.every((d) => d.account.owed > 0)).toBe(true);
      expect(debtors.length).toBe(accounts.filter((a) => a.owed > 0).length);
      for (let i = 1; i < debtors.length; i++) expect(debtors[i - 1].daysOverdue).toBeGreaterThanOrEqual(debtors[i].daysOverdue);
      const totals = agingTotals(debtors);
      expect(totals.map((t) => t.bucket)).toEqual(BUCKETS);
      expect(totals.reduce((n, t) => n + t.amount, 0)).toBe(debtors.reduce((n, d) => n + d.account.owed, 0));
    }
  });
});

describe("schedules", () => {
  it("clamps month ends and rolls the year", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2028-01-31", 1)).toBe("2028-02-29");
    expect(addMonths("2026-11-30", 3)).toBe("2027-02-28");
    expect(addMonths("2026-12-15", 1)).toBe("2027-01-15");
  });
  it("splits equally with the odd ngwee on the last instalment, always adding to the total", () => {
    const s = buildSchedule(100_001, 3, "2026-12-01");
    expect(s.map((i) => i.amount)).toEqual([33_333, 33_333, 33_335]);
    expect(s.map((i) => i.dueOn)).toEqual(["2026-12-01", "2027-01-01", "2027-02-01"]);
    for (const [total, n] of [[1, 1], [999, 7], [250_000, 12]] as const) expect(buildSchedule(total, n, "2026-12-01").reduce((x, i) => x + i.amount, 0)).toBe(total);
  });
});

describe("validating a plan", () => {
  const env = { owed: 100_000, today: TODAY, hasActivePlan: false };
  const ok = { studentNo: "S-1", count: 3, firstDueOn: "2026-12-01", note: "" };
  it("accepts a sound plan", () => expect(checkPlan(ok, env).ok).toBe(true));
  it("rejects each bad input", () => {
    expect(checkPlan({ ...ok, studentNo: "" }, env).ok).toBe(false);
    expect(checkPlan(ok, { ...env, owed: 0 }).ok).toBe(false);
    expect(checkPlan(ok, { ...env, hasActivePlan: true }).ok).toBe(false);
    for (const count of [1, 13, 2.5, "x"]) expect(checkPlan({ ...ok, count }, env).ok).toBe(false);
    expect(checkPlan({ ...ok, firstDueOn: "2026-11-16" }, env).ok).toBe(false);
    expect(checkPlan({ ...ok, firstDueOn: "2027-03-01" }, env).ok).toBe(false);
    expect(checkPlan({ ...ok, firstDueOn: "soon" }, env).ok).toBe(false);
    expect(checkPlan({ ...ok, note: "x".repeat(500) }, env).ok).toBe(false);
  });
  it("validates reminders", () => {
    expect(checkReminder({ studentNo: "S-1", channel: "sms", note: "" }).ok).toBe(true);
    expect(checkReminder({ studentNo: "S-1", channel: "pigeon" }).ok).toBe(false);
    expect(checkReminder({ studentNo: "", channel: "sms" }).ok).toBe(false);
  });
});

describe("plans in the repository", () => {
  it("agrees a plan that adds up to what is owed, and makes the next instalment the due date", async () => {
    const c = ctx();
    const a = (await owing(c))[0];
    const r = await repo.createPlan(c, { studentNo: a.no, count: 4, firstDueOn: "2026-12-01", note: "Agreed with parent" }, NOW);
    expect(r.ok).toBe(true);
    const [plan] = await repo.listPlans(c);
    expect(plan.status).toBe("active");
    expect(plan.startBalance).toBe(a.owed);
    expect(plan.instalments).toHaveLength(4);
    expect(plan.instalments.reduce((n, i) => n + i.amount, 0)).toBe(a.owed);
    const after = (await repo.listAccounts(c)).find((x) => x.no === a.no)!;
    expect(after.onPlan).toBe(true);
    expect(after.dueOn).toBe("2026-12-01");
    expect(after.owed).toBe(a.owed);
  });
  it("allows one active plan per student, and refuses someone who owes nothing", async () => {
    const c = ctx();
    const accounts = await repo.listAccounts(c);
    const a = accounts.find((x) => x.owed > 0)!;
    const input = { studentNo: a.no, count: 2, firstDueOn: "2026-12-01", note: "" };
    expect((await repo.createPlan(c, input, NOW)).ok).toBe(true);
    expect((await repo.createPlan(c, input, NOW)).ok).toBe(false);
    const cleared = accounts.find((x) => x.owed <= 0);
    if (cleared) expect((await repo.createPlan(c, { ...input, studentNo: cleared.no }, NOW)).ok).toBe(false);
    expect((await repo.createPlan(c, { ...input, studentNo: "NOPE-1" }, NOW)).ok).toBe(false);
  });
  it("cancels with the plan kept on record, restoring the original due date, and cannot cancel twice", async () => {
    const c = ctx();
    const a = (await owing(c))[0];
    const was = a.dueOn;
    const { ok, id } = (await repo.createPlan(c, { studentNo: a.no, count: 2, firstDueOn: "2026-12-01", note: "" }, NOW)) as { ok: true; id: string };
    expect(ok).toBe(true);
    expect((await repo.cancelPlan(c, id, "Family withdrew", NOW)).ok).toBe(true);
    const [plan] = await repo.listPlans(c);
    expect(plan).toMatchObject({ status: "cancelled", cancelReason: "Family withdrew" });
    const after = (await repo.listAccounts(c)).find((x) => x.no === a.no)!;
    expect(after.onPlan).toBe(false);
    expect(after.dueOn).toBe(was);
    expect((await repo.cancelPlan(c, id, "again", NOW)).ok).toBe(false);
    expect((await repo.cancelPlan(c, "plan-9999", "x", NOW)).ok).toBe(false);
  });
  it("keeps one school's plans out of another's", async () => {
    const a = (await owing(ctx()))[0];
    await repo.createPlan(ctx(), { studentNo: a.no, count: 2, firstDueOn: "2026-12-01", note: "" }, NOW);
    expect(await repo.listPlans(ctx({ tenantId: "t2" }))).toHaveLength(0);
  });
});

describe("reminders", () => {
  it("records who chased whom, newest first, and shows the latest against the debtor", async () => {
    const c = ctx();
    const a = (await owing(c))[0];
    expect((await repo.recordReminder(c, { studentNo: a.no, channel: "sms", note: "First" }, "2026-11-10T09:00:00.000Z")).ok).toBe(true);
    expect((await repo.recordReminder(c, { studentNo: a.no, channel: "call", note: "Second" }, NOW)).ok).toBe(true);
    const reminders = await repo.listReminders(c);
    expect(reminders.map((r) => r.note)).toEqual(["Second", "First"]);
    expect(reminders[0].by).toBe("Bursar One");
    const d = debtorsOf(await repo.listAccounts(c), await repo.listPlans(c), reminders, TODAY).find((x) => x.account.no === a.no)!;
    expect(d.lastReminder?.channel).toBe("call");
  });
  it("refuses an unknown student and one who owes nothing, and keeps schools apart", async () => {
    const c = ctx();
    expect((await repo.recordReminder(c, { studentNo: "NOPE-1", channel: "sms", note: "" }, NOW)).ok).toBe(false);
    const cleared = (await repo.listAccounts(c)).find((x) => x.owed <= 0);
    if (cleared) expect((await repo.recordReminder(c, { studentNo: cleared.no, channel: "sms", note: "" }, NOW)).ok).toBe(false);
    const a = (await owing(c))[0];
    await repo.recordReminder(c, { studentNo: a.no, channel: "email", note: "" }, NOW);
    expect(await repo.listReminders(ctx({ tenantId: "t2" }))).toHaveLength(0);
  });
});
