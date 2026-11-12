import { INSTITUTIONS, INSTITUTION_TYPES, type Division } from "@/config/institution";
import { parseMoney } from "@/lib/forms/validate";
import type { FieldDef, FormSpec, FormValues } from "@/types/forms";
import type { PlatformContext } from "../repositories/platform-types";
import { COURSE_ROWS, K, LEARNERS, flavour, groupNames, type Flavour } from "../repositories/platform-mock/shared";
import { isDivisionScoped } from "../repositories/platform-mock/divisions";

/**
 * Every create / edit form on the Platform Admin screens.
 *
 * A form is tied to a table by TableSection.id and to a button by its label
 * (`action`). Each field names the table column it fills, so what you type
 * shows up in that column. `derive` fills columns the person is not asked
 * about (totals, codes). tests/forms-registry.test.ts checks that every
 * column named here exists in the real table for every institution type.
 */
export type FormEntry = {
  /** Button label (as the screen builder words it) that opens this form to create. */
  action?: string;
  spec: FormSpec;
  /** Extra cells computed from the validated values, by column header. */
  derive?: (values: FormValues, f: Flavour) => Record<string, string>;
  /** Recompute `derive` on edit too (only when every value it reads can be edited). */
  deriveOnEdit?: boolean;
  /** Extra rule across fields (e.g. closing date after opening). Returns errors by field name. */
  check?: (values: FormValues) => Record<string, string> | null;
  /** Like `check`, but also sees the row being edited (as column → cell), for rules that depend on it. */
  checkEdit?: (values: FormValues, row: Record<string, string>) => Record<string, string> | null;
};

type Maker = (ctx: PlatformContext, f: Flavour) => FormEntry[];

// ---------- field helpers ----------
const req = <T extends FieldDef>(f: T): T => ({ required: true, ...f });
const text = (name: string, label: string, column: string, extra: Partial<FieldDef> = {}): FieldDef =>
  req({ name, label, type: "text", column, maxLength: 80, ...extra });
const select = (name: string, label: string, column: string, options: string[], extra: Partial<FieldDef> = {}): FieldDef =>
  req({ name, label, type: "select", column, options, ...extra });
const num = (name: string, label: string, column: string, extra: Partial<FieldDef> = {}): FieldDef =>
  req({ name, label, type: "number", column, min: 0, max: 100000, ...extra });
const money = (name: string, label: string, column: string, extra: Partial<FieldDef> = {}): FieldDef =>
  req({ name, label, type: "money", column, min: 0, max: 10000000, ...extra });
const date = (name: string, label: string, column: string): FieldDef =>
  req({ name, label, type: "date", column });
const status = (options: string[], defaultValue = options[0]): FieldDef =>
  select("status", "Status", "Status", options, { defaultValue });
const auto = (name: string, label: string, column: string, prefix: string, digits: number): FieldDef => ({
  name, label, type: "text", column, auto: { prefix, digits },
});

const uniq = (xs: string[]) => [...new Set(xs)];
const val = (v: FormValues, name: string): string => {
  const x = v[name];
  return typeof x === "string" ? x : "";
};

// ---------- rules shared by forms ----------
const ALL = "All divisions";

/**
 * Whole-school roles cover every division; a division's Head covers only that
 * division. Returns what is wrong, or null.
 */
export function accessRule(role: string, access: string, divisions: Division[]): string | null {
  if (/^(Principal|Vice-Chancellor)$/.test(role) && access !== ALL) return `${role} covers the whole school. Choose "${ALL}".`;
  const head = divisions.find((d) => role === `Head of ${d.name}`);
  if (head && access !== head.name) return `${role} covers ${head.name} only. Choose ${head.name}.`;
  return null;
}

/** "Grades 1-7", "grades 1 – 7" or "1–7" → "Grades 1–7"; null when it is not a sensible range. */
export function parseGrades(text: string): string | null {
  const m = /^(?:grades?\s*)?(\d{1,2})\s*[–-]\s*(\d{1,2})$/i.exec(text.trim());
  if (!m) return null;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return a >= 1 && b <= 12 && a < b ? `Grades ${a}–${b}` : null;
}

/** Permission matrix: role columns, and the rights a cell can hold. */
export const PERMISSION_ROLES = ["Platform Admin", "School Admin", "Head of Division", "Registrar", "Bursar", "Cashier", "Lecturer / Teacher", "Hostel Warden", "Student", "Parent"];
export const RIGHTS = ["V", "C", "E", "D", "A"];

