# ADR 0002: Database tooling and conventions

**Status:** Accepted · **Date:** 2026-10-24 · **Increment:** MVP-1, step 1

## Context

The API (NestJS) needs a type-safe way to define and migrate the PostgreSQL schema. Development runs on a Neon branch, while production can run either on Postgres on the VPS (Option 1) or on Neon Free (Option 2). Authentication will use Better Auth, which stores users, sessions, accounts and verification tokens in our database.

## Decisions

1. **Prisma ORM 7.10.1** (pinned) for schema, migrations and the query client. Prisma's `latest` tag pointed to an 8.0 release candidate at the time, so we pinned the stable 7.x line.
2. **`@prisma/adapter-pg`** (node-postgres) as the runtime driver adapter, rather than Neon's own serverless adapter. The API is a long-running server, and `pg` works the same against Neon and against Postgres on the VPS, so switching hosting options needs no code change.
3. **Two connection strings:** `DATABASE_URL` (pooled, used by the app) and `DIRECT_URL` (unpooled, used by Prisma migrations via `prisma.config.ts`).
4. **Text primary keys with UUID values.** Better Auth creates its own string IDs for auth tables; using `text` everywhere keeps all foreign keys to `users` the same type.
5. **snake_case in the database, camelCase in code** via `@map` / `@@map`; plural table names.
6. **CHECK constraints** that Prisma can't express are appended by hand to migrations and listed in [docs/database](../database/README.md#5-constraints-and-indexes).
7. **TypeScript 5.9** (pinned) instead of TypeScript 7 (the native compiler), until NestJS tooling supports it.

## Consequences

- Text IDs use slightly more space than native `uuid`; irrelevant at our scale.
- Prisma 7 requires a driver adapter and a `prisma.config.ts`; contributors must use the npm scripts rather than old Prisma 6 tutorials.
- Moving from Neon to the VPS (or back) is a `pg_dump` / `pg_restore` plus a change to the two environment variables.
