import { describe, expect, it } from "vitest";
import { ROLES, hrefForNavLabel } from "@/config/navigation";
import { CASHIER_PAGES } from "@/lib/cashier/pages";

describe("Cashier pages", () => {
  it("builds every sidebar page except the dashboard, and nothing the sidebar does not list", () => {
    const slugs = ROLES.cashier.nav.filter((n) => n.slug).map((n) => n.slug);
    expect([...CASHIER_PAGES].sort()).toEqual([...slugs].sort());
  });
  it("finds the pages the views link to by their labels", () => {
    expect(hrefForNavLabel("cashier", "Today's transactions")).toBe("/cashier/today-s-transactions");
    expect(hrefForNavLabel("cashier", "Collect payment")).toBe("/cashier/collect-payment");
    expect(hrefForNavLabel("cashier", "Cash-up")).toBe("/cashier/cash-up");
  });
});