// ---------- shared option lists ----------
const CAMPUSES = ["Main Campus", "North Campus", "Distance Learning Centre"];
const METHODS = ["Mobile money", "Cash", "Bank"];
const HOUSES = ["Kafue House", "Zambezi House", "Luangwa House", "Kariba House"];
const VENUES = ["Main Hall", "Block B Hall", "Lab 2"];

const departments = (f: Flavour) =>
  f.tertiary
    ? ["Computer Science", "Accounting & Finance", "Civil Engineering", "Nursing", "Education", "Administration"]
    : ["Mathematics", "English", "Sciences", "Humanities", "Languages", "Administration"];

/** Student numbers carry the division code when a school has several divisions. */
function learnerNo(ctx: PlatformContext, no: string): string {
  const d = ctx.division;
  return d && (ctx.tenant?.divisions.length ?? 0) > 1 ? no.replace(/^STU-/, `${d.code}-`) : no;
}
const learnerOptions = (ctx: PlatformContext) => LEARNERS.map((l) => `${learnerNo(ctx, l.no)} · ${l.name}`);
const periods = (f: Flavour) => [1, 2, 3].slice(0, f.tertiary ? 2 : 3).map((n) => f.periodName(n));
const courseTitles = (f: Flavour) => COURSE_ROWS(f.tertiary, f.primary).map(([, title]) => title);
const studentPrefix = (ctx: PlatformContext) =>
  ctx.division && (ctx.tenant?.divisions.length ?? 0) > 1 ? `${ctx.division.code}-` : "STU-";

const form = (
  id: string,
  tableId: string,
  title: string,
  keyColumns: string[],
  fields: FieldDef[],
  extra: Partial<FormSpec> = {},
): FormSpec => ({ id, tableId, title, submitLabel: "Save", target: "row", keyColumns, fields, ...extra });

/** A form for records with history: archived, never deleted. */
const keepForm = (...args: Parameters<typeof form>): FormSpec => ({ ...form(...args), keep: true });

