# F-2 · Plan round 1 · Engineer

Date: 2026-10-23. Base: `claude/adoring-euler-4469ys` at `0c7b4e1` (F-1 built, PRs #11, #15, #16, #17).
Read: CLAUDE.md, POLICY, COMPLIANCE, DESIGN (§2.6, §2.8, §3.4, Stage 5), DECISIONS, IMPLEMENTATION, F-2, the
F-1 plan and its round files, and the F-1 follow-ups that touch the feed, pane and swipe (review-pr3, the UX
lead's committee round 3, the tester's re-run 5). Also read the code F-2 touches: `lib/feed.ts`, `app/page.tsx`,
`app/pane.tsx`, `app/feed-keys.tsx`, `lib/trades.ts#evidenceWeight/rankTraders`, `lib/delete.ts`,
`app/api/sync/route.ts`, `db/schema.sql`.

This plan says how to build F-2. It does not change any decision in the feature file. It proposes no
product code. Where the brief I was given goes beyond the feature file (gesture weights, private likes),
I flag it for the owner (§9, Q1). The build waits on two hard stops (§1). Nothing here is legal advice.

## 1. Hard stops (the committee cannot clear these; only the owner, and counsel, can)

| # | Stop | Source | What it blocks | What the owner does |
|---|---|---|---|---|
| H1 | POLICY F1 says "no personalized suggestions" in so many words. F-2 *is* a personalized suggestion of records. The reviewer reads POLICY as written. | POLICY F1; IMPLEMENTATION "Conflicts" #2 (still open) | Merging any F-2 PR that computes or shows personalized suggestions (PR-1, PR-4b). | Amend the F1 wording (owner-only file). For example: "no personalized suggestions of trades, securities or actions; suggestions of records to read follow F-2's guardrails". |
| H2 | Counsel decides where the publisher's-exclusion line sits for F-2, state by state. "Any new ranking, label, badge, alert or suggestion goes to counsel before build if it could be read as a recommendation." | COMPLIANCE §2 (table, Procedures), §13 Securities row; IMPLEMENTATION's decision that legal gates are not phase gates | Building the personalized surfaces: PR-1 scoring, and PR-4b (the signed-in section, the personalized feed order, reason lines). | Get counsel's opinion on the questions in §8, or record that counsel cleared the "records to read" design. |
| H3 | Stage 2 (Bayesian) and stage 3 (in-house model) wait on the owner's say-so. A model call needs a key (a secret) and an eval file. | IMPLEMENTATION hard stop 7; POLICY H; DESIGN §2.8 AI rule | PR-6 and PR-7 only. Stage 1 needs no model and no key. | Answer pre-authorization requests P6 and P7 (§7). |
| H4 | The Privacy Policy has to describe the new behavioral data (events, likes, follows, the 90-day retention) before any non-demo viewer uses F-2. | POLICY P6; COMPLIANCE §3 Procedures (a privacy-policy diff for every new field) | Turning F-2 on for real users. It does not block the build. | Update the Privacy placeholder with the data inventory in §4. |

**If H1 and H2 are not cleared,** the non-personalized PRs still build in this order: PR-2, PR-3a, PR-3b,
PR-4a, PR-5 (its impersonal half). None of them suggests anything per viewer:
- the event log, follows, likes and "not interested" are the viewer's own choices;
- diversity and exploration apply to the same public feed for everyone;
- the profile row is item-to-item: every viewer sees the same row on the same profile.

PR-1 and PR-4b are written only after H1 and H2 are cleared. PR-1 is first in dependency order because
everything that ranks per viewer depends on it. It goes first in time only if H1 and H2 are already
cleared when the build starts.

## 2. The PRs, in dependency order (each ≤ about 2 days and ≤ the Gate's 800-line cap)

### PR-1 · Stage 1 deterministic scoring (pure, no DB, no UI) · `autopilot/feature-2-scoring` · ~750 lines (60% tests) · waits on H1, H2

**Modules (unit tests first):**
- `lib/discovery/weights.ts`: the signal weights in one table, as constants:
  - double-tap like **+3**, swipe-open **+2**, swipe-reject **−4** (from the brief, §9 Q1);
  - proposed for the owner: profile open +2, share +4, follow +5, symbol watched +3 (symbol affinity),
    dwell ≥ 8 s +1, dwell 2 to 8 s +0.5;
  - impression 0 (a denominator only); a quick skip under 1 s is 0 (logged so stage 2 can learn its weight);
  - unlike retracts the +3 (it is not a negative).
  - Half-life 30 days, inside the 90-day window. A test pins every value, so a change is one reviewed line.
- `lib/discovery/profile.ts`: builds the viewer profile from their signals.
  - `viewerProfile(signals, now)`: decayed affinity per trader; a symbol vector and a holding-period vector
    (buckets ≤ 1 d, 1 to 7, 7 to 30, 30 to 180, > 180 days), weighted by that affinity, plus watchlist symbols.
  - "Not interested" and unfollow put **−4 on that trader's symbols and buckets**. That is how they "lower
    similar records".
  - Never reads the sign or size of any return.
- `lib/discovery/score.ts`: scores each candidate trader for the viewer.
  - `relevance(v, t) = direct + 0.6·cos(symbols) + 0.6·cos(holding) + 0.4·covisit + follow bonus`.
  - Co-visitation counts a pair only when **≥ 5 distinct viewers** contribute, and each viewer contributes
    at most once per pair. So nobody's private like or follow can be inferred, and five throwaway accounts
    can't buy visibility (F5).
  - The viewer's own record, excluded traders (90 days) and records still importing (the F-1 TR-3 rule) are
    never candidates.
  - **The section order uses `rankTraders` with `weight = evidenceWeight(confidence(...))`.** That is the
    TR-9 pace-interval lower bound, symmetric in sign, already used by the feed. Relevance picks the top 20
    candidates; the lower bound orders them. Never raw averages (criterion 8).
- `lib/discovery/diversity.ts`: `diversify(cards, { window: 10, maxPerTrader: 2, maxPerSymbol: 2 })`.
  - A greedy re-rank that keeps every 10-card window within the caps.
  - When the eligible pool can't fill a window, the feed ends (an honest "You've reached the end"). It never
    relaxes the cap. With today's 3 demo traders the feed would be 6 cards (§9 Q4).
- `lib/discovery/explore.ts`: at least 2 of every 10 slots go to traders with no signal from this viewer.
  - The choice uses a seeded PRNG (seed = viewer id and UTC day; signed out, the day alone). So a page is
    reproducible for a test, and a shared link reads the same all day.
  - It records the propensity (the chance that pick had) for stage 2 and 3.
  - Exploration is sign-neutral, and it is how "too early" records (weight 0) get seen at all.
- `lib/discovery/reasons.ts`: one reason per suggestion, from fixed templates in `lib/copy.ts`, in this order:
  - "You follow @x"
  - "Similar holding period to @x" (only when the median holding days fall in the same bucket)
  - "Trades symbols on your watchlist: AAA, BBB"
  - "Trades symbols you read: AAA"
  - "New to you" (exploration)
  - Each reason is checked to be true against its inputs.
  - Reasons never mention outcomes ("because you read losing trades" is impossible by construction), never
    cite another viewer, never say "AI".
- `ReasonWriter` interface: injected, deterministic by default. A model-backed writer is PR-6. Any throw,
  timeout over 300 ms, banned word or digit not present in the input falls back to the template.

**Tests:**
- Cold start: no signals gives only exploration and impersonal reasons.
- One signal; many signals (10,000 events).
- A viewer who reads only losing records gets the same slate shape, and losses are suggested.
- **Sign invariance:** negating every `return_pct` leaves relevance and the exclusions identical.
- Diversity on 1,000 generated feeds (property test, seeded): no trader or symbol more than twice in any 10;
  at least 2 exploration slots in every full window.
- Exclusion exactly at 90 days (still excluded at 89 d 23 h 59 m, back at 90 d + 1 s).
- Unfollow equals "not interested".
- The fallback when the writer throws, is slow, or returns banned text.
- Every template is checked against `PROMO` plus `\b(buy|sell|hold|pick|signal|advice|price target)s?\b`.
  The `\b` matters: "holding period" must pass and "hold" must fail.
- 5,000 viewers × 500 candidates scored in under 50 s on one core (budget 10 ms per viewer).

### PR-2 · Event log, rollups, deletion, nightly purge · `autopilot/feature-2-events` · ~750 lines

**Schema** (idempotent `schema_add_*` and `create table if not exists`; no drop, truncate or `delete from`
in `db/schema.sql`):
- `closed_trades.trade_key`, generated as `encode(sha256(sell_id::bytea), 'hex')`, with an index.
  - A trade's stable key across rebuilds. Event rows carry no vendor activity id (no brokerage data).
  - Likes and events re-attach like theses do. A key with no current trade is kept and ignored on read.
- `discovery_event_types(code smallint pk, name text unique)` and `discovery_surfaces(code smallint pk, name text unique)`.
  - Seeded with `insert … on conflict do nothing`.
  - Lookup tables, not CHECKs: widening a CHECK needs a drop and re-add, which CI forbids (the
    `referred_surface` precedent). Stage 2 and 3 add a row; nothing is migrated or dropped.
  - Surfaces: feed, pane, profile, section, profile_row, trade_page, ticker_page.
  - Types: impression, dwell_short, dwell_long, skip, swipe_open, swipe_reject, profile_open, like, unlike,
    share, follow, unfollow, watch, unwatch, not_interested, not_interested_undo.
- `discovery_events(id bigint identity, viewer_id int not null → users on delete cascade, at timestamptz not null default now(), surface smallint → discovery_surfaces, type smallint → discovery_event_types, target_kind text check in ('trader','trade','symbol'), target_user_id int → users on delete cascade, target_trade_key text, target_symbol text)`.
  - A check ties `target_kind` to exactly the one target column it uses.
  - Indexes: `(viewer_id, at)` and `(at)` (for the purge).
  - **Criterion 3:** a test asserts the table's column list is exactly this one (`information_schema`). Another
    scans generated rows for `@`, a run of 7+ digits outside ids, and any account id, units or price.
- `discovery_serves(id, viewer_id → users cascade, at, surface, ranker text)` and
  `discovery_serve_items(serve_id → cascade, pos smallint, target_user_id → users cascade, target_trade_key, explore boolean, propensity real)`.
  - What was shown, where, by which ranker. Stage 2 and 3 need this to correct for position and exploration.
  - In a separate table, so the event row stays exactly criterion 3's fields (§9 Q6).
  - Child rows, not jsonb, so deleting a trader cascades.
- `viewer_affinities(viewer_id → cascade, kind text check in ('trader','symbol','hold'), trader_id → users cascade, symbol, bucket smallint, score real, last_at, unique (viewer_id, kind, trader_id, symbol, bucket) nulls not distinct)`.
  - Derived. Rebuilt from the 90-day event window by `rebuildAffinities(viewer)`, the same raw-in,
    derived-out rule as `closed_trades`. Also upserted per event for speed.
  - So implicit signals forget after 90 days.
- `viewer_exclusions(viewer_id, trader_id, until, reason check in ('not_interested','unfollow'))`, PK on (viewer_id, trader_id).
- `follows(viewer_id, trader_id, created_at, pk, check viewer_id <> trader_id)` and
  `trade_likes(viewer_id, trade_key, trader_id → cascade, created_at, pk (viewer_id, trade_key))`.
  - Explicit choices. They stay until the viewer removes them; their raw events still go at 90 days.
  - Both are private: no public query reads them (§5).

**Code:**
- `lib/discovery/events.ts` (pure validation):
  - types and surfaces from the allow-list; target shape;
  - unknown keys rejected; at most 50 events per batch;
  - self-targeting dropped;
  - timestamps clamped to [now − 1 h, now].
- `app/api/events/route.ts` (POST):
  - signed in only; signed out is a 204 with no write and nothing stored;
  - same-origin check; `minInterval`, one batch per 2 s per session;
  - one multi-row insert plus the affinity upserts in one transaction; 204;
  - an event naming a deleted or unknown trader is dropped.
- `lib/delete.ts`: `deleteProfile` deletes the viewer's discovery rows in its **first** step, before the
  vendor call. A vendor failure that leaves the user row marked for the retry still leaves no events, so
  "the same day" holds even then. The cascade covers the rest, and others' events about a deleted trader.
- `app/api/discovery/nightly/route.ts` (POST, `Bearer $CRON_SECRET`, `maxDuration` 300):
  - deletes `discovery_events` and serves older than 90 days in batches of 10,000 by id, until a deadline;
  - deletes expired exclusions; refreshes trader features (PR-4a);
  - re-runs the discovery delete for any `deleted_at` user.
  - `lib/sync.ts`, `lib/connections.ts` and `/api/sync` stay untouched.
  - Until the owner schedules it (P3), every read filters `at > now() − 90 days`, so stale rows never
    influence anything.

**Tests:**
- DB: the purge boundary at exactly 90 days; a batch resumes after the deadline.
- DB: deletion as viewer and as trader, then zero rows in all eight tables. A failed vendor call still
  leaves zero events.
- DB: the column-list and personal-data assertions; ingest rejects a bad type, kind or key.
- E2e: sign in, generate events, delete through `/settings`, then query every table. Same day, end to end
  (criterion 5).

### PR-3a · Follows, private likes, "not interested" (server and controls) · `autopilot/feature-2-controls` · ~650 lines

- **Server actions:** `follow`, `unfollow`, `like`, `unlike`, `notInterested`, `undoNotInterested`. Each writes
  its table and its event in one transaction. Unfollow and "not interested" write the 90-day exclusion.
- **Follow:**
  - "Follow" / "Following" (`aria-pressed`, ≥ 44 px) on the profile header and in the pane;
  - one line under it: "Only you can see who you follow.";
  - hidden on your own profile;
  - signed out, it links to `/login?next=…`; there is no count anywhere.
- **Like:** a small outline-to-filled icon button on each trade card ("Like, only you can see this"),
  `aria-pressed`. It is the keyboard and screen-reader route to what the double tap does.
  - **No burst, no animation, no vibration, no count** (F6, §3.4: no celebration on real trades).
  - Liking a loss is the same as liking a gain.
- **"Not interested in @x":** in a small "…" menu on section rows and feed cards.
  - A 5-second "Undo" (`role="status"`).
  - `/me/following` lists Following, Liked records and Not interested (with "Show again"). Viewer only, `noindex`.
- **Watchlist and share:** the existing watch actions and `share-button.tsx` emit `watch`/`unwatch` and `share` events.
- **Tests:**
  - Unit: action input validation.
  - DB: exclusion expiry; a like re-attaches after a rebuild (by `trade_key`); the like table is unreadable
    by any public query.
  - E2e at 375 px, light and dark, keyboard only:
    - follow, unfollow, like, unlike, "not interested", undo;
    - signed-out taps go to sign-in;
    - nothing changes on the public profile or the share card.

### PR-3b · Gestures and the client event logger · `autopilot/feature-2-gestures` · ~600 lines

- `app/discovery-log.tsx` (client, once per page): a buffered queue.
  - It flushes with `sendBeacon` every 10 s and on `pagehide`, at most 50 events per batch; it never blocks a tap.
  - Impressions: once per card per page view, when 60% of the card is visible for 500 ms (`IntersectionObserver`).
  - Dwell: `dwell_short` at 2 s and `dwell_long` at 8 s visible. A bucket, not a number, so the event row
    keeps criterion 3's fields.
  - `skip`: the card leaves view under 1 s.
  - Signed out, the logger is not mounted. No identifier, cookie or local storage is used for logging.
- **Double tap to like:** on the trade card body, not on links, buttons or the pane chart.
  - Two taps within 300 ms and 24 px of each other; `touch-action: manipulation` stops the double-tap zoom.
  - Optimistic: the icon fills at once. It reverts with a polite message if the server refuses (a like is
    not money or a record, so optimistic UI is safe).
  - Signed out: one inline line, "Sign in to keep likes. Only you see them.", with a link.
  - Reduced motion changes nothing, because there is no motion.
- **Swipe-open +2:** the pane is 60% visible after a horizontal scroll, or opened with →, or with the pane
  button. Once per row per page view. SW-1 is unchanged.
- **Swipe-reject −4:** the default this plan builds is a horizontal swipe on a **suggestion row inside the
  "More like what you read" section** (not a feed row). It dismisses the row ("Not now"), with a visible
  "Not now" button as the keyboard equivalent.
  - The default feed's left/right stays reserved for the profile (SW-1 "Reserved gesture").
  - Alternatives for the owner: §9 Q2.
- **Tests:**
  - Unit: tap timing (two taps 299 ms apart like; 301 ms apart don't; a tap on a link is not a like) and the
    queue (dedupe, batch cap, flush on hide).
  - E2e with touch emulation: double tap likes once; a vertical swipe never likes; a horizontal swipe still
    opens the pane, with the hint behaviour unchanged.
  - The pane open logs exactly one `swipe_open`.
  - Signed out, no `/api/events` request is made (route interception).

### PR-4a · Feed placement and the profile row, impersonal half · `autopilot/feature-2-placement` · ~700 lines

- `discovery_trader_features(user_id pk → cascade, symbols text[], hold_buckets real[5], evidence_weight real, closes int, eligible boolean, source_synced_at, updated_at)`.
  - Refreshed by the nightly route, and for any trader whose `users.last_synced_at` is newer than
    `updated_at`, at most 50 per feed request in the background (`after()`), never inline on a public read.
  - Missing features: that trader gets impersonal treatment, never an error.
- **Feed** (`app/page.tsx`, ranking still in `lib/feed.ts`):
  - candidates → existing score and `rankTraders` → `diversify` → exploration slots (day-seeded);
  - the same for everyone signed out.
- **Page size 30 cards with "Show more" (`?after=<cursor>`, works without JS).** The next page prefetches 5
  cards from the end. The reason: diversity raises the number of distinct traders per page, and the F-1
  re-run measured 564 KB raw at 50 distinct heavy traders, over the 500 KB bound. At 30 cards the worst case
  is about 340 KB (30 × ~11.3 KB).
- **The section** is one feed row at position 4, then every 15 cards. It is a full-height card with up to 5
  trader rows, each with: name, badge (Verified, Demo, or the incomplete line), the TR-9 line, a reason, Follow
  and "…".
  - A vertical list, not a carousel, so it never fights the feed's horizontal swipe.
  - Signed out: the same section, ordered by the lower bound with diversity, reason "Recent record" (wording
    for the UX lead).
- **The profile row:** "Similar records" under the trade list, 3 traders by item-to-item similarity
  (symbols plus holding period).
  - The same for every viewer, so it works signed out and on a shared link. It carries the disclaimer the
    page already has.
- **Tests:**
  - Unit: cursor round-trip and stable order across pages.
  - E2e: signed out, the section is present, no personal data, and the 10-card caps hold on the real page.
  - The feed's raw HTML is ≤ 500 KB with 30 distinct heavy traders (the fixture from F-1 PR-3).
  - The existing feed e2e tests move to `feedCandidates({ ids })` eligibility. This fixes the F-1
    shared-database known limit; no test is weakened.

### PR-4b · Personalized feed and section, signed in · `autopilot/feature-2-personal` · ~550 lines · waits on H1, H2

- Signed in: `viewerProfile` from `viewer_affinities`, follows, likes, watchlist and exclusions (one query
  each, by index).
  - Then `relevance` → feed card score × (1 + 0.5·relevance) → `rankTraders` → `diversify` → exploration.
  - The section is "More like what you read", with reasons.
  - One `discovery_serves` row with its items per render.
- **Caching:** the shared candidate and feature reads are the same for every viewer. Only the re-rank is per
  viewer (≤ 10 ms). An explicit action (follow, like, "not interested") takes effect on the next render.
- A settings switch, "Personalize my feed" (§9 Q5): off means the signed-out ranking and no logging.
- **Tests:**
  - E2e: cold start, one like, many signals, a losing-only reader; unfollow removes that trader for 90 days
    (with a clock); exclusions honoured on the feed and the section; reasons true and scanned.
  - E2e: model writer forced to fail, so template reasons show.
  - The page shows no other viewer's data. Two viewers get different slates; a signed-out viewer gets the
    impersonal one.

### PR-5 · Heavy use and the end-to-end matrix · `autopilot/feature-2-heavy` · ~500 lines

- **Fixture (`LOAD=1`):**
  - 500 traders: 12 heavy at 10,000 activities each, the rest 50 to 500;
  - 5,000 viewers × 500 events (2.5 M events), 30% of them older than 90 days.
- **Asserts, with budgets:**
  - The purge removes exactly the old rows within one 300 s call, or resumes cleanly.
  - 200 concurrent event batches: p95 < 50 ms, no lost rows.
  - 50 concurrent signed-in feeds: server p95 < 800 ms; signed out p95 < 400 ms.
  - Raw HTML ≤ 500 KB on every page.
  - 5,000 viewers scored < 100 s (≥ 5,000 per hour on one instance, with margin).
  - Deleting 100 viewers and 10 traders leaves zero rows behind.
  - Memory growth < 160 MB.
- **If the signed-out p95 misses:** the fallback is a stored `closed_trades.feed_key`.
  - Score order is time-invariant: `ln ln(1+|r|·100) + closed_at/48 h` differs from today's score only by a
    term shared by every row, until the 3.3-year clamp.
  - So the candidate query becomes an index scan. An equivalence test runs against today's SQL on the fixture.
- **Generated-feed diversity:** 1,000 seeded viewers, caps checked on every 10-card window of 3 pages.

### Later stages (outlined only; each needs H3 and its own committee round)

- **PR-6 · Stage 2, Bayesian.**
  - Per (viewer, trader) Beta-Bernoulli engagement (successes = weighted positives, trials = impressions,
    prior from the trader's global rate).
  - Thompson sampling replaces the seeded exploration. Propensities are logged.
  - Model-backed `ReasonWriter` (Claude, through one module, typed input, schema-validated output, a
    50-example eval file, template fallback).
  - No schema change beyond inserting rows into the lookup tables.
- **PR-7 · Stage 3, in-house model.**
  - Offline training on `discovery_events` plus `discovery_serve_items` (inverse-propensity weighted).
  - An added `trader_embeddings(trader_id, model_version, vector real[])`. The serving path is the same:
    re-rank, then `diversify`, then the lower-bound order.
  - The eval pipeline and the guardrail tests (sign invariance, caps, copy scan, k ≥ 5) are its acceptance
    criteria (F-2 Open questions).

## 3. Acceptance criteria → PR → test

| F-2 criterion | PR | Test (kind) |
|---|---|---|
| 1 Follow/unfollow from profile and pane, private, feeds ranking | 3a, 4b | e2e follow/unfollow; DB "no public query reads `follows`"; e2e followed trader ranks higher (E, D) |
| 2 "More like what you read" from own events | 2, 4b | e2e: events from viewer A change A's section only (E) |
| 3 Event fields only, no personal or brokerage data | 2 | exact column list; generated-row scan (D) |
| 4 "Not interested" 90 days + lowers similar; unfollow same | 1, 3a, 4b | 90-day boundary (U); similar trader drops (U); e2e with clock (E) |
| 5 Nightly 90-day purge; deletion same day | 2, 5 | purge boundary (D); delete via `/settings` → zero rows in 8 tables (E); heavy purge (L) |
| 6 ≤ 2 per trader/symbol in any 10; ≥ 2 of 10 exploration | 1, 4a, 5 | property test on 1,000 generated feeds (U); real page (E); 1,000 viewers (L) |
| 7 Plain-words reason per suggestion | 1, 4b | reason truth checks (U); visible on every section row (E) |
| 8 Losses same rules; lower-bound order | 1, 4a | sign invariance (U); order equals `rankTraders` by `evidenceWeight` (U); losing record suggested (E) |
| 9 No banned words in suggestion copy | 1 | template scan in `lib/copy.test.ts` (U); scanner rule needs P5 |
| 10 Signed-out non-personalized version | 4a | e2e signed out: section and feed present, no `/api/events` call (E) |
| 11 Cold start, one, many, losing-only, heavy, model failure | 1, 4b, 5 | the named cases (U, E, L) |
| Brief: double-tap +3, swipe-open +2, swipe-reject −4, private likes | 1, 3a, 3b | weights pinned (U); gesture e2e (E); like privacy (D, E) |

## 4. Personal data inventory (COMPLIANCE §3, for the Privacy Policy diff)

| Data | Where | Who sees it | Deleted |
|---|---|---|---|
| Behavior events (type, surface, target, time) | `discovery_events` | nobody in the product; the viewer's own ranking | 90 days (nightly); account deletion, first step |
| What was shown | `discovery_serves`, `discovery_serve_items` | nobody | 90 days; deletion |
| Derived affinities | `viewer_affinities` | nobody | rebuilt from the 90-day window; deletion |
| Follows, likes, exclusions | `follows`, `trade_likes`, `viewer_exclusions` | the viewer only (`/me/following`) | by the viewer; exclusions at 90 days; deletion |

Signed-out visitors: nothing is logged. There is no third-party script, tracker or cookie beyond the
existing session cookie.

## 5. Policy checks built into the design

- **No advice and no "buy X":**
  - the suggestions are traders and closed records;
  - nothing is suggested per symbol;
  - the reasons are fixed templates, scanned;
  - no "AI" label;
  - no notification (out of scope);
  - copy never says "suggested for you" in a way that implies endorsement (UX lead's wording).
- **Likes and follows stay private:**
  - no count on any page, pane, share card, OG image, `/pane-chart` response or the trader's own `/me`;
  - the trader is never told;
  - co-visitation needs k ≥ 5 viewers, and reasons never cite other viewers.
  - Tests render each public surface and grep for like or follow data.
- **Losses never hidden:** the ranking reads only `abs(return_pct)` and the sign-symmetric lower bound, and
  the personal features never read the sign (invariance test). "Not interested" hides a trader from *one
  viewer's suggestions* on that viewer's request. It never hides a trade on the profile (TR-1).
- **Works signed out:** the feed, section and profile row render without a session and without JS (the
  section is server-rendered).
- **18+:** only attested, signed-in users are logged and personalized; there is no new sign-up path.
- **No celebration** on likes or follows (F6).
- **Disclaimer:** the footer is already on every page; the section and row add none of their own numbers
  beyond the TR-9 line.
- **Accessibility (A1):** every gesture has a button; `aria-pressed`; ≥ 44 px; visible focus; reduced motion;
  the undo uses `role="status"`.

## 6. Performance budgets

| Budget | Value | Where checked |
|---|---|---|
| Feed raw HTML | ≤ 500 KB per page (30 cards), worst case 30 distinct heavy traders | PR-4a e2e, PR-5 |
| Signed-out feed server time | p95 < 400 ms at 500 traders / heavy fixture | PR-5 |
| Signed-in feed server time | p95 < 800 ms, of which scoring ≤ 10 ms | PR-5 |
| `/api/events` | p95 < 50 ms per batch of 50; never on the tap's critical path | PR-5 |
| Tap to visual feedback (like, follow) | < 100 ms (optimistic icon) | PR-3b e2e |
| Viewers scored | ≥ 5,000 per hour on one instance | PR-1 unit, PR-5 |
| Nightly purge | 1 M expired rows in one 300 s call, resumable | PR-5 |

## 7. Pre-authorization requests (owner answers once, before the build)

| # | Request | Needed before | Why |
|---|---|---|---|
| P1 | H1: amend POLICY F1 | PR-1, PR-4b merge | the reviewer fails F-2 against the current wording |
| P2 | H2: counsel's opinion (questions in §8) | PR-1, PR-4b build | COMPLIANCE §2 |
| P3 | A nightly schedule for `POST /api/discovery/nightly` (deploy settings) | before Status: built | the 90-day purge; reads filter by date meanwhile |
| P4 | Privacy Policy placeholder text for §4 | before real viewers | POLICY P6 |
| P5 | Add the suggestion-copy word list to `scripts/compliance.ts` (protected) | PR-1 | criterion 9 says "scanner rule"; until then a repo test enforces it |
| P6 | Stage 2: the owner's go and a model key (test mode) | PR-6 | IMPLEMENTATION stop 7; POLICY H |
| P7 | Stage 3: training compute and where the model runs (no new vendor assumed) | PR-7 | Standing direction 3 |
| P8 | Request #13 (`test:load` in `package.json`, CI job) also runs `lib/discovery.load.test.ts` | PR-5 | heavy use checked automatically |
| P9 | `playwright.config.ts` (protected): the `webServer` env for the e2e clock and the event route | PR-3b | only if a config change proves necessary; specs avoid it otherwise |

No new dependency and no new vendor for stage 1.

## 8. Questions for counsel (H2), drafted for the owner

1. Does ordering a feed of published, broker-sourced trade records per viewer, by what the viewer read and
   followed, keep the publisher's exclusion? The ordering never names a security to trade.
2. Does a reason line naming the viewer's own watchlist symbols ("trades symbols on your watchlist: AAA")
   read as a recommendation about that security?
3. Is "Follow" on a trader acceptable if it never notifies or pushes, and never shows a count?
4. Do any states treat behavior-based ranking of financial content as needing adviser registration, or as
   profiling with an opt-out duty? Is the settings switch (Q5) enough?
5. Does keeping 90 days of behavior events need consent beyond the Privacy Policy, given the financial context?

## 9. Open questions for the business lead (and the owner where marked)

- **Q1 (owner):** the gesture weights (+3, +2, −4) and private likes came in my brief but are not in F-2's
  Decisions. The owner records them in the feature file (owner-only) before PR-1. The other weights in
  PR-1 are my proposals.
- **Q2 (owner):** where the swipe-reject gesture lives. This plan builds (c).
  - (a) A quick flick past a feed card. No gesture conflict, but noisy: −4 on an implicit skip punishes fast
    readers. I'd log it at 0 and let stage 2 learn it.
  - (b) A right swipe on a feed card with the pane closed. This breaks SW-1's "Reserved gesture", a DESIGN
    Must, so it needs the owner's change to DESIGN.
  - (c) The default: a swipe on a section row, plus a "Not now" button.
- **Q3:** "profile row". I read it as the impersonal "Similar records" row plus the Follow control. If the
  owner meant a personalized row on profiles, it moves to PR-4b and waits on H2.
- **Q4:** thin supply. The diversity caps make a 3-trader demo feed 6 cards long. The default is to end the
  feed honestly and never relax the cap. The business lead should know the first impression shortens until
  supply grows.
- **Q5:** a "Personalize my feed" switch in settings, on by default. Cheap, privacy-positive, and probably
  what counsel asks for. It needs the business lead's yes.
- **Q6:** criterion 3 lists the event fields "only". Stage 2 and 3 need position, ranker and propensity, so
  they live in `discovery_serves` and its items, not on the event row. The business lead confirms this
  reading.
- **Q7:** page size 30 instead of 50. It keeps the 500 KB bound under diversity. It also answers the F-1
  owner item (564 KB at 50 distinct traders).

## 10. Risks

- **Legal:** the H1 and H2 stops are real. If counsel says no to personalization, PR-1 and PR-4b don't
  ship, and F-2 becomes the impersonal half plus private follows and likes. Everything else is built so
  that it still stands.
- **Event volume:** about 2 M rows a day at 10,000 active viewers. A single table with a batched purge is
  fine at the target. Partition by day (dropped by the purge script, not `schema.sql`) when the purge
  exceeds 300 s. Marked `ponytail:`.
- **Feed query cost:** today `feedCandidates` scans every closed trade per request (about 2.5 M rows at
  500 heavy traders). PR-5 measures it; `feed_key` is the fix if needed.
- **Gaming visibility:** sybil accounts and co-visitation. Mitigated by k ≥ 5, one contribution per viewer
  per pair, attested accounts only, and the lower bound still ordering.
- **Gesture conflicts:** double tap against the pane chart's scrub (excluded from the target); double tap
  against zoom (`touch-action`).
- **F-1 follow-ups F-2 touches:**
  - Pane header "Name@handle" runs together (UX round 3, item 3). PR-3a adds Follow there, so it fixes the
    spacing in the same PR.
  - NUL-byte handles answer 500 on `/u/[handle]/*` routes. PR-3a's actions validate the handle pattern first,
    and PR-4a's profile row shares that guard.
  - Shared-database e2e flakiness: fixed in PR-4a (above).
  - Feed over 500 KB at 50 distinct traders: Q7.
  - The pane-chart route rate limit: unchanged, out of scope.
- **Next.js version:** AGENTS.md warns this Next.js differs from what we know. Each PR reads
  `node_modules/next/dist/docs/` for route handlers, `after()`, caching and server actions before coding.

## 11. Compliance checklist (COMPLIANCE §1)

1. **Performance:** yes. The section and row show the TR-9 line; the disclaimer is on every page; the
   ranking is the documented method (lower bound, abs); no endorsement wording. Counsel: H2.
2. **Personal data:** yes. §4 lists the fields; nothing is logged signed out; 90-day retention; deleted
   with the account in the first step; Privacy diff P4.
3. **Money:** no. No points, rewards or anything convertible.
4. **Email, push, SMS, tracking:** first-party event logging only, no third party, no session replay; no
   notifications.
5. **User text:** none new. Reasons are templates.
6. **Sign-up, age:** unchanged. Only attested users are logged.
7. **Vendor or dependency:** none for stage 1. Stage 2's model call goes through one module (P6).
8. **Screen reader and keyboard:** buttons for every gesture, `aria-pressed`, `role="status"` undo, focus,
   reduced motion.
9. **Security:** the events route is same-origin, session-bound, rate-limited and bounded; the nightly
   route uses the cron bearer; handle validation.
10. **Claims:** the reasons are true by construction (tested); no "AI picks"; no completeness claims.
11. **Checkout:** no.

## Sign-off

Engineer: proposes this plan for round 1. I will sign a version that keeps §1 (hard stops) and §5 (policy
checks) intact.
