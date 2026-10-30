# Changelog

All notable changes to Chill Hub. Each entry belongs to an increment and step from the [development plan](docs/development-plan.md).

## [Unreleased]: MVP-1

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
