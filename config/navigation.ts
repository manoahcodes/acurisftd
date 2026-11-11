import { DEPLOYMENT_MODE, DEPLOYMENTS, isMultiTenant, type DeploymentMode } from "./deployment";

export const ROLE_KEYS = [
  "platform",
  "teacher",
  "bursar",
  "cashier",
  "parent",
  "student",
] as const;

export type RoleKey = (typeof ROLE_KEYS)[number];

/**
 * Where a page's data comes from for the Platform Admin.
 * "platform": always cross-tenant. "tenant": needs a selected school.
 * "either": aggregates across schools until one is selected.
 */
export type NavScope = "platform" | "tenant" | "either";

/**
 * Labels may contain {period}, {course}, {courses}, {programmes} or {educators}.
 * They are resolved per school (see config/institution.ts), but the raw label
 * is the stable key used for badges, search and links.
 */
export type NavItem = { label: string; slug: string; scope?: NavScope };

/** Sidebar group. `items` are labels of entries in the role's `nav`. */
export type NavGroup = { label: string; items: string[] };

/** What the top bar shows next to the search box. */
export type TopbarContext =
  | { kind: "academicYear" } // dropdown: "Academic Year 2026"
  | { kind: "scope"; label: string } // static chip, e.g. "All tenants"
  | { kind: "none" }; // nothing shown

/** Config form: points at an existing nav item by its label. */
export type QuickAction = { label: string; navLabel: string };

/** Resolved form: safe to pass to components. */
export type ResolvedQuickAction = { label: string; href: string };

export type TopbarConfig = {
  searchPlaceholder: string;
  context: TopbarContext;
  /** One-click shortcut to the role's most common task. Omit for none. */
  quickAction?: QuickAction;
  /** Shows the child switcher (parents only). */
  childSwitcher?: boolean;
};

/** Config form: links point at an existing nav item by its label. */
export type UserMenuEntry =
  | { kind: "link"; label: string; navLabel: string }
  | { kind: "signout" };

/** Resolved form: safe to pass to a client component. */
export type ResolvedUserMenuEntry =
  | { kind: "link"; label: string; href: string }
  | { kind: "signout" };

export type RoleConfig = {
  /** Shown in the sidebar subtitle, breadcrumb and user menu */
  label: string;
  /** Every page of the role, flat. The first item is the overview. */
  nav: NavItem[];
  /**
   * Optional grouping for the sidebar. When set, the overview (nav[0]) is shown
   * first and the groups follow as expandable sections. Roles without it keep
   * the flat list.
   */
  navGroups?: NavGroup[];
  topbar: TopbarConfig;
  /**
   * Sidebar card lets the user switch between campuses they work at.
   * Off for roles tied to one campus (students) or whose campus follows another
   * choice (parents: the selected child). Those roles get a fixed card.
   */
  campusSwitcher?: boolean;
  /** Entries in the user dropdown. Sign out is appended automatically. */
  userMenu: UserMenuEntry[];
};

const slugify = (label: string) =>
  label
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** The first label is always the role's overview page (empty slug). */
const nav = (labels: string[]): NavItem[] =>
  labels.map((label, i) => ({ label, slug: i === 0 ? "" : slugify(label) }));

const link = (label: string, navLabel: string = label): UserMenuEntry => ({
  kind: "link",
  label,
  navLabel,
});

type GroupDef = {
  label: string;
  /** Path prefix for the group's pages, e.g. "finances" gives /platform/finances/... */
  prefix?: string;
  /** `slug` overrides the one derived from the label (keeps URLs stable when a label changes). */
  items: Array<[label: string, scope: NavScope, slug?: string]>;
  /** Only in these deployments. Omit for all. */
  modes?: DeploymentMode[];
};

/**
 * Platform Admin modules. Slugs come from the labels, so "Tuition fees" in the
 * "finances" group lives at /platform/finances/tuition-fees.
 */
