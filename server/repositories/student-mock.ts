import { statusOf } from "@/lib/fee-policy";
import { studentNoFor } from "@/lib/bursar/link";
import { positionOf } from "./ledger-store";
import { CONTACT_SEED, identityFor, assessmentsFor, assignmentsFor, CURRENT_PERIOD_NO, HISTORY, NOTICES_READ_BEFORE, noticesFor, OPENED_BEFORE, resourcesFor, timetableFor } from "@/lib/student/seed";
import { buildReport } from "@/lib/student/results";
import { studentTermsFor } from "@/lib/student/terms";
import { canSubmit, canWithdraw } from "@/lib/student/assignments";
import { buildAttendance, canExplain, generateEntries, PERIOD_START, SAMPLE_END } from "@/lib/student/attendance";
import type { AbsenceNote, ContactDetails, ProfilePhoto, StudentAssignment, StudentSubmission } from "@/types/student";
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
  /** Key: date. */
  notes?: Record<string, AbsenceNote>;
  /** Resource ids bookmarked and opened. */
  resources?: { saved: string[]; opened: string[] };
  /** Notice ids read. */
  readNotices?: string[];
  profile?: { contact: ContactDetails; photo?: ProfilePhoto; photoVersion?: string; updatedAt?: string };
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

const isTertiaryType = (ctx: StudentContext) => studentTermsFor(ctx.institutionType).tertiary;
const seedKeyOf = (ctx: StudentContext) => `${ctx.institutionType}|${ctx.studentId}`;

/** One reason already sent and approved, so the page shows every state. */
function seedNotes(ctx: StudentContext): Record<string, AbsenceNote> {
  const tt = timetableFor(ctx.institutionType);
  const from = isTertiaryType(ctx) ? PERIOD_START.tertiary : PERIOD_START.school;
  const first = generateEntries(tt, seedKeyOf(ctx), from, SAMPLE_END).find((e) => e.status === "absent");
  return first ? { [first.date]: { date: first.date, reason: "Clinic appointment; a note from the clinic was handed to the office.", submittedAt: `${first.date}T12:00:00.000Z`, state: "approved" } } : {};
}

const seedResources = (ctx: StudentContext) => ({ saved: [] as string[], opened: resourcesFor(ctx.institutionType).filter((r) => r.postedOn < OPENED_BEFORE).map((r) => r.id) });

const seedReadNotices = (ctx: StudentContext) => noticesFor(ctx.institutionType).filter((n) => n.postedOn < NOTICES_READ_BEFORE).map((n) => n.id);

