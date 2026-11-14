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
- Bursar, Cashier, Parent and Student pages are still "hasn't been built yet" placeholders
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
- [ ] Phase 3: Lesson planner, Learning resources
- [ ] Swap `TeachingRepository` for a real one; `getTeacherSession` (`server/teacher-context.ts`) must verify the Teacher/Lecturer role and fail closed
- [x] Sidebar badges (Class register, Assignments, Assessments) and the dashboard "To mark" KPI come from the teacher's own data
