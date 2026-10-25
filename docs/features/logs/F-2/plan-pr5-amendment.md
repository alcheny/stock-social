# F-2 · Plan amendment: PR-5 (personal ordering from explicit choices) and PR-6 (heavy use)

Date: 2026-10-25. Author: engineer, merging the three round-1 positions:
- `plan-pr5-round1-business-lead.md` (BL)
- `plan-pr5-round1-ux-lead.md` (UX)
- `plan-pr5-round1-engineer.md` (ENG)

Other inputs:
- the F-2 feature file, including the newest Decision, guardrails Q1 reversed on 2026-10-25: with personal ordering
  off, no activity of any kind is recorded, and explicit choices order nothing except hides;
- POLICY F1 as amended (`bcaac14`);
- `plan-guardrails.md` round 2 (PR-7: G1, G3, G4; PR-8: G2, G5, G6; now **sequential: PR-7 after PR-4, PR-8 after
  PR-7**), its §13 "binding additions to PR-5a and PR-5b" (C3, C9, the Q1 reversal, adopted in §6.1 below), and its
  sign-offs (BL C1 to C9, UX items 1 to 22);
- the code on `claude/peaceful-dirac-33bucv`.

This amendment replaces `plan.md` §1 "PR-5" and "PR-6". The signed text of `plan.md` is unchanged. It decides how, not
what: every change to a feature-file criterion goes to the owner (§8, §11). Nothing here is legal advice.

Demo sentence: "Follow a trader or like two trades, open the feed again, and traders who hold about as long come
higher, losses included, with one line saying why."

## 1. What the three positions agree on (adopted without debate)

- **No event table.**
  - Dropped: `discovery_events`, `discovery_event_types`, `discovery_surfaces`, the emitters, `/api/events`, the
    implicit logger and the event purge.
  - Every signal G3 keeps (follows, likes, hides, unfollow notes) is already a state row the viewer chose.
  - PR-5 only reads those rows.
- **The implicit logger is parked as PR-5x.** It is not built, not even behind PR-7's constant. It returns only when the
  owner lifts G3, with its own plan round and its own Privacy text. PR-7's `IMPLICIT_SIGNALS`, `mayRecord`,
  `usableTypes` and T3.3 stay as built; PR-5x must use them.
- **No schema change.** The `discovery_trader_features` table is dropped.
- **The exploration seed stays the UTC day.** The per-viewer seed is dropped.
- **Feed cards get no reason line.** Reasons appear on section rows only.
- **Dropped reasons:** "Trades symbols you read" and "New to you". Neither can be true under G3.
- **Dropped heading:** "More like what you read".
- **Privacy Part B (approved 2026-10-25) is not pasted.** It describes recording that does not happen.

## 2. Settled differences

