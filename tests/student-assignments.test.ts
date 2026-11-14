import { beforeEach, describe, expect, it } from "vitest";
import { INSTITUTION_TYPES } from "@/config/institution";
import { canSubmit, canWithdraw, daysUntil, dueLabel, percentOf, statusOf } from "@/lib/student/assignments";
import { MAX_SUBMISSION_BYTES, readSubmissionFile, safeFileName, sniffSubmission } from "@/lib/student/files";
import { assignmentsFor } from "@/lib/student/seed";
import { checkSubmission } from "@/lib/student/validate";
import { mockStudentRepository as repo, resetMockStudent } from "@/server/repositories/student-mock";
import type { StudentContext } from "@/server/repositories/student-types";

const ctx: StudentContext = { tenantId: "t1", studentId: "s1", institutionType: "high_school" };
const NOW = "2026-11-14T10:00:00.000Z";
const TODAY = "2026-11-14";
const bytes = (...b: number[]) => new Uint8Array(b);
const text = (s: string) => new TextEncoder().encode(s);

beforeEach(() => resetMockStudent());

describe("Assignment status", () => {
  const a = { dueDate: "2026-11-16" };
  it("is to do until the due date passes, then overdue", () => {
    expect(statusOf(a, undefined, "2026-11-16")).toBe("todo");
    expect(statusOf(a, undefined, "2026-11-17")).toBe("overdue");
  });
  it("never reports overdue before the date is known", () => {
    expect(statusOf(a, undefined, "")).toBe("todo");
  });
  it("follows the submission once there is one", () => {
    expect(statusOf(a, { mark: null, late: false }, TODAY)).toBe("submitted");
    expect(statusOf(a, { mark: null, late: true }, TODAY)).toBe("late");
    expect(statusOf(a, { mark: 5, late: true }, TODAY)).toBe("marked");
    expect(statusOf(a, { mark: 0, late: false }, TODAY)).toBe("marked");
  });
  it("words the due date", () => {
    expect(daysUntil("2026-11-16", "2026-11-14")).toBe(2);
    expect(dueLabel("2026-11-14", TODAY)).toBe("Due today");
    expect(dueLabel("2026-11-15", TODAY)).toBe("Due tomorrow");
    expect(dueLabel("2026-11-19", TODAY)).toBe("Due in 5 days");
    expect(dueLabel("2026-11-13", TODAY)).toBe("1 day overdue");
    expect(dueLabel("2026-11-10", TODAY)).toBe("4 days overdue");
  });
  it("works out percentages", () => {
    expect(percentOf(21, 25)).toBe(84);
    expect(percentOf(7, 9)).toBe(77.8);
  });
});

describe("Hand-in rules", () => {
  it("accepts on time and flags late work", () => {
    expect(canSubmit({ dueDate: "2026-11-14", acceptLate: false }, undefined, "2026-11-14")).toEqual({ ok: true, late: false });
    expect(canSubmit({ dueDate: "2026-11-13", acceptLate: true }, undefined, "2026-11-14")).toEqual({ ok: true, late: true });
  });
  it("refuses late work when the teacher does not take it", () => {
    const r = canSubmit({ dueDate: "2026-11-13", acceptLate: false }, undefined, "2026-11-14");
    expect(r.ok).toBe(false);
  });
  it("locks marked work, even a zero mark", () => {
    expect(canSubmit({ dueDate: "2026-12-01", acceptLate: true }, { mark: 0 }, TODAY).ok).toBe(false);
    expect(canWithdraw({ mark: 0 })).toBe(false);
    expect(canWithdraw({ mark: null })).toBe(true);
    expect(canWithdraw(undefined)).toBe(false);
  });
});

describe("Submission checks", () => {
  const textOnly = { id: "a", allowText: true, allowFile: false };
  const both = { id: "a", allowText: true, allowFile: true };
  it("needs something handed in", () => {
    expect(checkSubmission({ text: "  " }, both, false).ok).toBe(false);
    expect(checkSubmission({ text: "answer" }, both, false)).toMatchObject({ ok: true, value: { text: "answer", hasFile: false } });
    expect(checkSubmission({ text: "" }, both, true).ok).toBe(true);
  });
  it("refuses a file where only text is taken", () => {
    const r = checkSubmission({ text: "x" }, textOnly, true);
    expect(r).toMatchObject({ ok: false, fields: { file: expect.any(String) } });
  });
  it("refuses a very long answer and non-text input", () => {
    expect(checkSubmission({ text: "a".repeat(5001) }, both, false).ok).toBe(false);
    expect(checkSubmission({ text: 42 }, both, false).ok).toBe(false);
  });
});

