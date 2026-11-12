import { INSTITUTIONS, INSTITUTION_TYPES, LEVEL_LABELS, divisionsLabel, systemLabel, tenantSystem, tenantSystemLabel } from "@/config/institution";
import { scopeLabel, visibleDivisions } from "@/lib/division-scope";
import type { PlatformContext } from "../platform-types";
import { K, table, tableOf, type Builder } from "./shared";
import { staffFor } from "./staff";

const tenants: Builder = ({ tenants }) => ({
  description: "Every school on ACURIS. The institution type decides whether it runs terms or semesters.",
  actions: ["Add tenant"],
  kpis: [
    { title: "Tenants", caption: "On the platform", value: String(tenants.length), note: `${tenants.filter((t) => t.status === "Active").length} active` },
    { title: "Total learners", caption: "Across tenants", value: tenants.reduce((n, t) => n + t.learners, 0).toLocaleString("en-US") },
    { title: "Semester system", caption: "Tertiary tenants", value: String(tenants.filter((t) => tenantSystem(t.divisions) === "semester").length) },
    { title: "Term system", caption: "School-level tenants", value: String(tenants.filter((t) => tenantSystem(t.divisions) === "term").length) },
  ],
  tables: [
    tableOf("tenants",
      "Tenants & schools",
      ["School", "Institution type", "Divisions", "Academic system", "Campuses", "Learners", "Plan", "Status"],
      tenants.map((t) => [
        t.name,
        divisionsLabel(t.divisions),
        String(t.divisions.length),
        tenantSystemLabel(t.divisions),
        String(t.campuses),
        t.learners.toLocaleString("en-US"),
        t.plan,
        t.status,
      ]),
      {
        statusColumn: "Status",
        // Schools are suspended (edit the status), not archived. One with no learners yet can be deleted.
        rowMeta: tenants.map((t) => ({ archivable: false, deletable: t.learners === 0 })),
      },
    ),
  ],
});

const subscriptions: Builder = ({ tenants }) => {
  const price = { Starter: 1500, Growth: 4200, Enterprise: 11800 } as const;
  return {
    description: "Plans, renewals and billing status for every school.",
    actions: ["Change plan"],
    tables: [
      table(
        "Subscriptions",
        ["School", "Plan", "Billing", "Renewal date", "Amount", "Status"],
        tenants.map((t, i) => [
          t.name,
          t.plan,
          "Monthly",
          `${String(10 + i * 4).padStart(2, "0")} Nov 2026`,
          K(price[t.plan]),
          t.status === "Trial" ? "Trial" : "Paid",
        ]),
        { statusColumn: "Status" },
      ),
    ],
  };
};

const platformUsers: Builder = () => ({
  description: "People who run the ACURIS platform itself (not school staff).",
  actions: ["Invite platform user"],
  tables: [
    tableOf("platform-users",
      "Platform users",
      ["Name", "Role", "Email", "Last active", "Status"],
      [
        ["Platform Admin", "Super admin", "admin@acuris.example", "Today 08:42", "Active"],
        ["Mercy Kangwa", "Support lead", "mercy@acuris.example", "Today 07:55", "Active"],
        ["Joseph Daka", "Billing", "joseph@acuris.example", "Yesterday", "Active"],
        ["Ruth Sinkala", "Onboarding", "ruth@acuris.example", "02 Nov 2026", "Pending"],
      ],
      { statusColumn: "Status" },
    ),
  ],
});

const usage: Builder = ({ tenants }) => ({
  description: "Storage and learner capacity per school.",
  tables: [
    table(
      "Usage & capacity",
      ["School", "Learners", "Learner limit", "Storage used", "Status"],
      tenants.map((t, i) => {
        const limit = t.plan === "Starter" ? 1000 : t.plan === "Growth" ? 3000 : 10000;
        const gb = [42, 18, 6, 12, 55, 120][i] ?? 10;
        return [
          t.name,
          t.learners.toLocaleString("en-US"),
          limit.toLocaleString("en-US"),
          `${gb} GB`,
          gb > 50 ? "Review" : "Active",
        ];
      }),
      { statusColumn: "Status" },
    ),
  ],
});

const support: Builder = ({ tenants }) => ({
  description: "Open support tickets from schools.",
  actions: ["New ticket"],
  tables: [
    tableOf("tickets",
      "Support queue",
      ["Ticket", "School", "Subject", "Priority", "Opened", "Status"],
      [
        ["#SUP-1048", tenants[1]?.name ?? "", "Receipts not printing", "High", "Today 07:50", "Open"],
        ["#SUP-1047", tenants[0]?.name ?? "", "Import learners from CSV", "Medium", "Yesterday", "In progress"],
        ["#SUP-1045", tenants[4]?.name ?? "", "Reset registrar password", "Low", "02 Nov 2026", "Resolved"],
      ],
      { statusColumn: "Status" },
    ),
  ],
});

