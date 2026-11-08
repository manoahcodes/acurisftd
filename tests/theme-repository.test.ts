import { beforeEach, describe, expect, it } from "vitest";
import { mockThemeRepository as repo, resetMockTheme } from "@/server/repositories/theme-mock";
import { DEFAULT_THEME } from "@/server/repositories/theme-types";

beforeEach(resetMockTheme);

describe("theme repository", () => {
  it("falls back to the platform default for a school with no override", async () => {
    const r = await repo.resolve({ tenantId: "chilenje" });
    expect(r.theme).toEqual(DEFAULT_THEME);
  });

  it("a school override wins, and clearing it restores the default", async () => {
    const base = await repo.getPlatformDefault();
    await repo.saveTenantOverride("chilenje", { ...base, theme: { ...base.theme, primary: "#6f2c91" } });
    expect((await repo.resolve({ tenantId: "chilenje" })).theme.primary).toBe("#6f2c91");
    expect((await repo.resolve({ tenantId: "mukuba" })).theme.primary).toBe(DEFAULT_THEME.primary);
    await repo.clearTenantOverride("chilenje");
    expect((await repo.resolve({ tenantId: "chilenje" })).theme.primary).toBe(DEFAULT_THEME.primary);
  });

  it("changing the platform default does not change a school that has its own", async () => {
    const base = await repo.getPlatformDefault();
    await repo.saveTenantOverride("chilenje", base);
    await repo.savePlatformDefault({ ...base, theme: { ...base.theme, primary: "#e11d48" } });
    expect((await repo.resolve({ tenantId: "chilenje" })).theme.primary).toBe(DEFAULT_THEME.primary);
    expect((await repo.resolve({ tenantId: "mukuba" })).theme.primary).toBe("#e11d48");
  });

  it("returned configs are copies, so callers cannot edit the store", async () => {
    const a = await repo.getPlatformDefault();
    a.theme.primary = "#000000";
    expect((await repo.getPlatformDefault()).theme.primary).toBe(DEFAULT_THEME.primary);
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
