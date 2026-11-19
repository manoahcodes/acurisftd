import { formatKwacha } from "@/lib/money";
import { prettyDate } from "@/lib/teacher/dates";
import { ACCOUNT_LABELS } from "@/lib/cashier/terms";
import { inEffect, scopeLabel } from "./fees";
import { METHOD_LABELS } from "@/lib/cashier/methods";
import type { AccountRow, FeeItem, InvoiceStatus, InvoiceView, Payment, StatementEntry, UnallocatedPayment, Waiver } from "@/types/bursar";

/** Wording and table rows for the Bursar pages. Pure. */

export const FREQUENCY_LABEL = (f: FeeItem["frequency"], period: string) => (f === "year" ? "Per year" : `Per ${period.toLowerCase()}`);
export const BILLING_LABEL: Record<FeeItem["billing"], string> = { everyone: "Everyone it applies to", optional: "Optional" };

export type FeeState = "active" | "scheduled" | "off";

/** On and in effect, on but not yet in effect, or off. */
export const feeState = (f: Pick<FeeItem, "active" | "effectiveFrom">, today: string): FeeState => (!f.active ? "off" : inEffect(f, today) ? "active" : "scheduled");
export const feeStateLabel = (f: Pick<FeeItem, "active" | "effectiveFrom">, today: string) => {
  const s = feeState(f, today);
  return s === "active" ? "Active" : s === "scheduled" ? `Starts ${prettyDate(f.effectiveFrom)}` : "Off";
};

export const FEE_COLUMNS = ["Fee", "Account", "Applies to", "Amount", "Frequency", "Billed to", "Due", "Status"];
export function feeRows(fees: FeeItem[], period: string, today: string): string[][] {
  return fees.map((f) => [f.name, ACCOUNT_LABELS[f.kind], scopeLabel(f.scope), formatKwacha(f.amount), FREQUENCY_LABEL(f.frequency, period), BILLING_LABEL[f.billing], prettyDate(f.dueOn), feeStateLabel(f, today)]);
}

export const ACCOUNT_COLUMNS = ["Student number", "Name", "Class or programme", "Billed", "Paid", "Waived", "Owed", "Due", "Status"];
export const accountStatusLabel = (a: Pick<AccountRow, "status" | "owed">) => (a.owed <= 0 ? "Cleared" : a.status === "overdue" ? "Overdue" : "Owing");
export function accountRows(rows: AccountRow[]): string[][] {
  return rows.map((a) => [a.no, a.name, a.group, formatKwacha(a.billed), formatKwacha(a.paid), formatKwacha(a.waived), formatKwacha(a.owed), a.dueOn && a.owed > 0 ? prettyDate(a.dueOn) : "", accountStatusLabel(a)]);
}

export const STATEMENT_COLUMNS = ["Date", "Description", "Reference", "Charged", "Paid or credited", "Owed after"];
export const statementRows = (entries: StatementEntry[]): string[][] =>
  entries.map((e) => [prettyDate(e.date), e.description, e.reference, e.charge ? formatKwacha(e.charge) : "", e.credit ? formatKwacha(e.credit) : "", formatKwacha(e.balance)]);

export const paymentStatusLabel = (s: Payment["status"]) => (s === "success" ? "Success" : s === "pending" ? "Pending" : "Reversed");
export const waiverKindLabel = (k: Waiver["kind"]) => (k === "bursary" ? "Bursary" : k === "discount" ? "Discount" : "Waiver");
export const waiverStatusLabel = (s: Waiver["status"]) => (s === "pending" ? "Pending" : s === "approved" ? "Approved" : "Declined");

export const UNALLOCATED_COLUMNS = ["Number", "Received", "Method", "Reference", "Amount", "Left to allocate", "Sender", "Status"];
export const unallocatedRows = (rows: UnallocatedPayment[]): string[][] =>
  rows.map((u) => [u.no, prettyDate(u.date), METHOD_LABELS[u.method], u.reference, formatKwacha(u.amount), formatKwacha(u.remaining), u.payer, u.status === "open" ? "Waiting" : "Allocated"]);

export const WAIVER_COLUMNS = ["Number", "Student number", "Student", "Type", "Account", "Amount", "From", "Requested by", "Status"];
export const waiverRows = (rows: Waiver[]): string[][] => rows.map((w) => [w.no, w.studentNo, w.studentName, waiverKindLabel(w.kind), ACCOUNT_LABELS[w.account], formatKwacha(w.amount), w.source, w.requestedBy, waiverStatusLabel(w.status)]);

export const sourceLabel = (s: Payment["source"]) => (s === "cashier" ? "Cashier desk" : s === "bursar" ? "Bursar" : "Allocated");

export const PAYMENT_COLUMNS = ["Receipt", "Date", "Student number", "Student", "Account", "Method", "Reference", "Amount", "Taken by", "Status"];
export const paymentRows = (rows: Payment[]): string[][] =>
  rows.map((p) => [p.no, prettyDate(p.date), p.studentNo, p.studentName, ACCOUNT_LABELS[p.account], METHOD_LABELS[p.method], p.reference, formatKwacha(p.amount), `${sourceLabel(p.source)}, ${p.by}`, paymentStatusLabel(p.status)]);

export const invoiceStatusLabel = (s: InvoiceStatus) => ({ paid: "Paid", partly_paid: "Partly paid", unpaid: "Unpaid", overdue: "Overdue", cancelled: "Cancelled" })[s];

export const INVOICE_COLUMNS = ["Invoice", "Period", "Student number", "Student", "Issued", "Due", "Total", "Paid", "Outstanding", "Status"];
export const invoiceRows = (rows: InvoiceView[]): string[][] =>
  rows.map((v) => [v.invoice.no, v.invoice.period, v.invoice.studentNo, v.studentName, prettyDate(v.invoice.issuedOn), prettyDate(v.invoice.dueOn), formatKwacha(v.invoice.total), formatKwacha(v.paid), formatKwacha(v.outstanding), invoiceStatusLabel(v.status)]);
