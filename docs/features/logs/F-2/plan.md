# F-2 · Personalized discovery · Implementation plan (signed)

Date: 2026-10-23. Feature: `docs/features/F-2-personal-discovery.md` (Status ready; Decisions as
restored 2026-10-23). Inputs: `plan-round1-*.md`, `plan-round2-engineer.md` (with its Round 3 note) and
`plan-round2-business-lead.md` (REVISE, demands A to E). This is the round-2 plan with A to E applied as
the business lead wrote them; nothing else in round 2 changed. It decides how, not what: no decision in
the feature file changes, and the owner questions O1 to O3 are the owner's. Nothing here is legal advice.

Criteria are numbered 1 to 11 in the order of the feature file's acceptance criteria.

Demo sentence: "Follow the records you read, and the feed shows you more traders who trade like them,
losses included, each with the reason it is there."

## 1. The PRs, in build order

Every PR: ≤ the Gate's 800-line cap, tests written first and failing before the code, schema additive
and idempotent (`create table if not exists`, `schema_add_*`, `insert … on conflict do nothing`; no
`drop`, `truncate` or `delete from` in `db/schema.sql`), reads `node_modules/next/dist/docs/` for the
APIs it uses before coding (AGENTS.md), touches no protected path, adds no dependency or vendor.

| # | PR | Criteria | Waits on |
|---|---|---|---|
| 1 | Feed mix and paging | 6, 8 (feed), 10 (feed) | nothing |
| 2 | Follow and "not interested" | 1 (private follow), 4 (exclusion half), 5 (deletion of follows and exclusions) | nothing to build; H4 before real viewers |
| 3 | Suggestions section, impersonal | 7 (impersonal reasons), 8 (section), 9, 10 | PR-1, PR-2 |
| 3b | Profile row | owner placement decision | **O2** |
| 4 | Likes and gestures | owner gesture decisions | PR-2, PR-3 (O1 only for 4c) |
| 5 | Event log, implicit logger, personal scoring | 1 (ranking), 2, 3, 4 (lowers similar), 5 (event purge and deletion), 7, 8, 11 | **H1, H2, H4** |
| 6 | Heavy use and the end-to-end matrix | 5 (heavy), 11 (heavy) | PR-5 |

**No event table exists before PR-5** (demand C). PR-2 to PR-4 store only the state the viewer chose:
`follows`, `viewer_exclusions`, `trade_likes` (plus the existing watchlist). Those rows are the explicit
signals PR-5 reads, with the owner's weights. Reviewer rule: fail any PR before PR-5 that creates an
event table or its lookup tables.

### PR-1 · Feed mix and paging · `autopilot/feature-2-feed-mix` · ~700 lines · waits on nothing

Impersonal and sign-neutral; the same list for every viewer, signed in or out.

- **Scope.**
  - `lib/discovery/diversity.ts`: `diversify(cards, { window: 10, maxPerTrader: 2, maxPerSymbol: 2 })`,
    greedy over the ranked list; never relaxes a cap (when the pool cannot fill a window, the list ends).
  - `lib/discovery/explore.ts`: ≥ 2 of every 10 slots are exploration picks from the eligible pool
    outside the top 30 by score (includes "too early" records). Seeded PRNG, seed = UTC day only. Never
    reads the sign of `return_pct`. No propensity recorded.
  - `lib/discovery/pager.ts`: pages of 30. Cursor `{ day, asOf, offset }`, base64url, ≤ 200 bytes,
    validated (bad or tampered → page 1, never a 500). `asOf` freezes the ranking clock (`closed_at ≤
    asOf`). Each page recomputes the same ranked, diversified, explored list (≤ `FEED_CANDIDATES` = 200)
    and slices `[offset, offset + 30)`, so the diversity window spans the page join by construction.
  - `lib/feed.ts`: `feedCandidates({ ids, asOf })`.
  - UI: `app/page.tsx` plus a small client `app/feed-pager.tsx`. Auto-append, no tap: a sentinel 5 cards
    from the end fetches the next 30 server-rendered cards through a server action; one request in
    flight; failure shows one inline "Couldn't load more. Retry" (≥ 44 px). Without JS the sentinel is a
    plain `?after=<cursor>` link. SW-1 behavior identical on appended cards.
  - **End card:** "End of today's feed." (true: the order is seeded per UTC day; no completeness claim,
    the list is capped at 200 candidates) with "Publish your trades". The UX lead may rewrite it within
    the same rule.
