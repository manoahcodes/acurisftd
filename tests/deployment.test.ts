import { describe, expect, it } from "vitest";
import { DEPLOYMENT_MODES, isMultiTenant, parseDeploymentMode } from "@/config/deployment";
import { ROLES, availableRoleKeys } from "@/config/navigation";
import { resolveSelection } from "@/lib/tenant-selection";
import { buildDashboard } from "@/server/repositories/dashboard-mock";
import { TENANTS } from "@/server/repositories/tenants-mock";
import type { TenantContext } from "@/types/dashboard";

const own: TenantContext = { tenantId: "lusaka-hills", tenantName: "Lusaka Hills Academy", campus: "Main Campus", institutionType: "high_school" };

describe("parseDeploymentMode", () => {
  it("defaults to cloud, accepts known modes, and rejects typos", () => {
    expect(parseDeploymentMode(undefined)).toBe("cloud");
    expect(parseDeploymentMode(" ")).toBe("cloud");
    for (const m of DEPLOYMENT_MODES) expect(parseDeploymentMode(m)).toBe(m);
    expect(() => parseDeploymentMode("selfhosted")).toThrow();
  });
  it("only the shared cloud is multi-tenant", () => {
    expect(DEPLOYMENT_MODES.filter((m) => isMultiTenant(m))).toEqual(["cloud"]);
  });
});

describe("admin roles", () => {
  const platform = ROLES.platform.nav.map((n) => n.label);
  const school = ROLES["school-admin"].nav.map((n) => n.label);

  it("Platform Admin is about tenants and the platform only", () => {
    expect(ROLES.platform.label).toBe("Platform Admin");
    expect(platform).toEqual(expect.arrayContaining(["Tenants & schools", "Subscriptions", "Usage & capacity", "Support queue", "Platform users", "Access control", "Platform settings", "Audit trail"]));
    expect(ROLES.platform.topbar.quickAction?.label).toBe("Add tenant");
  });
  it("Platform Admin has no school-level pages: registrations, academics, finances, hostels", () => {
    for (const item of ROLES.platform.nav) {
      expect(item.scope).toBe("platform");
      expect(item.slug).not.toMatch(/^(finances|registrations|academics|examinations|hostels|users|institution|reports)\//);
    }
    for (const gone of ["Hostels & rooms", "Tuition fees", "Student payments", "Total receivables", "Students", "Exam registration", "Final results"]) {
      expect(platform).not.toContain(gone);
    }
  });
  it("School Admin owns the school modules, hostels included, all scoped to one school", () => {
    expect(ROLES["school-admin"].label).toBe("School Admin");
    expect(school).toEqual(expect.arrayContaining(["Hostels & rooms", "Room allocations", "Tuition fees", "Student payments", "Students", "School settings", "Data export & backup"]));
    for (const gone of ["Tenants & schools", "Subscriptions", "Platform users", "Usage & capacity", "Support queue", "Platform settings"]) {
      expect(school).not.toContain(gone);
    }
    expect(ROLES["school-admin"].nav.filter((n) => n.slug).every((n) => n.scope === "tenant")).toBe(true);
    expect(ROLES["school-admin"].topbar.quickAction).toBeUndefined();
  });
  it("only the shared cloud offers the Platform Admin", () => {
    expect(availableRoleKeys("cloud")).toContain("platform");
    for (const mode of ["dedicated", "self_hosted"] as const) {
      expect(availableRoleKeys(mode)).not.toContain("platform");
      expect(availableRoleKeys(mode)).toContain("school-admin");
    }
  });
  it("menu links and quick actions resolve in both roles, and no slug is shared with a different meaning", () => {
    for (const key of ["platform", "school-admin"] as const) {
      const r = ROLES[key];
      expect(r.nav.some((n) => n.slug === "data-export-and-backup")).toBe(key === "school-admin");
      for (const e of r.userMenu) if (e.kind === "link") expect(r.nav.some((n) => n.label === e.navLabel)).toBe(true);
    }
    const shared = ROLES.platform.nav.filter((n) => n.slug && ROLES["school-admin"].nav.some((m) => m.slug === n.slug));
    expect(shared).toEqual([]);
  });
});

describe("resolveSelection", () => {
  it("cloud: all schools, cookie picks one, unknown ids ignored", () => {
    const s = resolveSelection("cloud", TENANTS, "lusaka-hills", "zambezi-university", undefined);
    expect(s.tenants).toHaveLength(TENANTS.length);
    expect(s.selected?.id).toBe("zambezi-university");
    expect(resolveSelection("cloud", TENANTS, "lusaka-hills", "nope", undefined).selected).toBeUndefined();
  });
  it.each(["dedicated", "self_hosted"] as const)("%s: only the own school, whatever the cookie says", (mode) => {
    const s = resolveSelection(mode, TENANTS, "lusaka-hills", "zambezi-university", undefined);
    expect(s.tenants.map((t) => t.id)).toEqual(["lusaka-hills"]);
    expect(s.selected?.id).toBe("lusaka-hills");
  });
  it("a division cookie only counts for a multi-division school", () => {
    const hills = TENANTS.find((t) => t.id === "lusaka-hills")!;
    const id = hills.divisions[1].id;
    expect(resolveSelection("self_hosted", TENANTS, "lusaka-hills", undefined, id).division?.id).toBe(id);
    expect(resolveSelection("self_hosted", TENANTS, "chilenje", undefined, "high_school").division).toBeUndefined();
  });
});

describe("admin dashboards per deployment", () => {
  it("Platform Admin: tenant-level only, and none in a single-school deployment", () => {
    expect(() => buildDashboard("platform", undefined, "self_hosted")).toThrow();
    const d = JSON.stringify(buildDashboard("platform", own, "cloud"));
    expect(d).toContain("Active tenants");
    // Even with a school context passed in, it is still the tenant-level view, not that school's overview.
    expect(d).toContain("Platform overview");
    expect(d).not.toContain("Academic set-up");
    expect(d).not.toContain("Last backup");
  });
  it("School Admin: needs its school, shows backup instead of billing when single-school", () => {
    expect(() => buildDashboard("school-admin", undefined, "self_hosted")).toThrow();
    const d = JSON.stringify(buildDashboard("school-admin", own, "self_hosted"));
    expect(d).toContain("Last backup");
    expect(d).not.toContain("Subscription");
    expect(d).toContain("By School Admin");
    expect(JSON.stringify(buildDashboard("school-admin", own, "cloud"))).toContain("Subscription");
  });
});
