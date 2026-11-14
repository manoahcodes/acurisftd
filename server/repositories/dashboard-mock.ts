import { DEPLOYMENT_MODE, DEPLOYMENTS, isMultiTenant, type DeploymentMode } from "@/config/deployment";
import { INSTITUTIONS, systemLabel, termsFor, type InstitutionType } from "@/config/institution";
import type { RoleKey } from "@/config/navigation";
import { formatKwacha, kwachaToNgwee } from "@/lib/money";
import type { Dashboard, Row, TenantContext } from "@/types/dashboard";
import type { DashboardRepository } from "./types";

// Row builders keep the data below readable.
const r = (...cells: string[]): Row => ({ cells });
const go = (label: string, target: string): Row => ({ cells: [label, target], sep: "arrow" });
const link = (label: string): Row => ({ cells: [label], trailingArrow: true });
const K = (kwacha: number) => formatKwacha(kwachaToNgwee(kwacha));

type Lesson = { time: string; group: string; course: string; room: string; size: number };

/** Sample data that fits one kind of school. Wording (Term/Semester...) comes from termsFor. */
type Profile = {
  /** "learner" for schools, "student" for colleges and universities. */
  one: string;
  many: string;
  /** Short phrase for the teacher KPI note, e.g. "Grades 8–12". */
  span: string;
  lessons: Lesson[];
  submissions: string[][];
  accounts: { no: string; group: string }[];
  kids: { name: string; group: string; time: string }[];
  feeLine: string;
  extraFee: string;
  feeKinds: string;
  snapshot: string[][];
  timetable: string[][];
  assignments: string[][];
  results: string[][];
  studentNotices: string[][];
  parentNotices: string[][];
  attendanceTotal: number;
  periodNo: number;
};

