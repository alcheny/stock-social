# F-2 · Plan round 2 · Engineer

Date: 2026-10-23. Base: `claude/adoring-euler-4469ys` at `cbab4e6`, with the F-2 feature file as it stands
after the session recorder's restore (Decisions dated "restored 2026-10-23", two owner questions under
Open questions). Responds to `plan-round1-business-lead.md`. Read again: the F-2 file, DESIGN SW-1
(Stage 5.3, "Reserved gesture"), IMPLEMENTATION pre-authorization items #7, #10 and #13,
`app/api/sync/route.ts`, `lib/delete.ts`, `lib/feed.ts`, `db/schema.sql` (`closed_trades`).

This plan says how to build F-2. It changes no decision in the feature file and proposes no product code.
Nothing here is legal advice.

## 0. What changed since round 1, and the order of authority

1. **H5 is resolved by the record.** The four lost owner decisions are now in F-2 Decisions:
   - double tap = private like **+3**; swipe in the opening direction (to the pane, SW-1) **+2**; swipe in
     the other direction = reject **−4**, "and the card is not shown again";
   - likes are private (no count, no list, nothing on the profile or share card);
   - placement: a section in the feed **and** a row on the trader profile;
   - a suggestion opens the same pane as any feed card; the profile is one step further.
2. **Owner decisions outrank committee rulings.** Where the business lead's round-1 rulings conflict with
   a recorded owner decision, the decision wins and the ruling becomes the owner question the recorder
   already filed:
   - **O1 (open): the reject gesture.** The ruling "no reject gesture" conflicts with the owner's swipe.
     The plan keeps the swipe in the narrowest form that cannot collide with the profile-opening swipe
     (§3, PR-4) and keeps O1 open.
   - **O2 (open): the profile row.** The ruling "cut" conflicts with the owner's placement. The plan keeps
     the row as its own PR (PR-3b) that is not built until the owner answers O2.
3. **Every other ruling is applied** (they do not touch an owner decision): numbers off section rows, 3
   rows, a true signed-out heading, reasons without tickers or "You follow @x", no implicit logger before
   H2 and H4, and the deletions (serves tables, propensity logging, `viewer_affinities`, co-visitation,
   the trader-features table until the personal PR, "Not now", the settings switch). P3 and P9 are
   withdrawn; P4 folds into item #10 and P8 into item #13.
4. **The dependency bug is fixed.** Diversity, exploration and paging are PR-1, which imports nothing
   that reads one viewer's behavior.

**One reading I flag rather than decide:** "the card is not shown again" (owner) against criterion 4's
"removes that trader from the viewer's suggestions for 90 days". I build the criterion (a 90-day
exclusion, with "Show again" on `/me/following`) because it is the testable line and the owner set both.
If the owner meant "never", it is one constant (`EXCLUSION_DAYS`) and a test value. It travels with O1.

## 1. Hard stops

| # | Stop | Status | Blocks | Proceeds meanwhile | What the owner does |
|---|---|---|---|---|---|
| H1 | POLICY F1 says "no personalized suggestions" | Open (IMPLEMENTATION conflict #2) | PR-5 merge | PR-1 to PR-4, PR-3b | After counsel answers, amend F1, e.g. "no personalized suggestions of trades, securities or actions; suggestions of records to read follow F-2's guardrails". |
| H2 | Counsel on the publisher's exclusion for F-2 (COMPLIANCE §2: before build) | Open | PR-5 **build**, including the implicit logger | PR-1 to PR-4, PR-3b | Send the packet in §8 and record the answer in the F-2 file. |
| H3 | Stage 2 and 3 (model key, eval, compute) | Not needed for stage 1 | Later stages only | Everything in this plan | Answer P6 and P7 after stage 1 has run on real viewers. |
| H4 | Privacy Policy covers the new data (POLICY P6, COMPLIANCE §3) | Open | Real (non-demo) viewers using PR-2 to PR-5; PR-5 build of the implicit logger | The build of PR-1 to PR-4 | Add the §4 inventory to the Privacy placeholder already requested in item #10. |
| H5 | Lost design decisions | **Resolved 2026-10-23** by the recorder's restore | — | — | Nothing; answer O1 and O2 below. |

**Owner questions (not hard stops for the order; each blocks one slice):**

| # | Question (as filed in F-2 Open questions) | Blocks | Default if still open when the slice is reached |
|---|---|---|---|
| O1 | Where the reject swipe lives, given SW-1 reserves left/right on the feed | Nothing: PR-4 ships the non-colliding default (§3). Only the feed-card variant (PR-4c) waits | Reject swipe on section rows only; feed cards unchanged |
| O2 | Keep the profile row or cut it | PR-3b | Not built; nothing else depends on it |

`Status: built` is not reachable before H1 and H2 clear, because criteria 1 ("feed the ranking"), 2, 4
("lowers similar") and 7 (personal reasons) need PR-5. The status line will say so.

## 2. The PRs, in build order

Each ≤ the Gate's 800-line cap, about 2 days, tests written first and failing before the code. Schema is
additive and idempotent (`create table if not exists`, `schema_add_*`, `insert … on conflict do
nothing`); no `drop`, `truncate` or `delete from` in `db/schema.sql`. Every PR reads
`node_modules/next/dist/docs/` for the APIs it uses (server actions, route handlers, `after()`, caching)
before coding (AGENTS.md).

| # | PR | Criteria | Waits on |
|---|---|---|---|
| 1 | Feed mix and paging | 6, 8 (feed), 10 (feed) | nothing |
| 2 | Follow and "not interested" (−4) | 1 (private follow), 3, 4 (exclusion half), 5 | nothing to build; H4 before real viewers |
| 3 | The section, impersonal | 7 (impersonal reasons), 8 (section), 9, 10 | PR-1, PR-2 |
| 3b | The profile row | owner placement | **O2** |
| 4 | Likes, double tap, reject swipe | owner gesture decisions | PR-2, PR-3 (O1 only for 4c) |
| 5 | Implicit logger and personal scoring | 1 (ranking), 2, 4 (lowers similar), 7, 8, 11 | **H1, H2, H4** |
| 6 | Heavy use and the end-to-end matrix | 5 (heavy), 11 (heavy) | PR-5 (its PR-1/2 parts can run earlier) |

### PR-1 · Feed mix and paging · `autopilot/feature-2-feed-mix` · ~700 lines (≈ 55% tests) · waits on nothing

Impersonal and sign-neutral. **Imports nothing from any module that reads one viewer's behavior** (a test
greps the import graph of `lib/discovery/diversity.ts`, `explore.ts`, `pager.ts` and `app/page.tsx` for
`profile`, `score`, `events`, `follows`, `likes`).