describe("File checks go by the bytes", () => {
  it("recognises the allowed kinds", () => {
    expect(sniffSubmission(text("%PDF-1.7\n..."))).toBe("application/pdf");
    expect(sniffSubmission(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0))).toBe("image/png");
    expect(sniffSubmission(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
    expect(sniffSubmission(text("Just my answer.\nSecond line."))).toBe("text/plain");
    const docx = new Uint8Array([0x50, 0x4b, 0x03, 0x04, ...text("....word/document.xml....")]);
    expect(sniffSubmission(docx)).toBe("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  });
  it("refuses a zip that is not a Word document, binaries, and empty files", () => {
    expect(sniffSubmission(new Uint8Array([0x50, 0x4b, 0x03, 0x04, ...text("other/file.txt")]))).toBeUndefined();
    expect(sniffSubmission(bytes(0x7f, 0x45, 0x4c, 0x46, 0, 0, 1))).toBeUndefined();
    expect(sniffSubmission(new Uint8Array())).toBeUndefined();
  });
  it("treats SVG and HTML as plain text, never as markup", () => {
    expect(sniffSubmission(text("<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>"))).toBe("text/plain");
    // It is stored and served as a text/plain attachment (nosniff), so it can never run as a page.
  });
  it("reads a File, ignoring its claimed type, and cleans the name", async () => {
    const f = new File([text("%PDF-1.4 hello")], "../../etc/pass wd.exe", { type: "text/html" });
    const r = await readSubmissionFile(f);
    expect(r).toMatchObject({ ok: true, file: { type: "application/pdf", name: "pass wd.exe" } });
  });
  it("refuses empty, oversized and unknown files", async () => {
    expect((await readSubmissionFile(new File([], "a.txt"))).ok).toBe(false);
    expect((await readSubmissionFile(new File([new Uint8Array(MAX_SUBMISSION_BYTES + 1)], "big.pdf"))).ok).toBe(false);
    expect((await readSubmissionFile(new File([bytes(0x7f, 0x45, 0x4c, 0x46)], "tool.pdf", { type: "application/pdf" }))).ok).toBe(false);
  });
  it("cleans file names", () => {
    expect(safeFileName("C:\\Users\\me\\report.pdf")).toBe("report.pdf");
    expect(safeFileName("..hidden")).toBe("hidden");
    expect(safeFileName("")).toBe("submission");
    expect(safeFileName("a<b>\"c\".pdf")).not.toMatch(/[<>"]/);
  });
});

describe("Assignment seed", () => {
  it.each(INSTITUTION_TYPES)("is consistent for %s", (type) => {
    const work = assignmentsFor(type);
    expect(new Set(work.map((w) => w.assignment.id)).size).toBe(work.length);
    expect(work.filter((w) => !w.submission)).toHaveLength(3);
    expect(work.every((w) => w.assignment.allowText || w.assignment.allowFile)).toBe(true);
    for (const w of work) if (w.submission?.mark != null) expect(w.submission.mark).toBeLessThanOrEqual(w.assignment.maxMarks);
  });
});

describe("Student assignments repository", () => {
  it("lists this student's work with the course name and no file bytes", async () => {
    const rows = await repo.listAssignments(ctx);
    expect(rows).toHaveLength(8);
    expect(rows.every((r) => r.courseName !== "")).toBe(true);
    expect(JSON.stringify(rows)).not.toContain("fileData");
    expect(await repo.countPending(ctx)).toBe(3);
  });
  it("hands work in on time, and the pending count drops", async () => {
    const r = await repo.submitWork(ctx, "asg-1", { text: "My answers" }, NOW, "2026-11-14");
    expect(r.ok).toBe(true);
    const row = (await repo.listAssignments(ctx)).find((x) => x.id === "asg-1")!;
    expect(row.submission).toMatchObject({ text: "My answers", late: false, attempts: 1, mark: null });
    expect(await repo.countPending(ctx)).toBe(2);
  });
  it("marks late work as late", async () => {
    await repo.submitWork(ctx, "asg-3", { text: "Sorry it is late" }, NOW, "2026-11-14");
    expect((await repo.listAssignments(ctx)).find((x) => x.id === "asg-3")!.submission?.late).toBe(true);
  });
  it("lets work be handed in again before it is marked, counting attempts and keeping an earlier file", async () => {
    const file = { name: "report.pdf", size: 12, type: "application/pdf", data: Buffer.from("%PDF-1.4 hello").toString("base64") };
    await repo.submitWork(ctx, "asg-2", { text: "v1", file }, NOW, "2026-11-14");
    await repo.submitWork(ctx, "asg-2", { text: "v2" }, NOW, "2026-11-15");
    const sub = (await repo.listAssignments(ctx)).find((x) => x.id === "asg-2")!.submission!;
    expect(sub).toMatchObject({ text: "v2", attempts: 2, file: { name: "report.pdf" } });
    expect((await repo.getSubmissionFile(ctx, "asg-2"))?.data).toBe(file.data);
  });
  it("refuses marked work and unknown ids", async () => {
    expect((await repo.submitWork(ctx, "asg-5", { text: "change it" }, NOW, TODAY)).ok).toBe(false);
    expect((await repo.submitWork(ctx, "asg-999", { text: "x" }, NOW, TODAY)).ok).toBe(false);
    expect((await repo.withdrawWork(ctx, "asg-5")).ok).toBe(false);
    expect((await repo.submitWork(ctx, "asg-1", { text: "" }, NOW, TODAY)).ok).toBe(false);
  });
  it("takes work back before it is marked", async () => {
    expect((await repo.withdrawWork(ctx, "asg-4")).ok).toBe(true);
    expect((await repo.listAssignments(ctx)).find((x) => x.id === "asg-4")!.submission).toBeUndefined();
    expect(await repo.countPending(ctx)).toBe(4);
    expect((await repo.withdrawWork(ctx, "asg-4")).ok).toBe(false);
  });
  it("keeps each student's work separate", async () => {
    const other: StudentContext = { ...ctx, studentId: "s2" };
    await repo.submitWork(ctx, "asg-1", { text: "mine" }, NOW, TODAY);
    expect((await repo.listAssignments(other)).find((x) => x.id === "asg-1")!.submission).toBeUndefined();
    expect(await repo.getSubmissionFile(other, "asg-2")).toBeUndefined();
  });
});
