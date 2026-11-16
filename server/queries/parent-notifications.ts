import { hrefForNavLabel } from "@/config/navigation";
import { todayIn } from "@/lib/format";
import { formatKwacha } from "@/lib/money";
import { prettyDate } from "@/lib/teacher/dates";
import type { NotificationItem, NotificationSummary } from "@/types/topbar";
import { parent, student } from "../repositories";
import { childContext, type ParentSession } from "../parent-context";

const MAX_ITEMS = 6;
const href = (label: string) => hrefForNavLabel("parent", label, "Parent notifications");

/**
 * The bell for a parent: unread messages, events that ask for a reply, and a
 * fee balance for each linked child. It follows the same records as the
 * sidebar badge and honours the parent's own notification choices (the in-app
 * channel and each topic). The count is every item, which can exceed the items listed.
 */
export async function parentNotifications(s: Pick<ParentSession, "ctx" | "children" | "timezone">): Promise<NotificationSummary> {
  const prefs = await parent.getPrefs(s.ctx);
  if (!prefs.channels.inApp) return { unreadCount: 0, items: [] };
  const today = todayIn(s.timezone).iso;
  const [threads, events] = await Promise.all([parent.listThreads(s.ctx), parent.listEvents(s.ctx)]);
  const fees = await Promise.all(
    s.children.map(async (c) => {
      const ctx = childContext(s, c.id);
      return ctx ? { child: c, fee: await student.getFees(ctx) } : undefined;
    }),
  );

  const items: NotificationItem[] = [
    ...(prefs.topics.messages ? threads.filter((t) => t.unread).map((t) => ({ id: `thread-${t.id}`, title: t.subject, detail: t.staffName, href: href("Messages"), unread: true })) : []),
    ...(prefs.topics.events ? events.filter((e) => e.rsvp && e.response === null && (e.endDate ?? e.date) >= today).map((e) => ({ id: `event-${e.id}`, title: e.title, detail: `${prettyDate(e.date)} · Reply requested`, href: href("School calendar"), unread: true })) : []),
    ...(prefs.topics.fees ? fees.flatMap((f) => (f && f.fee.balance > 0 ? [{ id: `fee-${f.child.id}`, title: f.fee.status === "overdue" ? "Fees are overdue" : "Fees are due", detail: `${f.child.name} · ${formatKwacha(f.fee.balance)}${f.fee.dueOn ? ` due ${prettyDate(f.fee.dueOn)}` : ""}`, href: href("Fee statements"), unread: true }] : [])) : []),
  ];
  return { unreadCount: items.length, items: items.slice(0, MAX_ITEMS) };
}
