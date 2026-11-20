import { ShieldAlert } from "lucide-react";
import { isMultiTenant } from "@/config/deployment";
import { exitWorkspace } from "@/server/actions/workspace";
import { getTenantSelection } from "@/server/queries/platform";

/**
 * Shown on every School Admin page in the shared cloud while a Platform Admin
 * is inside a school's workspace, so it is always clear whose records are on
 * screen and that the visit is audited. Reads a cookie: use inside <Suspense>.
 */
export async function WorkspaceBanner() {
  if (!isMultiTenant()) return null;
  const { selected } = await getTenantSelection();
  if (!selected) return null;

  return (
    <div
      role="status"
      className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-warning/40 bg-warning-soft px-4 py-3 text-sm text-ink"
    >
      <ShieldAlert size={18} aria-hidden className="shrink-0" />
      <p className="min-w-0 flex-1">
        You are inside <strong>{selected.name}</strong>&apos;s workspace as Platform Admin. Your visit is recorded in the audit trail.
      </p>
      <form action={exitWorkspace}>
        <button
          type="submit"
          className="rounded-lg border border-line bg-surface px-3 py-1.5 font-medium hover:border-brand focus-visible:outline-2 focus-visible:outline-brand"
        >
          Exit workspace
        </button>
      </form>
    </div>
  );
}
