import { classesFor, learnersOf } from "@/lib/teacher/seed";
import { bandsFor, finalPercent, gradeOf, PASS_MARK, percent, rankOf, round1 } from "@/lib/teacher/grading";
import { tally } from "@/lib/teacher/validate";
import type {
  Assessment,
  AssessmentDetail,
  AssessmentResult,
  AssessmentRow,
  AssessmentStats,
  Assignment,
  AssignmentDetail,
  AssignmentRow,
  AttendanceStatus,
  ClassSummary,
  Gradebook,
  GradebookRow,
  Learner,
  RegisterRecord,
  RosterEntry,
  Submission,
  SubmissionStatus,
} from "@/types/teacher";
import { loadSnapshot, saveSnapshot } from "../persistence/store";
import type { TeacherContext, TeachingRepository } from "./teacher-types";

/**
 * Teaching data per school and per teacher, kept in memory and saved to the
 * SQLite file like the Platform Admin's records. Classes and rosters are fixed
 * sample data; registers, assignments, marks, notes and flags are what a
 * teacher changes, so only those are saved.
 */
type State = {
  /** Key "classId|date". */
  registers: Record<string, RegisterRecord>;
  assignments: Assignment[];
  /** Key "assignmentId|learnerId". Missing means nothing handed in yet. */
  submissions: Record<string, Submission>;
  notes: Record<string, string>;
  /** Watch-list notes by learner id. */
  flags: Record<string, string>;
  seq: number;
  assessments: Assessment[];
  /** Key "assessmentId|learnerId". Missing means not marked yet. */
  results: Record<string, AssessmentResult>;
  /** Percent of the final grade from assignments, by class. */
  cwWeight: Record<string, number>;
  /** Gradebook remarks by learner id. */
  remarks: Record<string, string>;
};

const g = globalThis as unknown as { __acurisTeaching?: Map<string, State> };
const KEY = "teaching";
const data = (g.__acurisTeaching ??= new Map<string, State>(loadSnapshot<Array<[string, State]>>(KEY) ?? []));
const save = () => saveSnapshot(KEY, [...data]);

const scopeOf = (c: TeacherContext) => `${c.tenantId}:${c.teacherId}:${c.institutionType}`;

// A small stable hash, so sample marks do not change between restarts.
const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
};

const SEED_DAYS = ["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12"];
const SEED_NOW = "2026-11-12T16:00:00.000Z";

