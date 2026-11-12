import { formatStamp } from "@/lib/format";
import { mockAuditLog } from "../audit-mock";
import { tenantSystem } from "@/config/institution";
import { K, LEARNERS, flavour, groupNames, table, tableOf, type Builder } from "./shared";

const pct = (a: number, b: number) => `${Math.round((a / b) * 100)}%`;

const academicReports: Builder = (ctx) => {
  const f = flavour(ctx);
  return {
    description: "Academic performance reports ready to generate or download.",
    actions: ["Generate report"],
    tables: [
      tableOf("academic-reports",
        "Academic reports",
        ["Report", "Scope", f.terms.period, "Generated", "Status"],
        [
          ["Pass rates by " + f.terms.course.toLowerCase(), "Whole school", f.periodName(1), "02 Nov 2026", "Ready"],
          [`Performance by ${f.tertiary ? "programme" : "class"}`, "Whole school", f.periodName(1), "02 Nov 2026", "Ready"],
          ["Attendance summary", "Whole school", f.periodName(2), "—", "Pending"],
          ["Learners at risk", "Whole school", f.periodName(2), "—", "Pending"],
        ],
        { statusColumn: "Status" },
      ),
    ],
  };
};

const admitted: Builder = (ctx) => {
  const f = flavour(ctx);
  if (!ctx.tenant) {
    return {
      description: "Admissions across all schools.",
      tables: [
        table(
          "Admitted students by school",
          ["School", "Intake", "Applications", "Admitted", "Conversion"],
          ctx.tenants.map((t) => {
            const admitted = Math.round(t.learners * 0.18);
            const apps = Math.round(admitted * 1.7);
            return [t.name, "2026", apps.toLocaleString("en-US"), admitted.toLocaleString("en-US"), pct(admitted, apps)];
          }),
        ),
      ],
    };
  }
  const groups = groupNames(f.tertiary, f.primary);
  return {
    description: `Students admitted to ${f.tenantName}.`,
    tables: [
      table(
        "Admitted students",
        ["Student", f.tertiary ? "Programme" : "Class", "Intake", "Admitted on", "Status"],
        LEARNERS.map((l, i) => [
          `${l.no} · ${l.name}`,
          groups[i],
          "2026",
          `${10 + i} Jan 2026`,
          i === 7 ? "Pending" : "Enrolled",
        ]),
        { statusColumn: "Status" },
      ),
    ],
  };
};

const periodRegistrations: Builder = (ctx) => {
  const f = flavour(ctx);
  if (!ctx.tenant) {
    return {
      description: "Term and semester registration progress, per school.",
      tables: [
        table(
          "Registrations by school",
          ["School", "Academic system", "Period", "Eligible", "Registered", "Rate"],
          ctx.tenants.map((t) => {
            const system = tenantSystem(t.divisions);
            const registered = Math.round(t.learners * 0.88);
            return [
              t.name,
              system === "semester" ? "Semester" : "Term",
              system === "semester" ? "Semester 2 2026" : "Term 3 2026",
              t.learners.toLocaleString("en-US"),
              registered.toLocaleString("en-US"),
              pct(registered, t.learners),
            ];
          }),
        ),
      ],
    };
  }
  return {
    description: `${f.terms.period} registration progress at ${f.tenantName}.`,
    tables: [
      table(
        `${f.terms.period} registrations`,
        [f.tertiary ? "Programme" : "Class", "Eligible", "Registered", "Pending", "Rate"],
        (f.tertiary
          ? [["BSc Computer Science", 420, 380], ["BA Accounting & Finance", 510, 462], ["BEng Civil Engineering", 300, 281], ["BSc Nursing", 260, 214]]
          : [["Grade 9A", 42, 40], ["Grade 10B", 36, 36], ["Grade 11A", 31, 27], ["Grade 12", 38, 35]]
        ).map(([name, eligible, registered]) => [
          String(name),
          String(eligible),
          String(registered),
          String(Number(eligible) - Number(registered)),
          pct(Number(registered), Number(eligible)),
        ]),
      ),
    ],
  };
};

const financeReports: Builder = (ctx) => {
  const f = flavour(ctx);
  return {
    description: "Financial reports for the bursar and management.",
    actions: ["Generate report"],
    tables: [
      tableOf("finance-reports",
        "Finance reports",
        ["Report", f.terms.period, "Generated", "Total", "Status"],
        [
          ["Fee collection summary", f.periodName(f.tertiary ? 1 : 2), "02 Nov 2026", K(1284500), "Ready"],
          ["Income by fee type", f.periodName(f.tertiary ? 1 : 2), "02 Nov 2026", K(1284500), "Ready"],
          ["Bursary utilisation", f.periodName(f.tertiary ? 2 : 3), "—", "—", "Pending"],
        ],
        { statusColumn: "Status" },
      ),
    ],
  };
};

const bank: Builder = () => ({
  description: "Bank statement lines and whether they are matched to receipts.",
  actions: ["Import statement"],
  tables: [
    tableOf("bank-transactions",
      "Bank transactions",
      ["Date", "Reference", "Bank", "Description", "Amount", "Status"],
      [
        ["04 Nov 2026", "TRF-88213", "Zanaco", "Fees: STU-1201", K(1200), "Matched"],
        ["04 Nov 2026", "TRF-88190", "Stanbic", "Fees: STU-1048", K(850), "Matched"],
        ["03 Nov 2026", "DEP-55120", "Zanaco", "Cash deposit", K(2500), "Matched"],
        ["03 Nov 2026", "TRF-88075", "FNB", "Unreferenced transfer", K(2350), "Unmatched"],
      ],
      { statusColumn: "Status" },
    ),
  ],
});

