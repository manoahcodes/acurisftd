# Platform Admin: to-do (not yet covered)

Last updated: 2026-11-08. Covered so far: all list screens, create/edit forms on mock data, sidebar features, search, tests (207 passing, Chromium only).

## 1. Real data and sign-in
- [ ] Replace in-memory mock repositories with a real API or database (data currently resets on server restart)
- [ ] Real sign-in and session with roles
- [ ] Replace the placeholder permission check in `server/forms/guard.ts` (must verify Platform Admin and fail closed)
- [ ] Enforce role scopes (which divisions a role can see). Today they are only displayed
- [ ] Swap `RecordStore` and `TenantDirectory` mocks for real implementations that check role and tenant on every call

## 2. Disabled process buttons
- [ ] Import CSV (students)
- [ ] Add room (hostels)
- [ ] Change plan (subscriptions)
- [ ] Edit settings (institution types and general settings, in bulk)
- [ ] Generate transcript
- [ ] Generate dockets
- [ ] Generate report (Reports pages)
- [ ] Upload results
- [ ] Publish results
- [ ] Open registration (term or semester)
- [ ] Import statement

## 3. Missing features
- [ ] Delete / archive / suspend records (nothing can be removed today)
- [ ] Forms for read-only tables: Subscriptions, Usage and capacity, Institution types, Permission matrix, Division access
- [ ] Change a school's divisions after it is created
- [ ] Assign or change a staff member's role and division access after creation
- [ ] Reports: export, print and filters
- [ ] Audit trail should log changes made through the forms

## 4. Rough edges
- [ ] Summary cards (KPIs) and counts do not update after adding a record
- [ ] Editing a row whose date reads "Jan 2026" opens with an empty date (cannot be parsed back)
- [ ] Check whether the top-bar "Add tenant" button opens the new form or only goes to the page

## 5. Verification still owed
- [ ] Firefox: scrollbar theme and sidebar styling (sandbox could not download browsers)
- [ ] Safari / WebKit: same
- [ ] Phone and tablet layouts, including the form dialogs
- [ ] Screen-reader and keyboard pass on the forms
- [ ] Browser (end-to-end) tests in the repo, and CI to run lint, typecheck and tests

## Out of scope for Platform Admin (separate work)
- Teacher, Bursar, Cashier, Parent and Student pages are still "hasn't been built yet" placeholders

## 6. Branding and theme (added with the theme editor)
- [ ] Swap `ThemeRepository` mock for a real one that checks role and tenant on every write (`server/repositories/theme-types.ts`)
- [ ] Apply the saved time zone: `lib/format.ts` still hard-codes Africa/Lusaka
- [ ] Use logo, welcome message and sign-in banner on the sign-in page (no sign-in page exists yet)
- [ ] Print the document header, footer and signature line on receipts, dockets and transcripts
- [ ] Move the logo from a data URL to file storage when a real backend exists
- [ ] Theme can flash default colours while the shell fallback shows (`ShellFallback`)
- [ ] Check dark mode on every screen (hard-coded `text-white` / `bg-white/10` on non-navy surfaces)
- [ ] Verify Poppins, Lato and Source Sans 3 load in a networked build (sandbox could not reach Google Fonts)
