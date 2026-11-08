import type { Mode } from "./options";

/** A person's own light/dark choice, remembered per browser. It overrides the school's Mode setting. */
export const MODE_COOKIE = "acuris_mode";
export const MODE_PREFERENCES = ["light", "dark", "system"] as const;
export type ModePreference = (typeof MODE_PREFERENCES)[number];

/** Reads the cookie value. Anything that is not one of the three choices means "no choice made". */
export function parseModePreference(value: string | undefined): ModePreference | undefined {
  return MODE_PREFERENCES.find((m) => m === value);
}

/** The mode to render: the person's choice if they made one, else the school's. "system" follows the device. */
export function effectiveMode(school: Mode, preference: ModePreference | undefined): Mode {
  if (!preference) return school;
  return preference === "system" ? "auto" : preference;
}

/** Which menu option to show as selected. With no personal choice it shows the school's mode. */
export function selectedPreference(school: Mode, preference: ModePreference | undefined): ModePreference {
  return preference ?? (school === "auto" ? "system" : school);
}
