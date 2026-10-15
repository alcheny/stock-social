# Spec: Variant A: inline honesty (TR-9 range + evidence line, TR-3/7/8 labels)

Variant: **A · Inline honesty (profile headline)** · Spec agreed by designer and business analyst

## Agreed spec

# Spec: Issue #11, Variant A · Inline honesty

Honesty goes into the numbers people already read. There are no new sections or components. The range and evidence line sit under the existing headline stat, and TR-3/7/8 are quiet muted labels under the name.

## 1. `lib/trades.ts`: `confidence()` (pure, no dependencies)

```ts
export type ConfidenceInput = Pick<ClosedTrade,'symbol'|'openedAt'|'closedAt'|'returnPct'|'holdingDays'>;
export type Tier = 'too-early'|'thin'|'moderate'|'strong';
export type Edge = 'positive'|'negative'|'unclear';
export type Confidence = {
  n: number; k: number; spanDays: number;
  tier: Tier; edge: Edge | null;
  perTrade: { low: number; mid: number; high: number } | null; // simple returns (0.013 = +1.3%)
  pace30: { low: number; mid: number; high: number } | null;   // per 30 days invested
  tradesPerMonth: number;
};
export function confidence(trades: ConfidenceInput[], today: Date): Confidence
```

**Inputs**
- Log return `x = ln(1 + returnPct)`. Clamp `1 + r` to at least 1e-9 so a -100% trade cannot produce -Infinity.
- Days held `d = max(holdingDays, 1)`.

**Clusters (K bets)**
- Group trades by symbol and sort each group by `openedAt`.
- Sweep through each group. A trade joins the current cluster if `openedAt <= the cluster's running max closedAt`. Otherwise it starts a new cluster.
- Overlap is inclusive of the boundary instant. A trade opened exactly when another closed is a different bet only if it opens strictly after.
- `K` is the total cluster count across symbols.
- `spanDays = (max closedAt − min openedAt) / DAY`, and 0 if there are no trades.
- `tradesPerMonth = n / max(spanDays, 30) * 30`. This is for display only.

**Tier**
- `K < 10` gives `too-early`, with `perTrade`, `pace30` and `edge` all null.
- Otherwise `K >= 100 && span >= 365` gives `strong`.
- Otherwise `K >= 30 && span >= 90` gives `moderate`.
- Otherwise `thin`.
- A tier-boundary test table is required: K 9/10/29/30/99/100 and span 89/90/364/365.

**Per-trade interval**
- `m = Σx/n`.
- `SE = sqrt(K/(K−1) · Σ_c (X_c − n_c·m)²) / n`.
- `half = t(K−1)·SE`.
- The interval is `[e^(m−half) − 1, e^m − 1, e^(m+half) − 1]`.

**Pace interval**
- `R = Σx/Σd`.
- `SE_R = sqrt(K/(K−1) · Σ_c (X_c − R·D_c)²) / Σd`.
- The interval is `e^(30(R ± t·SE_R)) − 1`.

**Zero spread**
- The SE is 0, so the interval collapses to the point estimate. No NaN and no division by zero.
- Guard `K−1 = 0` before computing. K=1 is always `too-early`, so it never reaches the SE code.

**Edge**
- `positive` if `pace30.low > 0`.
- `negative` if `pace30.high < 0`.
- Otherwise `unclear`.
- Negative edge is a first-class output.

**t quantile**
- A local `tCrit95(df)` returns exact table values for df 1..30 (12.706, 4.303, 3.182, …, 2.042).
- For df > 30 it uses an approximation that is exact at df=30 and tends to 1.96, for example `1.96 + 2.4/df`, or a Cornish-Fisher expansion. Document which one is used in a comment.
- Add a `ponytail:` comment: open positions (TR-4) are deferred, with closed trades only for now.

