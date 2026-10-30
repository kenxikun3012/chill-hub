# Changelog

All notable changes to Chill Hub. Each entry belongs to an increment and step from the [development plan](docs/development-plan.md).

## [Unreleased]: MVP-1

### Step 3b: Profile editing (2026-10-30)

- Bottom tabs for approved players, and a required display name screen at the first login after approval.
- My profile: details, games with ranks and roles, and reputation. Edit profile: display name, bio, department, year, and adding, editing and removing games (PRO-01, PRO-03).
- `/players/:id`: another player's public profile, without email, real name or student ID (PRO-04).
- Avatars show initials until file storage is set up.

### Step 3a, Part 3: Admin approval queue (2026-10-30)

- `/admin` on the website, for admins only: pending, approved and rejected tabs, applicant details, approve, and reject with a required reason (ready-made reasons included). Stacks into one column on narrow screens (ACC-04, ADM-02).
- Admins get a "Sign-up approvals" button on the home page.

### Step 3a, Part 2: Expo app (2026-10-30)

- `apps/mobile`: Expo SDK 58 app and website with Expo Router and NativeWind (colours from the wireframes).
- Screens: welcome, 3-step sign-up, email code with resend, log in, forgot and reset password, waiting for approval, rejected with re-apply, and a placeholder home.
- Each account status only reaches its own screens (ACC-06). The website uses the session cookie; the app keeps a bearer token in secure storage.
- `passwordSchema` added to `@chill-hub/shared`, which now always loads from its build output.

### Step 3a, Part 1: Authentication API (2026-10-30)

- Better Auth at `/api/v1/auth`: sign-up with college-domain check, 6-digit email codes, login, logout and password reset, with login rate limiting (ACC-01, 02, 07; NFR-09).
- Real sessions replace the temporary header: cookie on web, bearer token in the app, 30 days. `x-dev-user-id` remains for development and tests only.
- `PUT /me/sign-up-details`: sign-up step 3 and re-applying after a rejection. An approval request now needs a student ID number and an in-game ID.
- Approval decisions are emailed (ACC-05). Emails print to the console in development and use Resend in production.
- `npm run admin:create` creates the first admin.
- Migration `20261030120000_nullable_student_id`: `users.student_id_number` is empty until sign-up step 3.
- The API refuses to start in production without an auth secret, public URL and Resend settings. 74 end-to-end tests. Decisions in [ADR 0004](docs/decisions/0004-authentication.md).

### Step 2: Basic CRUD APIs (2026-10-28)

- `packages/shared` (`@chill-hub/shared`): Zod 4 schemas, enums, settings defaults and API types, for both the API and the future Expo app.
- `apps/api`: NestJS 12 API under `/api/v1` with 64 endpoints: health, settings, my account, approvals, users, profiles, in-game accounts, games catalogue (ranks, roles, modes), lobbies, members, join requests, chat, ratings and reputation, notifications, preferences and push tokens.
- Core rules enforced: private lobby codes only for host and members (NFR-06), lobby code required, capacity and rank checks, active-lobby limit per player (LOB-13), full/open status, host-only edits, close → chat read-only and rating requests, rating window, college email domains, approval → player role, notification preferences.
- Temporary dev authentication via the `x-dev-user-id` header (`DEV_AUTH=true`, refused in production), with account-status and role rules (ACC-06, MOD-06).
- Consistent JSON errors; database errors mapped to 404/409/400; cursor pagination for lists.
- Swagger UI at `/api/v1/docs`, generated from the shared Zod schemas.
- 51 end-to-end tests (Jest + supertest) against a real PostgreSQL; refuses to run against the dev database.
- Dev-only demo seed (`npm run db:seed:demo`): an admin, three players, a public and a private lobby.
- Setting renamed: `max_active_lobbies_per_host` → `max_active_lobbies_per_player` (seed removes the old key).
- Prisma client generated as CommonJS; TypeScript 6.0. Docs: [API guide](docs/api/README.md), [ADR 0003](docs/decisions/0003-api-conventions.md).

### Step 1: Database (2026-10-24)

- Monorepo set up with npm workspaces; API package `@chill-hub/api` in `apps/api`.
- Prisma 7.10.1 with the `pg` driver adapter; `prisma.config.ts` reads `DIRECT_URL` for migrations.
- MVP-1 schema: 23 tables and 11 enums covering accounts and approval, profiles, games catalogue, lobbies, chat, ratings, notifications and settings.
- First migration `20261024120000_mvp1_init`, including hand-written CHECK constraints.
- Seed script for the games catalogue (5 games) and default settings.
- Documentation: database design, development plan, decision records 0001 and 0002.
- Applied to the Neon `dev` branch (PostgreSQL 18, Singapore) and seeded. Verified: seed is repeatable, and `prisma migrate diff` shows no drift between the database and the schema.
- Connection strings use `sslmode=verify-full`.
