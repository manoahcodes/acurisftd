/** Small CSV reader and writer (RFC 4180 style: quotes, doubled quotes, CRLF). */

/** Parses CSV text into rows of cells. Blank lines are skipped; a leading BOM is ignored. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  const endCell = () => {
    row.push(cell);
    cell = "";
  };
  const endRow = () => {
    endCell();
    if (row.some((c) => c.trim() !== "")) rows.push(row.map((c) => c.trim()));
    row = [];
  };

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === ",") endCell();
    else if (ch === "\n") endRow();
    else if (ch === "\r") {
      if (src[i + 1] === "\n") i++;
      endRow();
    } else cell += ch;
  }
  if (cell !== "" || row.length > 0) endRow();
  return rows;
}

/**
 * Writes rows as CSV. A cell that starts with = + - @ is prefixed with a quote
 * so a spreadsheet cannot run it as a formula.
 */
export function toCsv(rows: string[][]): string {
  const safe = (c: string) => (/^[=+\-@\t\r]/.test(c) && !/^-?\d+(\.\d+)?$/.test(c) ? `'${c}` : c);
  const esc = (c: string) => (/[",\n\r]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c);
  return rows.map((r) => r.map((c) => esc(safe(c))).join(",")).join("\r\n") + "\r\n";
}

export type CsvTable = { headers: string[]; rows: Array<Record<string, string>> };

/**
 * Reads a CSV with a header row. Headers match `columns` ignoring case and
 * spacing. Returns an error message when a required column is missing.
 */
export function readCsvTable(
  text: string,
  columns: string[],
  required: string[] = columns,
): { ok: true; table: CsvTable } | { ok: false; message: string } {
  const all = parseCsv(text);
  if (all.length === 0) return { ok: false, message: "The file is empty." };
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  const header = all[0].map(norm);
  const index = new Map<string, number>();
  for (const c of columns) {
    const i = header.indexOf(norm(c));
    if (i >= 0) index.set(c, i);
  }
  const missing = required.filter((c) => !index.has(c));
  if (missing.length > 0) return { ok: false, message: `Missing column${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}.` };
  const rows = all.slice(1).map((cells) => Object.fromEntries(columns.map((c) => [c, index.has(c) ? (cells[index.get(c)!] ?? "") : ""])));
  if (rows.length === 0) return { ok: false, message: "The file has a header but no rows." };
  return { ok: true, table: { headers: columns, rows } };
}