// ---------- makers by page slug ----------
const MAKERS: Record<string, Maker> = {
  "institution/campuses": () => [
    {
      action: "Add campus",
      spec: form("campus", "campuses", "campus", ["Campus"], [
        text("name", "Campus name", "Campus", { lockedOnEdit: true }),
        text("code", "Code", "Code", { maxLength: 8, placeholder: "MAIN" }),
        text("location", "Location", "Location"),
        status(["Active", "Pending", "Inactive"]),
      ], { rowDefaults: { Departments: "0", Learners: "0" } }),
    },
  ],

  "institution/schools": (_c, f) => [
    {
      action: f.tertiary ? "Add school" : "Add section",
      spec: form("section", "schools", f.tertiary ? "school" : "section", ["Name"], [
        text("name", f.tertiary ? "School name" : "Section name", "Name", { lockedOnEdit: true }),
        text("head", "Head", "Head"),
        status(["Active", "Pending"]),
      ], { rowDefaults: { Departments: "0", [f.terms.programmes]: "0", Learners: "0" } }),
    },
  ],

  "institution/departments": (_c, f) => [
    {
      action: "Add department",
      spec: form("department", "departments", "department", ["Department"], [
        text("name", "Department name", "Department", { lockedOnEdit: true }),
        text("parent", f.tertiary ? "School" : "Section", f.tertiary ? "School" : "Section"),
        text("head", "Head", "Head"),
        select("campus", "Campus", "Campus", CAMPUSES),
        status(["Active", "Pending"]),
      ], { rowDefaults: { Staff: "0" } }),
    },
  ],

  "finances/bursary-management": () => [
    {
      action: "New bursary",
      spec: form("bursary", "bursaries", "bursary", ["Bursary"], [
        text("name", "Bursary name", "Bursary", { lockedOnEdit: true }),
        text("sponsor", "Sponsor", "Sponsor"),
        num("beneficiaries", "Beneficiaries", "Beneficiaries", { min: 1 }),
        money("value", "Value each (kwacha)", "Value each", { min: 1 }),
        status(["Active", "Pending"]),
      ]),
      deriveOnEdit: true,
      derive: (v) => ({ "Total awarded": K(Number(val(v, "beneficiaries")) * parseMoney(val(v, "value"))) }),
    },
  ],

  "finances/tuition-fees": (_c, f) => {
    const perPeriod = `Fee per ${f.terms.period.toLowerCase()}`;
    const klass = f.tertiary ? "Programme" : "Class";
    return [
      {
        action: "Add fee structure",
        spec: form("tuition-fee", "tuition", "fee structure", [klass], [
          select("group", klass, klass, uniq(groupNames(f.tertiary, f.primary)), { lockedOnEdit: true }),
          money("fee", `${perPeriod} (kwacha)`, perPeriod, { min: 1 }),
          date("effective", "Effective from", "Effective"),
          status(["Active", "Pending"]),
        ]),
        deriveOnEdit: true,
        derive: (v, fl) => ({ "Per year": K(parseMoney(val(v, "fee")) * (fl.tertiary ? 2 : 3)) }),
      },
    ];
  },

  "finances/other-fees": (_c, f) => [
    {
      action: "Add fee",
      spec: form("other-fee", "other-fees", "fee", ["Fee"], [
        text("name", "Fee name", "Fee", { lockedOnEdit: true }),
        select("applies", "Applies to", "Applies to", ["All learners", "Boarders", "Optional", "New learners"]),
        money("amount", "Amount (kwacha)", "Amount", { min: 1 }),
        select("frequency", "Frequency", "Frequency", [`Per ${f.terms.period.toLowerCase()}`, "Per year", "Once-off"]),
        status(["Active", "Pending"]),
      ]),
    },
  ],

  "finances/student-payments": (ctx) => [
    {
      action: "Record payment",
      spec: keepForm("payment", "payments", "payment", ["Receipt"], [
        auto("receipt", "Receipt no.", "Receipt", "RC-", 5),
        select("student", "Student", "Student", learnerOptions(ctx), { lockedOnEdit: true }),
        select("method", "Method", "Method", METHODS),
        money("amount", "Amount (kwacha)", "Amount", { min: 1 }),
        date("date", "Date", "Date"),
        status(["Success", "Pending", "Failed"]),
      ]),
    },
  ],

  "users/students": (ctx, f) => [
    {
      action: "Add student",
      spec: form("student", "students", "student", ["Student no."], [
        auto("no", "Student no.", "Student no.", studentPrefix(ctx), 4),
        text("name", "Full name", "Name"),
        select("group", f.tertiary ? "Programme" : "Class", f.tertiary ? "Programme" : "Class", uniq(groupNames(f.tertiary, f.primary))),
        select("campus", "Campus", "Campus", CAMPUSES),
        status(["Active", "Suspended", "Withdrawn"]),
      ]),
    },
  ],

  "users/staff": (ctx) => {
    const divisions = ctx.tenant?.divisions ?? [];
    const multi = divisions.length > 1;
    return [
      {
        action: "Add staff member",
        spec: form("staff", "staff", "staff member", ["Staff no."], [
          text("name", "Full name", "Name"),
          auto("no", "Staff no.", "Staff no.", "STF-", 4),
          select("role", "Role", "Role", [
            "Principal", "Vice-Chancellor", "Registrar", "Bursar", "Cashier", "Hostel Warden", "Admissions Officer",
            ...(multi ? divisions.map((d) => `Head of ${d.name}`) : ["Head of Division"]),
          ]),
          select("level", "Level", "Level", ["Level 1 · Executive", "Level 2 · Management", "Level 3 · Operational"]),
          select("department", "Department", "Department", ["Administration", "Registry", "Finance", "Student Affairs"]),
          ...(multi
            ? [select("access", "Division access", "Division access", [ALL, ...divisions.map((d) => d.name)], { defaultValue: ALL })]
            : []),
          status(["Active", "Pending"]),
        ]),
        check: multi ? (v) => { const m = accessRule(val(v, "role"), val(v, "access"), divisions); return m ? { access: m } : null; } : undefined,
      },
    ];
  },

  "users/educators": (_c, f) => [
    {
      action: `Add ${f.terms.educators.toLowerCase().replace(/s$/, "")}`,
      spec: form("educator", "educators", f.terms.educators.toLowerCase().replace(/s$/, ""), ["Staff no."], [
        text("name", "Full name", "Name"),
        auto("no", "Staff no.", "Staff no.", "STF-", 4),
        select("department", "Department", "Department", departments(f)),
        text("courses", f.terms.courses, f.terms.courses, { help: "Separate several with commas." }),
        num("hours", "Weekly hours", "Weekly hours", { max: 60 }),
        status(["Active", "On leave"]),
      ]),
    },
  ],

  "registrations/period-registration": (_ctx, f) => [
    {
      action: `Open ${f.terms.period.toLowerCase()} registration`,
      spec: form("registration-window", "registration-windows", "registration window", ["Period"], [
        select("period", f.terms.period, "Period", periods(f), { lockedOnEdit: true, defaultValue: periods(f)[periods(f).length - 1] }),
        date("opens", "Opens", "Opens"),
        date("closes", "Closes", "Closes"),
        select("status", "Status", "Status", ["Open", "Scheduled", "Closed"], { defaultValue: "Open" }),
      ]),
      check: (v) => (val(v, "opens") && val(v, "closes") && val(v, "closes") < val(v, "opens") ? { closes: "Closing date must be after the opening date." } : null),
    },
  ],

  "registrations/course-registration": (ctx, f) => [
    {
      action: `Register ${f.terms.course.toLowerCase()}`,
      spec: keepForm("course-registration", "course-registration", "course registration", ["Student", f.terms.course, f.terms.period], [
        select("student", "Student", "Student", learnerOptions(ctx), { lockedOnEdit: true }),
        select("course", f.terms.course, f.terms.course, courseTitles(f), { lockedOnEdit: true }),
        select("period", f.terms.period, f.terms.period, periods(f), { lockedOnEdit: true, defaultValue: periods(f)[periods(f).length - 1] }),
        status(["Registered", "Pending"]),
      ]),
      derive: (v, fl) => ({
        Code: COURSE_ROWS(fl.tertiary, fl.primary).find(([, t]) => t === val(v, "course"))?.[0] ?? "—",
      }),
    },
  ],

  "registrations/exam-registration": (ctx, f) => [
    {
      action: "Register for exams",
      spec: keepForm("exam-registration", "exam-registration", "exam registration", ["Student", f.terms.course, "Exam session"], [
        select("student", "Student", "Student", learnerOptions(ctx), { lockedOnEdit: true }),
        select("course", f.terms.course, f.terms.course, courseTitles(f), { lockedOnEdit: true }),
        select("session", "Exam session", "Exam session", periods(f).map((p) => `${p} exams`), { lockedOnEdit: true }),
        select("paid", "Exam fee paid", "Exam fee paid", ["Yes", "No"], { defaultValue: "No" }),
        status(["Registered", "Pending"]),
      ]),
    },
  ],

  "registrations/exam-receipts": (ctx) => [
    {
      action: "Issue receipt",
      spec: keepForm("exam-receipt", "exam-receipts", "exam receipt", ["Receipt"], [
        auto("receipt", "Receipt no.", "Receipt", "EX-", 5),
        select("student", "Student", "Student", learnerOptions(ctx), { lockedOnEdit: true }),
        money("fee", "Exam fee (kwacha)", "Exam fee", { min: 1, defaultValue: "450" }),
        date("date", "Date", "Date"),
        status(["Issued", "Pending"]),
      ]),
    },
  ],

  "academics/programmes": (_c, f) =>
    f.tertiary
      ? [
          {
            action: "Add programme",
            spec: form("programme", "programmes", "programme", ["Code"], [
              text("code", "Code", "Code", { maxLength: 12, lockedOnEdit: true, placeholder: "BSC-CS" }),
              text("name", "Programme name", "Programme"),
              text("school", "School", "School"),
              select("duration", "Duration", "Duration", ["2 years", "3 years", "4 years", "5 years"]),
              status(["Active", "Pending"]),
            ], { rowDefaults: { Students: "0" } }),
          },
        ]
      : [
          {
            action: "Add class",
            spec: form("class", "programmes", "class", ["Class"], [
              text("name", "Class", "Class", { lockedOnEdit: true, placeholder: "Grade 8A" }),
              select(
                "level", "Level", "Level",
                f.primary ? ["Lower primary", "Upper primary"] : ["Junior", "Senior"],
              ),
              text("teacher", "Class teacher", "Class teacher"),
              text("room", "Room", "Room", { maxLength: 12 }),
              status(["Active", "Pending"]),
            ], { rowDefaults: { Learners: "0" } }),
          },
        ],

  "academics/courses": (_c, f) => [
    {
      action: `Add ${f.terms.course.toLowerCase()}`,
      spec: form("course", "courses", f.terms.course.toLowerCase(), ["Code"], [
        text("code", "Code", "Code", { maxLength: 12, lockedOnEdit: true }),
        text("title", f.terms.course, f.terms.course),
        num("load", f.tertiary ? "Credits" : "Periods per week", f.tertiary ? "Credits" : "Periods per week", { min: 1, max: 40 }),
        select("department", "Department", "Department", departments(f)),
        text("staff", f.tertiary ? "Lecturer" : "Teacher", f.tertiary ? "Lecturer" : "Teacher"),
        status(["Active", "Pending"]),
      ]),
    },
  ],

  "academics/exemptions": (ctx, f) => [
    {
      action: "Grant exemption",
      spec: keepForm("exemption", "exemptions", "exemption", ["Student", f.terms.course], [
        select("student", "Student", "Student", learnerOptions(ctx), { lockedOnEdit: true }),
        select("course", f.terms.course, f.terms.course, courseTitles(f), { lockedOnEdit: true }),
        text("reason", "Reason", "Reason"),
        select("by", "Granted by", "Granted by", ["Registrar", "Head of department", "School Admin"]),
        status(["Approved", "Pending", "Rejected"], "Pending"),
      ]),
    },
  ],

  "academics/assessments-and-assignments": (_c, f) => [
    {
      action: "Create assessment",
      spec: form("assessment", "assessments", "assessment", ["Title"], [
        text("title", "Title", "Title", { lockedOnEdit: true }),
        select("course", f.terms.course, f.terms.course, courseTitles(f)),
        select("type", "Type", "Type", ["Assignment", "Test", "Exam"]),
        date("due", "Due date", "Due"),
        num("weight", "Weight (%)", "Weight", { min: 1, max: 100, suffix: "%" }),
        status(["Draft", "Published"]),
      ]),
    },
  ],

  "examinations/exam-register": (_c, f) => [
    {
      action: "Add session",
      spec: keepForm("exam-session", "exam-sessions", "exam session", ["Date", f.terms.course], [
        date("date", "Date", "Date"),
        select("course", f.terms.course, f.terms.course, courseTitles(f), { lockedOnEdit: true }),
        select("venue", "Venue", "Venue", VENUES),
        num("candidates", "Candidates", "Candidates", { min: 1 }),
        text("invigilator", "Invigilator", "Invigilator"),
        status(["Scheduled", "Pending"]),
      ]),
    },
  ],

  "hostels/hostels-and-rooms": () => [
    {
      action: "Add hostel",
      spec: form("hostel", "hostels", "hostel", ["Hostel"], [
        text("name", "Hostel name", "Hostel", { lockedOnEdit: true }),
        text("block", "Block", "Block", { maxLength: 4 }),
        select("gender", "Gender", "Gender", ["Female", "Male", "Mixed"]),
        num("rooms", "Rooms", "Rooms", { min: 1 }),
        num("capacity", "Capacity (beds)", "Capacity", { min: 1 }),
        status(["Active", "Maintenance"]),
      ], { rowDefaults: { Occupied: "0" } }),
    },
    {
      action: "Add room",
      spec: form("room", "rooms", "room", ["Hostel", "Room"], [
        select("hostel", "Hostel", "Hostel", HOUSES, { lockedOnEdit: true }),
        text("room", "Room", "Room", { lockedOnEdit: true, maxLength: 12, placeholder: "A-103" }),
        num("beds", "Beds", "Beds", { min: 1, max: 12, defaultValue: "4" }),
        status(["Active", "Maintenance"]),
      ]),
    },
  ],

  "hostels/room-allocations": (ctx, f) => [
    {
      action: "Allocate room",
      spec: form("allocation", "allocations", "room allocation", ["Student", f.terms.period], [
        select("student", "Student", "Student", learnerOptions(ctx), { lockedOnEdit: true }),
        select("hostel", "Hostel", "Hostel", HOUSES),
        text("room", "Room", "Room", { maxLength: 8, placeholder: "A-101" }),
        select("period", f.terms.period, f.terms.period, periods(f), { lockedOnEdit: true, defaultValue: periods(f)[periods(f).length - 1] }),
        money("fee", "Fee (kwacha)", "Fee", { min: 0, defaultValue: "3200" }),
        status(["Allocated", "Pending", "Waitlisted"]),
      ]),
    },
  ],

  "tenants-and-schools": () => [
    {
      action: "Add tenant",
      spec: form("tenant", "tenants", "school", ["School"], [
        text("name", "School name", "School"),
        {
          name: "types", label: "Divisions", type: "multiselect", required: true,
          column: "Institution type", joiner: " + ",
          options: INSTITUTION_TYPES.map((t) => INSTITUTIONS[t].label),
          help: "Pick one or more. All divisions of a school must use the same academic system, so Primary and High School can be combined, and College and University can be combined, but not school-level with tertiary. A division of a school that already has learners cannot be removed, only added.",
        },
        select("plan", "Plan", "Plan", ["Starter", "Growth", "Enterprise"], { defaultValue: "Starter" }),
        num("campuses", "Campuses", "Campuses", { min: 1, max: 50, defaultValue: "1" }),
        status(["Active", "Trial", "Suspended"], "Trial"),
      ], { target: "tenant" }),
    },
  ],

  subscriptions: () => [
    {
      spec: form("subscription", "subscriptions", "subscription", ["School"], [
        text("school", "School", "School", { lockedOnEdit: true }),
        select("billing", "Billing", "Billing", ["Monthly", "Termly", "Annually"]),
        date("renewal", "Renewal date", "Renewal date"),
      ], { editOnly: true }),
    },
  ],

  "usage-and-capacity": () => [
    {
      spec: form("capacity", "usage", "capacity", ["School"], [
        text("school", "School", "School", { lockedOnEdit: true }),
        num("limit", "Learner limit", "Learner limit", { min: 100, max: 1000000, help: "The most learners (or students) the school may enrol on its plan." }),
      ], { editOnly: true }),
    },
  ],

  "platform-users": () => [
    {
      action: "Invite platform user",
      spec: form("platform-user", "platform-users", "platform user", ["Name"], [
        text("name", "Full name", "Name", { lockedOnEdit: true }),
        select("role", "Role", "Role", ["Super admin", "Support lead", "Billing", "Onboarding", "Auditor"]),
        { name: "email", label: "Email", type: "email", column: "Email", required: true, maxLength: 120 },
        status(["Active", "Pending", "Suspended"], "Pending"),
      ], { rowDefaults: { "Last active": "Never" } }),
    },
  ],

  "support-queue": (ctx) => [
    {
      action: "New ticket",
      spec: form("ticket", "tickets", "ticket", ["Ticket"], [
        auto("ticket", "Ticket", "Ticket", "#SUP-", 4),
        select("school", "School", "School", ctx.tenants.map((t) => t.name), { lockedOnEdit: true }),
        text("subject", "Subject", "Subject", { maxLength: 100 }),
        select("priority", "Priority", "Priority", ["Low", "Medium", "High"], { defaultValue: "Medium" }),
        status(["Open", "In progress", "Resolved"]),
      ], { rowDefaults: { Opened: "Just now" } }),
    },
  ],

  "platform-settings": () => [
    {
      spec: form("institution-type", "institution-types", "institution type", ["Institution type"], [
        text("type", "Institution type", "Institution type", { lockedOnEdit: true }),
        text("grades", "Grades", "Grades", { maxLength: 20, placeholder: "Grades 1–7", help: "Only school-level types have grades. Use a range like Grades 1–7." }),
      ], { editOnly: true }),
      deriveOnEdit: true,
      derive: (v) => ({ Grades: parseGrades(val(v, "grades")) ?? val(v, "grades") }),
      check: (v) => (parseGrades(val(v, "grades")) ? null : { grades: "Use a range of grades from 1 to 12, like Grades 1–7." }),
      checkEdit: (_v, row) => (row["Grades"] === "—" ? { grades: "This institution type has no grades." } : null),
    },
    {
      spec: form("setting", "settings", "setting", ["Setting"], [
        text("value", "Value", "Value"),
      ], { editOnly: true }),
    },
  ],

  "access-control": (ctx) => [
    {
      spec: form("permission", "permissions", "permissions", ["Module"], [
        text("module", "Module", "Module", { lockedOnEdit: true }),
        ...PERMISSION_ROLES.map((role, i): FieldDef => ({
          name: `r${i}`, label: role, type: "multiselect", column: role, options: RIGHTS, joiner: " ",
          help: i === 0 ? "V view · C create · E edit · D delete · A approve" : undefined,
        })),
      ], { editOnly: true }),
      checkEdit: (v, row) => {
        const errors: Record<string, string> = {};
        PERMISSION_ROLES.forEach((role, i) => {
          const picks = (v[`r${i}`] as string[]) ?? [];
          if (picks.some((p) => p !== "V") && !picks.includes("V")) errors[`r${i}`] = "Needs view to create, edit, delete or approve.";
          // Platform Admin must keep control of these pages, or nobody could manage them.
          else if (i === 0 && ["Access control", "Platform settings"].includes(row["Module"]) && !["V", "C", "E"].every((p) => picks.includes(p))) {
            errors[`r${i}`] = "Platform Admin must keep view, create and edit here.";
          }
        });
        return Object.keys(errors).length ? errors : null;
      },
    },
    ...((ctx.tenant?.divisions.length ?? 0) > 1
      ? [
          {
            spec: form("division-access", "division-access", "division access", ["Staff no."], [
              text("staff", "Staff", "Staff", { lockedOnEdit: true }),
              text("role", "Role", "Role", { lockedOnEdit: true }),
              select("access", "Division access", "Division access", [ALL, ...ctx.tenant!.divisions.map((d) => d.name)]),
            ], { editOnly: true, writeTo: { slug: "users/staff", tableId: "staff" } }),
            checkEdit: (v: FormValues, row: Record<string, string>) => {
              const m = accessRule(row["Role"], val(v, "access"), ctx.tenant!.divisions);
              return m ? { access: m } : null;
            },
          },
        ]
      : []),
    {
      action: "Add role",
      spec: form("role", "roles", "role", ["Role"], [
        text("name", "Role name", "Role", { lockedOnEdit: true }),
        select("level", "Level", "Level", ["Level 1 · Executive", "Level 2 · Management", "Level 3 · Operational", "Learner", "Guardian"]),
        select("scope", "Scope", "Scope", ["All schools", "Whole school", "One division", "Whole school or one division", "Own records", "Linked children"]),
        text("description", "Description", "Description", { maxLength: 140 }),
      ], { rowDefaults: { Users: "0" } }),
    },
  ],
};

