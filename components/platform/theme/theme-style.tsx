import { themeToCss } from "@/lib/theme/css";
import { DEFAULT_THEME } from "@/server/repositories/theme-types";
import type { ThemeSettings } from "@/types/theme";

/**
 * Injects the school's theme as CSS variables. The CSS is built only from a
 * validated hex colour and fixed option lists (see lib/theme/css.ts), never
 * from free text, so it is safe to inline. A corrupt stored theme falls back
 * to the default rather than breaking every page.
 */
export function ThemeStyle({ theme }: { theme: ThemeSettings }) {
  let css: string;
  try {
    css = themeToCss(theme);
  } catch {
    css = themeToCss(DEFAULT_THEME);
  }
  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}
