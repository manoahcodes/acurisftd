import type { InstitutionType } from "@/config/institution";

/**
 * Who is asking, and which school day it is. The Bursar works on the whole
 * school's fee ledger, so every method reads and writes inside this tenant. A
 * real implementation must enforce that in its queries, not in the UI. `today`
 * is "YYYY-MM-DD" in the school's zone, worked out once per request by the
 * caller, so the repository never reads the clock itself.
 */
export type BursarContext = { tenantId: string; bursarId: string; bursarName: string; institutionType: InstitutionType; today: string };

/**
 * Everything the Bursar pages read and write. The mock keeps it in memory and a
 * SQLite file; swap it in ./index.ts for your own database. `now` is an ISO
 * timestamp from the caller. Money is integer ngwee.
 *
 * Rules the implementation must keep:
 * - What a student owes lives in one ledger (see ledger-store.ts) that the
 *   Cashier, Student and Parent pages also read, so every change here moves the
 *   balance everywhere.
 * - Money is never deleted. A payment is reversed with a reason and stays listed.
 *
 * Methods are added page by page as each Bursar page is built.
 */
export interface BursarRepository {
  /** One student's total owed and earliest due date, or undefined for a number that is not on the school's roll. */
  balanceOf(ctx: BursarContext, studentNo: string): Promise<{ balance: number; dueOn: string | null } | undefined>;
}
