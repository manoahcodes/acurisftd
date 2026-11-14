import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ROLES, ROLE_KEYS, isRoleKey } from "@/config/navigation";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { PageHeader } from "@/components/dashboard/page-header";
import { PageSkeleton } from "@/components/dashboard/page-skeleton";
import { TodayDate } from "@/components/dashboard/today-date";
import { dashboards, teaching } from "@/server/repositories";
import { getTeacherSession } from "@/server/teacher-context";
import { getDashboardSchool } from "@/server/queries/dashboard";
import { getResolvedTheme } from "@/server/queries/theme";

type Params = Promise<{ role: string }>;

export function generateStaticParams() {
  return ROLE_KEYS.map((role) => ({ role }));
}

// `params` is read inside <Suspense> (see layout.tsx for why).
export default function RoleDashboardPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <RoleDashboard params={params} />
    </Suspense>
  );
}

async function RoleDashboard({ params }: { params: Params }) {
  const { role } = await params;
  if (!isRoleKey(role)) notFound();

  // The school this role's dashboard describes (own school, or the selected
  // one for Platform Admin / demo preview); none means the platform-wide view.
  const school = await getDashboardSchool(role);
  let data = await dashboards.getDashboard(role, school);
  let roleLabel: string = ROLES[role].label;
  if (role === "teacher") {
    // The marking figures come from the teacher's own assessments, and the title follows the school's level.
    const { ctx, terms } = await getTeacherSession();
    const o = await teaching.overview(ctx);
    roleLabel = terms.educator;
    const plural = (n: number) => `${n} ${n === 1 ? "assignment" : "assignments"}`;
    data = {
      ...data,
      kpis: data.kpis.map((k) => (k.title === "To mark" ? { ...k, value: String(o.assessmentsToMark), note: `${plural(o.toMark)} to mark too` } : k)),
      sections: data.sections.map((sec) => ({ ...sec, rows: sec.rows.map((row) => (row.cells[0] === "Enter assessment marks" ? { ...row, cells: [row.cells[0], `${o.assessmentsToMark} pending`] } : row)) })),
    };
  }
  const { branding } = await getResolvedTheme(role);
  const subtitleName = school
    ? `${school.tenantName}  •  ${school.campus}`
    : "All schools";

  return (
    <>
      <PageHeader
        crumbs={[
          { label: "Dashboard", href: `/${role}` },
          { label: roleLabel, href: `/${role}` },
        ]}
        title={data.title}
        subtitle={
          <>
            {subtitleName}  •  <TodayDate timeZone={branding.timezone} />
          </>
        }
      />
      <DashboardView data={data} />
    </>
  );
}