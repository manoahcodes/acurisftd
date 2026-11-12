import { beforeEach, describe, expect, it, vi } from "vitest";

const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (k: string) => (jar.has(k) ? { value: jar.get(k) } : undefined) }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

import { submitRecord } from "@/server/actions/records";
import { accessRule, parseGrades } from "@/server/forms/registry";
import { platformScreens, tenantDirectory } from "@/server/repositories";
import { resetMockAudit } from "@/server/repositories/audit-mock";
import { resetMockRecords } from "@/server/repositories/records-mock";
import { audit } from "@/server/repositories";
import type { FormState } from "@/types/forms";

const idle: FormState = { status: "idle" };
const fd = (o: Record<string, string | string[]>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) for (const x of Array.isArray(v) ? v : [v]) f.append(k, x);
  return f;
};
const edit = (slug: string, formId: string, rowKey: string, values: Record<string, string | string[]>) =>
  submitRecord(idle, fd({ slug, formId, mode: "edit", rowKey, ...values }));

async function table(slug: string, tableId: string, tenantId: string | null) {
  const tenants = await tenantDirectory.list();
  const tenant = tenants.find((t) => t.id === tenantId) ?? null;
  const s = (await platformScreens.getScreen({ tenant, division: null, tenants }, slug))!;
  return s.tables.find((t) => t.id === tableId)!;
}
const cell = (t: Awaited<ReturnType<typeof table>>, key: string, column: string) =>
  t.rows.find((r) => r[0] === key)![t.columns.indexOf(column)];

beforeEach(() => {
  jar.clear();
  jar.set("stecia_platform_tenant", "all");
  resetMockRecords();
  resetMockAudit();
});

describe("rules", () => {
  it("parseGrades accepts ranges and normalises them", () => {
    expect(parseGrades("1-7")).toBe("Grades 1–7");
    expect(parseGrades("grades 8 – 12")).toBe("Grades 8–12");
    for (const bad of ["", "7-1", "0-3", "1-13", "abc", "5-5"]) expect(parseGrades(bad), bad).toBeNull();
  });
  it("accessRule keeps whole-school and division roles in their lane", () => {
    const ds = [{ id: "primary", name: "Primary School", code: "PRI", institutionType: "primary" as const }];
    expect(accessRule("Principal", "All divisions", ds)).toBeNull();
    expect(accessRule("Principal", "Primary School", ds)).toMatch(/whole school/);
    expect(accessRule("Head of Primary School", "All divisions", ds)).toMatch(/Primary School only/);
    expect(accessRule("Head of Primary School", "Primary School", ds)).toBeNull();
    expect(accessRule("Bursar", "Primary School", ds)).toBeNull();
  });
});

describe("Subscriptions and Usage & capacity", () => {
  it("edit billing, renewal and the learner limit; they cannot be created", async () => {
    expect((await edit("subscriptions", "subscription", "Northview Primary", { billing: "Termly", renewal: "2026-12-01" })).status).toBe("success");
    const subs = await table("subscriptions", "subscriptions", null);
    expect(cell(subs, "Northview Primary", "Billing")).toBe("Termly");
    expect(cell(subs, "Northview Primary", "Renewal date")).toBe("01 Dec 2026");
    expect((await submitRecord(idle, fd({ slug: "subscriptions", formId: "subscription", mode: "create", billing: "Monthly", renewal: "2026-12-01" }))).status).toBe("error");

    expect((await edit("usage-and-capacity", "capacity", "Northview Primary", { limit: "5000" })).status).toBe("success");
    expect(cell(await table("usage-and-capacity", "usage", null), "Northview Primary", "Learner limit")).toBe("5,000");
    expect((await edit("usage-and-capacity", "capacity", "Northview Primary", { limit: "5" })).status).toBe("error");
  });
});

describe("Institution types", () => {
  it("edits grades for school-level types, normalising the text", async () => {
    expect((await edit("platform-settings", "institution-type", "Primary School", { grades: "1-6" })).status).toBe("success");
    expect(cell(await table("platform-settings", "institution-types", null), "Primary School", "Grades")).toBe("Grades 1–6");
    expect((await edit("platform-settings", "institution-type", "Primary School", { grades: "9-3" })).status).toBe("error");
  });
  it("refuses grades on a tertiary type", async () => {
    const r = await edit("platform-settings", "institution-type", "University", { grades: "1-4" });
    expect(r.status).toBe("error");
    expect(r.errors?.grades).toMatch(/no grades/);
  });
});

describe("Permission matrix", () => {
  const rights = (over: Record<string, string[]>) => {
    const base: Record<string, string[]> = {};
    for (let i = 0; i < 10; i++) base[`r${i}`] = i === 0 ? ["V", "C", "E", "D", "A"] : ["V"];
    return { ...base, ...over };
  };
  it("saves a valid change, and shows none as a dash", async () => {
    expect((await edit("access-control", "permission", "Finances", rights({ r5: ["V", "C"], r8: [] }))).status).toBe("success");
    const m = await table("access-control", "permissions", null);
    expect(cell(m, "Finances", "Cashier")).toBe("V C");
    expect(cell(m, "Finances", "Student")).toBe("—");
  });
  it("needs view for any other right, and keeps Platform Admin in control of access", async () => {
    const noView = await edit("access-control", "permission", "Finances", rights({ r5: ["C"] }));
    expect(noView.errors?.r5).toMatch(/view/);
    const lockout = await edit("access-control", "permission", "Access control", rights({ r0: ["V"] }));
    expect(lockout.errors?.r0).toMatch(/Platform Admin must keep/);
    expect((await edit("access-control", "permission", "Finances", rights({ r0: ["V"] }))).status).toBe("success"); // other modules are fine
  });
});

