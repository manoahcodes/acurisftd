import { describe, expect, it } from "vitest";
import { DEPLOYMENT_MODES, isMultiTenant, parseDeploymentMode } from "@/config/deployment";
import { buildAdminRole } from "@/config/navigation";
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

describe("admin role per deployment", () => {
  it("cloud keeps the Platform Admin with cross-school pages", () => {
    const r = buildAdminRole("cloud");
    expect(r.label).toBe("Platform Admin");
    expect(r.nav.map((n) => n.label)).toEqual(expect.arrayContaining(["Tenants & schools", "Subscriptions", "Platform settings"]));
    expect(r.topbar.quickAction?.label).toBe("Add tenant");
  });
  it.each(["dedicated", "self_hosted"] as const)("%s is a School Admin with no cross-school pages", (mode) => {
    const r = buildAdminRole(mode);
    const labels = r.nav.map((n) => n.label);
    expect(r.label).toBe("School Admin");
    for (const gone of ["Tenants & schools", "Subscriptions", "Platform users", "Usage & capacity", "Support queue", "Platform settings"]) {
      expect(labels).not.toContain(gone);
    }
    expect(labels).toContain("School settings");
    expect(r.nav.find((n) => n.label === "School settings")?.slug).toBe("platform-settings");
    expect(r.topbar.quickAction).toBeUndefined();
  });
  it("every mode offers data export & backup, and menu links resolve", () => {
    for (const mode of DEPLOYMENT_MODES) {
      const r = buildAdminRole(mode);
      expect(r.nav.some((n) => n.slug === "data-export-and-backup")).toBe(true);
      for (const e of r.userMenu) if (e.kind === "link") expect(r.nav.some((n) => n.label === e.navLabel)).toBe(true);
    }
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

describe("admin dashboard per deployment", () => {
  it("single-school needs its school and shows backup instead of billing", () => {
    expect(() => buildDashboard("platform", undefined, "self_hosted")).toThrow();
    const d = JSON.stringify(buildDashboard("platform", own, "self_hosted"));
    expect(d).toContain("Last backup");
    expect(d).not.toContain("Subscription");
    expect(d).toContain("By School Admin");
    expect(JSON.stringify(buildDashboard("platform", own, "cloud"))).toContain("Subscription");
  });
});
