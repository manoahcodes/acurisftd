# Platform Admin: to-do (not yet covered)

> **2026-11-20: Platform Admin and School Admin are now separate roles (section 10).** Items below that say "Platform Admin" for school-level screens (students, finances, registrations, academics, hostels, reports) now belong to the **School Admin**.

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
- Bursar pages: see the Bursar role section below
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
- [x] Fee balance now comes from the Bursar's shared ledger (`server/repositories/ledger-store.ts`), with overdue worked out from the due date; payments the Bursar or Cashier take change what the student sees, including the notice and the withheld exam card and result slip
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
- [x] Parent fee position follows the same ledger as the Student. [ ] Fee statements still show the position only; swap in the Bursar's invoices and receipts
- [ ] The bell lists an event until the parent replies, even after its date, because the server cannot read the clock while prerendering; filter past events once the date is available there
- [ ] Notification preferences are saved and the bell honours them; email and text delivery need a sending service
- [ ] A child's class label comes from the guardian's child record (`ChildRepository`), while the timetable and results come from the Student module's sample data, so both children show the same courses
- [ ] Dark mode check of the seven Parent pages was not run in the sandbox (the pages use the theme tokens); phone width and light mode were checked with no overflow or console errors

## Cashier role

Own ledger, like the Student and Teacher modules: every page reads and writes only this cashier's receipts inside this school (`server/cashier-context.ts`, `CashierRepository` in `server/repositories/cashier-types.ts`, swap point in `index.ts`, SQLite-backed mock). Wording follows the school (Learner or Student, Class or Programme; accounts are tuition, transport, meals and other at schools, and tuition, accommodation, registration and other at colleges and universities). Money is integer ngwee. Pure rules are in `lib/cashier/validate.ts` and `totals.ts`; server actions in `server/actions/cashier.ts` re-check everything and write to the audit log.

- [x] Collect payment: find a student, choose the account and method, amount (cannot exceed what is owed on that account; "Full balance" shortcut), reference required for mobile money and bank, review step, receipt issued, print it from the success screen
- [x] Cash is a successful receipt at once; mobile money (Airtel, MTN, Zamtel) and bank payments are **pending** until the cashier confirms the money arrived, and only then lower the balance and count as collected
- [x] Find student: search by number, name or class/programme, fee accounts with due dates, overdue/owing/cleared, recent payments, jump to Collect payment
- [x] Print receipt: every receipt, search and status filter, printable with the school's branding and signature; a voided receipt prints marked VOID with its reason; pending ones cannot be printed yet
- [x] Today's transactions: totals, search, method and status filters, CSV and print, confirm a pending receipt, **void** a receipt taken today (reason required, audited, stays listed, left out of the totals, balance restored). Earlier days, refunds and later changes are for the Bursar
- [x] Cash-up: count the drawer by denomination (K 200 down to 5 ngwee), expected cash against counted, a reason is required when they differ, cannot be submitted while receipts are pending, **submitting locks the day** (no more payments, confirmations or voids), printable, history with each difference and reason
- [x] Payment methods: read-only list of what the school accepts, merchant and bank details, today's confirmed total per method, what to check before issuing a receipt
- [x] Sidebar badge (pending receipts), the bell (pending receipts, cash-up not submitted), the top bar search (students and receipts) and the dashboard figures come from the cashier's own records
- [x] `tests/cashier-*.test.ts`: validation, money parsing, cash-up counting, repository rules (void, confirm, lock, separation by cashier and school), dashboard, bell and search
- [x] (Done with the Bursar role: Student and Parent follow the ledger; the Platform Admin Student payments table is still sample data) Link the ledger to the rest of the platform: payments should lower the **Student** fee balance (`lib/student/fees.ts`), show on the **Parent** fee statements and the **Platform Admin** Student payments table, and clear the Student withholding of the exam card and result slip (today each module has its own sample numbers)
- [x] Fee balances now live in the Bursar's ledger, shared by every cashier in a school. [ ] Swap `CashierRepository` for a real one; the student list is still the sample roll
- [ ] Payment methods (merchant numbers, bank account) are sample data in `lib/cashier/methods.ts`; the school should set them (Bursar or Platform Admin) and be able to switch a method off. The Bursar has no screen for this yet
- [ ] Mobile money confirmation is manual; connect it to the provider's callback or the bank statement import when those exist
- [ ] Advance payments (more than is owed) and refunds are refused at the desk; the Bursar role needs screens for them
- [ ] The cash-up has no opening float and no per-cashier handover; add them if the school needs them
- [ ] Phone width and dark mode of the six Cashier pages were not checked; the desktop pages, the full payment, void and cash-up flow and the pending/closed rules were run in a browser with no console errors
- [ ] `next build` could not be run in the sandbox (Google Fonts unreachable); dev server, typecheck, lint and tests pass

