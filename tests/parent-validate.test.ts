import { describe, expect, it } from "vitest";
import { checkCompose, checkGuardianContact, checkLinkRequest, checkMeeting, checkPrefs, checkReply, checkRsvp } from "@/lib/parent/validate";

const TODAY = "2026-11-16"; // a Monday

describe("checkMeeting", () => {
  const ok = { childId: "chisomo", staffId: "t-mth", date: "2026-11-19", slot: "Morning", topic: "How to help with maths" };
  it("accepts a school day in the window", () => expect(checkMeeting(ok, TODAY).ok).toBe(true));
  it("refuses today, the past, weekends and dates too far ahead", () => {
    for (const date of ["2026-11-16", "2026-11-10", "2026-11-21", "2027-03-01", "nonsense"]) expect(checkMeeting({ ...ok, date }, TODAY).ok).toBe(false);
  });
  it("needs a topic and a real slot", () => {
    expect(checkMeeting({ ...ok, topic: "hi" }, TODAY).ok).toBe(false);
    expect(checkMeeting({ ...ok, slot: "Night" }, TODAY).ok).toBe(false);
  });
});

describe("messages", () => {
  it("trims and limits replies", () => {
    expect(checkReply({ body: "  Thank you  " })).toEqual({ ok: true, value: { body: "Thank you" } });
    expect(checkReply({ body: " " }).ok).toBe(false);
    expect(checkReply({ body: "x".repeat(2001) }).ok).toBe(false);
  });
  it("needs a recipient and a subject; the child is optional", () => {
    expect(checkCompose({ staffId: "bursar", subject: "Payment plan", body: "Hello", childId: "" })).toMatchObject({ ok: true, value: { childId: null } });
    expect(checkCompose({ staffId: "", subject: "x", body: "Hello" }).ok).toBe(false);
    expect(checkCompose({ staffId: "bursar", subject: "Payment plan", body: "Hello", childId: "bad id!" }).ok).toBe(false);
  });
});

describe("profile", () => {
  it("needs a phone or an email and valid formats", () => {
    expect(checkGuardianContact({ phone: "", email: "" }).ok).toBe(false);
    expect(checkGuardianContact({ phone: "abc" }).ok).toBe(false);
    expect(checkGuardianContact({ email: "Grace@Example.org", phone: "" })).toMatchObject({ ok: true, value: { email: "grace@example.org" } });
  });
  it("keeps at least one notification channel on", () => {
    expect(checkPrefs({ channels: { inApp: false, email: false, sms: false }, topics: {} }).ok).toBe(false);
    const r = checkPrefs({ channels: { email: true }, topics: { fees: true, other: true } });
    expect(r).toMatchObject({ ok: true, value: { channels: { email: true, inApp: false }, topics: { fees: true, results: false } } });
  });
  it("checks a link request", () => {
    expect(checkLinkRequest({ studentNumber: " stu-1048 ", relationship: "Mother" })).toMatchObject({ ok: true, value: { studentNumber: "STU-1048" } });
    expect(checkLinkRequest({ studentNumber: "1048", relationship: "Mother" }).ok).toBe(false);
    expect(checkLinkRequest({ studentNumber: "STU-1048", relationship: "Cousin" }).ok).toBe(false);
  });
});

describe("checkRsvp", () => {
  it("accepts going, not going and taking it back only", () => {
    expect([checkRsvp("going"), checkRsvp("not_going"), checkRsvp(null), checkRsvp("maybe")]).toEqual(["going", "not_going", null, undefined]);
  });
});
