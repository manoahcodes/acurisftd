import type { InstitutionType } from "@/config/institution";
import { WEEKDAYS, type StudentCourse, type Timetable, type TimetableChange, type TimetableSlot } from "@/types/student";

/**
 * Sample student, courses and weekly timetable for the mock. The subjects and
 * first-day order match the Student dashboard, so both show the same school
 * day. Real data replaces this.
 */

export type StudentProfileSeed = { name: string; number: string; group: string };

export const STUDENT_SEED: Record<InstitutionType, StudentProfileSeed> = {
  primary: { name: "Chisomo Banda", number: "PRI-1048", group: "Grade 3B" },
  high_school: { name: "Chisomo Banda", number: "STU-1048", group: "Grade 10A" },
  college: { name: "Chisomo Banda", number: "COL-1048", group: "Diploma in ICT, Year 2" },
  university: { name: "Chisomo Banda", number: "UNI-1048", group: "BSc Computer Science, Year 2" },
};

type CourseSeed = Omit<StudentCourse, "id">;

const COURSES: Record<InstitutionType, CourseSeed[]> = {
  primary: [
    { name: "Mathematics", code: "MAT", teacher: "Mrs. N. Mwale", room: "Room P-101", credits: null },
    { name: "English", code: "ENG", teacher: "Mr. B. Tembo", room: "Room P-101", credits: null },
    { name: "Science", code: "SCI", teacher: "Ms. M. Phiri", room: "Room P-102", credits: null },
    { name: "Social Studies", code: "SST", teacher: "Mr. J. Daka", room: "Room P-101", credits: null },
    { name: "Creative Arts", code: "ART", teacher: "Ms. G. Zulu", room: "Art room", credits: null },
    { name: "Religious Education", code: "RE", teacher: "Mr. P. Sakala", room: "Room P-104", credits: null },
  ],
  high_school: [
    { name: "Mathematics", code: "MTH", teacher: "Mr. K. Tembo", room: "Room A-101", credits: null },
    { name: "English", code: "ENG", teacher: "Ms. R. Mwale", room: "Room B-203", credits: null },
    { name: "Physics", code: "PHY", teacher: "Mr. D. Zulu", room: "Lab 2", credits: null },
    { name: "Biology", code: "BIO", teacher: "Mrs. E. Phiri", room: "Room C-104", credits: null },
    { name: "ICT", code: "ICT", teacher: "Mr. M. Daka", room: "Computer Lab", credits: null },
    { name: "History", code: "HIS", teacher: "Ms. F. Banda", room: "Room A-102", credits: null },
  ],
  college: [
    { name: "Database Systems", code: "DBS", teacher: "Mr. C. Mulenga", room: "Lab 3", credits: 4 },
    { name: "Web Development", code: "WEB", teacher: "Ms. T. Kunda", room: "Lab 1", credits: 4 },
    { name: "Communication Skills", code: "COM", teacher: "Mrs. L. Ngoma", room: "Room B-12", credits: 2 },
    { name: "Business Statistics", code: "BST", teacher: "Mr. H. Chola", room: "Room B-14", credits: 3 },
    { name: "Networking Fundamentals", code: "NET", teacher: "Mr. W. Musonda", room: "Lab 2", credits: 3 },
  ],
  university: [
    { name: "Algorithms", code: "CS301", teacher: "Dr. A. Mumba", room: "Lecture Hall 2", credits: 4 },
    { name: "Discrete Mathematics", code: "MA210", teacher: "Prof. S. Lungu", room: "Lecture Hall 4", credits: 3 },
    { name: "Operating Systems", code: "CS320", teacher: "Dr. J. Kapata", room: "Lab 5", credits: 4 },
    { name: "Research Methods", code: "RM200", teacher: "Dr. N. Bwalya", room: "Room N-210", credits: 2 },
    { name: "Database Systems", code: "CS310", teacher: "Dr. P. Nyirenda", room: "Lab 5", credits: 3 },
  ],
};

/** Sittings in a day: schools run five periods, tertiary four. */
const PERIODS: Record<InstitutionType, Array<[string, string]>> = {
  primary: [["08:00", "08:45"], ["09:00", "09:45"], ["10:30", "11:15"], ["11:30", "12:15"], ["13:30", "14:15"]],
  high_school: [["08:00", "09:00"], ["09:10", "10:10"], ["10:30", "11:30"], ["12:00", "13:00"], ["14:00", "15:00"]],
  college: [["08:00", "10:00"], ["10:15", "12:15"], ["13:00", "15:00"], ["15:15", "16:45"]],
  university: [["08:00", "10:00"], ["10:15", "12:15"], ["13:00", "15:00"], ["15:00", "17:00"]],
};

const BREAKS: Record<InstitutionType, Timetable["breaks"]> = {
  primary: [{ start: "09:45", end: "10:30", label: "Break" }, { start: "12:15", end: "13:30", label: "Lunch" }],
  high_school: [{ start: "10:10", end: "10:30", label: "Break" }, { start: "11:30", end: "12:00", label: "Lunch" }],
  college: [{ start: "12:15", end: "13:00", label: "Lunch" }],
  university: [{ start: "12:15", end: "13:00", label: "Lunch" }],
};

const INSTITUTION_TERTIARY = new Set<InstitutionType>(["college", "university"]);

export const courseIdOf = (code: string) => `crs-${code.toLowerCase()}`;

export const coursesFor = (type: InstitutionType): StudentCourse[] => COURSES[type].map((c) => ({ ...c, id: courseIdOf(c.code) }));

/** Slot ids are "slot-<day>-<period number>", e.g. "slot-wed-2". */
export const slotId = (day: string, period: number) => `slot-${day.toLowerCase()}-${period}`;

export function slotsFor(type: InstitutionType): TimetableSlot[] {
  const courses = coursesFor(type);
  const out: TimetableSlot[] = [];
  WEEKDAYS.forEach((day, d) => {
    PERIODS[type].forEach(([start, end], p) => {
      // Colleges and universities finish early on Fridays.
      if (INSTITUTION_TERTIARY.has(type) && day === "Fri" && p >= 2) return;
      // Rotating the courses gives each day a different order, and Monday matches the dashboard.
      const course = courses[(p + d * 2) % courses.length];
      out.push({ id: slotId(day, p + 1), day, start, end, courseId: course.id, room: course.room });
    });
  });
  return out;
}

/** A few one-off changes around the seeded "now" (mid-November 2026), so week navigation has something to show. */
function changesFor(): TimetableChange[] {
  return [
    { slotId: slotId("Wed", 2), date: "2026-11-11", kind: "room", room: "Hall", note: "Moved to the hall for a joint session." },
    { slotId: slotId("Wed", 2), date: "2026-11-18", kind: "cancelled", note: "Teacher at a training workshop." },
    { slotId: slotId("Thu", 1), date: "2026-11-19", kind: "room", room: "Lab 4", note: "Room swapped for equipment set-up." },
  ];
}

export function timetableFor(type: InstitutionType): Timetable {
  return { group: STUDENT_SEED[type].group, courses: coursesFor(type), slots: slotsFor(type), changes: changesFor(), breaks: BREAKS[type] };
}
