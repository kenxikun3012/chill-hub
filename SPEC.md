# Chill Hub — Software Requirements Specification

| | |
|---|---|
| **Product** | Chill Hub (working name): college gaming hub |
| **Platforms** | Website, Android app, iOS app, Admin web panel |
| **Version** | 0.6 (draft): hosting changed to a low-cost VPS, with two database options (on the VPS or on Neon Free) |
| **Date** | 2026-10-15 |
| **Owner** | College esports club |
| **Status** | Draft for review |

---

## 1. Introduction

### 1.1 Purpose
This document defines the requirements for Chill Hub, a gaming portal for students at a single college. It is the reference for design, development, testing and future feature decisions.

### 1.2 Product summary
Chill Hub helps students who play popular esports titles to:

1. **Find teammates** by posting and joining game lobbies. Each lobby carries the real in-game lobby code.
2. **Share game knowledge** through guides, a Q&A forum and news/patch notes.
3. **Compete** in tournaments run by the esports club (Phase 2).
4. **Build a community** through verified profiles, reputation and lobby chat.

Accounts are restricted to approved college students. Admins review every sign-up.

### 1.3 Scope
**In scope:** account registration with admin approval, player profiles, lobby recruitment, lobby chat, knowledge sharing, tournaments, notifications, reporting, player reputation, admin/moderation panel.

**Out of scope (for now):** playing games inside the app, gaming room/equipment booking, video/clip hosting, built-in casual games, direct integration with game publisher APIs, payments, prize money handling.

### 1.4 Definitions
| Term | Meaning |
|---|---|
| Lobby | A listing created by a player to recruit others for a game session |
| Lobby code | The real in-game party/room/custom-match code needed to join in the game |
| Host | The player who created a lobby |
| In-game ID | A player's account name in a game (e.g. Riot ID, MLBB ID, Steam name) |
| Organizer | An authorized esports club moderator who runs tournaments |
| MVP | Minimum viable product: the first public release |

---

## 2. Overall description

### 2.1 Users and roles

| Role | Who | Main permissions |
|---|---|---|
| **Visitor** | Not logged in, or account pending | View landing page; sign up; check approval status |
| **Player** | Approved student | Create/join lobbies, chat, write guides, ask/answer questions, rate teammates, report, register for tournaments |
| **Moderator** | Trusted students/staff | Everything a Player can do, plus: review reports, hide/remove content, warn/suspend users |
| **Tournament Organizer** | Authorized esports club moderators | Create and run tournaments, confirm results, manage brackets |
| **Admin** | App administrators | Everything above, plus: approve/reject accounts, assign roles, manage the games list, post news, change system settings, ban users |

A user can hold more than one role (e.g. Moderator + Tournament Organizer).

### 2.2 Operating environment
- **Website:** latest two versions of Chrome, Edge, Firefox and Safari; responsive from 360 px phone width to desktop.
- **Mobile:** Android 10+ and iOS 16+.
- **Admin panel:** desktop browsers. Phone support is not required.

### 2.3 Assumptions and constraints
- The project is built and maintained by the esports club with no fixed deadline. The design must favour low running cost, simple deployment and code that new club members can pick up.
- User count is unknown. The system should comfortably serve a typical college (up to ~5,000 registered users, ~500 concurrent) and be able to scale beyond that without a redesign.
- Publishing on iOS requires an Apple Developer account ($99/year). Google Play requires a one-time $25 fee.
- The app does not connect to game servers. Lobby codes are entered manually by hosts and are not validated against the game.

---

## 3. Functional requirements

Priority key: **MVP** = first release · **P2** = Phase 2 · **P3** = later/optional.

### 3.1 Accounts and approval

| ID | Requirement | Priority |
|---|---|---|
| ACC-01 | A visitor can sign up with full name, college email, password, student ID number, a photo of their student ID card, and at least one in-game ID. | MVP |
| ACC-02 | The system verifies the college email by sending a code or link. Only emails on the allowed college domain(s) are accepted. | MVP |
| ACC-03 | After email verification, the account enters **Pending** state and appears in the admin approval queue. | MVP |
| ACC-04 | An admin can view a pending applicant's details and ID photo, then **Approve** or **Reject** (with a reason). | MVP |
| ACC-05 | The applicant is notified of the decision by email and, if they have the app, by push notification. | MVP |
| ACC-06 | Pending and rejected users cannot access any feature beyond their status page. A rejected user may re-apply once the issue is fixed. | MVP |
| ACC-07 | Users can log in, log out, and reset a forgotten password by email. | MVP |
| ACC-08 | Student ID photos are visible to admins only and are **permanently deleted within 30 days** of the approval decision. Only the approval result, the reviewing admin and the date are kept. | MVP |
| ACC-09 | Admins can suspend or ban an account. Banned users are logged out of all devices. | MVP |
| ACC-10 | Users can delete their own account. Their personal data is removed. Their public posts are kept but shown as "Deleted user". | MVP |
| ACC-11 | Admins can bulk-deactivate accounts (e.g. graduated students) by year or list. | P3 |

