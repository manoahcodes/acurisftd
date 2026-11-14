import { assessmentsFor, assignmentsFor, CURRENT_PERIOD_NO, HISTORY, timetableFor } from "@/lib/student/seed";
import { buildReport } from "@/lib/student/results";
import { studentTermsFor } from "@/lib/student/terms";
import { canSubmit, canWithdraw } from "@/lib/student/assignments";
import type { StudentAssignment, StudentSubmission } from "@/types/student";
import { loadSnapshot, saveSnapshot } from "../persistence/store";
import type { StudentContext, StudentRepository } from "./student-types";

/**
 * Student data per school and per student, kept in memory and saved to the
 * SQLite file like the Teacher pages. The timetable and the assignments are
 * set by the school, so they are sample data; what the student changes
 * (hand-ins) is what gets saved.
 */
type Stored = StudentSubmission & { fileData?: string };
type State = {
  /** Key: assignment id. */
  submissions: Record<string, Stored>;
};

const g = globalThis as unknown as { __acurisStudent?: Map<string, State> };
const KEY = "student";
const data = (g.__acurisStudent ??= new Map<string, State>(loadSnapshot<Array<[string, State]>>(KEY) ?? []));
const save = () => saveSnapshot(KEY, [...data]);

const scopeOf = (c: StudentContext) => `${c.tenantId}:${c.studentId}:${c.institutionType}`;
const bad = (error: string) => ({ ok: false as const, error });

function seed(ctx: StudentContext): State {
  const s: State = { submissions: {} };
  for (const { assignment, submission } of assignmentsFor(ctx.institutionType)) {
    if (!submission) continue;
    s.submissions[assignment.id] = { assignmentId: assignment.id, text: submission.text, submittedAt: submission.submittedAt, late: submission.late, attempts: 1, mark: submission.mark, feedback: submission.feedback };
  }
  return s;
}

function stateOf(ctx: StudentContext): State {
  let s = data.get(scopeOf(ctx));
  if (!s) {
    s = seed(ctx);
    data.set(scopeOf(ctx), s);
    save();
  }
  return s;
}

const assignmentOf = (ctx: StudentContext, id: string): StudentAssignment | undefined => assignmentsFor(ctx.institutionType).find((w) => w.assignment.id === id)?.assignment;

/** What the page may see of a stored submission: never the file's bytes. */
const publicOf = (s: Stored): StudentSubmission => ({
  assignmentId: s.assignmentId, text: s.text, file: s.file, submittedAt: s.submittedAt, late: s.late, attempts: s.attempts, mark: s.mark, feedback: s.feedback,
});

export const mockStudentRepository: StudentRepository = {
  async getTimetable(ctx) {
    return timetableFor(ctx.institutionType);
  },

  async listAssignments(ctx) {
    const s = stateOf(ctx);
    const courses = new Map(timetableFor(ctx.institutionType).courses.map((c) => [c.id, c.name]));
    return assignmentsFor(ctx.institutionType).map(({ assignment }) => ({
      ...assignment,
      courseName: courses.get(assignment.courseId) ?? "",
      submission: s.submissions[assignment.id] ? publicOf(s.submissions[assignment.id]) : undefined,
    }));
  },

  async countPending(ctx) {
    const s = stateOf(ctx);
    return assignmentsFor(ctx.institutionType).filter(({ assignment }) => !s.submissions[assignment.id]).length;
  },

  async submitWork(ctx, assignmentId, input, now, today) {
    const a = assignmentOf(ctx, assignmentId);
    if (!a) return bad("That assignment is not one of yours.");
    const s = stateOf(ctx);
    const existing = s.submissions[a.id];
    const check = canSubmit(a, existing, today);
    if (!check.ok) return bad(check.error);
    if (!input.text && !input.file && !existing?.file) return bad("There is nothing to hand in.");
    s.submissions[a.id] = {
      assignmentId: a.id,
      text: input.text,
      file: input.file ? { name: input.file.name, size: input.file.size, type: input.file.type } : existing?.file,
      fileData: input.file ? input.file.data : existing?.fileData,
      submittedAt: now,
      late: check.late,
      attempts: (existing?.attempts ?? 0) + 1,
      mark: null,
      feedback: "",
    };
    save();
    return { ok: true, id: a.id };
  },

  async withdrawWork(ctx, assignmentId) {
    const a = assignmentOf(ctx, assignmentId);
    if (!a) return bad("That assignment is not one of yours.");
    const s = stateOf(ctx);
    const existing = s.submissions[a.id];
    if (!existing) return bad("Nothing has been handed in for this assignment.");
    if (!canWithdraw(existing)) return bad("This work has been marked, so it can no longer be taken back.");
    delete s.submissions[a.id];
    save();
    return { ok: true, id: a.id };
  },

  async getResults(ctx) {
    const s = stateOf(ctx);
    const type = ctx.institutionType;
    const tt = timetableFor(type);
    const coursework = assignmentsFor(type).flatMap(({ assignment }) => {
      const mark = s.submissions[assignment.id]?.mark;
      return mark === null || mark === undefined ? [] : [{ courseId: assignment.courseId, mark, max: assignment.maxMarks }];
    });
    return buildReport({
      type,
      periodLabel: `${studentTermsFor(type).period} ${CURRENT_PERIOD_NO[type]} 2026`,
      courses: tt.courses,
      assessments: assessmentsFor(type),
      coursework,
      history: HISTORY[type],
    });
  },

  async getSubmissionFile(ctx, assignmentId) {
    const a = assignmentOf(ctx, assignmentId);
    const sub = a ? stateOf(ctx).submissions[a.id] : undefined;
    return sub?.file && sub.fileData ? { name: sub.file.name, type: sub.file.type, data: sub.fileData } : undefined;
  },
};

/** Test helper: forget everything. */
export const resetMockStudent = () => {
  data.clear();
  save();
};
