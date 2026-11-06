# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

Android and the website only; there is no iOS app (iPhone users use the website). One Expo codebase serves both. The Android build should feel smooth and native in behavior (navigation, gestures, performance) even though the design language is shared with the web.

## Users

Primary: students at a single college who play popular esports titles (for example Valorant, MLBB) and want teammates quickly, by posting or joining game lobbies.

Also: esports-club admins, moderators and tournament organizers, who approve sign-ups, moderate content and run tournaments, mostly from the desktop admin web panel. Admins and moderators cannot use lobbies.

## Product Purpose

Chill Hub is a gaming hub for one college. It helps students find teammates through lobbies that carry the real in-game lobby code, share game knowledge (guides, Q&A, news), and later compete in club-run tournaments. Accounts are limited to real students: every sign-up is approved by an admin. Success is a student finding a team in a minute and a club that can run the community with little effort and cost.

## Positioning

A closed, college-only hub: membership is checked (student ID number, club join code, admin approval), so lobbies and codes stay among classmates rather than strangers. Working name: "Chill Hub".

## Operating Context

Students use it on phones (Android) and in the browser; admins mostly at a desktop. Built and run by the esports club with no deadline, favoring low running cost and code new club members can pick up. Scale target: about 5,000 registered users, about 500 concurrent. Stack: Expo (app, web, admin), NestJS API, PostgreSQL.

## Capabilities and Constraints

- Sign-up: student ID number (like `22/29484`), club join code, full name, any email (no college email domain exists; verified by a 6-digit code), in-game ID. Admin approval follows; student ID photo comes later and is deleted within 30 days of the decision.
- Waiting (pending) students can browse lobbies, games and profiles but cannot create, join or change anything, and never see lobby codes.
- Lobbies, lobby chat, profiles with reputation, real-time notifications, reports, admin approval queue. Guides, Q&A, news and tournaments are later phases.
- Theme follows the phone's light/dark setting.
- Out of scope: playing games in-app, payments, video hosting, publisher API integration.
- Requirements spec: SPEC.md; decisions: docs/decisions/.

## Brand Commitments

Direction chosen earlier: "Arena" (esports, competitive). Tokens and mockups are recorded in the project notes. The user asked that visuals be left open for the later restyle, so this is a prior direction to start from, not a binding spec. "Chill Hub" is a working name.

## Evidence on Hand

Wireframes in `wireframes/`, diagrams in `diagrams/`, and the working Expo app in `apps/mobile`. No real users, testimonials, metrics or branding assets exist yet; do not invent them.

## Product Principles

1. Trust first: only real classmates get in, so show membership and approval state clearly and never leak lobby codes.
2. Speed to a team: finding or posting a lobby takes as few taps as possible.
3. Waiting is not a dead end: pending students can look around.
4. Cheap and simple to run: favor choices a small student club can maintain.
5. Same product on phone and web, native-feeling on Android.

## Accessibility & Inclusion

No product-specific standard established. Accessibility checks are planned during the restyle; target WCAG AA contrast in both light and dark themes.
