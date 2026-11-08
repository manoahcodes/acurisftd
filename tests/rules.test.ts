import { describe, expect, it } from "vitest";
import {
  INSTITUTIONS, INSTITUTION_TYPES, assertSharedSystem, divisionsShareSystem, resolveLabel, termsFor, type Division,
} from "@/config/institution";
import { ROLES } from "@/config/navigation";
import { ALL_DIVISIONS, inScope, onlyDivisions, scopeLabel, visibleDivisions } from "@/lib/division-scope";
import {
  SIDEBAR_COLLAPSED_WIDTH, SIDEBAR_DEFAULT, SIDEBAR_MAX, SIDEBAR_MIN, SIDEBAR_PREPAINT_SCRIPT,
  clampSidebarWidth, parseSidebarCollapsed, parseSidebarWidth,
} from "@/lib/sidebar-width";
import { iconNameFor } from "@/components/shell/nav-icons";
import { TENANTS } from "@/server/repositories/tenants-mock";

const d = (type: (typeof INSTITUTION_TYPES)[number]): Division => ({ id: type, name: type, code: type, institutionType: type });

describe("institution rules", () => {
  it("university and college use semesters; primary and high school use terms", () => {
    expect(INSTITUTIONS.university.system).toBe("semester");
    expect(INSTITUTIONS.college.system).toBe("semester");
    expect(INSTITUTIONS.high_school.system).toBe("term");
    expect(INSTITUTIONS.primary.system).toBe("term");
    expect(termsFor("university").period).toBe("Semester");
    expect(termsFor("high_school").period).toBe("Term");
  });
  it("a school cannot mix terms and semesters", () => {
    expect(divisionsShareSystem([d("primary"), d("high_school")])).toBe(true);
    expect(divisionsShareSystem([d("college"), d("university")])).toBe(true);
    expect(divisionsShareSystem([d("high_school"), d("university")])).toBe(false);
    expect(() => assertSharedSystem("X", [d("primary"), d("university")])).toThrow();
    expect(() => assertSharedSystem("X", [])).toThrow();
  });
  it("seed tenants obey the rule", () => {
    for (const t of TENANTS) expect(divisionsShareSystem(t.divisions), t.name).toBe(true);
  });
  it("resolves wording tokens", () => {
    expect(resolveLabel("{period} registration", termsFor("university"))).toBe("Semester registration");
  });
});

describe("division scopes", () => {
  const divs = [d("primary"), d("high_school")];
  it("whole-school roles see every division", () => {
    expect(inScope(ALL_DIVISIONS, "primary")).toBe(true);
    expect(visibleDivisions(ALL_DIVISIONS, divs)).toHaveLength(2);
    expect(scopeLabel(ALL_DIVISIONS, divs)).toBe("All divisions");
  });
  it("division roles see only theirs", () => {
    const s = onlyDivisions("high_school");
    expect(inScope(s, "primary")).toBe(false);
    expect(visibleDivisions(s, divs).map((x) => x.id)).toEqual(["high_school"]);
  });
});

describe("sidebar width", () => {
  it("clamps and parses safely", () => {
    expect(clampSidebarWidth(10)).toBe(SIDEBAR_MIN);
    expect(clampSidebarWidth(9999)).toBe(SIDEBAR_MAX);
    expect(parseSidebarWidth(undefined)).toBe(SIDEBAR_DEFAULT);
    expect(parseSidebarWidth("abc")).toBe(SIDEBAR_DEFAULT);
    expect(parseSidebarWidth("1e3")).toBe(SIDEBAR_DEFAULT);
    expect(parseSidebarWidth("999")).toBe(SIDEBAR_MAX);
    expect(parseSidebarWidth("320")).toBe(320);
    expect(parseSidebarCollapsed("1")).toBe(true);
    expect(parseSidebarCollapsed("0")).toBe(false);
  });

  /** Runs the pre-paint script against a fake document and returns the variable it set. */
  const run = (cookie: string) => {
    let set = "";
    const document = { cookie, documentElement: { style: { setProperty: (_: string, v: string) => (set = v) } } };
    new Function("document", SIDEBAR_PREPAINT_SCRIPT)(document);
    return set;
  };
  it("pre-paint script agrees with the server-side parsers", () => {
    expect(run("")).toBe(`${SIDEBAR_DEFAULT}px`);
    expect(run("stecia_sidebar_width=400")).toBe("400px");
    expect(run("a=1; stecia_sidebar_width=9999")).toBe(`${SIDEBAR_MAX}px`);
    expect(run("stecia_sidebar_width=12")).toBe(`${SIDEBAR_MIN}px`);
    expect(run("stecia_sidebar_width=garbage")).toBe(`${SIDEBAR_DEFAULT}px`);
    expect(run("stecia_sidebar_width=400; stecia_sidebar_collapsed=1")).toBe(`${SIDEBAR_COLLAPSED_WIDTH}px`);
    expect(run("stecia_sidebar_collapsed=0")).toBe(`${SIDEBAR_DEFAULT}px`);
  });
});

describe("sidebar icons", () => {
  it("every nav item and group of every role has its own icon", () => {
    const missing: string[] = [];
    for (const [role, cfg] of Object.entries(ROLES)) {
      const labels = [...cfg.nav.map((n) => n.label), ...(cfg.navGroups?.map((g) => g.label) ?? [])];
      for (const l of labels) if (iconNameFor(l) === "Circle") missing.push(`${role}: ${l}`);
    }
    expect(missing).toEqual([]);
  });
});