const PROFILES: Record<InstitutionType, Profile> = {
  primary: {
    one: "learner", many: "learners", span: "Grades 1–7", periodNo: 3, attendanceTotal: 168,
    lessons: [
      { time: "08:00–08:45", group: "Grade 3B", course: "Mathematics", room: "Room P-101", size: 38 },
      { time: "09:00–09:45", group: "Grade 5A", course: "Mathematics", room: "Room P-203", size: 34 },
      { time: "10:30–11:15", group: "Grade 6C", course: "Mathematics", room: "Room P-102", size: 36 },
      { time: "11:30–12:15", group: "Grade 1A", course: "Numeracy", room: "Room P-104", size: 40 },
      { time: "13:30–14:15", group: "Grade 7", course: "Mathematics", room: "Room P-201", size: 32 },
    ],
    submissions: [["Chisomo Banda", "Number bonds worksheet", "Submitted 08:32"], ["Mwamba Zulu", "Times tables practice", "Submitted 08:14"], ["Tionenji Phiri", "Week 4 spelling quiz", "Needs marking"]],
    accounts: [{ no: "PRI-1048", group: "Grade 3" }, { no: "PRI-0832", group: "Grade 5" }, { no: "PRI-1201", group: "Grade 7" }],
    kids: [{ name: "Chisomo Banda", group: "Grade 3B", time: "07:52" }, { name: "Natasha Banda", group: "Grade 6A", time: "07:48" }],
    feeLine: "tuition", extraFee: "Feeding programme", feeKinds: "tuition, transport, meals or other fee",
    snapshot: [["Chisomo", "Mathematics  78%", "+4% from last assessment"], ["Chisomo", "English  82%", "On track"], ["Natasha", "Reading", "Teacher feedback available"]],
    timetable: [["08:00", "Mathematics", "Room P-101", "Completed"], ["09:00", "English", "Room P-101", "Completed"], ["10:30", "Science", "Room P-102", "In progress"], ["11:30", "Social Studies", "Room P-101", "Upcoming"], ["13:30", "Creative Arts", "Art room", "Upcoming"]],
    assignments: [["Mathematics", "Number bonds worksheet", "Due 22 Oct"], ["English", "Story writing", "Due 23 Oct"], ["Science", "Label the plant parts", "Due 24 Oct"]],
    results: [["Mathematics", "Times tables test", "78%", "Good progress"], ["English", "Reading comprehension", "82%", "Strong"], ["Science", "Observation task", "Awaiting mark"]],
    studentNotices: [["Grade 7 examination preparation", "Thursday after school"], ["Library books due back", "Friday"], ["Sports day sign-ups are open", "Register by 28 Oct"]],
    parentNotices: [["Parent-teacher meeting", "24 Oct", "RSVP requested"], ["Grade 7 examination timetable published"], ["School closes for holiday", "03 Nov"]],
  },
  high_school: {
    one: "learner", many: "learners", span: "Grades 8–12", periodNo: 3, attendanceTotal: 184,
    lessons: [
      { time: "08:00–09:00", group: "Grade 9A", course: "Mathematics", room: "Room A-101", size: 42 },
      { time: "09:10–10:10", group: "Grade 10B", course: "Mathematics", room: "Room B-203", size: 36 },
      { time: "10:30–11:30", group: "Grade 11A", course: "Mathematics", room: "Room A-102", size: 31 },
      { time: "12:00–13:00", group: "Grade 8C", course: "Mathematics", room: "Room C-104", size: 38 },
      { time: "14:00–15:00", group: "Grade 12", course: "Mathematics", room: "Room B-201", size: 37 },
    ],
    submissions: [["Chisomo Banda", "Algebra worksheet", "Submitted 08:32"], ["Mwamba Zulu", "Quadratic equations", "Submitted 08:14"], ["Tionenji Phiri", "Week 4 quiz", "Needs marking"]],
    accounts: [{ no: "STU-1048", group: "Grade 11" }, { no: "STU-0832", group: "Grade 9" }, { no: "STU-1201", group: "Grade 12" }],
    kids: [{ name: "Chisomo Banda", group: "Grade 10A", time: "08:02" }, { name: "Natasha Banda", group: "Grade 8B", time: "07:48" }],
    feeLine: "tuition", extraFee: "Activities", feeKinds: "tuition, transport, meals or other fee",
    snapshot: [["Chisomo", "Mathematics  78%", "+4% from last assessment"], ["Chisomo", "English  82%", "On track"], ["Natasha", "Reading", "Teacher feedback available"]],
    timetable: [["08:00", "Mathematics", "Room A-101", "Completed"], ["09:10", "English", "Room B-203", "Completed"], ["10:30", "Physics", "Lab 2", "In progress"], ["12:00", "Biology", "Room C-104", "Upcoming"], ["14:00", "ICT", "Computer Lab", "Upcoming"]],
    assignments: [["Mathematics", "Algebra practice", "Due 22 Oct"], ["English", "Essay draft", "Due 23 Oct"], ["Biology", "Label the cell diagram", "Due 24 Oct"]],
    results: [["Mathematics", "Algebra test", "78%", "Good progress"], ["English", "Comprehension", "82%", "Strong"], ["Physics", "Practical report", "Awaiting mark"]],
    studentNotices: [["Grade 10 revision session", "Thursday after school"], ["Library books due back", "Friday"], ["Sports day sign-ups are open", "Register by 28 Oct"]],
    parentNotices: [["Parent-teacher meeting", "24 Oct", "RSVP requested"], ["Grade 10 assessment schedule published"], ["School closes for holiday", "03 Nov"]],
  },
  college: {
    one: "student", many: "students", span: "4 programmes", periodNo: 2, attendanceTotal: 142,
    lessons: [
      { time: "08:00–10:00", group: "Diploma in ICT, Year 1", course: "Database Systems", room: "Lab 3", size: 34 },
      { time: "10:15–12:15", group: "Diploma in ICT, Year 2", course: "Web Development", room: "Lab 1", size: 28 },
      { time: "13:00–15:00", group: "Certificate in Accounting", course: "Financial Accounting", room: "Room B-12", size: 40 },
      { time: "15:15–16:45", group: "Diploma in Business Admin", course: "Business Statistics", room: "Room B-14", size: 40 },
    ],
    submissions: [["Chisomo Banda", "ER diagram assignment", "Submitted 08:32"], ["Mwamba Zulu", "SQL practical", "Submitted 08:14"], ["Tionenji Phiri", "Ledger exercise", "Needs marking"]],
    accounts: [{ no: "COL-1048", group: "Diploma in ICT" }, { no: "COL-0832", group: "Certificate in Accounting" }, { no: "COL-1201", group: "Diploma in Business Admin" }],
    kids: [{ name: "Chisomo Banda", group: "Diploma in ICT, Year 2", time: "08:02" }, { name: "Natasha Banda", group: "Certificate in Accounting", time: "08:15" }],
    feeLine: "tuition", extraFee: "Lab and workshop fee", feeKinds: "tuition, accommodation, registration or other fee",
    snapshot: [["Chisomo", "Database Systems  78%", "+4% from last assessment"], ["Chisomo", "Web Development  82%", "On track"], ["Natasha", "Financial Accounting", "Lecturer feedback available"]],
    timetable: [["08:00", "Database Systems", "Lab 3", "Completed"], ["10:15", "Web Development", "Lab 1", "In progress"], ["13:00", "Communication Skills", "Room B-12", "Upcoming"], ["15:15", "Business Statistics", "Room B-14", "Upcoming"]],
    assignments: [["Database Systems", "ER diagram assignment", "Due 22 Oct"], ["Web Development", "Portfolio page", "Due 23 Oct"], ["Business Statistics", "Probability worksheet", "Due 24 Oct"]],
    results: [["Database Systems", "Mid-semester test", "78%", "Good progress"], ["Web Development", "Practical project", "82%", "Strong"], ["Business Statistics", "Quiz 2", "Awaiting mark"]],
    studentNotices: [["Practical assessments timetable", "Published Thursday"], ["Library books due back", "Friday"], ["Industrial attachment briefing", "Register by 28 Oct"]],
    parentNotices: [["Sponsor and guardian briefing", "24 Oct", "RSVP requested"], ["Mid-semester results published"], ["Semester break begins", "03 Nov"]],
  },
  university: {
    one: "student", many: "students", span: "4 programmes", periodNo: 2, attendanceTotal: 210,
    lessons: [
      { time: "08:00–10:00", group: "BSc Computer Science, Year 2", course: "Algorithms", room: "Lecture Hall 2", size: 120 },
      { time: "10:15–12:15", group: "BEng Civil Engineering, Year 1", course: "Engineering Mathematics", room: "Lecture Hall 4", size: 95 },
      { time: "13:00–14:00", group: "BA Accounting & Finance, Year 3", course: "Quantitative Methods", room: "Room N-210", size: 64 },
      { time: "14:30–16:30", group: "BSc Computer Science, Year 3", course: "Machine Learning", room: "Lab 5", size: 48 },
    ],
    submissions: [["Chisomo Banda", "Algorithms problem set", "Submitted 08:32"], ["Mwamba Zulu", "Calculus assignment", "Submitted 08:14"], ["Tionenji Phiri", "Regression report", "Needs marking"]],
    accounts: [{ no: "UNI-1048", group: "BSc Computer Science" }, { no: "UNI-0832", group: "BEng Civil Engineering" }, { no: "UNI-1201", group: "BA Accounting & Finance" }],
    kids: [{ name: "Chisomo Banda", group: "BSc Computer Science, Year 2", time: "08:02" }, { name: "Natasha Banda", group: "BA Accounting & Finance, Year 1", time: "08:15" }],
    feeLine: "tuition", extraFee: "Accommodation", feeKinds: "tuition, accommodation, registration or other fee",
    snapshot: [["Chisomo", "Algorithms  78%", "+4% from last assessment"], ["Chisomo", "Discrete Mathematics  82%", "On track"], ["Natasha", "Microeconomics", "Lecturer feedback available"]],
    timetable: [["08:00", "Algorithms", "Lecture Hall 2", "Completed"], ["10:15", "Discrete Mathematics", "Lecture Hall 4", "In progress"], ["13:00", "Operating Systems", "Lab 5", "Upcoming"], ["15:00", "Research Methods", "Room N-210", "Upcoming"]],
    assignments: [["Algorithms", "Problem set 4", "Due 22 Oct"], ["Discrete Mathematics", "Proof exercises", "Due 23 Oct"], ["Research Methods", "Proposal draft", "Due 24 Oct"]],
    results: [["Algorithms", "Continuous assessment 1", "78%", "Good progress"], ["Discrete Mathematics", "Test 2", "82%", "Strong"], ["Operating Systems", "Lab report", "Awaiting mark"]],
    studentNotices: [["Examination timetable published", "Check your portal"], ["Library books due back", "Friday"], ["Career fair registration is open", "Register by 28 Oct"]],
    parentNotices: [["Sponsor and guardian briefing", "24 Oct", "RSVP requested"], ["Continuous assessment results published"], ["Semester break begins", "03 Nov"]],
  },
};

