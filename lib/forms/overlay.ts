import type { TableSection } from "@/types/platform";
import { keyForRow } from "./spec";

/** Changes made through forms, kept apart from the base data a screen is built from. */
export type TableOverlay = {
  /** New rows, newest first, as column header → value. */
  added: Array<Record<string, string>>;
  /** Edited values by row key (the first column's original value), as column header → value. */
  edits: Record<string, Record<string, string>>;
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
 * (base or new) by its key. Columns a new row has no value for show "—".
 * A column the overlay names that the table does not have is ignored.
 */
export function applyOverlay(
  section: TableSection,
  overlay: TableOverlay | undefined,
  keyColumns: string[] = [section.columns[0]],
): TableSection {
  if (!overlay || (overlay.added.length === 0 && Object.keys(overlay.edits).length === 0)) return section;

  const { columns } = section;
  const fromRecord = (rec: Record<string, string>) => columns.map((c) => rec[c] ?? "—");

  const rows = [...overlay.added.map(fromRecord), ...section.rows].map((row) => {
    const edit = overlay.edits[keyForRow(columns, row, keyColumns) ?? ""];
    if (!edit) return row;
    return row.map((cell, i) => (columns[i] in edit ? edit[columns[i]] : cell));
  });

  return { ...section, rows };
}
