import { cleanWebsiteUrl } from "./links";
import { isPortalIcon, PORTAL_ICONS } from "./icons";
import type { PortalContent, PortalFeature, PortalFieldErrors, PortalLink } from "@/types/portal";

export const MAX_NAV = 8;
export const MAX_FEATURES = 6;

const clean = (v: unknown): string => (typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "");
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

type Result = { ok: true; value: PortalContent } | { ok: false; errors: PortalFieldErrors };

/** A path on the school's website ("/about", "about") or a full http(s) address. Returns "" when empty. */
function cleanPath(v: unknown, key: string, errors: PortalFieldErrors): string {
  const p = clean(v);
  if (!p) return "";
  if (/^[a-z][a-z0-9+.-]*:/i.test(p)) {
    if (!/^https?:\/\//i.test(p) || !cleanWebsiteUrl(p)) errors[key] = "Use a path like /admissions or a full https:// address.";
    return p;
  }
  if (/[\s<>"']/.test(p) || p.startsWith("//")) errors[key] = "Use a path like /admissions or a full https:// address.";
  return p.startsWith("/") ? p : `/${p}`;
}

function text(v: unknown, key: string, label: string, min: number, max: number, errors: PortalFieldErrors): string {
  const s = clean(v);
  if (s.length < min) errors[key] = `${label} is required.`;
  else if (s.length > max) errors[key] = `${label} must be at most ${max} characters.`;
  return s;
}

/**
 * Validates portal content from untrusted input (parsed JSON). Unknown keys are dropped.
 * Images never come from the JSON: they are data URLs the server built from validated uploads (see readImage).
 */
export function parsePortalContent(input: unknown, images: { heroImage?: string; aboutImage?: string } = {}): Result {
  const errors: PortalFieldErrors = {};
  const i = obj(input);

  let websiteUrl = "";
  const rawSite = clean(i.websiteUrl);
  if (rawSite) {
    const site = cleanWebsiteUrl(rawSite);
    if (!site) errors.websiteUrl = "Enter the website address, like https://www.school.edu.";
    else websiteUrl = site;
  }

  const rawNav = list(i.nav);
  if (rawNav.length > MAX_NAV) errors.nav = `Add at most ${MAX_NAV} links.`;
  const nav: PortalLink[] = rawNav.slice(0, MAX_NAV).map((l, n) => {
    const o = obj(l);
    return { label: text(o.label, `nav.${n}.label`, "Link name", 1, 30, errors), path: cleanPath(o.path, `nav.${n}.path`, errors) };
  });

  const h = obj(i.hero);
  const hero = {
    eyebrow: text(h.eyebrow, "hero.eyebrow", "Small heading", 0, 80, errors),
    heading: text(h.heading, "hero.heading", "Heading", 1, 120, errors),
    body: text(h.body, "hero.body", "Text", 0, 300, errors),
    primaryLabel: text(h.primaryLabel, "hero.primaryLabel", "Main button", 0, 30, errors),
    primaryPath: cleanPath(h.primaryPath, "hero.primaryPath", errors),
    secondaryLabel: text(h.secondaryLabel, "hero.secondaryLabel", "Second button", 0, 30, errors),
    secondaryPath: cleanPath(h.secondaryPath, "hero.secondaryPath", errors),
  };

  const a = obj(i.about);
  const about = {
    eyebrow: text(a.eyebrow, "about.eyebrow", "Small heading", 0, 80, errors),
    heading: text(a.heading, "about.heading", "Heading", 0, 140, errors),
    body: text(a.body, "about.body", "Text", 0, 500, errors),
    linkLabel: text(a.linkLabel, "about.linkLabel", "Link name", 0, 40, errors),
    linkPath: cleanPath(a.linkPath, "about.linkPath", errors),
  };

  const rawFeatures = list(i.features);
  if (rawFeatures.length > MAX_FEATURES) errors.features = `Add at most ${MAX_FEATURES} cards.`;
  const features: PortalFeature[] = rawFeatures.slice(0, MAX_FEATURES).map((f, n) => {
    const o = obj(f);
    const icon = clean(o.icon);
    if (!isPortalIcon(icon)) errors[`features.${n}.icon`] = `Choose one of: ${PORTAL_ICONS.join(", ")}.`;
    return {
      icon,
      title: text(o.title, `features.${n}.title`, "Title", 1, 40, errors),
      body: text(o.body, `features.${n}.body`, "Text", 0, 160, errors),
      path: cleanPath(o.path, `features.${n}.path`, errors),
    };
  });

  const s = obj(i.signIn);
  const signIn = {
    heading: text(s.heading, "signIn.heading", "Heading", 1, 80, errors),
    intro: text(s.intro, "signIn.intro", "Text", 0, 240, errors),
    helpText: text(s.helpText, "signIn.helpText", "Help text", 0, 240, errors),
  };

  const r = obj(i.register);
  const roles = obj(r.roles);
  const register = {
    heading: text(r.heading, "register.heading", "Heading", 1, 80, errors),
    intro: text(r.intro, "register.intro", "Text", 0, 300, errors),
    roles: { applicant: roles.applicant === true, staff: roles.staff === true, parent: roles.parent === true },
  };
  if (!register.roles.applicant && !register.roles.staff && !register.roles.parent) {
    errors["register.roles"] = "Keep at least one sign-up type open.";
  }

  const footerNote = text(i.footerNote, "footerNote", "Footer text", 0, 160, errors);

  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { websiteUrl, heroImage: images.heroImage ?? "", aboutImage: images.aboutImage ?? "", nav, hero, about, features, signIn, register, footerNote } };
}
