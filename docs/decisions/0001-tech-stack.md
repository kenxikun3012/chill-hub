# ADR 0001: Technology stack and hosting

**Status:** Accepted · **Date:** 2026-10-24

## Context

- Team: 1–2 developers, strong in TypeScript (plus some .NET), no Android experience, no Mac.
- Region: Supabase and Railway are unavailable; Render, Cloudflare, Neon, Vercel and VPS providers are available.
- Budget: under US$3/month for hosting, and the real-time server must not sleep (rules out most free plans).
- Shared code now, with the option of native apps later.

## Decision

| Layer | Choice |
|---|---|
| Android, iOS, player website and admin panel | React Native + Expo (Expo Router for web), one codebase; admin as protected `/admin` routes |
| API | NestJS (TypeScript), OpenAPI-documented, holds all business rules |
| Real-time | Socket.IO on the API, Redis adapter when scaling out |
| Database | PostgreSQL via Prisma 7 (see [ADR 0002](0002-database-conventions.md)) |
| Auth | Better Auth inside the API |
| Files | Cloudflare R2 |
| Hosting | ~US$2/month VPS (1 GB+ RAM) with Docker Compose; database on the VPS (Option 1) or Neon Free (Option 2); web build on Cloudflare Pages |
| Repo | npm workspaces monorepo (`apps/*`, `packages/*`) |

## Alternatives considered

- **.NET MAUI / Flutter / fully native apps:** MAUI and Swift need a Mac for iOS; Flutter means learning Dart; native means 2–3 codebases.
- **Render / Railway / Fly.io for the API:** Railway unavailable; Render's free tier sleeps and paid plans exceed the budget; Fly.io's smallest always-on machine is too small for NestJS within budget.
- **Neon Realtime + Neon Functions (beta):** promising and possibly $0, but beta, limited to four regions, and no row-level security yet for protecting private lobby codes. Re-evaluate later.
- **Cloudflare Workers + Durable Objects:** $0 and never sleeps, but would replace NestJS entirely.
- **pnpm + Turborepo:** pnpm isn't available without extra installs on Node 25 (Corepack was removed); npm workspaces are enough for now.

## Consequences

- The team maintains a VPS (security updates, backups); see [SPEC 5.2](../../SPEC.md#52-reliability-and-scaling).
- Native apps can be added later against the same API ([SPEC 5.3](../../SPEC.md#53-path-to-native-apps-later)).
