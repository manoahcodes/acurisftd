import type { Branding } from "@/types/theme";

/** One link in the portal header or footer. It points at the school's official website. */
export type PortalLink = {
  label: string;
  /** Path on the school's website, e.g. "/admissions". A full https:// address is also allowed. */
  path: string;
};

export type PortalFeature = {
  /** Name of an icon from the fixed list in lib/portal/icons.ts. */
  icon: string;
  title: string;
  body: string;
  /** Where the card goes on the school's website ("" for no link). */
  path: string;
};

/** One slide of the optional hero slider. */
export type PortalSlide = {
  /** A data: URL built on the server from a validated upload. */
  image: string;
  heading: string;
  body: string;
  ctaLabel: string;
  ctaPath: string;
};

/** The tinted layer over a page's side photo, so the text on it stays readable. */
export type PortalOverlay = {
  color: "navy" | "brand" | "black";
  /** 0 to 95 (percent). */
  strength: number;
};

/** The look of the brand panel on the left of the sign-in and register pages (its base colour, glow and grid lines). */
export type PortalPanel = {
  color: "navy" | "brand" | "black";
  glow: boolean;
  grid: boolean;
};

export type PortalSignUpRoles = {
  /** People applying to join the school (becomes a student after admission). */
  applicant: boolean;
  /** Staff who hold an invite code from the school. */
  staff: boolean;
  /** Parents and guardians who hold an invite code. */
  parent: boolean;
};

/**
 * The words and links on a school's public portal pages: landing, sign-in and
 * register. Colours, logo and name come from the theme and branding instead.
 */
export type PortalContent = {
  /** The school's official website, e.g. "https://www.woodlands.edu". "" hides every external link. */
  websiteUrl: string;
  nav: PortalLink[];
  /** A data: URL built on the server from a validated upload, or "" for none. Shown behind the hero text. */
  heroImage: string;
  /** Optional hero slider. Empty means the normal single hero. */
  slides: PortalSlide[];
  /** Same, shown beside the about text. */
  aboutImage: string;
  /** Same, shown behind the brand panel on the sign-in page. */
  signInImage: string;
  /** Same, for the register page. */
  registerImage: string;
  hero: {
    eyebrow: string;
    heading: string;
    body: string;
    primaryLabel: string;
    primaryPath: string;
    secondaryLabel: string;
    secondaryPath: string;
  };
  about: {
    eyebrow: string;
    heading: string;
    body: string;
    linkLabel: string;
    linkPath: string;
  };
  features: PortalFeature[];
  signIn: { heading: string; intro: string; helpText: string; overlay: PortalOverlay; panel: PortalPanel };
  register: { heading: string; intro: string; roles: PortalSignUpRoles; overlay: PortalOverlay; panel: PortalPanel };
  /** Text under the school name in the footer. */
  footerNote: string;
};

/** What a school has changed from the platform default. Unchanged sections keep following the default. */
export type PortalOverride = Partial<PortalContent>;

export type PortalFieldErrors = Record<string, string>;

export type PortalFormState = {
  ok: boolean;
  message?: string;
  errors?: PortalFieldErrors;
};

/** What the landing, sign-in and register components draw. Used by the live pages and the editor's preview. */
export type PortalView = { branding: Branding; content: PortalContent };
