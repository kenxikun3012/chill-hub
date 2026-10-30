# ADR 0004: Authentication

**Status:** Accepted (2026-10-30)

## Context

Step 3a replaces the temporary `x-dev-user-id` header with real accounts. The same API serves a website and a mobile app, sign-up has three steps, and every account needs admin approval.

## Decisions

1. **Better Auth runs inside the API**, mounted at `/api/v1/auth` before Nest's body parsers, using the existing `users`, `sessions`, `auth_accounts` and `verifications` tables.
2. **6-digit emailed codes** for email verification and password reset, so app and web work the same without deep links. Codes are stored hashed, last 10 minutes and allow 5 attempts.
3. **Password login only.** Better Auth's passwordless, change-email, update-user and delete-user routes are disabled. Account changes go through `/me`.
4. **Two session transports:** an HttpOnly cookie on web, a bearer token in the app (from the `set-auth-token` response header or the `token` field). Sessions last 30 days, renewed on use.
5. **`users.student_id_number` is nullable.** The account exists after sign-up step 1, but the number arrives in step 3. An approval request can't be submitted without it and an in-game ID.
6. **The origin check stays on in tests.** Better Auth turns it off when `NODE_ENV=test`, so we set it explicitly and tests see production behaviour.
7. **Email goes through a `Mailer` interface:** console in development, Resend in production. The API refuses to start in production without Resend settings, so codes can't end up in logs there.
8. **`npm run admin:create` makes the first admin** on the server. Nothing is exposed over the API.
9. **`x-dev-user-id` stays for development and tests** when `DEV_AUTH=true`, and is still refused in production.

## Consequences

- Auth routes return Better Auth's error shape (`{ code, message }`), not our `{ statusCode, error, message }`.
- Rate limits are kept in memory, per API process, and keyed on the client address from `x-forwarded-for`. That suits one VPS behind Caddy, but the API port must not be reachable directly, or clients could fake the header.
- Web and API must be on the same parent domain for the session cookie to work between them. This is to be settled when the website is deployed.
