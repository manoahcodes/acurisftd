import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// A server restart: forget everything held in memory, then load the modules again.
const KEYS = ["__acurisTheme", "__acurisRecords", "__acurisAudit", "__acurisDb"];
async function restart() {
  const g = globalThis as unknown as Record<string, { db?: { close(): void } } | undefined>;
  g.__acurisDb?.db?.close();
  for (const k of KEYS) delete g[k];
  vi.resetModules();
}

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "acuris-"));
  vi.stubEnv("ACURIS_PERSIST", "on");
  vi.stubEnv("ACURIS_DATA_DIR", dir);
});
afterEach(async () => {
  await restart();
  vi.unstubAllEnvs();
  rmSync(dir, { recursive: true, force: true });
});

describe("data survives a restart", () => {
  it("theme, branding, school overrides and presets", async () => {
    await restart();
    const { mockThemeRepository: repo } = await import("@/server/repositories/theme-mock");
    const platform = await repo.getPlatformDefault();
    await repo.savePlatformDefault({ theme: { ...platform.theme, primary: "#aa3366" }, branding: { ...platform.branding, name: "Saved School", timezone: "Africa/Nairobi" } });
    await repo.saveTenantOverride("northview", { theme: { primary: "#118833" }, branding: { tagline: "Hello" } });
    const preset = await repo.savePreset("platform", "Mine", platform.theme);

    await restart();
    const again = (await import("@/server/repositories/theme-mock")).mockThemeRepository;
    const loaded = await again.getPlatformDefault();
    expect(loaded.theme.primary).toBe("#aa3366");
    expect(loaded.branding).toMatchObject({ name: "Saved School", timezone: "Africa/Nairobi" });
    expect((await again.getTenantOverride("northview"))?.theme.primary).toBe("#118833");
    expect((await again.listPresets("platform")).map((p) => p.id)).toEqual([preset.id]);
  });

  it("records, the audit trail and schools", async () => {
    await restart();
    const { mockRecordStore } = await import("@/server/repositories/records-mock");
    const { mockAuditLog } = await import("@/server/repositories/audit-mock");
    const { mockTenantDirectory } = await import("@/server/repositories/tenants-mock");
    mockRecordStore.add("s", "t", { Key: "A", Val: "B" });
    mockRecordStore.edit("s", "t", "A", { Name: "x" });
    mockRecordStore.archive("s", "t", "A");
    mockAuditLog.record({ user: "Admin", action: "Edit", entity: "Row A", school: "All" } as never);
    const school = await mockTenantDirectory.create({ name: "Persist High", plan: "Starter", status: "Trial", campuses: 1, types: ["high_school"] });

    await restart();
    const records = (await import("@/server/repositories/records-mock")).mockRecordStore;
    const o = records.overlay("s", "t")!;
    expect(o.added[0]).toEqual({ Key: "A", Val: "B" });
    expect(o.edits.A).toEqual({ Name: "x" });
    expect(o.archived?.A).toBe(true);
    expect((await import("@/server/repositories/audit-mock")).mockAuditLog.list()[0].action).toBe("Edit");
    const tenants = await (await import("@/server/repositories/tenants-mock")).mockTenantDirectory.list();
    expect(tenants.find((t) => t.id === school.id)?.name).toBe("Persist High");
    expect(tenants.length).toBeGreaterThan(6);
  });

  it("falls back to memory when the data file cannot be used", async () => {
    vi.stubEnv("ACURIS_DATA_DIR", join(dir, "acuris.db", "nope")); // a path under a non-directory
    await restart();
    const { mockThemeRepository: repo } = await import("@/server/repositories/theme-mock");
    const p = await repo.getPlatformDefault();
    await expect(repo.savePlatformDefault({ ...p, branding: { ...p.branding, name: "Mem" } })).resolves.toBeUndefined();
    expect((await repo.getPlatformDefault()).branding.name).toBe("Mem");
  });
});

describe("tests do not touch the file by default", () => {
  it("is off under NODE_ENV=test unless asked", async () => {
    vi.stubEnv("ACURIS_PERSIST", "");
    await restart();
    const { loadSnapshot, saveSnapshot } = await import("@/server/persistence/store");
    saveSnapshot("x", 1);
    expect(loadSnapshot("x")).toBeUndefined();
  });
});
