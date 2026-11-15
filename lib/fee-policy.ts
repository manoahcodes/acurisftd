/**
 * What a school does when a student has an unpaid balance. Set per school by
 * the Platform Admin. Every option is a soft restriction: the student always
 * sees why and how much, never a blank screen.
 */
export const FEE_POLICIES = ["inform", "withhold_exam_card", "withhold_results", "withhold_both"] as const;
export type FeePolicy = (typeof FEE_POLICIES)[number];
export const DEFAULT_FEE_POLICY: FeePolicy = "inform";

export const FEE_POLICY_LABELS: Record<FeePolicy, string> = {
  inform: "Information only",
  withhold_exam_card: "Withhold exam card",
  withhold_results: "Withhold result slip",
  withhold_both: "Withhold exam card and result slip",
};

export function labelToPolicy(label: string): FeePolicy | undefined {
  return FEE_POLICIES.find((p) => FEE_POLICY_LABELS[p] === label);
}

export const isFeePolicy = (v: unknown): v is FeePolicy => typeof v === "string" && (FEE_POLICIES as readonly string[]).includes(v);

export type FeeStatus = "paid" | "due" | "overdue";

/** A student's own fee position, in integer ngwee. Read-only for the student. */
export type FeeBalance = {
  /** Outstanding amount in ngwee. 0 when cleared. */
  balance: number;
  /** Due date, YYYY-MM-DD, or null when nothing is owed. */
  dueOn: string | null;
  status: FeeStatus;
};

export type Withheld = { examCard: boolean; results: boolean };

/** Which documents the policy holds back for this balance. Cleared balances withhold nothing. */
export function withheldFor(policy: FeePolicy, fee: FeeBalance): Withheld {
  if (fee.balance <= 0) return { examCard: false, results: false };
  return {
    examCard: policy === "withhold_exam_card" || policy === "withhold_both",
    results: policy === "withhold_results" || policy === "withhold_both",
  };
}

/** Status from balance and due date; `today` is YYYY-MM-DD. */
export function statusOf(balance: number, dueOn: string | null, today: string): FeeStatus {
  if (balance <= 0) return "paid";
  return dueOn && dueOn < today ? "overdue" : "due";
}
