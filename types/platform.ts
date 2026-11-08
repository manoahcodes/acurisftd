import type { Division } from "@/config/institution";
import type { Kpi } from "./dashboard";
import type { ScreenForms } from "./forms";

/** A school (tenant) as the Platform Admin sees it. */
export type TenantSummary = {
  id: string;
  name: string;
  /** One or more divisions. All share one academic system. */
  divisions: Division[];
  campuses: number;
  learners: number;
  plan: "Starter" | "Growth" | "Enterprise";
  status: "Active" | "Trial" | "Suspended";
};

export type TableSection = {
  /** Stable id; forms attach to tables by it (titles change with wording). */
  id?: string;
  title: string;
  subtitle?: string;
  columns: string[];
  rows: string[][];
  /** Column header whose values render as coloured status chips. */
  statusColumn?: string;
  /** Short legend shown under the table. */
  note?: string;
};

/** Everything a list screen needs. Rendered by PlatformScreenView. */
export type PlatformScreen = {
  description: string;
  kpis?: Kpi[];
  tables: TableSection[];
  /** Primary actions. Those with a form (see `forms`) open it; the rest are not built yet. */
  actions?: string[];
  /** Create / edit forms for this screen, added on the way out of the repository. */
  forms?: ScreenForms;
};
