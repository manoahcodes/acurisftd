# Platform Admin: to-do (not yet covered)

Last updated: 2026-11-13. Covered so far: all list screens, create/edit forms on mock data, sidebar features, search, tests (207 passing, Chromium only).

## 1. Real data and sign-in
- [x] Stop data resetting on server restart: theme and branding, schools, records (edits, archives, staff), and the audit trail are saved in a SQLite file (`data/acuris.db`, git-ignored; `server/persistence/store.ts`). Needs a persistent disk; falls back to memory on read-only or serverless hosting. Off in tests; `ACURIS_PERSIST=on|off`, `ACURIS_DATA_DIR`
- [ ] Replace the mock repositories (and this SQLite stand-in) with a real API or database
- [ ] Real sign-in and session with roles
- [ ] Replace the placeholder permission check in `server/forms/guard.ts` (must verify Platform Admin and fail closed)
- [ ] Enforce role scopes (which divisions a role can see). Today they are only displayed
- [ ] Swap `RecordStore` and `TenantDirectory` mocks for real implementations that check role and tenant on every call

## 2. Process buttons
All work on mock data now (CSV files up to 1 MB, 500 rows; every run is written to the audit trail).
- [x] Import CSV (students): every row checked like the Add student form; nothing imported if any row is bad
- [x] Add room (hostels): form with a new Rooms table
- [x] Change plan (subscriptions)
- [x] Edit settings: general settings in bulk (academic year start and session timeout are validated; the time zone now lives under Branding). Institution types stay fixed by the system
- [x] Generate transcript, dockets and reports: mark rows issued/ready and download a CSV (sample marks and figures, as the mock has no stored results)
- [x] Upload results: one batch per course; a batch with an unregistered student is marked Failed
- [x] Publish results: marks pending results published
- [x] Open registration (term or semester): form with a Registration windows table
- [x] Import statement: lines naming a known student number are matched, the rest unmatched
- [x] Run backup now and Export data
- [x] In a school with several divisions these dialogs ask for the Division first, then show that division's own questions and CSV columns
- [x] Printable transcripts, exam dockets and receipts: Print button on each row opens a sheet with the school's logo, document header, footer and signature line; "Print / Save as PDF" uses the browser (no PDF library). Generated files are still CSV

## 3. Missing features
- [x] Delete / archive / suspend records. Archive any row (restorable); delete only rows made through a form and without history; schools are suspended via status, or deleted when empty
- [x] Edit forms for the read-only tables: Subscriptions (billing, renewal date), Usage and capacity (learner limit), Institution types (grades), Permission matrix (rights per role; Platform Admin keeps control of access and settings), Division access (edits the Staff record). Plan, learner counts and storage stay derived. The matrix is shown, not yet enforced
- [x] Change a school's divisions after it is created: divisions can be added (one academic system only); removing one is refused while the school has learners. Staff limited to a removed division show "No division"
- [x] Change a staff member's role and division access after creation (Staff form or Division access page). Principals stay whole-school and a Head stays on their own division; new, edited and archived staff show on Division access
- [x] Reports: drop-down filters (status, period, class/programme and similar), Export CSV of what is shown, and a print view
- [x] Audit trail logs changes made through the forms (create, edit, archive, restore, delete, schools)

## 4. Rough edges
- [x] Summary cards that are plain row counts follow added and archived rows (other cards, e.g. totals or percentages, still do not)
- [x] A "Jan 2026" date opens on the 1st of that month (saving shows it as "01 Jan 2026")
- [x] Top-bar "Add tenant" opens the new-school form

## 5. Verification still owed
- [ ] Firefox: scrollbar theme and sidebar styling (sandbox could not download browsers)
- [ ] Safari / WebKit: same
- [ ] Phone and tablet layouts, including the form dialogs
- [ ] Screen-reader and keyboard pass on the forms
- [ ] Browser (end-to-end) tests in the repo, and CI to run lint, typecheck and tests

## Out of scope for Platform Admin (separate work)
- Bursar and Cashier pages are still "hasn't been built yet" placeholders
- Student pages: see section 8
- Teacher / Lecturer pages: see section 7

