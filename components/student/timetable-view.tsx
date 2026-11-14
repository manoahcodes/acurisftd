"use client";

import { useState, useSyncExternalStore } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock, List, MapPin } from "lucide-react";
import { DetailsList, PrintSheet, PrintTable } from "@/components/platform/print-sheet";
import { Card, Chip, ExportBar, Stat, buttonClass, downloadCsv } from "@/components/teacher/shared";
import { cn, safeZone } from "@/lib/format";
import type { PrintBranding } from "@/lib/print";
import { csvFilename } from "@/lib/table-tools";
import { addDays, prettyDate, shortDate, weekStart } from "@/lib/teacher/dates";
import { nextSitting, progressOf, sittingsOn, timeRange, weekDates, weeklyHours, weekdayOf, type Progress, type Sitting } from "@/lib/student/timetable";
import type { StudentTerms } from "@/lib/student/terms";
import type { Timetable } from "@/types/student";

/** Today's date and the minute of the day in the school's zone. Empty on the server and on the first client render, so the server never reads the clock. */
function useClock(timezone: string): { today: string; minutes: number } | null {
  const zone = safeZone(timezone);
  const read = () => {
    const now = new Date();
    const date = new Intl.DateTimeFormat("en-CA", { timeZone: zone }).format(now);
    const parts = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: zone }).formatToParts(now);
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
    return `${date}|${get("hour") * 60 + get("minute")}`;
  };
  const snapshot = useSyncExternalStore(
    (cb) => {
      const id = setInterval(cb, 30_000);
      return () => clearInterval(id);
    },
    read,
    () => "",
  );
  if (!snapshot) return null;
  const [today, minutes] = snapshot.split("|");
  return { today, minutes: Number(minutes) };
}

const PROGRESS_LABEL: Record<Progress, string> = { done: "Done", now: "In progress", next: "Up next", later: "" };