**Modules (unit tests first):**
- `lib/discovery/diversity.ts`: `diversify(cards, { window: 10, maxPerTrader: 2, maxPerSymbol: 2 })`.
  - Greedy re-rank over the ranked list: take the highest card that keeps every 10-card window inside the
    caps. It never relaxes a cap: when the pool cannot fill a window, the list ends there.
  - With today's 3 demo traders the feed is 6 cards, then the end card (Q4 accepted by the business lead).
- `lib/discovery/explore.ts`: at least 2 of every 10 slots are exploration picks.
  - Impersonal definition: a pick from the eligible pool outside the top 30 by score, which includes
    "too early" records (evidence weight 0) that would otherwise never be seen.
  - Chosen with a seeded PRNG, seed = UTC day only (same for every viewer, signed in or out; per-viewer
    seeding comes with PR-5). A shared link reads the same all day.
  - Sign-neutral: the pool and the pick never read the sign of `return_pct`.
  - **No propensity is recorded** (deleted; it returns with stage 2).
- `lib/discovery/pager.ts`: pages of **30 cards**.
  - Cursor = `{ day, asOf, offset }`, base64url, ≤ 200 bytes, validated (bad or tampered cursor → page 1,
    never a 500).
  - `asOf` freezes the ranking clock: the candidate query uses `asOf` as "now" and `closed_at ≤ asOf`. So
    a trade closing between page 1 and page 2 cannot shift the order: **no card repeats or vanishes
    across pages** within a day's session.
  - Every page recomputes the same ranked, diversified, explored list (≤ `FEED_CANDIDATES` = 200
    candidates) and slices `[offset, offset + 30)`. Because pages are slices of one list, **the diversity
    window spans the page join by construction**: cards 25 to 34 are a window of the same list. This is
    stronger than carrying the last 9 trader ids in the cursor (§9, demand 7).
- `lib/feed.ts`: `feedCandidates({ ids, asOf })`. The `ids` eligibility filter also fixes the F-1
  shared-database e2e limit (the existing feed tests move to it; none is weakened).

**UI (`app/page.tsx`, a small client `app/feed-pager.tsx`):**
- **Auto-append, no tap to continue.** A sentinel 5 cards from the end (`IntersectionObserver`) fetches
  the next page through a server action that returns the next 30 server-rendered cards; they append in
  place, focus and scroll position untouched. One request in flight at a time; a failure shows one
  inline "Couldn't load more. Retry" button (≥ 44 px), never a blank.
- Without JS, the same sentinel is a plain `?after=<cursor>` link (the only place a "more" control exists).
- **The end card** (when the list ends): written by the UX lead, no completeness claim ("all", "every"),
  carries "Publish your trades" for traders (supply). Placeholder until then: "You're up to date."
- SW-1 behavior on appended cards is identical (the pane row, → and ←, the hint only once).

**Tests (first):**
- Unit, property (seeded, 1,000 generated feeds of 3 pages each): no trader or symbol more than twice in
  any 10 consecutive cards **including windows that span page joins**; at least 2 exploration picks in
  every full window; never a relaxed cap.
- Unit: cursor round-trip; tampered cursor → page 1; pages 1 to 3 concatenated equal the unpaged list;
  a trade inserted after `asOf` does not appear and moves nothing.
- Unit, **sign invariance**: negating every `return_pct` leaves the diversified order unchanged (the score
  reads `abs`).
- Unit: the import-graph test above.
- E2e (375 px, light and dark): scroll to card 25 → page 2 appends with no tap; card 30 to 31 is seamless;
  keyboard `↓` through the join; no-JS run uses the link; the end card renders with the demo fixture.
- E2e: **feed raw HTML ≤ 500 KB per page with 50 distinct heavy traders** in the fixture (the F-1 PR-3
  fixture, extended). At 30 cards × ~11.3 KB worst case ≈ 340 KB.
- Load (`LOAD=1`): signed-out server time **p95 < 400 ms** at 500 traders (heavy fixture), pages 1 to 3.
  If it misses, the fallback is the stored `closed_trades.feed_key` from round 1 (score order is
  time-invariant up to a shared term until the 3.3-year clamp), with an equivalence test against today's
  SQL. That would add one `schema_add_column` and one index, both additive.

### PR-2 · Follow and "not interested" · `autopilot/feature-2-follow` · ~750 lines · waits on nothing (H4 before real viewers)

**Schema:**
- `discovery_event_types(code smallint pk, name text unique)`, `discovery_surfaces(code smallint pk, name text unique)`,
  seeded with `insert … on conflict do nothing`. Lookup tables, not CHECKs (widening a CHECK needs a drop).
  - Surfaces: feed, pane, profile, section, me.
  - Types seeded in PR-2: **explicit only**: follow, unfollow, not_interested, not_interested_undo,
    share, watch, unwatch. PR-4 adds like, unlike. **Only PR-5 adds** impression, dwell_short,
    dwell_long, skip, swipe_open, profile_open.
  - Because `discovery_events.type` is a foreign key to this table, **an implicit event cannot be written
    before PR-5 inserts its type row**: the database refuses it, whatever the client sends.
