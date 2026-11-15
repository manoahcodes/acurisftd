"use client";

import { useMemo, useState, useTransition } from "react";
import { AlertTriangle, CheckCheck, ChevronDown, Pin, Search } from "lucide-react";
import { Card, Chip, Stat, buttonClass, inputClass, useToday } from "@/components/teacher/shared";
import { markEveryNoticeRead, setNoticeRead } from "@/server/actions/student";
import { cn } from "@/lib/format";
import { prettyDate, shortDate } from "@/lib/teacher/dates";
import { NOTICE_CATEGORIES, type StudentNoticeRow } from "@/types/student";

export function NoticesView({ rows, timezone }: { rows: StudentNoticeRow[]; timezone: string }) {
  const today = useToday(timezone);
  const [category, setCategory] = useState("");
  const [query, setQuery] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();
  // Shown straight away; the server's answer replaces it when the page refreshes.
  const [readNow, setReadNow] = useState<Record<string, boolean>>({});
  const isRead = (n: StudentNoticeRow) => readNow[n.id] ?? n.read;

  const unread = rows.filter((n) => !isRead(n)).length;
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((n) => (!category || n.category === category) && (!unreadOnly || !(readNow[n.id] ?? n.read)) && (!q || `${n.title} ${n.body} ${n.postedBy}`.toLowerCase().includes(q)));
  }, [rows, category, query, unreadOnly, readNow]);

  const mark = (n: StudentNoticeRow, read: boolean) => {
    setReadNow((s) => ({ ...s, [n.id]: read }));
    setError(null);
    start(async () => {
      const r = await setNoticeRead(n.id, read);
      if (!r.ok) {
        setReadNow((s) => ({ ...s, [n.id]: !read }));
        setError(r.error);
      }
    });
  };

  const toggle = (n: StudentNoticeRow) => {
    const opening = openId !== n.id;
    setOpenId(opening ? n.id : null);
    // Opening a notice reads it.
    if (opening && !isRead(n)) mark(n, true);
  };

  const markAll = () => {
    const before = readNow;
    setReadNow(Object.fromEntries(rows.map((n) => [n.id, true])));
    setError(null);
    start(async () => {
      const r = await markEveryNoticeRead();
      if (!r.ok) {
        setReadNow(before);
        setError(r.error);
      }
    });
  };

  return (
    <div className="mt-6 space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Unread" value={String(unread)} note={unread === 0 ? "You are all caught up" : undefined} />
        <Stat label="Notices" value={String(rows.length)} />
        <Stat label="Need action" value={String(rows.filter((n) => n.actionBy && (!today || n.actionBy >= today)).length)} note="Have a date to act by" />
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-52">
              <Search size={16} aria-hidden className="pointer-events-none absolute left-3 top-3 text-muted" />
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search notices" aria-label="Search notices" className={`${inputClass} pl-9`} />
            </div>
            <select aria-label="Filter by category" value={category} onChange={(e) => setCategory(e.target.value)} className={`${inputClass} w-auto!`}>
              <option value="">All categories</option>
              {NOTICE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
            <label className="inline-flex items-center gap-2 text-[15px] text-ink">
              <input type="checkbox" checked={unreadOnly} onChange={(e) => setUnreadOnly(e.target.checked)} className="h-4 w-4 accent-brand" /> Unread only
            </label>
          </div>
          <button type="button" onClick={markAll} disabled={unread === 0} className={buttonClass}><CheckCheck size={16} aria-hidden /> Mark all as read</button>
        </div>
        {error && <p role="alert" className="mt-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
        <p className="sr-only" role="status">{unread} unread {unread === 1 ? "notice" : "notices"}</p>
      </Card>

      {shown.length === 0 ? (
        <Card><p className="text-[15px] text-muted">{rows.length === 0 ? "There are no notices yet." : unreadOnly && !query && !category ? "You are all caught up." : "Nothing matches."}</p></Card>
      ) : (
        <ul className="space-y-3">
          {shown.map((n) => {
            const open = openId === n.id;
            const read = isRead(n);
            return (
              <li key={n.id}>
                <Card className="p-0">
                  <h2>
                    <button type="button" aria-expanded={open} aria-controls={`ntc-${n.id}`} onClick={() => toggle(n)} className="flex w-full items-start gap-3 rounded-2xl px-5 py-4 text-left hover:bg-canvas focus-visible:outline-2 focus-visible:outline-brand">
                      <span className="mt-2 flex w-3 shrink-0 justify-center">
                        {!read && <span className="h-2.5 w-2.5 rounded-full bg-brand" aria-hidden />}
                        {!read && <span className="sr-only">Unread</span>}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={cn("block text-[17px] text-ink", read ? "font-medium" : "font-bold")}>{n.title}</span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
                          <span>{prettyDate(n.postedOn)}</span>
                          <span aria-hidden>·</span>
                          <span>{n.postedBy}</span>
                        </span>
                        {!open && <span className="mt-1 line-clamp-1 block text-[15px] text-muted">{n.body}</span>}
                      </span>
                      <span className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                        {n.pinned && <span className="inline-flex items-center gap-1 text-sm text-muted"><Pin size={14} aria-hidden /> Pinned</span>}
                        {n.important && <Chip tone="bad"><AlertTriangle size={12} aria-hidden className="mr-1 inline" />Important</Chip>}
                        <Chip tone="info">{n.category}</Chip>
                        <ChevronDown size={18} aria-hidden className={cn("text-muted transition-transform", open && "rotate-180")} />
                      </span>
                    </button>
                  </h2>
                  {open && (
                    <div id={`ntc-${n.id}`} className="border-t border-line px-5 py-4">
                      <p className="whitespace-pre-wrap text-[15px] text-ink">{n.body}</p>
                      {n.actionBy && (
                        <p className="mt-3 text-[15px] text-ink">
                          <span className="font-medium">Act by:</span> {prettyDate(n.actionBy)}
                          {today && n.actionBy < today ? <span className="text-danger"> (passed)</span> : null}
                        </p>
                      )}
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <button type="button" onClick={() => mark(n, !read)} className={buttonClass}>{read ? "Mark as unread" : "Mark as read"}</button>
                        <span className="text-sm text-muted">Posted {shortDate(n.postedOn)}</span>
                      </div>
                    </div>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
