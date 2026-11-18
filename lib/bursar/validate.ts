import type { InstitutionType } from "@/config/institution";
import { parseKwacha, type Checked } from "@/lib/cashier/validate";
import { bursarTermsFor } from "@/lib/bursar/terms";
import { ACCOUNT_KINDS, type AccountKind } from "@/types/cashier";
import { FEE_BILLINGS, FEE_FREQUENCIES, type FeeItemInput, type FeeScope } from "@/types/bursar";

/** Checks shared by the Bursar's server actions (which must not trust the browser) and its forms. Pure, so they are easy to test. */

export type { Checked };
export const BURSAR_LIMITS = { name: 60, reason: 200, note: 200, fee: 1_000_000_00 };

export const clean = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max + 1) : "");

/** A real calendar date written "YYYY-MM-DD". */
export function isIsoDate(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

export type FeeEnv = { type: InstitutionType; groups: string[] };

type RawScope = { kind?: unknown; from?: unknown; to?: unknown; group?: unknown };
export type RawFee = { id?: unknown; name?: unknown; kind?: unknown; amount?: unknown; scope?: RawScope; frequency?: unknown; billing?: unknown; dueOn?: unknown; effectiveFrom?: unknown; active?: unknown };

const fail = (error: string, field: string, message = error): Checked<never> => ({ ok: false, error, fields: { [field]: message } });

function checkScope(raw: RawScope | undefined, env: FeeEnv): Checked<FeeScope> {
  const tertiary = bursarTermsFor(env.type).tertiary;
  if (!raw || raw.kind === "all") return { ok: true, value: { kind: "all" } };
  if (raw.kind === "grades") {
    if (tertiary) return fail("Fees at a college or university apply to everyone or to one programme.", "scope");
    const from = Number(raw.from);
    const to = Number(raw.to);
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to > 12 || from > to) return fail("Choose grades from 1 to 12, with the first no higher than the last.", "scope", "Choose a valid grade range.");
    return { ok: true, value: { kind: "grades", from, to } };
  }
  if (raw.kind === "group") {
    if (!tertiary) return fail("Fees at a school apply to everyone or to a range of grades.", "scope");
    const group = typeof raw.group === "string" ? raw.group : "";
    if (!env.groups.includes(group)) return fail("Choose one of the programmes on the school's roll.", "scope", "Choose a programme.");
    return { ok: true, value: { kind: "group", group } };
  }
  return fail("Choose who this fee applies to.", "scope", "Choose who it applies to.");
}

/**
 * A fee as typed. The amount is the kwacha as written ("2,600" or "350.50") and
 * is converted to ngwee here with no floating point.
 */
export function checkFeeItem(raw: RawFee, env: FeeEnv): Checked<FeeItemInput> {
  const name = clean(raw.name, BURSAR_LIMITS.name);
  if (name.length < 2) return fail("Give the fee a name.", "name", "Enter a name.");
  if (name.length > BURSAR_LIMITS.name) return fail(`The name can be at most ${BURSAR_LIMITS.name} characters.`, "name", `At most ${BURSAR_LIMITS.name} characters.`);

  const kinds = bursarTermsFor(env.type).accountKinds;
  const kind = ACCOUNT_KINDS.find((k): k is AccountKind => k === raw.kind && kinds.includes(k));
  if (!kind) return fail("Choose which account this fee is charged to.", "kind", "Choose an account.");

  const amount = parseKwacha(raw.amount);
  if (amount === undefined) return fail("Enter the fee in kwacha, for example 2600 or 350.50.", "amount", "Enter a valid amount.");
  if (amount > BURSAR_LIMITS.fee) return fail("That fee is too large.", "amount", "Too large.");

  const scope = checkScope(raw.scope, env);
  if (!scope.ok) return scope;

  const frequency = FEE_FREQUENCIES.find((f) => f === raw.frequency);
  if (!frequency) return fail("Choose how often it is charged.", "frequency", "Choose how often.");
  const billing = FEE_BILLINGS.find((b) => b === raw.billing);
  if (!billing) return fail("Choose whether it is charged to everyone it applies to or is optional.", "billing", "Choose one.");

  if (!isIsoDate(raw.effectiveFrom)) return fail("Enter the date this fee takes effect.", "effectiveFrom", "Enter a valid date.");
  if (!isIsoDate(raw.dueOn)) return fail("Enter the date invoices with this fee fall due.", "dueOn", "Enter a valid date.");
  if (raw.dueOn < raw.effectiveFrom) return fail("The due date cannot be before the fee takes effect.", "dueOn", "Not before the effective date.");

  const id = typeof raw.id === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(raw.id) ? raw.id : undefined;
  if (raw.id !== undefined && raw.id !== "" && !id) return fail("That fee is not available.", "id");
  return { ok: true, value: { ...(id ? { id } : {}), name, kind, amount, scope: scope.value, frequency, billing, dueOn: raw.dueOn, effectiveFrom: raw.effectiveFrom, active: raw.active !== false } };
}