**Pure helper for TR-7**
- `isNewRecord(trades: {openedAt: Date}[], closedCount: number, today: Date): boolean`.
- It returns true if the days since the first trade's `openedAt` are `< 30`, or the closed trade count is `< 10`.
- Boundary tests are required. Under the rule "under 30 days of history", 29 days is new and 30 days is not. 9 trades is new and 10 trades is not.

**Helper for display text**
- `evidenceLine(c: Confidence): string`. Examples:
  - `Edge: unclear · Evidence: thin (30 bets, 60 days)`
  - `Edge: negative · Evidence: moderate (42 bets, 120 days)`
  - Too early: `Too early to tell (4 of 10 bets)`, with no edge text.
- It returns plain text and is shared by the profile, the share card and the metadata.
- `rangeText(c)` returns `"(-0.1% to +2.7%)"` using `pct()`, or null when `perTrade` is null.
- Copy must never contain "skill", "proven" or "guaranteed". A test greps the output of every tier and edge combination for those words.

## 2. Unit tests (`lib/trades.test.ts`, or a new `lib/confidence.test.ts`)

- Overlap clustering:
  - Two same-symbol trades with overlapping holds count as K=1 for the pair.
  - Different symbols with the same dates are separate clusters.
  - Back-to-back non-overlapping trades are separate clusters.
- K<10 returns `too-early` with null intervals and null edge.
- K=0 and K=1 return safely with no throw and no NaN.
- Hand-computed example:
  - Use 10 single-trade clusters with returns whose logs are e.g. ±0.02 alternating.
  - Compute `m`, `SE` and `half` by hand in a comment, then assert to 1e-6 with df=9 and t=2.262.
- Zero spread:
  - 10 identical returns give low == mid == high, and no NaN.
  - Edge is positive if the return is > 0.
- Tier boundaries per the table above.
- Edge classification: positive, negative and unclear.
- A negative edge renders with equal prominence in `evidenceLine`.
- `isNewRecord` boundaries at 29/30 days and 9/10 trades.
- No banned words.

## 3. Profile (`app/u/[handle]/page.tsx`)

Load extra data in `load()`, with no schema change:
- Brokers: `select distinct raw->>'institution' as inst from activities where user_id=$1 and source='snaptrade'`, and `count(distinct account_id)`.
- Selecting `opened_at` from `closed_trades` is also required, because `confidence` needs it.
- Demo users have `raw = {demo:true}`, so there is no institution. Use "Demo data" instead of a broker name.

**Under the name** (the existing muted line, plus one more `muted small` line; no new component):
- Line 1 is unchanged: `@handle [Verified/Demo badge]`.
- Line 2 is `Record since Mar 4, 2026 · Connected: ‹broker name› (2 accounts)`.
  - The date is the first `openedAt`, formatted en-US.
  - If the institution is unknown, show `Connected: broker (1 account)`.
  - Demo shows `Record since … · Demo data`.
- New-record badge: when `isNewRecord`, render a small pill `New record` next to the handle, reusing the existing Badge styling or a plain `<span className="badge">`. It has no celebration styling.
- TR-8 line: the same muted line ends with `Only trades from connected accounts are shown.` Copy must never say "all of their trades". Test with a grep over the profile source and the e2e text.

**Headline (the second big stat, avg return)**
- The value stays `+1.3%` with the label `avg return / trade`.
- Directly under it, inside the same `.stat`, add a muted `<small>` with the range.
- When `perTrade` is non-null: `(-0.1% to +2.7%)`, with `95% range` as the label text. For example, `+1.3% per trade (-0.1% to +2.7%)` appears as the combined accessible text, using the `aria-label` below.
- When `K<10`: the range is omitted. The `<small>` shows `Too early to tell (K of 10 bets)`.
- Below the two big stats, add one full-width line `<p className="evidence">` with `evidenceLine()`, for example `Edge: unclear · Evidence: thin (30 bets, 60 days)`.
- Negative edges use the same size, weight and position as positive ones. The only difference is that the word and the colour class follow `up`/`down` on the edge word. Losses are never softened.
- Win rate stays unchanged, and its tile has no range because TR-9 covers the average return only.
- Add a short note on tap, using a native `<details>` element with the summary `What's this?`. The body reads: "95% range from independent bets (same-stock trades that overlap count as one). A wider range means less evidence." This is accessible and needs no JS.
  - It is still part of the evidence line block and not a new section.
