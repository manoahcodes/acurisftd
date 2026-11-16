"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { DetailsList, PrintSheet, PrintTable } from "@/components/platform/print-sheet";
import { Card, Chip, ExportBar, Stat, buttonClass, downloadCsv, useToday } from "@/components/teacher/shared";
import type { FeeBalance } from "@/lib/fee-policy";
import { cn } from "@/lib/format";
import type { PrintBranding } from "@/lib/print";
import { csvFilename } from "@/lib/table-tools";
import { prettyDate } from "@/lib/teacher/dates";
import type { StudentTerms } from "@/lib/student/terms";
import { WithheldCard } from "./fee-notice";
import type { CourseResult, PastPeriod, ResultItem, ResultsReport } from "@/types/student";

const fmt = (n: number | null, suffix = "%") => (n === null ? "—" : `${n}${suffix}`);
const gradeTone = (r: Pick<CourseResult, "final" | "passed">) => (r.final === null ? "info" : r.passed ? "good" : "bad");

const STATE_LABEL: Record<ResultItem["state"], string> = { marked: "", absent: "Absent", excused: "Excused", pending: "Being marked", upcoming: "Not sat yet" };

export function ResultsView({ report, studentName, studentNumber, group, terms, branding, slipWithheld = false, fee, slipName = "Result slip", printPast = false, forParent = false }: { forParent?: boolean; slipName?: string; printPast?: boolean; slipWithheld?: boolean; fee: FeeBalance; report: ResultsReport; studentName: string; studentNumber: string; group: string; terms: StudentTerms; branding: PrintBranding }) {
  const today = useToday(branding.timezone);
  const [open, setOpen] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  const [past, setPast] = useState<PastPeriod | null>(null);
  const tertiary = terms.tertiary;
  const passed = report.courses.filter((c) => c.passed).length;
  const best = report.courses.filter((c) => c.final !== null).sort((a, b) => b.final! - a.final!)[0];

  const columns = [terms.course, "Code", ...(tertiary ? ["Credits"] : []), "Coursework", "Final %", "Grade", ...(tertiary ? ["Points"] : []), "Remark"];
  const table = report.courses.map((c) => [c.courseName, c.code, ...(tertiary ? [String(c.credits ?? "")] : []), fmt(c.coursework), fmt(c.final), c.grade, ...(tertiary ? [c.points === null ? "" : String(c.points)] : []), c.remark]);

  return (
    <div className="mt-6 space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {tertiary ? (
          <>
            <Stat label={`GPA, ${report.periodLabel}`} value={report.gpa === null ? "—" : report.gpa.toFixed(2)} note={report.provisional ? "Provisional: results still to come" : "Out of 4.00"} />
            <Stat label="Cumulative GPA" value={report.cumulativeGpa === null ? "—" : report.cumulativeGpa.toFixed(2)} note={`Across ${report.history.length + 1} semesters`} />
          </>
        ) : (
          <>
            <Stat label={`Average, ${report.periodLabel}`} value={fmt(report.average)} note={report.provisional ? "Provisional: results still to come" : undefined} />
            <Stat label="Overall grade" value={report.overallGrade} />
          </>
        )}
        <Stat label={`${terms.courses} passing`} value={`${passed} of ${report.courses.length}`} note={`Pass mark ${report.passMark}%`} />
        {tertiary ? <Stat label="Credits passed" value={`${report.creditsPassed} of ${report.creditsTotal}`} /> : <Stat label="Strongest subject" value={best?.courseName ?? "—"} note={best ? fmt(best.final) : undefined} />}
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-ink">{report.periodLabel}</h2>
            <p className="text-sm text-muted">Marked assignments count for {report.courses[0]?.courseworkWeight ?? 20}% of each {terms.course.toLowerCase()}; assessments share the rest by weight. Anything not yet marked is left out, so the figures can still change.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {!slipWithheld && <ExportBar onCsv={() => downloadCsv(csvFilename(`results ${report.periodLabel}`, today || "export"), [columns, ...table])} onPrint={() => setPrinting(true)} disabled={report.courses.length === 0} />}
          </div>
        </div>
      </Card>

      {slipWithheld && <WithheldCard what={slipName} fee={fee} terms={terms} forParent={forParent} />}

      <ul className="space-y-3">
        {report.courses.map((c) => {
          const isOpen = open === c.courseId;
          return (
            <li key={c.courseId}>
              <Card className="p-0">
                <h3>
                  <button type="button" aria-expanded={isOpen} aria-controls={`res-${c.courseId}`} onClick={() => setOpen(isOpen ? null : c.courseId)} className="flex w-full flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl px-5 py-4 text-left hover:bg-canvas focus-visible:outline-2 focus-visible:outline-brand">
                    <span className="min-w-48 flex-1">
                      <span className="block text-[17px] font-semibold text-ink">{c.courseName}</span>
                      <span className="block text-sm text-muted">{c.code}{c.credits ? ` · ${c.credits} credits` : ""} · {c.teacher}</span>
                    </span>
                    <span className="w-40">
                      <span className="block text-[15px] font-semibold text-ink">{fmt(c.final)}</span>
                      <span className="mt-1 block h-2 overflow-hidden rounded-full bg-canvas" aria-hidden>
                        <span className={cn("block h-full rounded-full", c.passed === false ? "bg-danger" : "bg-brand")} style={{ width: `${Math.min(100, c.final ?? 0)}%` }} />
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      <Chip tone={gradeTone(c)}>{c.grade === "—" ? "No grade yet" : `${c.grade} · ${c.remark}`}</Chip>
                      {c.provisional && <Chip tone="warn">Provisional</Chip>}
                    </span>
                    <ChevronDown size={18} aria-hidden className={cn("shrink-0 text-muted transition-transform", isOpen && "rotate-180")} />
                  </button>
                </h3>
                {isOpen && (
                  <div id={`res-${c.courseId}`} className="overflow-x-auto border-t border-line px-5 py-4">
                    <table className="w-full min-w-[34rem] text-left text-[15px]">
                      <caption className="sr-only">{c.courseName} results</caption>
                      <thead>
                        <tr className="text-sm text-muted">
                          <th scope="col" className="py-2 pr-3 font-medium">Assessment</th>
                          <th scope="col" className="py-2 pr-3 font-medium">Date</th>
                          <th scope="col" className="py-2 pr-3 font-medium">Weight</th>
                          <th scope="col" className="py-2 pr-3 font-medium">Mark</th>
                          <th scope="col" className="py-2 pr-3 font-medium">%</th>
                          <th scope="col" className="py-2 font-medium">Class average</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {c.items.map((i) => (
                          <tr key={i.id}>
                            <th scope="row" className="py-2 pr-3 font-medium text-ink">{i.title}<span className="block text-sm font-normal text-muted">{i.kind}</span></th>
                            <td className="py-2 pr-3 text-muted">{prettyDate(i.date)}</td>
                            <td className="py-2 pr-3 text-muted">{i.weight}%</td>
                            <td className="py-2 pr-3 text-ink">{i.mark !== null ? `${i.mark} / ${i.maxMarks}` : <span className="text-muted">{STATE_LABEL[i.state]}</span>}</td>
                            <td className="py-2 pr-3 text-ink">{fmt(i.pct)}</td>
                            <td className="py-2 text-muted">{fmt(i.classAverage)}</td>
                          </tr>
                        ))}
                        <tr>
                          <th scope="row" className="py-2 pr-3 font-medium text-ink">Assignments<span className="block text-sm font-normal text-muted">{c.courseworkCount} marked</span></th>
                          <td className="py-2 pr-3 text-muted">—</td>
                          <td className="py-2 pr-3 text-muted">{c.courseworkWeight}%</td>
                          <td className="py-2 pr-3 text-muted">{c.courseworkCount ? "Average" : "None marked yet"}</td>
                          <td className="py-2 pr-3 text-ink">{fmt(c.coursework)}</td>
                          <td className="py-2 text-muted">—</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </li>
          );
        })}
      </ul>

      <Card>
        <h2 className="text-lg font-semibold text-ink">Earlier {terms.period.toLowerCase()}s</h2>
        {report.history.length === 0 ? (
          <p className="mt-2 text-[15px] text-muted">Nothing yet.</p>
        ) : (
          <div className="mt-3 space-y-5">
            {[...report.history].reverse().map((h) => (
              <div key={h.label} className="overflow-x-auto">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-[16px] font-semibold text-ink">{h.label}</h3>
                  <p className="flex flex-wrap items-center gap-3 text-sm text-muted">{h.gpa !== null ? `GPA ${h.gpa.toFixed(2)} · ${h.credits} credits · ` : ""}Average {h.average}%{printPast && !slipWithheld && <button type="button" onClick={() => setPast(h)} className={buttonClass}>Print {slipName.toLowerCase()}</button>}</p>
                </div>
                <table className="mt-2 w-full min-w-[28rem] text-left text-[15px]">
                  <caption className="sr-only">{h.label} results</caption>
                  <thead>
                    <tr className="text-sm text-muted">
                      <th scope="col" className="py-1.5 pr-3 font-medium">{terms.course}</th>
                      {tertiary && <th scope="col" className="py-1.5 pr-3 font-medium">Credits</th>}
                      <th scope="col" className="py-1.5 pr-3 font-medium">%</th>
                      <th scope="col" className="py-1.5 font-medium">Grade</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {h.courses.map((c) => (
                      <tr key={c.name}>
                        <th scope="row" className="py-1.5 pr-3 font-medium text-ink">{c.name}</th>
                        {tertiary && <td className="py-1.5 pr-3 text-muted">{c.credits}</td>}
                        <td className="py-1.5 pr-3 text-ink">{c.pct}%</td>
                        <td className="py-1.5 text-ink">{c.grade}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <details>
          <summary className="cursor-pointer text-lg font-semibold text-ink focus-visible:outline-2 focus-visible:outline-brand">Grading scale</summary>
          <table className="mt-3 w-full max-w-lg text-left text-[15px]">
            <caption className="sr-only">Grading scale</caption>
            <thead><tr className="text-sm text-muted"><th scope="col" className="py-1.5 pr-3 font-medium">From</th><th scope="col" className="py-1.5 pr-3 font-medium">Grade</th>{tertiary && <th scope="col" className="py-1.5 pr-3 font-medium">Points</th>}<th scope="col" className="py-1.5 font-medium">Meaning</th></tr></thead>
            <tbody className="divide-y divide-line">
              {report.bands.map((b) => <tr key={b.grade}><td className="py-1.5 pr-3 text-muted">{b.min}%</td><th scope="row" className="py-1.5 pr-3 font-medium text-ink">{b.grade}</th>{tertiary && <td className="py-1.5 pr-3 text-ink">{b.points.toFixed(1)}</td>}<td className="py-1.5 text-ink">{b.remark}</td></tr>)}
            </tbody>
          </table>
          {!slipWithheld && <button type="button" onClick={() => setPrinting(true)} className={`${buttonClass} mt-4`}>Print {slipName.toLowerCase()}</button>}
        </details>
      </Card>

      {printing && !slipWithheld && (
        <PrintSheet branding={branding} title={`${slipName}, ${report.periodLabel}`} signature lines={[report.provisional ? "Provisional: some results are still to come." : "Final results."]} onClose={() => setPrinting(false)}>
          <DetailsList details={[[terms.member, studentName], [`${terms.member} number`, studentNumber], [terms.group, group], [terms.period, report.periodLabel], ...(tertiary ? ([["GPA", report.gpa === null ? "—" : report.gpa.toFixed(2)], ["Cumulative GPA", report.cumulativeGpa === null ? "—" : report.cumulativeGpa.toFixed(2)]] as Array<[string, string]>) : ([["Average", fmt(report.average)], ["Overall grade", report.overallGrade]] as Array<[string, string]>))]} />
          <div className="mt-6"><PrintTable columns={columns} rows={table} /></div>
        </PrintSheet>
      )}
      {past && !slipWithheld && (
        <PrintSheet branding={branding} title={`${slipName}, ${past.label}`} signature lines={["Final results."]} onClose={() => setPast(null)}>
          <DetailsList details={[[terms.member, studentName], [`${terms.member} number`, studentNumber], [terms.group, group], [terms.period, past.label], ...(tertiary ? ([["GPA", past.gpa === null ? "—" : past.gpa.toFixed(2)], ["Credits", String(past.credits)]] as Array<[string, string]>) : ([["Average", `${past.average}%`]] as Array<[string, string]>))]} />
          <div className="mt-6"><PrintTable columns={[terms.course, ...(tertiary ? ["Credits"] : []), "Final %", "Grade"]} rows={past.courses.map((c) => [c.name, ...(tertiary ? [String(c.credits ?? "")] : []), `${c.pct}%`, c.grade])} /></div>
        </PrintSheet>
      )}
    </div>
  );
}
