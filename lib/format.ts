export const DEFAULT_TIME_ZONE = "Africa/Lusaka";

/** A usable IANA zone: the given one if the runtime knows it, else Lusaka. */
export function safeZone(zone?: string): string {
  if (!zone) return DEFAULT_TIME_ZONE;
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: zone });
    return zone;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

/** "Thursday, 29 October 2026" in the school's time zone (Lusaka by default). */
export function formatLongDate(date: Date, zone?: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: safeZone(zone),
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("weekday")}, ${get("day")} ${get("month")} ${get("year")}`;
}

export const cn = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

/** "12 Nov 2026 08:41", in the school's time zone (Lusaka by default). */
export function formatStamp(iso: string, zone?: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    timeZone: safeZone(zone),
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("day")} ${get("month")} ${get("year")} ${get("hour")}:${get("minute")}`;
}

/** Today as "12 Nov 2026" and as "2026-11-12" in the given zone. Reads the clock: call in actions, not while rendering. */
export function todayIn(zone?: string, now: Date = new Date()): { display: string; iso: string } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit", month: "short", year: "numeric", timeZone: safeZone(zone),
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const iso = new Intl.DateTimeFormat("en-CA", { timeZone: safeZone(zone) }).format(now);
  return { display: `${get("day")} ${get("month")} ${get("year")}`, iso };
}

export const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Today in Lusaka time (the default zone). */
export const todayLusaka = (now: Date = new Date()) => todayIn(DEFAULT_TIME_ZONE, now);
