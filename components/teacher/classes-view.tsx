"use client";

import { useMemo, useState, useTransition } from "react";
import { Flag, Search, Users } from "lucide-react";
import { DetailsList, PrintSheet, PrintTable } from "@/components/platform/print-sheet";
import { saveClassNote, saveLearnerFlag } from "@/server/actions/teacher";
import type { PrintBranding } from "@/lib/print";
import type { TeacherTerms } from "@/lib/teacher/terms";
import { csvFilename } from "@/lib/table-tools";
import type { ClassDetail, RosterEntry } from "@/types/teacher";
import { Card, Chip, Dialog, ExportBar, Stat, buttonClass, downloadCsv, inputClass, primaryClass, rateText, rateTone, useToday } from "./shared";

export function ClassesView({ classes, terms, branding }: { classes: ClassDetail[]; terms: TeacherTerms; branding: PrintBranding }) {
  const [query, setQuery] = useState("");
  const [onlyReview, setOnlyReview] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return classes.filter((c) => (!onlyReview || c.flagged > 0) && (!q || `${c.name} ${c.subject} ${c.room}`.toLowerCase().includes(q)));
  }, [classes, query, onlyReview]);

  const open = classes.find((c) => c.id === openId);
  const totalMembers = classes.reduce((n, c) => n + c.size, 0);
  const needReview = classes.filter((c) => c.flagged > 0).length;

  return (
    <div className="mt-6 space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label={`My ${terms.groups.toLowerCase()}`} value={String(classes.length)} />
        <Stat label={terms.members} value={String(totalMembers)} note={`Across all ${terms.groups.toLowerCase()}`} />
        <Stat label="Need review" value={String(needReview)} note={needReview === 1 ? `1 ${terms.group.toLowerCase()} has ${terms.members.toLowerCase()} on the watch list` : `${needReview} ${terms.groups.toLowerCase()} have ${terms.members.toLowerCase()} on the watch list`} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-60 flex-1 sm:max-w-sm">
          <Search size={16} aria-hidden className="pointer-events-none absolute left-3 top-3 text-muted" />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${terms.groups.toLowerCase()}`} aria-label={`Search ${terms.groups.toLowerCase()}`} className={`${inputClass} pl-9`} />
        </div>
        <label className="flex items-center gap-2 text-[15px] text-ink">
          <input type="checkbox" checked={onlyReview} onChange={(e) => setOnlyReview(e.target.checked)} className="size-4 accent-[var(--color-brand)]" />
          Needs review only
        </label>
      </div>

      {shown.length === 0 ? (
        <Card><p className="text-[15px] text-muted">No {terms.groups.toLowerCase()} match.</p></Card>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((c) => (
            <li key={c.id}>
              <Card className="flex h-full flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-semibold text-ink">{c.name}</h2>
                    <p className="text-[15px] text-muted">{c.subject}</p>
                  </div>
                  <Chip tone={rateTone(c.attendanceRate)}>{rateText(c.attendanceRate)} attendance</Chip>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 text-[15px]">
                  <dt className="text-muted">{terms.members}</dt><dd className="text-ink">{c.size}</dd>
                  <dt className="text-muted">Room</dt><dd className="text-ink">{c.room}</dd>
                  <dt className="text-muted">Time</dt><dd className="text-ink">{c.time}</dd>
                  <dt className="text-muted">Days</dt><dd className="text-ink">{c.days.join(", ")}</dd>
                  <dt className="text-muted">Open assignments</dt><dd className="text-ink">{c.openAssignments}</dd>
                </dl>
                {c.flagged > 0 && <p className="mt-3 flex items-center gap-1.5 text-[15px] text-warning"><Flag size={15} aria-hidden /> {c.flagged} on the watch list</p>}
                {c.note && <p className="mt-3 rounded-lg bg-canvas px-3 py-2 text-[15px] text-ink">{c.note}</p>}
                <div className="mt-auto pt-4">
                  <button type="button" onClick={() => setOpenId(c.id)} className={buttonClass}>
                    <Users size={16} aria-hidden /> View {terms.members.toLowerCase()}
                  </button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {open && <ClassDialog key={open.id} cls={open} terms={terms} branding={branding} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function ClassDialog({ cls, terms, branding, onClose }: { cls: ClassDetail; terms: TeacherTerms; branding: PrintBranding; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [note, setNote] = useState(cls.note);
  const [flagging, setFlagging] = useState<RosterEntry | null>(null);
  const [printing, setPrinting] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [pending, start] = useTransition();
  const today = useToday(branding.timezone);

  const roster = useMemo(() => {
    const q = query.trim().toLowerCase();
    return cls.roster.filter((l) => !q || `${l.name} ${l.number}`.toLowerCase().includes(q));
  }, [cls.roster, query]);

  const columns = ["No.", terms.member, "Number", "Present", "Absent", "Late", "Attendance", "Watch list"];
  const rows = roster.map((l, i) => [String(i + 1), l.name, l.number, String(l.attendance.present), String(l.attendance.absent), String(l.attendance.late), rateText(l.attendance.rate), l.flag || "—"]);

  const run = (job: () => Promise<{ ok: boolean; error?: string }>, done: string) =>
    start(async () => {
      const r = await job();
      setMessage(r.ok ? { text: done, error: false } : { text: r.error ?? "Something went wrong.", error: true });
    });

  return (
    <Dialog title={cls.name} subtitle={`${cls.subject} · ${cls.room} · ${cls.time} · ${cls.days.join(", ")}`} onClose={onClose} wide>
      <div className="space-y-5 px-6 py-5">
        <div>
          <label htmlFor="class-note" className="mb-1 block text-sm font-medium text-ink">{terms.group} note</label>
          <textarea id="class-note" rows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} className={`${inputClass} h-auto py-2`} placeholder={`Anything to remember about this ${terms.group.toLowerCase()}`} />
          <div className="mt-2">
            <button type="button" disabled={pending || note.trim() === cls.note} onClick={() => run(() => saveClassNote(cls.id, note), "Note saved.")} className={buttonClass}>Save note</button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative min-w-56 flex-1 sm:max-w-xs">
            <Search size={16} aria-hidden className="pointer-events-none absolute left-3 top-3 text-muted" />
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${terms.members.toLowerCase()}`} aria-label={`Search ${terms.members.toLowerCase()}`} className={`${inputClass} pl-9`} />
          </div>
          <ExportBar onCsv={() => downloadCsv(csvFilename(`${cls.name} ${terms.members}`, today || "list"), [columns, ...rows])} onPrint={() => setPrinting(true)} disabled={roster.length === 0} />
        </div>

        {message && <p role={message.error ? "alert" : "status"} className={message.error ? "rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger" : "rounded-lg bg-positive-soft px-3 py-2 text-sm text-positive"}>{message.text}</p>}

        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[40rem] text-left text-[15px]">
            <caption className="sr-only">{terms.members} in {cls.name}</caption>
            <thead className="bg-canvas text-sm text-muted">
              <tr>{columns.map((c) => <th key={c} scope="col" className="px-3 py-2 font-medium">{c}</th>)}</tr>
            </thead>
            <tbody>
              {roster.map((l, i) => (
                <tr key={l.id} className="border-t border-line">
                  <td className="px-3 py-2 text-muted">{i + 1}</td>
                  <td className="px-3 py-2 font-medium text-ink">{l.name}</td>
                  <td className="px-3 py-2 text-muted">{l.number}</td>
                  <td className="px-3 py-2">{l.attendance.present}</td>
                  <td className="px-3 py-2">{l.attendance.absent}</td>
                  <td className="px-3 py-2">{l.attendance.late}</td>
                  <td className="px-3 py-2"><Chip tone={rateTone(l.attendance.rate)}>{rateText(l.attendance.rate)}</Chip></td>
                  <td className="px-3 py-2">
                    <button type="button" onClick={() => setFlagging(l)} className={l.flag ? "inline-flex items-center gap-1.5 text-warning underline-offset-2 hover:underline" : "text-muted underline-offset-2 hover:text-ink hover:underline"} title={l.flag || undefined}>
                      <Flag size={14} aria-hidden /> {l.flag ? "On watch list" : "Add"}
                    </button>
                  </td>
                </tr>
              ))}
              {roster.length === 0 && <tr><td colSpan={columns.length} className="px-3 py-6 text-center text-muted">No {terms.members.toLowerCase()} match.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {flagging && (
        <FlagDialog
          learner={flagging}
          terms={terms}
          onClose={() => setFlagging(null)}
          onSave={(text) => {
            const l = flagging;
            setFlagging(null);
            run(() => saveLearnerFlag(cls.id, l.id, text), text ? `${l.name} is on the watch list.` : `${l.name} was removed from the watch list.`);
          }}
        />
      )}

      {printing && (
        <PrintSheet branding={branding} title={`${cls.name} – ${terms.members}`} lines={[`${cls.subject} · ${cls.room} · ${cls.time}`, `${roster.length} ${terms.members.toLowerCase()}${query ? ` matching “${query}”` : ""}`]} onClose={() => setPrinting(false)}>
          <DetailsList details={[[terms.group, cls.name], ["Subject", cls.subject], ["Room", cls.room]]} />
          <div className="mt-6"><PrintTable columns={columns} rows={rows} /></div>
        </PrintSheet>
      )}
    </Dialog>
  );
}

function FlagDialog({ learner, terms, onClose, onSave }: { learner: RosterEntry; terms: TeacherTerms; onClose: () => void; onSave: (note: string) => void }) {
  const [text, setText] = useState(learner.flag);
  return (
    <Dialog title={`Watch list: ${learner.name}`} subtitle={`${terms.member} ${learner.number}`} onClose={onClose}>
      <form
        className="space-y-4 px-6 py-5"
        onSubmit={(e) => {
          e.preventDefault();
          onSave(text.trim());
        }}
      >
        <div>
          <label htmlFor="flag-note" className="mb-1 block text-sm font-medium text-ink">Why are you keeping an eye on them?</label>
          <textarea id="flag-note" rows={3} maxLength={300} value={text} onChange={(e) => setText(e.target.value)} className={`${inputClass} h-auto py-2`} />
          <p className="mt-1 text-sm text-muted">Leave it empty and save to take them off the watch list.</p>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={buttonClass}>Cancel</button>
          <button type="submit" className={primaryClass}>{learner.flag && !text.trim() ? "Remove from watch list" : "Save"}</button>
        </div>
      </form>
    </Dialog>
  );
}
