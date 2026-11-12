import { askedFields, keyForRow } from "@/lib/forms/spec";
import { nextKey, normaliseKey } from "@/lib/forms/overlay";
import type { FormValues } from "@/types/forms";
import type { Flavour } from "../repositories/platform-mock/shared";
import { cellsFromValues } from "./cells";
import type { FormEntry } from "./registry";

/**
 * The cells for a new row from validated form values: row defaults, generated
 * numbers (continuing after `rows`), the asked fields, then derived columns.
 * Returns the row's key too, or an error when the form does not match its table
 * or the key is already taken. Shared by the create form and CSV imports.
 */
export function buildNewRow(
  entry: FormEntry,
  values: FormValues,
  columns: string[],
  rows: string[][],
  f: Flavour,
): { ok: true; cells: Record<string, string>; key: string } | { ok: false; message: string } {
  const { spec } = entry;
  const generated: Record<string, string> = {};
  for (const field of spec.fields) {
    if (!field.auto || !field.column) continue;
    const i = columns.indexOf(field.column);
    generated[field.column] = nextKey(rows.map((r) => r[i] ?? ""), field.auto.prefix, field.auto.digits);
  }
  const cells = {
    ...(spec.rowDefaults ?? {}),
    ...generated,
    ...cellsFromValues(askedFields(spec, "create"), values),
    ...(entry.derive?.(values, f) ?? {}),
  };
  const key = keyForRow(columns, columns.map((c) => cells[c] ?? "—"), spec.keyColumns);
  if (key === null) return { ok: false, message: "This form does not match its table." };
  if (rows.some((r) => normaliseKey(keyForRow(columns, r, spec.keyColumns) ?? "") === normaliseKey(key))) {
    return { ok: false, message: "This record already exists." };
  }
  return { ok: true, cells, key };
}
