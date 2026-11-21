import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { ThemeStyle } from "@/components/platform/theme/theme-style";
import { PortalLanding } from "@/components/portal/portal-landing";
import { PortalShell } from "@/components/portal/portal-shell";
import { ROLES, availableRoleKeys } from "@/config/navigation";
import { getPortalPage } from "@/server/queries/portal";
import { getTenantSelection } from "@/server/queries/platform";

/**
 * "/" is the landing page of the active school: the workspace the admin has
 * open, or the deployment's own school in a single-school install. With no
 * active school it falls back to the dev role picker.
 */
export default function Home() {
  return (
    <Suspense fallback={<main className="min-h-dvh bg-canvas" />}>
      <ActiveSchool />
    </Suspense>
  );
}

async function ActiveSchool() {
  await connection();
  const { selected } = await getTenantSelection();
  const page = selected ? await getPortalPage(selected.id) : undefined;
  if (!page) return <RolePicker />;
  const base = `/s/${page.tenant.id}`;
  return (
    <>
      <ThemeStyle theme={page.theme} />
      <PortalShell page={page} base={base}>
        <PortalLanding page={page} base={base} />
      </PortalShell>
    </>
  );
}

/** Dev-only role picker, shown when no school is active. Replace with real login + role-based redirect. */
function RolePicker() {
  return (
    <main className="mx-auto max-w-md px-6 py-20">
      <h1 className="text-3xl font-bold">ACURIS</h1>
      <p className="mt-2 text-muted">Pick a role to preview its dashboard.</p>
      <p className="mt-2 text-sm">
        <Link href="/sign-in" className="font-medium text-brand underline">Open the branded sign-in page</Link>
      </p>
      <ul className="mt-8 space-y-2">
        {availableRoleKeys().map((key) => (
          <li key={key}>
            <Link
              href={`/${key}`}
              className="block rounded-xl border border-line bg-surface px-4 py-3 font-medium hover:border-brand"
            >
              {ROLES[key].label}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
