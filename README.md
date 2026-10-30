# Chill Hub

A gaming hub for our college: find teammates through game lobbies, share game knowledge, and (later) run esports tournaments. Android, iOS and web from one Expo codebase, backed by a NestJS API and PostgreSQL.

> **Status:** MVP-1, step 2 (CRUD APIs) done. See the [development plan](docs/development-plan.md).

## Repository layout

```
apps/
  mobile/         Expo app and website: app/ (screens), src/ (API client, session, UI)
  api/            NestJS API: src/ (modules), test/ (e2e), prisma/ (schema, migrations, seed)
packages/
  shared/         Zod schemas, enums and types shared by the API and the app
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
| `npm run app:web` | Start the website in the browser (http://localhost:8081) |
| `npm run app:dev` | Start the Expo dev server; scan the QR code with Expo Go to use a phone |
| `npm run app:typecheck` | Type-check the app |
| `npm run api:dev` | Start the API in watch mode (Swagger at http://localhost:3000/api/v1/docs) |
| `npm run api:test` | Run the API end-to-end tests (needs `TEST_DATABASE_URL`) |
| `npm run db:migrate` | Apply migrations to the dev database (creates new ones after schema changes) |
| `npm run db:seed` | Load games catalogue and default settings |
| `npm run db:seed:demo` | Dev only: add demo users and lobbies, and print their `x-dev-user-id` values |
| `npm run admin:create` | Create an approved admin (asks for name, email and password) |
| `npm run db:studio` | Browse the database in Prisma Studio |
| `npm run db:generate` | Regenerate the Prisma client |
| `npm run spec:docx` | Rebuild the Word version of the spec from `SPEC.md` |

## Documentation

Start at [docs/README.md](docs/README.md).
