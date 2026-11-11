# ACURIS — Advance Campus Unified Records & Information System

A role-based, multi-tenant school management platform frontend built with **Next.js 16** (App Router), **React 19**, and **Tailwind CSS v4**.

Each role — Platform Admin, Teacher, Bursar, Cashier, Parent, and Student — gets its own shell, navigation, dashboard, and top bar. Data is currently served by in-memory mock repositories behind typed interfaces, so the UI can be connected to a real API or database without changing components.

---

## Tech stack

| Area | Choice |
| --- | --- |
| Framework | [Next.js 16.4](https://nextjs.org) — App Router, Turbopack, Server Components |
| UI | React 19.3 |
| Language | TypeScript 5 (strict) |
| Styling | Tailwind CSS v4 (`@tailwindcss/turbopack`) with design tokens in `app/globals.css` |
| Icons | `lucide-react` |
| Package manager | pnpm 12.15 (see `packageManager` in `package.json`) |

## Requirements

- **Node.js >= 20.9** (required by Next.js 16)
- **pnpm 12.15** — enable with `corepack enable`, or install pnpm globally

## Getting started

```bash
pnpm install
pnpm dev
```

Open <http://localhost:3000>. The home page is a development-only role picker; choose a role to preview its dashboard at `/<role>` (for example `/teacher`).

### Scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Start the development server with Turbopack |
| `pnpm build` | Create a production build |
| `pnpm start` | Run the production build |
| `pnpm lint` | Run ESLint |

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Dev-only role picker (`app/page.tsx`) |
| `/[role]` | Role dashboard — KPIs and cards (`app/[role]/page.tsx`) |
| `/[role]/[...slug]` | Placeholder for every sidebar section that isn't built yet |
| `/api/search?role=<role>&q=<query>` | Tenant- and role-scoped search endpoint |

Valid roles are defined in [`config/navigation.ts`](config/navigation.ts): `platform`, `teacher`, `bursar`, `cashier`, `parent`, `student`.

## Project structure

```text
app/
  layout.tsx                 Root layout, fonts, metadata, Suspense boundary
  page.tsx                   Dev-only role picker
  [role]/
    layout.tsx               Shared shell: sidebar, top bar, skip link, role guard
    page.tsx                 Role dashboard
    [...slug]/page.tsx       Placeholder pages for future sections
  api/search/route.ts        Search API endpoint
  globals.css                Tailwind import + design tokens

components/
  shell/                     Sidebar, top bar, mobile drawer, role/campus/year/child
                             switchers, notifications, user menu, search
  dashboard/                 KPI cards, list cards, page header, skeleton, date

config/navigation.ts         Single source of truth for roles, nav items, top bar
                             config, quick actions, and user menu entries

server/
  repositories/              Typed interfaces + mock implementations (data layer)
  queries/                   Request-cached reads (React cache) using cookies
  actions/                   Server Actions that persist selections in cookies
  request-context.ts         Resolves the tenant context from the session

lib/                         Formatting, money, permission, and cookie-name helpers
types/                       Shared domain types (dashboard, directory, tenancy, top bar)
```

Alias: `@/*` maps to the project root (`tsconfig.json`).

## Architecture

### Role-driven UI

All role configuration lives in `config/navigation.ts`. A `RoleConfig` declares the role label, sidebar nav items, top bar behaviour (search placeholder, academic-year chip, quick action, child switcher), campus switcher visibility, and user-menu entries. Adding or changing a role's navigation is a one-file change; sidebar, top bar, breadcrumbs, and placeholder pages all read from it.

`ROLES` is typed as `Record<RoleKey, RoleConfig>`, so adding a role to `ROLE_KEYS` fails the build until its config (and mock dashboard) exists.

### Data layer

The UI depends only on interfaces in `server/repositories/*-types.ts`:

- `DashboardRepository` / `SessionProvider`
- `AcademicYearRepository` / `SearchRepository`
- `NotificationRepository` / `ChildRepository`
- `CampusRepository` / `NavBadgeRepository`

Current implementations are mocks in `*-mock.ts` / `mock.ts`. **`server/repositories/index.ts` is the swap point** — replace the exported mock instances with your own database- or API-backed implementations. Every repository method receives a tenant context so queries can be scoped per school; keep that scoping in the real implementation.

### Server-side reads and cookie-backed selections

- `server/queries/*` wrap reads in React `cache()` so the desktop sidebar and mobile drawer share one fetch per request. Queries that read cookies must be called inside a `<Suspense>` boundary.
- Academic year, campus, and child selections are stored in `httpOnly` cookies by Server Actions in `server/actions/*`. The corresponding query validates the cookie against the tenant's/user's own records, ignoring forged or stale values.
- The search route enforces a 2-character minimum, caps the query at 80 characters, and returns `Cache-Control: no-store`.

### Conventions

- **Money** is stored and calculated as integer **ngwee** (1 kwacha = 100 ngwee). Use `lib/money.ts`; never use floats for amounts and only format at display time.
- **Dates** are formatted in `Africa/Lusaka` (`lib/format.ts`).
- **Design tokens** (navy, brand, canvas, ink, muted, line, etc.) live in `app/globals.css`; change colours there once and every screen follows.
- **Accessibility:** the shell provides a skip link and focusable main region; interactive controls include screen-reader labels.
- **Next.js 16 specifics:** route `params` are promises and are read inside `<Suspense>`. Placeholder pages set `export const instant = false` to opt out of instant-navigation validation until real pages exist. Before writing Next.js code, read the bundled docs referenced in [`AGENTS.md`](AGENTS.md) (`node_modules/next/dist/docs/`).

## Current status

This is a frontend prototype with mocked data. Not yet implemented:

- Authentication and authorization — the role is taken from the URL, and the role switcher/search endpoint are development-only. Access control must come from the session.
- Real persistence — all repositories are in-memory mocks.
- Built-out section pages — every sidebar item except the role dashboard renders a placeholder.
- Tests — no test runner is configured yet.

### Development tunnel

`next.config.ts` whitelists a specific dev tunnel host (`*.inc1.devtunnels.ms`) for `allowedDevOrigins` and Server Action origins. If you use a different tunnel, update both entries — otherwise dev scripts and Server Actions will be blocked.

## Deployment modes

Set `NEXT_PUBLIC_ACURIS_DEPLOYMENT` (unset means `cloud`; an unknown value fails fast):

| Mode | Hosted by | Top admin | Schools visible |
| --- | --- | --- | --- |
| `cloud` | ACURIS, shared | Platform Admin | All, with a school switcher |
| `dedicated` | ACURIS, one school | School Admin | Only its own |
| `self_hosted` | The school | School Admin | Only its own |

Single-school modes hide the tenant list, subscriptions, platform users, support queue and the school switcher, refuse tenant creation, and never search across schools. Every mode has a **Data export & backup** page. The top admin role keeps the route `/platform` in all modes. In single-school modes the session's own school is the deployment's school.
