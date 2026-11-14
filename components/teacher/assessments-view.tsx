"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Search, Trash2 } from "lucide-react";
import { PrintSheet, PrintTable } from "@/components/platform/print-sheet";
import { changeAssessmentStatus, removeAssessment, saveAssessment, saveResults } from "@/server/actions/teacher";
import { cn } from "@/lib/format";
import { gradeOf, percent, round1 } from "@/lib/teacher/grading";
import type { PrintBranding } from "@/lib/print";
import { prettyDate } from "@/lib/teacher/dates";
import type { TeacherTerms } from "@/lib/teacher/terms";
import { csvFilename } from "@/lib/table-tools";
import { ASSESSMENT_KINDS, type AssessmentDetail, type AssessmentRow, type AssessmentStatus, type GradeBand, type ResultKind, type TeachingClass } from "@/types/teacher";
import { Card, Chip, Dialog, ExportBar, Field, Stat, buttonClass, downloadCsv, inputClass, primaryClass, useToday } from "./shared";

const STATUS_TONE = { scheduled: "info", marking: "warn", published: "good" } as const;
const STATUS_LABEL: Record<AssessmentStatus, string> = { scheduled: "Scheduled", marking: "Marking", published: "Published" };
const RESULT_LABEL: Record<ResultKind, string> = { marked: "Marked", pending: "Not marked", absent: "Absent", excused: "Excused" };

