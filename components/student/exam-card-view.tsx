"use client";

import { useState } from "react";
import { DetailsList, PrintSheet, PrintTable } from "@/components/platform/print-sheet";
import { Card, buttonClass } from "@/components/teacher/shared";
import type { PrintBranding } from "@/lib/print";
import type { FeeBalance } from "@/lib/fee-policy";
import type { StudentTerms } from "@/lib/student/terms";
import { prettyDate } from "@/lib/teacher/dates";
import type { ResultsReport } from "@/types/student";
import { WithheldCard } from "./fee-notice";

/** The exam card: the sittings a student may attend. A school can withhold it until fees are cleared. */
export function ExamCardView({ report, withheld, fee, studentName, studentNumber, group, terms, branding }: { report: ResultsReport; withheld: boolean; fee: FeeBalance; studentName: string; studentNumber: string; group: string; terms: StudentTerms; branding: PrintBranding }) {
  const [printing, setPrinting] = useState(false);
  const sittings = report.courses
    .flatMap((c) => c.items.filter((i) => i.state === "upcoming").map((i) => ({ course: c.courseName, code: c.code, title: i.title, date: i.date })))
    .sort((a, b) => a.date.localeCompare(b.date));
  const columns = [terms.course, "Code", "Assessment", "Date"];
  const rows = sittings.map((s) => [s.course, s.code, s.title, prettyDate(s.date)]);

  if (withheld) {
    return <div className="mt-6"><WithheldCard what="Exam card" fee={fee} terms={terms} /></div>;
  }

  return (
    <div className="mt-6 space-y-6">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-ink">{report.periodLabel} exam card</h2>
            <p className="text-sm text-muted">Bring this card, and your {terms.member.toLowerCase()} number, to every exam.</p>
          </div>
          <button type="button" className={buttonClass} disabled={sittings.length === 0} onClick={() => setPrinting(true)}>Print exam card</button>
        </div>
      </Card>
      <Card>
        {sittings.length === 0 ? (
          <p className="text-[15px] text-muted">No exams are scheduled yet. They will appear here once the timetable is published.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[30rem] text-left text-[15px]">
              <caption className="sr-only">Exams this {terms.period.toLowerCase()}</caption>
              <thead><tr className="text-sm text-muted">{columns.map((c) => <th key={c} scope="col" className="py-2 pr-3 font-medium">{c}</th>)}</tr></thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => <tr key={r.join("|")}><th scope="row" className="py-2 pr-3 font-medium text-ink">{r[0]}</th>{r.slice(1).map((c, i) => <td key={i} className="py-2 pr-3 text-ink">{c}</td>)}</tr>)}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {printing && (
        <PrintSheet branding={branding} title={`Exam card, ${report.periodLabel}`} signature lines={["Valid only with a photo ID."]} onClose={() => setPrinting(false)}>
          <DetailsList details={[[terms.member, studentName], [`${terms.member} number`, studentNumber], [terms.group, group], [terms.period, report.periodLabel]]} />
          <div className="mt-6"><PrintTable columns={columns} rows={rows} /></div>
        </PrintSheet>
      )}
    </div>
  );
}
