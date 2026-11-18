import { cache } from "react";
import { connection } from "next/server";
import { todayIn } from "@/lib/format";
import { bursarTermsFor, type BursarTerms } from "@/lib/bursar/terms";
import { getDashboardSchool } from "./queries/dashboard";
import { getResolvedTheme } from "./queries/theme";
import { session } from "./repositories";
import type { BursarContext } from "./repositories/bursar-types";

export type BursarSession = { ctx: BursarContext; terms: BursarTerms; timezone: string; schoolName: string; campus: string };

/**
 * The signed-in bursar, the school whose fees they run, the wording for it and
 * today's school day. SWAP POINT: the mock session has no roles, so this only
 * confirms there is a signed-in user. A real session provider must verify the
 * user holds the Bursar role and fail closed, because every repository call is
 * scoped by what this returns. Waits for a real request (`connection()`) before
 * reading the clock, because the server must not read it while prerendering:
 * call it inside <Suspense> or a Server Action.
 */
export const getBursarSession = cache(async (): Promise<BursarSession> => {
  await connection();
  const user = await session.getCurrentUser();
  if (!user) throw new Error("Not signed in.");
  const school = (await getDashboardSchool("bursar")) ?? user.tenant;
  const { branding } = await getResolvedTheme("bursar");
  return {
    ctx: { tenantId: school.tenantId, bursarId: user.id, bursarName: user.name, institutionType: school.institutionType, today: todayIn(branding.timezone).iso },
    terms: bursarTermsFor(school.institutionType),
    timezone: branding.timezone,
    schoolName: school.tenantName,
    campus: school.campus,
  };
});
