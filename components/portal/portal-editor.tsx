"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, useTransition } from "react";
import { ExternalLink as ExternalIcon, Plus, Trash2 } from "lucide-react";
import { PORTAL_ICONS } from "@/lib/portal/icons";
import { MAX_FEATURES, MAX_NAV } from "@/lib/portal/validate";
import { resetPortal, savePortal } from "@/server/actions/portal";
import type { PortalContent, PortalFeature, PortalFormState, PortalLink } from "@/types/portal";

const IDLE: PortalFormState = { ok: false };
const input =
  "h-11 w-full rounded-lg border border-line bg-surface px-3 text-[15px] text-ink placeholder:text-muted focus-visible:outline-2 focus-visible:outline-brand aria-[invalid=true]:border-danger";
const area = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-[15px] text-ink placeholder:text-muted focus-visible:outline-2 focus-visible:outline-brand aria-[invalid=true]:border-danger";
const card = "rounded-2xl border border-line bg-surface p-5 shadow-card";

type Props = {
  scopeLabel: string;
  isTenant: boolean;
  area: "platform" | "school";
  inherited: boolean;
  /** The open school's id, for the "view live pages" links. */
  schoolId?: string;
  content: PortalContent;
};

function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-ink">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-muted">{hint}</span>}
      {error && <span role="alert" className="mt-1 block text-xs text-danger">{error}</span>}
    </label>
  );
}

