import type { InstitutionType } from "@/config/institution";
import type { AssessmentInput, AssignmentInput, MarkEntry, RegisterInput, ResultEntry } from "@/lib/teacher/validate";
import type {
  AssessmentDetail,
  AssessmentRow,
  AssessmentStatus,
  AssignmentDetail,
  AssignmentRow,
  AssignmentStatus,
  ClassDetail,
  ClassSummary,
  Gradebook,
  Outcome,
  RegisterHistoryRow,
  RegisterRecord,
  RegisterSheet,
  TeachingOverview,
} from "@/types/teacher";

/**
 * Who is asking. Every method reads and writes only this teacher's (or
 * lecturer's) own classes and the learners in them, inside this school. A real
 * implementation must enforce that in its queries, not in the UI.
 */
export type TeacherContext = { tenantId: string; teacherId: string; institutionType: InstitutionType };

/**
 * Everything the Teacher / Lecturer pages read and write. The mock keeps it in
 * memory and a SQLite file; swap it in ./index.ts for your own database.
 * Dates are "YYYY-MM-DD"; `now` is an ISO timestamp from the caller, so the
 * repository never reads the clock itself.
 */
export interface TeachingRepository {
  overview(ctx: TeacherContext): Promise<TeachingOverview>;

  // My classes
  listClasses(ctx: TeacherContext): Promise<ClassSummary[]>;
  getClass(ctx: TeacherContext, classId: string): Promise<ClassDetail | undefined>;
  setClassNote(ctx: TeacherContext, classId: string, note: string): Promise<Outcome>;
  /** An empty note removes the learner from the watch list. */
  setLearnerFlag(ctx: TeacherContext, classId: string, learnerId: string, note: string): Promise<Outcome>;

  // Class register
  getRegister(ctx: TeacherContext, classId: string, date: string): Promise<RegisterSheet | undefined>;
  saveRegister(ctx: TeacherContext, input: RegisterInput, now: string): Promise<Outcome>;
  registerHistory(ctx: TeacherContext): Promise<RegisterHistoryRow[]>;
  /** Every register with its marks, so the page can open any class and date. */
  listRegisters(ctx: TeacherContext): Promise<RegisterRecord[]>;

  // Assignments
  listAssignments(ctx: TeacherContext): Promise<AssignmentRow[]>;
  getAssignment(ctx: TeacherContext, id: string): Promise<AssignmentDetail | undefined>;
  /** `id` undefined creates a draft; otherwise edits that assignment. */
  saveAssignment(ctx: TeacherContext, id: string | undefined, input: AssignmentInput, now: string): Promise<Outcome>;
  setAssignmentStatus(ctx: TeacherContext, id: string, status: AssignmentStatus, now: string): Promise<Outcome>;
  deleteAssignment(ctx: TeacherContext, id: string): Promise<Outcome>;
  saveMarks(ctx: TeacherContext, assignmentId: string, entries: MarkEntry[]): Promise<Outcome>;

  // Assessments
  listAssessments(ctx: TeacherContext): Promise<AssessmentRow[]>;
  getAssessment(ctx: TeacherContext, id: string): Promise<AssessmentDetail | undefined>;
  /** `id` undefined creates a scheduled assessment; otherwise edits that one. */
  saveAssessment(ctx: TeacherContext, id: string | undefined, input: AssessmentInput, now: string): Promise<Outcome>;
  /** Publishing needs every learner to have a mark, or to be marked absent or excused. */
  setAssessmentStatus(ctx: TeacherContext, id: string, status: AssessmentStatus, now: string): Promise<Outcome>;
  /** Only an assessment with no marks can be deleted. */
  deleteAssessment(ctx: TeacherContext, id: string): Promise<Outcome>;
  saveResults(ctx: TeacherContext, assessmentId: string, entries: ResultEntry[]): Promise<Outcome>;

  // Gradebook
  getGradebook(ctx: TeacherContext, classId: string): Promise<Gradebook | undefined>;
  /** Percent (0-50) of the final grade that comes from assignments. */
  setCourseworkWeight(ctx: TeacherContext, classId: string, weight: number): Promise<Outcome>;
  setGradebookRemark(ctx: TeacherContext, classId: string, learnerId: string, remark: string): Promise<Outcome>;
}
