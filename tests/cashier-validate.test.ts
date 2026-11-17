import { describe, expect, it } from "vitest";
import { breakDown, checkCashUp, checkCounts, checkPayment, checkVoidReason, countedTotal, DENOMINATIONS, parseKwacha } from "@/lib/cashier/validate";
import { dayTotals, receiptNo } from "@/lib/cashier/totals";
import { cashierTermsFor } from "@/lib/cashier/terms";
import { startsPending } from "@/lib/cashier/methods";
import type { Receipt } from "@/types/cashier";

const owed = { tuition: 320_000, transport: 40_000 };
const base = { studentNo: "UNI-1048", account: "tuition", method: "cash", amount: 85_000, reference: "", note: "" };

describe("parseKwacha", () => {
  it("turns typed kwacha into integer ngwee without floats", () => {
    expect(parseKwacha("850")).toBe(85_000);
    expect(parseKwacha("850.5")).toBe(85_050);
    expect(parseKwacha("1,250.25")).toBe(125_025);
    expect(parseKwacha("0.05")).toBe(5);
    expect(parseKwacha(" 19.99 ")).toBe(1999);
  });
  it("refuses anything that is not a positive amount with at most two decimals", () => {
    for (const bad of ["", "0", "0.00", "-5", "1.234", "abc", "1e3", "K 50", "5.", ".5", undefined, 5, null]) expect(parseKwacha(bad)).toBeUndefined();
  });
});

describe("checkPayment", () => {
  it("accepts a cash payment within what is owed", () => {
    const r = checkPayment(base, { owed });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toMatchObject({ studentNo: "UNI-1048", account: "tuition", method: "cash", amount: 85_000, reference: "" });
  });
  it("refuses an amount above the balance, zero, fractions and unbilled accounts", () => {
    expect(checkPayment({ ...base, amount: 320_001 }, { owed }).ok).toBe(false);
    expect(checkPayment({ ...base, amount: 0 }, { owed }).ok).toBe(false);
    expect(checkPayment({ ...base, amount: 10.5 }, { owed }).ok).toBe(false);
    expect(checkPayment({ ...base, amount: Number.NaN }, { owed }).ok).toBe(false);
    expect(checkPayment({ ...base, account: "meals" }, { owed }).ok).toBe(false);
    expect(checkPayment({ ...base, account: "nonsense" }, { owed }).ok).toBe(false);
    expect(checkPayment({ ...base, account: "tuition" }, { owed: { tuition: 0 } }).ok).toBe(false);
  });
  it("accepts exactly the balance", () => {
    expect(checkPayment({ ...base, amount: 320_000 }, { owed }).ok).toBe(true);
  });
  it("needs a student and a known method", () => {
    expect(checkPayment({ ...base, studentNo: " " }, { owed }).ok).toBe(false);
    expect(checkPayment({ ...base, method: "bitcoin" }, { owed }).ok).toBe(false);
  });
  it("needs a reference for mobile money and bank, and drops one typed for cash", () => {
    expect(checkPayment({ ...base, method: "mtn_money" }, { owed }).ok).toBe(false);
    expect(checkPayment({ ...base, method: "bank_deposit", reference: "  " }, { owed }).ok).toBe(false);
    const ok = checkPayment({ ...base, method: "airtel_money", reference: "  AM-1  " }, { owed });
    expect(ok.ok && ok.value.reference).toBe("AM-1");
    const cash = checkPayment({ ...base, reference: "ignored" }, { owed });
    expect(cash.ok && cash.value.reference).toBe("");
  });
  it("limits the reference and note length", () => {
    expect(checkPayment({ ...base, method: "mtn_money", reference: "x".repeat(61) }, { owed }).ok).toBe(false);
    expect(checkPayment({ ...base, note: "x".repeat(201) }, { owed }).ok).toBe(false);
  });
});

describe("checkVoidReason", () => {
  it("requires a reason and trims it", () => {
    expect(checkVoidReason("").ok).toBe(false);
    expect(checkVoidReason("   ").ok).toBe(false);
    expect(checkVoidReason(undefined).ok).toBe(false);
    expect(checkVoidReason("x".repeat(201)).ok).toBe(false);
    const r = checkVoidReason("  Wrong   account ");
    expect(r.ok && r.value).toBe("Wrong account");
  });
});

