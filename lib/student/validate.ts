import type { StudentAssignment } from "@/types/student";

/** Checks shared by the server actions (which must not trust the browser) and the forms. Pure, so they are easy to test. */

export const LIMITS = { text: 5000 };

export type Checked<T> = { ok: true; value: T } | { ok: false; error: string; fields?: Record<string, string> };

export type SubmissionInput = { assignmentId: string; text: string; hasFile: boolean };

/**
 * A hand-in: the typed answer and whether a file came with it. The file itself
 * is checked separately (lib/student/files.ts). Only what the assignment allows
 * is accepted, and something must be handed in.
 */
export function checkSubmission(raw: { assignmentId?: unknown; text?: unknown }, assignment: Pick<StudentAssignment, "id" | "allowText" | "allowFile">, hasFile: boolean): Checked<SubmissionInput> {
  const text = typeof raw.text === "string" ? raw.text.replace(/\r\n/g, "\n").trim() : "";
  if (text.length > LIMITS.text) return { ok: false, error: `Your answer can be at most ${LIMITS.text} characters.`, fields: { text: `At most ${LIMITS.text} characters.` } };
  if (text && !assignment.allowText) return { ok: false, error: "This assignment takes a file, not a typed answer.", fields: { text: "Not accepted for this assignment." } };
  if (hasFile && !assignment.allowFile) return { ok: false, error: "This assignment takes a typed answer, not a file.", fields: { file: "Not accepted for this assignment." } };
  if (!text && !hasFile) return { ok: false, error: assignment.allowFile && assignment.allowText ? "Type your answer or attach a file." : assignment.allowFile ? "Attach your file." : "Type your answer.", fields: { text: "Nothing to hand in yet." } };
  return { ok: true, value: { assignmentId: assignment.id, text, hasFile } };
}
