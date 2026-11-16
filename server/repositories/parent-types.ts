import type { InstitutionType } from "@/config/institution";
import type { EventRow, GuardianContact, GuardianProfile, LinkRelationship, LinkRequest, MeetingRequest, MeetingSlot, MessageThread, NotificationPrefs, Outcome, RsvpResponse, StaffMember } from "@/types/parent";

/**
 * Who is asking. `childIds` are the children linked to this guardian. A real
 * implementation must enforce the link in its own queries, not in the UI.
 */
export type ParentContext = { tenantId: string; guardianId: string; institutionType: InstitutionType; childIds: string[] };

/**
 * Everything the Parent pages read and write that belongs to the guardian:
 * calendar replies, meeting requests, messages, profile and link requests.
 * A child's academic and fee records come from the Student module instead.
 * The mock keeps it in memory and a SQLite file; swap it in ./index.ts for your
 * own database. `now` is an ISO timestamp and `today` a date in the school's
 * zone, both from the caller, so the repository never reads the clock itself.
 */
export interface ParentRepository {
  // School calendar
  listEvents(ctx: ParentContext): Promise<EventRow[]>;
  /** Replies to an event that asks for one; null takes the reply back. */
  setRsvp(ctx: ParentContext, eventId: string, response: RsvpResponse | null): Promise<Outcome>;
  /** Staff who teach or serve the child. Empty for a child who is not linked. */
  listStaff(ctx: ParentContext, childId: string): Promise<StaffMember[]>;
  listMeetings(ctx: ParentContext): Promise<MeetingRequest[]>;
  requestMeeting(ctx: ParentContext, input: { childId: string; staffId: string; date: string; slot: MeetingSlot; topic: string }, now: string): Promise<Outcome>;
  cancelMeeting(ctx: ParentContext, meetingId: string): Promise<Outcome>;

  // Messages
  /** Newest activity first. */
  listThreads(ctx: ParentContext): Promise<MessageThread[]>;
  countUnread(ctx: ParentContext): Promise<number>;
  reply(ctx: ParentContext, threadId: string, body: string, now: string): Promise<Outcome>;
  compose(ctx: ParentContext, input: { childId: string | null; staffId: string; subject: string; body: string }, now: string): Promise<Outcome>;
  setRead(ctx: ParentContext, threadId: string, read: boolean): Promise<Outcome>;
  markAllRead(ctx: ParentContext): Promise<Outcome>;

  // Profile
  getProfile(ctx: ParentContext): Promise<GuardianProfile>;
  saveContact(ctx: ParentContext, contact: GuardianContact, now: string): Promise<Outcome>;
  getPrefs(ctx: ParentContext): Promise<NotificationPrefs>;
  savePrefs(ctx: ParentContext, prefs: NotificationPrefs): Promise<Outcome>;
  listLinkRequests(ctx: ParentContext): Promise<LinkRequest[]>;
  /** Asks the school to link another child. The school approves; nothing is linked here. */
  requestLink(ctx: ParentContext, input: { studentNumber: string; relationship: LinkRelationship; note: string }, now: string): Promise<Outcome>;
  withdrawLink(ctx: ParentContext, requestId: string): Promise<Outcome>;
}