describe("cash-up counting", () => {
  it("adds up the denominations", () => {
    expect(countedTotal({ "20000": 1, "5000": 2, "5": 3 })).toBe(30_015);
    expect(countedTotal({})).toBe(0);
  });
  it("breaks an amount into the fewest notes and coins and adds back to it", () => {
    for (const n of [0, 5, 85_000, 119_500, 123_455]) expect(countedTotal(breakDown(n))).toBe(n);
    expect(breakDown(30_000)).toEqual({ "20000": 1, "10000": 1 });
  });
  it("only accepts known denominations and whole counts", () => {
    expect(checkCounts({ "20000": 1 }).ok).toBe(true);
    expect(checkCounts({ "3": 1 }).ok).toBe(false);
    expect(checkCounts({ "20000": -1 }).ok).toBe(false);
    expect(checkCounts({ "20000": 1.5 }).ok).toBe(false);
    expect(checkCounts({ "20000": "2" }).ok).toBe(false);
    expect(checkCounts(null).ok).toBe(false);
    expect(checkCounts([1]).ok).toBe(false);
    expect(DENOMINATIONS[0]).toBe(20000);
    expect(DENOMINATIONS.at(-1)).toBe(5);
  });
  it("needs a reason only when the count differs", () => {
    const same = checkCashUp({ counts: { "10000": 1 } }, 10_000);
    expect(same.ok && same.value.variance).toBe(0);
    const short = checkCashUp({ counts: { "10000": 1 } }, 10_500);
    expect(short.ok).toBe(false);
    const withReason = checkCashUp({ counts: { "10000": 1 }, reason: " Change given " }, 10_500);
    expect(withReason.ok && withReason.value).toMatchObject({ variance: -500, reason: "Change given" });
    const over = checkCashUp({ counts: { "10000": 1, "500": 1 }, reason: "Found in the till" }, 10_000);
    expect(over.ok && over.value.variance).toBe(500);
  });
  it("drops a reason typed when nothing differs", () => {
    const r = checkCashUp({ counts: { "10000": 1 }, reason: "leftover" }, 10_000);
    expect(r.ok && r.value.reason).toBe("");
  });
});

describe("dayTotals", () => {
  const rc = (o: Partial<Receipt>): Receipt => ({ id: "x", no: "RC-1", studentNo: "S", studentName: "N", group: "G", account: "tuition", method: "cash", amount: 1000, reference: "", note: "", status: "success", at: "2026-11-16T08:00:00+02:00", date: "2026-11-16", cashier: "C", ...o });
  it("leaves voided receipts out and keeps pending money apart", () => {
    const t = dayTotals([rc({}), rc({ amount: 500, method: "mtn_money" }), rc({ amount: 700, status: "pending", method: "mtn_money" }), rc({ amount: 900, status: "voided" }), rc({ date: "2026-11-15", amount: 9999 })], "2026-11-16");
    expect(t).toMatchObject({ count: 3, collected: 1500, pending: 1, pendingAmount: 700, voided: 1, expectedCash: 1000 });
    expect(t.byMethod.mtn_money).toBe(500);
  });
});

describe("wording and numbering", () => {
  it("words schools and tertiary differently", () => {
    expect(cashierTermsFor("primary")).toMatchObject({ member: "Learner", group: "Class", tertiary: false });
    expect(cashierTermsFor("university")).toMatchObject({ member: "Student", group: "Programme", tertiary: true });
    expect(cashierTermsFor("university").accountKinds).toContain("accommodation");
    expect(cashierTermsFor("high_school").accountKinds).toContain("transport");
  });
  it("numbers receipts and starts only non-cash payments pending", () => {
    expect(receiptNo(2641)).toBe("RC-02641");
    expect(startsPending("cash")).toBe(false);
    expect(startsPending("mtn_money")).toBe(true);
    expect(startsPending("bank_deposit")).toBe(true);
  });
});
