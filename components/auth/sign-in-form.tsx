"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { ROLES, ROLE_KEYS, type RoleKey } from "@/config/navigation";
import { inputClass } from "@/components/platform/record-form";

/**
 * Demo sign-in: nothing is checked and nothing is sent anywhere. It only
 * continues into the role you pick. SWAP POINT: replace onSubmit with a real
 * sign-in call and redirect by the signed-in user's role.
 */
export function SignInForm() {
  const router = useRouter();
  const id = useId();
  const [role, setRole] = useState<RoleKey>("platform");

  return (
    <form
      className="mt-6 space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        router.push(`/${role}`);
      }}
    >
      <div>
        <label htmlFor={`${id}-email`} className="mb-1 block text-sm font-medium text-ink">Email</label>
        <input id={`${id}-email`} type="email" autoComplete="username" placeholder="you@school.edu" className={inputClass} />
      </div>
      <div>
        <label htmlFor={`${id}-password`} className="mb-1 block text-sm font-medium text-ink">Password</label>
        <input id={`${id}-password`} type="password" autoComplete="current-password" className={inputClass} />
      </div>
      <div>
        <label htmlFor={`${id}-role`} className="mb-1 block text-sm font-medium text-ink">Continue as</label>
        <select id={`${id}-role`} value={role} onChange={(e) => setRole(e.target.value as RoleKey)} className={inputClass}>
          {ROLE_KEYS.map((k) => (
            <option key={k} value={k}>{ROLES[k].label}</option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        className="w-full rounded-lg bg-brand px-4 py-2.5 text-[15px] font-semibold text-on-brand hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        Sign in
      </button>
      <p className="text-center text-sm text-muted">Demo only: any details continue, and no account is checked.</p>
    </form>
  );
}
