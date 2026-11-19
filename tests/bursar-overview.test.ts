import { beforeEach, describe, expect, it } from "vitest";
import { INSTITUTION_TYPES } from "@/config/institution";
import { overviewOf } from "@/lib/bursar/overview";
import { mockBursarRepository as repo, resetMockBursar } from "@/server/repositories/bursar-mock";
import type { BursarContext } from "@/server/repositories/bursar-types";

const TODAY = "2026-11-17";
const NOW = "2026-11-17T09:00:00.000Z";
const ctx = (over: Partial<BursarContext> = {}): BursarContext => ({ tenantId: "t1", bursarId: "b1", bursarName: "Bursar One", institutionType: "high_school", today: TODAY, ...over });
const overview = async (c = ctx()) =>
  overviewOf({ accounts: await repo.listAccounts(c), payments: await repo.listPayments(c), unallocated: await repo.listUnallocated(c), waivers: await repo.listWaivers(c), plans: await repo.listPlans(c), book: await repo.listCashUps(c), lines: await repo.listBankLines(c), today: c.today });

beforeEach(() => resetMockBursar());

describe("overview figures", () => {
  it("agrees with the books for every kind of school", async () => {
    for (const type of INSTITUTION_TYPES) {
      const c = ctx({ institutionType: type });
      const o = await overview(c);
      const accounts = await repo.listAccounts(c);
      expect(o.owed).toBe(accounts.reduce((n, a) => n + a.owed, 0));
      expect(o.debtors).toBe(accounts.filter((a) => a.owed > 0).length);
      expect(o.today.mobile + o.today.bank + o.today.cash).toBe(o.collectedToday);
      expect(o.today.mobileCount + o.today.bankCount + o.today.cashCount).toBe(o.paymentsToday);
      expect(o.reconciliation).toBe(o.cashUpsToReview + o.daysNotCashedUp + o.statementIssues);
    }
  });
  it("shows today's sample day: pending receipts are not collected", async () => {
    const o = await overview();
    expect(o.collectedToday).toBeGreaterThan(0);
    expect(o.openUnallocated).toBe(3);
    expect(o.unallocatedAmount).toBe(235_000);
    expect(o.pendingWaivers).toBe(2);
    expect(o.statementIssues).toBe(3);
    expect(o.cashUpsToReview).toBe(1);
  });
  it("moves when the books move", async () => {
    const c = ctx();
    const before = await overview(c);
    const { cashUp } = (await repo.listCashUps(c)).rows[0];
    await repo.reviewCashUp(c, { date: cashUp.date, cashier: cashUp.submittedBy, status: "verified", note: "" }, NOW);
    const after = await overview(c);
    expect(after.cashUpsToReview).toBe(before.cashUpsToReview - 1);
    expect(after.reconciliation).toBe(before.reconciliation - 1);
  });
  it("counts a plan that is behind", async () => {
    const c = ctx();
    const a = (await repo.listAccounts(c)).find((x) => x.owed > 0)!;
    await repo.createPlan(c, { studentNo: a.no, count: 2, firstDueOn: "2026-11-17", note: "" }, NOW);
    expect((await overview({ ...c, today: "2026-11-30" })).behindPlans).toBe(1);
    expect((await overview(c)).behindPlans).toBe(0);
  });
});
