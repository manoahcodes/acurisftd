import type { InstitutionType } from "@/config/institution";
import { studentsFor } from "@/lib/cashier/seed";
import { planDue } from "@/lib/bursar/plans";
import type { PaymentPlan, Reversal } from "@/types/bursar";
import type { AccountKind } from "@/types/cashier";
import { loadSnapshot, saveSnapshot } from "./../persistence/store";

/**
 * The school's fee ledger: what every student still owes on each account, and
 * the payment plans that move due dates. It belongs to the Bursar. The Cashier
 * desk, the Student and Parent fee pages and the Bursar pages all read and
 * change balances through here, so a payment taken anywhere moves the balance
 * everywhere. Kept in memory and saved to the SQLite file like the other mocks.
 *
 * SWAP POINT: this is the table behind "student accounts" in a real database.
 */
export type LedgerScope = { tenantId: string; institutionType: InstitutionType };

type Ledger = {
  /** Still owed, by "studentNo|kind", ngwee. */
  owed: Record<string, number>;
  /** When each account falls due, by "studentNo|kind", before any payment plan. */
  dues: Record<string, string | null>;
  plans: PaymentPlan[];
  /** Payments the Bursar has reversed, by payment id. The Cashier checks this so a reversed receipt cannot also be voided. */
  reversed: Record<string, Reversal>;
};

const g = globalThis as unknown as { __acurisLedger?: Map<string, Ledger> };
const KEY = "ledger";
const data = (g.__acurisLedger ??= new Map<string, Ledger>(loadSnapshot<Array<[string, Ledger]>>(KEY) ?? []));
const save = () => saveSnapshot(KEY, [...data]);

const scopeKey = (s: LedgerScope) => `${s.tenantId}:${s.institutionType}`;
const keyOf = (no: string, kind: AccountKind) => `${no}|${kind}`;

function seed(type: InstitutionType): Ledger {
  const l: Ledger = { owed: {}, dues: {}, plans: [], reversed: {} };
  for (const st of studentsFor(type)) {
    for (const line of st.lines) {
      l.owed[keyOf(st.no, line.kind)] = line.owed;
      l.dues[keyOf(st.no, line.kind)] = line.dueOn;
    }
  }
  return l;
}

function ledgerOf(scope: LedgerScope): Ledger {
  let l = data.get(scopeKey(scope));
  if (!l) {
    l = seed(scope.institutionType);
    data.set(scopeKey(scope), l);
    save();
  }
  l.reversed ??= {};
  return l;
}

const totalOwed = (l: Ledger, no: string) => Object.entries(l.owed).reduce((n, [k, v]) => (k.startsWith(`${no}|`) ? n + v : n), 0);
const activePlan = (l: Ledger, no: string) => l.plans.find((p) => p.studentNo === no && p.status === "active");

export const owedOf = (scope: LedgerScope, no: string, kind: AccountKind): number => ledgerOf(scope).owed[keyOf(no, kind)] ?? 0;

/** Adds to (or takes from) what is owed. It never goes below zero; returns the new amount. */
export function addOwed(scope: LedgerScope, no: string, kind: AccountKind, delta: number): number {
  const l = ledgerOf(scope);
  const next = Math.max(0, (l.owed[keyOf(no, kind)] ?? 0) + delta);
  l.owed[keyOf(no, kind)] = next;
  save();
  return next;
}

/** Sets when an account falls due (a new invoice or a changed date). */
export function setDue(scope: LedgerScope, no: string, kind: AccountKind, dueOn: string | null): void {
  ledgerOf(scope).dues[keyOf(no, kind)] = dueOn;
  save();
}

/** The account's own due date, ignoring any payment plan. Null when none was ever set. */
export const baseDueOf = (scope: LedgerScope, no: string, kind: AccountKind): string | null => ledgerOf(scope).dues[keyOf(no, kind)] ?? null;

/** When an account falls due: nothing once it is paid, the next instalment while an active plan covers the student, otherwise its own date. */
export function dueOf(scope: LedgerScope, no: string, kind: AccountKind): string | null {
  const l = ledgerOf(scope);
  if ((l.owed[keyOf(no, kind)] ?? 0) <= 0) return null;
  const plan = activePlan(l, no);
  if (plan) {
    const due = planDue(plan, totalOwed(l, no));
    if (due) return due;
  }
  return l.dues[keyOf(no, kind)] ?? null;
}

/** One student's position across every account: the total owed and the earliest date any of it falls due. */
export function positionOf(scope: LedgerScope, no: string): { balance: number; dueOn: string | null } {
  const l = ledgerOf(scope);
  const kinds = Object.keys(l.owed).filter((k) => k.startsWith(`${no}|`)).map((k) => k.slice(no.length + 1) as AccountKind);
  const balance = kinds.reduce((n, k) => n + (l.owed[keyOf(no, k)] ?? 0), 0);
  const dues = kinds.map((k) => dueOf(scope, no, k)).filter((d): d is string => Boolean(d)).sort();
  return { balance, dueOn: dues[0] ?? null };
}

export const listPlans = (scope: LedgerScope): PaymentPlan[] => ledgerOf(scope).plans.map((p) => ({ ...p, instalments: p.instalments.map((i) => ({ ...i })) }));

export function savePlan(scope: LedgerScope, plan: PaymentPlan): void {
  const l = ledgerOf(scope);
  const i = l.plans.findIndex((p) => p.id === plan.id);
  if (i >= 0) l.plans[i] = plan;
  else l.plans.push(plan);
  save();
}

export const reversalOf = (scope: LedgerScope, paymentId: string): Reversal | undefined => ledgerOf(scope).reversed[paymentId];

export function markReversed(scope: LedgerScope, paymentId: string, reversal: Reversal): void {
  ledgerOf(scope).reversed[paymentId] = reversal;
  save();
}

/** Test helper: forget everything. */
export const resetLedger = () => {
  data.clear();
  saveSnapshot(KEY, []);
};
