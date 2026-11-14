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
