"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { Check, Trash2, TriangleAlert } from "lucide-react";
import { CopyrightYear } from "@/components/shell/copyright-year";
import { cn } from "@/lib/format";
import { copyrightHolderFor } from "@/lib/theme/copyright";
import { hexToHsl, hslToHex, isHex } from "@/lib/theme/color";
import { previewVars } from "@/lib/theme/css";
import { logoColours } from "@/lib/theme/logo-image";
import { suggestPalettes, usablePrimary, type PaletteSuggestion } from "@/lib/theme/logo-colours";
import { auditPalette, colourNotes, paletteFor } from "@/lib/theme/generate";
import { useThemeFade } from "@/lib/theme/use-theme-fade";
import {
  BASE_SIZES, DENSITIES, FALLBACK_FONT_STACK, FONTS, HARMONIES, MODES, RADII, SHADOWS, SIDEBAR_STYLES, type FontKey,
} from "@/lib/theme/options";
import { BUILT_IN_PRESETS, QUICK_COLOURS } from "@/lib/theme/presets";
import { deleteThemePreset, resetTenantTheme, saveTheme, saveThemePreset } from "@/server/actions/theme";
import type { Branding, ThemeFormState, ThemePreset, ThemeSettings } from "@/types/theme";

const IDLE: ThemeFormState = { ok: false };
const input =
  "h-11 w-full rounded-lg border border-line bg-surface px-3 text-[15px] text-ink placeholder:text-muted focus-visible:outline-2 focus-visible:outline-brand aria-[invalid=true]:border-danger";
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

type Props = {
  scopeLabel: string;
  isTenant: boolean;
  inherited: boolean;
  theme: ThemeSettings;
  branding: Branding;
  presets: ThemePreset[];
  timezones: string[];
};

