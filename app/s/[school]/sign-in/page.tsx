import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { SignInForm } from "@/components/auth/sign-in-form";
import { ThemeStyle } from "@/components/platform/theme/theme-style";
import { PortalAuthLayout, canRegister } from "@/components/portal/portal-shell";
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
  const { content } = page;

  return (
    <>
      <ThemeStyle theme={page.theme} />
      <PortalAuthLayout page={page} base={base} heading={content.signIn.heading} intro={content.signIn.intro}>
        <div className="rounded-2xl border border-line bg-surface p-6 shadow-card sm:p-8 [&>form]:mt-0">
          <SignInForm />
        </div>
        {canRegister(page) && (
          <p className="mt-6 text-sm text-muted">
            New here? <Link href={`${base}/register`} className="font-medium text-brand underline">Create an account</Link>
          </p>
        )}
        {content.signIn.helpText && <p className="mt-3 text-sm text-muted">{content.signIn.helpText}</p>}
      </PortalAuthLayout>
    </>
  );
}
