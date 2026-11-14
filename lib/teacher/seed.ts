import type { InstitutionType } from "@/config/institution";
import type { Learner, TeachingClass } from "@/types/teacher";

/**
 * Sample classes and learners for the mock. The same lessons feed the Teacher
 * dashboard, so its numbers match these pages. Real data replaces this.
 */
export type Lesson = { time: string; group: string; course: string; room: string; size: number };

export const LESSONS: Record<InstitutionType, Lesson[]> = {
  primary: [
    { time: "08:00–08:45", group: "Grade 3B", course: "Mathematics", room: "Room P-101", size: 38 },
    { time: "09:00–09:45", group: "Grade 5A", course: "Mathematics", room: "Room P-203", size: 34 },
    { time: "10:30–11:15", group: "Grade 6C", course: "Mathematics", room: "Room P-102", size: 36 },
    { time: "11:30–12:15", group: "Grade 1A", course: "Numeracy", room: "Room P-104", size: 40 },
    { time: "13:30–14:15", group: "Grade 7", course: "Mathematics", room: "Room P-201", size: 32 },
  ],
  high_school: [
    { time: "08:00–09:00", group: "Grade 9A", course: "Mathematics", room: "Room A-101", size: 42 },
    { time: "09:10–10:10", group: "Grade 10B", course: "Mathematics", room: "Room B-203", size: 36 },
    { time: "10:30–11:30", group: "Grade 11A", course: "Mathematics", room: "Room A-102", size: 31 },
    { time: "12:00–13:00", group: "Grade 8C", course: "Mathematics", room: "Room C-104", size: 38 },
    { time: "14:00–15:00", group: "Grade 12", course: "Mathematics", room: "Room B-201", size: 37 },
  ],
  college: [
    { time: "08:00–10:00", group: "Diploma in ICT, Year 1", course: "Database Systems", room: "Lab 3", size: 34 },
    { time: "10:15–12:15", group: "Diploma in ICT, Year 2", course: "Web Development", room: "Lab 1", size: 28 },
    { time: "13:00–15:00", group: "Certificate in Accounting", course: "Financial Accounting", room: "Room B-12", size: 40 },
    { time: "15:15–16:45", group: "Diploma in Business Admin", course: "Business Statistics", room: "Room B-14", size: 40 },
  ],
  university: [
    { time: "08:00–10:00", group: "BSc Computer Science, Year 2", course: "Algorithms", room: "Lecture Hall 2", size: 120 },
    { time: "10:15–12:15", group: "BEng Civil Engineering, Year 1", course: "Engineering Mathematics", room: "Lecture Hall 4", size: 95 },
    { time: "13:00–14:00", group: "BA Accounting & Finance, Year 3", course: "Quantitative Methods", room: "Room N-210", size: 64 },
    { time: "14:30–16:30", group: "BSc Computer Science, Year 3", course: "Machine Learning", room: "Lab 5", size: 48 },
  ],
};

const DAYS = [["Mon", "Wed", "Fri"], ["Tue", "Thu"], ["Mon", "Tue", "Thu"], ["Wed", "Fri"], ["Mon", "Tue", "Wed", "Thu", "Fri"]];

const FIRST = [
  "Chisomo", "Mwamba", "Tionenji", "Natasha", "Thandiwe", "Chanda", "Mutale", "Bwalya", "Namukolo", "Kondwani", "Lungile", "Mapalo",
  "Temwani", "Zione", "Wezi", "Chipo", "Mulenga", "Kabwe", "Nkandu", "Sepiso", "Yamikani", "Luyando", "Taonga", "Mercy",
  "Joseph", "Grace", "Patrick", "Esther", "Brian", "Ruth", "Daniel", "Faith", "Moses", "Joy", "Peter", "Hope",
];
const LAST = [
  "Banda", "Zulu", "Phiri", "Mwale", "Tembo", "Lungu", "Mumba", "Chanda", "Sakala", "Daka", "Mulenga", "Kunda", "Ngoma", "Chola",
  "Musonda", "Simbeye", "Kapata", "Bwalya", "Mbewe", "Nyirenda", "Siame", "Kaunda", "Chileshe", "Moyo", "Ng'andu", "Shamwana",
];

/** Short code that starts learner numbers: "G9A" style for schools, the course for tertiary. */
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function classesFor(type: InstitutionType): TeachingClass[] {
  return LESSONS[type].map((l, i) => ({
    id: `cls-${slug(l.group)}`,
    name: l.group,
    subject: l.course,
    room: l.room,
    time: l.time,
    days: DAYS[i % DAYS.length],
  }));
}

/** The class's roster: stable names and numbers, so saved registers still match after a restart. */
export function learnersOf(type: InstitutionType, classId: string): Learner[] {
  const index = LESSONS[type].findIndex((l) => `cls-${slug(l.group)}` === classId);
  if (index < 0) return [];
  const { size } = LESSONS[type][index];
  const prefix = type === "college" || type === "university" ? "STU" : "LRN";
  const seen = new Set<string>();
  const out: Learner[] = [];
  for (let i = 0; seen.size < size && i < size * 50; i++) {
    const name = `${FIRST[(i * 5 + index * 3) % FIRST.length]} ${LAST[(i * 7 + index * 11 + Math.floor(i / FIRST.length)) % LAST.length]}`;
    if (seen.has(name)) continue;
    seen.add(name);
    const n = out.length;
    out.push({ id: `${classId}-${String(n + 1).padStart(3, "0")}`, name, number: `${prefix}-${2000 + index * 200 + n + 1}`, classId });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, "en"));
}
