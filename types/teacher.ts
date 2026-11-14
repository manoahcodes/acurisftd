/** Shared shapes for the Teacher / Lecturer pages. Dates are "YYYY-MM-DD" in the school's zone. */

export const ATTENDANCE_STATUSES = ["present", "absent", "late", "excused"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

/** A class (schools) or course (colleges and universities) this person teaches. */
export type TeachingClass = {
  id: string;
  name: string;
  subject: string;
  room: string;
  time: string;
  /** Teaching days, e.g. ["Mon", "Wed", "Fri"]. */
  days: string[];
};

export type Learner = { id: string; name: string; number: string; classId: string };

export type AttendanceTally = { present: number; absent: number; late: number; excused: number; rate: number | null };

export type ClassSummary = TeachingClass & {
  size: number;
  /** Learners on the watch list. */
  flagged: number;
  /** Share (0-100) present or late across submitted registers; null before any register. */
  attendanceRate: number | null;
  registersTaken: number;
  openAssignments: number;
  note: string;
};

export type RosterEntry = Learner & { flag: string; attendance: AttendanceTally };
export type ClassDetail = ClassSummary & { roster: RosterEntry[] };

export type RegisterStatus = "draft" | "submitted";
export type RegisterRecord = {
  classId: string;
  date: string;
  marks: Record<string, AttendanceStatus>;
  note: string;
  status: RegisterStatus;
  updatedAt: string;
};

export type RegisterSheet = { class: TeachingClass; date: string; roster: Learner[]; record?: RegisterRecord };

export type RegisterHistoryRow = AttendanceTally & {
  classId: string;
  className: string;
  date: string;
  size: number;
  status: RegisterStatus;
  note: string;
};

export const ASSIGNMENT_KINDS = ["Homework", "Classwork", "Project", "Quiz"] as const;
export type AssignmentKind = (typeof ASSIGNMENT_KINDS)[number];
export type AssignmentStatus = "draft" | "published" | "closed";

export type ResourceLink = { label: string; url: string };

export type Assignment = {
  id: string;
  classId: string;
  title: string;
  instructions: string;
  kind: AssignmentKind;
  dueDate: string;
  maxMarks: number;
  status: AssignmentStatus;
  links: ResourceLink[];
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type SubmissionStatus = "pending" | "submitted" | "late" | "missing";
export type Submission = {
  assignmentId: string;
  learnerId: string;
  status: SubmissionStatus;
  /** null until marked. */
  mark: number | null;
  feedback: string;
};

export type AssignmentRow = Assignment & {
  className: string;
  total: number;
  submitted: number;
  marked: number;
  /** Handed in but not yet marked. */
  toMark: number;
};

export type AssignmentDetail = AssignmentRow & { entries: Array<{ learner: Learner; submission: Submission }> };

export type TeachingOverview = {
  classes: number;
  learners: number;
  flaggedClasses: number;
  draftRegisters: number;
  toMark: number;
};

/** What a repository write returns: it worked (with the new id, if any), or why not. */
export type Outcome = { ok: true; id?: string } | { ok: false; error: string };
