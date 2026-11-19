"use client";

import { useMemo, useState } from "react";
import { Card, ExportBar, Field, Stat, buttonClass, downloadCsv, inputClass, primaryClass } from "@/components/teacher/shared";
import { PrintSheet, PrintTable } from "@/components/platform/print-sheet";
import { BUCKET_LABEL, agingTotals, debtorsOf } from "@/lib/bursar/debtors";
import { waiverKindLabel } from "@/lib/bursar/format";
import { PRESETS, PRESET_LABEL, collections, inRange, positionByGroup, rangeOf, reversedIn, waiverSummary, type Preset } from "@/lib/bursar/reports";
import type { BursarTerms } from "@/lib/bursar/terms";
import { isIsoDate } from "@/lib/bursar/validate";
import { METHOD_LABELS } from "@/lib/cashier/methods";
import { ACCOUNT_LABELS } from "@/lib/cashier/terms";
import { formatKwacha } from "@/lib/money";
import type { PrintBranding } from "@/lib/print";
import { csvFilename } from "@/lib/table-tools";
import { prettyDate } from "@/lib/teacher/dates";
import { ACCOUNT_KINDS, METHOD_IDS } from "@/types/cashier";
import type { AccountRow, Payment, PaymentPlan, Waiver } from "@/types/bursar";

type Report = "collections" | "position" | "ageing" | "waivers";
const REPORTS: Array<[Report, string]> = [["collections", "Collections"], ["position", "Fee position"], ["ageing", "Ageing"], ["waivers", "Bursaries and reversals"]];

const Bar = ({ value, max }: { value: number; max: number }) => (
  <span className="block h-2.5 rounded-full bg-canvas" aria-hidden><span className="block h-full rounded-full bg-brand" style={{ width: `${max > 0 ? (value / max) * 100 : 0}%` }} /></span>
);

