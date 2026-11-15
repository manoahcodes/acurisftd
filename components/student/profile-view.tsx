"use client";

import { useRef, useState, useTransition } from "react";
import { Lock, Trash2, Upload } from "lucide-react";
import { Card, Field, buttonClass, inputClass, primaryClass } from "@/components/teacher/shared";
import { removeProfilePhoto, saveContactDetails, uploadProfilePhoto } from "@/server/actions/student";
import { formatStamp } from "@/lib/format";
import { prettyDate } from "@/lib/teacher/dates";
import { MAX_PHOTO_BYTES, PROFILE_LIMITS, initialsOf } from "@/lib/student/profile";
import type { StudentTerms } from "@/lib/student/terms";
import { RELATIONSHIPS, type ContactDetails, type StudentProfile } from "@/types/student";

const KEYS = ["phone", "email", "address", "emergencyName", "emergencyRelationship", "emergencyPhone"] as const;

export function ProfileView({ profile, terms, timezone }: { profile: StudentProfile; terms: StudentTerms; timezone: string }) {
  const { identity: who } = profile;
  const saved = profile.contact;
  const [form, setForm] = useState<ContactDetails>(saved);
  const [errors, setErrors] = useState<Partial<Record<keyof ContactDetails, string>>>({});
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [pending, start] = useTransition();
  const dirty = KEYS.some((k) => form[k] !== saved[k]);

  const set = <K extends keyof ContactDetails>(k: K, v: ContactDetails[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = () => {
    setMessage(null);
    setErrors({});
    start(async () => {
      const r = await saveContactDetails({ ...form });
      if (r.ok) setMessage({ text: "Your details were saved.", error: false });
      else {
        setErrors((r.fields ?? {}) as typeof errors);
        setMessage({ text: r.error, error: true });
      }
    });
  };

  return (
    <div className="mt-6 grid gap-6 xl:grid-cols-[2fr_3fr]">
      <div className="space-y-6">
        <PhotoCard profile={profile} />
        <Card>
          <h2 className="text-lg font-semibold text-ink">{terms.member} details</h2>
          <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-muted"><Lock size={14} aria-hidden /> Set by the school. To correct anything here, speak to the school office.</p>
          <dl className="mt-4 divide-y divide-line text-[15px]">
            {[
              ["Name", who.name],
              [`${terms.member} number`, who.number],
              [terms.group, who.group],
              ["School", who.institution],
              ["Enrolled", prettyDate(who.enrolledOn)],
              ["Date of birth", prettyDate(who.dateOfBirth)],
              ["Guardian", who.guardian],
              [who.advisorTitle, who.advisor],
            ].map(([k, v]) => (
              <div key={k} className="flex flex-wrap justify-between gap-x-4 gap-y-0.5 py-2">
                <dt className="text-muted">{k}</dt>
                <dd className="font-medium text-ink">{v}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>

      <Card>
        <form onSubmit={(e) => { e.preventDefault(); submit(); }} noValidate className="space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-ink">Your contact details</h2>
            <p className="text-sm text-muted">The school uses these to reach you. {profile.updatedAt ? `Last changed ${formatStamp(profile.updatedAt, timezone)}.` : ""}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Phone" error={errors.phone} help="Optional.">
              {(p) => <input {...p} type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} maxLength={PROFILE_LIMITS.phone.max} className={inputClass} />}
            </Field>
            <Field label="Email" error={errors.email} help="Optional.">
              {(p) => <input {...p} type="email" autoComplete="email" value={form.email} onChange={(e) => set("email", e.target.value)} maxLength={PROFILE_LIMITS.email} className={inputClass} />}
            </Field>
          </div>
          <Field label="Home address" error={errors.address} help="Optional.">
            {(p) => <textarea {...p} rows={2} autoComplete="street-address" value={form.address} onChange={(e) => set("address", e.target.value)} maxLength={PROFILE_LIMITS.address} className={`${inputClass} h-auto py-2`} />}
          </Field>

          <fieldset className="space-y-4 rounded-xl border border-line p-4">
            <legend className="px-1 text-[15px] font-semibold text-ink">Emergency contact</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name" error={errors.emergencyName}>
                {(p) => <input {...p} type="text" autoComplete="off" value={form.emergencyName} onChange={(e) => set("emergencyName", e.target.value)} maxLength={PROFILE_LIMITS.name} className={inputClass} />}
              </Field>
              <Field label="Relationship" error={errors.emergencyRelationship}>
                {(p) => (
                  <select {...p} value={form.emergencyRelationship} onChange={(e) => set("emergencyRelationship", e.target.value as ContactDetails["emergencyRelationship"])} className={inputClass}>
                    {RELATIONSHIPS.map((r) => <option key={r}>{r}</option>)}
                  </select>
                )}
              </Field>
            </div>
            <Field label="Phone" error={errors.emergencyPhone} help="Someone other than you, who can be reached during the day.">
              {(p) => <input {...p} type="tel" inputMode="tel" autoComplete="off" value={form.emergencyPhone} onChange={(e) => set("emergencyPhone", e.target.value)} maxLength={PROFILE_LIMITS.phone.max} className={inputClass} />}
            </Field>
          </fieldset>

          {message && <p role={message.error ? "alert" : "status"} className={message.error ? "rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger" : "rounded-lg bg-positive-soft px-3 py-2 text-sm text-positive"}>{message.text}</p>}
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" disabled={!dirty || pending} onClick={() => { setForm(saved); setErrors({}); setMessage(null); }} className={buttonClass}>Undo changes</button>
            <button type="submit" disabled={!dirty || pending} className={primaryClass}>{pending ? "Saving…" : "Save changes"}</button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function PhotoCard({ profile }: { profile: StudentProfile }) {
  const [pending, start] = useTransition();
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const hasPhoto = profile.photoVersion !== null && !removed;
  const shown = preview ?? (hasPhoto ? `/api/student/photo?v=${encodeURIComponent(profile.photoVersion!)}` : null);

  const choose = (f: File | undefined) => {
    setError(null);
    setMessage(null);
    if (preview) URL.revokeObjectURL(preview);
    if (!f) {
      setFile(null);
      setPreview(null);
      return;
    }
    // A quick check for a better message; the server checks the real bytes.
    if (f.size > MAX_PHOTO_BYTES) {
      setError("The photo must be 1 MB or smaller.");
      setFile(null);
      setPreview(null);
      if (input.current) input.current.value = "";
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const upload = () => {
    if (!file) return;
    const form = new FormData();
    form.set("photo", file);
    start(async () => {
      const r = await uploadProfilePhoto(form);
      if (r.ok) {
        setMessage("Your photo was updated.");
        setRemoved(false);
        setFile(null);
        if (input.current) input.current.value = "";
      } else setError(r.error);
    });
  };

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-5">
        {/* eslint-disable-next-line @next/next/no-img-element -- a user photo served by our own route */}
        {shown ? <img src={shown} alt={`Photo of ${profile.identity.name}`} className="h-28 w-28 rounded-full object-cover ring-2 ring-line" /> : (
          <span role="img" aria-label="No photo yet" className="flex h-28 w-28 items-center justify-center rounded-full bg-brand/10 text-3xl font-bold text-brand ring-2 ring-line">{initialsOf(profile.identity.name)}</span>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-semibold text-ink">{profile.identity.name}</h2>
          <p className="text-[15px] text-muted">{profile.identity.number} · {profile.identity.group}</p>
        </div>
      </div>
      <div className="mt-5 space-y-3">
        <Field label="Profile photo" error={error ?? undefined} help="PNG or JPEG, up to 1 MB.">
          {(p) => <input {...p} ref={input} type="file" accept="image/png,image/jpeg" onChange={(e) => choose(e.target.files?.[0])} className="block w-full text-[15px] text-ink file:mr-3 file:rounded-lg file:border file:border-line file:bg-surface file:px-3 file:py-2 file:text-[15px] file:font-medium hover:file:bg-canvas" />}
        </Field>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={!file || pending} onClick={upload} className={primaryClass}><Upload size={16} aria-hidden /> {pending ? "Uploading…" : "Use this photo"}</button>
          {hasPhoto && !file && (
            <button type="button" disabled={pending} onClick={() => start(async () => {
              const r = await removeProfilePhoto();
              if (r.ok) { setRemoved(true); setMessage("Your photo was removed."); } else setError(r.error);
            })} className={buttonClass}><Trash2 size={16} aria-hidden /> Remove photo</button>
          )}
        </div>
        {message && <p role="status" className="text-sm text-positive">{message}</p>}
      </div>
    </Card>
  );
}
