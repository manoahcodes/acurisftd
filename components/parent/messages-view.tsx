"use client";

import { useMemo, useState, useTransition } from "react";
import { ArrowLeft, PenLine, Search } from "lucide-react";
import { Card, Chip, Dialog, Field, buttonClass, inputClass, primaryClass } from "@/components/teacher/shared";
import { composeMessage, markAllThreadsRead, replyToThread, setThreadRead } from "@/server/actions/parent";
import { cn, formatStamp } from "@/lib/format";
import { LIMITS } from "@/lib/parent/validate";
import type { MessageThread, StaffMember } from "@/types/parent";

type Kid = { id: string; name: string };

/** Newest activity first; a thread is read when opened, and unread ones are marked. */
export function MessagesView({ threads, kids, staff, timezone }: { threads: MessageThread[]; kids: Kid[]; staff: StaffMember[]; timezone: string }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [composing, setComposing] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [pending, start] = useTransition();

  const q = query.trim().toLowerCase();
  const rows = useMemo(
    () => threads.filter((t) => (filter === "all" || t.unread) && (!q || [t.subject, t.staffName, ...t.messages.map((m) => m.body)].some((x) => x.toLowerCase().includes(q)))),
    [threads, q, filter],
  );
  const open = threads.find((t) => t.id === openId);
  const unread = threads.filter((t) => t.unread).length;
  const kidName = (id: string | null) => kids.find((k) => k.id === id)?.name;

  const openThread = (t: MessageThread) => {
    setOpenId(t.id);
    if (t.unread) start(async () => { await setThreadRead(t.id, true); });
  };

  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search size={16} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input type="search" aria-label="Search messages" placeholder="Search messages" value={query} onChange={(e) => setQuery(e.target.value)} className={`${inputClass} pl-9`} />
        </div>
        <select aria-label="Show" value={filter} onChange={(e) => setFilter(e.target.value as "all" | "unread")} className={`${inputClass} w-auto!`}>
          <option value="all">All messages</option>
          <option value="unread">Unread ({unread})</option>
        </select>
        <button type="button" disabled={pending || unread === 0} onClick={() => start(async () => { await markAllThreadsRead(); setMessage({ text: "Everything is marked as read.", error: false }); })} className={buttonClass}>Mark all as read</button>
        <button type="button" onClick={() => setComposing(true)} className={primaryClass}><PenLine size={16} aria-hidden /> New message</button>
      </div>

      {message && <p role="status" className="rounded-lg bg-positive-soft px-3 py-2 text-sm text-positive">{message.text}</p>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Card className={cn("p-0", open && "max-lg:hidden")}>
          {rows.length === 0 ? (
            <p className="px-5 py-6 text-[15px] text-muted">{threads.length === 0 ? "No messages yet. Use New message to write to a teacher or the office." : "Nothing matches."}</p>
          ) : (
            <ul className="divide-y divide-line" aria-label="Conversations">
              {rows.map((t) => {
                const last = t.messages.at(-1)!;
                return (
                  <li key={t.id}>
                    <button type="button" onClick={() => openThread(t)} aria-current={openId === t.id} className={cn("block w-full px-5 py-4 text-left hover:bg-canvas focus-visible:outline-2 focus-visible:outline-brand", openId === t.id && "bg-canvas")}>
                      <span className="flex items-center justify-between gap-2">
                        <span className={cn("truncate text-[16px] text-ink", t.unread ? "font-bold" : "font-medium")}>{t.subject}</span>
                        {t.unread && <span className="shrink-0"><Chip tone="info">Unread</Chip></span>}
                      </span>
                      <span className="mt-0.5 block truncate text-sm text-muted">{t.staffName}{kidName(t.childId) ? ` · about ${kidName(t.childId)}` : ""}</span>
                      <span className="mt-1 block truncate text-sm text-ink">{last.from === "parent" ? "You: " : ""}{last.body}</span>
                      <span className="mt-0.5 block text-xs text-muted">{formatStamp(t.lastAt, timezone)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {open ? (
          <ThreadPanel key={open.id} thread={open} about={kidName(open.childId)} timezone={timezone} onBack={() => setOpenId(null)} />
        ) : (
          <Card className="max-lg:hidden"><p className="text-[15px] text-muted">Choose a conversation to read it.</p></Card>
        )}
      </div>

      {composing && <ComposeDialog kids={kids} staff={staff} onClose={() => setComposing(false)} onDone={(id) => { setComposing(false); setOpenId(id); setMessage({ text: "Your message was sent.", error: false }); }} />}
    </div>
  );
}

function ThreadPanel({ thread, about, timezone, onBack }: { thread: MessageThread; about: string | undefined; timezone: string; onBack: () => void }) {
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <Card>
      <button type="button" onClick={onBack} className={`${buttonClass} mb-3 lg:hidden`}><ArrowLeft size={16} aria-hidden /> Back</button>
      <h2 className="text-lg font-semibold text-ink">{thread.subject}</h2>
      <p className="text-sm text-muted">{thread.staffName} · {thread.staffTitle}{about ? ` · about ${about}` : ""}</p>
      <ul className="mt-4 space-y-3" aria-label="Messages in this conversation">
        {thread.messages.map((m) => (
          <li key={m.id} className={cn("max-w-[85%] rounded-xl px-4 py-3", m.from === "parent" ? "ml-auto bg-brand/10" : "bg-canvas")}>
            <p className="text-sm font-medium text-ink">{m.author}</p>
            <p className="mt-1 whitespace-pre-wrap text-[15px] text-ink">{m.body}</p>
            <p className="mt-1 text-xs text-muted">{formatStamp(m.sentAt, timezone)}</p>
          </li>
        ))}
      </ul>
      <form
        className="mt-5 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          setError("");
          start(async () => {
            const r = await replyToThread(thread.id, { body });
            if (r.ok) setBody(""); else setError(r.fields?.body ?? r.error);
          });
        }}
      >
        <Field label="Reply" error={error || undefined} help={`Up to ${LIMITS.body.max} characters.`}>
          {(p) => <textarea {...p} rows={3} maxLength={LIMITS.body.max} value={body} onChange={(e) => setBody(e.target.value)} className={`${inputClass} h-auto py-2`} />}
        </Field>
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={pending} className={primaryClass}>{pending ? "Sending…" : "Send reply"}</button>
          <button type="button" disabled={pending} onClick={() => start(async () => { await setThreadRead(thread.id, false); onBack(); })} className={buttonClass}>Mark as unread</button>
        </div>
      </form>
    </Card>
  );
}

function ComposeDialog({ kids, staff, onClose, onDone }: { kids: Kid[]; staff: StaffMember[]; onClose: () => void; onDone: (id: string) => void }) {
  const [staffId, setStaffId] = useState("");
  const [childId, setChildId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <Dialog title="New message" subtitle="Write to a teacher or office linked to your child." onClose={onClose}>
      <form
        className="space-y-4 px-6 py-5"
        onSubmit={(e) => {
          e.preventDefault();
          setErrors({});
          setError("");
          start(async () => {
            const r = await composeMessage({ staffId, childId, subject, body });
            if (r.ok && r.id) onDone(r.id); else { setErrors(r.ok ? {} : (r.fields ?? {})); setError(r.ok ? "" : r.error); }
          });
        }}
      >
        <Field label="To" error={errors.staffId} required>
          {(p) => <select {...p} value={staffId} onChange={(e) => setStaffId(e.target.value)} className={inputClass}><option value="">Choose…</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.title}</option>)}</select>}
        </Field>
        <Field label="About" error={errors.childId}>
          {(p) => <select {...p} value={childId} onChange={(e) => setChildId(e.target.value)} className={inputClass}><option value="">General, not about one child</option>{kids.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}</select>}
        </Field>
        <Field label="Subject" error={errors.subject} required>
          {(p) => <input {...p} maxLength={LIMITS.subject.max} value={subject} onChange={(e) => setSubject(e.target.value)} className={inputClass} />}
        </Field>
        <Field label="Message" error={errors.body} required>
          {(p) => <textarea {...p} rows={5} maxLength={LIMITS.body.max} value={body} onChange={(e) => setBody(e.target.value)} className={`${inputClass} h-auto py-2`} />}
        </Field>
        {error && !Object.keys(errors).length && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={buttonClass}>Cancel</button>
          <button type="submit" disabled={pending} className={primaryClass}>{pending ? "Sending…" : "Send"}</button>
        </div>
      </form>
    </Dialog>
  );
}
