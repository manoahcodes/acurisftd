import { cache } from "react";
import { studentTermsFor, type StudentTerms } from "@/lib/student/terms";
import { getDashboardSchool } from "./queries/dashboard";
import { getResolvedTheme } from "./queries/theme";
import { session } from "./repositories";
import type { StudentContext } from "./repositories/student-types";

export type StudentSession = { ctx: StudentContext; terms: StudentTerms; timezone: string; schoolName: string; campus: string };

/**
 * The signed-in student, the school they study in, and the wording for it.
 * SWAP POINT: the mock session has no roles, so this only confirms there is a
 * signed-in user. A real session provider must verify the user holds the
 * Student role and fail closed, because every repository call is scoped by
 * what this returns. Reads cookies, so call it inside <Suspense> or a Server Action.
 */
export const getStudentSession = cache(async (): Promise<StudentSession> => {
  const user = await session.getCurrentUser();
  if (!user) throw new Error("Not signed in.");
  const school = (await getDashboardSchool("student")) ?? user.tenant;
  const { branding } = await getResolvedTheme("student");
  return {
    ctx: { tenantId: school.tenantId, studentId: user.id, institutionType: school.institutionType },
    terms: studentTermsFor(school.institutionType),
    timezone: branding.timezone,
    schoolName: school.tenantName,
    campus: school.campus,
  };
});