## Bursar role (added 2026-11-19, one commit per page on `main`)
The Bursar owns the books. One shared school ledger (`server/repositories/ledger-store.ts`, keyed by school and level) holds what each student owes, payment plans and reversed payments, and every role reads it: Cashier, Student, Parent and Bursar always show one balance. `BursarRepository` (`server/repositories/bursar-types.ts`, SQLite-backed mock in `bursar-mock.ts`, swap point in `index.ts`) keeps the fee structure, invoices, payments the Bursar records, unallocated money, waivers, reminders, statement lines and cash-up reviews; desk receipts and cash-ups are read from the cashier repository. Money is integer ngwee. Wording follows the school (`lib/bursar/terms.ts`). Pure rules live in `lib/bursar/*` (validate, fees, accounts, invoices, plans, debtors, reconcile, reports, overview); server actions in `server/actions/bursar.ts` re-check everything, resolve ids inside the signed-in school and write to the audit log. Invariant, tested for all four school types: billed - paid - waived = owed.

- [x] Fee structures: the Bursar owns and edits them (seeded from the Admin sample amounts). Scope by grades or programme, per period or yearly, everyone or optional, effective dates, switch off (never deleted)
- [x] Student accounts: balances, statements with running balance, **reverse a payment** (reason required, audited, never deleted, a later cashier void is refused), **allocate unallocated payments** (partly if needed), **approve or decline bursaries, waivers and discounts**
- [x] Record payment: any method, back-dated up to 120 days, a reference can be used once, printable receipt
- [x] Invoices: generate for a period from the fee structure (running twice never bills twice), charge one fee to one student, print, cancel while unpaid (reason, stays listed)
- [x] Debtors: ageing buckets, filters, **payment plans** (2 to 12 equal monthly instalments; the next instalment becomes the due date everywhere; behind-plan flag; cancel with a reason), reminders log, documents held back under the school's fee policy, CSV and print
- [x] Reconciliation: review each cashier's cash-up (verify or query), days with cash taken but no cash-up, paste bank and mobile money statement lines, automatic matching by reference and amount, match by hand, take an unknown deposit in as unallocated, set a line aside with a reason, payments missing from the statement
- [x] Financial reports: collections (by account, method, day), fee position by class or programme, debtor ageing, bursaries and reversals; date presets or custom range; CSV and print
- [x] Finance overview, sidebar badges, the bell and the top bar search come from the school's own books (`server/queries/bursar-queries.ts`)
- [x] `tests/bursar-*.test.ts`
- [ ] Swap `BursarRepository` for a real one. `getBursarSession` (`server/bursar-context.ts`) must verify the Bursar role and fail closed; the mock session has no roles
- [ ] Reminders are only recorded; nothing is sent. Connect SMS or email when a provider exists
- [ ] Statement lines are typed or pasted; connect bank and mobile money feeds or file imports. Cash-ups have no opening float or deposit slip tracking
- [ ] Advance payments (more than is owed) and refunds are refused; they need their own flow and approval
- [ ] The Platform Admin's Student payments table and the Parent fee statements do not yet show the Bursar's invoices and receipts
- [ ] Phone width and dark mode of the seven Bursar pages were not checked in a browser; the pages were fetched from the dev server (200) and the logic is covered by tests. Add them to the contrast scan
- [ ] `next build` could not run in the sandbox (Google Fonts unreachable); typecheck, lint and tests pass

