import { safeZone } from "@/lib/format";
import { formatKwacha } from "@/lib/money";
import type { Receipt } from "@/types/cashier";
import { ACCOUNT_LABELS } from "./terms";
import { METHOD_LABELS } from "./methods";

/** "08:41" in the school's zone. */
export function timeIn(iso: string, zone?: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: safeZone(zone) }).format(d);
}

/** An ngwee amount as the text typed into an amount box: "850" or "850.50". */
export const ngweeToInput = (ngwee: number) => (ngwee % 100 === 0 ? String(ngwee / 100) : (ngwee / 100).toFixed(2));

export const statusLabel = (s: Receipt["status"]) => (s === "success" ? "Success" : s === "pending" ? "Pending" : "Voided");

export const varianceText = (v: number) => (v === 0 ? "No difference" : `${v > 0 ? "Over" : "Short"} ${formatKwacha(Math.abs(v))}`);

/** Columns and rows for the receipt list (CSV and print). */
export const RECEIPT_COLUMNS = ["Receipt", "Time", "Student number", "Student", "Account", "Method", "Reference", "Amount", "Status"];
export function receiptRows(receipts: Receipt[], zone?: string): string[][] {
  return receipts.map((r) => [r.no, timeIn(r.at, zone), r.studentNo, r.studentName, ACCOUNT_LABELS[r.account], METHOD_LABELS[r.method], r.reference, formatKwacha(r.amount), statusLabel(r.status)]);
}