- `discovery_events(id bigint identity pk, viewer_id int not null → users on delete cascade, at timestamptz not null default now(), surface smallint not null → discovery_surfaces, type smallint not null → discovery_event_types, target_kind text check in ('trader','trade','symbol'), target_user_id int → users on delete cascade, target_trade_key text, target_symbol text)`.
  - A check ties `target_kind` to exactly one target column.
  - Indexes: `(viewer_id, at)`, `(at)` for the purge, **`(target_user_id)` for the delete cascade** (§6).
- `follows(viewer_id → users cascade, trader_id → users cascade, created_at, pk (viewer_id, trader_id), check viewer_id <> trader_id)`, index `(trader_id)`.
- `viewer_exclusions(viewer_id → users cascade, trader_id → users cascade, until timestamptz, reason text check in ('not_interested','unfollow'), pk (viewer_id, trader_id))`, index `(trader_id)`.
- No serves tables, no `viewer_affinities`, no trader-features table (deleted, §9 demand 3).

**Code:**
- `lib/discovery/weights.ts`: the owner's weights pinned, one table, one test per value: like **+3**,
  opening swipe **+2**, reject / "not interested" **−4**, unlike retracts +3. My proposals (profile open +2,
  share +4, follow +5, symbol watched +3, dwell ≥ 8 s +1, 2 to 8 s +0.5, impression and skip 0) are marked
  `proposed` and go to the owner with O1. Nothing reads the table until PR-5; before that, the −4's effect
  is the exclusion below.
- `lib/discovery/events.ts` (pure): allow-list of types and surfaces, target shape, unknown keys rejected,
  ≤ 50 per batch, self-targeting dropped, time clamped to [now − 1 h, now].
- Server actions in `app/discovery-actions.ts`: `follow`, `unfollow`, `notInterested`,
  `undoNotInterested`. Each writes its row and its event in one transaction.
  - "Not interested" = **the single negative action**: the −4 event and a 90-day exclusion. The reject
    swipe in PR-4 calls this same action; there is no second negative type and no "Not now".
  - Unfollow writes the same 90-day exclusion (criterion 4) with reason `unfollow`.
- **Follow control** on the profile header and the pane: "Follow" / "Following", `aria-pressed`, ≥ 44 px,
  hidden on your own profile; signed out it links to `/login?next=…`. No count anywhere.
  - The privacy line appears **once**: the status after the first follow, "Following @x. Only you can see
    this." (`role="status"`), and on `/me/following`. Not under every button.
  - The pane header spacing fix (F-1 UX round 3, "Name@handle") ships here, since Follow goes there.
- **"Not interested in @x"** lives in a "…" menu **on section rows only** (PR-3 renders the rows; PR-2
  ships the action and the menu component). Never on feed cards. 5-second "Undo" (`role="status"`).
- `/me/following` (viewer only, `noindex`): Following, Not interested (with "Show again"). Liked records
  join it in PR-4.
- Existing watch actions and `share-button.tsx` emit `watch`/`unwatch` and `share` (explicit actions the
  viewer chose).
- Exclusions are honored on the signed-in feed (from PR-1's list, after diversity is recomputed on the
  filtered pool) and in the section. Never on a profile: "not interested" never hides a trade (TR-1).
- `lib/delete.ts#deleteProfile`: a **first step** before the vendor call deletes the viewer's
  `discovery_events`, `follows`, `viewer_exclusions` (and, from PR-4, `trade_likes`) in one transaction,
  so a vendor failure still leaves no behavioral data the same day. The cascade covers the rest,
  including other viewers' rows that reference a deleted trader.
