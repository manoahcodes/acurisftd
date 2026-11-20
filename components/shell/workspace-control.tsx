import { divisionsLabel, tenantSystemLabel } from "@/config/institution";
import { getTenantSelection } from "@/server/queries/platform";
import { DivisionSelect } from "./division-select";
import { StaticTenantCard } from "./tenant-card";

/**
 * Sidebar card for the School Admin in the shared cloud: the school workspace
 * that is open (switching school means leaving the workspace from the Platform
 * Admin), plus a division picker for a school with several divisions.
 */
export async function WorkspaceControl() {
  const { selected, division } = await getTenantSelection();

  if (!selected) {
    return <StaticTenantCard title="No school open" subtitle="Open a workspace first" />;
  }

  return (
    <>
      <StaticTenantCard title={selected.name} subtitle={`${divisionsLabel(selected.divisions)} · ${tenantSystemLabel(selected.divisions)}`} />
      {selected.divisions.length > 1 && (
        <DivisionSelect
          options={[
            { id: "all", name: "All divisions" },
            ...selected.divisions.map((d) => ({ id: d.id, name: d.name })),
          ]}
          selectedId={division?.id ?? "all"}
        />
      )}
    </>
  );
}
