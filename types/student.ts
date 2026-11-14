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

// ---- Assignments

export const ASSIGNMENT_KINDS = ["Homework", "Classwork", "Project", "Quiz"] as const;
export type AssignmentKind = (typeof ASSIGNMENT_KINDS)[number];

export type AssignmentLink = { label: string; url: string };

/** Work set by a teacher for this student's class. */
export type StudentAssignment = {
  id: string;
  courseId: string;
  title: string;
  instructions: string;
  kind: AssignmentKind;
  postedOn: string;
  dueDate: string;
  maxMarks: number;
  links: AssignmentLink[];
  /** What the student may hand in. At least one is true. */
  allowText: boolean;
  allowFile: boolean;
  /** Work can still be handed in after the due date (it is then marked late). */
  acceptLate: boolean;
};

/** The file kept with a submission. The bytes stay on the server; the page only sees this. */
export type SubmissionFile = { name: string; size: number; type: string };

export type StudentSubmission = {
  assignmentId: string;
  text: string;
  file?: SubmissionFile;
  submittedAt: string;
  /** Handed in after the due date. */
  late: boolean;
  /** How many times it has been handed in (1 = first time). */
  attempts: number;
  /** null until the teacher has marked it. */
  mark: number | null;
  feedback: string;
};

/**
 * todo: not handed in, still open. overdue: not handed in, past the due date.
 * submitted / late: handed in, waiting for a mark. marked: has a mark.
 */
export type AssignmentStatus = "todo" | "overdue" | "submitted" | "late" | "marked";

export type StudentAssignmentRow = StudentAssignment & {
  courseName: string;
  submission?: StudentSubmission;
};
