import { addDays, weekStart } from "@/lib/teacher/dates";
import { WEEKDAYS, type StudentCourse, type Timetable, type TimetableSlot, type Weekday } from "@/types/student";

/** Pure timetable helpers. They never read the clock: callers pass the date and time in. */

export const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

/** The five dates (Monday to Friday) of the week that contains `iso`. */
export const weekDates = (iso: string): Array<{ day: Weekday; date: string }> => {
  const monday = weekStart(iso);
  return WEEKDAYS.map((day, i) => ({ day, date: addDays(monday, i) }));
};

export const weekdayOf = (iso: string): Weekday | undefined => {
  const i = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return i >= 1 && i <= 5 ? WEEKDAYS[i - 1] : undefined;
};

export type Sitting = {
  slot: TimetableSlot;
  course: StudentCourse;
  date: string;
  room: string;
  /** Set when a one-off change applies on this date. */
  change?: { kind: "cancelled" | "room"; note: string };
};

/** The sittings on one date in time order, with that day's one-off changes applied. */
export function sittingsOn(tt: Timetable, date: string): Sitting[] {
  const day = weekdayOf(date);
  if (!day) return [];
  const courses = new Map(tt.courses.map((c) => [c.id, c]));
  return tt.slots
    .filter((s) => s.day === day)
    .sort((a, b) => toMinutes(a.start) - toMinutes(b.start))
    .flatMap((slot) => {
      const course = courses.get(slot.courseId);
      if (!course) return [];
      const change = tt.changes.find((c) => c.slotId === slot.id && c.date === date);
      return [{ slot, course, date, room: change?.kind === "room" && change.room ? change.room : slot.room, change: change && { kind: change.kind, note: change.note } }];
    });
}

export type Progress = "done" | "now" | "next" | "later";

/**
 * Where each sitting on `date` stands at `nowMinutes` (minutes since midnight)
 * when `date` is today. For other days everything is "later" (or "done" for
 * past days) so no sitting is picked out as next.
 */
export function progressOf(sittings: Sitting[], date: string, today: string, nowMinutes: number): Progress[] {
  if (date < today) return sittings.map(() => "done");
  if (date > today) return sittings.map(() => "later");
  let nextFound = false;
  return sittings.map((s) => {
    if (s.change?.kind === "cancelled") return toMinutes(s.slot.end) <= nowMinutes ? "done" : "later";
    if (toMinutes(s.slot.end) <= nowMinutes) return "done";
    if (toMinutes(s.slot.start) <= nowMinutes) return "now";
    if (!nextFound) {
      nextFound = true;
      return "next";
    }
    return "later";
  });
}

/** The next sitting that has not been cancelled, looking up to two weeks ahead of `today` at `nowMinutes`. */
export function nextSitting(tt: Timetable, today: string, nowMinutes: number): Sitting | undefined {
  for (let i = 0; i < 14; i++) {
    const date = addDays(today, i);
    for (const s of sittingsOn(tt, date)) {
      if (s.change?.kind === "cancelled") continue;
      if (i === 0 && toMinutes(s.slot.start) <= nowMinutes) continue;
      return s;
    }
  }
  return undefined;
}

export const timeRange = (start: string, end: string) => `${start}–${end}`;

/** Hours per week in class. */
export const weeklyHours = (tt: Timetable): number => Math.round((tt.slots.reduce((n, s) => n + toMinutes(s.end) - toMinutes(s.start), 0) / 60) * 10) / 10;
