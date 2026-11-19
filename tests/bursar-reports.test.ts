import { beforeEach, describe, expect, it } from "vitest";
import { INSTITUTION_TYPES } from "@/config/institution";
import { collections, inRange, positionByGroup, rangeOf, reversedIn, waiverSummary } from "@/lib/bursar/reports";
import { mockBursarRepository as repo, resetMockBursar } from "@/server/repositories/bursar-mock";
import type { BursarContext } from "@/server/repositories/bursar-types";

const TODAY = "2026-11-17";
const NOW = "2026-11-17T09:00:00.000Z";
const ctx = (over: Partial<BursarContext> = {}): BursarContext => ({ tenantId: "t1", bursarId: "b1", bursarName: "Bursar One", institutionType: "high_school", today: TODAY, ...over });
const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);

beforeEach(() => resetMockBursar());

describe("ranges", () => {
  it("builds each preset inclusive of today", () => {
    expect(rangeOf("today", TODAY)).toEqual({ from: TODAY, to: TODAY });
    expect(rangeOf("7d", TODAY)).toEqual({ from: "2026-11-11", to: TODAY });
    expect(rangeOf("30d", TODAY).from).toBe("2026-10-19");
    expect(rangeOf("90d", TODAY).from).toBe("2026-08-20");
  });
  it("includes both ends", () => {
    const r = { from: "2026-11-01", to: "2026-11-05" };
    expect(["2026-10-31", "2026-11-01", "2026-11-05", "2026-11-06"].map((d) => inRange(d, r))).toEqual([false, true, true, false]);
  });
});

describe("collections", () => {
  it("counts only successful payments, and every breakdown adds to the total", async () => {
    for (const type of INSTITUTION_TYPES) {
      const payments = await repo.listPayments(ctx({ institutionType: type }));
      const c = collections(payments, rangeOf("90d", TODAY));
      const expected = payments.filter((p) => p.status === "success" && p.date >= rangeOf("90d", TODAY).from && p.date <= TODAY).reduce((n, p) => n + p.amount, 0);
      expect(c.total).toBe(expected);
      expect(sum(c.byAccount)).toBe(c.total);
      expect(sum(c.byMethod)).toBe(c.total);
      expect(c.byDay.reduce((n, d) => n + d.amount, 0)).toBe(c.total);
      expect(c.byDay.reduce((n, d) => n + d.count, 0)).toBe(c.count);
      for (let i = 1; i < c.byDay.length; i++) expect(c.byDay[i - 1].date > c.byDay[i].date).toBe(true);
    }
  });
  it("leaves out pending and reversed payments, and a narrower range collects less", async () => {
    const c0 = ctx();
    const payments = await repo.listPayments(c0);
    const wide = collections(payments, rangeOf("90d", TODAY));
    expect(collections(payments, rangeOf("today", TODAY)).total).toBeLessThan(wide.total);
    const target = payments.find((p) => p.status === "success" && p.source === "cashier")!;
    await repo.reversePayment(c0, target.id, "Entered twice", NOW);
    const after = collections(await repo.listPayments(c0), rangeOf("90d", TODAY));
    expect(after.total).toBe(wide.total - target.amount);
    expect(after.count).toBe(wide.count - 1);
  });
  it("lists reversals by the day they were made", async () => {
    const c0 = ctx();
    const p = (await repo.listPayments(c0)).find((x) => x.status === "success" && x.source === "bursar")!;
    await repo.reversePayment(c0, p.id, "Wrong student", NOW);
    const all = await repo.listPayments(c0);
    expect(reversedIn(all, rangeOf("today", TODAY)).map((x) => x.id)).toContain(p.id);
    expect(reversedIn(all, { from: "2026-01-01", to: "2026-11-16" })).toHaveLength(0);
  });
});

describe("fee position", () => {
  it("keeps billed less paid less waived equal to owed in every row and in the total", async () => {
    for (const type of INSTITUTION_TYPES) {
      const accounts = await repo.listAccounts(ctx({ institutionType: type }));
      const { rows, total } = positionByGroup(accounts);
      for (const g of [...rows, total]) {
        expect(g.billed - g.paid - g.waived).toBe(g.owed);
        expect(g.rate).toBeGreaterThanOrEqual(0);
        expect(g.rate).toBeLessThanOrEqual(100);
      }
      expect(rows.reduce((n, g) => n + g.students, 0)).toBe(accounts.length);
      expect(rows.reduce((n, g) => n + g.owed, 0)).toBe(total.owed);
    }
  });
  it("calls a group with nothing due fully paid", () => expect(positionByGroup([]).total.rate).toBe(100));
});

describe("bursaries", () => {
  it("totals approved awards by type within the range, and counts those still waiting", async () => {
    const waivers = await repo.listWaivers(ctx());
    const s = waiverSummary(waivers, { from: "2026-09-01", to: TODAY });
    expect(s.approved.map((a) => a.kind)).toEqual(["bursary", "waiver", "discount"]);
    const approved = waivers.filter((w) => w.status === "approved");
    expect(s.approvedAmount).toBe(approved.reduce((n, w) => n + w.amount, 0));
    expect(s.pending).toBe(waivers.filter((w) => w.status === "pending").length);
    expect(waiverSummary(waivers, { from: "2026-11-01", to: TODAY }).approvedAmount).toBe(0);
  });
});
