"use client";

import { useState, useTransition } from "react";
import { Check, Plus, X } from "lucide-react";
import { Card, Dialog, ExportBar, Field, buttonClass, downloadCsv, inputClass, primaryClass } from "@/components/teacher/shared";
import { PrintSheet, PrintTable } from "@/components/platform/print-sheet";
import { ErrorNote, WaiverChip, textareaClass } from "./bits";
import { decideWaiver, requestWaiver } from "@/server/actions/bursar";
import { WAIVER_COLUMNS, waiverKindLabel, waiverRows } from "@/lib/bursar/format";
import type { BursarTerms } from "@/lib/bursar/terms";
import { checkWaiver } from "@/lib/bursar/validate";
import { ACCOUNT_LABELS } from "@/lib/cashier/terms";
import { formatKwacha } from "@/lib/money";
import type { PrintBranding } from "@/lib/print";
import { csvFilename } from "@/lib/table-tools";
import { prettyDate } from "@/lib/teacher/dates";
import { WAIVER_KINDS, type AccountRow, type Waiver } from "@/types/bursar";

type Draft = { studentNo: string; kind: string; account: string; amount: string; source: string; requestedBy: string; reason: string };
const EMPTY: Draft = { studentNo: "", kind: "bursary", account: "", amount: "", source: "", requestedBy: "", reason: "" };

