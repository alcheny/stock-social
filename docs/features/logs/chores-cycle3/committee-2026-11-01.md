# Chores from approval council cycle 3: committee log (2026-11-01)

Branch `claude/chores-cycle3`. Source: `docs/ideas/approval-2026-11-01-cycle3.md` ("Not approved" C3-34 and C3-39/40;
"Routed in round 0" C3-44, K20, K22). Plan: `plan.md` in this folder (its Round 2 section overrides §1-§5).
Roles were separate subagents with fresh context: UX lead (plan), business lead and engineer (review), tester (QA),
business lead and UX lead (user tests), an independent code reviewer. The orchestrating session built the code.

## Step 1: plan and review

- Round 1. The UX lead drafted the plan with nine open questions, each with a recommended option. Business lead:
  CHANGES (7 demands). Engineer: CHANGES (15 points; 1-5, 7, 11, 13 blocking).
- Round 2. All demands were folded into the plan's Round 2 section. Business lead: **SIGN**. Engineer: **SIGN**, with
  three build notes (health e2e accepts 200/ok or 503/degraded; the demo check fails safe; `checkoutFor` stays a plain
  server function), all applied.

## Decisions (each by the committee's recommended option after debate)

| # | Question | Decision | Why |
|---|---|---|---|
| D1 | Does the stalest trader sync affect health status? | No, details only | Backoff and quarantine legitimately hold a trader up to 24 h (UX lead, BL, engineer). |
| D2 | Log a wrong bearer on /api/health? | No | Public endpoint; logging it would let anyone fill the log. |
| D3 | 401 log window | 60 s per route per warm instance, `suppressed` count on the next line | Bounded map; documented as a per-instance limit (ponytail note in `lib/cron-auth.ts`). |
| D4 | "Through logSafe" | `console.warn('cron unauthorized', logSafe(denied), JSON.stringify({ route, suppressed }))`, `denied` a fixed `CronUnauthorized` (status 401) built from nothing in the request | Meets the council's wording literally; passes the log scanner (engineer ran it). |
| D5 | Health status code when degraded | 503 (ok 200) | Status-code-only monitors catch it (BL); body and `no-store` unchanged. |
| D6 | og:title | First sentence of the positioning line; og/twitter description "Losses included." (+ Demo sentence); meta description the whole line (+ Demo sentence) | No repeat in an unfurl (BL 2); `<title>` stays "Stock Social" (plain text, unchanged). |
| D7 | Where the image lives | `app/home-card/route.tsx`, referenced only from `app/page.tsx` | A root `opengraph-image` would be inherited by every child route. |
| D8 | Demo sentence in the preview | "Demo records are marked Demo." appended while any non-deleted user has a demo activity; fails safe to shown | The seed is all demo; the design system council's rule (`design-system-2026-11-01.md:441`) (BL 1). |
| D9 | C3-44 gate | closed trades or open positions (the public record) or another user's note or saved view naming the user; a connection alone does not count; fails open | Legal veto "the real data condition, not a proxy" (BL 3; open positions are public, TR-3). In `lib/delete.ts` (note-readers pin). |
| D10 | One "checkout open?" rule | `app/tools/parts.tsx#checkoutFor`, used by /tools and /account | Pages can never disagree (BL 4); parts.tsx is already a pinned billing importer. |
| D11 | /account link while checkout is not open | Secondary button; "See Record tools (not open yet)" when the launch gate keeps the viewer out, "See Record tools (not available right now)" when billing is not configured | Matches /tools' own line in each state; no price, date, promise or waitlist (legal C3-39). |
| D12 | Locked /tools way back | "Back to the feed" → `/`, in `.rt-links` (44 px), only where the Subscribe screen is not shown | Council "a way back"; billing-open screens unchanged. |
| D13 | Shared constant-time check in the cron routes | The routes keep their inline check and only gain the log call; `cronAuthorized` serves health | `lib/sync-route.test.ts:23` pins the inline check in the sync route's source; tests are never weakened. |
| D14 | `siteOrigin` for the feed | Moved verbatim to `lib/site-origin.ts`, re-exported by `lib/billing.ts` | `app/page.tsx` must not import billing (`lib/record-tools.test.ts:253` pin). |
| D15 | Axe check (plan §5 AC5) | Manual a11y checks in the user tests | Axe is not a repo dependency; no new dependencies. |

## Business lead sign-off: F-3 entry points in the billing-closed states (council condition for C3-39)

**SIGNED** (round 1, confirmed in round 2 for both closed states). Scope: amends `docs/features/logs/F-3/plan.md:142`
and §1, closed states only (gate closed for the viewer, or billing not configured). Billing-open state unchanged; the
lapsed, confirming, subscriber and trader branches unchanged; no other F-3 entry point (`/settings`, `/me/following`,
nav) changes. Reason (business lead): "while billing is closed, a primary button leads to a page with nothing to buy.
That breaks the user's trust in the button for nothing. The secondary link keeps the way to read what the tools are
without promising a purchase." Conditions: (a) one helper for both pages (D10); (b) a dated decision line in the F-3
plan citing this record (added at §1 and §8); (c) the open state with the billing vendor's fake passes in QA;
(d) no other entry point changes. C3-40 is not built: "Delete my profile" is unchanged.

## Step 3: tests first

`lib/chores-cycle3.test.ts` (unit and database cases for every criterion) and `e2e/chores-cycle3.spec.ts` (360 px)
were written against the plan, then the code. No existing test was changed.

## Step 4: QA loop (tester, `qa.md`)

Round 1: one defect. **D1 (low):** in the production build the 401 line read `cron unauthorized s status 401 …`:
the minifier renames the `CronUnauthorized` class and `logSafe` prints the constructor's name. Fixed (the class name is
fixed with `Object.defineProperty`; a source test pins it) and re-checked against a fresh production build: the line
reads `cron unauthorized CronUnauthorized status 401 {"route":"sync","suppressed":0}`, one per route per minute.
Round 2: clean.

## Step 5: user tests at 360 px

- Business lead (`user-test-business.md`): **PASS**, compliance pass on all six checks. Non-blocking: (1) the /account
  link wraps to two lines at 360 px; (2) the preview's wording differs from D27's first-visit line. Decisions: (1) kept —
  the UX lead found the wrap legible, no overflow, 44 px+ target, and the state must stay in the visible link text
  (a11y condition); (2) out of scope — D27 changes only through the idea board (F-18), left to the next design session.
- UX lead (`user-test-ux.md`): **PASS** (keyboard only, light and dark; contrast 18.8:1 text, 3.75:1 boundary).
  Non-blocking: the card repeats the title sentence (as planned: the image must stand alone when a platform shows no
  text); a square crop would cut the card's text. Follow-ups outside this diff (the /settings text links' height, the
  repeated "Record tools" name, feed range buttons) are for the settings-lane and feed owners.

## Step 6: independent code review

No blocking findings. Applied: (1) the public health path reads the newest heartbeat only; the stalest-trader scan
runs only behind the bearer; (2) `/home-card` adds `s-maxage=3600` for the CDN; (3) the demo check is remembered per
instance for 5 minutes (a failure is not remembered); (4) `/account` reads the checkout state only where its link
shows; (5) `cronAuthorized` compares SHA-256 digests (constant time, equal length, no length leak); (7) the fragile
word regex in a test now uses word boundaries and an unused timer mock is gone. Not applied: (6) one bearer rule in
the cron routes (D13: `lib/sync-route.test.ts:23` pins the inline check; tests are never weakened).
