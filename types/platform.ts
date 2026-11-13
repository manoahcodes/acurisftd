import type { Division } from "@/config/institution";
import type { Kpi } from "./dashboard";
import type { ProcessSpec } from "./process";
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
  /** Rows of this table can be printed one by one as this document (e.g. "Transcript"). */
  printAs?: string;
  /** Short legend shown under the table. */
  note?: string;
  /** Per-row state, in the same order as `rows`. Rows without an entry are active and archivable. */
  rowMeta?: RowMeta[];
};

export type RowMeta = {
  /** Hidden unless "Show archived" is ticked. */
  archived?: boolean;
  /** Can be deleted for good (created through a form and with no history). */
  deletable?: boolean;
  /** False for rows that are suspended instead of archived (schools). Default true. */
  archivable?: boolean;
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
  /** Job buttons (import, generate, publish...) by action label, added on the way out of the repository. */
  processes?: Record<string, ProcessSpec>;
};