function platformOverview(ctx: TenantContext, mode: DeploymentMode): Dashboard {
  const p = PROFILES[ctx.institutionType];
  const terms = termsFor(ctx.institutionType);
  const info = INSTITUTIONS[ctx.institutionType];
  const learners = ctx.learners ?? 1000;
  return {
    title: `${ctx.tenantName} overview`,
    kpis: [
      { title: `Total ${p.many}`, caption: ctx.divisionsLabel ?? info.label, value: learners.toLocaleString("en-US"), note: "+8.4% this " + terms.period.toLowerCase() },
      { title: "Campuses", caption: "Linked to this school", value: String(ctx.campusCount ?? 1), note: ctx.campus },
      isMultiTenant(mode)
        ? { title: "Plan", caption: "Current subscription", value: ctx.plan ?? "Growth", note: ctx.status ?? "Active" }
        : { title: "Last backup", caption: DEPLOYMENTS[mode].label, value: "Today 02:00", note: `Kept by ${DEPLOYMENTS[mode].operator.toLowerCase()}` },
      { title: "Open support", caption: "Awaiting action", value: "3", note: "1 high priority" },
    ],
    sections: [
      {
        title: "Academic set-up",
        subtitle: `${ctx.tenantName}  •  ${systemLabel(ctx.institutionType)}`,
        span: "half",
        rows: [
          r("Institution", ctx.divisionsLabel ?? info.label),
          r("Academic system", systemLabel(ctx.institutionType)),
          r(`Current ${terms.period.toLowerCase()}`, `${terms.period} ${p.periodNo} 2026`),
          r(terms.programmes, p.lessons.map((l) => l.group).slice(0, 2).join(", ")),
        ],
      },
      {
        title: "School alerts",
        subtitle: `Items for ${ctx.tenantName}`,
        span: "half",
        rows: [
          r("Storage approaching limit", ctx.tenantName, "Review"),
          isMultiTenant(mode)
            ? r("Subscription renewal due in 5 days", ctx.plan ?? "Growth")
            : r("Next backup", "Tomorrow 02:00"),
          r("Failed nightly sync", "1 campus", "Investigate"),
        ],
      },
      {
        title: "Recent events",
        subtitle: `Audit trail for ${ctx.tenantName}`,
        span: "full",
        rows: [
          r("08:42", `${terms.educators} imported`, ctx.tenantName, `By ${DEPLOYMENTS[mode].adminLabel}`),
          isMultiTenant(mode)
            ? r("08:20", "Subscription changed", `Plan: ${ctx.plan ?? "Growth"}`)
            : r("02:00", "Backup completed", "Automatic"),
          r("07:55", "Support ticket escalated", "#SUP-1048", "High"),
        ],
      },
    ],
  };
}

