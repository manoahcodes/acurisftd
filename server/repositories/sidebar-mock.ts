import type { RoleKey } from "@/config/navigation";
import type { NavBadgeRepository } from "./sidebar-types";

// Numbers come from the mockup dashboards.
const DATA: Record<RoleKey, Record<string, number>> = {
  platform: { "Tenants & schools": 1, Subscriptions: 1, "Support queue": 17 },
  "school-admin": {},
  // The teacher's badges (Class register, Assignments, Assessments) come from their own data in server/queries/sidebar.ts.
  teacher: {},
  bursar: {},
  cashier: { "Today's transactions": 2 },
  // The parent's Messages badge comes from their own conversations in server/queries/sidebar.ts.
  parent: {},
  student: { Assignments: 3, "School notices": 2 },
};

export const mockNavBadgeRepository: NavBadgeRepository = {
  // The mock ignores ctx because all mock data belongs to one school.
  async counts(_ctx, role) {
    return DATA[role];
  },
};