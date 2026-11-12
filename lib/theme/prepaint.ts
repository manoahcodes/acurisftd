/** localStorage key holding the last theme CSS this browser rendered. */
export const THEME_CSS_KEY = "acuris.theme-css";
export const THEME_PREPAINT_ID = "acuris-theme-prepaint";

/**
 * Runs in <head> before first paint. If this browser has shown a school's theme
 * before, its CSS is applied straight away, so the loading shell (and the first
 * paint of a page) uses the school's colours instead of flashing the defaults.
 * The real <ThemeStyle> replaces it as soon as the server has resolved the theme.
 * textContent is used so stored text can never become markup.
 */
export const THEME_PREPAINT_SCRIPT = `(function(){try{var c=localStorage.getItem(${JSON.stringify(THEME_CSS_KEY)});if(c&&c.length<20000){var s=document.createElement("style");s.id=${JSON.stringify(THEME_PREPAINT_ID)};s.textContent=c;document.head.appendChild(s)}}catch(e){}})();`;
