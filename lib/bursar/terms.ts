import { INSTITUTIONS, type InstitutionType } from "@/config/institution";
import { cashierTermsFor, type CashierTerms } from "@/lib/cashier/terms";

/** Wording for the Bursar role: the cashier's, plus who pays and what the billing period is called. */
export type BursarTerms = CashierTerms & {
  type: InstitutionType;
  /** "Parent or guardian" at a school, "Sponsor" at a college or university. */
  payer: string;
  /** "Term" or "Semester". */
  period: string;
};

export const bursarTermsFor = (type: InstitutionType): BursarTerms => {
  const tertiary = INSTITUTIONS[type].level === "tertiary";
  return { ...cashierTermsFor(type), type, payer: tertiary ? "Sponsor" : "Parent or guardian", period: tertiary ? "Semester" : "Term" };
};