### 3.2 Profiles

| ID | Requirement | Priority |
|---|---|---|
| PRO-01 | Each player has a profile: display name, avatar, bio, year/department (optional), games played, in-game IDs, rank per game, and preferred roles (e.g. Duelist, Support, IGL). | MVP |
| PRO-02 | Profiles show a reputation summary (see 3.6) and, once tournaments exist, badges and tournament history. | MVP / P2 |
| PRO-03 | Players can edit their own profile at any time. Rank is self-reported. | MVP |
| PRO-04 | Student ID number and email are never shown publicly. | MVP |

### 3.3 Games catalogue

| ID | Requirement | Priority |
|---|---|---|
| GAM-01 | Admins manage a list of supported games (e.g. Valorant, Mobile Legends, PUBG Mobile, EA FC, League of Legends). | MVP |
| GAM-02 | For each game, admins define: name, icon, platform(s), team/lobby size, rank tiers, player roles, and game modes. | MVP |
| GAM-03 | Lobby filters, profile ranks and roles use the per-game values from GAM-02. | MVP |

### 3.4 Lobby recruitment

| ID | Requirement | Priority |
|---|---|---|
| LOB-01 | A player can create a lobby with: game, mode, **in-game lobby code (required)**, number of open slots, rank range, needed roles, voice chat yes/no, start time ("now" or a scheduled time), and an optional note. | MVP |
| LOB-02 | A lobby cannot be published without a lobby code. | MVP |
| LOB-03 | When creating a lobby, the host chooses **Public** (code visible to all approved users) or **Private** (code visible only to accepted members). | MVP |
| LOB-04 | **Public lobby:** any approved player can take an open slot right away and sees the code. | MVP |
| LOB-05 | **Private lobby:** players send a join request. The host accepts or declines. On acceptance, the player sees the code and joins the lobby chat. | MVP |
| LOB-06 | Players can browse lobbies and filter by game, mode, rank, needed role, voice/no-voice and start time. | MVP |
| LOB-07 | The host can edit the lobby (including the code), remove members, and close the lobby. Changing the code notifies all current members. | MVP |
| LOB-08 | A lobby automatically becomes **Full** when all slots are taken and is hidden from browse results. It becomes visible again if a slot opens. | MVP |
| LOB-09 | A lobby automatically **expires** 2 hours after its start time (configurable by admins). Expired lobbies are archived and their code is no longer shown. | MVP |
| LOB-10 | A member can leave a lobby at any time. The host is notified. | MVP |
| LOB-11 | Each lobby has a temporary **group chat** for its members (text only). The chat is read-only after the lobby closes and deleted after 7 days. | MVP |
| LOB-12 | Members get a reminder notification 10 minutes before a scheduled lobby starts. | MVP |
| LOB-13 | A player can be in at most 3 active lobbies at once (configurable) to prevent slot hoarding. | MVP |
| LOB-14 | Players can save filter presets and get notified when a matching lobby is posted. | P3 |

**Lobby states:** `Open → Full → In progress → Closed/Expired`

### 3.5 Knowledge sharing

| ID | Requirement | Priority |
|---|---|---|
| KNO-01 | Players can write **guides/articles** tagged by game (and optionally by role/character/map), with a rich-text editor and images. | MVP |
| KNO-02 | Players can post **questions** in a Q&A forum, tagged by game. Others can answer and comment. | MVP |
| KNO-03 | Users can upvote guides, questions and answers. The question author can mark one answer as **Accepted**. | MVP |
| KNO-04 | Admins (and users they authorize) can publish **News / Patch notes** posts, which appear in a highlighted feed. | MVP |
| KNO-05 | Content is searchable by keyword and filterable by game and tag. Results can be sorted by newest or most upvoted. | MVP |
| KNO-06 | Authors can edit or delete their own posts. Moderators can hide or remove any post. | MVP |
| KNO-07 | Players can bookmark posts to read later. | P2 |

