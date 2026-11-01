# F-2 PR-5 + PR-6 · UX lead plan (one PR)

Date 2026-11-01. Builds on `plan.md` §PR-5/§PR-6, amended by the owner's decisions of 2026-11-01. I adopt the
engineer's skeleton (items 1-8) with the amendments marked **Amend**. One branch `autopilot/feature-2-personal`,
commits in this order (criterion 15: hidden trades ship before scoring):
1 hidden trades · 2 settings + `/me/personalize` · 3 event log + logger · 4 scoring, reasons, heading · 5 LOAD suite.

## 1. What the 2026-11-01 decisions change in the old plan
- **90-day event purge → gone.** Preference data and the activity log are stored until the viewer removes them or
  deletes the account. Every read uses only `at > asOf − 90 days`, weights fading linearly to 0 across the window.
  `purgeDiscovery` deletes only: likes, trade rejects and `trade` events whose close no longer exists (by
  `trade_key`); events/rows whose trader is deleted (cascade already does it; the purge sweeps stragglers);
  `viewer_exclusions` the viewer *ended* (Undo/"Show again") over a day ago. A "Not interested" that ran its 90 days
  is kept stored (no longer read). **Amend:** today's purge deletes any row with `until < now − 1 day`; it must add
  `and ended_by_viewer` (new column `viewer_exclusions.ended_at timestamptz`, set by `endExclusion`), else naturally
  expired rows are deleted on a timer, which the decision forbids.
- **Criterion 5** ("raw events older than 90 days deleted nightly") is superseded (see Open question Q1); its second
  half (account deletion removes events the same day) stands and is tested end to end.
- **Criterion 2/7 watchlist:** superseded by criterion 16 (watchlist is never an input). No watchlist reason line.
- **`traderPreference`** (`weights.ts`) today never ages a like; PR-5 replaces it with the 90-day linear fade.
- **`discovery_trader_features`** (old plan) is dropped: symbol and holding vectors come from the candidates' own
  facts read at asOf. Return to it only if the LOAD budget fails.

## 2. Data model
- `users.personalize_feed boolean not null default true`; `users.activity_log_on_at timestamptz` (null = Off).
- `discovery_event_types`, `discovery_surfaces` lookup tables and `discovery_events` as in `plan.md` §PR-5 (5a).
  Written types: impression, dwell_short, dwell_long, skip, swipe_open, profile_open, share. follow, unfollow, like,
  unlike, not_interested, watch, unwatch exist in the lookup but `lib/discovery/events.ts` rejects them
  (`EXPLICIT_IN_OWN_TABLES`, `SYMBOL_EVENTS = false`). Index `(viewer_id, at)`, `(target_user_id)`, `(target_trade_key)`.
- No derived table: everything is computed on read, so "Clear my activity" is one `delete … where viewer_id`.
- Account deletion: `discovery_events` added to `lib/delete.ts`'s first step (both as viewer and as target).

## 3. Screens and states

### 3.1 `/me/hidden` · Hidden trades (commit 1)
Signed in only (signed out → `/login`), `noindex`. h1 "Hidden trades". Muted line under it: "Trades you hid stay out
of your feed until you show them again. Only you can see this list." Rows newest first, 30 per page, keyset paged like
`/me/likes` ("Older hidden trades" link). Each row (`ul.rows`, one `li.line`):
`@handle` (link to profile, `WhoName`) · "SYMBOL, closed Oct 3, 2026" (no return: not a performance screen, so no
disclaimer needed; a link "Trade page →" goes to the record, which carries it) · form button **Show again**,
accessible name "Show again: @handle, SYMBOL closed Oct 3, 2026".
- Show again = `undoRejectTrade` by trade key (deletes the row, restores a like from `liked_at`), a plain form post →
  redirect `?back=<key>`; the page's `role="status"` line says "@handle's trade is back in your feed." only when that
  key is no longer hidden and was shown again by this viewer in the last minute (same guard pattern as `?back=` on
  `/me/following`). Focus after redirect: the status line is announced; nothing else moves.
- Empty: "You haven't hidden a trade." Close gone after a rebuild, or trader deleted: row skipped (purge removes it).
- Demo trader rows carry the Demo badge. Losing and winning trades look identical (no return shown).

