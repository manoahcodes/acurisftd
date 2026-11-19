import { beforeEach, describe, expect, it } from "vitest";
import { INSTITUTION_TYPES } from "@/config/institution";
import { groupsFor, seedFeeItems } from "@/lib/bursar/fees";
import { canCancel, invoiceViews, nextPeriodLabel, planInvoices, suggestedDue } from "@/lib/bursar/invoices";
import { periodLabel, seedInvoices } from "@/lib/bursar/seed";
import { checkCharge, checkGenerate } from "@/lib/bursar/validate";
import { studentsFor } from "@/lib/cashier/seed";
import { mockBursarRepository as repo, resetMockBursar } from "@/server/repositories/bursar-mock";
import type { BursarContext } from "@/server/repositories/bursar-types";
import type { GenerateInput } from "@/types/bursar";

const TODAY = "2026-11-17";
const NOW = "2026-11-17T09:00:00.000Z";
const ctx = (over: Partial<BursarContext> = {}): BursarContext => ({ tenantId: "t1", bursarId: "b1", bursarName: "Bursar One", institutionType: "high_school", today: TODAY, ...over });
const run: GenerateInput = { period: "Term 1 2027", dueOn: "2027-01-29", includeAnnual: false, groups: [] };
const roll = studentsFor("high_school");
const views = async (c = ctx()) => {
  const accounts = await repo.listAccounts(c);
  return invoiceViews(await repo.listInvoices(c), accounts.map((a) => ({ no: a.no, name: a.name, group: a.group, lines: a.lines })), TODAY);
};

beforeEach(() => resetMockBursar());

describe("periods and due dates", () => {
  it("names the next period, rolling over the year", () => {
    expect(nextPeriodLabel("high_school", "Term 2 2026")).toBe("Term 3 2026");
    expect(nextPeriodLabel("high_school", "Term 3 2026")).toBe("Term 1 2027");
    expect(nextPeriodLabel("university", "Semester 1 2026")).toBe("Semester 2 2026");
    expect(nextPeriodLabel("university", "Semester 2 2026")).toBe("Semester 1 2027");
    expect(nextPeriodLabel("primary", periodLabel("primary"))).toBe("Term 1 2027");
  });
  it("suggests the fees' own due date while it is ahead, and a month out once it has passed", () => {
    const fees = seedFeeItems("high_school");
    expect(suggestedDue(fees, "2026-11-17")).toBe("2026-11-27");
    expect(suggestedDue(fees, "2026-12-05")).toBe("2027-01-04");
  });
});

describe("planning a run", () => {
  const fees = seedFeeItems("high_school");
  const students = roll.map((s) => ({ no: s.no, name: s.name, group: s.group }));
  it("bills every student the structure applies to, from fees that are on, in effect and billed to everyone", () => {
    const { drafts, skipped } = planInvoices(fees, students, [], run, TODAY);
    expect(drafts).toHaveLength(roll.length);
    expect(skipped).toHaveLength(0);
    const g11 = drafts.find((d) => d.studentNo === roll[0].no)!;
    expect(g11.lines.map((l) => l.name)).toEqual(["Tuition", "Registration", "Examination"]);
    expect(g11.total).toBe(260_000 + 35_000 + 45_000);
    expect(drafts.every((d) => d.lines.every((l) => l.name !== "Boarding" && l.name !== "Transport"))).toBe(true);
  });
  it("adds once-a-year fees only when asked, and limits the run to chosen classes", () => {
    const withYear = planInvoices(fees, students, [], { ...run, includeAnnual: true }, TODAY).drafts[0];
    expect(withYear.lines.map((l) => l.name)).toContain("Library & ICT levy");
    const one = planInvoices(fees, students, [], { ...run, groups: ["Grade 11A"] }, TODAY);
    expect(one.drafts.map((d) => d.studentNo)).toEqual([roll[0].no]);
  });
  it("skips anyone already invoiced for the period and anyone no fee applies to", () => {
    const existing = seedInvoices("high_school");
    const again = planInvoices(fees, students, existing, { ...run, period: periodLabel("high_school") }, TODAY);
    expect(again.drafts).toHaveLength(0);
    expect(again.skipped.every((s) => s.reason === "already invoiced")).toBe(true);
    const none = planInvoices(fees.map((f) => ({ ...f, active: false })), students, [], run, TODAY);
    expect(none.drafts).toHaveLength(0);
    expect(none.skipped[0].reason).toBe("no fees apply");
    const cancelled = existing.map((i) => ({ ...i, cancelled: { reason: "x", at: NOW, by: "b" } }));
    expect(planInvoices(fees, students, cancelled, { ...run, period: periodLabel("high_school") }, TODAY).drafts).toHaveLength(roll.length);
  });
});

