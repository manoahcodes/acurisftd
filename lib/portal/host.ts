/**
 * Which school a request is for, from the Host header. Schools live on a
 * subdomain: woodlands.acuris.app, or woodlands.localhost:3001 while developing.
 * The bare domain, "www" and "app" are the platform itself, not a school.
 */
const RESERVED = new Set(["www", "app", "admin", "api"]);
const SLUG = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export function schoolSlugFromHost(host: string | null | undefined, rootDomain: string): string | undefined {
  if (!host) return undefined;
  const hostname = host.toLowerCase().split(":")[0];
  const root = rootDomain.toLowerCase().split(":")[0].replace(/^\.+/, "");
  if (!root || !hostname.endsWith(`.${root}`)) return undefined;
  const sub = hostname.slice(0, -(root.length + 1));
  // One label only: a.b.root is not a school.
  if (sub.includes(".") || RESERVED.has(sub) || !SLUG.test(sub)) return undefined;
  return sub;
}

/** The portal pages a school subdomain serves. Everything else (dashboards, assets, API) is left alone. */
export const PORTAL_PATHS = ["/", "/sign-in", "/register"] as const;
export const isPortalPath = (pathname: string) => (PORTAL_PATHS as readonly string[]).includes(pathname);
