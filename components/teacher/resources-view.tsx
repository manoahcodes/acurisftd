"use client";

import { useMemo, useState, useTransition } from "react";
import { ExternalLink, Plus, Search, Trash2 } from "lucide-react";
import { PrintSheet, PrintTable } from "@/components/platform/print-sheet";
import { removeResource, saveResource, shareResource } from "@/server/actions/teacher";
import { cn } from "@/lib/format";
import type { PrintBranding } from "@/lib/print";
import type { TeacherTerms } from "@/lib/teacher/terms";
import { csvFilename } from "@/lib/table-tools";
import { RESOURCE_KINDS, type ResourceRow, type TeachingClass } from "@/types/teacher";
import { Card, Chip, Dialog, ExportBar, Field, Stat, buttonClass, downloadCsv, inputClass, primaryClass, useToday } from "./shared";

export function ResourcesView({ rows, classes, terms, branding }: { rows: ResourceRow[]; classes: TeachingClass[]; terms: TeacherTerms; branding: PrintBranding }) {
  const today = useToday(branding.timezone);
  const [query, setQuery] = useState("");
  const [fClass, setFClass] = useState("");
  const [fKind, setFKind] = useState("");
  const [fShared, setFShared] = useState("");
  const [editing, setEditing] = useState<ResourceRow | "new" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ResourceRow | null>(null);
  const [printing, setPrinting] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [pending, start] = useTransition();

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (!fClass || (fClass === "all" ? r.classId === "" : r.classId === fClass)) &&
        (!fKind || r.kind === fKind) &&
        (!fShared || (fShared === "shared" ? r.shared : !r.shared)) &&
        (!q || `${r.title} ${r.topic} ${r.body} ${r.className}`.toLowerCase().includes(q)),
    );
  }, [rows, query, fClass, fKind, fShared]);

  const columns = ["Title", "Type", terms.group, "Topic", "Shared", "Link", "Note"];
  const table = shown.map((r) => [r.title, r.kind, r.className || `All ${terms.groups.toLowerCase()}`, r.topic, r.shared ? "Yes" : "No", r.url, r.body]);

  const run = (job: () => Promise<{ ok: boolean; error?: string }>, done: string) =>
    start(async () => {
      const r = await job();
      setMessage(r.ok ? { text: done, error: false } : { text: r.error ?? "Something went wrong.", error: true });
    });

  return (
    <div className="mt-6 space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label={terms.tertiary ? "Materials" : "Resources"} value={String(rows.length)} />
        <Stat label={`Shared with ${terms.members.toLowerCase()}`} value={String(rows.filter((r) => r.shared).length)} />
        <Stat label="Private" value={String(rows.filter((r) => !r.shared).length)} note="Only you can see these" />
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-56">
              <Search size={16} aria-hidden className="pointer-events-none absolute left-3 top-3 text-muted" />
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search title, topic or note" aria-label="Search resources" className={`${inputClass} pl-9`} />
            </div>
            <select aria-label={`Filter by ${terms.group.toLowerCase()}`} value={fClass} onChange={(e) => setFClass(e.target.value)} className={`${inputClass} w-auto!`}>
              <option value="">Every {terms.group.toLowerCase()}</option>
              <option value="all">For all {terms.groups.toLowerCase()}</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select aria-label="Filter by type" value={fKind} onChange={(e) => setFKind(e.target.value)} className={`${inputClass} w-auto!`}>
              <option value="">Any type</option>
              {RESOURCE_KINDS.map((k) => <option key={k}>{k}</option>)}
            </select>
            <select aria-label="Filter by sharing" value={fShared} onChange={(e) => setFShared(e.target.value)} className={`${inputClass} w-auto!`}>
              <option value="">Shared or private</option>
              <option value="shared">Shared</option>
              <option value="private">Private</option>
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <ExportBar onCsv={() => downloadCsv(csvFilename(terms.tertiary ? "course materials" : "learning resources", today || "export"), [columns, ...table])} onPrint={() => setPrinting(true)} disabled={shown.length === 0} />
            <button type="button" onClick={() => setEditing("new")} className={primaryClass}><Plus size={16} aria-hidden /> Add {terms.tertiary ? "material" : "resource"}</button>
          </div>
        </div>
        {message && <p role={message.error ? "alert" : "status"} className={cn("mt-4 rounded-lg px-3 py-2 text-sm", message.error ? "bg-danger-soft text-danger" : "bg-positive-soft text-positive")}>{message.text}</p>}
      </Card>

      {shown.length === 0 ? (
        <Card><p className="text-[15px] text-muted">{rows.length === 0 ? "Nothing here yet. Add a link or a note." : "Nothing matches."}</p></Card>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((r) => (
            <li key={r.id}>
              <Card className="flex h-full flex-col">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="min-w-0 text-[17px] font-semibold text-ink">{r.title}</h2>
                  <Chip tone={r.shared ? "good" : "info"}>{r.shared ? "Shared" : "Private"}</Chip>
                </div>
                <p className="mt-1 text-sm text-muted">{r.kind} · {r.className || `All ${terms.groups.toLowerCase()}`}{r.topic && ` · ${r.topic}`}</p>
                {r.body && <p className="mt-3 whitespace-pre-line text-[15px] text-ink">{r.body}</p>}
                {r.url && (
                  <a href={r.url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 break-all text-[15px] text-brand hover:underline">
                    <ExternalLink size={14} aria-hidden className="shrink-0" /> {new URL(r.url).hostname}<span className="sr-only"> (opens in a new tab)</span>
                  </a>
                )}
                <div className="mt-auto flex flex-wrap gap-x-3 gap-y-1 pt-4 text-sm">
                  <button type="button" className="text-brand hover:underline" onClick={() => setEditing(r)}>Edit</button>
                  <button type="button" disabled={pending} className="text-brand hover:underline" onClick={() => run(() => shareResource(r.id, !r.shared), r.shared ? `“${r.title}” is now private.` : `“${r.title}” is shared with ${terms.members.toLowerCase()}.`)}>{r.shared ? "Make private" : "Share"}</button>
                  <button type="button" aria-label={`Delete ${r.title}`} className="text-danger hover:underline" onClick={() => setConfirmDelete(r)}><Trash2 size={14} aria-hidden className="inline" /> Delete</button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {editing && <ResourceForm key={editing === "new" ? "new" : editing.id} existing={editing === "new" ? null : editing} classes={classes} terms={terms} onClose={() => setEditing(null)} onSaved={(t) => { setEditing(null); setMessage({ text: t, error: false }); }} />}

      {confirmDelete && (
        <Dialog title="Delete this resource?" subtitle={confirmDelete.title} onClose={() => setConfirmDelete(null)}>
          <div className="space-y-4 px-6 py-5">
            <p className="text-[15px] text-ink">{confirmDelete.shared ? `${terms.members} will no longer see it. ` : ""}This cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmDelete(null)} className={buttonClass}>Cancel</button>
              <button type="button" disabled={pending} onClick={() => { const r = confirmDelete; setConfirmDelete(null); run(() => removeResource(r.id), `“${r.title}” was deleted.`); }} className="rounded-lg bg-danger px-4 py-2 text-[15px] font-semibold text-white hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger">Delete</button>
            </div>
          </div>
        </Dialog>
      )}

      {printing && (
        <PrintSheet branding={branding} title={terms.tertiary ? "Course materials" : "Learning resources"} lines={[`${shown.length} items`]} onClose={() => setPrinting(false)}>
          <PrintTable columns={columns} rows={table} />
        </PrintSheet>
      )}
    </div>
  );
}

function ResourceForm({ existing, classes, terms, onClose, onSaved }: { existing: ResourceRow | null; classes: TeachingClass[]; terms: TeacherTerms; onClose: () => void; onSaved: (text: string) => void }) {
  const [v, setV] = useState({ classId: existing?.classId ?? "", title: existing?.title ?? "", kind: existing?.kind ?? "Link", url: existing?.url ?? "", body: existing?.body ?? "", topic: existing?.topic ?? "" });
  const [shared, setShared] = useState(existing?.shared ?? false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [pending, start] = useTransition();
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV((p) => ({ ...p, [k]: e.target.value }));

  return (
    <Dialog title={existing ? "Edit" : terms.tertiary ? "Add material" : "Add resource"} subtitle="A web link, a note, or both. Files cannot be uploaded." onClose={onClose}>
      <form
        noValidate
        className="space-y-4 px-6 py-5"
        onSubmit={(e) => {
          e.preventDefault();
          setErrors({});
          setFormError("");
          start(async () => {
            const r = await saveResource(existing?.id ?? null, { ...v, shared });
            if (r.ok) onSaved(existing ? "Saved." : "Added.");
            else {
              setErrors(r.fields ?? {});
              setFormError(r.fields ? "" : r.error);
            }
          });
        }}
      >
        {formError && <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{formError}</p>}
        <Field label="Title" required error={errors.title}>{(p) => <input {...p} value={v.title} maxLength={120} onChange={set("title")} className={inputClass} />}</Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Type" required error={errors.kind}>{(p) => <select {...p} value={v.kind} onChange={set("kind")} className={inputClass}>{RESOURCE_KINDS.map((k) => <option key={k}>{k}</option>)}</select>}</Field>
          <Field label={terms.group} error={errors.classId}>{(p) => <select {...p} value={v.classId} onChange={set("classId")} className={inputClass}><option value="">All {terms.groups.toLowerCase()}</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>}</Field>
        </div>
        <Field label="Topic" help="Used to find it again, for example “Fractions”." error={errors.topic}>{(p) => <input {...p} value={v.topic} maxLength={60} onChange={set("topic")} className={inputClass} />}</Field>
        <Field label="Web link" error={errors.url}>{(p) => <input {...p} inputMode="url" placeholder="https://" value={v.url} onChange={set("url")} className={inputClass} />}</Field>
        <Field label="Note" error={errors.body}>{(p) => <textarea {...p} rows={4} maxLength={2000} value={v.body} onChange={set("body")} className={`${inputClass} h-auto py-2`} />}</Field>
        <label className="flex items-center gap-2 text-[15px] text-ink">
          <input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} className="size-4 accent-[var(--color-brand)]" />
          Share with {terms.members.toLowerCase()}
        </label>
        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <button type="button" onClick={onClose} className={buttonClass}>Cancel</button>
          <button type="submit" disabled={pending} className={primaryClass}>{existing ? "Save changes" : "Add"}</button>
        </div>
      </form>
    </Dialog>
  );
}
