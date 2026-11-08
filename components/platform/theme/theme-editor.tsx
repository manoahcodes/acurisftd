"use client";

import { useActionState, useMemo, useState } from "react";
import { Check, Trash2, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/format";
import { hexToHsl, hslToHex, isHex } from "@/lib/theme/color";
import { previewVars } from "@/lib/theme/css";
import { auditPalette, generatePalette } from "@/lib/theme/generate";
import {
  BASE_SIZES, DENSITIES, FONTS, HARMONIES, MODES, RADII, SHADOWS, SIDEBAR_STYLES, type FontKey,
} from "@/lib/theme/options";
import { BUILT_IN_PRESETS, QUICK_COLOURS } from "@/lib/theme/presets";
import { deleteThemePreset, resetTenantTheme, saveTheme, saveThemePreset } from "@/server/actions/theme";
import type { Branding, ThemeFormState, ThemePreset, ThemeSettings } from "@/types/theme";

const IDLE: ThemeFormState = { ok: false };
const input =
  "h-11 w-full rounded-lg border border-line bg-surface px-3 text-[15px] text-ink placeholder:text-muted focus-visible:outline-2 focus-visible:outline-brand aria-[invalid=true]:border-red-500";
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
  const [shortName, setShortName] = useState(branding.shortName);
  const [saved, save, saving] = useActionState(saveTheme, IDLE);
  const [presetState, savePreset, presetPending] = useActionState(saveThemePreset, IDLE);
  const [resetState, reset, resetting] = useActionState(resetTenantTheme, IDLE);
  const errors = saved.errors ?? {};
  const set = <K extends keyof ThemeSettings>(k: K, v: ThemeSettings[K]) => setTheme((t) => ({ ...t, [k]: v }));

  const previewMode = theme.mode === "dark" ? "dark" : "light";
  const vars = useMemo(() => (isHex(theme.primary) ? previewVars(theme, previewMode) : undefined), [theme, previewMode]);
  const audit = useMemo(
    () => (isHex(theme.primary) ? auditPalette(generatePalette(theme.primary, theme.harmony, theme.sidebarStyle, previewMode)) : []),
    [theme, previewMode],
  );
  const swatches = useMemo(() => {
    if (!isHex(theme.primary)) return [];
    const p = generatePalette(theme.primary, theme.harmony, theme.sidebarStyle, previewMode);
    return [p.brand, p.accent, p.navy, p.canvas, p.ink];
  }, [theme, previewMode]);

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
      {err(key) && <span className="mt-1 block text-sm text-red-600">{err(key)}</span>}
    </label>
  );

  const choice = <T extends string | number>(label: string, key: keyof ThemeSettings, options: readonly T[], show: (o: T) => string = (o) => cap(String(o))) => (
    <fieldset>
      <legend className="mb-1 text-sm font-medium text-ink">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label key={String(o)} className={cn(
            "cursor-pointer rounded-lg border px-3 py-2 text-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand",
            String(theme[key]) === String(o) ? "border-brand bg-avatar font-semibold text-ink" : "border-line bg-surface text-muted",
          )}>
            <input type="radio" name={key} value={String(o)} checked={String(theme[key]) === String(o)}
              onChange={() => set(key, (typeof o === "number" ? o : String(o)) as never)} className="sr-only" />
            {show(o)}
          </label>
        ))}
      </div>
      {err(key) && <span className="mt-1 block text-sm text-red-600">{err(key)}</span>}
    </fieldset>
  );

  const section = "rounded-2xl border border-line bg-surface p-6 shadow-card";
  const h = "text-lg font-semibold text-ink";

  return (
    <form action={save} className="mt-10 space-y-6">
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
                <span className="mb-1 block text-sm font-medium text-ink">Logo (PNG, JPEG or WebP, up to 3 MB)</span>
                <input name="logo" type="file" accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) { setLogoPreview(URL.createObjectURL(f)); setRemoveLogo(false); }
                  }}
                  className="block w-full text-sm text-muted file:mr-3 file:h-10 file:rounded-lg file:border-0 file:bg-brand file:px-4 file:font-semibold file:text-white" />
                {err("logo") && <span className="mt-1 block text-sm text-red-600">{err("logo")}</span>}
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
                {err("timezone") && <span className="mt-1 block text-sm text-red-600">{err("timezone")}</span>}
              </label>
            </div>
          </section>

          <section className={section}>
            <h3 className={h}>Colours</h3>
            <p className="mt-1 text-sm text-muted">Pick one colour. The whole palette is generated from it and adjusted to stay readable.</p>
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
            {err("primary") && <span className="mt-1 block text-sm text-red-600">{err("primary")}</span>}
            <div className="mt-5">{choice("Harmony (accent colour)", "harmony", HARMONIES)}</div>
            <div className="mt-5 flex gap-2" aria-label="Generated palette">
              {swatches.map((c, i) => <span key={i} title={c} style={{ background: c }} className="h-10 flex-1 rounded-lg border border-line" />)}
            </div>
            <ul className="mt-4 space-y-1 text-sm">
              {audit.map((c) => (
                <li key={c.label} className={cn("flex items-center gap-2", c.pass ? "text-muted" : "text-red-600")}>
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
                  {Object.entries(FONTS).map(([k, f]) => <option key={k} value={k}>{f.label}</option>)}
                </select>
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
                    <button type="button" aria-label={`Delete preset ${p.name}`} onClick={() => deleteThemePreset(p.id)} className="border-l border-line bg-surface px-2 text-muted hover:text-red-600">
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
            {presetState.message && <p role="status" className={cn("mt-2 text-sm", presetState.ok ? "text-positive" : "text-red-600")}>{presetState.message}</p>}
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
                  <button type="button" className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white">Primary action</button>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button disabled={saving} className="h-11 rounded-lg bg-brand px-6 text-[15px] font-semibold text-white disabled:opacity-60">
          {saving ? "Saving..." : "Save changes"}
        </button>
        {isTenant && !inherited && (
          <button formAction={reset} disabled={resetting} formNoValidate className="h-11 rounded-lg border border-line px-4 text-sm font-semibold text-ink">
            Use platform default
          </button>
        )}
        {(saved.message || resetState.message) && (
          <p role="status" className={cn("text-sm", (saved.message ? saved.ok : resetState.ok) ? "text-positive" : "text-red-600")}>
            {saved.message ?? resetState.message}
          </p>
        )}
      </div>
    </form>
  );
}
