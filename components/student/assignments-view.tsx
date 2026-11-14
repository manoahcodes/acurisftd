"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { Download, ExternalLink, Paperclip, Search, Undo2 } from "lucide-react";
import { DetailsList, PrintSheet, PrintTable } from "@/components/platform/print-sheet";
import { Card, Chip, Dialog, ExportBar, Field, Stat, buttonClass, downloadCsv, inputClass, primaryClass, useToday } from "@/components/teacher/shared";
import { submitAssignment, withdrawAssignment } from "@/server/actions/student";
import { cn, formatStamp } from "@/lib/format";
import type { PrintBranding } from "@/lib/print";
import { csvFilename } from "@/lib/table-tools";
import { prettyDate } from "@/lib/teacher/dates";
import { canSubmit, canWithdraw, dueLabel, percentOf, statusOf } from "@/lib/student/assignments";
import { ACCEPT_ATTRIBUTE, MAX_SUBMISSION_BYTES, formatBytes } from "@/lib/student/files";
import { LIMITS } from "@/lib/student/validate";
import type { StudentTerms } from "@/lib/student/terms";
import type { AssignmentStatus, StudentAssignmentRow } from "@/types/student";

const STATUS: Record<AssignmentStatus, { label: string; tone: "good" | "warn" | "bad" | "info" }> = {
  todo: { label: "To do", tone: "info" },
  overdue: { label: "Overdue", tone: "bad" },
  submitted: { label: "Handed in", tone: "warn" },
  late: { label: "Handed in late", tone: "warn" },
  marked: { label: "Marked", tone: "good" },
};

const TABS = [
  { id: "all", label: "All" },
  { id: "open", label: "To do" },
  { id: "waiting", label: "Handed in" },
  { id: "marked", label: "Marked" },
] as const;
type Tab = (typeof TABS)[number]["id"];

const inTab = (tab: Tab, s: AssignmentStatus) =>
  tab === "all" || (tab === "open" && (s === "todo" || s === "overdue")) || (tab === "waiting" && (s === "submitted" || s === "late")) || (tab === "marked" && s === "marked");

