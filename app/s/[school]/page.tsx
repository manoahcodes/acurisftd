import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { ThemeStyle } from "@/components/platform/theme/theme-style";
import { PortalLanding } from "@/components/portal/portal-landing";
import { PortalShell } from "@/components/portal/portal-shell";
import { getPortalBase, getPortalPage } from "@/server/queries/portal";

type Params = Promise<{ school: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  await connection();
  const page = await getPortalPage((await params).school);
  if (!page) return { title: "School not found" };
  return { title: page.branding.tagline ? `${page.branding.name} - ${page.branding.tagline}` : page.branding.name };
}

// Reads the saved branding and portal text on every visit, so edits show without a rebuild.
export default function SchoolLandingPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<main className="min-h-dvh bg-canvas" />}>
      <Landing params={params} />
    </Suspense>
  );
}

async function Landing({ params }: { params: Params }) {
  await connection();
  const { school } = await params;
  const page = await getPortalPage(school);
  if (!page) notFound();
  const base = await getPortalBase(school);
  return (
    <>
      <ThemeStyle theme={page.theme} />
      <PortalShell page={page} base={base}>
        <PortalLanding page={page} base={base} />
      </PortalShell>
    </>
  );
}