### 3.2 Feed line "N trades hidden by you" (commit 1)
Signed in and N > 0 only (N = the viewer's `trade_exclusions` rows whose close exists): one muted line directly under
the feed's top explainer, above the first card, on every server-rendered feed page (the pager appends cards below it,
it does not repeat). Text: "3 trades hidden by you." + link **Show them** (accessible name "Show 3 hidden trades",
target ≥ 44 px tall via padding). Singular: "1 trade hidden by you." N = 0 or signed out: absent (no placeholder,
no "0"). After a reject on the page the line updates on next load only (the 5-second Undo toast already covers it).
This is the viewer's own private count, never shown to a trader (F6 unaffected).

### 3.3 `/me/personalize` · Personalize (commit 2)
Linked from `/settings` ("Personalize your feed") and from `/me/following` (under its lists) and from the feed's order
line (3.5). Signed in only. h1 "Personalize your feed". Two blocks, each an `h2`, an explain paragraph, then a
`role="group" aria-labelledby=<h2 id>` holding **On** and **Off**: two `<button name="v" value="on|off">` in one form,
same class, same size, side by side at 360 px (each `flex: 1`, ≥ 44 px tall, ≥ 140 px wide), `aria-pressed` on both.
The current one shows a "✓ " prefix and a 2 px outline in addition to `aria-pressed` (never color alone). Pressing the
current value is a no-op that still confirms. Works without JavaScript (server action form post → redirect `?saved=`).

Block A, **Personalize my feed** (default On):
"Uses your follows, likes, hidden traders and hidden trades to order your feed and the section in it. Each choice
counts for 90 days, fading over that time. Off: you get the order everyone gets, minus what you hid."

Block B, **Personalize with my activity** (default Off):
"Off unless you turn it on. When on, Stock Social records which records you see, how long you look, which you skip,
open or share, while you're signed in. Only the last 90 days are used to order your feed. The record is kept until you
clear it or delete your account." Then a third control, separate form, `secondary` style: **Clear my activity**.
While Block A is Off, Block B shows the extra line "Not recorded or used while Personalize my feed is off." and the
logger is not mounted (see Q4).

Status line (`role="status"`, one per page, top of `main`, filled only from a `?saved=` value checked against the
stored state): "Personalize my feed is on." · "Personalize my feed is off. You get the order everyone gets, minus what
you hid." · "Activity is on. Recording starts now." · "Activity is off. Nothing new is recorded, and what was recorded
isn't used. Clear my activity deletes it." · "Your activity is cleared." · "There was no activity to clear." Error:
reuse `FOLLOW.failed`. Clear: one tap, deletes at once (decision text), no second view (Q5).

### 3.4 Event logger (commit 3)
`app/discovery-log.tsx`, mounted by the layout only when the server sees: signed in, `personalize_feed`, and
`activity_log_on_at` not null. Invisible: no DOM output, no focus, no ARIA, no UI on failure, no retry storm (drops a
batch on non-2xx). Rules from `plan.md` 5a (impression 60 % visible ≥ 500 ms once per card per view; dwell buckets;
skip < 1 s; swipe_open once per row per view; `sendBeacon` every 10 s and on `pagehide`), measured by
IntersectionObserver so keyboard and screen-reader browsing count the same as touch. **share** = the share button's
action completing (link copied or system share sheet opened) once per target per view; unfurls and visits to a shared
link are never events (Q7). `/api/events`: 204 with nothing stored unless signed in + both settings On; same-origin
check; one batch per 2 s per session (else 429, dropped); ≤ 50 events; card targets arrive as `closed_trades.id` and are
resolved server side to `trade_key` + trader, unknown ids dropped; self-targets dropped; time clamped to [now − 1 h, now].

### 3.5 Feed order and the section (commit 4)
- Feed order line, signed in + personalize On + ≥ 1 signal in the window: "Ordered using your follows, likes and
  hides." (activity On and ≥ 1 event: "…likes, hides and activity.") + link **Change** (name "Change how your feed is
  ordered") → `/me/personalize`. Otherwise absent. Sits above the hidden line (3.2).
- Section heading, same condition: "More like what you read"; explain: "Traders like the ones you follow, like and
  read, ordered by how much evidence each record has. Losses count the same as gains." Otherwise the current
  `SECTION.heading`/`explain`, unchanged (signed out, zero signals, personalize Off).
