"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { BookOpenCheck, Briefcase, Users } from "lucide-react";
import { cn } from "@/lib/format";
import { inputClass } from "@/components/platform/record-form";
import type { PortalSignUpRoles } from "@/types/portal";

type Kind = keyof PortalSignUpRoles;

const KINDS: Record<Kind, { title: string; body: string; icon: typeof Users; invite: boolean }> = {
  applicant: { title: "Applicant / student", body: "I want to apply, or I have been admitted.", icon: BookOpenCheck, invite: false },
  staff: { title: "Staff", body: "I work here and have an invite code.", icon: Briefcase, invite: true },
  parent: { title: "Parent or guardian", body: "My child studies here and I have an invite code.", icon: Users, invite: true },
};

/**
 * Demo sign-up: nothing is checked or stored. It only shows the confirmation.
 * SWAP POINT: replace onSubmit with a real sign-up call (applications for
 * applicants; invite-code redemption for staff and parents).
 */
export function PortalRegisterForm({ roles, base }: { roles: PortalSignUpRoles; base: string }) {
  const id = useId();
  const open = (Object.keys(KINDS) as Kind[]).filter((k) => roles[k]);
  const [kind, setKind] = useState<Kind>(open[0]);
  const [done, setDone] = useState(false);
  const info = KINDS[kind];

  if (done) {
    return (
      <div role="status" className="rounded-2xl border border-line bg-surface p-8 text-center shadow-card">
        <h2 className="text-xl font-bold text-ink">Thank you</h2>
        <p className="mt-2 text-muted">
          {kind === "applicant"
            ? "Your application would be sent to the admissions office now."
            : "Your invite code would be checked and your account created now."}{" "}
          This is a demo, so nothing was saved.
        </p>
        <Link href={`${base}/sign-in`} className="mt-6 inline-block rounded-lg bg-brand px-5 py-2.5 font-semibold text-on-brand hover:opacity-90">
          Go to sign in
        </Link>
      </div>
    );
  }

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        setDone(true);
      }}
    >
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink">I am joining as</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          {open.map((k) => {
            const Icon = KINDS[k].icon;
            const on = k === kind;
            return (
              <label
                key={k}
                className={cn(
                  "cursor-pointer rounded-xl border bg-surface p-4 has-focus-visible:outline-2 has-focus-visible:outline-brand",
                  on ? "border-brand ring-1 ring-brand" : "border-line hover:border-brand",
                )}
              >
                <input type="radio" name="kind" value={k} checked={on} onChange={() => setKind(k)} className="sr-only" />
                <Icon aria-hidden className="size-5 text-brand" />
                <span className="mt-2 block text-sm font-semibold text-ink">{KINDS[k].title}</span>
                <span className="mt-1 block text-xs text-muted">{KINDS[k].body}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${id}-first`} className="mb-1 block text-sm font-medium text-ink">First name</label>
          <input id={`${id}-first`} required autoComplete="given-name" className={inputClass} />
        </div>
        <div>
          <label htmlFor={`${id}-last`} className="mb-1 block text-sm font-medium text-ink">Last name</label>
          <input id={`${id}-last`} required autoComplete="family-name" className={inputClass} />
        </div>
        <div>
          <label htmlFor={`${id}-email`} className="mb-1 block text-sm font-medium text-ink">Email</label>
          <input id={`${id}-email`} type="email" required autoComplete="email" className={inputClass} />
        </div>
        <div>
          <label htmlFor={`${id}-phone`} className="mb-1 block text-sm font-medium text-ink">Phone</label>
          <input id={`${id}-phone`} type="tel" autoComplete="tel" className={inputClass} />
        </div>
        {info.invite && (
          <div className="sm:col-span-2">
            <label htmlFor={`${id}-code`} className="mb-1 block text-sm font-medium text-ink">Invite code</label>
            <input id={`${id}-code`} required autoComplete="off" placeholder="From the school office" className={inputClass} />
          </div>
        )}
        <div className="sm:col-span-2">
          <label htmlFor={`${id}-password`} className="mb-1 block text-sm font-medium text-ink">Password</label>
          <input id={`${id}-password`} type="password" required minLength={8} autoComplete="new-password" className={inputClass} />
        </div>
      </div>

      <button type="submit" className="w-full rounded-lg bg-brand px-4 py-2.5 text-[15px] font-semibold text-on-brand hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
        {kind === "applicant" ? "Start my application" : "Create account"}
      </button>
      <p className="text-center text-sm text-muted">
        Already have an account? <Link href={`${base}/sign-in`} className="font-medium text-brand underline">Sign in</Link>
      </p>
      <p className="text-center text-xs text-muted">Demo only: nothing is checked or saved.</p>
    </form>
  );
}
