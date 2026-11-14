"use client";

import { useMemo, useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { PrintSheet, PrintTable } from "@/components/platform/print-sheet";
import { saveRegister } from "@/server/actions/teacher";
import { cn } from "@/lib/format";
import type { PrintBranding } from "@/lib/print";
import { addDays, isWeekend, lastSchoolDay, prettyDate } from "@/lib/teacher/dates";
import type { TeacherTerms } from "@/lib/teacher/terms";
import { csvFilename } from "@/lib/table-tools";
import { tally } from "@/lib/teacher/validate";
import { ATTENDANCE_STATUSES, type AttendanceStatus, type Learner, type RegisterHistoryRow, type RegisterRecord, type TeachingClass } from "@/types/teacher";
import { Card, Chip, ExportBar, Stat, buttonClass, downloadCsv, inputClass, primaryClass, rateText, rateTone, useToday } from "./shared";

type ClassRoster = { class: TeachingClass; roster: Learner[] };

const LABEL: Record<AttendanceStatus, string> = { present: "Present", absent: "Absent", late: "Late", excused: "Excused" };
const SHORT: Record<AttendanceStatus, string> = { present: "P", absent: "A", late: "L", excused: "E" };
const ON: Record<AttendanceStatus, string> = {
  present: "bg-positive text-white",
  absent: "bg-danger text-white",
  late: "bg-warning text-white",
  excused: "bg-brand text-on-brand",
};

export function RegisterView({
  classes,
  records,
  history,
  terms,
  branding,
  initialClassId,
}: {
  classes: ClassRoster[];
  records: RegisterRecord[];
  history: RegisterHistoryRow[];
  terms: TeacherTerms;
  branding: PrintBranding;
  initialClassId?: string;
}) {
  const today = useToday(branding.timezone);
  const [classId, setClassId] = useState(initialClassId && classes.some((c) => c.class.id === initialClassId) ? initialClassId : (classes[0]?.class.id ?? ""));
  const [picked, setPicked] = useState("");
  const date = picked || (today ? lastSchoolDay(today) : "");
  const [draft, setDraft] = useState<{ key: string; marks: Record<string, AttendanceStatus>; note: string } | null>(null);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [pending, start] = useTransition();

  const current = classes.find((c) => c.class.id === classId);
  const key = `${classId}|${date}`;
  const saved = records.find((r) => r.classId === classId && r.date === date);
  const working = draft?.key === key ? draft : { key, marks: saved?.marks ?? {}, note: saved?.note ?? "" };
  const dirty = draft?.key === key;
  const roster = useMemo(() => current?.roster ?? [], [current]);
  const counts = tally(roster.map((l) => working.marks[l.id]).filter((m): m is AttendanceStatus => Boolean(m)));
  const unmarked = roster.filter((l) => !working.marks[l.id]).length;
  const locked = !date || isWeekend(date) || date > today;

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return roster.filter((l) => !q || `${l.name} ${l.number}`.toLowerCase().includes(q));
  }, [roster, query]);

  const change = (marks: Record<string, AttendanceStatus>, note = working.note) => {
    setMessage(null);
    setDraft({ key, marks, note });
  };

  const submit = (final: boolean) =>
    start(async () => {
      const r = await saveRegister({ classId, date, marks: working.marks, note: working.note, submit: final });
      if (r.ok) {
        setDraft(null);
        setMessage({ text: final ? "Register submitted." : "Draft saved.", error: false });
      } else setMessage({ text: r.error, error: true });
    });

  // ---- history
  const [hClass, setHClass] = useState("");
  const [hStatus, setHStatus] = useState("");
  const [printing, setPrinting] = useState(false);
  const rows = history.filter((h) => (!hClass || h.classId === hClass) && (!hStatus || h.status === hStatus));
  const columns = ["Date", terms.group, "Status", `${terms.members} marked`, "Present", "Absent", "Late", "Excused", "Attendance"];
  const table = rows.map((h) => [prettyDate(h.date), h.className, h.status === "submitted" ? "Submitted" : "Draft", String(h.present + h.absent + h.late + h.excused), String(h.present), String(h.absent), String(h.late), String(h.excused), rateText(h.rate)]);

  if (classes.length === 0) return <Card className="mt-6"><p className="text-[15px] text-muted">You have no {terms.groups.toLowerCase()} yet.</p></Card>;

  return (
    <div className="mt-6 space-y-8">
      <Card>
        <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="reg-class" className="mb-1 block text-sm font-medium text-ink">{terms.group}</label>
              <select id="reg-class" value={classId} onChange={(e) => { setClassId(e.target.value); setMessage(null); }} className={inputClass}>
                {classes.map((c) => <option key={c.class.id} value={c.class.id}>{c.class.name} – {c.class.subject}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="reg-date" className="mb-1 block text-sm font-medium text-ink">Date</label>
              <input id="reg-date" type="date" value={date} max={today || undefined} onChange={(e) => { setPicked(e.target.value); setMessage(null); }} className={inputClass} />
            </div>
          </div>
          <div className="flex items-end gap-2">
            <button type="button" onClick={() => date && setPicked(lastSchoolDay(addDays(date, -1)))} disabled={!date} className={buttonClass} aria-label="Previous school day"><ChevronLeft size={16} aria-hidden /></button>
            <button type="button" onClick={() => date && setPicked(addDays(date, 1) > today ? date : lastSchoolDay(addDays(date, 1)))} disabled={!date || addDays(date, 1) > today} className={buttonClass} aria-label="Next school day"><ChevronRight size={16} aria-hidden /></button>
          </div>
        </div>
        {date && <p className="mt-3 text-[15px] text-muted">{prettyDate(date)} · {current?.class.time} · {current?.class.room}</p>}
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-ink">{terms.group} register</h2>
            {saved && <Chip tone={saved.status === "submitted" ? "good" : "warn"}>{saved.status === "submitted" ? "Submitted" : "Draft"}</Chip>}
            {dirty && <Chip tone="info">Unsaved changes</Chip>}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Stat label="Present" value={String(counts.present)} />
          <Stat label="Absent" value={String(counts.absent)} />
          <Stat label="Late" value={String(counts.late)} />
          <Stat label="Excused" value={String(counts.excused)} />
          <Stat label="Not marked" value={String(unmarked)} />
        </div>

        {isWeekend(date) && date ? (
          <p role="alert" className="mt-4 rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning">Registers are taken on school days (Monday to Friday). Choose another date.</p>
        ) : (
          <>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <div className="relative min-w-56 flex-1 sm:max-w-xs">
                <Search size={16} aria-hidden className="pointer-events-none absolute left-3 top-3 text-muted" />
                <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${terms.members.toLowerCase()}`} aria-label={`Search ${terms.members.toLowerCase()}`} className={`${inputClass} pl-9`} />
              </div>
              <button type="button" disabled={locked} onClick={() => change(Object.fromEntries(roster.map((l) => [l.id, working.marks[l.id] ?? "present"])))} className={buttonClass}>Mark everyone present</button>
              <button type="button" disabled={locked} onClick={() => change({})} className={buttonClass}>Clear all</button>
            </div>

            <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
              {shown.map((l, i) => (
                <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-medium text-ink"><span className="mr-2 text-muted">{i + 1}.</span>{l.name}</p>
                    <p className="text-sm text-muted">{l.number}</p>
                  </div>
                  <div role="group" aria-label={`Attendance for ${l.name}`} className="flex gap-1">
                    {ATTENDANCE_STATUSES.map((s) => (
                      <button
                        key={s}
                        type="button"
                        disabled={locked}
                        aria-pressed={working.marks[l.id] === s}
                        aria-label={LABEL[s]}
                        title={LABEL[s]}
                        onClick={() => change({ ...working.marks, [l.id]: s })}
                        className={cn("size-9 rounded-lg border text-sm font-semibold focus-visible:outline-2 focus-visible:outline-brand disabled:opacity-50", working.marks[l.id] === s ? `${ON[s]} border-transparent` : "border-line bg-surface text-muted hover:bg-canvas")}
                      >
                        {SHORT[s]}
                      </button>
                    ))}
                  </div>
                </li>
              ))}
              {shown.length === 0 && <li className="px-3 py-6 text-center text-[15px] text-muted">No {terms.members.toLowerCase()} match.</li>}
            </ul>
            <p className="mt-2 text-sm text-muted">P present · A absent · L late · E excused</p>

            <div className="mt-4">
              <label htmlFor="reg-note" className="mb-1 block text-sm font-medium text-ink">Note for this register</label>
              <textarea id="reg-note" rows={2} maxLength={500} value={working.note} disabled={locked} onChange={(e) => change(working.marks, e.target.value)} className={`${inputClass} h-auto py-2`} />
            </div>

            {message && <p role={message.error ? "alert" : "status"} className={cn("mt-4 rounded-lg px-3 py-2 text-sm", message.error ? "bg-danger-soft text-danger" : "bg-positive-soft text-positive")}>{message.text}</p>}

            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button type="button" disabled={pending || locked || !dirty} onClick={() => submit(false)} className={buttonClass}>Save draft</button>
              <button type="button" disabled={pending || locked || (saved?.status === "submitted" && !dirty)} onClick={() => submit(true)} className={primaryClass}>
                {saved?.status === "submitted" ? "Resubmit register" : "Submit register"}
              </button>
            </div>
          </>
        )}
      </Card>

      <Card>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-lg font-semibold text-ink">Register history</h2>
          <ExportBar onCsv={() => downloadCsv(csvFilename("register history", today || "export"), [columns, ...table])} onPrint={() => setPrinting(true)} disabled={rows.length === 0} />
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <select aria-label={`Filter by ${terms.group.toLowerCase()}`} value={hClass} onChange={(e) => setHClass(e.target.value)} className={`${inputClass} w-auto`}>
            <option value="">All {terms.groups.toLowerCase()}</option>
            {classes.map((c) => <option key={c.class.id} value={c.class.id}>{c.class.name}</option>)}
          </select>
          <select aria-label="Filter by status" value={hStatus} onChange={(e) => setHStatus(e.target.value)} className={`${inputClass} w-auto`}>
            <option value="">Any status</option>
            <option value="submitted">Submitted</option>
            <option value="draft">Draft</option>
          </select>
        </div>
        <div className="mt-4 overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[44rem] text-left text-[15px]">
            <caption className="sr-only">Register history</caption>
            <thead className="bg-canvas text-sm text-muted">
              <tr>{columns.map((c) => <th key={c} scope="col" className="px-3 py-2 font-medium">{c}</th>)}</tr>
            </thead>
            <tbody>
              {rows.slice(0, 60).map((h, i) => (
                <tr key={`${h.classId}|${h.date}`} className="border-t border-line">
                  <td className="px-3 py-2">
                    <button type="button" className="text-brand hover:underline" onClick={() => { setClassId(h.classId); setPicked(h.date); setMessage(null); window.scrollTo({ top: 0, behavior: "smooth" }); }}>{table[i][0]}</button>
                  </td>
                  <td className="px-3 py-2">{h.className}</td>
                  <td className="px-3 py-2"><Chip tone={h.status === "submitted" ? "good" : "warn"}>{table[i][2]}</Chip></td>
                  <td className="px-3 py-2">{table[i][3]}/{h.size}</td>
                  <td className="px-3 py-2">{h.present}</td>
                  <td className="px-3 py-2">{h.absent}</td>
                  <td className="px-3 py-2">{h.late}</td>
                  <td className="px-3 py-2">{h.excused}</td>
                  <td className="px-3 py-2"><Chip tone={rateTone(h.rate)}>{rateText(h.rate)}</Chip></td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={columns.length} className="px-3 py-6 text-center text-muted">No registers yet.</td></tr>}
            </tbody>
          </table>
        </div>
        {rows.length > 60 && <p className="mt-2 text-sm text-muted">Showing the latest 60 of {rows.length}. Export to get them all.</p>}
      </Card>

      {printing && (
        <PrintSheet branding={branding} title="Register history" lines={[`${rows.length} registers`]} onClose={() => setPrinting(false)}>
          <PrintTable columns={columns} rows={table} />
        </PrintSheet>
      )}
    </div>
  );
}