/** Bursaries, fee waivers and discounts. Nothing reduces an account until the Bursar approves it. */
export function WaiversPanel({ rows, accounts, terms, today, branding }: { rows: Waiver[]; accounts: AccountRow[]; terms: BursarTerms; today: string; branding: PrintBranding }) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [deciding, setDeciding] = useState<{ waiver: Waiver; decision: "approve" | "decline" } | null>(null);
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [listing, setListing] = useState(false);
  const [busy, start] = useTransition();

  const owing = accounts.filter((a) => a.owed > 0);
  const student = accounts.find((a) => a.no === draft?.studentNo);
  const lines = (student?.lines ?? []).filter((l) => l.owed > 0);
  const pending = rows.filter((w) => w.status === "pending");
  const set = (k: keyof Draft, v: string) => setDraft((d) => (d ? { ...d, [k]: v } : d));

  const startRequest = () => {
    setDraft({ ...EMPTY });
    setErrors({});
    setError(null);
  };

  const submitRequest = () => {
    if (!draft) return;
    const owed = Object.fromEntries((student?.lines ?? []).map((l) => [l.kind, l.owed]));
    const c = checkWaiver(draft, { kinds: terms.accountKinds, owed });
    if (!c.ok) {
      setErrors(c.fields ?? {});
      setError(c.error);
      return;
    }
    start(async () => {
      const r = await requestWaiver(draft);
      if (r.ok) setDraft(null);
      else {
        setErrors(r.fields ?? {});
        setError(r.error);
      }
    });
  };

  const submitDecision = () => {
    if (!deciding) return;
    if (deciding.decision === "decline" && !note.trim()) return setError("Say why it is being declined.");
    start(async () => {
      const r = await decideWaiver(deciding.waiver.id, deciding.decision, note);
      if (r.ok) setDeciding(null);
      else setError(r.error);
    });
  };

  const text = waiverRows(rows);

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink">Bursaries and waivers</h2>
          <p className="mt-1 text-sm text-muted" role="status">{pending.length === 0 ? "No requests waiting for a decision." : `${pending.length} ${pending.length === 1 ? "request" : "requests"} waiting for a decision.`}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ExportBar disabled={rows.length === 0} onCsv={() => downloadCsv(csvFilename("Bursaries and waivers", today), [WAIVER_COLUMNS, ...text])} onPrint={() => setListing(true)} />
          <button type="button" onClick={startRequest} className={primaryClass}><Plus size={16} aria-hidden /> New request</button>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="mt-4 text-[15px] text-muted">No bursaries or waivers yet.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-208 text-left text-[15px]">
            <thead>
              <tr className="border-b border-line text-sm text-muted">
                <th className="py-2 pr-3 font-medium">Request</th>
                <th className="py-2 pr-3 font-medium">{terms.member}</th>
                <th className="py-2 pr-3 font-medium">Reduces</th>
                <th className="py-2 pr-3 text-right font-medium">Amount</th>
                <th className="py-2 pr-3 font-medium">Why</th>
                <th className="py-2 pr-3 font-medium">Status</th>
                <th className="py-2"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((w) => (
                <tr key={w.id} className="border-b border-line align-top last:border-0">
                  <td className="py-2 pr-3"><span className="block font-medium text-ink">{w.no}</span><span className="text-sm text-muted">{waiverKindLabel(w.kind)} • {w.source}</span></td>
                  <td className="py-2 pr-3 text-ink">{w.studentName}<span className="block text-sm text-muted">{w.studentNo}</span></td>
                  <td className="py-2 pr-3 text-muted">{ACCOUNT_LABELS[w.account]}</td>
                  <td className="py-2 pr-3 text-right text-ink">{formatKwacha(w.amount)}</td>
                  <td className="max-w-72 py-2 pr-3 text-muted">{w.reason}<span className="block text-sm">Asked by {w.requestedBy}, {prettyDate(w.requestedAt.slice(0, 10))}</span>{w.decisionNote && <span className="block text-sm">Decision: {w.decisionNote}</span>}</td>
                  <td className="py-2 pr-3"><WaiverChip status={w.status} />{w.decidedBy && <span className="mt-1 block text-sm text-muted">{w.decidedBy}</span>}</td>
                  <td className="py-2">
                    {w.status === "pending" && (
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => { setDeciding({ waiver: w, decision: "approve" }); setNote(""); setError(null); }} className={buttonClass} aria-label={`Approve ${w.no}`}><Check size={16} aria-hidden /> Approve</button>
                        <button type="button" onClick={() => { setDeciding({ waiver: w, decision: "decline" }); setNote(""); setError(null); }} className={buttonClass} aria-label={`Decline ${w.no}`}><X size={16} aria-hidden /> Decline</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {draft && (
        <Dialog title="New bursary or waiver request" subtitle="It is recorded as pending. The account only changes once you approve it." onClose={() => !busy && setDraft(null)}>
          <form noValidate onSubmit={(e) => { e.preventDefault(); submitRequest(); }} className="space-y-4 px-6 py-5">
            <Field label={terms.member} error={errors.student} required>
              {(p) => (
                <select {...p} value={draft.studentNo} onChange={(e) => setDraft({ ...draft, studentNo: e.target.value, account: accounts.find((a) => a.no === e.target.value)?.lines.find((l) => l.owed > 0)?.kind ?? "" })} className={inputClass}>
                  <option value="">Choose a {terms.member.toLowerCase()} who owes fees</option>
                  {owing.map((a) => <option key={a.no} value={a.no}>{a.name} ({a.no}), owes {formatKwacha(a.owed)}</option>)}
                </select>
              )}
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Type" error={errors.kind} required>
                {(p) => <select {...p} value={draft.kind} onChange={(e) => set("kind", e.target.value)} className={inputClass}>{WAIVER_KINDS.map((k) => <option key={k} value={k}>{waiverKindLabel(k)}</option>)}</select>}
              </Field>
              <Field label="Reduces" error={errors.account} required>
                {(p) => (
                  <select {...p} value={draft.account} onChange={(e) => set("account", e.target.value)} disabled={!student} className={inputClass}>
                    {lines.length === 0 && <option value="">Choose first</option>}
                    {lines.map((l) => <option key={l.kind} value={l.kind}>{ACCOUNT_LABELS[l.kind]}, owes {formatKwacha(l.owed)}</option>)}
                  </select>
                )}
              </Field>
              <Field label="Amount (kwacha)" error={errors.amount} required>
                {(p) => <input {...p} inputMode="decimal" value={draft.amount} onChange={(e) => set("amount", e.target.value)} className={inputClass} />}
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={draft.kind === "bursary" ? "Who funds it" : "Who is asking"} error={errors.source} required>
                {(p) => <input {...p} value={draft.source} onChange={(e) => set("source", e.target.value)} maxLength={70} className={inputClass} />}
              </Field>
              <Field label="Requested by" error={errors.requestedBy} required>
                {(p) => <input {...p} value={draft.requestedBy} onChange={(e) => set("requestedBy", e.target.value)} maxLength={70} className={inputClass} />}
              </Field>
            </div>
            <Field label="Reason" error={errors.reason} required>
              {(p) => <textarea {...p} value={draft.reason} onChange={(e) => set("reason", e.target.value)} maxLength={210} className={textareaClass} />}
            </Field>
            {error && <ErrorNote>{error}</ErrorNote>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setDraft(null)} disabled={busy} className={buttonClass}>Cancel</button>
              <button type="submit" disabled={busy} className={primaryClass}>{busy ? "Saving…" : "Record request"}</button>
            </div>
          </form>
        </Dialog>
      )}

      {deciding && (
        <Dialog title={`${deciding.decision === "approve" ? "Approve" : "Decline"} ${deciding.waiver.no}`} subtitle={`${waiverKindLabel(deciding.waiver.kind)} of ${formatKwacha(deciding.waiver.amount)} for ${deciding.waiver.studentName}`} onClose={() => !busy && setDeciding(null)}>
          <form noValidate onSubmit={(e) => { e.preventDefault(); submitDecision(); }} className="space-y-4 px-6 py-5">
            <p className="text-[15px] text-muted">{deciding.decision === "approve" ? `This takes ${formatKwacha(deciding.waiver.amount)} off ${ACCOUNT_LABELS[deciding.waiver.account]} now.` : "The account does not change."} {deciding.waiver.reason}</p>
            <Field label={deciding.decision === "approve" ? "Note (optional)" : "Why is it declined?"} required={deciding.decision === "decline"}>
              {(p) => <textarea {...p} value={note} onChange={(e) => setNote(e.target.value)} maxLength={210} className={textareaClass} />}
            </Field>
            {error && <ErrorNote>{error}</ErrorNote>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setDeciding(null)} disabled={busy} className={buttonClass}>Cancel</button>
              <button type="submit" disabled={busy} className={primaryClass}>{busy ? "Saving…" : deciding.decision === "approve" ? "Approve" : "Decline"}</button>
            </div>
          </form>
        </Dialog>
      )}

      {listing && (
        <PrintSheet branding={branding} title="Bursaries and waivers" lines={[`As at ${prettyDate(today)}`]} onClose={() => setListing(false)}>
          <PrintTable columns={WAIVER_COLUMNS} rows={text} />
        </PrintSheet>
      )}
    </Card>
  );
}