describe("what has been paid on an invoice", () => {
  it("splits every sample invoice into paid and outstanding that add up, for every school type", async () => {
    for (const type of INSTITUTION_TYPES) {
      resetMockBursar();
      const c = ctx({ institutionType: type });
      const accounts = await repo.listAccounts(c);
      const vs = invoiceViews(await repo.listInvoices(c), accounts.map((a) => ({ no: a.no, name: a.name, group: a.group, lines: a.lines })), TODAY);
      expect(vs.length).toBeGreaterThan(0);
      for (const v of vs) expect(v.paid + v.outstanding, `${type} ${v.invoice.no}`).toBe(v.invoice.total);
      for (const a of accounts) expect(vs.filter((v) => v.invoice.studentNo === a.no).reduce((n, v) => n + v.outstanding, 0)).toBe(a.owed);
    }
  });
  it("calls an invoice paid, partly paid or overdue", async () => {
    const vs = await views();
    expect(vs.some((v) => v.status === "paid")).toBe(true);
    expect(vs.some((v) => v.status === "overdue")).toBe(true);
    expect(vs.find((v) => v.status === "paid")!.outstanding).toBe(0);
    expect(vs.filter((v) => v.status === "overdue").every((v) => v.outstanding > 0 && v.invoice.dueOn < TODAY)).toBe(true);
  });
  it("gives what is still owed to the newest invoice first", () => {
    const old = { id: "inv-a", no: "A", studentNo: "S1", period: "P1", issuedOn: "2026-01-01", dueOn: "2026-12-01", lines: [{ kind: "tuition" as const, name: "Tuition", amount: 1000 }], total: 1000 };
    const recent = { ...old, id: "inv-b", no: "B", period: "P2", issuedOn: "2026-06-01" };
    const [b, a] = invoiceViews([old, recent], [{ no: "S1", name: "N", group: "G", lines: [{ kind: "tuition", owed: 1200 }] }], TODAY);
    expect(b.invoice.id).toBe("inv-b");
    expect([b.outstanding, a.outstanding]).toEqual([1000, 200]);
    expect(canCancel(b)).toBe(true);
    expect(canCancel(a)).toBe(false);
  });
});

