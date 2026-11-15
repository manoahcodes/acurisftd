import { beforeEach, describe, expect, it } from "vitest";
import { INSTITUTION_TYPES } from "@/config/institution";
import { byCourse, byDate, canExplain, checkAbsenceNote, currentStreak, dayStatus, figures, generateEntries, NOTE_WINDOW_DAYS, sittingsToRecover } from "@/lib/student/attendance";
import { timetableFor } from "@/lib/student/seed";
import { mockStudentRepository as repo, resetMockStudent } from "@/server/repositories/student-mock";
import type { StudentContext } from "@/server/repositories/student-types";
import type { AttendanceEntry } from "@/types/student";

const ctx = (institutionType: StudentContext["institutionType"] = "high_school"): StudentContext => ({ tenantId: "t1", studentId: "s1", institutionType });
const NOW = "2026-11-15T08:00:00.000Z";
const TODAY = "2026-11-15";
const e = (date: string, status: AttendanceEntry["status"], courseId = "c1"): AttendanceEntry => ({ date, slotId: `s-${date}-${courseId}`, courseId, courseName: courseId, start: "08:00", end: "09:00", status });

beforeEach(() => resetMockStudent());

describe("Attendance figures", () => {
  it("counts late as attending and leaves excused out of the rate", () => {
    const f = figures([{ status: "present" }, { status: "late" }, { status: "absent" }, { status: "excused" }]);
    expect(f).toMatchObject({ present: 1, late: 1, absent: 1, excused: 1, total: 4 });
    expect(f.rate).toBe(67);
  });
  it("has no rate with nothing to count", () => {
    expect(figures([]).rate).toBeNull();
    expect(figures([{ status: "excused" }]).rate).toBeNull();
  });
  it("takes the worst mark of the day", () => {
    expect(dayStatus([])).toBe("none");
    expect(dayStatus([{ status: "present" }, { status: "late" }])).toBe("late");
    expect(dayStatus([{ status: "late" }, { status: "absent" }, { status: "excused" }])).toBe("absent");
    expect(dayStatus([{ status: "present" }, { status: "excused" }])).toBe("excused");
  });
  it("lists the weakest course first", () => {
    const rows = byCourse([e("2026-11-02", "present", "a"), e("2026-11-03", "absent", "b"), e("2026-11-04", "present", "b")]);
    expect(rows.map((r) => r.courseId)).toEqual(["b", "a"]);
  });
  it("counts the streak back from the latest day until an absence", () => {
    const rows = [e("2026-11-02", "absent"), e("2026-11-03", "present"), e("2026-11-04", "late"), e("2026-11-05", "excused"), e("2026-11-06", "present")];
    expect(currentStreak(rows)).toBe(3);
    expect(currentStreak([e("2026-11-06", "absent")])).toBe(0);
  });
  it("works out how many sittings it takes to get back to the required rate", () => {
    const f = figures([...Array(8).fill({ status: "present" }), ...Array(2).fill({ status: "absent" })]);
    expect(f.rate).toBe(80);
    expect(sittingsToRecover(f, 85)).toBe(4);
    expect(sittingsToRecover(figures([{ status: "present" }]), 85)).toBe(0);
  });
});

describe("Generated attendance", () => {
  it.each(INSTITUTION_TYPES)("is consistent for %s", (type) => {
    const tt = timetableFor(type);
    const rows = generateEntries(tt, "k", "2026-09-07", "2026-11-13");
    expect(rows.length).toBeGreaterThan(100);
    const slots = new Set(tt.slots.map((s) => s.id));
    for (const r of rows) {
      expect(slots.has(r.slotId)).toBe(true);
      expect(new Date(`${r.date}T00:00:00Z`).getUTCDay()).not.toBe(0);
      expect(new Date(`${r.date}T00:00:00Z`).getUTCDay()).not.toBe(6);
    }
    // No sittings in the mid-term break, and none on a cancelled sitting.
    expect(rows.some((r) => r.date >= "2026-10-12" && r.date <= "2026-10-16")).toBe(false);
    const rate = figures(rows).rate!;
    expect(rate).toBeGreaterThan(80);
    expect(rate).toBeLessThan(100);
  });
  it("is the same every time", () => {
    const tt = timetableFor("high_school");
    expect(generateEntries(tt, "k", "2026-09-07", "2026-11-13")).toEqual(generateEntries(tt, "k", "2026-09-07", "2026-11-13"));
  });
  it("skips a cancelled sitting", () => {
    const tt = timetableFor("high_school");
    const day = byDate(generateEntries(tt, "k", "2026-11-18", "2026-11-18")).get("2026-11-18") ?? [];
    expect(day.some((r) => r.slotId === "slot-wed-2")).toBe(false);
  });
});

