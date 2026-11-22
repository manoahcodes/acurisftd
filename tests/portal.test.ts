import { beforeEach, describe, expect, it } from "vitest";
import { cleanWebsiteUrl, externalHref } from "@/lib/portal/links";
import { isPortalPath, schoolSlugFromHost } from "@/lib/portal/host";
import { applyPortalOverride, diffPortal, isEmptyPortalOverride } from "@/lib/portal/merge";
import { parsePortalContent } from "@/lib/portal/validate";
import { mockPortalRepository, resetMockPortal } from "@/server/repositories/portal-mock";
import { DEFAULT_PORTAL } from "@/server/repositories/portal-types";

const base = () => structuredClone(DEFAULT_PORTAL);

describe("schoolSlugFromHost", () => {
  it("reads one subdomain label", () => {
    expect(schoolSlugFromHost("woodlands.localhost:3001", "localhost")).toBe("woodlands");
    expect(schoolSlugFromHost("Woodlands.Acuris.App", "acuris.app")).toBe("woodlands");
  });
  it("ignores the bare domain, reserved names and deeper hosts", () => {
    expect(schoolSlugFromHost("localhost:3000", "localhost")).toBeUndefined();
    expect(schoolSlugFromHost("www.acuris.app", "acuris.app")).toBeUndefined();
    expect(schoolSlugFromHost("a.b.acuris.app", "acuris.app")).toBeUndefined();
    expect(schoolSlugFromHost("evil.com", "acuris.app")).toBeUndefined();
    expect(schoolSlugFromHost("notacuris.app", "acuris.app")).toBeUndefined();
    expect(schoolSlugFromHost(null, "acuris.app")).toBeUndefined();
  });
  it("only rewrites the portal pages", () => {
    expect(isPortalPath("/")).toBe(true);
    expect(isPortalPath("/sign-in")).toBe(true);
    expect(isPortalPath("/teacher")).toBe(false);
  });
});

describe("external links", () => {
  it("cleans a website address", () => {
    expect(cleanWebsiteUrl("www.school.edu/")).toBe("https://www.school.edu");
    expect(cleanWebsiteUrl("https://school.edu/en/?x=1#y")).toBe("https://school.edu/en");
    expect(cleanWebsiteUrl("javascript:alert(1)")).toBeUndefined();
    expect(cleanWebsiteUrl("notaurl")).toBeUndefined();
    expect(cleanWebsiteUrl("")).toBeUndefined();
  });
  it("builds links on the school's website, or hides them", () => {
    expect(externalHref("https://school.edu", "/admissions")).toBe("https://school.edu/admissions");
    expect(externalHref("https://school.edu/", "admissions")).toBe("https://school.edu/admissions");
    expect(externalHref("https://school.edu", "")).toBe("https://school.edu");
    expect(externalHref("https://school.edu", "https://apply.school.edu/x")).toBe("https://apply.school.edu/x");
    expect(externalHref("", "/admissions")).toBeUndefined();
    expect(externalHref("https://school.edu", "javascript:alert(1)")).toBeUndefined();
  });
});

describe("parsePortalContent", () => {
  it("accepts the defaults", () => {
    expect(parsePortalContent(base()).ok).toBe(true);
  });
  it("normalises paths and the website", () => {
    const c = base();
    c.websiteUrl = "www.school.edu/";
    c.nav = [{ label: "Admissions", path: "admissions" }];
    const r = parsePortalContent(c);
    expect(r.ok && r.value.websiteUrl).toBe("https://www.school.edu");
    expect(r.ok && r.value.nav[0].path).toBe("/admissions");
  });
  it("rejects unsafe links, unknown icons and a closed register", () => {
    const c = base();
    c.nav = [{ label: "X", path: "javascript:alert(1)" }];
    c.features[0].icon = "skull";
    c.register.roles = { applicant: false, staff: false, parent: false };
    const r = parsePortalContent(c);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors["nav.0.path"]).toBeDefined();
      expect(r.errors["features.0.icon"]).toBeDefined();
      expect(r.errors["register.roles"]).toBeDefined();
    }
  });
  it("drops unknown keys and survives garbage", () => {
    expect(parsePortalContent(null).ok).toBe(false);
    const r = parsePortalContent({ ...base(), evil: "x" });
    expect(r.ok && "evil" in r.value).toBe(false);
  });
});

