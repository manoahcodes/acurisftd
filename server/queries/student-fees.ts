import { withheldFor, type FeeBalance, type FeePolicy, type Withheld } from "@/lib/fee-policy";
import { student } from "../repositories";
import type { StudentSession } from "../student-context";

export type StudentFeeView = { fee: FeeBalance; policy: FeePolicy; withheld: Withheld };

/** The student's balance, their school's policy and what it holds back. */
export async function getStudentFeeView(s: Pick<StudentSession, "ctx" | "feePolicy">): Promise<StudentFeeView> {
  const fee = await student.getFees(s.ctx);
  return { fee, policy: s.feePolicy, withheld: withheldFor(s.feePolicy, fee) };
}
