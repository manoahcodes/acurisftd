import { INSTITUTIONS, type InstitutionType } from "@/config/institution";
import type { AccountKind } from "@/types/cashier";

/** Wording for the cashier role. Schools bill learners by class; colleges and universities bill students by programme. */
export type CashierTerms = {
  member: string;
  members: string;
  /** "Class" or "Programme". */
  group: string;
  tertiary: boolean;
  accountKinds: AccountKind[];
};

const SCHOOL: CashierTerms = { member: "Learner", members: "learners", group: "Class", tertiary: false, accountKinds: ["tuition", "transport", "meals", "other"] };
const TERTIARY: CashierTerms = { member: "Student", members: "students", group: "Programme", tertiary: true, accountKinds: ["tuition", "accommodation", "registration", "other"] };

export const cashierTermsFor = (type: InstitutionType): CashierTerms => (INSTITUTIONS[type].level === "tertiary" ? TERTIARY : SCHOOL);

export const ACCOUNT_LABELS: Record<AccountKind, string> = {
  tuition: "Tuition",
  transport: "Transport",
  meals: "Meals",
  accommodation: "Accommodation",
  registration: "Registration",
  other: "Other fees",
};
