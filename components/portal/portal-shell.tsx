import Link from "next/link";
import { ArrowLeft, ArrowRight, LogIn, Menu, Globe } from "lucide-react";
import { CopyrightYear } from "@/components/shell/copyright-year";
import { externalHref } from "@/lib/portal/links";
import { ACURIS_COPYRIGHT_TEXT, copyrightHolderFor } from "@/lib/theme/copyright";
import { overlayStyle } from "@/lib/portal/overlay";
import { panelColours } from "@/lib/portal/panel";
import type { PortalOverlay, PortalPanel, PortalView } from "@/types/portal";

type Branding = PortalView["branding"];

/** `light` is for a brand-coloured background, where the usual brand-coloured circle would disappear. */
export function SchoolMark({ branding, size = "size-11", light = false }: { branding: Branding; size?: string; light?: boolean }) {
  return branding.logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element -- the logo is a stored data URL
    <img src={branding.logoUrl} alt="" className={`${size} shrink-0 rounded-full bg-white object-contain p-1`} />
  ) : (
    <span aria-hidden className={`${size} grid shrink-0 place-items-center rounded-full text-sm font-bold ${light ? "bg-white text-neutral-900" : "bg-brand text-on-brand"}`}>
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

const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";
export const canRegister = (page: PortalView) => Object.values(page.content.register.roles).some(Boolean);

/**
 * Header and footer for the school's landing page.
 * `base` is where the portal lives: "" on the school's own subdomain, "/s/<school>"
 * when reached by path (local development).
 */
export function PortalShell({ page, base, children }: { page: PortalView; base: string; children: React.ReactNode }) {
  const { branding, content } = page;
  const links = content.nav.filter((l) => externalHref(content.websiteUrl, l.path));
  const actions = (
    <>
      <Link href={`${base}/sign-in`} className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 ${focus}`}>
        <LogIn aria-hidden className="size-4" /> Sign in
      </Link>
      {canRegister(page) && (
        <Link href={`${base}/register`} className={`inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-on-brand hover:opacity-90 ${focus}`}>
          Apply with us <ArrowRight aria-hidden className="size-4" />
        </Link>
      )}
    </>
  );

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-navy/95 text-white backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-5 py-3">
          <Link href={`${base}/`} className={`flex min-w-0 items-center gap-3 rounded-lg ${focus}`}>
            <SchoolMark branding={branding} />
            <span className="min-w-0">
              <span className="block truncate text-[17px] font-semibold leading-tight tracking-tight">{branding.name}</span>
              {branding.tagline && <span className="hidden truncate text-xs text-white/65 sm:block">{branding.tagline}</span>}
            </span>
          </Link>
          <nav aria-label="School website" className="ml-auto hidden items-center gap-1 text-sm text-white/80 md:flex">
            {links.map((l) => (
              <ExternalLink key={l.label} website={content.websiteUrl} path={l.path} className={`rounded-md px-3 py-2 hover:bg-white/10 hover:text-white ${focus}`}>
                {l.label}
              </ExternalLink>
            ))}
          </nav>
          <div className={`hidden items-center gap-2 md:flex ${links.length ? "" : "ml-auto"}`}>{actions}</div>

          {/* Phones: one menu holds the website links and the portal actions. */}
          <details className="group relative ml-auto md:hidden">
            <summary aria-label="Menu" className={`grid size-10 cursor-pointer list-none place-items-center rounded-lg hover:bg-white/10 [&::-webkit-details-marker]:hidden ${focus}`}>
              <Menu aria-hidden className="size-5" />
            </summary>
            <div className="absolute right-0 mt-2 w-64 space-y-1 rounded-xl border border-white/10 bg-navy p-3 shadow-xl">
              {links.map((l) => (
                <ExternalLink key={l.label} website={content.websiteUrl} path={l.path} className="block rounded-md px-3 py-2 text-sm text-white/85 hover:bg-white/10">
                  {l.label}
                </ExternalLink>
              ))}
              <div className="flex flex-col gap-2 border-t border-white/10 pt-3">{actions}</div>
            </div>
          </details>
        </div>
      </header>

      <div className="flex-1">{children}</div>

      <footer className="bg-navy text-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-3">
              <SchoolMark branding={branding} />
              <p className="text-lg font-semibold tracking-tight">{branding.name}</p>
            </div>
            {(content.footerNote || branding.tagline) && <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/70">{content.footerNote || branding.tagline}</p>}
          </div>
          <nav aria-label="Footer" className="text-sm">
            <p className="font-semibold">Explore</p>
            <ul className="mt-3 space-y-2 text-white/70">
              {links.map((l) => (
                <li key={l.label}>
                  <ExternalLink website={content.websiteUrl} path={l.path} className="hover:text-white hover:underline">{l.label}</ExternalLink>
                </li>
              ))}
              <li><Link href={`${base}/sign-in`} className="hover:text-white hover:underline">Sign in</Link></li>
              {canRegister(page) && <li><Link href={`${base}/register`} className="hover:text-white hover:underline">Register</Link></li>}
            </ul>
          </nav>
          {(branding.email || branding.phone || branding.address) && (
            <div className="text-sm">
              <p className="font-semibold">Contact</p>
              <ul className="mt-3 space-y-2 text-white/70">
                {branding.email && <li><a href={`mailto:${branding.email}`} className="hover:text-white hover:underline">{branding.email}</a></li>}
                {branding.phone && <li><a href={`tel:${branding.phone.replace(/[^+\d]/g, "")}`} className="hover:text-white hover:underline">{branding.phone}</a></li>}
                {branding.address && <li className="whitespace-pre-line">{branding.address}</li>}
              </ul>
            </div>
          )}
        </div>
        <div className="border-t border-white/10">
          <p className="mx-auto max-w-6xl px-5 py-5 text-xs text-white/55">
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

/**
 * Split layout for sign-in and register: the school's brand on the left,
 * the form on the right. No header or footer, so nothing competes with the form.
 */
export function PortalAuthLayout({
  page, base, heading, intro, statement, image, overlay, panel, wide, children,
}: { page: PortalView; base: string; heading: string; intro?: string; statement?: string; image?: string; overlay?: PortalOverlay; panel?: PortalPanel; wide?: boolean; children: React.ReactNode }) {
  const { branding, content } = page;
  const site = externalHref(content.websiteUrl, "/");
  const colours = panelColours(panel);
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside style={{ backgroundColor: colours.background, color: colours.text }} className="relative isolate flex flex-col justify-between gap-12 overflow-hidden px-8 py-10 sm:px-12 lg:py-14">
        {image && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- stored data URL */}
            <img src={image} alt="" className="absolute inset-0 -z-20 size-full object-cover" />
            {/* The school's overlay keeps the white text readable on the photo. */}
            <div aria-hidden className="absolute inset-0 -z-10" style={overlayStyle(overlay)} />
          </>
        )}
        {/* Soft glow and a faint grid: decoration only, switched on or off per school. */}
        {colours.glowOn && <div aria-hidden style={{ backgroundColor: colours.glow }} className="pointer-events-none absolute -right-32 -top-32 -z-10 size-[28rem] rounded-full opacity-25 blur-3xl" />}
        {colours.gridOn && <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 opacity-[0.07] [background-image:linear-gradient(currentColor_1px,transparent_1px),linear-gradient(90deg,currentColor_1px,transparent_1px)] [background-size:48px_48px]" />}
        <Link href={`${base}/`} className={`flex w-fit items-center gap-3 rounded-lg ${focus}`}>
          <SchoolMark branding={branding} size="size-12" light={panel?.color === "brand"} />
          <span className="text-lg font-semibold tracking-tight">{branding.name}</span>
        </Link>
        <div className="max-w-md">
          <p className="text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">{statement || branding.welcomeMessage || branding.name}</p>
          {branding.tagline && <p className="mt-5 text-lg opacity-80">{branding.tagline}</p>}
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <Link href={`${base}/`} className="inline-flex items-center gap-2 opacity-80 hover:opacity-100"><ArrowLeft aria-hidden className="size-4" /> Back to home</Link>
          {site && (
            <a href={site} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 opacity-80 hover:opacity-100">
              <Globe aria-hidden className="size-4" /> School website
            </a>
          )}
        </div>
      </aside>

      <main className="flex flex-col justify-center bg-canvas px-6 py-12 sm:px-12">
        <div className={`mx-auto w-full ${wide ? "max-w-xl" : "max-w-md"}`}>
          {branding.loginBanner && (
            <p role="status" className="mb-6 rounded-xl bg-brand px-4 py-3 text-center text-[15px] font-medium text-on-brand">{branding.loginBanner}</p>
          )}
          <h1 className="text-3xl font-semibold tracking-tight text-ink">{heading}</h1>
          {intro && <p className="mt-2 text-[16px] leading-relaxed text-muted">{intro}</p>}
          <div className="mt-8">{children}</div>
          <p className="mt-10 text-xs text-muted">
            {copyrightHolderFor(branding) ? (
              <>© <CopyrightYear timeZone={branding.timezone} /> {copyrightHolderFor(branding)}. </>
            ) : null}
            {ACURIS_COPYRIGHT_TEXT}
          </p>
        </div>
      </main>
    </div>
  );
}
