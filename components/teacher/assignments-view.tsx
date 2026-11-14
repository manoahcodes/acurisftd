"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Search, Trash2 } from "lucide-react";
import { PrintSheet, PrintTable } from "@/components/platform/print-sheet";
import { changeAssignmentStatus, removeAssignment, saveAssignment, saveMarks } from "@/server/actions/teacher";
import { cn } from "@/lib/format";
import type { PrintBranding } from "@/lib/print";
import { addDays, prettyDate } from "@/lib/teacher/dates";
import type { TeacherTerms } from "@/lib/teacher/terms";
import { csvFilename } from "@/lib/table-tools";
import { ASSIGNMENT_KINDS, type AssignmentDetail, type AssignmentRow, type AssignmentStatus, type ResourceLink, type SubmissionStatus, type TeachingClass } from "@/types/teacher";
import { Card, Chip, Dialog, ExportBar, Field, Stat, buttonClass, downloadCsv, inputClass, primaryClass, useToday } from "./shared";

const STATUS_TONE = { draft: "info", published: "good", closed: "warn" } as const;
const STATUS_LABEL: Record<AssignmentStatus, string> = { draft: "Draft", published: "Published", closed: "Closed" };
const SUB_LABEL: Record<SubmissionStatus, string> = { pending: "Not handed in", submitted: "Handed in", late: "Handed in late", missing: "Missing" };

