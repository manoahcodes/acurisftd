import { cache } from "react";
import { teacherTermsFor, type TeacherTerms } from "@/lib/teacher/terms";
import { getDashboardSchool } from "./queries/dashboard";
import { getResolvedTheme } from "./queries/theme";
import { session } from "./repositories";
import type { TeacherContext } from "./repositories/teacher-types";

export type TeacherSession = { ctx: TeacherContext; terms: TeacherTerms; timezone: string; schoolName: string; campus: string };

/**
 * The signed-in teacher or lecturer, the school they teach in, and the
 * wording for it. SWAP POINT: the mock session has no roles, so this only
 * confirms there is a signed-in user. A real session provider must verify the
 * user holds the Teacher/Lecturer role and fail closed, because every
 * repository call is scoped by what this returns. Reads cookies, so call it
 * inside <Suspense> or a Server Action.
 */
export const getTeacherSession = cache(async (): Promise<TeacherSession> => {
  const user = await session.getCurrentUser();
  if (!user) throw new Error("Not signed in.");
  const school = (await getDashboardSchool("teacher")) ?? user.tenant;
  const { branding } = await getResolvedTheme("teacher");
  return {
    ctx: { tenantId: school.tenantId, teacherId: user.id, institutionType: school.institutionType },
    terms: teacherTermsFor(school.institutionType),
    timezone: branding.timezone,
    schoolName: school.tenantName,
    campus: school.campus,
  };
});
