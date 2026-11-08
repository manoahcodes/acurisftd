import { notFound } from "next/navigation";
import { Suspense } from "react";
import {
  ROLES,
  ROLE_KEYS,
  hrefFor,
  isRoleKey,
  type NavItem,
} from "@/config/navigation";
import { divisionsLabel, resolveLabel, tenantSystemLabel, tenantTermsType, termsFor } from "@/config/institution";
import { PageHeader } from "@/components/dashboard/page-header";
import { PageSkeleton } from "@/components/dashboard/page-skeleton";
import { PlatformScreenView } from "@/components/platform/platform-screen-view";
import { ThemeSection } from "@/components/platform/theme/theme-section";
import { SelectSchoolPrompt } from "@/components/platform/select-school-prompt";
import { platformScreens } from "@/server/repositories";
import { getTenantSelection } from "@/server/queries/platform";

type Params = Promise<{ role: string; slug: string[] }>;

// Every sidebar page for every role is known up front.
export function generateStaticParams() {
  return ROLE_KEYS.flatMap((role) =>
    ROLES[role].nav
      .filter((item) => item.slug)
      .map((item) => ({ role, slug: item.slug.split("/") })),
  );
}

// Skip instant-navigation validation: these pages read the selected school from a cookie.
export const instant = false;

// `params` is read inside <Suspense> (see ../layout.tsx for why).
export default function SectionPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Section params={params} />
    </Suspense>
  );
}

async function Section({ params }: { params: Params }) {
  const { role, slug } = await params;
  if (!isRoleKey(role)) notFound();

  const item = ROLES[role].nav.find((n) => n.slug === slug.join("/"));
  if (!item) notFound();

  if (role === "platform") return <PlatformSection item={item} />;

  // Other roles: placeholder for every sidebar page that isn't built yet.
  return (
    <PageHeader
      crumbs={[
        { label: "Dashboard", href: `/${role}` },
        { label: ROLES[role].label, href: hrefFor(role, "") },
        { label: item.label, href: hrefFor(role, item.slug) },
      ]}
      title={item.label}
      subtitle="This section hasn't been built yet."
    />
  );
}

/**
 * A Platform Admin page. Screens that belong to one school need a selected
 * school; "either" screens roll up across schools until one is picked.
 */
async function PlatformSection({ item }: { item: NavItem }) {
  const { tenants, selected, division } = await getTenantSelection();
  const title = resolveLabel(item.label, termsFor(selected && tenantTermsType(selected.divisions)));
  const needsSchool = item.scope === "tenant" && !selected;

  const screen = needsSchool
    ? undefined
    : await platformScreens.getScreen(
        { tenant: selected ?? null, division: division ?? null, tenants },
        item.slug,
      );

  const subtitle = selected
    ? `${selected.name} • ${division ? division.name : divisionsLabel(selected.divisions)} • ${tenantSystemLabel(selected.divisions)}`
    : item.scope === "tenant"
      ? "Select a school to continue"
      : "All tenants";

  return (
    <>
      <PageHeader
        crumbs={[
          { label: "Dashboard", href: "/platform" },
          { label: ROLES.platform.label, href: hrefFor("platform", "") },
          { label: title, href: hrefFor("platform", item.slug) },
        ]}
        title={title}
        subtitle={screen || needsSchool ? subtitle : "This section hasn't been built yet."}
      />
      {needsSchool ? (
        <SelectSchoolPrompt title={title} tenants={tenants} />
      ) : screen ? (
        <PlatformScreenView screen={screen} slug={item.slug} />
      ) : null}
      {item.slug === "platform-settings" && <ThemeSection />}
    </>
  );
}
