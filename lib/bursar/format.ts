import { formatKwacha } from "@/lib/money";
import { prettyDate } from "@/lib/teacher/dates";
import { ACCOUNT_LABELS } from "@/lib/cashier/terms";
import { inEffect, scopeLabel } from "./fees";
import type { FeeItem } from "@/types/bursar";

/** Wording and table rows for the Bursar pages. Pure. */

export const FREQUENCY_LABEL = (f: FeeItem["frequency"], period: string) => (f === "year" ? "Per year" : `Per ${period.toLowerCase()}`);
export const BILLING_LABEL: Record<FeeItem["billing"], string> = { everyone: "Everyone it applies to", optional: "Optional" };

export type FeeState = "active" | "scheduled" | "off";

/** On and in effect, on but not yet in effect, or off. */
export const feeState = (f: Pick<FeeItem, "active" | "effectiveFrom">, today: string): FeeState => (!f.active ? "off" : inEffect(f, today) ? "active" : "scheduled");
export const feeStateLabel = (f: Pick<FeeItem, "active" | "effectiveFrom">, today: string) => {
  const s = feeState(f, today);
  return s === "active" ? "Active" : s === "scheduled" ? `Starts ${prettyDate(f.effectiveFrom)}` : "Off";
};

export const FEE_COLUMNS = ["Fee", "Account", "Applies to", "Amount", "Frequency", "Billed to", "Due", "Status"];
export function feeRows(fees: FeeItem[], period: string, today: string): string[][] {
  return fees.map((f) => [f.name, ACCOUNT_LABELS[f.kind], scopeLabel(f.scope), formatKwacha(f.amount), FREQUENCY_LABEL(f.frequency, period), BILLING_LABEL[f.billing], prettyDate(f.dueOn), feeStateLabel(f, today)]);
}
