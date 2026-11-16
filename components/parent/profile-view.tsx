"use client";

import { useState, useTransition } from "react";
import { Lock } from "lucide-react";
import { Card, Chip, Field, buttonClass, inputClass, primaryClass } from "@/components/teacher/shared";
import { requestChildLink, saveGuardianContact, saveNotificationPrefs, withdrawChildLink } from "@/server/actions/parent";
import { cn, formatStamp } from "@/lib/format";
import { LIMITS } from "@/lib/parent/validate";
import type { StudentTerms } from "@/lib/student/terms";
import { LINK_RELATIONSHIPS, NOTIFY_CHANNELS, NOTIFY_TOPICS, type GuardianContact, type GuardianProfile, type LinkRequest, type LinkState, type NotificationPrefs, type NotifyChannel, type NotifyTopic } from "@/types/parent";

type Note = { text: string; error: boolean } | null;
const CHANNEL_LABEL: Record<NotifyChannel, string> = { inApp: "In the app (the bell)", email: "Email", sms: "Text message" };
const TOPIC_LABEL: Record<NotifyTopic, string> = { attendance: "Attendance and absences", results: "Results and report cards", fees: "Fees and statements", events: "Calendar and events", messages: "Messages from staff" };
const LINK_TONE: Record<LinkState, { label: string; tone: "good" | "warn" | "bad" | "info" }> = { pending: { label: "Waiting for the school", tone: "warn" }, approved: { label: "Approved", tone: "good" }, declined: { label: "Declined", tone: "bad" }, withdrawn: { label: "Withdrawn", tone: "info" } };

const Banner = ({ note }: { note: Note }) => note && <p role={note.error ? "alert" : "status"} className={cn("rounded-lg px-3 py-2 text-sm", note.error ? "bg-danger-soft text-danger" : "bg-positive-soft text-positive")}>{note.text}</p>;

export function ProfileView({ profile, prefs, links, kids, terms, timezone }: { profile: GuardianProfile; prefs: NotificationPrefs; links: LinkRequest[]; kids: Array<{ id: string; name: string; grade: string }>; terms: StudentTerms; timezone: string }) {
  return (
    <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <div className="space-y-6">
        <Card>
          <h2 className="text-lg font-semibold text-ink">About you</h2>
          <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-muted"><Lock size={14} aria-hidden /> Set by the school. To correct anything here, speak to the school office.</p>
          <dl className="mt-4 divide-y divide-line text-[15px]">
            <div className="flex justify-between gap-4 py-2"><dt className="text-muted">Name</dt><dd className="font-medium text-ink">{profile.name}</dd></div>
            <div className="flex justify-between gap-4 py-2"><dt className="text-muted">Relationship</dt><dd className="font-medium text-ink">{profile.relationship}</dd></div>
            <div className="flex flex-wrap justify-between gap-4 py-2"><dt className="text-muted">Linked {terms.member.toLowerCase()}s</dt><dd className="font-medium text-ink">{kids.length ? kids.map((k) => `${k.name} (${k.grade})`).join(", ") : "None yet"}</dd></div>
          </dl>
        </Card>
        <LinkCard links={links} terms={terms} timezone={timezone} />
      </div>
      <div className="space-y-6">
        <ContactCard profile={profile} timezone={timezone} />
        <PrefsCard prefs={prefs} />
      </div>
    </div>
  );
}

const KEYS = ["phone", "altPhone", "email", "address"] as const;

function ContactCard({ profile, timezone }: { profile: GuardianProfile; timezone: string }) {
  const saved = profile.contact;
  const [form, setForm] = useState<GuardianContact>(saved);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [note, setNote] = useState<Note>(null);
  const [pending, start] = useTransition();
  const dirty = KEYS.some((k) => form[k] !== saved[k]);
  const set = (k: keyof GuardianContact, v: string) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <Card>
      <form noValidate className="space-y-5" onSubmit={(e) => { e.preventDefault(); setNote(null); setErrors({}); start(async () => { const r = await saveGuardianContact({ ...form }); if (r.ok) setNote({ text: "Your details were saved.", error: false }); else { setErrors(r.fields ?? {}); setNote({ text: r.error, error: true }); } }); }}>
        <div>
          <h2 className="text-lg font-semibold text-ink">Your contact details</h2>
          <p className="text-sm text-muted">The school uses these to reach you. {profile.updatedAt ? `Last changed ${formatStamp(profile.updatedAt, timezone)}.` : ""}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phone" error={errors.phone}>{(p) => <input {...p} type="tel" inputMode="tel" autoComplete="tel" maxLength={20} value={form.phone} onChange={(e) => set("phone", e.target.value)} className={inputClass} />}</Field>
          <Field label="Another phone" error={errors.altPhone} help="Optional.">{(p) => <input {...p} type="tel" inputMode="tel" autoComplete="off" maxLength={20} value={form.altPhone} onChange={(e) => set("altPhone", e.target.value)} className={inputClass} />}</Field>
        </div>
        <Field label="Email" error={errors.email}>{(p) => <input {...p} type="email" autoComplete="email" maxLength={LIMITS.email} value={form.email} onChange={(e) => set("email", e.target.value)} className={inputClass} />}</Field>
        <Field label="Home address" error={errors.address} help="Optional.">{(p) => <textarea {...p} rows={2} autoComplete="street-address" maxLength={LIMITS.address} value={form.address} onChange={(e) => set("address", e.target.value)} className={`${inputClass} h-auto py-2`} />}</Field>
        <Banner note={note} />
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" disabled={!dirty || pending} onClick={() => { setForm(saved); setErrors({}); setNote(null); }} className={buttonClass}>Undo changes</button>
          <button type="submit" disabled={!dirty || pending} className={primaryClass}>{pending ? "Saving…" : "Save changes"}</button>
        </div>
      </form>
    </Card>
  );
}

