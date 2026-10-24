# Changelog

All notable changes to Chill Hub. Each entry belongs to an increment and step from the [development plan](docs/development-plan.md).

## [Unreleased]: MVP-1

### Step 1: Database (2026-10-24)

- Monorepo set up with npm workspaces; API package `@chill-hub/api` in `apps/api`.
- Prisma 7.10.1 with the `pg` driver adapter; `prisma.config.ts` reads `DIRECT_URL` for migrations.
- MVP-1 schema: 23 tables and 11 enums covering accounts and approval, profiles, games catalogue, lobbies, chat, ratings, notifications and settings.
- First migration `20261024120000_mvp1_init`, including hand-written CHECK constraints.
- Seed script for the games catalogue (5 games) and default settings.
- Documentation: database design, development plan, decision records 0001 and 0002.
- Applied to the Neon `dev` branch (PostgreSQL 18, Singapore) and seeded. Verified: seed is repeatable, and `prisma migrate diff` shows no drift between the database and the schema.
- Connection strings use `sslmode=verify-full`.
