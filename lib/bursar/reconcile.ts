import { methodOf } from "@/lib/cashier/methods";
import { parseKwacha } from "@/lib/cashier/validate";
import type { CashUp, Receipt } from "@/types/cashier";
import type { BankInput, BankLine, CashUpReview, LineView, MatchTarget, MissingCashUp, Payment, UnallocatedPayment } from "@/types/bursar";

/** Bank and mobile money matching, and cash-up checks. Pure. */

/** References are compared ignoring case and spaces: "ZNC 778213" and "znc-778213" are not the same, "ZNC-778213 " and "znc-778213" are. */
export const normRef = (ref: string) => ref.replace(/\s+/g, "").toLowerCase();

export const reviewKey = (date: string, cashier: string) => `${date}|${cashier}`;

/** Everything a statement line could belong to: non-cash payments with a reference, and unallocated deposits. Reversed payments and allocations (the deposit itself is the unallocated record) are left out. */
export function targetsOf(payments: Payment[], unallocated: UnallocatedPayment[]): MatchTarget[] {
  const fromPayments = payments
    .filter((p) => p.source !== "allocation" && p.status !== "reversed" && p.reference && methodOf(p.method)?.group !== "cash")
    .map((p): MatchTarget => ({ kind: "payment", id: p.id, no: p.no, date: p.date, amount: p.amount, method: p.method, reference: p.reference, who: p.studentName, status: p.status === "pending" ? "pending" : "success" }));
  const fromUnallocated = unallocated.map((u): MatchTarget => ({ kind: "unallocated", id: u.id, no: u.no, date: u.date, amount: u.amount, method: u.method, reference: u.reference, who: u.payer, status: u.status }));
  return [...fromPayments, ...fromUnallocated];
}

const claim = (t: Pick<MatchTarget, "kind" | "id">) => `${t.kind}:${t.id}`;

/**
 * Where each statement line stands. A match the Bursar made by hand counts
 * first. The rest match on reference and amount, oldest line first, and a
 * payment is claimed by one line only, so a duplicated line shows up as
 * unmatched. Same reference but another amount is a mismatch to look into.
 */
export function reconcile(lines: BankLine[], targets: MatchTarget[]): LineView[] {
  const byClaim = new Map(targets.map((t) => [claim(t), t]));
  const taken = new Set<string>();
  const views = new Map<string, LineView>();

  for (const line of lines) {
    if (line.ignored) views.set(line.id, { line, status: "ignored" });
    else if (line.matchedTo) {
      const t = byClaim.get(claim(line.matchedTo));
      if (t && !taken.has(claim(t))) {
        taken.add(claim(t));
        views.set(line.id, { line, status: "matched", target: t, manual: true });
      }
    }
  }
  const rest = lines.filter((l) => !views.has(l.id)).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  for (const line of rest) {
    const same = targets.filter((t) => !taken.has(claim(t)) && normRef(t.reference) === normRef(line.reference));
    const exact = same.find((t) => t.amount === line.amount);
    if (exact) {
      taken.add(claim(exact));
      views.set(line.id, { line, status: "matched", target: exact });
    } else views.set(line.id, same.length ? { line, status: "mismatch", target: same[0] } : { line, status: "unmatched" });
  }
  return lines.map((l) => views.get(l.id)!);
}

/**
 * Payments and deposits the statement does not show: money the books say
 * arrived that the bank has not confirmed. Only those dated within the period
 * the statement covers (from its earliest line) count; earlier ones belong to a
 * statement not loaded here.
 */
export const notOnStatement = (targets: MatchTarget[], views: LineView[]): MatchTarget[] => {
  if (views.length === 0) return [];
  const since = views.map((v) => v.line.date).sort()[0];
  const seen = new Set(views.filter((v) => v.status === "matched" && v.target).map((v) => claim(v.target!)));
  return targets.filter((t) => t.date >= since && !seen.has(claim(t)));
};

/** What a line can be matched to by hand: something not yet matched, for exactly the same amount. */
export function candidatesFor(line: BankLine, targets: MatchTarget[], views: LineView[]): MatchTarget[] {
  return notOnStatement(targets, views).filter((t) => t.amount === line.amount);
}