export function TimetableView({ timetable, terms, branding }: { timetable: Timetable; terms: StudentTerms; branding: PrintBranding }) {
  const clock = useClock(branding.timezone);
  const today = clock?.today ?? "";
  // Until the clock is known, show the week the sample data is set in; it switches to the real week on arrival.
  const [offset, setOffset] = useState(0);
  const [mode, setMode] = useState<"week" | "day">("week");
  const [picked, setPicked] = useState<string | null>(null);
  const [courseId, setCourseId] = useState("");
  const [printing, setPrinting] = useState(false);

  const anchor = today || "2026-11-09";
  const monday = addDays(weekStart(anchor), offset * 7);
  const week = weekDates(monday);
  const isThisWeek = offset === 0;
  // The day list opens on today when it is in view, else on Monday of the shown week.
  const dayDate = picked && week.some((w) => w.date === picked) ? picked : (week.find((w) => w.date === today)?.date ?? week[0].date);

  const nowMin = clock?.minutes ?? 0;
  const next = today ? nextSitting(timetable, today, nowMin) : undefined;
  const courseName = (id: string) => timetable.courses.find((c) => c.id === id)?.name ?? "";

  const keep = (s: Sitting) => !courseId || s.slot.courseId === courseId;
  const dayRows = (date: string) => sittingsOn(timetable, date).filter(keep);

  const csvRows = week.flatMap(({ date }) => dayRows(date).map((s) => [prettyDate(date), timeRange(s.slot.start, s.slot.end), s.course.name, s.course.teacher, s.room, s.change ? (s.change.kind === "cancelled" ? "Cancelled" : "Room changed") : ""]));
  const columns = ["Date", "Time", terms.course, "Teacher", "Room", "Note"];
  const changesThisWeek = week.flatMap(({ date }) => sittingsOn(timetable, date).filter((s) => s.change));

  return (
    <div className="mt-6 space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label={`${terms.sittings} per week`} value={String(timetable.slots.length)} note={`${weeklyHours(timetable)} hours in class`} />
        <Stat label={terms.courses} value={String(timetable.courses.length)} note={timetable.group} />
        <div className="rounded-xl bg-canvas px-4 py-3" aria-live="polite">
          <p className="text-sm text-muted">Next {terms.sitting.toLowerCase()}</p>
          {next ? (
            <>
              <p className="text-lg font-bold text-ink">{next.course.name}</p>
              <p className="text-sm text-muted">{next.date === today ? "Today" : prettyDate(next.date)} · {timeRange(next.slot.start, next.slot.end)} · {next.room}</p>
            </>
          ) : (
            <p className="text-lg font-bold text-ink">{today ? "Nothing coming up" : "…"}</p>
          )}
        </div>
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setOffset((o) => o - 1)} aria-label="Previous week" className={`${buttonClass} px-2.5`}><ChevronLeft size={16} aria-hidden /></button>
            <div className="min-w-44 text-center">
              <p className="text-[15px] font-semibold text-ink">{shortDate(week[0].date)} – {shortDate(week[4].date)}</p>
              <p className="text-sm text-muted">{isThisWeek ? "This week" : offset === 1 ? "Next week" : offset === -1 ? "Last week" : `${offset > 0 ? "+" : ""}${offset} weeks`}</p>
            </div>
            <button type="button" onClick={() => setOffset((o) => o + 1)} aria-label="Next week" className={`${buttonClass} px-2.5`}><ChevronRight size={16} aria-hidden /></button>
            <button type="button" onClick={() => { setOffset(0); setPicked(null); }} disabled={isThisWeek && !picked} className={buttonClass}>Today</button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select aria-label={`Filter by ${terms.course.toLowerCase()}`} value={courseId} onChange={(e) => setCourseId(e.target.value)} className="h-10 rounded-lg border border-line bg-surface px-3 text-[15px] text-ink focus-visible:outline-2 focus-visible:outline-brand">
              <option value="">All {terms.courses.toLowerCase()}</option>
              {timetable.courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <div role="group" aria-label="Layout" className="inline-flex overflow-hidden rounded-lg border border-line">
              <button type="button" aria-pressed={mode === "week"} onClick={() => setMode("week")} className={cn("inline-flex items-center gap-1.5 px-3 py-2 text-[15px] font-medium focus-visible:outline-2 focus-visible:outline-brand", mode === "week" ? "bg-brand text-on-brand" : "text-ink hover:bg-canvas")}><CalendarDays size={16} aria-hidden /> Week</button>
              <button type="button" aria-pressed={mode === "day"} onClick={() => setMode("day")} className={cn("inline-flex items-center gap-1.5 px-3 py-2 text-[15px] font-medium focus-visible:outline-2 focus-visible:outline-brand", mode === "day" ? "bg-brand text-on-brand" : "text-ink hover:bg-canvas")}><List size={16} aria-hidden /> Day</button>
            </div>
            <ExportBar onCsv={() => downloadCsv(csvFilename("my timetable", monday), [columns, ...csvRows])} onPrint={() => setPrinting(true)} disabled={csvRows.length === 0} />
          </div>
        </div>

        {changesThisWeek.length > 0 && (
          <ul className="mt-4 space-y-1 rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning" aria-label="Changes this week">
            {changesThisWeek.map((s) => (
              <li key={`${s.date}-${s.slot.id}`}>
                <strong>{prettyDate(s.date)}, {s.course.name}:</strong> {s.change?.kind === "cancelled" ? "cancelled." : `moved to ${s.room}.`} {s.change?.note}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {mode === "week" ? (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[44rem] border-collapse text-left">
            <caption className="sr-only">Weekly timetable, {shortDate(week[0].date)} to {shortDate(week[4].date)}</caption>
            <thead>
              <tr className="border-b border-line">
                {week.map(({ day, date }) => (
                  <th key={day} scope="col" className={cn("px-3 py-3 align-bottom", date === today && "bg-brand/10")}>
                    <span className="block text-[15px] font-semibold text-ink">{day}</span>
                    <span className="block text-sm font-normal text-muted">{shortDate(date)}{date === today ? " · Today" : ""}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="align-top">
                {week.map(({ date }) => {
                  const rows = dayRows(date);
                  const prog = progressOf(rows, date, today || "0000-00-00", nowMin);
                  return (
                    <td key={date} className={cn("w-1/5 border-l border-line px-2 py-2 first:border-l-0", date === today && "bg-brand/5")}>
                      {rows.length === 0 ? (
                        <p className="px-1 py-2 text-sm text-muted">{courseId ? "No sittings" : "Nothing scheduled"}</p>
                      ) : (
                        <ul className="space-y-2">
                          {rows.map((s, i) => <SittingCard key={s.slot.id} sitting={s} progress={prog[i]} />)}
                        </ul>
                      )}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </Card>
      ) : (
        <Card>
          <div role="tablist" aria-label="Day" className="mb-4 flex flex-wrap gap-2">
            {week.map(({ day, date }) => (
              <button key={date} type="button" role="tab" aria-selected={date === dayDate} onClick={() => setPicked(date)} className={cn("rounded-lg border px-3 py-1.5 text-[15px] font-medium focus-visible:outline-2 focus-visible:outline-brand", date === dayDate ? "border-brand bg-brand text-on-brand" : "border-line text-ink hover:bg-canvas")}>
                {day} <span className="text-sm opacity-80">{shortDate(date)}</span>
              </button>
            ))}
          </div>
          <h2 className="text-lg font-semibold text-ink">{prettyDate(dayDate)}{dayDate === today ? " · Today" : ""}</h2>
          {(() => {
            const rows = dayRows(dayDate);
            if (rows.length === 0) return <p className="mt-3 text-[15px] text-muted">{weekdayOf(dayDate) ? "Nothing scheduled." : "No classes at the weekend."}</p>;
            const prog = progressOf(rows, dayDate, today || "0000-00-00", nowMin);
            return (
              <ol className="mt-3 divide-y divide-line">
                {rows.map((s, i) => (
                  <li key={s.slot.id} className="flex flex-wrap items-center gap-x-6 gap-y-1 py-3">
                    <span className="w-28 shrink-0 text-[15px] font-semibold tabular-nums text-ink">{timeRange(s.slot.start, s.slot.end)}</span>
                    <span className="min-w-40 flex-1">
                      <span className={cn("block text-[16px] font-semibold text-ink", s.change?.kind === "cancelled" && "line-through")}>{s.course.name}</span>
                      <span className="block text-sm text-muted">{s.course.teacher}</span>
                    </span>
                    <span className="inline-flex items-center gap-1 text-[15px] text-muted"><MapPin size={14} aria-hidden /> {s.room}</span>
                    <StatusChip sitting={s} progress={prog[i]} />
                  </li>
                ))}
              </ol>
            );
          })()}
        </Card>
      )}

      <Card>
        <h2 className="text-lg font-semibold text-ink">My {terms.courses.toLowerCase()}</h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {timetable.courses.map((c) => (
            <li key={c.id} className="rounded-xl border border-line px-4 py-3">
              <p className="text-[16px] font-semibold text-ink">{c.name}</p>
              <p className="text-sm text-muted">{c.code}{c.credits ? ` · ${c.credits} credits` : ""}</p>
              <p className="mt-1 text-sm text-muted">{c.teacher}</p>
              <p className="inline-flex items-center gap-1 text-sm text-muted"><MapPin size={13} aria-hidden /> {c.room}</p>
              <p className="mt-1 text-sm text-muted">{timetable.slots.filter((s) => s.courseId === c.id).map((s) => s.day).join(", ")}</p>
            </li>
          ))}
        </ul>
      </Card>

      {printing && (
        <PrintSheet branding={branding} title={`Timetable, ${timetable.group}`} lines={[`${shortDate(week[0].date)} – ${shortDate(week[4].date)} ${week[4].date.slice(0, 4)}`, courseId ? courseName(courseId) : `All ${terms.courses.toLowerCase()}`]} onClose={() => setPrinting(false)}>
          <DetailsList details={[[terms.group, timetable.group], [`${terms.sittings} per week`, String(timetable.slots.length)]]} />
          <div className="mt-6"><PrintTable columns={columns} rows={csvRows} /></div>
        </PrintSheet>
      )}
    </div>
  );
}

function StatusChip({ sitting, progress }: { sitting: Sitting; progress: Progress }) {
  if (sitting.change?.kind === "cancelled") return <Chip tone="bad">Cancelled</Chip>;
  if (sitting.change?.kind === "room") return <Chip tone="warn">Room changed</Chip>;
  if (progress === "now") return <Chip tone="good">In progress</Chip>;
  if (progress === "next") return <Chip tone="info">Up next</Chip>;
  if (progress === "done") return <Chip tone="info">Done</Chip>;
  return null;
}

function SittingCard({ sitting: s, progress }: { sitting: Sitting; progress: Progress }) {
  const cancelled = s.change?.kind === "cancelled";
  return (
    <li className={cn("rounded-lg border px-2.5 py-2", progress === "now" ? "border-brand bg-brand/10" : "border-line bg-surface", progress === "done" && "opacity-70")}>
      <p className="inline-flex items-center gap-1 text-sm tabular-nums text-muted"><Clock size={12} aria-hidden /> {timeRange(s.slot.start, s.slot.end)}</p>
      <p className={cn("text-[15px] font-semibold text-ink", cancelled && "line-through")}>{s.course.name}</p>
      <p className="text-sm text-muted">{s.room}</p>
      {(s.change || PROGRESS_LABEL[progress]) && (
        <p className="mt-1"><StatusChip sitting={s} progress={progress} /></p>
      )}
    </li>
  );
}
