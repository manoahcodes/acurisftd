import { describe, expect, it } from "vitest";
import { formatLongDate, formatStamp, safeZone, todayIn, todayLusaka } from "@/lib/format";

describe("time zones", () => {
  // 23:30 UTC on 31 Dec is already 1 Jan in Lusaka (UTC+2) and Nairobi (UTC+3), but not in London.
  const at = new Date("2026-12-31T23:30:00Z");
  it("uses the school's zone", () => {
    expect(todayIn("Africa/Lusaka", at).iso).toBe("2027-01-01");
    expect(todayIn("Europe/London", at).iso).toBe("2026-12-31");
    expect(formatLongDate(at, "Africa/Nairobi")).toBe("Friday, 1 January 2027");
    expect(formatStamp("2026-11-12T06:41:00Z", "Africa/Lusaka")).toBe("12 Nov 2026 08:41");
    expect(formatStamp("2026-11-12T06:41:00Z", "Africa/Nairobi")).toBe("12 Nov 2026 09:41");
  });
  it("falls back to Lusaka for a missing or unknown zone", () => {
    expect(safeZone()).toBe("Africa/Lusaka");
    expect(safeZone("Mars/Olympus")).toBe("Africa/Lusaka");
    expect(todayIn("Mars/Olympus", at).iso).toBe(todayLusaka(at).iso);
  });
});
