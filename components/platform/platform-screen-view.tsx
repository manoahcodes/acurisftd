import type { PlatformScreen } from "@/types/platform";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { DataTable } from "./data-table";
import { ScreenActions } from "./screen-actions";

/** Renders a Platform Admin list screen: description, actions, KPIs and tables. */
export function PlatformScreenView({ screen, slug }: { screen: PlatformScreen; slug: string }) {
  return (
    <div className="mt-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-3xl text-[16px] text-muted">{screen.description}</p>
        {screen.actions && screen.actions.length > 0 && (
          <ScreenActions slug={slug} actions={screen.actions} forms={screen.forms?.actions ?? {}} />
        )}
      </div>

      {screen.kpis && screen.kpis.length > 0 && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {screen.kpis.map((kpi) => (
            <KpiCard key={kpi.title} {...kpi} />
          ))}
        </div>
      )}

      {screen.tables.map((section) => (
        <DataTable
          key={section.title}
          section={section}
          slug={slug}
          editForm={section.id ? screen.forms?.edits[section.id] : undefined}
          rowForm={section.id ? screen.forms?.rows[section.id] : undefined}
        />
      ))}
    </div>
  );
}
