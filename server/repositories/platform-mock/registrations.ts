import { COURSE_ROWS, LEARNERS, flavour, groupNames, table, tableOf, type Builder } from "./shared";

const periodRegistration: Builder = (ctx) => {
  const f = flavour(ctx);
  const groups = groupNames(f.tertiary, f.primary);
  const status = ["Registered", "Registered", "Pending", "Registered", "Blocked", "Registered", "Pending", "Registered"];
  return {
    description: `${f.terms.period} registration for 2026. Learners with unpaid fees are blocked.`,
    actions: [`Open ${f.terms.period.toLowerCase()} registration`],
    kpis: [
      { title: "Registered", caption: f.periodName(f.tertiary ? 2 : 3), value: "1,102", note: "88% of learners" },
      { title: "Pending", caption: "Awaiting fees or approval", value: "98" },
      { title: "Blocked", caption: "Outstanding balance", value: "48" },
    ],
    tables: [
      table(
        `${f.terms.period} registration`,
        ["Student", f.tertiary ? "Programme" : "Class", f.terms.period, "Fees cleared", "Status"],
        LEARNERS.map((l, i) => [
          `${l.no} · ${l.name}`,
          groups[i],
          f.periodName(f.tertiary ? 2 : 3),
          status[i] === "Blocked" ? "No" : "Yes",
          status[i],
        ]),
        { statusColumn: "Status" },
      ),
      tableOf("registration-windows",
        "Registration windows",
        ["Period", "Opens", "Closes", "Status"],
        [[f.periodName(1), "12 Jan 2026", "30 Jan 2026", "Closed"]],
        { statusColumn: "Status", note: `Open a window with the Open ${f.terms.period.toLowerCase()} registration button. Learners with unpaid fees stay blocked.` },
      ),
    ],
  };
};

const courseRegistration: Builder = (ctx) => {
  const f = flavour(ctx);
  const courses = COURSE_ROWS(f.tertiary, f.primary);
  return {
    description: `${f.terms.course} registration per learner for the current ${f.terms.period.toLowerCase()}.`,
    actions: [`Register ${f.terms.course.toLowerCase()}`],
    tables: [
      tableOf("course-registration",
        `${f.terms.course} registration`,
        ["Student", "Code", f.terms.course, f.terms.period, "Status"],
        LEARNERS.slice(0, 6).map((l, i) => [
          `${l.no} · ${l.name}`,
          courses[i % courses.length][0],
          courses[i % courses.length][1],
          f.periodName(f.tertiary ? 2 : 3),
          i === 4 ? "Pending" : "Registered",
        ]),
        { statusColumn: "Status" },
      ),
    ],
  };
};

const examRegistration: Builder = (ctx) => {
  const f = flavour(ctx);
  const courses = COURSE_ROWS(f.tertiary, f.primary);
  return {
    description: "Learners entered for the end-of-period examinations.",
    actions: ["Register for exams"],
    tables: [
      tableOf("exam-registration",
        "Exam registration",
        ["Student", f.terms.course, "Exam session", "Exam fee paid", "Status"],
        LEARNERS.slice(0, 6).map((l, i) => [
          `${l.no} · ${l.name}`,
          courses[i % courses.length][1],
          `${f.terms.period} ${f.tertiary ? 2 : 3} exams`,
          i === 4 ? "No" : "Yes",
          i === 4 ? "Pending" : "Registered",
        ]),
        { statusColumn: "Status" },
      ),
    ],
  };
};

const examReceipts: Builder = () => ({
  description: "Receipts for examination fees.",
  actions: ["Issue receipt"],
  tables: [
    tableOf("exam-receipts",
      "Exam receipts",
      ["Receipt", "Student", "Exam fee", "Date", "Status"],
      LEARNERS.slice(0, 6).map((l, i) => [
        `EX-0${1840 + i}`,
        `${l.no} · ${l.name}`,
        "K 450",
        `0${(i % 5) + 1} Nov 2026`,
        i === 4 ? "Pending" : "Issued",
      ]),
      { statusColumn: "Status", printAs: "Receipt" },
    ),
  ],
});

const examDocket: Builder = (ctx) => {
  const f = flavour(ctx);
  return {
    description: "Exam dockets are issued once registration and exam fees are cleared.",
    actions: ["Generate dockets"],
    tables: [
      tableOf("exam-dockets",
        "Exam docket",
        ["Docket", "Student", `${f.terms.courses} on docket`, "Venue", "Status"],
        LEARNERS.slice(0, 6).map((l, i) => [
          `DK-0${3100 + i}`,
          `${l.no} · ${l.name}`,
          i === 4 ? "—" : "5",
          i % 2 === 0 ? "Main Hall" : "Block B Hall",
          i === 4 ? "Blocked" : "Issued",
        ]),
        { statusColumn: "Status", printAs: "Exam docket", note: "Blocked dockets have an outstanding balance or missing exam registration." },
      ),
    ],
  };
};

export const registrationScreens: Record<string, Builder> = {
  "registrations/period-registration": periodRegistration,
  "registrations/course-registration": courseRegistration,
  "registrations/exam-registration": examRegistration,
  "registrations/exam-receipts": examReceipts,
  "registrations/exam-docket": examDocket,
};
