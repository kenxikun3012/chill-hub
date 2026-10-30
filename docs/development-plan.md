# Development plan

Chill Hub is built **incrementally**. Each increment delivers working, documented features. The mobile app and the website are built in parallel from the same Expo codebase.

## MVP-1 (current)

Goal: a usable first release covering sign-up with admin approval, profiles, lobbies with chat, real-time notifications and post-match feedback.

| Step | Work | Status |
|---|---|---|
| 1 | **Database**: MVP-1 schema, first migration, seed data, database docs | ✅ Done (2026-10-24): applied and seeded on the Neon `dev` branch |
| 2 | **Basic CRUD APIs** for the MVP-1 tables (NestJS + OpenAPI) | ✅ Done (2026-10-28): 64 endpoints with core rules, 51 e2e tests. See the [API guide](api/README.md) |
| 3a | **Authentication**: sign-up (3 steps), email code, pending/rejected screens, login, password reset; admin approval queue | ⬜ |
| 3b | **Profile editing**: profile, in-game IDs, ranks and roles | ⬜ |
| 3c | **Lobby CRUD**: browse/filter, 3-step create, public/private join, host view, lobby chat | ⬜ |
| 3d | **Real-time notifications**: in-app inbox, push, preferences, live lobby updates | ⬜ |
| 3e | **Post-match feedback**: rating screen, reputation on profiles | ⬜ |

Each feature in step 3 is one agile iteration: build the UI (app + web) and connect it to the backend, test it, then update the docs and changelog.

### Definition of done (every step)

- Works on Android, iOS (via Expo Go / EAS) and web where relevant.
- API rules enforced on the server, with OpenAPI docs updated.
- Database changes come as a migration, with [docs/database](database/README.md) updated.
- An entry in [CHANGELOG.md](../CHANGELOG.md); a decision record in [docs/decisions](decisions/) for any significant choice.

## Later increments (from the spec)

- ID photo upload with 30-day deletion (ACC-08)
- Knowledge sharing: guides, Q&A, news
- Reporting and moderation queue, audit log
- Admin panel: dashboard, users, games catalogue, settings
- Tournaments, leaderboards, badges (Phase 2)