const settings: Builder = () => ({
  description: "Platform-wide defaults. School-specific settings are managed per tenant.",
  actions: ["Edit settings"],
  tables: [
    table(
      "Institution types",
      ["Institution type", "Level", "Grades", "Academic system", "Period label"],
      INSTITUTION_TYPES.map((type) => {
        const info = INSTITUTIONS[type];
        return [
          info.label,
          LEVEL_LABELS[info.level],
          info.grades ?? "—",
          systemLabel(type),
          info.system === "semester" ? "Semester" : "Term",
        ];
      }),
      { note: "Primary (grades 1–7) is for smaller tenants. University and College are Tertiary and use semesters; Primary and High School use terms. A tenant can have several divisions (for example Primary and High School), each with its own students, fees, classes and results. All divisions of a tenant share one academic system, so a High School cannot be combined with a University." },
    ),
    tableOf("settings","General", ["Setting", "Value", "Scope"], [
      ["Default currency", "Zambian Kwacha (ZMW)", "Platform"],
      ["Time zone", "Africa/Lusaka", "Platform"],
      ["Academic year start", "January", "Platform"],
      ["Session timeout", "30 minutes", "Platform"],
      ["Audit trail retention", "7 years", "Platform"],
    ]),
  ],
});

const P = (...p: string[]) => p.join(" ");

/**
 * For a school with several divisions: every staff role assignment and the
 * divisions it covers. With a division selected, only assignments that can
 * see it are listed (the same rule the Staff page uses).
 */
function divisionAccess(ctx: PlatformContext) {
  const tenant = ctx.tenant;
  if (!tenant || tenant.divisions.length < 2) return [];

  const rows = staffFor(ctx).map((m) => [
    m.name,
    m.role,
    scopeLabel(m.scope, tenant.divisions),
    String(visibleDivisions(m.scope, tenant.divisions).length),
    m.status,
  ]);

  return [
    table(
      ctx.division ? `Division access · ${tenant.name} · ${ctx.division.name}` : `Division access · ${tenant.name}`,
      ["Staff", "Role", "Division access", "Divisions visible", "Status"],
      rows,
      {
        statusColumn: "Status",
        note: "A role limited to a division only sees that division's students, classes, fees, registrations and results. Whole-school roles see every division, including ones added later.",
      },
    ),
  ];
}

const access: Builder = (ctx) => ({
  description: "Roles and what each can do in every module. Select a school with several divisions to see who can access which division.",
  actions: ["Add role"],
  tables: [
    ...divisionAccess(ctx),
    tableOf("roles",
      "Staff roles",
      ["Role", "Level", "Scope", "Users", "Description"],
      [
        ["Platform Admin", "Level 1 · Executive", "All schools", "4", "Runs the platform across all schools"],
        ["School Admin", "Level 1 · Executive", "Whole school", "128", "Principal / Vice-Chancellor: full control of one school"],
        ["Head of Division", "Level 2 · Management", "One division", "64", "Runs one division (for example Primary or High School) and sees only its records"],
        ["Registrar", "Level 2 · Management", "Whole school or one division", "96", "Admissions, registrations, results"],
        ["Bursar", "Level 2 · Management", "Whole school or one division", "120", "Fees, bursaries, reconciliation"],
        ["Cashier", "Level 3 · Operational", "Whole school or one division", "210", "Takes payments and issues receipts"],
        ["Lecturer / Teacher", "Level 3 · Operational", "One division", "2,340", "Teaching, assessments, marks entry"],
        ["Hostel Warden", "Level 3 · Operational", "Whole school or one division", "58", "Room allocation and hostel records"],
        ["Student", "Learner", "Own records", "48,620", "Own records only"],
        ["Parent", "Guardian", "Linked children", "31,400", "Linked children only"],
      ],
    ),
    table(
      "Permission matrix",
      ["Module", "Platform Admin", "School Admin", "Head of Division", "Registrar", "Bursar", "Cashier", "Lecturer / Teacher", "Hostel Warden", "Student", "Parent"],
      [
        ["Campuses, Schools, Departments", P("V C E D"), P("V C E D"), "V", "V", "V", "—", "V", "—", "—", "—"],
        ["Finances", P("V C E D A"), P("V C E A"), "V", "V", P("V C E D A"), P("V C"), "—", "—", "V", "V"],
        ["Users", P("V C E D A"), P("V C E A"), P("V C E"), P("V C E"), "V", "V", "V", "V", "V", "V"],
        ["Registrations", P("V C E D A"), P("V C E A"), P("V C E A"), P("V C E A"), "V", "—", "V", "—", "V C", "V"],
        ["Academics", P("V C E D A"), P("V C E A"), P("V C E A"), P("V C E"), "—", "—", P("V C E"), "—", "V", "V"],
        ["Examinations", P("V C E D A"), P("V C E A"), P("V C E A"), P("V C E A"), "V", "—", P("V C E"), "—", "V", "V"],
        ["Hostels", P("V C E D A"), P("V C E A"), "V", "V", "V", "—", "—", P("V C E"), "V", "—"],
        ["Reports", "V", "V", "V", "V", "V", "—", "V", "V", "—", "—"],
        ["Access control", P("V C E D A"), "V", "—", "—", "—", "—", "—", "—", "—", "—"],
        ["Platform settings", P("V C E D A"), "—", "—", "—", "—", "—", "—", "—", "—", "—"],
      ],
      { note: "V view · C create · E edit · D delete · A approve · — no access. Rights apply inside the role's division scope." },
    ),
  ],
});

export const platformScreens: Record<string, Builder> = {
  "tenants-and-schools": tenants,
  subscriptions,
  "platform-users": platformUsers,
  "usage-and-capacity": usage,
  "support-queue": support,
  "platform-settings": settings,
  "access-control": access,
};
