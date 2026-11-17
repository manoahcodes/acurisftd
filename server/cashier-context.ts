import { cache } from "react";
import { connection } from "next/server";
import { todayIn } from "@/lib/format";
import { cashierTermsFor, type CashierTerms } from "@/lib/cashier/terms";
import { getDashboardSchool } from "./queries/dashboard";
import { getResolvedTheme } from "./queries/theme";
import { session } from "./repositories";
import type { CashierContext } from "./repositories/cashier-types";

export type CashierSession = { ctx: CashierContext; terms: CashierTerms; timezone: string; schoolName: string; campus: string };

/**
 * The signed-in cashier, the school they work in, the wording for it and today's
 * school day. SWAP POINT: the mock session has no roles, so this only confirms
 * there is a signed-in user. A real session provider must verify the user holds
 * the Cashier role and fail closed, because every repository call is scoped by
 * what this returns. Waits for a real request (`connection()`) before reading
 * the clock, because the server must not read it while prerendering: call it
 * inside <Suspense> or a Server Action.
 */
export const getCashierSession = cache(async (): Promise<CashierSession> => {
  await connection();
  const user = await session.getCurrentUser();
  if (!user) throw new Error("Not signed in.");
  const school = (await getDashboardSchool("cashier")) ?? user.tenant;
  const { branding } = await getResolvedTheme("cashier");
  return {
    ctx: { tenantId: school.tenantId, cashierId: user.id, cashierName: user.name, institutionType: school.institutionType, today: todayIn(branding.timezone).iso },
    terms: cashierTermsFor(school.institutionType),
    timezone: branding.timezone,
    schoolName: school.tenantName,
    campus: school.campus,
  };
});
