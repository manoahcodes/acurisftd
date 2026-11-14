"use client";

import { useMemo, useState, useTransition } from "react";
import { Search } from "lucide-react";
import { PrintSheet, PrintTable } from "@/components/platform/print-sheet";
import { saveCourseworkWeight, saveGradebookRemark } from "@/server/actions/teacher";
import { cn } from "@/lib/format";
import type { PrintBranding } from "@/lib/print";
import type { TeacherTerms } from "@/lib/teacher/terms";
import { csvFilename } from "@/lib/table-tools";
import type { Gradebook } from "@/types/teacher";
import { Card, Chip, ExportBar, Stat, buttonClass, downloadCsv, inputClass, useToday } from "./shared";

const pct = (n: number | null) => (n === null ? "—" : `${n}%`);

export function GradebookView({ books, tertiary, terms, branding }: { books: Gradebook[]; tertiary: boolean; terms: TeacherTerms; branding: PrintBranding }) {
  const today = useToday(branding.timezone);
  const [classId, setClassId] = useState(books[0]?.classId ?? "");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"name" | "rank">("name");
  const [weight, setWeight] = useState<{ classId: string; value: string } | null>(null);
  const [printing, setPrinting] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [pending, start] = useTransition();

  const book = books.find((b) => b.classId === classId);
  const rows = useMemo(() => {
    if (!book) return [];
    const q = query.trim().toLowerCase();
    const list = book.rows.filter((r) => !q || `${r.learner.name} ${r.learner.number}`.toLowerCase().includes(q));
    return sort === "rank" ? [...list].sort((a, b) => (a.rank ?? 1e9) - (b.rank ?? 1e9) || a.learner.name.localeCompare(b.learner.name, "en")) : list;
  }, [book, query, sort]);

  if (!book) return <Card className="mt-6"><p className="text-[15px] text-muted">You have no {terms.groups.toLowerCase()} yet.</p></Card>;

  const weightValue = weight?.classId === book.classId ? weight.value : String(book.courseworkWeight);
  const run = (job: () => Promise<{ ok: boolean; error?: string }>, done: string) =>
    start(async () => {
      const r = await job();
      setMessage(r.ok ? { text: done, error: false } : { text: r.error ?? "Something went wrong.", error: true });
    });

  const columns = ["Rank", terms.member, "Number", ...book.columns.map((c) => `${c.title} (${c.weight}%)`), "Coursework", "Final %", "Grade", tertiary ? "Points" : "Result", "Remark"];
  const table = rows.map((r) => [
    r.rank === null ? "" : String(r.rank),
    r.learner.name,
    r.learner.number,
    ...book.columns.map((c) => (r.scores[c.id] === null ? "" : String(r.scores[c.id]))),
    r.coursework === null ? "" : String(r.coursework),
    r.final === null ? "" : String(r.final),
    r.grade,
    tertiary ? (r.points === null ? "" : String(r.points)) : r.passed === null ? "" : r.passed ? "Pass" : "Fail",
    r.remark,
  ]);
  const maxCount = Math.max(1, ...book.distribution.map((d) => d.count));
  const incomplete = book.columns.some((c) => c.status !== "published");

  return (
    <div className="mt-6 space-y-6">
      <Card>
        <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
          <div className="max-w-md">
            <label htmlFor="gb-class" className="mb-1 block text-sm font-medium text-ink">{terms.group}</label>
            <select id="gb-class" value={classId} onChange={(e) => { setClassId(e.target.value); setMessage(null); }} className={inputClass}>
              {books.map((b) => <option key={b.classId} value={b.classId}>{b.className} – {b.subject}</option>)}
            </select>
          </div>
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => saveCourseworkWeight(book.classId, weightValue), "Coursework weight saved.");
            }}
          >
            <div>
              <label htmlFor="gb-cw" className="mb-1 block text-sm font-medium text-ink">Coursework counts for (%)</label>
              <input id="gb-cw" inputMode="numeric" value={weightValue} onChange={(e) => setWeight({ classId: book.classId, value: e.target.value })} className={`${inputClass} w-28`} />
            </div>
            <button type="submit" disabled={pending || weightValue === String(book.courseworkWeight)} className={buttonClass}>Save</button>
          </form>
        </div>
        <p className="mt-3 text-sm text-muted">
          Coursework is the average of marked assignments ({book.assignmentCount} so far) and counts for {book.courseworkWeight}%; the {book.columns.length} assessment{book.columns.length === 1 ? "" : "s"} share the other {100 - book.courseworkWeight}% by their weights. Anything not yet marked is left out, not counted as zero.
        </p>
      </Card>

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Class average" value={pct(book.average)} />
        <Stat label="Highest" value={pct(book.highest)} />
        <Stat label="Pass rate" value={pct(book.passRate)} note={`Pass is ${book.passMark}% or more`} />
        <Stat label={terms.members} value={String(book.rows.length)} />
      </div>

      <Card>
        <h2 className="text-lg font-semibold text-ink">Grade spread</h2>
        <ul className="mt-3 grid gap-2" aria-label="Grade spread">
          {book.distribution.map((d) => (
            <li key={d.grade} className="grid grid-cols-[3rem_1fr_3rem] items-center gap-3 text-[15px]">
              <span className="font-medium text-ink">{d.grade}</span>
              <span className="h-3 overflow-hidden rounded-full bg-canvas"><span className="block h-full rounded-full bg-brand" style={{ width: `${(d.count / maxCount) * 100}%` }} /></span>
              <span className="text-right text-muted">{d.count}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-muted">{book.bands.map((b) => `${b.grade} ${b.min}+`).join(" · ")}</p>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-56">
              <Search size={16} aria-hidden className="pointer-events-none absolute left-3 top-3 text-muted" />
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${terms.members.toLowerCase()}`} aria-label={`Search ${terms.members.toLowerCase()}`} className={`${inputClass} pl-9`} />
            </div>
            <select aria-label="Sort by" value={sort} onChange={(e) => setSort(e.target.value as "name" | "rank")} className={`${inputClass} w-auto`}>
              <option value="name">Sort by name</option>
              <option value="rank">Sort by rank</option>
            </select>
          </div>
          <ExportBar onCsv={() => downloadCsv(csvFilename(`${book.className} gradebook`, today || "export"), [columns, ...table])} onPrint={() => setPrinting(true)} disabled={rows.length === 0} />
        </div>

        {incomplete && <p className="mt-4 rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning">Some assessments are still being marked, so these figures are provisional.</p>}
        {message && <p role={message.error ? "alert" : "status"} className={cn("mt-4 rounded-lg px-3 py-2 text-sm", message.error ? "bg-danger-soft text-danger" : "bg-positive-soft text-positive")}>{message.text}</p>}

        <div className="mt-4 overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-left text-[15px]" style={{ minWidth: `${40 + book.columns.length * 7}rem` }}>
            <caption className="sr-only">Gradebook for {book.className}</caption>
            <thead className="bg-canvas text-sm text-muted">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">Rank</th>
                <th scope="col" className="sticky left-0 bg-canvas px-3 py-2 font-medium">{terms.member}</th>
                {book.columns.map((c) => (
                  <th key={c.id} scope="col" className="px-3 py-2 font-medium">
                    <span className="block">{c.title}</span>
                    <span className="block text-xs font-normal">/{c.maxMarks} · {c.weight}%{c.status !== "published" && " · marking"}</span>
                  </th>
                ))}
                <th scope="col" className="px-3 py-2 font-medium">Coursework</th>
                <th scope="col" className="px-3 py-2 font-medium">Final</th>
                <th scope="col" className="px-3 py-2 font-medium">Grade</th>
                <th scope="col" className="px-3 py-2 font-medium">Remark</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.learner.id} className="border-t border-line">
                  <td className="px-3 py-2 text-muted">{r.rank ?? "—"}</td>
                  <td className="sticky left-0 bg-surface px-3 py-2"><p className="font-medium text-ink">{r.learner.name}</p><p className="text-sm text-muted">{r.learner.number}</p></td>
                  {book.columns.map((c) => <td key={c.id} className="px-3 py-2">{pct(r.scores[c.id])}</td>)}
                  <td className="px-3 py-2">{pct(r.coursework)}</td>
                  <td className="px-3 py-2 font-semibold text-ink">{pct(r.final)}{r.missing > 0 && <span className="ml-1 text-sm font-normal text-warning" title={`${r.missing} mark${r.missing === 1 ? "" : "s"} missing`}>*</span>}</td>
                  <td className="px-3 py-2">{r.final === null ? "—" : <Chip tone={r.passed ? "good" : "bad"}>{r.grade}{tertiary && r.points !== null ? ` · ${r.points}` : ""}</Chip>}</td>
                  <td className="px-3 py-2">
                    <input
                      aria-label={`Remark for ${r.learner.name}`}
                      key={`${r.learner.id}-${r.remark}`}
                      defaultValue={r.remark}
                      maxLength={300}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v !== r.remark) run(() => saveGradebookRemark(book.classId, r.learner.id, v), `Remark saved for ${r.learner.name}.`);
                      }}
                      className={`${inputClass} min-w-48`}
                    />
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={book.columns.length + 6} className="px-3 py-6 text-center text-muted">No {terms.members.toLowerCase()} match.</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-sm text-muted">* Some marks are still missing from this final figure.</p>
      </Card>

      {printing && (
        <PrintSheet branding={branding} title={`${book.className} – gradebook`} lines={[`${book.subject} · coursework ${book.courseworkWeight}%`, `Class average ${pct(book.average)} · pass rate ${pct(book.passRate)}`]} onClose={() => setPrinting(false)}>
          <PrintTable columns={columns} rows={table} />
        </PrintSheet>
      )}
    </div>
  );
}
