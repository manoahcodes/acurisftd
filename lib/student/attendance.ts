import { addDays, isWeekend } from "@/lib/teacher/dates";
import { tally } from "@/lib/teacher/validate";
import type { AbsenceNote, AttendanceEntry, AttendanceMark, AttendanceReport, Timetable } from "@/types/student";
import { sittingsOn } from "./timetable";

/** Attendance for one student: sample data generation and the figures the page shows. Pure. */

/** The share (0-100) of sittings attended that the school expects. */
export const REQUIRED_RATE = 85;

/** A reason can be sent for an absence this many days back. */
export const NOTE_WINDOW_DAYS = 14;

/** A day in the sample data on which the student is marked absent. */
const RECENT_ABSENCE = "2026-11-12";

export const CLOSURES = [{ from: "2026-10-12", to: "2026-10-16", label: "Mid-term break" }];

/** Start of the period under way (Term 3 or Semester 2 of 2026), by academic system. */
export const PERIOD_START = { school: "2026-09-07", tertiary: "2026-08-17" } as const;
/** The last school day before the sample data was made. */
export const SAMPLE_END = "2026-11-13";

const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  // Mix the bits so that neighbouring dates do not give neighbouring results.
  h ^= h >>> 16;
  h = Math.imul(h, 2246822507);
  h ^= h >>> 13;
  h = Math.imul(h, 3266489909);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};

const isClosed = (date: string) => CLOSURES.some((c) => date >= c.from && date <= c.to);

/** Every sitting from `from` to `to` with a mark: mostly present, with a few late, absent and excused. */
export function generateEntries(tt: Timetable, seedKey: string, from: string, to: string): AttendanceEntry[] {
  const out: AttendanceEntry[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    if (isWeekend(d) || isClosed(d)) continue;
    // A bad day is a whole day: absence mostly comes in days, not single lessons.
    const dayRoll = hash(`${seedKey}|${d}`);
    for (const s of sittingsOn(tt, d)) {
      if (s.change?.kind === "cancelled") continue;
      const roll = hash(`${seedKey}|${d}|${s.slot.id}`);
      let status: AttendanceMark = "present";
      if (dayRoll < 0.07) status = "absent";
      else if (dayRoll < 0.09) status = "excused";
      else if (roll < 0.06) status = "late";
      else if (roll < 0.075) status = "absent";
      // One recent absence, so the page can always show how to send a reason.
      if (d === RECENT_ABSENCE) status = "absent";
      out.push({ date: d, slotId: s.slot.id, courseId: s.course.id, courseName: s.course.name, start: s.slot.start, end: s.slot.end, status });
    }
  }
  return out;
}

export type Figures = { present: number; absent: number; late: number; excused: number; total: number; rate: number | null };

export function figures(entries: Array<Pick<AttendanceEntry, "status">>): Figures {
  const t = tally(entries.map((e) => e.status));
  return { ...t, total: entries.length, rate: t.rate };
}

export type CourseFigures = Figures & { courseId: string; courseName: string };

export function byCourse(entries: AttendanceEntry[]): CourseFigures[] {
  const groups = new Map<string, AttendanceEntry[]>();
  for (const e of entries) groups.set(e.courseId, [...(groups.get(e.courseId) ?? []), e]);
  return [...groups.entries()].map(([courseId, rows]) => ({ courseId, courseName: rows[0].courseName, ...figures(rows) })).sort((a, b) => (a.rate ?? 101) - (b.rate ?? 101) || a.courseName.localeCompare(b.courseName));
}

export type DayStatus = "present" | "late" | "absent" | "excused" | "none";

/** The worst mark of the day: absent, then late, then excused, else present. */
export function dayStatus(rows: Array<Pick<AttendanceEntry, "status">>): DayStatus {
  if (rows.length === 0) return "none";
  for (const s of ["absent", "late", "excused"] as const) if (rows.some((r) => r.status === s)) return s;
  return "present";
}

export function byDate(entries: AttendanceEntry[]): Map<string, AttendanceEntry[]> {
  const m = new Map<string, AttendanceEntry[]>();
  for (const e of entries) m.set(e.date, [...(m.get(e.date) ?? []), e]);
  return m;
}

/** Whole school days in a row, counting back from the latest day, with nothing worse than late. */
export function currentStreak(entries: AttendanceEntry[]): number {
  const days = [...byDate(entries).entries()].sort(([a], [b]) => b.localeCompare(a));
  let n = 0;
  for (const [, rows] of days) {
    const s = dayStatus(rows);
    if (s === "absent") break;
    if (s === "present" || s === "late") n++;
  }
  return n;
}

/** Sittings the student could still reach the required rate with: how many more must be attended in a row. */
export function sittingsToRecover(f: Figures, required: number): number {
  if (f.rate === null || f.rate >= required) return 0;
  const counted = f.total - f.excused;
  const attended = f.present + f.late;
  let n = 0;
  while (((attended + n) / (counted + n)) * 100 < required && n < 1000) n++;
  return n;
}

export const isAbsentDay = (entries: AttendanceEntry[], date: string) => entries.some((e) => e.date === date && e.status === "absent");

/** Whether a reason can be sent for `date`: a day marked absent, not in the future, and not too long ago. */
export function canExplain(entries: AttendanceEntry[], date: string, today: string): { ok: true } | { ok: false; error: string } {
  if (!isAbsentDay(entries, date)) return { ok: false, error: "You were not marked absent on that day." };
  if (date > today) return { ok: false, error: "That date is in the future." };
  if (date < addDays(today, -NOTE_WINDOW_DAYS)) return { ok: false, error: `A reason can only be sent within ${NOTE_WINDOW_DAYS} days. Please speak to the school office.` };
  return { ok: true };
}

export const NOTE_LIMITS = { min: 5, max: 300 };

export function checkAbsenceNote(raw: { date?: unknown; reason?: unknown }): { ok: true; value: { date: string; reason: string } } | { ok: false; error: string; fields?: Record<string, string> } {
  if (typeof raw.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw.date) || Number.isNaN(Date.parse(`${raw.date}T00:00:00Z`))) return { ok: false, error: "Choose a valid date." };
  const reason = typeof raw.reason === "string" ? raw.reason.replace(/\s+/g, " ").trim() : "";
  if (reason.length < NOTE_LIMITS.min) return { ok: false, error: "Tell us briefly why you were away.", fields: { reason: `At least ${NOTE_LIMITS.min} characters.` } };
  if (reason.length > NOTE_LIMITS.max) return { ok: false, error: `The reason can be at most ${NOTE_LIMITS.max} characters.`, fields: { reason: `At most ${NOTE_LIMITS.max} characters.` } };
  return { ok: true, value: { date: raw.date, reason } };
}

export function buildAttendance(args: { tt: Timetable; seedKey: string; tertiary: boolean; periodLabel: string; notes: AbsenceNote[] }): AttendanceReport {
  const from = args.tertiary ? PERIOD_START.tertiary : PERIOD_START.school;
  return {
    periodLabel: args.periodLabel,
    from,
    to: SAMPLE_END,
    entries: generateEntries(args.tt, args.seedKey, from, SAMPLE_END),
    notes: args.notes,
    closures: CLOSURES,
    required: REQUIRED_RATE,
  };
}
