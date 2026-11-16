/** Shared shapes for the Parent pages. Dates are "YYYY-MM-DD" in the school's zone, times "HH:MM", stamps ISO strings. */

import type { Outcome } from "./student";
export type { Outcome };

// ---- School calendar

export const EVENT_KINDS = ["Holiday", "Exam", "Meeting", "Event", "Deadline", "Trip"] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

export type SchoolEvent = {
  id: string;
  title: string;
  kind: EventKind;
  date: string;
  /** Last day, for events over several days. */
  endDate?: string;
  start?: string;
  end?: string;
  location: string;
  description: string;
  /** The school asks parents to reply. */
  rsvp: boolean;
};

export type RsvpResponse = "going" | "not_going";
export type EventRow = SchoolEvent & { response: RsvpResponse | null };

/** A member of staff a parent may write to or meet, because they teach or serve a linked child. */
export type StaffMember = { id: string; name: string; title: string };

export const MEETING_SLOTS = ["Morning", "Afternoon"] as const;
export type MeetingSlot = (typeof MEETING_SLOTS)[number];

export type MeetingState = "pending" | "confirmed" | "declined" | "cancelled";

export type MeetingRequest = {
  id: string;
  childId: string;
  staffId: string;
  staffName: string;
  date: string;
  slot: MeetingSlot;
  topic: string;
  state: MeetingState;
  createdAt: string;
  /** The school's answer, once there is one. */
  reply: string;
};

// ---- Messages

export type ThreadMessage = { id: string; from: "parent" | "staff"; author: string; body: string; sentAt: string };

export type MessageThread = {
  id: string;
  subject: string;
  /** The child it is about, or null for a general message. */
  childId: string | null;
  staffId: string;
  staffName: string;
  staffTitle: string;
  messages: ThreadMessage[];
  /** The parent has not read the latest staff message. */
  unread: boolean;
  lastAt: string;
};

// ---- Profile

export type GuardianContact = { phone: string; altPhone: string; email: string; address: string };

export type GuardianProfile = {
  /** Set by the school; the parent can read these but not change them. */
  name: string;
  relationship: string;
  contact: GuardianContact;
  updatedAt: string | null;
};

export const NOTIFY_CHANNELS = ["inApp", "email", "sms"] as const;
export type NotifyChannel = (typeof NOTIFY_CHANNELS)[number];
export const NOTIFY_TOPICS = ["attendance", "results", "fees", "events", "messages"] as const;
export type NotifyTopic = (typeof NOTIFY_TOPICS)[number];

export type NotificationPrefs = { channels: Record<NotifyChannel, boolean>; topics: Record<NotifyTopic, boolean> };

export const LINK_RELATIONSHIPS = ["Mother", "Father", "Guardian", "Other"] as const;
export type LinkRelationship = (typeof LINK_RELATIONSHIPS)[number];

export type LinkState = "pending" | "approved" | "declined" | "withdrawn";
export type LinkRequest = { id: string; studentNumber: string; childName: string; relationship: LinkRelationship; note: string; state: LinkState; createdAt: string };
