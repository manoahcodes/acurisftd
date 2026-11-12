"use server";

import { revalidatePath } from "next/cache";
import { safeZone } from "@/lib/format";
import { readFormData, validateForm } from "@/lib/forms/validate";
import type { FormSpec } from "@/types/forms";
import type { ProcessState } from "@/types/process";
import { resolveContext } from "../forms/context";
import { requirePlatformAdmin } from "../forms/guard";
import { processesFor } from "../processes/registry";
import { flavour } from "../repositories/platform-mock/shared";
import { audit, platformScreens, session } from "../repositories";
import { getResolvedTheme } from "../queries/theme";

const ID = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_FILE_BYTES = 1_000_000;
const fail = (message: string, extra: Partial<ProcessState> = {}): ProcessState => ({ status: "error", message, ...extra });

/**
 * Runs one job button (import, generate, publish...). Like submitRecord, nothing
 * the browser sends is trusted beyond the page, the button and the values: the
 * button is rebuilt here from the school's real data, values are validated
 * against it, and the school and division come from the admin's real selection.
 */
export async function runProcess(_prev: ProcessState, formData: FormData): Promise<ProcessState> {
  await requirePlatformAdmin();

  const slug = String(formData.get("slug") ?? "");
  const processId = String(formData.get("processId") ?? "");
  if (!ID.test(processId)) return fail("That action is not available.");

  const divisionId = String(formData.get("division") ?? "");
  const resolved = await resolveContext(slug, divisionId);
  if (!resolved.ok) return fail(resolved.message, resolved.field ? { errors: { [resolved.field]: resolved.message } } : {});
  const { ctx } = resolved;

  const screen = await platformScreens.getScreen(ctx, slug);
  if (!screen) return fail("That action is not available.");
  const entry = processesFor(slug, ctx, screen).find((e) => e.spec.id === processId);
  if (!entry || entry.spec.blocked) return fail(entry?.spec.intro ?? "That action is not available.");

  // Reuse the form checks for the questions the button asks.
  const asForm: FormSpec = { id: entry.spec.id, title: entry.spec.title, submitLabel: entry.spec.submitLabel, target: "row", tableId: "", keyColumns: [], fields: entry.spec.fields };
  const submitted = readFormData(asForm, formData);
  const checked = validateForm(asForm, submitted, "create");
  if (!checked.ok) return fail("Fix the highlighted fields.", { errors: checked.errors, values: submitted });

  let csv: string | undefined;
  if (entry.spec.csv) {
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) return fail("Choose a CSV file.");
    if (file.size > MAX_FILE_BYTES) return fail("That file is too large (1 MB at most).");
    csv = await file.text();
  }

  const user = await session.getCurrentUser();
  const outcome = await entry.run({ slug, ctx, screen, f: flavour(ctx), values: checked.values, csv, user: user.name, timeZone: safeZone((await getResolvedTheme("platform")).branding.timezone) });
  if (!outcome.ok) return fail(outcome.message, { problems: outcome.problems, errors: outcome.errors, values: submitted });

  audit.record({
    user: user.name,
    action: entry.spec.title,
    entity: outcome.entity,
    scope: ctx.tenant?.id ?? "platform",
    school: ctx.tenant?.name ?? "Platform",
  });
  revalidatePath("/platform", "layout");
  return { status: "success", message: outcome.message, problems: outcome.problems, download: outcome.download };
}
