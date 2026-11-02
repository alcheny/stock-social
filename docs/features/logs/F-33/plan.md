# F-33 implementation plan (UX lead, 2026-11-02)

Feature: `docs/features/F-33-ranking-weight-needs-evidence.md`. Owner decisions applied unchanged: OD 2.33 (near-edge
distance from 0), cycle-5 Q3 (weight from the moderate tier, 30 bets AND 90 days, 1-point spread floor inside the error
term), OD 2.32 (one arithmetic range rule; zero width prints "Too early to tell"; "average per trade so far, likely
between X and Y"). OD 2.34 stays open. TR-9 text and CLAUDE.md:92 are referenced, never edited. Read-side only: no
schema change, no rebuild, no MATCHER_VERSION bump. Tests are written first (§5), then the code.

## 1. Ranking weight

The orchestrator's proposal is accepted, with three changes: the floor scales with trades per bet (so it is "per trade",
as decided), the clustering runs once, and the span comes from one helper shared with `confidence()`.

**Module boundaries**
- `lib/confidence.ts` (constants, no logic change): `RANK_MIN_BETS = MODERATE.bets` (30), new
  `RANK_MIN_DAYS = MODERATE.days` (90), new `SPREAD_FLOOR = 0.01`. Rewrite the RANK_MIN_BETS comment (it says lucky
  streaks "can't climb the feed"; new comment: the tier raises the cost of a lucky streak and does not close the
  hold-losers path, OD 2.34).
- `lib/bets.ts`: `BetInput` gains an optional `holdingDays`; `Bet` gains `days` = Σ max(holdingDays ?? 1, 1). Split
  `arithmeticRange` into `arithmeticFromBets(bets, n)` (the current body) plus the wrapper, so `rankWeight` clusters once.
  Printed output is byte-identical (the existing `lib/bets.test.ts` pins stay green, unchanged).
- `lib/trades.ts`: export `recordSpanDays(trades)` = (latest close − earliest open) / DAY; `confidence()` calls it.
  `evidenceWeight` is deleted (every caller retargeted, §5). `rankTraders` is unchanged.
- **New `lib/rank-weight.ts`** (pure; imports bets.ts, confidence.ts, trades.ts types and `tCrit95`):
  `RANK_FORMULA = 'f33.1'`, `paceInterval(bets, n)`, `rankWeight(trades: ConfidenceInput[]): number`.
- `lib/feed.ts#weights()`: `evidenceWeight(confidence(ts, asOf))` becomes `rankWeight(ts)`. The rows it reads are
  unchanged: **no SQL change anywhere in the feed**, so no EXPLAIN test. `lib/discovery/section.ts` code is unchanged (it
  reads `TraderFacts.weight`).

**Formulas** (K bets b, each with S_b = Σ simple returns, D_b = Σ max(hold days, 1), n_b trades; n = Σ n_b):
```
R      = Σ S_b / Σ D_b                                  (return per day held, simple returns: OD 2.32)
ss     = Σ (S_b − R·D_b)²
v      = max(ss / (K−1), SPREAD_FLOOR² · n / K)         (per-bet variance; floor = 1 point per trade, averaged over bets)
se     = √(K · v) / Σ D_b                               (unfloored, this is confidenceFromSums' seR form on simple returns)
t      = tCrit95(K − 1)
pace30 = { low: 30(R − t·se), mid: 30R, high: 30(R + t·se) }
weight = 0 unless  tierFor(K, recordSpanDays) ∈ {moderate, strong}           (30 bets AND 90 days, both ≥)
              and  arithmeticFromBets(...).half ≤ TOO_WIDE_HALF_WIDTH       (F-4: a too-wide record never ranks ahead)
              and  every value finite
         else max(0, pace30.low, −pace30.high)                              (OD 2.33, method (c))
```
- When every bet is one trade the floor is exactly the brief's `max(ss/(K−1), 0.01²)`. A bet of several overlapping
  trades gets a proportionally larger floor (variances add), so the floor never rewards scaling into one position.
