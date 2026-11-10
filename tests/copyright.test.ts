import { describe, expect, it } from "vitest";
import { ACURIS_COPYRIGHT_TEXT, cleanCopyrightHolder, copyrightHolderFor } from "@/lib/theme/copyright";
import { parseBranding } from "@/lib/theme/validate";

describe("cleanCopyrightHolder", () => {
  it("keeps a plain name", () => expect(cleanCopyrightHolder("Zambezi University")).toBe("Zambezi University"));
  it("removes a typed symbol, word, year or range and a trailing full stop", () => {
    for (const typed of ["© 2026 Zambezi University.", "(c) 2019-2026 Zambezi University", "Copyright 2026, Zambezi University", "©2026 © Zambezi University..", "  2026   Zambezi   University  "])
      expect(cleanCopyrightHolder(typed)).toBe("Zambezi University");
  });
  it("does not damage names that merely contain digits", () => {
    expect(cleanCopyrightHolder("2U Academy")).toBe("2U Academy");
    expect(cleanCopyrightHolder("Class of 2026 Trust")).toBe("Class of 2026 Trust");
    expect(cleanCopyrightHolder("St. Mary's Ltd.")).toBe("St. Mary's Ltd");
  });
  it("is empty for empty or symbol-only input", () => {
    for (const v of ["", "   ", "©", "© 2026.", "(c) 2026 -"]) expect(cleanCopyrightHolder(v)).toBe("");
  });
});

describe("copyrightHolderFor", () => {
  it("uses the holder, else the school name", () => {
    expect(copyrightHolderFor({ copyrightHolder: "Zambezi Education Trust", name: "Zambezi University" })).toBe("Zambezi Education Trust");
    expect(copyrightHolderFor({ copyrightHolder: "", name: "Zambezi University" })).toBe("Zambezi University");
  });
  it("shows no school line when it would just repeat ACURIS", () => {
    expect(copyrightHolderFor({ copyrightHolder: "", name: "ACURIS" })).toBe("");
    expect(copyrightHolderFor({ copyrightHolder: "acuris.", name: "X" })).toBe("");
  });
  it("the fixed ACURIS line is exactly as specified", () => {
    expect(ACURIS_COPYRIGHT_TEXT).toBe("ACURIS by STECIA Digital Technologies.");
  });
});

describe("branding validation", () => {
  const base = {
    name: "Zambezi University", shortName: "ZU", tagline: "", email: "", phone: "", address: "",
    timezone: "Africa/Lusaka", welcomeMessage: "", loginBanner: "", documentHeader: "", documentFooter: "", signatureLine: "",
  };
  it("stores only the cleaned name", () => {
    const r = parseBranding({ ...base, copyrightHolder: "© 2024 Zambezi Trust." }, "");
    expect(r.ok && r.value.copyrightHolder).toBe("Zambezi Trust");
  });
  it("allows empty and rejects over-long values", () => {
    expect(parseBranding({ ...base, copyrightHolder: "" }, "").ok).toBe(true);
    expect(parseBranding({ ...base, copyrightHolder: "x".repeat(121) }, "").ok).toBe(false);
  });
});

describe("missing values", () => {
  it("do not throw", () => {
    expect(cleanCopyrightHolder(undefined)).toBe("");
    expect(copyrightHolderFor({ name: "Zambezi University" })).toBe("Zambezi University");
    expect(copyrightHolderFor({})).toBe("");
  });
});
