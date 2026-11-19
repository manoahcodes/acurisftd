"use client";

import { useMemo, useState, useTransition } from "react";
import { Ban, FilePlus, Plus, Printer, Search } from "lucide-react";
import { Card, Chip, Dialog, ExportBar, Field, Stat, buttonClass, downloadCsv, inputClass, primaryClass } from "@/components/teacher/shared";
import { DetailsList, PrintSheet, PrintTable } from "@/components/platform/print-sheet";
import { ErrorNote, textareaClass } from "./bits";
import { cancelInvoice, chargeFee, generateInvoices } from "@/server/actions/bursar";
import { inEffect, scopeMatches } from "@/lib/bursar/fees";
import { INVOICE_COLUMNS, invoiceRows, invoiceStatusLabel } from "@/lib/bursar/format";
import { canCancel, nextPeriodLabel, planInvoices, suggestedDue } from "@/lib/bursar/invoices";
import type { BursarTerms } from "@/lib/bursar/terms";
import { checkCharge, checkGenerate } from "@/lib/bursar/validate";
import { ACCOUNT_LABELS } from "@/lib/cashier/terms";
import { formatKwacha } from "@/lib/money";
import type { PrintBranding } from "@/lib/print";
import { csvFilename } from "@/lib/table-tools";
import { prettyDate } from "@/lib/teacher/dates";
import type { AccountRow, FeeItem, InvoiceStatus, InvoiceView } from "@/types/bursar";
import { periodLabel } from "@/lib/bursar/seed";

const TONE: Record<InvoiceStatus, "good" | "warn" | "bad" | "info"> = { paid: "good", partly_paid: "warn", unpaid: "info", overdue: "bad", cancelled: "info" };

type Run = { period: string; dueOn: string; includeAnnual: boolean; groups: string[] };
type Charge = { studentNo: string; feeId: string; period: string; dueOn: string };