- Headline stats and the share card always use all-time data. The chart range selector is unchanged and stays secondary.
- Exclusions, drawdown labels and "Every trade" are unchanged.

**CSS** (`app/globals.css`, tokens only):
- `.evidence` is a `muted` 0.9rem line, wraps at 360px, and has no horizontal overflow.
- Range text sits in `.stat small` and wraps.
- The pill is rounded with a muted border.

**Metadata description**
- `generateMetadata` appends the evidence tier: `… avg return · Evidence: thin`.

**States**
- Empty (no trades): none of the new elements render. `Record since` and the confidence line only render when `trades.length > 0`.
- Loading: server-rendered, so no loading state.
- Error: if `confidence` somehow returns NaN, treat the interval as null and show the too-early copy. Guard with `Number.isFinite`.

## 4. Feed ranking (`app/page.tsx`)

- Trader ranking should sort by the pace-interval lower bound. The feed is trade-card based, so compute `confidence()` per visible trader in JS from the batched `rows` query.
  - Add `opened_at` to that query.
  - Fetch a wider candidate set (for example LIMIT 200 by the current SQL recency ranking), then re-order the cards in JS.
  - Sort key per card: `lowerBoundAbs(trader) × existing magnitude-recency score`.
  - Equal-size losses and gains must rank the same. The rule `abs(return_pct)` stays in the SQL magnitude term.
  - The trader multiplier uses the lower-bound distance from zero: `max(|pace30.low|, |pace30.high|)` is wrong, because it would favour wide ranges.
  - Use `evidenceWeight = pace30 ? Math.max(0, pace30.low, -pace30.high) : 0`, which is the confident distance from zero in either direction.
  - A trader whose interval straddles 0 (or who is too early) has weight 0. Those cards sort after confident ones and keep the recency order among themselves.
  - Keep the existing `having count(*) >= 5` rule.
  - Slice to 50 after sorting.
- This one change is the only feed change in variant A. The cards themselves are unchanged and carry no chips (that belongs to variant C).
- The feed must work signed out.

## 5. Share card (`opengraph-image.tsx`)

- Select `opened_at` too.
- Under the three big numbers, or in the left column, add one line (font 30, `#8b8b98`) with `evidenceLine()`.
- Replace the third tile label with `trades · losses included`.
- Show `New record` as a small text label if `isNewRecord`.
- Always all-time. The card has no range text, only the evidence label, to avoid clutter at 1200×630.

## 6. Acceptance mapping and E2E (`tests/e2e`)

- The demo profile shows `Edge:` and `Evidence:` or `Too early to tell`. All demo traders are thin or too early.
- `Record since` appears.
- The `Demo data` label appears on demo profiles. The Demo badge is still shown.
- No page text contains "skill", "proven", "guaranteed" or "all of their trades".
- A 360px viewport has `scrollWidth <= innerWidth` on the profile.
- The feed returns 200 and renders signed out.
- Feed ordering test (unit, on a pure `rankTraders` helper in `lib/trades.ts` or `lib/pane.ts`): a trader with a confident edge outranks one with a higher average return but a wide interval. Mirror-image gain and loss traders tie.
- No dollar amounts, quantities or prices are added anywhere. The `$` characters in the new copy are only code.

## 7. Out of scope
TR-4, TR-5, TR-6, schema or protected-path changes, new dependencies, feed card chips, and a trust panel.

## Designer ⇄ business discussion

### Round 1

