import type { InstitutionType } from "@/config/institution";
import { WEEKDAYS, type AssignmentKind, type StudentAssignment, type StudentCourse, type Timetable, type TimetableChange, type TimetableSlot } from "@/types/student";

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

// ---- Assignments

type AssignmentSeed = {
  /** Index into the school's courses. */
  course: number;
  title: string;
  kind: AssignmentKind;
  due: string;
  max: number;
  instructions: string;
  file?: boolean;
  /** Handed in after the due date. */
  late?: boolean;
  /** Late work is refused after the due date. */
  strict?: boolean;
  /** What the student has done so far. */
  state: "todo" | "submitted" | "late" | "marked";
  mark?: number;
  feedback?: string;
};

/** Eight assignments per school: three still to do, and a mix of waiting and marked work. */
const ASSIGNMENTS: Record<InstitutionType, AssignmentSeed[]> = {
  primary: [
    { course: 0, title: "Number bonds worksheet", kind: "Homework", due: "2026-11-16", max: 20, instructions: "Do all ten questions. Write the number sentence for each one.", state: "todo" },
    { course: 1, title: "Story writing: my best day", kind: "Project", due: "2026-11-18", max: 40, instructions: "Write a story of at least ten sentences. You may attach a photo of your handwritten page.", file: true, state: "todo" },
    { course: 2, title: "Label the plant parts", kind: "Classwork", due: "2026-11-12", max: 30, instructions: "Label the roots, stem, leaves and flower on the diagram.", late: true, state: "todo" },
    { course: 3, title: "My community map", kind: "Homework", due: "2026-11-13", max: 25, instructions: "Describe three places in your community and say what each is used for.", state: "submitted" },
    { course: 4, title: "Colour wheel", kind: "Classwork", due: "2026-11-06", max: 25, instructions: "Complete the colour wheel and name the primary colours.", state: "marked", mark: 22, feedback: "Lovely neat colouring. Remember to name the secondary colours too." },
    { course: 0, title: "Times tables practice", kind: "Homework", due: "2026-10-30", max: 20, instructions: "Practise the 6, 7 and 8 times tables and write them out.", late: true, state: "marked", mark: 15, feedback: "Good work. Handed in late, so please plan your time next week." },
    { course: 1, title: "Reading comprehension", kind: "Quiz", due: "2026-10-23", max: 20, instructions: "Read the passage and answer the questions.", state: "marked", mark: 18, feedback: "Excellent understanding of the text." },
    { course: 5, title: "Kindness poster", kind: "Project", due: "2026-11-12", max: 20, instructions: "Make a poster about being kind and attach a photo of it.", file: true, late: true, state: "late" },
  ],
  high_school: [
    { course: 0, title: "Algebra practice", kind: "Homework", due: "2026-11-16", max: 20, instructions: "Complete exercises 4.1 to 4.3. Show your working for every question.", state: "todo" },
    { course: 1, title: "Essay draft: a place I know", kind: "Project", due: "2026-11-18", max: 40, instructions: "Write a 500-word descriptive essay. Type it here or attach your draft.", file: true, state: "todo" },
    { course: 2, title: "Pendulum practical report", kind: "Classwork", due: "2026-11-12", max: 30, instructions: "Write up the method, results table and conclusion from Tuesday's practical.", file: true, late: true, state: "todo" },
    { course: 3, title: "Label the cell diagram", kind: "Homework", due: "2026-11-13", max: 25, instructions: "Label the animal and plant cell diagrams and list two differences.", state: "submitted" },
    { course: 4, title: "Spreadsheet formulas quiz", kind: "Quiz", due: "2026-11-06", max: 25, instructions: "Answer the questions on SUM, AVERAGE and IF.", state: "marked", mark: 21, feedback: "Well done. Check your use of absolute references next time." },
    { course: 0, title: "Quadratic equations", kind: "Homework", due: "2026-10-30", max: 20, instructions: "Solve the set equations by factorising.", late: true, state: "marked", mark: 14, feedback: "Method is sound. Two sign errors cost you marks. Handed in late." },
    { course: 5, title: "Causes of the First World War", kind: "Homework", due: "2026-10-23", max: 30, instructions: "Explain three causes in your own words.", state: "marked", mark: 24, feedback: "Clear and well organised." },
    { course: 1, title: "Comprehension questions", kind: "Classwork", due: "2026-11-12", max: 20, instructions: "Answer questions 1 to 8 on the passage.", late: true, state: "late" },
  ],
  college: [
    { course: 0, title: "ER diagram assignment", kind: "Homework", due: "2026-11-16", max: 20, instructions: "Draw an ER diagram for the library case study and list the keys.", file: true, state: "todo" },
    { course: 1, title: "Portfolio page", kind: "Project", due: "2026-11-18", max: 40, instructions: "Build a one-page portfolio. Submit a short note on your design choices and attach a screenshot.", file: true, state: "todo" },
    { course: 3, title: "Probability worksheet", kind: "Classwork", due: "2026-11-12", max: 30, instructions: "Complete questions 1 to 10.", late: true, state: "todo" },
    { course: 2, title: "Formal letter", kind: "Homework", due: "2026-11-13", max: 25, instructions: "Write a formal letter of application for an attachment.", state: "submitted" },
    { course: 4, title: "Subnetting quiz", kind: "Quiz", due: "2026-11-06", max: 25, instructions: "Answer the subnetting questions.", state: "marked", mark: 20, feedback: "Good grasp of CIDR. Review variable-length masks." },
    { course: 0, title: "SQL joins exercise", kind: "Homework", due: "2026-10-30", max: 20, instructions: "Write the queries for the five scenarios.", late: true, state: "marked", mark: 15, feedback: "Queries are correct; one join is missing its condition. Late penalty not applied." },
    { course: 3, title: "Descriptive statistics", kind: "Homework", due: "2026-10-23", max: 30, instructions: "Compute the mean, median and standard deviation for the data set.", state: "marked", mark: 26, feedback: "Accurate throughout." },
    { course: 1, title: "CSS layout task", kind: "Classwork", due: "2026-11-12", max: 20, instructions: "Recreate the layout in the brief using flexbox.", file: true, late: true, state: "late" },
  ],
  university: [
    { course: 0, title: "Problem set 4", kind: "Homework", due: "2026-11-16", max: 20, instructions: "Solve problems 1 to 5. Analyse the running time of each solution.", file: true, state: "todo" },
    { course: 3, title: "Research proposal draft", kind: "Project", due: "2026-11-18", max: 40, instructions: "Submit a draft of your proposal: question, method and a short reading list.", file: true, state: "todo" },
    { course: 1, title: "Proof exercises", kind: "Classwork", due: "2026-11-12", max: 30, instructions: "Prove the statements in exercises 3.1 to 3.6.", file: true, late: true, state: "todo" },
    { course: 2, title: "Process scheduling notes", kind: "Homework", due: "2026-11-13", max: 25, instructions: "Compare round-robin and priority scheduling with an example.", state: "submitted" },
    { course: 4, title: "Normalisation quiz", kind: "Quiz", due: "2026-11-06", max: 25, instructions: "Answer the normalisation questions.", state: "marked", mark: 21, feedback: "Strong. Watch out for partial dependencies in question 4." },
    { course: 0, title: "Sorting analysis", kind: "Homework", due: "2026-10-30", max: 20, instructions: "Compare merge sort and quicksort on three input types.", late: true, state: "marked", mark: 15, feedback: "Good analysis of the worst case. Submitted late." },
    { course: 1, title: "Set theory set", kind: "Homework", due: "2026-10-23", max: 30, instructions: "Complete the set theory questions.", state: "marked", mark: 25, feedback: "Clear proofs." },
    { course: 4, title: "ER modelling task", kind: "Classwork", due: "2026-11-12", max: 20, instructions: "Model the hospital scenario and attach your diagram.", file: true, late: true, state: "late" },
  ],
};