/** Invoices: make them from the fee structure, add one fee to one student, print and cancel. */
export function InvoicesView({ views, fees, accounts, groups, terms, today, branding }: { views: InvoiceView[]; fees: FeeItem[]; accounts: AccountRow[]; groups: string[]; terms: BursarTerms; today: string; branding: PrintBranding }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [period, setPeriod] = useState("");
  const [group, setGroup] = useState("");
  const [run, setRun] = useState<Run | null>(null);
  const [charge, setCharge] = useState<Charge | null>(null);
  const [cancelling, setCancelling] = useState<InvoiceView | null>(null);
  const [reason, setReason] = useState("");
  const [viewing, setViewing] = useState<InvoiceView | null>(null);
  const [listing, setListing] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const periods = useMemo(() => [...new Set(views.map((v) => v.invoice.period))], [views]);
  const current = periods[0] ?? periodLabel(terms.type);
  const roll = useMemo(() => accounts.map((a) => ({ no: a.no, name: a.name, group: a.group })), [accounts]);
  const invoices = useMemo(() => views.map((v) => v.invoice), [views]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return views.filter((v) => (!status || v.status === status) && (!period || v.invoice.period === period) && (!group || v.group === group) && (!q || `${v.invoice.no} ${v.studentName} ${v.invoice.studentNo}`.toLowerCase().includes(q)));
  }, [views, query, status, period, group]);

  const live = views.filter((v) => v.status !== "cancelled");
  const invoiced = live.reduce((n, v) => n + v.invoice.total, 0);
  const collected = live.reduce((n, v) => n + v.paid, 0);
  const outstanding = live.reduce((n, v) => n + v.outstanding, 0);
  const overdue = live.filter((v) => v.status === "overdue").length;
  const rows = invoiceRows(shown);

  const openRun = () => {
    setRun({ period: nextPeriodLabel(terms.type, current), dueOn: suggestedDue(fees, today), includeAnnual: false, groups: [] });
    setErrors({});
    setError(null);
  };

  const plan = useMemo(() => (run ? planInvoices(fees, roll, invoices, run, today) : null), [run, fees, roll, invoices, today]);
  const planTotal = plan?.drafts.reduce((n, d) => n + d.total, 0) ?? 0;

  const submitRun = () => {
    if (!run) return;
    const c = checkGenerate(run, { groups, today });
    if (!c.ok) {
      setErrors(c.fields ?? {});
      setError(c.error);
      return;
    }
    start(async () => {
      const r = await generateInvoices(run);
      if (r.ok) {
        setRun(null);
        setDone(`Made ${r.created} ${r.created === 1 ? "invoice" : "invoices"} for ${run.period}, ${formatKwacha(r.total)} in all.${r.skipped ? ` ${r.skipped} skipped.` : ""}`);
      } else {
        setErrors(r.fields ?? {});
        setError(r.error);
      }
    });
  };

  const chargeStudent = accounts.find((a) => a.no === charge?.studentNo);
  const chargeable = chargeStudent ? fees.filter((f) => inEffect(f, today) && scopeMatches(f.scope, chargeStudent.group) && chargeStudent.lines.some((l) => l.kind === f.kind)) : [];

  const submitCharge = () => {
    if (!charge) return;
    const c = checkCharge(charge, { today });
    if (!c.ok) {
      setErrors(c.fields ?? {});
      setError(c.error);
      return;
    }
    start(async () => {
      const r = await chargeFee(charge);
      if (r.ok) {
        setCharge(null);
        setDone("Fee added to the student's account.");
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
      const r = await cancelInvoice(cancelling.invoice.id, reason);
      if (r.ok) {
        setCancelling(null);
        setDone(`${cancelling.invoice.no} cancelled.`);
      } else setError(r.error);
    });
  };

  return (
    <div className="mt-6 space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Invoiced" value={formatKwacha(invoiced)} note={`${live.length} invoices`} />
        <Stat label="Paid" value={formatKwacha(collected)} />
        <Stat label="Outstanding" value={formatKwacha(outstanding)} />
        <Stat label="Overdue invoices" value={String(overdue)} />
      </div>

      {done && <p role="status" className="rounded-lg bg-positive-soft px-3 py-2 text-[15px] text-positive">{done}</p>}

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-56">
              <Search size={16} aria-hidden className="pointer-events-none absolute left-3 top-3 text-muted" />
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Invoice, name or number" aria-label="Search invoices" className={`${inputClass} pl-9`} />
            </div>
            <select aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)} className={`${inputClass} w-auto!`}>
              <option value="">All statuses</option>
              {(["unpaid", "partly_paid", "overdue", "paid", "cancelled"] as const).map((s) => <option key={s} value={s}>{invoiceStatusLabel(s)}</option>)}
            </select>
            <select aria-label={`Filter by ${terms.period.toLowerCase()}`} value={period} onChange={(e) => setPeriod(e.target.value)} className={`${inputClass} w-auto!`}>
              <option value="">All {terms.period.toLowerCase()}s</option>
              {periods.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <select aria-label={`Filter by ${terms.group.toLowerCase()}`} value={group} onChange={(e) => setGroup(e.target.value)} className={`${inputClass} w-auto!`}>
              <option value="">All {terms.group.toLowerCase()}s</option>
              {groups.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <ExportBar disabled={shown.length === 0} onCsv={() => downloadCsv(csvFilename("Invoices", today), [INVOICE_COLUMNS, ...rows])} onPrint={() => setListing(true)} />
            <button type="button" onClick={() => { setCharge({ studentNo: "", feeId: "", period: current, dueOn: suggestedDue(fees, today) }); setErrors({}); setError(null); }} className={buttonClass}><Plus size={16} aria-hidden /> Charge a fee</button>
            <button type="button" onClick={openRun} className={primaryClass}><FilePlus size={16} aria-hidden /> Generate invoices</button>
          </div>
        </div>
        <p className="mt-3 text-sm text-muted" role="status">{shown.length} of {views.length} invoices</p>
        {shown.length === 0 ? (
          <p className="mt-3 text-[15px] text-muted">No invoices match.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-224 text-left text-[15px]">
              <thead>
                <tr className="border-b border-line text-sm text-muted">
                  <th className="py-2 pr-3 font-medium">Invoice</th>
                  <th className="py-2 pr-3 font-medium">{terms.member}</th>
                  <th className="py-2 pr-3 font-medium">Due</th>
                  <th className="py-2 pr-3 text-right font-medium">Total</th>
                  <th className="py-2 pr-3 text-right font-medium">Paid</th>
                  <th className="py-2 pr-3 text-right font-medium">Outstanding</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {shown.map((v) => (
                  <tr key={v.invoice.id} className="border-b border-line align-top last:border-0">
                    <td className="py-2 pr-3"><span className="block font-medium text-ink">{v.invoice.no}</span><span className="text-sm text-muted">{v.invoice.period}</span></td>
                    <td className="py-2 pr-3 text-ink">{v.studentName}<span className="block text-sm text-muted">{v.invoice.studentNo} • {v.group}</span></td>
                    <td className="py-2 pr-3 text-muted">{prettyDate(v.invoice.dueOn)}</td>
                    <td className="py-2 pr-3 text-right text-ink">{formatKwacha(v.invoice.total)}</td>
                    <td className="py-2 pr-3 text-right text-muted">{formatKwacha(v.paid)}</td>
                    <td className="py-2 pr-3 text-right font-medium text-ink">{formatKwacha(v.outstanding)}</td>
                    <td className="py-2 pr-3"><Chip tone={TONE[v.status]}>{invoiceStatusLabel(v.status)}</Chip>{v.invoice.cancelled && <span className="mt-1 block max-w-48 text-sm text-muted">{v.invoice.cancelled.reason}</span>}</td>
                    <td className="py-2">
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => setViewing(v)} className={buttonClass} aria-label={`Open invoice ${v.invoice.no}`}><Printer size={16} aria-hidden /> Invoice</button>
                        {canCancel(v) && (
                          <button type="button" onClick={() => { setCancelling(v); setReason(""); setError(null); }} className={buttonClass} aria-label={`Cancel invoice ${v.invoice.no}`}><Ban size={16} aria-hidden /> Cancel</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {run && plan && (
        <Dialog title="Generate invoices" subtitle="From the fee structure. Anyone already invoiced for the period is skipped, so running it twice never bills anyone twice." onClose={() => !busy && setRun(null)} wide>
          <form noValidate onSubmit={(e) => { e.preventDefault(); submitRun(); }} className="space-y-4 px-6 py-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={terms.period} error={errors.period} help={`For example ${nextPeriodLabel(terms.type, current)}`} required>
                {(p) => <input {...p} value={run.period} onChange={(e) => setRun({ ...run, period: e.target.value })} maxLength={50} className={inputClass} />}
              </Field>
              <Field label="Invoices fall due" error={errors.dueOn} required>
                {(p) => <input {...p} type="date" min={today} value={run.dueOn} onChange={(e) => setRun({ ...run, dueOn: e.target.value })} className={inputClass} />}
              </Field>
            </div>
            <label className="flex items-center gap-2 text-[15px] text-ink">
              <input type="checkbox" checked={run.includeAnnual} onChange={(e) => setRun({ ...run, includeAnnual: e.target.checked })} className="size-4" /> Include fees charged once a year
            </label>
            <fieldset>
              <legend className="mb-1 text-sm font-medium text-ink">{terms.group}s (none chosen means all)</legend>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {groups.map((g) => (
                  <label key={g} className="flex items-center gap-1.5 text-[15px] text-ink">
                    <input type="checkbox" checked={run.groups.includes(g)} onChange={(e) => setRun({ ...run, groups: e.target.checked ? [...run.groups, g] : run.groups.filter((x) => x !== g) })} className="size-4" /> {g}
                  </label>
                ))}
              </div>
              {errors.groups && <p className="mt-1 text-sm text-danger">{errors.groups}</p>}
            </fieldset>
            <div className="rounded-xl bg-canvas px-4 py-3" role="status" aria-live="polite">
              <p className="font-medium text-ink">{plan.drafts.length} {plan.drafts.length === 1 ? "invoice" : "invoices"}, {formatKwacha(planTotal)}</p>
              <p className="text-sm text-muted">
                {plan.skipped.length > 0 ? `${plan.skipped.filter((s) => s.reason === "already invoiced").length} already invoiced, ${plan.skipped.filter((s) => s.reason === "no fees apply").length} with no fee applying. ` : ""}
                Only fees that are on, have taken effect and are billed to everyone are used. Optional fees are added one by one with Charge a fee.
              </p>
            </div>
            {error && <ErrorNote>{error}</ErrorNote>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setRun(null)} disabled={busy} className={buttonClass}>Cancel</button>
              <button type="submit" disabled={busy || plan.drafts.length === 0} className={primaryClass}>{busy ? "Generating…" : `Generate ${plan.drafts.length} ${plan.drafts.length === 1 ? "invoice" : "invoices"}`}</button>
            </div>
          </form>
        </Dialog>
      )}

      {charge && (
        <Dialog title="Charge a fee" subtitle="Adds one fee to one student's account, for example hostel or transport." onClose={() => !busy && setCharge(null)}>
          <form noValidate onSubmit={(e) => { e.preventDefault(); submitCharge(); }} className="space-y-4 px-6 py-5">
            <Field label={terms.member} error={errors.student} required>
              {(p) => (
                <select {...p} value={charge.studentNo} onChange={(e) => setCharge({ ...charge, studentNo: e.target.value, feeId: "" })} className={inputClass}>
                  <option value="">Choose a {terms.member.toLowerCase()}</option>
                  {accounts.map((a) => <option key={a.no} value={a.no}>{a.name} ({a.no}, {a.group})</option>)}
                </select>
              )}
            </Field>
            <Field label="Fee" error={errors.fee} required>
              {(p) => (
                <select {...p} value={charge.feeId} disabled={!chargeStudent} onChange={(e) => setCharge({ ...charge, feeId: e.target.value })} className={inputClass}>
                  <option value="">{chargeStudent ? "Choose a fee" : `Choose a ${terms.member.toLowerCase()} first`}</option>
                  {chargeable.map((f) => <option key={f.id} value={f.id}>{f.name}, {formatKwacha(f.amount)} ({ACCOUNT_LABELS[f.kind]}{f.billing === "optional" ? ", optional" : ""})</option>)}
                </select>
              )}
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={terms.period} error={errors.period} required>
                {(p) => <input {...p} value={charge.period} onChange={(e) => setCharge({ ...charge, period: e.target.value })} maxLength={50} className={inputClass} />}
              </Field>
              <Field label="Falls due" error={errors.dueOn} required>
                {(p) => <input {...p} type="date" min={today} value={charge.dueOn} onChange={(e) => setCharge({ ...charge, dueOn: e.target.value })} className={inputClass} />}
              </Field>
            </div>
            {error && <ErrorNote>{error}</ErrorNote>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setCharge(null)} disabled={busy} className={buttonClass}>Cancel</button>
              <button type="submit" disabled={busy} className={primaryClass}>{busy ? "Adding…" : "Add fee"}</button>
            </div>
          </form>
        </Dialog>
      )}

      {cancelling && (
        <Dialog title={`Cancel ${cancelling.invoice.no}`} subtitle={`${formatKwacha(cancelling.invoice.total)} for ${cancelling.studentName}`} onClose={() => !busy && setCancelling(null)}>
          <form noValidate onSubmit={(e) => { e.preventDefault(); submitCancel(); }} className="space-y-4 px-6 py-5">
            <p className="text-sm text-muted">The invoice stays on the record as cancelled and the amount comes off what {cancelling.studentName} owes. Only an invoice with nothing paid on it can be cancelled.</p>
            <Field label="Reason" required error={error ?? undefined}>
              {(p) => <textarea {...p} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={210} className={textareaClass} />}
            </Field>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setCancelling(null)} disabled={busy} className={buttonClass}>Keep invoice</button>
              <button type="submit" disabled={busy} className={primaryClass}>{busy ? "Cancelling…" : "Cancel invoice"}</button>
            </div>
          </form>
        </Dialog>
      )}

      {viewing && (
        <PrintSheet branding={branding} title={viewing.status === "cancelled" ? `Invoice ${viewing.invoice.no} (CANCELLED)` : `Invoice ${viewing.invoice.no}`} lines={[viewing.invoice.period]} signature onClose={() => setViewing(null)}>
          {viewing.invoice.cancelled && <p className="mb-4 rounded border-2 border-[#b00020] px-3 py-2 text-lg font-bold text-[#b00020]">CANCELLED: {viewing.invoice.cancelled.reason}</p>}
          <DetailsList details={[["Billed to", `${viewing.studentName} (${viewing.invoice.studentNo})`], [terms.group, viewing.group], ["Issued", prettyDate(viewing.invoice.issuedOn)], ["Due", prettyDate(viewing.invoice.dueOn)]]} />
          <div className="mt-6">
            <PrintTable columns={["Fee", "Account", "Amount"]} rows={[...viewing.invoice.lines.map((l) => [l.name, ACCOUNT_LABELS[l.kind], formatKwacha(l.amount)]), ["Total", "", formatKwacha(viewing.invoice.total)], ["Paid", "", formatKwacha(viewing.paid)], ["Outstanding", "", formatKwacha(viewing.outstanding)]]} />
          </div>
        </PrintSheet>
      )}

      {listing && (
        <PrintSheet branding={branding} title="Invoices" lines={[`As at ${prettyDate(today)}`, `${shown.length} invoices`]} onClose={() => setListing(false)}>
          <PrintTable columns={INVOICE_COLUMNS} rows={rows} />
        </PrintSheet>
      )}
    </div>
  );
}