function seed(ctx: TeacherContext): State {
  const classes = classesFor(ctx.institutionType);
  const s: State = { registers: {}, assignments: [], submissions: {}, notes: {}, flags: {}, seq: 1, assessments: [], results: {}, cwWeight: {}, remarks: {} };

  classes.forEach((cls) => {
    const roster = learnersOf(ctx.institutionType, cls.id);
    for (const date of SEED_DAYS) {
      const marks: Record<string, AttendanceStatus> = {};
      for (const l of roster) {
        const r = hash(`${l.id}|${date}`);
        marks[l.id] = r < 0.06 ? "absent" : r < 0.1 ? "late" : r < 0.12 ? "excused" : "present";
      }
      s.registers[`${cls.id}|${date}`] = { classId: cls.id, date, marks, note: "", status: "submitted", updatedAt: SEED_NOW };
    }
  });

  // One register is still a draft, so the sidebar badge has something to show.
  const first = classes[0];
  if (first) {
    const roster = learnersOf(ctx.institutionType, first.id);
    const marks: Record<string, AttendanceStatus> = {};
    roster.slice(0, Math.ceil(roster.length / 2)).forEach((l) => (marks[l.id] = "present"));
    s.registers[`${first.id}|2026-11-13`] = { classId: first.id, date: "2026-11-13", marks, note: "", status: "draft", updatedAt: SEED_NOW };
  }

  // Two groups to review: a couple of learners on the watch list in each.
  const flagged = [classes[0], classes[2]].filter(Boolean);
  flagged.forEach((cls, i) => {
    const roster = learnersOf(ctx.institutionType, cls.id);
    s.flags[roster[2 + i].id] = "Missed three lessons in a row; follow up with the guardian.";
    s.flags[roster[9 + i].id] = "Falling behind on homework.";
  });
  if (classes[0]) s.notes[classes[0].id] = "Revision for the end-of-term test starts next week.";

  const make = (cls: (typeof classes)[number], title: string, kind: Assignment["kind"], dueDate: string, maxMarks: number, status: Assignment["status"], instructions: string): Assignment => ({
    id: `asg-${s.seq++}`,
    classId: cls.id,
    title,
    instructions,
    kind,
    dueDate,
    maxMarks,
    status,
    links: [],
    notes: "",
    createdAt: "2026-11-02T08:00:00.000Z",
    updatedAt: SEED_NOW,
  });

  const subject = (i: number) => classes[i].subject;
  const picks: Array<[number, string, Assignment["kind"], string, number, Assignment["status"], string]> = [
    [0, `${subject(0)} worksheet`, "Homework", "2026-11-16", 20, "published", "Complete all questions and show your working."],
    [1, "Quadratic equations", "Classwork", "2026-11-11", 30, "closed", "Solve the set questions from the board."],
    [2, "Week 4 quiz", "Quiz", "2026-11-18", 25, "published", "A short quiz on this week's work."],
    [0, "Topic project plan", "Project", "2026-11-27", 40, "draft", "Outline your plan before the project begins."],
  ];
  for (const [ci, title, kind, due, max, status, text] of picks) {
    if (!classes[ci]) continue;
    const a = make(classes[ci], title, kind, due, max, status, text);
    s.assignments.push(a);
    if (status === "draft") continue;
    for (const l of learnersOf(ctx.institutionType, a.classId)) {
      const r = hash(`${a.id}|${l.id}`);
      if (status === "published" && r > 0.55) continue; // not handed in yet
      if (status === "closed" && r > 0.9) continue; // missing
      const late = r > 0.45 && r <= 0.55;
      const marked = hash(`${a.id}|${l.id}|m`) < (status === "closed" ? 0.85 : 0.4);
      s.submissions[`${a.id}|${l.id}`] = {
        assignmentId: a.id,
        learnerId: l.id,
        status: late ? "late" : "submitted",
        mark: marked ? Math.round(a.maxMarks * (0.4 + hash(`${l.id}|${a.id}`) * 0.6)) : null,
        feedback: "",
      };
    }
  }
  seedAssessments(ctx, s);
  return s;
}

function seedAssessments(ctx: TeacherContext, s: State) {
  const classes = classesFor(ctx.institutionType);
  const make = (ci: number, title: string, kind: Assessment["kind"], date: string, maxMarks: number, weight: number, status: Assessment["status"], share: number) => {
    const cls = classes[ci];
    if (!cls) return;
    const a: Assessment = { id: `ass-${s.seq++}`, classId: cls.id, title, kind, date, maxMarks, weight, status, notes: "", createdAt: "2026-10-01T08:00:00.000Z", updatedAt: SEED_NOW };
    s.assessments.push(a);
    if (status === "scheduled") return;
    for (const l of learnersOf(ctx.institutionType, cls.id)) {
      const r = hash(`${a.id}|${l.id}`);
      if (hash(`${a.id}|${l.id}|s`) > share) continue; // not marked yet
      if (r < 0.03) s.results[`${a.id}|${l.id}`] = { assessmentId: a.id, learnerId: l.id, kind: r < 0.015 ? "absent" : "excused", mark: null, comment: "" };
      else s.results[`${a.id}|${l.id}`] = { assessmentId: a.id, learnerId: l.id, kind: "marked", mark: Math.round(maxMarks * (0.3 + hash(`${l.id}|${a.id}|m`) * 0.65)), comment: "" };
    }
  };
  make(0, "Mid-term test", "Test", "2026-10-14", 50, 30, "published", 1);
  make(0, "Practical 1", "Practical", "2026-11-05", 20, 20, "marking", 0.6);
  make(0, "End-of-term exam", "Exam", "2026-12-04", 100, 50, "scheduled", 0);
  make(1, "Mid-term test", "Test", "2026-10-14", 50, 40, "published", 1);
  make(1, "End-of-term exam", "Exam", "2026-12-04", 100, 60, "scheduled", 0);
  make(2, "Mid-term test", "Test", "2026-10-15", 50, 40, "published", 1);
  make(2, "Week 5 test", "Test", "2026-11-11", 30, 20, "marking", 0.25);
  make(3, "Mid-term test", "Test", "2026-10-15", 50, 100, "published", 1);
}

