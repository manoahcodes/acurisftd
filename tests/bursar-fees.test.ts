import { beforeEach, describe, expect, it } from "vitest";
import { INSTITUTION_TYPES } from "@/config/institution";
import { feesForGroup, gradeOf, groupsFor, inEffect, sameScope, scopeLabel, scopeMatches, seedFeeItems } from "@/lib/bursar/fees";
import { feeRows, feeState, feeStateLabel } from "@/lib/bursar/format";
import { bursarTermsFor } from "@/lib/bursar/terms";
import { checkFeeItem, isIsoDate, type RawFee } from "@/lib/bursar/validate";
import { studentsFor } from "@/lib/cashier/seed";
import { mockBursarRepository as repo, resetMockBursar } from "@/server/repositories/bursar-mock";
import type { BursarContext } from "@/server/repositories/bursar-types";

const TODAY = "2026-11-17";
const NOW = "2026-11-17T08:00:00.000Z";
const ctx = (over: Partial<BursarContext> = {}): BursarContext => ({ tenantId: "t1", bursarId: "b1", bursarName: "Bursar One", institutionType: "high_school", today: TODAY, ...over });
const env = { type: "high_school" as const, groups: groupsFor("high_school") };
const raw = (over: Partial<RawFee> = {}): RawFee => ({ name: "Sports levy", kind: "other", amount: "250", scope: { kind: "all" }, frequency: "period", billing: "everyone", dueOn: "2026-12-01", effectiveFrom: "2026-11-20", active: true, ...over });

beforeEach(() => resetMockBursar());

describe("scopes", () => {
  it("reads the grade out of a class name", () => {
    expect(gradeOf("Grade 11A")).toBe(11);
    expect(gradeOf("Grade 7")).toBe(7);
    expect(gradeOf("BSc Nursing")).toBeUndefined();
  });
  it("matches everyone, a grade range, or one programme", () => {
    expect(scopeMatches({ kind: "all" }, "anything")).toBe(true);
    expect(scopeMatches({ kind: "grades", from: 10, to: 11 }, "Grade 11A")).toBe(true);
    expect(scopeMatches({ kind: "grades", from: 10, to: 11 }, "Grade 12")).toBe(false);
    expect(scopeMatches({ kind: "grades", from: 10, to: 11 }, "BSc Nursing")).toBe(false);
    expect(scopeMatches({ kind: "group", group: "BSc Nursing" }, "BSc Nursing")).toBe(true);
    expect(scopeMatches({ kind: "group", group: "BSc Nursing" }, "BA Accounting & Finance")).toBe(false);
  });
  it("labels them and tells two scopes apart", () => {
    expect(scopeLabel({ kind: "all" })).toBe("Everyone");
    expect(scopeLabel({ kind: "grades", from: 8, to: 9 })).toBe("Grades 8–9");
    expect(scopeLabel({ kind: "grades", from: 12, to: 12 })).toBe("Grade 12");
    expect(sameScope({ kind: "grades", from: 1, to: 2 }, { kind: "grades", from: 1, to: 2 })).toBe(true);
    expect(sameScope({ kind: "all" }, { kind: "grades", from: 1, to: 12 })).toBe(false);
  });
});