const PLATFORM_WIDE: Dashboard = {
  title: "Platform overview",
  kpis: [
    { title: "Active tenants", caption: "Schools using ACURIS", value: "128", note: "+12 this month" },
    { title: "Total learners", caption: "Across all tenants", value: "48,620", note: "+8.4% this term" },
    { title: "Platform health", caption: "Services operational", value: "99.98%", note: "All systems normal" },
    { title: "Open support", caption: "Awaiting action", value: "17", note: "5 high priority" },
  ],
  sections: [
    {
      title: "Tenant activity",
      subtitle: "New schools and recent usage",
      span: "half",
      rows: [
        r("Lusaka Hills Academy", "1,248 learners", "Active"),
        r("Chilenje Secondary", "2,104 learners", "Active"),
        r("Northview Primary", "684 learners", "Trial"),
        r("Mukuba Learning Centre", "950 learners", "Active"),
        r("Kafue Valley College", "1,720 learners", "Active"),
      ],
    },
    {
      title: "Platform alerts",
      subtitle: "Items requiring platform-level attention",
      span: "half",
      rows: [
        r("Storage approaching limit", "Lusaka Hills", "Review"),
        r("Subscription renewal due in 5 days", "Northview"),
        r("Failed nightly sync", "2 tenant(s)", "Investigate"),
        r("New tenant awaiting verification", "1 request"),
      ],
    },
    {
      title: "Recent platform events",
      subtitle: "Audit trail across the platform",
      span: "full",
      rows: [
        r("08:42", "Tenant created", "Kafue Valley College", "By Platform Admin"),
        r("08:20", "Subscription changed", "Chilenje Secondary", "Plan: Growth"),
        r("07:55", "Support ticket escalated", "#SUP-1048", "High"),
      ],
    },
  ],
};

