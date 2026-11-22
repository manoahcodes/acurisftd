import Link from "next/link";
import { SignInForm } from "@/components/auth/sign-in-form";
import type { PortalView } from "@/types/portal";
import { PortalRegisterForm } from "./portal-register-form";
import { PortalAuthLayout, canRegister } from "./portal-shell";

/** The sign-in page body. Shared by the live page and the editor's preview, so they never drift apart. */
export function PortalSignInView({ page, base }: { page: PortalView; base: string }) {
  const { content } = page;
  return (
    <PortalAuthLayout page={page} base={base} heading={content.signIn.heading} intro={content.signIn.intro} image={content.signInImage}>
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
  );
}

/** The register page body, shared the same way. */
export function PortalRegisterView({ page, base }: { page: PortalView; base: string }) {
  const { content, branding } = page;
  return (
    <PortalAuthLayout page={page} base={base} heading={content.register.heading} intro={content.register.intro} statement={`Join ${branding.name}.`} image={content.registerImage} wide>
      <PortalRegisterForm roles={content.register.roles} base={base} />
    </PortalAuthLayout>
  );
}
