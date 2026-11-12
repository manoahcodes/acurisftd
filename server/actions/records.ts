"use server";

import { isMultiTenant } from "@/config/deployment";
import { revalidatePath } from "next/cache";
import { INSTITUTIONS, INSTITUTION_TYPES, divisionsShareSystem, type InstitutionType } from "@/config/institution";
import { askedFields, keyForRow } from "@/lib/forms/spec";
import { normaliseKey } from "@/lib/forms/overlay";
import { readFormData, validateForm } from "@/lib/forms/validate";
import type { FormState } from "@/types/forms";
import { cellsFromValues } from "../forms/cells";
import { buildNewRow } from "../forms/create";
import { requirePlatformAdmin } from "../forms/guard";
import { FORM_SLUGS, entryById } from "../forms/registry";
import { recordScope } from "../forms/scope";
import { flavour } from "../repositories/platform-mock/shared";
import { audit, platformScreens, records, session, tenantDirectory } from "../repositories";
import { resolveContext } from "../forms/context";

/** Writes one line to the audit trail as the signed-in user. */
async function log(action: string, entity: string, scope: string, school: string) {
  const user = await session.getCurrentUser();
  audit.record({ user: user.name, action, entity, scope, school });
}

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
  const resolved = await resolveContext(slug, divisionId);
  if (!resolved.ok) {
    return fail(resolved.message, resolved.field ? { errors: { [resolved.field]: resolved.message } } : {});
  }
  const { ctx, target } = resolved;
  const { tenants } = ctx;

  const entry = entryById(slug, formId, ctx, target?.id);
  if (!entry) return fail("That form is not available.");
  const { spec } = entry;
  if (mode === "create" && spec.editOnly) return fail("This form can only edit existing records.");
  if (mode === "edit" && spec.createOnly) return fail("These records cannot be edited.");

  const submitted = readFormData(spec, formData);
  const checked = validateForm(spec, submitted, mode);
  if (!checked.ok) return fail("Fix the highlighted fields.", { errors: checked.errors, values: submitted });
  const values = checked.values;
  const crossErrors = entry.check?.(values);
  if (crossErrors) return fail("Fix the highlighted fields.", { errors: crossErrors, values: submitted });

  // ---- Schools (tenants) ----
  if (spec.target === "tenant") {
    if (!isMultiTenant()) return fail("This deployment hosts a single school.");
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
      await log("School added", `Tenants & schools: ${name}`, "platform", "Platform");
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
    await log("School edited", `Tenants & schools: ${name}`, "platform", "Platform");
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
    const built = buildNewRow(entry, values, columns, rows, flavourOf);
    if (!built.ok) return fail(built.message, { values: submitted });
    const { cells, key } = built;
    records.add(scope, spec.tableId, cells);
    await log("Record created", `${table.title}: ${key}`, ctx.tenant?.id ?? "platform", ctx.tenant?.name ?? "Platform");
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
  await log("Record edited", `${table.title}: ${editKey}`, ctx.tenant?.id ?? "platform", ctx.tenant?.name ?? "Platform");
  revalidatePath("/platform", "layout");
  return { status: "success", message: "Saved." };
}


export type RemovalOp = "archive" | "restore" | "delete";
export type RemovalResult = { status: "success" | "error"; message: string };

/**
 * Archives, restores or deletes one table row (or deletes a school).
 * Archive and restore work on any row. Delete only works on a row created
 * through a form whose table has no history (see FormSpec.keep), and on a
 * school with no learners; everything else is archived (or, for schools,
 * suspended). The row is found again on the server, never trusted from the browser.
 */
export async function removeRecord(input: {
  slug: string;
  formId: string;
  op: RemovalOp;
  rowKey: string;
  divisionId?: string;
}): Promise<RemovalResult> {
  await requirePlatformAdmin();
  const bad = (message: string): RemovalResult => ({ status: "error", message });
  const { slug, formId, op, rowKey, divisionId = "" } = input;

  if (!FORM_SLUGS.includes(slug) || !ID.test(formId)) return bad("That action is not available.");
  if (!["archive", "restore", "delete"].includes(op)) return bad("That action is not available.");
  const resolved = await resolveContext(slug, divisionId);
  if (!resolved.ok) return bad(resolved.message);
  const { ctx, target } = resolved;
  const { tenants } = ctx;

  const entry = entryById(slug, formId, ctx, target?.id);
  if (!entry) return bad("That action is not available.");
  const { spec } = entry;

  // ---- Schools: suspend through the status field; delete only when empty ----
  if (spec.target === "tenant") {
    if (!isMultiTenant()) return bad("This deployment hosts a single school.");
    if (op !== "delete") return bad("Schools are suspended or reactivated by editing their status.");
    const current = tenants.find((t) => normaliseKey(t.name) === normaliseKey(rowKey));
    if (!current) return bad("That school no longer exists.");
    if (!(await tenantDirectory.remove(current.id))) {
      return bad("This school has learners. Suspend it instead of deleting it.");
    }
    await log("School deleted", `Tenants & schools: ${current.name}`, "platform", "Platform");
    revalidatePath("/platform", "layout");
    return { status: "success", message: `${current.name} deleted.` };
  }

  const screen = await platformScreens.getScreen(ctx, slug);
  const table = screen?.tables.find((t) => t.id === spec.tableId);
  if (!table) return bad("That table is not available.");
  const offset = table.columns[0] === "Division" ? 1 : 0;
  const columns = table.columns.slice(offset);
  const index = table.rows.findIndex((r) => keyForRow(columns, r.slice(offset), spec.keyColumns) === rowKey);
  if (index < 0) return bad("That record no longer exists. Reload the page.");
  const meta = table.rowMeta?.[index];
  const scope = recordScope(slug, ctx);
  const school = ctx.tenant?.name ?? "Platform";
  const where = ctx.tenant?.id ?? "platform";

  if (op === "archive") {
    if (meta?.archived) return bad("Already archived.");
    records.archive(scope, spec.tableId, rowKey);
    await log("Record archived", `${table.title}: ${rowKey}`, where, school);
  } else if (op === "restore") {
    if (!meta?.archived) return bad("That record is not archived.");
    records.restore(scope, spec.tableId, rowKey);
    await log("Record restored", `${table.title}: ${rowKey}`, where, school);
  } else {
    if (spec.keep) return bad("This record has history, so it can only be archived.");
    if (!meta?.deletable) return bad("Only records you created can be deleted. Archive this one instead.");
    records.removeAdded(scope, spec.tableId, index, rowKey);
    await log("Record deleted", `${table.title}: ${rowKey}`, where, school);
  }
  revalidatePath("/platform", "layout");
  return { status: "success", message: op === "archive" ? "Archived." : op === "restore" ? "Restored." : "Deleted." };
}
