"use client";

import { useEffect, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { externalHref } from "@/lib/portal/links";
import { cn } from "@/lib/format";
import type { PortalSlide } from "@/types/portal";

const SECONDS = 6;
const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

/**
 * The hero when the school has slides: photos crossfade behind the text, with
 * previous/next buttons and dots. Autoplay pauses on hover and keyboard focus
 * and never runs for visitors who prefer reduced motion. `children` is the
 * portal-access panel, drawn on the right.
 */
export function PortalHeroSlider({
  slides, eyebrow, schoolName, website, children,
}: { slides: PortalSlide[]; eyebrow: string; schoolName: string; website: string; children: React.ReactNode }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(true); // assume reduced until we know: no motion by default
  const count = slides.length;
  const current = Math.min(index, count - 1);
  const slide = slides[current];

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (count < 2 || paused || reduced) return;
    const t = setTimeout(() => setIndex((i) => (i + 1) % count), SECONDS * 1000);
    return () => clearTimeout(t);
  }, [count, current, paused, reduced]);

  const go = (n: number) => setIndex(((n % count) + count) % count);
  const cta = slide.ctaLabel ? externalHref(website, slide.ctaPath) : undefined;

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Highlights"
      className="relative isolate overflow-hidden bg-navy text-white"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {slides.map((s, n) => (
        // eslint-disable-next-line @next/next/no-img-element -- stored data URL
        <img
          key={n}
          src={s.image}
          alt=""
          className={cn("absolute inset-0 -z-20 size-full object-cover transition-opacity duration-1000 motion-reduce:transition-none", n === current ? "opacity-100" : "opacity-0")}
        />
      ))}
      <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-r from-navy via-navy/85 to-navy/55" />

      <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-28 pt-20 sm:pt-28 lg:grid-cols-[1.35fr_1fr]">
        <div aria-live={paused || reduced ? "polite" : "off"} aria-atomic="true" role="group" aria-roledescription="slide" aria-label={`${current + 1} of ${count}`}>
          {eyebrow && <p className="text-base font-medium text-accent">{eyebrow} {schoolName}</p>}
          <h1 className="mt-4 text-balance text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">{slide.heading}</h1>
          {slide.body && <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/80">{slide.body}</p>}
          {cta && (
            <a href={cta} target="_blank" rel="noopener noreferrer" className={`mt-9 inline-flex items-center gap-2 rounded-lg bg-brand px-6 py-3 font-semibold text-on-brand hover:opacity-90 ${focus}`}>
              {slide.ctaLabel} <ArrowRight aria-hidden className="size-4" />
            </a>
          )}
        </div>
        {children}
      </div>

      {count > 1 && (
        <div className="absolute inset-x-0 bottom-0">
          <div className="mx-auto flex max-w-6xl items-center gap-4 px-5 pb-8">
            <button type="button" aria-label="Previous slide" onClick={() => go(current - 1)} className={`grid size-10 place-items-center rounded-full border border-white/30 hover:bg-white/10 ${focus}`}>
              <ChevronLeft aria-hidden className="size-5" />
            </button>
            <button type="button" aria-label="Next slide" onClick={() => go(current + 1)} className={`grid size-10 place-items-center rounded-full border border-white/30 hover:bg-white/10 ${focus}`}>
              <ChevronRight aria-hidden className="size-5" />
            </button>
            <div className="flex items-center gap-2">
              {slides.map((_, n) => (
                <button
                  key={n}
                  type="button"
                  aria-label={`Go to slide ${n + 1}`}
                  aria-current={n === current}
                  onClick={() => go(n)}
                  className={cn("h-2 rounded-full transition-all motion-reduce:transition-none", focus, n === current ? "w-8 bg-brand" : "w-2 bg-white/50 hover:bg-white/80")}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
