import { beforeEach, describe, expect, it } from "vitest";
import { INSTITUTION_TYPES, resolveLabel, termsFor } from "@/config/institution";
import { classesFor, learnersOf } from "@/lib/teacher/seed";
import { teacherTermsFor } from "@/lib/teacher/terms";
import { addDays, isWeekend, lastSchoolDay, prettyDate } from "@/lib/teacher/dates";
import { checkAssignment, checkLinks, checkMarks, checkRegister, tally } from "@/lib/teacher/validate";
import { mockTeachingRepository as repo, resetMockTeaching } from "@/server/repositories/teacher-mock";
import type { TeacherContext } from "@/server/repositories/teacher-types";

const ctx: TeacherContext = { tenantId: "t1", teacherId: "u1", institutionType: "high_school" };

describe("Teacher and Lecturer wording", () => {
  it("uses Teacher, classes and learners for primary and high schools", () => {
    for (const t of ["primary", "high_school"] as const) {
      const w = teacherTermsFor(t);
      expect([w.educator, w.group, w.member, w.pages.planner]).toEqual(["Teacher", "Class", "Learner", "Lesson planner"]);
    }
  });
  it("uses Lecturer, courses and students for colleges and universities", () => {
    for (const t of ["college", "university"] as const) {
      const w = teacherTermsFor(t);
      expect([w.educator, w.group, w.member, w.pages.register, w.pages.planner]).toEqual(["Lecturer", "Course", "Student", "Attendance register", "Course outline"]);
    }
  });
  it("shows lecturer wording in the nav while the raw labels stay stable", () => {
    expect(resolveLabel("My classes", termsFor("university"))).toBe("My courses");
    expect(resolveLabel("Class register", termsFor("college"))).toBe("Attendance register");
    expect(resolveLabel("My classes", termsFor("primary"))).toBe("My classes");
    expect(resolveLabel("Gradebook", termsFor("university"))).toBe("Gradebook");
  });
});

describe("sample classes and rosters", () => {
  it("gives every school type classes with unique, correctly sized rosters", () => {
    for (const type of INSTITUTION_TYPES) {
      const classes = classesFor(type);
      expect(classes.length).toBeGreaterThan(0);
      expect(new Set(classes.map((c) => c.id)).size).toBe(classes.length);
      for (const c of classes) {
        const roster = learnersOf(type, c.id);
        expect(roster.length).toBeGreaterThan(20);
        expect(new Set(roster.map((l) => l.id)).size).toBe(roster.length);
        expect(new Set(roster.map((l) => l.name)).size).toBe(roster.length);
      }
    }
  });
  it("has no roster for a class that is not the teacher's", () => {
    expect(learnersOf("high_school", "cls-someone-elses")).toEqual([]);
  });
});

describe("dates", () => {
  it("steps over weekends", () => {
    expect(addDays("2026-11-13", 3)).toBe("2026-11-16");
    expect(isWeekend("2026-11-14")).toBe(true);
    expect(lastSchoolDay("2026-11-15")).toBe("2026-11-13");
    expect(prettyDate("2026-11-13")).toBe("Fri 13 Nov 2026");
  });
});

