"use client";

import { useSyncExternalStore } from "react";
import { safeZone } from "@/lib/format";

const subscribe = () => () => {};
// The server never reads the clock (Cache Components forbids it), so the
// server render leaves the year empty and the browser fills it in.
const getServerSnapshot = () => "";

/** The year in the school's time zone, so it flips at that zone's midnight on 1 January. */
export function CopyrightYear({ timeZone }: { timeZone?: string }) {
  const year = useSyncExternalStore(
    subscribe,
    () => new Intl.DateTimeFormat("en-GB", { year: "numeric", timeZone: safeZone(timeZone) }).format(new Date()),
    getServerSnapshot,
  );
  return <>{year}</>;
}
