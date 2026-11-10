import type { RoleKey } from "@/config/navigation";

/**
 * DEMO ONLY. The mock session puts every non-admin user in one school
 * (Lusaka Hills), so a theme set for any other school would never be seen by
 * them. While this is on, those roles preview the school the Platform Admin has
 * selected. Turn it off (or delete it) once sessions carry each user's real
 * school: real users must only ever get their own school's look.
 */
export const PREVIEW_SELECTED_SCHOOL = true;

/**
 * Which school's look an area shows. `undefined` means the platform default.
 * The Platform Admin's own screens follow the school they have selected (the
 * platform default when none is), so changes they save show straight away.
 */
export function themeTenantFor(
  role: RoleKey,
  ownTenantId: string,
  selectedTenantId: string | undefined,
  preview: boolean = PREVIEW_SELECTED_SCHOOL,
): string | undefined {
  if (role === "platform") return selectedTenantId;
  return preview ? (selectedTenantId ?? ownTenantId) : ownTenantId;
}
