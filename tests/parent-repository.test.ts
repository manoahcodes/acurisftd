import { beforeEach, describe, expect, it } from "vitest";
import { mockParentRepository as repo, resetMockParent } from "@/server/repositories/parent-mock";
import type { ParentContext } from "@/server/repositories/parent-types";

const ctx: ParentContext = { tenantId: "t1", guardianId: "g1", institutionType: "high_school", childIds: ["chisomo", "natasha"] };
const other: ParentContext = { ...ctx, guardianId: "g2", childIds: ["zed"] };
const NOW = "2026-11-16T10:00:00.000Z";

beforeEach(() => resetMockParent());

describe("calendar", () => {
  it("records, changes and withdraws a reply, only for events that ask for one", async () => {
    await repo.setRsvp(ctx, "ev-open-day", "going");
    expect((await repo.listEvents(ctx)).find((e) => e.id === "ev-open-day")?.response).toBe("going");
    await repo.setRsvp(ctx, "ev-open-day", null);
    expect((await repo.listEvents(ctx)).find((e) => e.id === "ev-open-day")?.response).toBeNull();
    expect((await repo.setRsvp(ctx, "ev-fees", "going")).ok).toBe(false);
    expect((await repo.setRsvp(ctx, "nope", "going")).ok).toBe(false);
  });
  it("keeps one guardian's replies away from another", async () => {
    await repo.setRsvp(ctx, "ev-open-day", "going");
    expect((await repo.listEvents(other)).find((e) => e.id === "ev-open-day")?.response).toBeNull();
  });
});

describe("meetings", () => {
  const input = { childId: "chisomo", staffId: "t-mth", date: "2026-11-19", slot: "Morning" as const, topic: "Progress in maths" };
  it("refuses a child who is not linked and an unknown staff member", async () => {
    expect((await repo.requestMeeting(ctx, { ...input, childId: "zed" }, NOW)).ok).toBe(false);
    expect((await repo.requestMeeting(ctx, { ...input, staffId: "ghost" }, NOW)).ok).toBe(false);
    expect(await repo.listStaff(ctx, "zed")).toEqual([]);
  });
  it("saves a request once, then lets it be cancelled", async () => {
    const r = await repo.requestMeeting(ctx, input, NOW);
    expect(r.ok).toBe(true);
    expect((await repo.requestMeeting(ctx, input, NOW)).ok).toBe(false);
    if (r.ok) await repo.cancelMeeting(ctx, r.id!);
    expect((await repo.listMeetings(ctx))[0].state).toBe("cancelled");
    expect((await repo.listMeetings(other)).length).toBe(0);
  });
});

describe("messages", () => {
  it("starts with three unread threads and counts down as they are read", async () => {
    expect(await repo.countUnread(ctx)).toBe(3);
    await repo.setRead(ctx, "th-1", true);
    expect(await repo.countUnread(ctx)).toBe(2);
    await repo.markAllRead(ctx);
    expect(await repo.countUnread(ctx)).toBe(0);
  });
  it("a reply marks the thread read and moves it to the top", async () => {
    await repo.reply(ctx, "th-2", "Thank you", NOW);
    const [top] = await repo.listThreads(ctx);
    expect(top.id).toBe("th-2");
    expect(top.unread).toBe(false);
    expect(top.messages.at(-1)).toMatchObject({ from: "parent", body: "Thank you" });
    expect((await repo.reply(ctx, "nope", "x", NOW)).ok).toBe(false);
  });
  it("composes only to listed staff and linked children", async () => {
    expect((await repo.compose(ctx, { childId: "zed", staffId: "bursar", subject: "Hello", body: "Hi" }, NOW)).ok).toBe(false);
    expect((await repo.compose(ctx, { childId: null, staffId: "ghost", subject: "Hello", body: "Hi" }, NOW)).ok).toBe(false);
    expect((await repo.compose(ctx, { childId: "natasha", staffId: "bursar", subject: "Hello", body: "Hi" }, NOW)).ok).toBe(true);
  });
});

describe("profile", () => {
  it("saves contact details and preferences", async () => {
    await repo.saveContact(ctx, { phone: "+260 971 000 000", altPhone: "", email: "g@example.org", address: "Lusaka" }, NOW);
    expect(await repo.getProfile(ctx)).toMatchObject({ name: "Grace Banda", contact: { phone: "+260 971 000 000" }, updatedAt: NOW });
    const prefs = (await repo.getPrefs(ctx));
    prefs.channels.sms = true;
    await repo.savePrefs(ctx, prefs);
    expect((await repo.getPrefs(ctx)).channels.sms).toBe(true);
  });
  it("links a child only by request, once, and lets it be withdrawn while pending", async () => {
    const r = await repo.requestLink(ctx, { studentNumber: "STU-2001", relationship: "Mother", note: "" }, NOW);
    expect(r.ok).toBe(true);
    expect((await repo.requestLink(ctx, { studentNumber: "STU-2001", relationship: "Mother", note: "" }, NOW)).ok).toBe(false);
    if (r.ok) expect((await repo.withdrawLink(ctx, r.id!)).ok).toBe(true);
    expect((await repo.listLinkRequests(ctx))[0].state).toBe("withdrawn");
    expect(ctx.childIds).toEqual(["chisomo", "natasha"]);
  });
});
