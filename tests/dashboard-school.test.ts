import { describe, expect, it } from "vitest";
import { INSTITUTION_TYPES } from "@/config/institution";
import { ROLE_KEYS } from "@/config/navigation";
import { dashboardSchoolFor } from "@/lib/dashboard/school";
import { buildDashboard } from "@/server/repositories/dashboard-mock";
import { TENANTS } from "@/server/repositories/tenants-mock";
import type { TenantContext } from "@/types/dashboard";

const own: TenantContext = {
  tenantId: "lusaka-hills",
  tenantName: "Lusaka Hills Academy",
  campus: "Main Campus",
  institutionType: "high_school",
};
const tenant = (id: string) => TENANTS.find((t) => t.id === id)!;
const ctxFor = (type: TenantContext["institutionType"]): TenantContext => ({ ...own, institutionType: type });
const text = (role: (typeof ROLE_KEYS)[number], type: TenantContext["institutionType"]) =>
  JSON.stringify(buildDashboard(role, ctxFor(type)));

describe("dashboardSchoolFor", () => {
  it("Platform Admin: platform-wide view with no school, else the selected school", () => {
    expect(dashboardSchoolFor("platform", own, undefined, undefined)).toBeUndefined();
    const s = dashboardSchoolFor("platform", own, tenant("zambezi-university"), undefined);
    expect(s?.tenantName).toBe("Zambezi University");
    expect(s?.institutionType).toBe("university");
  });
  it("other roles: preview follows the selected school, else their own", () => {
    expect(dashboardSchoolFor("teacher", own, tenant("mukuba"), undefined, true)?.institutionType).toBe("college");
    expect(dashboardSchoolFor("teacher", own, undefined, undefined, true)).toBe(own);
    expect(dashboardSchoolFor("teacher", own, tenant("mukuba"), undefined, false)).toBe(own);
  });
  it("combined school: first division is the fallback, a selected division wins", () => {
    const hills = tenant("lusaka-hills");
    expect(dashboardSchoolFor("student", own, hills, undefined, true)?.institutionType).toBe("primary");
    const hs = hills.divisions.find((d) => d.institutionType === "high_school");
    expect(dashboardSchoolFor("student", own, hills, hs, true)?.institutionType).toBe("high_school");
  });
});

describe("buildDashboard", () => {
  it("has a platform-wide view and needs a school for the other roles", () => {
    expect(buildDashboard("platform").title).toBe("Platform overview");
    expect(() => buildDashboard("teacher")).toThrow();
  });
  it("builds every role for every institution type with the school's name", () => {
    for (const type of INSTITUTION_TYPES) {
      for (const role of ROLE_KEYS) {
        const d = buildDashboard(role, ctxFor(type));
        expect(d.kpis.length).toBeGreaterThan(0);
        expect(d.sections.length).toBeGreaterThan(0);
      }
    }
  });
  it("uses Term wording for schools and Semester wording for tertiary", () => {
    for (const type of ["primary", "high_school"] as const) {
      expect(text("student", type)).toContain("Term 3");
      expect(text("student", type)).not.toContain("Semester");
    }
    for (const type of ["college", "university"] as const) {
      expect(text("student", type)).toContain("Semester 2");
      expect(text("student", type)).not.toMatch(/Term \d/);
      expect(text("teacher", type)).not.toContain("Grade ");
    }
  });
  it("shows grades for schools and programmes for tertiary", () => {
    expect(text("teacher", "primary")).toContain("Grade 3B");
    expect(text("teacher", "primary")).not.toContain("Grade 12");
    expect(text("teacher", "high_school")).toContain("Grade 12");
    expect(text("teacher", "university")).toContain("BSc Computer Science");
    expect(text("teacher", "college")).toContain("Diploma in ICT");
  });
  it("names the school in notices and the Platform Admin's school overview", () => {
    expect(text("parent", "college")).toContain("Lusaka Hills Academy");
    const d = buildDashboard("platform", { ...ctxFor("university"), tenantName: "Zambezi University" });
    expect(d.title).toContain("Zambezi University");
    expect(JSON.stringify(d)).toContain("Semester system");
  });
});
