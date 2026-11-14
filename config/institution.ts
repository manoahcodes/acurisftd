/**
 * Institution types are what a tenant picks when it is set up. Each type belongs
 * to a level, and the level decides the academic system:
 *
 *   Primary      -> Primary level   (grades 1-7)    -> TERM system
 *   High School  -> Secondary level (grades 8-12)   -> TERM system
 *   College      -> Tertiary level                  -> SEMESTER system
 *   University   -> Tertiary level                  -> SEMESTER system
 *
 * Primary is for smaller tenants that only offer grades 1-7. Change the mapping
 * here and every label follows.
 */
export const INSTITUTION_TYPES = ["primary", "high_school", "college", "university"] as const;

export type InstitutionType = (typeof INSTITUTION_TYPES)[number];
export type AcademicSystem = "term" | "semester";
export type InstitutionLevel = "primary" | "secondary" | "tertiary";

type InstitutionInfo = {
  label: string;
  level: InstitutionLevel;
  system: AcademicSystem;
  /** Grades offered, for school-level types. */
  grades?: string;
};

export const LEVEL_LABELS: Record<InstitutionLevel, string> = {
  primary: "Primary",
  secondary: "Secondary",
  tertiary: "Tertiary",
};

export const INSTITUTIONS: Record<InstitutionType, InstitutionInfo> = {
  primary: { label: "Primary School", level: "primary", system: "term", grades: "Grades 1–7" },
  high_school: { label: "High School", level: "secondary", system: "term", grades: "Grades 8–12" },
  college: { label: "College", level: "tertiary", system: "semester" },
  university: { label: "University", level: "tertiary", system: "semester" },
};

/**
 * A division is one part of a tenant with its own level, students, fees, classes
 * and results (for example Primary and High School inside one combined school).
 * Divisions are fully separate: own student numbers and own fee accounts.
 */
export type Division = {
  id: string;
  name: string;
  /** Short prefix for numbering, e.g. PRI gives student numbers PRI-1048. */
  code: string;
  institutionType: InstitutionType;
};

/**
 * All divisions of a tenant share one academic system, so a school can combine
 * Primary and High School (terms) or College and University (semesters), but not
 * a High School with a University.
 */
export function divisionsShareSystem(divisions: readonly Division[]): boolean {
  return divisions.every(
    (d) => INSTITUTIONS[d.institutionType].system === INSTITUTIONS[divisions[0].institutionType].system,
  );
}

export function assertSharedSystem(tenantName: string, divisions: readonly Division[]): void {
  if (divisions.length === 0) throw new Error(`${tenantName} needs at least one division.`);
  if (!divisionsShareSystem(divisions)) {
    throw new Error(`${tenantName} mixes terms and semesters. All divisions of a tenant must share one academic system.`);
  }
}

export const tenantSystem = (divisions: readonly Division[]): AcademicSystem =>
  INSTITUTIONS[divisions[0].institutionType].system;

export const tenantSystemLabel = (divisions: readonly Division[]) =>
  tenantSystem(divisions) === "semester" ? "Semester system" : "Term system";

/** "High School", or "Primary School + High School" for a combined school. */
export const divisionsLabel = (divisions: readonly Division[]): string =>
  [...new Set(divisions.map((d) => INSTITUTIONS[d.institutionType].label))].join(" + ");

/** Wording is tenant-wide: every division shares the system, and so the vocabulary. */
export const tenantTermsType = (divisions: readonly Division[]): InstitutionType | undefined =>
  divisions[0]?.institutionType;

export const isInstitutionType = (value: string): value is InstitutionType =>
  (INSTITUTION_TYPES as readonly string[]).includes(value);

export const systemLabel = (type: InstitutionType) =>
  INSTITUTIONS[type].system === "semester" ? "Semester system" : "Term system";

/** Words that change with the institution level. Used as {tokens} in nav labels. */
export type Terminology = {
  period: string;
  course: string;
  courses: string;
  programmes: string;
  educators: string;
  /**
   * Display wording for a nav label that has no {token} of its own. The raw
   * label stays the stable key (badges, icons, links); only what is shown changes.
   */
  labels?: Record<string, string>;
};

const SCHOOL_TERMS: Terminology = {
  period: "Term",
  course: "Subject",
  courses: "Subjects",
  programmes: "Classes",
  educators: "Teachers",
};

const TERTIARY_TERMS: Terminology = {
  period: "Semester",
  course: "Course",
  courses: "Courses",
  programmes: "Programmes",
  educators: "Lecturers",
  labels: {
    "My classes": "My courses",
    "Class register": "Attendance register",
    "Lesson planner": "Course outline",
    "Learning resources": "Course materials",
  },
};

/** Shown when no school is selected, so the wording stays neutral. */
export const GENERIC_TERMS: Terminology = {
  period: "Term/Semester",
  course: "Course/Subject",
  courses: "Courses/Subjects",
  programmes: "Programmes/Classes",
  educators: "Lecturers/Teachers",
};

export function termsFor(type: InstitutionType | null | undefined): Terminology {
  if (!type) return GENERIC_TERMS;
  return INSTITUTIONS[type].level === "tertiary" ? TERTIARY_TERMS : SCHOOL_TERMS;
}

/** Replaces {period}, {course}, {courses}, {programmes}, {educators} in a label. */
export function resolveLabel(label: string, terms: Terminology): string {
  if (terms.labels?.[label]) return terms.labels[label];
  return label.replace(/\{(\w+)\}/g, (match, key: string) =>
    key !== "labels" && key in terms ? terms[key as Exclude<keyof Terminology, "labels">] : match,
  );
}