- Reason line per row, first that is true: "Similar holding period to @x" (x followed or liked by the viewer, same
  holding bucket as the row's median; x is never the row's trader) · "Trades symbols you read" (≥ 1 shared symbol with
  the viewer's liked or opened records in the window) · "New to you" (no impression, open or like of this trader by the
  viewer in the window; only with activity On, else skipped) · the existing "Typical holding period: …". Never a
  ticker, never a number from a record, never another viewer.

### 3.6 Every state, one line each
Signed out: unchanged feed and section, no logger, no lines, `/me/*` → `/login`, `/api/events` 204. New viewer (zero
signals): impersonal order, old heading, no order line. Personalize Off: impersonal order minus own hides (exclusions
and trade rejects), old heading, no logger. Activity On, no events yet: explicit signals only. Viewer who reads only
losing records: same relevance as an identical viewer reading gains (sign invariance test). Demo data: demo traders
rank and get reasons under the same rules, badge kept. Scoring throws: impersonal order and old heading for that
request, no error shown. Trader deleted mid-page: gap, as today. Loading: server-rendered, the pager's existing
"Trades X to Y loaded" status.

## 4. Scoring (`lib/discovery/personal.ts`, pure)
Adopt skeleton item 5 as written: `viewerProfile(signals, events, asOf)`; linear fade `max(0, 1 − age/90 d)`;
like +3, swipe_open +2, reject/"Not interested" −4, unfollow −1 (owner-pinned); proposed: dwell_long +1,
profile_open +1, share +1, skip −0.5, dwell_short 0, impression 0 (used only for "New to you"). Relevance
`direct + 0.6·cos(symbols) + 0.6·cos(holding) + follow bonus (proposed +2)`; position key `index/(1+0.5·rel)` for
rel > 0, `index·(1+0.5·|rel|)` for rel < 0, stable ties by index; then the existing caps and exploration. Profile
built from rows with `at ≤ asOf` so page 2 matches page 1's list. The page passes `profileFor` into `loadFeedPage`
(the guard test that `loadFeedPage` alone reads no `trade_likes`/`discovery_events` stays green). ≤ 2,000 events read
per viewer. Never reads `return_pct` or its sign (import-guard test on `personal.ts`).

## 5. Copy
All new strings in `lib/copy.ts` blocks `HIDDEN_TRADES`, `PERSONALIZE`, and additions to `SECTION`
(`personalHeading`, `personalExplain`, `reasons`) and `FEED` (`orderLine`, `hiddenLine`), added to `allCopy()` so the
scanner (PROMO + suggestion word list: buy, sell, hold, pick, signal, advice, price target, Suggested, Recommended,
Top, Best, AI) covers them. Note: "hold" is banned as a word, "holding period" already passes the scanner's rule; check
"hidden"/"hide" are not caught. Durations come from constants (`WINDOW_DAYS = 90`), never literals.

## 6. Tests, one per acceptance criterion (C = criterion number in the feature file)
- C1: following a trader raises that trader's position for the viewer; unfollow lowers it, never removes cards.
- C2: viewer with signals sees "More like what you read"; rows follow relevance, ordered by lower bound.
- C3: `discovery_events` column list is exact; generated rows contain no `@`, no 7+ digit run outside ids, no price,
  units or account id; `/api/events` rejects unknown keys and explicit types.
- C4: "Not interested" removes the trader from suggestions for 90 days and lowers a trader with the same symbols and
  bucket; unfollow −1 only.
- C5 (amended): account deletion leaves zero rows in every F-2 table, as viewer and as target (e2e); events older than
  90 days are stored but change nothing (boundary at exactly 90 d); purge deletes orphans and viewer-ended exclusions
  after 1 day, never a naturally expired "Not interested".
- C6: caps and ≥ 2 exploration picks per 10 hold on 1,000 generated personal feeds.
- C7/C17: each reason true against its inputs; no ticker slot; scanner passes; x never the row's trader.
- C8: sign invariance: flipping every return's sign leaves the personal order unchanged; section by lower bound.
- C9: copy scanner over the new blocks.
- C10: signed out: HTML has no logger script, impersonal heading, `/api/events` stores nothing (route test + e2e).
- C11: cold start, one signal, 10,000 events, losses-only viewer; scoring forced to throw → impersonal page.
- C12: new user has `activity_log_on_at` null; Off posts store nothing; Off with stored events → order identical to a
  viewer with none; Clear deletes all at once; the On/Off buttons have identical classes and size (Playwright box
  compare at 360 px) and both work with JavaScript disabled.
