import type { InstitutionType } from "@/config/institution";
import type { StudentAssignmentRow, Outcome, Timetable } from "@/types/student";

/**
 * Who is asking. Every method reads and writes only this student's own records
 * inside this school. A real implementation must enforce that in its queries,
 * not in the UI.
 */
export type StudentContext = { tenantId: string; studentId: string; institutionType: InstitutionType };

/** A checked file ready to store. `data` is the file's bytes as base64. */
export type SubmissionUpload = { name: string; size: number; type: string; data: string };

/**
 * Everything the Student pages read and write. The mock keeps it in memory and
 * a SQLite file; swap it in ./index.ts for your own database. Dates are
 * "YYYY-MM-DD"; `now` is an ISO timestamp and `today` a date in the school's
 * zone, both from the caller, so the repository never reads the clock itself.
 */
export interface StudentRepository {
  // My timetable
  getTimetable(ctx: StudentContext): Promise<Timetable>;

  // Assignments
  listAssignments(ctx: StudentContext): Promise<StudentAssignmentRow[]>;
  /** How many assignments have nothing handed in yet (the sidebar badge). Does not depend on the date. */
  countPending(ctx: StudentContext): Promise<number>;
  /**
   * Hands work in, or hands it in again before it is marked. Refuses marked
   * work and, when the assignment does not take late work, anything after the
   * due date. A new file replaces the old one; with no file the old one is kept.
   */
  submitWork(ctx: StudentContext, assignmentId: string, input: { text: string; file?: SubmissionUpload }, now: string, today: string): Promise<Outcome>;
  /** Takes work back before it is marked. */
  withdrawWork(ctx: StudentContext, assignmentId: string): Promise<Outcome>;
  /** The file kept with a submission, for the student to download again. */
  getSubmissionFile(ctx: StudentContext, assignmentId: string): Promise<{ name: string; type: string; data: string } | undefined>;
}
