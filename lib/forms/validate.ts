import type { FieldDef, FormErrors, FormSpec, FormValues } from "@/types/forms";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE = /^\+?[0-9 ()-]{7,20}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export type ValidationResult =
  | { ok: true; values: FormValues }
  | { ok: false; errors: FormErrors; values: FormValues };

const clean = (v: unknown): string => (typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "");

/** Reads submitted FormData into plain values for the spec's fields (anything else is dropped). */
export function readFormData(spec: FormSpec, data: FormData): FormValues {
  const values: FormValues = {};
  for (const f of spec.fields) {
    values[f.name] =
      f.type === "multiselect" ? data.getAll(f.name).map(clean).filter(Boolean) : clean(data.get(f.name));
  }
  return values;
}

function isRealDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function checkField(f: FieldDef, raw: string | string[]): string | null {
  if (f.type === "multiselect") {
    const picked = Array.isArray(raw) ? raw : [];
    if (f.required && picked.length === 0) return `Choose at least one ${f.label.toLowerCase()}.`;
    if (f.options && picked.some((p) => !f.options!.includes(p))) return `${f.label} has an option that is not allowed.`;
    return null;
  }

  const value = Array.isArray(raw) ? "" : raw;
  if (value === "") return f.required ? `${f.label} is required.` : null;
  if (f.maxLength && value.length > f.maxLength) return `${f.label} must be at most ${f.maxLength} characters.`;

  switch (f.type) {
    case "email":
      return EMAIL.test(value) ? null : "Enter a valid email address.";
    case "tel":
      return PHONE.test(value) ? null : "Enter a valid phone number.";
    case "date":
      return isRealDate(value) ? null : "Enter a valid date.";
    case "select":
      return f.options?.includes(value) ? null : `Choose one of the listed ${f.label.toLowerCase()} options.`;
    case "number":
    case "money": {
      // Plain decimal only: no exponent, no thousands separators, no hex.
      if (!/^\d+(\.\d{1,2})?$/.test(value)) {
        return f.type === "money" ? "Enter an amount like 1500 or 1500.50." : "Enter a whole number.";
      }
      const n = Number(value);
      if (f.type === "number" && !Number.isInteger(n)) return "Enter a whole number.";
      if (f.min !== undefined && n < f.min) return `${f.label} must be at least ${f.min}.`;
      if (f.max !== undefined && n > f.max) return `${f.label} must be at most ${f.max}.`;
      return null;
    }
    default:
      return null;
  }
}

/**
 * Checks values against the spec. When editing, locked fields are ignored
 * (the stored value stays). Pure: no I/O, so it is the same on server and in tests.
 */
export function validateForm(
  spec: FormSpec,
  input: FormValues,
  mode: "create" | "edit",
  extra: { divisionId?: string } = {},
): ValidationResult {
  const errors: FormErrors = {};
  const values: FormValues = {};

  for (const f of spec.fields) {
    if (mode === "edit" && f.lockedOnEdit) continue;
    const raw = input[f.name] ?? (f.type === "multiselect" ? [] : "");
    values[f.name] = raw;
    const problem = checkField(f, raw);
    if (problem) errors[f.name] = problem;
  }

  if (mode === "create" && spec.divisionChoices && spec.divisionChoices.length > 0) {
    if (!extra.divisionId || !spec.divisionChoices.some((d) => d.id === extra.divisionId)) {
      errors.division = "Choose a division.";
    }
  }

  return Object.keys(errors).length > 0 ? { ok: false, errors, values } : { ok: true, values };
}

/** "1500" or "1500.5" → ngwee-safe kwacha number. Call only after validation. */
export const parseMoney = (value: string): number => Math.round(Number(value) * 100) / 100;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-11-10" → "10 Nov 2026", matching how the mock tables show dates. */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${String(d).padStart(2, "0")} ${MONTHS[m - 1]} ${y}`;
}