- Exact mirror: negating every return negates R and every residual; ss and v are equal, so +5% and −5% records weigh
  exactly the same (today's log weight ties +5% with −4.76%, not −5%).
- No `log1p`: the weight is the simple near-edge distance, as /how will say it.
- The floor enters only the weight. No printed range reads `paceInterval` or `SPREAD_FLOOR`.

**Cache** (`lib/feed.ts`): `export const weightKey = (id, p, formula = RANK_FORMULA) => \`${formula}|${id}:${p.n}:${p.m}:${p.k}\``,
plus two tiny wrappers `weightCacheGet(key)` / `weightCacheSet(key, w)` that `weights()` uses (the eviction moves into
`weightCacheSet`). A deploy starts a new process (empty Map) and the formula in the key covers any process that keeps
the module across a code change. No weight is persisted anywhere (checked by test, §5 AC9).

**States**
| State | Weight | What the viewer sees |
|---|---|---|
| Empty record | 0 | unchanged |
| New trader / under 30 bets or under 90 days | 0 | base order (size × recency), visible, stable tie-break; /how says why, not a penalty |
| At tier, range crosses 0 | 0 | base order |
| At tier, all losses / clear loss | −high30 | ranked like the mirrored gain |
| Too wide (half > 10 points) | 0 | unchanged "too wide" wording |
| Zero-width printed range at the tier | > 0 via the floor | "Too early to tell" (§2); see Risk R2 |
| Demo | same rule | Demo badge unchanged; excluded from the readout figure |
| Signed out | same rule | same order for everyone |

## 2. Printed ranges: zero width

**Definition.** A range has zero width when `pct(low) === pct(high)`, the strings it would print (lib/format.ts, one
decimal; `0.0%` and the `≈` forms included). New helper `zeroWidth(iv)` in `lib/confidence.ts`. Why the printed values:
the defect is what the reader sees ("+1.0% to +1.0%"); the red team's jitter range is not zero unrounded but prints as
zero; `trustSign` already reads printed values (code review 2026-11-01), so verdict and range use one rounding; any
unrounded epsilon would be arbitrary and still let "+1.0% to +1.0%" through.

**Evidence.** In `cardEvidence` (arithmetic) and `confidenceFromSums` (log path): a zero-width `perTrade` gives
`tier: 'too-early'`, `edge: null`, `perTrade` kept (as a too-wide range is kept). So no "Past results: above zero",
no "clear pattern", and `Evidence: too early` everywhere.

**One producer.** `RECORD_STRIP.early` stays the only "Too early to tell" literal. Add one builder beside it in
`lib/copy.ts`: `earlyOf: (k, min) => k < min ? \`${early} (${k} of ${min} bets)\` : early` (today's literal form for
under 5 bets, the plain words otherwise). `lib/trades.ts` and `lib/confidence.ts` import `RECORD_STRIP` from copy.ts
(no cycle: copy.ts imports format, paging, public-wire, discovery/weights, open-split, none of which import back; the
engineer confirms with a plain `node -e "import('./lib/trades.ts')"`). `rangeText` and `evidenceRangeText` return null
for a zero-width range.

| Surface | Zero-width output (visible = accessible) |
|---|---|
| Share card, `lib/record-card.ts:290` (unfurl, square, story) | range slot prints `RECORD_STRIP.early`; `cardAlt` and `cardDescription` carry the same words |
| Share prompt, `app/u/[handle]/share-prompt.tsx` | quotes the card's range only when it is a range (the page passes null when the card range is `early`) |
| Record strip, `lib/record-strip.ts` (feed card, trade/month pages and images) | already prints the `early` part once tier is too-early; alt "too early to tell" |
| Profile stat block, `app/u/[handle]/page.tsx:339` | no range (PR-2b: said once, in the evidence line) |
| Profile / tools / recap evidence line, `evidenceLine` | `${early}: the returns so far are too alike to give a range (N bets)`; no "Past results" |
| Trust line, `trustLine` | `Based on N trades. ${early}: the returns so far are too alike to give a range.` |
| Swipe pane, `lib/pane-evidence.ts` → `app/pane.tsx:81` | `rangeLine = RECORD_STRIP.early` when a range exists but has zero width (under 5 bets unchanged) |
| Display log, `lib/display-log.ts` | `rangeText` null, `evidence` the new line (it logs what is shown) |
| `app/t/[symbol]/page.tsx:128,159`, `HoldTime.tsx:31`, `Concentration.tsx:30`, `app/t/compare/page.tsx:85` | `range ? \`${range} · 95% range\` : RECORD_STRIP.earlyOf(c.k, MIN_BETS)`; the literals go |
| Ticker baseline, `lib/ticker.ts:400` | a null range takes the existing "no ranges" sentence pair |
| Tools card, `lib/record-tools.ts:229` | `range` null; `low` null too (it must not print the low end alone) |
| Options, `lib/options-view.ts:35`, `app/u/[handle]/options-block.tsx:46` | range slot prints `RECORD_STRIP.early` (gate via `zeroWidth`) |

**OD 2.32 wording: struck from this build (orchestrator ruling 4, BL round 2 D3).** The card label change to the
owner's words "average per trade so far, likely between X and Y" (the `perTradeSoFar` label, the unfurl label split,
the open-positions column, the snapshot and image-hash updates) is not built here. It moves pinned image layouts
(ENG demands 2-4) and is not an F-33 acceptance criterion. It is filed as a scheduled hand-off in the feature file
(Hand-offs) with the owner's exact words, and the PR says in one line that it is not delivered.
- "Too early to tell" (17 glyphs) is shorter than any printed range, so the zero-width state cannot overflow.

