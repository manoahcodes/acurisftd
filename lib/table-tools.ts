import { toCsv } from "./csv";

/** Columns that make useful drop-down filters on a report (status, period, class, programme...). */
const FILTER_COLUMN = /^(status|period|term|semester|class|programme|program|grade|division|type|year|department|faculty|method|campus|hostel)\b/i;
const MAX_CHOICES = 12;

export type TableFilter = { column: string; index: number; choices: string[] };

/** Which columns get a filter, with their distinct values (only when there is something to choose between). */
export function filterableColumns(columns: string[], rows: string[][], statusColumn?: string): TableFilter[] {
  const filters: TableFilter[] = [];
  columns.forEach((column, index) => {
    if (column !== statusColumn && !FILTER_COLUMN.test(column)) return;
    const choices = [...new Set(rows.map((r) => r[index] ?? "").filter((v) => v !== "" && v !== "—"))].sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
    if (choices.length >= 2 && choices.length <= MAX_CHOICES) filters.push({ column, index, choices });
  });
  return filters;
}

/** Rows that match every chosen value (`chosen` maps a column index to the wanted value; empty means any) and the text query. */
export function applyFilters(rows: string[][], chosen: Record<number, string>, query = ""): string[][] {
  const q = query.trim().toLowerCase();
  const wanted = Object.entries(chosen).filter(([, v]) => v);
  return rows.filter(
    (row) =>
      wanted.every(([i, v]) => row[Number(i)] === v) && (!q || row.some((cell) => cell.toLowerCase().includes(q))),
  );
}

/** A file name such as "finance-reports-2026-11-12.csv". */
export function csvFilename(title: string, isoDate: string): string {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "table";
  return `${slug}-${isoDate}.csv`;
}

/** The visible table as CSV (formula-defused by toCsv). */
export const tableToCsv = (columns: string[], rows: string[][]) => toCsv([columns, ...rows]);
