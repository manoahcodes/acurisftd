import { INSTITUTIONS, type InstitutionType } from "@/config/institution";

/**
 * Wording for the teaching role. Primary and High School have a Teacher with
 * classes, learners, lessons and a lesson planner; College and University have
 * a Lecturer with courses, students, sessions and a course outline.
 */
export type TeacherTerms = {
  /** "Teacher" or "Lecturer". */
  educator: string;
  /** What a class is called: "Class" or "Course". */
  group: string;
  groups: string;
  /** Who is taught: "Learner" or "Student". */
  member: string;
  members: string;
  /** One sitting: "Lesson" or "Session". */
  sitting: string;
  /** The page names as shown to this person. */
  pages: { classes: string; register: string; planner: string; resources: string };
  period: string;
  tertiary: boolean;
};

const SCHOOL: TeacherTerms = {
  educator: "Teacher", group: "Class", groups: "Classes", member: "Learner", members: "Learners", sitting: "Lesson",
  pages: { classes: "My classes", register: "Class register", planner: "Lesson planner", resources: "Learning resources" },
  period: "Term", tertiary: false,
};

const TERTIARY: TeacherTerms = {
  educator: "Lecturer", group: "Course", groups: "Courses", member: "Student", members: "Students", sitting: "Session",
  pages: { classes: "My courses", register: "Attendance register", planner: "Course outline", resources: "Course materials" },
  period: "Semester", tertiary: true,
};

export const teacherTermsFor = (type: InstitutionType): TeacherTerms =>
  INSTITUTIONS[type].level === "tertiary" ? TERTIARY : SCHOOL;

const lower = (s: string) => s.toLowerCase();
export { lower as lc };
