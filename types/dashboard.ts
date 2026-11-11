import type { InstitutionType } from "@/config/institution";

export type Kpi = {
  title: string;
  caption: string;
  value: string;
  note?: string;
};

/**
 * One line inside a ListCard. `cells` are joined with a bullet (or an arrow
 * when `sep` is "arrow"). `trailingArrow` adds an arrow after the last cell.
 */
export type Row = {
  cells: string[];
  sep?: "dot" | "arrow";
  trailingArrow?: boolean;
};

export type Section = {
  title: string;
  subtitle?: string;
  rows: Row[];
  /** "half" sits two-up on large screens, "full" spans the grid */
  span: "half" | "full";
};

export type Dashboard = {
  title: string;
  kpis: Kpi[];
  sections: Section[];
};

export type TenantContext = {
  tenantId: string;
  tenantName: string;
  campus: string;
  /** Decides Term vs Semester wording for this school. */
  institutionType: InstitutionType;
  /** Optional school facts, used by the Platform Admin's per-school overview. */
  learners?: number;
  campusCount?: number;
  /** e.g. "Primary School + High School". */
  divisionsLabel?: string;
  plan?: string;
  status?: string;
};

export type CurrentUser = {
  id: string;
  name: string;
  tenant: TenantContext;
};