export type ReconSummary = { lines: number; matched: number; mismatched: number; unmatched: number; ignored: number; unmatchedAmount: number; notOnStatement: number; notOnStatementAmount: number };

export function summarise(views: LineView[], missing: MatchTarget[]): ReconSummary {
  const of = (s: LineView["status"]) => views.filter((v) => v.status === s);
  return {
    lines: views.length,
    matched: of("matched").length,
    mismatched: of("mismatch").length,
    unmatched: of("unmatched").length,
    ignored: of("ignored").length,
    unmatchedAmount: [...of("unmatched"), ...of("mismatch")].reduce((n, v) => n + v.line.amount, 0),
    notOnStatement: missing.length,
    notOnStatementAmount: missing.reduce((n, t) => n + t.amount, 0),
  };
}

/** Days before today on which a cashier took cash but did not submit a cash-up. */
export function missingCashUps(receipts: Receipt[], cashUps: CashUp[], today: string): MissingCashUp[] {
  const done = new Set(cashUps.map((c) => reviewKey(c.date, c.submittedBy)));
  const owed = new Map<string, MissingCashUp>();
  for (const r of receipts) {
    if (r.status !== "success" || r.date >= today || methodOf(r.method)?.group !== "cash" || done.has(reviewKey(r.date, r.cashier))) continue;
    const k = reviewKey(r.date, r.cashier);
    const m = owed.get(k) ?? { date: r.date, cashier: r.cashier, expectedCash: 0 };
    m.expectedCash += r.amount;
    owed.set(k, m);
  }
  return [...owed.values()].sort((a, b) => b.date.localeCompare(a.date) || a.cashier.localeCompare(b.cashier));
}

export const reviewOf = (reviews: CashUpReview[], date: string, cashier: string) => reviews.find((r) => r.date === date && r.cashier === cashier);

export const MAX_STATEMENT_LINES = 200;
export type ParsedStatement = { lines: BankInput[]; errors: Array<{ row: number; message: string }> };

const dmy = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/;
function dateOf(text: string): string | undefined {
  const t = text.trim();
  const m = dmy.exec(t);
  const iso = m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : t;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return undefined;
  const d = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso ? iso : undefined;
}

/**
 * Reads statement lines pasted as `date, reference, amount, description` (comma
 * or tab separated, one per line). A header row is skipped. Dates can be
 * 2026-11-16 or 16/11/2026; amounts are kwacha, with or without a leading K.
 */
export function parseStatement(text: string, today: string): ParsedStatement {
  const out: ParsedStatement = { lines: [], errors: [] };
  const rows = text.split(/\r?\n/).map((r, i) => ({ row: i + 1, raw: r.trim() })).filter((r) => r.raw);
  for (const { row, raw } of rows) {
    const cells = raw.split(/\t|,/).map((c) => c.trim());
    if (out.lines.length + out.errors.length === 0 && /^date$/i.test(cells[0])) continue;
    if (out.lines.length >= MAX_STATEMENT_LINES) {
      out.errors.push({ row, message: `Only ${MAX_STATEMENT_LINES} lines can be added at once.` });
      break;
    }
    if (cells.length < 3) {
      out.errors.push({ row, message: "Needs a date, a reference and an amount." });
      continue;
    }
    const date = dateOf(cells[0]);
    if (!date) out.errors.push({ row, message: "The date should look like 2026-11-16 or 16/11/2026." });
    else if (date > today) out.errors.push({ row, message: "The date is in the future." });
    else if (!cells[1] || cells[1].length > 60) out.errors.push({ row, message: "The reference is missing or too long." });
    else {
      const amount = parseKwacha(cells[2].replace(/^K\s*/i, ""));
      if (amount === undefined) out.errors.push({ row, message: "The amount should be kwacha, like 650 or 650.50." });
      else out.lines.push({ date, reference: cells[1], amount, description: cells.slice(3).join(", ").replace(/\s+/g, " ").trim().slice(0, 80) });
    }
  }
  return out;
}
