import { cache } from "react";
import { headers } from "next/headers";
import { schoolSlugFromHost } from "@/lib/portal/host";
import { applyPortalOverride } from "@/lib/portal/merge";
import { portal, tenantDirectory, themes } from "@/server/repositories";
import type { PortalContent } from "@/types/portal";
import type { TenantSummary } from "@/types/platform";
import type { Branding, ThemeSettings } from "@/types/theme";
import { getTenantSelection } from "./platform";

export type PortalPageData = {
  tenant: TenantSummary;
  theme: ThemeSettings;
  branding: Branding;
  content: PortalContent;
};

/**
 * Everything a school's public portal page needs, found by the slug in the
 * subdomain. Undefined when no such school exists or it is suspended. Public
 * and read-only: it returns only branding and portal text, never school data.
 * Reads per-request data, so call it inside <Suspense>.
 */
export const getPortalPage = cache(async (slug: string): Promise<PortalPageData | undefined> => {
  const tenant = (await tenantDirectory.list()).find((t) => t.id === slug);
  if (!tenant || tenant.status === "Suspended") return undefined;
  const { theme, branding } = await themes.resolve({ tenantId: tenant.id });
  return { tenant, theme, branding, content: await portal.resolve(tenant.id) };
});

export type PortalEditorState = {
  scopeLabel: string;
  isTenant: boolean;
  inherited: boolean;
  /** The school's slug, so the editor can link to the live pages. */
  schoolId?: string;
  content: PortalContent;
  platformDefault: PortalContent;
  /** The look the pages are drawn with, so the preview matches. */
  theme: ThemeSettings;
  branding: Branding;
};

/** What the Portal pages editor needs: the platform default, or the open school's content. */
export const getPortalEditorState = cache(async (area: "platform" | "school"): Promise<PortalEditorState> => {
  const { selected } = await getTenantSelection();
  const platformDefault = await portal.getPlatformDefault();
  if (area === "platform" || !selected) {
    const look = await themes.getPlatformDefault();
    return { scopeLabel: "Platform default", isTenant: false, inherited: false, content: platformDefault, platformDefault, ...look };
  }
  const override = await portal.getTenantOverride(selected.id);
  return {
    scopeLabel: selected.name,
    isTenant: true,
    inherited: !override,
    schoolId: selected.id,
    content: applyPortalOverride(platformDefault, override),
    platformDefault,
    ...(await themes.resolve({ tenantId: selected.id })),
  };
});


/**
 * Where this portal's own pages live. On the school's subdomain the proxy
 * rewrites /sign-in, so links stay "/sign-in" ("" base). Reached by path
 * (local development, no wildcard DNS) they must keep the "/s/<school>" prefix.
 */
export async function getPortalBase(slug: string): Promise<string> {
  const host = (await headers()).get("host");
  const root = process.env.NEXT_PUBLIC_ACURIS_ROOT_DOMAIN ?? "localhost";
  return schoolSlugFromHost(host, root) === slug ? "" : `/s/${slug}`;
}
