import type { InstitutionType } from "@/config/institution";
import { coursesFor } from "@/lib/student/seed";
import { studentTermsFor } from "@/lib/student/terms";
import type { GuardianProfile, LinkRequest, MessageThread, NotificationPrefs, SchoolEvent, StaffMember } from "@/types/parent";

/** Sample calendar, staff, messages and profile for the mock. Real data replaces this. */

export function staffFor(type: InstitutionType): StaffMember[] {
  const tertiary = studentTermsFor(type).tertiary;
  const teachers = coursesFor(type).map((c) => ({ id: `t-${c.code.toLowerCase()}`, name: c.teacher, title: `${c.name} ${tertiary ? "lecturer" : "teacher"}` }));
  return [...teachers, { id: "bursar", name: "Bursar's office", title: "Fees and payments" }, { id: "office", name: tertiary ? "Registry" : "Head teacher's office", title: tertiary ? "Records and registration" : "School administration" }];
}

export function eventsFor(type: InstitutionType): SchoolEvent[] {
  const t = studentTermsFor(type);
  return [
    { id: "ev-exams", title: `End-of-${t.period.toLowerCase()} examinations`, kind: "Exam", date: "2026-11-30", endDate: "2026-12-11", location: "Examination halls", description: "Exam cards are issued the week before. Learners should arrive 20 minutes early.".replace("Learners", t.member + "s"), rsvp: false },
    { id: "ev-open-day", title: "Open day and results clinic", kind: "Event", date: "2026-11-21", start: "09:00", end: "13:00", location: "Main hall", description: "Meet staff, see work on display and talk through progress. Please tell us whether you will come.", rsvp: true },
    { id: "ev-fees", title: "Fees due date", kind: "Deadline", date: "2026-11-27", location: "Bursar's office", description: "Outstanding balances are due. Visit the bursar's office to pay or arrange a plan.", rsvp: false },
    { id: "ev-trip", title: "Science museum trip", kind: "Trip", date: "2026-11-25", start: "07:30", end: "16:00", location: "Departs from the main gate", description: "A signed consent slip and a packed lunch are needed. Please confirm if your child will join.", rsvp: true },
    { id: "ev-pt", title: "Parent and teacher meetings", kind: "Meeting", date: "2026-11-19", start: "14:00", end: "17:30", location: "Classrooms", description: "Ten-minute talks with your child's teachers. Use Request a meeting to ask for a slot.", rsvp: true },
    { id: "ev-carols", title: "Carols and prize-giving", kind: "Event", date: "2026-12-04", start: "17:00", end: "19:00", location: "School grounds", description: "An evening of music and prizes. Families are welcome.", rsvp: true },
    { id: "ev-closing", title: `Closing day for ${t.period.toLowerCase()}`, kind: "Holiday", date: "2026-12-12", location: "", description: `${t.period} ends. The next ${t.period.toLowerCase()} opens in January.`, rsvp: false },
    { id: "ev-reopen", title: "School reopens", kind: "Holiday", date: "2027-01-12", location: "", description: "First day of the new academic year.", rsvp: false },
  ];
}

export const GUARDIAN_SEED: GuardianProfile = {
  name: "Grace Banda",
  relationship: "Mother",
  contact: { phone: "+260 977 123 456", altPhone: "", email: "grace.banda@example.org", address: "Plot 24, Kabulonga, Lusaka" },
  updatedAt: null,
};

export const PREFS_SEED: NotificationPrefs = {
  channels: { inApp: true, email: true, sms: false },
  topics: { attendance: true, results: true, fees: true, events: true, messages: true },
};

export const LINKS_SEED: LinkRequest[] = [];

/** Three unread threads (the sidebar badge) and one that has been read and answered. */
export function threadsFor(type: InstitutionType): MessageThread[] {
  const staff = staffFor(type);
  const [first, second] = staff;
  const bursar = staff.find((s) => s.id === "bursar")!;
  const office = staff.find((s) => s.id === "office")!;
  const t = (id: string, subject: string, childId: string | null, s: StaffMember, messages: MessageThread["messages"], unread: boolean): MessageThread => ({ id, subject, childId, staffId: s.id, staffName: s.name, staffTitle: s.title, messages, unread, lastAt: messages.at(-1)!.sentAt });
  return [
    t("th-1", "Homework not handed in", "chisomo", first, [{ id: "m1", from: "staff", author: first.name, body: "Good morning. Chisomo has not handed in last week's assignment. Could you remind them to submit it by Friday?", sentAt: "2026-11-13T07:40:00.000Z" }], true),
    t("th-2", "Fee reminder", null, bursar, [{ id: "m1", from: "staff", author: bursar.name, body: "This is a reminder that the fee balance is due on 27 November. Please visit the bursar's office if you would like to arrange a payment plan.", sentAt: "2026-11-12T10:05:00.000Z" }], true),
    t("th-3", "Open day invitation", null, office, [{ id: "m1", from: "staff", author: office.name, body: "You are invited to our open day on 21 November. Please reply on the School calendar so we can plan for numbers.", sentAt: "2026-11-10T13:20:00.000Z" }], true),
    t("th-4", "Question about Natasha's reading group", "natasha", second, [
      { id: "m1", from: "parent", author: "You", body: "Could Natasha join the extra reading group on Wednesdays?", sentAt: "2026-11-03T08:10:00.000Z" },
      { id: "m2", from: "staff", author: second.name, body: "Yes, there is space. She can start this Wednesday.", sentAt: "2026-11-03T15:30:00.000Z" },
    ], false),
  ];
}
