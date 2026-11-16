import type { InstitutionType } from "@/config/institution";
import { formatKwacha } from "@/lib/money";
import type { FeeBalance, FeePolicy, Withheld } from "@/lib/fee-policy";
import type { StudentTerms } from "./terms";

/**
 * Sample fee positions until the Bursar's records are connected. Integer
 * ngwee. The status is stored (not worked out from the clock) because the
 * server never reads the date while prerendering.
 */
export const FEE_SEED: Record<InstitutionType, FeeBalance> = {
  primary: { balance: 185_000, dueOn: "2026-11-27", status: "due" },
  high_school: { balance: 240_000, dueOn: "2026-11-27", status: "due" },
  college: { balance: 320_000, dueOn: "2026-11-06", status: "overdue" },
  university: { balance: 0, dueOn: null, status: "paid" },
};

/**
 * Learners at schools do not pay their own fees, so they are pointed to a
 * parent or guardian and are not shown the amount. College and university
 * students see the amount.
 */
export const showsAmount = (terms: StudentTerms) => terms.tertiary;

const owed = (fee: FeeBalance) => formatKwacha(fee.balance);

/** The line shown in place of a withheld document. */
export function withheldMessage(terms: StudentTerms, fee: FeeBalance, forParent = false): { title: string; detail: string } {
  if (forParent) {
    return {
      title: "Available once the balance is cleared",
      detail: `Outstanding balance: ${owed(fee)}. Please visit the bursar's office to pay or ask about a payment plan.`,
    };
  }
  return {
    title: "Available once your balance is cleared",
    detail: showsAmount(terms)
      ? `Outstanding balance: ${owed(fee)}. Visit the bursary with your student number to pay or ask about a payment plan.`
      : "Please ask your parent or guardian to visit the bursar's office.",
  };
}

/** The neutral notice on My home and the bell. Empty when nothing is owed. */
export function feeNotice(terms: StudentTerms, fee: FeeBalance, policy: FeePolicy, withheld: Withheld): { title: string; detail: string; tone: "warn" | "bad" } | null {
  if (fee.balance <= 0) return null;
  const what = [withheld.examCard && "exam card", withheld.results && "result slip"].filter(Boolean).join(" and ");
  const tail = what ? ` Your ${what} will be available once your balance is cleared.` : "";
  return {
    title: fee.status === "overdue" ? "Fees are overdue" : "Fees are due",
    detail: showsAmount(terms)
      ? `Your balance is ${owed(fee)}.${tail}`
      : `There is a fee balance on your account. Please ask your parent or guardian to visit the bursar's office.${tail}`,
    tone: fee.status === "overdue" ? "bad" : "warn",
  };
}