- **Schema.** None. (Fallback only if the load budget misses: `closed_trades.feed_key` via
  `schema_add_column` plus one index, with an equivalence test against today's SQL.)
- **Tests first.**
  - Property (seeded, 1,000 feeds × 3 pages): no trader or symbol more than twice in any 10 consecutive
    cards, including windows across page joins; ≥ 2 exploration picks per full window; never a relaxed cap.
  - Cursor round-trip; tampered cursor → page 1; pages 1 to 3 concatenated equal the unpaged list; a
    trade inserted after `asOf` appears nowhere and moves nothing.
  - Sign invariance: negating every `return_pct` leaves the order unchanged.
  - **Import guard, scoped to the pure modules (demand A):** `diversity.ts`, `explore.ts` and `pager.ts`
    import nothing from `lib/db.ts`, `lib/session.ts` or any module that reads one viewer's data (the
    test walks their import graph). `app/page.tsx` is not in this test.
  - **Behavioral guard (demand A):** a DB test renders the signed-out feed (pages 1 to 3) with a
    query-logging client (the test pre-seeds `globalThis.sql` with a `debug` hook before `lib/db.ts`
    loads; no product change) and asserts no query mentions `follows`, `viewer_exclusions`,
    `trade_likes` or `discovery_events`. Later PRs only add cases to this test.
  - E2e (375 px, light and dark): page 2 appends with no tap at card 25; the 30 → 31 join is seamless;
    keyboard `↓` through the join; no-JS uses the link; the end card renders on the demo fixture.
  - E2e: raw HTML ≤ 500 KB per page with 50 distinct heavy traders in the fixture.
  - Load (`LOAD=1`): signed-out server time p95 < 400 ms at 500 traders, pages 1 to 3.
- **Acceptance (F-2):** 6 (diversity and exploration on generated feeds), 8 (feed ranking symmetric,
  lower bound), 10 (signed-out feed identical, works on shared links).
- **Budgets:** ≤ 500 KB per page; signed-out p95 < 400 ms.
- **Policy checks:** losses ranked as gains (`abs`); works signed out; no completeness claim; nothing
  per viewer.

### PR-2 · Follow and "not interested" · `autopilot/feature-2-follow` · ~650 lines · waits on nothing (H4 before real viewers)

- **Scope.**
  - Server actions in `app/discovery-actions.ts`: `follow`, `unfollow`, `notInterested`,
    `undoNotInterested`. "Not interested" is the single negative action: a 90-day exclusion
    (`EXCLUSION_DAYS = 90`, O3). Unfollow writes the same exclusion with reason `unfollow` (criterion 4).
  - Follow control on the profile header and the pane: "Follow" / "Following", `aria-pressed`, ≥ 44 px,
    hidden on your own profile; signed out it links to `/login?next=…`. No count anywhere. The pane
    header spacing fix ("Name@handle") ships here.
  - Privacy line once: the status after the first follow, "Following @x. Only you can see this."
    (`role="status"`), and on `/me/following`.
  - "Not interested in @x" in a "…" menu component used on section rows only (rendered by PR-3); never on
    feed cards. After it: `role="status"` line **"Hidden for 90 days."** with an "Undo" button for 5 s.
  - `/me/following` (viewer only, `noindex`): Following; Not interested, with "Show again".
  - Exclusions honored on the signed-in feed and the section; never on a profile (TR-1).
  - **Hides between pages (demand B).** The list a cursor slices is a pure function of `(day, asOf,
    exclusion set at asOf)`:
    - Exclusions with `created_at ≤ asOf` and `until > asOf` shape the ranked, diversified list (the
      hidden trader's cards are not candidates).
    - Exclusions created after `asOf` and still active act as a **display filter**: their cards are
      dropped from every later slice in place; the rest keep their positions in the list. The client
      collapses that trader's already-rendered cards (scroll position anchored, no motion under reduced
      motion). Undo within 5 s restores them; later slices include them again.
    - Undo and "Show again" set `until = now()` instead of deleting, and the tick deletes only rows
      with `until < now() − 1 day`, so the list for a same-day cursor never changes under the viewer.
    - The hide enters the ranking at the viewer's next page 1 (a new `asOf`), where the caps hold exactly.
    - Result: no card repeats; no card vanishes except the hidden trader's; the hidden trader never
      appears again in the session. **Stated bound in a session with hides:** removing cards can bring
      others closer, so in any 10 consecutive displayed cards one trader or symbol appears at most
      **4 times after one hide** (tight), at most 6 after two, at most 8 after three; from four hides in
      one session the bound is the window itself. Pages built at a new `asOf` obey the caps (≤ 2) exactly.
      What to measure: the share of sessions with two or more hides.
  - `lib/delete.ts#deleteProfile`: a first step before the vendor call deletes the viewer's `follows`
    and `viewer_exclusions` in one transaction; the cascade covers rows referencing a deleted trader.
  - `lib/discovery/purge.ts#purgeDiscovery({ deadline })`, called from `app/api/sync/route.ts` **after
    the connection tick and the deletion retries, before `syncTick`** (demand D), under
    `pg_try_advisory_lock(<purge key>)` with a fixed time box of **≤ 30 s per call**; the caller then
    continues exactly as today (no branch, trader claiming never skipped; a caller that loses the lock
    skips only the purge). In PR-2 it deletes `viewer_exclusions` with `until < now() − 1 day` in
    batches by the `(until)` index. `syncTick` keeps its own deadline, so the route stays inside its
    300 s limit.
