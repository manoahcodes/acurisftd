/** Icons a feature card may use. A closed list, so stored content can never name anything else. */
export const PORTAL_ICONS = ["book", "users", "calendar", "graduation", "building", "globe", "heart", "award"] as const;
export type PortalIcon = (typeof PORTAL_ICONS)[number];
export const isPortalIcon = (v: string): v is PortalIcon => (PORTAL_ICONS as readonly string[]).includes(v);
