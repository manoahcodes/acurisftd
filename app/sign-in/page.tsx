import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { ThemeStyle } from "@/components/platform/theme/theme-style";
import { SignInForm } from "@/components/auth/sign-in-form";
import { themes } from "@/server/repositories";

export const metadata: Metadata = { title: "Sign in" };

// Reads the saved branding on every visit, so changes show without a rebuild.
export default function SignInPage() {
  return (
    <Suspense fallback={<main className="min-h-dvh bg-canvas" />}>
      <SignIn />
    </Suspense>
  );
}

async function SignIn() {
  await connection();
  const { theme, branding } = await themes.getPlatformDefault();

  return (
    <>
      <ThemeStyle theme={theme} />
      <main className="grid min-h-dvh place-items-center bg-canvas px-4 py-10">
        <div className="w-full max-w-md">
          {branding.loginBanner && (
            <p role="status" className="mb-4 rounded-xl bg-brand px-4 py-3 text-center text-[15px] font-medium text-on-brand">
              {branding.loginBanner}
            </p>
          )}
          <div className="rounded-2xl border border-line bg-surface p-8 shadow-card">
            <div className="flex flex-col items-center text-center">
              {branding.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- the logo is a stored data URL
                <img src={branding.logoUrl} alt="" className="size-16 rounded-xl bg-white object-contain p-1" />
              ) : (
                <span aria-hidden className="grid size-16 place-items-center rounded-xl bg-brand text-xl font-bold text-on-brand">
                  {branding.shortName.slice(0, 2).toUpperCase()}
                </span>
              )}
              <h1 className="mt-4 text-2xl font-bold text-ink">{branding.name}</h1>
              {branding.tagline && <p className="mt-1 text-sm text-muted">{branding.tagline}</p>}
              {branding.welcomeMessage && <p className="mt-4 text-[16px] text-ink">{branding.welcomeMessage}</p>}
            </div>
            <SignInForm />
          </div>
          <p className="mt-6 text-center text-sm text-muted">
            {branding.email || branding.phone ? `Need help? ${[branding.email, branding.phone].filter(Boolean).join(" · ")}` : null}
          </p>
        </div>
      </main>
    </>
  );
}