describe("register validation", () => {
  const ids = ["a", "b", "c"];
  const ok = { classId: "cls", date: "2026-11-12", marks: { a: "present", b: "late", c: "absent" }, note: " hi ", submit: true };
  it("accepts a complete register and trims the note", () => {
    const r = checkRegister(ok, ids, "2026-11-13");
    expect(r.ok && r.value.note).toBe("hi");
  });
  it("refuses future dates, weekends and bad dates", () => {
    expect(checkRegister({ ...ok, date: "2026-11-14" }, ids, "2026-11-20").ok).toBe(false);
    expect(checkRegister({ ...ok, date: "2026-11-16" }, ids, "2026-11-13").ok).toBe(false);
    expect(checkRegister({ ...ok, date: "2026-02-30" }, ids, "2026-11-13").ok).toBe(false);
  });
  it("refuses marks for people outside the class or with an unknown status", () => {
    expect(checkRegister({ ...ok, marks: { ...ok.marks, z: "present" } }, ids, "2026-11-13").ok).toBe(false);
    expect(checkRegister({ ...ok, marks: { ...ok.marks, a: "sleeping" } }, ids, "2026-11-13").ok).toBe(false);
  });
  it("needs everyone marked to submit, but allows a partial draft", () => {
    const partial = { ...ok, marks: { a: "present" } };
    expect(checkRegister(partial, ids, "2026-11-13").ok).toBe(false);
    expect(checkRegister({ ...partial, submit: false }, ids, "2026-11-13").ok).toBe(true);
  });
  it("counts late as attending and leaves excused out of the rate", () => {
    expect(tally(["present", "late", "absent", "excused"])).toMatchObject({ present: 1, late: 1, absent: 1, excused: 1, rate: 67 });
    expect(tally([]).rate).toBeNull();
  });
});

describe("assignment validation", () => {
  const base = { classId: "c1", title: " Essay ", kind: "Homework", dueDate: "2026-12-01", maxMarks: "20", instructions: "", notes: "", links: [] };
  it("accepts a good assignment", () => {
    const r = checkAssignment(base, ["c1"]);
    expect(r.ok && r.value).toMatchObject({ title: "Essay", maxMarks: 20 });
  });
  it("reports each bad field", () => {
    const r = checkAssignment({ ...base, classId: "other", title: "", kind: "Nap", dueDate: "x", maxMarks: "0" }, ["c1"]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.fields ?? {}).sort()).toEqual(["classId", "dueDate", "kind", "maxMarks", "title"]);
  });
  it("only allows web links", () => {
    expect(checkLinks([{ label: "x", url: "javascript:alert(1)" }]).ok).toBe(false);
    expect(checkLinks([{ label: "x", url: "data:text/html,hi" }]).ok).toBe(false);
    expect(checkLinks([{ label: "", url: "https://a.org" }]).ok).toBe(false);
    expect(checkLinks([{ label: "Notes", url: "https://example.org/a" }])).toMatchObject({ ok: true });
    expect(checkLinks(Array.from({ length: 9 }, () => ({ label: "a", url: "https://a.org" }))).ok).toBe(false);
  });
});

describe("marks validation", () => {
  it("keeps marks between 0 and the maximum, for people in the class", () => {
    expect(checkMarks([{ learnerId: "a", mark: 20, feedback: "" }], 20, ["a"]).ok).toBe(true);
    expect(checkMarks([{ learnerId: "a", mark: 21, feedback: "" }], 20, ["a"]).ok).toBe(false);
    expect(checkMarks([{ learnerId: "a", mark: -1, feedback: "" }], 20, ["a"]).ok).toBe(false);
    expect(checkMarks([{ learnerId: "x", mark: 5, feedback: "" }], 20, ["a"]).ok).toBe(false);
    expect(checkMarks([{ learnerId: "a", mark: 5, feedback: "" }, { learnerId: "a", mark: 6, feedback: "" }], 20, ["a"]).ok).toBe(false);
    expect(checkMarks([{ learnerId: "a", mark: 5, feedback: "", status: "missing" }], 20, ["a"]).ok).toBe(false);
  });
});

