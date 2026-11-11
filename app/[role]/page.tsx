import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ROLES, ROLE_KEYS, isRoleKey } from "@/config/navigation";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { PageHeader } from "@/components/dashboard/page-header";
import { PageSkeleton } from "@/components/dashboard/page-skeleton";
import { TodayDate } from "@/components/dashboard/today-date";
import { dashboards } from "@/server/repositories";
import { getDashboardSchool } from "@/server/queries/dashboard";

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
  const data = await dashboards.getDashboard(role, school);
  const subtitleName = school
    ? `${school.tenantName}  •  ${school.campus}`
    : "All schools";

  return (
    <>
      <PageHeader
        crumbs={[
          { label: "Dashboard", href: `/${role}` },
          { label: ROLES[role].label, href: `/${role}` },
        ]}
        title={data.title}
        subtitle={
          <>
            {subtitleName}  •  <TodayDate />
          </>
        }
      />
      <DashboardView data={data} />
    </>
  );
}