/** Edits the words and links on a school's landing, sign-in and register pages. */
export function PortalEditor({ scopeLabel, isTenant, area: areaKey, inherited, schoolId, content: initial }: Props) {
  const [c, setC] = useState<PortalContent>(initial);
  const [saved, save, saving] = useActionState(savePortal, IDLE);
  const [resetState, reset, resetting] = useActionState(resetPortal, IDLE);
  const router = useRouter();
  const [, startRefresh] = useTransition();
  useEffect(() => {
    if (saved.ok || resetState.ok) startRefresh(() => router.refresh());
  }, [saved, resetState, router]);

  const err = (k: string) => saved.errors?.[k];
  const set = <K extends keyof PortalContent>(k: K, v: PortalContent[K]) => setC((p) => ({ ...p, [k]: v }));
  const setIn = <K extends "hero" | "about" | "signIn" | "register">(k: K, v: Partial<PortalContent[K]>) =>
    setC((p) => ({ ...p, [k]: { ...p[k], ...v } }));
  const setNav = (i: number, v: Partial<PortalLink>) => set("nav", c.nav.map((l, n) => (n === i ? { ...l, ...v } : l)));
  const setFeature = (i: number, v: Partial<PortalFeature>) => set("features", c.features.map((f, n) => (n === i ? { ...f, ...v } : f)));
  const roles = c.register.roles;

  const base = schoolId ? `/s/${schoolId}` : undefined;

  return (
    <section aria-labelledby="portal-h" className="mt-10 space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="portal-h" className="text-xl font-bold text-ink">Portal pages</h2>
          <p className="mt-1 text-sm text-muted">
            The landing, sign-in and register pages people see before they sign in.{" "}
            {isTenant
              ? inherited ? `${scopeLabel} uses the platform default.` : `${scopeLabel} has its own changes.`
              : "Every school starts from this default."}
          </p>
        </div>
        {base && (
          <div className="flex gap-3 text-sm font-medium text-brand">
            {[["Landing", base], ["Sign in", `${base}/sign-in`], ["Register", `${base}/register`]].map(([l, h]) => (
              <Link key={l} href={h} target="_blank" className="inline-flex items-center gap-1 hover:underline">
                {l} <ExternalIcon aria-hidden className="size-3.5" />
              </Link>
            ))}
          </div>
        )}
      </div>

      <form action={save} className="space-y-5">
        <input type="hidden" name="area" value={areaKey} />
        <input type="hidden" name="payload" value={JSON.stringify(c)} />

        <div className={card}>
          <h3 className="font-semibold text-ink">School website</h3>
          <p className="mb-3 text-sm text-muted">The portal is only the sign-in side. Academics, Admissions, About and similar links open this website in a new tab. Leave it empty to hide them.</p>
          <Field label="Official website" error={err("websiteUrl")} hint="For example https://www.woodlands.edu">
            <input value={c.websiteUrl} onChange={(e) => set("websiteUrl", e.target.value)} inputMode="url" placeholder="https://www.school.edu" aria-invalid={!!err("websiteUrl")} className={input} />
          </Field>
          <div className="mt-5 space-y-3">
            <p className="text-sm font-medium text-ink">Header and footer links</p>
            {err("nav") && <p role="alert" className="text-xs text-danger">{err("nav")}</p>}
            {c.nav.map((l, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <Field label="Name" error={err(`nav.${i}.label`)}>
                  <input value={l.label} onChange={(e) => setNav(i, { label: e.target.value })} aria-invalid={!!err(`nav.${i}.label`)} className={input} />
                </Field>
                <Field label="Page on the website" error={err(`nav.${i}.path`)}>
                  <input value={l.path} onChange={(e) => setNav(i, { path: e.target.value })} aria-invalid={!!err(`nav.${i}.path`)} className={input} />
                </Field>
                <button type="button" aria-label={`Remove ${l.label || "link"}`} onClick={() => set("nav", c.nav.filter((_, n) => n !== i))} className="mt-6 grid size-11 place-items-center rounded-lg border border-line text-muted hover:text-danger">
                  <Trash2 aria-hidden className="size-4" />
                </button>
              </div>
            ))}
            {c.nav.length < MAX_NAV && (
              <button type="button" onClick={() => set("nav", [...c.nav, { label: "", path: "" }])} className="inline-flex items-center gap-1 text-sm font-medium text-brand">
                <Plus aria-hidden className="size-4" /> Add link
              </button>
            )}
          </div>
        </div>

        <div className={card}>
          <h3 className="mb-3 font-semibold text-ink">Landing page: top banner</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Small heading (school name follows)" error={err("hero.eyebrow")}>
              <input value={c.hero.eyebrow} onChange={(e) => setIn("hero", { eyebrow: e.target.value })} className={input} />
            </Field>
            <Field label="Heading" error={err("hero.heading")}>
              <input value={c.hero.heading} onChange={(e) => setIn("hero", { heading: e.target.value })} aria-invalid={!!err("hero.heading")} className={input} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Text" error={err("hero.body")}>
                <textarea rows={2} value={c.hero.body} onChange={(e) => setIn("hero", { body: e.target.value })} className={area} />
              </Field>
            </div>
            <Field label="Main button" error={err("hero.primaryLabel")}>
              <input value={c.hero.primaryLabel} onChange={(e) => setIn("hero", { primaryLabel: e.target.value })} className={input} />
            </Field>
            <Field label="Main button goes to" error={err("hero.primaryPath")}>
              <input value={c.hero.primaryPath} onChange={(e) => setIn("hero", { primaryPath: e.target.value })} aria-invalid={!!err("hero.primaryPath")} className={input} />
            </Field>
            <Field label="Second button" error={err("hero.secondaryLabel")}>
              <input value={c.hero.secondaryLabel} onChange={(e) => setIn("hero", { secondaryLabel: e.target.value })} className={input} />
            </Field>
            <Field label="Second button goes to" error={err("hero.secondaryPath")}>
              <input value={c.hero.secondaryPath} onChange={(e) => setIn("hero", { secondaryPath: e.target.value })} aria-invalid={!!err("hero.secondaryPath")} className={input} />
            </Field>
          </div>
        </div>

        <div className={card}>
          <h3 className="mb-3 font-semibold text-ink">Landing page: about and cards</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Small heading (school name follows)" error={err("about.eyebrow")}>
              <input value={c.about.eyebrow} onChange={(e) => setIn("about", { eyebrow: e.target.value })} className={input} />
            </Field>
            <Field label="Heading" error={err("about.heading")}>
              <input value={c.about.heading} onChange={(e) => setIn("about", { heading: e.target.value })} className={input} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Text" error={err("about.body")}>
                <textarea rows={3} value={c.about.body} onChange={(e) => setIn("about", { body: e.target.value })} className={area} />
              </Field>
            </div>
            <Field label="Link name" error={err("about.linkLabel")}>
              <input value={c.about.linkLabel} onChange={(e) => setIn("about", { linkLabel: e.target.value })} className={input} />
            </Field>
            <Field label="Link goes to" error={err("about.linkPath")}>
              <input value={c.about.linkPath} onChange={(e) => setIn("about", { linkPath: e.target.value })} aria-invalid={!!err("about.linkPath")} className={input} />
            </Field>
          </div>
          <div className="mt-6 space-y-4">
            <p className="text-sm font-medium text-ink">Cards</p>
            {err("features") && <p role="alert" className="text-xs text-danger">{err("features")}</p>}
            {c.features.map((f, i) => (
              <div key={i} className="grid gap-3 rounded-xl border border-line p-4 sm:grid-cols-2">
                <Field label="Title" error={err(`features.${i}.title`)}>
                  <input value={f.title} onChange={(e) => setFeature(i, { title: e.target.value })} aria-invalid={!!err(`features.${i}.title`)} className={input} />
                </Field>
                <Field label="Icon" error={err(`features.${i}.icon`)}>
                  <select value={f.icon} onChange={(e) => setFeature(i, { icon: e.target.value })} className={input}>
                    {PORTAL_ICONS.map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Text" error={err(`features.${i}.body`)}>
                    <input value={f.body} onChange={(e) => setFeature(i, { body: e.target.value })} className={input} />
                  </Field>
                </div>
                <Field label="Goes to (empty for no link)" error={err(`features.${i}.path`)}>
                  <input value={f.path} onChange={(e) => setFeature(i, { path: e.target.value })} aria-invalid={!!err(`features.${i}.path`)} className={input} />
                </Field>
                <button type="button" onClick={() => set("features", c.features.filter((_, n) => n !== i))} className="inline-flex items-center gap-1 self-end pb-2 text-sm text-muted hover:text-danger">
                  <Trash2 aria-hidden className="size-4" /> Remove card
                </button>
              </div>
            ))}
            {c.features.length < MAX_FEATURES && (
              <button type="button" onClick={() => set("features", [...c.features, { icon: "book", title: "", body: "", path: "" }])} className="inline-flex items-center gap-1 text-sm font-medium text-brand">
                <Plus aria-hidden className="size-4" /> Add card
              </button>
            )}
          </div>
        </div>

        <div className={card}>
          <h3 className="mb-3 font-semibold text-ink">Sign-in page</h3>
          <div className="grid gap-4">
            <Field label="Heading" error={err("signIn.heading")}>
              <input value={c.signIn.heading} onChange={(e) => setIn("signIn", { heading: e.target.value })} aria-invalid={!!err("signIn.heading")} className={input} />
            </Field>
            <Field label="Text" error={err("signIn.intro")}>
              <input value={c.signIn.intro} onChange={(e) => setIn("signIn", { intro: e.target.value })} className={input} />
            </Field>
            <Field label="Help text under the form" error={err("signIn.helpText")}>
              <input value={c.signIn.helpText} onChange={(e) => setIn("signIn", { helpText: e.target.value })} className={input} />
            </Field>
          </div>
          <p className="mt-3 text-xs text-muted">The welcome message and banner come from Branding above.</p>
        </div>

        <div className={card}>
          <h3 className="mb-3 font-semibold text-ink">Register page</h3>
          <div className="grid gap-4">
            <Field label="Heading" error={err("register.heading")}>
              <input value={c.register.heading} onChange={(e) => setIn("register", { heading: e.target.value })} aria-invalid={!!err("register.heading")} className={input} />
            </Field>
            <Field label="Text" error={err("register.intro")}>
              <textarea rows={2} value={c.register.intro} onChange={(e) => setIn("register", { intro: e.target.value })} className={area} />
            </Field>
            <fieldset>
              <legend className="mb-1 text-sm font-medium text-ink">Who can sign up</legend>
              {([["applicant", "Applicants and students"], ["staff", "Staff (invite code)"], ["parent", "Parents and guardians (invite code)"]] as const).map(([k, l]) => (
                <label key={k} className="mt-1 flex items-center gap-2 text-[15px] text-ink">
                  <input type="checkbox" checked={roles[k]} onChange={(e) => setIn("register", { roles: { ...roles, [k]: e.target.checked } })} className="size-4 accent-brand" />
                  {l}
                </label>
              ))}
              {err("register.roles") && <p role="alert" className="mt-1 text-xs text-danger">{err("register.roles")}</p>}
            </fieldset>
            <Field label="Footer text (under the school name)" error={err("footerNote")}>
              <input value={c.footerNote} onChange={(e) => set("footerNote", e.target.value)} className={input} />
            </Field>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={saving} className="rounded-lg bg-brand px-5 py-2.5 font-semibold text-on-brand hover:opacity-90 disabled:opacity-60">
            {saving ? "Saving…" : "Save portal pages"}
          </button>
          {saved.message && <p role={saved.ok ? "status" : "alert"} className={saved.ok ? "text-sm text-positive" : "text-sm text-danger"}>{saved.message}</p>}
        </div>
      </form>

      {isTenant && !inherited && (
        <form action={reset} className="flex items-center gap-3">
          <input type="hidden" name="area" value={areaKey} />
          <button type="submit" disabled={resetting} className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink hover:border-brand disabled:opacity-60">
            Reset to platform default
          </button>
          {resetState.message && <p role={resetState.ok ? "status" : "alert"} className="text-sm text-muted">{resetState.message}</p>}
        </form>
      )}
    </section>
  );
}
