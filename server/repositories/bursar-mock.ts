import { studentsFor } from "@/lib/cashier/seed";
import type { BursarContext, BursarRepository } from "./bursar-types";
import { positionOf, type LedgerScope } from "./ledger-store";

/** Bursar data for the school, kept with the shared ledger (./ledger-store). Filled in page by page. */
const scope = (c: BursarContext): LedgerScope => ({ tenantId: c.tenantId, institutionType: c.institutionType });

export const mockBursarRepository: BursarRepository = {
  async balanceOf(ctx, studentNo) {
    if (!studentsFor(ctx.institutionType).some((s) => s.no === studentNo)) return undefined;
    return positionOf(scope(ctx), studentNo);
  },
};

/** Test helper: forget everything. */
export { resetLedger as resetMockBursar } from "./ledger-store";
