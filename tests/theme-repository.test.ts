import { beforeEach, describe, expect, it } from "vitest";
import { applyOverride, diffConfig, isEmptyOverride } from "@/lib/theme/merge";
import { mockThemeRepository as repo, resetMockTheme } from "@/server/repositories/theme-mock";
import { DEFAULT_THEME } from "@/server/repositories/theme-types";

beforeEach(resetMockTheme);

describe("theme repository", () => {
  it("falls back to the platform default for a school with no override", async () => {
    const r = await repo.resolve({ tenantId: "chilenje" });
    expect(r.theme).toEqual(DEFAULT_THEME);
  });

  it("a school's own changes win, and clearing them restores the default", async () => {
    await repo.saveTenantOverride("chilenje", { theme: { primary: "#6f2c91" }, branding: {} });
    expect((await repo.resolve({ tenantId: "chilenje" })).theme.primary).toBe("#6f2c91");
    expect((await repo.resolve({ tenantId: "mukuba" })).theme.primary).toBe(DEFAULT_THEME.primary);
    await repo.clearTenantOverride("chilenje");
    expect((await repo.resolve({ tenantId: "chilenje" })).theme.primary).toBe(DEFAULT_THEME.primary);
  });

  it("a school keeps following the platform default for anything it did not change", async () => {
    const base = await repo.getPlatformDefault();
    await repo.saveTenantOverride("chilenje", { theme: { primary: "#6f2c91" }, branding: { shortName: "CS" } });
    await repo.savePlatformDefault({
      theme: { ...base.theme, primary: "#e11d48", radius: "pill" },
      branding: { ...base.branding, tagline: "New tagline" },
    });
    const school = await repo.resolve({ tenantId: "chilenje" });
    expect(school.theme.primary).toBe("#6f2c91"); // its own choice
    expect(school.branding.shortName).toBe("CS"); // its own choice
    expect(school.theme.radius).toBe("pill"); // followed the new default
    expect(school.branding.tagline).toBe("New tagline"); // followed the new default
    expect((await repo.resolve({ tenantId: "mukuba" })).theme.primary).toBe("#e11d48");
  });

  it("returned configs are copies, so callers cannot edit the store", async () => {
    const a = await repo.getPlatformDefault();
    a.theme.primary = "#000000";
    expect((await repo.getPlatformDefault()).theme.primary).toBe(DEFAULT_THEME.primary);
    await repo.saveTenantOverride("chilenje", { theme: { primary: "#6f2c91" }, branding: {} });
    const o = await repo.getTenantOverride("chilenje");
    o!.theme.primary = "#000000";
    expect((await repo.getTenantOverride("chilenje"))!.theme.primary).toBe("#6f2c91");
  });

  it("keeps presets per scope", async () => {
    const p = await repo.savePreset("platform", "Gold", { ...DEFAULT_THEME, primary: "#d4a017" });
    await repo.savePreset("chilenje", "Other", DEFAULT_THEME);
    expect((await repo.listPresets("platform")).map((x) => x.name)).toEqual(["Gold"]);
    await repo.deletePreset("platform", p.id);
    expect(await repo.listPresets("platform")).toEqual([]);
    expect(await repo.listPresets("chilenje")).toHaveLength(1);
  });
});

describe("diffConfig and applyOverride", () => {
  it("stores only what differs and round-trips", async () => {
    const base = await repo.getPlatformDefault();
    const next = { theme: { ...base.theme, primary: "#6f2c91", font: "lato" as const }, branding: { ...base.branding, name: "Chilenje" } };
    const diff = diffConfig(base, next);
    expect(diff).toEqual({ theme: { primary: "#6f2c91", font: "lato" }, branding: { name: "Chilenje" } });
    expect(applyOverride(base, diff)).toEqual(next);
  });
  it("an unchanged config produces an empty override", async () => {
    const base = await repo.getPlatformDefault();
    expect(isEmptyOverride(diffConfig(base, base))).toBe(true);
  });
  it("no override gives a copy of the base", async () => {
    const base = await repo.getPlatformDefault();
    const copy = applyOverride(base, undefined);
    expect(copy).toEqual(base);
    expect(copy).not.toBe(base);
  });
});

describe("settings saved before a field existed", () => {
  it("fill in defaults instead of returning undefined", async () => {
    // Shape of branding and theme saved before copyrightHolder, secondary and tertiary were added.
    const store = (globalThis as unknown as { __acurisTheme: { platform: { theme: object; branding: object } } }).__acurisTheme;
    const current = await repo.getPlatformDefault();
    const oldBranding: Record<string, unknown> = { ...current.branding };
    const oldTheme: Record<string, unknown> = { ...current.theme };
    delete oldBranding.copyrightHolder;
    delete oldTheme.secondary;
    delete oldTheme.tertiary;
    store.platform = { theme: oldTheme, branding: oldBranding };
    for (const c of [await repo.getPlatformDefault(), await repo.resolve({ tenantId: "chilenje" })]) {
      expect(c.branding.copyrightHolder).toBe("");
      expect(c.theme.secondary).toBe("");
      expect(c.theme.tertiary).toBe("");
    }
  });
});