export type SeededWork = { assignment: StudentAssignment; submission?: { text: string; late: boolean; mark: number | null; feedback: string; submittedAt: string; hasFile: boolean } };

export function assignmentsFor(type: InstitutionType): SeededWork[] {
  const courses = coursesFor(type);
  return ASSIGNMENTS[type].map((a, i): SeededWork => {
    const id = `asg-${i + 1}`;
    const assignment: StudentAssignment = {
      id,
      courseId: courses[a.course % courses.length].id,
      title: a.title,
      instructions: a.instructions,
      kind: a.kind,
      postedOn: "2026-10-19",
      dueDate: a.due,
      maxMarks: a.max,
      links: [],
      allowText: true,
      allowFile: Boolean(a.file),
      acceptLate: !a.strict,
    };
    if (a.state === "todo") return { assignment };
    const late = a.state === "late" || a.late === true;
    return {
      assignment,
      submission: {
        text: "Here is my completed work.",
        late,
        mark: a.state === "marked" ? (a.mark ?? 0) : null,
        feedback: a.feedback ?? "",
        submittedAt: `${a.due}T${late ? "17:30" : "08:15"}:00.000Z`,
        hasFile: false,
      },
    };
  });
}

// ---- Results and grades

/** A small stable hash, so sample marks do not change between restarts. */
const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
};

export type AssessmentSeed = {
  id: string;
  /** Index into the school's courses. */
  course: number;
  title: string;
  kind: "Test" | "Exam" | "Practical" | "Oral";
  date: string;
  max: number;
  weight: number;
  state: "marked" | "upcoming" | "pending" | "excused";
  /** Class average percent, for marked items. */
  classAverage?: number;
  mark?: number;
};

