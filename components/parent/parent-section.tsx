import { getChildOverviews } from "@/server/queries/parent-children";
import { getParentSession } from "@/server/parent-context";
import { ChildrenView } from "./children-view";

/** Slugs of the Parent pages that are built. */
export const PARENT_PAGES = ["my-children"];

/** One Parent page. Reads cookies and the session, so render it inside <Suspense>. */
export async function ParentSection({ slug }: { slug: string }) {
  const session = await getParentSession();
  const { terms } = session;

  if (slug === "my-children") {
    const rows = await getChildOverviews(session);
    return <ChildrenView rows={rows} terms={terms} selectedId={session.selected?.id} />;
  }

  return null;
}
