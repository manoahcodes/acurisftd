import { describe, expect, it } from "vitest";
import { INSTITUTION_TYPES } from "@/config/institution";
import { resolveLabel, termsFor } from "@/config/institution";
import { studentTermsFor } from "@/lib/student/terms";
import { timetableFor } from "@/lib/student/seed";
import { nextSitting, progressOf, sittingsOn, toMinutes, weekDates, weekdayOf, weeklyHours } from "@/lib/student/timetable";
import { mockStudentRepository as repo } from "@/server/repositories/student-mock";

describe("Student wording", () => {
  it("uses learner, subject, term and lesson at schools", () => {
    for (const t of ["primary", "high_school"] as const) {
      const w = studentTermsFor(t);
      expect([w.member, w.course, w.period, w.sitting, w.group, w.tertiary]).toEqual(["Learner", "Subject", "Term", "Lesson", "Class", false]);
    }
  });
  it("uses student, course, semester and session at colleges and universities", () => {
    for (const t of ["college", "university"] as const) {
      const w = studentTermsFor(t);
      expect([w.member, w.course, w.period, w.sitting, w.group, w.tertiary]).toEqual(["Student", "Course", "Semester", "Session", "Programme", true]);
    }
  });
  it("keeps the raw nav labels stable", () => {
    expect(resolveLabel("My timetable", termsFor("university"))).toBe("My timetable");
  });
});

describe("Timetable seed", () => {
  it.each(INSTITUTION_TYPES)("is consistent for %s", (type) => {
    const tt = timetableFor(type);
    const ids = new Set(tt.courses.map((c) => c.id));
    expect(tt.slots.length).toBeGreaterThan(0);
    expect(new Set(tt.slots.map((s) => s.id)).size).toBe(tt.slots.length);
    for (const s of tt.slots) {
      expect(ids.has(s.courseId)).toBe(true);
      expect(toMinutes(s.end)).toBeGreaterThan(toMinutes(s.start));
    }
    // No two sittings overlap on a day.
    for (const day of new Set(tt.slots.map((s) => s.day))) {
      const sorted = tt.slots.filter((s) => s.day === day).sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
      sorted.slice(1).forEach((s, i) => expect(toMinutes(s.start)).toBeGreaterThanOrEqual(toMinutes(sorted[i].end)));
    }
    // Every one-off change points at a real sitting on the right weekday.
    for (const c of tt.changes) {
      const slot = tt.slots.find((s) => s.id === c.slotId);
      expect(slot).toBeDefined();
      expect(weekdayOf(c.date)).toBe(slot?.day);
    }
  });
  it("opens Monday with the same order as the dashboard", () => {
    const names = (t: Parameters<typeof timetableFor>[0]) => sittingsOn(timetableFor(t), "2026-11-16").map((s) => s.course.name);
    expect(names("high_school")).toEqual(["Mathematics", "English", "Physics", "Biology", "ICT"]);
    expect(names("university")).toEqual(["Algorithms", "Discrete Mathematics", "Operating Systems", "Research Methods"]);
  });
  it("counts the hours in class", () => {
    expect(weeklyHours(timetableFor("high_school"))).toBe(25);
  });
});

describe("Timetable helpers", () => {
  const tt = timetableFor("high_school");
  it("lists a week from Monday to Friday", () => {
    expect(weekDates("2026-11-14").map((d) => d.date)).toEqual(["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13"]);
    expect(weekDates("2026-11-15")[0].date).toBe("2026-11-09");
  });
  it("has nothing at the weekend", () => {
    expect(sittingsOn(tt, "2026-11-14")).toEqual([]);
  });
  it("applies one-off changes only on their date", () => {
    const cancelled = sittingsOn(tt, "2026-11-18")[1];
    expect(cancelled.change?.kind).toBe("cancelled");
    expect(sittingsOn(tt, "2026-11-25")[1].change).toBeUndefined();
    const moved = sittingsOn(tt, "2026-11-19")[0];
    expect(moved.room).toBe("Lab 4");
    expect(moved.slot.room).not.toBe("Lab 4");
  });
  it("marks done, now, next and later through the day", () => {
    const rows = sittingsOn(tt, "2026-11-16");
    expect(progressOf(rows, "2026-11-16", "2026-11-16", toMinutes("09:30"))).toEqual(["done", "now", "next", "later", "later"]);
    expect(progressOf(rows, "2026-11-16", "2026-11-17", 0)).toEqual(Array(5).fill("done"));
    expect(progressOf(rows, "2026-11-16", "2026-11-15", 0)).toEqual(Array(5).fill("later"));
  });
  it("finds the next sitting, skipping cancelled ones and rolling over the weekend", () => {
    expect(nextSitting(tt, "2026-11-16", toMinutes("07:00"))?.course.name).toBe("Mathematics");
    expect(nextSitting(tt, "2026-11-14", toMinutes("10:00"))?.date).toBe("2026-11-16");
    // Wed 18 Nov, 09:30: the 09:10 English lesson is cancelled, so the next is the 10:30 one.
    expect(nextSitting(tt, "2026-11-18", toMinutes("09:30"))?.slot.start).toBe("10:30");
  });
});

describe("Student repository", () => {
  it("returns the timetable for the school's level", async () => {
    const ctx = { tenantId: "t1", studentId: "s1", institutionType: "university" as const };
    const tt = await repo.getTimetable(ctx);
    expect(tt.group).toBe("BSc Computer Science, Year 2");
    expect(tt.courses.some((c) => c.name === "Algorithms")).toBe(true);
  });
});
