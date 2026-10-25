# F-2 · Guardrails G1 to G6 · Implementation plan (engineer)

Date: 2026-10-25. Role: engineer. Process: `docs/IMPLEMENTATION.md` step 1 (plan), "Parallel development" (file sets
per PR, independence test) and "Resolving hard stops with the team" step 6 (each adopted guardrail is planned and
built through the normal cycle). Inputs: `docs/features/F-2-personal-discovery.md` (Decisions 2026-10-25 "guardrails",
H1, H2, H4; acceptance criteria G1 to G6), `hardstops-resolution-business-lead.md` §2 "Extra guardrails" and §3 (the
Privacy text), `hardstops-resolution-engineer.md` (D1 to D14, §3.3), `plan.md` (PR-5a/5b, §4 budgets, §8 policy
checks), POLICY as amended in `bcaac14` (F1 now ends "A viewer can turn personal ordering off in Settings."). Tree read:
`claude/peaceful-dirac-33bucv` at `bcaac14` plus PR-4's uncommitted fix round 2.

This plan decides how, not what. It changes no decision in the feature file. Nothing here is legal advice.

## 0. Summary

| # | PR | Guardrails | Product lines | Test lines | Waits on |
|---|---|---|---|---|---|
| 7 | Feed controls · `autopilot/feature-2-feed-controls` | G1, G3, G4 | ~170 | ~380 | PR-4 landed on the branch |
| 8 | Reachable and unlogged · `autopilot/feature-2-reach` | G2, G5, G6 | ~320 | ~600 | PR-4 landed on the branch |

- **PR-7 and PR-8 pass the independence test against each other (§3), so they build in parallel**, each in its own
  worktree, database and ports. If a build finds it needs a file the other owns, PR-7 goes first (lower number).
- **Both wait on PR-4.** PR-4's last fix round is in this working tree and it owns files both PRs change: `lib/feed.ts`,
  `app/me/following/*`, `app/me/liked/route.ts`, `app/card-gestures.tsx`, `lib/delete.ts`, `e2e/likes.spec.ts`. The
  builds start from the branch after PR-4's merge commit, not from the working tree.
- **PR-5a and PR-5b now wait on PR-7 and PR-8.** PR-7 holds the gate PR-5 must call (G1, G3), and PR-8 holds the
  reset registry PR-5a must extend (G2). That is in addition to `plan.md`'s H1, H2 and H4, which are now cleared:
  H1 applied in `bcaac14`, H2 accepted by the owner with these guardrails as the mitigation, H4 approved with conditions.
- **The Privacy page PR** (another worktree) states the guardrails as shipped. It merges after PR-7 and PR-8, and its
  text has to match §7 below.
- **Why two PRs, not one.** About 490 product lines would fit under one 800-line cap. Splitting them keeps the
  one change to the ranking (G1, independence rule 4) away from five changes that don't touch it. Each committee review
  stays small, and the two build at the same time.
- **Urgency.** POLICY F1's last sentence, "A viewer can turn personal ordering off in Settings", is false on this branch
  until PR-7 merges: PR-4's unfollow and trade-reject demotions run with no switch. No real viewer is affected, since
  real viewers stay gated by H4's conditions. But a reviewer who reads F1 as written can fail PR-4 on it. PR-7 is the
  first item after PR-4, and PR-4's review should cite this plan.

Every PR follows these rules:
- ≤ 800 product lines.
- Tests are written first and fail before the code.
- Schema changes are additive and idempotent (`schema_add_column`, `schema_add_index`), with no `drop`, `truncate` or
  `delete from` in `db/schema.sql`.
- The engineer reads `node_modules/next/dist/docs/` before using an API (AGENTS.md). For these PRs that means
  `01-getting-started/07-mutating-data.md` and `02-guides/forms.md`: server actions, no-JS submission, `refresh()`,
  and route handlers.
- No protected path, no dependency, no vendor.
- No test is weakened or deleted. §5 lists every pinned assertion that the owner's G6 decision makes obsolete. Each one
  is rewritten to assert the new behavior, and the test count never drops.

## 1. PR-7 · Feed controls (G1, G3, G4) · ~170 product lines

Branch `autopilot/feature-2-feed-controls`, database `stock_social_f2_controls`, ports 3110 (`next start`) and 3111.

### 1.1 Scope

**G1: "Order my feed by my activity" on `/settings`, on by default.**
- **Stored state.** `users.personal_order_off boolean not null default false`. A boolean rather than a timestamp,
  because we store the minimum (POLICY P3): nothing records when the switch was changed. Existing and new accounts read
  `false`, which means on.
- **Server side.**
  - `lib/feed-settings.ts` (new, ~15 lines): `personalOrderOff(viewer)` and `setPersonalOrder(viewer, on)`, both keyed by
    the session's id.
  - `app/settings/actions.ts` (new, `'use server'`, ~20 lines): `setOrder(on)` for signed-in viewers only. It returns
    `{ ok, on }` for the optimistic switch. Without JavaScript the form posts to `/settings`, the action calls
    `refresh()` and the page renders again at the same URL, with no redirect and no query.
