# API guide: MVP-1

**Code:** [`apps/api`](../../apps/api) (NestJS 12) · **Schemas:** [`packages/shared`](../../packages/shared/src) (Zod 4) · **Live docs:** Swagger UI at `http://localhost:3000/api/v1/docs` when running locally
**Status:** Step 2 (basic CRUD + core rules) done. Login (Better Auth) arrives in step 3a; real-time and push delivery in step 3d.

## Contents

1. [Running the API](#1-running-the-api)
2. [Conventions](#2-conventions)
3. [Authentication](#3-authentication)
4. [Access rules](#4-access-rules)
5. [Endpoints](#5-endpoints)
6. [Business rules enforced by the API](#6-business-rules-enforced-by-the-api)
7. [Testing](#7-testing)
8. [Project structure](#8-project-structure)

---

## 1. Running the API

`apps/api/.env` needs `DATABASE_URL` (see [`.env.example`](../../apps/api/.env.example)). For local development also set:

```
DEV_AUTH=true
PORT=3000
```

Then, from the repo root:

```bash
npm run api:dev
```

This builds `@chill-hub/shared`, generates the Prisma client and starts Nest in watch mode. Open `http://localhost:3000/api/v1/docs`, click **Authorize** and paste a user ID into `x-dev-user-id` to try endpoints.

## 2. Conventions

| Topic | Convention |
|---|---|
| Base path | `/api/v1` |
| Format | JSON in and out. Field names are camelCase. Dates are ISO 8601 strings (e.g. `2026-10-28T20:00:00+06:30`); responses use UTC (`...Z`). |
| Validation | Every body, query and path parameter is checked against a Zod schema from `@chill-hub/shared`. Unknown body fields are rejected. |
| Lists | Cursor pagination: `?limit=20&cursor=<id>` (limit 1–100, default 20). Response: `{ "items": [...], "nextCursor": "<id>" \| null }`. Pass `nextCursor` back as `cursor` for the next page. |
| Errors | Always `{ "statusCode", "error", "message", "details"? }`. `details` lists each validation problem as `"field: message"`. |
| Status codes | 200 OK · 201 created · 204 no content (deletes) · 400 invalid input or broken rule · 401 not identified · 403 not allowed · 404 not found · 409 conflict (duplicate, full lobby, limit reached, already answered) · 503 database unreachable |
| IDs | Text IDs (UUID strings). |

Example error:

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Validation failed",
  "details": ["lobbyCode: Enter the lobby code from the game"]
}
```

## 3. Authentication

Better Auth runs inside the API at `/api/v1/auth` (see [ADR 0004](../decisions/0004-authentication.md)). Send JSON. These routes return errors as `{ code, message }`.

| Step | Request | Body | Result |
|---|---|---|---|
| Sign-up 1 | `POST /auth/sign-up/email` | `name, email, password` | Emails a 6-digit code. College domains only; password 8–128 characters |
| Sign-up 2 | `POST /auth/email-otp/verify-email` | `email, otp` | Logged in as pending; returns `token` |
| Resend code | `POST /auth/email-otp/send-verification-otp` | `email, type: "email-verification"` | Emails a new code |
| Sign-up 3 | `PUT /me/sign-up-details` | `studentIdNumber, inGameAccount: { gameId, inGameName, rankId?, preferredRoleIds? }` | Saves details and joins the approval queue |
| Log in | `POST /auth/sign-in/email` | `email, password` | Returns `token`. 403 if the email isn't verified (a new code is sent) or the account is banned |
| Log out | `POST /auth/sign-out` | `{}` | Ends this session |
| Forgot password | `POST /auth/email-otp/request-password-reset` | `email` | Always 200; emails a code if the account exists |
| Reset password | `POST /auth/email-otp/reset-password` | `email, otp, password` | Sets the password and ends all sessions |

**Staying logged in:** the website uses an HttpOnly cookie. The app sends `Authorization: Bearer <token>`, with the token from the response above or the `set-auth-token` header. Sessions last 30 days and renew with use.

**Re-applying after a rejection:** the reason is in `GET /me/approval-requests`. Call `PUT /me/sign-up-details` again with the corrected details; earlier requests stay in the history.

**Limits:** 5 login or sign-up attempts per minute per client address (NFR-09). Codes last 10 minutes and allow 5 attempts.

**First admin:** run `npm run admin:create` on the server. It asks for a name, email and password.

**Emails:** in development they're printed to the API console, codes included. In production, set `RESEND_API_KEY` and `MAIL_FROM`.

**Development shortcut:** with `DEV_AUTH=true`, the `x-dev-user-id: <user id>` header also identifies a user. The API refuses to start with it on in production. `npm run db:seed:demo` prints demo user ids.

**Production settings:** `BETTER_AUTH_SECRET` (32+ characters), `BETTER_AUTH_URL`, `RESEND_API_KEY` and `MAIL_FROM` are required, or the API refuses to start. Run the API behind Caddy with its port closed to the internet, because rate limiting trusts `x-forwarded-for`.

## 4. Access rules

Applied to every request by the guard (`src/common/auth/dev-auth.guard.ts`):

| Account status | Can do |
|---|---|
| approved | Everything their roles allow |
| pending / rejected | Only routes marked *pending OK* below: own account, profile, in-game IDs, notifications, approval requests (ACC-06) |
| suspended | Read (GET) anything; no changes until `suspendedUntil` (MOD-06) |
| banned / deleted | Nothing |

Roles: **player** (every approved user), **moderator** (read users), **organizer** (Phase 2), **admin** (manage users, approvals, games, settings; delete any lobby).

## 5. Endpoints

Legend: 🌐 public (no user needed) · ⏳ pending OK · 🛡 moderator/admin · 👑 admin only. Everything else needs an approved user.

### Health and settings

| Method | Path | Who | Purpose |
|---|---|---|---|
| GET | `/health` | 🌐 | API and database status |
| GET | `/settings/public` | 🌐 | Allowed email domains (for the sign-up form) |
| GET | `/settings` | 👑 | All settings with current values |
| GET / PUT | `/settings/:key` | 👑 | Read / change one setting (`{ "value": ... }`, validated per key) |

### My account

| Method | Path | Who | Purpose |
|---|---|---|---|
| GET | `/me` | ⏳ | My account: status, roles, email, student ID |
| DELETE | `/me` | ⏳ | Delete my account (ACC-10) |
| PUT | `/me/sign-up-details` | ⏳ | Sign-up step 3 or fix details after a rejection, then join the queue |
| GET / POST | `/me/approval-requests` | ⏳ | My approval history / ask for (re-)review (needs a student ID number and an in-game ID) |
| GET / PUT | `/me/profile` | ⏳ | My profile / create or update it |
| GET / POST | `/me/in-game-accounts` | ⏳ | My in-game IDs / add one |
| PATCH / DELETE | `/me/in-game-accounts/:id` | ⏳ | Edit / remove one |
| GET | `/me/notifications` | ⏳ | Inbox, newest first (`?unreadOnly=true`) |
| GET | `/me/notifications/unread-count` | ⏳ | `{ "unread": n }` |
| POST | `/me/notifications/read-all` | ⏳ | Mark everything read |
| PATCH / DELETE | `/me/notifications/:id` | ⏳ | `{ "read": true/false }` / delete |
| GET | `/me/notification-preferences` | ⏳ | Grouped toggles with defaults |
| PUT | `/me/notification-preferences/:group` | ⏳ | `{ push, email, inApp }`; `account` can't be changed |
| POST | `/me/push-tokens` | ⏳ | Register this device's Expo push token |
| DELETE | `/me/push-tokens/:token` | ⏳ | Unregister it |

### Players

| Method | Path | Who | Purpose |
|---|---|---|---|
| GET | `/profiles/:userId` | | Public profile + in-game accounts (no email, real name or student ID) |
| GET | `/users/:id/reputation` | | 👍 count, no-show count and rate, lobbies played (REP-02) |

### Games catalogue

| Method | Path | Who | Purpose |
|---|---|---|---|
| GET | `/games`, `/games/:id` | 🌐 | Active games with ranks, roles, modes (`?includeInactive=true` for admins) |
| POST / PATCH / DELETE | `/games`, `/games/:id` | 👑 | Manage games (delete only if unused; otherwise set `isActive: false`) |
| POST / PATCH / DELETE | `/games/:id/ranks[/:itemId]` | 👑 | Manage ranks (`tierOrder` 1 = lowest) |
| POST / PATCH / DELETE | `/games/:id/roles[/:itemId]` | 👑 | Manage roles |
| POST / PATCH / DELETE | `/games/:id/modes[/:itemId]` | 👑 | Manage modes |

### Lobbies

| Method | Path | Who | Purpose |
|---|---|---|---|
| GET | `/lobbies` | | Browse. Filters: `gameId`, `modeId`, `status` (default `open`), `visibility`, `roleId`, `rankId` (lobbies whose range includes this rank), `hostId`, `startsAfter`, `startsBefore`, `mine=true` (my active lobbies) |
| GET | `/lobbies/:id` | | Detail with member list. `lobbyCode` is `null` when you may not see it |
| POST | `/lobbies` | | Create (you become host and first member) |
| PATCH | `/lobbies/:id` | host | Edit any field, change code, `status: "in_progress"` or `"closed"` |
| DELETE | `/lobbies/:id` | host / 👑 | Hard delete (host: only while nobody else joined) |
| GET | `/lobbies/:id/members` | | Active members |
| POST | `/lobbies/:id/members` | | Take a slot in a public lobby |
| DELETE | `/lobbies/:id/members/:userId` | self / host | Leave, or host removes a player |
| POST | `/lobbies/:id/join-requests` | | Ask to join a private lobby |
| GET | `/lobbies/:id/join-requests` | host | Requests (`?status=pending`) with rank, roles and reputation |
| PATCH | `/lobbies/:id/join-requests/:requestId` | host / requester | `accepted` or `declined` (host), `cancelled` (requester) |
| GET / POST | `/lobbies/:id/messages` | members | Chat history (newest first) / send a message |
| GET | `/lobbies/:id/ratings/mine` | members | My ratings in this lobby |
| PUT | `/lobbies/:id/ratings/:rateeId` | members | Rate a teammate `{ "value": "good" \| "no_show" }` after the lobby ends |

### Staff

| Method | Path | Who | Purpose |
|---|---|---|---|
| GET | `/users`, `/users/:id` | 🛡 | Search users (`?q=`, `status`, `role`) |
| POST | `/users` | 👑 | Create a user (college email only) |
| PATCH | `/users/:id` | 👑 | Name, status, `suspendedUntil` (banning logs them out) |
| PUT | `/users/:id/roles` | 👑 | Replace roles |
| DELETE | `/users/:id` | 👑 | Delete account (personal data removed) |
| GET | `/approval-requests` | 👑 | Queue (`?status=pending`, oldest first) |
| GET / PATCH | `/approval-requests/:id` | 👑 | Detail / `{ "decision": "approve" }` or `{ "decision": "reject", "rejectReason": "..." }` |

## 6. Business rules enforced by the API

| Rule | Spec | Where |
|---|---|---|
| Private lobby codes only reach the host and active members; closed/expired lobbies show no code | NFR-06, LOB-03, LOB-09 | `canSeeCode()` in `lobby.presenter.ts`, the single place that decides |
| A lobby needs a code; capacity ≤ the game's max lobby size and ≥ current players; mode, ranks and roles must belong to the game; lowest rank ≤ highest | LOB-01, LOB-02 | `lobby-rules.ts` |
| Start time between 5 minutes ago and 14 days ahead | LOB-01 | `lobby-rules.ts` |
| A player can be in at most `max_active_lobbies_per_player` active lobbies (hosting counts) | LOB-13 | checked on create, join and accept |
| Lobby becomes `full` / back to `open` as players join and leave; full lobbies are hidden from browse | LOB-08 | `syncFullness()` |
| Open lobbies more than `lobby_expiry_hours` past their start are hidden from browse (marked `expired` by a job in step 3d) | LOB-09 | `LobbiesService.list` |
| Only the host edits; changing the code posts a system chat message and notifies members | LOB-07 | `LobbiesService.update` |
| Closing cancels pending requests, makes chat read-only and asks everyone to rate | LOB-11, REP-01 | `LobbiesService.update` |
| Ratings: only after the lobby ends, only between players who were in it, not yourself, changeable until `editable_until` (24 h) | REP-01, REP-03 | `RatingsService` |
| Capacity and limit checks lock the lobby/user row in a transaction, so two players can't take the last slot at once | | `lockLobby()`, `lockUser()` |
| Only college email domains can be used | ACC-02 | `SettingsService.isEmailDomainAllowed` |
| Approving adds the `player` role; both decisions notify the student; a reason is required to reject | ACC-04, ACC-05 | `ApprovalsService.decide` |
| Notifications respect each user's in-app setting per group; account notifications always arrive | NOT-03 | `NotificationsService.notify` |

Real-time delivery (WebSocket events, push and email) is **not** in this step. The API already stores every notification, so step 3d only needs to send them.

## 7. Testing

The end-to-end tests make real HTTP requests to the whole app. They live in [`apps/api/test`](../../apps/api/test): 74 tests in 6 files, covering every rule in section 6.

**Setup (once):** in Neon, create a branch called `test` (from `dev`), then add to `apps/api/.env`:

```
TEST_DATABASE_URL="<test branch pooled URL>"
TEST_DIRECT_URL="<test branch direct URL>"
```

**Run:**

```bash
npm run api:test
```

- The suite applies migrations and seeds the games, then **wipes all data except the games catalogue** before each file. It refuses to run if `TEST_DATABASE_URL` points at the same host as `DATABASE_URL`.
- It runs Jest with `--experimental-vm-modules`, which Jest needs to load NestJS 12's ES-module packages.
- Any PostgreSQL works as the test database. For example, a local Postgres or PGlite server via `TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54329/postgres?sslmode=disable` (how the suite was first verified, before the Neon branch existed).

## 8. Project structure

```
apps/api/src
├─ main.ts, app.module.ts, app.setup.ts   bootstrap, module wiring, pipes/filters/Swagger
├─ config/env.ts                           environment variables (validated with Zod)
├─ core/core.module.ts                     global: env, Prisma, settings, notifications
├─ prisma/prisma.service.ts                Prisma client (pg adapter)
├─ common/auth/                            session guard, @Public, @AllowPending, @Roles, @CurrentActor
├─ common/http/                            error filter, cursor pagination helpers
└─ modules/
   ├─ auth/          Better Auth setup, email senders
   ├─ accounts/      /me, /users, /approval-requests
   ├─ games/         /games (+ ranks, roles, modes)
   ├─ profiles/      /profiles, /me/profile, /me/in-game-accounts
   ├─ lobbies/       /lobbies (+ members, join requests, chat), lobby rules and presenter
   ├─ ratings/       /lobbies/:id/ratings, /users/:id/reputation
   ├─ notifications/ /me/notifications, preferences, push tokens
   ├─ settings/      /settings
   └─ health/        /health
```

**Adding an endpoint:** add or extend a Zod schema in `packages/shared`, then use it in the controller as `@Body({ schema })` / `@Query({ schema })`. Swagger picks it up automatically. Put the rules in the service, and add an e2e test.
