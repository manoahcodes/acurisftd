import { useEffect, useRef } from "react";
import { THEME_FADE_CLASS } from "./mode";

/**
 * Keeps colours easing (see globals.css) while `active` is true, then switches
 * the fade off `hold` ms later, once the new colours have had time to arrive.
 * Used when a theme is saved and when the light/dark mode changes.
 */
export function useThemeFade(active: boolean, hold = 800) {
  const was = useRef(false);

  useEffect(() => {
    const root = document.documentElement;
    if (active) {
      was.current = true;
      root.classList.add(THEME_FADE_CLASS);
      return;
    }
    if (!was.current) return;
    was.current = false;
    const timer = setTimeout(() => root.classList.remove(THEME_FADE_CLASS), hold);
    return () => clearTimeout(timer);
  }, [active, hold]);

  useEffect(() => () => document.documentElement.classList.remove(THEME_FADE_CLASS), []);
}
