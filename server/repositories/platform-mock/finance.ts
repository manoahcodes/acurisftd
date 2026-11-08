import { K, LEARNERS, flavour, tableOf, type Builder } from "./shared";

const bursary: Builder = (ctx) => {
  const f = flavour(ctx);
  return {
    description: `Bursaries and scholarships awarded at ${f.tenantName}.`,
    actions: ["New bursary"],
    kpis: [
      { title: "Active bursaries", caption: "This year", value: "4" },
      { title: "Beneficiaries", caption: "Learners funded", value: "186" },
      { title: "Total awarded", caption: "This year", value: K(742000) },
    ],
    tables: [
      tableOf("bursaries",
        "Bursary management",
        ["Bursary", "Sponsor", "Beneficiaries", "Value each", "Total awarded", "Status"],
        [
          ["Merit scholarship", "School", "40", K(5000), K(200000), "Active"],
          ["Needs-based bursary", "Government", "96", K(3500), K(336000), "Active"],
          ["Alumni fund", "Alumni association", "30", K(3000), K(90000), "Active"],
          ["Corporate sponsorship", "Zamtel Foundation", "20", K(5800), K(116000), "Pending"],
        ],
        { statusColumn: "Status" },
      ),
    ],
  };
};

const tuition: Builder = (ctx) => {
  const f = flavour(ctx);
  const rows = f.tertiary
    ? [
        ["BSc Computer Science", K(14500), K(29000), "Jan 2026", "Active"],
        ["BA Accounting & Finance", K(12800), K(25600), "Jan 2026", "Active"],
        ["BEng Civil Engineering", K(15200), K(30400), "Jan 2026", "Active"],
        ["BSc Nursing", K(13900), K(27800), "Jan 2026", "Active"],
      ]
    : f.primary
      ? [
          ["Grades 1–2", K(900), K(2700), "Jan 2026", "Active"],
          ["Grades 3–4", K(1100), K(3300), "Jan 2026", "Active"],
          ["Grades 5–6", K(1400), K(4200), "Jan 2026", "Active"],
          ["Grade 7 (exam class)", K(1700), K(5100), "Jan 2026", "Pending"],
        ]
      : [
          ["Grade 8–9", K(2100), K(6300), "Jan 2026", "Active"],
          ["Grade 10–11", K(2600), K(7800), "Jan 2026", "Active"],
          ["Grade 12", K(3000), K(9000), "Jan 2026", "Active"],
        ];
  return {
    description: `Tuition is billed per ${f.terms.period.toLowerCase()}.`,
    actions: ["Add fee structure"],
    tables: [
      tableOf("tuition",
        "Tuition fees",
        [f.tertiary ? "Programme" : "Class", `Fee per ${f.terms.period.toLowerCase()}`, "Per year", "Effective", "Status"],
        rows,
        { statusColumn: "Status" },
      ),
    ],
  };
};

const otherFees: Builder = (ctx) => {
  const f = flavour(ctx);
  return {
    description: "Fees charged on top of tuition.",
    actions: ["Add fee"],
    tables: [
      tableOf("other-fees",
        "Other fees",
        ["Fee", "Applies to", "Amount", "Frequency", "Status"],
        [
          ["Registration", "All learners", K(350), `Per ${f.terms.period.toLowerCase()}`, "Active"],
          ["Examination", "All learners", K(450), `Per ${f.terms.period.toLowerCase()}`, "Active"],
          ["Library & ICT levy", "All learners", K(200), "Per year", "Active"],
          ["Hostel", "Boarders", K(3200), `Per ${f.terms.period.toLowerCase()}`, "Active"],
          ["Transport", "Optional", K(900), `Per ${f.terms.period.toLowerCase()}`, "Pending"],
        ],
        { statusColumn: "Status" },
      ),
    ],
  };
};

const payments: Builder = (ctx) => {
  const f = flavour(ctx);
  const methods = ["Mobile money", "Cash", "Bank", "Cash", "Mobile money", "Bank", "Cash", "Mobile money"];
  const amounts = [850, 500, 1200, 300, 2100, 3400, 650, 1500];
  const status = ["Success", "Success", "Success", "Pending", "Success", "Success", "Success", "Failed"];
  return {
    description: `Payments received from ${f.tenantName} learners.`,
    actions: ["Record payment"],
    kpis: [
      { title: "Collected today", caption: "Receipted payments", value: K(18450), note: "24 transactions" },
      { title: "Unallocated", caption: "Needs matching", value: K(2350), note: "3 payments" },
    ],
    tables: [
      tableOf("payments",
        "Student payments",
        ["Receipt", "Student", "Method", "Amount", "Date", "Status"],
        LEARNERS.map((l, i) => [
          `RC-0${2641 - i}`,
          `${l.no} · ${l.name}`,
          methods[i],
          K(amounts[i]),
          `0${(i % 5) + 1} Nov 2026`,
          status[i],
        ]),
        { statusColumn: "Status" },
      ),
    ],
  };
};

export const financeScreens: Record<string, Builder> = {
  "finances/bursary-management": bursary,
  "finances/tuition-fees": tuition,
  "finances/other-fees": otherFees,
  "finances/student-payments": payments,
};