function PrefsCard({ prefs: saved }: { prefs: NotificationPrefs }) {
  const [prefs, setPrefs] = useState(saved);
  const [note, setNote] = useState<Note>(null);
  const [pending, start] = useTransition();
  const dirty = JSON.stringify(prefs) !== JSON.stringify(saved);
  return (
    <Card>
      <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); setNote(null); start(async () => { const r = await saveNotificationPrefs(prefs); setNote(r.ok ? { text: "Your notification choices were saved.", error: false } : { text: r.error, error: true }); }); }}>
        <div>
          <h2 className="text-lg font-semibold text-ink">Notifications</h2>
          <p className="text-sm text-muted">Choose how you hear from the school and what about.</p>
        </div>
        <fieldset>
          <legend className="text-[15px] font-semibold text-ink">How</legend>
          <div className="mt-2 space-y-2">{NOTIFY_CHANNELS.map((c) => <label key={c} className="flex items-center gap-3 text-[15px] text-ink"><input type="checkbox" checked={prefs.channels[c]} onChange={(e) => setPrefs((p) => ({ ...p, channels: { ...p.channels, [c]: e.target.checked } }))} className="size-4 accent-brand" />{CHANNEL_LABEL[c]}</label>)}</div>
        </fieldset>
        <fieldset>
          <legend className="text-[15px] font-semibold text-ink">What about</legend>
          <div className="mt-2 space-y-2">{NOTIFY_TOPICS.map((t) => <label key={t} className="flex items-center gap-3 text-[15px] text-ink"><input type="checkbox" checked={prefs.topics[t]} onChange={(e) => setPrefs((p) => ({ ...p, topics: { ...p.topics, [t]: e.target.checked } }))} className="size-4 accent-brand" />{TOPIC_LABEL[t]}</label>)}</div>
        </fieldset>
        <Banner note={note} />
        <div className="flex justify-end"><button type="submit" disabled={!dirty || pending} className={primaryClass}>{pending ? "Saving…" : "Save choices"}</button></div>
      </form>
    </Card>
  );
}

function LinkCard({ links, terms, timezone }: { links: LinkRequest[]; terms: StudentTerms; timezone: string }) {
  const member = terms.member.toLowerCase();
  const [number, setNumber] = useState("");
  const [relationship, setRelationship] = useState("");
  const [text, setText] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [note, setNote] = useState<Note>(null);
  const [pending, start] = useTransition();
  return (
    <Card>
      <h2 className="text-lg font-semibold text-ink">Link another {member}</h2>
      <p className="mt-1 text-sm text-muted">Send a request and the school office will check it before anything is linked.</p>
      <form noValidate className="mt-4 space-y-4" onSubmit={(e) => { e.preventDefault(); setNote(null); setErrors({}); start(async () => { const r = await requestChildLink({ studentNumber: number, relationship, note: text }); if (r.ok) { setNumber(""); setRelationship(""); setText(""); setNote({ text: "Your request was sent. The school will contact you once it is reviewed.", error: false }); } else { setErrors(r.fields ?? {}); setNote({ text: r.error, error: true }); } }); }}>
        <Field label={`${terms.member} number`} error={errors.studentNumber} help="From the school card or an invoice, such as STU-1048." required>{(p) => <input {...p} autoComplete="off" maxLength={12} value={number} onChange={(e) => setNumber(e.target.value)} className={inputClass} />}</Field>
        <Field label="Your relationship" error={errors.relationship} required>{(p) => <select {...p} value={relationship} onChange={(e) => setRelationship(e.target.value)} className={inputClass}><option value="">Choose…</option>{LINK_RELATIONSHIPS.map((r) => <option key={r}>{r}</option>)}</select>}</Field>
        <Field label="Anything the school should know" error={errors.note} help="Optional.">{(p) => <textarea {...p} rows={2} maxLength={LIMITS.note} value={text} onChange={(e) => setText(e.target.value)} className={`${inputClass} h-auto py-2`} />}</Field>
        <Banner note={note} />
        <div className="flex justify-end"><button type="submit" disabled={pending} className={primaryClass}>{pending ? "Sending…" : "Send request"}</button></div>
      </form>
      {links.length > 0 && (
        <ul className="mt-5 divide-y divide-line border-t border-line" aria-label="Link requests">
          {links.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div><p className="text-[15px] font-medium text-ink">{l.studentNumber} · {l.relationship}</p><p className="text-sm text-muted">Sent {formatStamp(l.createdAt, timezone)}</p></div>
              <div className="flex items-center gap-2">
                <Chip tone={LINK_TONE[l.state].tone}>{LINK_TONE[l.state].label}</Chip>
                {l.state === "pending" && <button type="button" disabled={pending} onClick={() => start(async () => { const r = await withdrawChildLink(l.id); setNote(r.ok ? { text: "Your request was withdrawn.", error: false } : { text: r.error, error: true }); })} className={buttonClass}>Withdraw</button>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
