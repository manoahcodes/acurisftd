/**
 * Links from the portal to the school's official website. The portal is only
 * the sign-in side of the school, so Academics, Admissions and so on live there.
 */

/** A website address as https://host/..., or undefined when it is not a usable http(s) address. */
export function cleanWebsiteUrl(input: string): string | undefined {
  const raw = input.trim();
  if (!raw) return undefined;
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`);
    if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;
    if (!url.hostname.includes(".") && url.hostname !== "localhost") return undefined;
    // Keep the origin and any path; drop the query and fragment.
    return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
  } catch {
    return undefined;
  }
}

/**
 * The full address for a link on the school's website. `path` may be "/about",
 * "about" or a full https:// address. Returns undefined when the school has no
 * website set (or the path is empty), so the caller can hide the link.
 */
export function externalHref(websiteUrl: string, path: string): string | undefined {
  const p = path.trim();
  if (/^https?:\/\//i.test(p)) return cleanWebsiteUrl(p) ? p : undefined;
  // Any other scheme (javascript:, data:, mailto:) is refused rather than treated as a path.
  if (/^[a-z][a-z0-9+.-]*:/i.test(p)) return undefined;
  const base = cleanWebsiteUrl(websiteUrl);
  if (!base) return undefined;
  if (!p || p === "/") return base;
  return `${base}/${p.replace(/^\/+/, "")}`;
}
