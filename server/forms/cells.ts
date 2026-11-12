import { formatDate, parseMoney } from "@/lib/forms/validate";
import type { FieldDef, FormValues } from "@/types/forms";
import { K } from "../repositories/platform-mock/shared";

/** How a validated value reads in its table cell. */
export function displayValue(field: FieldDef, raw: string | string[]): string {
  if (Array.isArray(raw)) return raw.length === 0 ? "—" : raw.join(field.joiner ?? ", ");
  if (raw === "") return "—";
  switch (field.type) {
    case "money":
      return K(parseMoney(raw));
    case "date":
      return formatDate(raw);
    case "number":
      return `${Number(raw).toLocaleString("en-US")}${field.suffix ?? ""}`;
    default:
      return `${raw}${field.suffix ?? ""}`;
  }
}

/** Column header → cell text for every field that fills a column. */
export function cellsFromValues(fields: FieldDef[], values: FormValues): Record<string, string> {
  const cells: Record<string, string> = {};
  for (const f of fields) {
    if (!f.column || !(f.name in values)) continue;
    cells[f.column] = displayValue(f, values[f.name]);
  }
  return cells;
}
