import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { SignInForm } from "@/components/auth/sign-in-form";
import { ThemeStyle } from "@/components/platform/theme/theme-style";
import { PortalShell, SchoolMark } from "@/components/portal/portal-shell";
import { getPortalBase, getPortalPage } from "@/server/queries/portal";

type Params = Promise<{ school: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  await connection();
  const page = await getPortalPage((await params).school);
  return { title: page ? `Sign in · ${page.branding.name}` : "School not found" };
}

export default function SchoolSignInPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<main className="min-h-dvh bg-canvas" />}>
      <SignIn params={params} />
    </Suspense>
  );
}

async function SignIn({ params }: { params: Params }) {
  await connection();
  const { school } = await params;
  const page = await getPortalPage(school);
  if (!page) notFound();
  const base = await getPortalBase(school);
  const { branding, content } = page;
  const canRegister = Object.values(content.register.roles).some(Boolean);

  return (
    <>
      <ThemeStyle theme={page.theme} />
      <PortalShell page={page} base={base}>
        <div className="mx-auto w-full max-w-md px-4 py-12">
          {branding.loginBanner && (
            <p role="status" className="mb-4 rounded-xl bg-brand px-4 py-3 text-center text-[15px] font-medium text-on-brand">
              {branding.loginBanner}
            </p>
          )}
          <div className="rounded-2xl border border-line bg-surface p-8 shadow-card">
            <div className="flex flex-col items-center text-center">
              <SchoolMark branding={branding} size="size-16" />
              <h1 className="mt-4 text-2xl font-bold text-ink">{content.signIn.heading}</h1>
              {content.signIn.intro && <p className="mt-2 text-[16px] text-muted">{content.signIn.intro}</p>}
              {branding.welcomeMessage && <p className="mt-3 text-[16px] text-ink">{branding.welcomeMessage}</p>}
            </div>
            <SignInForm />
          </div>
          {canRegister && (
            <p className="mt-6 text-center text-sm text-muted">
              New here? <Link href={`${base}/register`} className="font-medium text-brand underline">Create an account</Link>
            </p>
          )}
          {content.signIn.helpText && <p className="mt-3 text-center text-sm text-muted">{content.signIn.helpText}</p>}
        </div>
      </PortalShell>
    </>
  );
}
