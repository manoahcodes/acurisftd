import type { MethodGroup, MethodId } from "@/types/cashier";

/**
 * The ways this school takes payment. SWAP POINT: the school sets these (Platform
 * Admin or Bursar); the cashier only reads them. Bank details here are sample data.
 */
export type PaymentMethod = {
  id: MethodId;
  label: string;
  group: MethodGroup;
  enabled: boolean;
  /** "Account name", "Account number" and the like, shown on the Payment methods page. */
  details: Array<[string, string]>;
  /** What to check before issuing a receipt. */
  instructions: string[];
};

const MOBILE_STEPS = ["Ask for the transaction ID in the confirmation message.", "Check the amount and the school's merchant number on the payer's phone.", "Confirm the receipt once the money shows on the school's account."];

export const PAYMENT_METHODS: PaymentMethod[] = [
  {
    id: "cash",
    label: "Cash",
    group: "cash",
    enabled: true,
    details: [],
    instructions: ["Count the cash in front of the payer.", "Issue the receipt only after the full amount is in your hands.", "Cash is counted again at cash-up."],
  },
  { id: "airtel_money", label: "Airtel Money", group: "mobile", enabled: true, details: [["Merchant number", "0977 000 111"], ["Merchant name", "School fees"]], instructions: MOBILE_STEPS },
  { id: "mtn_money", label: "MTN Mobile Money", group: "mobile", enabled: true, details: [["Merchant number", "0966 000 222"], ["Merchant name", "School fees"]], instructions: MOBILE_STEPS },
  { id: "zamtel_money", label: "Zamtel Money", group: "mobile", enabled: true, details: [["Merchant number", "0955 000 333"], ["Merchant name", "School fees"]], instructions: MOBILE_STEPS },
  {
    id: "bank_deposit",
    label: "Bank deposit or transfer",
    group: "bank",
    enabled: true,
    details: [["Bank", "Zanaco"], ["Account name", "School fees collection"], ["Account number", "0123 4567 8901"], ["Branch", "Cairo Road, Lusaka"]],
    instructions: ["Take the deposit slip or transfer reference.", "Ask the payer to write the student number on the slip.", "Confirm the receipt once the money shows on the bank statement."],
  },
];

export const methodOf = (id: string): PaymentMethod | undefined => PAYMENT_METHODS.find((m) => m.id === id);
export const enabledMethods = () => PAYMENT_METHODS.filter((m) => m.enabled);
export const METHOD_LABELS = Object.fromEntries(PAYMENT_METHODS.map((m) => [m.id, m.label])) as Record<MethodId, string>;
/** Cash is taken as received. Anything else waits for a phone or statement check. */
export const startsPending = (id: MethodId) => methodOf(id)?.group !== "cash";
