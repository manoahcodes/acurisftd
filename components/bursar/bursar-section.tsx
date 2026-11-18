import { BURSAR_PAGES } from "@/lib/bursar/pages";
import { printBrandingOf } from "@/lib/print";
import { bursar } from "@/server/repositories";
import { getBursarSession } from "@/server/bursar-context";
import { getResolvedTheme } from "@/server/queries/theme";
import { FeeStructuresView } from "./fee-structures-view";

export { BURSAR_PAGES };

/** One Bursar page. Reads cookies and the session, so render it inside <Suspense>. */
export async function BursarSection({ slug }: { slug: string }) {
  const { ctx, terms } = await getBursarSession();
  const branding = printBrandingOf((await getResolvedTheme("bursar")).branding);

  if (slug === "fee-structures") {
    const [fees, groups] = await Promise.all([bursar.listFees(ctx), bursar.listGroups(ctx)]);
    return <FeeStructuresView fees={fees} groups={groups} terms={terms} today={ctx.today} branding={branding} />;
  }

  return null;
}
