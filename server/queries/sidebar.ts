import { cache } from "react";
import { ROLES, type RoleKey } from "@/config/navigation";
import { navBadges, parent, student, teaching } from "@/server/repositories";
import { getParentSession } from "@/server/parent-context";
import { getStudentSession } from "@/server/student-context";
import { getTeacherSession } from "@/server/teacher-context";
import { getCashierSession } from "@/server/cashier-context";
import { cashierToday } from "./cashier-queries";
import { getTenantContext } from "@/server/request-context";

/**
 * Badge counts for the role's nav items, keyed by nav label. Only positive
 * whole numbers for labels that exist in the role's nav survive, so a stale
 * or mistyped label from the data layer cannot break the sidebar.
 * Cached per request: the desktop sidebar and the mobile drawer share one fetch.
 */
export const getNavBadges = cache(
  async (role: RoleKey): Promise<Record<string, number>> => {
    const ctx = await getTenantContext();
    let raw = await navBadges.counts(ctx, role);
    if (role === "teacher") {
      // Registers still in draft and handed-in work waiting for a mark come from the teacher's own data.
      const overview = await teaching.overview((await getTeacherSession()).ctx);
      raw = { ...raw, "Class register": overview.draftRegisters, Assignments: overview.toMark, Assessments: overview.assessmentsToMark };
    }
    if (role === "student") {
      // Assignments with nothing handed in and unread notices come from the student's own records.
      const { ctx } = await getStudentSession();
      const [pending, unread] = await Promise.all([student.countPending(ctx), student.countUnreadNotices(ctx)]);
      raw = { ...raw, Assignments: pending, "School notices": unread };
    }
    if (role === "cashier") {
      // Receipts still pending confirmation come from the cashier's own ledger.
      raw = { ...raw, "Today's transactions": (await cashierToday(await getCashierSession())).pending };
    }
    if (role === "parent") {
      // Unread conversations come from the guardian's own messages.
      raw = { ...raw, Messages: await parent.countUnread((await getParentSession()).ctx) };
    }
    const labels = new Set(ROLES[role].nav.map((n) => n.label));

    const counts: Record<string, number> = {};
    for (const [label, value] of Object.entries(raw)) {
      if (!labels.has(label)) {
        if (process.env.NODE_ENV !== "production") {
          console.warn(`Nav badge for "${role}" names unknown nav item "${label}"`);
        }
        continue;
      }
      if (Number.isFinite(value) && value > 0) counts[label] = Math.floor(value);
    }
    return counts;
  },
);