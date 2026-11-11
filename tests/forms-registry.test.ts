import { describe, expect, it } from "vitest";
import { INSTITUTION_TYPES, type Division, type InstitutionType, INSTITUTIONS } from "@/config/institution";
import { ROLES } from "@/config/navigation";
import { askedFields, keyForRow } from "@/lib/forms/spec";
import { validateForm } from "@/lib/forms/validate";
import { FORM_SLUGS, entriesFor, offeredEntries } from "@/server/forms/registry";
import { cellsFromValues } from "@/server/forms/cells";
import { mockPlatformScreenRepository } from "@/server/repositories/platform-mock";
import { flavour } from "@/server/repositories/platform-mock/shared";
import { TENANTS } from "@/server/repositories/tenants-mock";
import type { PlatformContext } from "@/server/repositories/platform-types";
import type { FormValues } from "@/types/forms";

const div = (type: InstitutionType): Division => ({ id: type, name: INSTITUTIONS[type].label, code: type.slice(0, 3).toUpperCase(), institutionType: type });

/** One school per institution type, plus the combined school, so every wording is covered. */
const contexts: Array<[string, PlatformContext]> = [
  ...INSTITUTION_TYPES.map((t): [string, PlatformContext] => {
    const tenant = { id: t, name: `${t} school`, divisions: [div(t)], campuses: 1, learners: 1, plan: "Growth" as const, status: "Active" as const };
    return [t, { tenant, division: null, tenants: TENANTS }];
  }),
  ["combined (all)", { tenant: TENANTS[0], division: null, tenants: TENANTS }],
  ["combined (primary)", { tenant: TENANTS[0], division: TENANTS[0].divisions[0], tenants: TENANTS }],
  ["platform", { tenant: null, division: null, tenants: TENANTS }],
];

// Buttons that are not forms (processes) and stay disabled on purpose.
const PROCESS_ACTIONS = new RegExp(
  "^(Import CSV|Add room|Change plan|Edit settings|Generate .*|Upload results|Publish results|Open .* registration|Import statement|Run backup now|Export data)$",
);

describe("form registry matches the screens", () => {
  it("only names real pages", () => {
    const slugs = new Set(ROLES.platform.nav.map((n) => n.slug));
    for (const s of FORM_SLUGS) expect(slugs.has(s), s).toBe(true);
  });

  for (const [label, ctx] of contexts) {
    for (const slug of FORM_SLUGS) {
      const item = ROLES.platform.nav.find((n) => n.slug === slug)!;
      if (item.scope === "tenant" && !ctx.tenant) continue;

      it(`${label}: ${slug}`, async () => {
        const screen = (await mockPlatformScreenRepository.getScreen(ctx, slug))!;
        expect(screen, "screen exists").toBeDefined();
        const f = flavour(ctx);

        for (const entry of offeredEntries(slug, ctx)) {
          const { spec } = entry;
          const table = screen.tables.find((t) => t.id === spec.tableId);
          expect(table, `table ${spec.tableId}`).toBeDefined();
          // The merged view has a Division column the record does not own.
          const columns = table!.columns.filter((c) => c !== "Division");

          for (const key of spec.keyColumns) expect(columns, `key ${key}`).toContain(key);
          for (const fld of spec.fields) if (fld.column) expect(columns, `field ${fld.name}`).toContain(fld.column);
          for (const col of Object.keys(spec.rowDefaults ?? {})) expect(columns, `default ${col}`).toContain(col);

          if (entry.action) expect(screen.actions, `action ${entry.action}`).toContain(entry.action);
          expect(screen.forms?.edits[spec.tableId] ?? undefined, "edit form attached").toBeDefined();

          // Field names are unique, selects have options, and derived columns exist.
          const names = spec.fields.map((x) => x.name);
          expect(new Set(names).size).toBe(names.length);
          for (const fld of spec.fields) {
            if (fld.type === "select" || fld.type === "multiselect") expect(fld.options?.length, fld.name).toBeGreaterThan(0);
          }
          const sample: FormValues = {};
          for (const fld of askedFields(spec, "create")) {
            sample[fld.name] =
              fld.type === "multiselect" ? [fld.options![0]]
              : fld.type === "select" ? fld.options![0]
              : fld.type === "date" ? "2026-11-10"
              : fld.type === "email" ? "a@b.co"
              : fld.type === "tel" ? "0977123456"
              : fld.type === "money" || fld.type === "number" ? String(Math.max(fld.min ?? 0, 1))
              : "Sample".slice(0, fld.maxLength ?? 6);
          }
          // A sample built from the form's own options must pass its own validation.
          const checked = validateForm(spec, sample, "create", { divisionId: spec.divisionChoices?.[0]?.id });
          expect(checked.ok, JSON.stringify(!checked.ok && checked.errors)).toBe(true);
          const derived = entry.derive?.(sample, f) ?? {};
          for (const col of Object.keys(derived)) expect(columns, `derived ${col}`).toContain(col);
          const cells = { ...spec.rowDefaults, ...cellsFromValues(spec.fields, sample), ...derived };
          expect(keyForRow(columns, columns.map((c) => cells[c] ?? "—"), spec.keyColumns)).not.toBeNull();
        }
      });
    }
  }

  it("every action button either opens a form or is a known process", async () => {
    for (const [label, ctx] of contexts) {
      for (const item of ROLES.platform.nav) {
        if (!item.slug || (item.scope === "tenant" && !ctx.tenant)) continue;
        const screen = await mockPlatformScreenRepository.getScreen(ctx, item.slug);
        for (const action of screen?.actions ?? []) {
          const hasForm = Boolean(screen?.forms?.actions[action]);
          expect(hasForm || PROCESS_ACTIONS.test(action), `${label} ${item.slug}: "${action}" has no form`).toBe(true);
        }
      }
    }
  });

  it("the combined school asks which division, and each division has its own fields", () => {
    const ctx = contexts.find(([l]) => l === "combined (all)")![1];
    const [students] = offeredEntries("users/students", ctx);
    expect(students.spec.divisionChoices?.map((d) => d.id)).toEqual(["primary", "high_school"]);
    const primaryNo = students.spec.variants!.primary.fields.find((f) => f.auto)!.auto!.prefix;
    const hsNo = students.spec.variants!.high_school.fields.find((f) => f.auto)!.auto!.prefix;
    expect(primaryNo).toBe("PRI-");
    expect(hsNo).toBe("HS-");
    // With one division picked the form is not split again.
    const one = entriesFor("users/students", { ...ctx, division: ctx.tenant!.divisions[0] })[0];
    expect(one.spec.divisionChoices).toBeUndefined();
  });
});
