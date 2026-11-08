import { cookies } from "next/headers";
import Link from "next/link";
import { Suspense } from "react";
import { ROLE_KEYS, isRoleKey } from "@/config/navigation";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import {
  SIDEBAR_COLLAPSED_COOKIE,
  SIDEBAR_COOKIE,
  SIDEBAR_DEFAULT,
  parseSidebarCollapsed,
  parseSidebarWidth,
} from "@/lib/sidebar-width";
import { effectiveMode, MODE_COOKIE, parseModePreference, selectedPreference } from "@/lib/theme/mode";
import { ThemeStyle } from "@/components/platform/theme/theme-style";
import { getResolvedTheme } from "@/server/queries/theme";
import { session } from "@/server/repositories";

type Params = Promise<{ role: string }>;

// The set of roles is fixed, so Next can prerender every role's shell.
export function generateStaticParams() {
  return ROLE_KEYS.map((role) => ({ role }));
}

// Next 16's instant-navigation check requires `params` to be read inside a
// <Suspense> boundary, so the layout only passes the promise down.
export default function RoleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Params;
}) {
  return (
    <Suspense fallback={<ShellFallback />}>
      <Shell params={params}>{children}</Shell>
    </Suspense>
  );
}

/** Reads params and the signed-in user (per-request data). */
async function Shell({ params, children }: { params: Params; children: React.ReactNode }) {
  const { role } = await params;

  // Unknown role: render a message instead of calling notFound(). A thrown 404
  // aborts Next's instant-navigation validation, which renders this layout with
  // placeholder params. Children are not rendered, so pages never run for it.
  if (!isRoleKey(role)) return <UnknownRole />;

  const user = await session.getCurrentUser();
  const { theme } = await getResolvedTheme(role);
  const cookieStore = await cookies();
  const sidebarWidth = parseSidebarWidth(cookieStore.get(SIDEBAR_COOKIE)?.value);
  const modeChoice = parseModePreference(cookieStore.get(MODE_COOKIE)?.value);
  const sidebarCollapsed = parseSidebarCollapsed(cookieStore.get(SIDEBAR_COLLAPSED_COOKIE)?.value);

  return (
    // `relative` makes this the containing block for absolutely positioned
    // descendants (such as sr-only text), so they can never extend the document
    // and add a page-level scrollbar next to the sidebar's and main's own.
    <div className="relative flex h-dvh overflow-hidden">
      <ThemeStyle theme={{ ...theme, mode: effectiveMode(theme.mode, modeChoice) }} />
      {/* First focusable element: keyboard users can jump past the sidebar and top bar. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-ink focus:shadow-lg"
      >
        Skip to content
      </a>
      <Sidebar role={role} userName={user.name} tenant={user.tenant} width={sidebarWidth} collapsed={sidebarCollapsed} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar role={role} userName={user.name} tenant={user.tenant} modePreference={selectedPreference(theme.mode, modeChoice)} />
        <main
          id="main-content"
          tabIndex={-1}
          className="relative flex-1 overflow-y-auto bg-canvas px-6 py-8 focus:outline-none lg:px-12"
        >
          {children}
        </main>
      </div>
    </div>
  );
}

function UnknownRole() {
  return (
    <main className="flex h-dvh items-center justify-center bg-canvas px-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-ink">Page not found</h1>
        <p className="mt-2 text-muted">That area of ACURIS does not exist.</p>
        <Link href="/" className="mt-6 inline-block font-medium text-ink underline">
          Back to start
        </Link>
      </div>
    </main>
  );
}

function ShellFallback() {
  return (
    <div className="flex h-dvh overflow-hidden">
      <aside
        style={{ width: `var(--sidebar-w, ${SIDEBAR_DEFAULT}px)` }}
        className="hidden shrink-0 bg-navy lg:block"
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="h-[72px] shrink-0 border-b border-line bg-surface" />
        <div className="flex-1 overflow-y-auto bg-canvas" />
      </div>
    </div>
  );
}