### 3.6 Reputation

| ID | Requirement | Priority |
|---|---|---|
| REP-01 | After a lobby closes, each member can rate each other member once: 👍 **Good teammate** or 🚫 **No-show**. | MVP |
| REP-02 | A profile shows the total of good-teammate ratings and the no-show rate. Individual raters are not shown. | MVP |
| REP-03 | Ratings can only be given by players who were in the same lobby. They can be changed for 24 hours, then lock. | MVP |
| REP-04 | Players with a high no-show rate (threshold set by admins) are flagged to moderators. | MVP |
| REP-05 | Additional rating tags (e.g. "Good comms", "Toxic") feed into the moderation queue. | P3 |

### 3.7 Reporting and moderation

| ID | Requirement | Priority |
|---|---|---|
| MOD-01 | Users can report a user, lobby (e.g. fake or wrong code), chat message, post, question or answer, choosing a reason and adding an optional note. | MVP |
| MOD-02 | Reports go to a moderation queue in the admin panel showing the reported item, its context and the reporter. | MVP |
| MOD-03 | Moderators can dismiss a report, hide/remove the content, warn the user, or suspend them for a fixed period of 1, 3, 7 or 30 days. Only admins can permanently ban. | MVP |
| MOD-04 | Every moderation action is recorded in an audit log (who, what, when, why). | MVP |
| MOD-05 | Reporters are told when their report has been handled, without details of the action. | MVP |
| MOD-06 | Suspended users can view content but cannot create lobbies, post, chat or rate during the suspension. | MVP |

### 3.8 Tournaments (Phase 2)

| ID | Requirement | Priority |
|---|---|---|
| TOU-01 | Only **Tournament Organizers** (authorized esports club moderators) and **Admins** can create and manage tournaments. | P2 |
| TOU-02 | A tournament has: game, format, team size, max teams/players, registration open/close dates, schedule, rules, and an optional prize description. | P2 |
| TOU-03 | Supported formats: single elimination, double elimination, round robin. | P2 |
| TOU-04 | **Team signup:** a captain creates a team and invites members. Invitations must be accepted. **Solo signup:** players register individually (organizer may form teams). | P2 |
| TOU-05 | Organizers can approve, reject or waitlist registrations. Registered players get email and push confirmations. | P2 |
| TOU-06 | When registration closes, the organizer generates the bracket automatically (random or manual seeding) and can adjust it before publishing. | P2 |
| TOU-07 | Brackets and schedules are visible to all approved users and update live. | P2 |
| TOU-08 | After a match, team captains report the score and upload screenshot proof. If both captains agree, the result is accepted. If they disagree, the organizer decides. | P2 |
| TOU-09 | Organizers can override any result, record forfeits/no-shows and disqualify teams, with a reason logged. | P2 |
| TOU-10 | **Leaderboards:** season rankings per game, based on tournament placements (points table set by admins). | P2 |
| TOU-11 | **Badges:** winners and top placings get badges shown on their profiles. | P2 |
| TOU-12 | Players get notifications for registration, bracket publish, upcoming matches (1 hour and 10 minutes before) and results. | P2 |

### 3.9 Notifications

| ID | Requirement | Priority |
|---|---|---|
| NOT-01 | The system sends notifications through three channels: **push** (mobile), **email** and an **in-app inbox** (notification bell on web and mobile). | MVP |
| NOT-02 | Events that trigger notifications include: account approved/rejected; lobby join request; request accepted/declined; lobby code changed; lobby starting soon; new lobby chat message; answer to your question; report resolved; tournament events (P2). | MVP |
| NOT-03 | Users can turn each notification type on or off per channel. Account and security emails cannot be turned off. | MVP |
| NOT-04 | The in-app inbox shows unread count and lets users mark all as read. | MVP |

### 3.10 Admin panel

| ID | Requirement | Priority |
|---|---|---|
| ADM-01 | A separate web dashboard, accessible only to Moderators, Organizers and Admins (each sees only what their role allows). | MVP |
| ADM-02 | **Approval queue:** list of pending sign-ups with ID photo viewer, approve/reject actions and reasons. | MVP |
| ADM-03 | **User management:** search users, view profile and history, change roles, suspend/ban/unban. | MVP |
| ADM-04 | **Moderation queue** and **audit log** (see 3.7). | MVP |
| ADM-05 | **Games catalogue** management (see 3.3). | MVP |
| ADM-06 | **Settings:** allowed email domains, lobby expiry time, max active lobbies, no-show threshold, leaderboard points. | MVP |
| ADM-07 | **Dashboard stats:** registered users, pending approvals, active lobbies, posts, open reports. | MVP |
| ADM-08 | **Tournament management** screens for organizers (see 3.8). | P2 |

