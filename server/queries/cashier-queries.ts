import { hrefForNavLabel } from "@/config/navigation";
import { METHOD_LABELS } from "@/lib/cashier/methods";
import { statusLabel } from "@/lib/cashier/format";
import { ACCOUNT_LABELS } from "@/lib/cashier/terms";
import { formatKwacha } from "@/lib/money";
import { prettyDate } from "@/lib/teacher/dates";
import type { Dashboard } from "@/types/dashboard";
import type { SearchResult } from "@/types/directory";
import type { NotificationSummary } from "@/types/topbar";
import { cashier } from "../repositories";
import type { CashierSession } from "../cashier-context";

const MAX_RESULTS = 8;

/** The desk's own figures for today, for the sidebar badge, the bell and the dashboard. */
export const cashierToday = async (s: Pick<CashierSession, "ctx">) => cashier.getDay(s.ctx, s.ctx.today);

/** Replaces the sample figures on the Cashier dashboard with the desk's own records. */
export async function cashierDashboard(data: Dashboard, s: Pick<CashierSession, "ctx">): Promise<Dashboard> {
  const [day, receipts, history] = await Promise.all([cashierToday(s), cashier.listReceipts(s.ctx), cashier.listCashUps(s.ctx)]);
  const todays = receipts.filter((r) => r.date === s.ctx.today).slice(0, 4);
  const last = history.find((h) => h.date !== s.ctx.today);
  const variance = day.cashUp ? day.cashUp.variance : 0;
  return {
    ...data,
    kpis: data.kpis.map((k) => {
      if (k.title === "Transactions today") return { ...k, value: String(day.count), note: day.voided ? `${day.voided} voided, not counted` : "Across all methods" };
      if (k.title === "Amount collected") return { ...k, value: formatKwacha(day.collected), note: "Confirmed receipts" };
      if (k.title === "Pending receipts") return { ...k, value: String(day.pending), note: day.pending ? `${formatKwacha(day.pendingAmount)} to confirm` : "Nothing to confirm" };
      if (k.title === "Cash drawer") return { ...k, value: formatKwacha(day.expectedCash), note: "Cash payments only" };
      return k;
    }),
    sections: data.sections.map((sec) => {
      if (sec.title === "Recent transactions") {
        return { ...sec, rows: todays.length ? todays.map((r) => ({ cells: [r.no, r.studentNo, formatKwacha(r.amount), METHOD_LABELS[r.method], statusLabel(r.status)] })) : [{ cells: ["No payments taken today"] }] };
      }
      if (sec.title === "End-of-day cash-up") {
        return {
          ...sec,
          rows: [
            { cells: [`Expected cash  ${formatKwacha(day.expectedCash)}`, day.cashUp ? `Counted  ${formatKwacha(day.cashUp.counted)}` : "Not counted yet", day.cashUp ? `Variance  ${formatKwacha(Math.abs(variance))}` : "Variance  pending"] },
            { cells: [`Mobile money  ${formatKwacha(day.byMethod.airtel_money + day.byMethod.mtn_money + day.byMethod.zamtel_money)}`, `Bank  ${formatKwacha(day.byMethod.bank_deposit)}`] },
            { cells: [day.cashUp ? "Today: submitted, day closed" : "Today: not submitted", last ? `Last cash-up: ${prettyDate(last.date)}` : "No earlier cash-up"] },
          ],
        };
      }
      return sec;
    }),
  };
}

/** The bell: pending receipts to confirm, then a cash-up still to submit. */
export async function cashierNotifications(s: Pick<CashierSession, "ctx">): Promise<NotificationSummary> {
  const day = await cashierToday(s);
  const txHref = hrefForNavLabel("cashier", "Today's transactions", "Cashier notifications");
  const cashUpHref = hrefForNavLabel("cashier", "Cash-up", "Cashier notifications");
  const items = [
    ...(day.pending > 0 ? [{ id: "pending", title: `${day.pending} ${day.pending === 1 ? "receipt" : "receipts"} pending`, detail: `${formatKwacha(day.pendingAmount)} to confirm`, href: txHref, unread: true }] : []),
    ...(!day.cashUp ? [{ id: "cash-up", title: "Cash-up not submitted", detail: `Expected cash ${formatKwacha(day.expectedCash)}`, href: cashUpHref, unread: true }] : []),
  ];
  return { unreadCount: items.length, items };
}

/** Search across this desk's own students and receipts. */
export async function searchCashier(s: Pick<CashierSession, "ctx" | "terms">, query: string): Promise<SearchResult[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const [students, receipts] = await Promise.all([cashier.listStudents(s.ctx), cashier.listReceipts(s.ctx)]);
  const find = hrefForNavLabel("cashier", "Find student", "Cashier search");
  const print = hrefForNavLabel("cashier", "Print receipt", "Cashier search");
  const entries: Array<SearchResult & { text: string }> = [
    ...students.map((st) => ({ id: `student-${st.no}`, title: st.name, subtitle: `${st.no} · ${st.group} · ${formatKwacha(st.total)} owed`, kind: s.terms.member, href: find, text: `${st.no} ${st.name} ${st.group}` })),
    ...receipts.map((r) => ({ id: `receipt-${r.id}`, title: r.no, subtitle: `${r.studentNo} · ${formatKwacha(r.amount)} · ${METHOD_LABELS[r.method]} · ${statusLabel(r.status)} · ${ACCOUNT_LABELS[r.account]}`, kind: "Receipt", href: print, text: `${r.no} ${r.studentNo} ${r.studentName} ${r.reference}` })),
  ];
  return entries.filter((e) => e.text.toLowerCase().includes(q)).slice(0, MAX_RESULTS).map((e): SearchResult => ({ id: e.id, title: e.title, subtitle: e.subtitle, kind: e.kind, href: e.href }));
}
