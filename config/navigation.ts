import { DEPLOYMENT_MODE, DEPLOYMENTS, isMultiTenant } from "./deployment";

export const ROLE_KEYS = [
  "platform",
  "school-admin",
  "teacher",
  "bursar",
  "cashier",
  "parent",
  "student",
] as const;

export type RoleKey = (typeof ROLE_KEYS)[number];

/**
 * Where an admin page's data comes from.
 * "platform": the platform's own data (tenants, plans, support), never a
 * school's records. "tenant": one school's records, so a school must be
 * selected (School Admin pages, reached through a school workspace).
 * "either": aggregates across schools until one is selected (not used by the
 * Platform Admin any more; kept for the type).
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
export type QuickAction = {
  label: string;
  navLabel: string;
  /** Label of the page's action button to open straight away (e.g. "Add tenant"). */
  opens?: string;
};

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
};

/**
 * Platform Admin modules: the tenants (client schools) and the platform itself.
 * Nothing here shows a school's students, fees, registrations or academics;
 * those belong to the School Admin (see SCHOOL_ADMIN_GROUPS) and are reached by
 * opening that school's workspace.
 */
const PLATFORM_GROUPS: GroupDef[] = [
  {
    label: "Tenants",
    items: [
      ["Tenants & schools", "platform"],
      ["Subscriptions", "platform"],
      ["Usage & capacity", "platform"],
      ["Support queue", "platform"],
    ],
  },
  {
    label: "Administration",
    items: [
      ["Platform users", "platform"],
      ["Access control", "platform"],
      ["Platform settings", "platform"],
      // Platform-level events only: tenants, plans and workspace entries.
      ["Audit trail", "platform", "audit-trail"],
    ],
  },
];

/**
 * School Admin modules: one school's operations. Slugs come from the labels, so
 * "Tuition fees" in the "finances" group lives at /school-admin/finances/tuition-fees.
 */
const SCHOOL_ADMIN_GROUPS: GroupDef[] = [
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
      ["Admitted students", "tenant"],
      ["{period} registrations", "tenant"],
      ["Finance reports", "tenant"],
      ["Bank transactions", "tenant"],
      ["Payments report", "tenant"],
      ["Student balances", "tenant"],
      ["Total receivables", "tenant"],
      ["Receivables analysis", "tenant"],
      ["Audit trail", "tenant"],
    ],
  },
  {
    label: "Administration",
    items: [
      // Same screen the platform used to call "Platform settings", now per school.
      ["School settings", "tenant", "school-settings"],
      ["Data export & backup", "tenant"],
    ],
  },
];

function navFromGroups(groups: GroupDef[]): { nav: NavItem[]; navGroups: NavGroup[] } {
  const items: NavItem[] = [{ label: "Overview", slug: "", scope: "platform" }];
  const navGroups: NavGroup[] = [];
  for (const group of groups) {
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
 * The Platform Admin role (URL /platform): ACURIS staff running the tenants.
 * In a single-school deployment there are no tenants, so the role is not
 * offered (see `isRoleAvailable`) and the School Admin is the top admin.
 */
export function buildPlatformRole(): RoleConfig {
  const built = navFromGroups(PLATFORM_GROUPS);
  return {
    label: DEPLOYMENTS.cloud.adminLabel,
    nav: built.nav,
    navGroups: built.navGroups,
    topbar: {
      searchPlaceholder: "Search tenants, subscriptions, tickets...",
      // The sidebar card already says "All tenants", so the top bar shows no chip.
      context: { kind: "none" },
      quickAction: { label: "Add tenant", navLabel: "Tenants & schools", opens: "Add tenant" },
    },
    userMenu: [link("Platform settings"), link("Audit trail"), link("Support queue")],
  };
}

/**
 * The School Admin role (URL /school-admin): one school's own administrator.
 * In the shared cloud a Platform Admin can enter a school's workspace as this
 * role (with a visible banner and an audit entry); in a single-school
 * deployment it is the top admin.
 */
export function buildSchoolAdminRole(): RoleConfig {
  const built = navFromGroups(SCHOOL_ADMIN_GROUPS);
  return {
    label: "School Admin",
    nav: built.nav,
    navGroups: built.navGroups,
    topbar: {
      searchPlaceholder: "Search students, staff, pages...",
      context: { kind: "none" },
    },
    userMenu: [link("School settings"), link("Audit trail"), link("Data export & backup")],
  };
}

export const ROLES: Record<RoleKey, RoleConfig> = {
  platform: buildPlatformRole(),
  "school-admin": buildSchoolAdminRole(),
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
      "Exam card",
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

/**
 * Roles that exist in a deployment. A single-school deployment has no tenants,
 * so there is no Platform Admin there: the School Admin is the top admin.
 */
export function isRoleAvailable(role: RoleKey, mode = DEPLOYMENT_MODE): boolean {
  return role !== "platform" || isMultiTenant(mode);
}

/** Roles to offer in pickers for this deployment. */
export const availableRoleKeys = (mode = DEPLOYMENT_MODE): RoleKey[] =>
  ROLE_KEYS.filter((r) => isRoleAvailable(r, mode));

/** The School Admin or Platform Admin nav item for a slug (admin screens share builders). */
export function adminNavItem(slug: string): NavItem | undefined {
  return ROLES["school-admin"].nav.find((n) => n.slug === slug) ?? ROLES.platform.nav.find((n) => n.slug === slug);
}

/** Query parameter that opens a page's action form on arrival. */
export const OPEN_PARAM = "new";

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
  const href = hrefForNavLabel(role, action.navLabel, "quickAction");
  return {
    label: action.label,
    // The page opens that action's form on arrival (see ScreenActions).
    href: action.opens ? `${href}?${OPEN_PARAM}=${encodeURIComponent(action.opens)}` : href,
  };
}