## 3. /how copy (lib/copy.ts)

`HOW_PERSONAL.text`, replacing the sentence "Records with at least 10 independent bets … a clear gain." (the opening, the
48-hour sentence and everything from "Signed out" on stay word for word):

> Sign is never used, so a loss ranks like a gain of the same size. The base order uses how large each return is and
> how recent the close is (a close counts about a third as much after each 48 hours). A record gets ranking weight
> once it has at least 30 independent bets over at least 90 days and its per-trade range is no wider than 10 points
> either side. Its weight is how far the likely range of its return per 30 days held sits from zero, measured from the
> end nearest zero: the low end when the whole range is above zero, the high end when the whole range is below zero,
> and no weight when the range crosses zero. For this weight the spread between trades counts as at least 1
> percentage point, so a run of nearly identical returns does not look more certain than it is. Records with weight
> come first, ordered by weight times the base order, a clear loss as much as a clear gain. Only closed trades count
> toward the weight; open positions are shown on the record but are not part of it yet. A record with fewer bets or
> a shorter history carries no ranking weight yet. That is not a penalty: a short record says little either way, so
> it keeps its place in the base order, stays visible, and gains weight once it reaches 30 bets over 90 days. Signed
> out, everyone gets the same order. …(unchanged)

New `HOW.math` bullet (after the headline-stats bullet), OD 2.32 on the page that documents the math:

> The likely range is a 95% range around the average return per trade, from independent bets (trades in one stock
> whose holds overlap count as one bet). When it would print with no width, for example when every trade so far
> returned the same, the record shows "Too early to tell" instead.

(`"${RECORD_STRIP.early}"` in the template; RECORD_STRIP is defined above HOW.) The numbers 48, 30, 90, 10 and 1 stay
written out (copy.ts is client-safe and confidence.ts will import copy.ts) and tests tie each to its constant
(RECENCY_HOURS, RANK_MIN_BETS, RANK_MIN_DAYS, TOO_WIDE_HALF_WIDTH × 100, SPREAD_FLOOR × 100). No "top", "best",
"proven", "skill", "can't" or "cannot". COMPLIANCE §12: the /how change is a product statement, so the build PR adds a
dated line to §12's /how history (a doc line, not a protected path).

## 4. F-15 readout: counts-only line

- `scripts/f15-readout.ts`: `ReadoutInput.ranked?: number`. In "This week's facts" block:
  `- records with ranking weight above 0: <cell>` where the cell is `0`, `<5` for 1 to 4, or the count; `not loaded`
  when the input lacks it. One definition line, exported as `RANKED_LINE`: "Counts visible records that are not Demo
  and whose ranking weight is above 0 at the time of the run (30 or more independent bets over 90 or more days and a
  likely range clear of zero). A count only: no handle, no id, no return." A single cell with no total or difference
  row, so complementary suppression has nothing to protect beyond "<5".
- Loader `loadRanked(sql)` in the same file, called from `main()`: one statement, closed trades of users with
  `deleted_at is null` and not `demoUser(...)` (the G1 query's own predicates; if #100's F-16 extends `visibleUser`
  with "hidden" before this merges, add that predicate too), grouped by user as `weights()` does; `rankWeight` per user
  in JS; returns the count above 0. Owner-run weekly script, not a request path: no EXPLAIN test (ponytail below).

## 5. Tests (written first; none deleted; the count only rises)