export function AssessmentsView({ rows, details, classes, bands, passMark, terms, branding }: { rows: AssessmentRow[]; details: AssessmentDetail[]; classes: TeachingClass[]; bands: GradeBand[]; passMark: number; terms: TeacherTerms; branding: PrintBranding }) {
  const today = useToday(branding.timezone);
  const [query, setQuery] = useState("");
  const [fClass, setFClass] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [editing, setEditing] = useState<AssessmentRow | "new" | null>(null);
  const [marking, setMarking] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AssessmentRow | null>(null);
  const [printing, setPrinting] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [pending, start] = useTransition();

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((a) => (!fClass || a.classId === fClass) && (!fStatus || a.status === fStatus) && (!q || `${a.title} ${a.className} ${a.kind}`.toLowerCase().includes(q)));
  }, [rows, query, fClass, fStatus]);

  const columns = ["Title", terms.group, "Type", "Date", "Marks", "Weight", "Status", "Marked", "Average", "Pass rate"];
  const table = shown.map((a) => [a.title, a.className, a.kind, prettyDate(a.date), String(a.maxMarks), `${a.weight}%`, STATUS_LABEL[a.status], `${a.marked}/${a.total}`, a.average === null ? "—" : String(a.average), a.passRate === null ? "—" : `${a.passRate}%`]);

  const run = (job: () => Promise<{ ok: boolean; error?: string }>, done: string) =>
    start(async () => {
      const r = await job();
      setMessage(r.ok ? { text: done, error: false } : { text: r.error ?? "Something went wrong.", error: true });
    });

  const open = details.find((d) => d.id === marking);
  const toMark = rows.reduce((n, a) => n + a.toMark, 0);

  return (
    <div className="mt-6 space-y-6">
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Assessments" value={String(rows.length)} />
        <Stat label="Scheduled" value={String(rows.filter((a) => a.status === "scheduled").length)} />
        <Stat label="Being marked" value={String(rows.filter((a) => a.status === "marking").length)} />
        <Stat label="To mark" value={String(toMark)} note={`${terms.members} without a mark`} />
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-56">
              <Search size={16} aria-hidden className="pointer-events-none absolute left-3 top-3 text-muted" />
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search assessments" aria-label="Search assessments" className={`${inputClass} pl-9`} />
            </div>
            <select aria-label={`Filter by ${terms.group.toLowerCase()}`} value={fClass} onChange={(e) => setFClass(e.target.value)} className={`${inputClass} w-auto`}>
              <option value="">All {terms.groups.toLowerCase()}</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select aria-label="Filter by status" value={fStatus} onChange={(e) => setFStatus(e.target.value)} className={`${inputClass} w-auto`}>
              <option value="">Any status</option>
              {(Object.keys(STATUS_LABEL) as AssessmentStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <ExportBar onCsv={() => downloadCsv(csvFilename("assessments", today || "export"), [columns, ...table])} onPrint={() => setPrinting(true)} disabled={shown.length === 0} />
            <button type="button" onClick={() => setEditing("new")} className={primaryClass}><Plus size={16} aria-hidden /> New assessment</button>
          </div>
        </div>

        {message && <p role={message.error ? "alert" : "status"} className={cn("mt-4 rounded-lg px-3 py-2 text-sm", message.error ? "bg-danger-soft text-danger" : "bg-positive-soft text-positive")}>{message.text}</p>}

        <div className="mt-4 overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[60rem] text-left text-[15px]">
            <caption className="sr-only">Assessments</caption>
            <thead className="bg-canvas text-sm text-muted">
              <tr>{[...columns, "Actions"].map((c) => <th key={c} scope="col" className="px-3 py-2 font-medium">{c}</th>)}</tr>
            </thead>
            <tbody>
              {shown.map((a, i) => (
                <tr key={a.id} className="border-t border-line align-top">
                  <td className="px-3 py-2 font-medium text-ink">{a.title}</td>
                  <td className="px-3 py-2">{a.className}</td>
                  <td className="px-3 py-2">{a.kind}</td>
                  <td className="px-3 py-2">{table[i][3]}</td>
                  <td className="px-3 py-2">{a.maxMarks}</td>
                  <td className="px-3 py-2">{a.weight}%</td>
                  <td className="px-3 py-2"><Chip tone={STATUS_TONE[a.status]}>{STATUS_LABEL[a.status]}</Chip></td>
                  <td className="px-3 py-2">{table[i][7]}</td>
                  <td className="px-3 py-2">{table[i][8]}</td>
                  <td className="px-3 py-2">{table[i][9]}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
                      {a.status !== "scheduled" && <button type="button" className="text-brand hover:underline" onClick={() => setMarking(a.id)}>Marks</button>}
                      <button type="button" className="text-brand hover:underline" onClick={() => setEditing(a)}>Edit</button>
                      {a.status === "scheduled" && <button type="button" disabled={pending} className="text-brand hover:underline" onClick={() => run(() => changeAssessmentStatus(a.id, "marking"), `“${a.title}” is open for marking.`)}>Open for marking</button>}
                      {a.status === "marking" && <button type="button" disabled={pending} className="text-brand hover:underline" onClick={() => run(() => changeAssessmentStatus(a.id, "published"), `Results for “${a.title}” are published.`)}>Publish results</button>}
                      {a.status === "published" && <button type="button" disabled={pending} className="text-brand hover:underline" onClick={() => run(() => changeAssessmentStatus(a.id, "marking"), `“${a.title}” is open for changes.`)}>Reopen</button>}
                      <button type="button" aria-label={`Delete ${a.title}`} className="text-danger hover:underline" onClick={() => setConfirmDelete(a)}><Trash2 size={14} aria-hidden className="inline" /> Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {shown.length === 0 && <tr><td colSpan={columns.length + 1} className="px-3 py-6 text-center text-muted">{rows.length === 0 ? "No assessments yet. Schedule your first one." : "No assessments match."}</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      {editing && <AssessmentForm key={editing === "new" ? "new" : editing.id} existing={editing === "new" ? null : editing} classes={classes} terms={terms} today={today} onClose={() => setEditing(null)} onSaved={(text) => { setEditing(null); setMessage({ text, error: false }); }} />}
      {open && <ResultsDialog key={open.id} detail={open} bands={bands} passMark={passMark} terms={terms} branding={branding} today={today} onClose={() => setMarking(null)} />}

      {confirmDelete && (
        <Dialog title="Delete this assessment?" subtitle={confirmDelete.title} onClose={() => setConfirmDelete(null)}>
          <div className="space-y-4 px-6 py-5">
            <p className="text-[15px] text-ink">This cannot be undone. An assessment that already has marks cannot be deleted.</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmDelete(null)} className={buttonClass}>Cancel</button>
              <button type="button" disabled={pending} onClick={() => { const a = confirmDelete; setConfirmDelete(null); run(() => removeAssessment(a.id), `“${a.title}” was deleted.`); }} className="rounded-lg bg-danger px-4 py-2 text-[15px] font-semibold text-white hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger">Delete</button>
            </div>
          </div>
        </Dialog>
      )}

      {printing && (
        <PrintSheet branding={branding} title="Assessments" lines={[`${shown.length} assessments`]} onClose={() => setPrinting(false)}>
          <PrintTable columns={columns} rows={table} />
        </PrintSheet>
      )}
    </div>
  );
}

function AssessmentForm({ existing, classes, terms, today, onClose, onSaved }: { existing: AssessmentRow | null; classes: TeachingClass[]; terms: TeacherTerms; today: string; onClose: () => void; onSaved: (text: string) => void }) {
  const [v, setV] = useState({
    classId: existing?.classId ?? classes[0]?.id ?? "",
    title: existing?.title ?? "",
    kind: existing?.kind ?? "Test",
    date: existing?.date ?? today,
    maxMarks: String(existing?.maxMarks ?? 50),
    weight: String(existing?.weight ?? 30),
    notes: existing?.notes ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [pending, start] = useTransition();
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV((p) => ({ ...p, [k]: e.target.value }));
  const marked = existing !== null && existing.status !== "scheduled";

  return (
    <Dialog title={existing ? "Edit assessment" : "New assessment"} subtitle={existing ? STATUS_LABEL[existing.status] : "Scheduled until you open it for marking"} onClose={onClose}>
      <form
        noValidate
        className="space-y-4 px-6 py-5"
        onSubmit={(e) => {
          e.preventDefault();
          setErrors({});
          setFormError("");
          start(async () => {
            const r = await saveAssessment(existing?.id ?? null, v);
            if (r.ok) onSaved(existing ? "Assessment updated." : "Assessment scheduled.");
            else {
              setErrors(r.fields ?? {});
              setFormError(r.fields ? "" : r.error);
            }
          });
        }}
      >
        {formError && <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{formError}</p>}
        <Field label={terms.group} required error={errors.classId} help={marked ? "The class cannot change once marking has started." : undefined}>
          {(p) => <select {...p} value={v.classId} disabled={marked} onChange={set("classId")} className={inputClass}>{classes.map((c) => <option key={c.id} value={c.id}>{c.name} – {c.subject}</option>)}</select>}
        </Field>
        <Field label="Title" required error={errors.title}>{(p) => <input {...p} value={v.title} maxLength={120} onChange={set("title")} className={inputClass} />}</Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Type" required error={errors.kind}>{(p) => <select {...p} value={v.kind} onChange={set("kind")} className={inputClass}>{ASSESSMENT_KINDS.map((k) => <option key={k}>{k}</option>)}</select>}</Field>
          <Field label="Date" required error={errors.date}>{(p) => <input {...p} type="date" value={v.date} onChange={set("date")} className={inputClass} />}</Field>
          <Field label="Total marks" required error={errors.maxMarks}>{(p) => <input {...p} inputMode="decimal" value={v.maxMarks} onChange={set("maxMarks")} className={inputClass} />}</Field>
          <Field label="Weight (%)" required error={errors.weight} help="How much it counts against your other assessments.">{(p) => <input {...p} inputMode="numeric" value={v.weight} onChange={set("weight")} className={inputClass} />}</Field>
        </div>
        <Field label="Private notes" error={errors.notes}>{(p) => <textarea {...p} rows={2} maxLength={2000} value={v.notes} onChange={set("notes")} className={`${inputClass} h-auto py-2`} />}</Field>
        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <button type="button" onClick={onClose} className={buttonClass}>Cancel</button>
          <button type="submit" disabled={pending} className={primaryClass}>{existing ? "Save changes" : "Schedule"}</button>
        </div>
      </form>
    </Dialog>
  );
}

type Row = { kind: ResultKind; mark: string; comment: string };

function ResultsDialog({ detail, bands, passMark, terms, branding, today, onClose }: { detail: AssessmentDetail; bands: GradeBand[]; passMark: number; terms: TeacherTerms; branding: PrintBranding; today: string; onClose: () => void }) {
  const initial = useMemo(() => Object.fromEntries(detail.entries.map((e) => [e.learner.id, { kind: e.result.kind, mark: e.result.mark === null ? "" : String(e.result.mark), comment: e.result.comment } satisfies Row])), [detail]);
  const [rows, setRows] = useState<Record<string, Row>>(initial);
  const [query, setQuery] = useState("");
  const [printing, setPrinting] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [pending, start] = useTransition();

  const set = (id: string, patch: Partial<Row>) => {
    setMessage(null);
    setRows((p) => {
      const next = { ...p[id], ...patch };
      // Typing a mark means the person sat it; choosing absent or excused clears the mark.
      if (patch.mark !== undefined && patch.mark !== "" && (next.kind === "pending" || next.kind === "absent" || next.kind === "excused")) next.kind = "marked";
      if (patch.kind && (patch.kind === "absent" || patch.kind === "excused")) next.mark = "";
      return { ...p, [id]: next };
    });
  };
  const markError = (r: Row) => {
    if (r.mark === "") return "";
    const n = Number(r.mark);
    return !Number.isFinite(n) || n < 0 || n > detail.maxMarks ? `0 to ${detail.maxMarks}` : "";
  };
  const invalid = Object.values(rows).some((r) => markError(r));
  const dirty = JSON.stringify(rows) !== JSON.stringify(initial);

  const marks = Object.values(rows).filter((r) => r.mark !== "" && !markError(r)).map((r) => Number(r.mark));
  const avg = marks.length ? marks.reduce((a, b) => a + b, 0) / marks.length : null;
  const passed = marks.filter((m) => percent(m, detail.maxMarks) >= passMark).length;
  const spread = bands.map((b) => ({ grade: b.grade, count: marks.filter((m) => gradeOf(percent(m, detail.maxMarks), bands).grade === b.grade).length }));
  const shown = detail.entries.filter((e) => !query.trim() || `${e.learner.name} ${e.learner.number}`.toLowerCase().includes(query.trim().toLowerCase()));

  const columns = [terms.member, "Number", "Result", `Mark /${detail.maxMarks}`, "%", "Grade", "Comment"];
  const table = detail.entries.map((e) => {
    const r = rows[e.learner.id];
    const pct = r.mark === "" || markError(r) ? null : percent(Number(r.mark), detail.maxMarks);
    return [e.learner.name, e.learner.number, RESULT_LABEL[r.kind], r.mark, pct === null ? "" : `${pct}%`, pct === null ? "" : gradeOf(pct, bands).grade, r.comment];
  });

  return (
    <Dialog title={detail.title} subtitle={`${detail.className} · ${detail.kind} · ${prettyDate(detail.date)} · out of ${detail.maxMarks} · ${STATUS_LABEL[detail.status]}`} onClose={onClose} wide>
      <div className="space-y-4 px-6 py-5">
        <div className="grid gap-3 sm:grid-cols-4">
          <Stat label="Marked" value={`${marks.length}/${detail.total}`} />
          <Stat label="Average" value={avg === null ? "—" : String(round1(avg))} note={avg === null ? undefined : `${Math.round(percent(avg, detail.maxMarks))}%`} />
          <Stat label="Highest / lowest" value={marks.length ? `${Math.max(...marks)} / ${Math.min(...marks)}` : "—"} />
          <Stat label="Pass rate" value={marks.length ? `${Math.round((passed / marks.length) * 100)}%` : "—"} note={`Pass is ${passMark}% or more`} />
        </div>

        {marks.length > 0 && (
          <ul aria-label="Grade spread" className="flex flex-wrap gap-2">
            {spread.map((s) => <li key={s.grade}><Chip tone={s.count ? "info" : "info"}>{s.grade}: {s.count}</Chip></li>)}
          </ul>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative min-w-56 flex-1 sm:max-w-xs">
            <Search size={16} aria-hidden className="pointer-events-none absolute left-3 top-3 text-muted" />
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${terms.members.toLowerCase()}`} aria-label={`Search ${terms.members.toLowerCase()}`} className={`${inputClass} pl-9`} />
          </div>
          <ExportBar onCsv={() => downloadCsv(csvFilename(`${detail.title} results`, today || "export"), [columns, ...table])} onPrint={() => setPrinting(true)} />
        </div>

        {detail.status === "published" && <p className="rounded-lg bg-canvas px-3 py-2 text-sm text-muted">Results are published. Saving a change reopens the assessment so you can check it before publishing again.</p>}
        {message && <p role={message.error ? "alert" : "status"} className={cn("rounded-lg px-3 py-2 text-sm", message.error ? "bg-danger-soft text-danger" : "bg-positive-soft text-positive")}>{message.text}</p>}

        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[48rem] text-left text-[15px]">
            <caption className="sr-only">Results for {detail.title}</caption>
            <thead className="bg-canvas text-sm text-muted">
              <tr>{[terms.member, "Result", `Mark /${detail.maxMarks}`, "Grade", "Comment"].map((c) => <th key={c} scope="col" className="px-3 py-2 font-medium">{c}</th>)}</tr>
            </thead>
            <tbody>
              {shown.map((e) => {
                const r = rows[e.learner.id];
                const err = markError(r);
                const pct = r.mark === "" || err ? null : percent(Number(r.mark), detail.maxMarks);
                return (
                  <tr key={e.learner.id} className="border-t border-line align-top">
                    <td className="px-3 py-2"><p className="font-medium text-ink">{e.learner.name}</p><p className="text-sm text-muted">{e.learner.number}</p></td>
                    <td className="px-3 py-2">
                      <select aria-label={`Result for ${e.learner.name}`} value={r.kind === "marked" ? "marked" : r.kind} onChange={(ev) => set(e.learner.id, { kind: ev.target.value as ResultKind })} className={`${inputClass} w-auto min-w-36`}>
                        {(Object.keys(RESULT_LABEL) as ResultKind[]).map((k) => <option key={k} value={k}>{RESULT_LABEL[k]}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input aria-label={`Mark for ${e.learner.name}`} aria-invalid={Boolean(err)} inputMode="decimal" disabled={r.kind === "absent" || r.kind === "excused"} value={r.mark} onChange={(ev) => set(e.learner.id, { mark: ev.target.value.trim() })} className={cn(inputClass, "w-24", err && "border-danger")} />
                      {err && <p className="mt-1 text-sm text-danger">{err}</p>}
                    </td>
                    <td className="px-3 py-2">{pct === null ? "—" : <Chip tone={pct >= passMark ? "good" : "bad"}>{gradeOf(pct, bands).grade} · {pct}%</Chip>}</td>
                    <td className="px-3 py-2"><input aria-label={`Comment for ${e.learner.name}`} maxLength={500} value={r.comment} onChange={(ev) => set(e.learner.id, { comment: ev.target.value })} className={inputClass} /></td>
                  </tr>
                );
              })}
              {shown.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-muted">No {terms.members.toLowerCase()} match.</td></tr>}
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
                  return { learnerId: e.learner.id, kind: r.kind, mark: r.mark === "" ? null : Number(r.mark), comment: r.comment };
                });
                const res = await saveResults(detail.id, entries);
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
        <PrintSheet branding={branding} title={`${detail.title} – results`} lines={[`${detail.className} · ${detail.kind} · ${prettyDate(detail.date)}`, `Out of ${detail.maxMarks}`]} onClose={() => setPrinting(false)}>
          <PrintTable columns={columns} rows={table} />
        </PrintSheet>
      )}
    </Dialog>
  );
}