## 6. Branding and theme (added with the theme editor)
- [x] Colour suggestions from the uploaded logo (or the saved one): the editor reads the logo in the browser (`lib/theme/logo-colours.ts`), skips transparent and white/black backgrounds, and offers up to three primary + secondary choices that fill the form and live preview; nothing saves until Save. SVG logos are not accepted today, so they are not read
- [x] Browser tab titles follow the page: "Result transcripts · School name" (worded for the selected school, Term or Semester), "Sign in · School name"; the overview keeps "School name - tagline"
- [ ] Swap `ThemeRepository` mock for a real one that checks role and tenant on every write (`server/repositories/theme-types.ts`)
- [x] Saved time zone applied to the dashboard date, copyright year and dates written by process buttons (audit-trail times in the Reports screen still use Lusaka)
- [x] Branded demo sign-in page at `/sign-in` (logo, welcome message, banner). Nothing is checked; it only continues into the chosen role. Real sign-in is still open (section 1)
- [x] Document header, footer and signature line print on receipts, dockets and transcripts
- [ ] Move the logo from a data URL to file storage when a real backend exists
- [x] Theme colour flash: the browser remembers the last theme and applies it before first paint (first visit in a browser can still show defaults once)
- [x] Dark mode checked on every screen of every role (automated contrast scan, light and dark; add new pages to that check)
- [x] Ten theme fonts: Inter, Poppins, Lato, Source Sans 3, Roboto, Open Sans, Nunito Sans, Montserrat, Merriweather (serif) and Atkinson Hyperlegible, with a live sample in the picker
- [ ] Verify the nine brand fonts (all except Inter) download in a networked build (sandbox could not reach Google Fonts)

## 7. Teacher and Lecturer role
Primary and High School get a **Teacher** (classes, learners, lessons, "Lesson planner"); College and University get a **Lecturer** (courses, students, sessions, "Attendance register", "Course outline"). Wording lives in `lib/teacher/terms.ts`; nav labels keep their stable keys and are re-worded through `Terminology.labels` in `config/institution.ts`.

Data is the in-memory mock saved through the SQLite store (key `teaching`), scoped per school and per teacher (`server/repositories/teacher-mock.ts`, interface in `teacher-types.ts`). Server actions in `server/actions/teacher.ts` re-validate everything with `lib/teacher/validate.ts`.

- [x] Phase 1: My classes (cards, roster, watch list, class note, CSV, print), Class register (take, draft, submit, history, CSV, print), Assignments (create, edit, publish, close, delete, links and notes, marks entry, CSV, print)
- [x] Phase 2: Assessments (schedule, open for marking, marks entry with absent/excused, publish, stats, grade spread, CSV, print) and Gradebook (weighted finals, coursework weight, rank, grade, remarks, CSV, print). Grading scales and the 50% pass mark are samples in `lib/teacher/grading.ts`; a school replaces them
- [x] Phase 3: Lesson planner / Course outline (plans by week, draft, ready, taught with reflection, copy to another date, links and notes, CSV, print) and Learning resources / Course materials (links and notes only, by class, type and topic, share with learners, CSV, print). The Student role now has its own Learning resources page (section 8), but it is sample data of its own: items a teacher shares are not yet linked to what the student sees
- [ ] Swap `TeachingRepository` for a real one; `getTeacherSession` (`server/teacher-context.ts`) must verify the Teacher/Lecturer role and fail closed
- [x] Sidebar badges (Class register, Assignments, Assessments) and the dashboard "To mark" KPI come from the teacher's own data

## 8. Student role
Primary and High School get a **Learner** (subjects, terms, percentages); College and University get a **Student** (courses, semesters, GPA). Wording lives in `lib/student/terms.ts`, and follows the school selected in the demo. Pages: My timetable, Assignments, Results & grades, Attendance, Learning resources, School notices, My profile (My home is the dashboard).

Data is the in-memory mock saved through the SQLite store (key `student`), scoped per school and per student (`server/repositories/student-mock.ts`, interface in `student-types.ts`). What the school sets (timetable, assignments, assessments, notices, resources) is sample data in `lib/student/seed.ts`; what the student does (hand-ins, reasons for absence, bookmarks, read marks, contact details, photo) is saved. Server actions in `server/actions/student.ts` re-validate everything with `lib/student/*`. `getStudentSession` (`server/student-context.ts`) must verify the Student role and fail closed.