describe("generating invoices", () => {
  it("makes the invoices, adds to what is owed, and keeps the books adding up", async () => {
    const before = await repo.listAccounts(ctx());
    const r = await repo.generateInvoices(ctx(), run, NOW);
    if (!r.ok) throw new Error(r.error);
    expect(r.created).toBe(roll.length);
    const after = await repo.listAccounts(ctx());
    for (const a of after) {
      const b = before.find((x) => x.no === a.no)!;
      expect(a.owed).toBeGreaterThan(b.owed);
      expect(a.billed - a.paid - a.waived).toBe(a.owed);
      expect((await repo.getStatement(ctx(), a.no))!.entries.at(-1)!.balance).toBe(a.owed);
    }
    expect(after.reduce((n, a) => n + a.owed, 0) - before.reduce((n, a) => n + a.owed, 0)).toBe(r.total);
    const inv = (await repo.listInvoices(ctx())).find((i) => i.period === run.period)!;
    expect(inv).toMatchObject({ issuedOn: TODAY, dueOn: "2027-01-29" });
    expect(inv.no).toMatch(/^INV-2026-\d{4}$/);
  });
  it("never bills anyone twice", async () => {
    await repo.generateInvoices(ctx(), run, NOW);
    expect(await repo.generateInvoices(ctx(), run, NOW)).toMatchObject({ ok: false });
    expect((await repo.listInvoices(ctx())).filter((i) => i.period === run.period)).toHaveLength(roll.length);
  });
  it("keeps an overdue account's earlier due date and gives a cleared one the new date", async () => {
    const overdue = (await repo.listAccounts(ctx())).find((a) => a.status === "overdue")!;
    const cleared = (await repo.listAccounts(ctx())).find((a) => a.owed === 0)!;
    await repo.generateInvoices(ctx(), run, NOW);
    const accounts = await repo.listAccounts(ctx());
    expect(accounts.find((a) => a.no === overdue.no)!.dueOn).toBe(overdue.dueOn);
    expect(accounts.find((a) => a.no === overdue.no)!.status).toBe("overdue");
    expect(accounts.find((a) => a.no === cleared.no)!.dueOn).toBe("2027-01-29");
  });
  it("moves the student's fee balance too", async () => {
    const { mockStudentRepository: student } = await import("@/server/repositories/student-mock");
    const before = (await student.getFees({ tenantId: "t1", studentId: "chisomo", institutionType: "high_school", today: TODAY })).balance;
    await repo.generateInvoices(ctx(), { ...run, groups: ["Grade 11A"] }, NOW);
    expect((await student.getFees({ tenantId: "t1", studentId: "chisomo", institutionType: "high_school", today: TODAY })).balance).toBe(before + 340_000);
  });
  it("works for every school type", async () => {
    for (const type of INSTITUTION_TYPES) {
      resetMockBursar();
      const c = ctx({ institutionType: type });
      const r = await repo.generateInvoices(c, { ...run, period: nextPeriodLabel(type, periodLabel(type)) }, NOW);
      expect(r.ok, type).toBe(true);
      for (const a of await repo.listAccounts(c)) expect(a.billed - a.paid - a.waived).toBe(a.owed);
    }
  });
});

describe("charging one fee", () => {
  const NO = roll[0].no;
  const boarding = async () => (await repo.listFees(ctx())).find((f) => f.name === "Boarding")!;
  const input = async () => ({ studentNo: NO, feeId: (await boarding()).id, period: "Term 3 2026", dueOn: "2026-12-04" });
  it("adds an optional fee once per student and period", async () => {
    const before = (await repo.listAccounts(ctx())).find((a) => a.no === NO)!;
    const r = await repo.chargeFee(ctx(), await input(), NOW);
    expect(r.ok).toBe(true);
    const after = (await repo.listAccounts(ctx())).find((a) => a.no === NO)!;
    expect(after.owed).toBe(before.owed + 320_000);
    expect(after.billed - after.paid - after.waived).toBe(after.owed);
    expect(await repo.chargeFee(ctx(), await input(), NOW)).toMatchObject({ ok: false });
    expect((await repo.chargeFee(ctx(), { ...(await input()), period: "Term 1 2027" }, NOW)).ok).toBe(true);
  });
  it("refuses a fee that is off, a stranger, an unknown fee, and one that does not apply", async () => {
    const transport = (await repo.listFees(ctx())).find((f) => f.name === "Transport")!;
    expect(await repo.chargeFee(ctx(), { ...(await input()), feeId: transport.id }, NOW)).toMatchObject({ ok: false });
    expect(await repo.chargeFee(ctx(), { ...(await input()), studentNo: "NOPE" }, NOW)).toMatchObject({ ok: false });
    expect(await repo.chargeFee(ctx(), { ...(await input()), feeId: "fee-9999" }, NOW)).toMatchObject({ ok: false });
    const tuition = (await repo.listFees(ctx())).find((f) => f.name === "Tuition" && f.scope.kind === "grades" && f.scope.from === 12)!;
    expect(await repo.chargeFee(ctx(), { ...(await input()), feeId: tuition.id }, NOW)).toMatchObject({ ok: false, error: expect.stringContaining("does not apply") });
  });
});

