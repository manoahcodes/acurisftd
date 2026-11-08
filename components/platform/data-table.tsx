"use client";

import { useId, useState } from "react";
import { Pencil, Search } from "lucide-react";
import { cellToValue, keyForRow } from "@/lib/forms/spec";
import type { FormSpec } from "@/types/forms";
import { RecordForm, type RecordTarget } from "./record-form";
import { cn } from "@/lib/format";
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

function chipClass(value: string) {
  const v = value.toLowerCase();
  if (GOOD.has(v)) return "bg-emerald-50 text-emerald-700";
  if (WARN.has(v)) return "bg-amber-50 text-amber-800";
  if (BAD.has(v)) return "bg-red-50 text-red-700";
  return "bg-canvas text-muted";
}

/** One table card with a text filter. Filtering happens in the browser on the rows it was given. */
export function DataTable({
  section,
  slug,
  editForm,
}: {
  section: TableSection;
  slug?: string;
  /** When set, each row gets an Edit button that opens this form. */
  editForm?: FormSpec;
}) {
  const { title, subtitle, columns, rows, statusColumn, note } = section;
  const headingId = useId();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<RecordTarget | null>(null);

  // An all-divisions table has a Division column in front that is not part of the record.
  const offset = columns[0] === "Division" ? 1 : 0;
  const recordColumns = columns.slice(offset);
  const canEdit = Boolean(editForm && slug);

  const openEdit = (row: string[]) => {
    if (!editForm) return;
    const cells = row.slice(offset);
    const rowKey = keyForRow(recordColumns, cells, editForm.keyColumns);
    if (rowKey === null) return;
    const values: Record<string, string> = {};
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
  const visible = q
    ? rows.filter((row) => row.some((cell) => cell.toLowerCase().includes(q)))
    : rows;
  const statusIndex = statusColumn ? columns.indexOf(statusColumn) : -1;

  return (
    <section
      aria-labelledby={headingId}
      className="relative rounded-2xl border border-line bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id={headingId} className="text-xl font-semibold text-ink">
            {title}
          </h2>
          {subtitle && <p className="mt-1 text-[15px] text-muted">{subtitle}</p>}
        </div>
        <label className="relative flex items-center">
          <span className="sr-only">Filter {title}</span>
          <Search size={15} aria-hidden className="pointer-events-none absolute left-3 text-muted" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter rows..."
            autoComplete="off"
            className="h-10 w-56 rounded-lg border border-line bg-white pl-9 pr-3 text-[15px] text-ink placeholder:text-muted focus-visible:outline-2 focus-visible:outline-brand"
          />
        </label>
      </div>

      <div
        role="region"
        aria-label={`${title} table`}
        tabIndex={0}
        className="mt-5 overflow-x-auto focus-visible:outline-2 focus-visible:outline-brand"
      >
        <table className="w-full min-w-max border-collapse text-left text-[15px]">
          <thead>
            <tr className="border-b border-line text-sm text-muted">
              {columns.map((c) => (
                <th key={c} scope="col" className="whitespace-nowrap px-3 py-3 font-medium first:pl-0">
                  {c}
                </th>
              ))}
              {canEdit && (
                <th scope="col" className="px-3 py-3 text-right font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {visible.map((row, r) => (
              <tr key={r} className="border-b border-line last:border-b-0">
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
                  </td>
                ))}
                {canEdit && (
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => openEdit(row)}
                      aria-label={`Edit ${row[offset]}`}
                      title="Edit"
                      className="rounded-lg p-2 text-muted hover:bg-canvas hover:text-ink focus-visible:outline-2 focus-visible:outline-brand"
                    >
                      <Pencil size={16} aria-hidden />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {visible.length === 0 && (
        <p className="py-6 text-center text-sm text-muted">No rows match &ldquo;{query.trim()}&rdquo;.</p>
      )}
      <p className="sr-only" role="status" aria-live="polite">
        {q ? `${visible.length} of ${rows.length} rows shown` : ""}
      </p>
      {note && <p className="mt-4 text-sm text-muted">{note}</p>}
      {editing && editForm && slug && (
        <RecordForm slug={slug} spec={editForm} target={editing} onClose={() => setEditing(null)} />
      )}
    </section>
  );
}
