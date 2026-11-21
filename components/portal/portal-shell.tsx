import Link from "next/link";
import { ArrowRight, LogIn } from "lucide-react";
import { CopyrightYear } from "@/components/shell/copyright-year";
import { externalHref } from "@/lib/portal/links";
import { ACURIS_COPYRIGHT_TEXT, copyrightHolderFor } from "@/lib/theme/copyright";
import type { PortalPageData } from "@/server/queries/portal";

export function SchoolMark({ branding, size = "size-12" }: { branding: PortalPageData["branding"]; size?: string }) {
  return branding.logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element -- the logo is a stored data URL
    <img src={branding.logoUrl} alt="" className={`${size} shrink-0 rounded-full bg-white object-contain p-1`} />
  ) : (
    <span aria-hidden className={`${size} grid shrink-0 place-items-center rounded-full bg-brand text-sm font-bold text-on-brand`}>
      {branding.shortName.slice(0, 2).toUpperCase()}
    </span>
  );
}

/** A link to the school's official website. Opens in a new tab; renders nothing when the school has no website set. */
export function ExternalLink({ website, path, className, children }: { website: string; path: string; className?: string; children: React.ReactNode }) {
  const href = externalHref(website, path);
  if (!href) return null;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
    </a>
  );
}

/**
 * Header and footer shared by the school's landing, sign-in and register pages.
 * `base` is where the portal lives: "" on the school's own subdomain, "/s/<school>"
 * when reached by path (local development).
 */
export function PortalShell({ page, base, children }: { page: PortalPageData; base: string; children: React.ReactNode }) {
  const { branding, content } = page;
  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="bg-navy text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-4">
          <Link href={`${base}/`} className="flex min-w-0 items-center gap-3">
            <SchoolMark branding={branding} />
            <span className="min-w-0">
              <span className="block truncate text-lg font-bold leading-tight">{branding.name}</span>
              {branding.tagline && <span className="block truncate text-xs uppercase tracking-widest text-white/70">{branding.tagline}</span>}
            </span>
          </Link>
          <nav aria-label="School website" className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-white/85">
            {content.nav.map((l) => (
              <ExternalLink key={l.label} website={content.websiteUrl} path={l.path} className="hover:text-white hover:underline">
                {l.label}
              </ExternalLink>
            ))}
          </nav>
        </div>
        <div className="border-t border-white/10">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-5 py-3">
            <Link href={`${base}/sign-in`} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold hover:bg-white/10">
              <LogIn aria-hidden className="size-4" /> Sign in
            </Link>
            {(content.register.roles.applicant || content.register.roles.staff || content.register.roles.parent) && (
              <Link href={`${base}/register`} className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-on-brand hover:opacity-90">
                Apply with us <ArrowRight aria-hidden className="size-4" />
              </Link>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1">{children}</div>

      <footer className="bg-navy text-white">
        <div className="mx-auto max-w-6xl px-5 py-10">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="text-lg font-bold">{branding.name}</p>
              {(content.footerNote || branding.tagline) && <p className="mt-1 text-sm text-white/70">{content.footerNote || branding.tagline}</p>}
              {(branding.email || branding.phone) && (
                <p className="mt-3 text-sm text-white/70">{[branding.email, branding.phone].filter(Boolean).join(" · ")}</p>
              )}
            </div>
            <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-white/85">
              {content.nav.map((l) => (
                <ExternalLink key={l.label} website={content.websiteUrl} path={l.path} className="hover:text-white hover:underline">
                  {l.label}
                </ExternalLink>
              ))}
              <Link href={`${base}/sign-in`} className="hover:text-white hover:underline">Sign in</Link>
            </nav>
          </div>
          <p className="mt-8 border-t border-white/10 pt-5 text-xs text-white/60">
            {copyrightHolderFor(branding) ? (
              <>© <CopyrightYear timeZone={branding.timezone} /> {copyrightHolderFor(branding)}. All rights reserved. </>
            ) : null}
            {ACURIS_COPYRIGHT_TEXT}
          </p>
        </div>
      </footer>
    </div>
  );
}
