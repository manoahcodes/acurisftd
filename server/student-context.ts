import { cache } from "react";
import { connection } from "next/server";
import { todayIn } from "@/lib/format";
import { studentTermsFor, type StudentTerms } from "@/lib/student/terms";
import { getDashboardSchool } from "./queries/dashboard";
import { getResolvedTheme } from "./queries/theme";
import { DEFAULT_FEE_POLICY, isFeePolicy, type FeePolicy } from "@/lib/fee-policy";
import { session, tenantDirectory } from "./repositories";
import type { StudentContext } from "./repositories/student-types";

export type StudentSession = { ctx: StudentContext; terms: StudentTerms; timezone: string; schoolName: string; campus: string; feePolicy: FeePolicy };

/**
 * The signed-in student, the school they study in, and the wording for it.
 * SWAP POINT: the mock session has no roles, so this only confirms there is a
 * signed-in user. A real session provider must verify the user holds the
 * Student role and fail closed, because every repository call is scoped by
 * what this returns. Waits for a real request (`connection()`) before reading
 * the clock, which is how a fee balance is told apart as due or overdue, so
 * call it inside <Suspense> or a Server Action.
 */
export const getStudentSession = cache(async (): Promise<StudentSession> => {
  await connection();
  const user = await session.getCurrentUser();
  if (!user) throw new Error("Not signed in.");
  const school = (await getDashboardSchool("student")) ?? user.tenant;
  const { branding } = await getResolvedTheme("student");
  // The school's own policy, set by the Platform Admin. Unknown or missing means information only.
  const tenant = (await tenantDirectory.list()).find((t) => t.id === school.tenantId);
  const feePolicy = isFeePolicy(tenant?.feePolicy) ? tenant.feePolicy : DEFAULT_FEE_POLICY;
  return {
    ctx: { tenantId: school.tenantId, studentId: user.id, institutionType: school.institutionType, today: todayIn(branding.timezone).iso },
    terms: studentTermsFor(school.institutionType),
    timezone: branding.timezone,
    schoolName: school.tenantName,
    campus: school.campus,
    feePolicy,
  };
});
