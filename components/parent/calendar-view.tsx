"use client";

import { useMemo, useState, useTransition } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import { Card, Chip, Dialog, Field, buttonClass, inputClass, primaryClass, useToday } from "@/components/teacher/shared";
import { cancelMeeting, requestMeeting, setEventReply } from "@/server/actions/parent";
import { cn } from "@/lib/format";
import { prettyDate } from "@/lib/teacher/dates";
import { MEETING_SLOTS, type EventKind, type EventRow, type MeetingRequest, type MeetingState, type StaffMember } from "@/types/parent";

const KIND_TONE: Record<EventKind, "good" | "warn" | "bad" | "info"> = { Holiday: "good", Exam: "bad", Meeting: "info", Event: "info", Deadline: "warn", Trip: "info" };
const MEETING_TONE: Record<MeetingState, { label: string; tone: "good" | "warn" | "bad" | "info" }> = { pending: { label: "Waiting for the school", tone: "warn" }, confirmed: { label: "Confirmed", tone: "good" }, declined: { label: "Not possible", tone: "bad" }, cancelled: { label: "Cancelled", tone: "info" } };
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const endOf = (e: EventRow) => e.endDate ?? e.date;
const covers = (e: EventRow, date: string) => date >= e.date && date <= endOf(e);

function monthCells(year: number, month: number): Array<string | null> {
  const lead = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: Array<string | null> = Array(lead).fill(null);
  for (let d = 1; d <= days; d++) cells.push(`${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  return cells;
}

const when = (e: EventRow) => `${prettyDate(e.date)}${e.endDate ? ` to ${prettyDate(e.endDate)}` : ""}${e.start ? ` · ${e.start}${e.end ? `–${e.end}` : ""}` : ""}`;

export function CalendarView({ events, meetings, kids, staffByChild, timezone, initialMonth }: { events: EventRow[]; meetings: MeetingRequest[]; kids: Array<{ id: string; name: string }>; staffByChild: Record<string, StaffMember[]>; timezone: string; initialMonth: string }) {
  const today = useToday(timezone);
  const [year, setYear] = useState(Number(initialMonth.slice(0, 4)));
  const [month, setMonth] = useState(Number(initialMonth.slice(5, 7)) - 1);
  const [picked, setPicked] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [pending, start] = useTransition();

  const cells = useMemo(() => monthCells(year, month), [year, month]);
  const shown = picked ? events.filter((e) => covers(e, picked)) : events.filter((e) => !today || endOf(e) >= today);
  const step = (n: number) => {
    const d = new Date(Date.UTC(year, month + n, 1));
    setYear(d.getUTCFullYear());
    setMonth(d.getUTCMonth());
    setPicked(null);
  };

  const reply = (e: EventRow, response: "going" | "not_going" | null) =>
    start(async () => {
      const r = await setEventReply(e.id, response);
      setMessage(r.ok ? { text: response === null ? `Your reply to ${e.title} was taken back.` : `Thank you. We have noted that you are ${response === "going" ? "coming to" : "not coming to"} ${e.title}.`, error: false } : { text: r.error, error: true });
    });

  return (
    <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <Card>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink" aria-live="polite">{MONTHS[month]} {year}</h2>
          <div className="flex gap-1">
            <button type="button" onClick={() => step(-1)} aria-label="Previous month" className={`${buttonClass} px-2`}><ChevronLeft size={18} aria-hidden /></button>
            <button type="button" onClick={() => step(1)} aria-label="Next month" className={`${buttonClass} px-2`}><ChevronRight size={18} aria-hidden /></button>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-7 gap-1 text-center text-sm text-muted" aria-hidden>{WEEK.map((w) => <span key={w}>{w}</span>)}</div>
        <ul className="mt-1 grid grid-cols-7 gap-1">
          {cells.map((date, i) => {
            if (!date) return <li key={`pad-${i}`} />;
            const on = events.filter((e) => covers(e, date));
            const sel = picked === date;
            return (
              <li key={date}>
                <button type="button" aria-pressed={sel} aria-label={`${prettyDate(date)}${on.length ? `, ${on.length} ${on.length === 1 ? "event" : "events"}: ${on.map((e) => e.title).join(", ")}` : ""}`} onClick={() => setPicked(sel ? null : date)} className={cn("flex h-11 w-full flex-col items-center justify-center rounded-lg text-[15px] focus-visible:outline-2 focus-visible:outline-brand", on.length ? "bg-brand/10 font-semibold text-ink" : "text-muted hover:bg-canvas", date === today && "ring-1 ring-brand", sel && "ring-2 ring-brand")}>
                  {Number(date.slice(8))}
                  {on.length > 0 && <span aria-hidden className="mt-0.5 size-1.5 rounded-full bg-brand" />}
                </button>
              </li>
            );
          })}
        </ul>
        <button type="button" onClick={() => setAsking(true)} className={`${primaryClass} mt-5 w-full justify-center`}>Request a meeting with a teacher</button>
      </Card>

      <div className="space-y-6">
        {message && <p role={message.error ? "alert" : "status"} className={cn("rounded-lg px-3 py-2 text-sm", message.error ? "bg-danger-soft text-danger" : "bg-positive-soft text-positive")}>{message.text}</p>}

        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-ink">{picked ? prettyDate(picked) : "Coming up"}</h2>
            {picked && <button type="button" onClick={() => setPicked(null)} className={buttonClass}>Show everything coming up</button>}
          </div>
          {shown.length === 0 ? (
            <p className="mt-3 text-[15px] text-muted">{picked ? "Nothing is on this day." : "Nothing is coming up."}</p>
          ) : (
            <ul className="mt-3 divide-y divide-line">
              {shown.map((e) => (
                <li key={e.id} className="py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-[16px] font-semibold text-ink">{e.title}</h3>
                    <Chip tone={KIND_TONE[e.kind]}>{e.kind}</Chip>
                  </div>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 text-sm text-muted"><span className="inline-flex items-center gap-1"><CalendarDays size={14} aria-hidden />{when(e)}</span>{e.location && <span className="inline-flex items-center gap-1"><MapPin size={14} aria-hidden />{e.location}</span>}</p>
                  <p className="mt-1 text-[15px] text-ink">{e.description}</p>
                  {e.rsvp && (
                    <div className="mt-2 flex flex-wrap items-center gap-2" role="group" aria-label={`Reply to ${e.title}`}>
                      <button type="button" disabled={pending} aria-pressed={e.response === "going"} onClick={() => reply(e, e.response === "going" ? null : "going")} className={cn(buttonClass, e.response === "going" && "border-positive text-positive")}>I&apos;m going</button>
                      <button type="button" disabled={pending} aria-pressed={e.response === "not_going"} onClick={() => reply(e, e.response === "not_going" ? null : "not_going")} className={cn(buttonClass, e.response === "not_going" && "border-danger text-danger")}>Can&apos;t make it</button>
                      <span className="text-sm text-muted">{e.response === null ? "No reply yet" : e.response === "going" ? "You replied: going" : "You replied: not going"}</span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-ink">My meeting requests</h2>
          {meetings.length === 0 ? (
            <p className="mt-2 text-[15px] text-muted">You have not asked to meet anyone yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line">
              {meetings.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="text-[15px] font-medium text-ink">{m.staffName} · {kids.find((c) => c.id === m.childId)?.name ?? "Child"}</p>
                    <p className="text-sm text-muted">{prettyDate(m.date)}, {m.slot.toLowerCase()} · {m.topic}</p>
                    {m.reply && <p className="text-sm text-ink">School: {m.reply}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Chip tone={MEETING_TONE[m.state].tone}>{MEETING_TONE[m.state].label}</Chip>
                    {(m.state === "pending" || m.state === "confirmed") && <button type="button" disabled={pending} onClick={() => start(async () => { const r = await cancelMeeting(m.id); setMessage(r.ok ? { text: "The meeting request was cancelled.", error: false } : { text: r.error, error: true }); })} className={buttonClass}>Cancel</button>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {asking && <MeetingDialog today={today} kids={kids} staffByChild={staffByChild} onClose={() => setAsking(false)} onDone={(text) => { setAsking(false); setMessage({ text, error: false }); }} />}
    </div>
  );
}

function MeetingDialog({ today, kids, staffByChild, onClose, onDone }: { today: string; kids: Array<{ id: string; name: string }>; staffByChild: Record<string, StaffMember[]>; onClose: () => void; onDone: (text: string) => void }) {
  const [childId, setChildId] = useState(kids[0]?.id ?? "");
  const staff = staffByChild[childId] ?? [];
  const [staffId, setStaffId] = useState("");
  const [date, setDate] = useState("");
  const [slot, setSlot] = useState<string>(MEETING_SLOTS[0]);
  const [topic, setTopic] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const tomorrow = today ? new Date(Date.parse(`${today}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10) : undefined;

  return (
    <Dialog title="Request a meeting" subtitle="The school will confirm a time with you." onClose={onClose}>
      <form
        className="space-y-4 px-6 py-5"
        onSubmit={(e) => {
          e.preventDefault();
          setErrors({});
          setError("");
          start(async () => {
            const r = await requestMeeting({ childId, staffId, date, slot, topic });
            if (r.ok) onDone("Your meeting request was sent. The school will confirm a time.");
            else { setErrors(r.fields ?? {}); setError(r.error); }
          });
        }}
      >
        <Field label="About which child?" error={errors.childId} required>
          {(p) => <select {...p} value={childId} onChange={(e) => { setChildId(e.target.value); setStaffId(""); }} className={inputClass}>{kids.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>}
        </Field>
        <Field label="Who would you like to meet?" error={errors.staffId} required>
          {(p) => <select {...p} value={staffId} onChange={(e) => setStaffId(e.target.value)} className={inputClass}><option value="">Choose…</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.title}</option>)}</select>}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Preferred day" error={errors.date} help="A school day within the next 60 days." required>
            {(p) => <input {...p} type="date" min={tomorrow} value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />}
          </Field>
          <Field label="Time of day" error={errors.slot} required>
            {(p) => <select {...p} value={slot} onChange={(e) => setSlot(e.target.value)} className={inputClass}>{MEETING_SLOTS.map((s) => <option key={s}>{s}</option>)}</select>}
          </Field>
        </div>
        <Field label="What would you like to talk about?" error={errors.topic} required>
          {(p) => <textarea {...p} rows={3} maxLength={200} value={topic} onChange={(e) => setTopic(e.target.value)} className={`${inputClass} h-auto py-2`} />}
        </Field>
        {error && !Object.keys(errors).length && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={buttonClass}>Cancel</button>
          <button type="submit" disabled={pending} className={primaryClass}>{pending ? "Sending…" : "Send request"}</button>
        </div>
      </form>
    </Dialog>
  );
}
