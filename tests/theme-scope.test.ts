import { describe, expect, it } from "vitest";
import { themeTenantFor } from "@/lib/theme/scope";

describe("themeTenantFor", () => {
  it("Platform Admin screens always use the platform default, whatever workspace was opened", () => {
    expect(themeTenantFor("platform", "lusaka-hills", "zambezi-university")).toBeUndefined();
    expect(themeTenantFor("platform", "lusaka-hills", "zambezi-university", false)).toBeUndefined();
    expect(themeTenantFor("platform", "lusaka-hills", undefined)).toBeUndefined();
  });
  it("School Admin screens follow the open school workspace, else the platform default", () => {
    expect(themeTenantFor("school-admin", "lusaka-hills", "zambezi-university")).toBe("zambezi-university");
    expect(themeTenantFor("school-admin", "lusaka-hills", "zambezi-university", false)).toBe("zambezi-university");
    expect(themeTenantFor("school-admin", "lusaka-hills", undefined)).toBeUndefined();
  });
  it("demo preview: other roles follow the selected school, else their own", () => {
    for (const role of ["teacher", "bursar", "cashier", "parent", "student"] as const) {
      expect(themeTenantFor(role, "lusaka-hills", "zambezi-university", true)).toBe("zambezi-university");
      expect(themeTenantFor(role, "lusaka-hills", undefined, true)).toBe("lusaka-hills");
    }
  });
  it("with the preview off, other roles only ever get their own school", () => {
    expect(themeTenantFor("teacher", "lusaka-hills", "zambezi-university", false)).toBe("lusaka-hills");
  });
});
