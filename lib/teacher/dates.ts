/** Calendar-date helpers on "YYYY-MM-DD" strings. They never read the clock. */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const parse = (iso: string) => new Date(`${iso}T00:00:00Z`);

export const addDays = (iso: string, n: number): string => {
  const d = parse(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export const isWeekend = (iso: string) => [0, 6].includes(parse(iso).getUTCDay());

/** The latest school day on or before `iso`. */
export const lastSchoolDay = (iso: string): string => {
  let d = iso;
  while (isWeekend(d)) d = addDays(d, -1);
  return d;
};

/** "Fri 13 Nov 2026". */
export const prettyDate = (iso: string): string => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const d = parse(iso);
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};

/** "13 Nov". */
export const shortDate = (iso: string): string => {
  const d = parse(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
};

/** The Monday of the week that contains `iso`. */
export const weekStart = (iso: string): string => {
  const d = parse(iso).getUTCDay();
  return addDays(iso, d === 0 ? -6 : 1 - d);
};
