import { beforeEach, describe, expect, it } from "vitest";
import { INSTITUTION_TYPES } from "@/config/institution";
import { assessmentsFor, coursesFor, HISTORY } from "@/lib/student/seed";
import { buildReport, courseResult, COURSEWORK_WEIGHT, gradePointAverage, pastPeriod } from "@/lib/student/results";
import { mockStudentRepository as repo, resetMockStudent } from "@/server/repositories/student-mock";
import type { StudentContext } from "@/server/repositories/student-types";

const ctx = (institutionType: StudentContext["institutionType"]): StudentContext => ({ tenantId: "t1", studentId: "s1", institutionType });

beforeEach(() => resetMockStudent());

describe("Course results", () => {
  const type = "high_school" as const;
  const course = coursesFor(type)[0];
  const item = (over: Partial<ReturnType<typeof assessmentsFor>[number]>) => ({ id: "x", course: 0, title: "T", kind: "Test" as const, date: "2026-10-01", max: 50, weight: 30, state: "marked" as const, mark: 40, ...over });

  it("combines assessments by weight and coursework at 20%", () => {
    // Test 80% (weight 30), practical 60% (weight 20): assessed = (80*30+60*20)/50 = 72. With coursework 90: 90*0.2 + 72*0.8 = 75.6.
    const r = courseResult(type, course, [item({}), item({ id: "y", max: 20, mark: 12, weight: 20 })], [{ courseId: course.id, mark: 9, max: 10 }]);
    expect(r.coursework).toBe(90);
    expect(r.final).toBe(75.6);
    expect(r.grade).toBe("B");
    expect(r.passed).toBe(true);
  });
  it("leaves out what is not marked instead of counting it as zero", () => {
    const r = courseResult(type, course, [item({}), item({ id: "z", state: "upcoming", mark: undefined, max: 100, weight: 50 }), item({ id: "p", state: "pending", mark: undefined })], []);
    expect(r.final).toBe(80);
    expect(r.provisional).toBe(true);
  });
  it("has no grade until something is marked", () => {
    const r = courseResult(type, course, [item({ state: "upcoming", mark: undefined })], []);
    expect([r.final, r.grade, r.points, r.passed]).toEqual([null, "—", null, null]);
  });
  it("ignores another course's assignments and treats a zero mark as a mark", () => {
    const r = courseResult(type, course, [item({ mark: 0 })], [{ courseId: "other", mark: 10, max: 10 }]);
    expect(r.coursework).toBeNull();
    expect(r.final).toBe(0);
    expect(r.grade).toBe("F");
    expect(r.passed).toBe(false);
  });
  it("uses the published coursework weight", () => {
    expect(COURSEWORK_WEIGHT).toBe(20);
  });
});

describe("Grade-point average", () => {
  it("weights by credits and skips courses with no grade", () => {
    expect(gradePointAverage([{ points: 4, credits: 4 }, { points: 2, credits: 2 }, { points: null, credits: 3 }])).toBe(3.33);
  });
  it("counts each course once when there are no credits, and is null with nothing", () => {
    expect(gradePointAverage([{ points: 3, credits: null }, { points: 1, credits: null }])).toBe(2);
    expect(gradePointAverage([{ points: null, credits: 3 }])).toBeNull();
    expect(gradePointAverage([])).toBeNull();
  });
  it("works out a finished period", () => {
    const p = pastPeriod("university", HISTORY.university[1]);
    // 77% is B+ (3.5), 69% B (3), 64% B (3), 81% A (4); credits 4, 3, 4, 2.
    expect(p.gpa).toBe(Math.round(((3.5 * 4 + 3 * 3 + 3 * 4 + 4 * 2) / 13) * 100) / 100);
    expect(p.credits).toBe(13);
  });
});

describe("Seeded results", () => {
  it.each(INSTITUTION_TYPES)("hold together for %s", async (type) => {
    const r = await repo.getResults(ctx(type));
    expect(r.courses.length).toBeGreaterThan(0);
    expect(r.provisional).toBe(true);
    for (const c of r.courses) {
      expect(c.items).toHaveLength(3);
      for (const i of c.items) if (i.mark !== null) expect(i.mark).toBeLessThanOrEqual(i.maxMarks);
      expect(c.final).not.toBeNull();
    }
    const tertiary = type === "college" || type === "university";
    expect(r.gpa !== null).toBe(tertiary);
    expect(r.cumulativeGpa !== null).toBe(tertiary);
    expect(r.history).toHaveLength(2);
    expect(r.periodLabel).toBe(tertiary ? "Semester 2 2026" : "Term 3 2026");
    expect(r.bands[0].grade).toBe("A");
  });
  it("shows excused and still-marked items without a mark", async () => {
    const r = await repo.getResults(ctx("high_school"));
    expect(r.courses[2].items.find((i) => i.state === "excused")?.mark).toBeNull();
    expect(r.courses[3].items.find((i) => i.state === "pending")?.pct).toBeNull();
  });
  it("picks up newly marked assignments as coursework", async () => {
    const before = await repo.getResults(ctx("high_school"));
    const asg = (await repo.listAssignments(ctx("high_school"))).filter((a) => a.submission?.mark != null && a.courseId === before.courses[0].courseId);
    expect(before.courses[0].courseworkCount).toBe(asg.length);
    expect(before.courses[0].coursework).not.toBeNull();
    // A course with nothing marked has none.
    expect(before.courses[3].courseworkCount).toBe(0);
  });
  it("builds a report from raw parts", () => {
    const type = "college" as const;
    const r = buildReport({ type, periodLabel: "Semester 2 2026", courses: coursesFor(type), assessments: assessmentsFor(type), coursework: [], history: [] });
    expect(r.creditsTotal).toBe(16);
    expect(r.history).toEqual([]);
    expect(r.cumulativeGpa).toBe(r.gpa);
  });
});
