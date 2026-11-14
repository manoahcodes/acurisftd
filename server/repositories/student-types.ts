import type { InstitutionType } from "@/config/institution";
import type { Timetable } from "@/types/student";

/**
 * Who is asking. Every method reads and writes only this student's own records
 * inside this school. A real implementation must enforce that in its queries,
 * not in the UI.
 */
export type StudentContext = { tenantId: string; studentId: string; institutionType: InstitutionType };

/**
 * Everything the Student pages read and write. The mock keeps it in memory and
 * a SQLite file; swap it in ./index.ts for your own database. Dates are
 * "YYYY-MM-DD"; `now` is an ISO timestamp from the caller, so the repository
 * never reads the clock itself.
 */
export interface StudentRepository {
  // My timetable
  getTimetable(ctx: StudentContext): Promise<Timetable>;
}