export function AssignmentsView({ rows, details, classes, terms, branding }: { rows: AssignmentRow[]; details: AssignmentDetail[]; classes: TeachingClass[]; terms: TeacherTerms; branding: PrintBranding }) {
  const today = useToday(branding.timezone);
  const [query, setQuery] = useState("");
  const [fClass, setFClass] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [editing, setEditing] = useState<AssignmentRow | "new" | null>(null);
  const [marking, setMarking] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AssignmentRow | null>(null);
  const [printing, setPrinting] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [pending, start] = useTransition();

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((a) => (!fClass || a.classId === fClass) && (!fStatus || a.status === fStatus) && (!q || `${a.title} ${a.className} ${a.kind}`.toLowerCase().includes(q)));
  }, [rows, query, fClass, fStatus]);

  const columns = ["Title", terms.group, "Type", "Due", "Marks", "Status", "Handed in", "To mark"];
  const table = shown.map((a) => [a.title, a.className, a.kind, prettyDate(a.dueDate), String(a.maxMarks), STATUS_LABEL[a.status], `${a.submitted}/${a.total}`, String(a.toMark)]);

  const run = (job: () => Promise<{ ok: boolean; error?: string }>, done: string) =>
    start(async () => {
      const r = await job();
      setMessage(r.ok ? { text: done, error: false } : { text: r.error ?? "Something went wrong.", error: true });
    });

  const open = details.find((d) => d.id === marking);
  const overdue = (a: AssignmentRow) => a.status === "published" && Boolean(today) && a.dueDate < today;

  return (
    <div className="mt-6 space-y-6">
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Assignments" value={String(rows.length)} />
        <Stat label="Published" value={String(rows.filter((a) => a.status === "published").length)} />
        <Stat label="Drafts" value={String(rows.filter((a) => a.status === "draft").length)} />
        <Stat label="To mark" value={String(rows.reduce((n, a) => n + a.toMark, 0))} note="Handed in, no mark yet" />
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-56">
              <Search size={16} aria-hidden className="pointer-events-none absolute left-3 top-3 text-muted" />
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search assignments" aria-label="Search assignments" className={`${inputClass} pl-9`} />
            </div>
            <select aria-label={`Filter by ${terms.group.toLowerCase()}`} value={fClass} onChange={(e) => setFClass(e.target.value)} className={`${inputClass} w-auto!`}>
              <option value="">All {terms.groups.toLowerCase()}</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select aria-label="Filter by status" value={fStatus} onChange={(e) => setFStatus(e.target.value)} className={`${inputClass} w-auto!`}>
              <option value="">Any status</option>
              {(Object.keys(STATUS_LABEL) as AssignmentStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <ExportBar onCsv={() => downloadCsv(csvFilename("assignments", today || "export"), [columns, ...table])} onPrint={() => setPrinting(true)} disabled={shown.length === 0} />
            <button type="button" onClick={() => setEditing("new")} className={primaryClass}><Plus size={16} aria-hidden /> New assignment</button>
          </div>
        </div>

        {message && <p role={message.error ? "alert" : "status"} className={cn("mt-4 rounded-lg px-3 py-2 text-sm", message.error ? "bg-danger-soft text-danger" : "bg-positive-soft text-positive")}>{message.text}</p>}

        <div className="mt-4 overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[56rem] text-left text-[15px]">
            <caption className="sr-only">Assignments</caption>
            <thead className="bg-canvas text-sm text-muted">
              <tr>{[...columns, "Actions"].map((c) => <th key={c} scope="col" className="px-3 py-2 font-medium">{c}</th>)}</tr>
            </thead>
            <tbody>
              {shown.map((a, i) => (
                <tr key={a.id} className="border-t border-line align-top">
                  <td className="px-3 py-2 font-medium text-ink">{a.title}</td>
                  <td className="px-3 py-2">{a.className}</td>
                  <td className="px-3 py-2">{a.kind}</td>
                  <td className="px-3 py-2">{table[i][3]}{overdue(a) && <span className="ml-2 text-sm text-danger">Overdue</span>}</td>
                  <td className="px-3 py-2">{a.maxMarks}</td>
                  <td className="px-3 py-2"><Chip tone={STATUS_TONE[a.status]}>{STATUS_LABEL[a.status]}</Chip></td>
                  <td className="px-3 py-2">{a.submitted}/{a.total}</td>
                  <td className="px-3 py-2">{a.toMark}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
                      {a.status !== "draft" && <button type="button" className="text-brand hover:underline" onClick={() => setMarking(a.id)}>Marks</button>}
                      <button type="button" className="text-brand hover:underline" onClick={() => setEditing(a)}>Edit</button>
                      {a.status === "draft" && <button type="button" disabled={pending} className="text-brand hover:underline" onClick={() => run(() => changeAssignmentStatus(a.id, "published"), `“${a.title}” is published.`)}>Publish</button>}
                      {a.status === "published" && <button type="button" disabled={pending} className="text-brand hover:underline" onClick={() => run(() => changeAssignmentStatus(a.id, "closed"), `“${a.title}” is closed.`)}>Close</button>}
                      {a.status === "closed" && <button type="button" disabled={pending} className="text-brand hover:underline" onClick={() => run(() => changeAssignmentStatus(a.id, "published"), `“${a.title}” is open again.`)}>Reopen</button>}
                      <button type="button" aria-label={`Delete ${a.title}`} className="text-danger hover:underline" onClick={() => setConfirmDelete(a)}><Trash2 size={14} aria-hidden className="inline" /> Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {shown.length === 0 && <tr><td colSpan={columns.length + 1} className="px-3 py-6 text-center text-muted">{rows.length === 0 ? "No assignments yet. Create your first one." : "No assignments match."}</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      {editing && <AssignmentForm key={editing === "new" ? "new" : editing.id} existing={editing === "new" ? null : editing} classes={classes} terms={terms} today={today} onClose={() => setEditing(null)} onSaved={(text) => { setEditing(null); setMessage({ text, error: false }); }} />}
      {open && <MarksDialog key={open.id} detail={open} terms={terms} branding={branding} today={today} onClose={() => setMarking(null)} />}

      {confirmDelete && (
        <Dialog title="Delete this assignment?" subtitle={confirmDelete.title} onClose={() => setConfirmDelete(null)}>
          <div className="space-y-4 px-6 py-5">
            <p className="text-[15px] text-ink">This cannot be undone. An assignment that already has work handed in cannot be deleted; close it instead.</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmDelete(null)} className={buttonClass}>Cancel</button>
              <button type="button" disabled={pending} onClick={() => { const a = confirmDelete; setConfirmDelete(null); run(() => removeAssignment(a.id), `“${a.title}” was deleted.`); }} className="rounded-lg bg-danger px-4 py-2 text-[15px] font-semibold text-white hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger">Delete</button>
            </div>
          </div>
        </Dialog>
      )}

      {printing && (
        <PrintSheet branding={branding} title="Assignments" lines={[`${shown.length} assignments`]} onClose={() => setPrinting(false)}>
          <PrintTable columns={columns} rows={table} />
        </PrintSheet>
      )}
    </div>
  );
}

function AssignmentForm({ existing, classes, terms, today, onClose, onSaved }: { existing: AssignmentRow | null; classes: TeachingClass[]; terms: TeacherTerms; today: string; onClose: () => void; onSaved: (text: string) => void }) {
  const [v, setV] = useState({
    classId: existing?.classId ?? classes[0]?.id ?? "",
    title: existing?.title ?? "",
    kind: existing?.kind ?? "Homework",
    dueDate: existing?.dueDate ?? (today ? addDays(today, 7) : ""),
    maxMarks: String(existing?.maxMarks ?? 20),
    instructions: existing?.instructions ?? "",
    notes: existing?.notes ?? "",
  });
  const [links, setLinks] = useState<ResourceLink[]>(existing?.links ?? []);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [pending, start] = useTransition();
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV((p) => ({ ...p, [k]: e.target.value }));
  const locked = existing !== null && existing.status !== "draft";

  return (
    <Dialog title={existing ? "Edit assignment" : "New assignment"} subtitle={existing ? STATUS_LABEL[existing.status] : "Saved as a draft until you publish it"} onClose={onClose}>
      <form
        noValidate
        className="space-y-4 px-6 py-5"
        onSubmit={(e) => {
          e.preventDefault();
          setErrors({});
          setFormError("");
          start(async () => {
            const r = await saveAssignment(existing?.id ?? null, { ...v, links });
            if (r.ok) onSaved(existing ? "Assignment updated." : "Draft created. Publish it when it is ready.");
            else {
              setErrors(r.fields ?? {});
              setFormError(r.fields ? "" : r.error);
            }
          });
        }}
      >
        {formError && <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{formError}</p>}
        <Field label={terms.group} required error={errors.classId} help={locked ? "The class cannot change once it is published." : undefined}>
          {(p) => <select {...p} value={v.classId} disabled={locked} onChange={set("classId")} className={inputClass}>{classes.map((c) => <option key={c.id} value={c.id}>{c.name} – {c.subject}</option>)}</select>}
        </Field>
        <Field label="Title" required error={errors.title}>{(p) => <input {...p} value={v.title} maxLength={120} onChange={set("title")} className={inputClass} />}</Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Type" required error={errors.kind}>{(p) => <select {...p} value={v.kind} onChange={set("kind")} className={inputClass}>{ASSIGNMENT_KINDS.map((k) => <option key={k}>{k}</option>)}</select>}</Field>
          <Field label="Due date" required error={errors.dueDate}>{(p) => <input {...p} type="date" value={v.dueDate} onChange={set("dueDate")} className={inputClass} />}</Field>
          <Field label="Total marks" required error={errors.maxMarks}>{(p) => <input {...p} inputMode="decimal" value={v.maxMarks} onChange={set("maxMarks")} className={inputClass} />}</Field>
        </div>
        <Field label="Instructions" error={errors.instructions}>{(p) => <textarea {...p} rows={3} maxLength={2000} value={v.instructions} onChange={set("instructions")} className={`${inputClass} h-auto py-2`} />}</Field>
        <Field label="Private notes" help={`Only you see these (marking guide, reminders).`} error={errors.notes}>{(p) => <textarea {...p} rows={2} maxLength={2000} value={v.notes} onChange={set("notes")} className={`${inputClass} h-auto py-2`} />}</Field>

        <fieldset>
          <legend className="mb-1 text-sm font-medium text-ink">Links</legend>
          <p className="mb-2 text-sm text-muted">Add web links to readings, videos or documents. Files cannot be uploaded.</p>
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
          <button type="submit" disabled={pending} className={primaryClass}>{existing ? "Save changes" : "Create draft"}</button>
        </div>
      </form>
    </Dialog>
  );
}

type Row = { status: SubmissionStatus; mark: string; feedback: string };

function MarksDialog({ detail, terms, branding, today, onClose }: { detail: AssignmentDetail; terms: TeacherTerms; branding: PrintBranding; today: string; onClose: () => void }) {
  const initial = useMemo(() => Object.fromEntries(detail.entries.map((e) => [e.learner.id, { status: e.submission.status, mark: e.submission.mark === null ? "" : String(e.submission.mark), feedback: e.submission.feedback } satisfies Row])), [detail]);
  const [rows, setRows] = useState<Record<string, Row>>(initial);
  const [query, setQuery] = useState("");
  const [printing, setPrinting] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [pending, start] = useTransition();

  const set = (id: string, patch: Partial<Row>) => {
    setMessage(null);
    setRows((p) => ({ ...p, [id]: { ...p[id], ...patch } }));
  };
  const markError = (r: Row) => {
    if (r.mark === "") return "";
    const n = Number(r.mark);
    if (!Number.isFinite(n) || n < 0 || n > detail.maxMarks) return `0 to ${detail.maxMarks}`;
    return r.status === "missing" || r.status === "pending" ? "Not handed in" : "";
  };
  const invalid = Object.values(rows).some((r) => markError(r));
  const dirty = JSON.stringify(rows) !== JSON.stringify(initial);

  const marks = Object.values(rows).filter((r) => r.mark !== "" && !markError(r)).map((r) => Number(r.mark));
  const avg = marks.length ? marks.reduce((a, b) => a + b, 0) / marks.length : null;
  const shown = detail.entries.filter((e) => !query.trim() || `${e.learner.name} ${e.learner.number}`.toLowerCase().includes(query.trim().toLowerCase()));

  const columns = [terms.member, "Number", "Status", `Mark /${detail.maxMarks}`, "%", "Feedback"];
  const table = detail.entries.map((e) => {
    const r = rows[e.learner.id];
    const n = r.mark === "" ? null : Number(r.mark);
    return [e.learner.name, e.learner.number, SUB_LABEL[r.status], r.mark, n === null || !Number.isFinite(n) ? "" : `${Math.round((n / detail.maxMarks) * 100)}%`, r.feedback];
  });

  return (
    <Dialog title={detail.title} subtitle={`${detail.className} · ${detail.kind} · due ${prettyDate(detail.dueDate)} · out of ${detail.maxMarks}`} onClose={onClose} wide>
      <div className="space-y-4 px-6 py-5">
        <div className="grid gap-3 sm:grid-cols-4">
          <Stat label="Handed in" value={`${Object.values(rows).filter((r) => r.status === "submitted" || r.status === "late").length}/${detail.total}`} />
          <Stat label="Marked" value={String(marks.length)} />
          <Stat label="Average" value={avg === null ? "—" : `${Math.round((avg / detail.maxMarks) * 100)}%`} note={avg === null ? undefined : `${Math.round(avg * 10) / 10} / ${detail.maxMarks}`} />
          <Stat label="Highest" value={marks.length ? String(Math.max(...marks)) : "—"} />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative min-w-56 flex-1 sm:max-w-xs">
            <Search size={16} aria-hidden className="pointer-events-none absolute left-3 top-3 text-muted" />
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${terms.members.toLowerCase()}`} aria-label={`Search ${terms.members.toLowerCase()}`} className={`${inputClass} pl-9`} />
          </div>
          <ExportBar onCsv={() => downloadCsv(csvFilename(`${detail.title} marks`, today || "export"), [columns, ...table])} onPrint={() => setPrinting(true)} />
        </div>

        {message && <p role={message.error ? "alert" : "status"} className={cn("rounded-lg px-3 py-2 text-sm", message.error ? "bg-danger-soft text-danger" : "bg-positive-soft text-positive")}>{message.text}</p>}

        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[48rem] text-left text-[15px]">
            <caption className="sr-only">Marks for {detail.title}</caption>
            <thead className="bg-canvas text-sm text-muted">
              <tr>{[terms.member, "Status", `Mark /${detail.maxMarks}`, "Feedback"].map((c) => <th key={c} scope="col" className="px-3 py-2 font-medium">{c}</th>)}</tr>
            </thead>
            <tbody>
              {shown.map((e) => {
                const r = rows[e.learner.id];
                const err = markError(r);
                return (
                  <tr key={e.learner.id} className="border-t border-line align-top">
                    <td className="px-3 py-2"><p className="font-medium text-ink">{e.learner.name}</p><p className="text-sm text-muted">{e.learner.number}</p></td>
                    <td className="px-3 py-2">
                      <select aria-label={`Status for ${e.learner.name}`} value={r.status} onChange={(ev) => set(e.learner.id, { status: ev.target.value as SubmissionStatus })} className={`${inputClass} w-auto!`}>
                        {(Object.keys(SUB_LABEL) as SubmissionStatus[]).map((s) => <option key={s} value={s}>{SUB_LABEL[s]}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input aria-label={`Mark for ${e.learner.name}`} aria-invalid={Boolean(err)} inputMode="decimal" value={r.mark} onChange={(ev) => set(e.learner.id, { mark: ev.target.value.trim() })} className={cn(inputClass, "w-24!", err && "border-danger")} />
                      {err && <p className="mt-1 text-sm text-danger">{err}</p>}
                    </td>
                    <td className="px-3 py-2"><input aria-label={`Feedback for ${e.learner.name}`} maxLength={500} value={r.feedback} onChange={(ev) => set(e.learner.id, { feedback: ev.target.value })} className={inputClass} /></td>
                  </tr>
                );
              })}
              {shown.length === 0 && <tr><td colSpan={4} className="px-3 py-6 text-center text-muted">No {terms.members.toLowerCase()} match.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <button type="button" onClick={onClose} className={buttonClass}>Close</button>
          <button
            type="button"
            disabled={pending || invalid || !dirty}
            onClick={() =>
              start(async () => {
                const entries = detail.entries.map((e) => {
                  const r = rows[e.learner.id];
                  return { learnerId: e.learner.id, mark: r.mark === "" ? null : Number(r.mark), feedback: r.feedback, status: r.status };
                });
                const res = await saveMarks(detail.id, entries);
                setMessage(res.ok ? { text: "Marks saved.", error: false } : { text: res.error, error: true });
              })
            }
            className={primaryClass}
          >
            Save marks
          </button>
        </div>
      </div>

      {printing && (
        <PrintSheet branding={branding} title={`${detail.title} – marks`} lines={[`${detail.className} · ${detail.kind} · due ${prettyDate(detail.dueDate)}`, `Out of ${detail.maxMarks}`]} onClose={() => setPrinting(false)}>
          <PrintTable columns={columns} rows={table} />
        </PrintSheet>
      )}
    </Dialog>
  );
}
