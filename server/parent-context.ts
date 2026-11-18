import { cache } from "react";
import { connection } from "next/server";
import { todayIn } from "@/lib/format";
import { studentTermsFor, type StudentTerms } from "@/lib/student/terms";
import { DEFAULT_FEE_POLICY, isFeePolicy, type FeePolicy } from "@/lib/fee-policy";
import type { Child } from "@/types/topbar";
import { getDashboardSchool } from "./queries/dashboard";
import { getChildState } from "./queries/topbar";
import { getResolvedTheme } from "./queries/theme";
import { session, tenantDirectory } from "./repositories";
import type { ParentContext } from "./repositories/parent-types";
import type { StudentContext } from "./repositories/student-types";

export type { ParentContext };

export type ParentSession = {
  ctx: ParentContext;
  /** Same wording as the Student pages: Learner or Student, Term or Semester. */
  terms: StudentTerms;
  timezone: string;
  schoolName: string;
  campus: string;
  feePolicy: FeePolicy;
  children: Child[];
  /** The child picked in the top bar; undefined when no child is linked. */
  selected: Child | undefined;
};

/**
 * The signed-in guardian, the school and the children linked to them.
 * SWAP POINT: the mock session has no roles, so this only confirms there is a
 * signed-in user. A real session provider must verify the Parent role and fail
 * closed. Waits for a real request (`connection()`) before reading the clock,
 * so call it inside <Suspense> or a Server Action.
 */
export const getParentSession = cache(async (): Promise<ParentSession> => {
  await connection();
  const user = await session.getCurrentUser();
  if (!user) throw new Error("Not signed in.");
  const school = (await getDashboardSchool("parent")) ?? user.tenant;
  const { branding } = await getResolvedTheme("parent");
  const tenant = (await tenantDirectory.list()).find((t) => t.id === school.tenantId);
  const feePolicy = isFeePolicy(tenant?.feePolicy) ? tenant.feePolicy : DEFAULT_FEE_POLICY;
  const { list, selected } = await getChildState();
  return {
    ctx: { tenantId: school.tenantId, guardianId: user.id, institutionType: school.institutionType, childIds: list.map((c) => c.id), today: todayIn(branding.timezone).iso },
    terms: studentTermsFor(school.institutionType),
    timezone: branding.timezone,
    schoolName: school.tenantName,
    campus: school.campus,
    feePolicy,
    children: list,
    selected,
  };
});

/**
 * The Student-module context for one child, or undefined when that child is not
 * linked to the signed-in guardian. Every page and action reads a child's
 * records through this, so a forged id reaches nothing.
 */
export function childContext(s: Pick<ParentSession, "ctx">, childId: string): StudentContext | undefined {
  if (!s.ctx.childIds.includes(childId)) return undefined;
  return { tenantId: s.ctx.tenantId, studentId: childId, institutionType: s.ctx.institutionType, today: s.ctx.today };
}
