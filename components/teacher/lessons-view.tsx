"use client";

import { useMemo, useState, useTransition } from "react";
import { Copy, Plus, Search, Trash2 } from "lucide-react";
import { PrintSheet, PrintTable } from "@/components/platform/print-sheet";
import { changeLessonStatus, copyLesson, removeLesson, saveLesson } from "@/server/actions/teacher";
import { cn } from "@/lib/format";
import type { PrintBranding } from "@/lib/print";
import { addDays, prettyDate, shortDate, weekStart } from "@/lib/teacher/dates";
import type { TeacherTerms } from "@/lib/teacher/terms";
import { csvFilename } from "@/lib/table-tools";
import type { LessonRow, LessonStatus, ResourceLink, TeachingClass } from "@/types/teacher";
import { Card, Chip, Dialog, ExportBar, Field, Stat, buttonClass, downloadCsv, inputClass, primaryClass, useToday } from "./shared";

const STATUS_TONE = { draft: "info", ready: "good", taught: "warn" } as const;
const STATUS_LABEL: Record<LessonStatus, string> = { draft: "Draft", ready: "Ready", taught: "Taught" };

export function LessonsView({ rows, classes, terms, branding }: { rows: LessonRow[]; classes: TeachingClass[]; terms: TeacherTerms; branding: PrintBranding }) {
  const today = useToday(branding.timezone);
  const sitting = terms.sitting;
  const [query, setQuery] = useState("");
  const [fClass, setFClass] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [editing, setEditing] = useState<LessonRow | "new" | null>(null);
  const [taught, setTaught] = useState<LessonRow | null>(null);
  const [copying, setCopying] = useState<LessonRow | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<LessonRow | null>(null);
  const [printing, setPrinting] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [pending, start] = useTransition();

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((l) => (!fClass || l.classId === fClass) && (!fStatus || l.status === fStatus) && (!q || `${l.title} ${l.className} ${l.objectives}`.toLowerCase().includes(q)));
  }, [rows, query, fClass, fStatus]);

  const weeks = useMemo(() => {
    const m = new Map<string, LessonRow[]>();
    for (const l of shown) m.set(weekStart(l.date), [...(m.get(weekStart(l.date)) ?? []), l]);
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [shown]);

  const columns = ["Date", "Time", terms.group, "Topic", "Status", "Objectives", "Homework"];
  const table = shown.map((l) => [prettyDate(l.date), l.startTime, l.className, l.title, STATUS_LABEL[l.status], l.objectives, l.homework]);

  const run = (job: () => Promise<{ ok: boolean; error?: string }>, done: string) =>
    start(async () => {
      const r = await job();
      setMessage(r.ok ? { text: done, error: false } : { text: r.error ?? "Something went wrong.", error: true });
    });

  const thisWeek = today ? weekStart(today) : "";

  return (
    <div className="mt-6 space-y-6">
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label={`${sitting}s planned`} value={String(rows.length)} />
        <Stat label="This week" value={String(rows.filter((l) => thisWeek && weekStart(l.date) === thisWeek).length)} />
        <Stat label="Drafts" value={String(rows.filter((l) => l.status === "draft").length)} note="Still to finish" />
        <Stat label="Taught" value={String(rows.filter((l) => l.status === "taught").length)} />
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-56">
              <Search size={16} aria-hidden className="pointer-events-none absolute left-3 top-3 text-muted" />
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${sitting.toLowerCase()} plans`} aria-label={`Search ${sitting.toLowerCase()} plans`} className={`${inputClass} pl-9`} />
            </div>
            <select aria-label={`Filter by ${terms.group.toLowerCase()}`} value={fClass} onChange={(e) => setFClass(e.target.value)} className={`${inputClass} w-auto!`}>
              <option value="">All {terms.groups.toLowerCase()}</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select aria-label="Filter by status" value={fStatus} onChange={(e) => setFStatus(e.target.value)} className={`${inputClass} w-auto!`}>
              <option value="">Any status</option>
              {(Object.keys(STATUS_LABEL) as LessonStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <ExportBar onCsv={() => downloadCsv(csvFilename(`${sitting} plans`, today || "export"), [columns, ...table])} onPrint={() => setPrinting(true)} disabled={shown.length === 0} />
            <button type="button" onClick={() => setEditing("new")} className={primaryClass}><Plus size={16} aria-hidden /> New {sitting.toLowerCase()} plan</button>
          </div>
        </div>
        {message && <p role={message.error ? "alert" : "status"} className={cn("mt-4 rounded-lg px-3 py-2 text-sm", message.error ? "bg-danger-soft text-danger" : "bg-positive-soft text-positive")}>{message.text}</p>}
      </Card>

      {weeks.length === 0 && <Card><p className="text-[15px] text-muted">{rows.length === 0 ? `No ${sitting.toLowerCase()} plans yet. Plan your first one.` : "No plans match."}</p></Card>}

      {weeks.map(([week, list]) => (
        <section key={week} aria-labelledby={`wk-${week}`}>
          <h2 id={`wk-${week}`} className="mb-3 text-lg font-semibold text-ink">
            Week of {shortDate(week)}{thisWeek === week && <span className="ml-2 align-middle"><Chip tone="good">This week</Chip></span>}
            <span className="ml-2 text-sm font-normal text-muted">to {shortDate(addDays(week, 4))}</span>
          </h2>
          <ul className="grid gap-3">
            {list.map((l) => (
              <li key={l.id}>
                <Card className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-[17px] font-semibold text-ink">{l.title}</h3>
                      <Chip tone={STATUS_TONE[l.status]}>{STATUS_LABEL[l.status]}</Chip>
                    </div>
                    <p className="mt-1 text-[15px] text-muted">{prettyDate(l.date)}{l.startTime && ` · ${l.startTime}`} · {l.className} · {l.subject}</p>
                    {l.objectives && <p className="mt-2 text-[15px] text-ink">{l.objectives}</p>}
                    {l.links.length > 0 && (
                      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                        {l.links.map((k) => <li key={k.url}><a href={k.url} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">{k.label}</a></li>)}
                      </ul>
                    )}
                    {l.status === "taught" && l.reflection && <p className="mt-2 rounded-lg bg-canvas px-3 py-2 text-sm text-ink"><span className="font-medium">Reflection: </span>{l.reflection}</p>}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
                    <button type="button" className="text-brand hover:underline" onClick={() => setEditing(l)}>Edit</button>
                    {l.status === "draft" && <button type="button" disabled={pending} className="text-brand hover:underline" onClick={() => run(() => changeLessonStatus(l.id, "ready"), `“${l.title}” is ready.`)}>Mark ready</button>}
                    {l.status === "ready" && <button type="button" className="text-brand hover:underline" onClick={() => setTaught(l)}>Mark taught</button>}
                    {l.status === "taught" && <button type="button" disabled={pending} className="text-brand hover:underline" onClick={() => run(() => changeLessonStatus(l.id, "ready"), `“${l.title}” is back to ready.`)}>Reopen</button>}
                    <button type="button" className="text-brand hover:underline" onClick={() => setCopying(l)}><Copy size={14} aria-hidden className="inline" /> Copy</button>
                    <button type="button" aria-label={`Delete ${l.title}`} className="text-danger hover:underline" onClick={() => setConfirmDelete(l)}><Trash2 size={14} aria-hidden className="inline" /> Delete</button>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {editing && <LessonForm key={editing === "new" ? "new" : editing.id} existing={editing === "new" ? null : editing} classes={classes} terms={terms} today={today} onClose={() => setEditing(null)} onSaved={(t) => { setEditing(null); setMessage({ text: t, error: false }); }} />}

      {taught && (
        <Dialog title={`Mark “${taught.title}” as taught`} subtitle={prettyDate(taught.date)} onClose={() => setTaught(null)}>
          <ReflectionForm initial={taught.reflection} onCancel={() => setTaught(null)} onSave={(text) => { const l = taught; setTaught(null); run(() => changeLessonStatus(l.id, "taught", text), `“${l.title}” is marked as taught.`); }} />
        </Dialog>
      )}

      {copying && (
        <Dialog title={`Copy “${copying.title}”`} subtitle="Creates a new draft on the date you choose" onClose={() => setCopying(null)}>
          <CopyForm initial={copying.date} onCancel={() => setCopying(null)} onSave={(date) => { const l = copying; setCopying(null); run(() => copyLesson(l.id, date), `Copied to ${prettyDate(date)} as a draft.`); }} />
        </Dialog>
      )}

      {confirmDelete && (
        <Dialog title={`Delete this ${sitting.toLowerCase()} plan?`} subtitle={confirmDelete.title} onClose={() => setConfirmDelete(null)}>
          <div className="space-y-4 px-6 py-5">
            <p className="text-[15px] text-ink">This cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmDelete(null)} className={buttonClass}>Cancel</button>
              <button type="button" disabled={pending} onClick={() => { const l = confirmDelete; setConfirmDelete(null); run(() => removeLesson(l.id), `“${l.title}” was deleted.`); }} className="rounded-lg bg-danger px-4 py-2 text-[15px] font-semibold text-white hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger">Delete</button>
            </div>
          </div>
        </Dialog>
      )}

      {printing && (
        <PrintSheet branding={branding} title={terms.tertiary ? "Course outline" : "Lesson plans"} lines={[`${shown.length} ${sitting.toLowerCase()} plans`]} onClose={() => setPrinting(false)}>
          <PrintTable columns={columns} rows={table} />
        </PrintSheet>
      )}
    </div>
  );
}

function ReflectionForm({ initial, onCancel, onSave }: { initial: string; onCancel: () => void; onSave: (text: string) => void }) {
  const [text, setText] = useState(initial);
  return (
    <form className="space-y-4 px-6 py-5" onSubmit={(e) => { e.preventDefault(); onSave(text.trim()); }}>
      <div>
        <label htmlFor="reflection" className="mb-1 block text-sm font-medium text-ink">Reflection (optional)</label>
        <textarea id="reflection" rows={4} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} className={`${inputClass} h-auto py-2`} />
        <p className="mt-1 text-sm text-muted">What went well, and what would you change?</p>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className={buttonClass}>Cancel</button>
        <button type="submit" className={primaryClass}>Mark taught</button>
      </div>
    </form>
  );
}

function CopyForm({ initial, onCancel, onSave }: { initial: string; onCancel: () => void; onSave: (date: string) => void }) {
  const [date, setDate] = useState(addDays(initial, 7));
  return (
    <form className="space-y-4 px-6 py-5" onSubmit={(e) => { e.preventDefault(); if (date) onSave(date); }}>
      <Field label="New date" required>{(p) => <input {...p} type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />}</Field>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className={buttonClass}>Cancel</button>
        <button type="submit" disabled={!date} className={primaryClass}>Copy</button>
      </div>
    </form>
  );
}

function LessonForm({ existing, classes, terms, today, onClose, onSaved }: { existing: LessonRow | null; classes: TeachingClass[]; terms: TeacherTerms; today: string; onClose: () => void; onSaved: (text: string) => void }) {
  const sitting = terms.sitting;
  const [v, setV] = useState({
    classId: existing?.classId ?? classes[0]?.id ?? "",
    title: existing?.title ?? "",
    date: existing?.date ?? today,
    startTime: existing?.startTime ?? "",
    objectives: existing?.objectives ?? "",
    activities: existing?.activities ?? "",
    homework: existing?.homework ?? "",
    notes: existing?.notes ?? "",
  });
  const [links, setLinks] = useState<ResourceLink[]>(existing?.links ?? []);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [pending, start] = useTransition();
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV((p) => ({ ...p, [k]: e.target.value }));
  const area = (k: "objectives" | "activities" | "homework" | "notes", label: string, help?: string) => (
    <Field label={label} help={help} error={errors[k]}>{(p) => <textarea {...p} rows={3} maxLength={2000} value={v[k]} onChange={set(k)} className={`${inputClass} h-auto py-2`} />}</Field>
  );

  return (
    <Dialog title={existing ? `Edit ${sitting.toLowerCase()} plan` : `New ${sitting.toLowerCase()} plan`} subtitle={existing ? STATUS_LABEL[existing.status] : "Saved as a draft"} onClose={onClose} wide>
      <form
        noValidate
        className="space-y-4 px-6 py-5"
        onSubmit={(e) => {
          e.preventDefault();
          setErrors({});
          setFormError("");
          start(async () => {
            const r = await saveLesson(existing?.id ?? null, { ...v, links });
            if (r.ok) onSaved(existing ? "Plan updated." : "Draft saved.");
            else {
              setErrors(r.fields ?? {});
              setFormError(r.fields ? "" : r.error);
            }
          });
        }}
      >
        {formError && <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{formError}</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={terms.group} required error={errors.classId}>{(p) => <select {...p} value={v.classId} onChange={set("classId")} className={inputClass}>{classes.map((c) => <option key={c.id} value={c.id}>{c.name} – {c.subject}</option>)}</select>}</Field>
          <Field label="Topic" required error={errors.title}>{(p) => <input {...p} value={v.title} maxLength={120} onChange={set("title")} className={inputClass} />}</Field>
          <Field label="Date" required error={errors.date}>{(p) => <input {...p} type="date" value={v.date} onChange={set("date")} className={inputClass} />}</Field>
          <Field label="Start time" error={errors.startTime}>{(p) => <input {...p} type="time" value={v.startTime} onChange={set("startTime")} className={inputClass} />}</Field>
        </div>
        {area("objectives", terms.tertiary ? "Learning outcomes" : "Objectives", "Needed before the plan can be marked ready.")}
        {area("activities", "Activities", "Needed before the plan can be marked ready.")}
        {area("homework", terms.tertiary ? "Reading or task for next time" : "Homework")}
        {area("notes", "Private notes")}

        <fieldset>
          <legend className="mb-1 text-sm font-medium text-ink">Links</legend>
          <p className="mb-2 text-sm text-muted">Readings, videos or documents on the web. Files cannot be uploaded.</p>
          <ul className="space-y-2">
            {links.map((l, i) => (
              <li key={i} className="grid grid-cols-[1fr_1.5fr_auto] gap-2">
                <input aria-label={`Link ${i + 1} name`} placeholder="Name" value={l.label} maxLength={80} onChange={(e) => setLinks(links.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} className={inputClass} />
                <input aria-label={`Link ${i + 1} address`} placeholder="https://" inputMode="url" value={l.url} onChange={(e) => setLinks(links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} className={inputClass} />
                <button type="button" aria-label={`Remove link ${i + 1}`} onClick={() => setLinks(links.filter((_, j) => j !== i))} className="rounded-lg p-2 text-muted hover:bg-canvas hover:text-ink"><Trash2 size={16} aria-hidden /></button>
              </li>
            ))}
          </ul>
          {errors.links && <p className="mt-1 text-sm text-danger">{errors.links}</p>}
          {links.length < 8 && <button type="button" onClick={() => setLinks([...links, { label: "", url: "" }])} className={`${buttonClass} mt-2`}><Plus size={16} aria-hidden /> Add link</button>}
        </fieldset>

        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <button type="button" onClick={onClose} className={buttonClass}>Cancel</button>
          <button type="submit" disabled={pending} className={primaryClass}>{existing ? "Save changes" : "Save draft"}</button>
        </div>
      </form>
    </Dialog>
  );
}