function stateOf(ctx: StudentContext): State {
  let s = data.get(scopeOf(ctx));
  if (!s) {
    s = seed(ctx);
    s.notes = seedNotes(ctx);
    s.resources = seedResources(ctx);
    s.readNotices = seedReadNotices(ctx);
    s.profile = { contact: { ...CONTACT_SEED } };
    data.set(scopeOf(ctx), s);
    save();
  } else if (!s.notes || !s.resources || !s.readNotices || !s.profile) {
    // Saved before these pages existed: add what is missing and keep everything else.
    s.notes ??= seedNotes(ctx);
    s.resources ??= seedResources(ctx);
    s.readNotices ??= seedReadNotices(ctx);
    s.profile ??= { contact: { ...CONTACT_SEED } };
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

  async getFees(ctx) {
    // The Bursar's ledger is the source: what this student owes and when it falls due (a payment plan moves the date).
    const { balance, dueOn } = positionOf({ tenantId: ctx.tenantId, institutionType: ctx.institutionType }, studentNoFor(ctx.institutionType, ctx.studentId));
    // Without a date from the caller a balance is simply due; overdue needs today.
    return { balance, dueOn, status: ctx.today ? statusOf(balance, dueOn, ctx.today) : balance > 0 ? "due" : "paid" };
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

  async getAttendance(ctx) {
    const s = stateOf(ctx);
    const type = ctx.institutionType;
    const terms = studentTermsFor(type);
    return buildAttendance({
      tt: timetableFor(type),
      seedKey: seedKeyOf(ctx),
      tertiary: terms.tertiary,
      periodLabel: `${terms.period} ${CURRENT_PERIOD_NO[type]} 2026`,
      notes: Object.values(s.notes ?? {}).sort((a, b) => b.date.localeCompare(a.date)),
    });
  },

  async saveAbsenceNote(ctx, date, reason, now, today) {
    const s = stateOf(ctx);
    const report = await mockStudentRepository.getAttendance(ctx);
    const can = canExplain(report.entries, date, today);
    if (!can.ok) return bad(can.error);
    if (s.notes![date]?.state === "approved") return bad("The school has already accepted a reason for that day.");
    s.notes![date] = { date, reason, submittedAt: now, state: "pending" };
    save();
    return { ok: true, id: date };
  },

  async removeAbsenceNote(ctx, date) {
    const s = stateOf(ctx);
    const note = s.notes![date];
    if (!note) return bad("There is no reason to take back for that day.");
    if (note.state !== "pending") return bad("The school has already accepted that reason, so it cannot be taken back.");
    delete s.notes![date];
    save();
    return { ok: true, id: date };
  },

  async listResources(ctx) {
    const s = stateOf(ctx);
    const courses = new Map(timetableFor(ctx.institutionType).courses.map((c) => [c.id, c]));
    return resourcesFor(ctx.institutionType)
      .map((r) => ({ ...r, courseName: courses.get(r.courseId)?.name ?? "", teacher: courses.get(r.courseId)?.teacher ?? "", saved: s.resources!.saved.includes(r.id), opened: s.resources!.opened.includes(r.id) }))
      .sort((a, b) => b.postedOn.localeCompare(a.postedOn) || a.title.localeCompare(b.title));
  },

  async setResourceSaved(ctx, resourceId, saved) {
    if (!resourcesFor(ctx.institutionType).some((r) => r.id === resourceId)) return bad("That resource is not available to you.");
    const list = stateOf(ctx).resources!;
    list.saved = saved ? [...new Set([...list.saved, resourceId])] : list.saved.filter((x) => x !== resourceId);
    save();
    return { ok: true, id: resourceId };
  },

  async markResourceOpened(ctx, resourceId) {
    if (!resourcesFor(ctx.institutionType).some((r) => r.id === resourceId)) return bad("That resource is not available to you.");
    const list = stateOf(ctx).resources!;
    if (!list.opened.includes(resourceId)) {
      list.opened.push(resourceId);
      save();
    }
    return { ok: true, id: resourceId };
  },

  async listNotices(ctx) {
    const read = stateOf(ctx).readNotices!;
    return noticesFor(ctx.institutionType)
      .map((n) => ({ ...n, read: read.includes(n.id) }))
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.postedOn.localeCompare(a.postedOn) || a.title.localeCompare(b.title));
  },

  async countUnreadNotices(ctx) {
    const read = stateOf(ctx).readNotices!;
    return noticesFor(ctx.institutionType).filter((n) => !read.includes(n.id)).length;
  },

  async setNoticeRead(ctx, noticeId, isRead) {
    if (!noticesFor(ctx.institutionType).some((n) => n.id === noticeId)) return bad("That notice is not available to you.");
    const s = stateOf(ctx);
    s.readNotices = isRead ? [...new Set([...s.readNotices!, noticeId])] : s.readNotices!.filter((x) => x !== noticeId);
    save();
    return { ok: true, id: noticeId };
  },

  async markAllNoticesRead(ctx) {
    stateOf(ctx).readNotices = noticesFor(ctx.institutionType).map((n) => n.id);
    save();
    return { ok: true };
  },

  async getProfile(ctx) {
    const p = stateOf(ctx).profile!;
    return { identity: identityFor(ctx.institutionType), contact: { ...p.contact }, photoVersion: p.photo ? (p.photoVersion ?? "1") : null, updatedAt: p.updatedAt ?? null };
  },

  async saveContact(ctx, contact, now) {
    const p = stateOf(ctx).profile!;
    p.contact = { ...contact };
    p.updatedAt = now;
    save();
    return { ok: true };
  },

  async savePhoto(ctx, photo, now) {
    const p = stateOf(ctx).profile!;
    p.photo = { ...photo };
    p.photoVersion = now;
    p.updatedAt = now;
    save();
    return { ok: true };
  },

  async removePhoto(ctx, now) {
    const p = stateOf(ctx).profile!;
    if (!p.photo) return bad("There is no photo to remove.");
    delete p.photo;
    delete p.photoVersion;
    p.updatedAt = now;
    save();
    return { ok: true };
  },

  async getPhoto(ctx) {
    const photo = stateOf(ctx).profile!.photo;
    return photo ? { ...photo } : undefined;
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
