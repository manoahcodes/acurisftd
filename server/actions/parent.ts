"use server";

import { revalidatePath } from "next/cache";
import { todayIn } from "@/lib/format";
import { checkCompose, checkGuardianContact, checkLinkRequest, checkMeeting, checkPrefs, checkReply, checkRsvp, isId } from "@/lib/parent/validate";
import type { Outcome } from "@/types/parent";
import { parent } from "../repositories";
import { getParentSession } from "../parent-context";

/**
 * Parent actions. Each one re-checks everything on the server: the browser is
 * only trusted for the values typed. Ids are resolved against the signed-in
 * guardian's own data by the repository, and any child named must be one of
 * the guardian's linked children, so changing an id reaches nothing.
 */

export type ActionResult = Outcome & { fields?: Record<string, string> };
const bad = (error: string): ActionResult => ({ ok: false, error });
const refresh = () => revalidatePath("/parent", "layout");
const done = (r: Outcome): ActionResult => {
  if (r.ok) refresh();
  return r;
};

// ---- School calendar

export async function setEventReply(eventId: unknown, response: unknown): Promise<ActionResult> {
  if (!isId(eventId)) return bad("That event is not available.");
  const value = checkRsvp(response);
  if (value === undefined) return bad("Choose going or not going.");
  const { ctx } = await getParentSession();
  return done(await parent.setRsvp(ctx, eventId, value));
}

export async function requestMeeting(raw: Record<string, unknown>): Promise<ActionResult> {
  const { ctx, timezone } = await getParentSession();
  const now = new Date();
  const checked = checkMeeting(raw, todayIn(timezone, now).iso);
  if (!checked.ok) return checked;
  return done(await parent.requestMeeting(ctx, checked.value, now.toISOString()));
}

export async function cancelMeeting(meetingId: unknown): Promise<ActionResult> {
  if (!isId(meetingId)) return bad("That request is not available.");
  const { ctx } = await getParentSession();
  return done(await parent.cancelMeeting(ctx, meetingId));
}

// ---- Messages

export async function replyToThread(threadId: unknown, raw: Record<string, unknown>): Promise<ActionResult> {
  if (!isId(threadId)) return bad("That conversation is not available.");
  const checked = checkReply(raw);
  if (!checked.ok) return checked;
  const { ctx } = await getParentSession();
  return done(await parent.reply(ctx, threadId, checked.value.body, new Date().toISOString()));
}

export async function composeMessage(raw: Record<string, unknown>): Promise<ActionResult> {
  const checked = checkCompose(raw);
  if (!checked.ok) return checked;
  const { ctx } = await getParentSession();
  return done(await parent.compose(ctx, checked.value, new Date().toISOString()));
}

export async function setThreadRead(threadId: unknown, read: unknown): Promise<ActionResult> {
  if (!isId(threadId) || typeof read !== "boolean") return bad("That conversation is not available.");
  const { ctx } = await getParentSession();
  return done(await parent.setRead(ctx, threadId, read));
}

export async function markAllThreadsRead(): Promise<ActionResult> {
  const { ctx } = await getParentSession();
  return done(await parent.markAllRead(ctx));
}

// ---- Profile

export async function saveGuardianContact(raw: Record<string, unknown>): Promise<ActionResult> {
  const checked = checkGuardianContact(raw);
  if (!checked.ok) return checked;
  const { ctx } = await getParentSession();
  return done(await parent.saveContact(ctx, checked.value, new Date().toISOString()));
}

export async function saveNotificationPrefs(raw: unknown): Promise<ActionResult> {
  const checked = checkPrefs(raw);
  if (!checked.ok) return checked;
  const { ctx } = await getParentSession();
  return done(await parent.savePrefs(ctx, checked.value));
}

export async function requestChildLink(raw: Record<string, unknown>): Promise<ActionResult> {
  const checked = checkLinkRequest(raw);
  if (!checked.ok) return checked;
  const { ctx } = await getParentSession();
  return done(await parent.requestLink(ctx, checked.value, new Date().toISOString()));
}

export async function withdrawChildLink(requestId: unknown): Promise<ActionResult> {
  if (!isId(requestId)) return bad("That request is not available.");
  const { ctx } = await getParentSession();
  return done(await parent.withdrawLink(ctx, requestId));
}
