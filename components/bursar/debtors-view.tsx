"use client";

import { useMemo, useState, useTransition } from "react";
import { BellRing, CalendarClock, FileText, Search } from "lucide-react";
import { Card, Chip, Dialog, ExportBar, Field, Stat, buttonClass, downloadCsv, inputClass, primaryClass } from "@/components/teacher/shared";
import { PrintSheet, PrintTable } from "@/components/platform/print-sheet";
import { ErrorNote, textareaClass } from "./bits";
import { StatementDialog } from "./statement-dialog";
import { cancelPlan, createPlan, recordReminder } from "@/server/actions/bursar";
import { BUCKETS, BUCKET_LABEL, agingTotals, debtorsOf } from "@/lib/bursar/debtors";
import { CHANNEL_LABEL, DEBTOR_COLUMNS, debtorRows } from "@/lib/bursar/format";
import { buildSchedule, planProgress } from "@/lib/bursar/plans";
import type { BursarTerms } from "@/lib/bursar/terms";
import { PLAN_COUNTS, checkPlan } from "@/lib/bursar/validate";
import { withheldFor, type FeePolicy } from "@/lib/fee-policy";
import { formatKwacha } from "@/lib/money";
import type { PrintBranding } from "@/lib/print";
import { csvFilename } from "@/lib/table-tools";
import { addDays, prettyDate } from "@/lib/teacher/dates";
import { REMINDER_CHANNELS, type AccountRow, type AgingBucket, type Debtor, type PaymentPlan, type Reminder, type ReminderChannel } from "@/types/bursar";

type Tab = "debtors" | "plans";
const BUCKET_TONE: Record<AgingBucket, "good" | "warn" | "bad" | "info"> = { current: "info", d1_30: "warn", d31_60: "warn", d61_90: "bad", d90_plus: "bad" };

