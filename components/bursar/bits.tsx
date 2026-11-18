"use client";

import { Chip } from "@/components/teacher/shared";
import { accountStatusLabel, paymentStatusLabel, waiverStatusLabel } from "@/lib/bursar/format";
import type { AccountRow, Payment, Waiver } from "@/types/bursar";

export const AccountChip = ({ account }: { account: Pick<AccountRow, "status" | "owed"> }) => (
  <Chip tone={account.owed <= 0 ? "good" : account.status === "overdue" ? "bad" : "warn"}>{accountStatusLabel(account)}</Chip>
);

export const PaymentChip = ({ status }: { status: Payment["status"] }) => <Chip tone={status === "success" ? "good" : status === "pending" ? "warn" : "bad"}>{paymentStatusLabel(status)}</Chip>;

export const WaiverChip = ({ status }: { status: Waiver["status"] }) => <Chip tone={status === "approved" ? "good" : status === "pending" ? "warn" : "bad"}>{waiverStatusLabel(status)}</Chip>;

/** A message that screen readers announce. */
export const ErrorNote = ({ children }: { children: string }) => (
  <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{children}</p>
);

export const textareaClass =
  "min-h-20 w-full rounded-lg border border-line bg-surface px-3 py-2 text-[15px] text-ink placeholder:text-muted focus-visible:outline-2 focus-visible:outline-brand";
