"use client";

import { useMemo, useState, useTransition } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import { DetailsList, PrintSheet, PrintTable } from "@/components/platform/print-sheet";
import { Card, Chip, ExportBar, Field, Stat, buttonClass, downloadCsv, inputClass, primaryClass, rateTone, useToday } from "@/components/teacher/shared";
import { sendAbsenceReason, takeBackAbsenceReason } from "@/server/actions/student";
import { cn, formatStamp } from "@/lib/format";
import type { PrintBranding } from "@/lib/print";
import { csvFilename } from "@/lib/table-tools";
import { prettyDate } from "@/lib/teacher/dates";
import { NOTE_LIMITS, byCourse, byDate, canExplain, currentStreak, dayStatus, figures, sittingsToRecover, type DayStatus } from "@/lib/student/attendance";
import type { StudentTerms } from "@/lib/student/terms";
import type { AttendanceEntry, AttendanceMark, AttendanceReport } from "@/types/student";

const MARK: Record<AttendanceMark, { label: string; tone: "good" | "warn" | "bad" | "info" }> = {
  present: { label: "Present", tone: "good" },
  late: { label: "Late", tone: "warn" },
  absent: { label: "Absent", tone: "bad" },
  excused: { label: "Excused", tone: "info" },
};

const DAY_CLASS: Record<DayStatus, string> = {
  present: "bg-positive-soft text-positive",
  late: "bg-warning-soft text-warning",
  absent: "bg-danger-soft text-danger",
  excused: "bg-canvas text-ink ring-1 ring-line",
  none: "text-muted",
};
const DAY_LABEL: Record<DayStatus, string> = { present: "present", late: "late", absent: "absent", excused: "excused", none: "no classes" };

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** The cells of a month grid starting on Monday; null pads before the 1st. */
function monthCells(year: number, month: number): Array<string | null> {
  const first = new Date(Date.UTC(year, month, 1));
  const lead = (first.getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: Array<string | null> = Array(lead).fill(null);
  for (let d = 1; d <= days; d++) cells.push(`${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  return cells;
}

export function AttendanceView({ report, terms, branding, studentName, studentNumber, group }: { report: AttendanceReport; terms: StudentTerms; branding: PrintBranding; studentName: string; studentNumber: string; group: string }) {
  const today = useToday(branding.timezone);
  const all = figures(report.entries);
  const courses = useMemo(() => byCourse(report.entries), [report.entries]);
  const days = useMemo(() => byDate(report.entries), [report.entries]);
  const streak = currentStreak(report.entries);
  const below = all.rate !== null && all.rate < report.required;
  const need = sittingsToRecover(all, report.required);

  // The calendar opens on the latest month with data.
  const lastMonth = Number(report.to.slice(5, 7)) - 1;
  const year = Number(report.to.slice(0, 4));
  const firstMonth = Number(report.from.slice(5, 7)) - 1;
  const [month, setMonth] = useState(lastMonth);
  const [picked, setPicked] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [courseId, setCourseId] = useState("");
  const [limit, setLimit] = useState(15);
  const [printing, setPrinting] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  const note = (date: string) => report.notes.find((n) => n.date === date);
  const log = report.entries
    .filter((e) => (!status || e.status === status) && (!courseId || e.courseId === courseId))
    .sort((a, b) => b.date.localeCompare(a.date) || b.start.localeCompare(a.start));

  const columns = ["Date", "Time", terms.course, "Status", "Reason"];
  const toRow = (e: AttendanceEntry) => [prettyDate(e.date), `${e.start}–${e.end}`, e.courseName, MARK[e.status].label, e.status === "absent" ? (note(e.date)?.reason ?? "") : ""];

  return (
    <div className="mt-6 space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl bg-canvas px-4 py-3">
          <p className="text-sm text-muted">Attendance, {report.periodLabel}</p>
          <p className="text-2xl font-bold text-ink">{all.rate === null ? "—" : `${all.rate}%`}</p>
          <p className="mt-0.5"><Chip tone={rateTone(all.rate)}>{below ? `Below ${report.required}%` : `Meets ${report.required}%`}</Chip></p>
        </div>
        <Stat label="Present or late" value={String(all.present + all.late)} note={`of ${all.total - all.excused} ${terms.sittings.toLowerCase()}`} />
        <Stat label="Absent" value={String(all.absent)} note={`${all.late} late · ${all.excused} excused`} />
        <Stat label="Current streak" value={`${streak} ${streak === 1 ? "day" : "days"}`} note="School days without an absence" />
      </div>

      {below && (
        <p role="status" className="flex items-start gap-2 rounded-xl bg-warning-soft px-4 py-3 text-[15px] text-warning">
          <AlertTriangle size={18} aria-hidden className="mt-0.5 shrink-0" />
          <span>Your attendance is below the {report.required}% the school expects. Attending your next {need} {terms.sittings.toLowerCase()} in a row would bring it back up. Talk to your {terms.tertiary ? "lecturer" : "teacher"} if something is getting in the way.</span>
        </p>
      )}

      <div className="grid gap-6 xl:grid-cols-[2fr_3fr]">
        <Card>
          <h2 className="text-lg font-semibold text-ink">By {terms.course.toLowerCase()}</h2>
          <ul className="mt-3 space-y-3">
            {courses.map((c) => (
              <li key={c.courseId}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[15px] font-medium text-ink">{c.courseName}</span>
                  <span className="text-[15px] font-semibold text-ink">{c.rate === null ? "—" : `${c.rate}%`}</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-canvas" aria-hidden>
                  <div className={cn("h-full rounded-full", (c.rate ?? 100) < report.required ? "bg-danger" : "bg-brand")} style={{ width: `${c.rate ?? 0}%` }} />
                </div>
                <p className="mt-0.5 text-sm text-muted">{c.present} present · {c.late} late · {c.absent} absent{c.excused ? ` · ${c.excused} excused` : ""}</p>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-ink">{MONTHS[month]} {year}</h2>
            <div className="flex gap-2">
              <button type="button" onClick={() => setMonth((m) => m - 1)} disabled={month <= firstMonth} aria-label="Previous month" className={`${buttonClass} px-2.5`}><ChevronLeft size={16} aria-hidden /></button>
              <button type="button" onClick={() => setMonth((m) => m + 1)} disabled={month >= lastMonth} aria-label="Next month" className={`${buttonClass} px-2.5`}><ChevronRight size={16} aria-hidden /></button>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-7 gap-1 text-center" role="grid" aria-label={`${MONTHS[month]} ${year} attendance`}>
            {WEEK.map((w) => <div key={w} role="columnheader" className="py-1 text-sm font-medium text-muted">{w}</div>)}
            {monthCells(year, month).map((date, i) => {
              if (!date) return <div key={`pad-${i}`} role="gridcell" />;
              const rows = days.get(date) ?? [];
              const s = dayStatus(rows);
              const closure = report.closures.find((c) => date >= c.from && date <= c.to);
              const label = `${prettyDate(date)}: ${closure && s === "none" ? closure.label : DAY_LABEL[s]}`;
              return (
                <div key={date} role="gridcell">
                  {s === "none" ? (
                    <span aria-label={label} className={cn("flex h-11 items-center justify-center rounded-lg text-[15px]", closure ? "bg-canvas text-muted" : "text-muted/60")} title={closure?.label}>{Number(date.slice(8))}</span>
                  ) : (
                    <button type="button" aria-label={label} aria-pressed={picked === date} onClick={() => setPicked(picked === date ? null : date)} className={cn("flex h-11 w-full items-center justify-center rounded-lg text-[15px] font-medium focus-visible:outline-2 focus-visible:outline-brand", DAY_CLASS[s], picked === date && "ring-2 ring-brand")}>
                      {Number(date.slice(8))}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted" aria-label="Key">
            {(["present", "late", "absent", "excused"] as const).map((k) => <li key={k} className="inline-flex items-center gap-1.5"><span aria-hidden className={cn("inline-block h-3 w-3 rounded", DAY_CLASS[k].split(" ")[0])} /> {MARK[k].label}</li>)}
            <li className="inline-flex items-center gap-1.5"><span aria-hidden className="inline-block h-3 w-3 rounded bg-canvas" /> Closed</li>
          </ul>

          {picked && (
            <DayPanel
              date={picked}
              rows={days.get(picked) ?? []}
              entries={report.entries}
              note={note(picked)}
              today={today}
              timezone={branding.timezone}
              onDone={(text, error) => setMessage({ text, error })}
            />
          )}
        </Card>
      </div>

      {message && <p role={message.error ? "alert" : "status"} className={cn("rounded-lg px-3 py-2 text-sm", message.error ? "bg-danger-soft text-danger" : "bg-positive-soft text-positive")}>{message.text}</p>}

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-ink">Recent log</h2>
          <div className="flex flex-wrap items-center gap-2">
            <select aria-label="Filter by status" value={status} onChange={(e) => { setStatus(e.target.value); setLimit(15); }} className={`${inputClass} w-auto!`}>
              <option value="">Every status</option>
              {(["absent", "late", "excused", "present"] as const).map((k) => <option key={k} value={k}>{MARK[k].label}</option>)}
            </select>
            <select aria-label={`Filter by ${terms.course.toLowerCase()}`} value={courseId} onChange={(e) => { setCourseId(e.target.value); setLimit(15); }} className={`${inputClass} w-auto!`}>
              <option value="">All {terms.courses.toLowerCase()}</option>
              {courses.map((c) => <option key={c.courseId} value={c.courseId}>{c.courseName}</option>)}
            </select>
            <ExportBar onCsv={() => downloadCsv(csvFilename(`attendance ${report.periodLabel}`, today || "export"), [columns, ...log.map(toRow)])} onPrint={() => setPrinting(true)} disabled={log.length === 0} />
          </div>
        </div>
        {log.length === 0 ? (
          <p className="mt-3 text-[15px] text-muted">Nothing matches.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[34rem] text-left text-[15px]">
              <caption className="sr-only">Attendance log, newest first</caption>
              <thead><tr className="text-sm text-muted">{columns.map((c) => <th key={c} scope="col" className="py-2 pr-3 font-medium">{c}</th>)}</tr></thead>
              <tbody className="divide-y divide-line">
                {log.slice(0, limit).map((e) => (
                  <tr key={`${e.date}-${e.slotId}`}>
                    <td className="py-2 pr-3 text-ink">{prettyDate(e.date)}</td>
                    <td className="py-2 pr-3 tabular-nums text-muted">{e.start}–{e.end}</td>
                    <td className="py-2 pr-3 text-ink">{e.courseName}</td>
                    <td className="py-2 pr-3"><Chip tone={MARK[e.status].tone}>{MARK[e.status].label}</Chip></td>
                    <td className="py-2 text-muted">{e.status === "absent" ? (note(e.date) ? (note(e.date)!.state === "approved" ? "Reason accepted" : "Reason sent") : "—") : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {log.length > limit && <div className="mt-3"><button type="button" onClick={() => setLimit((l) => l + 15)} className={buttonClass}>Show more ({log.length - limit} left)</button></div>}
          </div>
        )}
      </Card>

      {printing && (
        <PrintSheet branding={branding} title={`Attendance, ${report.periodLabel}`} lines={[`${prettyDate(report.from)} to ${prettyDate(report.to)}`, `${log.length} ${terms.sittings.toLowerCase()} shown`]} onClose={() => setPrinting(false)}>
          <DetailsList details={[[terms.member, studentName], [`${terms.member} number`, studentNumber], [terms.group, group], ["Attendance", all.rate === null ? "—" : `${all.rate}%`], ["Absent", String(all.absent)], ["Late", String(all.late)]]} />
          <div className="mt-6"><PrintTable columns={columns} rows={log.map(toRow)} /></div>
        </PrintSheet>
      )}
    </div>
  );
}

function DayPanel({ date, rows, entries, note, today, timezone, onDone }: { date: string; rows: AttendanceEntry[]; entries: AttendanceEntry[]; note: AttendanceReport["notes"][number] | undefined; today: string; timezone: string; onDone: (text: string, error: boolean) => void }) {
  const [reason, setReason] = useState(note?.reason ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const absent = rows.some((r) => r.status === "absent");
  const can = today ? canExplain(entries, date, today) : ({ ok: false, error: "" } as const);
  const editable = !note || note.state === "pending";

  return (
    <div className="mt-4 rounded-xl border border-line px-4 py-3">
      <h3 className="text-[16px] font-semibold text-ink">{prettyDate(date)}</h3>
      <ul className="mt-2 divide-y divide-line">
        {rows.sort((a, b) => a.start.localeCompare(b.start)).map((r) => (
          <li key={r.slotId} className="flex flex-wrap items-center justify-between gap-2 py-1.5 text-[15px]">
            <span className="text-ink"><span className="tabular-nums text-muted">{r.start}</span> {r.courseName}</span>
            <Chip tone={MARK[r.status].tone}>{MARK[r.status].label}</Chip>
          </li>
        ))}
      </ul>

      {absent && note && (
        <p className="mt-3 text-[15px] text-ink"><span className="font-medium">Your reason ({note.state === "approved" ? "accepted by the school" : "waiting for review"}): </span>{note.reason}<span className="block text-sm text-muted">Sent {formatStamp(note.submittedAt, timezone)}</span></p>
      )}

      {absent && editable && can.ok && (
        <form
          className="mt-3 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            start(async () => {
              const r = await sendAbsenceReason({ date, reason });
              if (r.ok) onDone(`Your reason for ${prettyDate(date)} was sent to the school.`, false);
              else setError(r.fields?.reason ?? r.error);
            });
          }}
        >
          <Field label={note ? "Change your reason" : "Why were you away?"} error={error ?? undefined} help={`${NOTE_LIMITS.min}–${NOTE_LIMITS.max} characters. The school will review it.`}>
            {(p) => <textarea {...p} rows={3} maxLength={NOTE_LIMITS.max} value={reason} onChange={(e) => setReason(e.target.value)} className={`${inputClass} h-auto py-2`} />}
          </Field>
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={pending} className={primaryClass}>{pending ? "Sending…" : note ? "Update reason" : "Send reason"}</button>
            {note && (
              <button type="button" disabled={pending} onClick={() => start(async () => {
                const r = await takeBackAbsenceReason(date);
                if (r.ok) { setReason(""); onDone(`Your reason for ${prettyDate(date)} was taken back.`, false); } else setError(r.error);
              })} className={buttonClass}>Take back</button>
            )}
          </div>
        </form>
      )}
      {absent && editable && !can.ok && can.error && <p className="mt-3 text-sm text-muted">{can.error}</p>}
    </div>
  );
}
