import { describe, expect, it } from "vitest";
import { INSTITUTION_TYPES } from "@/config/institution";
import { FEE_POLICIES, FEE_POLICY_LABELS, isFeePolicy, labelToPolicy, statusOf, withheldFor } from "@/lib/fee-policy";
import { feeNotice, showsAmount, withheldMessage } from "@/lib/student/fees";
import { studentTermsFor } from "@/lib/student/terms";
import { studentNoFor } from "@/lib/bursar/link";
import { mockBursarRepository, resetMockBursar } from "@/server/repositories/bursar-mock";
import { mockStudentRepository as repo } from "@/server/repositories/student-mock";
import { mockTenantDirectory } from "@/server/repositories/tenants-mock";

const owing = { balance: 185_000, dueOn: "2026-11-27", status: "due" as const };
const cleared = { balance: 0, dueOn: null, status: "paid" as const };

describe("Fee policy", () => {
  it("has a label for every policy and reads it back", () => {
    for (const p of FEE_POLICIES) expect(labelToPolicy(FEE_POLICY_LABELS[p])).toBe(p);
    expect(labelToPolicy("Delete everything")).toBeUndefined();
    expect(isFeePolicy("withhold_both")).toBe(true);
    expect(isFeePolicy("nope")).toBe(false);
    expect(isFeePolicy(undefined)).toBe(false);
  });
  it("withholds only what the policy names, and only while money is owed", () => {
    expect(withheldFor("inform", owing)).toEqual({ examCard: false, results: false });
    expect(withheldFor("withhold_exam_card", owing)).toEqual({ examCard: true, results: false });
    expect(withheldFor("withhold_results", owing)).toEqual({ examCard: false, results: true });
    expect(withheldFor("withhold_both", owing)).toEqual({ examCard: true, results: true });
    for (const p of FEE_POLICIES) expect(withheldFor(p, cleared)).toEqual({ examCard: false, results: false });
  });
  it("works out the status from balance and due date", () => {
    expect(statusOf(0, null, "2026-11-15")).toBe("paid");
    expect(statusOf(100, "2026-11-27", "2026-11-15")).toBe("due");
    expect(statusOf(100, "2026-11-06", "2026-11-15")).toBe("overdue");
    expect(statusOf(100, "2026-11-15", "2026-11-15")).toBe("due");
  });
});

describe("Student fee wording", () => {
  it("shows the amount to tertiary students only", () => {
    const school = studentTermsFor("high_school");
    const tertiary = studentTermsFor("college");
    expect(showsAmount(school)).toBe(false);
    expect(showsAmount(tertiary)).toBe(true);
    expect(withheldMessage(tertiary, owing).detail).toContain("K 1,850");
    expect(withheldMessage(school, owing).detail).not.toMatch(/K\s?\d/);
    expect(withheldMessage(school, owing).detail).toContain("parent or guardian");
    expect(withheldMessage(school, owing).title).toBe("Available once your balance is cleared");
  });
  it("says nothing when the balance is cleared and names what is held back", () => {
    const t = studentTermsFor("college");
    expect(feeNotice(t, cleared, "withhold_both", withheldFor("withhold_both", cleared))).toBeNull();
    const n = feeNotice(t, owing, "withhold_both", withheldFor("withhold_both", owing))!;
    expect(n.detail).toContain("exam card and result slip");
    expect(feeNotice(t, owing, "inform", withheldFor("inform", owing))!.detail).not.toContain("available once");
  });
  it("reads the balance from the Bursar's ledger for every school type", async () => {
    for (const type of INSTITUTION_TYPES) {
      resetMockBursar();
      const ctx = { tenantId: "t", studentId: "s", institutionType: type };
      const fee = await repo.getFees(ctx);
      const book = await mockBursarRepository.balanceOf({ tenantId: "t", bursarId: "b", bursarName: "B", institutionType: type, today: "2026-11-17" }, studentNoFor(type, "s"));
      expect(Number.isInteger(fee.balance) && fee.balance >= 0).toBe(true);
      expect(fee.balance).toBe(book!.balance);
      expect(fee.dueOn).toBe(book!.dueOn);
      expect(fee.status === "paid").toBe(fee.balance === 0);
    }
  });
  it("tells overdue from due only when it knows today's date", async () => {
    resetMockBursar();
    const base = { tenantId: "t", studentId: "mwamba", institutionType: "high_school" as const };
    expect((await repo.getFees(base)).status).toBe("due");
    expect((await repo.getFees({ ...base, today: "2026-11-17" })).status).toBe("overdue");
    expect((await repo.getFees({ ...base, today: "2026-11-01" })).status).toBe("due");
  });
});

describe("Per-school policy", () => {
  it("is saved on the school and survives other edits", async () => {
    const [first] = await mockTenantDirectory.list();
    const before = first.feePolicy;
    await mockTenantDirectory.update(first.id, { feePolicy: "withhold_both" });
    expect((await mockTenantDirectory.list()).find((t) => t.id === first.id)?.feePolicy).toBe("withhold_both");
    await mockTenantDirectory.update(first.id, { campuses: first.campuses });
    expect((await mockTenantDirectory.list()).find((t) => t.id === first.id)?.feePolicy).toBe("withhold_both");
    await mockTenantDirectory.update(first.id, { feePolicy: before });
  });
});

describe("withheldMessage for a parent", () => {
  it("shows the amount and sends the parent to the bursar, not back to themselves", async () => {
    const { withheldMessage } = await import("@/lib/student/fees");
    const { studentTermsFor } = await import("@/lib/student/terms");
    const m = withheldMessage(studentTermsFor("high_school"), { balance: 240_000, dueOn: "2026-11-27", status: "due" }, true);
    expect(m.detail).toContain("2,400");
    expect(m.detail).not.toContain("parent or guardian");
  });
});
