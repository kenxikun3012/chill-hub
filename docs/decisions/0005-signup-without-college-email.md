# ADR 0005: Sign-up without a college email

**Status:** Accepted · **Date:** 2026-11-06 · **Replaces parts of:** [ADR 0004](0004-authentication.md)

## Context

ADR 0004 assumed students have a college email, so sign-up refused any address outside a list of college domains. The college has no email domain, so that rule would have blocked every student. With it gone, the only automatic check of who someone is disappears, and the student ID number checked by an admin becomes the main proof.

## Decisions

1. **Any email works.** The 6-digit code still proves the address belongs to the student. `allowed_email_domains` stays as an optional setting (empty by default) in case the college ever has a domain.
2. **Student ID number first.** It goes at the top of the first sign-up screen, written like `22/29484` (two-digit batch year, slash, code). The server only accepts that exact form; the app turns `22-29484` into it before sending.
3. **Club join code.** One shared code, stored as the setting `signup_join_code`, keeps strangers out of the approval queue. It is compared in constant time, ignoring case, and is never returned by the public settings. Empty means no code is needed, so development stays easy; setting it is on the pre-launch checklist.
4. **Admins still approve by hand.** Checking the ID against the club's list of IDs and names is wanted (ACC-14) but the list doesn't exist yet, so it waits.
5. **Waiting students can look around.** Once their details are in, a pending student can read lobbies, games and profiles but not create, join or change anything. The server enforces it in the auth guard (GET only). Lobby codes are hidden from them in `canSeeCode()`, because a visible public code would let them join a game without being approved. Students who haven't sent their details, and rejected students, still see only their own screens.
6. **The ID is claimed early.** Because the ID is saved at step 1, a mistyped email would otherwise lock the real student out of their own ID. An unverified sign-up releases its ID once its code has expired (10 minutes). During that window a second sign-up is refused with a message saying so.

## Consequences

- Anyone who knows a classmate's ID number and the join code can sign up with it first. The admin sees it as a duplicate or a mismatch when the real student tries, and can remove the other account. The ID list and ID photo (ACC-08) are what close this gap.
- A taken ID is reported at sign-up, which shows that the ID is registered. Sign-up is rate limited, and the join code has to be right first.
- The wireframes and the Word spec's sign-up screens show the earlier order. The app is the reference until a design pass.