function teacher(ctx: TenantContext): Dashboard {
  const p = PROFILES[ctx.institutionType];
  const t = termsFor(ctx.institutionType);
  const first = p.lessons[0];
  const tertiary = ctx.institutionType === "college" || ctx.institutionType === "university";
  const total = p.lessons.reduce((n, l) => n + l.size, 0);
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  return {
    title: "Good morning, User",
    kpis: [
      { title: `My ${t.programmes.toLowerCase()}`, caption: `Assigned this ${t.period.toLowerCase()}`, value: String(p.lessons.length), note: `Across ${p.span}` },
      { title: cap(p.many), caption: `In your ${t.programmes.toLowerCase()}`, value: String(total), note: "2 groups need review" },
      { title: "Attendance today", caption: "Across my lessons", value: "92%", note: `3 ${p.many} absent` },
      { title: "To mark", caption: "Assessments pending", value: "28", note: "Due by Friday" },
    ],
    sections: [
      {
        title: "Today's teaching schedule",
        subtitle: `Tuesday  •  ${ctx.campus}`,
        span: "half",
        rows: p.lessons.map((l) => r(l.time, l.group, l.course, l.room)),
      },
      {
        title: `${tertiary ? "Lecturer" : "Teacher"} quick actions`,
        span: "half",
        rows: [
          go(tertiary ? "Take attendance register" : "Take class register", first.group),
          go("Create assignment", "Select class"),
          go("Enter assessment marks", "28 pending"),
          go(tertiary ? "View course outline" : "View lesson plan", "Week 4"),
        ],
      },
      {
        title: "Class attendance",
        subtitle: "Today's register status",
        span: "half",
        rows: [
          r(first.group, `${first.size} ${p.many}`, `${first.size - 2} present`, "2 absent"),
          r(p.lessons[1].group, `${p.lessons[1].size} ${p.many}`, "Register complete"),
          r(p.lessons[2].group, `${p.lessons[2].size} ${p.many}`, "Register not started"),
          r(p.lessons[3].group, `${p.lessons[3].size} ${p.many}`, "Register complete"),
        ],
      },
      {
        title: `Recent ${p.one} submissions`,
        subtitle: "Latest work to review",
        span: "half",
        rows: p.submissions.map((s) => r(...s)),
      },
    ],
  };
}