| AC | Test (file) |
|---|---|
| 1 probe | `F-33 AC1: ten +1%, the jitter record and ten −1% each weigh less than the 200-bet record` (new `lib/rank-weight.test.ts`): fictional records rebuilt from the feature file's probe |
| 2 zero width | `F-33 AC2: a zero-width range prints Too early to tell on every printer` (new `lib/zero-width.f33.test.ts`): exact +1% ×10, ×40 over 120 days, and the jitter record through recordCard (+ alt, description), recordStrip (text, alt, image lines), paneEvidence, evidenceLine, trustLine, rangeText, evidenceRangeText, toolsFigures low, optionSummary view, earlyOf; plus `only lib/copy.ts holds the literal`: no "Too early to tell" in app/ or lib/ sources outside copy.ts (tests excluded) |
| 3 boundaries | `F-33 AC3: 29 bets no weight, 30 bets weight` and `89 days no weight, 90 days weight` (rank-weight.test.ts), spans built to the exact millisecond |
| 4 property | `F-33 AC4: at the tier, rankWeight equals the OD 2.33 reference and rankTraders keeps its order` (rank-weight.test.ts): 500 records from an inline seeded PRNG (K 30–150, span 90–500 days, mean −5..+5%, spread 0–8%, random holds, both signs); an independent reference near-edge in the test; equal scores; rankWeight within 1e-12 of the reference |
| 5 below tier | `F-33 AC5: below the tier the feed keeps score order with a stable tie-break; trade count never decides` (rank-weight.test.ts): weight-0 records sort by score, ties keep input order in both input orders, a 200-close and a 20-close record at equal score swap only with the input |
| 6 symmetry | `F-33 AC6: a record and its negation weigh exactly the same` (rank-weight.test.ts, `assert.equal`, over the AC4 records too) |
| 7 hold-losers | `F-33 AC7: 30 winners at +1% (10 losers held open) never outrank a 200-bet record with the same closed figures` (rank-weight.test.ts; passes: K = 30 gives t·se wider than K = 200, equal scores) + `test.todo('OD 2.34: losers held open at −20% lower the ranking weight (open positions in the range)')` |
| 8 floor vs print | `F-33 AC8: at or above the 1-point floor the floor changes nothing; no printed range reads the floor` (rank-weight.test.ts): floored = unfloored pace interval when every bet's spread ≥ 1 point; cardEvidence / arithmeticRange outputs for the random set equal `arithmeticFromBets` before the split (the existing bets/record-card pins stay unchanged) |
| 9 cache | `F-33 AC9: the weight cache key carries the formula; an old-formula entry is never served` (new `lib/feed.f33-cache.test.ts`): set under `weightKey(id, p, 'f-old')`, `weightCacheGet(weightKey(id, p))` is undefined; `weights()` builds keys only through `weightKey` (source check); no SQL in lib/ writes a weight |
| 10 readout | `F-33 AC10: ranked records print <5 from 1 to 4, exact from 5, 0 at 0, not loaded when missing` (`scripts/f15-readout.test.ts`) |
| /how | `F-33: /how states the tier, the floor and near-edge from the constants, never "top/best/proven/skill/can't"` (new test in `lib/fixes-cycle3.test.ts`) |
| layout (struck: card wording hand-off) | ~~`F-33: every unfurl label row fits its column at the "so far" wording`~~ (record-card tests) and a Playwright 360 px screenshot pass of unfurl/square/story with and without open positions and with a zero-width record |

**Retargeted (same test, same intent, new rule):**
- `lib/confidence.test.ts:109-120` → `rankWeight`, records of 40 bets over 120+ days, mirror at −5% with `assert.equal`.
- `lib/confidence.test.ts:205` → the 200-bet too-wide record (`big`) has `rankWeight` 0.
- `lib/confidence.test.ts:211-218` → "F-33: ranking weight starts at the moderate tier": RANK_MIN_BETS 30,
  RANK_MIN_DAYS 90; tight(6/9/29) weigh 0, tight(30) over 90+ days weighs > 0; the "shown from 5 bets" line stays.
- `lib/ranking.f19.test.ts`: RANK_MIN_BETS pin 30; PIN_WEIGHTS recomputed with rankWeight (A > 0, B and C 0), PIN_ORDER
  and PIN_A unchanged.
- `lib/record-card.rework.test.ts:130-135` → k ∈ {5, 7, 9, 29} show a range and weigh 0; 30 bets over 90+ days > 0.
- `lib/discovery/section.test.ts:27` → `rankWeight`; the mirrored fixture built in simple returns so the strict 1e-12
  tie still holds; expected orders re-derived (trader 5, 12 bets, now weighs 0), never loosened.