---

## 4. Non-functional requirements

### 4.1 Performance
- NFR-01: Pages and app screens load in under 2 seconds on a typical 4G connection.
- NFR-02: Lobby list and lobby chat updates appear for other users within 2 seconds (real-time).
- NFR-03: The system supports at least 500 concurrent users without slowdown.

### 4.2 Security and privacy
- NFR-04: All traffic uses HTTPS. Passwords are hashed (never stored in plain text).
- NFR-05: Role-based access control is enforced on the server, not only in the UI.
- NFR-06: Private lobby codes are only sent from the server to accepted members and the host.
- NFR-07: Student ID photos are stored in a private bucket, accessed only through short-lived signed URLs by admins, and deleted per ACC-08.
- NFR-08: The app follows applicable data-protection law and college policy. A privacy policy and terms of use must be shown and accepted at sign-up.
- NFR-09: Login is rate-limited to slow down password-guessing attacks.
- NFR-10: Uploaded images are limited in size (e.g. 5 MB) and type (JPG/PNG/WebP).

### 4.3 Usability and accessibility
- NFR-11: Creating a lobby takes no more than 3 screens/steps.
- NFR-12: The UI supports dark mode (default) and light mode.
- NFR-13: Web pages meet WCAG 2.1 AA for contrast, keyboard navigation and screen-reader labels.
- NFR-14: Interface language: English. The design should allow adding more languages later.

### 4.4 Reliability and maintainability
- NFR-15: Target uptime of 99% outside planned maintenance.
- NFR-16: The database is backed up daily, with backups kept for 14 days.
- NFR-17: The code lives in a shared Git repository with a README, setup guide and contribution guide so new club members can take over.
- NFR-18: Errors and crashes are logged to a monitoring tool.

---

## 5. Technical architecture (recommended)

**Constraints behind these choices:** 1–2 developers with TypeScript (and some .NET) experience, no Mac, Supabase blocked in our region, and the AWS/Google Cloud/Azure consoles not used. Render, Cloudflare, Neon, Vercel and VPS providers are available; Railway is not available in our region. Hosting budget: under US$3 per month, with no free plan that puts the real-time server to sleep. The app starts with shared code and may become native later.

| Layer | Choice | Notes |
|---|---|---|
| Android, iOS & player website | **React Native with Expo** (TypeScript), using Expo Router for Android, iOS **and web** | One codebase for all three. EAS Build compiles the iOS app in the cloud, so no Mac is needed. Expo handles push notifications and over-the-air updates. |
| Admin panel | **Protected `/admin` routes in the same Expo web app** | Desktop layouts shown only to Moderators, Organizers and Admins; access is still checked by the API on every request (NFR-05) |
| Shared code | Monorepo (npm workspaces) | `apps/app` (Expo), `apps/api` (NestJS), `packages/shared` (types, validation schemas, API client). See [ADR 0001](docs/decisions/0001-tech-stack.md). |
| API server | **NestJS** (Node.js, TypeScript) | The only thing the apps talk to. It holds every business rule: approvals, lobby code visibility (NFR-06), limits, moderation, bracket generation. Documented with OpenAPI. |
| Database | **PostgreSQL**: either on the same VPS (**Option 1**) or on **Neon Free** (**Option 2**); see 5.1 | Standard PostgreSQL either way, so moving between the two options is a dump/restore with no code changes |
| ORM / migrations | **Prisma 7** with the `pg` driver adapter | Type-safe queries; schema changes are version-controlled migrations. The same code works with Neon and with Postgres on the VPS. See [docs/database](docs/database/README.md) and [ADR 0002](docs/decisions/0002-database-conventions.md). |
| Authentication | **Better Auth** inside the NestJS API | Email + password, college-domain email verification, password reset, sessions. Users, roles and Pending/Approved/Rejected status stored in Postgres. |
| Real-time | **Socket.IO** (NestJS WebSocket gateway) | Lobby chat, live lobby list and slots, code-change alerts, live brackets. Runs on the always-on VPS, so connections never sleep. A Redis adapter is added once more than one API instance runs. |
| File storage | **Cloudflare R2** (S3-compatible) | Private bucket for student ID photos with short-lived signed URLs (NFR-07); public bucket for avatars and guide images |
| Scheduled jobs | **BullMQ** with Redis on the VPS | Lobby expiry, start reminders, chat clean-up after 7 days, ID photo deletion after 30 days |
| Push | Expo Push Notifications (FCM/APNs) | |
| Email | Transactional email service (e.g. Resend) | |
| Hosting | **Low-cost VPS** (about US$2/month, at least 1 GB RAM, e.g. IONOS VPS XS) running Docker Compose: NestJS API, Redis, Caddy (automatic HTTPS) and, in Option 1, PostgreSQL. Expo web build on **Cloudflare Pages** (free). App Store / Google Play via EAS Submit. | Always on, so WebSockets and scheduled jobs never sleep. Fixed monthly price. The team is responsible for OS security updates and backups (see 5.1). Renewal prices can be higher than the first term, so check before buying. |

