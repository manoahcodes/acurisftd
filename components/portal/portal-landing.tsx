import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { externalHref } from "@/lib/portal/links";
import type { PortalPageData } from "@/server/queries/portal";
import { ExternalLink } from "./portal-shell";
import { PortalIconView } from "./portal-icon";

/** The school's public landing page. Colours come from the school's theme; every school-website link is external. */
export function PortalLanding({ page, base }: { page: PortalPageData; base: string }) {
  const { branding, content } = page;
  const { hero, about, features } = content;
  const site = content.websiteUrl;
  return (
    <>
      <section className="bg-navy text-white">
        <div className="mx-auto flex max-w-4xl flex-col items-center px-5 py-24 text-center sm:py-32">
          {hero.eyebrow && <p className="text-xs font-bold uppercase tracking-[0.3em] text-accent">{hero.eyebrow} {branding.name}</p>}
          <h1 className="mt-6 text-4xl font-extrabold leading-tight sm:text-6xl">{hero.heading}</h1>
          {hero.body && <p className="mt-6 max-w-2xl text-lg text-white/85">{hero.body}</p>}
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            {hero.primaryLabel && (
              <ExternalLink website={site} path={hero.primaryPath} className="inline-flex items-center gap-2 rounded-lg bg-brand px-6 py-3 font-semibold text-on-brand hover:opacity-90">
                {hero.primaryLabel} <ArrowRight aria-hidden className="size-4" />
              </ExternalLink>
            )}
            {hero.secondaryLabel && (
              <ExternalLink website={site} path={hero.secondaryPath} className="inline-flex items-center rounded-lg border border-white/25 bg-white/10 px-6 py-3 font-semibold hover:bg-white/15">
                {hero.secondaryLabel}
              </ExternalLink>
            )}
            {/* The portal's own entry point is always there, even when the school has no website set. */}
            {!site && (
              <Link href={`${base}/sign-in`} className="inline-flex items-center gap-2 rounded-lg bg-brand px-6 py-3 font-semibold text-on-brand hover:opacity-90">
                Sign in to the portal <ArrowRight aria-hidden className="size-4" />
              </Link>
            )}
          </div>
        </div>
      </section>

      <section className="bg-surface">
        <div className="mx-auto grid max-w-6xl gap-12 px-5 py-20 lg:grid-cols-2 lg:items-center">
          <div>
            {about.eyebrow && <p className="text-xs font-bold uppercase tracking-[0.25em] text-brand">{about.eyebrow} {branding.name}</p>}
            {about.heading && <h2 className="mt-4 text-3xl font-bold leading-tight text-ink sm:text-4xl">{about.heading}</h2>}
            {about.body && <p className="mt-5 text-[17px] leading-relaxed text-muted">{about.body}</p>}
            {about.linkLabel && (
              <ExternalLink website={site} path={about.linkPath} className="mt-6 inline-flex items-center gap-2 font-semibold text-brand hover:underline">
                {about.linkLabel} <ArrowRight aria-hidden className="size-4" />
              </ExternalLink>
            )}
          </div>
          <ul className="grid gap-4 sm:grid-cols-2">
            {features.map((f) => {
              const inner = (
                <>
                  <PortalIconView name={f.icon} className="size-7 text-brand" />
                  <h3 className="mt-5 text-lg font-bold text-ink">{f.title}</h3>
                  {f.body && <p className="mt-2 text-sm leading-relaxed text-muted">{f.body}</p>}
                </>
              );
              const card = "block h-full rounded-2xl bg-canvas p-6";
              return (
                <li key={f.title}>
                  {f.path && externalHref(site, f.path) ? (
                    <ExternalLink website={site} path={f.path} className={`${card} transition hover:shadow-card hover:ring-1 hover:ring-brand`}>
                      {inner}
                    </ExternalLink>
                  ) : (
                    <div className={card}>{inner}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </section>
    </>
  );
}
