/** Shared shapes for the Student pages. Dates are "YYYY-MM-DD" in the school's zone, times "HH:MM". */

import type { GradeBand, ResourceKind } from "./teacher";

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

// ---- Results and grades

export type ResultState = "marked" | "absent" | "excused" | "pending" | "upcoming";

/** One assessment for one course, as this student sees it. */
export type ResultItem = {
  id: string;
  title: string;
  kind: string;
  date: string;
  maxMarks: number;
  /** Share (1-100) of the assessed part of the course grade. */
  weight: number;
  state: ResultState;
  mark: number | null;
  /** Percent of the marks gained; null where there is no mark. */
  pct: number | null;
  /** The class's average percent, once everyone is marked. */
  classAverage: number | null;
};

export type CourseResult = {
  courseId: string;
  courseName: string;
  code: string;
  teacher: string;
  credits: number | null;
  items: ResultItem[];
  /** Average percent of marked assignments; null when none is marked. */
  coursework: number | null;
  courseworkCount: number;
  /** Share (0-100) of the final figure that comes from assignments. */
  courseworkWeight: number;
  /** The course percentage so far; null until something is marked. */
  final: number | null;
  grade: string;
  /** Grade points on the school's scale; null with no final. */
  points: number | null;
  remark: string;
  passed: boolean | null;
  /** Assessments still to come or to be marked, so the figure may change. */
  provisional: boolean;
};

export type PastCourse = { name: string; credits: number | null; pct: number; grade: string; points: number };
export type PastPeriod = {
  label: string;
  courses: PastCourse[];
  average: number;
  /** Grade-point average for the period (colleges and universities). */
  gpa: number | null;
  credits: number;
};

export type ResultsReport = {
  /** e.g. "Term 3 2026". */
  periodLabel: string;
  courses: CourseResult[];
  /** Average of the course percentages so far; null with none. */
  average: number | null;
  overallGrade: string;
  /** Credit-weighted grade-point average this period (colleges and universities); null at schools. */
  gpa: number | null;
  /** Grade-point average over every period shown, this one included. */
  cumulativeGpa: number | null;
  /** Credits on courses passed so far this period. */
  creditsPassed: number;
  creditsTotal: number;
  history: PastPeriod[];
  bands: GradeBand[];
  passMark: number;
  /** True while any course still has results to come. */
  provisional: boolean;
};

// ---- Attendance

export type AttendanceMark = "present" | "absent" | "late" | "excused";

/** What happened at one sitting on one day. */
export type AttendanceEntry = {
  date: string;
  slotId: string;
  courseId: string;
  courseName: string;
  start: string;
  end: string;
  status: AttendanceMark;
};

/** The student's reason for being away, sent for the school to review. */
export type AbsenceNote = {
  date: string;
  reason: string;
  submittedAt: string;
  state: "pending" | "approved";
};

export type AttendanceReport = {
  periodLabel: string;
  /** First and last school day covered. */
  from: string;
  to: string;
  entries: AttendanceEntry[];
  notes: AbsenceNote[];
  /** Days with no sittings because the school is closed. */
  closures: Array<{ from: string; to: string; label: string }>;
  /** The share (0-100) the school expects. */
  required: number;
};

// ---- Learning resources

/** A link or note a teacher has shared with this student's class. Files are not uploaded. */
export type StudentResource = {
  id: string;
  courseId: string;
  title: string;
  kind: ResourceKind;
  /** An https link, or empty for a note. */
  url: string;
  body: string;
  topic: string;
  postedOn: string;
};

export type StudentResourceRow = StudentResource & {
  courseName: string;
  teacher: string;
  /** The student bookmarked it. */
  saved: boolean;
  /** The student has opened it. */
  opened: boolean;
};
