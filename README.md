# Chill Hub

A gaming hub for our college: find teammates through game lobbies, share game knowledge, and (later) run esports tournaments. Android, iOS and web from one Expo codebase, backed by a NestJS API and PostgreSQL.

> **Status:** MVP-1, step 1 (database) in progress. See the [development plan](docs/development-plan.md).

## Repository layout

```
apps/
  api/            NestJS API (Prisma schema, migrations, seed in apps/api/prisma)
  app/            Expo app for Android, iOS and web (coming in step 3)
packages/
  shared/         Shared types, validation and API client (coming in step 2)
docs/             Development docs: plan, database design, decision records
diagrams/         Use case, process and ERD diagrams (draw.io + PNG)
wireframes/       Clickable wireframe prototype (open index.html)
tools/            Helper scripts (e.g. SPEC.md -> Word)
SPEC.md           Requirements specification
```

## Getting started

**Requirements:** Node.js 22 or newer (24 LTS recommended), Git, and a Neon account (free) for the development database.

```bash
npm install
```

Copy `apps/api/.env.example` to `apps/api/.env` and fill in your Neon `dev` branch connection strings (see [database setup](docs/database/README.md#9-working-with-the-database)). Then:

```bash
npm run db:migrate
```

```bash
npm run db:seed
```

## Useful scripts (run from the repo root)

| Script | What it does |
|---|---|
| `npm run db:migrate` | Apply migrations to the dev database (creates new ones after schema changes) |
| `npm run db:seed` | Load games catalogue and default settings |
| `npm run db:studio` | Browse the database in Prisma Studio |
| `npm run db:generate` | Regenerate the Prisma client |
| `npm run spec:docx` | Rebuild the Word version of the spec from `SPEC.md` |

## Documentation

Start at [docs/README.md](docs/README.md).
