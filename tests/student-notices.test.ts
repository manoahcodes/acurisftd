import { beforeEach, describe, expect, it } from "vitest";
import { INSTITUTION_TYPES } from "@/config/institution";
import { NOTICES_READ_BEFORE, noticesFor } from "@/lib/student/seed";
import { mockStudentRepository as repo, resetMockStudent } from "@/server/repositories/student-mock";
import type { StudentContext } from "@/server/repositories/student-types";
import { NOTICE_CATEGORIES } from "@/types/student";

const ctx: StudentContext = { tenantId: "t1", studentId: "s1", institutionType: "high_school" };
beforeEach(() => resetMockStudent());

describe("Notice seed", () => {
  it.each(INSTITUTION_TYPES)("is sound for %s", (type) => {
    const list = noticesFor(type);
    expect(new Set(list.map((n) => n.id)).size).toBe(list.length);
    for (const n of list) {
      expect(NOTICE_CATEGORIES).toContain(n.category);
      expect(n.title && n.body).toBeTruthy();
      // Wording tokens are all filled in.
      expect(`${n.title} ${n.body}`).not.toMatch(/[{}]|undefined/);
    }
  });
  it("uses Term at schools and Semester at colleges and universities", () => {
    expect(noticesFor("high_school").some((n) => /term/i.test(n.title))).toBe(true);
    expect(noticesFor("university").some((n) => /semester/i.test(n.title))).toBe(true);
    expect(noticesFor("university").some((n) => /\bterm\b/i.test(`${n.title} ${n.body}`))).toBe(false);
  });
});

describe("Notice repository", () => {
  it("starts with the newest three unread, pinned first", async () => {
    const rows = await repo.listNotices(ctx);
    expect(rows[0].pinned).toBe(true);
    expect(rows.filter((n) => !n.read).length).toBe(noticesFor("high_school").filter((n) => n.postedOn >= NOTICES_READ_BEFORE).length);
    expect(await repo.countUnreadNotices(ctx)).toBe(3);
    const rest = rows.filter((n) => !n.pinned);
    for (let i = 1; i < rest.length; i++) expect(rest[i - 1].postedOn >= rest[i].postedOn).toBe(true);
  });
  it("marks one read and unread again", async () => {
    await repo.setNoticeRead(ctx, "ntc-2", true);
    expect(await repo.countUnreadNotices(ctx)).toBe(2);
    await repo.setNoticeRead(ctx, "ntc-2", true);
    expect(await repo.countUnreadNotices(ctx)).toBe(2);
    await repo.setNoticeRead(ctx, "ntc-5", false);
    expect(await repo.countUnreadNotices(ctx)).toBe(3);
    expect((await repo.listNotices(ctx)).find((n) => n.id === "ntc-5")!.read).toBe(false);
  });
  it("marks everything read", async () => {
    await repo.markAllNoticesRead(ctx);
    expect(await repo.countUnreadNotices(ctx)).toBe(0);
    expect((await repo.listNotices(ctx)).every((n) => n.read)).toBe(true);
  });
  it("refuses an unknown notice", async () => {
    expect((await repo.setNoticeRead(ctx, "ntc-999", true)).ok).toBe(false);
  });
  it("keeps each student's read marks separate", async () => {
    await repo.markAllNoticesRead(ctx);
    expect(await repo.countUnreadNotices({ ...ctx, studentId: "s2" })).toBe(3);
  });
});

describe("Student bell and search", () => {
  it("counts unread notices and assignments with nothing handed in", async () => {
    const { studentNotifications } = await import("@/server/queries/student-notifications");
    const first = await studentNotifications(ctx);
    expect(first.unreadCount).toBe(3 + 3);
    expect(first.items.length).toBeLessThanOrEqual(6);
    expect(first.items.every((i) => i.unread && i.href.startsWith("/student/"))).toBe(true);
    await repo.markAllNoticesRead(ctx);
    expect((await studentNotifications(ctx)).unreadCount).toBe(3);
    await repo.submitWork(ctx, "asg-1", { text: "done" }, "2026-11-15T08:00:00.000Z", "2026-11-15");
    expect((await studentNotifications(ctx)).unreadCount).toBe(2);
  });
  it("searches only this student's records", async () => {
    const { searchStudent } = await import("@/server/queries/student-search");
    const hits = await searchStudent(ctx, "essay");
    expect(hits.map((h) => h.kind)).toContain("Assignment");
    expect(hits.every((h) => h.href.startsWith("/student/"))).toBe(true);
    expect((await searchStudent(ctx, "revision")).some((h) => h.kind === "Notice")).toBe(true);
    expect(await searchStudent(ctx, "   ")).toEqual([]);
    expect(await searchStudent(ctx, "zzzzqq")).toEqual([]);
  });
});
