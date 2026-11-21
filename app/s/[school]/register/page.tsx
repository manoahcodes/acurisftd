import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { ThemeStyle } from "@/components/platform/theme/theme-style";
import { PortalRegisterForm } from "@/components/portal/portal-register-form";
import { PortalShell } from "@/components/portal/portal-shell";
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
  const { content, branding } = page;

  return (
    <>
      <ThemeStyle theme={page.theme} />
      <PortalShell page={page} base={base}>
        <div className="mx-auto grid w-full max-w-5xl gap-10 px-5 py-12 lg:grid-cols-[1fr_1.3fr]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-brand">{branding.name}</p>
            <h1 className="mt-3 text-3xl font-bold text-ink sm:text-4xl">{content.register.heading}</h1>
            {content.register.intro && <p className="mt-4 text-[17px] leading-relaxed text-muted">{content.register.intro}</p>}
          </div>
          <div className="rounded-2xl border border-line bg-surface p-6 shadow-card sm:p-8">
            <PortalRegisterForm roles={content.register.roles} base={base} />
          </div>
        </div>
      </PortalShell>
    </>
  );
}