- **Schema.**
  - `follows(viewer_id → users on delete cascade, trader_id → users on delete cascade, created_at
    timestamptz not null default now(), primary key (viewer_id, trader_id), check (viewer_id <>
    trader_id))`, index `(trader_id)`.
  - `viewer_exclusions(viewer_id → users cascade, trader_id → users cascade, created_at timestamptz not
    null default now(), until timestamptz not null, reason text check in ('not_interested','unfollow'),
    primary key (viewer_id, trader_id))`, indexes `(trader_id)`, `(until)`.
  - No event, lookup, serves, affinity or trader-feature table.
- **Tests first.**
  - DB: follow/unfollow; "not interested" and unfollow exclude for 90 days (excluded at 89 d 23 h 59 m
    by a backdated `until`, back at 90 d + 1 s); Undo and "Show again" end the exclusion.
  - **Property (demand B): 1,000 seeded feeds, a hide between pages 1 and 2** (and a variant with the
    hide after cards of the trader were already rendered on page 1): pages 1 to 3 contain no repeated
    card; every card of the no-hide list except the hidden trader's appears, in the same relative order;
    the hidden trader appears nowhere after the hide; every 10-card window obeys the stated bound; the
    next page 1 obeys the caps exactly. Plus: an exclusion row ending or purged mid-day does not change
    a same-day cursor's slices.
  - Behavioral guard: **new cases added to PR-1's test** (signed-in render reads `viewer_exclusions` and
    `follows` only for the session's viewer id); the signed-out cases stay as they are. The PR-2 diff
    changes no PR-1 assertion (reviewer rule).
  - DB: follows and exclusions unreadable by every public query (render each public page and route,
    grep for follow data); no count on profile, pane, share card, OG image, `/pane-chart`.
  - DB: purge boundary; a purge cut by its time box resumes on the next call; two concurrent callers →
    exactly one purges and **both** claim traders; the F-1 fleet test passes unchanged.
  - DB: deletion as viewer and as trader → zero rows in `follows` and `viewer_exclusions`; a failed
    vendor call still leaves zero.
  - E2e (375 px, light and dark, keyboard only): follow, unfollow, first-follow status line,
    `/me/following` with "Show again", signed-out tap goes to sign-in; deletion via `/settings` then both
    tables empty the same day.
  - Unit: action input validation; handles checked against the pattern first (the F-1 NUL-byte 500).
- **Acceptance (F-2):** 1 (follow and unfollow from profile and pane, private; "feed the ranking" is
  PR-5), 4 (90-day exclusion from suggestions for "not interested" and unfollow; "lowers similar" is
  PR-5), 5 (account deletion removes follows and exclusions the same day).
- **Budgets:** tap to feedback < 100 ms (optimistic toggle, reverted on refusal); purge ≤ 30 s per call.
- **Policy checks:** private (no counts, trader never told); never hides a trade on a profile; no event
  rows; nothing stored signed out; honest duration copy.

### PR-3 · Suggestions section, impersonal · `autopilot/feature-2-section` · ~600 lines · waits on PR-1, PR-2

- **Scope.**
  - One full-height feed card at **position 6 of each 30-card page, so the first five cards are
    records**. Inserted after diversity; section rows do not count toward the caps but are checked
    against them.
  - 3 rows. Candidates = PR-1's eligible pool minus traders in the 10 feed cards around the section,
    minus the viewer's own record, follows and exclusions (signed in), minus records still importing.
    Ordered by `rankTraders` with `weight = evidenceWeight(confidence(...))` (TR-9 lower bound, symmetric
    in sign). Distinct traders, at most 2 sharing a holding bucket. Fewer than 3 → not rendered.
  - A row: name, badge (Verified / Demo / incomplete), one reason line, **no performance number**,
    Follow, "…" (→ "Not interested"). Tapping opens the trader's pane as a sheet (the same pane
    component); "See full profile →" is one step further.
  - Heading: a true impersonal heading for signed out, and for signed in until PR-5; placeholder "More
    verified records" until the UX lead writes it.
  - Impersonal reasons (templates in `lib/copy.ts`, each true against its inputs, no ticker slot):
    "Typical holding period: {under a day | 1 to 7 days | 1 to 4 weeks | 1 to 6 months | over 6
    months}"; "Closed a record this week"; "New here this month". No "Suggested", "Recommended", "Top",
    "Best", "AI".
