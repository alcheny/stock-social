# F-2 · Finalizing PR-5 (event log, logger, personal scoring) and PR-6 (heavy use) · Round 1, engineer

Date: 2026-10-25. Role: engineer (read only; this file is the only edit). Inputs: `plan.md` (PR-5a/5b, PR-6, §4, §5),
the F-2 feature file (Decisions to 2026-10-25, criteria 1 to 11 and G1 to G6), POLICY F1 as amended (`bcaac14`),
`hardstops-resolution-business-lead.md` §2 and §3, `hardstops-resolution-engineer.md`, `build-pr4-engineer.md`,
`plan-guardrails.md` (PR-7: G1, G3, G4; PR-8: G2, G5, G6; owner answer Q1), and the code on
`claude/peaceful-dirac-33bucv` (PR-4 with its fix round 2). I did not read the business lead's or the UX lead's round-1
files; the merge round reconciles the three. Nothing here is legal advice.

## 0. Position in one paragraph

Since the plan was signed, G3 took the implicit signals off the table for real viewers. Of the explicit signals, every
one except "share" already lives in a state row the viewer chose: `follows`, `trade_likes`, `trade_rejects`,
`viewer_exclusions` (not interested, unfollow notes) and `ticker_watches`. **So PR-5 should score from those rows and
build no event table at all.** That means no explicit-only log, and no implicit logger behind G3 that no real viewer
would ever run. This stores the minimum (POLICY P3). It adds no table to delete, reset, purge or disclose. It changes no
schema. It shrinks PR-5 from ~1,100 product lines to ~500, still split in two so that half of it can build now,
alongside PR-7 and PR-8. The implicit logger becomes a deferred **PR-5c**, planned only when the owner lifts G3. The
cost: the owner must restate criteria 2, 3 and 5 (§9), "share" carries no weight, and the owner's +2 for the opening
swipe stays dormant (it already is under G3).

| PR | Builds | Product lines | Test lines | Waits on |
|---|---|---|---|---|
| **5a** Personal scoring, pure | trader features, viewer profile, relevance, reason choice, proposed weights; new pure files only, wired to nothing | ~260 | ~420 | PR-4 landed |
| **5b** Personal ordering, wired | the viewer's signal reads, feed and section ordering, personal reasons and heading, G1 and G2 hooks, copy | ~250 | ~480 | 5a, PR-7, PR-8, the Privacy PR |
| **6** Heavy use | the `LOAD=1` fixture and asserts, re-based on state rows | 0 (fallbacks ≤ 60) | ~450 | 5b |
| ~~5a as planned~~ | event log, lookup tables, emitters, `/api/events`, logger, event purge | dropped | | |
| **5c** (deferred) | implicit logger behind PR-7's `mayRecord` / `usableTypes` | ~300 when planned | | the owner lifting G3 (counsel Q4, Q5), its own plan round |

## 1. What is built, what is dropped, and why

