"use client";

import { useMemo, useState, useTransition } from "react";
import { Pencil, Plus, Power, Search } from "lucide-react";
import { Card, Chip, Dialog, ExportBar, Field, Stat, buttonClass, downloadCsv, inputClass, primaryClass } from "@/components/teacher/shared";
import { PrintSheet, PrintTable } from "@/components/platform/print-sheet";
import { saveFee, setFeeActive } from "@/server/actions/bursar";
import { feesForGroup, scopeLabel } from "@/lib/bursar/fees";
import { BILLING_LABEL, FEE_COLUMNS, FREQUENCY_LABEL, feeRows, feeState, feeStateLabel } from "@/lib/bursar/format";
import type { BursarTerms } from "@/lib/bursar/terms";
import { checkFeeItem, BURSAR_LIMITS } from "@/lib/bursar/validate";
import { ngweeToInput } from "@/lib/cashier/format";
import { ACCOUNT_LABELS } from "@/lib/cashier/terms";
import { formatKwacha } from "@/lib/money";
import type { PrintBranding } from "@/lib/print";
import { csvFilename } from "@/lib/table-tools";
import { prettyDate } from "@/lib/teacher/dates";
import type { FeeBilling, FeeFrequency, FeeItem } from "@/types/bursar";

type Form = {
  id?: string;
  name: string;
  kind: string;
  amount: string;
  scopeKind: "all" | "grades" | "group";
  from: string;
  to: string;
  group: string;
  frequency: FeeFrequency;
  billing: FeeBilling;
  dueOn: string;
  effectiveFrom: string;
  active: boolean;
};

const blank = (terms: BursarTerms, groups: string[], today: string): Form => ({
  name: "", kind: terms.accountKinds[0], amount: "", scopeKind: "all", from: "1", to: "12", group: groups[0] ?? "", frequency: "period", billing: "everyone", dueOn: today, effectiveFrom: today, active: true,
});

const formOf = (f: FeeItem, groups: string[]): Form => ({
  id: f.id,
  name: f.name,
  kind: f.kind,
  amount: ngweeToInput(f.amount),
  scopeKind: f.scope.kind,
  from: f.scope.kind === "grades" ? String(f.scope.from) : "1",
  to: f.scope.kind === "grades" ? String(f.scope.to) : "12",
  group: f.scope.kind === "group" ? f.scope.group : (groups[0] ?? ""),
  frequency: f.frequency,
  billing: f.billing,
  dueOn: f.dueOn,
  effectiveFrom: f.effectiveFrom,
  active: f.active,
});

const toRaw = (f: Form) => ({
  id: f.id, name: f.name, kind: f.kind, amount: f.amount, frequency: f.frequency, billing: f.billing, dueOn: f.dueOn, effectiveFrom: f.effectiveFrom, active: f.active,
  scope: f.scopeKind === "grades" ? { kind: "grades", from: Number(f.from), to: Number(f.to) } : f.scopeKind === "group" ? { kind: "group", group: f.group } : { kind: "all" },
});

