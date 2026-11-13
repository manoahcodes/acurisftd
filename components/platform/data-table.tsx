"use client";

import { useId, useState, useTransition } from "react";
import { Archive, ArchiveRestore, FileDown, Pencil, Printer, Search, Trash2 } from "lucide-react";
import { removeRecord, type RemovalOp } from "@/server/actions/records";
import { cellToValue, keyForRow } from "@/lib/forms/spec";
import type { FormSpec } from "@/types/forms";
import { RecordForm, type RecordTarget } from "./record-form";
import { cn, todayIn } from "@/lib/format";
import { rowDetails, type PrintBranding } from "@/lib/print";
import { applyFilters, csvFilename, filterableColumns, tableToCsv } from "@/lib/table-tools";
import { DetailsList, PrintSheet, PrintTable } from "./print-sheet";
import type { TableSection } from "@/types/platform";

const GOOD = new Set([
  "active", "paid", "approved", "cleared", "complete", "completed", "registered",
  "issued", "published", "success", "allocated", "validated", "matched", "ready",
  "enrolled", "resolved", "scheduled",
]);
const WARN = new Set([
  "pending", "trial", "partial", "in progress", "review", "draft", "waitlisted",
  "on leave", "maintenance", "medium", "open",
]);
const BAD = new Set([
  "overdue", "suspended", "failed", "rejected", "high", "blocked", "unmatched", "denied",
]);

const iconButton =
  "rounded-lg p-2 text-muted hover:bg-canvas hover:text-ink focus-visible:outline-2 focus-visible:outline-brand disabled:opacity-50";

function chipClass(value: string) {
  const v = value.toLowerCase();
  if (GOOD.has(v)) return "bg-positive-soft text-positive";
  if (WARN.has(v)) return "bg-warning-soft text-warning";
  if (BAD.has(v)) return "bg-danger-soft text-danger";
  return "bg-canvas text-muted";
}

