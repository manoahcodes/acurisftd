import { describe, expect, it } from "vitest";
import { themeTenantFor } from "@/lib/theme/scope";

describe("themeTenantFor", () => {
  it("Platform Admin screens follow the selected school, else the platform default", () => {
    expect(themeTenantFor("platform", "lusaka-hills", "zambezi-university")).toBe("zambezi-university");
    expect(themeTenantFor("platform", "lusaka-hills", "zambezi-university", false)).toBe("zambezi-university");
    expect(themeTenantFor("platform", "lusaka-hills", undefined)).toBeUndefined();
    expect(themeTenantFor("platform", "lusaka-hills", undefined, false)).toBeUndefined();
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