- **The 90-day purge rides the existing scheduled tick** (item #7, every minute; demand 8):
  - `lib/discovery/purge.ts#purgeDiscovery({ deadline })`: deletes `discovery_events` with
    `at < now() − 90 days` in batches of 10,000 by id via the `(at)` index, then expired
    `viewer_exclusions`, until done or the deadline.
  - Called from `app/api/sync/route.ts` right after `purgeExpiredLinks()`, **only by the caller that wins
    `pg_try_advisory_lock(<purge key>)`**. That caller purges with its own deadline (≤ 240 s) and skips
    claiming traders this minute; overlapping callers skip the purge and sync as today. One caller's
    minute is the whole cost, and only when there is a backlog: at steady state (~2 M rows a day) about
    1,400 rows expire per minute, a few milliseconds.
  - Every read still filters `at > now() − 90 days`, so a late purge never changes a result.
  - **P3 withdrawn**: no new route, no new schedule. `lib/sync.ts` and `lib/connections.ts` untouched; the
    route gains two lines and the existing route test gains a case.

**Tests (first):**
- DB, criterion 3: `information_schema` column list of `discovery_events` is exactly the listed columns;
  a scan of generated rows finds no `@`, no run of 7+ digits outside ids, no account id, units or price.
- DB: an insert with an implicit type (impression, dwell, skip, swipe_open) **fails** with a foreign-key
  error; the seeded type set equals the explicit list (PR-5 extends the expected set when it adds rows).
- DB: follow/unfollow; unfollow and "not interested" exclude for 90 days (still excluded at 89 d 23 h
  59 m by backdated `until`, back at 90 d + 1 s); undo removes the exclusion; "Show again" works.
- DB: `follows` and `viewer_exclusions` are unreadable by every public query (render each public page and
  route, grep for follow data); no count on profile, pane, share card, OG image, `/pane-chart`.
- DB: the purge boundary at exactly 90 days; a batch resumes after a deadline; two concurrent callers →
  exactly one purges.
- DB: deletion as viewer and as trader → zero rows in every F-2 table; a failed vendor call still leaves
  zero discovery rows.
- E2e (375 px, light and dark, keyboard only): follow, unfollow, the first-follow status line,
  `/me/following`, signed-out tap goes to sign-in; deletion through `/settings` then every F-2 table is
  queried empty (criterion 5, same day).
- Unit: action input validation; handles validated against the pattern first (the F-1 NUL-byte 500).

### PR-3 · The section, impersonal · `autopilot/feature-2-section` · ~600 lines · waits on PR-1, PR-2

Owner placement: a section in the feed; a suggestion opens the pane. Same for signed in and signed out
until PR-5 (so criterion 10's "same section" holds by construction).

- **Position:** one full-height feed card at **position 6 of each 30-card page** (after the shared-link
  landing card and four more, so a shared link always opens on a trade). Inserted after diversity;
  section rows do not count toward the card caps but are checked against them (next bullet).
- **Rows: 3.** Candidates = PR-1's eligible pool minus traders in the 10 feed cards around the section,
  minus the viewer's own record, follows and exclusions (signed in), minus records still importing (F-1
  TR-3). Ordered by `rankTraders` with `weight = evidenceWeight(confidence(...))`: the TR-9 lower bound,
  symmetric in sign (criterion 8). Diversity across the 3 rows: distinct traders, at most 2 sharing a
  holding bucket. **Fewer than 3 candidates → the section is not rendered**, signed in or out alike.
- **A row** = name, badge (Verified / Demo / incomplete), **one reason line, no numbers of performance**,
  Follow, "…". Tapping the row, or the opening swipe (PR-4), opens the trader's pane as a sheet: the same
  pane component as a feed card (owner decision 4); the full profile is one step further, "See full
  profile →". The pane carries the record and the disclaimer it already has.
- **Heading:** signed out, and signed in before PR-5, a true impersonal heading. The UX lead writes it;
  placeholder "More verified records". "More like what you read" appears only in PR-5, and only for a
  viewer whose profile has at least one signal (otherwise the impersonal heading stays: never untrue).
- **Impersonal reasons** (templates in `lib/copy.ts`, one per row, each checked true against its inputs):
  - "Typical holding period: {under a day | 1 to 7 days | 1 to 4 weeks | 1 to 6 months | over 6 months}"
    (median `holding_days` bucket);
  - "Closed a record this week" (a close in the last 7 days);
  - "New here this month" (first close in the last 30 days).
  No ticker slot, no outcome, no other viewer, no "AI", no "Suggested", "Recommended", "Top", "Best".
- **Copy scan (criterion 9):** `lib/copy.test.ts` checks every template against `PROMO` plus
  `\b(buy|sell|hold|pick|signal|advice|price target)s?\b`. A first draft, "Usually holds 1 to 7 days",
  fails that regex ("holds"), which is why the template says "Typical holding period"; the test proves
  "holding period" passes and "hold"/"holds" fail. P5 (the rule in `scripts/compliance.ts`) remains the owner's.

375 px layout (full-height card, heading 1 line, rows ≈ 96 px, 3 targets per row = 9 on the card):

```
┌─────────────────────────────────────┐
│ More verified records               │
│─────────────────────────────────────│
│ @trader_a  [Verified]   [Follow] [⋯]│
│ Typical holding period: 1 to 7 days │
│─────────────────────────────────────│
│ @trader_b  [Demo]       [Follow] [⋯]│
│ Closed a record this week           │
│─────────────────────────────────────│
│ @trader_c  [Verified]   [Follow] [⋯]│
│ New here this month                 │
└─────────────────────────────────────┘
```

**Tests (first):**
- Unit: candidate filter (surrounding 10, self, follows, exclusions, importing); order equals
  `rankTraders` by `evidenceWeight`; sign invariance; a losing record is suggested exactly as a winning
  one of the same evidence; < 3 → null; every reason true against fixtures; template scan.
- E2e (375 px, light and dark, signed in and out): section at position 6, 3 rows, **no digit of a
  performance figure in any row** (regex on the row text for `%` and signed numbers), "…" present on rows
  and absent on every feed card; tapping a row opens the pane sheet; signed out no `/api/*` write.
- E2e: the demo fixture (3 traders) renders no section (all three are in the surrounding cards).
- Screenshots at 375 px, light and dark, signed in and out, attached to the PR's build log (demand 4).

### PR-3b · The profile row · `autopilot/feature-2-profile-row` · ~350 lines · **waits on O2**

Built only if the owner keeps the row. If O2 is answered "cut", the PR is dropped and nothing else
changes.

- Under the trade list on `/u/[handle]`: heading **"Similar holding periods"**, 3 traders whose median
  holding bucket equals this trader's, ordered by the TR-9 lower bound, each row with name, badge and its
  fact ("Typical holding period: 1 to 7 days"). No "Suggested", "Recommended", "You may also like",
  "Traders to follow", "Top" or "Best"; no performance numbers.
- The same for every viewer (item-to-item), so it works signed out and on a shared link; it is not a
  personalized suggestion and needs neither H1 nor H2.
- Data: one grouped query of median `holding_days` per eligible trader, cached for 1 hour with
  stale-while-revalidate (one computation per instance per hour, never on a request after warm-up). No new
  table. If PR-5 has merged first, it reads PR-5's trader features instead.
- Placed below the trader's own trades, never above, so the shared record comes first (the business
  lead's supply concern); the row is hidden when the trader has fewer than 5 closed trades.
- Tests: the row matches the bucket rule; identical for two viewers and signed out; profile p95
  regression ≤ 20 ms on the heavy fixture; copy scan; a handle with a NUL byte answers 404, not 500.
- What to measure (for the owner's O2 follow-up): the share of profile visits from a shared link that
  leave through the row, against the share that reach the end of the trade list.

### PR-4 · Likes, double tap and the reject swipe · `autopilot/feature-2-gestures` · ~650 lines · waits on PR-2, PR-3

**Likes (owner: double tap +3, private):**
- Schema: `closed_trades.trade_key` generated as `encode(sha256(sell_id::bytea), 'hex')` with an index
  (stable across rebuilds; no vendor id on event rows); `trade_likes(viewer_id → users cascade,
  trade_key, trader_id → users cascade, created_at, pk (viewer_id, trade_key))`, index `(trader_id)`;
  type rows `like`, `unlike`.
- Server actions `like`, `unlike` (row + event in one transaction). A like whose trade no longer exists
  after a rebuild is kept and ignored on read.
- **Double tap** on the trade card body (not on links, buttons or the pane chart): two taps within 300 ms
  and 24 px; `touch-action: manipulation`. Optimistic fill (a like is neither money nor a record), revert
  with a polite message on refusal. **No burst, no animation, no vibration, no count**; outline to
  filled. A like on a loss is the same as on a gain.
- The icon button on each card is the keyboard and screen-reader route ("Like. Only you can see likes.",
  `aria-pressed`, ≥ 44 px). Signed out: one inline line with a sign-in link.
- `/me/following` gains "Liked records".

**The reject swipe (owner: other direction −4), non-colliding default while O1 is open:**
- **Where:** section rows only. Feed cards keep SW-1 exactly: left opens the pane, right returns, right on
  a closed card does nothing.
- **How it cannot collide with the opening swipe:**
  - The two gestures are opposite directions on the same row, matching the owner's vocabulary (opening
    direction opens, the other rejects); no row has a meaning that a feed card gives the opposite
    direction.
  - Each section row is its own native horizontal scroll-snap container (no gesture library, like SW-1):
    `[reject tray | row | open sentinel]`, resting on the row, `scroll-snap-stop: always` on the row so a
    fling can never pass from one end to the other.
  - The recognizer arms only on a touch that **starts on a row at rest**: not while a pane sheet is open,
    and not within 400 ms after one closes (the pane's return swipe cannot carry into a reject).
  - Direction lock: horizontal travel ≥ 2× vertical, or the feed scrolls vertically as today.
  - Commit only past 50% of the row width; below it, the row snaps back and nothing is written.
- **What it does:** calls PR-2's `notInterested` (one negative action: the −4 event and the 90-day
  exclusion), collapses the row, shows the 5-second "Undo". The "…" menu's "Not interested" is the button
  equivalent (A1).
- **PR-4c (only if O1 answers "on feed cards too"):** a `[reject tray | card | pane]` row on feed cards
  with `scroll-snap-stop: always` on the card, the same arming rules, and an owner amendment of DESIGN
  SW-1's "Reserved gesture" first. About 150 lines. Not built otherwise.
- **If O1 answers "menu only":** the gesture half is removed (about 120 lines); the action, the −4 and
  the menu stay.

**Tests (first):**
- Unit: tap timing (299 ms likes, 301 ms doesn't; a tap on a link or the chart is not a like); the
  reject recognizer (49% snaps back, 51% commits; a touch starting while a pane is open, or 399 ms after
  it closes, never commits; a diagonal over the lock ratio scrolls vertically).
- DB: a like re-attaches after `rebuildTrades` by `trade_key`; `trade_likes` unreadable by every public
  query and absent from the profile, pane, share card and OG image.
- E2e with touch emulation (375 px): double tap likes once, a vertical swipe never likes; **a horizontal
  swipe on a feed card still opens the pane and never writes an exclusion**; on a section row the opening
  swipe opens the pane sheet and writes no exclusion; the reject swipe writes exactly one
  `not_interested` and the row is gone; Undo restores it; swipe right to close a pane, then immediately
  swipe right again on the row beneath → no reject.
- E2e: no `impression`, `dwell_*`, `skip` or `swipe_open` request is ever sent (route interception), so
  the opening swipe is not logged before PR-5.

### PR-5 · Implicit logger and personal scoring · `autopilot/feature-2-personal` · ~780 lines · waits on H1, H2, H4

Written only after H2 is recorded as cleared (COMPLIANCE §2: before build); merged only after H1.

**Implicit logger** (`app/discovery-log.tsx`, client, signed in only):
- Inserts the type rows impression, dwell_short, dwell_long, skip, swipe_open, profile_open.
- Buffered queue, `sendBeacon` every 10 s and on `pagehide`, ≤ 50 per batch, never on a tap's critical
  path. Impression: 60% visible for 500 ms, once per card per page view. Dwell as buckets (2 s, 8 s), not
  numbers. Skip: under 1 s, weight 0. Swipe-open: once per row per page view (feed cards and section
  rows).
- `app/api/events/route.ts`: signed in only (signed out 204, nothing stored), same-origin, one batch per
  2 s per session, one multi-row insert, unknown or deleted target dropped.
- Signed out: not mounted; no identifier, cookie or local storage for logging.

**Scoring (pure, `lib/discovery/profile.ts`, `score.ts`, `reasons.ts`):**
- `viewerProfile(events, follows, likes, watchlist, exclusions, now)` computed **on read** from the last
  90 days (≤ 2,000 most recent events by `(viewer_id, at)`). Decayed affinity per trader (half-life 30
  days); symbol and holding-bucket vectors weighted by that affinity; "not interested", reject and
  unfollow put −4 on that trader's symbols and buckets ("lowers similar records"). Never reads the sign or
  size of a return. If measured p95 > 10 ms per viewer, `viewer_affinities` returns (the business lead's
  condition).
- `discovery_trader_features(user_id pk → users cascade, symbols text[], hold_buckets real[5], updated_at)`
  returns here (the business lead's "comes back in the personal PR"), refreshed in the purge caller's
  tick for traders synced since `updated_at`, never inline on a public read.
- `relevance(v, t) = direct + 0.6·cos(symbols) + 0.6·cos(holding) + follow bonus`. **No co-visitation.**
- Feed: card score × (1 + 0.5·relevance) → `rankTraders` → `diversify` → exploration (seed = viewer id +
  UTC day). Section: relevance picks the top 20, the TR-9 lower bound orders them, followed traders are
  not candidates.
- Personal reasons (templates, scanned, no ticker slot): "Similar holding period to @x" (x a trader the
  viewer follows or liked, same bucket); "Trades symbols on your watchlist"; "Trades symbols you read";
  "New to you" (exploration, no event from this viewer on that trader in 90 days). Removed: "You follow
  @x" and every ticker list.
- `ReasonWriter` seam: a function parameter, deterministic by default; a throw, a timeout over 300 ms, a
  banned word or a digit absent from the input falls back to the template (criterion 11). No model in
  stage 1.

**Tests (first):** cold start (only exploration and impersonal reasons, impersonal heading); one signal;
many signals (10,000 events); a viewer who reads only losing records gets the same slate shape and
losses are suggested; **sign invariance** of relevance and exclusions; follow raises a trader;
"not interested" lowers a similar trader; two viewers get different slates and see none of each other's
data; signed out gets the impersonal one; the writer forced to fail shows templates; 5,000 viewers × 500
candidates scored in < 50 s on one core (≤ 10 ms per viewer).

### PR-6 · Heavy use and the end-to-end matrix · `autopilot/feature-2-heavy` · ~500 lines · waits on PR-5

**Fixture (`LOAD=1`):** 500 traders (12 heavy at 10,000 activities, the rest 50 to 500); 5,000 viewers ×
500 events (2.5 M live); **4 M expired events** (older than 90 days, the 2-day backlog at 2 M a day);
**one trader referenced by 100,000 viewers** (100,000 follows, 300,000 events, 100,000 exclusions,
10,000 likes), generated with `generate_series`.

**Asserts, with budgets:**
- **Purge: one `purgeDiscovery` call removes all 4 M expired rows** before its deadline (target < 120 s
  measured, hard limit 240 s), touches zero live rows, and resumes cleanly if cut.
- **Deleting the trader referenced by 100,000 viewers completes in < 5 s and leaves zero rows** in
  every F-2 table (cascade cost, not only correctness; relies on the `target_user_id` and `trader_id`
  indexes from PR-2 and PR-4). Fallback if it misses: the deletion's first step removes the references in
  50,000-row batches before the user row goes, same transaction budget.
- Signed-out feed p95 < 400 ms; signed-in p95 < 800 ms; raw HTML ≤ 500 KB on every page with 50 distinct
  heavy traders; 200 concurrent event batches p95 < 50 ms, no lost rows; 5,000 viewers scored in < 100 s;
  memory growth < 160 MB.
- Generated-feed diversity: 1,000 seeded viewers, caps checked on every 10-card window of 3 pages,
  including the joins.

PR-1 and PR-2 each carry their own heavy checks for what they add (HTML bound and signed-out p95; purge
and deletion on a smaller fixture), so the budgets are never unmeasured between PRs.

### Later stages (outlined; each needs H3 and its own committee round)

- **Stage 2, Bayesian:** per (viewer, trader) Beta-Bernoulli engagement, Thompson sampling instead of the
  seeded exploration. Brings back what it needs and only then: a serves table with positions and
  propensities (deleted from stage 1), with the owner's go. A model-backed `ReasonWriter` through one
  module with a 50-example eval file and the template fallback.
- **Stage 3, in-house model:** offline training, `trader_embeddings(trader_id, model_version, vector
  real[])`, the same serving path (re-rank → `diversify` → lower bound). Its acceptance criteria are the
  eval pipeline and the guardrail tests (sign invariance, caps, copy scan).
- Co-visitation returns only with real-viewer data and k ≥ 5 distinct contributors per pair.

## 3. Why this reject default, in one paragraph

The owner chose a swipe; SW-1 reserves left/right on feed cards for the profile. The default puts the
reject swipe where no profile-opening swipe already lives with another meaning (section rows, which have
no SW-1 pane row of their own), keeps the owner's direction pair (opening direction opens, the other
rejects), and makes accidental commits physically hard (arming only at rest, a 400 ms guard after a pane
closes, a 50% threshold, a snap stop, a 5-second Undo). It writes the same single negative action as the
menu, so the business lead's "one negative action" holds. Feed cards are not touched unless the owner
answers O1 and amends SW-1.

## 4. Personal data inventory (for the Privacy Policy, item #10)

| Data | Where | From | Who sees it | Deleted |
|---|---|---|---|---|
| Explicit actions (follow, unfollow, not interested, undo, share, watch, like) | `discovery_events` | PR-2, PR-4 | nobody in the product; the viewer's own ranking from PR-5 | 90 days (tick purge); account deletion, first step |
| Implicit behavior (impression, dwell bucket, skip, opening swipe, profile open) | `discovery_events` | **PR-5 only** | nobody; the viewer's own ranking | same |
| Follows, likes, exclusions | `follows`, `trade_likes`, `viewer_exclusions` | PR-2, PR-4 | the viewer only (`/me/following`) | by the viewer; exclusions at 90 days; deletion |
| Trader holding and symbol features | `discovery_trader_features` | PR-5 | nobody (derived from public records) | rebuilt; trader deletion |

Signed out: nothing is logged. No third-party script, tracker or cookie beyond the existing session cookie.

## 5. Policy checks (kept exactly from round 1, demand §10.10, with the deletions applied)

- **No advice, no "buy X":** suggestions are traders and closed records; nothing per symbol; fixed,
  scanned templates; no "AI" label; no notification; no endorsement wording.
- **Likes and follows private:** no count on any page, pane, share card, OG image, `/pane-chart` or the
  trader's own `/me`; the trader is never told; reasons never cite another viewer; co-visitation removed.
  Tests render each public surface and grep for like and follow data.
- **Losses never hidden:** ranking reads only `abs(return_pct)` and the symmetric lower bound; personal
  features never read the sign (invariance test, PR-1, PR-3, PR-5). "Not interested" and the reject swipe
  hide a trader from one viewer's feed and suggestions on that viewer's request; never a trade on a
  profile (TR-1).
- **Works signed out:** feed, paging (no-JS link), section and profile row render without a session.
- **18+:** only attested, signed-in users are logged; no new sign-up path.
- **No celebration** on likes, follows or rejects (F6).
- **Disclaimer:** section rows and profile rows carry no performance number; the pane they open carries
  the record and the disclaimer it already has.
- **Accessibility (A1):** every gesture has a button (Like, "…" → Not interested, row tap opens the pane);
  `aria-pressed`; ≥ 44 px; visible focus; reduced motion snaps; Undo is `role="status"`.

## 6. Performance budgets

| Budget | Value | Where checked |
|---|---|---|
| Feed raw HTML | ≤ 500 KB per 30-card page, 50 distinct heavy traders in the fixture | PR-1 e2e, PR-6 |
| Signed-out feed server time | p95 < 400 ms at 500 traders | PR-1 load, PR-6 |
| Signed-in feed server time | p95 < 800 ms, scoring ≤ 10 ms per viewer | PR-5, PR-6 |
| Next page appended | requested 5 cards before the end; no visible wait at normal swipe pace | PR-1 e2e |
| `/api/events` | p95 < 50 ms per batch of 50 | PR-5, PR-6 |
| Tap to feedback (like, follow, reject) | < 100 ms (optimistic icon or row collapse) | PR-2, PR-4 e2e |
| Viewers scored | ≥ 5,000 per hour per instance (measured ~180,000) | PR-5, PR-6 |
| Purge | 4 M expired rows in one call (< 240 s), resumable; steady state milliseconds per minute | PR-2 (small), PR-6 |
| Delete a trader referenced by 100,000 viewers | < 5 s, zero rows left | PR-2 (small), PR-6 |

## 7. Pre-authorization requests

| # | Request | Status | Needed before |
|---|---|---|---|
| P1 | Amend POLICY F1 (H1) | Open, owner | PR-5 merge |
| P2 | Counsel's opinion (H2, packet §8) | Open, owner; send now, in parallel with PR-1 to PR-4 | PR-5 build |
| P3 | Nightly schedule | **Withdrawn**: the purge rides item #7's tick | — |
| P4 | Privacy text for §4 | **Folded into item #10** | real viewers (H4) |
| P5 | Suggestion-copy word list in `scripts/compliance.ts` | Open, owner; `lib/copy.test.ts` enforces it meanwhile | PR-3 (not blocking) |
| P6 | Stage 2 go and model key | Later | stage 2 |
| P7 | Stage 3 compute | Later | stage 3 |
| P8 | Heavy suite in CI | **Folded into item #13** (`test:load` also runs `lib/discovery.load.test.ts`) | PR-6 |
| P9 | `playwright.config.ts` clock | **Withdrawn**: tests backdate `at` and `until` in the DB fixture | — |

No new dependency, no new vendor, no protected path touched by PR-1 to PR-6 (item #7's route is not
protected; `.github/`, `package.json`, `playwright.config.ts`, POLICY and `scripts/compliance.ts` are not
edited).

## 8. Counsel packet (H2), updated for the owner to send

1. Does ordering a feed of published, broker-sourced closed-trade records per viewer, by what the viewer
   read, followed and liked, keep the publisher's exclusion? The ordering never names a security to
   trade, and every reason line is a fact about the trader's record or the viewer's own actions.
2. **(New)** Is reordering a viewer's own feed so that traders they chose to follow appear higher a
   "suggestion" at all, or a display preference the viewer set?
3. Is "Follow" on a trader acceptable if it never notifies or pushes and never shows a count?
4. Do any states treat behavior-based ordering of financial content as needing adviser registration, or
   as profiling with an opt-out duty? (If one does, the opt-out comes back as a setting; it is not built
   by default.)
5. Does keeping 90 days of behavior events (§4) need consent beyond the Privacy Policy, given the
   financial context?

Removed: the round-1 question on ticker names in reason lines; no reason line names a symbol any more.

## 9. Response to the business lead's 8 demands

| # | Demand | Answer | Where |
|---|---|---|---|
| 1 | Move diversity and exploration out of the blocked scoring PR into PR-1 | **Accepted.** PR-1 holds `diversify`, `explore`, `pager`; an import-graph test proves it reads nothing per viewer. | PR-1 |
| 2 | Reorder; the implicit logger waits on H2 and H4 | **Accepted with change.** Order is PR-1 feed mix and paging → PR-2 follow and not interested → PR-3 section → PR-4 likes and gestures → PR-5 logger and scoring → PR-6 heavy, plus PR-3b waiting on O2. The logger is PR-5, built only after H2 and H4; the guarantee is structural (the implicit type rows do not exist before PR-5, so the foreign key refuses the insert), plus an e2e that no implicit request is sent. The change: the "section swipe logs `swipe_open`" check moves to PR-5, since logging it earlier would break this demand. | §1, PR-2, PR-4, PR-5 |
| 3 | Delete serves tables, propensity, `viewer_affinities`, co-visitation, trader features, the profile row, "Not now", the settings switch, P9 | **Accepted** for serves, propensity, `viewer_affinities` (returns only if read-time profile p95 > 10 ms), co-visitation, "Not now", the settings switch and P9. Trader features **accepted** for stage 1's early PRs; it returns in PR-5, as the business lead's own table allows. **Declined: the profile row**, because the owner's recorded placement includes it; it is PR-3b, not built until the owner answers O2, written to the business lead's wording rule (§2.5) and placed below the trader's own trades. | PR-2, PR-3b, PR-5 |
| 4 | No reject gesture; −4 on "Not interested"; a section swipe opens the pane | **Accepted with change.** −4 on "Not interested": accepted, PR-2, as the single negative action. Opening swipe on a section row opens the pane: accepted. **"No reject gesture": declined**, because the owner decided a reject swipe; the plan builds it only on section rows, in the non-colliding form of §3, calling the same "Not interested" action, with feed cards left exactly as SW-1 has them. O1 stays open; a "menu only" answer removes ~120 lines and nothing else. | PR-2, PR-4, §3 |
| 5 | Section rows without numbers, 3 rows, "…" on section rows only, a true signed-out heading | **Accepted.** 3 rows; name, badge, one reason, Follow, "…"; no performance number (e2e regex); "…" absent on every feed card (e2e); impersonal heading for signed out and for signed in before PR-5, and for any viewer with no signal after it. The change: the 375 px screenshots are a PR-3 build-log deliverable, since there is nothing to screenshot before it is built; the wireframe is in PR-3 above. | PR-3 |
| 6 | Reasons without tickers and without "You follow @x" | **Accepted.** Template lists in PR-3 (impersonal) and PR-5 (personal), no ticker slot, scanned; "Usually holds" became "Typical holding period" because the scan's `holds` match would fail it. Counsel question 2 is removed accordingly. | PR-3, PR-5, §8 |
| 7 | Paging: auto-append and the diversity window across the page join | **Accepted with change.** Auto-append at 5 cards from the end, no tap, the link only without JS. The window across the join is guaranteed by construction instead of by carrying the last 9 ids: each page is a slice of one list ranked with a frozen `asOf` and the day seed, so a window spanning the join is a window of the diversified list. The 1,000-feed property test checks the join windows explicitly. | PR-1 |
| 8 | Add H5; P3 and P9 withdrawn; P4 and P8 folded into items #10 and #13 | **Accepted, H5 now resolved.** H5 was real; the recorder restored the four decisions on 2026-10-23, so it is listed as resolved, and its two residual disagreements are O1 and O2. P3 withdrawn (purge in item #7's tick under an advisory lock, 4 M rows in one call tested); P9 withdrawn; P4 → #10; P8 → #13. | §1, §7 |

**Also from §10:** item 9 (counsel packet) is §8; item 10 (keep the policy checks and the sign-invariance
test exactly) is §5 and the invariance tests in PR-1, PR-3 and PR-5.

## 10. Risks

- **Legal:** if counsel says no to personalization, PR-5 does not ship and F-2 is the mixed feed, the
  impersonal section, private follows, likes and the reject action. Everything before PR-5 stands alone.
- **The reject swipe and SW-1:** the default is narrow, but the owner may still read the section as "the
  default feed". The cost of either O1 answer is bounded (§2 PR-4).
- **Thin supply:** the section is not rendered with fewer than 3 eligible traders outside the surrounding
  cards, and the feed ends at 6 cards with today's demo data. Honest, but short until supply grows.
- **Event volume:** ~2 M rows a day at 10,000 active viewers; one table with a batched purge is fine at
  the target. Partition by day (dropped by the purge, not `schema.sql`) when the purge slice exceeds its
  budget; marked `ponytail:`.
- **Feed query cost:** `feedCandidates` scans recent closed trades per request; three pages mean three
  scans per session. Measured in PR-1; `feed_key` is the fallback.
- **Next.js version:** each PR reads `node_modules/next/dist/docs/` for server actions returning
  rendered components, route handlers, `after()` and caching before writing code.

## 11. Compliance checklist (COMPLIANCE §1)

1. **Performance:** the section and profile row show no performance numbers; the pane carries the record
   and the disclaimer; ordering is the documented method (lower bound, abs); counsel before the personal
   half (H2).
2. **Personal data:** §4; nothing logged signed out; implicit logging only after H2 and H4; 90-day
   retention via the tick; deletion's first step; Privacy text via item #10.
3. **Money:** no points, rewards or anything convertible.
4. **Email, push, SMS, tracking:** first-party events only, no third party, no session replay, no
   notifications.
5. **User text:** none new; reasons are templates.
6. **Sign-up, age:** unchanged; only attested users are logged.
7. **Vendor or dependency:** none.
8. **Screen reader and keyboard:** a button for every gesture, `aria-pressed`, `role="status"`, focus,
   reduced motion.
9. **Security:** actions session-bound and validated; the events route (PR-5) same-origin, rate-limited
   and bounded; the purge runs under the existing cron bearer; cursors validated; handle pattern checked.
10. **Claims:** reasons true by construction (tested); no "AI picks"; no completeness claim on the end card.
11. **Checkout:** no.

## Sign-off

Engineer: proposes this plan for round 2. I would stake my name on building every PR as written. I sign
a version that keeps the owner's reject swipe (in the §3 form until O1 is answered) and the profile row as
a PR waiting on O2, because those are owner decisions; everything else in the business lead's critique is
applied.
