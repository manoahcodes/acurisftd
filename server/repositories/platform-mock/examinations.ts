import { COURSE_ROWS, LEARNERS, flavour, groupNames, tableOf, type Builder } from "./shared";

const uploadResults: Builder = (ctx) => {
  const f = flavour(ctx);
  const rows = COURSE_ROWS(f.tertiary, f.primary);
  return {
    description: "Marks uploaded by teaching staff or imported from spreadsheets.",
    actions: ["Upload results"],
    tables: [
      tableOf("upload-batches",
        "Upload exam results",
        ["Batch", f.terms.course, "Uploaded by", "Records", "Uploaded on", "Status"],
        [
          ["UP-0412", rows[0][1], "Dr. Kunda", "420", "03 Nov 2026", "Validated"],
          ["UP-0411", rows[1][1], "Mrs. Lungu", "510", "02 Nov 2026", "Validated"],
          ["UP-0410", rows[2][1], "Eng. Zimba", "298", "02 Nov 2026", "Pending"],
          ["UP-0409", rows[3][1], "Sr. Mwansa", "260", "01 Nov 2026", "Failed"],
        ],
        { statusColumn: "Status", note: "Failed batches have rows that did not match a registered student." },
      ),
    ],
  };
};

const transcripts: Builder = (ctx) => {
  const f = flavour(ctx);
  const groups = groupNames(f.tertiary, f.primary);
  const scores = f.tertiary ? ["3.6", "3.2", "3.8", "2.9", "3.4", "3.1"] : ["81%", "74%", "88%", "69%", "77%", "72%"];
  return {
    description: "Result transcripts per learner and period.",
    actions: ["Generate transcript"],
    tables: [
      tableOf("transcripts",
        "Result transcripts",
        ["Student", f.tertiary ? "Programme" : "Class", f.terms.period, f.tertiary ? "GPA" : "Average", "Status"],
        LEARNERS.slice(0, 6).map((l, i) => [
          `${l.no} · ${l.name}`,
          groups[i],
          f.periodName(f.tertiary ? 1 : 2),
          scores[i],
          i === 3 ? "Pending" : "Issued",
        ]),
        { statusColumn: "Status", printAs: "Transcript" },
      ),
    ],
  };
};

const finalResults: Builder = (ctx) => {
  const f = flavour(ctx);
  const groups = groupNames(f.tertiary, f.primary);
  const grades = f.tertiary
    ? ["Distinction", "Merit", "Distinction", "Pass", "Merit", "Merit"]
    : ["Division 1", "Division 2", "Division 1", "Division 3", "Division 2", "Division 2"];
  return {
    description: "Final results after moderation and approval.",
    actions: ["Publish results"],
    tables: [
      tableOf("final-results",
        "Final results",
        ["Student", f.tertiary ? "Programme" : "Class", "Overall", f.tertiary ? "Classification" : "Division", "Status"],
        LEARNERS.slice(0, 6).map((l, i) => [
          `${l.no} · ${l.name}`,
          groups[i],
          ["81%", "74%", "88%", "62%", "77%", "72%"][i],
          grades[i],
          i < 4 ? "Published" : "Pending",
        ]),
        { statusColumn: "Status" },
      ),
    ],
  };
};

const examRegister: Builder = (ctx) => {
  const f = flavour(ctx);
  const rows = COURSE_ROWS(f.tertiary, f.primary);
  return {
    description: "Examination timetable and attendance register.",
    actions: ["Add session"],
    tables: [
      tableOf("exam-sessions",
        "Exam register",
        ["Date", f.terms.course, "Venue", "Candidates", "Invigilator", "Status"],
        [
          ["23 Nov 2026", rows[0][1], "Main Hall", "420", "Mr. Daka", "Scheduled"],
          ["24 Nov 2026", rows[1][1], "Block B Hall", "510", "Mrs. Sakala", "Scheduled"],
          ["25 Nov 2026", rows[2][1], "Main Hall", "298", "Mr. Chanda", "Scheduled"],
          ["26 Nov 2026", rows[3][1], "Lab 2", "260", "Mrs. Phiri", "Pending"],
        ],
        { statusColumn: "Status" },
      ),
    ],
  };
};

export const examinationScreens: Record<string, Builder> = {
  "examinations/upload-exam-results": uploadResults,
  "examinations/result-transcripts": transcripts,
  "examinations/final-results": finalResults,
  "examinations/exam-register": examRegister,
};