| # | Point | BL | UX | ENG | **Settled** | Why |
|---|---|---|---|---|---|---|
| S1 | Heading | "More like what you follow and like" | same | true of the inputs; UX words | **"More like what you follow and like"**, in the personal state only (§5) | All three agree on the rule. Two of three proposed these words, and they name exactly the inputs used. |
| S2 | Reasons | "Holds trades about as long as @x"; "Trades symbols on your watchlist" | R1 "You liked one of their trades"; R2 "Similar holding period to @x, who you follow"; R3 "Similar holding period to @x, whose trade you liked" | holding period to @x; watchlist; liked symbols | **UX's R1 to R3** | "Holds trades…" fails the existing scan: `lib/copy.test.ts:333`, `SUGGESTION_WORDS` matches "Holds". The watchlist and symbol reasons go with S3. R1 to R3 are true by construction and say why @x matters. |
| S3 | Watchlist and symbol affinity as inputs | keep behind a constant | drop (U3) | section only | **Dropped from PR-5; no constant built** | Counsel Q1 rates symbol affinity the medium-risk input. Dropping it removes the only reason that ties a security to a trader. A constant at 0 would be dead code, not a guardrail. Ranking reads no `ticker_watches` at all, which makes BL C2's static guard trivially true. Owner question Q4 can restore it later. |
| S4 | Follow and watch weights | follow +5, watch +3 | — | +3, +2 | **Follow +5 (proposed); no watch weight** (S3) | A follow is the viewer's strongest standing choice and should outrank a single like (+3, pinned). Under the bound (S5), +5 keeps a followed trader at the cap even when the viewer hid one of their trades. The trade itself still stays hidden. |
| S5 | Bound | m ∈ [0.5, 2] | — | 1.25^clamp(r, −12, 4) | **m = clamp(1.25^r, 0.5, 2)** | Base 1.25 keeps PR-4's ×0.8 per −1 exactly. BL's bounds make the effect symmetric in log terms (½ to 2) and keep O4's "never a hide" honest. Only a trader with 4 or more negatives at once is affected by the floor, and no pinned PR-4 test exercises that. |
| S6 | Split 5a/5b | one PR unless > 700 lines | — | 5a pure / 5b wired | **One PR-5 (~400 product lines), two commits** | BL's split rule applies, and the total is far under 700. The pure commit may start now in its own worktree (passes the independence test, §7). The PR merges once, after PR-7, PR-8 and the Privacy PR. There is no unwired merge. |
| S7 | PR-6 | trimmed | — | kept, re-based | **Kept, test-only** (0 product lines, fallbacks ≤ 60) | Its fleet scenarios have nothing to do with events: deleting a trader referenced by 100,000 viewers, a 1 M ended-row purge, 5,000 viewers. They need a long-running fixture that should not block PR-5's merge. |
| S8 | `share` | none (PR-5x) | the only event, giving criteria 3 and 5 a writer | none | **None** | The owner never pinned a share weight. One unweighted signal would bring a table, a write route, a purge, a deletion step, a Reset entry, a Privacy Part B and a G1 write-block. Criteria 3 and 5 are restated instead of being given a writer (§8). Owner question Q5. |
| S9 | Reason fallback | try/catch around the picker; no model seam | — | 35-line seam with timeout | **try/catch** | There is no model in stage 1. The seam returns with H3. Criterion 11 is restated to match (§8). |
| S10 | Section states | ≥ 1 follow or like → personal | four states; no mixed section; personal only with ≥ 3 personal candidates | — | **UX's four states S0 to S3** (§5), with S1 as BL C9 and PR-7 T1.9 require | They are stricter, and every heading and line is true in every state. UX's S1 extra line ("Not ordered by your activity." plus a link) is not built. C9 is binding (guardrails §13), and T1.9 pins that a switched-off viewer sees neither `SECTION.personal` nor "Feed settings". |
| S11 | Paging contract after a removal | a new signal changes no same-day slice | "repeats none, misses none", removals included | bound stated | **Additions are exact. A removal (unlike, unfollow, Reset, switch change) may skip a card until the next page 1. The pager already drops repeats.** | This is the bound `plan-guardrails.md` §4 and UX guardrails item 7 accepted for Reset and the switch. Exactness under removal would need stored removal history, which would make "Unlike deletes it at once" false. Owner question Q6. |
| S12 | Similarity | holding period and symbols, 0.6 each | holding period only | cosine on both | **Holding bucket only**: `0.6·tanh(Hv[b]/6)` | It matches R2 and R3 exactly (equal median buckets), so the reason states the term that put the row there (UX §3). tanh keeps each bucket independent, which makes BL's monotonicity invariants hold. |
| S13 | `/how` documentation | — | a new "How your feed is ordered" section (F1 "documented method") | — | **Built in PR-5** | F1 says rankings follow "the documented method", and nothing documents the personal order today. |

## 3. The PRs

### PR-5 · Personal ordering from explicit choices · `autopilot/feature-2-personal` · ~400 product lines, ~700 test lines

**Commit 1: pure.** It may start now, in its own worktree, database and ports (§7).

| File | What | Lines |
|---|---|---|
| `lib/discovery/personal.ts` (new) | `directWeight`, `bucketVector`, `relevance` and `personalFactor` (§4); `sectionState` (S0 to S3); `personalCandidates` (traders for which R1, R2 or R3 is true); `reasonFor` (R1 > R2 > R3; most recent signal, then handle). No return field in any input type. | ~150 |
| `lib/discovery/weights.ts` | append a `PROPOSED` export only. `WEIGHTS` stays byte for byte (`exclusions.test.ts:23` pins it). | ~15 |
| tests | `lib/discovery/personal.test.ts` (new). An appended `PERSONAL_ROOTS` block at the end of `lib/discovery/imports.test.ts`, touching no line PR-7 adds. | — |

**Commit 2: wiring.** It starts after PR-8 (which follows PR-7) and the Privacy PR have merged.

