import { beforeEach, describe, expect, it, vi } from "vitest";

const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (k: string) => (jar.has(k) ? { value: jar.get(k) } : undefined),
    set: (k: string, v: string) => void jar.set(k, v),
    delete: (k: string) => void jar.delete(k),
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));

import { DEFAULT_SETUP, SETUPS, disallowedTypes, setupFor, tenantSetup } from "@/config/institution";
import { adminNavItem, ROLES } from "@/config/navigation";
import { exitWorkspace, openWorkspace } from "@/server/actions/workspace";
import { submitRecord } from "@/server/actions/records";
import { recordScope } from "@/server/forms/scope";
import { audit, platformScreens, tenantDirectory } from "@/server/repositories";
import { resetMockAudit } from "@/server/repositories/audit-mock";
import { resetMockRecords } from "@/server/repositories/records-mock";
import type { FormState } from "@/types/forms";

const idle: FormState = { status: "idle" };
const fd = (o: Record<string, string | string[]>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) for (const x of Array.isArray(v) ? v : [v]) f.append(k, x);
  return f;
};
const create = (values: Record<string, string | string[]>) =>
  submitRecord(idle, fd({ slug: "tenants-and-schools", formId: "tenant", mode: "create", plan: "Starter", campuses: "1", feePolicy: "Information only", status: "Trial", ...values }));

beforeEach(() => {
  jar.clear();
  resetMockRecords();
  resetMockAudit();
});

describe("setup types: higher education by default, school levels switched off", () => {
  it("the default setup offers only College and University", () => {
    expect(DEFAULT_SETUP).toBe("higher_ed");
    expect(SETUPS.higher_ed.types).toEqual(["college", "university"]);
    expect(disallowedTypes("higher_ed", ["primary", "college"])).toEqual(["primary"]);
    expect(disallowedTypes("extended", ["primary", "high_school", "college"])).toEqual([]);
  });
  it("a tenant's setup is stored, else inferred from its divisions", async () => {
    const tenants = await tenantDirectory.list();
    expect(tenantSetup(tenants.find((t) => t.id === "zambezi-university")!)).toBe("higher_ed");
    expect(tenantSetup(tenants.find((t) => t.id === "lusaka-hills")!)).toBe("extended");
    expect(setupFor(["college"])).toBe("higher_ed");
    expect(setupFor(["college", "primary"])).toBe("extended");
  });
  it("a new tenant defaults to higher education and cannot get school levels without the extended setup", async () => {
    const bad = await create({ name: "Riverside Primary", types: ["Primary School"], setup: "Higher education" });
    expect(bad.status).toBe("error");
    expect(bad.errors?.types).toMatch(/not part of the Higher education setup/);
    expect((await tenantDirectory.list()).some((t) => t.name === "Riverside Primary")).toBe(false);

    const ok = await create({ name: "Riverside College", types: ["College"], setup: "Higher education" });
    expect(ok.status, ok.message).toBe("success");
    const made = (await tenantDirectory.list()).find((t) => t.name === "Riverside College")!;
    expect(made.setupType).toBe("higher_ed");
  });
  it("the extended setup enables school-level divisions for a tenant that needs them", async () => {
    const r = await create({ name: "Riverside Primary", types: ["Primary School"], setup: "Higher education + school levels" });
    expect(r.status, r.message).toBe("success");
    expect((await tenantDirectory.list()).find((t) => t.name === "Riverside Primary")!.setupType).toBe("extended");
  });
  it("moving a school-level tenant back to higher education is refused while it keeps school divisions", async () => {
    const r = await submitRecord(idle, fd({
      slug: "tenants-and-schools", formId: "tenant", mode: "edit", rowKey: "Northview Primary",
      name: "Northview Primary", types: ["Primary School"], setup: "Higher education", plan: "Starter", campuses: "1", feePolicy: "Information only", status: "Trial",
    }));
    expect(r.status).toBe("error");
    expect((await tenantDirectory.list()).find((t) => t.id === "northview")!.setupType).toBe("extended");
  });
});

