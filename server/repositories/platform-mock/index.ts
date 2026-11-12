import type { PlatformScreenRepository } from "../platform-types";
import { applyOverlay, syncCountKpis } from "@/lib/forms/overlay";
import { entriesFor, offeredEntries } from "@/server/forms/registry";
import { recordScope } from "@/server/forms/scope";
import type { ScreenForms } from "@/types/forms";
import type { PlatformScreen } from "@/types/platform";
import { mockRecordStore } from "../records-mock";
import { buildForDivisions, isDivisionScoped, renumber } from "./divisions";
import { dataScreens } from "./data";
import { academicScreens } from "./academics";
import { examinationScreens } from "./examinations";
import { financeScreens } from "./finance";
import { hostelScreens } from "./hostels";
import { institutionScreens } from "./institution";
import { platformScreens } from "./platform";
import { registrationScreens } from "./registrations";
import { reportScreens } from "./reports";
import type { Builder } from "./shared";
import { userScreens } from "./users";

const SCREENS: Record<string, Builder> = {
  ...platformScreens,
  ...institutionScreens,
  ...financeScreens,
  ...userScreens,
  ...registrationScreens,
  ...academicScreens,
  ...examinationScreens,
  ...hostelScreens,
  ...dataScreens,
  ...reportScreens,
};

// The mock builds every screen from the institution type alone: all mock data
// belongs to one imaginary school, so it ignores ctx.tenant.id.
/** The screen's builder with form-created records and edits laid over its tables. */
const withRecords =
  (slug: string, build: Builder): Builder =>
  (ctx) => {
    let screen = build(ctx);
    const multi = (ctx.tenant?.divisions.length ?? 0) > 1;
    // Numbering first, so edit keys match what the table shows.
    if (isDivisionScoped(slug) && multi && ctx.division) screen = renumber(screen, ctx.division);

    const scope = recordScope(slug, ctx);
    const entries = entriesFor(slug, ctx);
    const tables = screen.tables.map((t) => {
      if (!t.id) return t;
      const spec = entries.find((e) => e.spec.tableId === t.id)?.spec;
      return applyOverlay(t, mockRecordStore.overlay(scope, t.id), spec?.keyColumns, spec?.keep);
    });
    // Count cards follow rows that were added or archived.
    return { ...screen, tables, kpis: syncCountKpis(screen.tables, tables, screen.kpis) };
  };

function attachForms(screen: PlatformScreen, slug: string, ctx: Parameters<Builder>[0]): PlatformScreen {
  const forms: ScreenForms = { actions: {}, edits: {}, rows: {} };
  const tableIds = new Set(screen.tables.map((t) => t.id));
  for (const { action, spec } of offeredEntries(slug, ctx)) {
    if (action && screen.actions?.includes(action)) forms.actions[action] = spec;
    if (!spec.createOnly && tableIds.has(spec.tableId)) forms.edits[spec.tableId] = spec;
    if (tableIds.has(spec.tableId) && !spec.editOnly) forms.rows[spec.tableId] = spec;
  }
  return Object.keys(forms.actions).length + Object.keys(forms.edits).length + Object.keys(forms.rows).length > 0 ? { ...screen, forms } : screen;
}

export const mockPlatformScreenRepository: PlatformScreenRepository = {
  async getScreen(ctx, slug) {
    const base = SCREENS[slug];
    if (!base) return undefined;
    const build = withRecords(slug, base);
    const screen = isDivisionScoped(slug) ? buildForDivisions(build, ctx) : build(ctx);
    return attachForms(screen, slug, ctx);
  },
};
