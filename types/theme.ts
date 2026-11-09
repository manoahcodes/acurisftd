import type {
  BaseSize,
  Density,
  FontKey,
  Harmony,
  Mode,
  Radius,
  Shadow,
  SidebarStyle,
} from "@/lib/theme/options";

/** Look and feel. Everything except `primary` comes from a closed list. */
export type ThemeSettings = {
  /** The one colour the admin picks, as #rrggbb. The rest of the palette is generated from it. */
  primary: string;
  /** Optional second colour (#rrggbb) used as the accent, or "" to use the generated one. */
  secondary: string;
  /** Optional third colour used to tint the sidebar, or "" to tint it from the primary. */
  tertiary: string;
  harmony: Harmony;
  mode: Mode;
  sidebarStyle: SidebarStyle;
  radius: Radius;
  density: Density;
  shadow: Shadow;
  font: FontKey;
  baseFontSize: BaseSize;
};

/** Identity, contact details and the text printed on documents and shown on the sign-in page. */
export type Branding = {
  name: string;
  shortName: string;
  tagline: string;
  /** A data: URL built on the server from a validated upload, or "" for none. */
  logoUrl: string;
  email: string;
  phone: string;
  address: string;
  timezone: string;
  welcomeMessage: string;
  loginBanner: string;
  documentHeader: string;
  documentFooter: string;
  signatureLine: string;
};

export type ThemeConfig = { theme: ThemeSettings; branding: Branding };

/**
 * What a school has changed from the platform default. Settings it has not
 * changed are absent, so they keep following the default when it is edited.
 */
export type ThemeOverride = { theme: Partial<ThemeSettings>; branding: Partial<Branding> };

export type ThemePreset = { id: string; name: string; theme: ThemeSettings };

/** "platform" is the default every school inherits; a tenant id is that school's override. */
export type ThemeScope = "platform" | (string & {});

export type ThemeFieldErrors = Partial<Record<keyof ThemeSettings | keyof Branding | "logo" | "form", string>>;

export type ThemeFormState = {
  ok: boolean;
  message?: string;
  errors?: ThemeFieldErrors;
};
