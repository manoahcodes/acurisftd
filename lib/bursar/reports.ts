import { ACCOUNT_KINDS, METHOD_IDS, type AccountKind, type MethodId } from "@/types/cashier";
import { addDays } from "@/lib/teacher/dates";
import type { AccountRow, Payment, Waiver, WaiverKind } from "@/types/bursar";

/** Financial report figures. Pure. Money is integer ngwee; a range is inclusive on both ends. */

export type Range = { from: string; to: string };
export const PRESETS = ["today", "7d", "30d", "90d"] as const;
export type Preset = (typeof PRESETS)[number];
export const PRESET_LABEL: Record<Preset, string> = { today: "Today", "7d": "Last 7 days", "30d": "Last 30 days", "90d": "Last 90 days" };

export const rangeOf = (preset: Preset, today: string): Range => ({ from: preset === "today" ? today : addDays(today, -({ "7d": 6, "30d": 29, "90d": 89 } as const)[preset]), to: today });
export const inRange = (date: string, r: Range) => date >= r.from && date <= r.to;

export type DayTotal = { date: string; count: number; amount: number };
export type Collections = { total: number; count: number; byAccount: Record<AccountKind, number>; byMethod: Record<MethodId, number>; byDay: DayTotal[] };

/** Money collected in the range: successful payments only. Pending ones are not collected yet and reversed ones were put back. */
export function collections(payments: Payment[], r: Range): Collections {
  const out: Collections = { total: 0, count: 0, byAccount: Object.fromEntries(ACCOUNT_KINDS.map((k) => [k, 0])) as Collections["byAccount"], byMethod: Object.fromEntries(METHOD_IDS.map((m) => [m, 0])) as Collections["byMethod"], byDay: [] };
  const days = new Map<string, DayTotal>();
  for (const p of payments) {
    if (p.status !== "success" || !inRange(p.date, r)) continue;
    out.total += p.amount;
    out.count++;
    out.byAccount[p.account] += p.amount;
    out.byMethod[p.method] += p.amount;
    const d = days.get(p.date) ?? { date: p.date, count: 0, amount: 0 };
    d.count++;
    d.amount += p.amount;
    days.set(p.date, d);
  }
  out.byDay = [...days.values()].sort((a, b) => b.date.localeCompare(a.date));
  return out;
}

/** Payments the Bursar put back in the range, by the day they were reversed. */
export const reversedIn = (payments: Payment[], r: Range) => payments.filter((p) => p.status === "reversed" && p.reversal && inRange(p.reversal.at.slice(0, 10), r));

export type GroupPosition = { group: string; students: number; billed: number; paid: number; waived: number; owed: number; /** Whole percent of what was due (billed less waived) that has been paid. */ rate: number };

const rateOf = (paid: number, billed: number, waived: number) => (billed - waived > 0 ? Math.round((paid / (billed - waived)) * 100) : 100);

/** Each class or programme's position, and a final total row. */
export function positionByGroup(accounts: AccountRow[]): { rows: GroupPosition[]; total: GroupPosition } {
  const map = new Map<string, GroupPosition>();
  for (const a of accounts) {
    const g = map.get(a.group) ?? { group: a.group, students: 0, billed: 0, paid: 0, waived: 0, owed: 0, rate: 0 };
    g.students++;
    g.billed += a.billed;
    g.paid += a.paid;
    g.waived += a.waived;
    g.owed += a.owed;
    map.set(a.group, g);
  }
  const rows = [...map.values()].map((g) => ({ ...g, rate: rateOf(g.paid, g.billed, g.waived) })).sort((a, b) => a.group.localeCompare(b.group, undefined, { numeric: true }));
  const total = rows.reduce((t, g) => ({ ...t, students: t.students + g.students, billed: t.billed + g.billed, paid: t.paid + g.paid, waived: t.waived + g.waived, owed: t.owed + g.owed }), { group: "Whole school", students: 0, billed: 0, paid: 0, waived: 0, owed: 0, rate: 0 });
  return { rows, total: { ...total, rate: rateOf(total.paid, total.billed, total.waived) } };
}

export type WaiverTotals = { kind: WaiverKind; count: number; amount: number };

/** Bursaries, waivers and discounts approved in the range (by decision date), and how many are still waiting. */
export function waiverSummary(waivers: Waiver[], r: Range): { approved: WaiverTotals[]; approvedAmount: number; pending: number; pendingAmount: number } {
  const approved = (["bursary", "waiver", "discount"] as const).map((kind) => {
    const mine = waivers.filter((w) => w.kind === kind && w.status === "approved" && w.decidedAt && inRange(w.decidedAt.slice(0, 10), r));
    return { kind, count: mine.length, amount: mine.reduce((n, w) => n + w.amount, 0) };
  });
  const pending = waivers.filter((w) => w.status === "pending");
  return { approved, approvedAmount: approved.reduce((n, a) => n + a.amount, 0), pending: pending.length, pendingAmount: pending.reduce((n, w) => n + w.amount, 0) };
}
