import { beforeEach, describe, expect, it } from "vitest";
import { INSTITUTION_TYPES } from "@/config/institution";
import { OPENED_BEFORE, resourcesFor } from "@/lib/student/seed";
import { mockStudentRepository as repo, resetMockStudent } from "@/server/repositories/student-mock";
import type { StudentContext } from "@/server/repositories/student-types";
import { RESOURCE_KINDS } from "@/types/teacher";

const ctx: StudentContext = { tenantId: "t1", studentId: "s1", institutionType: "high_school" };
beforeEach(() => resetMockStudent());

describe("Resource seed", () => {
  it.each(INSTITUTION_TYPES)("is sound for %s", (type) => {
    const list = resourcesFor(type);
    expect(list.length).toBeGreaterThanOrEqual(8);
    expect(new Set(list.map((r) => r.id)).size).toBe(list.length);
    for (const r of list) {
      expect(RESOURCE_KINDS).toContain(r.kind);
      // Every resource has a link or a note, and links are https only.
      expect(r.url || r.body).not.toBe("");
      if (r.url) expect(r.url).toMatch(/^https:\/\/[^\s]+$/);
      expect(r.title.length).toBeGreaterThan(0);
    }
  });
});

describe("Resource repository", () => {
  it("lists newest first with the course and teacher", async () => {
    const rows = await repo.listResources(ctx);
    expect(rows.length).toBe(resourcesFor("high_school").length);
    expect(rows.every((r) => r.courseName && r.teacher)).toBe(true);
    for (let i = 1; i < rows.length; i++) expect(rows[i - 1].postedOn >= rows[i].postedOn).toBe(true);
  });
  it("treats older resources as already opened and newer ones as new", async () => {
    const rows = await repo.listResources(ctx);
    for (const r of rows) expect(r.opened).toBe(r.postedOn < OPENED_BEFORE);
    expect(rows.some((r) => !r.opened)).toBe(true);
  });
  it("saves and unsaves, without duplicating", async () => {
    await repo.setResourceSaved(ctx, "res-1", true);
    await repo.setResourceSaved(ctx, "res-1", true);
    expect((await repo.listResources(ctx)).filter((r) => r.saved).map((r) => r.id)).toEqual(["res-1"]);
    await repo.setResourceSaved(ctx, "res-1", false);
    expect((await repo.listResources(ctx)).some((r) => r.saved)).toBe(false);
  });
  it("records that a resource was opened", async () => {
    const fresh = (await repo.listResources(ctx)).find((r) => !r.opened)!;
    await repo.markResourceOpened(ctx, fresh.id);
    await repo.markResourceOpened(ctx, fresh.id);
    expect((await repo.listResources(ctx)).find((r) => r.id === fresh.id)!.opened).toBe(true);
  });
  it("refuses an unknown resource", async () => {
    expect((await repo.setResourceSaved(ctx, "res-999", true)).ok).toBe(false);
    expect((await repo.markResourceOpened(ctx, "../etc")).ok).toBe(false);
  });
  it("keeps each student's marks separate", async () => {
    await repo.setResourceSaved(ctx, "res-2", true);
    expect((await repo.listResources({ ...ctx, studentId: "s2" })).some((r) => r.saved)).toBe(false);
  });
});