## 10. Platform Admin vs School Admin, higher education focus (added 2026-11-20)
Team lead review: the platform operator and a school's own admin are different people with different scope. Done on `main`.

- [x] **Two roles.** **Platform Admin** (`/platform`, cloud only) is about tenants and the platform: Tenants & schools, Subscriptions, Usage & capacity, Support queue, Platform users, Access control, Platform settings (default branding) and a platform-level Audit trail. **School Admin** (`/school-admin`) runs one school: Institution, Finances, Users, Registrations, Academics, Examinations, **Hostels**, Reports, School settings, Data export & backup. Config: `buildPlatformRole` / `buildSchoolAdminRole` in `config/navigation.ts` (`adminNavItem(slug)` finds an item in either)
- [x] **No school records for the Platform Admin.** Its pages are never given a school (`AdminSection` in `app/[role]/[...slug]/page.tsx`), its dashboard is tenant-level only (`PLATFORM_WIDE`), its search returns tenants and platform pages only, it always uses the platform default theme, and its audit trail lists platform-level events only (`audit-trail` slug)
- [x] **Workspace entry.** The only route into a school's students, fees, registrations or hostels is **Open workspace** on Tenants & schools (`server/actions/workspace.ts`): sets the school, writes a "Workspace opened" audit entry (also visible in that school's own audit trail), shows a banner on every School Admin page with **Exit workspace** (audited as "Workspace closed"). School Admin pages with no workspace open ask which school to open
- [x] **Single-school deployments** (dedicated, self-hosted): no Platform Admin (`availableRoleKeys`); the School Admin is the top admin and the only role offered in the pickers
- [x] **Higher education first.** Each tenant has a **setup type** (`config/institution.ts`: `SETUPS`, `DEFAULT_SETUP`): *Higher education* (default: College and University) or *Higher education + school levels* (also enables Primary and High School divisions). Primary and High School features are switched off, not deleted: creating or editing a tenant with school-level divisions is refused unless its setup allows them (`setupError` in `server/actions/records.ts`). Shown as a "Setup" column; changes audited as "Setup changed". Existing school-level demo tenants are on the extended setup
- [x] Theme editor takes an `area` ("platform" or "school") instead of guessing from the selection, so the Platform Admin edits only the default and a School Admin only its open school
- [x] `tests/platform-school-split.test.ts` and updates to the deployment, theme-scope, dashboard and form tests (858 pass across the repo)
- [ ] Setup type only gates the tenant form today. Also hide school-level wording, sample data and Teacher/Parent/Student variants for tenants on the higher-education setup, and make the Teacher and Parent roles optional per setup
- [ ] Per-setup feature flags beyond Primary and High School (for example hostels on or off per tenant)
- [ ] Platform Admin and School Admin need real roles in the session: `requirePlatformAdmin` (`server/forms/guard.ts`) is still a placeholder, and school-level form actions must verify School Admin, or a Platform Admin with an open workspace, and fail closed. Today the guard only checks that someone is signed in; the open workspace cookie is what scopes the data
- [ ] Time-box workspace entry (the cookie lasts 24 hours) and let a school see and approve platform support access
- [ ] Division scope of Data export & backup, Access control (which still lists both admin roles in the matrix) and platform user roles should be reviewed with the team lead
- [ ] `next build` could not run in the sandbox (Google Fonts unreachable); typecheck, lint, tests and the dev server (routes return 200) pass