- **The switch.**
  - `app/settings/order-switch.tsx` (new, client, ~40 lines) renders `<button role="switch" aria-checked>` inside a
    `<form>`.
  - The visible label is the owner's text, "Order my feed by my activity". The state is shown as the text "On" or "Off",
    never by color alone.
  - The explanation line changes with the state (copy in §6). A `role="status"` line confirms each change.
  - Optimistic toggle with rollback: this is a display preference, neither money nor a record. If the save fails, the
    switch goes back to its old state and the line reads `FOLLOW.failed`.
  - `app/settings/page.tsx` (~20 lines) gets a "Your feed" heading holding the switch, placed above the existing
    "Following and hidden traders" link.
- **`lib/feed.ts#loadFeedPage` (~12 lines).** The flag is read inside the existing `Promise.all`, signed in only. When it
  is off:
  - **Preferences are empty.** `prefs = new Map()`, so the unfollow −1 and each trade reject's trader part −1 are not
    applied to the feed or to the section's `preferPool`.
  - **Hides still apply.** "Not interested" traders and rejected trades are removed by the existing shaping and
    display-filter paths.
  - **The section leaves out only hides and the viewer.** Its skips are the running `not_interested` rows already read
    in `mine`, plus the viewer themself. Followed traders are not left out, because the criterion reads "the signed-out
    order minus their own hides". No new query is needed.
  - **No preference, no hide: the shared list.** That viewer gets `kept.mixed`, the list signed-out viewers get, without
    a re-rank. The code already does this today.
- **Not changed:** Similar trades on profiles (`lib/similar.ts`) is already the impersonal pool minus hides, so it meets
  G1 whether the switch is on or off.
