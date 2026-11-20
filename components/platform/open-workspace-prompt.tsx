import { divisionsLabel, tenantSystemLabel } from "@/config/institution";
import { isMultiTenant } from "@/config/deployment";
import { openWorkspace } from "@/server/actions/workspace";
import type { TenantSummary } from "@/types/platform";

/**
 * Lists the schools whose workspace can be opened. Opening one enters it as
 * School Admin (with a banner and an audit entry); that is the only route from
 * the Platform Admin to a school's students, finances and other records.
 * Each button is a form that calls a Server Action.
 */
export function OpenWorkspacePrompt({
  title,
  tenants,
  compact = false,
}: {
  title: string;
  tenants: TenantSummary[];
  /** Shown under the tenant table instead of in place of a page. */
  compact?: boolean;
}) {
  // A single-school deployment always has its school open, so there is nothing to choose.
  if (!isMultiTenant()) return null;
  return (
    <section className="mt-2 rounded-2xl border border-line bg-surface p-6 shadow-card">
      <h2 className="text-xl font-semibold text-ink">
        {compact ? "Open a school workspace" : `Open a school workspace to view ${title}`}
      </h2>
      <p className="mt-1 max-w-2xl text-[15px] text-muted">
        {compact
          ? "Students, finances, registrations, academics and hostels belong to each school's own admin. Entering a workspace opens it as School Admin, and the visit is recorded in the audit trail."
          : "This page shows one school's records, which the Platform Admin can only see inside that school's workspace. Choose a school to enter it; the visit is recorded in the audit trail."}
      </p>
      <ul className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {tenants.map((t) => (
          <li key={t.id}>
            <form action={openWorkspace.bind(null, t.id)}>
              <button
                type="submit"
                className="w-full rounded-xl border border-line px-4 py-3 text-left hover:border-brand focus-visible:outline-2 focus-visible:outline-brand"
              >
                <span className="block font-medium text-ink">Open {t.name}</span>
                <span className="block text-sm text-muted">
                  {divisionsLabel(t.divisions)} · {tenantSystemLabel(t.divisions)}
                </span>
              </button>
            </form>
          </li>
        ))}
      </ul>
    </section>
  );
}
