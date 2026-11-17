"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Card, Chip, inputClass, primaryClass, useToday } from "@/components/teacher/shared";
import { hrefFor } from "@/config/navigation";
import { statusOf } from "@/lib/fee-policy";
import { METHOD_LABELS } from "@/lib/cashier/methods";
import { ACCOUNT_LABELS, type CashierTerms } from "@/lib/cashier/terms";
import { timeIn } from "@/lib/cashier/format";
import { prettyDate } from "@/lib/teacher/dates";
import { formatKwacha } from "@/lib/money";
import type { Receipt, StudentAccount } from "@/types/cashier";
import { StatusChip } from "./bits";

const MAX_RESULTS = 20;

export function FindStudentView({ students, receipts, terms, timezone }: { students: StudentAccount[]; receipts: Receipt[]; terms: CashierTerms; timezone: string }) {
  const today = useToday(timezone);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<string | null>(null);

  const q = query.trim().toLowerCase();
  const shown = useMemo(() => (q ? students.filter((s) => `${s.no} ${s.name} ${s.group}`.toLowerCase().includes(q)) : students).slice(0, MAX_RESULTS), [students, q]);
  const student = students.find((s) => s.no === picked) ?? (q && shown.length === 1 ? shown[0] : undefined);
  const recent = student ? receipts.filter((r) => r.studentNo === student.no).slice(0, 6) : [];

  const standing = (s: StudentAccount) => (s.total <= 0 ? ("paid" as const) : today ? statusOf(s.total, s.dueOn, today) : ("due" as const));
  const chip = (s: StudentAccount) => {
    const st = standing(s);
    return <Chip tone={st === "paid" ? "good" : st === "overdue" ? "bad" : "warn"}>{st === "paid" ? "Cleared" : st === "overdue" ? "Overdue" : "Owing"}</Chip>;
  };

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[2fr_3fr]">
      <Card>
        <div className="relative">
          <Search size={16} aria-hidden className="pointer-events-none absolute left-3 top-3 text-muted" />
          <input type="search" value={query} onChange={(e) => { setQuery(e.target.value); setPicked(null); }} placeholder={`${terms.member} number, name or ${terms.group.toLowerCase()}`} aria-label={`Find a ${terms.member.toLowerCase()}`} className={`${inputClass} pl-9`} />
        </div>
        <p className="mt-2 text-sm text-muted" role="status">{shown.length} {shown.length === 1 ? terms.member.toLowerCase() : terms.members}{q ? " found" : ""}</p>
        {shown.length === 0 ? (
          <p className="mt-3 text-[15px] text-muted">No {terms.member.toLowerCase()} matches &quot;{query.trim()}&quot;. Check the number on the {terms.member.toLowerCase()}&apos;s card.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line rounded-lg border border-line">
            {shown.map((s) => (
              <li key={s.no}>
                <button type="button" onClick={() => setPicked(s.no)} aria-current={student?.no === s.no} className={`flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-canvas focus-visible:outline-2 focus-visible:outline-brand ${student?.no === s.no ? "bg-canvas" : ""}`}>
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-ink">{s.name}</span>
                    <span className="block truncate text-sm text-muted">{s.no} · {s.group}</span>
                  </span>
                  <span className="shrink-0 text-right text-sm text-muted">{formatKwacha(s.total)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        {!student ? (
          <p className="text-[15px] text-muted">Choose a {terms.member.toLowerCase()} to see what is owed and the latest payments.</p>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-ink">{student.name}</h2>
                <p className="text-sm text-muted">{student.no} · {student.group}</p>
              </div>
              <div className="flex items-center gap-3">
                {chip(student)}
                <Link href={`${hrefFor("cashier", "collect-payment")}?student=${encodeURIComponent(student.no)}`} className={primaryClass}>Collect payment</Link>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-ink">Fee accounts</h3>
              <ul className="mt-2 divide-y divide-line rounded-lg border border-line">
                {student.lines.map((l) => (
                  <li key={l.kind} className="flex items-center justify-between gap-3 px-3 py-2 text-[15px]">
                    <span className="text-ink">{ACCOUNT_LABELS[l.kind]}</span>
                    <span className="text-right">
                      <span className={l.owed > 0 ? "font-medium text-ink" : "text-muted"}>{l.owed > 0 ? formatKwacha(l.owed) : "Nothing owed"}</span>
                      {l.owed > 0 && l.dueOn && <span className="block text-xs text-muted">Due {prettyDate(l.dueOn)}</span>}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[15px] font-semibold text-ink">Total owed: {formatKwacha(student.total)}</p>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-ink">Recent payments</h3>
              {recent.length === 0 ? (
                <p className="mt-2 text-[15px] text-muted">No payments taken at this desk yet.</p>
              ) : (
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full min-w-120 text-left text-[15px]">
                    <thead>
                      <tr className="border-b border-line text-sm text-muted">
                        <th className="py-1.5 pr-3 font-medium">Receipt</th>
                        <th className="py-1.5 pr-3 font-medium">Date</th>
                        <th className="py-1.5 pr-3 font-medium">Method</th>
                        <th className="py-1.5 pr-3 text-right font-medium">Amount</th>
                        <th className="py-1.5 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recent.map((r) => (
                        <tr key={r.id} className="border-b border-line last:border-0">
                          <td className="py-1.5 pr-3 font-medium text-ink">{r.no}</td>
                          <td className="py-1.5 pr-3 text-muted">{prettyDate(r.date)} {timeIn(r.at, timezone)}</td>
                          <td className="py-1.5 pr-3 text-muted">{METHOD_LABELS[r.method]}</td>
                          <td className="py-1.5 pr-3 text-right">{formatKwacha(r.amount)}</td>
                          <td className="py-1.5"><StatusChip status={r.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