/** Debtors: who owes, how old the debt is, payment plans, and a log of who has been chased. */
export function DebtorsView({ accounts, plans, reminders, terms, today, feePolicy, branding }: { accounts: AccountRow[]; plans: PaymentPlan[]; reminders: Reminder[]; terms: BursarTerms; today: string; feePolicy: FeePolicy; branding: PrintBranding }) {
  const [tab, setTab] = useState<Tab>("debtors");
  const [query, setQuery] = useState("");
  const [bucket, setBucket] = useState("");
  const [group, setGroup] = useState("");
  const [planState, setPlanState] = useState("");
  const [statement, setStatement] = useState<string | null>(null);
  const [planning, setPlanning] = useState<{ studentNo: string; count: string; firstDueOn: string; note: string } | null>(null);
  const [reminding, setReminding] = useState<{ studentNo: string; channel: ReminderChannel; note: string } | null>(null);
  const [cancelling, setCancelling] = useState<PaymentPlan | null>(null);
  const [reason, setReason] = useState("");
  const [listing, setListing] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const debtors = useMemo(() => debtorsOf(accounts, plans, reminders, today), [accounts, plans, reminders, today]);
  const byNo = useMemo(() => new Map(accounts.map((a) => [a.no, a])), [accounts]);
  const groups = useMemo(() => [...new Set(debtors.map((d) => d.account.group))].sort(), [debtors]);
  const aging = useMemo(() => agingTotals(debtors), [debtors]);
  const behind = (d: Debtor) => (d.plan ? planProgress(d.plan, d.account.owed, today).behind : false);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return debtors.filter((d) => {
      if (bucket && d.bucket !== bucket) return false;
      if (group && d.account.group !== group) return false;
      if (planState === "none" && d.plan) return false;
      if (planState === "on" && !d.plan) return false;
      if (planState === "behind" && !behind(d)) return false;
      return !q || `${d.account.name} ${d.account.no}`.toLowerCase().includes(q);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debtors, query, bucket, group, planState, today]);

  const owedTotal = debtors.reduce((n, d) => n + d.account.owed, 0);
  const overdueTotal = debtors.filter((d) => d.daysOverdue > 0).reduce((n, d) => n + d.account.owed, 0);
  const activePlans = plans.filter((p) => p.status === "active");
  const rows = debtorRows(shown);
  const maxAmount = Math.max(1, ...aging.map((a) => a.amount));

  const planFor = planning ? byNo.get(planning.studentNo) : undefined;
  const preview = planFor && planning && /^\d+$/.test(planning.count) && Number(planning.count) >= PLAN_COUNTS.min && Number(planning.count) <= Math.min(PLAN_COUNTS.max, planFor.owed) && /^\d{4}-\d{2}-\d{2}$/.test(planning.firstDueOn) ? buildSchedule(planFor.owed, Number(planning.count), planning.firstDueOn) : null;

  const openPlan = (no: string) => {
    setPlanning({ studentNo: no, count: "3", firstDueOn: addDays(today, 14), note: "" });
    setErrors({});
    setError(null);
  };

  const submitPlan = () => {
    if (!planning) return;
    const owed = byNo.get(planning.studentNo)?.owed ?? 0;
    const c = checkPlan(planning, { owed, today, hasActivePlan: activePlans.some((p) => p.studentNo === planning.studentNo) });
    if (!c.ok) {
      setErrors(c.fields ?? {});
      setError(c.error);
      return;
    }
    start(async () => {
      const r = await createPlan(planning);
      if (r.ok) {
        setPlanning(null);
        setDone("Payment plan agreed. The next instalment is now the due date.");
      } else {
        setErrors(r.fields ?? {});
        setError(r.error);
      }
    });
  };

  const submitReminder = () => {
    if (!reminding) return;
    start(async () => {
      const r = await recordReminder(reminding);
      if (r.ok) {
        setReminding(null);
        setDone("Reminder recorded.");
      } else {
        setErrors(r.fields ?? {});
        setError(r.error);
      }
    });
  };

  const submitCancel = () => {
    if (!cancelling) return;
    if (!reason.trim()) return setError("A reason is required.");
    start(async () => {
      const r = await cancelPlan(cancelling.id, reason);
      if (r.ok) {
        setCancelling(null);
        setDone("Plan cancelled. The original due dates apply again.");
      } else setError(r.error);
    });
  };

  const nameOf = (no: string) => byNo.get(no)?.name ?? no;

  return (
    <div className="mt-6 space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total owed" value={formatKwacha(owedTotal)} note={`${debtors.length} ${terms.member.toLowerCase()}s`} />
        <Stat label="Overdue" value={formatKwacha(overdueTotal)} note={`${debtors.filter((d) => d.daysOverdue > 0).length} ${terms.member.toLowerCase()}s`} />
        <Stat label="On a plan" value={String(activePlans.length)} note={`${activePlans.filter((p) => { const a = byNo.get(p.studentNo); return a ? planProgress(p, a.owed, today).behind : false; }).length} behind`} />
        <Stat label="Documents held back" value={String(debtors.filter((d) => { const w = withheldFor(feePolicy, { balance: d.account.owed, dueOn: d.account.dueOn, status: d.daysOverdue > 0 ? "overdue" : "due" }); return w.examCard || w.results; }).length)} note="Under the school's fee policy" />
      </div>

      {done && <p role="status" className="rounded-lg bg-positive-soft px-3 py-2 text-[15px] text-positive">{done}</p>}

      <Card>
        <h2 className="text-lg font-semibold text-ink">Ageing</h2>
        <p className="text-sm text-muted">What is owed, by how long past its due date.</p>
        <ul className="mt-3 space-y-2">
          {aging.map((a) => (
            <li key={a.bucket} className="grid grid-cols-[8rem_1fr_auto] items-center gap-3 text-[15px]">
              <span className="text-ink">{BUCKET_LABEL[a.bucket]}</span>
              <span className="h-2.5 rounded-full bg-canvas" aria-hidden><span className="block h-full rounded-full bg-brand" style={{ width: `${(a.amount / maxAmount) * 100}%` }} /></span>
              <span className="text-right text-ink">{formatKwacha(a.amount)} <span className="text-sm text-muted">({a.count})</span></span>
            </li>
          ))}
        </ul>
      </Card>

      <div role="tablist" aria-label="Debtors sections" className="flex gap-2">
        {([["debtors", `Debtors (${debtors.length})`], ["plans", `Payment plans (${plans.length})`]] as const).map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => { setTab(id); setDone(null); }} className={tab === id ? primaryClass : buttonClass}>{label}</button>
        ))}
      </div>

      {tab === "debtors" ? (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-56">
                <Search size={16} aria-hidden className="pointer-events-none absolute left-3 top-3 text-muted" />
                <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name or number" aria-label="Search debtors" className={`${inputClass} pl-9`} />
              </div>
              <select aria-label="Filter by ageing" value={bucket} onChange={(e) => setBucket(e.target.value)} className={`${inputClass} w-auto!`}>
                <option value="">All ageing</option>
                {BUCKETS.map((b) => <option key={b} value={b}>{BUCKET_LABEL[b]}</option>)}
              </select>
              <select aria-label={`Filter by ${terms.group.toLowerCase()}`} value={group} onChange={(e) => setGroup(e.target.value)} className={`${inputClass} w-auto!`}>
                <option value="">All {terms.group.toLowerCase()}s</option>
                {groups.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
              <select aria-label="Filter by plan" value={planState} onChange={(e) => setPlanState(e.target.value)} className={`${inputClass} w-auto!`}>
                <option value="">Any plan state</option>
                <option value="none">No plan</option>
                <option value="on">On a plan</option>
                <option value="behind">Behind on plan</option>
              </select>
            </div>
            <ExportBar disabled={shown.length === 0} onCsv={() => downloadCsv(csvFilename("Debtors", today), [DEBTOR_COLUMNS, ...rows])} onPrint={() => setListing(true)} />
          </div>
          <p className="mt-3 text-sm text-muted" role="status">{shown.length} of {debtors.length} debtors</p>
          {shown.length === 0 ? (
            <p className="mt-3 text-[15px] text-muted">{debtors.length === 0 ? "Nobody owes anything." : "No debtors match."}</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-240 text-left text-[15px]">
                <thead>
                  <tr className="border-b border-line text-sm text-muted">
                    <th className="py-2 pr-3 font-medium">{terms.member}</th>
                    <th className="py-2 pr-3 text-right font-medium">Owed</th>
                    <th className="py-2 pr-3 font-medium">Due</th>
                    <th className="py-2 pr-3 font-medium">Ageing</th>
                    <th className="py-2 pr-3 font-medium">Plan</th>
                    <th className="py-2 pr-3 font-medium">Held back</th>
                    <th className="py-2 pr-3 font-medium">Last reminder</th>
                    <th className="py-2"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((d) => {
                    const w = withheldFor(feePolicy, { balance: d.account.owed, dueOn: d.account.dueOn, status: d.daysOverdue > 0 ? "overdue" : "due" });
                    return (
                      <tr key={d.account.no} className="border-b border-line align-top last:border-0">
                        <td className="py-2 pr-3 text-ink">{d.account.name}<span className="block text-sm text-muted">{d.account.no} • {d.account.group}</span></td>
                        <td className="py-2 pr-3 text-right font-medium text-ink">{formatKwacha(d.account.owed)}</td>
                        <td className="py-2 pr-3 text-muted">{d.account.dueOn ? prettyDate(d.account.dueOn) : "None"}</td>
                        <td className="py-2 pr-3"><Chip tone={BUCKET_TONE[d.bucket]}>{BUCKET_LABEL[d.bucket]}</Chip>{d.daysOverdue > 0 && <span className="mt-1 block text-sm text-muted">{d.daysOverdue} days late</span>}</td>
                        <td className="py-2 pr-3">{d.plan ? <Chip tone={behind(d) ? "bad" : "good"}>{behind(d) ? "Behind" : "On plan"}</Chip> : <span className="text-muted">None</span>}</td>
                        <td className="py-2 pr-3 text-sm text-muted">{[w.examCard && "Exam card", w.results && "Results"].filter(Boolean).join(", ") || "Nothing"}</td>
                        <td className="py-2 pr-3 text-sm text-muted">{d.lastReminder ? `${prettyDate(d.lastReminder.at.slice(0, 10))}, ${CHANNEL_LABEL[d.lastReminder.channel]}` : "Never"}</td>
                        <td className="py-2">
                          <div className="flex flex-wrap justify-end gap-2">
                            <button type="button" onClick={() => setStatement(d.account.no)} className={buttonClass} aria-label={`Statement for ${d.account.name}`}><FileText size={16} aria-hidden /> Statement</button>
                            <button type="button" onClick={() => { setReminding({ studentNo: d.account.no, channel: "sms", note: "" }); setError(null); setErrors({}); }} className={buttonClass} aria-label={`Record a reminder for ${d.account.name}`}><BellRing size={16} aria-hidden /> Remind</button>
                            {!d.plan && <button type="button" onClick={() => openPlan(d.account.no)} className={buttonClass} aria-label={`Agree a payment plan for ${d.account.name}`}><CalendarClock size={16} aria-hidden /> Plan</button>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ) : (
        <Card>
          {plans.length === 0 ? (
            <p className="text-[15px] text-muted">No payment plans yet. Agree one from the Debtors tab.</p>
          ) : (
            <ul className="divide-y divide-line">
              {plans.map((p) => {
                const owed = byNo.get(p.studentNo)?.owed ?? 0;
                const pr = planProgress(p, owed, today);
                const pct = Math.min(100, Math.round((pr.paid / Math.max(1, p.startBalance)) * 100));
                return (
                  <li key={p.id} className="py-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-ink">{nameOf(p.studentNo)} <span className="text-sm font-normal text-muted">{p.studentNo}</span></p>
                        <p className="text-sm text-muted">{p.instalments.length} instalments from {prettyDate(p.instalments[0].dueOn)} • started at {formatKwacha(p.startBalance)} • agreed by {p.createdBy}{p.note ? ` • ${p.note}` : ""}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {p.status === "cancelled" ? <Chip tone="info">Cancelled</Chip> : pr.done ? <Chip tone="good">Complete</Chip> : <Chip tone={pr.behind ? "bad" : "good"}>{pr.behind ? "Behind" : "On track"}</Chip>}
                        {p.status === "active" && <button type="button" onClick={() => { setCancelling(p); setReason(""); setError(null); }} className={buttonClass} aria-label={`Cancel plan for ${nameOf(p.studentNo)}`}>Cancel plan</button>}
                      </div>
                    </div>
                    {p.status === "active" ? (
                      <div className="mt-2">
                        <div className="h-2 rounded-full bg-canvas" role="progressbar" aria-label="Paid on plan" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} /></div>
                        <p className="mt-1 text-sm text-muted">{formatKwacha(pr.paid)} paid, {formatKwacha(pr.remaining)} to go{pr.next ? ` • next ${formatKwacha(pr.next.amount)} on ${prettyDate(pr.next.dueOn)}` : ""}</p>
                      </div>
                    ) : (
                      <p className="mt-1 text-sm text-muted">Cancelled{p.cancelledAt ? ` on ${prettyDate(p.cancelledAt.slice(0, 10))}` : ""}: {p.cancelReason}</p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}

      {statement && <StatementDialog studentNo={statement} terms={terms} today={today} branding={branding} onClose={() => setStatement(null)} />}

      {planning && planFor && (
        <Dialog title="Agree a payment plan" subtitle={`${planFor.name} owes ${formatKwacha(planFor.owed)}. It is split into equal monthly instalments.`} onClose={() => !busy && setPlanning(null)}>
          <form noValidate onSubmit={(e) => { e.preventDefault(); submitPlan(); }} className="space-y-4 px-6 py-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Instalments" error={errors.count} help={`${PLAN_COUNTS.min} to ${PLAN_COUNTS.max}`} required>
                {(p) => <input {...p} type="number" inputMode="numeric" min={PLAN_COUNTS.min} max={PLAN_COUNTS.max} value={planning.count} onChange={(e) => setPlanning({ ...planning, count: e.target.value })} className={inputClass} />}
              </Field>
              <Field label="First instalment due" error={errors.firstDueOn} required>
                {(p) => <input {...p} type="date" min={today} value={planning.firstDueOn} onChange={(e) => setPlanning({ ...planning, firstDueOn: e.target.value })} className={inputClass} />}
              </Field>
            </div>
            <Field label="Note" error={errors.note} help="Optional, for example what was agreed with the family.">
              {(p) => <textarea {...p} value={planning.note} onChange={(e) => setPlanning({ ...planning, note: e.target.value })} maxLength={210} className={textareaClass} />}
            </Field>
            {preview && (
              <ol className="rounded-xl bg-canvas px-4 py-3 text-[15px]" aria-label="Instalments">
                {preview.map((i, n) => <li key={n} className="flex justify-between py-0.5 text-ink"><span>{n + 1}. {prettyDate(i.dueOn)}</span><span>{formatKwacha(i.amount)}</span></li>)}
              </ol>
            )}
            {error && <ErrorNote>{error}</ErrorNote>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setPlanning(null)} disabled={busy} className={buttonClass}>Cancel</button>
              <button type="submit" disabled={busy} className={primaryClass}>{busy ? "Saving…" : "Agree plan"}</button>
            </div>
          </form>
        </Dialog>
      )}

      {reminding && (
        <Dialog title="Record a reminder" subtitle={`${nameOf(reminding.studentNo)}. This records that they were chased; nothing is sent from here.`} onClose={() => !busy && setReminding(null)}>
          <form noValidate onSubmit={(e) => { e.preventDefault(); submitReminder(); }} className="space-y-4 px-6 py-5">
            <Field label="How were they contacted" error={errors.channel} required>
              {(p) => (
                <select {...p} value={reminding.channel} onChange={(e) => setReminding({ ...reminding, channel: e.target.value as ReminderChannel })} className={inputClass}>
                  {REMINDER_CHANNELS.map((c) => <option key={c} value={c}>{CHANNEL_LABEL[c]}</option>)}
                </select>
              )}
            </Field>
            <Field label="Note" error={errors.note}>
              {(p) => <textarea {...p} value={reminding.note} onChange={(e) => setReminding({ ...reminding, note: e.target.value })} maxLength={210} className={textareaClass} />}
            </Field>
            {error && <ErrorNote>{error}</ErrorNote>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setReminding(null)} disabled={busy} className={buttonClass}>Cancel</button>
              <button type="submit" disabled={busy} className={primaryClass}>{busy ? "Saving…" : "Record reminder"}</button>
            </div>
          </form>
        </Dialog>
      )}

      {cancelling && (
        <Dialog title="Cancel payment plan" subtitle={`${nameOf(cancelling.studentNo)}. The plan stays on the record and the original due dates apply again.`} onClose={() => !busy && setCancelling(null)}>
          <form noValidate onSubmit={(e) => { e.preventDefault(); submitCancel(); }} className="space-y-4 px-6 py-5">
            <Field label="Reason" required error={error ?? undefined}>
              {(p) => <textarea {...p} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={210} className={textareaClass} />}
            </Field>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setCancelling(null)} disabled={busy} className={buttonClass}>Keep plan</button>
              <button type="submit" disabled={busy} className={primaryClass}>{busy ? "Cancelling…" : "Cancel plan"}</button>
            </div>
          </form>
        </Dialog>
      )}

      {listing && (
        <PrintSheet branding={branding} title="Debtors" lines={[`As at ${prettyDate(today)}`, `${shown.length} debtors, ${formatKwacha(shown.reduce((n, d) => n + d.account.owed, 0))}`]} onClose={() => setListing(false)}>
          <PrintTable columns={DEBTOR_COLUMNS} rows={rows} />
        </PrintSheet>
      )}
    </div>
  );
}