export function ThemeEditor({ scopeLabel, isTenant, inherited, theme: initial, branding, presets, timezones }: Props) {
  const [theme, setTheme] = useState<ThemeSettings>(initial);
  const [logoPreview, setLogoPreview] = useState<string>(branding.logoUrl);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [name, setName] = useState(branding.name);
  const [holder, setHolder] = useState(branding.copyrightHolder);
  const [shortName, setShortName] = useState(branding.shortName);
  const [fromLogo, setFromLogo] = useState<string[]>([]);
  const [saved, save, saving] = useActionState(saveTheme, IDLE);
  const [presetState, savePreset, presetPending] = useActionState(saveThemePreset, IDLE);
  const [resetState, reset, resetting] = useActionState(resetTenantTheme, IDLE);
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  // After a successful save or reset, refresh so the whole app picks up the new look straight away.
  useEffect(() => {
    if (saved.ok || resetState.ok) startRefresh(() => router.refresh());
  }, [saved, resetState, router]);
  // Read the logo's colours whenever the logo changes (a new file, or the one already saved).
  useEffect(() => {
    let live = true;
    Promise.resolve(logoPreview ? logoColours(logoPreview) : []).then((c) => live && setFromLogo(c));
    return () => { live = false; };
  }, [logoPreview]);
  // Ease from the old colours to the new ones instead of jumping.
  useThemeFade(saving || resetting || refreshing);
  const errors = saved.errors ?? {};
  const set = <K extends keyof ThemeSettings>(k: K, v: ThemeSettings[K]) => setTheme((t) => ({ ...t, [k]: v }));

  const previewMode = theme.mode === "dark" ? "dark" : "light";
  const vars = useMemo(() => (isHex(theme.primary) ? previewVars(theme, previewMode) : undefined), [theme, previewMode]);
  const palette = useMemo(() => (isHex(theme.primary) ? paletteFor(theme, previewMode) : undefined), [theme, previewMode]);
  const audit = useMemo(() => (palette ? auditPalette(palette) : []), [palette]);
  const notes = useMemo(() => (isHex(theme.primary) ? colourNotes(theme, previewMode) : []), [theme, previewMode]);
  const swatches = palette ? [palette.brand, palette.accent, palette.navy, palette.canvas, palette.ink] : [];

  const err = (k: string) => (errors as Record<string, string | undefined>)[k];
  const field = (label: string, key: keyof Branding, props: { type?: string; max?: number; value?: string; onChange?: (v: string) => void } = {}) => (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-ink">{label}</span>
      <input
        name={key} type={props.type ?? "text"} maxLength={props.max}
        defaultValue={props.onChange ? undefined : branding[key]} value={props.value}
        onChange={props.onChange ? (e) => props.onChange!(e.target.value) : undefined}
        aria-invalid={err(key) ? true : undefined} className={input}
      />
      {err(key) && <span className="mt-1 block text-sm text-danger">{err(key)}</span>}
    </label>
  );

  const optionalColour = (key: "secondary" | "tertiary", label: string, help: string, fallback: string | undefined) => (
    <div>
      <span className="mb-1 block text-sm font-medium text-ink">{label}</span>
      <p className="mb-2 text-xs text-muted">{help}</p>
      <div className="flex flex-wrap items-center gap-2">
        <input type="color" aria-label={`${label} colour`} value={isHex(theme[key]) ? theme[key] : (fallback ?? "#000000")}
          onChange={(e) => set(key, e.target.value.toLowerCase())} className="h-11 w-14 cursor-pointer rounded-lg border border-line bg-surface p-1" />
        <input name={key} aria-label={`${label} hex`} value={theme[key]} placeholder="Generated" maxLength={7}
          onChange={(e) => set(key, e.target.value)} aria-invalid={err(key) ? true : undefined} className={cn(input, "w-32 font-mono")} />
        {theme[key] !== "" && (
          <button type="button" onClick={() => set(key, "")} className="h-10 rounded-lg border border-line px-3 text-sm font-medium text-ink">Use generated</button>
        )}
      </div>
      {err(key) && <span className="mt-1 block text-sm text-danger">{err(key)}</span>}
    </div>
  );

  const choice = <T extends string | number>(label: string, key: keyof ThemeSettings, options: readonly T[], show: (o: T) => string = (o) => cap(String(o))) => (
    <fieldset>
      <legend className="mb-1 text-sm font-medium text-ink">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label key={String(o)} className={cn(
            "relative cursor-pointer rounded-lg border px-3 py-2 text-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand",
            String(theme[key]) === String(o) ? "border-brand bg-avatar font-semibold text-ink" : "border-line bg-surface text-muted",
          )}>
            <input type="radio" name={key} value={String(o)} checked={String(theme[key]) === String(o)}
              onChange={() => set(key, (typeof o === "number" ? o : String(o)) as never)} className="sr-only" />
            {show(o)}
          </label>
        ))}
      </div>
      {err(key) && <span className="mt-1 block text-sm text-danger">{err(key)}</span>}
    </fieldset>
  );

  const suggestions = useMemo(() => suggestPalettes(fromLogo), [fromLogo]);
  const applySuggestion = (x: PaletteSuggestion) => {
    setTheme((t) => ({ ...t, primary: usablePrimary(x.primary), secondary: x.secondary, harmony: x.harmony }));
  };

  const section = "rounded-2xl border border-line bg-surface p-6 shadow-card";
  const h = "text-lg font-semibold text-ink";

  return (
    <form action={save} className="mt-6 space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-ink">Branding and theme</h2>
        <p className="mt-1 max-w-3xl text-[15px] text-muted">
          Editing: <strong className="text-ink">{scopeLabel}</strong>.{" "}
          {isTenant
            ? inherited
              ? "This school uses the platform default. Saving gives it its own branding."
              : "This school has its own branding."
            : "Every school without its own branding uses this. Select a school in the sidebar to customise one."}
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <section className={section}>
            <h3 className={h}>Institutional identity</h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {field("Institution name", "name", { max: 120, value: name, onChange: setName })}
              {field("Short name", "shortName", { max: 12, value: shortName, onChange: setShortName })}
              <div className="sm:col-span-2">{field("Tagline", "tagline", { max: 140 })}</div>
              <div className="sm:col-span-2">
                {field("Copyright holder", "copyrightHolder", { max: 120, value: holder, onChange: setHolder })}
                <p className="mt-1 text-sm text-muted">
                  Type the name only: the &copy; symbol and year are added for you. Leave empty to use the institution name.
                </p>
                <p className="mt-2 rounded-lg bg-canvas px-3 py-2 text-sm text-ink" aria-label="Footer preview">
                  {copyrightHolderFor({ copyrightHolder: holder, name }) && (
                    <span className="block">
                      &copy; <CopyrightYear /> {copyrightHolderFor({ copyrightHolder: holder, name })}.
                    </span>
                  )}
                  <span className="block">
                    &copy; <CopyrightYear /> ACURIS by STECIA Digital Technologies.
                  </span>
                </p>
              </div>
              <div className="sm:col-span-2">
                <span className="mb-1 block text-sm font-medium text-ink">Logo (PNG, JPEG or WebP, up to 3 MB)</span>
                <input name="logo" type="file" accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) { setLogoPreview(URL.createObjectURL(f)); setRemoveLogo(false); }
                  }}
                  className="block w-full text-sm text-muted file:mr-3 file:h-10 file:rounded-lg file:border-0 file:bg-brand file:px-4 file:font-semibold file:text-on-brand" />
                {err("logo") && <span className="mt-1 block text-sm text-danger">{err("logo")}</span>}
                {branding.logoUrl && (
                  <label className="mt-2 flex items-center gap-2 text-sm text-muted">
                    <input type="checkbox" name="removeLogo" checked={removeLogo}
                      onChange={(e) => { setRemoveLogo(e.target.checked); if (e.target.checked) setLogoPreview(""); else setLogoPreview(branding.logoUrl); }} />
                    Remove current logo
                  </label>
                )}
              </div>
            </div>
          </section>

          <section className={section}>
            <h3 className={h}>Contact and regional settings</h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {field("Email", "email", { type: "email" })}
              {field("Phone", "phone", { type: "tel" })}
              <div className="sm:col-span-2">{field("Address", "address", { max: 300 })}</div>
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-sm font-medium text-ink">Time zone</span>
                <select name="timezone" defaultValue={branding.timezone} aria-invalid={err("timezone") ? true : undefined} className={input}>
                  {timezones.map((z) => <option key={z} value={z}>{z}</option>)}
                </select>
                {err("timezone") && <span className="mt-1 block text-sm text-danger">{err("timezone")}</span>}
              </label>
            </div>
          </section>

          <section className={section}>
            <h3 className={h}>Colours</h3>
            <p className="mt-1 text-sm text-muted">Pick one colour. The whole palette is generated from it and adjusted to stay readable.</p>
            {suggestions.length > 0 && (
              <div className="mt-4 rounded-xl border border-line bg-canvas p-4" role="group" aria-label="Colours suggested from your logo">
                <p className="text-sm font-medium text-ink">Suggested from your logo</p>
                <p className="mt-0.5 text-xs text-muted">Colours found in the logo. Choose one to try it in the preview; nothing is saved until you press Save.</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  {suggestions.map((x) => {
                    const on = theme.primary.toLowerCase() === usablePrimary(x.primary) && theme.secondary.toLowerCase() === x.secondary;
                    return (
                      <button key={`${x.primary}-${x.secondary}-${x.harmony}`} type="button" onClick={() => applySuggestion(x)} aria-pressed={on}
                        className={cn("rounded-lg border bg-surface p-3 text-left focus-visible:outline-2 focus-visible:outline-brand", on ? "border-brand" : "border-line hover:border-brand")}>
                        <span className="flex items-center gap-2">
                          <span aria-hidden style={{ background: usablePrimary(x.primary) }} className="size-7 rounded-full ring-1 ring-line" />
                          <span aria-hidden style={x.secondary ? { background: x.secondary } : undefined}
                            className={cn("size-7 rounded-full ring-1 ring-line", !x.secondary && "border border-dashed border-muted")} />
                        </span>
                        <span className="mt-2 block text-sm font-medium text-ink">{x.label}</span>
                        <span className="block text-xs text-muted">{x.primary}{x.secondary ? ` + ${x.secondary}` : `, ${x.harmony} accent`}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <input type="color" aria-label="Primary colour" value={isHex(theme.primary) ? theme.primary : "#0b66f5"}
                onChange={(e) => set("primary", e.target.value.toLowerCase())} className="h-11 w-14 cursor-pointer rounded-lg border border-line bg-surface p-1" />
              <input name="primary" aria-label="Primary colour hex" value={theme.primary} onChange={(e) => set("primary", e.target.value)}
                aria-invalid={err("primary") ? true : undefined} className={cn(input, "w-32 font-mono")} maxLength={7} />
              <div className="flex flex-wrap gap-2" role="group" aria-label="Quick colours">
                {QUICK_COLOURS.map((c) => (
                  <button key={c} type="button" onClick={() => set("primary", c)} aria-label={`Use ${c}`}
                    style={{ background: c }} className={cn("h-8 w-8 rounded-full border-2", theme.primary === c ? "border-ink" : "border-surface ring-1 ring-line")} />
                ))}
              </div>
              <button type="button" className="h-10 rounded-lg border border-line px-3 text-sm font-medium text-ink"
                onClick={() => { if (isHex(theme.primary)) { const { s, l } = hexToHsl(theme.primary); set("primary", hslToHex({ h: Math.random() * 360, s: Math.max(s, 55), l: Math.min(Math.max(l, 35), 50) })); } }}>
                Surprise me
              </button>
            </div>
            {err("primary") && <span className="mt-1 block text-sm text-danger">{err("primary")}</span>}
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              {optionalColour("secondary", "Secondary colour (optional)", "Used for the accent: highlights and the active page in the sidebar.", palette?.accent)}
              {optionalColour("tertiary", "Tertiary colour (optional)", "Tints the sidebar. Leave empty to tint it from the primary colour.", palette?.navy)}
            </div>
            <div className={cn("mt-5", theme.secondary !== "" && "opacity-60")}>
              {choice("Harmony (generates the accent when no secondary colour is set)", "harmony", HARMONIES)}
            </div>
            {notes.length > 0 && (
              <ul className="mt-3 space-y-1 text-sm text-muted">
                {notes.map((n) => <li key={n}>{n}</li>)}
              </ul>
            )}
            <div className="mt-5 flex gap-2" aria-label="Generated palette">
              {swatches.map((c, i) => <span key={i} title={c} style={{ background: c }} className="h-10 flex-1 rounded-lg border border-line" />)}
            </div>
            <ul className="mt-4 space-y-1 text-sm">
              {audit.map((c) => (
                <li key={c.label} className={cn("flex items-center gap-2", c.pass ? "text-muted" : "text-danger")}>
                  {c.pass ? <Check size={14} aria-hidden /> : <TriangleAlert size={14} aria-hidden />}
                  {c.label}: {c.ratio}:1 (needs {c.min}:1)
                </li>
              ))}
            </ul>
          </section>

          <section className={section}>
            <h3 className={h}>Layout, shape and type</h3>
            <div className="mt-4 grid gap-5 sm:grid-cols-2">
              {choice("Sidebar", "sidebarStyle", SIDEBAR_STYLES)}
              {choice("Corners", "radius", RADII)}
              {choice("Density", "density", DENSITIES)}
              {choice("Card shadow", "shadow", SHADOWS)}
              {choice("Text size", "baseFontSize", BASE_SIZES, (n) => `${n}px`)}
              <fieldset>
                <legend className="mb-1 text-sm font-medium text-ink">Font</legend>
                <select name="font" value={theme.font} onChange={(e) => set("font", e.target.value as FontKey)} className={input}>
                  {Object.entries(FONTS).map(([k, f]) => <option key={k} value={k}>{f.label} · {f.hint}</option>)}
                </select>
                <p className="mt-2 rounded-lg bg-canvas px-3 py-2 text-[15px] text-ink" aria-label="Font sample"
                  style={{ fontFamily: `var(${FONTS[theme.font].variable}), ${FALLBACK_FONT_STACK}` }}>
                  The quick brown fox jumps over the lazy dog. 0123456789
                </p>
              </fieldset>
            </div>
          </section>

          <section className={section}>
            <h3 className={h}>Appearance and presets</h3>
            <div className="mt-4">{choice("Mode", "mode", MODES, (m) => (m === "auto" ? "Follow device" : cap(m)))}</div>
            <p className="mt-5 text-sm font-medium text-ink">Start from a preset</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {[...BUILT_IN_PRESETS, ...presets].map((p) => (
                <span key={p.id} className="inline-flex overflow-hidden rounded-lg border border-line text-sm">
                  <button type="button" onClick={() => setTheme(p.theme)} className="flex items-center gap-2 bg-surface px-3 py-2 text-ink">
                    <span style={{ background: p.theme.primary }} className="h-3 w-3 rounded-full" aria-hidden />{p.name}
                  </button>
                  {!BUILT_IN_PRESETS.some((b) => b.id === p.id) && (
                    <button type="button" aria-label={`Delete preset ${p.name}`} onClick={() => deleteThemePreset(p.id)} className="border-l border-line bg-surface px-2 text-muted hover:text-danger">
                      <Trash2 size={14} />
                    </button>
                  )}
                </span>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-ink">Save current look as a preset</span>
                <input name="presetName" maxLength={40} placeholder="Preset name" className={cn(input, "w-64")} />
              </label>
              <button formAction={savePreset} disabled={presetPending} className="h-11 rounded-lg border border-line px-4 text-sm font-semibold text-ink disabled:opacity-60">Save preset</button>
            </div>
            {presetState.message && <p role="status" className={cn("mt-2 text-sm", presetState.ok ? "text-positive" : "text-danger")}>{presetState.message}</p>}
          </section>

          <section className={section}>
            <h3 className={h}>Documents and sign-in</h3>
            <div className="mt-4 grid gap-4">
              {field("Welcome message", "welcomeMessage", { max: 200 })}
              {field("Sign-in banner", "loginBanner", { max: 200 })}
              {field("Document header (receipts, transcripts)", "documentHeader", { max: 200 })}
              {field("Document footer", "documentFooter", { max: 200 })}
              {field("Signature line", "signatureLine", { max: 80 })}
            </div>
          </section>
        </div>

        <aside className="xl:sticky xl:top-4 xl:self-start">
          <div className={section}>
            <h3 className={h}>Live preview</h3>
            <div style={vars} className="mt-4 overflow-hidden rounded-2xl border border-line bg-canvas text-ink" aria-label="Theme preview">
              <div className="flex">
                <div className="w-24 space-y-2 bg-navy p-3 text-white">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {logoPreview ? <img src={logoPreview} alt="" className="h-8 w-8 rounded-md object-contain" /> : <span className="block h-8 w-8 rounded-md bg-brand" />}
                  <p className="truncate text-xs font-semibold">{shortName || "Name"}</p>
                  <span className="block rounded-lg bg-navy-raised px-2 py-1 text-[11px]">Overview</span>
                  <span className="block px-2 py-1 text-[11px] text-accent">Students</span>
                </div>
                <div className="flex-1 space-y-3 p-3">
                  <p className="truncate text-sm font-semibold">{name || "Institution name"}</p>
                  <div className="rounded-xl border border-line bg-surface p-3 shadow-card">
                    <p className="text-xs text-muted">Fees collected</p>
                    <p className="text-lg font-semibold text-brand">K 482,000</p>
                  </div>
                  <button type="button" className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-on-brand">Primary action</button>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button disabled={saving} className="h-11 rounded-lg bg-brand px-6 text-[15px] font-semibold text-on-brand disabled:opacity-60">
          {saving ? "Saving..." : "Save changes"}
        </button>
        {isTenant && !inherited && (
          <button formAction={reset} disabled={resetting} formNoValidate className="h-11 rounded-lg border border-line px-4 text-sm font-semibold text-ink">
            Use platform default
          </button>
        )}
        {(saved.message || resetState.message) && (
          <p role="status" className={cn("text-sm", (saved.message ? saved.ok : resetState.ok) ? "text-positive" : "text-danger")}>
            {saved.message ?? resetState.message}
          </p>
        )}
      </div>
    </form>
  );
}
