import { RESOURCE_KINDS, type ResourceKind, ASSESSMENT_KINDS, ASSIGNMENT_KINDS, ATTENDANCE_STATUSES, type AssessmentKind, type ResultKind, type AssignmentKind, type AttendanceStatus, type AttendanceTally, type ResourceLink } from "@/types/teacher";

/** Checks shared by the server actions (which must not trust the browser) and the forms. Pure, so they are easy to test. */

export const isIsoDate = (v: unknown): v is string => {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
};

const isStatus = (v: unknown): v is AttendanceStatus => (ATTENDANCE_STATUSES as readonly unknown[]).includes(v);

export const LIMITS = { title: 120, instructions: 2000, notes: 2000, note: 500, label: 80, url: 500, feedback: 500, links: 8, maxMarks: 1000 };

export type Checked<T> = { ok: true; value: T } | { ok: false; error: string; fields?: Record<string, string> };

export type RegisterInput = { classId: string; date: string; marks: Record<string, AttendanceStatus>; note: string; submit: boolean };

/**
 * A register for one class on one day. `rosterIds` are the learners really in
 * the class; marks for anyone else are refused. Submitting needs everyone marked.
 */
export function checkRegister(raw: { classId?: unknown; date?: unknown; marks?: unknown; note?: unknown; submit?: unknown }, rosterIds: string[], today: string): Checked<RegisterInput> {
  if (typeof raw.classId !== "string" || !raw.classId) return { ok: false, error: "Choose a class." };
  if (!isIsoDate(raw.date)) return { ok: false, error: "Choose a valid date." };
  if (raw.date > today) return { ok: false, error: "A register cannot be taken for a future date." };
  const wd = new Date(`${raw.date}T00:00:00Z`).getUTCDay();
  if (wd === 0 || wd === 6) return { ok: false, error: "Registers are taken on school days (Monday to Friday)." };
  if (typeof raw.marks !== "object" || raw.marks === null || Array.isArray(raw.marks)) return { ok: false, error: "Marks are missing." };
  const known = new Set(rosterIds);
  const marks: Record<string, AttendanceStatus> = {};
  for (const [id, status] of Object.entries(raw.marks)) {
    if (!known.has(id)) return { ok: false, error: "A mark is for someone who is not in this class." };
    if (!isStatus(status)) return { ok: false, error: "Each mark must be present, absent, late or excused." };
    marks[id] = status;
  }
  const note = typeof raw.note === "string" ? raw.note.trim() : "";
  if (note.length > LIMITS.note) return { ok: false, error: `The note can be at most ${LIMITS.note} characters.` };
  const submit = raw.submit === true;
  if (submit) {
    const missing = rosterIds.filter((id) => !marks[id]).length;
    if (missing > 0) return { ok: false, error: `${missing} ${missing === 1 ? "person is" : "people are"} not marked yet. Mark everyone before submitting, or save as a draft.` };
  }
  return { ok: true, value: { classId: raw.classId, date: raw.date, marks, note, submit } };
}

export function tally(statuses: Iterable<AttendanceStatus>): AttendanceTally {
  const t = { present: 0, absent: 0, late: 0, excused: 0 };
  for (const s of statuses) t[s]++;
  const total = t.present + t.absent + t.late + t.excused;
  // Late still counts as attending; excused is left out of the rate.
  const counted = total - t.excused;
  return { ...t, rate: counted > 0 ? Math.round(((t.present + t.late) / counted) * 100) : null };
}

export type AssignmentInput = {
  classId: string;
  title: string;
  instructions: string;
  kind: AssignmentKind;
  dueDate: string;
  maxMarks: number;
  links: ResourceLink[];
  notes: string;
};

