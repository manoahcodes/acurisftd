import { GENERIC_TERMS, divisionsLabel, resolveLabel, termsFor } from "@/config/institution";
import { ROLES, hrefFor, type RoleKey } from "@/config/navigation";
import type { AcademicYear, SearchResult } from "@/types/directory";
import type {
  AcademicYearRepository,
  SearchRepository,
} from "./directory-types";
import { mockTenantDirectory } from "./tenants-mock";

const YEARS: AcademicYear[] = [
  { id: "2026", label: "Academic Year 2026", isCurrent: true },
  { id: "2025", label: "Academic Year 2025", isCurrent: false },
  { id: "2024", label: "Academic Year 2024", isCurrent: false },
];

export const mockAcademicYearRepository: AcademicYearRepository = {
  async list() {
    return YEARS;
  },
};

type Entry = {
  id: string;
  title: string;
  subtitle: string;
  kind: string;
  /** Label of the nav item this result opens (detail pages don't exist yet). */
  navLabel: string;
  /** Extra words that should find this entry (for example Term and Semester wording). */
  keywords?: string;
};

const DATA: Record<RoleKey, Entry[]> = {
  platform: [
    // Tenants, subscriptions and pages are added from live data in entriesFor().
    { id: "ticket-sup-1048", title: "Support ticket #SUP-1048", subtitle: "Escalated · High", kind: "Ticket", navLabel: "Support queue" },
  ],
  teacher: [
    { id: "class-9a", title: "Grade 9A", subtitle: "42 learners · Mathematics · Room A-101", kind: "Class", navLabel: "My classes" },
    { id: "class-10b", title: "Grade 10B", subtitle: "36 learners · Mathematics · Room B-203", kind: "Class", navLabel: "My classes" },
    { id: "class-11a", title: "Grade 11A", subtitle: "31 learners · Mathematics · Room A-102", kind: "Class", navLabel: "My classes" },
    { id: "class-8c", title: "Grade 8C", subtitle: "38 learners · Mathematics · Room C-104", kind: "Class", navLabel: "My classes" },
    { id: "class-12", title: "Grade 12", subtitle: "Mathematics · Room B-201", kind: "Class", navLabel: "My classes" },
    { id: "learner-chisomo", title: "Chisomo Banda", subtitle: "Learner · Mathematics", kind: "Learner", navLabel: "My classes" },
    { id: "learner-mwamba", title: "Mwamba Zulu", subtitle: "Learner · Mathematics", kind: "Learner", navLabel: "My classes" },
    { id: "learner-tionenji", title: "Tionenji Phiri", subtitle: "Learner · Mathematics", kind: "Learner", navLabel: "My classes" },
    { id: "assign-algebra", title: "Algebra worksheet", subtitle: "Submitted 08:32 by Chisomo Banda", kind: "Assignment", navLabel: "Assignments" },
    { id: "assign-quadratic", title: "Quadratic equations", subtitle: "Submitted 08:14 by Mwamba Zulu", kind: "Assignment", navLabel: "Assignments" },
    { id: "assess-week4", title: "Week 4 quiz", subtitle: "Needs marking", kind: "Assessment", navLabel: "Assessments" },
  ],
  bursar: [
    { id: "acct-stu-1048", title: "STU-1048", subtitle: "Grade 11 · K 4,200 overdue", kind: "Account", navLabel: "Student accounts" },
    { id: "acct-stu-0832", title: "STU-0832", subtitle: "Grade 9 · K 2,850 overdue", kind: "Account", navLabel: "Student accounts" },
    { id: "acct-stu-1201", title: "STU-1201", subtitle: "Grade 12 · K 1,600 unallocated", kind: "Account", navLabel: "Student accounts" },
    { id: "rc-02641", title: "RC-02641", subtitle: "STU-1048 · K 850 · Mobile money", kind: "Receipt", navLabel: "Student accounts" },
    { id: "rc-02640", title: "RC-02640", subtitle: "STU-0832 · K 500 · Cash", kind: "Receipt", navLabel: "Student accounts" },
    { id: "rc-02639", title: "RC-02639", subtitle: "STU-1201 · K 1,200 · Bank", kind: "Receipt", navLabel: "Student accounts" },
  ],
  cashier: [
    { id: "learner-stu-1048", title: "STU-1048", subtitle: "Grade 11 · Collect payment", kind: "Learner", navLabel: "Collect payment" },
    { id: "learner-stu-0832", title: "STU-0832", subtitle: "Grade 9 · Collect payment", kind: "Learner", navLabel: "Collect payment" },
    { id: "learner-stu-1201", title: "STU-1201", subtitle: "Grade 12 · Collect payment", kind: "Learner", navLabel: "Collect payment" },
    { id: "learner-stu-1140", title: "STU-1140", subtitle: "Collect payment", kind: "Learner", navLabel: "Collect payment" },
    { id: "rc-02641", title: "RC-02641", subtitle: "STU-1048 · K 850 · Mobile money · Success", kind: "Receipt", navLabel: "Print receipt" },
    { id: "rc-02640", title: "RC-02640", subtitle: "STU-0832 · K 500 · Cash · Success", kind: "Receipt", navLabel: "Print receipt" },
    { id: "rc-02639", title: "RC-02639", subtitle: "STU-1201 · K 1,200 · Bank · Success", kind: "Receipt", navLabel: "Print receipt" },
    { id: "rc-02638", title: "RC-02638", subtitle: "STU-1140 · K 300 · Cash · Pending", kind: "Receipt", navLabel: "Print receipt" },
  ],
  // Parent results are limited to the signed-in parent's own children.
  parent: [
    { id: "child-chisomo", title: "Chisomo Banda", subtitle: "Grade 10A · Present today", kind: "Child", navLabel: "My children" },
    { id: "child-natasha", title: "Natasha Banda", subtitle: "Grade 5B · Present today", kind: "Child", navLabel: "My children" },
    { id: "stmt-chisomo", title: "Term 3 tuition (Chisomo)", subtitle: "K 850 outstanding", kind: "Statement", navLabel: "Fee statements" },
    { id: "stmt-natasha", title: "Activities (Natasha)", subtitle: "K 400 outstanding", kind: "Statement", navLabel: "Fee statements" },
    { id: "notice-ptm", title: "Parent-teacher meeting", subtitle: "24 Oct · RSVP requested", kind: "Notice", navLabel: "School calendar" },
    { id: "notice-holiday", title: "School closes for holiday", subtitle: "03 Nov", kind: "Notice", navLabel: "School calendar" },
  ],
  student: [
    { id: "assign-algebra", title: "Algebra practice", subtitle: "Mathematics · Due 22 Oct", kind: "Assignment", navLabel: "Assignments" },
    { id: "assign-essay", title: "Essay draft", subtitle: "English · Due 23 Oct", kind: "Assignment", navLabel: "Assignments" },
    { id: "assign-cell", title: "Label the cell diagram", subtitle: "Biology · Due 24 Oct", kind: "Assignment", navLabel: "Assignments" },
    { id: "result-algebra", title: "Algebra test", subtitle: "Mathematics · 78%", kind: "Result", navLabel: "Results & grades" },
    { id: "result-comprehension", title: "Comprehension", subtitle: "English · 82%", kind: "Result", navLabel: "Results & grades" },
    { id: "result-practical", title: "Practical report", subtitle: "Physics · Awaiting mark", kind: "Result", navLabel: "Results & grades" },
    { id: "notice-revision", title: "Grade 10 revision session", subtitle: "Thursday after school", kind: "Notice", navLabel: "School notices" },
    { id: "notice-library", title: "Library books due back", subtitle: "Friday", kind: "Notice", navLabel: "School notices" },
    { id: "notice-sports", title: "Sports day sign-ups are open", subtitle: "Register by 28 Oct", kind: "Notice", navLabel: "School notices" },
  ],
};