function stateOf(ctx: TeacherContext): State {
  let s = data.get(scopeOf(ctx));
  if (!s) {
    s = seed(ctx);
    data.set(scopeOf(ctx), s);
    save();
  } else if (!s.assessments) {
    // Saved before assessments existed: add them and keep everything else.
    Object.assign(s, { assessments: [], results: {}, cwWeight: {}, remarks: {} });
    seedAssessments(ctx, s);
    save();
  }
  return s;
}

const classOf = (ctx: TeacherContext, id: string) => classesFor(ctx.institutionType).find((c) => c.id === id);
const rosterOf = (ctx: TeacherContext, id: string): Learner[] => learnersOf(ctx.institutionType, id);

function summarise(ctx: TeacherContext, s: State, cls: ReturnType<typeof classesFor>[number]): ClassSummary {
  const roster = rosterOf(ctx, cls.id);
  const ids = new Set(roster.map((l) => l.id));
  const submitted = Object.values(s.registers).filter((r) => r.classId === cls.id && r.status === "submitted");
  const statuses = submitted.flatMap((r) => Object.entries(r.marks).filter(([id]) => ids.has(id)).map(([, v]) => v));
  return {
    ...cls,
    size: roster.length,
    flagged: roster.filter((l) => s.flags[l.id]).length,
    attendanceRate: submitted.length ? tally(statuses).rate : null,
    registersTaken: submitted.length,
    openAssignments: s.assignments.filter((a) => a.classId === cls.id && a.status === "published").length,
    note: s.notes[cls.id] ?? "",
  };
}

const toMarkIn = (s: State, a: Assignment) =>
  Object.values(s.submissions).filter((x) => x.assignmentId === a.id && (x.status === "submitted" || x.status === "late") && x.mark === null).length;

function rowOf(ctx: TeacherContext, s: State, a: Assignment): AssignmentRow {
  const subs = Object.values(s.submissions).filter((x) => x.assignmentId === a.id);
  return {
    ...a,
    className: classOf(ctx, a.classId)?.name ?? "",
    total: rosterOf(ctx, a.classId).length,
    submitted: subs.filter((x) => x.status === "submitted" || x.status === "late").length,
    marked: subs.filter((x) => x.mark !== null).length,
    toMark: toMarkIn(s, a),
  };
}


const resultOf = (s: State, a: Assessment, learnerId: string): AssessmentResult =>
  s.results[`${a.id}|${learnerId}`] ?? { assessmentId: a.id, learnerId, kind: "pending", mark: null, comment: "" };

function assessmentRow(ctx: TeacherContext, s: State, a: Assessment): AssessmentRow {
  const roster = rosterOf(ctx, a.classId);
  const results = roster.map((l) => resultOf(s, a, l.id));
  const marks = results.filter((r) => r.kind === "marked" && r.mark !== null).map((r) => r.mark as number);
  const pass = PASS_MARK;
  const stats: AssessmentStats = {
    marked: marks.length,
    average: marks.length ? round1(marks.reduce((n, m) => n + m, 0) / marks.length) : null,
    highest: marks.length ? Math.max(...marks) : null,
    lowest: marks.length ? Math.min(...marks) : null,
    passRate: marks.length ? Math.round((marks.filter((m) => percent(m, a.maxMarks) >= pass).length / marks.length) * 100) : null,
  };
  return {
    ...a,
    ...stats,
    className: classOf(ctx, a.classId)?.name ?? "",
    total: roster.length,
    absent: results.filter((r) => r.kind === "absent").length,
    excused: results.filter((r) => r.kind === "excused").length,
    toMark: a.status === "marking" ? results.filter((r) => r.kind === "pending").length : 0,
  };
}