describe("cancelling an invoice", () => {
  it("takes an unpaid invoice off what is owed, keeps it listed, and ties the statement", async () => {
    await repo.generateInvoices(ctx(), { ...run, groups: ["Grade 11A"] }, NOW);
    const inv = (await repo.listInvoices(ctx())).find((i) => i.period === run.period)!;
    const owed = (await repo.listAccounts(ctx())).find((a) => a.no === inv.studentNo)!.owed;
    expect((await repo.cancelInvoice(ctx(), inv.id, "Issued by mistake", NOW)).ok).toBe(true);
    const a = (await repo.listAccounts(ctx())).find((x) => x.no === inv.studentNo)!;
    expect(a.owed).toBe(owed - inv.total);
    expect(a.billed - a.paid - a.waived).toBe(a.owed);
    const listed = (await repo.listInvoices(ctx())).find((i) => i.id === inv.id)!;
    expect(listed.cancelled).toMatchObject({ reason: "Issued by mistake", by: "Bursar One" });
    expect((await views()).find((v) => v.invoice.id === inv.id)!.status).toBe("cancelled");
    const st = (await repo.getStatement(ctx(), inv.studentNo))!;
    expect(st.entries.some((e) => e.kind === "cancellation")).toBe(true);
    expect(st.entries.at(-1)!.balance).toBe(a.owed);
    expect(await repo.cancelInvoice(ctx(), inv.id, "Again", NOW)).toMatchObject({ ok: false });
    // the period can be invoiced again once cancelled
    expect((await repo.generateInvoices(ctx(), { ...run, groups: ["Grade 11A"] }, NOW)).ok).toBe(true);
  });
  it("refuses an invoice that has been paid on, and one that is not in this school", async () => {
    const paid = (await views()).find((v) => v.paid > 0)!;
    expect(await repo.cancelInvoice(ctx(), paid.invoice.id, "x", NOW)).toMatchObject({ ok: false });
    expect(await repo.cancelInvoice(ctx(), "inv-9999", "x", NOW)).toMatchObject({ ok: false });
  });
});

describe("validation", () => {
  const env = { groups: groupsFor("high_school"), today: TODAY };
  it("checks an invoice run", () => {
    expect(checkGenerate({ period: " Term 1  2027 ", dueOn: "2027-01-29", includeAnnual: true, groups: ["Grade 11A", "Grade 11A"] }, env)).toEqual({ ok: true, value: { period: "Term 1 2027", dueOn: "2027-01-29", includeAnnual: true, groups: ["Grade 11A"] } });
    expect(checkGenerate({ period: "Term 1 2027", dueOn: TODAY }, env)).toMatchObject({ ok: true, value: { includeAnnual: false, groups: [] } });
    for (const bad of [{ period: "T" }, { period: "x".repeat(60) }, { dueOn: "2026-11-16" }, { dueOn: "later" }, { groups: "all" }, { groups: ["Grade 99Z"] }, { groups: [1] }]) {
      expect(checkGenerate({ period: "Term 1 2027", dueOn: "2027-01-29", ...bad }, env).ok, JSON.stringify(bad)).toBe(false);
    }
  });
  it("checks a single charge", () => {
    expect(checkCharge({ studentNo: "GR11-1042", feeId: "fee-13", period: "Term 1 2027", dueOn: "2027-01-29" }, { today: TODAY }).ok).toBe(true);
    for (const bad of [{ studentNo: "" }, { feeId: "../x" }, { period: "" }, { dueOn: "2020-01-01" }, { dueOn: "x" }]) {
      expect(checkCharge({ studentNo: "GR11-1042", feeId: "fee-13", period: "Term 1 2027", dueOn: "2027-01-29", ...bad }, { today: TODAY }).ok, JSON.stringify(bad)).toBe(false);
    }
  });
});
