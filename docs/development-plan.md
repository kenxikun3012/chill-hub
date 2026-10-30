# Development plan

Chill Hub is built **incrementally**. Each increment delivers working, documented features. The mobile app and the website are built in parallel from the same Expo codebase.

## MVP-1 (current)

Goal: a usable first release covering sign-up with admin approval, profiles, lobbies with chat, real-time notifications and post-match feedback.

| Step | Work | Status |
|---|---|---|
| 1 | **Database**: MVP-1 schema, first migration, seed data, database docs | ✅ Done (2026-10-24): applied and seeded on the Neon `dev` branch |
| 2 | **Basic CRUD APIs** for the MVP-1 tables (NestJS + OpenAPI) | ✅ Done (2026-10-28): 64 endpoints with core rules, 51 e2e tests. See the [API guide](api/README.md) |
| 3a | **Authentication**: sign-up (3 steps), email code, pending/rejected screens, login, password reset; admin approval queue | ✅ Built (2026-10-30): API, app screens and admin queue. See the [plan below](#step-3a-plan-authentication) |
| 3b | **Profile editing**: profile, in-game IDs, ranks and roles | ✅ Built (2026-10-30): initials instead of photos for now |
| 3c | **Lobby CRUD**: browse/filter, 3-step create, public/private join, host view, lobby chat | ✅ Built (2026-10-30): chat and lobbies refresh every few seconds until step 3d |
| 3d | **Real-time notifications**: in-app inbox, push, preferences, live lobby updates | ⬜ |
| 3e | **Post-match feedback**: rating screen, reputation on profiles | ⬜ |

Each feature in step 3 is one agile iteration: build the UI (app + web) and connect it to the backend, test it, then update the docs and changelog.

### Definition of done (every step)

- Works on Android, iOS (via Expo Go / EAS) and web where relevant.
- API rules enforced on the server, with OpenAPI docs updated.
- Database changes come as a migration, with [docs/database](database/README.md) updated.
- An entry in [CHANGELOG.md](../CHANGELOG.md); a decision record in [docs/decisions](decisions/) for any significant choice.

## Step 3a plan: authentication

Decided 2026-10-30. Built in three parts, each tested, documented, reviewed and committed on its own, on `feature/auth` (from `dev`, after step 2 is merged).

**Decisions**

| Topic | Choice |
|---|---|
| Email | Codes print to the API console in development; Resend in production |
| Email verification and password reset | 6-digit emailed code for both, typed into the app |
| First admin | `npm run admin:create`: asks for email and password on the server |
| Sign-up order | 1. Name, college email, password. 2. Email code. 3. Student ID number and one in-game ID |
| Sessions | 30 days, renewed on use; a ban ends all sessions at once (ACC-09) |
| Rejected applicants | Same account: see the reason, fix details, submit a new approval request; history is kept |
| App styling | NativeWind |

**Part 1: Better Auth in the API** (built 2026-10-30, see [ADR 0004](decisions/0004-authentication.md))

1. Spike first: confirm Better Auth runs inside the CommonJS NestJS app and maps onto the existing `sessions`, `auth_accounts` and `verifications` tables.
2. Migration: make `users.student_id_number` nullable, because the account exists before sign-up step 3. It stays unique, and an approval request can't be submitted without it.
3. Email sender interface with console and Resend versions.
4. Sign-up, email code, login, logout, password reset and login rate limiting (NFR-09), with allowed-domain checks on the server.
5. Sign-up completion endpoint: student ID number and in-game ID, then the account joins the approval queue (ACC-03).
6. Real session guard replaces `DevAuthGuard`, keeping its status and role rules. Cookies on web, bearer tokens on the app.
7. Sessions deleted on ban; approval decisions emailed (ACC-05).
8. `admin:create` script. Auth tests log in for real; the other tests keep the dev header.

**Part 2: Expo app** (built 2026-10-30; checked on web and on Android through Expo Go; iOS not yet tried)

Differences from the wireframes: the email code comes second rather than last, so nobody fills in details for an email they don't own; one game is asked for at sign-up, with more added later in the profile; reset uses a code, not a link. The student ID photo waits for its later increment. The terms checkbox and the "Contact the esports club" button wait until those pages and contact details exist.

1. Create `apps/mobile` (Expo Router, NativeWind, `@chill-hub/shared` for validation) with an API client and session storage.
2. Screens from the wireframes: 3-step sign-up, login, forgot password, and pending and rejected status pages with re-apply.
3. Route protection by account status (ACC-06). Checked on web and on a phone through Expo Go.

**Part 3: Admin approval queue** (built 2026-10-30; checked on web)

Differences from the wireframes: no ID photo yet, and the student ID number's uniqueness isn't shown as a check because the API already refuses duplicates. The rest of the admin panel (navigation, dashboard, users, settings) comes in a later increment.

1. Protected `/admin` routes on web, for admins only.
2. Queue list, applicant details, approve, and reject with a reason.
3. End-to-end check: sign up, verify, approve, then log in as an approved player.

**Needed from the team**

- Before production only: a Resend account and a domain to send from, plus the real college email domain.
- A Neon `dev` branch, so test runs stop wiping development data.

## Step 3b decisions

Decided 2026-10-30. A display name is chosen on a required screen at the first login after approval. Approved players get bottom tabs (Home and Profile for now). `/` is the entry point: the welcome page for guests, a redirect to the right screen for everyone else. Avatars are initials until file storage arrives. `/players/:id` shows other players' public profiles and reputation, ready for step 3c to link to; "Report user" waits for moderation.

## Step 3c decisions

Decided 2026-10-30. Lobbies can be scheduled up to 24 hours ahead (spec v0.7), so the host picks Now or types a clock time, which means its next occurrence. An open chat refreshes every 5 seconds and an open lobby every 10 until Socket.IO arrives in step 3d; the list refreshes on opening and pull-down. Search is left out for now. Closing a lobby makes chat read-only and sends the rating notification; the rating screen is step 3e. Differences from the wireframes: the lobby page shows no rank or role per member and no host reputation on cards, because the API doesn't return them yet.

## Staff and lobbies

Decided 2026-10-30 (spec v0.8). Moderators and admins are staff accounts and can't use lobbies, even with the player role. The Lobbies and Create tabs and My lobbies are hidden for them, and the API refuses them. Admins can still delete a lobby through the API until a moderation screen exists. Organizers keep lobby access.

## Later increments (from the spec)

- ID photo upload with 30-day deletion (ACC-08), and profile photos (PRO-01), once file storage is set up
- Knowledge sharing: guides, Q&A, news
- Reporting and moderation queue, audit log
- Admin panel: dashboard, users, games catalogue, settings
- Tournaments, leaderboards, badges (Phase 2)