describe("Platform Admin works on tenants, not on a school's records", () => {
  it("every slug is either the platform's or a school's, never both", () => {
    const platform = new Set(ROLES.platform.nav.map((n) => n.slug));
    for (const n of ROLES["school-admin"].nav) expect(platform.has(n.slug) && n.slug !== "", n.slug).toBe(false);
  });
  it("school pages resolve to school-scoped records, platform pages to the platform scope", async () => {
    const tenants = await tenantDirectory.list();
    const ctx = { tenant: tenants[0], division: null, tenants };
    expect(adminNavItem("finances/tuition-fees")?.scope).toBe("tenant");
    expect(adminNavItem("hostels/hostels-and-rooms")?.scope).toBe("tenant");
    expect(adminNavItem("subscriptions")?.scope).toBe("platform");
    expect(recordScope("subscriptions", ctx)).toBe("platform");
    expect(recordScope("school-settings", ctx)).not.toBe("platform");
  });
  it("school settings reuse the platform settings screen and forms under their own slug", async () => {
    const tenants = await tenantDirectory.list();
    const ctx = { tenant: tenants[0], division: null, tenants };
    const school = await platformScreens.getScreen(ctx, "school-settings");
    expect(school?.tables.length).toBeGreaterThan(0);
    expect(Object.keys(school?.processes ?? {})).toContain("Edit settings");
  });
  it("the platform audit trail lists platform-level events only, never a school's changes", async () => {
    audit.record({ user: "Mrs. Phiri", action: "Record created", entity: "Tuition fees: Year 1", scope: "mukuba", school: "Mukuba Learning Centre" });
    audit.record({ user: "ACURIS Admin", action: "School added", entity: "Tenants & schools: X", scope: "platform", school: "Platform" });
    const tenants = await tenantDirectory.list();
    const platform = (await platformScreens.getScreen({ tenant: null, division: null, tenants }, "audit-trail"))!;
    const text = JSON.stringify(platform.tables[0].rows);
    expect(text).toContain("School added");
    expect(text).not.toContain("Tuition fees: Year 1");
  });
});

describe("opening a school workspace", () => {
  it("selects the school, records who entered it, and lands on the School Admin", async () => {
    await expect(openWorkspace("mukuba")).rejects.toThrow("REDIRECT:/school-admin");
    expect(jar.get("stecia_platform_tenant")).toBe("mukuba");
    const entry = audit.list().find((e) => e.action === "Workspace opened")!;
    expect(entry).toMatchObject({ scope: "mukuba", school: "Mukuba Learning Centre" });
  });
  it("ignores an unknown or malformed school and records nothing", async () => {
    await openWorkspace("nope");
    await openWorkspace("../etc");
    expect(jar.has("stecia_platform_tenant")).toBe(false);
    expect(audit.list()).toHaveLength(0);
  });
  it("leaving clears the school, records it, and returns to the Platform Admin", async () => {
    await expect(openWorkspace("mukuba")).rejects.toThrow();
    await expect(exitWorkspace()).rejects.toThrow("REDIRECT:/platform");
    expect(jar.has("stecia_platform_tenant")).toBe(false);
    expect(audit.list().some((e) => e.action === "Workspace closed" && e.scope === "mukuba")).toBe(true);
  });
  it("the school's own audit trail shows the visit, the platform's shows it too as a workspace entry", async () => {
    await expect(openWorkspace("mukuba")).rejects.toThrow();
    const tenants = await tenantDirectory.list();
    const mukuba = tenants.find((t) => t.id === "mukuba")!;
    const school = (await platformScreens.getScreen({ tenant: mukuba, division: null, tenants }, "reports/audit-trail"))!;
    expect(JSON.stringify(school.tables[0].rows)).toContain("Workspace opened");
    const platform = (await platformScreens.getScreen({ tenant: null, division: null, tenants }, "audit-trail"))!;
    expect(JSON.stringify(platform.tables[0].rows)).toContain("Workspace opened");
  });
});