/** One table card with a text filter. Filtering happens in the browser on the rows it was given. */
export function DataTable({
  section,
  slug,
  editForm,
  rowForm,
  branding,
  reportTools = false,
}: {
  section: TableSection;
  slug?: string;
  /** When set, each row gets an Edit button that opens this form. */
  editForm?: FormSpec;
  /** When set, rows can be archived, restored and (if allowed) deleted. */
  rowForm?: FormSpec;
  /** The school's document header, footer and signature, for printing. */
  branding?: PrintBranding;
  /** Adds drop-down filters, Export CSV and Print for reports. */
  reportTools?: boolean;
}) {
  const { title, subtitle, columns, rows, statusColumn, note, rowMeta } = section;
  const headingId = useId();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<RecordTarget | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [chosen, setChosen] = useState<Record<number, string>>({});
  const [printing, setPrinting] = useState<"table" | { row: string[] } | null>(null);
  const [pending, startTransition] = useTransition();

  // An all-divisions table has a Division column in front that is not part of the record.
  const offset = columns[0] === "Division" ? 1 : 0;
  const recordColumns = columns.slice(offset);
  const canEdit = Boolean(editForm && slug);
  const canRemove = Boolean(rowForm && slug);
  const hasActions = canEdit || canRemove || (Boolean(section.printAs) && Boolean(branding));
  const archivedCount = rowMeta?.filter((m) => m.archived).length ?? 0;

  const keyOf = (row: string[], form: FormSpec) => keyForRow(recordColumns, row.slice(offset), form.keyColumns);

  const remove = (row: string[], op: RemovalOp) => {
    if (!rowForm || !slug) return;
    const rowKey = keyOf(row, rowForm);
    if (rowKey === null) return;
    const divisionId = offset ? rowForm.divisionChoices?.find((d) => d.name === row[0])?.id : undefined;
    setConfirming(null);
    startTransition(async () => {
      const result = await removeRecord({ slug, formId: rowForm.id, op, rowKey, divisionId });
      setMessage(result.message);
    });
  };

  const openEdit = (row: string[]) => {
    if (!editForm) return;
    const cells = row.slice(offset);
    const rowKey = keyForRow(recordColumns, cells, editForm.keyColumns);
    if (rowKey === null) return;
    const values: Record<string, string | string[]> = {};
    for (const f of editForm.fields) {
      const i = f.column ? recordColumns.indexOf(f.column) : -1;
      if (i >= 0) values[f.name] = cellToValue(f, cells[i] ?? "");
    }
    const divisionId = offset
      ? editForm.divisionChoices?.find((d) => d.name === row[0])?.id
      : undefined;
    setEditing({ mode: "edit", rowKey, values, divisionId });
  };

  const q = query.trim().toLowerCase();
  const filters = reportTools ? filterableColumns(columns, rows, statusColumn) : [];
  const entries = rows.map((row, i) => ({ row, meta: rowMeta?.[i] ?? {} }));
  const matching = new Set(applyFilters(rows, chosen, query));
  const visible = entries.filter(({ row, meta }) => (showArchived || !meta.archived) && matching.has(row));
  const filtersOn = Object.values(chosen).some(Boolean);
  const canPrintRows = Boolean(section.printAs && branding);
  const exportCsv = () => {
    const url = URL.createObjectURL(new Blob([tableToCsv(columns, visible.map((v) => v.row))], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = csvFilename(title, todayIn(branding?.timezone).iso);
    document.body.append(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };
  const statusIndex = statusColumn ? columns.indexOf(statusColumn) : -1;

  return (
    <section
      aria-labelledby={headingId}
      className="relative rounded-2xl border border-line bg-surface p-6 shadow-card"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id={headingId} className="text-xl font-semibold text-ink">
            {title}
          </h2>
          {subtitle && <p className="mt-1 text-[15px] text-muted">{subtitle}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-3">
        {archivedCount > 0 && (
          <label className="flex items-center gap-2 text-sm text-muted">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="size-4 accent-[var(--brand)]"
            />
            Show archived ({archivedCount})
          </label>
        )}
        <label className="relative flex items-center">
          <span className="sr-only">Filter {title}</span>
          <Search size={15} aria-hidden className="pointer-events-none absolute left-3 text-muted" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter rows..."
            autoComplete="off"
            className="h-10 w-56 rounded-lg border border-line bg-surface pl-9 pr-3 text-[15px] text-ink placeholder:text-muted focus-visible:outline-2 focus-visible:outline-brand"
          />
        </label>
        {reportTools && (
          <>
            <button type="button" onClick={exportCsv} className="inline-flex h-10 items-center gap-2 rounded-lg border border-line px-3 text-[15px] font-medium text-ink hover:bg-canvas focus-visible:outline-2 focus-visible:outline-brand">
              <FileDown size={15} aria-hidden /> Export CSV
            </button>
            {branding && (
              <button type="button" onClick={() => setPrinting("table")} className="inline-flex h-10 items-center gap-2 rounded-lg border border-line px-3 text-[15px] font-medium text-ink hover:bg-canvas focus-visible:outline-2 focus-visible:outline-brand">
                <Printer size={15} aria-hidden /> Print
              </button>
            )}
          </>
        )}
        </div>
      </div>

      {filters.length > 0 && (
        <div className="mt-4 flex flex-wrap items-end gap-3">
          {filters.map((f) => (
            <label key={f.column} className="text-sm text-muted">
              <span className="mb-1 block">{f.column}</span>
              <select
                value={chosen[f.index] ?? ""}
                onChange={(e) => setChosen((c) => ({ ...c, [f.index]: e.target.value }))}
                className="h-10 rounded-lg border border-line bg-surface px-3 text-[15px] text-ink focus-visible:outline-2 focus-visible:outline-brand"
              >
                <option value="">All</option>
                {f.choices.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </label>
          ))}
          {filtersOn && (
            <button type="button" onClick={() => setChosen({})} className="h-10 text-sm font-medium text-brand underline">
              Clear filters
            </button>
          )}
        </div>
      )}

      <div
        role="region"
        aria-label={`${title} table`}
        tabIndex={0}
        className="relative mt-5 overflow-x-auto focus-visible:outline-2 focus-visible:outline-brand"
      >
        <table className="w-full min-w-max border-collapse text-left text-[15px]">
          <thead>
            <tr className="border-b border-line text-sm text-muted">
              {columns.map((c) => (
                <th key={c} scope="col" className="whitespace-nowrap px-3 py-3 font-medium first:pl-0">
                  {c}
                </th>
              ))}
              {hasActions && (
                <th scope="col" className="px-3 py-3 text-right font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {visible.map(({ row, meta }, r) => (
              <tr key={r} className={cn("border-b border-line last:border-b-0", meta.archived && "opacity-60")}>
                {row.map((cell, c) => (
                  <td
                    key={c}
                    className={cn(
                      "whitespace-nowrap px-3 py-3.5 first:pl-0",
                      c === 0 ? "font-medium text-ink" : "text-muted",
                    )}
                  >
                    {c === statusIndex ? (
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-sm font-medium",
                          chipClass(cell),
                        )}
                      >
                        {cell}
                      </span>
                    ) : (
                      cell
                    )}
                    {c === 0 && meta.archived && (
                      <span className="ml-2 rounded-full bg-canvas px-2 py-0.5 text-xs font-medium text-muted">Archived</span>
                    )}
                  </td>
                ))}
                {hasActions && (
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    {canPrintRows && (
                      <button
                        type="button"
                        onClick={() => setPrinting({ row })}
                        aria-label={`Print ${section.printAs!.toLowerCase()} ${row[offset]}`}
                        title={`Print ${section.printAs!.toLowerCase()}`}
                        className={iconButton}
                      >
                        <Printer size={16} aria-hidden />
                      </button>
                    )}
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => openEdit(row)}
                        aria-label={`Edit ${row[offset]}`}
                        title="Edit"
                        className={iconButton}
                      >
                        <Pencil size={16} aria-hidden />
                      </button>
                    )}
                    {canRemove && meta.archived && (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => remove(row, "restore")}
                        aria-label={`Restore ${row[offset]}`}
                        title="Restore"
                        className={iconButton}
                      >
                        <ArchiveRestore size={16} aria-hidden />
                      </button>
                    )}
                    {canRemove && !meta.archived && meta.archivable !== false && (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => remove(row, "archive")}
                        aria-label={`Archive ${row[offset]}`}
                        title="Archive"
                        className={iconButton}
                      >
                        <Archive size={16} aria-hidden />
                      </button>
                    )}
                    {canRemove && meta.deletable && confirming !== String(r) && (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => setConfirming(String(r))}
                        aria-label={`Delete ${row[offset]}`}
                        title="Delete"
                        className={cn(iconButton, "hover:text-danger")}
                      >
                        <Trash2 size={16} aria-hidden />
                      </button>
                    )}
                    {canRemove && meta.deletable && confirming === String(r) && (
                      <span className="ml-1 inline-flex items-center gap-1 text-sm">
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => remove(row, "delete")}
                          className="rounded-lg bg-danger px-2.5 py-1 font-medium text-white focus-visible:outline-2 focus-visible:outline-brand"
                        >
                          Delete for good
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirming(null)}
                          className="rounded-lg px-2 py-1 text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-brand"
                        >
                          Cancel
                        </button>
                      </span>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {visible.length === 0 && (
        <p className="py-6 text-center text-sm text-muted">{q || filtersOn ? "No rows match the filters." : "No rows to show."}</p>
      )}
      <p className="sr-only" role="status" aria-live="polite">
        {message || (q || filtersOn ? `${visible.length} of ${rows.length} rows shown` : "")}
      </p>
      {note && <p className="mt-4 text-sm text-muted">{note}</p>}
      {printing && branding && printing === "table" && (
        <PrintSheet
          branding={branding}
          title={title}
          lines={[
            ...(subtitle ? [subtitle] : []),
            ...filters.filter((f) => chosen[f.index]).map((f) => `${f.column}: ${chosen[f.index]}`),
            ...(q ? [`Search: ${query.trim()}`] : []),
            `${visible.length} ${visible.length === 1 ? "row" : "rows"}`,
          ]}
          onClose={() => setPrinting(null)}
        >
          <PrintTable columns={columns} rows={visible.map((v) => v.row)} />
        </PrintSheet>
      )}
      {printing && branding && typeof printing === "object" && (
        <PrintSheet branding={branding} title={section.printAs ?? title} lines={[title]} signature onClose={() => setPrinting(null)}>
          <DetailsList details={rowDetails(columns, printing.row)} />
        </PrintSheet>
      )}
      {editing && editForm && slug && (
        <RecordForm slug={slug} spec={editForm} target={editing} onClose={() => setEditing(null)} />
      )}
    </section>
  );
}