export function checkLinks(raw: unknown): Checked<ResourceLink[]> {
  if (raw === undefined || raw === null) return { ok: true, value: [] };
  if (!Array.isArray(raw)) return { ok: false, error: "Links are not valid." };
  if (raw.length > LIMITS.links) return { ok: false, error: `Add at most ${LIMITS.links} links.` };
  const out: ResourceLink[] = [];
  for (const item of raw) {
    const label = typeof item?.label === "string" ? item.label.trim() : "";
    const url = typeof item?.url === "string" ? item.url.trim() : "";
    if (!label && !url) continue;
    if (!label) return { ok: false, error: "Give each link a name." };
    if (label.length > LIMITS.label) return { ok: false, error: `A link name can be at most ${LIMITS.label} characters.` };
    if (url.length > LIMITS.url) return { ok: false, error: "A link is too long." };
    let parsed: URL | null = null;
    try {
      parsed = new URL(url);
    } catch {
      parsed = null;
    }
    // Only web links: a javascript: or data: link must never reach an href.
    if (!parsed || (parsed.protocol !== "https:" && parsed.protocol !== "http:")) return { ok: false, error: `"${label}" needs a web address starting with https://` };
    out.push({ label, url: parsed.toString() });
  }
  return { ok: true, value: out };
}

export function checkAssignment(raw: Record<string, unknown>, ownClassIds: string[]): Checked<AssignmentInput> {
  const fields: Record<string, string> = {};
  const text = (k: string) => (typeof raw[k] === "string" ? (raw[k] as string).trim() : "");
  const classId = text("classId");
  if (!ownClassIds.includes(classId)) fields.classId = "Choose one of your classes.";
  const title = text("title");
  if (!title) fields.title = "Enter a title.";
  else if (title.length > LIMITS.title) fields.title = `Keep the title under ${LIMITS.title} characters.`;
  const instructions = text("instructions");
  if (instructions.length > LIMITS.instructions) fields.instructions = `Keep the instructions under ${LIMITS.instructions} characters.`;
  const notes = text("notes");
  if (notes.length > LIMITS.notes) fields.notes = `Keep the notes under ${LIMITS.notes} characters.`;
  const kind = text("kind") as AssignmentKind;
  if (!ASSIGNMENT_KINDS.includes(kind)) fields.kind = "Choose a type.";
  const dueDate = text("dueDate");
  if (!isIsoDate(dueDate)) fields.dueDate = "Choose a due date.";
  const maxMarks = typeof raw.maxMarks === "number" ? raw.maxMarks : Number(text("maxMarks"));
  if (!Number.isFinite(maxMarks) || maxMarks <= 0 || maxMarks > LIMITS.maxMarks) fields.maxMarks = `Marks must be between 1 and ${LIMITS.maxMarks}.`;
  else if (Math.round(maxMarks * 100) !== maxMarks * 100) fields.maxMarks = "Use at most two decimal places.";
  const links = checkLinks(raw.links);
  if (!links.ok) fields.links = links.error;
  if (Object.keys(fields).length > 0) return { ok: false, error: "Fix the highlighted fields.", fields };
  return { ok: true, value: { classId, title, instructions, kind, dueDate, maxMarks, links: (links as { ok: true; value: ResourceLink[] }).value, notes } };
}

export type MarkEntry = { learnerId: string; mark: number | null; feedback: string; status?: "submitted" | "late" | "missing" | "pending" };

/** Marks entered for one assignment: each between 0 and the maximum, for learners in the class. */
export function checkMarks(raw: unknown, maxMarks: number, rosterIds: string[]): Checked<MarkEntry[]> {
  if (!Array.isArray(raw)) return { ok: false, error: "Marks are missing." };
  const known = new Set(rosterIds);
  const seen = new Set<string>();
  const out: MarkEntry[] = [];
  for (const item of raw) {
    const learnerId = typeof item?.learnerId === "string" ? item.learnerId : "";
    if (!known.has(learnerId)) return { ok: false, error: "A mark is for someone who is not in this class." };
    if (seen.has(learnerId)) return { ok: false, error: "Someone appears twice." };
    seen.add(learnerId);
    const feedback = typeof item.feedback === "string" ? item.feedback.trim() : "";
    if (feedback.length > LIMITS.feedback) return { ok: false, error: `Feedback can be at most ${LIMITS.feedback} characters.` };
    const status = item.status;
    if (status !== undefined && !["submitted", "late", "missing", "pending"].includes(status)) return { ok: false, error: "Not a valid status." };
    let mark: number | null = null;
    if (item.mark !== null && item.mark !== undefined && item.mark !== "") {
      mark = Number(item.mark);
      if (!Number.isFinite(mark) || mark < 0 || mark > maxMarks) return { ok: false, error: `Marks must be between 0 and ${maxMarks}.` };
      if (Math.round(mark * 100) !== mark * 100) return { ok: false, error: "Use at most two decimal places." };
      if (status === "missing" || status === "pending") return { ok: false, error: "Work that was not handed in cannot have a mark." };
    }
    out.push({ learnerId, mark, feedback, status });
  }
  return { ok: true, value: out };
}

