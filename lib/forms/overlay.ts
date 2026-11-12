import type { Kpi } from "@/types/dashboard";
import type { RowMeta, TableSection } from "@/types/platform";
import { keyForRow } from "./spec";

/** Changes made through forms, kept apart from the base data a screen is built from. */
export type TableOverlay = {
  /** New rows, newest first, as column header → value. */
  added: Array<Record<string, string>>;
  /** Edited values by row key (the first column's original value), as column header → value. */
  edits: Record<string, Record<string, string>>;
  /** Keys of archived rows (hidden by default, restorable). */
  archived?: Record<string, true>;
};

export const emptyOverlay = (): TableOverlay => ({ added: [], edits: {} });


/** A row's key compared without case or spacing differences. */
export const normaliseKey = (key: string): string => key.trim().replace(/\s+/g, " ").toLowerCase();

/** Next "PREFIX-0001" after the highest number already used under that prefix. */
export function nextKey(existing: string[], prefix: string, digits: number): string {
  const pattern = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\d+)`);
  let max = 0;
  for (const key of existing) {
    const n = pattern.exec(key)?.[1];
    if (n) max = Math.max(max, Number(n));
  }
  return `${prefix}${String(max + 1).padStart(digits, "0")}`;
}

/**
 * Puts the overlay on top of a table: new rows first, then edits to any row
 * (base or new) by its key, then archived marks. Columns a new row has no value
 * for show "—". A column the overlay names that the table does not have is ignored.
 * `keep` marks a table whose records have history: nothing in it is deletable.
 * A row is deletable only when it was created through a form (nothing else
 * refers to it yet).
 */
export function applyOverlay(
  section: TableSection,
  overlay: TableOverlay | undefined,
  keyColumns: string[] = [section.columns[0]],
  keep = false,
): TableSection {
  const archived = overlay?.archived ?? {};
  if (
    !overlay ||
    (overlay.added.length === 0 && Object.keys(overlay.edits).length === 0 && Object.keys(archived).length === 0)
  ) {
    return section;
  }

  const { columns } = section;
  const fromRecord = (rec: Record<string, string>) => columns.map((c) => rec[c] ?? "—");
  const nAdded = overlay.added.length;

  const rowMeta: RowMeta[] = [];
  const rows = [...overlay.added.map(fromRecord), ...section.rows].map((row, i) => {
    const edit = overlay.edits[keyForRow(columns, row, keyColumns) ?? ""];
    const shown = edit ? row.map((cell, c) => (columns[c] in edit ? edit[columns[c]] : cell)) : row;
    // The key is read from the row as first created, so an edit cannot hide its own archive mark.
    const key = keyForRow(columns, row, keyColumns) ?? "";
    rowMeta.push({ archived: Boolean(archived[key]), deletable: i < nAdded && !keep });
    return shown;
  });

  return { ...section, rows, rowMeta };
}

/** Rows that are not archived. */
export const activeRowCount = (t: TableSection): number =>
  t.rows.length - (t.rowMeta?.filter((m) => m.archived).length ?? 0);

/**
 * Keeps count cards honest after rows are added or archived. A card whose value
 * is a plain whole number equal to exactly one base table's row count follows
 * that table; any other card is left alone (a card whose number could mean two
 * tables, or is not a row count, must not be guessed).
 */
export function syncCountKpis(base: TableSection[], current: TableSection[], kpis: Kpi[] | undefined): Kpi[] | undefined {
  if (!kpis) return kpis;
  return kpis.map((k) => {
    if (!/^\d[\d,]*$/.test(k.value)) return k;
    const n = Number(k.value.replace(/,/g, ""));
    const matches = base
      .map((t, i) => ({ t, i }))
      .filter(({ t }) => t.rows.length === n);
    if (matches.length !== 1) return k;
    const now = activeRowCount(current[matches[0].i]);
    return now === n ? k : { ...k, value: now.toLocaleString("en-US") };
  });
}
