import type { Branding, ThemeConfig, ThemePreset, ThemeScope, ThemeSettings } from "@/types/theme";
import type { DirectoryContext } from "./directory-types";

/**
 * Look and feel, per platform and per school.
 * SWAP POINT: a real implementation must check the caller's role and that
 * `tenantId` is a school they may change, on every write.
 */
export interface ThemeRepository {
  /** What a school actually shows: its own override, else the platform default. */
  resolve(ctx: DirectoryContext): Promise<ThemeConfig>;
  getPlatformDefault(): Promise<ThemeConfig>;
  /** undefined when the school has no override and inherits the default. */
  getTenantOverride(tenantId: string): Promise<ThemeConfig | undefined>;
  savePlatformDefault(config: ThemeConfig): Promise<void>;
  saveTenantOverride(tenantId: string, config: ThemeConfig): Promise<void>;
  clearTenantOverride(tenantId: string): Promise<void>;
  listPresets(scope: ThemeScope): Promise<ThemePreset[]>;
  savePreset(scope: ThemeScope, name: string, theme: ThemeSettings): Promise<ThemePreset>;
  deletePreset(scope: ThemeScope, id: string): Promise<void>;
}

export const DEFAULT_THEME: ThemeSettings = {
  primary: "#0b66f5",
  secondary: "",
  tertiary: "",
  harmony: "analogous",
  mode: "light",
  sidebarStyle: "dark",
  radius: "rounded",
  density: "comfortable",
  shadow: "soft",
  font: "inter",
  baseFontSize: 16,
};

export const DEFAULT_BRANDING: Branding = {
  name: "ACURIS",
  shortName: "ACURIS",
  tagline: "Advance Campus Unified Records & Information System",
  logoUrl: "",
  email: "",
  phone: "",
  address: "",
  timezone: "Africa/Lusaka",
  welcomeMessage: "Welcome back.",
  loginBanner: "",
  documentHeader: "",
  documentFooter: "",
  signatureLine: "Registrar",
};