describe("Reasons for absence", () => {
  const rows = [e("2026-11-10", "absent"), e("2026-11-11", "late"), e("2026-10-01", "absent")];
  it("can only be sent for an absent day, not in the future, within the window", () => {
    expect(canExplain(rows, "2026-11-10", TODAY)).toEqual({ ok: true });
    expect(canExplain(rows, "2026-11-11", TODAY).ok).toBe(false);
    expect(canExplain(rows, "2026-11-12", TODAY).ok).toBe(false);
    expect(canExplain(rows, "2026-10-01", TODAY).ok).toBe(false);
    expect(canExplain([e("2026-11-20", "absent")], "2026-11-20", TODAY).ok).toBe(false);
    expect(NOTE_WINDOW_DAYS).toBe(14);
  });
  it("checks the date and the reason", () => {
    expect(checkAbsenceNote({ date: "2026-11-10", reason: "  I was   ill  " })).toEqual({ ok: true, value: { date: "2026-11-10", reason: "I was ill" } });
    expect(checkAbsenceNote({ date: "10/11/2026", reason: "ill today" }).ok).toBe(false);
    expect(checkAbsenceNote({ date: "2026-13-45", reason: "ill today" }).ok).toBe(false);
    expect(checkAbsenceNote({ date: "2026-11-10", reason: "no" })).toMatchObject({ ok: false, fields: { reason: expect.any(String) } });
    expect(checkAbsenceNote({ date: "2026-11-10", reason: "x".repeat(301) }).ok).toBe(false);
    expect(checkAbsenceNote({ date: 5, reason: {} }).ok).toBe(false);
  });
});

describe("Attendance repository", () => {
  it("returns the period's entries with one accepted reason already on file", async () => {
    const r = await repo.getAttendance(ctx());
    expect(r.entries.length).toBeGreaterThan(100);
    expect(r.notes).toHaveLength(1);
    expect(r.notes[0].state).toBe("approved");
    expect(r.entries.some((x) => x.date === r.notes[0].date && x.status === "absent")).toBe(true);
  });
  it("uses the longer semester for colleges and universities", async () => {
    const school = await repo.getAttendance(ctx("high_school"));
    const uni = await repo.getAttendance(ctx("university"));
    expect(uni.from < school.from).toBe(true);
    expect(uni.periodLabel).toBe("Semester 2 2026");
  });
  it("saves a reason for a recent absence, lets it be changed, and takes it back", async () => {
    // Find a student with an absence that has no reason on file yet.
    let me = ctx();
    let date = "";
    for (let i = 1; i < 40 && !date; i++) {
      me = { ...ctx(), studentId: `find-${i}` };
      const r = await repo.getAttendance(me);
      date = r.entries.find((x) => x.status === "absent" && !r.notes.some((n) => n.date === x.date))?.date ?? "";
    }
    expect(date).not.toBe("");
    const soon = new Date(Date.parse(`${date}T00:00:00Z`) + 2 * 86_400_000).toISOString().slice(0, 10);
    expect((await repo.saveAbsenceNote(me, date, "Malaria", NOW, soon)).ok).toBe(true);
    expect((await repo.saveAbsenceNote(me, date, "Malaria, doctor's note", NOW, soon)).ok).toBe(true);
    const after = await repo.getAttendance(me);
    expect(after.notes.find((n) => n.date === date)).toMatchObject({ reason: "Malaria, doctor's note", state: "pending" });
    expect((await repo.removeAbsenceNote(me, date)).ok).toBe(true);
    expect((await repo.removeAbsenceNote(me, date)).ok).toBe(false);
  });
  it("refuses a reason for a day that was not absent, or one already accepted", async () => {
    const r = await repo.getAttendance(ctx());
    const present = r.entries.find((x) => x.status === "present")!.date;
    expect((await repo.saveAbsenceNote(ctx(), present, "Because", NOW, present)).ok).toBe(false);
    const accepted = r.notes[0].date;
    expect((await repo.saveAbsenceNote(ctx(), accepted, "Change it", NOW, accepted)).ok).toBe(false);
    expect((await repo.removeAbsenceNote(ctx(), accepted)).ok).toBe(false);
  });
  it("keeps each student's reasons separate", async () => {
    const other = { ...ctx(), studentId: "s2" };
    const mine = await repo.getAttendance(ctx());
    const theirs = await repo.getAttendance(other);
    expect(theirs.notes.every((n) => theirs.entries.some((x) => x.date === n.date))).toBe(true);
    expect(mine.entries).not.toEqual(theirs.entries);
  });
});