describe("the sample structure", () => {
  it("bills every class or programme on the roll, for every school type", () => {
    for (const type of INSTITUTION_TYPES) {
      const items = seedFeeItems(type);
      const terms = bursarTermsFor(type);
      for (const g of groupsFor(type)) {
        const f = feesForGroup(items, g, TODAY);
        expect(f.perPeriod, `${type} ${g}`).toBeGreaterThan(0);
        expect(f.required.some((x) => x.kind === "tuition")).toBe(true);
      }
      for (const it of items) {
        expect(terms.accountKinds).toContain(it.kind);
        expect(Number.isInteger(it.amount) && it.amount > 0).toBe(true);
        expect(it.dueOn >= it.effectiveFrom).toBe(true);
      }
      expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
    }
  });
  it("uses the Admin sample amounts for tuition", () => {
    const hs = feesForGroup(seedFeeItems("high_school"), "Grade 11A", TODAY);
    expect(hs.required.find((f) => f.kind === "tuition")!.amount).toBe(260_000);
    const uni = feesForGroup(seedFeeItems("university"), "BSc Computer Science", TODAY);
    expect(uni.required.find((f) => f.kind === "tuition")!.amount).toBe(1_450_000);
  });
  it("splits per-period, once-a-year and optional fees, and leaves out fees not yet in effect", () => {
    const f = feesForGroup(seedFeeItems("high_school"), "Grade 11A", TODAY);
    expect(f.perPeriod).toBe(260_000 + 35_000 + 45_000);
    expect(f.perYear).toBe(20_000);
    expect(f.optional.map((x) => x.name)).toEqual(["Boarding"]);
    // Transport is off and starts next year, so it is not offered yet.
    expect(feesForGroup(seedFeeItems("primary"), "Grade 3B", TODAY).optional.map((x) => x.name)).toEqual(["Boarding"]);
    const turnedOn = seedFeeItems("primary").map((f) => (f.name === "Transport" ? { ...f, active: true } : f));
    expect(feesForGroup(turnedOn, "Grade 3B", TODAY).optional.map((x) => x.name)).toEqual(["Boarding"]);
    expect(feesForGroup(turnedOn, "Grade 3B", "2027-01-02").optional.map((x) => x.name)).toEqual(["Boarding", "Transport"]);
  });
  it("only counts a fee once it is on and its date has come", () => {
    expect(inEffect({ active: true, effectiveFrom: TODAY }, TODAY)).toBe(true);
    expect(inEffect({ active: true, effectiveFrom: "2026-11-18" }, TODAY)).toBe(false);
    expect(inEffect({ active: false, effectiveFrom: "2026-01-01" }, TODAY)).toBe(false);
    expect(feeState({ active: true, effectiveFrom: "2026-12-01" }, TODAY)).toBe("scheduled");
    expect(feeStateLabel({ active: false, effectiveFrom: "2026-01-01" }, TODAY)).toBe("Off");
  });
  it("makes a row for the CSV and print for each fee", () => {
    const items = seedFeeItems("high_school");
    const rows = feeRows(items, "Term", TODAY);
    expect(rows).toHaveLength(items.length);
    expect(rows[0]).toEqual(["Tuition", "Tuition", "Grades 8–9", "K 2,100", "Per term", "Everyone it applies to", "Fri 27 Nov 2026", "Active"]);
  });
});

describe("checkFeeItem", () => {
  it("accepts a good fee and converts kwacha to ngwee", () => {
    const c = checkFeeItem(raw({ amount: "1,250.50" }), env);
    expect(c).toMatchObject({ ok: true, value: { name: "Sports levy", amount: 125_050, kind: "other", active: true } });
  });
  it("refuses a missing name, an unknown account and a bad amount", () => {
    expect(checkFeeItem(raw({ name: " " }), env)).toMatchObject({ ok: false, fields: { name: expect.any(String) } });
    expect(checkFeeItem(raw({ kind: "accommodation" }), env)).toMatchObject({ ok: false, fields: { kind: expect.any(String) } });
    for (const amount of ["", "0", "-5", "12.345", "abc", 500, undefined]) expect(checkFeeItem(raw({ amount }), env)).toMatchObject({ ok: false, fields: { amount: expect.any(String) } });
    expect(checkFeeItem(raw({ amount: "9999999" }), env).ok).toBe(false);
  });
  it("accepts grade ranges at a school and programmes at a college, and nothing else", () => {
    expect(checkFeeItem(raw({ scope: { kind: "grades", from: 8, to: 9 } }), env)).toMatchObject({ ok: true, value: { scope: { kind: "grades", from: 8, to: 9 } } });
    for (const bad of [{ kind: "grades", from: 9, to: 8 }, { kind: "grades", from: 0, to: 3 }, { kind: "grades", from: 1, to: 13 }, { kind: "grades", from: "x", to: 3 }, { kind: "group", group: "BSc Nursing" }, { kind: "nonsense" }]) {
      expect(checkFeeItem(raw({ scope: bad }), env).ok, JSON.stringify(bad)).toBe(false);
    }
    const uni = { type: "university" as const, groups: groupsFor("university") };
    expect(checkFeeItem(raw({ scope: { kind: "group", group: "BSc Nursing" } }), uni).ok).toBe(true);
    expect(checkFeeItem(raw({ scope: { kind: "group", group: "Not a programme" } }), uni).ok).toBe(false);
    expect(checkFeeItem(raw({ scope: { kind: "grades", from: 1, to: 2 } }), uni).ok).toBe(false);
  });
  it("refuses bad dates, a due date before it takes effect, and a forged id", () => {
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("2026-11-17")).toBe(true);
    expect(checkFeeItem(raw({ effectiveFrom: "soon" }), env)).toMatchObject({ ok: false, fields: { effectiveFrom: expect.any(String) } });
    expect(checkFeeItem(raw({ dueOn: "2026-11-01" }), env)).toMatchObject({ ok: false, fields: { dueOn: expect.any(String) } });
    expect(checkFeeItem(raw({ id: "../../etc" }), env).ok).toBe(false);
    expect(checkFeeItem(raw({ frequency: "weekly" }), env).ok).toBe(false);
    expect(checkFeeItem(raw({ billing: "maybe" }), env).ok).toBe(false);
  });
});

