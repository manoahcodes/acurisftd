import { describe, expect, it } from "vitest";
import { INSTITUTION_TYPES } from "@/config/institution";
import { buildStatement } from "@/lib/parent/fees";
import { FEE_SEED } from "@/lib/student/fees";

describe("buildStatement", () => {
  for (const type of INSTITUTION_TYPES) {
    it(`agrees with the Student fee position at a ${type}`, () => {
      const fee = FEE_SEED[type];
      const s = buildStatement(type, "chisomo", fee, "Term 3 2026");
      expect(s.billed - s.paid).toBe(fee.balance);
      expect(s.balance).toBe(fee.balance);
      expect(s.ledger.at(-1)!.balance).toBe(fee.balance);
      expect(s.invoice.lines.reduce((n, l) => n + l.amount, 0)).toBe(s.invoice.total);
      expect(s.receipts.reduce((n, r) => n + r.amount, 0)).toBe(s.paid);
    });
  }

  it("has no receipts when nothing has been paid and never goes negative", () => {
    const s = buildStatement("college", "x", { balance: 99_999_999, dueOn: "2026-11-06", status: "overdue" }, "Semester 2 2026");
    expect(s.paid).toBe(0);
    expect(s.receipts).toEqual([]);
    expect(s.balance).toBeLessThanOrEqual(s.billed);
  });
});