| Plan item | Now | Why |
|---|---|---|
| `discovery_events`, `discovery_event_types`, `discovery_surfaces` | **Dropped** | Every explicit signal but share is already a state row with `created_at` (and `until` for hides and notes). Copying each one into a log would keep the same fact twice. It would also add a table to deletion, Reset (PR-8's T2.4 registry), the purge and the Privacy text, and decide no ranking the rows can't decide. |
| Emitters in the PR-2 and PR-4 actions, watch and share | **Dropped** | Nothing to emit into. "Unlike retracts +3" and "undo ends −4" happen by themselves, because the row is gone or ended. |
| Implicit logger `app/discovery-log.tsx`, `POST /api/events` | **Deferred to PR-5c** | G3 keeps it off for real viewers. Built behind PR-7's gate, it would run only for demo accounts, which are ours, so it would measure nothing about real reading. ~300 lines nobody runs is cost with no learning. PR-7's `IMPLICIT_SIGNALS`, `mayRecord`, `usableTypes` and static guard T3.3 stay exactly as planned and are what 5c must use. |
| Event purge (4 M backlog) | **Dropped** | No events. The existing purge already removes ended hides and notes. |
| `discovery_trader_features` table, refreshed in the tick | **Dropped** | `lib/feed.ts#weights` already parses every counted close's symbol and holding days per trader at `asOf`, and caches the result per trader fingerprint. The features (top 16 symbols, a 5-bucket holding histogram) come out of that same pass and live in the same cache, at about 200 bytes per trader, or ≤ 4 MB at the cache's 20,000 cap. That means no table, no tick job and no stale features. |
| `viewerProfile`, relevance, personal reasons, heading, `ReasonWriter` seam | **Built** (5a pure, 5b wired) | Criteria 1, 4 (lowers similar), 7, 8, 11. |
| Per-viewer exploration seed (viewer id + UTC day) | **Dropped** | Keeping the day seed for everyone keeps "Signed out, everyone gets the same documented order" simple. A switched-off viewer gets `kept.mixed` exactly (PR-7 T1.1), and the shared list cache stays shared. Personalization comes from the re-rank only. |
| "Trades symbols you read", "New to you" reasons | **Dropped** | Both need implicit reading data, so under G3 neither can be shown true. |
| "share" as a signal | **No weight** | Sharing writes no state row. Weighting it needs an event row. PR-5c can add it. |
| PR-6 | **Kept, re-based** | The same budgets, with the event volumes replaced by signal-row volumes (§6.3). |

## 2. Data model

**No schema change in PR-5a, PR-5b or PR-6.** Every read is of existing tables:

| Read (5b) | Statement | Bound |
|---|---|---|
| `lib/likes.ts#likesAt(viewer, asOf)` | `trade_likes l join closed_trades t on t.trade_key = l.trade_key where l.viewer_id = ${viewer} and l.created_at <= asOf and l.created_at > asOf − 180 d order by l.created_at desc limit 500`. Returns trader, `created_at`, symbol and holding days. A like on a trade a rebuild removed drops out of the join, so it is ignored on read, as today. | ≤ 500 rows, index `closed_trades(trade_key)` (PR-4) |
| `lib/follows.ts#followsAt(viewer, asOf)` | `select trader_id, created_at from follows where viewer_id = ${viewer} and created_at <= asOf order by created_at desc limit 200` | ≤ 200 rows, pk |
| `lib/watches.ts#watchedAt(viewer, asOf)` (new file) | `select symbol from ticker_watches where user_id = ${viewer} and created_at <= asOf`. `last_seen_at` is never read: it is implicit (G3). | `WATCH_CAP` |
| Exclusions and rejects | the reads `loadFeedPage` already makes (`exclusionsFor`, `rejectsFor`) | unchanged |
| Features of followed or hidden traders outside the list | one grouped read of public records at `asOf` (`group by grouping sets ((user_id, symbol), (user_id, bucket))`, ≤ 21 rows per trader). It is impersonal and names no viewer table. | ≤ 200 traders |

Each signal read uses only rows with `created_at ≤ asOf`. So a like, follow or watch made after page 1 enters at the
viewer's next page 1, the PR-2 demand-B rule.

**Paging bound after a removal (stated, not stored).** An unlike, an unfollow or a rebuild that drops a liked trade,
made mid-session, deletes a row the list at `asOf` was built from. A later page can then repeat or skip a card. This is
the same bound `plan-guardrails.md` §4 accepted for Reset and the switch: the pager already drops repeats
(`feed-pager.tsx`, `shown`), and the next page 1 is exact. I looked at the alternative, keeping ended rows a day
(`trade_likes.ended_at`, `viewer_exclusions.followed_at`, ~45 lines). It would make "Unlike deletes it at once" in the
Privacy text false and store a removal history. As in PR-7 and PR-8, data minimization outweighs a one-time reorder.
5b's tests assert that no rendered card is duplicated after a mid-session unlike and unfollow.

**Additive fallbacks, only if a budget misses** (each with an equivalence test against the on-read result):
`schema_add_index('trade_likes_viewer_created', … (viewer_id, created_at desc))`, already PR-8's optional index; an
in-memory relevance memo per `(viewer, day, asOf)` (no schema); `discovery_trader_features` as the plan wrote it.

## 3. How the signals become the relevance score

### 3.1 Inputs and weights

`WEIGHTS` in `lib/discovery/weights.ts` stays byte for byte, because `lib/discovery/exclusions.test.ts:23` pins the whole
object. The new values go in a separate `PROPOSED` export, so "pinned" and "proposed" are visible in the code and the
owner can promote a value with a one-line diff.

| Signal (state row) | On the trader (direct, `d`) | On "similar" (viewer vectors) | Status |
|---|---|---|---|
| Like (`trade_likes`) | +3 × 2^(−age/30 d), on the liked trade's trader | +3 × the same decay, on that trade's symbol and holding bucket | **+3 pinned** (owner). Decay half-life 30 d, 180 d horizon, newest 500: proposed |
| Opening swipe | +2 | — | **pinned, dormant**: an "open" under G3 (PR-7 §1.1). Returns with 5c |
| "Not interested" (`viewer_exclusions`) | trader hidden 90 d (as built) | −4 spread over that trader's symbols and buckets while the row runs (criterion 4, "lowers similar") | **−4 pinned** (owner) |
| Trade reject (`trade_rejects`) | the trade hidden; −1 on its trader for `PREF_DAYS` (as built) | −4 on the trade's symbol and bucket for `PREF_DAYS`, even if O3 makes the hide permanent | −4 and the trade hide **pinned**. The −1 is the owner's "slight", valued by the engineer and built. The similar half: **proposed** |
| Unfollow note | −1 for 90 d (as built) | none (O4 says "on that trader") | owner-directed, engineer-valued, built in PR-4 |
| Follow (`follows`) | +3 | +3 spread over the followed trader's symbols and buckets | **proposed**. The owner said "feed the ranking" and gave no number |
| Watchlist symbol (`ticker_watches`) | — | +2 on that symbol, **section only** (§3.3) | **proposed** |
| Share | — | — | no weight (no state row) |

### 3.2 Formula (pure, `lib/discovery/relevance.ts`)

- **Trader features** at `asOf`. `Fsym(T)` is T's top 16 symbols by counted closes, L2-normalized. `Fhold(T)` is the
  5-bucket histogram of T's closes (`holdBucket`), normalized. Neither has a return field, by type.
- **Viewer vectors.** `Sv` (symbols) and `Hv` (buckets) are the signed sums of the "similar" column above. They can be
  negative.
- **Relevance:** `r(T) = d(T) + 0.6·cos(Sv, Fsym(T)) + 0.6·cos(Hv, Fhold(T))` (coefficients proposed).
- **Factor:** `personalFactor(r) = 1.25^clamp(r, −12, +4)`.
  - For r ≤ 0 it equals PR-4's `PREF_BASE^(−p)` exactly: −1 gives ×0.8.
  - `prefFactor` itself is untouched, so `prefs.test.ts:31` ("nothing positive before PR-5") still holds of it.
- **What each signal can do, in factor terms** (proposed scale):

  | Signal | Factor |
  |---|---|
  | one fresh like on that trader, or a follow | ×1.95 |
  | cap (two signals) | ×2.44 |
  | a full symbol match alone | ×1.14 at most |
  | a full holding-bucket match alone | ×1.14 at most |
  | "Not interested" on a trader with the same symbols and buckets | ×0.77 |
  | unfollow, or a reject's trader part | ×0.8 |

  The symbol term, the input closest to advice (counsel Q1), can move a trader by 14% at most.
- **Feed.** `rerank` and `shapeList` take the factor function as a parameter (prefs.ts and exclusions.ts, ~5 lines),
  so the order is weight × score × factor. Then come `diversify` (caps unchanged) and exploration (day seed, unchanged).
  Followed traders rank higher in the feed (Q2, a display preference) and still leave the section.
- **Cold start.** With no signal, `r ≡ 0`, the code takes the existing "no preference" path and serves `kept.mixed`.
  That is the signed-out list minus hides, with no re-mix.
- **G1 off** (PR-7's `personal_order_off`). The flag is read first, then the signal reads run only when the switch is
  on, so a switched-off viewer reads no like, watch or follow for ranking. That costs one sequential round trip (~1 ms)
  for switched-on viewers. PR-7's T1.1 and T7.L must pass unchanged after 5b.

### 3.3 Section

- **When the viewer has at least one positive signal at `asOf`:**
  - Relevance picks the 20 best of the eligible pool (ties broken by `byEvidence`).
  - The existing steps then run on those 20, in lower-bound order: near cards, earlier sections, Demo last, the
    new-record slot, the bucket cap.
  - Rows still read in evidence order (TR-9, criterion 8). The section's "ordered by evidence" line stays true.
- **Fallback.** If fewer than 3 rows survive, the impersonal pool is used.
- **The watchlist orders the section only, never the feed.** This contains the riskiest input (Q1) to the place that
  shows its reason. It also means a mid-session unwatch can't disturb paging: section rows aren't in the cursor's list.

### 3.4 Reasons (pure choice in 5a, copy in 5b)

The first one true for the row wins (the order is the business lead's and UX lead's call):
1. **"Similar holding period to @x".** x is the trader the viewer most recently followed, or whose record they most
   recently liked, among those in the row's bucket (not deleted, never the row's trader).
2. **"Trades symbols on your watchlist".** `Fsym(row)` intersects the watchlist.
3. **"Trades symbols in records you liked"** (new, replaces "…you read"; copy is the UX lead's). `Fsym(row)` intersects
   the liked trades' symbols.
4. **Otherwise PR-3's impersonal holding-period line.**

No template has a ticker or number slot, and each is checked true on fixtures. The heading changes only with a positive
signal and the switch on. Its words are the UX lead's, but it must be true of follows, likes and the watchlist: the
signals no longer include reading as such.

`ReasonWriter` seam (criterion 11), ~35 lines. It is deterministic by default. The validator falls back to the
template on a throw, after 300 ms, on a scanned word, or on a digit absent from the input. A test forces the writer to
fail. No model in stage 1.

## 4. Sign invariance

- **By construction:**
  - `features.ts`, `relevance.ts` and `reasons.ts` import no return. A static test greps them for
    `return_pct|returnPct|pnl` and the pure-import guard walks them.
  - The impersonal base (|return| × recency, TR-9 lower bound) is unchanged and already symmetric.
  - F1's "never the sign or size of a return" applies to the personal part, which reads neither.
- **Property (5a).** 1,000 seeded pools × viewer profiles. Negating every return leaves every `r(T)`, the re-rank and
  the reason choice identical.
- **DB (5b).** Build a fixture, then its mirror with every `return_pct` negated, and give the same viewer the same
  likes, follows, hides and watches in both.
  - Pages 1 to 3 and the section are identical by card identity.
  - A viewer who likes only losing records gets exactly the order a viewer liking the mirrored gains gets.
  - "Not interested" lowers a similar loser exactly as it lowers a similar winner.

## 5. Budgets

| Budget | Value | Where |
|---|---|---|
| Signed-in feed, switch on, heavy viewer (500 likes, 200 follows, 50 watches) | p95 < 800 ms (unchanged) | 5b load case, PR-6 |
| Personal scoring CPU per page (≤ 350 traders) | ≤ 10 ms (expected < 2 ms) | 5a bench, 5b in-process |
| Extra viewer reads | ≤ 3 statements per page, keyed by the viewer; ≤ 20 ms p95 together | 5b |
| Switch off | ≤ signed-out + 20 ms (PR-7 T7.L, re-run after 5b) | 5b |
| Signed out | p95 < 400 ms; zero new queries (behavioral guard) | 5b, PR-6 |
| Feed HTML | ≤ 500 KB per page (reason lines are the same length class) | 5b, PR-6 |
| Pure scoring at scale | 5,000 viewers × 500 candidates < 50 s, one core | 5a (`LOAD=1`) |
| Dropped | `/api/events` p95, 200 concurrent batches, 4 M event drain | — |

## 6. The PRs

### 6.1 PR-5a · Personal scoring, pure · `autopilot/feature-2-scoring` · ~260 product lines

- **Product:**
  - `lib/discovery/features.ts` (new, ~60): `traderFeatures(closes)` and `cosine`.
  - `lib/discovery/relevance.ts` (new, ~110): `viewerProfile(signals, featuresOf, asOf)`, `relevance`,
    `personalFactor`, `personalPool`.
  - `lib/discovery/reasons.ts` (new, ~60): `personalReason`, returning a `Reason` kind as data, plus the `ReasonWriter`
    validator. It cannot import `lib/copy.ts`, because pure modules may import only `lib/discovery/*`.
  - `lib/discovery/weights.ts`: append `PROPOSED` only (~25).
- **Tests:**
  - `lib/discovery/features.test.ts`, `relevance.test.ts`, `reasons.test.ts` (new).
  - `lib/discovery/imports.test.ts`: a new `PERSONAL_ROOTS` block appended at the end, touching no line PR-7 adds.
- **What they cover:**
  - cold start, one signal, many signals (500 likes, 200 follows);
  - a follow raises; a like decays; "not interested" lowers a similar trader;
  - an unfollowed trader sits exactly ×0.8 below its twin with and without positive signals;
  - caps and floor;
  - sign invariance (property);
  - every reason true on fixtures, with no ticker or digit;
  - the failing writer falls back to the template;
  - the 5,000 × 500 bench.
- **Behavior change: none.** Nothing imports these modules outside tests until 5b.

### 6.2 PR-5b · Personal ordering, wired · `autopilot/feature-2-personal` · ~250 product lines

- **Product:**

  | File | Change | Lines |
  |---|---|---|
  | `lib/feed.ts` | features in `weights()`; the personal branch in `loadFeedPage` after the G1 flag; the section's personal pool, reasons and heading flag | ~80 |
  | `lib/discovery/prefs.ts`, `exclusions.ts` | factor parameter | ~8 |
  | `lib/discovery/section.ts` | `Reason` union widened | ~15 |
  | `lib/likes.ts` | `likesAt`; keeps `viewer_id = ${viewer}` for the static scan; and `resetFeed` (PR-8): nothing new to delete, since the registry gains no table | ~15 |
  | `lib/follows.ts` | `followsAt` | ~8 |
  | `lib/watches.ts` | new | ~10 |
  | `lib/copy.ts` | personal reasons and heading; the rewrite of PR-7's `SETTINGS.orderOnExplain`, which names only the demotions today; the Privacy replacements (§9) | ~40 |
  | `app/suggest-section.tsx`, `app/suggest-row.tsx` | heading and reason | ~15 |
- **Tests:**
  - `lib/feed.personal.test.ts` (new, DB): criteria 1, 4, 7 and 8, the mirror fixture, two viewers see none of each
    other's data, no duplicate card after a mid-session unlike or unfollow.
  - `lib/feed.signed-out.test.ts`: restated and new cases (§8).
  - `lib/feed.section.test.ts`: one restated case (§8).
  - `lib/feed.load.test.ts`: a heavy signed-in viewer.
  - `e2e/personal.spec.ts` (new, 375 px, light and dark, signed in and out): follow, then the next page 1 shows that
    trader's bucket earlier, with the personal reason and heading; switch off gives the impersonal section; signed out
    unchanged; G3: a scripted session of opens, swipes, scrolls and dwell writes no row except
    `sessions.last_seen_at` and the watched symbol's `last_seen_at` (owner Q1).

### 6.3 PR-6 · Heavy use · `autopilot/feature-2-heavy` · 0 product lines (fallbacks ≤ 60)

- **Fixture (`LOAD=1`):**
  - 500 traders, 12 of them heavy at 10,000 activities.
  - 5,000 viewers, each with 100 likes, 30 follows, 10 watches, 5 "Not interested", 10 rejects and 3 unfollow notes
    (~800 k rows).
  - One trader referenced by 100,000 viewers through follows, likes, exclusions and rejects (`generate_series`).
  - 1 M ended exclusions and rejects.
- **Asserts:**
  - signed-in p95 < 800 ms for the heaviest viewer, pages 1 to 3;
  - 5,000 distinct viewers' page 1 (feed and section, full DB path) < 600 s on one core, which is ≥ 30,000 per hour
    (criterion 11);
  - deleting the referenced trader < 5 s, with zero rows left in every F-2 table;
  - the 1 M ended rows drain within 10 ticks, each ≤ 30 s, zero live rows touched, and the F-1 fleet test unchanged;
  - memory growth < 160 MB;
  - 1,000 seeded viewers' feeds obey the caps on every window across 3 pages, joins included;
  - signed-out p95 < 400 ms; HTML ≤ 500 KB.
- **Fallbacks, only on a miss:**
  - deletion's first step in 50,000-row batches (`lib/delete.ts`, ~30);
  - the relevance memo in `lib/feed.ts` (~25).
- **Files:** `lib/feed.heavy.load.test.ts` (new), plus fallbacks if needed.

## 7. Dependencies and build order

| Rule (IMPLEMENTATION "Parallel development") | 5a vs PR-7 / PR-8 / Privacy PR | 5b vs PR-7 | 5b vs PR-8 | 5b vs Privacy PR |
|---|---|---|---|---|
| 1 waits on / needs code | passes: needs none of them (pure) | fails: needs the G1 flag | fails: needs `resetFeed` and the registry | fails: edits its `PRIVACY` sentences |
| 2 files | passes: new files, an append to `weights.ts`, and an appended block in `imports.test.ts` (the orchestrator should treat that block as append-mostly) | fails: `lib/feed.ts` | fails: `lib/likes.ts`, `lib/follows.ts`, `app/suggest-section.tsx` | fails: `lib/copy.ts` lines it adds |
| 3 schema | passes: none | — | — | — |
| 4 pinned behavior | passes: moves no ranking | fails: both move the ranking | — | — |
| 5 protected path or owner stop | passes | passes | passes | passes |

**Order:**
1. PR-4 lands.
2. **PR-7 ‖ PR-8 ‖ PR-5a** in parallel.
3. The Privacy PR (after PR-7 and PR-8, as `plan-guardrails.md` §0 says).
4. **PR-5b.**
5. **PR-6.**

This amends `plan-guardrails.md` §0's "PR-5a and PR-5b wait on PR-7 and PR-8" for 5a only, since 5a no longer names
`discovery_events` or extends the reset. PR-5b changes Privacy text, so the owner merges it by hand (POLICY H), the same
day as the matching Privacy sentences. Real (non-demo) viewers still wait on H4's conditions: item #7 scheduled and the
Privacy page live.

## 8. Pinned tests that change (rewritten, never deleted; count only grows)

| Where | Today | Rewritten to | Who approves |
|---|---|---|---|
| `lib/feed.signed-out.test.ts`, PR-2 signed-in case, last assertion | signed in, no query names `trade_likes` or `discovery_events` | `discovery_events` never. `trade_likes` only in `likesAt`'s statement, `where l.viewer_id = $1` with the viewer as its first parameter, once per page. The original "never" assertion moves verbatim into a **new case for a switched-off viewer** | **owner**: it relaxes a privacy guard to a keyed read. PR-4's log already said this needs owner approval |
| same file, PR-3 signed-in section case, last assertion | same | same restatement. The `union` count (`skips.length === 1`) is unchanged: no 5b read uses `union` | owner |
| same file, PR-4 case | `reads.length === 2` over `trade_rejects|trade_likes`, and `trade_likes` never | rejects: 2 reads (`from trade_rejects where viewer_id = $1`); likes: 2 reads (`likesAt`), each keyed by the viewer; "never" moves to the switched-off case | owner |
| `lib/feed.section.test.ts:91`, the criterion-4 case | the unfollowed trader "reads after all of them", and is row 3 at k = 2 | Under 5b the k-loop's follows also raise similar traders, so the case adds an exact twin of c (same bucket, symbols, evidence). The assertion becomes "c reads below its twin". At k = 2 the rows are `{keep₀, keep₁, c}` as a set. The leave-out, k = 1 / 0 and "all hidden" assertions are unchanged | the committee, as the business lead ruled the PR-4 restatement of this same case |
| **Unchanged, by design** | `exclusions.test.ts:23` (`WEIGHTS` untouched); `prefs.test.ts:28-31` (`prefFactor` untouched); `likes.test.ts:24` and `follows.test.ts:22` (reads stay in their files, keyed `viewer_id = ${viewer}`; "no discovery event table" stays true); PR-7 T1.1, T1.3, T3.3; PR-8 T2.4 (no new viewer table); every signed-out case | — | — |

New cases:
- `VIEWER_TABLES` after PR-7 already names `ticker_watches`. 5b adds that `ticker_watches` is read only
  `where user_id = $1` (the viewer), only with the switch on, and never signed out.

## 9. Knock-on edits to other documents (owner or other authors; listed, not made)

- **Feature file, owner's restatements before `Status: built`:**
  - **Criterion 2:** "…built from their own follows, likes, watchlist and hides; implicit reading signals only after the
    owner lifts G3."
  - **Criterion 3:** "No reading-event table exists while G3 holds; each signal table holds only its pinned columns
    (viewer, target, time, end, reason), tested against `information_schema`."
  - **Criterion 5**, event half: moot ("affinities" are computed per request and never stored). Deletion is already
    tested.
  - **G4's "reading activity":** keep the words, which are true but name nothing stored, or drop them until 5c.
- **`plan-guardrails.md`:**
  - `RESET.explain` gets no "It also deletes your reading activity." line.
  - T3.3 stays as written, waiting for 5c.
  - §0's dependency note for 5a (above).
- **Privacy PR:**
  - **Part B is not pasted** (nothing is recorded).
  - PR-5b carries Part A's three PR-5b replacements (follows, likes and the watchlist order the feed or section), plus
    one new sentence under "Not interested" and "Hide this trade": "Records with similar symbols and holding periods
    also appear a little lower."
  - The watchlist sentence must say "suggestions", not "feed" (§3.3).

## 10. Open questions

| # | For | Question | Default |
|---|---|---|---|
| E1 | owner | Accept state-only scoring (no event table, logger deferred to 5c) and the criterion restatements in §9 | yes, as proposed |
| E2 | owner | The proposed values in §3.1 (follow +3, watch +2, decay, coefficients, cap, the similar half of a reject) | build with them; each is one constant in `PROPOSED` |
| E3 | owner | The opening swipe +2: stay dormant under G3, or reclassify it as explicit (it would then need an event row: a one-type log) | dormant |
| E4 | BL, UX | The reason priority and the heading words (must be true of follows, likes, watchlist) | §3.4 order; heading pending UX |
| E5 | BL | The watchlist orders the section only (my proposal) or the feed too | section only |
| O3 | owner | Hide duration (still open) | 90 d. A permanent reject keeps its similar effect only for `PREF_DAYS` |

## 11. Risks

- **Symbol affinity (Q1 residual medium).** It is bounded at ×1.14, used in the section only for watchlist symbols, no
  reason names a symbol, and every template is scanned.
- **Thin signals look like noise.** One like moves one trader ×1.95, but the caps and exploration hold. Measure the
  share of signed-in sessions with at least one positive signal, and the section's open rate personal vs. impersonal.
- **The test restatements are the gating item.** If the owner declines §8's privacy-guard rows, 5b can't read likes
  in `loadFeedPage`. The only compliant alternative is page-side reads with a new restatement of the page-file guard.
  That is worse, so I would stop there and ask.

Engineer: round-1 position, not a sign-off. I would stake my name on building 5a, 5b and 6 as written here within the
stated lines, once the §8 restatements are approved.