- **What "records nothing about their reading" means today, and from PR-5 on.**
  - **Today.** No event table exists, and reading writes nothing to any F-2 table. With the switch off, PR-7 asserts
    that by query log (§1.3, T1.3).
  - **Two existing writes happen while reading.** `sessions.last_seen_at` (hourly, needed for sign-in) and
    `ticker_watches.last_seen_at` (the watchlist's own "new since you last looked") both keep running with the switch
    off. That default needs the owner (§8 Q1).
  - **From PR-5.** The switch also turns off scoring, the logger and `/api/events`, through the gate in G3 below.

**G3: implicit reading signals off for real viewers, as a pinned constant with a test.**
- **`lib/discovery/signals.ts` (new, pure, ~30 lines):**
  - `IMPLICIT_SIGNALS = false`. Its comment cites the F-2 Decision of 2026-10-25 and counsel questions Q4 and Q5.
  - `IMPLICIT_TYPES = ['impression', 'dwell_short', 'dwell_long', 'skip', 'swipe_open', 'profile_open']`. These are
    `plan.md` PR-5a's implicit types.
  - `mayRecord({ demo, orderOff }, type)`:
    - false for every type when `orderOff` is set (G1);
    - false for an implicit type unless `IMPLICIT_SIGNALS || demo`;
    - true for the explicit types (follow, unfollow, not_interested and its undo, like, unlike, share, watch, unwatch,
      reject and its undo).
  - `usableTypes({ demo, orderOff })`: the same rule applied to reads. PR-5b's `viewerProfile` filters its events
    through it, so stored demo implicit events never shape a real viewer's order.
- **A constant, not an environment flag or a database setting.**
  - An environment variable can be flipped in the deploy settings with no PR, no review and no test.
  - Turning the constant on needs a PR that edits the pinned test, so the change shows in the diff. The reviewer fails
    that PR unless the F-2 file records the owner's decision.
- **Demo viewers are exempt** so that PR-5's logger can be built and measured on fictional accounts. Demo data always
  carries the Demo badge (P2).
- **What the owner's +2 opening-swipe weight means while G3 holds.** `WEIGHTS.swipeOpen` stays pinned in
  `lib/discovery/weights.ts`. But the opening swipe is an implicit "open" under the G3 decision, so it is stored and
  used only for demo viewers. A follow, a like or a hide counts for every viewer.
- **Why this holds PR-5 now.** The static guard in §1.3 (T3.3) fails any module that names `discovery_events` or
  `/api/events` without importing `mayRecord` or `usableTypes`. PR-5 cannot record or use an implicit signal for a
  real viewer without failing CI first.

**G4: what deletion names, and deletion's first step.**
- **Copy.** `SETTINGS.deleteExplain` names follows, likes, hidden traders and trades, unfollow notes, the watchlist and
  reading activity (§6). It is a copy-only change: the page markup stays the same.
- **Code.** `lib/delete.ts` first step gains
  `` tx`delete from ticker_watches where user_id = ${u.id}` ``, in the same transaction as the `deleted_at` mark and
  before the vendor call (D14). That is 2 lines.

**Test hardening (D13).**
- `lib/feed.signed-out.test.ts`: `VIEWER_TABLES` gains `trade_rejects`, `ticker_watches` and `personal_order_off`.
  This makes an existing guard stricter.
- `lib/discovery/imports.test.ts`: `ROOTS` gains `lib/discovery/signals.ts`, which must stay pure.

### 1.2 Files PR-7 expects to touch

Product:
- `db/schema.sql` (append: one `schema_add_column` on `users`)
- `lib/discovery/signals.ts` (new)
- `lib/feed-settings.ts` (new)
- `lib/feed.ts` (`loadFeedPage` only)
- `lib/delete.ts` (first step, one statement)
- `lib/copy.ts` (`SETTINGS` keys only)
- `app/settings/page.tsx`
- `app/settings/order-switch.tsx` (new)
- `app/settings/actions.ts` (new)
- `app/globals.css` (append: `.switch`)

Tests:
- `lib/discovery/signals.test.ts` (new)
- `lib/discovery/imports.test.ts` (add a root)
- `lib/feed.order-off.test.ts` (new)
- `lib/feed.signed-out.test.ts` (add cases)
- `lib/delete.test.ts` (add a case)
- `lib/copy.test.ts` (add a case)
- `e2e/settings.spec.ts` (new)

### 1.3 Tests first (one or more per acceptance criterion)

| Criterion | Test | Kind |
|---|---|---|
| **G1** · off → feed and section equal the signed-out order minus own hides | **T1.1**, two equivalences at a fixed `now`, 3 seeded days. (a) A switch-off viewer with no hides gets pages 1 to 3 and the section equal to signed-out pages 1 to 3 and section: card ids in order, section rows in order, with the viewer left out. (b) Viewer A is switched off and has 3 follows, 2 unfollows, 3 trade rejects and 1 "Not interested". Viewer B has only the same rejects and "Not interested", no follows and no unfollows, and has the switch off too. A's pages 1 to 3 and section equal B's. A followed trader of A's appears in A's section exactly where it appears in the signed-out section. | DB, `lib/feed.order-off.test.ts` |
| G1 · the switch matters | **T1.2.** The same viewer A with the switch on gets a different order, because the demotions apply. Switching off and on round-trips. | DB |
| G1 · nothing about reading stored | **T1.3.** A query-logging client (the existing `debug` hook) watches a switch-off viewer render feed pages 1 to 3, a profile, a pane and Similar trades. The only writes allowed are `update sessions set last_seen_at` and, under §8 Q1's default, `update ticker_watches set last_seen_at`. Every other `insert`, `update` or `delete` fails the test. | DB |
| G1 · on by default | **T1.4.** A new account reads `personal_order_off = false`. `/settings` shows "On" with `aria-checked="true"`. | DB + e2e |
| G1 · UI | **T1.5**, `e2e/settings.spec.ts`, at 375 and 320 px, light and dark. The switch toggles, the status line speaks, and the state persists after a reload. Keyboard (Tab, Space, Enter) works with focus visible. With JavaScript disabled the form posts and `/settings` renders again with the new state, and no request URL carries a query (G6's rule applied to this action). Touch target ≥ 44 px. axe finds no violation. | e2e |
| **G3** · no implicit signal stored or used for a non-demo viewer | **T3.1:** `IMPLICIT_SIGNALS === false`, pinned. **T3.2:** `mayRecord` and `usableTypes` over the whole matrix: demo or not × order on or off × every type. The implicit types are false for non-demo viewers, every type is false when the order is off, and the explicit types are true otherwise. **T3.3**, a static guard: every file under `app/` and `lib/` that names `discovery_events` or `/api/events` imports `mayRecord` or `usableTypes` from `lib/discovery/signals.ts`. Today it passes with no such file, and it is written to be extended by PR-5. | unit, `lib/discovery/signals.test.ts` |
| **G4** · the screen names everything it deletes | **T4.1.** `SETTINGS.deleteExplain` matches each of `/follows/`, `/likes/`, `/hidden traders/`, `/trades/`, `/unfollow notes/`, `/watchlist/` and `/reading activity/`. T1.5 asserts it on the rendered view 1. | unit + e2e |
| G4 · watchlist in the first step | **T4.2.** The vendor call is made to throw. The users row stays marked, and the viewer has zero `ticker_watches` rows, as for follows, likes, exclusions and rejects. Another account's watchlist is unchanged. | DB, `lib/delete.test.ts` |
| Heavy use | **T7.L** (`LOAD=1`): 500 traders, one opted-out viewer with no hides. Its signed-in p95 is no more than the signed-out p95 plus 20 ms over pages 1 to 3. | load |

## 2. PR-8 · Reachable and unlogged (G2, G5, G6) · ~320 product lines

Branch `autopilot/feature-2-reach`, database `stock_social_f2_reach`, ports 3120 and 3121.

### 2.1 Scope

**G2: "Reset my feed" on the Following page, with one confirmation.**
- **What it deletes.** `resetFeed(viewer)` in `lib/likes.ts` runs one transaction:
  - `delete from trade_rejects where viewer_id = ${viewer}`: every one, running, ended or permanent if O3 makes them
    permanent;
  - `clearUnfollowNotes(viewer, tx)` in `lib/follows.ts`: `delete from viewer_exclusions where viewer_id = ${viewer}
    and reason = 'unfollow'`.
- **What it keeps:** follows, likes, "Not interested" (which has its own Show again) and the watchlist, as the
  decision lists them.
- **Hard delete rather than ending the rows.** The criterion says "leaves zero", and that is the stronger privacy
  promise. The Privacy text's "Reset my feed also ends it" stays true.
- **Placement.** The function lives in `lib/likes.ts` and `lib/follows.ts` because the existing privacy scans
  (`lib/likes.test.ts:24`, `lib/follows.test.ts:22`) allow only those files, `lib/delete.ts` and the purge to name these
  tables. Nothing has to be added to an allow-list.
- **The reset registry.** In `lib/likes.ts`: `RESET_DELETES = { trade_rejects: 'all', viewer_exclusions: 'unfollow' }`
  and `RESET_KEEPS = { follows, viewer_exclusions: 'not_interested', trade_likes }`. A test (T2.4) forces every table
  with a `viewer_id` column into one of them, so PR-5a's `discovery_events` fails CI until it is added to the reset.
- **UI.**
  - At the bottom of `/me/following`, a "Reset my feed" heading, its explanation and a link button to
    `/me/following/reset`.
  - That page (new, `noindex`, signed in only) says what will be deleted and what stays, then "This cannot be undone."
    It shows the primary "Reset my feed" and a secondary "Keep them" that goes back to the list.
  - **No counts.** The scans in `lib/likes.test.ts` forbid `count(` on these tables. The page describes what is deleted
    instead of counting it.
  - After the reset, the viewer goes to `/me/following`, which has no query. With JavaScript, a `role="status"` line
    says "Your feed is reset.", and focus moves to it. Without JavaScript, the page renders after the POST. An open
    feed tab picks up the change at its next page 1 (bound in §4).

**G5: every like reachable from "Liked records".**
- **`ownLikes(viewer, page)`.**
  - Left join from `trade_likes` to `closed_trades`, ordered by `l.created_at desc, l.trade_key`, in pages of
    `LIKES_MAX` = 200. It reads one extra row to know whether an older page exists.
  - A like whose trade a rebuild removed comes back with `gone: true` and its trader's handle, from
    `trade_likes.trader_id`. A deleted trader's likes are already removed by cascade.
- **Paging.**
  - `/me/following?likes=<n>#liked` with an integer page number. It names no trade, so it meets G6.
  - Bad values (non-numeric, ≤ 0, above 10^6) read as page 1 and never return a 500.
  - The links are "Older likes" and "Newer likes", each ≥ 44 px.
- **A removed record.** Its row reads "Record no longer available · @handle" and keeps the Unlike button. The
  accessible name is "Unlike a record by @handle that is no longer available". PR-4's focus rule after Unlike stays.
- **Copy.** `LIKES.capped` is replaced by the paging links. The assertion that pins it is rewritten (§5).

**G6: no viewer action or handle in a URL; expired sessions purged.**
- **The rule the tests enforce.** Taking a viewer action never requests a URL other than one of these:
  - the page the action was taken on;
  - a fixed path with no query: `/`, `/me/following`, `/settings`;
  - a static asset.

  No URL carries `done`, `first`, `back`, `k`, `watch` or a trade key. Reading a public page by its own path is a page
  view and stays allowed: `/u/<h>`, `/u/<h>/pane`, `/u/<h>/trade/<id>`, `/t/<sym>`, and `/login?next=<the page already
  loaded>`.
- **`/me/liked` becomes a POST.**
  - `app/me/liked/route.ts` exports `POST` only, so a GET gets 405. The body is `{"k": [...]}`, with at most 60 keys,
    each checked against `KEY`.
  - Signed out it returns `{ liked: [] }` and runs no query, with `Cache-Control: private, no-store`.
  - `app/card-gestures.tsx` sends `fetch('/me/liked', { method: 'POST', body })`.
- **No-JS confirmations carry no handle.**
  - **Profile forms.** `followForm`, `unfollowForm` and `notInterestedForm` take a bound `from: 'profile' | 'list'`.
    From a profile the action calls `refresh()`: the POST goes to the profile's own URL, and the profile renders again
    with no redirect.
  - **Section rows and the pane** redirect to `/me/following`, which has no query. The lists there confirm the change,
    and Undo or "Show again" is there too.
  - **`showAgainForm`** redirects to `/me/following`.
  - **Where the confirmation line comes from: stored state only.** `recentAction(viewer, trader)` in `lib/follows.ts`
    reads this viewer's own rows from the last 60 seconds:
    - a follow's `created_at`, with "first" from `users.follow_notice_at`;
    - an unfollow note's `created_at` while not following;
    - a running "Not interested" row's `created_at`.

    `lastShownAgain(viewer)` replaces `?back=`. It names the trader whose "Not interested" this viewer ended in the last
    minute. A visit by anyone else claims nothing, because every read is keyed by the session's id.
- **Watch cap.** `toggleWatch` redirects to `/t/<sym>` without `?watch=cap`. `loadWatch` also reads the viewer's watch
  count, and `Watch` shows the cap line whenever the viewer is not watching that symbol and is at `WATCH_CAP`.
- **Expired sessions.**
  - `purgeExpiredSessions({ boxMs = 5_000, batch = 10_000 })` in `lib/auth/sessions.ts` runs
    `delete … where token_hash in (select token_hash from sessions where expires_at <= now() order by expires_at limit
    $batch)` until a batch comes back short or the time box ends.
  - It is called in `app/api/sync/route.ts` right after `purgeExpiredLinks`, in a `try`, and it never changes which
    branch the route takes, the same pattern as `purgeDiscovery`.
  - New index `sessions (expires_at)`.
  - It runs only once IMPLEMENTATION item #7 is scheduled, which is the owner's deploy setting (§8).

### 2.2 Files PR-8 expects to touch

Product:
- `db/schema.sql` (append: one `schema_add_index` on `sessions`)
- `lib/likes.ts`
- `lib/follows.ts`
- `lib/auth/sessions.ts`
- `lib/copy.ts` (`FOLLOW`, `LIKES`, new `RESET`, and the `allCopy` line)
- `app/discovery-actions.ts`
- `app/follow-button.tsx`
- `app/not-interested.tsx`
- `app/suggest-section.tsx`
- `app/u/[handle]/similar-section.tsx`
- `app/u/[handle]/page.tsx`
- `app/me/following/page.tsx`
- `app/me/following/liked-list.tsx`
- `app/me/following/reset/page.tsx` (new)
- `app/me/liked/route.ts`
- `app/card-gestures.tsx`
- `app/t/[symbol]/Watch.tsx`
- `app/t/[symbol]/page.tsx`
- `app/actions.ts` (`toggleWatch` only)
- `app/api/sync/route.ts`
- `app/globals.css` (append)

Tests:
- `lib/likes.test.ts`
- `lib/follows.test.ts`
- `lib/auth/sessions.test.ts`
- `lib/reset.test.ts` (new)
- `e2e/likes.spec.ts`
- `e2e/follow.spec.ts`
- `e2e/section.spec.ts`
- `e2e/reset.spec.ts` (new)
- `e2e/urls.spec.ts` (new)

### 2.3 Tests first

| Criterion | Test | Kind |
|---|---|---|
| **G2** · zero hides, notes and reading activity for that viewer | **T2.1.** Viewer A has rejects (running, ended, and one stored as `'infinity'`), unfollow notes (running and ended), one "Not interested", follows and likes. Viewer B has the same kinds, including rows that name A as the trader. After `resetFeed(A)`, A has zero `trade_rejects` and zero `viewer_exclusions` with reason `unfollow`. A's "Not interested", follows and likes are unchanged. B's rows are unchanged row for row (a snapshot comparison). | DB, `lib/reset.test.ts` |
| G2 · nothing for any other viewer | Covered by T2.1's snapshot of B, plus a third viewer with no rows: still none. | DB |
| G2 · confirmed, signed in | **T2.2.** Signed out, the action does nothing and redirects to `/login`. It takes no argument, so it can't name another viewer. The reset is reachable only through the confirmation page. | DB + e2e |
| G2 · UI | **T2.3**, `e2e/reset.spec.ts`, at 375 and 320 px, light and dark. Hide a trade, unfollow, then Reset → confirm. Back in the feed at page 1, the trade is shown again and the trader's demotion is gone. "Not interested" and likes stay. Keyboard only, focus on the status line, no-JS path, axe clean. | e2e |
| G2 · PR-5 can't skip it | **T2.4.** Every table in `db/schema.sql` with a `viewer_id` column is a key of `RESET_DELETES` or `RESET_KEEPS`. | unit |
| **G5** · paging past 200 | **T5.1.** A viewer has 450 likes, 3 of them on trades a rebuild removed. Pages 1 to 3 of `ownLikes` together list every like exactly once, newest first. The removed ones carry `gone: true` and their trader's handle. Unliking a removed one deletes its row. | DB, `lib/likes.test.ts` |
| G5 · UI | **T5.2**, `e2e/likes.spec.ts`. "Older likes" reaches page 2 and "Newer likes" returns. A removed record's row shows "Record no longer available" and its Unlike works with and without JavaScript. The focus rule holds. `?likes=abc`, `?likes=0` and `?likes=9999999` return 200 at page 1 or an empty page. | e2e |
| **G6** · no request URL carries an action target or handle | **T6.1**, `e2e/urls.spec.ts`. Every request URL is recorded (`page.on('request')`) during each viewer action, with JavaScript and without: follow, unfollow and "Not interested" from the profile, a section row and the pane; Show again; like and unlike; hide this trade and its Undo; Unlike on `/me/following`; watch, unwatch and watch at the cap; Reset. Each URL must be the page the action was taken on, `/`, `/me/following`, `/settings` or `/_next/…`. None contains `done=`, `first=`, `back=`, `k=`, `watch=` or a 64-hex trade key. | e2e |
| G6 · the liked lookup | **T6.2.** A GET to `/me/liked` returns 405. A POST validates keys, caps at 60, returns the session's own likes, and returns `[]` signed out with no query run (the behavioral guard). | e2e + DB |
| G6 · confirmations from state | **T6.3.** `recentAction` returns follow, first, unfollow or hidden only for this viewer's own row from the last 60 s (backdated rows: 59 s is shown, 61 s is not). Another viewer's action never shows. `lastShownAgain` behaves the same way. | DB, `lib/follows.test.ts` |
| G6 · expired sessions purged | **T6.4.** Expired rows are deleted and live rows kept. A row expiring exactly at `now` is deleted. The time box holds (a fake clock). A static check confirms the route calls it after `purgeExpiredLinks` inside a `try`. | DB, `lib/auth/sessions.test.ts` |
| Heavy use | **T8.L** (`LOAD=1`). A reset for a viewer with 10,000 rejects and 5,000 unfollow notes takes < 300 ms. `/me/following` with 5,000 likes, page 25: p95 < 300 ms. POST `/me/liked` with 60 keys: p95 < 50 ms. 1,000,000 expired sessions drain in ≤ 20 ticks at ≤ 5 s each, with zero live sessions deleted. | load |

## 3. Independence test (IMPLEMENTATION "Parallel development")

| Rule | PR-7 vs PR-8 | Either vs PR-4 | Either vs the Privacy PR |
|---|---|---|---|
| 1 Waits on / needs unmerged code | Neither waits on the other. Each one's tests run on its own code. | **Fail: both wait on PR-4.** | The Privacy PR waits on both (its text states them) |
| 2 File sets | Shared only in append-mostly files: `db/schema.sql` (different tables), `lib/copy.ts` (PR-7 `SETTINGS`; PR-8 `FOLLOW`, `LIKES`, `RESET`, `allCopy`), `app/globals.css` (own classes). Otherwise disjoint. | Overlap (see §0) | `lib/copy.ts` only (it adds `PRIVACY` and touches `allCopy`; whoever merges second resolves that line) |
| 3 Schema additive on different tables or columns | `users.personal_order_off` vs index `sessions_expires` | — | none |
| 4 Same pinned behavior | Only PR-7 moves the ranking (for switched-off viewers). PR-8 changes no ranking code. | — | — |
| 5 Protected path or the same owner stop | Neither touches a protected path. Neither waits on an owner stop to build. §8 Q1 has a default. | — | — |

Result: PR-7 and PR-8 start together once PR-4 has landed.

## 4. Schema (additive only)

```sql
-- PR-7 (G1): null-free boolean, false = "Order my feed by my activity" on (the default). No timestamp: nothing records
-- when the viewer changed it (POLICY P3). Deleted with the users row.
select schema_add_column('users', 'personal_order_off', 'boolean not null default false');
-- PR-8 (G6): the expired-session purge walks this index in batches.
select schema_add_index('sessions_expires', 'create index sessions_expires on sessions (expires_at)');
```

- **Optional third change, only if T8.L misses its budget:** `schema_add_index('trade_likes_viewer_created', 'create index
  trade_likes_viewer_created on trade_likes (viewer_id, created_at desc)')`.
- No new table and no dropped column. `lib/likes.test.ts`'s "no discovery event table" check still passes.
- **Known bound after a Reset or a switch change.** A feed tab that was already open may, on its next page, repeat cards
  or skip a few. The cursor stays pinned to the old `asOf`, but the rows that shaped the list have been deleted (Reset)
  or the preferences no longer apply (the switch).
  - Repeats are already dropped by the pager (`feed-pager.tsx`, `shown`).
  - The next page 1 is exact.
  - We store no extra column to detect this, since data minimization outweighs a one-time reorder. T2.3 asserts that no
    rendered card is duplicated.

## 5. Pinned assertions the G6 decision makes obsolete (rewritten, never deleted)

Each one keeps its test and asserts the owner's new behavior instead. The reviewer checks this list against the diff.

| Where | Today | Rewritten to |
|---|---|---|
| `e2e/follow.spec.ts:133` | no-JS follow lands on `/u/<h>?done=follow` | lands on `/u/<h>` with no query, and the line "Following @h." is visible |
| `e2e/follow.spec.ts:137` | a crafted `?done=unfollow` link claims nothing | another viewer opening the profile within 60 s sees no line |
| `e2e/section.spec.ts:424` | no-JS "Not interested" lands on `/u/<x>?done=hidden` | lands on `/me/following`, and the trader is listed under Not interested |
| `e2e/likes.spec.ts:143,154,349` | `GET /me/liked?k=` (the route intercept and the signed-out read) | `POST /me/liked` (intercept by method), signed out → `{ liked: [] }`, GET → 405 |
| `lib/follows.test.ts:238` | "@x is back" via `?back=x` | via `lastShownAgain(viewer)`, the same 60-second rule |
| Any assertion of `LIKES.capped` text | "Showing your 200 most recent likes." | the "Older likes" link on a viewer with 201 likes |

## 6. Copy (scanned)

All of it goes in `lib/copy.ts`, inside objects already listed in `allCopy()` (`RESET` is added to the list). That runs
it through `PROMO`, `BANNED` (endorse, recommend, guarantee, secure, safe, "audit of the record") and
`SUGGESTION_WORDS` (buy, sell, hold, pick, signal, advice, price target). I checked every string below against those
lists. None contains a word they ban, a completeness claim, a count of anyone's follows or likes, or a ticker slot.
"held" in the existing deletion copy doesn't match `\bholds?\b`.

**PR-7, `SETTINGS`:**
- `feedTitle`: "Your feed"
- `orderLabel`: "Order my feed by my activity" (the owner's text)
- `on`: "On"
- `off`: "Off"
- `orderOnExplain`: "On: traders you unfollowed, and traders whose trades you hid, appear a little lower in your feed
  and suggestions." This is true of the code today, where follows and likes order nothing. PR-5b rewrites it when they
  start to.
- `orderOffExplain`: "Off: your feed and suggestions use the order everyone sees signed out, minus the traders and
  trades you hid."
- `orderSavedOn`: "Your feed is ordered by your activity."
- `orderSavedOff`: "Your feed now uses the signed-out order."
- `deleteExplain` (G4): "Deleting removes your profile, record, sign-in details and the brokerage link at the vendor,
  and your follows, likes, hidden traders and trades, unfollow notes, watchlist and reading activity. Your handle is
  held for a year."

**PR-8:**
- `RESET.heading`: "Reset my feed"
- `RESET.explain`: "Deletes the trades you hid and the notes we keep when you unfollow someone. Your follows, likes,
  “Not interested” list and watchlist stay." PR-5a appends "It also deletes your reading activity."
- `RESET.confirm`: "This cannot be undone." (the same string as `SETTINGS.confirm`)
- `RESET.action`: "Reset my feed"
- `RESET.keep`: "Keep them"
- `RESET.done`: "Your feed is reset."
- `LIKES.gone`: "Record no longer available"
- `LIKES.unlikeGone(h)`: "Unlike a record by @h that is no longer available"
- `LIKES.older`: "Older likes"
- `LIKES.newer`: "Newer likes"
- `FOLLOW.*` lines are unchanged (only where they come from changes).

The UX lead may reword any of these within the same scans. The tests import the strings rather than repeating them.

## 7. What the Privacy page PR must state (it merges after PR-7 and PR-8)

Packet §3, Part A and Part B, with the bracketed lines for G1 to G6 filled in. Three sentences must change, because
these PRs make them false or incomplete:
1. **The request-log sentence** ("a few of those addresses show an action, such as which trader you just followed or
   which records were on your screen") is false after PR-8. Replace it with: "Those addresses show which pages you
   opened, not what you did on them."
2. **Likes:** "Your Liked records list shows every like, each with Unlike, which deletes it at once."
3. **Sessions:** "Ended sessions are deleted by our regular clean-up." **Deletion:** the watchlist moves into the first
   sentence. **Opt-out:** Part B's bracketed line, plus a Part A line saying that today the switch turns off the
   demotions from unfollows and hidden trades.

Under §8 Q1's default, the Watchlist row ("when you last opened each symbol's page") stays as written, since the switch
doesn't stop that stamp. The Privacy PR's reviewer checks its text against the code as merged (IMPLEMENTATION, "true by
construction").

## 8. Owner question (each has a default; the build proceeds with it)

| # | Question | Default |
|---|---|---|
| Q1 | With "Order my feed by my activity" off, should opening a watched symbol's page still record when you last opened it (`ticker_watches.last_seen_at`, which drives "new since you last looked")? | **Yes, keep it.** It is the watchlist's own state, disclosed under Watchlist in the Privacy text, and it orders nothing today. The switch stops discovery activity (PR-5) and the demotions. If the owner says no, the watchlist counts new trades from when you started watching (~3 lines, plus T1.3 tightened). |

Standing, not new:
- **O3 (hide duration):** still open, default 90 days. No part of this plan changes with it. If trade hides become
  permanent, G2 is the way to end them, and T2.1 already covers `'infinity'`.
- **Owner actions with no question:** schedule IMPLEMENTATION item #7 (the expired-session purge and every clean-up line
  in the Privacy text depend on it).
- **A note for the UX lead, not the owner:** G6 changes where a no-JS action from a section row or the pane lands. It
  goes to `/me/following` instead of the trader's profile.

## 9. Accessibility (POLICY A1, WCAG 2.2 AA)

- **The switch (G1):**
  - a native `<button role="switch" aria-checked>` with the visible label as its accessible name (`aria-labelledby`);
  - the state is also visible as the text "On" or "Off", never color alone;
  - ≥ 44 × 44 px, visible focus ring (the existing token), Space and Enter toggle it;
  - a `role="status"` line confirms the change;
  - no animation on the knob under `prefers-reduced-motion`, and only a 120 ms color and transform change otherwise;
  - text contrast ≥ 4.5:1, and the track against its background ≥ 3:1 (non-text contrast).
- **Reset (G2):**
  - the confirmation page's `h1` takes focus on load;
  - the primary and secondary actions are both ≥ 44 px, and their meaning comes from their text;
  - after the reset, focus moves to the `role="status"` line;
  - it works with JavaScript off.
- **Liked records (G5):**
  - the paging links are real links ≥ 44 px, and focus lands on the "Liked records" heading (`#liked`, `tabIndex=-1`)
    after paging;
  - a removed record's Unlike has a distinct accessible name;
  - the row's text says "no longer available", so nothing depends on dimmed styling alone.
- **No-JS confirmations (G6):** stay `role="status"`. The watch-cap line becomes static text next to the button
  (`role="status"` only right after a tap).
- **Checks:** every new view is tested at 375 and 320 px in light and dark, with keyboard only and with axe
  (T1.5, T2.3, T5.2).

## 10. Performance budgets

| Budget | Value | Test |
|---|---|---|
| Signed-in feed, switch on | p95 < 800 ms (unchanged, `plan.md` §4). The flag read is one PK lookup inside the existing `Promise.all` | existing load test |
| Signed-in feed, switch off, no hides | ≤ signed-out p95 + 20 ms (it serves `kept.mixed`) | T7.L |
| Switch tap to feedback | < 100 ms (optimistic) | T1.5 |
| Reset, 10,000 rejects + 5,000 notes | < 300 ms, one transaction | T8.L |
| `/me/following`, 5,000 likes, page 25 | p95 < 300 ms (fallback index in §4) | T8.L |
| `POST /me/liked`, 60 keys | p95 < 50 ms | T8.L |
| Session purge | ≤ 5 s per tick under its box; 1 M expired rows drain in ≤ 20 ticks; zero live rows touched | T8.L |
| Feed raw HTML | ≤ 500 KB per page (unchanged; the switch adds nothing to the feed) | existing |

## 11. Compliance checklist (COMPLIANCE §1)

1. **Performance shown, ranked or described?**
   - G1 changes ordering only by removing demotions, and only for the viewer who chose it. It reads no return, so it is
     sign-invariant by construction (T1.1 compares against the signed-out order, which is already sign-invariant).
   - No new performance number is shown. The new pages (Settings, the reset confirmation, Liked records) show no
     return. A liked row still shows symbol and date only.
   - F1 as amended now requires the opt-out, and PR-7 supplies it.
2. **Personal data?**
   - New: `users.personal_order_off` (a boolean; only the viewer sees it, on `/settings`; deleted with the users row).
   - Removed:
     - trade hides and unfollow notes, on demand (G2);
     - expired sessions, by the tick (G6);
     - the watchlist, moved to deletion's first step (G4).
   - Viewer actions leave the request URLs (G6).
   - Nothing is stored signed out. The Privacy PR's text must match §7.
   - Retention lines depend on item #7 (owner).
3. **Money, rewards, points?** No.
4. **Email, push, SMS, tracking?** None added. G3 keeps implicit tracking off for real viewers. No third party.
5. **User text?** None new.
6. **Sign-up, age, identity, accounts?** No change to sign-up or 18+. Deletion gains one table in its first step.
7. **Vendor, dependency, font, outside asset?** None.
8. **Screen reader and keyboard?** §9.
9. **Security posture?**
   - Every new action is session-bound with no target argument (`resetFeed`, `setOrder`).
   - `/me/liked` moves to POST, validated and capped, `private, no-store`.
   - The session purge runs under the existing cron bearer.
   - Paging input is validated (`?likes=`).
   - No new public endpoint.
10. **Claims in copy?** Each explanation is true of the code as built. The "On" line names only today's demotions, and
    PR-5b must rewrite it (test T1.5 pins the string to `SETTINGS`). No "every trade", no "AI".
11. **Checkout?** No.

## 12. Policy checks for both PRs (from `plan.md` §8, applied)

- **Likes, follows and hides stay private:** no count anywhere, and the reset page counts nothing (the privacy scans
  stay as they are).
- **Losses are never hidden:** a hide is the viewer's own filter. TR-1 holds, since no profile changes.
- **Signed-out behavior is unchanged:** the feed, profiles and shared links behave exactly as today, and the behavioral
  guard is stricter (D13).
- **No celebration** on reset, the switch or likes (F6).
- **Implicit signals:** off for real viewers by a pinned constant until the owner decides otherwise (G3).

## Sign-off

Engineer: **SIGNED** 2026-10-25. I would stake my name on building PR-7 and PR-8 as written, within the stated line
counts, with every acceptance criterion G1 to G6 mapped to a test in §1.3 and §2.3.

Business lead: pending. Please check: that the two-PR split and the order after PR-4 are right; §8 Q1's default; the
Privacy coordination in §7; that the section shows followed traders when the switch is off (the strict reading of G1).

UX lead: pending. Please check: the switch's placement and copy (§1.1, §6); the reset confirmation page; the paging
links and the removed-record row; that no-JS actions from section rows and the pane now land on `/me/following`
instead of the trader's profile (G6); the static watch-cap line.

SIGNED: engineer. PENDING: business lead, UX lead.

## Owner answer (2026-10-25)

Q1: **yes**, keep recording a watched symbol's last-opened time while personal ordering is off (the plan's
default). Recorded in the F-2 file's Decisions.
