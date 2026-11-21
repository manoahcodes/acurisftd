import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { ThemeStyle } from "@/components/platform/theme/theme-style";
import { PortalRegisterForm } from "@/components/portal/portal-register-form";
import { PortalAuthLayout } from "@/components/portal/portal-shell";
import { getPortalBase, getPortalPage } from "@/server/queries/portal";

type Params = Promise<{ school: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  await connection();
  const page = await getPortalPage((await params).school);
  return { title: page ? `Register · ${page.branding.name}` : "School not found" };
}

export default function SchoolRegisterPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<main className="min-h-dvh bg-canvas" />}>
      <Register params={params} />
    </Suspense>
  );
}

async function Register({ params }: { params: Params }) {
  await connection();
  const { school } = await params;
  const page = await getPortalPage(school);
  // A school that has closed every sign-up type has no register page.
  if (!page || !Object.values(page.content.register.roles).some(Boolean)) notFound();
  const base = await getPortalBase(school);
  const { content } = page;

  return (
    <>
      <ThemeStyle theme={page.theme} />
      <PortalAuthLayout page={page} base={base} heading={content.register.heading} intro={content.register.intro} statement={`Join ${page.branding.name}.`} wide>
        <PortalRegisterForm roles={content.register.roles} base={base} />
      </PortalAuthLayout>
    </>
  );
}