/** Financial reports: what was collected, where each class stands, how old the debt is, and bursaries and reversals. */
export function ReportsView({ accounts, payments, waivers, plans, terms, today, branding }: { accounts: AccountRow[]; payments: Payment[]; waivers: Waiver[]; plans: PaymentPlan[]; terms: BursarTerms; today: string; branding: PrintBranding }) {
  const [report, setReport] = useState<Report>("collections");
  const [preset, setPreset] = useState<Preset | "custom">("30d");
  const [custom, setCustom] = useState({ from: rangeOf("30d", today).from, to: today });
  const [printing, setPrinting] = useState(false);

  const customOk = isIsoDate(custom.from) && isIsoDate(custom.to) && custom.from <= custom.to && custom.to <= today;
  const range = useMemo(() => (preset === "custom" ? (customOk ? custom : rangeOf("30d", today)) : rangeOf(preset, today)), [preset, custom, customOk, today]);
  const label = `${prettyDate(range.from)} to ${prettyDate(range.to)}`;

  const col = useMemo(() => collections(payments, range), [payments, range]);
  const pos = useMemo(() => positionByGroup(accounts), [accounts]);
  const debtors = useMemo(() => debtorsOf(accounts, plans, [], today), [accounts, plans, today]);
  const aging = useMemo(() => agingTotals(debtors), [debtors]);
  const wv = useMemo(() => waiverSummary(waivers, range), [waivers, range]);
  const reversed = useMemo(() => reversedIn(payments, range), [payments, range]);
  const pending = payments.filter((p) => p.status === "pending" && inRange(p.date, range));

  const accountRows = ACCOUNT_KINDS.filter((k) => col.byAccount[k] > 0).map((k) => [ACCOUNT_LABELS[k], formatKwacha(col.byAccount[k])]);
  const methodRows = METHOD_IDS.filter((m) => col.byMethod[m] > 0).map((m) => [METHOD_LABELS[m], formatKwacha(col.byMethod[m])]);
  const dayRows = col.byDay.map((d) => [prettyDate(d.date), String(d.count), formatKwacha(d.amount)]);
  const posRows = [...pos.rows, pos.total].map((g) => [g.group, String(g.students), formatKwacha(g.billed), formatKwacha(g.paid), formatKwacha(g.waived), formatKwacha(g.owed), `${g.rate}%`]);
  const POS_COLUMNS = [terms.group, `${terms.member}s`, "Billed", "Paid", "Waived", "Owed", "Paid so far"];
  const ageRows = aging.map((a) => [BUCKET_LABEL[a.bucket], String(a.count), formatKwacha(a.amount)]);
  const reversedRows = reversed.map((p) => [p.no, p.studentName, formatKwacha(p.amount), p.reversal?.reason ?? "", p.reversal?.by ?? ""]);
  const waiverRows = wv.approved.map((a) => [waiverKindLabel(a.kind), String(a.count), formatKwacha(a.amount)]);

  const sheets: Record<Report, { title: string; tables: Array<{ heading: string; columns: string[]; rows: string[][] }> }> = {
    collections: { title: "Collections", tables: [{ heading: "By account", columns: ["Account", "Collected"], rows: accountRows }, { heading: "By payment method", columns: ["Method", "Collected"], rows: methodRows }, { heading: "By day", columns: ["Day", "Payments", "Collected"], rows: dayRows }] },
    position: { title: "Fee position", tables: [{ heading: `By ${terms.group.toLowerCase()}`, columns: POS_COLUMNS, rows: posRows }] },
    ageing: { title: "Debtor ageing", tables: [{ heading: "Owed by age of debt", columns: ["Age", terms.member + "s", "Owed"], rows: ageRows }] },
    waivers: { title: "Bursaries, waivers and reversals", tables: [{ heading: "Approved", columns: ["Type", "Count", "Amount"], rows: waiverRows }, { heading: "Payments reversed", columns: ["Receipt", terms.member, "Amount", "Reason", "By"], rows: reversedRows }] },
  };
  const sheet = sheets[report];
  const dated = report === "collections" || report === "waivers";
  const csv = () => downloadCsv(csvFilename(sheet.title, today), sheet.tables.flatMap((t, i) => [...(i ? [[]] : []), [t.heading], t.columns, ...t.rows]));
  const maxDay = Math.max(1, ...col.byDay.map((d) => d.amount));

  return (
    <div className="mt-6 space-y-6">
      <div role="tablist" aria-label="Reports" className="flex flex-wrap gap-2">
        {REPORTS.map(([id, text]) => <button key={id} type="button" role="tab" aria-selected={report === id} onClick={() => setReport(id)} className={report === id ? primaryClass : buttonClass}>{text}</button>)}
      </div>

      <Card>
        <div className="flex flex-wrap items-end justify-between gap-3">
          {dated ? (
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Period">
                {(p) => (
                  <select {...p} value={preset} onChange={(e) => setPreset(e.target.value as Preset | "custom")} className={inputClass}>
                    {PRESETS.map((x) => <option key={x} value={x}>{PRESET_LABEL[x]}</option>)}
                    <option value="custom">Custom dates</option>
                  </select>
                )}
              </Field>
              {preset === "custom" && (
                <>
                  <Field label="From" error={!customOk ? "Check the dates." : undefined}>{(p) => <input {...p} type="date" max={today} value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} className={inputClass} />}</Field>
                  <Field label="To">{(p) => <input {...p} type="date" max={today} value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })} className={inputClass} />}</Field>
                </>
              )}
            </div>
          ) : <p className="text-[15px] text-muted">As at {prettyDate(today)}</p>}
          <ExportBar onCsv={csv} onPrint={() => setPrinting(true)} />
        </div>
        {dated && <p className="mt-2 text-sm text-muted" role="status">{label}</p>}
      </Card>

      {report === "collections" && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Collected" value={formatKwacha(col.total)} note={`${col.count} payments`} />
            <Stat label="Average per day" value={formatKwacha(col.byDay.length ? Math.round(col.total / col.byDay.length) : 0)} note={`${col.byDay.length} days with payments`} />
            <Stat label="Pending, not counted" value={formatKwacha(pending.reduce((n, p) => n + p.amount, 0))} note={`${pending.length} waiting for confirmation`} />
            <Stat label="Reversed" value={formatKwacha(reversed.reduce((n, p) => n + p.amount, 0))} note={`${reversed.length} payments`} />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            {[{ title: "By account", rows: accountRows }, { title: "By payment method", rows: methodRows }].map((t) => (
              <Card key={t.title}>
                <h2 className="text-lg font-semibold text-ink">{t.title}</h2>
                {t.rows.length === 0 ? <p className="mt-2 text-[15px] text-muted">Nothing collected in this period.</p> : (
                  <ul className="mt-2 divide-y divide-line">{t.rows.map(([k, v]) => <li key={k} className="flex justify-between py-2 text-[15px]"><span className="text-ink">{k}</span><span className="font-medium text-ink">{v}</span></li>)}</ul>
                )}
              </Card>
            ))}
          </div>
          <Card>
            <h2 className="text-lg font-semibold text-ink">By day</h2>
            {col.byDay.length === 0 ? <p className="mt-2 text-[15px] text-muted">Nothing collected in this period.</p> : (
              <ul className="mt-2 space-y-2">
                {col.byDay.map((d) => (
                  <li key={d.date} className="grid grid-cols-[9rem_1fr_auto] items-center gap-3 text-[15px]">
                    <span className="text-ink">{prettyDate(d.date)}</span><Bar value={d.amount} max={maxDay} />
                    <span className="text-right text-ink">{formatKwacha(d.amount)} <span className="text-sm text-muted">({d.count})</span></span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}

      {report === "position" && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Billed" value={formatKwacha(pos.total.billed)} />
            <Stat label="Paid" value={formatKwacha(pos.total.paid)} note={`${pos.total.rate}% of what was due`} />
            <Stat label="Waived" value={formatKwacha(pos.total.waived)} />
            <Stat label="Still owed" value={formatKwacha(pos.total.owed)} />
          </div>
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full min-w-176 text-left text-[15px]">
                <thead><tr className="border-b border-line text-sm text-muted">
                  <th className="py-2 pr-3 font-medium">{terms.group}</th><th className="py-2 pr-3 text-right font-medium">{terms.member}s</th><th className="py-2 pr-3 text-right font-medium">Billed</th><th className="py-2 pr-3 text-right font-medium">Paid</th><th className="py-2 pr-3 text-right font-medium">Waived</th><th className="py-2 pr-3 text-right font-medium">Owed</th><th className="w-40 py-2 font-medium">Paid so far</th>
                </tr></thead>
                <tbody>
                  {[...pos.rows, pos.total].map((g, i, all) => (
                    <tr key={g.group} className={`border-b border-line last:border-0 ${i === all.length - 1 ? "font-semibold" : ""}`}>
                      <td className="py-2 pr-3 text-ink">{g.group}</td><td className="py-2 pr-3 text-right text-ink">{g.students}</td><td className="py-2 pr-3 text-right text-ink">{formatKwacha(g.billed)}</td><td className="py-2 pr-3 text-right text-ink">{formatKwacha(g.paid)}</td><td className="py-2 pr-3 text-right text-muted">{formatKwacha(g.waived)}</td><td className="py-2 pr-3 text-right text-ink">{formatKwacha(g.owed)}</td>
                      <td className="py-2"><span className="flex items-center gap-2"><span className="flex-1"><Bar value={g.rate} max={100} /></span><span className="w-10 text-right text-sm text-muted">{g.rate}%</span></span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {report === "ageing" && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Total owed" value={formatKwacha(debtors.reduce((n, d) => n + d.account.owed, 0))} note={`${debtors.length} ${terms.member.toLowerCase()}s`} />
            <Stat label="Overdue" value={formatKwacha(debtors.filter((d) => d.daysOverdue > 0).reduce((n, d) => n + d.account.owed, 0))} />
            <Stat label="Over 90 days" value={formatKwacha(aging.find((a) => a.bucket === "d90_plus")?.amount ?? 0)} />
          </div>
          <Card>
            <ul className="space-y-2">
              {aging.map((a) => (
                <li key={a.bucket} className="grid grid-cols-[8rem_1fr_auto] items-center gap-3 text-[15px]">
                  <span className="text-ink">{BUCKET_LABEL[a.bucket]}</span><Bar value={a.amount} max={Math.max(1, ...aging.map((x) => x.amount))} />
                  <span className="text-right text-ink">{formatKwacha(a.amount)} <span className="text-sm text-muted">({a.count})</span></span>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}

      {report === "waivers" && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Approved" value={formatKwacha(wv.approvedAmount)} note="Bursaries, waivers and discounts" />
            <Stat label="Waiting for a decision" value={String(wv.pending)} note={formatKwacha(wv.pendingAmount)} />
            <Stat label="Payments reversed" value={String(reversed.length)} note={formatKwacha(reversed.reduce((n, p) => n + p.amount, 0))} />
          </div>
          <Card>
            <h2 className="text-lg font-semibold text-ink">Approved in this period</h2>
            <ul className="mt-2 divide-y divide-line">{wv.approved.map((a) => <li key={a.kind} className="flex justify-between py-2 text-[15px]"><span className="text-ink">{waiverKindLabel(a.kind)} <span className="text-sm text-muted">({a.count})</span></span><span className="font-medium text-ink">{formatKwacha(a.amount)}</span></li>)}</ul>
          </Card>
          <Card>
            <h2 className="text-lg font-semibold text-ink">Payments reversed</h2>
            {reversed.length === 0 ? <p className="mt-2 text-[15px] text-muted">None in this period.</p> : (
              <ul className="mt-2 divide-y divide-line">{reversed.map((p) => <li key={p.id} className="py-2 text-[15px]"><span className="flex justify-between text-ink"><span>{p.no}, {p.studentName}</span><span className="font-medium">{formatKwacha(p.amount)}</span></span><span className="block text-sm text-muted">{p.reversal?.reason} • {p.reversal?.by}</span></li>)}</ul>
            )}
          </Card>
        </>
      )}

      {printing && (
        <PrintSheet branding={branding} title={sheet.title} lines={[dated ? label : `As at ${prettyDate(today)}`]} onClose={() => setPrinting(false)}>
          {sheet.tables.map((t) => (
            <div key={t.heading} className="mb-6">
              <h2 className="mb-2 text-lg font-semibold">{t.heading}</h2>
              <PrintTable columns={t.columns} rows={t.rows} />
            </div>
          ))}
        </PrintSheet>
      )}
    </div>
  );
}
