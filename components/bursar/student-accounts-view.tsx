"use client";

import { useMemo, useState } from "react";
import { FileText, Search } from "lucide-react";
import { Card, Chip, ExportBar, Stat, downloadCsv, inputClass, buttonClass } from "@/components/teacher/shared";
import { PrintSheet, PrintTable } from "@/components/platform/print-sheet";
import { AccountChip } from "./bits";
import { StatementDialog } from "./statement-dialog";
import { UnallocatedPanel } from "./unallocated-panel";
import { WaiversPanel } from "./waivers-panel";
import { ACCOUNT_COLUMNS, accountRows } from "@/lib/bursar/format";
import type { BursarTerms } from "@/lib/bursar/terms";
import { formatKwacha } from "@/lib/money";
import type { PrintBranding } from "@/lib/print";
import { cn } from "@/lib/format";
import { csvFilename } from "@/lib/table-tools";
import { prettyDate } from "@/lib/teacher/dates";
import type { AccountRow, UnallocatedPayment, Waiver } from "@/types/bursar";

type Tab = "accounts" | "unallocated" | "waivers";

/** Every student's fee account, with statements, reversals, unallocated payments and bursary or waiver approvals. */
export function StudentAccountsView({ accounts, unallocated, waivers, terms, today, branding }: { accounts: AccountRow[]; unallocated: UnallocatedPayment[]; waivers: Waiver[]; terms: BursarTerms; today: string; branding: PrintBranding }) {
  const [tab, setTab] = useState<Tab>("accounts");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [group, setGroup] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [listing, setListing] = useState(false);

  const groups = useMemo(() => [...new Set(accounts.map((a) => a.group))], [accounts]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return accounts.filter((a) => {
      if (group && a.group !== group) return false;
      if (status === "owing" && a.owed <= 0) return false;
      if (status === "overdue" && !(a.owed > 0 && a.status === "overdue")) return false;
      if (status === "cleared" && a.owed > 0) return false;
      if (status === "plan" && !a.onPlan) return false;
      return !q || `${a.name} ${a.no} ${a.group}`.toLowerCase().includes(q);
    });
  }, [accounts, query, status, group]);

  const billed = accounts.reduce((n, a) => n + a.billed, 0);
  const paid = accounts.reduce((n, a) => n + a.paid, 0);
  const waived = accounts.reduce((n, a) => n + a.waived, 0);
  const owed = accounts.reduce((n, a) => n + a.owed, 0);
  const rate = billed - waived > 0 ? Math.round((paid / (billed - waived)) * 100) : 0;
  const waiting = unallocated.filter((u) => u.status === "open");
  const pending = waivers.filter((w) => w.status === "pending");
  const rows = accountRows(shown);
  const title = `${terms.member} accounts`;

  const tabs: Array<[Tab, string, number]> = [
    ["accounts", `${terms.member} accounts`, 0],
    ["unallocated", "Unallocated payments", waiting.length],
    ["waivers", "Bursaries and waivers", pending.length],
  ];

  return (
    <div className="mt-6 space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Billed" value={formatKwacha(billed)} note={`${accounts.length} ${accounts.length === 1 ? terms.member.toLowerCase() : terms.members.toLowerCase()}`} />
        <Stat label="Collected" value={formatKwacha(paid)} note={`${rate}% of what is due`} />
        <Stat label="Waived" value={formatKwacha(waived)} />
        <Stat label="Outstanding" value={formatKwacha(owed)} note={`${accounts.filter((a) => a.owed > 0).length} owing`} />
      </div>

      <div role="tablist" aria-label="Student accounts" className="flex flex-wrap gap-2">
        {tabs.map(([id, label, n]) => (
          <button key={id} type="button" role="tab" id={`tab-${id}`} aria-selected={tab === id} aria-controls={`panel-${id}`} onClick={() => setTab(id)}
            className={cn("inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-[15px] font-medium focus-visible:outline-2 focus-visible:outline-brand", tab === id ? "border-brand bg-brand text-on-brand" : "border-line text-ink hover:bg-canvas")}>
            {label}
            {n > 0 && <span className={cn("rounded-full px-2 text-sm", tab === id ? "bg-white/25" : "bg-warning-soft text-warning")}>{n}</span>}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === "accounts" && (
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative min-w-56">
                  <Search size={16} aria-hidden className="pointer-events-none absolute left-3 top-3 text-muted" />
                  <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Name, number or ${terms.group.toLowerCase()}`} aria-label={`Search ${terms.members.toLowerCase()}`} className={`${inputClass} pl-9`} />
                </div>
                <select aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)} className={`${inputClass} w-auto!`}>
                  <option value="">All accounts</option>
                  <option value="owing">Owing</option>
                  <option value="overdue">Overdue</option>
                  <option value="cleared">Cleared</option>
                  <option value="plan">On a payment plan</option>
                </select>
                <select aria-label={`Filter by ${terms.group.toLowerCase()}`} value={group} onChange={(e) => setGroup(e.target.value)} className={`${inputClass} w-auto!`}>
                  <option value="">All {terms.group.toLowerCase()}s</option>
                  {groups.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <ExportBar disabled={shown.length === 0} onCsv={() => downloadCsv(csvFilename(title, today), [ACCOUNT_COLUMNS, ...rows])} onPrint={() => setListing(true)} />
            </div>
            <p className="mt-3 text-sm text-muted" role="status">{shown.length} of {accounts.length} {accounts.length === 1 ? terms.member.toLowerCase() : terms.members.toLowerCase()}</p>
            {shown.length === 0 ? (
              <p className="mt-3 text-[15px] text-muted">No accounts match.</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-208 text-left text-[15px]">
                  <thead>
                    <tr className="border-b border-line text-sm text-muted">
                      <th className="py-2 pr-3 font-medium">{terms.member}</th>
                      <th className="py-2 pr-3 text-right font-medium">Billed</th>
                      <th className="py-2 pr-3 text-right font-medium">Paid</th>
                      <th className="py-2 pr-3 text-right font-medium">Owed</th>
                      <th className="py-2 pr-3 font-medium">Due</th>
                      <th className="py-2 pr-3 font-medium">Status</th>
                      <th className="py-2"><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((a) => (
                      <tr key={a.no} className="border-b border-line align-top last:border-0">
                        <td className="py-2 pr-3"><span className="block font-medium text-ink">{a.name}</span><span className="text-sm text-muted">{a.no} • {a.group}</span></td>
                        <td className="py-2 pr-3 text-right text-muted">{formatKwacha(a.billed)}</td>
                        <td className="py-2 pr-3 text-right text-muted">{formatKwacha(a.paid)}</td>
                        <td className="py-2 pr-3 text-right font-medium text-ink">{formatKwacha(a.owed)}</td>
                        <td className="py-2 pr-3 text-muted">{a.owed > 0 && a.dueOn ? prettyDate(a.dueOn) : "—"}</td>
                        <td className="py-2 pr-3">
                          <div className="flex flex-wrap gap-1">
                            <AccountChip account={a} />
                            {a.onPlan && <Chip>Plan</Chip>}
                            {a.pendingWaivers > 0 && <Chip tone="warn">Waiver pending</Chip>}
                          </div>
                        </td>
                        <td className="py-2 text-right">
                          <button type="button" onClick={() => setOpen(a.no)} className={buttonClass} aria-label={`Open statement for ${a.name}`}><FileText size={16} aria-hidden /> Statement</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}
        {tab === "unallocated" && <UnallocatedPanel rows={unallocated} accounts={accounts} terms={terms} today={today} branding={branding} />}
        {tab === "waivers" && <WaiversPanel rows={waivers} accounts={accounts} terms={terms} today={today} branding={branding} />}
      </div>

      {open && <StatementDialog studentNo={open} terms={terms} today={today} branding={branding} onClose={() => setOpen(null)} />}

      {listing && (
        <PrintSheet branding={branding} title={title} lines={[`As at ${prettyDate(today)}`, `${shown.length} accounts`]} onClose={() => setListing(false)}>
          <PrintTable columns={ACCOUNT_COLUMNS} rows={rows} />
        </PrintSheet>
      )}
    </div>
  );
}