**Note:** check that each of these services is available in our region before building. If one is not, it can be swapped for a similar service without changing any of the requirements.

### 5.1 Hosting options

Both options use the same VPS for the NestJS API, Socket.IO, Redis and Caddy. They differ only in where PostgreSQL runs. The team picks one when deploying; the code is the same for both.

| | Option 1: everything on the VPS | Option 2: API on the VPS, database on Neon Free |
|---|---|---|
| PostgreSQL | Docker container on the VPS | Neon Free plan, Singapore region (or the region closest to the VPS) |
| Monthly cost | About US$2 (VPS only) | About US$2 (VPS only); Neon Free is US$0 |
| Backups | Nightly `pg_dump` to Cloudflare R2, kept 14 days (NFR-16), run by a cron job on the VPS | Handled by Neon (point-in-time restore), plus the same nightly `pg_dump` to R2 as a second copy |
| Upkeep | Team updates PostgreSQL and watches disk space | Neon manages the database; less upkeep |
| Limits | Shares the VPS's 1 GB RAM with the API and Redis; tune Postgres memory settings | Free plan: 0.5 GB storage and 100 compute-hours per month; the database sleeps after 5 minutes idle and takes a few seconds to wake. Student ID photos live in R2, not the database, so 0.5 GB lasts a long time. |
| Watch out for | A single machine: if the VPS fails, restore from backup to a new VPS | The API needs connection retries for the wake-up delay. If the free compute-hours run out, move to Neon's paid plan or to Option 1. |

**Not used for now:** Neon Realtime and Neon Functions (both in beta). Neon Realtime's live queries are a good fit for the lobby list and chat, but they don't yet support row-level security, so private lobby codes (NFR-06) would rely entirely on query design. Re-evaluate once they leave beta.

### 5.2 Reliability and scaling

- **Starting point:** one VPS with 1 GB RAM handles NFR-03 (500 concurrent users) for typical college use. Watch memory use; a 2 GB VPS is the first upgrade.
- **Stateless API:** no sessions or files are kept on the server's disk, so a second API server can be added behind a load balancer. Socket.IO then uses the Redis adapter so events reach users on every server.
- **Database:** add indexes for the lobby browse filters and notification inbox from the start. In Option 1, move Postgres to its own server or to Neon if it becomes the bottleneck. In Option 2, upgrade the Neon plan.
- **Recovery:** nightly backups to R2; a restore onto a fresh VPS is tested once per semester. Error tracking and uptime monitoring (e.g. a free uptime checker) are covered in NFR-18.
- **Security on the VPS:** SSH keys only (no password login), a firewall allowing only ports 22, 80 and 443, automatic security updates, and Postgres/Redis never exposed to the internet.
- **Moving to a managed host later:** the API runs in Docker and the database is standard PostgreSQL, so both can move to a managed platform (e.g. Render) without code changes if the budget grows.

### 5.3 Path to native apps later

The React Native app is a UI layer only; every rule lives in the API. Native apps can therefore be added later without changing the backend:

1. **Native modules first:** if one feature needs native performance or a platform API, write it as an Expo module in Kotlin (Android) or Swift (iOS) inside the existing app.
2. **Full native app:** build a Kotlin (Jetpack Compose) Android app or a Swift (SwiftUI) iOS app that calls the same OpenAPI-documented API. Generate its API client from the OpenAPI file. Swift/iOS work requires a Mac at that point.
3. **Website:** the Expo web build can stay, or the player website can be replaced with Next.js reusing `packages/shared`.

