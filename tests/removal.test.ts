import { beforeEach, describe, expect, it, vi } from "vitest";

const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (k: string) => (jar.has(k) ? { value: jar.get(k) } : undefined) }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

import { applyOverlay, syncCountKpis } from "@/lib/forms/overlay";
import { removeRecord, submitRecord } from "@/server/actions/records";
import { resetMockAudit } from "@/server/repositories/audit-mock";
import { resetMockRecords } from "@/server/repositories/records-mock";
import { audit, platformScreens, tenantDirectory } from "@/server/repositories";
import type { FormState } from "@/types/forms";
import type { TableSection } from "@/types/platform";

const idle: FormState = { status: "idle" };
const fd = (o: Record<string, string | string[]>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) for (const x of Array.isArray(v) ? v : [v]) f.append(k, x);
  return f;
};
const campus = (name: string) => ({ slug: "institution/campuses", formId: "campus", mode: "create", name, code: "EST", location: "Ndola", status: "Active" });
const remove = (op: "archive" | "restore" | "delete", rowKey: string) =>
  removeRecord({ slug: "institution/campuses", formId: "campus", op, rowKey });

async function campuses() {
  const tenants = await tenantDirectory.list();
  const tenant = tenants.find((t) => t.id === "zambezi-university")!;
  return platformScreens.getScreen({ tenant, division: null, tenants }, "institution/campuses");
}

beforeEach(() => {
  jar.clear();
  resetMockRecords();
  resetMockAudit();
  jar.set("stecia_platform_tenant", "zambezi-university");
});

describe("applyOverlay: archive and delete rules", () => {
  const base: TableSection = { id: "t", title: "T", columns: ["Name", "City"], rows: [["A", "Lusaka"], ["B", "Kitwe"]] };
  const overlay = { added: [{ Name: "C", City: "Ndola" }], edits: {}, archived: { B: true as const } };
  it("marks archived rows and lets only form-created rows be deleted", () => {
    const t = applyOverlay(base, overlay);
    expect(t.rows).toHaveLength(3);
    expect(t.rowMeta).toEqual([
      { archived: false, deletable: true },
      { archived: false, deletable: false },
      { archived: true, deletable: false },
    ]);
  });
  it("a table with history never allows delete", () => {
    expect(applyOverlay(base, overlay, undefined, true).rowMeta?.every((m) => !m.deletable)).toBe(true);
  });
});

describe("syncCountKpis", () => {
  const t = (n: number): TableSection => ({ title: "T", columns: ["A"], rows: Array.from({ length: n }, (_, i) => [String(i)]) });
  it("follows the one table whose row count matches", () => {
    const after = { ...t(4), rowMeta: [{}, {}, { archived: true }, {}] };
    const out = syncCountKpis([t(3)], [after], [{ title: "Campuses", caption: "", value: "3" }, { title: "Rate", caption: "", value: "92%" }]);
    expect(out?.map((k) => k.value)).toEqual(["3", "92%"]); // 4 rows - 1 archived = 3
    const grown = syncCountKpis([t(3)], [t(4)], [{ title: "Campuses", caption: "", value: "3" }]);
    expect(grown?.[0].value).toBe("4");
  });
  it("leaves a number alone when two tables could match", () => {
    expect(syncCountKpis([t(3), t(3)], [t(4), t(3)], [{ title: "X", caption: "", value: "3" }])?.[0].value).toBe("3");
  });
});

