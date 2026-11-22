import type { PortalContent, PortalOverride } from "@/types/portal";
import { DEFAULT_OVERLAY } from "@/lib/portal/overlay";

/**
 * The words and links on each school's public portal pages, per platform and per school.
 * SWAP POINT: a real implementation must check the caller's role and that
 * `tenantId` is a school they may change, on every write. Reads are public
 * (these pages are shown before anyone signs in), so they must return only this content.
 */
export interface PortalRepository {
  /** What a school actually shows: the platform default with its own changes on top. */
  resolve(tenantId: string): Promise<PortalContent>;
  getPlatformDefault(): Promise<PortalContent>;
  /** Only what the school changed. undefined when it inherits everything. */
  getTenantOverride(tenantId: string): Promise<PortalOverride | undefined>;
  savePlatformDefault(content: PortalContent): Promise<void>;
  saveTenantOverride(tenantId: string, override: PortalOverride): Promise<void>;
  clearTenantOverride(tenantId: string): Promise<void>;
}

export const DEFAULT_PORTAL: PortalContent = {
  websiteUrl: "",
  heroImage: "",
  slides: [],
  aboutImage: "",
  signInImage: "",
  registerImage: "",
  nav: [
    { label: "About", path: "/about" },
    { label: "Academics", path: "/academics" },
    { label: "Admissions", path: "/admissions" },
    { label: "Contact", path: "/contact" },
  ],
  hero: {
    eyebrow: "Welcome to",
    heading: "Education without boundaries.",
    body: "Discover a connected learning environment where students, educators and institutions thrive.",
    primaryLabel: "Explore Academics",
    primaryPath: "/academics",
    secondaryLabel: "Admissions",
    secondaryPath: "/admissions",
  },
  about: {
    eyebrow: "Discover",
    heading: "A supportive place to learn, grow and prepare for the future.",
    body: "Students can explore academic programmes, connect with their community and build the knowledge and skills for what comes next.",
    linkLabel: "Learn more about us",
    linkPath: "/about",
  },
  features: [
    { icon: "book", title: "Academics", body: "Explore courses and academic programmes.", path: "/academics" },
    { icon: "users", title: "Admissions", body: "Find information about joining our institution.", path: "/admissions" },
    { icon: "calendar", title: "Events", body: "Stay informed about institutional activities.", path: "/events" },
    { icon: "graduation", title: "Student Life", body: "Discover our learning community.", path: "/student-life" },
  ],
  signIn: {
    heading: "Sign in",
    intro: "Use your portal account to continue.",
    helpText: "Forgot your details? Contact the school office.",
    overlay: { ...DEFAULT_OVERLAY },
  },
  register: {
    heading: "Create your account",
    intro: "Choose how you are joining and we will take you through the next steps.",
    roles: { applicant: true, staff: true, parent: true },
    overlay: { ...DEFAULT_OVERLAY },
  },
  footerNote: "",
};
