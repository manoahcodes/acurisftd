/** Shared shapes for the Student pages. Dates are "YYYY-MM-DD" in the school's zone, times "HH:MM". */

/** What a repository write returns: it worked (with the new id, if any), or why not. */
export type Outcome = { ok: true; id?: string } | { ok: false; error: string };

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"] as const;
export type Weekday = (typeof WEEKDAYS)[number];

/** A subject (schools) or course (colleges and universities) the student takes. */
export type StudentCourse = {
  id: string;
  name: string;
  /** Short code, e.g. "MTH". */
  code: string;
  teacher: string;
  room: string;
  /** Credit hours (colleges and universities); null at schools. */
  credits: number | null;
};

/** One weekly sitting: the same day and time every week. */
export type TimetableSlot = {
  id: string;
  day: Weekday;
  start: string;
  end: string;
  courseId: string;
  room: string;
};

/** A one-off change to a sitting on a given date. */
export type TimetableChange = {
  slotId: string;
  date: string;
  kind: "cancelled" | "room";
  /** The new room, for kind "room". */
  room?: string;
  note: string;
};

export type Timetable = {
  /** The class or programme the student belongs to, e.g. "Grade 10A". */
  group: string;
  courses: StudentCourse[];
  slots: TimetableSlot[];
  changes: TimetableChange[];
  /** Gaps between sittings that are worth showing (break, lunch). */
  breaks: Array<{ start: string; end: string; label: string }>;
};
