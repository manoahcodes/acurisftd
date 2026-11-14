import { timetableFor } from "@/lib/student/seed";
import type { StudentRepository } from "./student-types";

/**
 * Student data per school. The timetable is fixed sample data (the school sets
 * it, the student only reads it). Pages that let the student change something
 * keep that state here and save it to the SQLite file like the Teacher pages.
 */
export const mockStudentRepository: StudentRepository = {
  async getTimetable(ctx) {
    return timetableFor(ctx.institutionType);
  },
};