- [x] My timetable: week and day views, week navigation, one-off changes (cancelled, room), course filter, next-lesson card, CSV, print
- [x] Assignments: status tabs, search, course filter; hand in by typed answer and/or file (PDF, Word, PNG, JPEG, text; checked by bytes, 2 MB), hand in again, take back, late detection, locked once marked; files download as attachments only (`/api/student/submission`)
- [x] Results & grades: per-course breakdown with class averages, marked assignments count as coursework (20%), average and grade at schools, GPA, cumulative GPA and credits at colleges and universities, earlier periods, grading scale, printable result slip
- [x] Attendance: rate against the required 85%, per-course bars, month calendar, filterable log, CSV, print, and sending a reason for a recent absence (14-day window, reviewed by the school)
- [x] Learning resources: search, course and type filters, All / New / Saved, bookmarks, opened marks, notes download as text
- [x] School notices: pinned first, category filter, search, unread only, read on open, mark read or unread, mark all read
- [x] My profile: identity read-only; edit phone, email, address, required emergency contact; profile photo (PNG or JPEG by bytes, 1 MB, `/api/student/photo`)
- [x] Sidebar badges (Assignments, School notices), the bell and the top bar search come from the student's own data
- [x] Unpaid fees, set per school by the Platform Admin: **Fee policy** on the school form (Tenants & schools): information only, withhold exam card, withhold result slip, or both (`lib/fee-policy.ts`, field `feePolicy` on `TenantSummary`, audited as "Fee policy changed"). The student sees a fee notice on My home and in the bell; a withheld page shows "Available once your balance is cleared" and, at colleges and universities, the amount. Learners at schools are pointed to their parent or guardian and are not shown the amount. New **Exam card** page (printable). The result slip (print and CSV) is the withheld item on Results & grades; marks stay visible.
- [ ] Fee balance is sample data (`lib/student/fees.ts`, `StudentRepository.getFees`); connect it to the Bursar's records when that role is built, and compute overdue from the due date
- [ ] Exam card lists each course's upcoming exam; replace with the Registrar's exam timetable and add a student-specific exam number and venue when those exist
- [ ] Link the student's data to the Teacher module: assignments, marks, attendance and shared resources a teacher enters should be what the student sees (today the two mocks are separate)
- [ ] Swap `StudentRepository` for a real one; the school's timetable, notices and the review of absence reasons need an owner role (Teacher, Registrar or Parent)
- [ ] Move submission files and photos from base64 in the saved snapshot to file storage when a real backend exists
- [ ] Dark mode and phone layout check of the seven Student pages (not run in the sandbox); add them to the contrast scan
- [ ] `next build` could not be run in the sandbox (Google Fonts unreachable); dev server and 647 tests pass

## Parent role

Built on the Student module's records: every child page reads the selected child (top bar switcher, cookie `stecia_child`) through `childContext`, which refuses a child who is not linked to the signed-in guardian (`server/parent-context.ts`). Wording follows the school (Learner or Student, Term or Semester). No payments are taken and absences cannot be reported from here.

- [x] My children: a card per linked child with attendance, average or GPA, work to hand in, fee balance and policy flags
- [x] Attendance: the Student view, read-only for parents (rate, calendar, log, CSV, print; no absence-reason form)
- [x] Academic progress: the Student results view with a printable report card for the current and each earlier period, CSV, and the school's withheld-results policy (worded for a parent)
- [x] Fee statements: invoice, receipts and a running statement of account that agree with the Student fee position; print (statement, invoice, each receipt) and CSV; shows the unpaid-fees policy
- [x] School calendar: month view, coming-up list, RSVP (going, can't make it, take it back) on events that ask, request a meeting with a teacher or office linked to the child, cancel a request
- [x] Messages: conversations, unread marks, search, unread filter, reply, new message to linked staff (optionally about one child), mark read or unread, mark all read
- [x] Profile: edit contact details (school-set details read-only), notification choices by channel and topic, request to link another child (the school approves; withdraw while pending)
- [x] Sidebar Messages badge, the bell (unread messages, events awaiting a reply, each child's fee balance; honours the parent's notification choices) and top bar search come from the guardian's own data
- [x] `ParentRepository` (`server/repositories/parent-types.ts`, swap point in `index.ts`) with a SQLite-backed mock; pure validation in `lib/parent/validate.ts`; server actions in `server/actions/parent.ts` re-check everything
- [ ] Swap `ParentRepository` for a real one, and have the school side answer meeting requests and review link requests (today they stay "waiting for the school")
- [ ] Fee statements are built from the Student fee position (`lib/parent/fees.ts`); replace with the Bursar's invoices and receipts
- [ ] The bell lists an event until the parent replies, even after its date, because the server cannot read the clock while prerendering; filter past events once the date is available there
- [ ] Notification preferences are saved and the bell honours them; email and text delivery need a sending service
- [ ] A child's class label comes from the guardian's child record (`ChildRepository`), while the timetable and results come from the Student module's sample data, so both children show the same courses
- [ ] Dark mode check of the seven Parent pages was not run in the sandbox (the pages use the theme tokens); phone width and light mode were checked with no overflow or console errors
