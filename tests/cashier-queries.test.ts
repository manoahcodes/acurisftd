import { beforeEach, describe, expect, it } from "vitest";
import { cashierDashboard, cashierNotifications, searchCashier } from "@/server/queries/cashier-queries";
import { mockCashierRepository as repo, resetMockCashier } from "@/server/repositories/cashier-mock";
import { cashierTermsFor } from "@/lib/cashier/terms";
import { breakDown } from "@/lib/cashier/validate";
import { dashboards } from "@/server/repositories";
import type { CashierContext } from "@/server/repositories/cashier-types";

const ctx: CashierContext = { tenantId: "t1", cashierId: "c1", cashierName: "Cashier One", institutionType: "university", today: "2026-11-16" };
const s = { ctx, terms: cashierTermsFor("university") };
const NOW = "2026-11-16T12:00:00.000Z";
const school = { tenantId: "t1", tenantName: "Test University", campus: "Main", institutionType: "university" as const };

beforeEach(() => resetMockCashier());

describe("cashier dashboard, bell and search", () => {
  it("takes the dashboard figures from the desk's own records", async () => {
    const data = await cashierDashboard(await dashboards.getDashboard("cashier", school), s);
    const day = await repo.getDay(ctx, ctx.today);
    const kpi = (t: string) => data.kpis.find((k) => k.title === t)!;
    expect(kpi("Transactions today").value).toBe(String(day.count));
    expect(kpi("Pending receipts").value).toBe(String(day.pending));
    expect(data.sections.find((x) => x.title === "Recent transactions")!.rows.length).toBeGreaterThan(0);
  });
  it("follows a payment and a void on the dashboard", async () => {
    const before = await cashierDashboard(await dashboards.getDashboard("cashier", school), s);
    const r = await repo.recordPayment(ctx, { studentNo: "UNI-1048", account: "tuition", method: "cash", amount: 100_000, reference: "", note: "" }, NOW);
    const after = await cashierDashboard(await dashboards.getDashboard("cashier", school), s);
    expect(Number(after.kpis[0].value)).toBe(Number(before.kpis[0].value) + 1);
    await repo.voidReceipt(ctx, r.ok ? r.id! : "", "Mistake", NOW);
    const voided = await cashierDashboard(await dashboards.getDashboard("cashier", school), s);
    expect(voided.kpis[0].value).toBe(before.kpis[0].value);
    expect(voided.kpis[1].value).toBe(before.kpis[1].value);
  });
  it("rings for pending receipts and an open cash-up, and goes quiet once the day is closed", async () => {
    const open = await cashierNotifications(s);
    expect(open.items.map((i) => i.id)).toEqual(["pending", "cash-up"]);
    expect(open.unreadCount).toBe(2);
    for (const r of await repo.listReceipts(ctx)) if (r.status === "pending") await repo.confirmReceipt(ctx, r.id, NOW);
    const day = await repo.getDay(ctx, ctx.today);
    await repo.submitCashUp(ctx, { counts: breakDown(day.expectedCash), reason: "" }, NOW);
    expect((await cashierNotifications(s)).unreadCount).toBe(0);
  });
  it("searches only this desk's students and receipts", async () => {
    const byNumber = await searchCashier(s, "UNI-1048");
    expect(byNumber.some((r) => r.kind === "Student")).toBe(true);
    expect(byNumber.some((r) => r.kind === "Receipt")).toBe(true);
    expect((await searchCashier(s, "zzzz-nothing")).length).toBe(0);
    expect((await searchCashier(s, "  ")).length).toBe(0);
    expect((await searchCashier({ ctx: { ...ctx, cashierId: "c2" }, terms: s.terms }, "RC-")).every((r) => r.href.length > 0)).toBe(true);
  });
});
