import Link from "next/link";
import { ArrowRight, ChevronRight, LogIn, Mail, MapPin, Phone, UserPlus } from "lucide-react";
import { externalHref } from "@/lib/portal/links";
import type { PortalView } from "@/types/portal";
import { ExternalLink, canRegister } from "./portal-shell";
import { PortalIconView } from "./portal-icon";
import { PortalHeroSlider } from "./portal-hero-slider";

const tint = "bg-[color-mix(in_srgb,var(--color-brand)_12%,var(--color-surface))]";
const btnFocus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

/** The school's public landing page. Colours come from the school's theme; every school-website link is external. */
export function PortalLanding({ page, base }: { page: PortalView; base: string }) {
  const { branding, content } = page;
  const { hero, about } = content;
  const site = content.websiteUrl;
  const features = content.features;
  const hasContact = !!(branding.email || branding.phone || branding.address);

  const access = [
    { href: `${base}/sign-in`, icon: LogIn, title: "Sign in", body: "Students, staff, parents and guardians." },
    ...(canRegister(page) ? [{ href: `${base}/register`, icon: UserPlus, title: "Apply or register", body: "Start an application or use an invite code." }] : []),
  ];

  const accessPanel = (
      <div className="rounded-2xl bg-surface p-3 text-ink shadow-2xl ring-1 ring-white/10">
        <p className="px-4 pb-2 pt-3 text-sm font-semibold text-muted">Student and staff portal</p>
        <ul>
          {access.map((a, i) => (
            <li key={a.title} className={i ? "border-t border-line" : ""}>
              <Link href={a.href} className="group flex items-center gap-4 rounded-xl px-4 py-4 hover:bg-canvas focus-visible:outline-2 focus-visible:outline-brand">
                <span className={`grid size-11 shrink-0 place-items-center rounded-xl text-brand ${tint}`}><a.icon aria-hidden className="size-5" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{a.title}</span>
                  <span className="block text-sm text-muted">{a.body}</span>
                </span>
                <ChevronRight aria-hidden className="size-5 text-muted transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
              </Link>
            </li>
          ))}
        </ul>
        {branding.email && (
          <p className="border-t border-line px-4 pb-2 pt-4 text-sm text-muted">
            Need help? <a href={`mailto:${branding.email}`} className="font-medium text-brand hover:underline">{branding.email}</a>
          </p>
        )}
      </div>
  );

  return (
    <>
      {content.slides.length > 0 ? (
        <PortalHeroSlider slides={content.slides} eyebrow={hero.eyebrow} schoolName={branding.name} website={site}>
          {accessPanel}
        </PortalHeroSlider>
      ) : (
      <section className="relative isolate overflow-hidden bg-navy text-white">
        {content.heroImage && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- stored data URL */}
            <img src={content.heroImage} alt="" className="absolute inset-0 -z-20 size-full object-cover" />
            {/* Dark wash so the headline stays readable on any photo. */}
            <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-r from-navy via-navy/85 to-navy/55" />
          </>
        )}
        <div aria-hidden className="pointer-events-none absolute -right-40 -top-40 -z-10 size-[38rem] rounded-full bg-brand opacity-25 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 opacity-[0.06] [background-image:linear-gradient(white_1px,transparent_1px),linear-gradient(90deg,white_1px,transparent_1px)] [background-size:56px_56px]" />
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-20 sm:py-28 lg:grid-cols-[1.35fr_1fr]">
          <div>
            {hero.eyebrow && <p className="text-base font-medium text-accent">{hero.eyebrow} {branding.name}</p>}
            <h1 className="mt-4 text-balance text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">{hero.heading}</h1>
            {hero.body && <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/80">{hero.body}</p>}
            <div className="mt-9 flex flex-wrap gap-3">
              {hero.primaryLabel && (
                <ExternalLink website={site} path={hero.primaryPath} className={`inline-flex items-center gap-2 rounded-lg bg-brand px-6 py-3 font-semibold text-on-brand hover:opacity-90 ${btnFocus}`}>
                  {hero.primaryLabel} <ArrowRight aria-hidden className="size-4" />
                </ExternalLink>
              )}
              {hero.secondaryLabel && (
                <ExternalLink website={site} path={hero.secondaryPath} className={`inline-flex items-center rounded-lg border border-white/25 px-6 py-3 font-semibold hover:bg-white/10 ${btnFocus}`}>
                  {hero.secondaryLabel}
                </ExternalLink>
              )}
            </div>
          </div>

          {accessPanel}
        </div>
      </section>
      )}

      {(about.heading || features.length > 0) && (
        <section className="bg-surface">
          <div className="mx-auto grid max-w-6xl gap-14 px-5 py-20 sm:py-24 lg:grid-cols-[1fr_1.15fr]">
            <div className="max-w-lg">
              {about.eyebrow && <p className="text-base font-medium text-brand">{about.eyebrow} {branding.name}</p>}
              {about.heading && <h2 className="mt-3 text-balance text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-4xl">{about.heading}</h2>}
              {about.body && <p className="mt-5 text-[17px] leading-relaxed text-muted">{about.body}</p>}
              {about.linkLabel && (
                <ExternalLink website={site} path={about.linkPath} className="mt-7 inline-flex items-center gap-2 font-semibold text-brand hover:underline focus-visible:outline-2 focus-visible:outline-brand">
                  {about.linkLabel} <ArrowRight aria-hidden className="size-4" />
                </ExternalLink>
              )}
              {content.aboutImage && (
                // eslint-disable-next-line @next/next/no-img-element -- stored data URL
                <img src={content.aboutImage} alt="" className="mt-10 aspect-[4/3] w-full rounded-2xl object-cover shadow-card" />
              )}
            </div>
            <ul className="grid gap-x-10 sm:grid-cols-2">
              {features.map((f) => {
                const linked = f.path && externalHref(site, f.path);
                const inner = (
                  <>
                    <span className={`grid size-11 place-items-center rounded-xl text-brand ${tint}`}><PortalIconView name={f.icon} className="size-5" /></span>
                    <h3 className="mt-4 flex items-center gap-1.5 text-lg font-semibold text-ink">
                      {f.title}
                      {linked && <ArrowRight aria-hidden className="size-4 text-brand transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />}
                    </h3>
                    {f.body && <p className="mt-1.5 text-[15px] leading-relaxed text-muted">{f.body}</p>}
                  </>
                );
                const cell = "group block border-t border-line py-7";
                return (
                  <li key={f.title}>
                    {linked ? (
                      <ExternalLink website={site} path={f.path} className={`${cell} focus-visible:outline-2 focus-visible:outline-brand`}>{inner}</ExternalLink>
                    ) : (
                      <div className={cell}>{inner}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      )}

      {hasContact && (
        <section aria-label="Contact" className="border-t border-line bg-canvas">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-12 gap-y-5 px-5 py-10 text-[15px] text-ink">
            <p className="text-lg font-semibold">Get in touch</p>
            {branding.phone && <a href={`tel:${branding.phone.replace(/[^+\d]/g, "")}`} className="inline-flex items-center gap-2 hover:text-brand"><Phone aria-hidden className="size-4 text-brand" />{branding.phone}</a>}
            {branding.email && <a href={`mailto:${branding.email}`} className="inline-flex items-center gap-2 hover:text-brand"><Mail aria-hidden className="size-4 text-brand" />{branding.email}</a>}
            {branding.address && <span className="inline-flex items-center gap-2"><MapPin aria-hidden className="size-4 text-brand" />{branding.address}</span>}
          </div>
        </section>
      )}
    </>
  );
}
