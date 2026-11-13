import type { Dashboard } from "@/types/dashboard";
import { KpiCard } from "./kpi-card";
import { ListCard } from "./list-card";

/** Renders the KPI row plus the card grid. Every role dashboard uses this. */
export function DashboardView({ data }: { data: Dashboard }) {
  return (
    <>
      <div className="mt-2 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {data.kpis.map((kpi) => (
          <KpiCard key={kpi.title} {...kpi} />
        ))}
      </div>
      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
        {data.sections.map((section) => (
          <ListCard key={section.title} {...section} />
        ))}
      </div>
    </>
  );
}
