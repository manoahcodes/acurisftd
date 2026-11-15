"use server";

import { revalidatePath } from "next/cache";
import { todayIn } from "@/lib/format";
import { readSubmissionFile } from "@/lib/student/files";
import { checkAbsenceNote } from "@/lib/student/attendance";
import { checkContact, readPhoto } from "@/lib/student/profile";
import { checkSubmission } from "@/lib/student/validate";
import type { Outcome } from "@/types/student";
import { student } from "../repositories";
import { getStudentSession } from "../student-context";

/**
 * Student actions. Each one re-checks everything on the server: the browser is
 * only trusted for the values typed and the file chosen. Assignment ids are
 * always resolved against the signed-in student's own data by the repository,
 * so another student's work cannot be reached by changing an id.
 */

const ID = /^[A-Za-z0-9_-]{1,80}$/;
const bad = (error: string): ActionResult => ({ ok: false, error });
const refresh = () => revalidatePath("/student", "layout");

export type ActionResult = Outcome & { fields?: Record<string, string> };

/** Hand work in (or hand it in again). Takes a form so a file can come with it. */
export async function submitAssignment(form: FormData): Promise<ActionResult> {
  const { ctx, timezone } = await getStudentSession();
  const id = form.get("assignmentId");
  if (typeof id !== "string" || !ID.test(id)) return bad("That assignment is not available.");
  const rows = await student.listAssignments(ctx);
  const row = rows.find((r) => r.id === id);
  if (!row) return bad("That assignment is not one of yours.");

  const picked = form.get("file");
  const file = picked instanceof File && picked.size > 0 ? picked : undefined;
  const checked = checkSubmission({ assignmentId: id, text: form.get("text") }, row, Boolean(file));
  if (!checked.ok) return { ok: false, error: checked.error, fields: checked.fields };

  let upload: Awaited<ReturnType<typeof readSubmissionFile>> | undefined;
  if (file) {
    upload = await readSubmissionFile(file);
    if (!upload.ok) return { ok: false, error: upload.error, fields: { file: upload.error } };
  }
  const now = new Date();
  const r = await student.submitWork(ctx, id, { text: checked.value.text, file: upload?.ok ? upload.file : undefined }, now.toISOString(), todayIn(timezone, now).iso);
  if (r.ok) refresh();
  return r;
}

export async function withdrawAssignment(id: string): Promise<ActionResult> {
  const { ctx } = await getStudentSession();
  if (typeof id !== "string" || !ID.test(id)) return bad("That assignment is not available.");
  const r = await student.withdrawWork(ctx, id);
  if (r.ok) refresh();
  return r;
}

// ---- Attendance

/** Sends the reason for an absence. The date must be a day the student was marked absent, and recent enough. */
export async function sendAbsenceReason(raw: { date: unknown; reason: unknown }): Promise<ActionResult> {
  const { ctx, timezone } = await getStudentSession();
  const checked = checkAbsenceNote(raw ?? {});
  if (!checked.ok) return { ok: false, error: checked.error, fields: checked.fields };
  const now = new Date();
  const r = await student.saveAbsenceNote(ctx, checked.value.date, checked.value.reason, now.toISOString(), todayIn(timezone, now).iso);
  if (r.ok) refresh();
  return r;
}

export async function takeBackAbsenceReason(date: unknown): Promise<ActionResult> {
  const { ctx } = await getStudentSession();
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return bad("Choose a valid date.");
  const r = await student.removeAbsenceNote(ctx, date);
  if (r.ok) refresh();
  return r;
}

// ---- Learning resources

export async function saveResourceForLater(id: unknown, saved: unknown): Promise<ActionResult> {
  const { ctx } = await getStudentSession();
  if (typeof id !== "string" || !ID.test(id) || typeof saved !== "boolean") return bad("That resource is not available.");
  const r = await student.setResourceSaved(ctx, id, saved);
  if (r.ok) refresh();
  return r;
}

export async function noteResourceOpened(id: unknown): Promise<ActionResult> {
  const { ctx } = await getStudentSession();
  if (typeof id !== "string" || !ID.test(id)) return bad("That resource is not available.");
  const r = await student.markResourceOpened(ctx, id);
  if (r.ok) refresh();
  return r;
}

// ---- School notices

export async function setNoticeRead(id: unknown, read: unknown): Promise<ActionResult> {
  const { ctx } = await getStudentSession();
  if (typeof id !== "string" || !ID.test(id) || typeof read !== "boolean") return bad("That notice is not available.");
  const r = await student.setNoticeRead(ctx, id, read);
  if (r.ok) refresh();
  return r;
}

export async function markEveryNoticeRead(): Promise<ActionResult> {
  const { ctx } = await getStudentSession();
  const r = await student.markAllNoticesRead(ctx);
  if (r.ok) refresh();
  return r;
}

// ---- Profile

export type ContactResult = ActionResult;

/**
 * Saves the contact details. Only the fields a student may change are read;
 * anything else in the form (a name, a student number, a class) is ignored.
 */
export async function saveContactDetails(raw: Record<string, unknown>): Promise<ContactResult> {
  const { ctx } = await getStudentSession();
  const checked = checkContact(raw ?? {});
  if (!checked.ok) return { ok: false, error: "Check the highlighted fields.", fields: checked.errors as Record<string, string> };
  const r = await student.saveContact(ctx, checked.value, new Date().toISOString());
  if (r.ok) refresh();
  return r;
}

export async function uploadProfilePhoto(form: FormData): Promise<ActionResult> {
  const { ctx } = await getStudentSession();
  const read = await readPhoto(form.get("photo"));
  if (!read.ok) return { ok: false, error: read.error, fields: { photo: read.error } };
  const r = await student.savePhoto(ctx, read.photo, new Date().toISOString());
  if (r.ok) refresh();
  return r;
}

export async function removeProfilePhoto(): Promise<ActionResult> {
  const { ctx } = await getStudentSession();
  const r = await student.removePhoto(ctx, new Date().toISOString());
  if (r.ok) refresh();
  return r;
}
