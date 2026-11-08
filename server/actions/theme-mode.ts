"use server";

import { cookies } from "next/headers";
import { MODE_COOKIE, parseModePreference } from "@/lib/theme/mode";

/**
 * Remembers this browser's light/dark choice. It is a personal display
 * preference, not a school setting, so any signed-in role may set it and it is
 * not tied to a school. Only the three allowed values are stored. Setting a
 * cookie in a Server Action re-renders the current route.
 */
export async function setModePreference(value: string) {
  const mode = parseModePreference(value);
  if (!mode) return;
  (await cookies()).set(MODE_COOKIE, mode, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });
}
