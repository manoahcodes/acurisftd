import { NextResponse, type NextRequest } from "next/server";
import { isPortalPath, schoolSlugFromHost } from "@/lib/portal/host";

/**
 * Subdomain per school: woodlands.<root domain>/sign-in is served by
 * /s/woodlands/sign-in. Only the three portal pages are rewritten; dashboards,
 * assets and the API pass through untouched. Set the root domain with
 * NEXT_PUBLIC_ACURIS_ROOT_DOMAIN (default "localhost"). Production needs a
 * wildcard DNS record (*.your-domain) pointing at the app.
 */
export function proxy(request: NextRequest) {
  const rootDomain = process.env.NEXT_PUBLIC_ACURIS_ROOT_DOMAIN ?? "localhost";
  const slug = schoolSlugFromHost(request.headers.get("host"), rootDomain);
  const { pathname } = request.nextUrl;
  if (!slug || !isPortalPath(pathname)) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = `/s/${slug}${pathname === "/" ? "" : pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  // Skip assets and the API; the proxy only needs the portal pages.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