describe("fee repository", () => {
  it("starts from the sample structure and adds a fee", async () => {
    const before = await repo.listFees(ctx());
    expect(before.length).toBe(seedFeeItems("high_school").length);
    const input = checkFeeItem(raw(), env);
    if (!input.ok) throw new Error(input.error);
    const r = await repo.saveFee(ctx(), input.value, NOW);
    expect(r.ok).toBe(true);
    const after = await repo.listFees(ctx());
    expect(after).toHaveLength(before.length + 1);
    expect(after.at(-1)).toMatchObject({ name: "Sports levy", updatedBy: "Bursar One", updatedAt: NOW });
  });
  it("changes a fee in place and refuses an identical one", async () => {
    const [first] = await repo.listFees(ctx());
    const edit = checkFeeItem({ ...raw({ name: first.name, kind: first.kind, amount: "2,700" }), id: first.id, scope: first.scope }, env);
    if (!edit.ok) throw new Error(edit.error);
    expect((await repo.saveFee(ctx(), edit.value, NOW)).ok).toBe(true);
    expect((await repo.listFees(ctx())).find((f) => f.id === first.id)!.amount).toBe(270_000);
    const dup = checkFeeItem({ ...raw({ name: first.name.toUpperCase(), kind: first.kind, amount: "1" }), scope: first.scope }, env);
    if (!dup.ok) throw new Error(dup.error);
    expect(await repo.saveFee(ctx(), dup.value, NOW)).toMatchObject({ ok: false });
  });
  it("refuses to change a fee that is not in this school", async () => {
    const input = checkFeeItem({ ...raw(), id: "fee-9999" }, env);
    if (!input.ok) throw new Error(input.error);
    expect(await repo.saveFee(ctx(), input.value, NOW)).toMatchObject({ ok: false });
    expect(await repo.setFeeActive(ctx(), "fee-9999", false, NOW)).toMatchObject({ ok: false });
  });
  it("turns a fee off without deleting it, and keeps schools apart", async () => {
    const [first] = await repo.listFees(ctx());
    expect((await repo.setFeeActive(ctx(), first.id, false, NOW)).ok).toBe(true);
    const all = await repo.listFees(ctx());
    expect(all).toHaveLength(seedFeeItems("high_school").length);
    expect(all.find((f) => f.id === first.id)!.active).toBe(false);
    expect((await repo.listFees(ctx({ tenantId: "t2" }))).find((f) => f.id === first.id)!.active).toBe(true);
  });
  it("lists the classes on the roll", async () => {
    expect(await repo.listGroups(ctx())).toEqual(groupsFor("high_school"));
    expect(new Set(await repo.listGroups(ctx({ institutionType: "university" })))).toEqual(new Set(studentsFor("university").map((s) => s.group)));
  });
});