- `lib/fixes-cycle3.test.ts:22` unchanged (the substring survives) plus `over at least ${RANK_MIN_DAYS} days`.
- `e2e/app.spec.ts:1023` → `rankWeight`; the heavy fixture today has K = 8-9 (thin, measured), so its 30 oldest closes
  get distinct fictional symbols spread over the record's 3,600 days; the "> 0" assertion stays.
- Any existing fixture of identical returns whose expected text was a zero-width range or "Past results": the
  engineer adds a jitter wide enough to print, keeping the assertion, and lists each in the build log.

## 6. COMPLIANCE §1

1. Performance shown/ranked/described: **yes** (§2). Disclaimers unchanged on every surface (/how keeps its
   Disclaimer after the math). No advice words. Losses rank exactly like gains (AC6 exact equality). Evidence labels
   per DESIGN §5.2 kept; a zero-width range loses its verdict. Rankings are a counsel-listed area (POLICY): the method
   is the owner's call of 2026-11-02 (OD 2.33, Q3); the /how text goes to the AI legal committee in review.
2. Personal data: no new field or store. The readout prints one count, "<5" under 5, to a file outside the repo, with
   no handle, id or return.
3. Money, prices, rewards: no. Nothing rewards frequency; the floor grows with trades per bet, never helps them.
4. Email, push, SMS, tracking: no.
5. User-written text or images: no.
6. Sign-up, age, identity: no.
7. Vendor, dependency, font, outside copy: no (no new dependency; the PRNG is inline).
8. Screen reader / keyboard: "Too early to tell" is text, and every alt/description is built from the same model, so
   visible = accessible; no colour-only state; no new controls.
9. Security posture: no.
10. Claims: /how is true to the code (tests tie numbers to constants), says the weight is closed-trade only, and never
   says small samples "can't" rank ahead.
11. Checkout, trial, renewal: no.

## 7. Risks, limits, questions

- **R1 (question for the orchestrator, then the owner): the section's tie-break.** `lib/discovery/section.ts#byEvidence`
  orders weight, then closes counted (n), then id (F-2, criterion 8). After F-33 many more records weigh 0, so their
  section order leans on n, which reads against "no order ever uses trade count" and would fail AC5 if AC5 covered the
  section. Plan: leave F-2's order as is, scope AC5 to the feed (rankTraders), and add the question to the feature file's
  Open questions. If the owner wants it, the switch is score in place of n (one line, one retargeted test).
- **R2 (informational): zero width at the tier.** A record of 30+ near-identical returns over 90+ days prints "Too
  early to tell" yet carries weight through the floor. Both are owner decisions; /how explains each. UX review checks it
  reads acceptably.
- **R3 (scope): OD 2.32 on the log printers.** The ticker pages (pooled, clustered in SQL), recap, trade-share and the
  tools card still print confidence()'s log range. F-33 gives them the zero-width rule only; moving them to arithmetic
  needs SQL changes with an EXPLAIN rows-read test and is a separate item (ponytail; the orchestrator confirms).
- **R4:** heavier ordering change at launch: with seeded/demo data few records reach 30 bets over 90 days, so the feed
  mostly falls back to the base order. Expected, and what the owner chose.
- **R5:** #100 and #102 edit `lib/feed.ts`; build on main after both, re-run the cache and section tests after merging.

Ponytail markers to add:
- `lib/rank-weight.ts`: `ponytail: closed trades only; losers held open don't lower the weight (OD 2.34) — fix: count
  each open position as a provisional bet at its unrealized percent and days held so far.`
- `lib/record-card.ts:208` (extend the existing one): `ponytail: ticker pages, recap, trade-share and the tools card
  print confidence()'s log range, not OD 2.32's arithmetic one — fix: move othersConfidence's sums to simple returns
  (EXPLAIN rows-read test) and the per-trader ones to cardEvidence.`
- `scripts/f15-readout.ts#loadRanked`: `ponytail: reads every visible record's closes once a run — fix: read the feed's
  cached TraderFacts or a per-user summary when records grow.`

Rollout: one PR; deploy restarts the process; `RANK_FORMULA` guards the cache; no data migration; reversible by revert.

**Pre-authorization requests: none.** No protected path, dependency, vendor, secret or counsel stop is needed.
