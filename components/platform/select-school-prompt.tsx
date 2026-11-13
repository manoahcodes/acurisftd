import { divisionsLabel, tenantSystemLabel } from "@/config/institution";
import { setPlatformTenant } from "@/server/actions/platform-tenant";
import type { TenantSummary } from "@/types/platform";

/**
 * Shown instead of a school-level screen while no school is selected.
 * Each button is a form that stores the choice through a Server Action.
 */
export function SelectSchoolPrompt({ title, tenants }: { title: string; tenants: TenantSummary[] }) {
  return (
    <section className="mt-2 rounded-2xl border border-line bg-surface p-6 shadow-card">
      <h2 className="text-xl font-semibold text-ink">Select a school to view {title}</h2>
      <p className="mt-1 max-w-2xl text-[15px] text-muted">
        This page shows one school&apos;s records. Choose a school here, or use the school card in the
        sidebar at any time. The wording (Term or Semester) follows the school you choose.
      </p>
      <ul className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {tenants.map((t) => (
          <li key={t.id}>
            <form action={setPlatformTenant.bind(null, t.id)}>
              <button
                type="submit"
                className="w-full rounded-xl border border-line px-4 py-3 text-left hover:border-brand focus-visible:outline-2 focus-visible:outline-brand"
              >
                <span className="block font-medium text-ink">{t.name}</span>
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
