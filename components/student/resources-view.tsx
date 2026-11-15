"use client";

import { useMemo, useState, useTransition } from "react";
import { Bookmark, BookmarkCheck, BookOpen, Download, ExternalLink, FileText, Link2, PlayCircle, Search, StickyNote } from "lucide-react";
import { PrintSheet, PrintTable } from "@/components/platform/print-sheet";
import { Card, Chip, ExportBar, Stat, buttonClass, downloadCsv, inputClass, useToday } from "@/components/teacher/shared";
import { noteResourceOpened, saveResourceForLater } from "@/server/actions/student";
import { cn } from "@/lib/format";
import type { PrintBranding } from "@/lib/print";
import { csvFilename } from "@/lib/table-tools";
import { prettyDate } from "@/lib/teacher/dates";
import { RESOURCE_KINDS, type ResourceKind } from "@/types/teacher";
import type { StudentTerms } from "@/lib/student/terms";
import type { StudentResourceRow } from "@/types/student";

const ICON: Record<ResourceKind, typeof Link2> = { Link: Link2, Reading: BookOpen, Video: PlayCircle, Worksheet: FileText, Notes: StickyNote };
const TABS = [{ id: "all", label: "All" }, { id: "new", label: "New" }, { id: "saved", label: "Saved" }] as const;
type Tab = (typeof TABS)[number]["id"];

/** Only https links are opened; anything else is shown as text. */
const safeUrl = (u: string) => (/^https:\/\/[^\s]+$/i.test(u) ? u : "");

/** A plain-text file name from a title. */
const fileNameOf = (title: string) => `${title.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").toLowerCase() || "notes"}.txt`;

