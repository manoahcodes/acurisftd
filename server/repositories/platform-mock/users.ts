import { scopeLabel } from "@/lib/division-scope";
import { LEARNERS, flavour, groupNames, tableOf, type Builder } from "./shared";
import { staffFor } from "./staff";

const students: Builder = (ctx) => {
  const f = flavour(ctx);
  const groups = groupNames(f.tertiary, f.primary);
  return {
    description: `Enrolled ${f.tertiary ? "students" : "learners"} at ${f.tenantName}.`,
    actions: ["Add student", "Import CSV"],
    tables: [
      tableOf("students",
        "Students",
        ["Student no.", "Name", f.tertiary ? "Programme" : "Class", "Campus", "Status"],
        LEARNERS.map((l, i) => [
          l.no,
          l.name,
          groups[i],
          i % 3 === 2 ? "North Campus" : "Main Campus",
          i === 6 ? "Suspended" : "Active",
        ]),
        { statusColumn: "Status" },
      ),
    ],
  };
};

const staff: Builder = (ctx) => {
  const multi = (ctx.tenant?.divisions.length ?? 0) > 1;
  const divisions = ctx.tenant?.divisions ?? [];
  return {
    description: multi
      ? "Staff by role and level. A role is either whole-school or limited to one division, and that scope decides which divisions' records the person can see."
      : "Staff by role and level. A staff member's level decides which modules they can use.",
    actions: ["Add staff member"],
    tables: [
      tableOf("staff",
        "Staff",
        ["Name", "Staff no.", "Role", "Level", "Department", ...(multi ? ["Division access"] : []), "Status"],
        staffFor(ctx).map((m) => [
          m.name,
          m.no,
          m.role,
          m.level,
          m.department,
          ...(multi ? [scopeLabel(m.scope, divisions)] : []),
          m.status,
        ]),
        { statusColumn: "Status" },
      ),
    ],
  };
};

const educators: Builder = (ctx) => {
  const f = flavour(ctx);
  const title = f.terms.educators;
  return {
    description: `${title} and the ${f.terms.courses.toLowerCase()} they teach.`,
    actions: [`Add ${title.toLowerCase().replace(/s$/, "")}`],
    tables: [
      tableOf("educators",
        title,
        ["Name", "Staff no.", "Department", f.terms.courses, "Weekly hours", "Status"],
        f.tertiary
          ? [
              ["Dr. Moses Kunda", "STF-0102", "Computer Science", "CSC101, CSC204", "14", "Active"],
              ["Mrs. Lucy Lungu", "STF-0108", "Accounting & Finance", "ACC201", "10", "Active"],
              ["Eng. Sam Zimba", "STF-0113", "Civil Engineering", "CIV210, CIV305", "16", "Active"],
              ["Sr. Mary Mwansa", "STF-0121", "Nursing", "NUR120", "12", "On leave"],
            ]
          : f.primary
            ? [
                ["Mrs. Mercy Mumba", "STF-0102", "Languages", "ENG (Grades 1A, 2A, 3B)", "24", "Active"],
                ["Mr. Joseph Zulu", "STF-0108", "Mathematics & Science", "MAT, SCI (Grades 3B, 4A)", "22", "Active"],
                ["Mrs. Lucy Lungu", "STF-0113", "Social & Creative Studies", "SST, CTS (Grades 5B, 6C)", "20", "Active"],
                ["Mr. Paul Tembo", "STF-0121", "Mathematics & Science", "MAT, SCI (Grade 7)", "22", "On leave"],
              ]
            : [
              ["Mr. Isaac Chanda", "STF-0102", "Mathematics", "MAT10 (9A, 10B, 11A)", "22", "Active"],
              ["Mrs. Joyce Sakala", "STF-0108", "English", "ENG10 (9A, 10B)", "20", "Active"],
              ["Mr. Paul Daka", "STF-0113", "Sciences", "PHY10, BIO10", "24", "Active"],
              ["Mrs. Agnes Phiri", "STF-0121", "Humanities", "Geography (8C)", "18", "On leave"],
            ],
        { statusColumn: "Status" },
      ),
    ],
  };
};

export const userScreens: Record<string, Builder> = {
  "users/students": students,
  "users/staff": staff,
  "users/educators": educators,
};
