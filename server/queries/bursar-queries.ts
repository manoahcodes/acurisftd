import { hrefForNavLabel } from "@/config/navigation";
import { debtorsOf } from "@/lib/bursar/debtors";
import { overviewOf, type BursarOverview } from "@/lib/bursar/overview";
import { formatKwacha } from "@/lib/money";
import type { Dashboard, Row } from "@/types/dashboard";
import type { SearchResult } from "@/types/directory";
import type { NotificationSummary } from "@/types/topbar";
import { bursar } from "../repositories";
import type { BursarSession } from "../bursar-context";

const MAX_RESULTS = 8;
type S = Pick<BursarSession, "ctx" | "terms">;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Every figure the Bursar's dashboard, sidebar and bell show, from the Bursar's own records. */
export async function bursarFigures(s: S) {
  const { ctx } = s;
  const [accounts, payments, unallocated, waivers, plans, book, lines] = await Promise.all([bursar.listAccounts(ctx), bursar.listPayments(ctx), bursar.listUnallocated(ctx), bursar.listWaivers(ctx), bursar.listPlans(ctx), bursar.listCashUps(ctx), bursar.listBankLines(ctx)]);
  return { accounts, plans, overview: overviewOf({ accounts, payments, unallocated, waivers, plans, book, lines, today: ctx.today }) };
}

/** Sidebar badges: what is waiting on each page. */
export async function bursarBadges(s: S): Promise<Record<string, number>> {
  const { overview: o } = await bursarFigures(s);
  return { "Student accounts": o.openUnallocated + o.pendingWaivers, Debtors: o.overdueDebtors, Reconciliation: o.reconciliation };
}

/** Replaces the sample figures on the Bursar dashboard with the school's own books. */
export async function bursarDashboard(data: Dashboard, s: S): Promise<Dashboard> {
  const { overview: o, accounts, plans } = await bursarFigures(s);
  const owing = debtorsOf(accounts, plans, [], s.ctx.today).slice(0, 3);
  const attention: Row[] = owing.map((d) => ({ cells: [d.account.no, d.account.name, `${formatKwacha(d.account.owed)}${d.daysOverdue > 0 ? ` overdue ${d.daysOverdue} days` : " owed"}`, d.plan ? "On a plan" : `Contact ${s.terms.payer.toLowerCase()}`] }));
  return {
    ...data,
    kpis: data.kpis.map((k) => {
      if (k.title === "Collected today") return { ...k, value: formatKwacha(o.collectedToday), note: plural(o.paymentsToday, "payment") };
      if (k.title === "Outstanding fees") return { ...k, caption: `All active ${s.terms.member.toLowerCase()}s`, value: formatKwacha(o.owed), note: `${plural(o.overdueDebtors, "account")} overdue` };
      if (k.title === "Unallocated payments") return { ...k, value: formatKwacha(o.unallocatedAmount), note: plural(o.openUnallocated, "payment") };
      if (k.title === "Reconciliation") return { ...k, value: o.reconciliation > 0 ? `${o.reconciliation} to check` : "Up to date", note: o.reconciliation > 0 ? `${plural(o.cashUpsToReview, "cash-up")} to review, ${plural(o.statementIssues, "statement line")}` : "Nothing waiting" };
      return k;
    }),
    sections: data.sections.map((sec) => {
      if (sec.title === "Collections by payment method") {
        return { ...sec, rows: [
          { cells: ["Mobile money", formatKwacha(o.today.mobile), plural(o.today.mobileCount, "transaction")] },
          { cells: ["Bank deposit", formatKwacha(o.today.bank), plural(o.today.bankCount, "transaction")] },
          { cells: ["Cash", formatKwacha(o.today.cash), plural(o.today.cashCount, "transaction")] },
          { cells: ["Total", formatKwacha(o.collectedToday), plural(o.paymentsToday, "transaction")] },
        ] };
      }
      if (sec.title === "Accounts needing attention") return { ...sec, rows: attention.length ? attention : [{ cells: ["Nobody owes anything"] }] };
      return sec;
    }),
  };
}

/** The bell: what needs the Bursar's decision, each linking to its page. */
export async function bursarNotifications(s: S): Promise<NotificationSummary> {
  const { overview: o } = await bursarFigures(s);
  const href = (label: string) => hrefForNavLabel("bursar", label, "Bursar notifications");
  const items = [
    ...(o.openUnallocated > 0 ? [{ id: "unallocated", title: `${plural(o.openUnallocated, "unallocated payment")}`, detail: `${formatKwacha(o.unallocatedAmount)} needs allocating`, href: href("Student accounts"), unread: true }] : []),
    ...(o.pendingWaivers > 0 ? [{ id: "waivers", title: `${plural(o.pendingWaivers, "bursary or waiver")} to decide`, detail: `${formatKwacha(o.pendingWaiverAmount)} requested`, href: href("Student accounts"), unread: true }] : []),
    ...(o.reconciliation > 0 ? [{ id: "reconciliation", title: `${o.reconciliation} to check in Reconciliation`, detail: `${plural(o.cashUpsToReview, "cash-up")}, ${plural(o.daysNotCashedUp, "day")} not cashed up, ${plural(o.statementIssues, "statement line")}`, href: href("Reconciliation"), unread: true }] : []),
    ...(o.overdueDebtors > 0 ? [{ id: "debtors", title: `${plural(o.overdueDebtors, "account")} overdue`, detail: `${formatKwacha(o.overdueAmount)} past due${o.behindPlans ? `, ${o.behindPlans} behind on a plan` : ""}`, href: href("Debtors"), unread: true }] : []),
  ];
  return { unreadCount: items.length, items };
}

/** Search across the school's students, payments and invoices. */
export async function searchBursar(s: S, query: string): Promise<SearchResult[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const { ctx } = s;
  const [accounts, payments, invoices] = await Promise.all([bursar.listAccounts(ctx), bursar.listPayments(ctx), bursar.listInvoices(ctx)]);
  const names = new Map(accounts.map((a) => [a.no, a.name]));
  const entries: Array<SearchResult & { text: string }> = [
    ...accounts.map((a) => ({ id: `student-${a.no}`, title: a.name, subtitle: `${a.no} · ${a.group} · ${formatKwacha(a.owed)} owed`, kind: s.terms.member, href: hrefForNavLabel("bursar", "Student accounts", "Bursar search"), text: `${a.no} ${a.name} ${a.group}` })),
    ...payments.map((p) => ({ id: `payment-${p.id}`, title: p.no, subtitle: `${p.studentName} · ${formatKwacha(p.amount)} · ${p.status === "reversed" ? "Reversed" : p.status === "pending" ? "Pending" : "Paid"}`, kind: "Payment", href: hrefForNavLabel("bursar", "Record payment", "Bursar search"), text: `${p.no} ${p.studentNo} ${p.studentName} ${p.reference}` })),
    ...invoices.map((inv) => ({ id: `invoice-${inv.id}`, title: inv.no, subtitle: `${names.get(inv.studentNo) ?? inv.studentNo} · ${formatKwacha(inv.total)} · ${inv.period}`, kind: "Invoice", href: hrefForNavLabel("bursar", "Invoices", "Bursar search"), text: `${inv.no} ${inv.studentNo} ${names.get(inv.studentNo) ?? ""}` })),
  ];
  return entries.filter((e) => e.text.toLowerCase().includes(q)).slice(0, MAX_RESULTS).map((e): SearchResult => ({ id: e.id, title: e.title, subtitle: e.subtitle, kind: e.kind, href: e.href }));
}

export type { BursarOverview };
