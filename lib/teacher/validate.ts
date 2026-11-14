import { ASSIGNMENT_KINDS, ATTENDANCE_STATUSES, type AssignmentKind, type AttendanceStatus, type AttendanceTally, type ResourceLink } from "@/types/teacher";

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
