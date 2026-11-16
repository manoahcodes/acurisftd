import { EVENT_KINDS, LINK_RELATIONSHIPS, MEETING_SLOTS, NOTIFY_CHANNELS, NOTIFY_TOPICS, type GuardianContact, type LinkRelationship, type MeetingSlot, type NotificationPrefs, type RsvpResponse } from "@/types/parent";

/** Checks shared by the server actions (which must not trust the browser) and the forms. Pure, so they are easy to test. */

export type Checked<T> = { ok: true; value: T } | { ok: false; error: string; fields?: Record<string, string> };
const fail = (field: string, error: string) => ({ ok: false as const, error, fields: { [field]: error } });
const clean = (v: unknown) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "");
const multiline = (v: unknown) => (typeof v === "string" ? v.replace(/\r\n/g, "\n").trim() : "");
const ID = /^[A-Za-z0-9_-]{1,80}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
export const isId = (v: unknown): v is string => typeof v === "string" && ID.test(v);

export const LIMITS = { subject: { min: 3, max: 100 }, body: { min: 2, max: 2000 }, topic: { min: 5, max: 200 }, note: 300, email: 120, address: 200 };

export function checkReply(raw: { body?: unknown }): Checked<{ body: string }> {
  const body = multiline(raw.body);
  if (body.length < LIMITS.body.min) return fail("body", "Write a reply first.");
  if (body.length > LIMITS.body.max) return fail("body", `At most ${LIMITS.body.max} characters.`);
  return { ok: true, value: { body } };
}

export function checkCompose(raw: { childId?: unknown; staffId?: unknown; subject?: unknown; body?: unknown }): Checked<{ childId: string | null; staffId: string; subject: string; body: string }> {
  if (!isId(raw.staffId)) return fail("staffId", "Choose who to write to.");
  const childId = raw.childId === "" || raw.childId === undefined || raw.childId === null ? null : isId(raw.childId) ? raw.childId : undefined;
  if (childId === undefined) return fail("childId", "Choose which child this is about.");
  const subject = clean(raw.subject);
  if (subject.length < LIMITS.subject.min) return fail("subject", "Give the message a subject.");
  if (subject.length > LIMITS.subject.max) return fail("subject", `At most ${LIMITS.subject.max} characters.`);
  const reply = checkReply({ body: raw.body });
  if (!reply.ok) return reply;
  return { ok: true, value: { childId, staffId: raw.staffId, subject, body: reply.value.body } };
}

const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const isWeekday = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return d !== 0 && d !== 6;
};
export const MEETING_WINDOW_DAYS = 60;

/** A meeting can be asked for on a school day from tomorrow to two months ahead. */
export function checkMeeting(raw: { childId?: unknown; staffId?: unknown; date?: unknown; slot?: unknown; topic?: unknown }, today: string): Checked<{ childId: string; staffId: string; date: string; slot: MeetingSlot; topic: string }> {
  if (!isId(raw.childId)) return fail("childId", "Choose which child this is about.");
  if (!isId(raw.staffId)) return fail("staffId", "Choose who you would like to meet.");
  const date = typeof raw.date === "string" ? raw.date : "";
  if (!DATE.test(date) || Number.isNaN(Date.parse(date))) return fail("date", "Choose a date.");
  if (date <= today) return fail("date", "Choose a date from tomorrow onwards.");
  if (date > addDays(today, MEETING_WINDOW_DAYS)) return fail("date", `Choose a date within the next ${MEETING_WINDOW_DAYS} days.`);
  if (!isWeekday(date)) return fail("date", "Meetings are held on school days, Monday to Friday.");
  const slot = MEETING_SLOTS.find((s) => s === raw.slot);
  if (!slot) return fail("slot", "Choose morning or afternoon.");
  const topic = clean(raw.topic);
  if (topic.length < LIMITS.topic.min) return fail("topic", "Say briefly what you would like to talk about.");
  if (topic.length > LIMITS.topic.max) return fail("topic", `At most ${LIMITS.topic.max} characters.`);
  return { ok: true, value: { childId: raw.childId, staffId: raw.staffId, date, slot, topic } };
}

export const checkRsvp = (v: unknown): RsvpResponse | null | undefined => (v === "going" || v === "not_going" ? v : v === null ? null : undefined);

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE = /^\+?[0-9 ()-]{7,20}$/;

/** A parent must leave at least a phone number or an email so the school can reach them. */
export function checkGuardianContact(raw: Record<string, unknown>): Checked<GuardianContact> {
  const errors: Record<string, string> = {};
  const phone = clean(raw.phone);
  const altPhone = clean(raw.altPhone);
  const email = clean(raw.email).toLowerCase();
  const address = clean(raw.address);
  if (phone && !PHONE.test(phone)) errors.phone = "Enter a valid phone number, such as +260 977 123 456.";
  if (altPhone && !PHONE.test(altPhone)) errors.altPhone = "Enter a valid phone number.";
  if (email && (email.length > LIMITS.email || !EMAIL.test(email))) errors.email = "Enter a valid email address.";
  if (address.length > LIMITS.address) errors.address = `At most ${LIMITS.address} characters.`;
  if (!phone && !email && !errors.phone && !errors.email) errors.phone = "Give a phone number or an email so the school can reach you.";
  const first = Object.values(errors)[0];
  if (first) return { ok: false, error: first, fields: errors };
  return { ok: true, value: { phone, altPhone, email, address } };
}

export function checkPrefs(raw: unknown): Checked<NotificationPrefs> {
  const r = (raw && typeof raw === "object" ? raw : {}) as { channels?: Record<string, unknown>; topics?: Record<string, unknown> };
  const pick = <K extends string>(keys: readonly K[], src: Record<string, unknown> | undefined) => Object.fromEntries(keys.map((k) => [k, src?.[k] === true])) as Record<K, boolean>;
  const channels = pick(NOTIFY_CHANNELS, r.channels);
  const topics = pick(NOTIFY_TOPICS, r.topics);
  if (!Object.values(channels).some(Boolean)) return { ok: false, error: "Keep at least one way of being notified switched on." };
  return { ok: true, value: { channels, topics } };
}

const STUDENT_NUMBER = /^[A-Z]{2,4}-\d{3,6}$/;

export function checkLinkRequest(raw: { studentNumber?: unknown; relationship?: unknown; note?: unknown }): Checked<{ studentNumber: string; relationship: LinkRelationship; note: string }> {
  const studentNumber = clean(raw.studentNumber).toUpperCase();
  if (!STUDENT_NUMBER.test(studentNumber)) return fail("studentNumber", "Enter the number on the child's school card, such as STU-1048.");
  const relationship = LINK_RELATIONSHIPS.find((r) => r === raw.relationship);
  if (!relationship) return fail("relationship", "Choose how you are related to the child.");
  const note = multiline(raw.note);
  if (note.length > LIMITS.note) return fail("note", `At most ${LIMITS.note} characters.`);
  return { ok: true, value: { studentNumber, relationship, note } };
}

export { EVENT_KINDS };
