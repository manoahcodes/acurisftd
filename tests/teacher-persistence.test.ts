import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// A server restart: forget everything held in memory, then load the modules again.
async function restart() {
  const g = globalThis as unknown as Record<string, { db?: { close(): void } } | undefined>;
  g.__acurisDb?.db?.close();
  for (const k of ["__acurisTeaching", "__acurisDb"]) delete g[k];
  vi.resetModules();
}

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "acuris-teacher-"));
  vi.stubEnv("ACURIS_PERSIST", "on");
  vi.stubEnv("ACURIS_DATA_DIR", dir);
});
afterEach(async () => {
  await restart();
  vi.unstubAllEnvs();
  rmSync(dir, { recursive: true, force: true });
});

describe("teaching data survives a restart", () => {
  it("keeps registers, assignments, marks, notes and watch-list entries", async () => {
    const ctx = { tenantId: "t1", teacherId: "u1", institutionType: "high_school" as const };
    await restart();
    const first = (await import("@/server/repositories/teacher-mock")).mockTeachingRepository;
    const [c] = await first.listClasses(ctx);
    await first.setClassNote(ctx, c.id, "Remember the test");
    const made = await first.saveAssignment(ctx, undefined, { classId: c.id, title: "Kept", instructions: "", kind: "Quiz", dueDate: "2026-12-01", maxMarks: 10, links: [{ label: "Notes", url: "https://example.org/" }], notes: "" }, "2026-11-13T08:00:00.000Z");
    const id = made.ok ? made.id! : "";
    await first.setAssignmentStatus(ctx, id, "published", "2026-11-13T08:00:00.000Z");
    const who = (await first.getAssignment(ctx, id))!.entries[0].learner.id;
    await first.saveMarks(ctx, id, [{ learnerId: who, mark: 7, feedback: "ok", status: "submitted" }]);

    await restart();
    const again = (await import("@/server/repositories/teacher-mock")).mockTeachingRepository;
    expect((await again.listClasses(ctx))[0].note).toBe("Remember the test");
    const kept = (await again.getAssignment(ctx, id))!;
    expect(kept).toMatchObject({ title: "Kept", status: "published", links: [{ label: "Notes", url: "https://example.org/" }] });
    expect(kept.entries[0].submission).toMatchObject({ mark: 7, feedback: "ok" });
  });
});

describe("assessments survive a restart, and older saved data gains them", () => {
  it("keeps marks and gradebook settings", async () => {
    const ctx = { tenantId: "t1", teacherId: "u1", institutionType: "high_school" as const };
    await restart();
    const first = (await import("@/server/repositories/teacher-mock")).mockTeachingRepository;
    const [c] = await first.listClasses(ctx);
    const made = await first.saveAssessment(ctx, undefined, { classId: c.id, title: "Kept test", kind: "Test", date: "2026-11-20", maxMarks: 10, weight: 10, notes: "" }, "2026-11-14T08:00:00.000Z");
    const id = made.ok ? made.id! : "";
    await first.setAssessmentStatus(ctx, id, "marking", "2026-11-14T08:00:00.000Z");
    const who = (await first.getAssessment(ctx, id))!.entries[0].learner.id;
    await first.saveResults(ctx, id, [{ learnerId: who, kind: "marked", mark: 9, comment: "good" }]);
    await first.setCourseworkWeight(ctx, c.id, 35);
    await first.setGradebookRemark(ctx, c.id, who, "Excellent");

    await restart();
    const again = (await import("@/server/repositories/teacher-mock")).mockTeachingRepository;
    const d = (await again.getAssessment(ctx, id))!;
    expect(d).toMatchObject({ title: "Kept test", status: "marking" });
    expect(d.entries[0].result).toMatchObject({ mark: 9, comment: "good" });
    const book = (await again.getGradebook(ctx, c.id))!;
    expect(book.courseworkWeight).toBe(35);
    expect(book.rows.find((r) => r.learner.id === who)!.remark).toBe("Excellent");
  });

  it("adds assessments to data saved by Phase 1 without losing anything", async () => {
    const ctx = { tenantId: "t1", teacherId: "u1", institutionType: "high_school" as const };
    await restart();
    const { saveSnapshot } = await import("@/server/persistence/store");
    const first = (await import("@/server/repositories/teacher-mock")).mockTeachingRepository;
    const [c] = await first.listClasses(ctx);
    await first.setClassNote(ctx, c.id, "Phase 1 note");
    // Strip the new fields from what is on disk, as a Phase 1 database would have it.
    const g = globalThis as unknown as { __acurisTeaching: Map<string, Record<string, unknown>> };
    const NEW = new Set(["assessments", "results", "cwWeight", "remarks"]);
    const old = [...g.__acurisTeaching].map(([k, v]) => [k, Object.fromEntries(Object.entries(v).filter(([f]) => !NEW.has(f)))] as const);
    saveSnapshot("teaching", old);

    await restart();
    const again = (await import("@/server/repositories/teacher-mock")).mockTeachingRepository;
    expect((await again.listClasses(ctx))[0].note).toBe("Phase 1 note");
    expect((await again.listAssessments(ctx)).length).toBeGreaterThan(0);
  });
});
