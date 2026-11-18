import { beforeEach, describe, expect, it } from "vitest";
import { INSTITUTION_TYPES } from "@/config/institution";
import { nextInstalment, paidOnPlan, planDue, planProgress } from "@/lib/bursar/plans";
import { studentNoFor } from "@/lib/bursar/link";
import { bursarTermsFor } from "@/lib/bursar/terms";
import { studentsFor } from "@/lib/cashier/seed";
import { mockBursarRepository as bursar, resetMockBursar } from "@/server/repositories/bursar-mock";
import { mockCashierRepository as cashier } from "@/server/repositories/cashier-mock";
import { addOwed, dueOf, listPlans, owedOf, positionOf, savePlan } from "@/server/repositories/ledger-store";
import { mockStudentRepository as student } from "@/server/repositories/student-mock";
import type { PaymentPlan } from "@/types/bursar";

const scope = { tenantId: "t1", institutionType: "high_school" as const };
const bctx = { tenantId: "t1", bursarId: "b1", bursarName: "Bursar", institutionType: "high_school" as const, today: "2026-11-16" };
const cctx = { tenantId: "t1", cashierId: "c1", cashierName: "Cashier", institutionType: "high_school" as const, today: "2026-11-16" };
const sctx = { tenantId: "t1", studentId: "chisomo", institutionType: "high_school" as const, today: "2026-11-16" };
const NO = studentsFor("high_school")[0].no;

const plan = (over: Partial<PaymentPlan> = {}): PaymentPlan => ({
  id: "p1", studentNo: NO, startBalance: 300_000, instalments: [{ dueOn: "2026-12-01", amount: 100_000 }, { dueOn: "2027-01-01", amount: 100_000 }, { dueOn: "2027-02-01", amount: 100_000 }],
  note: "", status: "active", createdAt: "2026-11-16T10:00:00Z", createdBy: "Bursar", ...over,
});

beforeEach(() => resetMockBursar());

describe("plan arithmetic", () => {
  it("covers instalments in date order from what has been paid", () => {
    const p = plan();
    expect(paidOnPlan(p, 300_000)).toBe(0);
    expect(nextInstalment(p, 300_000)?.dueOn).toBe("2026-12-01");
    expect(planDue(p, 250_000)).toBe("2026-12-01");
    expect(planDue(p, 200_000)).toBe("2027-01-01");
    expect(planDue(p, 50_000)).toBe("2027-02-01");
    expect(planDue(p, 0)).toBeNull();
  });
  it("never counts more than was owed and is behind only after a missed date", () => {
    expect(paidOnPlan(plan(), 400_000)).toBe(0);
    expect(planProgress(plan(), 300_000, "2026-11-30").behind).toBe(false);
    expect(planProgress(plan(), 300_000, "2026-12-02").behind).toBe(true);
    expect(planProgress(plan(), 0, "2027-06-01")).toMatchObject({ done: true, behind: false, next: null });
  });
});

describe("one ledger for every role", () => {
  it("moves the student's balance when the cashier takes a payment", async () => {
    const before = (await student.getFees(sctx)).balance;
    const r = await cashier.recordPayment(cctx, { studentNo: NO, account: "tuition", method: "cash", amount: 100_000, reference: "", note: "" }, "2026-11-16T09:00:00Z");
    expect(r.ok).toBe(true);
    expect((await student.getFees(sctx)).balance).toBe(before - 100_000);
    expect((await bursar.balanceOf(bctx, NO))?.balance).toBe(before - 100_000);
  });
  it("puts the money back when that receipt is voided", async () => {
    const before = (await student.getFees(sctx)).balance;
    const r = await cashier.recordPayment(cctx, { studentNo: NO, account: "tuition", method: "cash", amount: 50_000, reference: "", note: "" }, "2026-11-16T09:00:00Z");
    if (!r.ok || !r.id) throw new Error("payment failed");
    await cashier.voidReceipt(cctx, r.id, "Wrong student", "2026-11-16T09:05:00Z");
    expect((await student.getFees(sctx)).balance).toBe(before);
  });
  it("keeps schools apart and knows only students on the roll", async () => {
    addOwed(scope, NO, "tuition", -10_000);
    expect(owedOf({ tenantId: "t2", institutionType: "high_school" }, NO, "tuition")).toBe(owedOf(scope, NO, "tuition") + 10_000);
    expect(await bursar.balanceOf(bctx, "NOPE-1")).toBeUndefined();
  });
  it("does not let an owed amount go below zero", () => {
    expect(addOwed(scope, NO, "tuition", -999_999_999)).toBe(0);
    expect(dueOf(scope, NO, "tuition")).toBeNull();
  });
});

describe("payment plans move the due date for everyone", () => {
  it("shows the next instalment as the due date, and the original once it is cancelled", async () => {
    const base = positionOf(scope, NO).dueOn;
    expect(base).not.toBeNull();
    savePlan(scope, plan({ startBalance: positionOf(scope, NO).balance }));
    expect(positionOf(scope, NO).dueOn).toBe("2026-12-01");
    expect((await student.getFees(sctx)).status).toBe("due");
    savePlan(scope, plan({ startBalance: positionOf(scope, NO).balance, status: "cancelled" }));
    expect(positionOf(scope, NO).dueOn).toBe(base);
    expect(listPlans(scope)).toHaveLength(1);
  });
});

describe("student link and wording", () => {
  it("finds a child by first name and falls back to the first student", () => {
    for (const type of INSTITUTION_TYPES) {
      const roll = studentsFor(type);
      expect(studentNoFor(type, "natasha")).toBe(roll[3].no);
      expect(studentNoFor(type, "dev-user")).toBe(roll[0].no);
    }
  });
  it("words payers and periods for the school's level", () => {
    expect(bursarTermsFor("primary")).toMatchObject({ payer: "Parent or guardian", period: "Term", member: "Learner" });
    expect(bursarTermsFor("university")).toMatchObject({ payer: "Sponsor", period: "Semester", member: "Student" });
  });
});