function downloadText(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function ResourcesView({ rows, terms, branding }: { rows: StudentResourceRow[]; terms: StudentTerms; branding: PrintBranding }) {
  const today = useToday(branding.timezone);
  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");
  const [courseName, setCourseName] = useState("");
  const [kind, setKind] = useState("");
  const [printing, setPrinting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();
  // Shown straight away; the server's answer replaces it when the page refreshes.
  const [savedNow, setSavedNow] = useState<Record<string, boolean>>({});
  const [openedNow, setOpenedNow] = useState<Record<string, boolean>>({});

  const isSaved = (r: StudentResourceRow) => savedNow[r.id] ?? r.saved;
  const isNew = (r: StudentResourceRow) => !(openedNow[r.id] ?? r.opened);
  const courses = useMemo(() => [...new Set(rows.map((r) => r.courseName))].sort(), [rows]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => (tab === "all" || (tab === "new" ? !(openedNow[r.id] ?? r.opened) : (savedNow[r.id] ?? r.saved))) && (!courseName || r.courseName === courseName) && (!kind || r.kind === kind) && (!q || `${r.title} ${r.topic} ${r.body} ${r.courseName}`.toLowerCase().includes(q)));
  }, [rows, tab, query, courseName, kind, savedNow, openedNow]);

  const count = (t: Tab) => rows.filter((r) => t === "all" || (t === "new" ? isNew(r) : isSaved(r))).length;

  const toggle = (r: StudentResourceRow) => {
    const next = !isSaved(r);
    setSavedNow((s) => ({ ...s, [r.id]: next }));
    setError(null);
    start(async () => {
      const res = await saveResourceForLater(r.id, next);
      if (!res.ok) {
        setSavedNow((s) => ({ ...s, [r.id]: !next }));
        setError(res.error);
      }
    });
  };

  const opened = (r: StudentResourceRow) => {
    if (!isNew(r)) return;
    setOpenedNow((s) => ({ ...s, [r.id]: true }));
    start(async () => {
      await noteResourceOpened(r.id);
    });
  };

  const columns = ["Title", "Type", terms.course, "Topic", "Posted", "Link or note"];
  const table = shown.map((r) => [r.title, r.kind, r.courseName, r.topic, prettyDate(r.postedOn), r.url || r.body]);

  return (
    <div className="mt-6 space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Resources" value={String(rows.length)} note={`Across ${courses.length} ${terms.courses.toLowerCase()}`} />
        <Stat label="New" value={String(count("new"))} note="Not opened yet" />
        <Stat label="Saved" value={String(count("saved"))} />
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
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search title, topic or note" aria-label="Search resources" className={`${inputClass} pl-9`} />
            </div>
            <select aria-label={`Filter by ${terms.course.toLowerCase()}`} value={courseName} onChange={(e) => setCourseName(e.target.value)} className={`${inputClass} w-auto!`}>
              <option value="">All {terms.courses.toLowerCase()}</option>
              {courses.map((c) => <option key={c}>{c}</option>)}
            </select>
            <select aria-label="Filter by type" value={kind} onChange={(e) => setKind(e.target.value)} className={`${inputClass} w-auto!`}>
              <option value="">Every type</option>
              {RESOURCE_KINDS.map((k) => <option key={k}>{k}</option>)}
            </select>
          </div>
          <ExportBar onCsv={() => downloadCsv(csvFilename("learning resources", today || "export"), [columns, ...table])} onPrint={() => setPrinting(true)} disabled={shown.length === 0} />
        </div>
        {error && <p role="alert" className="mt-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
      </Card>

      {shown.length === 0 ? (
        <Card><p className="text-[15px] text-muted">{rows.length === 0 ? "Nothing has been shared with you yet." : tab === "saved" ? "You have not saved anything yet. Use the bookmark on a resource." : "Nothing matches."}</p></Card>
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {shown.map((r) => {
            const Icon = ICON[r.kind];
            const url = safeUrl(r.url);
            return (
              <li key={r.id}>
                <Card className="flex h-full flex-col gap-3">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand"><Icon size={20} aria-hidden /></span>
                    <div className="min-w-0 flex-1">
                      <h2 className="text-[17px] font-semibold text-ink">{r.title}</h2>
                      <p className="text-sm text-muted">{r.courseName} · {r.kind}{r.topic ? ` · ${r.topic}` : ""}</p>
                    </div>
                    {isNew(r) && <Chip tone="info">New</Chip>}
                    <button type="button" onClick={() => toggle(r)} aria-pressed={isSaved(r)} aria-label={isSaved(r) ? `Remove ${r.title} from saved` : `Save ${r.title}`} className="rounded-lg p-2 text-muted hover:bg-canvas hover:text-ink focus-visible:outline-2 focus-visible:outline-brand">
                      {isSaved(r) ? <BookmarkCheck size={20} aria-hidden className="text-brand" /> : <Bookmark size={20} aria-hidden />}
                    </button>
                  </div>
                  {r.body && <p className="whitespace-pre-wrap text-[15px] text-ink">{r.body}</p>}
                  <p className="text-sm text-muted">Shared by {r.teacher} · {prettyDate(r.postedOn)}</p>
                  <div className="mt-auto flex flex-wrap gap-2 pt-1">
                    {url && (
                      <a href={url} target="_blank" rel="noopener noreferrer" onClick={() => opened(r)} onAuxClick={() => opened(r)} className={`${buttonClass} bg-brand! text-on-brand!`}>
                        <ExternalLink size={16} aria-hidden /> Open link
                      </a>
                    )}
                    {r.body && (
                      <button type="button" onClick={() => { downloadText(fileNameOf(r.title), `${r.title}\n${r.courseName}${r.topic ? ` · ${r.topic}` : ""}\n\n${r.body}\n`); opened(r); }} className={buttonClass}>
                        <Download size={16} aria-hidden /> Download as text
                      </button>
                    )}
                    {!url && isNew(r) && <button type="button" onClick={() => opened(r)} className={buttonClass}>Mark as read</button>}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {printing && (
        <PrintSheet branding={branding} title="Learning resources" lines={[`${shown.length} shown`]} onClose={() => setPrinting(false)}>
          <PrintTable columns={columns} rows={table} />
        </PrintSheet>
      )}
    </div>
  );
}
