"use client";

import { useSyncExternalStore } from "react";
import { formatLongDate } from "@/lib/format";

// The date never changes while the page is open, so there is nothing to subscribe to.
const subscribe = () => () => {};
// What the server (and the first client render) shows: nothing yet.
const getServerSnapshot = () => "";

/**
 * Shows today's date in the school's time zone. The server never reads the
 * clock while prerendering (which Next 16 rejects); the date appears once the
 * page is in the browser. useSyncExternalStore does this without a state update
 * inside an effect, and server and client output cannot mismatch.
 */
export function TodayDate({ timeZone }: { timeZone?: string }) {
  const text = useSyncExternalStore(subscribe, () => formatLongDate(new Date(), timeZone), getServerSnapshot);

  // Reserve space so the layout doesn't jump when the date appears.
  return <span className="inline-block min-w-[14ch]">{text || " "}</span>;
}
