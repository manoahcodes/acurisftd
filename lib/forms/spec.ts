import type { FieldDef, FormSpec } from "@/types/forms";

/** The spec as it applies to one division (its own fields and defaults), or unchanged when it has no variants. */
export function resolveSpec(spec: FormSpec, divisionId?: string): FormSpec {
  const variant = divisionId ? spec.variants?.[divisionId] : undefined;
  if (!variant) return spec;
  return { ...spec, fields: variant.fields, rowDefaults: variant.rowDefaults ?? spec.rowDefaults };
}

/** Fields the person fills in (system-generated ones are left out). */
export const askedFields = (spec: FormSpec, mode: "create" | "edit"): FieldDef[] =>
  spec.fields.filter((f) => !f.auto && !(mode === "edit" && f.createOnly));

/** The row key for a displayed row: the key columns' cells joined. Null if a key column is missing. */
export function keyForRow(columns: string[], row: string[], keyColumns: string[]): string | null {
  const parts: string[] = [];
  for (const c of keyColumns) {
    const i = columns.indexOf(c);
    if (i < 0) return null;
    parts.push(row[i] ?? "");
  }
  return parts.join(" | ");
}

const MONTH_NUMBERS: Record<string, string> = {
  Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
  Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
};

/**
 * Turns a displayed table cell back into a form value, so the edit form opens
 * pre-filled: "K 1,500" → "1500", "10 Nov 2026" → "2026-11-10", "30%" → "30".
 * Unreadable cells give "" rather than a wrong value.
 */
export function cellToValue(field: FieldDef, cell: string): string {
  switch (field.type) {
    case "money":
    case "number": {
      const digits = cell.replace(/[^\d.]/g, "");
      return /^\d+(\.\d+)?$/.test(digits) ? digits : "";
    }
    case "date": {
      const m = /^(\d{1,2}) ([A-Z][a-z]{2}) (\d{4})$/.exec(cell);
      if (m && MONTH_NUMBERS[m[2]]) return `${m[3]}-${MONTH_NUMBERS[m[2]]}-${m[1].padStart(2, "0")}`;
      // "Jan 2026" (a month only) opens on the 1st of that month.
      const my = /^([A-Z][a-z]{2}) (\d{4})$/.exec(cell);
      return my && MONTH_NUMBERS[my[1]] ? `${my[2]}-${MONTH_NUMBERS[my[1]]}-01` : "";
    }
    case "multiselect":
      return "";
    default:
      return cell === "—" ? "" : cell;
  }
}