describe("Staff, division access and divisions", () => {
  beforeEach(() => jar.set("stecia_platform_tenant", "lusaka-hills"));
  const access = () => table("access-control", "division-access", "lusaka-hills");

  it("changing someone's division access shows on the Staff and Division access pages", async () => {
    expect(cell(await access(), "Mrs. Grace Mumba", "Division access")).toBe("All divisions");
    const r = await edit("access-control", "division-access", "STF-0012", { access: "Primary School" });
    expect(r.status, r.message).toBe("success");
    expect(cell(await access(), "Mrs. Grace Mumba", "Division access")).toBe("Primary School");
    expect(cell(await access(), "Mrs. Grace Mumba", "Divisions visible")).toBe("1");
    expect(cell(await table("users/staff", "staff", "lusaka-hills"), "Mrs. Grace Mumba", "Division access")).toBe("Primary School");
  });

  it("a Principal stays whole-school and a Head stays on their division", async () => {
    expect((await edit("access-control", "division-access", "STF-0110", { access: "High School" })).errors?.access).toMatch(/Primary School only/);
    expect((await edit("users/staff", "staff", "STF-0001", { name: "Dr. Alice Mulenga", role: "Principal", level: "Level 1 · Executive", department: "Administration", access: "Primary School", status: "Active" })).errors?.access).toMatch(/whole school/);
  });

  it("changing a role through the Staff form is reflected, and new staff appear on Division access", async () => {
    expect((await edit("users/staff", "staff", "STF-0042", { name: "Ms. Esther Kunda", role: "Registrar", level: "Level 2 · Management", department: "Registry", access: "High School", status: "Active" })).status).toBe("success");
    expect(cell(await access(), "Ms. Esther Kunda", "Role")).toBe("Registrar");
    const add = await submitRecord(idle, fd({ slug: "users/staff", formId: "staff", mode: "create", name: "Mr. New Person", role: "Bursar", level: "Level 2 · Management", department: "Finance", access: "Primary School", status: "Active" }));
    expect(add.status, add.message).toBe("success");
    expect(cell(await access(), "Mr. New Person", "Divisions visible")).toBe("1");
    // Heads are offered per division.
    expect((await submitRecord(idle, fd({ slug: "users/staff", formId: "staff", mode: "create", name: "Ms. Head Two", role: "Head of High School", level: "Level 2 · Management", department: "Administration", access: "Primary School", status: "Active" }))).errors?.access).toMatch(/High School only/);
  });

  it("archiving a staff member removes them from Division access", async () => {
    // Archive through the removal action.
    const { removeRecord } = await import("@/server/actions/records");
    expect((await removeRecord({ slug: "users/staff", formId: "staff", op: "archive", rowKey: "STF-0051" })).status).toBe("success");
    const rows = (await access()).rows.map((r) => r[0]);
    expect(rows).not.toContain("Mr. Peter Daka");
  });

  const school = (id: string) => tenantDirectory.list().then((l) => l.find((t) => t.id === id)!);
  const tenantForm = (name: string, types: string[], extra: Record<string, string> = {}) =>
    edit("tenants-and-schools", "tenant", name, { name, types, plan: "Growth", campuses: "2", status: "Active", ...extra });

  it("adds a division to a school, keeping existing ones and one academic system", async () => {
    const before = await school("chilenje");
    expect(before.divisions.map((d) => d.id)).toEqual(["high_school"]);
    const bad = await tenantForm("Chilenje Secondary", ["High School", "University"]);
    expect(bad.errors?.types).toMatch(/cannot be mixed/);
    const ok = await tenantForm("Chilenje Secondary", ["High School", "Primary School"], { campuses: "1" });
    expect(ok.status, ok.message).toBe("success");
    const after = await school("chilenje");
    expect(after.divisions.map((d) => d.id)).toEqual(["high_school", "primary"]);
    expect(after.divisions[0]).toEqual(before.divisions[0]);
    expect(audit.list().some((e) => e.action === "Divisions changed")).toBe(true);
  });

  it("will not remove a division from a school that has learners, but can for an empty one", async () => {
    const r = await tenantForm("Lusaka Hills Academy", ["Primary School"]);
    expect(r.status).toBe("error");
    expect(r.errors?.types).toMatch(/High School already has learners/);
    expect((await school("lusaka-hills")).divisions).toHaveLength(2);

    await tenantDirectory.create({ name: "Tiny School", plan: "Starter", status: "Trial", campuses: 1, types: ["primary", "high_school"] });
    const ok = await tenantForm("Tiny School", ["Primary School"], { plan: "Starter", campuses: "1", status: "Trial" });
    expect(ok.status, ok.message).toBe("success");
    expect((await school("tiny-school")).divisions.map((d) => d.id)).toEqual(["primary"]);
  });

  it("the edit form opens with the school's current divisions", async () => {
    const tenants = await tenantDirectory.list();
    const s = (await platformScreens.getScreen({ tenant: null, division: null, tenants }, "tenants-and-schools"))!;
    const field = s.forms!.edits["tenants"].fields.find((f) => f.name === "types")!;
    const { cellToValue } = await import("@/lib/forms/spec");
    expect(cellToValue(field, "Primary School + High School")).toEqual(["Primary School", "High School"]);
  });
});
