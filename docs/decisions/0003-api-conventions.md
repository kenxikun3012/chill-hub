# ADR 0003: API framework setup, validation and testing

**Status:** Accepted · **Date:** 2026-10-28 · **Increment:** MVP-1, step 2

## Context

Step 2 builds the REST API on NestJS. NestJS 12 (current at the time) ships its packages as ES modules only and adds built-in support for "Standard Schema" validators such as Zod. The Expo app will need the same validation rules for its forms. Real login (Better Auth) is planned for step 3a, but ownership and role rules should be built and tested now.

## Decisions

1. **NestJS 12 in a CommonJS app.** Nest 12 supports CommonJS apps loading its ES-module packages via Node's `require(esm)`. Our API and Prisma client stay CommonJS (`moduleFormat = "cjs"` in the Prisma generator); TypeScript uses `module: nodenext`.
2. **TypeScript 6.0** (replacing the 5.9 pin from ADR 0002). The Nest CLI ships with TypeScript 6, and `@nestjs/swagger` and ts-jest support it. TypeScript 7 (the native compiler) is still avoided.
3. **Zod 4 schemas in `packages/shared`**, used by the API through Nest 12's `@Body({ schema })` / `@Query({ schema })` / `@Param(name, { schema })` with the global `StandardSchemaValidationPipe`. `@nestjs/swagger` turns the same schemas into OpenAPI automatically. No `class-validator` DTOs and no `nestjs-zod`.
4. **Dates as ISO 8601 strings** in requests (`dateTimeSchema`), converted to `Date` after validation. `z.coerce.date()` can't be expressed in OpenAPI, and crashed the Swagger document builder.
5. **Temporary dev authentication:** the `x-dev-user-id` header, only when `DEV_AUTH=true`, refused in production. The guard already applies the real status and role rules, so step 3a only swaps how the user is identified.
6. **Core rules in the API now, flows later:** step 2 includes ownership, code privacy, capacity, limits and the approval and rating rules, each with e2e tests. Step 3 adds the UI and real-time delivery on top.
7. **Testing: Jest 30 + ts-jest + supertest**, end-to-end against a real PostgreSQL (a Neon `test` branch). Jest needs `--experimental-vm-modules` to load Nest 12's ES modules (it checks for `vm.SourceTextModule`).
8. **Concurrency:** capacity and limit checks run inside a transaction that locks the lobby and user rows (`SELECT … FOR UPDATE`).

## Consequences

- `@chill-hub/shared` must be built before the API compiles (the `prebuild` / `pretest` scripts do this).
- The Expo app can import the same schemas (its `react-native` entry points at the TypeScript sources).
- If Nest or Jest later drop the need for `--experimental-vm-modules`, remove the flag from the `test` script.
- A dev-only `deepmerge` advisory in build tooling is accepted; production dependencies audit clean.
