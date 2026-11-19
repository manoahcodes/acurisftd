import type { InstitutionType } from "@/config/institution";
import { RECEIPT_SEED, studentsFor } from "@/lib/cashier/seed";
import { ACCOUNT_LABELS } from "@/lib/cashier/terms";
import { bursarTermsFor } from "@/lib/bursar/terms";
import type { AccountKind } from "@/types/cashier";
import type { BankLine, Invoice, InvoiceLine, Payment, UnallocatedPayment, Waiver } from "@/types/bursar";

/**
 * Sample records for the Bursar until a real database is connected. They are
 * built from the Cashier's sample roll, owed amounts and receipts so that, for
 * every student and account, what was billed minus what was paid and waived is
 * exactly what the ledger says is still owed (tests/bursar-accounts.test.ts
 * checks this). Whole kwacha, converted to ngwee here.
 */

export const PERIOD_NO: Record<InstitutionType, number> = { primary: 3, high_school: 3, college: 2, university: 2 };
export const periodLabel = (type: InstitutionType) => `${bursarTermsFor(type).period} ${PERIOD_NO[type]} 2026`;

const K = (kwacha: number) => kwacha * 100;
const ISSUED_ON = "2026-08-31";
const DEFAULT_DUE = "2026-11-27";
export const stamp = (date: string, time = "09:00") => `${date}T${time}:00+02:00`;

/** Tuition each student paid earlier in the period through the Bursar, whole kwacha (tuition is billed first, scaled for tertiary). */
const EARLIER_TUITION = [500, 300, 1500, 200, 400, 600, 0, 250];
const EARLIER_DATES = ["2026-09-04", "2026-09-07", "2026-09-11", "2026-09-14", "2026-09-18", "2026-09-21", "2026-09-25", "2026-10-02"];
/** The approved bursary: the sixth student, on tuition. */
const WAIVED_STUDENT = 5;
const WAIVED_KWACHA = 200;

const scaleOf = (type: InstitutionType) => (bursarTermsFor(type).tertiary ? 3 : 1);

/** What the desk took (successful receipts only) per "studentNo|kind", ngwee. */
function deskPaid(type: InstitutionType): Record<string, number> {
  const roll = studentsFor(type);
  const out: Record<string, number> = {};
  for (const r of RECEIPT_SEED) {
    if (r.status !== "success") continue;
    const st = roll[r.student];
    const kind = st.lines[r.kind].kind;
    out[`${st.no}|${kind}`] = (out[`${st.no}|${kind}`] ?? 0) + K(r.kwacha);
  }
  return out;
}

export function seedPayments(type: InstitutionType): Payment[] {
  const roll = studentsFor(type);
  const out: Payment[] = [];
  roll.forEach((st, i) => {
    const kwacha = EARLIER_TUITION[i] * scaleOf(type);
    if (kwacha <= 0) return;
    const n = out.length + 1;
    const method = i % 2 === 0 ? "bank_deposit" : "mtn_money";
    out.push({
      id: `bp-${String(n).padStart(5, "0")}`, no: `BP-${String(n).padStart(5, "0")}`, source: "bursar", studentNo: st.no, studentName: st.name, group: st.group, account: "tuition", method,
      amount: K(kwacha), reference: method === "bank_deposit" ? `ZNC-77${1000 + i * 37}` : `MP2609${10 + i}.1030.B${10 + i}`, note: "", status: "success", at: stamp(EARLIER_DATES[i]), date: EARLIER_DATES[i], by: "Bursar",
    });
  });
  return out;
}

export function seedWaivers(type: InstitutionType): Waiver[] {
  const roll = studentsFor(type);
  const w = (n: number, st: number, kind: Waiver["kind"], kwacha: number, source: string, reason: string, requestedBy: string, over: Partial<Waiver> = {}): Waiver => ({
    id: `wv-${String(n).padStart(4, "0")}`, no: `WV-${String(n).padStart(4, "0")}`, studentNo: roll[st].no, studentName: roll[st].name, kind, account: "tuition", amount: K(kwacha), source, reason,
    status: "pending", requestedBy, requestedAt: stamp("2026-11-10", "10:15"), ...over,
  });
  const tertiary = bursarTermsFor(type).tertiary;
  return [
    w(1, WAIVED_STUDENT, "bursary", WAIVED_KWACHA, "Needs-based bursary (Government)", "Awarded after the household income assessment.", tertiary ? "Dean of students" : "Head teacher", { status: "approved", requestedAt: stamp("2026-09-15", "10:00"), decidedBy: "Bursar", decidedAt: stamp("2026-09-20", "11:30"), decisionNote: "Funding confirmed." }),
    w(2, 4, "waiver", 300, tertiary ? "Dean of students" : "Head teacher", "Parent lost their job this year; asked for part of the fee to be waived.", tertiary ? "Dean of students" : "Head teacher"),
    w(3, 7, "bursary", 600, "Alumni fund", "Alumni fund award for the term.", tertiary ? "Registrar" : "Deputy head"),
  ];
}

