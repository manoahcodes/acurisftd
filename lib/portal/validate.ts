import { cleanWebsiteUrl } from "./links";
import { isPortalIcon, PORTAL_ICONS } from "./icons";
import { isOverlayColor, MAX_OVERLAY, OVERLAY_COLORS } from "./overlay";
import type { PortalContent, PortalFeature, PortalFieldErrors, PortalLink, PortalSlide } from "@/types/portal";

export const MAX_NAV = 8;
export const MAX_FEATURES = 6;
export const MAX_SLIDES = 5;

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

function overlay(v: unknown, key: string, errors: PortalFieldErrors): { color: "navy" | "brand" | "black"; strength: number } {
  const o = obj(v);
  const strength = typeof o.strength === "number" ? o.strength : Number.NaN;
  if (!isOverlayColor(o.color)) errors[`${key}.color`] = `Choose one of: ${Object.values(OVERLAY_COLORS).map((c) => c.label).join(", ")}.`;
  if (!Number.isInteger(strength) || strength < 0 || strength > MAX_OVERLAY) errors[`${key}.strength`] = `Strength must be a whole number from 0 to ${MAX_OVERLAY}.`;
  return { color: isOverlayColor(o.color) ? o.color : "navy", strength: Number.isInteger(strength) ? strength : 75 };
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
export function parsePortalContent(input: unknown, images: { heroImage?: string; aboutImage?: string; signInImage?: string; registerImage?: string; slideImages?: string[] } = {}): Result {
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

  const rawSlides = list(i.slides);
  if (rawSlides.length > MAX_SLIDES) errors.slides = `Add at most ${MAX_SLIDES} slides.`;
  const slides: PortalSlide[] = rawSlides.slice(0, MAX_SLIDES).map((sl, n) => {
    const o = obj(sl);
    const image = images.slideImages?.[n] ?? "";
    if (!image) errors[`slides.${n}.image`] = "Add a photo for this slide.";
    return {
      image,
      heading: text(o.heading, `slides.${n}.heading`, "Heading", 1, 100, errors),
      body: text(o.body, `slides.${n}.body`, "Text", 0, 200, errors),
      ctaLabel: text(o.ctaLabel, `slides.${n}.ctaLabel`, "Button", 0, 30, errors),
      ctaPath: cleanPath(o.ctaPath, `slides.${n}.ctaPath`, errors),
    };
  });

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
    overlay: overlay(s.overlay, "signIn.overlay", errors),
  };

  const r = obj(i.register);
  const roles = obj(r.roles);
  const register = {
    heading: text(r.heading, "register.heading", "Heading", 1, 80, errors),
    intro: text(r.intro, "register.intro", "Text", 0, 300, errors),
    overlay: overlay(r.overlay, "register.overlay", errors),
    roles: { applicant: roles.applicant === true, staff: roles.staff === true, parent: roles.parent === true },
  };
  if (!register.roles.applicant && !register.roles.staff && !register.roles.parent) {
    errors["register.roles"] = "Keep at least one sign-up type open.";
  }

  const footerNote = text(i.footerNote, "footerNote", "Footer text", 0, 160, errors);

  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { websiteUrl, heroImage: images.heroImage ?? "", aboutImage: images.aboutImage ?? "", signInImage: images.signInImage ?? "", registerImage: images.registerImage ?? "", slides, nav, hero, about, features, signIn, register, footerNote } };
}