export function AssignmentsView({ rows, terms, branding }: { rows: StudentAssignmentRow[]; terms: StudentTerms; branding: PrintBranding }) {
  const today = useToday(branding.timezone);
  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");
  const [courseName, setCourseName] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  const withStatus = useMemo(() => rows.map((r) => ({ row: r, status: statusOf(r, r.submission, today) })), [rows, today]);
  const courses = useMemo(() => [...new Set(rows.map((r) => r.courseName))].sort(), [rows]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return withStatus
      .filter(({ row, status }) => inTab(tab, status) && (!courseName || row.courseName === courseName) && (!q || `${row.title} ${row.courseName} ${row.kind}`.toLowerCase().includes(q)))
      // Work that still needs doing first (soonest due date), then the rest with the newest first.
      .sort((a, b) => {
        const aOpen = a.status === "todo" || a.status === "overdue";
        const bOpen = b.status === "todo" || b.status === "overdue";
        if (aOpen !== bOpen) return aOpen ? -1 : 1;
        return aOpen ? a.row.dueDate.localeCompare(b.row.dueDate) : b.row.dueDate.localeCompare(a.row.dueDate);
      });
  }, [withStatus, tab, query, courseName]);

  const count = (t: Tab) => withStatus.filter((w) => inTab(t, w.status)).length;
  const markedRows = rows.filter((r) => r.submission?.mark != null);
  const average = markedRows.length ? Math.round((markedRows.reduce((n, r) => n + percentOf(r.submission!.mark!, r.maxMarks), 0) / markedRows.length) * 10) / 10 : null;

  const columns = ["Title", terms.course, "Type", "Due", "Status", "Mark", "Out of"];
  const table = shown.map(({ row, status }) => [row.title, row.courseName, row.kind, prettyDate(row.dueDate), STATUS[status].label, row.submission?.mark != null ? String(row.submission.mark) : "", String(row.maxMarks)]);
  const open = withStatus.find((w) => w.row.id === openId);

  return (
    <div className="mt-6 space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="To do" value={String(count("open"))} note={today ? `${withStatus.filter((w) => w.status === "overdue").length} overdue` : undefined} />
        <Stat label="Handed in" value={String(count("waiting"))} note="Waiting for a mark" />
        <Stat label="Marked" value={String(count("marked"))} />
        <Stat label="Average on marked work" value={average === null ? "—" : `${average}%`} />
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div role="tablist" aria-label="Show" className="inline-flex overflow-hidden rounded-lg border border-line">
              {TABS.map((t) => (
                <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={cn("px-3 py-2 text-[15px] font-medium focus-visible:outline-2 focus-visible:outline-brand", tab === t.id ? "bg-brand text-on-brand" : "text-ink hover:bg-canvas")}>
                  {t.label} <span className="text-sm opacity-80">{count(t.id)}</span>
                </button>
              ))}
            </div>
            <div className="relative min-w-52">
              <Search size={16} aria-hidden className="pointer-events-none absolute left-3 top-3 text-muted" />
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search assignments" aria-label="Search assignments" className={`${inputClass} pl-9`} />
            </div>
            <select aria-label={`Filter by ${terms.course.toLowerCase()}`} value={courseName} onChange={(e) => setCourseName(e.target.value)} className={`${inputClass} w-auto!`}>
              <option value="">All {terms.courses.toLowerCase()}</option>
              {courses.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <ExportBar onCsv={() => downloadCsv(csvFilename("my assignments", today || "export"), [columns, ...table])} onPrint={() => setPrinting(true)} disabled={shown.length === 0} />
        </div>
        {message && <p role={message.error ? "alert" : "status"} className={cn("mt-4 rounded-lg px-3 py-2 text-sm", message.error ? "bg-danger-soft text-danger" : "bg-positive-soft text-positive")}>{message.text}</p>}
      </Card>

      {shown.length === 0 ? (
        <Card><p className="text-[15px] text-muted">{rows.length === 0 ? "No assignments have been set yet." : "Nothing matches."}</p></Card>
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {shown.map(({ row, status }) => (
            <li key={row.id}>
              <Card className="flex h-full flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-[17px] font-semibold text-ink">{row.title}</h2>
                    <p className="text-sm text-muted">{row.courseName} · {row.kind}</p>
                  </div>
                  <Chip tone={STATUS[status].tone}>{STATUS[status].label}</Chip>
                </div>
                <p className="text-[15px] text-muted">
                  {prettyDate(row.dueDate)}
                  {today && (status === "todo" || status === "overdue") ? <> · <strong className={cn("font-semibold", status === "overdue" ? "text-danger" : "text-ink")}>{dueLabel(row.dueDate, today)}</strong></> : null}
                </p>
                {row.submission?.mark != null && (
                  <p className="text-[15px] text-ink"><strong>{row.submission.mark}</strong> out of {row.maxMarks} · {percentOf(row.submission.mark, row.maxMarks)}%</p>
                )}
                <div className="mt-auto pt-1">
                  <button type="button" onClick={() => { setMessage(null); setOpenId(row.id); }} className={status === "todo" || status === "overdue" ? primaryClass : buttonClass}>
                    {status === "todo" || status === "overdue" ? "Open and hand in" : "View"}
                  </button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {open && (
        <DetailDialog
          row={open.row}
          status={open.status}
          today={today}
          timezone={branding.timezone}
          onClose={() => setOpenId(null)}
          onDone={(text) => {
            setMessage({ text, error: false });
            setOpenId(null);
          }}
        />
      )}

      {printing && (
        <PrintSheet branding={branding} title="My assignments" lines={[`${shown.length} shown`, tab === "all" ? "All assignments" : TABS.find((t) => t.id === tab)!.label]} onClose={() => setPrinting(false)}>
          <DetailsList details={[["To do", String(count("open"))], ["Handed in", String(count("waiting"))], ["Marked", String(count("marked"))]]} />
          <div className="mt-6"><PrintTable columns={columns} rows={table} /></div>
        </PrintSheet>
      )}
    </div>
  );
}

function DetailDialog({ row, status, today, timezone, onClose, onDone }: { row: StudentAssignmentRow; status: AssignmentStatus; today: string; timezone: string; onClose: () => void; onDone: (message: string) => void }) {
  const sub = row.submission;
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");

  const allowed = today ? canSubmit(row, sub, today) : ({ ok: true, late: false } as const);
  const resubmitting = Boolean(sub);

  const submit = (form: FormData) => {
    setError(null);
    setFields({});
    const file = form.get("file");
    if (file instanceof File && file.size > MAX_SUBMISSION_BYTES) {
      setFields({ file: `The file must be ${formatBytes(MAX_SUBMISSION_BYTES)} or smaller.` });
      setError("That file is too large.");
      return;
    }
    start(async () => {
      const r = await submitAssignment(form);
      if (r.ok) onDone(resubmitting ? `“${row.title}” was handed in again.` : `“${row.title}” was handed in.`);
      else {
        setError(r.error);
        setFields(r.fields ?? {});
      }
    });
  };

  return (
    <Dialog title={row.title} subtitle={`${row.courseName} · ${row.kind} · ${row.maxMarks} marks`} onClose={onClose}>
      <div className="space-y-5 px-6 py-5">
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone={STATUS[status].tone}>{STATUS[status].label}</Chip>
          <span className="text-[15px] text-muted">Due {prettyDate(row.dueDate)}{today && (status === "todo" || status === "overdue") ? ` · ${dueLabel(row.dueDate, today)}` : ""}</span>
        </div>

        <section aria-labelledby="inst">
          <h3 id="inst" className="mb-1 text-sm font-semibold text-ink">Instructions</h3>
          <p className="whitespace-pre-wrap text-[15px] text-ink">{row.instructions || "No instructions were added."}</p>
          {row.links.length > 0 && (
            <ul className="mt-2 space-y-1">
              {row.links.map((l) => (
                <li key={l.url}><a href={l.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[15px] text-brand hover:underline"><ExternalLink size={14} aria-hidden /> {l.label}</a></li>
              ))}
            </ul>
          )}
        </section>

        {sub && (
          <section aria-labelledby="mine" className="rounded-xl bg-canvas px-4 py-3">
            <h3 id="mine" className="mb-1 text-sm font-semibold text-ink">What you handed in</h3>
            <p className="text-sm text-muted">{formatStamp(sub.submittedAt, timezone)}{sub.late ? " · late" : ""}{sub.attempts > 1 ? ` · attempt ${sub.attempts}` : ""}</p>
            {sub.text && <p className="mt-2 whitespace-pre-wrap text-[15px] text-ink">{sub.text}</p>}
            {sub.file && (
              <p className="mt-2">
                <a href={`/api/student/submission?assignment=${encodeURIComponent(row.id)}`} className="inline-flex items-center gap-1.5 text-[15px] text-brand hover:underline">
                  <Download size={15} aria-hidden /> {sub.file.name} <span className="text-muted">({formatBytes(sub.file.size)})</span>
                </a>
              </p>
            )}
            {sub.mark !== null && (
              <div className="mt-3 border-t border-line pt-3">
                <p className="text-[15px] text-ink"><strong>{sub.mark}</strong> out of {row.maxMarks} · {percentOf(sub.mark, row.maxMarks)}%</p>
                {sub.feedback && <p className="mt-1 text-[15px] text-ink"><span className="font-medium">Feedback: </span>{sub.feedback}</p>}
              </div>
            )}
          </section>
        )}

        {sub?.mark != null ? (
          <p className="text-sm text-muted">This work has been marked, so it can no longer be changed.</p>
        ) : !allowed.ok ? (
          <p role="status" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{allowed.error}</p>
        ) : (
          <form action={submit} className="space-y-4" noValidate>
            <input type="hidden" name="assignmentId" value={row.id} />
            <h3 className="text-sm font-semibold text-ink">{resubmitting ? "Hand in again" : "Hand in your work"}</h3>
            {allowed.late && <p className="rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning">The due date has passed. Your work will be marked as handed in late.</p>}
            {row.allowText && (
              <Field label="Your answer" error={fields.text} help={`Up to ${LIMITS.text} characters.${row.allowFile ? " You can also attach a file." : ""}`}>
                {(p) => <textarea {...p} name="text" rows={6} maxLength={LIMITS.text} defaultValue={sub?.text ?? ""} className={`${inputClass} h-auto py-2`} />}
              </Field>
            )}
            {row.allowFile && (
              <Field label="Attach a file" error={fields.file} help={`PDF, Word, PNG, JPEG or text, up to ${formatBytes(MAX_SUBMISSION_BYTES)}.${sub?.file ? " Leave empty to keep the file you already attached." : ""}`}>
                {(p) => (
                  <div className="flex flex-wrap items-center gap-3">
                    <input {...p} ref={fileRef} type="file" name="file" accept={ACCEPT_ATTRIBUTE} onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")} className="block w-full text-[15px] text-ink file:mr-3 file:rounded-lg file:border file:border-line file:bg-surface file:px-3 file:py-2 file:text-[15px] file:font-medium hover:file:bg-canvas" />
                    {fileName && <span className="inline-flex items-center gap-1 text-sm text-muted"><Paperclip size={14} aria-hidden /> {fileName}</span>}
                  </div>
                )}
              </Field>
            )}
            {error && <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                {sub && canWithdraw(sub) && (
                  confirmWithdraw ? (
                    <span className="inline-flex items-center gap-2 text-sm text-ink">
                      Take this work back?
                      <button type="button" disabled={pending} onClick={() => start(async () => {
                        const r = await withdrawAssignment(row.id);
                        if (r.ok) onDone(`“${row.title}” was taken back. You can hand it in again.`);
                        else setError(r.error);
                      })} className={`${buttonClass} border-danger text-danger`}>Yes, take it back</button>
                      <button type="button" onClick={() => setConfirmWithdraw(false)} className={buttonClass}>No</button>
                    </span>
                  ) : (
                    <button type="button" onClick={() => setConfirmWithdraw(true)} className={buttonClass}><Undo2 size={16} aria-hidden /> Take back</button>
                  )
                )}
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={onClose} className={buttonClass}>Close</button>
                <button type="submit" disabled={pending} className={primaryClass}>{pending ? "Handing in…" : resubmitting ? "Hand in again" : "Hand in"}</button>
              </div>
            </div>
          </form>
        )}
        {(sub?.mark != null || !allowed.ok) && (
          <div className="flex justify-end"><button type="button" onClick={onClose} className={buttonClass}>Close</button></div>
        )}
      </div>
    </Dialog>
  );
}