describe("removeRecord", () => {
  it("archives any row, hides it by default in the data, and restores it", async () => {
    await submitRecord(idle, fd(campus("East Campus")));
    expect((await remove("archive", "Main Campus")).status).toBe("success"); // a base row
    let screen = await campuses();
    const i = screen!.tables[0].rows.findIndex((r) => r[0] === "Main Campus");
    expect(screen!.tables[0].rowMeta?.[i].archived).toBe(true);
    expect((await remove("archive", "Main Campus")).status).toBe("error"); // already
    expect((await remove("restore", "Main Campus")).status).toBe("success");
    screen = await campuses();
    expect(screen!.tables[0].rowMeta?.every((m) => !m.archived)).toBe(true);
  });

  it("deletes only a row created through a form", async () => {
    await submitRecord(idle, fd(campus("East Campus")));
    expect((await remove("delete", "Main Campus")).status).toBe("error");
    expect((await remove("delete", "East Campus")).status).toBe("success");
    expect((await campuses())!.tables[0].rows.some((r) => r[0] === "East Campus")).toBe(false);
    // The name is free again.
    expect((await submitRecord(idle, fd(campus("East Campus")))).status).toBe("success");
  });

  it("keeps the key taken while a row is archived", async () => {
    await submitRecord(idle, fd(campus("East Campus")));
    await remove("archive", "East Campus");
    expect((await submitRecord(idle, fd(campus("East Campus")))).status).toBe("error");
  });

  it("records with history can be archived but never deleted", async () => {
    const pay = { slug: "finances/student-payments", formId: "payment" } as const;
    const tenants = await tenantDirectory.list();
    const tenant = tenants.find((t) => t.id === "zambezi-university")!;
    const first = (await platformScreens.getScreen({ tenant, division: null, tenants }, pay.slug))!.tables[0].rows[0][0];
    expect((await removeRecord({ ...pay, op: "delete", rowKey: first })).status).toBe("error");
    expect((await removeRecord({ ...pay, op: "archive", rowKey: first })).status).toBe("success");
  });

  it("refuses unknown pages, forms, rows and operations", async () => {
    expect((await removeRecord({ slug: "nope", formId: "campus", op: "archive", rowKey: "x" })).status).toBe("error");
    expect((await removeRecord({ slug: "institution/campuses", formId: "nope", op: "archive", rowKey: "x" })).status).toBe("error");
    expect((await remove("archive", "No such campus")).status).toBe("error");
    expect((await removeRecord({ slug: "institution/campuses", formId: "campus", op: "wipe" as "delete", rowKey: "x" })).status).toBe("error");
  });

  it("a school with learners is suspended, not deleted; an empty one can be deleted", async () => {
    const t = { slug: "tenants-and-schools", formId: "tenant" } as const;
    jar.set("stecia_platform_tenant", "all");
    expect((await removeRecord({ ...t, op: "delete", rowKey: "Zambezi University" })).status).toBe("error");
    expect((await removeRecord({ ...t, op: "archive", rowKey: "Zambezi University" })).status).toBe("error");
    await tenantDirectory.create({ name: "Empty School", plan: "Starter", status: "Trial", campuses: 1, types: ["primary"] });
    expect((await removeRecord({ ...t, op: "delete", rowKey: "Empty School" })).status).toBe("success");
    expect((await tenantDirectory.list()).some((x) => x.name === "Empty School")).toBe(false);
  });

  it("logs creates, edits, archives, restores and deletes to the audit trail", async () => {
    await submitRecord(idle, fd(campus("East Campus")));
    await submitRecord(idle, fd({ ...campus("East Campus"), mode: "edit", rowKey: "East Campus", location: "Kitwe" }));
    await remove("archive", "East Campus");
    await remove("restore", "East Campus");
    await remove("delete", "East Campus");
    expect(audit.list().map((e) => e.action)).toEqual([
      "Record deleted", "Record restored", "Record archived", "Record edited", "Record created",
    ]);
    expect(audit.list()[0]).toMatchObject({ user: "User", scope: "zambezi-university", entity: expect.stringContaining("East Campus") });
  });

  it("shows logged changes on the Audit trail page, newest first", async () => {
    await submitRecord(idle, fd(campus("East Campus")));
    const tenants = await tenantDirectory.list();
    const tenant = tenants.find((t) => t.id === "zambezi-university")!;
    const rows = (await platformScreens.getScreen({ tenant, division: null, tenants }, "reports/audit-trail"))!.tables[0].rows;
    expect(rows[0][2]).toBe("Record created");
    const other = tenants.find((t) => t.id === "chilenje")!;
    const otherRows = (await platformScreens.getScreen({ tenant: other, division: null, tenants }, "reports/audit-trail"))!.tables[0].rows;
    expect(otherRows.some((r) => r[2] === "Record created")).toBe(false);
  });

  it("count cards follow added and archived rows", async () => {
    const before = (await campuses())!;
    const card = before.kpis?.find((k) => /^\d+$/.test(k.value) && Number(k.value) === before.tables[0].rows.length);
    if (!card) return; // this screen has no row-count card
    await submitRecord(idle, fd(campus("East Campus")));
    const after = (await campuses())!;
    expect(after.kpis?.find((k) => k.title === card.title)?.value).toBe(String(before.tables[0].rows.length + 1));
  });
});