describe("teaching repository", () => {
  beforeEach(() => resetMockTeaching());
  const NOW = "2026-11-13T08:00:00.000Z";

  it("matches the dashboard: 5 classes, 184 learners, 2 groups to review", async () => {
    const o = await repo.overview(ctx);
    expect(o).toMatchObject({ classes: 5, learners: 184, flaggedClasses: 2, draftRegisters: 1 });
  });

  it("keeps each teacher's data separate", async () => {
    const other = { ...ctx, teacherId: "u2" };
    const [mine] = await repo.listClasses(ctx);
    await repo.setClassNote(ctx, mine.id, "mine");
    expect((await repo.listClasses(other))[0].note).not.toBe("mine");
  });

  it("refuses classes and learners that are not the teacher's", async () => {
    expect((await repo.setClassNote(ctx, "cls-nope", "x")).ok).toBe(false);
    const [c] = await repo.listClasses(ctx);
    expect((await repo.setLearnerFlag(ctx, c.id, "not-a-learner", "x")).ok).toBe(false);
    expect(await repo.getClass(ctx, "cls-nope")).toBeUndefined();
  });

  it("flags and unflags a learner", async () => {
    const [c] = await repo.listClasses(ctx);
    const detail = (await repo.getClass(ctx, c.id))!;
    const clean = detail.roster.find((l) => !l.flag)!;
    await repo.setLearnerFlag(ctx, c.id, clean.id, "watch");
    expect((await repo.getClass(ctx, c.id))!.roster.find((l) => l.id === clean.id)!.flag).toBe("watch");
    await repo.setLearnerFlag(ctx, c.id, clean.id, "");
    expect((await repo.getClass(ctx, c.id))!.roster.find((l) => l.id === clean.id)!.flag).toBe("");
  });

  it("submitting the draft register clears the draft count", async () => {
    const [c] = await repo.listClasses(ctx);
    const sheet = (await repo.getRegister(ctx, c.id, "2026-11-13"))!;
    expect(sheet.record?.status).toBe("draft");
    const marks = Object.fromEntries(sheet.roster.map((l) => [l.id, "present" as const]));
    await repo.saveRegister(ctx, { classId: c.id, date: "2026-11-13", marks, note: "", submit: true }, NOW);
    expect((await repo.overview(ctx)).draftRegisters).toBe(0);
    expect((await repo.registerHistory(ctx))[0]).toMatchObject({ date: "2026-11-13", status: "submitted", rate: 100 });
  });

  it("creates, edits, publishes, marks and closes an assignment", async () => {
    const [c] = await repo.listClasses(ctx);
    const input = { classId: c.id, title: "New task", instructions: "", kind: "Homework" as const, dueDate: "2026-12-01", maxMarks: 10, links: [], notes: "" };
    const made = await repo.saveAssignment(ctx, undefined, input, NOW);
    expect(made.ok).toBe(true);
    const id = made.ok ? made.id! : "";
    expect((await repo.saveMarks(ctx, id, [])).ok).toBe(false); // still a draft
    expect((await repo.setAssignmentStatus(ctx, id, "published", NOW)).ok).toBe(true);
    const d = (await repo.getAssignment(ctx, id))!;
    const who = d.entries[0].learner.id;
    expect((await repo.saveMarks(ctx, id, [{ learnerId: who, mark: 8, feedback: "Good", status: "submitted" }])).ok).toBe(true);
    const after = (await repo.getAssignment(ctx, id))!;
    expect(after.entries[0].submission).toMatchObject({ mark: 8, feedback: "Good", status: "submitted" });
    expect(after.marked).toBe(1);
    // Work is in, so it can be closed but not deleted, and the maximum cannot drop below a mark.
    expect((await repo.deleteAssignment(ctx, id)).ok).toBe(false);
    expect((await repo.saveAssignment(ctx, id, { ...input, maxMarks: 5 }, NOW)).ok).toBe(false);
    expect((await repo.setAssignmentStatus(ctx, id, "closed", NOW)).ok).toBe(true);
  });

  it("deletes an assignment nobody has handed in", async () => {
    const [c] = await repo.listClasses(ctx);
    const made = await repo.saveAssignment(ctx, undefined, { classId: c.id, title: "Temp", instructions: "", kind: "Quiz", dueDate: "2026-12-01", maxMarks: 5, links: [], notes: "" }, NOW);
    expect((await repo.deleteAssignment(ctx, made.ok ? made.id! : "")).ok).toBe(true);
  });

  it("works for a university: courses and students", async () => {
    const uni: TeacherContext = { tenantId: "u", teacherId: "l1", institutionType: "university" };
    const o = await repo.overview(uni);
    expect(o.classes).toBe(4);
    expect(o.learners).toBe(120 + 95 + 64 + 48);
  });
});