const paymentsReport: Builder = () => ({
  description: "Daily collections by payment method.",
  tables: [
    table(
      "Payments report",
      ["Date", "Receipts", "Mobile money", "Bank", "Cash", "Total"],
      [
        ["05 Nov 2026", "24", K(8200), K(6750), K(2500), K(17450)],
        ["04 Nov 2026", "31", K(9100), K(11200), K(3300), K(23600)],
        ["03 Nov 2026", "19", K(5400), K(7600), K(2500), K(15500)],
      ],
    ),
  ],
});

const balances: Builder = (ctx) => {
  const f = flavour(ctx);
  const groups = groupNames(f.tertiary, f.primary);
  const billed = [14500, 12800, 15200, 13900, 14500, 12800];
  const paid = [14500, 8600, 11000, 13900, 9500, 12800];
  return {
    description: "What each student has been billed, paid and still owes.",
    tables: [
      table(
        "Student balances",
        ["Student", f.tertiary ? "Programme" : "Class", "Billed", "Paid", "Balance", "Status"],
        LEARNERS.slice(0, 6).map((l, i) => [
          `${l.no} · ${l.name}`,
          groups[i],
          K(billed[i]),
          K(paid[i]),
          K(billed[i] - paid[i]),
          billed[i] === paid[i] ? "Paid" : billed[i] - paid[i] > 3000 ? "Overdue" : "Partial",
        ]),
        { statusColumn: "Status" },
      ),
    ],
  };
};

const totalReceivables: Builder = (ctx) => {
  if (!ctx.tenant) {
    return {
      description: "Fees still owed to each school.",
      tables: [
        table(
          "Total receivables by school",
          ["School", "Accounts overdue", "Outstanding"],
          ctx.tenants.map((t) => [
            t.name,
            String(Math.round(t.learners * 0.04)),
            K(Math.round(t.learners * 0.04) * 3400),
          ]),
        ),
      ],
    };
  }
  return {
    description: `Fees still owed to ${ctx.tenant.name}.`,
    kpis: [
      { title: "Outstanding", caption: "All active learners", value: K(186450), note: "24 accounts overdue" },
    ],
    tables: [
      table("Total receivables", ["Category", "Accounts", "Outstanding"], [
        ["Tuition", "24", K(142000)],
        ["Examination", "11", K(4950)],
        ["Hostel", "9", K(28800)],
        ["Other", "6", K(10700)],
      ]),
    ],
  };
};

const BUCKETS = ["Current", "1–30 days", "31–60 days", "61–90 days", "90+ days"];

const receivablesAnalysis: Builder = (ctx) => {
  if (!ctx.tenant) {
    return {
      description: "Ageing of fees owed, per school.",
      tables: [
        table(
          "Receivables ageing by school",
          ["School", ...BUCKETS],
          ctx.tenants.map((t) => {
            const total = Math.round(t.learners * 0.04) * 3400;
            return [t.name, ...[0.3, 0.25, 0.2, 0.15, 0.1].map((share) => K(Math.round(total * share)))];
          }),
        ),
      ],
    };
  }
  const total = 186450;
  return {
    description: `Ageing of fees owed to ${ctx.tenant.name}.`,
    tables: [
      table(
        "Receivables analysis",
        ["Age", "Accounts", "Amount", "Share"],
        BUCKETS.map((bucket, i) => {
          const share = [0.3, 0.25, 0.2, 0.15, 0.1][i];
          return [bucket, String([8, 6, 5, 3, 2][i]), K(Math.round(total * share)), `${Math.round(share * 100)}%`];
        }),
      ),
    ],
  };
};

const auditTrail: Builder = (ctx) => {
  const events: Array<[string, string, string, string]> = [
    ["08:42", "Platform Admin", "Tenant created", "Kafue Valley School"],
    ["08:20", "Platform Admin", "Subscription changed", "Plan: Growth"],
    ["07:55", "Mercy Kangwa", "Support ticket escalated", "#SUP-1048"],
    ["07:31", "Mrs. Grace Mumba", "Results published", "Final results"],
    ["07:05", "Mr. Joseph Phiri", "Fee structure edited", "Tuition fees"],
    ["06:48", "Ms. Esther Kunda", "Payment recorded", "RC-02641"],
  ];
  // Changes made through the forms come first, newest first. A school's page shows its own.
  const logged = mockAuditLog
    .list()
    .filter((e) => !ctx.tenant || e.scope === ctx.tenant.id)
    .map((e) => [formatStamp(e.at), e.user, e.action, e.entity, e.school, "Success"]);
  return {
    description: ctx.tenant
      ? `Recent activity at ${ctx.tenant.name}.`
      : "Recent activity across the platform.",
    tables: [
      table(
        "Audit trail",
        ["Time", "User", "Action", "Entity", "School", "Result"],
        [...logged, ...events.map(([time, user, action, entity], i) => [
          `05 Nov 2026 ${time}`,
          user,
          action,
          entity,
          ctx.tenant ? ctx.tenant.name : (ctx.tenants[i % ctx.tenants.length]?.name ?? ""),
          i === 2 ? "Review" : "Success",
        ])],
        { statusColumn: "Result" },
      ),
    ],
  };
};

export const reportScreens: Record<string, Builder> = {
  "reports/academic-reports": academicReports,
  "reports/admitted-students": admitted,
  "reports/period-registrations": periodRegistrations,
  "reports/finance-reports": financeReports,
  "reports/bank-transactions": bank,
  "reports/payments-report": paymentsReport,
  "reports/student-balances": balances,
  "reports/total-receivables": totalReceivables,
  "reports/receivables-analysis": receivablesAnalysis,
  "reports/audit-trail": auditTrail,
};
