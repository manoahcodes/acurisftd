/** Desktop sidebar width in pixels. The width is remembered in a cookie so the server can render it. */
export const SIDEBAR_COOKIE = "stecia_sidebar_width";
export const SIDEBAR_MIN = 240;
export const SIDEBAR_MAX = 440;
export const SIDEBAR_DEFAULT = 280;

export const clampSidebarWidth = (px: number): number =>
  Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, Math.round(px)));

/** Reads the cookie value. Anything that is not a plain number gives the default. */
export function parseSidebarWidth(value: string | undefined): number {
  if (!value || !/^\d{2,4}$/.test(value)) return SIDEBAR_DEFAULT;
  return clampSidebarWidth(Number(value));
}

/** Collapsed icon rail. The expanded width above is kept, so expanding returns to it. */
export const SIDEBAR_COLLAPSED_COOKIE = "stecia_sidebar_collapsed";
export const SIDEBAR_COLLAPSED_WIDTH = 72;

export const parseSidebarCollapsed = (value: string | undefined): boolean => value === "1";

/**
 * Runs in <head> before first paint and copies the saved sidebar size into the
 * --sidebar-w CSS variable, so the loading placeholder is already the right
 * width while the real sidebar streams in. Built from the same constants and
 * rules as the parsers above.
 */
export const SIDEBAR_PREPAINT_SCRIPT = `(function(){try{var c=document.cookie;var m=c.match(/(?:^|; )${SIDEBAR_COOKIE}=(\\d{2,4})(?:;|$)/);var w=${SIDEBAR_DEFAULT};if(m){w=Math.min(${SIDEBAR_MAX},Math.max(${SIDEBAR_MIN},Math.round(+m[1])))}if(/(?:^|; )${SIDEBAR_COLLAPSED_COOKIE}=1(?:;|$)/.test(c)){w=${SIDEBAR_COLLAPSED_WIDTH}}document.documentElement.style.setProperty("--sidebar-w",w+"px")}catch(e){}})();`;