/** Page slugs that have forms. */
export const FORM_SLUGS = Object.keys(MAKERS);

/** Entries for a page, built for the division in `ctx` (or the school's first one when none is picked). */
export function entriesFor(slug: string, ctx: PlatformContext): FormEntry[] {
  const maker = MAKERS[slug];
  return maker ? maker(ctx, flavour(ctx)) : [];
}

/**
 * Entries as the screen offers them. With several divisions and none picked,
 * each form asks which division the record is for and carries per-division
 * fields, since classes, courses and numbering differ between divisions.
 */
export function offeredEntries(slug: string, ctx: PlatformContext): FormEntry[] {
  const divisions: Division[] = ctx.tenant?.divisions ?? [];
  if (!isDivisionScoped(slug) || divisions.length < 2 || ctx.division) return entriesFor(slug, ctx);

  const perDivision = divisions.map((d) => ({ d, entries: entriesFor(slug, { ...ctx, division: d }) }));
  const choices = divisions.map((d) => ({ id: d.id, name: d.name }));
  return perDivision[0].entries.map((first, i) => ({
    ...first,
    spec: {
      ...first.spec,
      divisionChoices: choices,
      variants: Object.fromEntries(
        perDivision.map(({ d, entries }) => [d.id, { fields: entries[i].spec.fields, rowDefaults: entries[i].spec.rowDefaults }]),
      ),
    },
  }));
}

/** The entry the server action should use: rebuilt for the division the record is going to. */
export function entryById(slug: string, formId: string, ctx: PlatformContext, divisionId?: string): FormEntry | undefined {
  const division = ctx.tenant?.divisions.find((d) => d.id === divisionId) ?? ctx.division;
  const target = isDivisionScoped(slug) && (ctx.tenant?.divisions.length ?? 0) > 1 ? { ...ctx, division } : ctx;
  return entriesFor(slug, target).find((e) => e.spec.id === formId);
}
