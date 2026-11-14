import { classesFor, learnersOf } from "@/lib/teacher/seed";
import { tally } from "@/lib/teacher/validate";
import type {
  Assignment,
  AssignmentDetail,
  AssignmentRow,
  AttendanceStatus,
  ClassSummary,
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
  const s: State = { registers: {}, assignments: [], submissions: {}, notes: {}, flags: {}, seq: 1 };

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
  return s;
}

function stateOf(ctx: TeacherContext): State {
  let s = data.get(scopeOf(ctx));
  if (!s) {
    s = seed(ctx);
    data.set(scopeOf(ctx), s);
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
};

/** Test helper: forget everything. */
export const resetMockTeaching = () => {
  data.clear();
  save();
};