// ---- Assessments and gradebook

export type AssessmentInput = { classId: string; title: string; kind: AssessmentKind; date: string; maxMarks: number; weight: number; notes: string };

export function checkAssessment(raw: Record<string, unknown>, ownClassIds: string[]): Checked<AssessmentInput> {
  const fields: Record<string, string> = {};
  const text = (k: string) => (typeof raw[k] === "string" ? (raw[k] as string).trim() : "");
  const classId = text("classId");
  if (!ownClassIds.includes(classId)) fields.classId = "Choose one of your classes.";
  const title = text("title");
  if (!title) fields.title = "Enter a title.";
  else if (title.length > LIMITS.title) fields.title = `Keep the title under ${LIMITS.title} characters.`;
  const kind = text("kind") as AssessmentKind;
  if (!ASSESSMENT_KINDS.includes(kind)) fields.kind = "Choose a type.";
  const date = text("date");
  if (!isIsoDate(date)) fields.date = "Choose the date it is sat.";
  const num = (k: string) => (typeof raw[k] === "number" ? (raw[k] as number) : Number(text(k)));
  const maxMarks = num("maxMarks");
  if (!Number.isFinite(maxMarks) || maxMarks <= 0 || maxMarks > LIMITS.maxMarks) fields.maxMarks = `Marks must be between 1 and ${LIMITS.maxMarks}.`;
  else if (Math.round(maxMarks * 100) !== maxMarks * 100) fields.maxMarks = "Use at most two decimal places.";
  const weight = num("weight");
  if (!Number.isFinite(weight) || weight < 1 || weight > 100) fields.weight = "Weight must be between 1 and 100.";
  else if (!Number.isInteger(weight)) fields.weight = "Use a whole number.";
  const notes = text("notes");
  if (notes.length > LIMITS.notes) fields.notes = `Keep the notes under ${LIMITS.notes} characters.`;
  if (Object.keys(fields).length > 0) return { ok: false, error: "Fix the highlighted fields.", fields };
  return { ok: true, value: { classId, title, kind, date, maxMarks, weight, notes } };
}

export type ResultEntry = { learnerId: string; kind: ResultKind; mark: number | null; comment: string };
const RESULT_KINDS: ResultKind[] = ["marked", "absent", "excused", "pending"];

/**
 * Results for one assessment. A mark must be between 0 and the maximum and
 * only goes with "marked"; absent, excused and pending carry no mark. A mark
 * typed with no kind becomes "marked".
 */
export function checkResults(raw: unknown, maxMarks: number, rosterIds: string[]): Checked<ResultEntry[]> {
  if (!Array.isArray(raw)) return { ok: false, error: "Results are missing." };
  const known = new Set(rosterIds);
  const seen = new Set<string>();
  const out: ResultEntry[] = [];
  for (const item of raw) {
    const learnerId = typeof item?.learnerId === "string" ? item.learnerId : "";
    if (!known.has(learnerId)) return { ok: false, error: "A result is for someone who is not in this class." };
    if (seen.has(learnerId)) return { ok: false, error: "Someone appears twice." };
    seen.add(learnerId);
    const comment = typeof item.comment === "string" ? item.comment.trim() : "";
    if (comment.length > LIMITS.feedback) return { ok: false, error: `Comments can be at most ${LIMITS.feedback} characters.` };
    const hasMark = item.mark !== null && item.mark !== undefined && item.mark !== "";
    let kind = (item.kind ?? (hasMark ? "marked" : "pending")) as ResultKind;
    if (!RESULT_KINDS.includes(kind)) return { ok: false, error: "Not a valid result." };
    let mark: number | null = null;
    if (hasMark) {
      mark = Number(item.mark);
      if (!Number.isFinite(mark) || mark < 0 || mark > maxMarks) return { ok: false, error: `Marks must be between 0 and ${maxMarks}.` };
      if (Math.round(mark * 100) !== mark * 100) return { ok: false, error: "Use at most two decimal places." };
      if (kind === "absent" || kind === "excused") return { ok: false, error: "Someone who was absent cannot have a mark." };
      kind = "marked";
    } else if (kind === "marked") kind = "pending";
    out.push({ learnerId, kind, mark, comment });
  }
  return { ok: true, value: out };
}