export function seedUnallocated(): UnallocatedPayment[] {
  const u = (n: number, date: string, method: UnallocatedPayment["method"], kwacha: number, reference: string, payer: string): UnallocatedPayment => ({
    id: `up-${String(n).padStart(4, "0")}`, no: `UP-${String(n).padStart(4, "0")}`, date, method, amount: K(kwacha), remaining: K(kwacha), reference, payer, note: "", status: "open", allocations: [],
  });
  return [
    u(1, "2026-11-12", "bank_deposit", 1200, "ZNC-778301", "Deposit slip has a name but no student number"),
    u(2, "2026-11-14", "mtn_money", 650, "MP261114.1215.C22", "Sent from 0966 *** 412"),
    u(3, "2026-11-16", "airtel_money", 500, "AM-5513977", "Sent from 0977 *** 058"),
  ];
}

/** One invoice per student for the period under way: what they owe, plus everything paid and waived against it. */
export function seedInvoices(type: InstitutionType): Invoice[] {
  const roll = studentsFor(type);
  const desk = deskPaid(type);
  const earlier = seedPayments(type);
  const waived = seedWaivers(type).filter((w) => w.status === "approved");
  const label = periodLabel(type);
  const out: Invoice[] = [];
  for (const st of roll) {
    const lines: InvoiceLine[] = [];
    for (const l of st.lines) {
      const paid = (desk[`${st.no}|${l.kind}`] ?? 0) + earlier.filter((p) => p.studentNo === st.no && p.account === l.kind).reduce((n, p) => n + p.amount, 0);
      const waive = waived.filter((w) => w.studentNo === st.no && w.account === l.kind).reduce((n, w) => n + w.amount, 0);
      const amount = l.owed + paid + waive;
      if (amount > 0) lines.push({ kind: l.kind as AccountKind, name: ACCOUNT_LABELS[l.kind], amount });
    }
    if (lines.length === 0) continue;
    const n = out.length + 1;
    out.push({
      id: `inv-${String(n).padStart(4, "0")}`, no: `INV-2026-${String(n).padStart(4, "0")}`, studentNo: st.no, period: label, issuedOn: ISSUED_ON,
      dueOn: st.lines.find((l) => l.dueOn)?.dueOn ?? DEFAULT_DUE, lines, total: lines.reduce((t, l) => t + l.amount, 0),
    });
  }
  return out;
}

/**
 * A statement the Bursar has already loaded. Most lines match the desk's
 * receipts and the unallocated deposit; one is for a different amount, and two
 * are money the books know nothing about (a deposit with no payment, and a bank
 * charge to ignore).
 */
export function seedBankLines(): BankLine[] {
  const l = (n: number, date: string, reference: string, kwacha: number, description: string): BankLine => ({
    id: `bl-${String(n).padStart(4, "0")}`, date, reference, amount: K(kwacha), description, importedAt: `${date}T18:00:00+02:00`, importedBy: "Finance office",
  });
  return [
    l(1, "2026-11-15", "MP261115.0930.B07", 700, "MTN MoMo collection"),
    l(2, "2026-11-16", "MP261116.0810.A41", 500, "MTN MoMo collection"),
    l(3, "2026-11-16", "ZNC-778213", 1200, "ZNC deposit"),
    l(4, "2026-11-16", "AM-5513902", 400, "Airtel collection"),
    l(5, "2026-11-16", "AM-5514417", 300, "Airtel collection"),
    l(6, "2026-11-16", "ZNC-778290", 650, "ZNC deposit"),
    l(7, "2026-11-12", "ZNC-778301", 1200, "ZNC deposit"),
    l(8, "2026-11-16", "ZNC-778350", 800, "ZNC deposit, no student named"),
    l(9, "2026-11-16", "BANK-CHG-1116", 15, "Bank charges reversal"),
    l(10, "2026-11-14", "MP261114.1215.C22", 650, "MTN MoMo collection"),
    l(11, "2026-11-16", "AM-5513977", 500, "Airtel collection"),
  ];
}
