import { getStudentFeeView } from "@/server/queries/student-fees";
import { getStudentSession } from "@/server/student-context";
import { FeeNotice } from "./fee-notice";

/** Fee notice for My home. Reads cookies, so render it inside <Suspense> (the dashboard page already is). */
export async function StudentFeeBanner() {
  const session = await getStudentSession();
  return <FeeNotice view={await getStudentFeeView(session)} terms={session.terms} />;
}
