import { describe, expect, it } from "vitest";
import { ROLES, hrefForNavLabel } from "@/config/navigation";
import { BURSAR_PAGES } from "@/lib/bursar/pages";

describe("Bursar pages", () => {
  it("builds every sidebar page except the dashboard, and nothing the sidebar does not list", () => {
    const slugs = ROLES.bursar.nav.filter((n) => n.slug).map((n) => n.slug);
    expect([...BURSAR_PAGES].sort()).toEqual([...slugs].sort());
  });
  it("finds the pages the dashboard, bell and search link to by their labels", () => {
    expect(hrefForNavLabel("bursar", "Student accounts")).toBe("/bursar/student-accounts");
    expect(hrefForNavLabel("bursar", "Debtors")).toBe("/bursar/debtors");
    expect(hrefForNavLabel("bursar", "Reconciliation")).toBe("/bursar/reconciliation");
    expect(hrefForNavLabel("bursar", "Record payment")).toBe("/bursar/record-payment");
    expect(hrefForNavLabel("bursar", "Invoices")).toBe("/bursar/invoices");
  });
});
