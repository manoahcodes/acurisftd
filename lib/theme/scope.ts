import { isMultiTenant } from "@/config/deployment";
import type { RoleKey } from "@/config/navigation";

/**
 * DEMO ONLY. The mock session puts every non-admin user in one school
 * (Lusaka Hills), so a theme set for any other school would never be seen by
 * them. While this is on, those roles preview the school the Platform Admin has
 * selected. It is always off in single-school deployments. Turn it off (or delete it) once sessions carry each user's real
 * school: real users must only ever get their own school's look.
 */
export const PREVIEW_SELECTED_SCHOOL = isMultiTenant();

/**
 * Which school's look an area shows. `undefined` means the platform default.
 * School Admin screens follow the school workspace in use (the platform default
 * when none is open), so changes saved there show straight away. The Platform
 * Admin's screens never follow a school: they are not school workspaces.
 */
export function themeTenantFor(
  role: RoleKey,
  ownTenantId: string,
  selectedTenantId: string | undefined,
  preview: boolean = PREVIEW_SELECTED_SCHOOL,
): string | undefined {
  // The Platform Admin only sees platform-level screens, so it always gets the platform default look.
  if (role === "platform") return undefined;
  // The School Admin follows the school workspace it is in (none yet = platform default).
  if (role === "school-admin") return selectedTenantId;
  return preview ? (selectedTenantId ?? ownTenantId) : ownTenantId;
}