| File | What | Lines |
|---|---|---|
| `lib/feed.ts` | After PR-7's `viewerFlags(viewer)` read, and only when `orderOff` is false: `likesAt` and `followsAt`; the m map into the re-rank; the section state, personal pool and reasons; `state` in `FeedPage`. PR-5 writes nothing, so it needs no `recording(id)` gate, and PR-7's T1.7 is untouched. | ~60 |
| `lib/discovery/prefs.ts`, `lib/discovery/exclusions.ts` | `rerank`, `preferPool` and `shapeList` take the factor function as a parameter, defaulting to `prefFactor`. `rerank` stays the only re-ordering of the shared list (BL builder demand 1). | ~10 |
| `lib/discovery/section.ts` | widen the `Reason` union with `liked` and `holdAs {handle, via: 'follow' or 'like'}` | ~12 |
| `lib/likes.ts` | `likesAt(viewer, asOf)`: newest 500 at `asOf`, within 180 days, joined to `closed_trades` by `trade_key` for the trader. The template keeps `viewer_id = ${viewer}` (`likes.test.ts:24` scan). | ~12 |
| `lib/follows.ts` | `followsAt(viewer, asOf)`: newest 200 at `asOf`, `where viewer_id = ${viewer}` (`follows.test.ts:22` scan; PR-2 guard regex) | ~8 |
| `lib/copy.ts` | heading, the S2 and S3 lines, R1 to R3; the rewrites of `SETTINGS.orderOnExplain` and `SECTION.personal` (guardrails §13: PR-7's T1.5 and T1.9 pin both strings through the objects, so the tests follow the new text); `HOW.feed`; the `PRIVACY` replacements (§9) | ~60 |
| `app/suggest-section.tsx`, `app/suggest-row.tsx` | state heading and line, PR-7's "Feed settings" link, the row reason | ~25 |
| `app/how/page.tsx` | the "How your feed is ordered" section (`id="feed"`), UX §4's five statements, with numbers drawn from the constants | ~20 |

Commit 2 also adds these tests:
- `lib/feed.personal.test.ts` (new, DB);
- `lib/feed.signed-out.test.ts` and `lib/feed.section.test.ts` (§6);
- `lib/copy.test.ts` (scan words: "for you", "picked", "curated", "smart", "personaliz", "improve", "better", plus "read"
  and "activity" in the heading and reasons);
- `lib/feed.load.test.ts` (a heavy signed-in viewer);
- `e2e/personal.spec.ts` (new);
- `e2e/how.spec.ts` (one case added).

**Acceptance (F-2):** criteria 1, 2, 3, 4, 5, 7, 8 and 11 as restated (§8), G1 held, and G3 held.

**The owner merges PR-5 by hand,** because it carries Privacy text (POLICY H, BL O9).

### PR-6 · Heavy use · `autopilot/feature-2-heavy` · 0 product lines (fallbacks ≤ 60), ~450 test lines

**Fixture (`LOAD=1`):**
- 500 traders, 12 of them heavy at 10,000 activities;
- 5,000 viewers, each with 50 follows, 500 likes, 50 hides (rejects, "Not interested") and 5 unfollow notes (~3 M rows);
- one trader referenced by 100,000 viewers (follows, likes, exclusions, rejects; `generate_series`);
- 1 M ended exclusions and rejects;
- one viewer with 2,000 stored likes and 500 follows.

**Asserts:**
- **Signed-in feed:** p95 < 800 ms for the heaviest viewer, pages 1 to 3.
- **Scoring:** ≤ 10 ms per page in-process.
- **Throughput (criterion 11):** 5,000 distinct viewers' page 1 (feed and section, full database path) in < 600 s on
  one core, which is ≥ 30,000 an hour.
- **Deletion:** deleting the referenced trader takes < 5 s and leaves zero rows in every F-2 table.
- **Purge:** the 1 M ended rows drain within 10 ticks, each ≤ 30 s, with zero live rows touched and the F-1 fleet
  test unchanged.
- **Memory:** growth < 160 MB.
- **Caps:** 1,000 seeded personal feeds obey the caps on every 10-card window across 3 pages, joins included.
- **Signed out:** p95 < 400 ms. Raw HTML ≤ 500 KB.

**Fallbacks, only on a miss:**
- deletion's first step in 50,000-row batches (`lib/delete.ts`, ~30 lines);
- `schema_add_index('trade_likes_viewer_created', …)`, already PR-8's optional index.

**Files:** `lib/feed.heavy.load.test.ts` (new); fallbacks only if needed.

**Waits on:** PR-5. P8 (CI heavy suite, item #13) is not blocking.

### PR-5x · Implicit signals (parked, not planned)

It returns only when the owner lifts G3 after counsel answers Q4 and Q5. It brings its own plan round, Privacy text,
and BL C3's behavioral pair:
- a non-demo viewer posting each implicit type stores 0 rows;
- seeded demo implicit rows are absent from a real viewer's profile.

Share and the opening swipe (+2) come back with it.

## 4. Schema and scoring

### Schema

None. `db/schema.sql`'s diff is empty in PR-5 and PR-6 (a test asserts it; BL builder demand 2). PR-5 writes nothing
at any time. Reads, all keyed by the session's viewer id and made only while the switch is on:

| Table | Columns read |
|---|---|
| `follows` | `trader_id`, `created_at` |
| `trade_likes` ⋈ `closed_trades` | trader, `created_at` |
| `viewer_exclusions` and `trade_rejects` | already read today |

`ticker_watches` is never read for ranking.

### Score (pure, `lib/discovery/personal.ts`)

| Term | Definition |
|---|---|
| `b(T)` | trader T's median holding bucket at `asOf` (already in `TraderFacts.hold`; nothing new to compute) |
| `d(T)` | `5·[follows T] + Σ likes on T 3·2^(−age/30 d) − 1·[running unfollow note on T] − 1·(running rejects of T's trades)` |
| `Hv[k]` | `Σ follows F with b(F)=k 5 + Σ likes on traders with b=k 3·decay − Σ running "Not interested" on U with b(U)=k 4 − Σ running rejects of a trade of U with b(U)=k 4` |
| `r(T)` | `d(T) + 0.6·tanh(Hv[b(T)] / 6)` |
| `m(T)` | `clamp(1.25^r(T), 0.5, 2)` |
| Feed | weight × score × m through `rerank`, then `diversify` and the day-seeded exploration, all unchanged |
| Section | §5 |

**When m ≡ 1, exactly** (the code takes the existing "no preference" path and serves `kept.mixed`):
- signed out;
- switch off (owner decision: hides still hide; the PR-4 demotions are off too, PR-7);
- cold start, with no signal and no demotion.

**Every signal is read with `created_at ≤ asOf`**, so a new like or follow enters at the viewer's next page 1. A
removal is bounded as in §2 S11.

**What each signal can do, in factor terms:**

| Signal | Factor |
|---|---|
| A follow | ×2 (the cap) |
| One fresh like | ×1.95 |
| A full holding-bucket match | ×1.14 at most |
| An unfollow, or a reject's trader part | ×0.8 |
| "Not interested" on a trader in the same bucket | ×0.88 at most |
| Floor | ×0.5 |

**Invariants, each a test (BL §5):**
- Adding a like or a follow never lowers that trader.
- A hide never raises a trader in the same bucket.
- An unfollowed or rejected trader ranks below its exact twin, with or without positive signals.
- PR-4's pinned preference tests pass unmodified. They use one negative per trader, so the floor never applies and
  both twins share the bucket term.

## 5. Weights, reasons and heading

### Weights

| Signal | Weight | Status |
|---|---|---|
| Like | +3 | **owner, pinned** (`WEIGHTS.like`) |
| "Not interested" | −4: trader hidden 90 d (built), and −4 into `Hv` while the row runs ("lowers similar", criterion 4) | **owner, pinned** (−4). The `Hv` use is proposed. |
| Trade reject | −4: the trade hidden (built), and −4 into `Hv` for `PREF_DAYS`, even if O3 makes the hide permanent | **owner, pinned** (−4). The `Hv` use is proposed. |
| Reject, trader part; unfollow | −1 each | owner-directed ("slight"), engineer-valued, built in PR-4 (`WEIGHTS`) |
| Opening swipe | +2 | **owner, pinned, dormant**: it is an "open" under G3. It returns with PR-5x |
| Follow | **+5** | proposed |
| Like decay | half-life 30 d; newest 500 likes within 180 d of `asOf` | proposed |
| Follows read | newest 200 at `asOf` | proposed |
| Holding similarity | coefficient 0.6, tanh scale 6 | proposed |
| Factor | base 1.25, m ∈ [0.5, 2] | proposed. The base equals 1 / `PREF_BASE`, which is built |
| Watchlist, symbols | — | **not an input** (S3; owner question Q4) |
| Share; profile open, dwell, impression, skip | — | **none** (S8; PR-5x) |

All proposed values live in `PROPOSED`, one constant each. The owner promotes a value with a one-line diff.

### Section states (UX §2): exactly one per render

| State | When | Heading | Line under the heading | Row reason |
|---|---|---|---|---|
| S0 | signed out | "Other traders' records" (today) | today's `SECTION.explain` | impersonal holding period (today) |
| S1 | signed in, switch off | "Other traders' records" | today's `SECTION.explain` only. No `SECTION.personal`, no "Feed settings" (BL C9, PR-7 T1.9) | impersonal |
| S2 | signed in, switch on, fewer than 3 personal candidates after every filter | "Other traders' records" | today's line, then `SECTION.personal` as PR-5 rewrites it (demotions and follows, true of S2) and "Feed settings". Add the cold-start hint "Follow a trader or like a trade, and this section can show traders like them." only when there is no follow and no like | impersonal |
| S3 | signed in, switch on, at least 3 personal candidates | **"More like what you follow and like"** | "Based on the traders you follow and the trades you like. Losses count the same as gains.", naming only the input kinds this viewer has, then "Feed settings" | R1 to R3 |

**Rules:**
- There is never a mixed section.
- Hides alone never make S3.
- In S3 the rows are personal candidates only: the viewer, follows and "Not interested" traders are left out. The rows
  are chosen with `preferPool` (m) and read in TR-9 lower-bound order, so criterion 8 holds in every state.
- **S1 equals S0 apart from the Following state** of a followed trader's row (PR-7, UX guardrails item 5). This settles
  UX round-1 §2's extra S1 line in favor of BL C9 and PR-7's T1.9, which are both binding. A switched-off viewer
  reaches the switch from Settings.

### Reasons, true by construction

The first true one wins: R1 > R2 > R3. Among several matches, the most recent signal at `asOf` wins, then the handle.

| Id | Template | True when |
|---|---|---|
| R1 | "You liked one of their trades" | the viewer has a like on a trade of this trader (counted at `asOf`; the trade still exists) |
| R2 | "Similar holding period to @x, who you follow" | the viewer follows @x; @x is not deleted, not excluded and not the row's trader; `b(@x) = b(row)` |
| R3 | "Similar holding period to @x, whose trade you liked" | the viewer liked a trade of @x and does not follow @x; otherwise as R2 |

A row is a personal candidate only if one of R1 to R3 is true. These are the same terms the score uses (`d` from
likes, `Hv` from follows and likes). No template has a ticker or number slot. Each template passes `PROMO`, `BANNED`,
`SUGGESTION_WORDS` and `ENDORSEMENT`. "Holding period" passes; "holds" fails.

### Other copy (UX lead's final words, within the scans)

- `SETTINGS.orderOnExplain` is rewritten to name exactly the inputs used: follows, likes, hides and unfollow notes,
  holding period, gains and losses counted the same.
- The On line may say nothing about reading is recorded only while that is true. G3 makes it true. A watched symbol's
  page still stamps `last_seen_at` while the switch is on, so the line must not say "nothing you open is recorded".
- `/how#feed` gets UX §4's five statements. Its 90-day figures come from `EXCLUSION_DAYS`, `PREF_DAYS` and
  `TRADE_REJECT_DAYS`.
- No feedback line promises an effect: no "We'll show you more like this", "improve" or "got it" (UX §8).

## 6. Tests

### New, written first (each failing before the code)

| Area | Test |
|---|---|
| No new data | Empty `db/schema.sql` diff. No `app/api/events`. A POST to `/api/events` returns 404, and a row-count snapshot of every table with a `viewer_id` column is unchanged after a scripted session (scroll 60 cards, open 3 panes, swipe, dwell). A static scan finds no `sendBeacon`, no visibility logger and no `discovery_events` in `app/` or `lib/`. |
| G1 off | 200 seeded viewers with follows, likes and hides, switched off: feed pages 1 to 3 and the section equal the signed-out order minus their hides (PR-7's T1.1 re-run). The query log shows no `trade_likes` read and no ranking read of `follows`. The section is in state S1. PR-5 writes nothing in any mode. |
| Cold start; one follow; one like; many signals | cold start is identical to today. A followed or liked trader ranks above its twin, with m ≤ 2. A stranger with more than 2× weight × score still ranks above. A trader in the same bucket ranks above its twin in another bucket, by less than the direct effect. The many-signals case uses 500 likes and 200 follows read, and 2,000 likes stored. |
| Unlike | the next page 1 equals the order from before the like |
| Lowers similar (criterion 4) | "Not interested" or a reject: a same-bucket trader ranks below its twin while the row runs, and equal after it ends. The excluded trader is absent for 90 days. |
| Invariants | §4's list; `m ∈ [0.5, 2]` over 1,000 seeds |
| Sign invariance | Property, 1,000 seeds: negating every return leaves `r`, the order and the reason choice unchanged. DB: a fixture and its mirror with `return_pct` negated give identical pages 1 to 3 and section. A viewer who likes only losing records gets the order a viewer liking the mirrored gains gets. |
| Caps | 1,000 seeded personal feeds × 3 pages, joins included: at most 2 per trader and per symbol in any 10 cards; at least 2 of 10 are exploration picks; the seed is the day only |
| Paging | A like or follow made between pages 1 and 2 changes no slice of that cursor and appears at the next page 1. After an unlike or unfollow made mid-session, no rendered card is duplicated. |
| Isolation | Swapping two viewers' rows swaps only their own orders. Reasons cite only traders this viewer follows or liked. |
| States and reasons | Four fixtures render S0, S1, S2 and S3 exactly. Hides only give S2 with no hint. Two personal candidates give S2 with no hint. A property test checks that every S3 row has an R1 to R3 reason and no other state has one. Each reason's truth condition holds on fixtures. A forced throw in the picker gives the impersonal reason (criterion 11). |
| Copy | the scan words (§3); `/how#feed` has the five statements and its 90-day numbers equal the constants |
| Budgets | §10 |
| Demo e2e (375 px, light and dark, keyboard and touch; done = this test with screenshots, BL builder demand 3) | The viewer likes two records in one bucket and opens the feed again: S3, with at least one R3 row. Signed out, the same page shows S0. Switch off: S1. |
| Privacy | `/privacy` contains the PR-5 sentences (§9) and no Part B |

### 6.1 The binding additions from `plan-guardrails.md` §13 (C3, C9, the Q1 reversal), adopted

§13 was written for an event log. Each item is adopted as a test in PR-5. Where PR-5 has no event table or route, the
test asserts that absence, so it still fails if one appears.

| §13 item | Adopted as (PR-5) |
|---|---|
| C3: a non-demo viewer POSTing each implicit type to `/api/events` stores 0 rows | **T5.C3a.** For a non-demo viewer, a demo viewer (PR-7's `viewerFlags` definition) and a signed-out client, POSTing each implicit type (`impression`, `dwell_short`, `dwell_long`, `skip`, `swipe_open`, `profile_open`) to `/api/events` gets 404, and a row-count snapshot of every table is unchanged. |
| C3: implicit demo rows seeded for a real viewer are absent from that viewer's profile input | **T5.C3b.** `personal.ts`'s input type has exactly four row kinds (follows, likes, exclusions, rejects) and no event or type field, checked by a static assertion over the exported type and its constructor `profileInput(...)`. A test passes extra properties shaped like events (`type: 'impression'`) and they are ignored (output unchanged). If PR-5x adds a table, this is where `usableTypes` filters. |
| C3: a switch-off viewer POSTing any type, explicit share included, stores 0 rows | **T5.C3c.** The same as T5.C3a for a switched-off viewer, every type including `share`. PR-7's T1.3 (no write at all while reading switched off) is re-run after PR-5. |
| C3: a switch-off viewer's explicit actions write their state row and no `discovery_events` row | **T5.C3d.** A switched-off viewer follows, unfollows, likes, unlikes, hides a trade and marks "Not interested". Each action changes exactly its own state table (`follows`, `viewer_exclusions`, `trade_likes`, `trade_rejects`), and every other table's row count is unchanged. No `discovery_events` table exists (`likes.test.ts:24` holds). |
| PR-5a: `discovery_events` into `RESET_DELETES` and deletion's first step; `RESET.explain` gains its sentence | **Not applicable: there is no table.** PR-8's T2.4 passes unchanged, because PR-5 adds no table with a `viewer_id`. `RESET.explain` gets no sentence. If PR-5x ever adds the table, T2.4 forces both. |
| C9: with the switch off, the section keeps the signed-out heading and explanation, with no personal reason line | **S1** (§5). **T5.C9:** switched off, with follows and likes, the section's heading, explanation and every row reason equal the signed-out render. `SECTION.personal` and "Feed settings" are absent (PR-7's T1.9 re-run). |
| PR-5b rewrites `orderOnExplain` and `SECTION.personal` once follows and likes order the feed | §3 commit 2, `lib/copy.ts`. T1.5 and T1.9 assert through `SETTINGS` and `SECTION`, so they follow the new text. A new truth test checks that each string names exactly the inputs PR-5 uses: follows, likes, hides, unfollow notes, holding period. |

### Existing tests that change (rewritten, never deleted; the count only rises)

| Where | Today | Rewritten to | Approval |
|---|---|---|---|
| `lib/feed.signed-out.test.ts`, the PR-2 signed-in case, last assertion | signed in, no query names `trade_likes` or `discovery_events` | `discovery_events` is never named. `trade_likes` appears only in `likesAt`'s statement (`where l.viewer_id = $1`, the viewer as first parameter), once per page. **The original assertion moves verbatim into a new switched-off case**, and the signed-out cases stay unchanged. | **Owner: this relaxes a privacy guard** to a keyed read (Q3) |
| the same file, the PR-3 signed-in section case, last assertion | the same | the same restatement. The `union` count (`skips.length === 1`) is unchanged, because no PR-5 read uses `union` | **owner** (Q3) |
| the same file, the PR-4 case | 2 reads across `trade_rejects` and `trade_likes`, matched by `from trade_rejects…`; `trade_likes` never | `trade_rejects`: 2 reads, as today. `trade_likes`: 2 reads (`likesAt`), keyed by the viewer. The "never" assertion moves to the switched-off case. | **owner** (Q3) |
| `lib/feed.section.test.ts:91` (criterion 4) | the unfollowed trader c "reads after all of them"; k = 2 → c is row 3; k = 1 or 0 → no section | **(a)** The leave-out, k = 1 or 0 and "all hidden" assertions are kept. **(b)** The k-loop's follows go to traders sharing one bucket that holds no other candidate, so they create no personal candidate and the section stays in S2. **(c)** "Reads after all of them" becomes "reads below its exact twin". **(d)** A sibling case pins the same leave-outs in S3. | committee (the business lead ruled PR-4's restatement of this case) |
| PR-7 T4.1 `/reading activity/` and `SETTINGS.deleteItems` "any reading activity we stored"; PR-8 `RESET.explain`'s planned PR-5 sentence | assumes an event log | Only if the owner restates G2 and G4 (Q1): the phrase and its regex go, in PR-7 or PR-8 if they have not built yet, otherwise in PR-5. `RESET.explain` gets no PR-5 sentence. | owner (Q1) |
| **Unchanged by design** | `exclusions.test.ts:23` (`WEIGHTS`); `prefs.test.ts:28-31` (`prefFactor` untouched, "nothing positive before PR-5" stays true of it); the `likes.test.ts:24` and `follows.test.ts:22` scans, including "no discovery event table"; PR-7 T1.1, T1.3, T3.3 and BL C2's static guard; PR-8 T2.4 (no new viewer table); every signed-out case | — | — |

## 7. Independence test and build order

The test is applied against the order `plan-guardrails.md` round 2 fixed: **PR-7 after PR-4, PR-8 after PR-7 (no
longer parallel), then the Privacy PR.** File sets are from its §1.2 and §2.2.

| Rule (IMPLEMENTATION "Parallel development") | PR-5 commit 1 vs PR-7 | commit 1 vs PR-8 | commit 1 vs Privacy PR | commit 2 vs PR-7 | commit 2 vs PR-8 | commit 2 vs Privacy PR |
|---|---|---|---|---|---|---|
| 1 Waits on, or needs unmerged code | passes | passes | passes | **fails**: needs `viewerFlags`, `SECTION.personal`, "Feed settings" and the section's Following state | **fails**: G5's `ownLikes` and the `/me/liked` POST are in files it edits | **fails**: edits the `PRIVACY` sentences that PR adds |
| 2 File sets | passes: new `lib/discovery/personal.ts` and its test, an append to `weights.ts`, and an appended block in `lib/discovery/imports.test.ts` (PR-7 also adds a root there; the orchestrator treats the block as append-mostly) | passes: disjoint | passes: disjoint | **fails**: `lib/feed.ts`, `app/suggest-section.tsx`, `lib/copy.ts` `SETTINGS` and `SECTION` lines PR-7 changes | **fails**: `lib/likes.ts`, `lib/follows.ts` | **fails**: `lib/copy.ts` `PRIVACY` |
| 3 Schema | passes (none) | passes | passes | passes | passes | passes |
| 4 Same pinned behavior | passes: moves no ranking | passes | passes | **fails**: both move the ranking, and T1.1, T1.9 and the guard | passes | passes |
| 5 Protected path or the same owner stop | passes | passes | passes | passes | passes | passes |

**Order:**
1. PR-4 lands.
2. **PR-7**, together with **PR-5 commit 1** in its own worktree, database (`stock_social_f2_personal`) and ports
   (3130, 3131). Commit 1 passes every rule against PR-7, PR-8 and the Privacy PR, so it also keeps running while step 3
   runs.
3. **PR-8** (after PR-7's merge).
4. **The Privacy PR** (after PR-7 and PR-8).
5. **PR-5 commit 2.** It rebases commit 1 on the branch after the Privacy PR's merge. The PR merges once, by the owner.
6. **PR-6.**

Per BL §7, PR-5 commit 1 takes no reviewer slot from item #7 or the share-image font fix. The sequential PR-7 → PR-8
order lengthens the critical path to PR-5's merge by one PR cycle. Commit 1 is the only part of PR-5 that can use that
time, which is why it starts at step 2.

This amends `plan-guardrails.md` §0's "PR-5a and PR-5b wait on PR-7 and PR-8": only PR-5's merge (commit 2) waits on
them.

**Real (non-demo) viewers** still wait on all of:
- item #7 scheduled;
- the Privacy text live;
- the share-image font fetch fixed (packet Q8).

POLICY's "no public launch until counsel signs off" stands.

## 8. Criteria to restate (feature file, the owner's; one question, Q1)

| # | Today | Restated |
|---|---|---|
| 2 | "…a 'More like what you read' section built from their own event log (impressions, dwell, swipes, opens, shares, follows, watchlist, hides)" | "A signed-in viewer with 'Order my feed by my activity' on sees a 'More like what you follow and like' section built from their own follows, likes and hides. Reading signals, shares and the watchlist are not inputs until the owner adds them (G3)." |
| 3 | "Every event is written with viewer id, surface, target, type and timestamp only…" | "No event table exists. Personal ordering reads only `follows`, `trade_likes`, `viewer_exclusions` and `trade_rejects` for the session's viewer, and writes nothing. A test pins those tables' columns (no personal or brokerage data)." |
| 5 | "Raw events older than 90 days are deleted by a nightly job; deleting an account deletes its events and affinities the same day" | "Deleting an account deletes its follows, likes, hides and unfollow notes the same day (tested end to end). Personal scores are computed per request and never stored." |
| 7 | examples "similar holding period to @x", "trades symbols on your watchlist" | examples "Similar holding period to @x, who you follow", "You liked one of their trades" |
| 11 | "…the deterministic fallback when the model call fails" | "…the impersonal reason when the reason picker fails (no model in stage 1)" |
| G2 | "…zero trade hides, unfollow notes and reading activity…" | "…zero trade hides and unfollow notes…" |
| G4 | "…the watchlist and reading activity…" | "…and the watchlist…" |

## 9. Privacy text (the Privacy PR, then PR-5)

- **Part B (approved) is not pasted.** Nothing is recorded, and UX §10's share-note version is not needed either (S8).
- **The Privacy PR states the guardrails as shipped,** including BL C5's follow sentence.
- **PR-5 adds, the day it merges:**
  - **Follows:** "While 'Order my feed by my activity' is on, followed traders appear higher in your feed, and
    traders with a similar holding period can appear higher too."
  - **Likes:** "While it is on, traders whose trades you liked, and traders with a similar holding period, can appear
    higher."
  - **"Not interested" and "Hide this trade":** "…and traders with a similar holding period appear a little lower for
    those 90 days."
  - One line under Settings: "Turned off, your follows, likes and hides are kept but order nothing except that hidden
    traders and trades stay hidden, and nothing about your activity is recorded." This is the owner's newest decision.
- **The Watchlist replacement sentence is not applied** (S3).

## 10. Budgets

| Budget | Value | Test |
|---|---|---|
| Signed-in feed, switch on, heavy viewer | p95 < 800 ms | PR-5 load case, PR-6 |
| Scoring CPU per page (≤ 350 traders) | ≤ 10 ms (expected < 2) | PR-5, PR-6 |
| Extra viewer reads | 2 statements per page, keyed, ≤ 20 ms p95 together | PR-5 |
| Switch off | ≤ signed-out + 20 ms (PR-7 T7.L re-run) | PR-5 |
| Signed out | p95 < 400 ms; zero new queries (behavioral guard) | PR-5, PR-6 |
| Feed HTML | ≤ 500 KB per page | PR-5, PR-6 |
| Pure scoring at scale | 5,000 viewers × 500 candidates < 50 s, one core | PR-5 (`LOAD=1`) |
| Fleet | §3 PR-6 asserts | PR-6 |
| Dropped | `/api/events` p95, concurrent event batches, the 4 M event drain | — |

## 11. Owner questions (each with the default the build uses)

| # | Question | Default |
|---|---|---|
| Q1 | Restate criteria 2, 3, 5, 7, 11, G2 and G4 as in §8. This includes the heading "More like what you follow and like" (UX U1). | **Yes**, as written |
| Q2 | Pin the proposed values in §5: follow +5; like half-life 30 d, newest 500 within 180 d; follows newest 200; holding similarity 0.6 with tanh scale 6; m = clamp(1.25^r, 0.5, 2); the −4 of "Not interested" and of a reject also lowering the same holding bucket | **Build with them**, one constant each in `PROPOSED` |
| Q3 | Approve rewriting three assertions in `lib/feed.signed-out.test.ts` from "signed in never reads `trade_likes`" to "reads it only keyed by the session's viewer id", with the original kept verbatim for switched-off viewers and signed out. **This relaxes a privacy guard**, and PR-5 does not merge without it. | **Yes** |
| Q4 | The watchlist and symbol affinity are not ranking inputs, and there is no "Trades symbols on your watchlist" reason (counsel Q1's medium risk) | **Not inputs**; addable later with its own reason and Privacy line |
| Q5 | `share`: no event and no weight in PR-5 | **None**; returns with PR-5x |
| Q6 | After a mid-session unlike, unfollow, Reset or switch change, an open feed may skip a card until the next page 1 (repeats are already dropped). The alternative stores removal history for 2 days (~45 lines) and changes "Unlike deletes it at once". | **Accept the bound; store nothing** |
| Q7 | The opening swipe (+2, pinned) stays unused while G3 holds, because it is an "open" | **Dormant** |
| Q8 | PR-5 carries the Privacy sentences in §9, so the owner merges it by hand | **Yes**; the alternative is a same-day one-file Privacy PR |
| O3 | Hide duration (still open) | **90 days**, for trade hides and "Not interested" alike. The BL now backs this (BL §9) and the engineer agrees: one constant, no never-purged rows. A reject lowers its holding bucket for `PREF_DAYS` only. |

## 12. COMPLIANCE §1 checklist

1. **Performance shown, ranked or described?**
   - No new number. Section rows stay figure-free, and the pane carries the F3 disclaimer.
   - The order is the documented method × a bounded factor that reads neither the sign nor the size of a return (F1).
     It is documented on `/how#feed`.
   - Losses are liked, hidden and lifted like gains: sign-invariance property and mirror tests.
   - The section is ordered by the TR-9 lower bound in every state.
2. **Personal data?**
   - No new field, table, retention or write.
   - New purpose for existing rows: follows and likes now order the viewer's own feed, disclosed by §9's sentences
     before real viewers.
   - Read only for the session's viewer and only with the switch on. When it is off, nothing is read for ordering and
     nothing is recorded (owner decision).
   - Nothing is read or stored signed out.
   - Deletion is unchanged (G4 adds the watchlist to the first step in PR-7).
   - No co-visitation: F1's "never another viewer's data" holds.
3. **Money, rewards, points?** None. A like or follow earns nothing (F6).
4. **Email, push, SMS, tracking?** None. No implicit tracking (G3), no third party, no notification (F3b).
5. **User text?** None new. Reasons are fixed, scanned templates with no ticker or number slot.
6. **Sign-up, age, identity?** Unchanged. Only signed-in, attested viewers have inputs. The minors' feed laws (packet
   Q4) remain a residual risk, mitigated by G1 and by using no implicit signals.
7. **Vendor, dependency, font, outside asset?** None. No model.
8. **Screen reader and keyboard?** No new control. The heading is a real `h2` and the region name. Reasons are text in
   each row's accessible name. "Feed settings" is a real link, ≥ 44 px, with visible focus. Tested at 375 px, light and
   dark, keyboard and touch.
9. **Security?** No new endpoint, route or action. Every read is session-bound and keyed. The behavioral guard is
   restated keyed (Q3) and stays verbatim for switched-off viewers and signed out.
10. **Claims?** The heading, lines and reasons are true by construction (tested per state). No "AI", "for you",
    "suggested", "recommended" or "picked", no completeness claim, and no promise of an effect after an action.
11. **Checkout?** No.

## Sign-off

Engineer: **SIGNED** 2026-10-25. I would stake my name on building PR-5 (~400 product lines, two commits) and PR-6
(test-only) as written here. Every criterion in §8 as restated, and G1 and G3, map to a test in §6. The condition is
the owner's answer to Q3: without it, PR-5 can't read likes in `loadFeedPage`, and I would stop and ask rather than
move the read elsewhere.

Business lead: **PENDING**. Please check S4 (follow +5, accepted, and no watch weight), S5 (your bound with my base),
S6 (one PR as your split rule gives), S7 (PR-6 kept, test-only) and S8 (share: none, as you proposed).

UX lead: **PENDING**. Please check S2 (your R1 to R3 adopted), S3 (watchlist dropped, as U3), S8 (share: none, against
your D4), S10 (your four states, with S1 reduced to S0 by BL C9 and PR-7's T1.9, against your round-1 S1 line), and
S11 (removals bounded, not exact: against your §9 "misses none").

Both leads: §6.1 adopts `plan-guardrails.md` §13 for a design without an event table. Please confirm that the four C3
tests assert absence strongly enough.

SIGNED: engineer. PENDING: business lead, UX lead.
