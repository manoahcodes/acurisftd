"use server";

import { revalidatePath } from "next/cache";
import { INSTITUTIONS, INSTITUTION_TYPES, divisionsShareSystem, type InstitutionType } from "@/config/institution";
import { ROLES } from "@/config/navigation";
import { askedFields, keyForRow } from "@/lib/forms/spec";
import { nextKey, normaliseKey } from "@/lib/forms/overlay";
import { readFormData, validateForm } from "@/lib/forms/validate";
import type { FormState } from "@/types/forms";
import { cellsFromValues } from "../forms/cells";
import { requirePlatformAdmin } from "../forms/guard";
import { FORM_SLUGS, entryById } from "../forms/registry";
import { recordScope } from "../forms/scope";
import { flavour } from "../repositories/platform-mock/shared";
import { isDivisionScoped } from "../repositories/platform-mock/divisions";
import { platformScreens, records, tenantDirectory } from "../repositories";
import { getTenantSelection } from "../queries/platform";

const fail = (message: string, extra: Partial<FormState> = {}): FormState => ({ status: "error", message, ...extra });
const ID = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * Creates or edits one record from a Platform Admin form.
 * Nothing the browser sends is trusted beyond the page, form id and the values
 * themselves: the form definition is rebuilt here, values are validated
 * against it, and the target school and division are checked against the
 * Platform Admin's real selection.
 */
export async function submitRecord(_prev: FormState, formData: FormData): Promise<FormState> {
  await requirePlatformAdmin();

  const slug = String(formData.get("slug") ?? "");
  const formId = String(formData.get("formId") ?? "");
  const mode = formData.get("mode") === "edit" ? "edit" : "create";
  const editKey = String(formData.get("rowKey") ?? "");
  const divisionId = String(formData.get("division") ?? "");

  if (!FORM_SLUGS.includes(slug) || !ID.test(formId)) return fail("That form is not available.");
  if (divisionId && !ID.test(divisionId)) return fail("That division is not valid.");

  const { tenants, selected, division } = await getTenantSelection();
  const item = ROLES.platform.nav.find((n) => n.slug === slug);
  if (item?.scope === "tenant" && !selected) return fail("Select a school first.");

  // Which division the record belongs to.
  const multi = (selected?.divisions.length ?? 0) > 1 && isDivisionScoped(slug);
  const target = multi ? (division ?? selected?.divisions.find((d) => d.id === divisionId)) : division;
  if (multi && !target) return fail("Choose a division.", { errors: { division: "Choose a division." } });
  const ctx = { tenant: selected ?? null, division: target ?? null, tenants };

  const entry = entryById(slug, formId, ctx, target?.id);
  if (!entry) return fail("That form is not available.");
  const { spec } = entry;
  if (mode === "create" && spec.editOnly) return fail("This form can only edit existing records.");
  if (mode === "edit" && spec.createOnly) return fail("These records cannot be edited.");

  const submitted = readFormData(spec, formData);
  const checked = validateForm(spec, submitted, mode);
  if (!checked.ok) return fail("Fix the highlighted fields.", { errors: checked.errors, values: submitted });
  const values = checked.values;

  // ---- Schools (tenants) ----
  if (spec.target === "tenant") {
    const name = String(values.name ?? "");
    const clash = tenants.find((t) => normaliseKey(t.name) === normaliseKey(name));
    if (mode === "create") {
      if (clash) return fail("A school with this name already exists.", { errors: { name: "Already exists." }, values: submitted });
      const types = (values.types as string[])
        .map((label) => INSTITUTION_TYPES.find((t) => INSTITUTIONS[t].label === label))
        .filter((t): t is InstitutionType => Boolean(t));
      const divisions = types.map((t) => ({ id: t, name: INSTITUTIONS[t].label, code: "", institutionType: t }));
      if (!divisionsShareSystem(divisions)) {
        return fail("A school uses one academic system.", {
          errors: { types: "Terms and semesters cannot be mixed. Combine school-level divisions with each other, or tertiary with tertiary." },
          values: submitted,
        });
      }
      await tenantDirectory.create({
        name, types,
        plan: values.plan as "Starter" | "Growth" | "Enterprise",
        status: values.status as "Active" | "Trial" | "Suspended",
        campuses: Number(values.campuses),
      });
      revalidatePath("/platform", "layout");
      return { status: "success", message: `${name} added.` };
    }

    const current = tenants.find((t) => normaliseKey(t.name) === normaliseKey(editKey));
    if (!current) return fail("That school no longer exists.");
    if (clash && clash.id !== current.id) return fail("A school with this name already exists.", { errors: { name: "Already exists." }, values: submitted });
    await tenantDirectory.update(current.id, {
      name,
      plan: values.plan as "Starter" | "Growth" | "Enterprise",
      status: values.status as "Active" | "Trial" | "Suspended",
      campuses: Number(values.campuses),
    });
    revalidatePath("/platform", "layout");
    return { status: "success", message: `${name} updated.` };
  }

  // ---- Table rows ----
  const screen = await platformScreens.getScreen(ctx, slug);
  const table = screen?.tables.find((t) => t.id === spec.tableId);
  if (!table) return fail("That table is not available.");
  const scope = recordScope(slug, ctx);
  // The merged all-divisions table has a Division column in front; its rows are per division.
  const offset = table.columns[0] === "Division" ? 1 : 0;
  const columns = table.columns.slice(offset);
  const rows = table.rows.map((r) => r.slice(offset));
  const flavourOf = flavour(ctx);

  if (mode === "create") {
    // System-generated numbers.
    const generated: Record<string, string> = {};
    for (const f of spec.fields) {
      if (!f.auto || !f.column) continue;
      const i = columns.indexOf(f.column);
      generated[f.column] = nextKey(rows.map((r) => r[i] ?? ""), f.auto.prefix, f.auto.digits);
    }
    const cells = {
      ...(spec.rowDefaults ?? {}),
      ...generated,
      ...cellsFromValues(askedFields(spec, "create"), values),
      ...(entry.derive?.(values, flavourOf) ?? {}),
    };
    const key = keyForRow(columns, columns.map((c) => cells[c] ?? "—"), spec.keyColumns);
    if (key === null) return fail("This form does not match its table.");
    if (rows.some((r) => normaliseKey(keyForRow(columns, r, spec.keyColumns) ?? "") === normaliseKey(key))) {
      return fail("This record already exists.", { values: submitted });
    }
    records.add(scope, spec.tableId, cells);
    revalidatePath("/platform", "layout");
    return { status: "success", message: "Saved." };
  }

  // Edit: find the row by key, then record only the changed (unlocked) columns.
  const row = rows.find((r) => keyForRow(columns, r, spec.keyColumns) === editKey);
  if (!row) return fail("That record no longer exists. Reload the page.");
  const cells = {
    ...cellsFromValues(askedFields(spec, "edit").filter((f) => !f.lockedOnEdit), values),
    ...(entry.deriveOnEdit ? entry.derive?.(values, flavourOf) ?? {} : {}),
  };
  records.edit(scope, spec.tableId, editKey, cells);
  revalidatePath("/platform", "layout");
  return { status: "success", message: "Saved." };
}