/**
 * Platform Admin search covers the schools on the platform (so new tenants are
 * found) and every page of the admin (so "tuition" or "hostel" jumps there).
 * Pages are found by their Term and Semester wording alike.
 */
async function platformEntries(): Promise<Entry[]> {
  const tenants = await mockTenantDirectory.list();
  const schoolTerms = termsFor("high_school");
  const tertiaryTerms = termsFor("university");

  const tenantEntries = tenants.flatMap((t): Entry[] => [
    {
      id: `tenant-${t.id}`,
      title: t.name,
      subtitle: `${divisionsLabel(t.divisions)} · ${t.learners.toLocaleString("en-US")} learners · ${t.status}`,
      kind: "Tenant",
      navLabel: "Tenants & schools",
    },
    {
      id: `sub-${t.id}`,
      title: `${t.name} subscription`,
      subtitle: `Plan: ${t.plan}`,
      kind: "Subscription",
      navLabel: "Subscriptions",
    },
  ]);

  const config = ROLES.platform;
  const groupOf = new Map<string, string>();
  for (const group of config.navGroups ?? []) {
    for (const label of group.items) groupOf.set(label, group.label);
  }

  const pageEntries = config.nav
    .filter((item) => item.slug)
    .map(
      (item): Entry => ({
        id: `page-${item.slug}`,
        title: resolveLabel(item.label, GENERIC_TERMS),
        subtitle: groupOf.get(item.label) ?? "Platform",
        kind: "Page",
        navLabel: item.label,
        keywords: `${resolveLabel(item.label, schoolTerms)} ${resolveLabel(item.label, tertiaryTerms)}`,
      }),
    );

  return [...tenantEntries, ...pageEntries];
}

function hrefForNavLabel(role: RoleKey, navLabel: string): string {
  const item = ROLES[role].nav.find((n) => n.label === navLabel);
  if (!item) {
    throw new Error(`Search mock for "${role}" references unknown nav item "${navLabel}"`);
  }
  return hrefFor(role, item.slug);
}

const MAX_RESULTS = 8;

export const mockSearchRepository: SearchRepository = {
  // The mock ignores ctx.tenantId because all mock data belongs to one school.
  async search(_ctx, role, query) {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const scored: { entry: Entry; score: number }[] = [];
    const entries = role === "platform" ? [...(await platformEntries()), ...DATA.platform] : DATA[role];
    for (const entry of entries) {
      const title = entry.title.toLowerCase();
      const keywords = (entry.keywords ?? "").toLowerCase();
      let score: number | null = null;
      if (title.startsWith(q)) score = 0;
      else if (title.includes(q) || keywords.includes(q)) score = 1;
      else if (
        entry.subtitle.toLowerCase().includes(q) ||
        entry.kind.toLowerCase().includes(q)
      ) {
        score = 2;
      }
      if (score !== null) scored.push({ entry, score });
    }

    scored.sort(
      (a, b) => a.score - b.score || a.entry.title.localeCompare(b.entry.title),
    );

    return scored.slice(0, MAX_RESULTS).map(
      ({ entry }): SearchResult => ({
        id: entry.id,
        title: entry.title,
        subtitle: entry.subtitle,
        kind: entry.kind,
        href: hrefForNavLabel(role, entry.navLabel),
      }),
    );
  },
};