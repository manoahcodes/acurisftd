import { cache } from "react";
import { ROLES, type RoleKey } from "@/config/navigation";
import { navBadges, teaching } from "@/server/repositories";
import { getTeacherSession } from "@/server/teacher-context";
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