export function FeeStructuresView({ fees, groups, terms, today, branding }: { fees: FeeItem[]; groups: string[]; terms: BursarTerms; today: string; branding: PrintBranding }) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("");
  const [state, setState] = useState("");
  const [editing, setEditing] = useState<Form | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [listing, setListing] = useState(false);
  const [busy, start] = useTransition();

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return fees.filter((f) => (!kind || f.kind === kind) && (!state || feeState(f, today) === state) && (!q || `${f.name} ${scopeLabel(f.scope)} ${ACCOUNT_LABELS[f.kind]}`.toLowerCase().includes(q)));
  }, [fees, query, kind, state, today]);

  const perGroup = useMemo(() => groups.map((g) => feesForGroup(fees, g, today)), [fees, groups, today]);
  const totals = perGroup.map((g) => g.perPeriod).filter((n) => n > 0);
  const range = totals.length ? (Math.min(...totals) === Math.max(...totals) ? formatKwacha(totals[0]) : `${formatKwacha(Math.min(...totals))} – ${formatKwacha(Math.max(...totals))}`) : "—";
  const inForce = fees.filter((f) => feeState(f, today) === "active").length;
  const optional = fees.filter((f) => f.billing === "optional" && f.active).length;
  const offOrLater = fees.length - inForce;

  const rows = feeRows(shown, terms.period, today);
  const title = "Fee structures";
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setEditing((e) => (e ? { ...e, [k]: v } : e));

  const open = (f: Form) => {
    setErrors({});
    setError(null);
    setEditing(f);
  };

  const submit = () => {
    if (!editing) return;
    const checked = checkFeeItem(toRaw(editing), { type: terms.type, groups });
    if (!checked.ok) {
      setErrors(checked.fields ?? {});
      setError(checked.error);
      return;
    }
    start(async () => {
      const r = await saveFee(toRaw(editing));
      if (r.ok) setEditing(null);
      else {
        setErrors(r.fields ?? {});
        setError(r.error);
      }
    });
  };

  const toggle = (f: FeeItem) => {
    setError(null);
    start(async () => {
      const r = await setFeeActive(f.id, !f.active);
      if (!r.ok) setError(r.error);
    });
  };

  return (
    <div className="mt-6 space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Fees in effect" value={String(inForce)} note={`${fees.length} in the structure`} />
        <Stat label={`Billed each ${terms.period.toLowerCase()}`} value={range} note={`By ${terms.group.toLowerCase()}, before optional fees`} />
        <Stat label="Optional fees" value={String(optional)} note="Added to the accounts that take them up" />
        <Stat label="Off or not started" value={String(offOrLater)} />
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-52">
              <Search size={16} aria-hidden className="pointer-events-none absolute left-3 top-3 text-muted" />
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Fee, account or who it applies to" aria-label="Search fees" className={`${inputClass} pl-9`} />
            </div>
            <select aria-label="Filter by account" value={kind} onChange={(e) => setKind(e.target.value)} className={`${inputClass} w-auto!`}>
              <option value="">All accounts</option>
              {terms.accountKinds.map((k) => <option key={k} value={k}>{ACCOUNT_LABELS[k]}</option>)}
            </select>
            <select aria-label="Filter by status" value={state} onChange={(e) => setState(e.target.value)} className={`${inputClass} w-auto!`}>
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="scheduled">Not started</option>
              <option value="off">Off</option>
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <ExportBar disabled={shown.length === 0} onCsv={() => downloadCsv(csvFilename(title, today), [FEE_COLUMNS, ...rows])} onPrint={() => setListing(true)} />
            <button type="button" onClick={() => open(blank(terms, groups, today))} className={primaryClass}>
              <Plus size={16} aria-hidden /> Add fee
            </button>
          </div>
        </div>
        {error && !editing && <p role="alert" className="mt-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
        <p className="mt-3 text-sm text-muted" role="status">{shown.length} of {fees.length} {fees.length === 1 ? "fee" : "fees"}</p>

        {shown.length === 0 ? (
          <p className="mt-3 text-[15px] text-muted">No fees match.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-208 text-left text-[15px]">
              <thead>
                <tr className="border-b border-line text-sm text-muted">
                  <th className="py-2 pr-3 font-medium">Fee</th>
                  <th className="py-2 pr-3 font-medium">Applies to</th>
                  <th className="py-2 pr-3 text-right font-medium">Amount</th>
                  <th className="py-2 pr-3 font-medium">Charged</th>
                  <th className="py-2 pr-3 font-medium">Due</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {shown.map((f) => {
                  const st = feeState(f, today);
                  return (
                    <tr key={f.id} className="border-b border-line align-top last:border-0">
                      <td className="py-2 pr-3"><span className="block font-medium text-ink">{f.name}</span><span className="text-sm text-muted">{ACCOUNT_LABELS[f.kind]}</span></td>
                      <td className="py-2 pr-3 text-muted">{scopeLabel(f.scope)}</td>
                      <td className="py-2 pr-3 text-right text-ink">{formatKwacha(f.amount)}</td>
                      <td className="py-2 pr-3 text-muted">{FREQUENCY_LABEL(f.frequency, terms.period)}<span className="block text-xs">{BILLING_LABEL[f.billing]}</span></td>
                      <td className="py-2 pr-3 text-muted">{prettyDate(f.dueOn)}</td>
                      <td className="py-2 pr-3"><Chip tone={st === "active" ? "good" : st === "scheduled" ? "warn" : "info"}>{feeStateLabel(f, today)}</Chip></td>
                      <td className="py-2">
                        <div className="flex flex-wrap justify-end gap-2">
                          <button type="button" onClick={() => open(formOf(f, groups))} className={buttonClass} aria-label={`Edit ${f.name}, ${scopeLabel(f.scope)}`}>
                            <Pencil size={16} aria-hidden /> Edit
                          </button>
                          <button type="button" disabled={busy} onClick={() => toggle(f)} className={buttonClass} aria-label={`${f.active ? "Turn off" : "Turn on"} ${f.name}, ${scopeLabel(f.scope)}`}>
                            <Power size={16} aria-hidden /> {f.active ? "Turn off" : "Turn on"}
                          </button>
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

      <Card>
        <h2 className="text-lg font-semibold text-ink">What each {terms.group.toLowerCase()} is billed</h2>
        <p className="mt-1 text-sm text-muted">Fees in effect today. Optional fees are not included in the total.</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-176 text-left text-[15px]">
            <thead>
              <tr className="border-b border-line text-sm text-muted">
                <th className="py-2 pr-3 font-medium">{terms.group}</th>
                <th className="py-2 pr-3 font-medium">Fees</th>
                <th className="py-2 pr-3 text-right font-medium">Each {terms.period.toLowerCase()}</th>
                <th className="py-2 pr-3 text-right font-medium">Once a year</th>
                <th className="py-2 font-medium">Optional</th>
              </tr>
            </thead>
            <tbody>
              {perGroup.map((g) => (
                <tr key={g.group} className="border-b border-line align-top last:border-0">
                  <td className="py-2 pr-3 font-medium text-ink">{g.group}</td>
                  <td className="py-2 pr-3 text-muted">{g.required.length ? g.required.map((f) => f.name).join(", ") : "No fees apply"}</td>
                  <td className="py-2 pr-3 text-right text-ink">{formatKwacha(g.perPeriod)}</td>
                  <td className="py-2 pr-3 text-right text-muted">{g.perYear ? formatKwacha(g.perYear) : "—"}</td>
                  <td className="py-2 text-muted">{g.optional.length ? g.optional.map((f) => f.name).join(", ") : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {editing && (
        <Dialog title={editing.id ? "Edit fee" : "Add fee"} subtitle="Changes apply to invoices made from now on. Invoices already sent keep their amounts." onClose={() => !busy && setEditing(null)}>
          <form noValidate onSubmit={(e) => { e.preventDefault(); submit(); }} className="space-y-4 px-6 py-5">
            <Field label="Fee name" error={errors.name} required>
              {(p) => <input {...p} value={editing.name} onChange={(e) => set("name", e.target.value)} maxLength={BURSAR_LIMITS.name + 10} className={inputClass} />}
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Charged to account" error={errors.kind} required>
                {(p) => (
                  <select {...p} value={editing.kind} onChange={(e) => set("kind", e.target.value)} className={inputClass}>
                    {terms.accountKinds.map((k) => <option key={k} value={k}>{ACCOUNT_LABELS[k]}</option>)}
                  </select>
                )}
              </Field>
              <Field label="Amount (kwacha)" error={errors.amount} required>
                {(p) => <input {...p} inputMode="decimal" value={editing.amount} onChange={(e) => set("amount", e.target.value)} placeholder="2600" className={inputClass} />}
              </Field>
            </div>
            <Field label="Applies to" error={errors.scope} required>
              {(p) => (
                <select {...p} value={editing.scopeKind} onChange={(e) => set("scopeKind", e.target.value as Form["scopeKind"])} className={inputClass}>
                  <option value="all">Everyone</option>
                  {terms.tertiary ? <option value="group">One programme</option> : <option value="grades">A range of grades</option>}
                </select>
              )}
            </Field>
            {editing.scopeKind === "grades" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="From grade" required>
                  {(p) => <input {...p} type="number" min={1} max={12} value={editing.from} onChange={(e) => set("from", e.target.value)} className={inputClass} />}
                </Field>
                <Field label="To grade" required>
                  {(p) => <input {...p} type="number" min={1} max={12} value={editing.to} onChange={(e) => set("to", e.target.value)} className={inputClass} />}
                </Field>
              </div>
            )}
            {editing.scopeKind === "group" && (
              <Field label="Programme" required>
                {(p) => (
                  <select {...p} value={editing.group} onChange={(e) => set("group", e.target.value)} className={inputClass}>
                    {groups.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                )}
              </Field>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="How often" error={errors.frequency} required>
                {(p) => (
                  <select {...p} value={editing.frequency} onChange={(e) => set("frequency", e.target.value as FeeFrequency)} className={inputClass}>
                    <option value="period">Every {terms.period.toLowerCase()}</option>
                    <option value="year">Once a year</option>
                  </select>
                )}
              </Field>
              <Field label="Billed to" error={errors.billing} required>
                {(p) => (
                  <select {...p} value={editing.billing} onChange={(e) => set("billing", e.target.value as FeeBilling)} className={inputClass}>
                    <option value="everyone">Everyone it applies to</option>
                    <option value="optional">Optional, added when taken up</option>
                  </select>
                )}
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Takes effect" error={errors.effectiveFrom} required>
                {(p) => <input {...p} type="date" value={editing.effectiveFrom} onChange={(e) => set("effectiveFrom", e.target.value)} className={inputClass} />}
              </Field>
              <Field label="Invoices fall due" error={errors.dueOn} required>
                {(p) => <input {...p} type="date" value={editing.dueOn} onChange={(e) => set("dueOn", e.target.value)} className={inputClass} />}
              </Field>
            </div>
            <label className="flex items-center gap-2 text-[15px] text-ink">
              <input type="checkbox" checked={editing.active} onChange={(e) => set("active", e.target.checked)} className="size-4" /> Fee is on
            </label>
            {error && <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditing(null)} disabled={busy} className={buttonClass}>Cancel</button>
              <button type="submit" disabled={busy} className={primaryClass}>{busy ? "Saving…" : editing.id ? "Save changes" : "Add fee"}</button>
            </div>
          </form>
        </Dialog>
      )}

      {listing && (
        <PrintSheet branding={branding} title={title} lines={[`Fees in the structure as at ${prettyDate(today)}`, `${shown.length} fees`]} onClose={() => setListing(false)}>
          <PrintTable columns={FEE_COLUMNS} rows={rows} />
        </PrintSheet>
      )}
    </div>
  );
}
