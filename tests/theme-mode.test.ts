import { describe, expect, it } from "vitest";
import { effectiveMode, parseModePreference, selectedPreference } from "@/lib/theme/mode";

describe("mode preference", () => {
  it("accepts only the three choices", () => {
    for (const ok of ["light", "dark", "system"]) expect(parseModePreference(ok)).toBe(ok);
    for (const bad of [undefined, "", "auto", "DARK", "dark;x", "1"]) expect(parseModePreference(bad)).toBeUndefined();
  });
  it("uses the school's mode until the person chooses", () => {
    expect(effectiveMode("dark", undefined)).toBe("dark");
    expect(effectiveMode("auto", undefined)).toBe("auto");
  });
  it("a personal choice overrides the school's mode", () => {
    expect(effectiveMode("dark", "light")).toBe("light");
    expect(effectiveMode("light", "dark")).toBe("dark");
    expect(effectiveMode("light", "system")).toBe("auto");
  });
  it("shows the school's mode as selected when nothing was chosen", () => {
    expect(selectedPreference("auto", undefined)).toBe("system");
    expect(selectedPreference("dark", undefined)).toBe("dark");
    expect(selectedPreference("dark", "light")).toBe("light");
  });
});
