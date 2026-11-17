"use client";

import { Chip } from "@/components/teacher/shared";
import { statusLabel } from "@/lib/cashier/format";
import type { Receipt } from "@/types/cashier";

export const StatusChip = ({ status }: { status: Receipt["status"] }) => <Chip tone={status === "success" ? "good" : status === "pending" ? "warn" : "bad"}>{statusLabel(status)}</Chip>;