const PLATFORM_GROUPS: GroupDef[] = [
  {
    label: "Platform",
    modes: ["cloud"],
    items: [
      ["Tenants & schools", "platform"],
      ["Subscriptions", "platform"],
      ["Platform users", "platform"],
      ["Usage & capacity", "platform"],
      ["Support queue", "platform"],
    ],
  },
  {
    label: "Institution",
    prefix: "institution",
    items: [
      ["Campuses", "tenant"],
      ["Schools", "tenant"],
      ["Departments", "tenant"],
    ],
  },
  {
    label: "Finances",
    prefix: "finances",
    items: [
      ["Bursary management", "tenant"],
      ["Tuition fees", "tenant"],
      ["Other fees", "tenant"],
      ["Student payments", "tenant"],
    ],
  },
  {
    label: "Users",
    prefix: "users",
    items: [
      ["Students", "tenant"],
      ["Staff", "tenant"],
      ["{educators}", "tenant"],
    ],
  },
  {
    label: "Registrations",
    prefix: "registrations",
    items: [
      ["{period} registration", "tenant"],
      ["{course} registration", "tenant"],
      ["Exam registration", "tenant"],
      ["Exam receipts", "tenant"],
      ["Exam docket", "tenant"],
    ],
  },
  {
    label: "Academics",
    prefix: "academics",
    items: [
      ["{programmes}", "tenant"],
      ["{courses}", "tenant"],
      ["Exemptions", "tenant"],
      ["Assessments & assignments", "tenant"],
    ],
  },
  {
    label: "Examinations",
    prefix: "examinations",
    items: [
      ["Upload exam results", "tenant"],
      ["Result transcripts", "tenant"],
      ["Final results", "tenant"],
      ["Exam register", "tenant"],
    ],
  },
  {
    label: "Hostels",
    prefix: "hostels",
    items: [
      ["Hostels & rooms", "tenant"],
      ["Room allocations", "tenant"],
    ],
  },
  {
    label: "Reports",
    prefix: "reports",
    items: [
      ["Academic reports", "tenant"],
      ["Admitted students", "either"],
      ["{period} registrations", "either"],
      ["Finance reports", "tenant"],
      ["Bank transactions", "tenant"],
      ["Payments report", "tenant"],
      ["Student balances", "tenant"],
      ["Total receivables", "either"],
      ["Receivables analysis", "either"],
      ["Audit trail", "either"],
    ],
  },
  {
    label: "Administration",
    items: [
      ["Access control", "platform"],
      ["Platform settings", "platform"],
      ["Data export & backup", "tenant"],
    ],
  },
];

/**
 * In a single-school deployment the top admin works inside one school: the
 * cross-school Platform group goes, and "Platform settings" becomes "School
 * settings" at the same URL.
 */
function groupsFor(mode: DeploymentMode): GroupDef[] {
  return PLATFORM_GROUPS.filter((g) => !g.modes || g.modes.includes(mode)).map((g) =>
    isMultiTenant(mode)
      ? g
      : {
          ...g,
          items: g.items.map((it): GroupDef["items"][number] =>
            it[0] === "Platform settings" ? ["School settings", it[1], "platform-settings"] : it,
          ),
        },
  );
}

export function buildPlatformNav(mode: DeploymentMode = DEPLOYMENT_MODE): { nav: NavItem[]; navGroups: NavGroup[] } {
  const items: NavItem[] = [{ label: "Overview", slug: "", scope: "platform" }];
  const navGroups: NavGroup[] = [];

  for (const group of groupsFor(mode)) {
    for (const [label, scope, fixedSlug] of group.items) {
      const own = fixedSlug ?? slugify(label);
      const slug = group.prefix ? `${group.prefix}/${own}` : own;
      items.push({ label, slug, scope });
    }
    navGroups.push({ label: group.label, items: group.items.map(([label]) => label) });
  }

  return { nav: items, navGroups };
}

/**
 * The top-level admin role (key "platform", URL /platform). In the shared cloud
 * it is the Platform Admin; in a single-school deployment it is that school's
 * own admin, with no cross-school pages.
 */
export function buildAdminRole(mode: DeploymentMode = DEPLOYMENT_MODE): RoleConfig {
  const built = buildPlatformNav(mode);
  const multi = isMultiTenant(mode);
  return {
    label: DEPLOYMENTS[mode].adminLabel,
    nav: built.nav,
    navGroups: built.navGroups,
    topbar: multi
      ? {
          searchPlaceholder: "Search tenants, schools, users, tickets...",
          // The sidebar card already says "All tenants", so the top bar shows no chip.
          context: { kind: "none" },
          quickAction: { label: "Add tenant", navLabel: "Tenants & schools" },
        }
      : {
          searchPlaceholder: "Search students, staff, pages...",
          context: { kind: "none" },
        },
    userMenu: multi
      ? [link("Platform settings"), link("Audit trail"), link("Support queue")]
      : [link("School settings"), link("Audit trail"), link("Data export & backup")],
  };
}