function buildGradebook(ctx: TeacherContext, s: State, cls: NonNullable<ReturnType<typeof classOf>>): Gradebook {
  const bands = bandsFor(ctx.institutionType);
  const passMark = PASS_MARK;
  const cw = s.cwWeight[cls.id] ?? 20;
  const assessments = s.assessments.filter((a) => a.classId === cls.id && a.status !== "scheduled").sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
  const assignments = s.assignments.filter((a) => a.classId === cls.id && a.status !== "draft");
  const roster = rosterOf(ctx, cls.id);

  const partial = roster.map((learner) => {
    const scores: Record<string, number | null> = {};
    for (const a of assessments) {
      const r = resultOf(s, a, learner.id);
      scores[a.id] = r.kind === "marked" && r.mark !== null ? percent(r.mark, a.maxMarks) : null;
    }
    const works = assignments.map((a) => s.submissions[`${a.id}|${learner.id}`]).flatMap((x, i) => (x && x.mark !== null ? [percent(x.mark, assignments[i].maxMarks)] : []));
    const coursework = works.length ? round1(works.reduce((n, w) => n + w, 0) / works.length) : null;
    const final = finalPercent(assessments.map((a) => ({ pct: scores[a.id], weight: a.weight })), coursework, cw);
    const missing = assessments.filter((a) => scores[a.id] === null && resultOf(s, a, learner.id).kind !== "excused").length;
    return { learner, scores, coursework, final, missing };
  });

  const ranks = rankOf(partial.map((p) => p.final));
  const rows: GradebookRow[] = partial.map((p, i) => {
    const band = p.final === null ? null : gradeOf(p.final, bands);
    return { ...p, grade: band?.grade ?? "—", points: band?.points ?? null, rank: ranks[i], passed: p.final === null ? null : p.final >= passMark, remark: s.remarks[p.learner.id] ?? "" };
  });
  const finals = rows.map((r) => r.final).filter((f): f is number => f !== null);
  return {
    classId: cls.id,
    className: cls.name,
    subject: cls.subject,
    courseworkWeight: cw,
    columns: assessments.map((a) => ({ id: a.id, title: a.title, kind: a.kind, maxMarks: a.maxMarks, weight: a.weight, status: a.status })),
    assignmentCount: assignments.length,
    rows,
    average: finals.length ? round1(finals.reduce((n, f) => n + f, 0) / finals.length) : null,
    highest: finals.length ? Math.max(...finals) : null,
    passRate: finals.length ? Math.round((finals.filter((f) => f >= passMark).length / finals.length) * 100) : null,
    distribution: bands.map((b) => ({ grade: b.grade, count: rows.filter((r) => r.grade === b.grade).length })),
    bands,
    passMark,
  };
}

const fail = (error: string) => ({ ok: false as const, error });

