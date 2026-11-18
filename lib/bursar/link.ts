import type { InstitutionType } from "@/config/institution";
import { studentsFor } from "@/lib/cashier/seed";

/**
 * Which student in the Bursar's records a signed-in student, or a guardian's
 * child, is. SWAP POINT: a real system links the user's account to their
 * student number. The mock matches a child's id to a first name ("natasha"
 * is Natasha Banda) and otherwise uses the first student on the roll.
 */
export function studentNoFor(type: InstitutionType, studentId: string): string {
  const roll = studentsFor(type);
  const id = studentId.trim().toLowerCase();
  return (roll.find((s) => s.name.split(" ")[0].toLowerCase() === id) ?? roll[0]).no;
}