### 5.4 Core data entities
`User`, `Profile`, `InGameAccount`, `ApprovalRequest`, `Role`, `Game`, `GameRank`, `GameRole`, `Lobby`, `LobbyMember`, `LobbyJoinRequest`, `ChatMessage`, `Rating`, `Post` (guide/question/news), `Answer`, `Comment`, `Vote`, `Report`, `ModerationAction`, `Notification`, `NotificationPreference`, `Tournament`, `Team`, `TeamMember`, `Registration`, `Match`, `MatchResult`, `Badge`, `LeaderboardEntry`.

---

## 6. Release plan

Development is ongoing with no fixed deadline, so the work is split into phases.

| Phase | Contents |
|---|---|
| **MVP** | Accounts + admin approval, profiles, games catalogue, lobby recruitment with codes and chat, knowledge sharing (guides, Q&A, news), reputation, reporting/moderation, notifications, admin panel. Website + Android + iOS. |
| **Phase 2** | Tournaments (signup, brackets, result reporting), leaderboards, badges, bookmarks. |
| **Phase 3 (ideas)** | Lobby alerts for saved filters, graduate deactivation, extra rating tags, profanity filter, blocking users, clip/video sharing, events calendar, multi-language support. |

---

## 7. Acceptance criteria (MVP highlights)

1. A new student can sign up, verify their email, and be approved by an admin. They cannot use the app before approval.
2. A non-college email is rejected at sign-up.
3. A lobby cannot be created without an in-game lobby code.
4. In a private lobby, the code is hidden from a non-member (including in API responses) and becomes visible right after the host accepts them.
5. In a public lobby, any approved player sees the code and can take a slot until the lobby is full.
6. A lobby disappears from browse results when full or expired.
7. Lobby members can chat in real time, and a code change notifies all members.
8. After a lobby closes, members can rate each other once, and the profile shows the updated reputation.
9. A reported post appears in the moderation queue, and hiding it removes it for all users.
10. A student ID photo can no longer be retrieved 30 days after the approval decision.
11. Users receive push, email and in-app notifications for approval and lobby join requests, and can turn off the optional ones.

---

## 8. Open questions

1. What is the college's email domain(s)? Are staff/alumni allowed?
2. Who are the first admins, and who approves new moderators/organizers?
3. Which games should launch in the catalogue on day one?
4. Does the college have rules about storing student ID numbers and photos that need sign-off (e.g. from the IT or data-protection office)?
5. Should the app use the college's name or logo? This may need permission.
6. Should tournament prizes be listed in the app, and are there rules about prizes?
7. Who pays for the Apple Developer account and any hosting costs beyond the free tiers?

---

## 9. Design artefacts

| Artefact | File | Contents |
|---|---|---|
| Use case diagram | `diagrams/1-use-case-diagram.drawio` (PNGs in `diagrams/png/`) | Actors and roles; accounts; lobbies; knowledge; moderation; administration; tournaments |
| Process diagrams | `diagrams/2-process-diagrams.drawio` | Swimlane flows: sign-up & admin approval; create & join lobby; play, close & rate |
| ERD | `diagrams/3-erd.drawio` | PostgreSQL tables in four domains: users & accounts; games & lobbies; knowledge & moderation; tournaments |
| Wireframes | `wireframes/index.html` | Clickable mid-fidelity prototype: sign-up & login, home, lobbies, knowledge, profile & notifications (mobile), admin panel (desktop) |

UI decisions made while wireframing:

- Sign-up has 3 steps (account → student ID → games), followed by the email code.
- Mobile navigation is a bottom tab bar: Home · Lobbies · Create · Knowledge · Profile.
- Home is a dashboard: my upcoming lobbies (code with a copy button), play-now lobbies, news, trending guides.
- Lobby cards show game, mode, start time and slots; rank and roles needed; host and reputation.
- Create lobby is a 3-step wizard: game & mode → lobby code & public/private → details.
- Lobby chat is a tab inside the lobby, with the code pinned at the top for members.
- The rating screen pops up when a lobby ends, with a notification for players not in the app.
- Knowledge has 3 sub-tabs (Guides · Q&A · News). Guides use a simple rich-text editor. Answers are sorted with the accepted answer first, then by votes.
- Notification settings are grouped toggles (Push / Email / In-app per group).
- Profiles show games and ranks first, then reputation.
- The admin panel opens on a dashboard of to-do cards.