- **Schema.** None.
- **Tests first.**
  - Unit: candidate filter; order equals `rankTraders` by `evidenceWeight`; sign invariance; a losing
    record suggested exactly as a winning one of the same evidence; < 3 → null; every reason true on
    fixtures; template scan against `PROMO` plus `\b(buy|sell|hold|pick|signal|advice|price target)s?\b`
    ("holding period" passes, "hold"/"holds" fail).
  - E2e (375 px, light and dark, signed in and out): section at position 6; 3 rows; no `%` or signed
    number in any row; "…" on rows and on no feed card; a row tap opens the pane sheet; signed out no
    write request; demo fixture (3 traders) renders no section.
  - E2e: "Not interested" on a row → "Hidden for 90 days." with Undo; the trader's rendered feed cards
    collapse; page 2 omits them (PR-2's display filter, end to end).
  - Screenshots at 375 px (light, dark, signed in, signed out) in the PR's build log.
- **Acceptance (F-2):** 7 (plain-word reason on each suggestion, impersonal form), 8 (section ordered
  by the lower bound, losses equal), 9 (copy scan), 10 (signed out sees the same section).
- **Budgets:** feed page HTML stays ≤ 500 KB with the section; signed-out p95 < 400 ms unchanged.
- **Policy checks:** no performance numbers without the disclaimer (the pane carries it); no advice
  words; heading never untrue; works signed out.

### PR-3b · Profile row · `autopilot/feature-2-profile-row` · ~350 lines · **waits on O2**

Built only if the owner keeps the row; dropped with no other change if O2 answers "cut".
- **Scope.** Under the trade list on `/u/[handle]` (never above it), heading "Similar holding periods",
  3 traders whose median holding bucket equals this trader's, ordered by the TR-9 lower bound; each row
  name, badge, its fact. Same for every viewer, so it works signed out. Hidden when the trader has fewer
  than 5 closed trades.
- **Schema.** None; one grouped query of median `holding_days`, cached 1 hour with
  stale-while-revalidate (or PR-5's trader features if PR-5 merged first).
- **Tests first.** Bucket rule; identical for two viewers and signed out; profile p95 regression ≤ 20 ms
  on the heavy fixture; copy scan; NUL-byte handle → 404.
- **Acceptance:** the owner's placement decision ("a row on the trader profile"); criteria 8 and 9 for
  its rows.
- **Budgets:** profile p95 +≤ 20 ms. **Policy checks:** no endorsement words, no performance numbers,
  the shared record comes first. Measure: share of shared-link profile visits leaving through the row.

### PR-4 · Likes and gestures · `autopilot/feature-2-gestures` · ~650 lines · waits on PR-2, PR-3

- **Scope, likes (owner: double tap +3, private).**
  - Server actions `like`, `unlike` (one row each; no event row). A like whose trade no longer exists
    after a rebuild is kept and ignored on read.
  - Double tap on the trade card body (not links, buttons or the pane chart): two taps within 300 ms and
    24 px, `touch-action: manipulation`. Outline to filled; no burst, animation, vibration or count. A
    like on a loss is the same as on a gain. The icon button is the keyboard and screen-reader route
    ("Like. Only you can see likes.", `aria-pressed`, ≥ 44 px). Signed out: one inline sign-in line.
  - `/me/following` gains "Liked records"; deletion's first step adds `trade_likes`.
- **Scope, reject swipe (owner: other direction −4), non-colliding default while O1 is open.** Section
  rows only; feed cards keep SW-1 exactly. Each row is its own native scroll-snap container `[reject
  tray | row | open sentinel]` with `scroll-snap-stop: always` on the row; arms only on a touch that
  starts on a row at rest (not while a pane is open, not within 400 ms after one closes); horizontal
  travel ≥ 2× vertical; commits past 50% of the row width. It calls PR-2's `notInterested` (same single
  negative action), collapses the row, shows "Hidden for 90 days." with Undo. The opening direction
  opens the pane sheet. PR-4c (only if O1 answers "on feed cards too", after an owner amendment of
  SW-1's "Reserved gesture"): ~150 lines. "Menu only": the gesture half is removed (~120 lines).
- **Schema.**
  - `closed_trades.trade_key` generated as
    `encode(sha256(replace(sell_id, chr(92), chr(92) || chr(92))::bytea), 'hex')` stored, with an index
    (demand E4). Doubling every backslash makes the `bytea` input read the text literally (no escape
    or `\x` hex parsing); every function in it is immutable, so it is valid in a generated column.
    Fallback if the database refuses the expression: a plain column filled by `rebuildTrades` with
    `node:crypto` sha256 of the UTF-8 bytes, same tests.
  - `trade_likes(viewer_id → users cascade, trade_key text not null, trader_id → users cascade,
    created_at timestamptz not null default now(), primary key (viewer_id, trade_key))`, index
    `(trader_id)`.
- **Tests first.**
  - DB: `trade_key` equals the `node:crypto` sha256 (UTF-8) for sell ids `a\b`, `\x41`, `\\`, `\001`,
    a trailing `\`, and non-ASCII text; no input errors; stable across `rebuildTrades`; a like
    re-attaches after a rebuild.
  - Unit: tap timing (299 ms likes, 301 ms doesn't; link or chart tap is not a like); reject recognizer
    (49% snaps back, 51% commits; a touch starting while a pane is open or 399 ms after it closes never
    commits; a diagonal over the lock ratio scrolls).
  - DB: `trade_likes` unreadable by every public query; absent from profile, pane, share card, OG image;
    behavioral guard gains the signed-out `trade_likes` case already covered by name and a signed-in
    own-viewer case.
  - E2e with touch emulation (375 px): double tap likes once, a vertical swipe never likes; a horizontal
    swipe on a feed card still opens the pane and writes no exclusion; on a section row the opening
    swipe opens the pane sheet, the reject swipe writes exactly one exclusion and the row is gone; Undo
    restores it; close a pane then immediately swipe again on the row beneath → no reject.
  - E2e: no request to any event endpoint is ever sent (route interception).
- **Acceptance:** the owner's gesture decisions (like +3 private, reject −4 not shown again for the
  exclusion period, opening swipe opens the pane); criterion 4's exclusion via the swipe.
- **Budgets:** tap to feedback < 100 ms (optimistic like; a like is neither money nor a record).
- **Policy checks:** likes private everywhere; no celebration (F6); every gesture has a button (A1).

### PR-5 · Event log, implicit logger, personal scoring · waits on **H1, H2, H4**

Written only after H2 is recorded as cleared (COMPLIANCE §2: before build) and H4 holds; merged only
after H1. At about 1,100 lines it ships as two PRs under the cap, in this order:
**PR-5a** `autopilot/feature-2-events` (~550: event log, logger, emitters, purge extension) and
**PR-5b** `autopilot/feature-2-personal` (~600: scoring, reasons, section heading).

- **Scope (5a), the event log moved here whole (demand C).**
  - Lookup tables `discovery_event_types(code smallint pk, name text unique)` and
    `discovery_surfaces(code smallint pk, name text unique)` seeded with `on conflict do nothing`
    (lookup tables, not CHECKs: widening a CHECK needs a drop). Surfaces: feed, pane, profile, section,
    me. Types: follow, unfollow, not_interested, not_interested_undo, like, unlike, share, watch,
    unwatch, impression, dwell_short, dwell_long, skip, swipe_open, profile_open.
  - `discovery_events(id bigint identity pk, viewer_id → users cascade, at timestamptz not null default
    now(), surface → discovery_surfaces, type → discovery_event_types, target_kind check in
    ('trader','trade','symbol'), target_user_id → users cascade, target_trade_key text, target_symbol
    text)`, a check tying `target_kind` to exactly one target; indexes `(viewer_id, at)`, `(at)`,
    `(target_user_id)`.
  - `lib/discovery/events.ts` (pure: allow-list, target shape, unknown keys rejected, ≤ 50 per batch,
    self-targeting dropped, time clamped to [now − 1 h, now]); `lib/discovery/weights.ts` (owner's
    weights pinned: like +3, opening swipe +2, reject / "not interested" −4, unlike retracts +3; the
    engineer's other values marked `proposed` for the owner).
  - Emitters: the PR-2 and PR-4 actions, the watch actions and `share-button.tsx` write their event in
    the same transaction as their row; the implicit logger `app/discovery-log.tsx` (signed in only;
    buffered, `sendBeacon` every 10 s and on `pagehide`; impression 60% visible for 500 ms once per card
    per view; dwell as buckets; skip < 1 s; swipe-open once per row per view) and
    `app/api/events/route.ts` (signed in only, signed out 204 and nothing stored, same-origin, one batch
    per 2 s per session, one multi-row insert). Signed out: not mounted, no identifier.
  - `purgeDiscovery` extends to `discovery_events` with `at < now() − 90 days` in batches of 10,000 by
    id, same ≤ 30 s box and placement; every read filters `at > now() − 90 days`. Deletion's first step
    adds `discovery_events`.
- **Scope (5b).**
  - `viewerProfile(events, follows, likes, watchlist, exclusions, now)` computed on read from the last
    90 days (≤ 2,000 events); decayed affinity (half-life 30 days); symbol and holding-bucket vectors;
    exclusions put −4 on the trader's symbols and buckets. Never reads the sign or size of a return.
  - `discovery_trader_features(user_id pk → users cascade, symbols text[], hold_buckets real[5],
    updated_at)`, refreshed in the purge caller's tick, never on a public read.
  - `relevance = direct + 0.6·cos(symbols) + 0.6·cos(holding) + follow bonus`; no co-visitation. Feed:
    score × (1 + 0.5·relevance) → `rankTraders` → `diversify` → exploration (seed viewer id + UTC day).
    Section: relevance picks 20, the lower bound orders them, followed traders excluded.
  - Personal reasons (scanned templates, no ticker slot): "Similar holding period to @x", "Trades
    symbols on your watchlist", "Trades symbols you read", "New to you". Heading "More like what you
    read" only for a viewer with at least one signal.
  - `ReasonWriter` seam: deterministic by default; throw, > 300 ms, a banned word or a digit absent from
    the input → template (criterion 11). No model in stage 1.
- **Tests first.** Criterion 3: the `discovery_events` column list is exactly the listed columns; a scan
  of generated rows finds no `@`, no 7+ digit run outside ids, no account id, units or price. Signed-out
  `/api/events` stores nothing. Behavioral guard gains signed-in own-viewer cases for `discovery_events`.
  Purge boundary at exactly 90 days. Cold start, one signal, many signals (10,000 events), a viewer who
  reads only losing records, sign invariance of relevance and exclusions, follow raises, "not
  interested" lowers a similar trader, two viewers see none of each other's data, signed out gets the
  impersonal version, the writer forced to fail shows templates, 5,000 viewers × 500 candidates in
  < 50 s on one core.
- **Acceptance (F-2):** 1 (follows feed the ranking), 2, 3, 4 (lowers similar), 5 (event purge and
  deletion), 7 (personal reasons), 8, 11.
- **Budgets:** signed-in feed p95 < 800 ms; scoring ≤ 10 ms per viewer (else `viewer_affinities`
  returns); `/api/events` p95 < 50 ms per batch of 50.
- **Policy checks:** implicit logging only after H2 and H4; no third party; reasons never cite another
  viewer; no "AI" label; no notification.

### PR-6 · Heavy use · `autopilot/feature-2-heavy` · ~500 lines · waits on PR-5

- **Fixture (`LOAD=1`):** 500 traders (12 heavy at 10,000 activities); 5,000 viewers × 500 events
  (2.5 M live); **4 M expired events**; one trader referenced by 100,000 viewers (follows, events,
  exclusions, likes) via `generate_series`.
- **Asserts:**
  - **Purge (demand D): the 4 M backlog drains within 10 consecutive ticks**, each purge call ≤ 30 s,
    zero live rows touched, the F-1 fleet test unchanged.
  - Deleting the trader referenced by 100,000 viewers: < 5 s, zero rows left in every F-2 table
    (fallback: deletion's first step removes references in 50,000-row batches).
  - Signed-out feed p95 < 400 ms; signed-in p95 < 800 ms; raw HTML ≤ 500 KB with 50 heavy traders; 200
    concurrent event batches p95 < 50 ms, no lost rows; 5,000 viewers scored < 100 s; memory growth
    < 160 MB; 1,000 seeded viewers' feeds obey the caps on every window of 3 pages, joins included.
- **Acceptance:** 5 (heavy), 11 (heavy use: thousands of viewers scored per hour).
- PR-1 and PR-2 carry their own smaller heavy checks, so no budget goes unmeasured between PRs.

**Criterion 5 reads "nightly job".** The purge runs in the sync tick (item #7: every minute), which
deletes sooner than nightly; that satisfies the criterion's intent, and the tester reads it that way.

### Later stages (outlined; each needs H3 and its own committee round)

- **Stage 2, Bayesian:** per (viewer, trader) Beta-Bernoulli engagement with Thompson sampling in place
  of the seeded exploration; a serves table with positions and propensities returns only then, with the
  owner's go; a model-backed `ReasonWriter` behind one module with a 50-example eval file and the
  template fallback.
- **Stage 3, in-house model:** offline training, `trader_embeddings(trader_id, model_version, vector
  real[])`, the same serving path (re-rank → `diversify` → lower bound); acceptance = the eval pipeline
  and the guardrail tests (sign invariance, caps, copy scan).
- Co-visitation returns only with real-viewer data and k ≥ 5 distinct contributors per pair.

## 2. Hard stops

| # | Stop | Gates | Proceeds meanwhile | What the owner does |
|---|---|---|---|---|
| H1 | POLICY F1 says "no personalized suggestions" (IMPLEMENTATION conflict #2) | PR-5 merge | PR-1 to PR-4, PR-3b | After counsel answers, amend F1 (P1). |
| H2 | Counsel on the publisher's exclusion for F-2 (COMPLIANCE §2: before build) | PR-5 build (event log, logger, scoring) | PR-1 to PR-4, PR-3b | Send the packet in §7 (P2); record the answer in the F-2 file. |
| H3 | Stage 2 and 3: model key, eval, compute | Later stages only | everything in this plan | Answer P6 and P7 after stage 1 has run on real viewers. |
| H4 | Privacy Policy covers the new data (POLICY P6, COMPLIANCE §3) | Real (non-demo) viewers on PR-2 to PR-5; PR-5 build | the build of PR-1 to PR-4 | Add the §5 inventory to the Privacy placeholder (item #10). |

H5 (lost design decisions) was resolved on 2026-10-23 by the recorder's restore. `Status: built` is
not reachable before H1 and H2 clear, since criteria 1 (ranking), 2, 3, 4 (lowers similar) and 7
(personal reasons) need PR-5.

## 3. Owner questions (each blocks one slice; the build proceeds with the default)

| # | Question | Blocks | Default |
|---|---|---|---|
| O1 | Reject gesture placement, given SW-1 reserves left/right on feed cards | PR-4c only | Reject swipe on section rows only; feed cards unchanged |
| O2 | Keep or cut the profile row | PR-3b | Not built |
| O3 | Exclusion duration: 90 days or permanent ("the card is not shown again") | Nothing (one constant and its copy) | **90 days** (criterion 4's testable line; bounds an accidental swipe; keeps supply reach). The Undo line says "Hidden for 90 days."; the owner may change it, and the copy changes with the constant. |

## 4. Performance budgets

| Budget | Value | Where checked |
|---|---|---|
| Feed raw HTML | ≤ 500 KB per 30-card page, 50 distinct heavy traders | PR-1, PR-3, PR-6 |
| Signed-out feed server time | p95 < 400 ms at 500 traders | PR-1, PR-6 |
| Signed-in feed server time | p95 < 800 ms; scoring ≤ 10 ms per viewer | PR-5, PR-6 |
| Next page appended | requested 5 cards before the end; no visible wait at normal pace | PR-1 |
| Tap to feedback (like, follow, hide) | < 100 ms | PR-2, PR-4 |
| `/api/events` | p95 < 50 ms per batch of 50 | PR-5, PR-6 |
| Purge | ≤ 30 s per call under the lock; 4 M backlog drains within 10 ticks | PR-2 (small), PR-6 |
| Delete a trader referenced by 100,000 viewers | < 5 s, zero rows left | PR-2 (small), PR-6 |
| Profile with row | p95 +≤ 20 ms | PR-3b |

## 5. Personal data inventory (for the Privacy Policy, item #10)

| Data | Where | From | Who sees it | Deleted |
|---|---|---|---|---|
| Follows, exclusions | `follows`, `viewer_exclusions` | PR-2 | the viewer only (`/me/following`) | by the viewer; exclusions after 90 days (+1 day); account deletion, first step |
| Likes | `trade_likes` | PR-4 | the viewer only | by the viewer; account deletion |
| Explicit and implicit events | `discovery_events` | **PR-5 only** | nobody; the viewer's own ranking | 90 days (tick purge); account deletion |
| Trader holding and symbol features | `discovery_trader_features` | PR-5 | nobody (derived from public records) | rebuilt; trader deletion |

No behavioral event rows exist before PR-5. Signed out: nothing is stored. No third-party script,
tracker or cookie beyond the existing session cookie.

## 6. Pre-authorization requests still needed from the owner

| # | Request | Status | Needed before |
|---|---|---|---|
| P1 | Amend POLICY F1 (H1) | **Approved 2026-10-25**; text in `hardstops-resolution-business-lead.md` §1, owner applies it to POLICY | PR-5 merge |
| P2 | Counsel's opinion (H2) | **Owner sends** `counsel-request.md` (2026-10-25); answer pending | PR-5 build |
| P5 | Suggestion-copy word list in `scripts/compliance.ts` (`lib/copy.test.ts` enforces it meanwhile) | Open | PR-3 (not blocking) |
| P4 | Privacy text for §5 | Folded into item #10 | real viewers (H4) |
| P8 | Heavy suite in CI (`test:load` also runs the F-2 load test) | Folded into item #13 | PR-6 |
| P3 | Nightly schedule | Withdrawn: the purge rides item #7's tick | — |
| P9 | Playwright clock | Withdrawn: tests backdate `at` and `until` | — |

P6 and P7 (stage 2 and 3) belong to H3 and are asked later.

## 7. Counsel packet (H2), for the owner to send

1. Does ordering a feed of published, broker-sourced closed-trade records per viewer, by what the
   viewer read, followed and liked, keep the publisher's exclusion? The ordering never names a security
   to trade, and every reason line is a fact about the trader's record or the viewer's own actions.
2. Is reordering a viewer's own feed so that traders they chose to follow appear higher a "suggestion"
   at all, or a display preference the viewer set?
3. Is "Follow" on a trader acceptable if it never notifies or pushes and never shows a count?
4. Do any states treat behavior-based ordering of financial content as needing adviser registration, or
   as profiling with an opt-out duty? (If one does, the opt-out comes back as a setting.)
5. Does keeping 90 days of behavior events (§5) need consent beyond the Privacy Policy, given the
   financial context?
6. "Not interested" removes a trader from that viewer's feed (exclusions are honored on the signed-in
   feed). That is a viewer-chosen mute, not a ranking, but it makes the feed per-viewer before H2. Does a
   mute the viewer sets keep the exclusion?
7. Is a section of traders that is the same for every viewer, ordered by the published lower-bound
   method, with factual reason lines and no performance figures, the same class as today's feed? (PR-3's
   build does not wait on the answer; it is needed before real viewers see it.)

## 8. Policy checks (every PR)

- **No advice, no "buy X":** suggestions are traders and closed records; nothing per symbol; fixed,
  scanned templates; no "AI" label; no notification; no endorsement wording.
- **Likes and follows private:** no count on any page, pane, share card, OG image, `/pane-chart` or the
  trader's own `/me`; the trader is never told; reasons never cite another viewer.
- **Losses never hidden:** ranking reads only `abs(return_pct)` and the symmetric lower bound; sign
  invariance tested in PR-1, PR-3, PR-5. A hide removes a trader from one viewer's feed and suggestions
  at that viewer's request, never a trade on a profile (TR-1).
- **Works signed out:** feed, paging (no-JS link), section and profile row render without a session.
- **18+:** only attested, signed-in users store anything; no new sign-up path.
- **No celebration** on likes, follows or hides (F6).
- **Disclaimer:** section and profile rows carry no performance number; the pane they open carries the
  record and the disclaimer.
- **No completeness claims:** the end card says "End of today's feed."
- **Accessibility (A1):** every gesture has a button; `aria-pressed`; ≥ 44 px; visible focus; reduced
  motion; Undo is `role="status"`.

## 9. Compliance checklist (COMPLIANCE §1)

1. Performance: section and profile rows show no numbers; the pane carries the disclaimer; documented
   ordering; counsel before the personal half (H2).
2. Personal data: §5; nothing stored signed out; no event rows before PR-5; implicit logging only after
   H2 and H4; 90-day retention via the tick; deletion's first step; Privacy text via item #10.
3. Money: no points, rewards or anything convertible.
4. Email, push, SMS, tracking: first-party only, no third party, no session replay, no notifications.
5. User text: none new; reasons are templates.
6. Sign-up, age: unchanged.
7. Vendor or dependency: none.
8. Screen reader and keyboard: a button for every gesture, `aria-pressed`, `role="status"`, reduced motion.
9. Security: session-bound validated actions; events route (PR-5) same-origin, rate-limited, bounded;
   purge under the existing cron bearer and an advisory lock; cursors validated; handle pattern checked.
10. Claims: reasons true by construction (tested); no "AI picks"; no completeness claim on the end card.
11. Checkout: no.

## Sign-off

Business lead: SIGNED 2026-10-23 (round 2: "If A to E come back as written, I sign without another
debate round"; A to E applied as written, see `plan-round2-engineer.md` → Round 3).

Engineer: SIGNED 2026-10-23 (author; I would stake my name on building every PR as written).

Plan signed 2026-10-23. Build starts with PR-1.

SIGNED: business lead (round 2 condition met), engineer

## Amendment: PR-1b (2026-10-24, engineer; accepted by the business lead in committee PR-3 §5 before PR-4)

Appended; the signed text above is unchanged. PR-1b "exploration and reach" adds, for every viewer alike: (1) one best
recent close of each eligible trader outside the 200 candidates (at most `EXPLORE_EXTRA` = 150 per list, in an order
seeded by the UTC day) joins the exploration pool only, so exploration and the section reach every eligible trader;
the cursor admits offsets up to `FEED_LIST_MAX`; (2) the section puts traders with no card earlier in the list first,
each group in TR-9 lower-bound order, and gives its third row to the newest verified record with no evidence weight yet
(the "new record" slot: rows still read in non-increasing evidence); (3) a per-card discount at the head of the ranking
breaks the hyperactive traders' fixed 10-card cycle. Known limits: past 150 outside traders a day the rest wait for
another day's seed; a trader with no close in the last 14 days is reached only when the full pass runs; the outside
traders' weight-cache key is read from the recent window (a rebuild or a new close changes it); the new-record slot
gives way to the bucket cap. Owner decision O4 (unfollow as a small negative weight, never a hide) is not in PR-1b:
it changes the pinned section test for criterion 4 and belongs with PR-4's viewer-specific score.