function bursar(ctx: TenantContext): Dashboard {
  const p = PROFILES[ctx.institutionType];
  const t = termsFor(ctx.institutionType);
  const tertiary = p.one === "student";
  const scale = tertiary ? 2 : 1; // tertiary fees run higher
  return {
    title: "Finance & fee collections",
    kpis: [
      { title: "Collected today", caption: "Receipted payments", value: K(18450 * scale), note: "24 transactions" },
      { title: "Outstanding fees", caption: `All active ${p.many}`, value: K(186450 * scale), note: "24 accounts overdue" },
      { title: "Unallocated payments", caption: "Needs matching", value: K(2350), note: "3 payments" },
      { title: "Reconciliation", caption: "Today's status", value: "Pending", note: "Cash-up not submitted" },
    ],
    sections: [
      {
        title: "Collections by payment method",
        subtitle: `Today's receipts  •  ${t.period} ${p.periodNo}`,
        span: "half",
        rows: [
          r("Mobile money", K(8200 * scale), "12 transactions"),
          r("Bank transfer", K(6750 * scale), "7 transactions"),
          r("Cash", K(2500 * scale), "5 transactions"),
          r("Total", K(17450 * scale), "24 transactions"),
        ],
      },
      {
        title: "Finance actions",
        span: "half",
        rows: [
          link("Record a fee payment"),
          link("Review overdue accounts"),
          link("Reconcile daily collections"),
          link("Generate fee statement"),
        ],
      },
      {
        title: "Accounts needing attention",
        subtitle: "Prioritised follow-up",
        span: "full",
        rows: [
          r(p.accounts[0].no, p.accounts[0].group, `${K(4200 * scale)} overdue`, tertiary ? "Contact sponsor" : "Contact guardian"),
          r(p.accounts[1].no, p.accounts[1].group, `${K(2850 * scale)} overdue`, "Payment plan"),
          r(p.accounts[2].no, p.accounts[2].group, `${K(1600 * scale)} unallocated`, "Match receipt"),
        ],
      },
    ],
  };
}

function cashier(ctx: TenantContext): Dashboard {
  const p = PROFILES[ctx.institutionType];
  const scale = p.one === "student" ? 2 : 1;
  return {
    title: "Payments desk",
    kpis: [
      { title: "Transactions today", caption: "Payments recorded", value: "24", note: "Across all methods" },
      { title: "Amount collected", caption: "Today's total", value: K(18450 * scale), note: "Receipts issued" },
      { title: "Pending receipts", caption: "Awaiting completion", value: "2", note: "Check payment status" },
      { title: "Cash drawer", caption: "Expected balance", value: K(2500 * scale), note: "Cash payments only" },
    ],
    sections: [
      {
        title: "Collect a payment",
        subtitle: `Find ${p.one} by student number or name`,
        span: "half",
        rows: [
          r(`Student: search to select ${p.one}`),
          r(`Account: ${p.feeKinds}`),
          r("Payment method: cash, mobile money, bank"),
          r("Amount received: enter amount and confirm"),
          go("Action: Review payment", "Issue receipt"),
        ],
      },
      {
        title: "Recent transactions",
        span: "half",
        rows: [
          r("RC-02641", p.accounts[0].no, K(850 * scale), "Mobile money", "Success"),
          r("RC-02640", p.accounts[1].no, K(500 * scale), "Cash", "Success"),
          r("RC-02639", p.accounts[2].no, K(1200 * scale), "Bank", "Success"),
          r("RC-02638", p.accounts[0].no, K(300 * scale), "Cash", "Pending"),
        ],
      },
      {
        title: "End-of-day cash-up",
        subtitle: "Verify totals before submitting",
        span: "full",
        rows: [
          r(`Cash received  ${K(2500 * scale)}`, `Expected cash  ${K(2500 * scale)}`, `Variance  ${K(0)}`),
          r(`Mobile money  ${K(8200 * scale)}`, `Bank transfer  ${K(6750 * scale)}`),
          r("Last cash-up: Monday, 20 Oct 2026", "Submitted by cashier"),
        ],
      },
    ],
  };
}

