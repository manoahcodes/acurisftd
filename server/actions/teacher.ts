"use server";

import { revalidatePath } from "next/cache";
import { todayIn } from "@/lib/format";
import { checkAssignment, checkMarks, checkRegister, type Checked } from "@/lib/teacher/validate";
import type { AssignmentStatus, Outcome } from "@/types/teacher";
import { teaching } from "../repositories";
import { getTeacherSession } from "../teacher-context";

/**
 * Teacher and lecturer actions. Each one re-checks everything on the server:
 * the browser is only trusted for the values typed. Class, learner and
 * assignment ids are always resolved against the signed-in teacher's own data
 * by the repository, so another teacher's records cannot be reached by
 * changing an id.
 */

const ID = /^[A-Za-z0-9_-]{1,80}$/;
const bad = (error: string): Outcome => ({ ok: false, error });
const refresh = () => revalidatePath("/teacher", "layout");

export type ActionResult = Outcome & { fields?: Record<string, string> };

const fromChecked = (c: Extract<Checked<unknown>, { ok: false }>): ActionResult => ({ ok: false, error: c.error, fields: c.fields });

export async function saveClassNote(classId: string, note: string): Promise<ActionResult> {
  const { ctx } = await getTeacherSession();
  if (!ID.test(classId)) return bad("That class is not available.");
  const text = String(note ?? "").trim();
  if (text.length > 1000) return bad("The note can be at most 1000 characters.");
  const r = await teaching.setClassNote(ctx, classId, text);
  if (r.ok) refresh();
  return r;
}

export async function saveLearnerFlag(classId: string, learnerId: string, note: string): Promise<ActionResult> {
  const { ctx } = await getTeacherSession();
  if (!ID.test(classId) || !ID.test(learnerId)) return bad("That person is not available.");
  const text = String(note ?? "").trim();
  if (text.length > 300) return bad("The note can be at most 300 characters.");
  const r = await teaching.setLearnerFlag(ctx, classId, learnerId, text);
  if (r.ok) refresh();
  return r;
}

export async function saveRegister(raw: { classId: string; date: string; marks: Record<string, string>; note: string; submit: boolean }): Promise<ActionResult> {
  const { ctx, timezone } = await getTeacherSession();
  if (typeof raw?.classId !== "string" || !ID.test(raw.classId)) return bad("Choose a class.");
  const sheet = typeof raw.date === "string" ? await teaching.getRegister(ctx, raw.classId, raw.date) : undefined;
  if (!sheet) return bad("That class is not one of yours.");
  const now = new Date();
  const checked = checkRegister(raw, sheet.roster.map((l) => l.id), todayIn(timezone, now).iso);
  if (!checked.ok) return fromChecked(checked);
  const r = await teaching.saveRegister(ctx, checked.value, now.toISOString());
  if (r.ok) refresh();
  return r;
}

export async function saveAssignment(id: string | null, raw: Record<string, unknown>): Promise<ActionResult> {
  const { ctx } = await getTeacherSession();
  if (id !== null && !ID.test(id)) return bad("That assignment is not available.");
  const classes = await teaching.listClasses(ctx);
  const checked = checkAssignment(raw ?? {}, classes.map((c) => c.id));
  if (!checked.ok) return fromChecked(checked);
  const r = await teaching.saveAssignment(ctx, id ?? undefined, checked.value, new Date().toISOString());
  if (r.ok) refresh();
  return r;
}

const STATUSES: AssignmentStatus[] = ["draft", "published", "closed"];

export async function changeAssignmentStatus(id: string, status: AssignmentStatus): Promise<ActionResult> {
  const { ctx } = await getTeacherSession();
  if (!ID.test(id) || !STATUSES.includes(status)) return bad("That change is not available.");
  const r = await teaching.setAssignmentStatus(ctx, id, status, new Date().toISOString());
  if (r.ok) refresh();
  return r;
}

export async function removeAssignment(id: string): Promise<ActionResult> {
  const { ctx } = await getTeacherSession();
  if (!ID.test(id)) return bad("That assignment is not available.");
  const r = await teaching.deleteAssignment(ctx, id);
  if (r.ok) refresh();
  return r;
}

export async function saveMarks(assignmentId: string, entries: unknown): Promise<ActionResult> {
  const { ctx } = await getTeacherSession();
  if (!ID.test(assignmentId)) return bad("That assignment is not available.");
  const detail = await teaching.getAssignment(ctx, assignmentId);
  if (!detail) return bad("That assignment no longer exists.");
  const checked = checkMarks(entries, detail.maxMarks, detail.entries.map((e) => e.learner.id));
  if (!checked.ok) return fromChecked(checked);
  const r = await teaching.saveMarks(ctx, assignmentId, checked.value);
  if (r.ok) refresh();
  return r;
}