export const mockTeachingRepository: TeachingRepository = {
  async overview(ctx) {
    const s = stateOf(ctx);
    const classes = classesFor(ctx.institutionType);
    const summaries = classes.map((c) => summarise(ctx, s, c));
    return {
      classes: classes.length,
      learners: summaries.reduce((n, c) => n + c.size, 0),
      flaggedClasses: summaries.filter((c) => c.flagged > 0).length,
      draftRegisters: Object.values(s.registers).filter((r) => r.status === "draft").length,
      toMark: s.assignments.filter((a) => a.status !== "draft").reduce((n, a) => n + toMarkIn(s, a), 0),
      assessmentsToMark: s.assessments.reduce((n, a) => n + assessmentRow(ctx, s, a).toMark, 0),
    };
  },

  async listClasses(ctx) {
    const s = stateOf(ctx);
    return classesFor(ctx.institutionType).map((c) => summarise(ctx, s, c));
  },

  async getClass(ctx, classId) {
    const cls = classOf(ctx, classId);
    if (!cls) return undefined;
    const s = stateOf(ctx);
    const submitted = Object.values(s.registers).filter((r) => r.classId === classId && r.status === "submitted");
    const roster: RosterEntry[] = rosterOf(ctx, classId).map((l) => ({
      ...l,
      flag: s.flags[l.id] ?? "",
      attendance: tally(submitted.map((r) => r.marks[l.id]).filter((m): m is AttendanceStatus => Boolean(m))),
    }));
    return { ...summarise(ctx, s, cls), roster };
  },

  async setClassNote(ctx, classId, note) {
    if (!classOf(ctx, classId)) return fail("That class is not one of yours.");
    const s = stateOf(ctx);
    if (note) s.notes[classId] = note;
    else delete s.notes[classId];
    save();
    return { ok: true };
  },

  async setLearnerFlag(ctx, classId, learnerId, note) {
    if (!classOf(ctx, classId)) return fail("That class is not one of yours.");
    if (!rosterOf(ctx, classId).some((l) => l.id === learnerId)) return fail("That person is not in this class.");
    const s = stateOf(ctx);
    if (note) s.flags[learnerId] = note;
    else delete s.flags[learnerId];
    save();
    return { ok: true };
  },

  async getRegister(ctx, classId, date) {
    const cls = classOf(ctx, classId);
    if (!cls) return undefined;
    return { class: cls, date, roster: rosterOf(ctx, classId), record: stateOf(ctx).registers[`${classId}|${date}`] };
  },

  async saveRegister(ctx, input, now) {
    if (!classOf(ctx, input.classId)) return fail("That class is not one of yours.");
    const s = stateOf(ctx);
    const key = `${input.classId}|${input.date}`;
    s.registers[key] = { classId: input.classId, date: input.date, marks: input.marks, note: input.note, status: input.submit ? "submitted" : "draft", updatedAt: now };
    save();
    return { ok: true };
  },

  async registerHistory(ctx) {
    const s = stateOf(ctx);
    const rows = Object.values(s.registers).flatMap((r) => {
      const cls = classOf(ctx, r.classId);
      if (!cls) return [];
      return [{ ...tally(Object.values(r.marks)), classId: r.classId, className: cls.name, date: r.date, size: rosterOf(ctx, r.classId).length, status: r.status, note: r.note }];
    });
    return rows.sort((a, b) => b.date.localeCompare(a.date) || a.className.localeCompare(b.className, "en", { numeric: true }));
  },

  async listRegisters(ctx) {
    return Object.values(stateOf(ctx).registers).filter((r) => classOf(ctx, r.classId));
  },

  async listAssignments(ctx) {
    const s = stateOf(ctx);
    return s.assignments.map((a) => rowOf(ctx, s, a)).sort((a, b) => b.dueDate.localeCompare(a.dueDate) || a.title.localeCompare(b.title));
  },

  async getAssignment(ctx, id) {
    const s = stateOf(ctx);
    const a = s.assignments.find((x) => x.id === id);
    if (!a || !classOf(ctx, a.classId)) return undefined;
    const entries = rosterOf(ctx, a.classId).map((learner) => ({
      learner,
      submission:
        s.submissions[`${a.id}|${learner.id}`] ??
        ({ assignmentId: a.id, learnerId: learner.id, status: (a.status === "closed" ? "missing" : "pending") as SubmissionStatus, mark: null, feedback: "" } satisfies Submission),
    }));
    return { ...rowOf(ctx, s, a), entries } satisfies AssignmentDetail;
  },

  async saveAssignment(ctx, id, input, now) {
    if (!classOf(ctx, input.classId)) return fail("That class is not one of yours.");
    const s = stateOf(ctx);
    if (!id) {
      const a: Assignment = { ...input, id: `asg-${s.seq++}`, status: "draft", createdAt: now, updatedAt: now };
      s.assignments.push(a);
      save();
      return { ok: true, id: a.id };
    }
    const i = s.assignments.findIndex((x) => x.id === id);
    if (i < 0) return fail("That assignment no longer exists.");
    const old = s.assignments[i];
    // Moving a handed-in assignment to another class would orphan its work; marks cannot exceed a lowered maximum.
    if (old.status !== "draft" && old.classId !== input.classId) return fail("The class cannot change once it is published.");
    const tooHigh = Object.values(s.submissions).some((x) => x.assignmentId === id && x.mark !== null && x.mark > input.maxMarks);
    if (tooHigh) return fail("Some marks are above the new maximum. Correct them first.");
    s.assignments[i] = { ...old, ...input, updatedAt: now };
    save();
    return { ok: true, id };
  },

  async setAssignmentStatus(ctx, id, status, now) {
    const s = stateOf(ctx);
    const a = s.assignments.find((x) => x.id === id);
    if (!a || !classOf(ctx, a.classId)) return fail("That assignment no longer exists.");
    if (status === "draft" && a.status !== "draft" && Object.values(s.submissions).some((x) => x.assignmentId === id)) {
      return fail("Work has already been handed in, so this cannot go back to draft.");
    }
    a.status = status;
    a.updatedAt = now;
    save();
    return { ok: true };
  },

  async deleteAssignment(ctx, id) {
    const s = stateOf(ctx);
    const a = s.assignments.find((x) => x.id === id);
    if (!a || !classOf(ctx, a.classId)) return fail("That assignment no longer exists.");
    if (Object.values(s.submissions).some((x) => x.assignmentId === id)) return fail("Work has been handed in for this assignment, so it cannot be deleted. Close it instead.");
    s.assignments = s.assignments.filter((x) => x.id !== id);
    save();
    return { ok: true };
  },

  async saveMarks(ctx, assignmentId, entries) {
    const s = stateOf(ctx);
    const a = s.assignments.find((x) => x.id === assignmentId);
    if (!a || !classOf(ctx, a.classId)) return fail("That assignment no longer exists.");
    if (a.status === "draft") return fail("Publish the assignment before entering marks.");
    for (const e of entries) {
      const key = `${assignmentId}|${e.learnerId}`;
      const old = s.submissions[key];
      let status: SubmissionStatus = e.status ?? old?.status ?? (e.mark !== null ? "submitted" : "pending");
      if (e.mark !== null && (status === "pending" || status === "missing")) status = "submitted";
      if (status === "pending" && e.feedback === "" && !old) continue;
      s.submissions[key] = { assignmentId, learnerId: e.learnerId, status, mark: e.mark, feedback: e.feedback };
    }
    save();
    return { ok: true };
  },
  async listAssessments(ctx) {
    const s = stateOf(ctx);
    return s.assessments.map((a) => assessmentRow(ctx, s, a)).sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));
  },

  async getAssessment(ctx, id) {
    const s = stateOf(ctx);
    const a = s.assessments.find((x) => x.id === id);
    if (!a || !classOf(ctx, a.classId)) return undefined;
    const entries = rosterOf(ctx, a.classId).map((learner) => ({ learner, result: resultOf(s, a, learner.id) }));
    return { ...assessmentRow(ctx, s, a), entries } satisfies AssessmentDetail;
  },

  async saveAssessment(ctx, id, input, now) {
    if (!classOf(ctx, input.classId)) return fail("That class is not one of yours.");
    const s = stateOf(ctx);
    if (!id) {
      const a: Assessment = { ...input, id: `ass-${s.seq++}`, status: "scheduled", createdAt: now, updatedAt: now };
      s.assessments.push(a);
      save();
      return { ok: true, id: a.id };
    }
    const i = s.assessments.findIndex((x) => x.id === id);
    if (i < 0) return fail("That assessment no longer exists.");
    const old = s.assessments[i];
    const hasMarks = Object.values(s.results).some((r) => r.assessmentId === id && (r.mark !== null || r.kind !== "pending"));
    if (hasMarks && old.classId !== input.classId) return fail("The class cannot change once marks are entered.");
    if (Object.values(s.results).some((r) => r.assessmentId === id && r.mark !== null && r.mark > input.maxMarks)) return fail("Some marks are above the new maximum. Correct them first.");
    s.assessments[i] = { ...old, ...input, updatedAt: now };
    save();
    return { ok: true, id };
  },

  async setAssessmentStatus(ctx, id, status, now) {
    const s = stateOf(ctx);
    const a = s.assessments.find((x) => x.id === id);
    if (!a || !classOf(ctx, a.classId)) return fail("That assessment no longer exists.");
    if (status === "published") {
      const open = assessmentRow(ctx, s, { ...a, status: "marking" }).toMark;
      if (open > 0) return fail(`${open} ${open === 1 ? "person has" : "people have"} no mark yet. Enter a mark, or mark them absent or excused, before publishing.`);
    }
    if (status === "scheduled" && Object.values(s.results).some((r) => r.assessmentId === id && r.kind !== "pending")) return fail("Marks are already entered, so this cannot go back to scheduled.");
    a.status = status;
    a.updatedAt = now;
    save();
    return { ok: true };
  },

  async deleteAssessment(ctx, id) {
    const s = stateOf(ctx);
    const a = s.assessments.find((x) => x.id === id);
    if (!a || !classOf(ctx, a.classId)) return fail("That assessment no longer exists.");
    if (Object.values(s.results).some((r) => r.assessmentId === id && r.kind !== "pending")) return fail("Marks are entered for this assessment, so it cannot be deleted.");
    s.assessments = s.assessments.filter((x) => x.id !== id);
    for (const k of Object.keys(s.results)) if (s.results[k].assessmentId === id) delete s.results[k];
    save();
    return { ok: true };
  },

  async saveResults(ctx, assessmentId, entries) {
    const s = stateOf(ctx);
    const a = s.assessments.find((x) => x.id === assessmentId);
    if (!a || !classOf(ctx, a.classId)) return fail("That assessment no longer exists.");
    if (a.status === "scheduled") return fail("Open the assessment for marking before entering marks.");
    for (const e of entries) {
      const key = `${assessmentId}|${e.learnerId}`;
      if (e.kind === "pending" && e.comment === "") delete s.results[key];
      else s.results[key] = { assessmentId, learnerId: e.learnerId, kind: e.kind, mark: e.mark, comment: e.comment };
    }
    // Changing a published result reopens it, so nobody reads figures that were not re-checked.
    if (a.status === "published") a.status = "marking";
    save();
    return { ok: true };
  },

  async getGradebook(ctx, classId) {
    const cls = classOf(ctx, classId);
    return cls ? buildGradebook(ctx, stateOf(ctx), cls) : undefined;
  },

  async setCourseworkWeight(ctx, classId, weight) {
    if (!classOf(ctx, classId)) return fail("That class is not one of yours.");
    stateOf(ctx).cwWeight[classId] = weight;
    save();
    return { ok: true };
  },

  async setGradebookRemark(ctx, classId, learnerId, remark) {
    if (!classOf(ctx, classId)) return fail("That class is not one of yours.");
    if (!rosterOf(ctx, classId).some((l) => l.id === learnerId)) return fail("That person is not in this class.");
    const s = stateOf(ctx);
    if (remark) s.remarks[learnerId] = remark;
    else delete s.remarks[learnerId];
    save();
    return { ok: true };
  },
};

/** Test helper: forget everything. */
export const resetMockTeaching = () => {
  data.clear();
  save();
};
