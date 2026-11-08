import { beforeEach, describe, expect, it, vi } from "vitest";

const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (k: string) => (jar.has(k) ? { value: jar.get(k) } : undefined) }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

import { submitRecord } from "@/server/actions/records";
import { resetMockRecords } from "@/server/repositories/records-mock";
import { platformScreens, tenantDirectory } from "@/server/repositories";
import type { FormState } from "@/types/forms";

const idle: FormState = { status: "idle" };
const fd = (o: Record<string, string | string[]>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) for (const x of Array.isArray(v) ? v : [v]) f.append(k, x);
  return f;
};
const campus = (name: string) => ({ slug: "institution/campuses", formId: "campus", mode: "create", name, code: "EST", location: "Ndola", status: "Active" });

beforeEach(() => {
  jar.clear();
  resetMockRecords();
  jar.set("stecia_platform_tenant", "zambezi-university");
});

describe("submitRecord", () => {
  it("creates a row that then shows in the screen", async () => {
    expect((await submitRecord(idle, fd(campus("East Campus")))).status).toBe("success");
    const tenants = await tenantDirectory.list();
    const screen = await platformScreens.getScreen({ tenant: tenants.find((t) => t.id === "zambezi-university")!, division: null, tenants }, "institution/campuses");
    expect(screen!.tables[0].rows[0][0]).toBe("East Campus");
  });

  it("rejects a repeat of an existing key, ignoring case", async () => {
    await submitRecord(idle, fd(campus("East Campus")));
    const again = await submitRecord(idle, fd(campus("east campus")));
    expect(again.status).toBe("error");
    expect((await submitRecord(idle, fd(campus("main campus")))).status).toBe("error"); // base row
  });

  it("returns field errors and the submitted values", async () => {
    const r = await submitRecord(idle, fd({ ...campus(""), status: "Hacked" }));
    expect(r.status).toBe("error");
    expect(r.errors).toMatchObject({ name: expect.any(String), status: expect.any(String) });
    expect(r.values?.location).toBe("Ndola");
  });

  it("refuses unknown pages and forms", async () => {
    expect((await submitRecord(idle, fd({ ...campus("X"), slug: "reports/audit-trail" }))).status).toBe("error");
    expect((await submitRecord(idle, fd({ ...campus("X"), formId: "nope" }))).status).toBe("error");
    expect((await submitRecord(idle, fd({ ...campus("X"), formId: "../../x" }))).status).toBe("error");
  });

  it("needs a school for school pages", async () => {
    jar.clear();
    expect((await submitRecord(idle, fd(campus("X")))).message).toMatch(/select a school/i);
  });

  it("edits only unlocked columns and cannot edit a missing row", async () => {
    const ok = await submitRecord(idle, fd({ slug: "institution/campuses", formId: "campus", mode: "edit", rowKey: "Main Campus", name: "Hijack", code: "MAIN", location: "Kabwe", status: "Active" }));
    expect(ok.status).toBe("success");
    const tenants = await tenantDirectory.list();
    const ctx = { tenant: tenants.find((t) => t.id === "zambezi-university")!, division: null, tenants };
    const row = (await platformScreens.getScreen(ctx, "institution/campuses"))!.tables[0].rows.find((r) => r[0].includes("Main"))!;
    expect(row[0]).toBe("Main Campus");
    expect(row[2]).toBe("Kabwe");
    const gone = await submitRecord(idle, fd({ slug: "institution/campuses", formId: "campus", mode: "edit", rowKey: "Ghost", code: "G", location: "x", status: "Active" }));
    expect(gone.status).toBe("error");
  });

  it("requires a valid division in a combined school and numbers students by division", async () => {
    jar.set("stecia_platform_tenant", "lusaka-hills");
    const base = { slug: "users/students", formId: "student", mode: "create", name: "New Pupil", group: "Grade 1A", campus: "Main Campus", status: "Active" };
    expect((await submitRecord(idle, fd(base))).status).toBe("error");
    expect((await submitRecord(idle, fd({ ...base, division: "university" }))).status).toBe("error");
    expect((await submitRecord(idle, fd({ ...base, division: "primary" }))).status).toBe("success");
    const tenants = await tenantDirectory.list();
    const t = tenants.find((x) => x.id === "lusaka-hills")!;
    const rows = (await platformScreens.getScreen({ tenant: t, division: t.divisions[0], tenants }, "users/students"))!.tables[0].rows;
    expect(rows[0][0]).toBe("PRI-1202");
    // The other division is unaffected.
    const hs = (await platformScreens.getScreen({ tenant: t, division: t.divisions[1], tenants }, "users/students"))!.tables[0].rows;
    expect(hs.some((r) => r[1] === "New Pupil")).toBe(false);
  });

  it("will not create a school that mixes terms and semesters", async () => {
    jar.clear();
    const r = await submitRecord(idle, fd({ slug: "tenants-and-schools", formId: "tenant", mode: "create", name: "Mixed", types: ["Primary School", "University"], plan: "Starter", campuses: "1", status: "Trial" }));
    expect(r.status).toBe("error");
    expect((await tenantDirectory.list()).some((t) => t.name === "Mixed")).toBe(false);
  });
});