- C13: personalize Off → order equals the signed-out order minus own exclusions and trade rejects.
- C14: like at 0, 45, 89, 91 days → weight 3, ~1.5, ~0.03, 0; rows still stored at 91 days.
- C15: `/me/hidden` and the feed line: keyboard only (Tab to "Show them", Enter, Tab to "Show again", Enter, status
  announced), axe clean, 44 px boxes, works without JS; commit order checked in review.
- C16: watch/unwatch posts store nothing; `personal.ts` does not import or query `ticker_watches`.
- Two viewers never see each other's data; 360 px screenshots of every state in 3.6 for the review.

## 7. PR-6 (commit 5, `LOAD=1`)
Adopt skeleton item 8, plus: `/me/hidden` with 10,000 hidden trades p95 < 300 ms; the feed's hidden-count query
< 20 ms at 10,000 rows; signed-out feed p95 < 400 ms unchanged; caps hold on 1,000 viewers × 3 pages.

## 8. Compliance (COMPLIANCE §1)
1 Performance: no number on new rows or lines; disclaimer unchanged on feed and pane; losses = gains (C8). 2 Personal
data: `discovery_events` (viewer id, surface, target, type, time), two `users` columns; seen only by that viewer's
ordering; deleted by Clear, by account deletion, by the orphan purge. Activity opt-in, off by default. 3 Money: no.
4 Tracking: first-party only, no third party, opt-in; no notifications. 5 User text: no. 6 Accounts: no. 7 Vendors or
dependencies: none. 8 Accessibility: section 3, C12, C15. 9 Security: `/api/events` is a new public endpoint
(same-origin, rate-limited, auth-gated, size-capped). 10 Claims: no "AI", no "smart", no "for you" promise.

## 9. Owner-only (the build does not wait, real viewers do)
- **H4 Privacy Policy text** (placeholder today): must state the storage rule, 90-day use window, activity opt-in and
  Clear. The PR exports these facts as `PREFERENCE_DATA` constants and a test that fails if the policy page, once it
  has text, omits them. Real viewers wait for it.
- Switching activity logging to default On (needs counsel's CIPA, SB 976, NY SAFE and profiling analysis).
- The proposed implicit weights and follow bonus.

## 10. Open questions (recommended option first; the committee decides by it)
- **Q1** Criterion 5's nightly 90-day deletion: superseded by indefinite storage; reads limited to 90 days. (Alt: keep.)
- **Q2** Controls' home: new `/me/personalize`, linked from Settings, Following and the feed order line. (Alt: on
  `/settings` itself, which already carries account deletion and would bury it.)
- **Q3** Turning activity Off: keep stored events unused and offer Clear in the status line. (Alt: clear on Off.)
- **Q4** Personalize Off with activity On: logger not mounted, nothing recorded (minimum collection, P3); the stored
  setting is kept for when personalize is turned back on. (Alt: keep recording.)
- **Q5** Clear my activity: one tap, deletes at once, status confirms. (Alt: a confirm view like account deletion.)
- **Q6** Opening swipe (+2): an activity event, so it counts only with activity On. (Alt: store it as an explicit
  choice in its own table, counting for everyone; that is new collection without opt-in, not recommended.)
- **Q7** "share" = the share action completing, once per target per view, +1. (Alt: weight 0.)
- **Q8** Implicit weights: dwell_long +1, profile_open +1, share +1, skip −0.5, dwell_short 0, impression 0; follow
  bonus +2.
- **Q9** Feed line at 0 hidden: absent. Placement: under the feed's top explainer, below the order line, page top only.
- **Q10** Show again on a trade: delete the row at once and restore its like (the feed reads rejects live, so no
  day-long keep is needed). (Alt: end-and-purge-a-day-later like trader exclusions.)
- **Q11** Exact copy: every string in section 3 as written.
- **Q12** Add "How your feed is ordered" (the 90-day window, the weights in words, Off switches) to `/how`: yes, one
  paragraph, same constants. (Alt: only on `/me/personalize`.)
- **Q13** Naturally expired "Not interested" rows: kept stored, unread, until the viewer or account deletion removes
  them; `/me/following` keeps listing only running ones.