**Designer:** Variant A puts a 95% range and one evidence line directly under the existing avg-return headline. TR-3/7/8 become one quiet muted line under the name, and the feed re-ranks traders by the pace-interval lower bound. There are no new sections or components.

**Business analyst (approved):**
- Ease of use: Good. The range sits next to the number people already read, and one plain evidence line sits under it. "Too early to tell (4 of 10 bets)" is clear to a first-time visitor. The native details "What's this?" explains the range without adding a section. The record-since and broker line under the name is quiet but readable at 360px.
- Retention: Moderate. "Too early (4 of 10 bets)" gives traders a visible reason to keep connecting and building history, and it rewards independent bets rather than trade frequency, because overlapping same-stock trades count as one bet. The New record badge sets honest expectations for new traders and avoids punishing them. Visitors get no new reason to return beyond the existing feed.
- Virality: Good for trust, modest for reach. The share card now shows the evidence label ("Edge: unclear · Evidence: thin"), which makes a shared link more credible and harder to dismiss as cherry-picked. The card has no range text, which keeps it clean at 1200×630. Negative edges render with the same prominence as positive ones, so the card cannot be gamed. Growth stays subordinate to trust, as the standing direction requires.
- Feedback: Approved. Implement these points as written:
1. Feed ranking: when most traders have evidenceWeight 0 (all demo and early traders), multiplying by 0 makes every score tie. Sort explicitly by confident-first (weight > 0), then by weight times the magnitude-recency score, then by the existing recency/magnitude score as the tiebreak. Add a unit test that covers the all-zero-weight case, plus mirror-image gain and loss traders tying.
2. Keep the `having count(*) >= 5` rule and the LIMIT 200 candidate fetch. Slice to 50 after sorting, and make sure signed-out rendering is unchanged.
3. Make sure the "Edge" word colour (up/down) is not the only signal. The word itself ("positive", "negative", "unclear") carries the meaning.
4. Banned-word test: also cover the share card and metadata strings, not just evidenceLine. Add "all of their trades" to the grep.
5. For the K<10 profile state, show the "Too early" copy and no range, as specced. Do not show a fabricated interval at all.
6. Demo traders keep the Demo badge, and "Demo data" replaces the broker name.
No other changes needed.

## QA log

| Round | By | Result | Findings |
|---|---|---|---|
| 1 | checks | ✖ fail | [bug] E2E: Running 14 tests using 1 worker [1/14] e2e/app.spec.ts:4:1 › feed works signed out and shows losses alongside gains [2/14] e2e/app.spec.ts:12:1 › profile shows headline stats and excluded positions [3/14] e2e/app.spec.ts:20:1 › profile chart is labeled, accessible and links points to trades [4/14] e2e/app.spec.ts:40:1 › chart: arrow keys move the active trade and Enter opens it [5/14] e2e/app.spec.ts:56:1 › chart: horizontal drag scrubs and opens on release; vertical scroll is not captured 1) e2e/app.spec.ts:56:1 › chart: horizontal drag scrubs and opens on release; vertical scroll  |
| 2 | tester | ✅ pass | [note] app/u/[handle]/page.tsx headline: The edge word comes from the pace-per-30-days interval, but the range shown under avg return is the per-trade interval. The two can disagree, e.g. 'Edge: positive' next to a per-trade range that touches 0. A short clarification in the 'What's this?' text would help. · [note] app/u/[handle]/page.tsx headline: The spec asked for an aria-label giving the combined accessible text ('+1.3% per trade (-0.1% to +2.7%)'). It is not present. The visible text 'range · 95% range' is the only label. · [note] app/u/[handle]/page.tsx:~60: The 'Connected' line falls ba |

## Cost

6 role calls, $1.37 total: designer#1 $0.16, business#1 $0.07, engineer#1 $0.55, engineer#2 $0.22, engineer#2 $0.24, tester#2 $0.12
