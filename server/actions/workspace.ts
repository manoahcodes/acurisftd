"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isMultiTenant } from "@/config/deployment";
import { PLATFORM_DIVISION_COOKIE, PLATFORM_TENANT_COOKIE } from "@/lib/platform-tenant";
import { requirePlatformAdmin } from "../forms/guard";
import { audit, session, tenantDirectory } from "../repositories";

const ID = /^[A-Za-z0-9_-]{1,64}$/;

const COOKIE_OPTIONS = {
  path: "/",
  maxAge: 60 * 60 * 24,
  sameSite: "lax" as const,
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
};

/**
 * Enters a school's workspace as School Admin. This is the only way a Platform
 * Admin reaches a school's records (students, fees, registrations, hostels...),
 * so every entry is written to the audit trail with who entered which school.
 * Single-school deployments have no workspaces to open.
 */
export async function openWorkspace(tenantId: string) {
  await requirePlatformAdmin();
  if (!isMultiTenant() || !ID.test(tenantId)) return;

  const tenant = (await tenantDirectory.list()).find((t) => t.id === tenantId);
  if (!tenant) return;

  const user = await session.getCurrentUser();
  audit.record({ user: user.name, action: "Workspace opened", entity: `${tenant.name} workspace`, scope: tenant.id, school: tenant.name });

  const store = await cookies();
  store.delete(PLATFORM_DIVISION_COOKIE);
  store.set(PLATFORM_TENANT_COOKIE, tenant.id, COOKIE_OPTIONS);
  redirect("/school-admin");
}

/** Leaves the school workspace and returns to the tenant-level Platform Admin. */
export async function exitWorkspace() {
  await requirePlatformAdmin();
  if (!isMultiTenant()) return;

  const store = await cookies();
  const id = store.get(PLATFORM_TENANT_COOKIE)?.value;
  const tenant = id ? (await tenantDirectory.list()).find((t) => t.id === id) : undefined;
  if (tenant) {
    const user = await session.getCurrentUser();
    audit.record({ user: user.name, action: "Workspace closed", entity: `${tenant.name} workspace`, scope: tenant.id, school: tenant.name });
  }
  store.delete(PLATFORM_DIVISION_COOKIE);
  store.delete(PLATFORM_TENANT_COOKIE);
  redirect("/platform");
}