/** Assessments for the current period: a mid-term test and a practical or quiz per course, then an exam still to come. */
export function assessmentsFor(type: InstitutionType): AssessmentSeed[] {
  const courses = coursesFor(type);
  const out: AssessmentSeed[] = [];
  courses.forEach((c, i) => {
    const tag = (n: string) => `${type}|${c.code}|${n}`;
    const pct = (n: string) => 0.48 + hash(tag(n)) * 0.45;
    const test = { id: `ast-${i + 1}-1`, course: i, title: "Mid-term test", kind: "Test" as const, date: "2026-10-14", max: 50, weight: 30 };
    out.push({ ...test, state: "marked", mark: Math.round(test.max * pct("t")), classAverage: Math.round(52 + hash(tag("ct")) * 18) });
    const second = i === 2 ? { title: "Practical 1", kind: "Practical" as const, max: 20 } : { title: i % 2 ? "Week 5 quiz" : "Practical 1", kind: i % 2 ? ("Test" as const) : ("Practical" as const), max: 20 };
    const base = { id: `ast-${i + 1}-2`, course: i, date: "2026-11-05", weight: 20, ...second };
    // One course is excused and one is still being marked, so the page shows both.
    if (i === 2) out.push({ ...base, state: "excused" });
    else if (i === 3) out.push({ ...base, state: "pending" });
    else out.push({ ...base, state: "marked", mark: Math.round(base.max * pct("p")), classAverage: Math.round(54 + hash(tag("cp")) * 16) });
    out.push({ id: `ast-${i + 1}-3`, course: i, title: "End-of-period exam", kind: "Exam", date: "2026-12-04", max: 100, weight: 50, state: "upcoming" });
  });
  return out;
}

export type PastSeed = { label: string; courses: Array<{ name: string; credits: number | null; pct: number }> };

/** Finished periods, so the history and the cumulative grade-point average have something to show. */
export const HISTORY: Record<InstitutionType, PastSeed[]> = {
  primary: [
    { label: "Term 1 2026", courses: [{ name: "Mathematics", credits: null, pct: 74 }, { name: "English", credits: null, pct: 79 }, { name: "Science", credits: null, pct: 68 }, { name: "Social Studies", credits: null, pct: 71 }, { name: "Creative Arts", credits: null, pct: 85 }, { name: "Religious Education", credits: null, pct: 77 }] },
    { label: "Term 2 2026", courses: [{ name: "Mathematics", credits: null, pct: 76 }, { name: "English", credits: null, pct: 81 }, { name: "Science", credits: null, pct: 70 }, { name: "Social Studies", credits: null, pct: 73 }, { name: "Creative Arts", credits: null, pct: 88 }, { name: "Religious Education", credits: null, pct: 80 }] },
  ],
  high_school: [
    { label: "Term 1 2026", courses: [{ name: "Mathematics", credits: null, pct: 72 }, { name: "English", credits: null, pct: 78 }, { name: "Physics", credits: null, pct: 64 }, { name: "Biology", credits: null, pct: 69 }, { name: "ICT", credits: null, pct: 83 }, { name: "History", credits: null, pct: 66 }] },
    { label: "Term 2 2026", courses: [{ name: "Mathematics", credits: null, pct: 75 }, { name: "English", credits: null, pct: 80 }, { name: "Physics", credits: null, pct: 61 }, { name: "Biology", credits: null, pct: 72 }, { name: "ICT", credits: null, pct: 86 }, { name: "History", credits: null, pct: 70 }] },
  ],
  college: [
    { label: "Semester 2 2025", courses: [{ name: "Programming Fundamentals", credits: 4, pct: 71 }, { name: "Computer Systems", credits: 3, pct: 64 }, { name: "Mathematics for IT", credits: 3, pct: 58 }, { name: "Communication Skills I", credits: 2, pct: 77 }] },
    { label: "Semester 1 2026", courses: [{ name: "Systems Analysis", credits: 4, pct: 74 }, { name: "Introduction to Databases", credits: 3, pct: 69 }, { name: "Web Basics", credits: 3, pct: 82 }, { name: "Business Studies", credits: 2, pct: 63 }] },
  ],
  university: [
    { label: "Semester 2 2025", courses: [{ name: "Data Structures", credits: 4, pct: 72 }, { name: "Linear Algebra", credits: 3, pct: 66 }, { name: "Computer Organisation", credits: 4, pct: 61 }, { name: "Technical Writing", credits: 2, pct: 79 }] },
    { label: "Semester 1 2026", courses: [{ name: "Object-Oriented Programming", credits: 4, pct: 77 }, { name: "Probability", credits: 3, pct: 69 }, { name: "Computer Networks", credits: 4, pct: 64 }, { name: "Ethics in Computing", credits: 2, pct: 81 }] },
  ],
};

/** The period now under way: Term 3 or Semester 2 of 2026. */
export const CURRENT_PERIOD_NO: Record<InstitutionType, number> = { primary: 3, high_school: 3, college: 2, university: 2 };
