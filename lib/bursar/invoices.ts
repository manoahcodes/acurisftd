import type { InstitutionType } from "@/config/institution";
import { bursarTermsFor } from "@/lib/bursar/terms";
import { inEffect, scopeMatches } from "@/lib/bursar/fees";
import { addDays } from "@/lib/teacher/dates";
import type { RollStudent } from "@/lib/bursar/accounts";
import type { AccountKind } from "@/types/cashier";
import type { FeeItem, GenerateInput, Invoice, InvoiceDraft, InvoiceLine, InvoiceStatus, InvoiceView } from "@/types/bursar";

/** Invoice maths. Pure, so the server and the page's preview always agree. Money is integer ngwee. */

const PERIODS_PER_YEAR = (type: InstitutionType) => (bursarTermsFor(type).tertiary ? 2 : 3);

/** "Term 3 2026" is followed by "Term 1 2027"; "Semester 2 2026" by "Semester 1 2027". */
export function nextPeriodLabel(type: InstitutionType, current: string): string {
  const { period } = bursarTermsFor(type);
  const m = /(\d+)\s+(\d{4})$/.exec(current);
  if (!m) return `${period} 1 ${current.match(/\d{4}/)?.[0] ?? ""}`.trim();
  const n = Number(m[1]);
  const year = Number(m[2]);
  return n >= PERIODS_PER_YEAR(type) ? `${period} 1 ${year + 1}` : `${period} ${n + 1} ${year}`;
}

/** A sensible due date for new invoices: the latest date the fees in effect already carry, or a month from today when that has passed. */
export function suggestedDue(fees: FeeItem[], today: string): string {
  const dues = fees.filter((f) => inEffect(f, today) && f.billing === "everyone").map((f) => f.dueOn).sort();
  const latest = dues.at(-1);
  return latest && latest >= today ? latest : addDays(today, 30);
}

/**
 * Works out which invoices a run would make. A student already invoiced for
 * the period is skipped, so running it twice never bills anyone twice, and a
 * student no fee applies to is skipped too. Only fees that are on, in effect
 * and billed to everyone are used; once-a-year fees only when asked for.
 */
export function planInvoices(fees: FeeItem[], students: RollStudent[], invoices: Invoice[], input: GenerateInput, today: string): { drafts: InvoiceDraft[]; skipped: Array<{ studentNo: string; reason: "already invoiced" | "no fees apply" }> } {
  const usable = fees.filter((f) => inEffect(f, today) && f.billing === "everyone" && (f.frequency === "period" || input.includeAnnual));
  const drafts: InvoiceDraft[] = [];
  const skipped: Array<{ studentNo: string; reason: "already invoiced" | "no fees apply" }> = [];
  for (const st of students) {
    if (input.groups.length > 0 && !input.groups.includes(st.group)) continue;
    if (invoices.some((i) => i.studentNo === st.no && i.period === input.period && !i.cancelled)) {
      skipped.push({ studentNo: st.no, reason: "already invoiced" });
      continue;
    }
    const lines: InvoiceLine[] = usable.filter((f) => scopeMatches(f.scope, st.group)).map((f) => ({ kind: f.kind, name: f.name, amount: f.amount, feeId: f.id }));
    if (lines.length === 0) {
      skipped.push({ studentNo: st.no, reason: "no fees apply" });
      continue;
    }
    drafts.push({ studentNo: st.no, lines, total: lines.reduce((n, l) => n + l.amount, 0) });
  }
  return { drafts, skipped };
}

/**
 * Each invoice with what has been paid against it. A payment goes on an
 * account, not on an invoice, so what is still owed on each account is given
 * to the newest invoices first and the rest counts as paid.
 */
export function invoiceViews(invoices: Invoice[], students: Array<RollStudent & { lines: Array<{ kind: AccountKind; owed: number }> }>, today: string): InvoiceView[] {
  const byNo = new Map(students.map((s) => [s.no, s]));
  const out = new Map<string, InvoiceView>();
  for (const st of students) {
    const mine = invoices.filter((i) => i.studentNo === st.no && !i.cancelled).sort((a, b) => b.issuedOn.localeCompare(a.issuedOn) || b.id.localeCompare(a.id));
    const left = new Map(st.lines.map((l) => [l.kind, l.owed]));
    for (const inv of mine) {
      let outstanding = 0;
      for (const line of inv.lines) {
        const take = Math.min(line.amount, left.get(line.kind) ?? 0);
        left.set(line.kind, (left.get(line.kind) ?? 0) - take);
        outstanding += take;
      }
      out.set(inv.id, view(inv, st, inv.total - outstanding, outstanding, today));
    }
  }
  return invoices.map((i) => out.get(i.id) ?? view(i, byNo.get(i.studentNo), i.cancelled ? 0 : i.total, 0, today)).sort((a, b) => b.invoice.issuedOn.localeCompare(a.invoice.issuedOn) || b.invoice.no.localeCompare(a.invoice.no));
}

function view(invoice: Invoice, st: RollStudent | undefined, paid: number, outstanding: number, today: string): InvoiceView {
  const status: InvoiceStatus = invoice.cancelled ? "cancelled" : outstanding <= 0 ? "paid" : invoice.dueOn < today ? "overdue" : paid > 0 ? "partly_paid" : "unpaid";
  return { invoice, studentName: st?.name ?? invoice.studentNo, group: st?.group ?? "", paid: invoice.cancelled ? 0 : paid, outstanding: invoice.cancelled ? 0 : outstanding, status };
}

/** Nothing paid on it yet, so it can still be cancelled. */
export const canCancel = (v: Pick<InvoiceView, "invoice" | "paid">) => !v.invoice.cancelled && v.paid === 0;
