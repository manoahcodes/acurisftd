import { INSTITUTIONS, type InstitutionType } from "@/config/institution";

/**
 * Wording for the student role. Primary and High School have a learner with
 * subjects, terms and percentages; College and University have a student with
 * courses, semesters and a grade-point average.
 */
export type StudentTerms = {
  /** "Learner" or "Student". */
  member: string;
  /** "Subject" or "Course". */
  course: string;
  courses: string;
  /** One sitting: "Lesson" or "Session". */
  sitting: string;
  sittings: string;
  /** "Term" or "Semester". */
  period: string;
  /** "Class" or "Programme". */
  group: string;
  tertiary: boolean;
};

const SCHOOL: StudentTerms = { member: "Learner", course: "Subject", courses: "Subjects", sitting: "Lesson", sittings: "Lessons", period: "Term", group: "Class", tertiary: false };
const TERTIARY: StudentTerms = { member: "Student", course: "Course", courses: "Courses", sitting: "Session", sittings: "Sessions", period: "Semester", group: "Programme", tertiary: true };

export const studentTermsFor = (type: InstitutionType): StudentTerms => (INSTITUTIONS[type].level === "tertiary" ? TERTIARY : SCHOOL);
