import { ROLES } from "@/config/navigation";
import type { PlatformContext } from "../repositories/platform-types";
import { isDivisionScoped } from "../repositories/platform-mock/divisions";

/**
 * Whose records a form writes to. Platform-wide pages share one scope; school
 * pages are per school, and per division where the page is split by division.
 */
export function recordScope(slug: string, ctx: PlatformContext): string {
  const item = ROLES.platform.nav.find((n) => n.slug === slug);
  if (item?.scope === "platform") return "platform";
  const tenant = ctx.tenant?.id ?? "all";
  if (!isDivisionScoped(slug)) return `${tenant}:-`;
  const division = ctx.division ?? ctx.tenant?.divisions[0];
  return `${tenant}:${division?.id ?? "-"}`;
}
