import type { AssignmentStatus, StudentAssignment, StudentSubmission } from "@/types/student";

/** Rules for assignments. Pure, so the server action, the repository and the page all agree. */

/**
 * Where an assignment stands on `today`. With no date yet (the page is still
 * loading in the browser), nothing counts as overdue.
 */
export function statusOf(a: Pick<StudentAssignment, "dueDate">, sub: Pick<StudentSubmission, "mark" | "late"> | undefined, today: string): AssignmentStatus {
  if (sub) return sub.mark !== null ? "marked" : sub.late ? "late" : "submitted";
  return today && a.dueDate < today ? "overdue" : "todo";
}

/** Whole days from `today` to the due date: negative once it has passed. */
export function daysUntil(dueDate: string, today: string): number {
  const a = Date.parse(`${today}T00:00:00Z`);
  const b = Date.parse(`${dueDate}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

export type SubmitCheck = { ok: true; late: boolean } | { ok: false; error: string };

/**
 * Whether the student may hand work in (or hand it in again) on `today`.
 * Marked work is locked. After the due date it is only accepted when the
 * teacher allows late work, and then it is marked late.
 */
export function canSubmit(a: Pick<StudentAssignment, "dueDate" | "acceptLate">, sub: Pick<StudentSubmission, "mark"> | undefined, today: string): SubmitCheck {
  if (sub && sub.mark !== null) return { ok: false, error: "This work has been marked, so it can no longer be changed." };
  const late = today > a.dueDate;
  if (late && !a.acceptLate) return { ok: false, error: "The due date has passed and late work is not accepted for this assignment." };
  return { ok: true, late };
}

/** A submission can be taken back only before it is marked. */
export const canWithdraw = (sub: Pick<StudentSubmission, "mark"> | undefined): boolean => Boolean(sub) && sub!.mark === null;

/** Share (0-100, one decimal) of the marks gained. */
export const percentOf = (mark: number, max: number): number => Math.round((mark / max) * 1000) / 10;

/** "Due today", "Due tomorrow", "Due in 5 days", "2 days overdue". */
export function dueLabel(dueDate: string, today: string): string {
  const d = daysUntil(dueDate, today);
  if (d === 0) return "Due today";
  if (d === 1) return "Due tomorrow";
  if (d > 1) return `Due in ${d} days`;
  return `${-d} ${d === -1 ? "day" : "days"} overdue`;
}
