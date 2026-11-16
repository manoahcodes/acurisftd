import { hrefForNavLabel } from "@/config/navigation";
import { prettyDate } from "@/lib/teacher/dates";
import type { SearchResult } from "@/types/directory";
import { parent } from "../repositories";
import type { ParentSession } from "../parent-context";

const MAX_RESULTS = 8;

/**
 * Search across the signed-in guardian's own children, events, conversations
 * and the staff who serve their children. Everything comes from records scoped
 * to this guardian, so nothing of anyone else's can appear.
 */
export async function searchParent(s: Pick<ParentSession, "ctx" | "children">, query: string): Promise<SearchResult[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const [events, threads, staff] = await Promise.all([parent.listEvents(s.ctx), parent.listThreads(s.ctx), s.children[0] ? parent.listStaff(s.ctx, s.children[0].id) : Promise.resolve([])]);
  const href = (label: string) => hrefForNavLabel("parent", label, "Parent search");
  const entries: Array<SearchResult & { text: string }> = [
    ...s.children.flatMap((c) => [
      { id: `child-${c.id}`, title: c.name, subtitle: c.grade, kind: "Child", href: href("My children"), text: `${c.name} ${c.grade}` },
      { id: `stmt-${c.id}`, title: `Fee statement (${c.name})`, subtitle: "Invoice, receipts and balance", kind: "Statement", href: href("Fee statements"), text: `fee statement invoice receipt balance ${c.name}` },
    ]),
    ...events.map((e) => ({ id: `event-${e.id}`, title: e.title, subtitle: `${prettyDate(e.date)} · ${e.kind}`, kind: "Event", href: href("School calendar"), text: `${e.title} ${e.kind} ${e.location}` })),
    ...threads.map((t) => ({ id: `thread-${t.id}`, title: t.subject, subtitle: `${t.staffName}${t.unread ? " · Unread" : ""}`, kind: "Message", href: href("Messages"), text: `${t.subject} ${t.staffName} ${t.messages.map((m) => m.body).join(" ")}` })),
    ...staff.map((m) => ({ id: `staff-${m.id}`, title: m.name, subtitle: m.title, kind: "Staff", href: href("Messages"), text: `${m.name} ${m.title}` })),
  ];
  return entries.filter((e) => e.text.toLowerCase().includes(q)).slice(0, MAX_RESULTS).map((e): SearchResult => ({ id: e.id, title: e.title, subtitle: e.subtitle, kind: e.kind, href: e.href }));
}