function parent(ctx: TenantContext): Dashboard {
  const p = PROFILES[ctx.institutionType];
  const t = termsFor(ctx.institutionType);
  const tertiary = p.one === "student";
  const [a, b] = p.kids;
  return {
    title: "Welcome back, Mrs. Banda",
    kpis: [
      { title: tertiary ? "Students linked" : "Children enrolled", caption: "Linked to your account", value: "2", note: `Both attending this ${t.period.toLowerCase()}` },
      { title: "Attendance", caption: `This ${t.period.toLowerCase()}`, value: "96%", note: "1 late arrival this week" },
      { title: "Fees outstanding", caption: "Across family accounts", value: K(1250 * (tertiary ? 4 : 1)), note: "Due 31 October" },
      { title: "Unread messages", caption: ctx.tenantName, value: "3", note: "1 requires a response" },
    ],
    sections: [
      {
        title: tertiary ? "My students" : "My children",
        subtitle: `Quick view of ${p.one} wellbeing`,
        span: "half",
        rows: [
          r(a.name, a.group, "Present today", a.time),
          r(b.name, b.group, "Present today", b.time),
          link("View attendance history"),
          link("View academic progress"),
        ],
      },
      {
        title: "Fee account",
        subtitle: "Family balance summary",
        span: "half",
        rows: [
          r(a.name.split(" ")[0], `${t.period} ${p.periodNo} ${p.feeLine}`, `${K(850 * (tertiary ? 4 : 1))} outstanding`),
          r(b.name.split(" ")[0], p.extraFee, `${K(400 * (tertiary ? 4 : 1))} outstanding`),
          r("Total balance", K(1250 * (tertiary ? 4 : 1)), "Due 31 Oct"),
          link("View statement / make payment"),
        ],
      },
      {
        title: tertiary ? "Campus updates" : "School updates",
        subtitle: `Notices from ${ctx.tenantName}`,
        span: "half",
        rows: p.parentNotices.map((n) => r(...n)),
      },
      {
        title: "Academic snapshot",
        subtitle: "Latest results available",
        span: "half",
        rows: p.snapshot.map((s) => r(...s)),
      },
    ],
  };
}

function student(ctx: TenantContext): Dashboard {
  const p = PROFILES[ctx.institutionType];
  const t = termsFor(ctx.institutionType);
  const per = t.period.toLowerCase();
  return {
    title: "Your learning space",
    kpis: [
      { title: "Attendance", caption: `This ${per}`, value: "97%", note: "You are on track" },
      { title: "Assignments due", caption: `Across your ${t.courses.toLowerCase()}`, value: "3", note: "Next due tomorrow" },
      { title: "Average score", caption: `Current ${per}`, value: "81%", note: `Up 3% this ${per}` },
      { title: "Unread notices", caption: ctx.tenantName, value: "2", note: "Check announcements" },
    ],
    sections: [
      {
        title: "Today's timetable",
        subtitle: `Tuesday  •  ${t.period} ${p.periodNo}, Week 4`,
        span: "half",
        rows: p.timetable.map((x) => r(...x)),
      },
      {
        title: "Assignments to complete",
        subtitle: "Plan your work",
        span: "half",
        rows: [...p.assignments.map((x) => r(...x)), link("Open assignments")],
      },
      {
        title: "Recent results",
        subtitle: "Your latest academic feedback",
        span: "half",
        rows: p.results.map((x) => r(...x)),
      },
      {
        title: p.one === "student" ? "Campus notices" : "School notices",
        subtitle: "Important information",
        span: "half",
        rows: p.studentNotices.map((x) => r(...x)),
      },
    ],
  };
}

/** Build one role's dashboard for a school. `undefined` is the platform-wide view. */
export function buildDashboard(
  role: RoleKey,
  ctx?: TenantContext,
  mode: DeploymentMode = DEPLOYMENT_MODE,
): Dashboard {
  if (role === "platform") {
    // Single-school deployments never show the platform-wide view.
    if (!ctx && !isMultiTenant(mode)) throw new Error("A single-school deployment needs its school.");
    return ctx ? platformOverview(ctx, mode) : PLATFORM_WIDE;
  }
  if (!ctx) throw new Error(`The ${role} dashboard needs a school.`);
  switch (role) {
    case "teacher": return teacher(ctx);
    case "bursar": return bursar(ctx);
    case "cashier": return cashier(ctx);
    case "parent": return parent(ctx);
    case "student": return student(ctx);
  }
}

export const mockDashboardRepository: DashboardRepository = {
  async getDashboard(role, ctx) {
    return buildDashboard(role, ctx);
  },
};
