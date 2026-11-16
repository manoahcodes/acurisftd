import { eventsFor, GUARDIAN_SEED, LINKS_SEED, PREFS_SEED, staffFor, threadsFor } from "@/lib/parent/seed";
import type { GuardianProfile, LinkRequest, MeetingRequest, MessageThread, NotificationPrefs, RsvpResponse } from "@/types/parent";
import { loadSnapshot, saveSnapshot } from "../persistence/store";
import type { ParentContext, ParentRepository } from "./parent-types";

/**
 * Parent data per school and per guardian, kept in memory and saved to the
 * SQLite file like the Student pages. The calendar and staff are set by the
 * school, so they are sample data; what the parent changes is what gets saved.
 */
type State = {
  rsvps: Record<string, RsvpResponse>;
  meetings: MeetingRequest[];
  threads: MessageThread[];
  profile: GuardianProfile;
  prefs: NotificationPrefs;
  links: LinkRequest[];
};

const g = globalThis as unknown as { __acurisParent?: Map<string, State> };
const KEY = "parent";
const data = (g.__acurisParent ??= new Map<string, State>(loadSnapshot<Array<[string, State]>>(KEY) ?? []));
const save = () => saveSnapshot(KEY, [...data]);

const scopeOf = (c: ParentContext) => `${c.tenantId}:${c.guardianId}:${c.institutionType}`;
const bad = (error: string) => ({ ok: false as const, error });
const clone = <T,>(v: T): T => structuredClone(v);

function stateOf(ctx: ParentContext): State {
  let s = data.get(scopeOf(ctx));
  if (!s) {
    s = { rsvps: {}, meetings: [], threads: threadsFor(ctx.institutionType), profile: clone(GUARDIAN_SEED), prefs: clone(PREFS_SEED), links: clone(LINKS_SEED) };
    data.set(scopeOf(ctx), s);
    save();
  }
  return s;
}

const linked = (ctx: ParentContext, childId: string | null) => childId === null || ctx.childIds.includes(childId);
const staffOf = (ctx: ParentContext, id: string) => staffFor(ctx.institutionType).find((m) => m.id === id);
let counter = 0;
const newId = (prefix: string, now: string) => `${prefix}-${Date.parse(now) || 0}-${++counter}`;

export const mockParentRepository: ParentRepository = {
  async listEvents(ctx) {
    const s = stateOf(ctx);
    return eventsFor(ctx.institutionType).map((e) => ({ ...e, response: s.rsvps[e.id] ?? null })).sort((a, b) => a.date.localeCompare(b.date) || (a.start ?? "").localeCompare(b.start ?? ""));
  },

  async setRsvp(ctx, eventId, response) {
    const event = eventsFor(ctx.institutionType).find((e) => e.id === eventId);
    if (!event) return bad("That event is not available.");
    if (!event.rsvp) return bad("This event does not ask for a reply.");
    const s = stateOf(ctx);
    if (response === null) delete s.rsvps[eventId];
    else s.rsvps[eventId] = response;
    save();
    return { ok: true, id: eventId };
  },

  async listStaff(ctx, childId) {
    return linked(ctx, childId) && ctx.childIds.includes(childId) ? staffFor(ctx.institutionType) : [];
  },

  async listMeetings(ctx) {
    return clone(stateOf(ctx).meetings).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async requestMeeting(ctx, input, now) {
    if (!ctx.childIds.includes(input.childId)) return bad("That child is not linked to your account.");
    const staff = staffOf(ctx, input.staffId);
    if (!staff) return bad("That member of staff is not available.");
    const s = stateOf(ctx);
    if (s.meetings.some((m) => m.state === "pending" && m.staffId === input.staffId && m.childId === input.childId && m.date === input.date)) return bad("You have already asked to meet them on that day.");
    const id = newId("mt", now);
    s.meetings.push({ id, childId: input.childId, staffId: staff.id, staffName: staff.name, date: input.date, slot: input.slot, topic: input.topic, state: "pending", createdAt: now, reply: "" });
    save();
    return { ok: true, id };
  },

  async cancelMeeting(ctx, meetingId) {
    const m = stateOf(ctx).meetings.find((x) => x.id === meetingId);
    if (!m) return bad("That meeting request is not one of yours.");
    if (m.state !== "pending" && m.state !== "confirmed") return bad("That request is already closed.");
    m.state = "cancelled";
    save();
    return { ok: true, id: meetingId };
  },

  async listThreads(ctx) {
    return clone(stateOf(ctx).threads).sort((a, b) => b.lastAt.localeCompare(a.lastAt));
  },

  async countUnread(ctx) {
    return stateOf(ctx).threads.filter((t) => t.unread).length;
  },

  async reply(ctx, threadId, body, now) {
    const t = stateOf(ctx).threads.find((x) => x.id === threadId);
    if (!t) return bad("That conversation is not one of yours.");
    t.messages.push({ id: newId("m", now), from: "parent", author: "You", body, sentAt: now });
    t.lastAt = now;
    t.unread = false;
    save();
    return { ok: true, id: threadId };
  },

  async compose(ctx, input, now) {
    if (!linked(ctx, input.childId)) return bad("That child is not linked to your account.");
    const staff = staffOf(ctx, input.staffId);
    if (!staff) return bad("That member of staff is not available.");
    const s = stateOf(ctx);
    const id = newId("th", now);
    s.threads.push({ id, subject: input.subject, childId: input.childId, staffId: staff.id, staffName: staff.name, staffTitle: staff.title, messages: [{ id: newId("m", now), from: "parent", author: "You", body: input.body, sentAt: now }], unread: false, lastAt: now });
    save();
    return { ok: true, id };
  },

  async setRead(ctx, threadId, read) {
    const t = stateOf(ctx).threads.find((x) => x.id === threadId);
    if (!t) return bad("That conversation is not one of yours.");
    t.unread = !read;
    save();
    return { ok: true, id: threadId };
  },

  async markAllRead(ctx) {
    for (const t of stateOf(ctx).threads) t.unread = false;
    save();
    return { ok: true };
  },

  async getProfile(ctx) {
    return clone(stateOf(ctx).profile);
  },

  async saveContact(ctx, contact, now) {
    const p = stateOf(ctx).profile;
    p.contact = { ...contact };
    p.updatedAt = now;
    save();
    return { ok: true };
  },

  async getPrefs(ctx) {
    return clone(stateOf(ctx).prefs);
  },

  async savePrefs(ctx, prefs) {
    stateOf(ctx).prefs = clone(prefs);
    save();
    return { ok: true };
  },

  async listLinkRequests(ctx) {
    return clone(stateOf(ctx).links).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async requestLink(ctx, input, now) {
    const s = stateOf(ctx);
    if (s.links.some((l) => l.state === "pending" && l.studentNumber === input.studentNumber)) return bad("You have already asked to link that number. The school is still reviewing it.");
    const id = newId("lk", now);
    // The school looks the number up when it reviews; the name is not shown to the requester.
    s.links.push({ id, studentNumber: input.studentNumber, childName: "", relationship: input.relationship, note: input.note, state: "pending", createdAt: now });
    save();
    return { ok: true, id };
  },

  async withdrawLink(ctx, requestId) {
    const l = stateOf(ctx).links.find((x) => x.id === requestId);
    if (!l) return bad("That request is not one of yours.");
    if (l.state !== "pending") return bad("The school has already answered that request.");
    l.state = "withdrawn";
    save();
    return { ok: true, id: requestId };
  },
};

/** Test helper: forget everything. */
export const resetMockParent = () => {
  data.clear();
  save();
};
