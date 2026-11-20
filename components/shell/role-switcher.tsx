"use client";

import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { ROLES, availableRoleKeys, hrefFor, isRoleKey, type RoleKey } from "@/config/navigation";

/**
 * DEVELOPMENT ONLY. The topbar renders this only outside production. It simply
 * navigates to another role's URL, so it grants nothing: real access must come
 * from the session.
 */
export function RoleSwitcher({ role }: { role: RoleKey }) {
  const router = useRouter();

  return (
    <label
      className="relative hidden items-center xl:flex"
      title="Development only: not shown in production"
    >
      <span className="sr-only">View as role (development only)</span>
      <span
        aria-hidden
        className="pointer-events-none absolute left-2 rounded bg-amber-100 px-1 text-[10px] font-bold uppercase text-amber-800"
      >
        Dev
      </span>
      <select
        value={role}
        onChange={(e) => {
          const next = e.target.value;
          if (isRoleKey(next)) router.push(hrefFor(next, ""));
        }}
        className="h-10 cursor-pointer appearance-none rounded-lg border border-dashed border-line bg-transparent py-2 pl-11 pr-8 text-sm text-ink hover:bg-canvas"
      >
        {availableRoleKeys().map((key) => (
          <option key={key} value={key}>
            {ROLES[key].label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={14}
        aria-hidden
        className="pointer-events-none absolute right-2.5 text-muted"
      />
    </label>
  );
}