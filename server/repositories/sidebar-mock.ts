import type { RoleKey } from "@/config/navigation";
import type { NavBadgeRepository } from "./sidebar-types";

// Numbers come from the mockup dashboards.
const DATA: Record<RoleKey, Record<string, number>> = {
  platform: { "Tenants & schools": 1, Subscriptions: 1, "Support queue": 17 },
  // "Class register" and "Assignments" are filled from the teacher's own data in server/queries/sidebar.ts.
  teacher: { Assessments: 28 },
  bursar: { "Student accounts": 3, Debtors: 24, Reconciliation: 1 },
  cashier: { "Today's transactions": 2 },
  parent: { Messages: 3 },
  student: { Assignments: 3, "School notices": 2 },
};

export const mockNavBadgeRepository: NavBadgeRepository = {
  // The mock ignores ctx because all mock data belongs to one school.
  async counts(_ctx, role) {
    return DATA[role];
  },
};