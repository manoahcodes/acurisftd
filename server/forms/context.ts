import { ROLES } from "@/config/navigation";
import type { Division } from "@/config/institution";
import type { PlatformContext } from "../repositories/platform-types";
import { isDivisionScoped } from "../repositories/platform-mock/divisions";
import { getTenantSelection } from "../queries/platform";

const ID = /^[A-Za-z0-9_-]{1,64}$/;

export type ResolvedContext =
  | { ok: true; ctx: PlatformContext; target: Division | undefined }
  | { ok: false; message: string; field?: string };

/**
 * The school and division a form or process acts on, checked against the
 * admin's real selection (never against what the browser says).
 */
export async function resolveContext(slug: string, divisionId: string): Promise<ResolvedContext> {
  if (divisionId && !ID.test(divisionId)) return { ok: false, message: "That division is not valid." };
  const { tenants, selected, division } = await getTenantSelection();
  const item = ROLES.platform.nav.find((n) => n.slug === slug);
  if (item?.scope === "tenant" && !selected) return { ok: false, message: "Select a school first." };

  const multi = (selected?.divisions.length ?? 0) > 1 && isDivisionScoped(slug);
  const target = multi ? (division ?? selected?.divisions.find((d) => d.id === divisionId)) : division;
  if (multi && !target) return { ok: false, message: "Choose a division.", field: "division" };
  return { ok: true, ctx: { tenant: selected ?? null, division: target ?? null, tenants }, target };
}
