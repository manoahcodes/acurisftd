"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, ExternalLink as ExternalIcon, ImagePlus, Plus, Trash2 } from "lucide-react";
import { PORTAL_ICONS } from "@/lib/portal/icons";
import { MAX_FEATURES, MAX_NAV, MAX_SLIDES } from "@/lib/portal/validate";
import { resetPortal, savePortal } from "@/server/actions/portal";
import type { PortalContent, PortalFeature, PortalFormState, PortalLink } from "@/types/portal";
import type { Branding, ThemeSettings } from "@/types/theme";
import { PortalPreview } from "./portal-preview";

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
  /** What a reset goes back to. */
  platformDefault: PortalContent;
  /** The school's look, used by the preview. */
  theme: ThemeSettings;
  branding: Branding;
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
/** Picks one image: shows what is saved (or the new file) and lets the admin replace or remove it. */
function ImagePicker({
  label, hint, name, removeName, saved, preview, onFile, onRemove, removed, error, resetKey,
}: {
  label: string; hint: string; name: string; removeName: string; saved: string; preview: string;
  onFile: (file: File | undefined) => void; onRemove: (v: boolean) => void; removed: boolean; error?: string; resetKey: number;
}) {
  return (
    <div>
      <p className="mb-1 text-sm font-medium text-ink">{label}</p>
      <div className="flex items-center gap-4">
        <div className="grid h-20 w-32 shrink-0 place-items-center overflow-hidden rounded-lg border border-dashed border-line bg-canvas text-muted">
          {/* eslint-disable-next-line @next/next/no-img-element -- stored data URL or a local preview */}
          {preview ? <img src={preview} alt="" className="size-full object-cover" /> : <ImagePlus aria-hidden className="size-6" />}
        </div>
        <div className="min-w-0 space-y-2">
          <input
            key={resetKey}
            type="file"
            name={name}
            accept="image/png,image/jpeg,image/webp"
            aria-label={label}
            aria-invalid={!!error}
            onChange={(e) => onFile(e.target.files?.[0])}
            className="block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-brand file:px-3 file:py-2 file:text-sm file:font-semibold file:text-on-brand"
          />
          {(saved || preview) && (
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" name={removeName} checked={removed} onChange={(e) => onRemove(e.target.checked)} className="size-4 accent-brand" />
              Remove this image
            </label>
          )}
        </div>
      </div>
      <p className="mt-1 text-xs text-muted">{hint}</p>
      {error && <p role="alert" className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}

/** A slide while it is being edited. Photos are never in the text payload: `keep` names which saved slide's photo it keeps, and a newly chosen file travels as its own form field. */
type EditorSlide = { key: number; keep: number; heading: string; body: string; ctaLabel: string; ctaPath: string; preview: string };
const toEditorSlides = (c: PortalContent): EditorSlide[] =>
  c.slides.map((s, n) => ({ key: n, keep: n, heading: s.heading, body: s.body, ctaLabel: s.ctaLabel, ctaPath: s.ctaPath, preview: "" }));

const readAsUrl = (file: File | undefined): Promise<string> =>
  new Promise((resolve) => {
    if (!file) return resolve("");
    const r = new FileReader();
    r.onload = () => resolve(typeof r.result === "string" ? r.result : "");
    r.onerror = () => resolve("");
    r.readAsDataURL(file);
  });

export function PortalEditor({ scopeLabel, isTenant, area: areaKey, inherited, schoolId, content: initial, platformDefault, theme, branding }: Props) {
  // Photos stay out of this state (and out of the text payload); they have their own fields.
  const [c, setC] = useState<PortalContent>({ ...initial, heroImage: "", aboutImage: "", signInImage: "", registerImage: "", slides: [] });
  const [slides, setSlides] = useState<EditorSlide[]>(() => toEditorSlides(initial));
  const [nextKey, setNextKey] = useState(initial.slides.length);
  // Images: what is saved, plus any file chosen but not saved yet (shown in the preview straight away).
  const [heroNew, setHeroNew] = useState("");
  const [aboutNew, setAboutNew] = useState("");
  const [signInNew, setSignInNew] = useState("");
  const [registerNew, setRegisterNew] = useState("");
  const [signInRemoved, setSignInRemoved] = useState(false);
  const [registerRemoved, setRegisterRemoved] = useState(false);
  const [heroRemoved, setHeroRemoved] = useState(false);
  const [aboutRemoved, setAboutRemoved] = useState(false);
  const [fileKey, setFileKey] = useState(0);
  const heroShown = heroRemoved ? "" : heroNew || initial.heroImage;
  const aboutShown = aboutRemoved ? "" : aboutNew || initial.aboutImage;
  const signInShown = signInRemoved ? "" : signInNew || initial.signInImage;
  const registerShown = registerRemoved ? "" : registerNew || initial.registerImage;
  const previewPage = useMemo(
    () => ({
      branding,
      content: {
        ...c,
        heroImage: heroShown,
        aboutImage: aboutShown,
        signInImage: signInShown,
        registerImage: registerShown,
        // A slide without a photo yet is left out of the preview, as it cannot be shown.
        slides: slides
          .map(({ keep, preview, heading, body, ctaLabel, ctaPath }) => ({ image: preview || initial.slides[keep]?.image || "", heading, body, ctaLabel, ctaPath }))
          .filter((sl) => sl.image),
      },
    }),
    [branding, c, heroShown, aboutShown, signInShown, registerShown, slides, initial.slides],
  );
  // After a successful save or reset nothing is pending: the refreshed content carries the saved images.
  const clearPending = () => {
    setHeroNew(""); setAboutNew(""); setHeroRemoved(false); setAboutRemoved(false);
    setSignInNew(""); setRegisterNew(""); setSignInRemoved(false); setRegisterRemoved(false); setFileKey((k) => k + 1);
    // What was just saved is now the saved order, so every slide keeps its own photo by position.
    setSlides((all) => all.map((sl, n) => ({ ...sl, keep: n, preview: "" })));
  };
  const [saved, save, saving] = useActionState(async (prev: PortalFormState, fd: FormData) => {
    const r = await savePortal(prev, fd);
    if (r.ok) clearPending();
    return r;
  }, IDLE);
  const [resetState, reset, resetting] = useActionState(async (prev: PortalFormState, fd: FormData) => {
    const r = await resetPortal(prev, fd);
    if (r.ok) { clearPending(); setC({ ...platformDefault, heroImage: "", aboutImage: "", signInImage: "", registerImage: "", slides: [] }); setSlides(toEditorSlides(platformDefault)); }
    return r;
  }, IDLE);
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

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] 2xl:items-start">
      <div className="order-first 2xl:order-last 2xl:sticky 2xl:top-4">
        <PortalPreview page={previewPage} theme={theme} />
      </div>
      <form action={save} className="space-y-5">
        <input type="hidden" name="area" value={areaKey} />
        <input type="hidden" name="payload" value={JSON.stringify({ ...c, slides: slides.map(({ keep, heading, body, ctaLabel, ctaPath }) => ({ keep, heading, body, ctaLabel, ctaPath })) })} />

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
          <h3 className="font-semibold text-ink">Landing page images</h3>
          <p className="mb-4 text-sm text-muted">Optional. PNG, JPEG or WebP, up to 1.5 MB each. Landscape photos work best.</p>
          <div className="grid gap-6">
            <ImagePicker
              label="Banner photo" hint="Shown behind the heading at the top of the page. A dark wash keeps the text readable."
              name="heroImage" removeName="removeHeroImage" saved={initial.heroImage} preview={heroShown} removed={heroRemoved}
              onFile={async (f) => { setHeroNew(await readAsUrl(f)); setHeroRemoved(false); }} onRemove={setHeroRemoved}
              error={err("heroImage")} resetKey={fileKey}
            />
            <ImagePicker
              label="About photo" hint="Shown beside the about text."
              name="aboutImage" removeName="removeAboutImage" saved={initial.aboutImage} preview={aboutShown} removed={aboutRemoved}
              onFile={async (f) => { setAboutNew(await readAsUrl(f)); setAboutRemoved(false); }} onRemove={setAboutRemoved}
              error={err("aboutImage")} resetKey={fileKey}
            />
          </div>
        </div>

        <div className={card}>
          <h3 className="font-semibold text-ink">Hero slider</h3>
          <p className="mb-4 text-sm text-muted">
            Optional. Add up to {MAX_SLIDES} slides and the top banner becomes a slider that changes every few seconds. With no slides, the single banner below is used.
          </p>
          {err("slides") && <p role="alert" className="mb-2 text-xs text-danger">{err("slides")}</p>}
          <div className="space-y-4">
            {slides.map((sl, i) => {
              const shown = sl.preview || initial.slides[sl.keep]?.image || "";
              const upd = (v: Partial<EditorSlide>) => setSlides((all) => all.map((x) => (x.key === sl.key ? { ...x, ...v } : x)));
              const move = (d: number) =>
                setSlides((all) => { const j = i + d; if (j < 0 || j >= all.length) return all; const n = [...all]; [n[i], n[j]] = [n[j], n[i]]; return n; });
              return (
                <fieldset key={sl.key} className="rounded-xl border border-line p-4">
                  <legend className="px-1 text-sm font-semibold text-ink">Slide {i + 1}</legend>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <div className="flex items-center gap-4">
                        <div className="grid h-20 w-32 shrink-0 place-items-center overflow-hidden rounded-lg border border-dashed border-line bg-canvas text-muted">
                          {/* eslint-disable-next-line @next/next/no-img-element -- stored data URL or a local preview */}
                          {shown ? <img src={shown} alt="" className="size-full object-cover" /> : <ImagePlus aria-hidden className="size-6" />}
                        </div>
                        <div className="min-w-0">
                          <input
                            key={fileKey}
                            type="file"
                            name={`slideImage${i}`}
                            accept="image/png,image/jpeg,image/webp"
                            aria-label={`Slide ${i + 1} photo`}
                            aria-invalid={!!err(`slides.${i}.image`)}
                            onChange={async (e) => upd({ preview: await readAsUrl(e.target.files?.[0]) })}
                            className="block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-brand file:px-3 file:py-2 file:text-sm file:font-semibold file:text-on-brand"
                          />
                          <p className="mt-1 text-xs text-muted">PNG, JPEG or WebP, up to 1.5 MB.</p>
                          {err(`slides.${i}.image`) && <p role="alert" className="mt-1 text-xs text-danger">{err(`slides.${i}.image`)}</p>}
                        </div>
                      </div>
                    </div>
                    <Field label="Heading" error={err(`slides.${i}.heading`)}>
                      <input value={sl.heading} onChange={(e) => upd({ heading: e.target.value })} aria-invalid={!!err(`slides.${i}.heading`)} className={input} />
                    </Field>
                    <Field label="Text" error={err(`slides.${i}.body`)}>
                      <input value={sl.body} onChange={(e) => upd({ body: e.target.value })} className={input} />
                    </Field>
                    <Field label="Button (optional)" error={err(`slides.${i}.ctaLabel`)}>
                      <input value={sl.ctaLabel} onChange={(e) => upd({ ctaLabel: e.target.value })} className={input} />
                    </Field>
                    <Field label="Button goes to" error={err(`slides.${i}.ctaPath`)}>
                      <input value={sl.ctaPath} onChange={(e) => upd({ ctaPath: e.target.value })} aria-invalid={!!err(`slides.${i}.ctaPath`)} className={input} />
                    </Field>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <button type="button" aria-label={`Move slide ${i + 1} up`} disabled={i === 0} onClick={() => move(-1)} className="grid size-9 place-items-center rounded-lg border border-line text-muted hover:text-ink disabled:opacity-40"><ArrowUp aria-hidden className="size-4" /></button>
                    <button type="button" aria-label={`Move slide ${i + 1} down`} disabled={i === slides.length - 1} onClick={() => move(1)} className="grid size-9 place-items-center rounded-lg border border-line text-muted hover:text-ink disabled:opacity-40"><ArrowDown aria-hidden className="size-4" /></button>
                    <button type="button" onClick={() => setSlides((all) => all.filter((x) => x.key !== sl.key))} className="ml-auto inline-flex items-center gap-1 text-sm text-muted hover:text-danger">
                      <Trash2 aria-hidden className="size-4" /> Remove slide
                    </button>
                  </div>
                </fieldset>
              );
            })}
            {slides.length < MAX_SLIDES && (
              <button
                type="button"
                onClick={() => { setSlides((all) => [...all, { key: nextKey, keep: -1, heading: "", body: "", ctaLabel: "", ctaPath: "", preview: "" }]); setNextKey((k) => k + 1); }}
                className="inline-flex items-center gap-1 text-sm font-medium text-brand"
              >
                <Plus aria-hidden className="size-4" /> Add slide
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
          <div className="mt-5">
            <ImagePicker
              label="Side photo" hint="Shown behind the school name on the left of the sign-in page. A dark wash keeps the text readable."
              name="signInImage" removeName="removeSignInImage" saved={initial.signInImage} preview={signInShown} removed={signInRemoved}
              onFile={async (f) => { setSignInNew(await readAsUrl(f)); setSignInRemoved(false); }} onRemove={setSignInRemoved}
              error={err("signInImage")} resetKey={fileKey}
            />
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
            <ImagePicker
              label="Side photo" hint="Shown behind the heading on the left of the register page. A dark wash keeps the text readable."
              name="registerImage" removeName="removeRegisterImage" saved={initial.registerImage} preview={registerShown} removed={registerRemoved}
              onFile={async (f) => { setRegisterNew(await readAsUrl(f)); setRegisterRemoved(false); }} onRemove={setRegisterRemoved}
              error={err("registerImage")} resetKey={fileKey}
            />
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
      </div>

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