describe("portal images", () => {
  it("come only from the server, never from the submitted JSON", () => {
    const c = { ...base(), heroImage: "data:image/png;base64,EVIL", aboutImage: "https://evil.example/x.png" };
    const r = parsePortalContent(c, { heroImage: "data:image/png;base64,AAAA" });
    expect(r.ok && r.value.heroImage).toBe("data:image/png;base64,AAAA");
    expect(r.ok && r.value.aboutImage).toBe("");
  });
  it("follow the default until a school sets its own", () => {
    const def = base();
    def.heroImage = "data:image/png;base64,DEF";
    const next = structuredClone(def);
    next.aboutImage = "data:image/png;base64,OWN";
    const o = diffPortal(def, next);
    expect(Object.keys(o)).toEqual(["aboutImage"]);
    const merged = applyPortalOverride(def, o);
    expect(merged.heroImage).toBe("data:image/png;base64,DEF");
    expect(merged.aboutImage).toBe("data:image/png;base64,OWN");
  });
});

describe("hero slides", () => {
  const slide = { heading: "Open day", body: "", ctaLabel: "Book", ctaPath: "open-day" };
  it("need a server-built photo, and come back normalised", () => {
    const c = { ...base(), slides: [{ ...slide, image: "data:image/png;base64,EVIL" }] };
    const missing = parsePortalContent(c);
    expect(!missing.ok && missing.errors["slides.0.image"]).toBeDefined();
    const ok = parsePortalContent(c, { slideImages: ["data:image/png;base64,AAAA"] });
    expect(ok.ok && ok.value.slides[0].image).toBe("data:image/png;base64,AAAA");
    expect(ok.ok && ok.value.slides[0].ctaPath).toBe("/open-day");
  });
  it("allow at most five and reject unsafe button links", () => {
    const six = { ...base(), slides: Array.from({ length: 6 }, () => ({ ...slide })) };
    const r = parsePortalContent(six, { slideImages: Array(6).fill("data:image/png;base64,A") });
    expect(!r.ok && r.errors.slides).toBeDefined();
    const bad = parsePortalContent({ ...base(), slides: [{ ...slide, ctaPath: "javascript:alert(1)" }] }, { slideImages: ["data:image/png;base64,A"] });
    expect(!bad.ok && bad.errors["slides.0.ctaPath"]).toBeDefined();
  });
  it("are replaced as a whole by a school's override", () => {
    const next = structuredClone(base());
    next.slides = [{ ...slide, image: "data:image/png;base64,A" }];
    const o = diffPortal(base(), next);
    expect(Object.keys(o)).toEqual(["slides"]);
    expect(applyPortalOverride(base(), o).slides).toHaveLength(1);
  });
});

describe("override merge", () => {
  it("keeps only what differs and follows the default for the rest", () => {
    const next = base();
    next.hero.heading = "Our heading";
    const o = diffPortal(base(), next);
    expect(Object.keys(o)).toEqual(["hero"]);
    const changedDefault = base();
    changedDefault.footerNote = "New default";
    const merged = applyPortalOverride(changedDefault, o);
    expect(merged.hero.heading).toBe("Our heading");
    expect(merged.footerNote).toBe("New default");
    expect(isEmptyPortalOverride(diffPortal(base(), base()))).toBe(true);
  });
});

describe("portal repository", () => {
  beforeEach(() => resetMockPortal());
  it("resolves default plus the school's override, and clears it", async () => {
    const next = base();
    next.websiteUrl = "https://woodlands.edu";
    await mockPortalRepository.saveTenantOverride("woodlands", diffPortal(base(), next));
    expect((await mockPortalRepository.resolve("woodlands")).websiteUrl).toBe("https://woodlands.edu");
    expect((await mockPortalRepository.resolve("other")).websiteUrl).toBe("");
    await mockPortalRepository.clearTenantOverride("woodlands");
    expect((await mockPortalRepository.resolve("woodlands")).websiteUrl).toBe("");
  });
});
