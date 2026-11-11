"use server";

import { cookies } from "next/headers";
import { isMultiTenant } from "@/config/deployment";
import { PLATFORM_DIVISION_COOKIE, PLATFORM_TENANT_COOKIE } from "@/lib/platform-tenant";

/**
 * Stores the school the Platform Admin is working in. "all" clears the choice.
 * The value is only format-checked here; the reader (getTenantSelection)
 * ignores anything that isn't a real tenant.
 * Setting a cookie in a Server Action re-renders the current route.
 */
export async function setPlatformTenant(tenantId: string) {
  // Single-school deployments have nothing to switch to.
  if (!isMultiTenant()) return;
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(tenantId)) return;

  const store = await cookies();
  // A division belongs to one school, so changing school clears the division.
  store.delete(PLATFORM_DIVISION_COOKIE);
  if (tenantId === "all") {
    store.delete(PLATFORM_TENANT_COOKIE);
    return;
  }

  store.set(PLATFORM_TENANT_COOKIE, tenantId, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });
}

/**
 * Stores the division within the selected school. "all" clears it.
 * Only the format is checked here; the reader ignores an id that is not a
 * division of the selected school.
 */
export async function setPlatformDivision(divisionId: string) {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(divisionId)) return;

  const store = await cookies();
  if (divisionId === "all") {
    store.delete(PLATFORM_DIVISION_COOKIE);
    return;
  }

  store.set(PLATFORM_DIVISION_COOKIE, divisionId, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });
}