/** Share of the final grade that comes from assignments: 0 to 50 percent. */
export function checkCourseworkWeight(raw: unknown): Checked<number> {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isInteger(n) || n < 0 || n > 50) return { ok: false, error: "Coursework can count for 0 to 50 percent, in whole numbers." };
  return { ok: true, value: n };
}

export function checkRemark(raw: unknown): Checked<string> {
  const t = typeof raw === "string" ? raw.trim() : "";
  if (t.length > 300) return { ok: false, error: "A remark can be at most 300 characters." };
  return { ok: true, value: t };
}

// ---- Lesson planner and learning resources

export type LessonInput = { classId: string; title: string; date: string; startTime: string; objectives: string; activities: string; homework: string; links: ResourceLink[]; notes: string };

export function checkLesson(raw: Record<string, unknown>, ownClassIds: string[]): Checked<LessonInput> {
  const fields: Record<string, string> = {};
  const text = (k: string) => (typeof raw[k] === "string" ? (raw[k] as string).trim() : "");
  const classId = text("classId");
  if (!ownClassIds.includes(classId)) fields.classId = "Choose one of your classes.";
  const title = text("title");
  if (!title) fields.title = "Enter the topic.";
  else if (title.length > LIMITS.title) fields.title = `Keep the topic under ${LIMITS.title} characters.`;
  const date = text("date");
  if (!isIsoDate(date)) fields.date = "Choose a date.";
  const startTime = text("startTime");
  if (startTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime)) fields.startTime = "Use a time like 08:00.";
  for (const k of ["objectives", "activities", "homework", "notes"] as const) {
    if (text(k).length > LIMITS.instructions) fields[k] = `Keep this under ${LIMITS.instructions} characters.`;
  }
  const links = checkLinks(raw.links);
  if (!links.ok) fields.links = links.error;
  if (Object.keys(fields).length > 0) return { ok: false, error: "Fix the highlighted fields.", fields };
  return { ok: true, value: { classId, title, date, startTime, objectives: text("objectives"), activities: text("activities"), homework: text("homework"), links: (links as { ok: true; value: ResourceLink[] }).value, notes: text("notes") } };
}

export const checkReflection = (raw: unknown): Checked<string> => {
  const t = typeof raw === "string" ? raw.trim() : "";
  return t.length > 1000 ? { ok: false, error: "The reflection can be at most 1000 characters." } : { ok: true, value: t };
};

export type ResourceInput = { classId: string; title: string; kind: ResourceKind; url: string; body: string; topic: string; shared: boolean };

/** A resource is a web link, a note, or both. `classId` may be empty (all classes) or one of the teacher's own. */
export function checkResource(raw: Record<string, unknown>, ownClassIds: string[]): Checked<ResourceInput> {
  const fields: Record<string, string> = {};
  const text = (k: string) => (typeof raw[k] === "string" ? (raw[k] as string).trim() : "");
  const classId = text("classId");
  if (classId && !ownClassIds.includes(classId)) fields.classId = "Choose one of your classes, or all of them.";
  const title = text("title");
  if (!title) fields.title = "Enter a title.";
  else if (title.length > LIMITS.title) fields.title = `Keep the title under ${LIMITS.title} characters.`;
  const kind = text("kind") as ResourceKind;
  if (!RESOURCE_KINDS.includes(kind)) fields.kind = "Choose a type.";
  const topic = text("topic");
  if (topic.length > 60) fields.topic = "Keep the topic under 60 characters.";
  const body = text("body");
  if (body.length > LIMITS.instructions) fields.body = `Keep the note under ${LIMITS.instructions} characters.`;
  let url = text("url");
  if (url) {
    const checked = checkLinks([{ label: title || "Link", url }]);
    if (!checked.ok) fields.url = "Use a web address starting with https://";
    else url = checked.value[0].url;
  } else if (!body) fields.url = "Add a web link or write a note.";
  else if (kind === "Link" || kind === "Video") fields.url = `A ${kind.toLowerCase()} needs a web address.`;
  if (Object.keys(fields).length > 0) return { ok: false, error: "Fix the highlighted fields.", fields };
  return { ok: true, value: { classId, title, kind, url, body, topic, shared: raw.shared === true } };
}