export const ROLES: Record<RoleKey, RoleConfig> = {
  platform: buildAdminRole(),
  teacher: {
    label: "Teacher",
    nav: nav([
      "My dashboard",
      "My classes",
      "Class register",
      "Lesson planner",
      "Assignments",
      "Assessments",
      "Gradebook",
      "Learning resources",
    ]),
    topbar: {
      searchPlaceholder: "Search learners, classes, assignments...",
      context: { kind: "academicYear" },
      quickAction: { label: "Take register", navLabel: "Class register" },
    },
    campusSwitcher: true,
    userMenu: [
      link("My classes"),
      link("Lesson planner"),
      link("Gradebook"),
    ],
  },
  bursar: {
    label: "Bursar",
    nav: nav([
      "Finance overview",
      "Fee structures",
      "Student accounts",
      "Record payment",
      "Invoices",
      "Debtors",
      "Reconciliation",
      "Financial reports",
    ]),
    topbar: {
      searchPlaceholder: "Search students, invoices, receipts...",
      context: { kind: "academicYear" },
      quickAction: { label: "Record payment", navLabel: "Record payment" },
    },
    campusSwitcher: true,
    userMenu: [
      link("Fee structures"),
      link("Reconciliation"),
      link("Financial reports"),
    ],
  },
  cashier: {
    label: "Cashier",
    nav: nav([
      "Cashier home",
      "Collect payment",
      "Find student",
      "Print receipt",
      "Today's transactions",
      "Cash-up",
      "Payment methods",
    ]),
    topbar: {
      searchPlaceholder: "Find learner by student number or name...",
      context: { kind: "none" },
      quickAction: { label: "Collect payment", navLabel: "Collect payment" },
    },
    campusSwitcher: true,
    userMenu: [
      link("Today's transactions"),
      link("End-of-day cash-up", "Cash-up"),
      link("Payment methods"),
    ],
  },
  parent: {
    label: "Parent",
    nav: nav([
      "Family overview",
      "My children",
      "Attendance",
      "Academic progress",
      "Fee statements",
      "School calendar",
      "Messages",
      "Profile",
    ]),
    topbar: {
      searchPlaceholder: "Search messages, notices, statements...",
      context: { kind: "academicYear" },
      childSwitcher: true,
    },
    userMenu: [
      link("My profile", "Profile"),
      link("Messages"),
      link("Fee statements"),
    ],
  },
  student: {
    label: "Student",
    nav: nav([
      "My home",
      "My timetable",
      "Assignments",
      "Results & grades",
      "Attendance",
      "Learning resources",
      "School notices",
      "My profile",
    ]),
    topbar: {
      searchPlaceholder: "Search assignments, resources, notices...",
      context: { kind: "academicYear" },
    },
    userMenu: [
      link("My profile"),
      link("School notices"),
      link("Results & grades"),
    ],
  },
};

export const isRoleKey = (value: string): value is RoleKey =>
  (ROLE_KEYS as readonly string[]).includes(value);

export const hrefFor = (role: RoleKey, slug: string) =>
  slug ? `/${role}/${slug}` : `/${role}`;

/**
 * Finds the href of a nav item by its label. A label that doesn't match throws,
 * so a typo fails the build instead of shipping a dead link.
 */
export function hrefForNavLabel(
  role: RoleKey,
  navLabel: string,
  source = "Reference",
): string {
  const target = ROLES[role].nav.find((n) => n.label === navLabel);
  if (!target) {
    throw new Error(`${source} for "${role}" references unknown nav item "${navLabel}"`);
  }
  return hrefFor(role, target.slug);
}

/** Turns a role's userMenu config into hrefs. Sign out is always appended last. */
export function resolveUserMenu(role: RoleKey): ResolvedUserMenuEntry[] {
  const resolved = ROLES[role].userMenu.map((entry): ResolvedUserMenuEntry => {
    if (entry.kind === "signout") return entry;
    return {
      kind: "link",
      label: entry.label,
      href: hrefForNavLabel(role, entry.navLabel, "userMenu"),
    };
  });

  return [...resolved, { kind: "signout" }];
}

/** The role's quick action with its href, or undefined when the role has none. */
export function resolveQuickAction(role: RoleKey): ResolvedQuickAction | undefined {
  const action = ROLES[role].topbar.quickAction;
  if (!action) return undefined;
  return {
    label: action.label,
    href: hrefForNavLabel(role, action.navLabel, "quickAction"),
  };
}