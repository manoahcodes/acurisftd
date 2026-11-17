"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Lock, Printer } from "lucide-react";
import { Card, Chip, Dialog, Field, Stat, buttonClass, inputClass, primaryClass } from "@/components/teacher/shared";
import { DetailsList, PrintSheet, PrintTable } from "@/components/platform/print-sheet";
import { hrefForNavLabel } from "@/config/navigation";
import { submitCashUp } from "@/server/actions/cashier";
import { METHOD_LABELS } from "@/lib/cashier/methods";
import { varianceText } from "@/lib/cashier/format";
import { countedTotal, DENOMINATIONS, denominationLabel, LIMITS, MAX_COUNT_PER_DENOMINATION } from "@/lib/cashier/validate";
import { formatStamp } from "@/lib/format";
import { prettyDate } from "@/lib/teacher/dates";
import { formatKwacha } from "@/lib/money";
import type { PrintBranding } from "@/lib/print";
import { METHOD_IDS, type CashUp, type DaySummary, type DenominationCounts } from "@/types/cashier";

const tone = (v: number) => (v === 0 ? ("good" as const) : v > 0 ? ("warn" as const) : ("bad" as const));

/** The day's cash-up: count the drawer by denomination, compare with what receipts say, explain any difference, then submit (which locks the day). */
export function CashUpView({ day, history, today, branding }: { day: DaySummary; history: CashUp[]; today: string; branding: PrintBranding }) {
  const [typed, setTyped] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [printing, setPrinting] = useState<CashUp | "history" | null>(null);
  const [busy, start] = useTransition();

  const submitted = day.cashUp;
  const parsed: DenominationCounts = {};
  const bad: Record<string, string> = {};
  for (const d of DENOMINATIONS) {
    const text = (typed[String(d)] ?? "").trim();
    if (!text) continue;
    const n = Number(text);
    if (!/^\d+$/.test(text) || n > MAX_COUNT_PER_DENOMINATION) bad[String(d)] = "Whole number from 0.";
    else if (n > 0) parsed[String(d)] = n;
  }
  const counted = countedTotal(parsed);
  const variance = counted - day.expectedCash;
  const hasBad = Object.keys(bad).length > 0;
  const blocked = day.pending > 0;

  const open = () => {
    if (hasBad) return setError("Fix the counts marked in red.");
    if (variance !== 0 && !reason.trim()) {
      setErrors({ reason: "A reason is required when the count differs." });
      return setError(`The count is ${variance > 0 ? "over" : "short"}. Say why before submitting.`);
    }
    setErrors({});
    setError(null);
    setConfirming(true);
  };

  const submit = () => {
    start(async () => {
      const r = await submitCashUp({ counts: parsed, reason });
      setConfirming(false);
      if (!r.ok) {
        setErrors(r.fields ?? {});
        setError(r.error);
      }
    });
  };

  const methodRows = METHOD_IDS.map((m) => [METHOD_LABELS[m], formatKwacha(day.byMethod[m])]);

  return (
    <div className="mt-6 space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Expected cash" value={formatKwacha(day.expectedCash)} note="Confirmed cash receipts" />
        <Stat label="Counted" value={formatKwacha(submitted ? submitted.counted : counted)} note={submitted ? "As submitted" : "From your count below"} />
        <Stat label="Difference" value={submitted ? varianceText(submitted.variance) : varianceText(variance)} />
        <Stat label="Collected today" value={formatKwacha(day.collected)} note="All methods" />
      </div>

      {submitted ? (
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <Lock size={22} aria-hidden className="mt-0.5 text-muted" />
              <div>
                <h2 className="text-lg font-semibold text-ink">Today is closed</h2>
                <p className="text-[15px] text-muted">Submitted by {submitted.submittedBy} on {formatStamp(submitted.submittedAt, branding.timezone)}. No more payments, confirmations or voids can be made for {prettyDate(today)}.</p>
              </div>
            </div>
            <button type="button" onClick={() => setPrinting(submitted)} className={buttonClass}><Printer size={16} aria-hidden /> Print cash-up</button>
          </div>
          <div className="mt-4 flex items-center gap-2"><Chip tone={tone(submitted.variance)}>{varianceText(submitted.variance)}</Chip>{submitted.reason && <span className="text-[15px] text-muted">{submitted.reason}</span>}</div>
        </Card>
      ) : (
        <Card>
          <h2 className="text-lg font-semibold text-ink">Count the drawer</h2>
          <p className="mt-1 text-sm text-muted">Enter how many of each note and coin are in the drawer. Leave blank for none.</p>
          {blocked && (
            <p role="alert" className="mt-4 rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning">
              {day.pending} {day.pending === 1 ? "receipt is" : "receipts are"} still pending. Confirm or void {day.pending === 1 ? "it" : "them"} in{" "}
              <Link href={hrefForNavLabel("cashier", "Today's transactions")} className="font-semibold underline">Today&apos;s transactions</Link> before you submit.
            </p>
          )}
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {DENOMINATIONS.map((d) => {
              const key = String(d);
              const n = parsed[key] ?? 0;
              return (
                <Field key={key} label={denominationLabel(d)} error={bad[key]} help={n > 0 ? formatKwacha(d * n) : undefined}>
                  {(p) => <input {...p} inputMode="numeric" value={typed[key] ?? ""} onChange={(e) => setTyped((t) => ({ ...t, [key]: e.target.value }))} placeholder="0" className={inputClass} />}
                </Field>
              );
            })}
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl bg-canvas px-4 py-3 text-[15px]">
            <span>Counted <strong className="text-ink">{formatKwacha(counted)}</strong></span>
            <span aria-hidden className="text-muted">·</span>
            <span>Expected <strong className="text-ink">{formatKwacha(day.expectedCash)}</strong></span>
            <Chip tone={tone(variance)}>{varianceText(variance)}</Chip>
          </div>
          {variance !== 0 && (
            <div className="mt-4">
              <Field label="Reason for the difference" error={errors.reason} required>
                {(p) => <textarea {...p} value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={LIMITS.reason + 20} className={`${inputClass} h-auto py-2`} />}
              </Field>
            </div>
          )}
          {error && <p role="alert" className="mt-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
          <div className="mt-4"><button type="button" onClick={open} disabled={blocked} className={primaryClass}>Review and submit</button></div>
        </Card>
      )}

      <Card>
        <h2 className="text-lg font-semibold text-ink">Collected by method</h2>
        <table className="mt-3 w-full max-w-lg text-left text-[15px]">
          <tbody>
            {methodRows.map(([label, value]) => (
              <tr key={label} className="border-b border-line last:border-0"><td className="py-1.5 text-muted">{label}</td><td className="py-1.5 text-right text-ink">{value}</td></tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-sm text-muted">Confirmed payments only. Only cash is counted in the drawer; mobile money and bank payments are checked against their own records.</p>
      </Card>

      <Card>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-ink">Previous cash-ups</h2>
          <button type="button" disabled={history.length === 0} onClick={() => setPrinting("history")} className={buttonClass}><Printer size={16} aria-hidden /> Print</button>
        </div>
        {history.length === 0 ? (
          <p className="mt-3 text-[15px] text-muted">No cash-ups have been submitted yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-152 text-left text-[15px]">
              <thead>
                <tr className="border-b border-line text-sm text-muted">
                  <th className="py-2 pr-3 font-medium">Day</th>
                  <th className="py-2 pr-3 text-right font-medium">Expected</th>
                  <th className="py-2 pr-3 text-right font-medium">Counted</th>
                  <th className="py-2 pr-3 font-medium">Difference</th>
                  <th className="py-2 font-medium">Reason</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.date} className="border-b border-line align-top last:border-0">
                    <td className="py-2 pr-3 font-medium text-ink">{prettyDate(h.date)}</td>
                    <td className="py-2 pr-3 text-right">{formatKwacha(h.expected)}</td>
                    <td className="py-2 pr-3 text-right">{formatKwacha(h.counted)}</td>
                    <td className="py-2 pr-3"><Chip tone={tone(h.variance)}>{varianceText(h.variance)}</Chip></td>
                    <td className="py-2 text-muted">{h.reason || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {confirming && (
        <Dialog title="Submit today's cash-up?" subtitle="This closes the day." onClose={() => !busy && setConfirming(false)}>
          <div className="space-y-4 px-6 py-5">
            <DetailsList details={[["Expected", formatKwacha(day.expectedCash)], ["Counted", formatKwacha(counted)], ["Difference", varianceText(variance)], ["Reason", variance === 0 ? "" : reason.trim()]]} />
            <p className="text-sm text-muted">Once submitted, no more payments can be taken, confirmed or voided for today.</p>
            {error && <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setConfirming(false)} disabled={busy} className={buttonClass}>Back</button>
              <button type="button" onClick={submit} disabled={busy} className={primaryClass}>{busy ? "Submitting…" : "Submit cash-up"}</button>
            </div>
          </div>
        </Dialog>
      )}

      {printing && printing !== "history" && (
        <PrintSheet branding={branding} title={`Cash-up for ${prettyDate(printing.date)}`} lines={[`Submitted by ${printing.submittedBy}, ${formatStamp(printing.submittedAt, branding.timezone)}`]} signature onClose={() => setPrinting(null)}>
          <DetailsList details={[["Expected cash", formatKwacha(printing.expected)], ["Counted", formatKwacha(printing.counted)], ["Difference", varianceText(printing.variance)], ["Reason", printing.reason]]} />
          <div className="mt-6">
            <PrintTable columns={["Denomination", "Count", "Amount"]} rows={DENOMINATIONS.filter((d) => printing.counts[String(d)]).map((d) => [denominationLabel(d), String(printing.counts[String(d)]), formatKwacha(d * printing.counts[String(d)])])} />
          </div>
        </PrintSheet>
      )}
      {printing === "history" && (
        <PrintSheet branding={branding} title="Cash-up history" onClose={() => setPrinting(null)}>
          <PrintTable columns={["Day", "Expected", "Counted", "Difference", "Reason"]} rows={history.map((h) => [prettyDate(h.date), formatKwacha(h.expected), formatKwacha(h.counted), varianceText(h.variance), h.reason])} />
        </PrintSheet>
      )}
    </div>
  );
}
