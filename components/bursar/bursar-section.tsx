import { BURSAR_PAGES } from "@/lib/bursar/pages";

export { BURSAR_PAGES };

/** One Bursar page. Reads cookies and the session, so render it inside <Suspense>. */
export async function BursarSection({ slug }: { slug: string }) {
  void slug;
  return null;
}
