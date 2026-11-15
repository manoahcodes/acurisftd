import { beforeEach, describe, expect, it } from "vitest";
import { INSTITUTION_TYPES } from "@/config/institution";
import { MAX_PHOTO_BYTES, checkContact, initialsOf, readPhoto, sniffPhoto } from "@/lib/student/profile";
import { CONTACT_SEED, identityFor } from "@/lib/student/seed";
import { mockStudentRepository as repo, resetMockStudent } from "@/server/repositories/student-mock";
import type { StudentContext } from "@/server/repositories/student-types";

const ctx: StudentContext = { tenantId: "t1", studentId: "s1", institutionType: "high_school" };
const NOW = "2026-11-15T08:00:00.000Z";
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0];
beforeEach(() => resetMockStudent());

describe("Contact details", () => {
  it("accepts the seeded details", () => {
    expect(checkContact({ ...CONTACT_SEED })).toMatchObject({ ok: true });
  });
  it("cleans spacing and lower-cases the email", () => {
    const r = checkContact({ ...CONTACT_SEED, email: "  Chisomo.Banda@Example.ORG ", address: "  Plot  24,   Lusaka " });
    expect(r).toMatchObject({ ok: true, value: { email: "chisomo.banda@example.org", address: "Plot 24, Lusaka" } });
  });
  it("lets phone, email and address be empty", () => {
    expect(checkContact({ ...CONTACT_SEED, phone: "", email: "", address: "" })).toMatchObject({ ok: true });
  });
  it("rejects bad phone, email and a long address", () => {
    const r = checkContact({ ...CONTACT_SEED, phone: "abc", email: "no-at-sign", address: "x".repeat(201) });
    expect(r).toMatchObject({ ok: false, errors: { phone: expect.any(String), email: expect.any(String), address: expect.any(String) } });
  });
  it("requires the emergency contact in full", () => {
    const r = checkContact({ ...CONTACT_SEED, emergencyName: "", emergencyPhone: "", emergencyRelationship: "Neighbour" });
    expect(r).toMatchObject({ ok: false, errors: { emergencyName: expect.any(String), emergencyPhone: expect.any(String), emergencyRelationship: expect.any(String) } });
  });
  it("refuses the student's own number as the emergency contact", () => {
    const r = checkContact({ ...CONTACT_SEED, emergencyPhone: "+260 (971) 234-567" });
    expect(r).toMatchObject({ ok: false, errors: { emergencyPhone: expect.stringContaining("own number") } });
  });
  it("ignores non-text input and extra fields", () => {
    expect(checkContact({ phone: 5, email: {}, emergencyName: null }).ok).toBe(false);
    const r = checkContact({ ...CONTACT_SEED, name: "Hacker", number: "X-1" });
    expect(r).toMatchObject({ ok: true });
    expect(Object.keys((r as { value: object }).value).sort()).toEqual(["address", "email", "emergencyName", "emergencyPhone", "emergencyRelationship", "phone"]);
  });
});

describe("Photo checks", () => {
  it("goes by the bytes, not the name or claimed type", async () => {
    expect(sniffPhoto(new Uint8Array(PNG))).toBe("image/png");
    expect(sniffPhoto(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffPhoto(new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'/>"))).toBeUndefined();
    expect(sniffPhoto(new TextEncoder().encode("GIF89a"))).toBeUndefined();
    const svgAsPng = new File([new TextEncoder().encode("<svg onload=alert(1)>")], "me.png", { type: "image/png" });
    expect((await readPhoto(svgAsPng)).ok).toBe(false);
    const real = await readPhoto(new File([new Uint8Array(PNG)], "x.bin", { type: "text/html" }));
    expect(real).toMatchObject({ ok: true, photo: { type: "image/png", size: PNG.length } });
  });
  it("refuses empty, missing and oversized photos", async () => {
    expect((await readPhoto(new File([], "e.png"))).ok).toBe(false);
    expect((await readPhoto(null)).ok).toBe(false);
    expect((await readPhoto("not a file")).ok).toBe(false);
    expect((await readPhoto(new File([new Uint8Array(MAX_PHOTO_BYTES + 1)], "big.png"))).ok).toBe(false);
  });
  it("makes initials", () => {
    expect(initialsOf("Chisomo Banda")).toBe("CB");
    expect(initialsOf("  mwansa  ")).toBe("M");
    expect(initialsOf("")).toBe("");
  });
});

describe("Profile repository", () => {
  it.each(INSTITUTION_TYPES)("has identity for %s set by the school", async (type) => {
    const p = await repo.getProfile({ ...ctx, institutionType: type });
    expect(p.identity).toEqual(identityFor(type));
    expect(p.identity.advisorTitle).toBe(type === "college" || type === "university" ? "Academic advisor" : "Class teacher");
    expect(p.photoVersion).toBeNull();
  });
  it("saves contact details and leaves the identity alone", async () => {
    const before = (await repo.getProfile(ctx)).identity;
    await repo.saveContact(ctx, { ...CONTACT_SEED, phone: "+260 955 000 111" }, NOW);
    const after = await repo.getProfile(ctx);
    expect(after.contact.phone).toBe("+260 955 000 111");
    expect(after.updatedAt).toBe(NOW);
    expect(after.identity).toEqual(before);
  });
  it("stores, serves and removes a photo", async () => {
    const photo = { type: "image/png" as const, size: PNG.length, data: Buffer.from(PNG).toString("base64") };
    await repo.savePhoto(ctx, photo, NOW);
    expect((await repo.getProfile(ctx)).photoVersion).toBe(NOW);
    expect(await repo.getPhoto(ctx)).toEqual(photo);
    expect(JSON.stringify(await repo.getProfile(ctx))).not.toContain(photo.data);
    expect((await repo.removePhoto(ctx, NOW)).ok).toBe(true);
    expect(await repo.getPhoto(ctx)).toBeUndefined();
    expect((await repo.removePhoto(ctx, NOW)).ok).toBe(false);
  });
  it("keeps each student's profile separate", async () => {
    await repo.saveContact(ctx, { ...CONTACT_SEED, address: "Mine only" }, NOW);
    expect((await repo.getProfile({ ...ctx, studentId: "s2" })).contact.address).toBe(CONTACT_SEED.address);
    await repo.savePhoto(ctx, { type: "image/png", size: 1, data: "AA==" }, NOW);
    expect(await repo.getPhoto({ ...ctx, studentId: "s2" })).toBeUndefined();
  });
});
