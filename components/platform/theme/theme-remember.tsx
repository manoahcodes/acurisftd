"use client";

import { useEffect } from "react";
import { THEME_CSS_KEY, THEME_PREPAINT_ID } from "@/lib/theme/prepaint";

/**
 * Remembers the theme CSS in this browser (see lib/theme/prepaint.ts) and drops
 * the early copy, since the real stylesheet is now on the page.
 */
export function ThemeRemember({ css }: { css: string }) {
  useEffect(() => {
    try {
      localStorage.setItem(THEME_CSS_KEY, css);
    } catch {
      /* storage blocked: the page just loads without the early colours */
    }
    document.getElementById(THEME_PREPAINT_ID)?.remove();
  }, [css]);
  return null;
}
