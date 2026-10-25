# F-4 PR 1 · Committee · UX lead

Date: 2026-10-24. Build under review: `0666990..2da6953` (worktree `agent-af2a9d77f0b6999cf`), the TR-9 floor of
5 bets and the 10-point width. I checked it against the owner's decisions in `docs/features/F-4-share-card.md`,
`plan.md` PR-1, my sign-off (`plan-signoff-ux-lead.md`, which accepted the `tooEarlyText` wording), POLICY (F1, F3,
F3b, A1) and DESIGN TR-7 and TR-9. Nothing here is legal advice.

## Method

- **Preview.** I used the shared preview on :3600 with the `stock_social_f4` database. I did not rebuild or stop the
  server.
- **Viewer.** A first-time viewer, signed out, arriving from a shared link.
- **Browser.** Playwright Chromium at 360 px (light) and 375 px (dark), full-page screenshots.
- **Fixture users.** 14 users, namespaced `uxf4p1_`, all verified closes. I created them, then deleted them along with
  their `signup_attempts` rows. Counts after the delete: 0 users, 0 closes.
  - `four`: 4 bets.
  - `five`: 5 narrow bets (thin, above zero).
  - `neg`: 6 narrow bets (thin, below zero).
  - `wide`: 8 wide bets.
  - `grp`: 12 trades in 3 overlapping positions.
  - `grpw`: 18 trades in 6 wide positions.
  - `big`: 40 wide bets over 198 days.
  - `t1`–`t7`: seven traders behind four tickers:
    - UXTW: wide, 9 bets, with one leading trader;
    - UXTN: narrow, 8 bets;
    - UXT4: 4 bets;
    - UXTO: 7 trades in 2 overlapping positions.
- **Pages visited at both widths.**
  - The profile of each fixture user.
  - `/t/UXTW`, `/t/UXTN`, `/t/UXT4` and `/t/UXTO`.
  - `/t/compare` for UXTW vs UXT4, and UXTN vs UXTW.
  - The trade page for `wide`, `five` and `four`.
  - The September month page for `wide` and `five`.
  - The feed.
  - The OG images of `/t/UXTW`, `/u/uxf4p1_big` and one trade.
- **Screenshots.** In `screenshots/pr1-ux/`, named `<page>-<width>-<scheme>.png`, plus `og-*.png`.
- **Feed section.** I scrolled 12 pages and the suggestions section never rendered on this database (fewer than 3
  rows qualify), so I judged C3's slot change from the code and the engineer's log.

## What works

- **The old floor is gone.** No page visited carries "of 10 bets" or "10 independent". Every K < 5 line reads
  "Too early to tell (4 of 5 bets)", and every overlapping case reads "Too early to tell: 12 trades in 3 overlapping
  positions (5 independent bets needed)". The wording is the same on the profile, ticker, compare, hold-time,
  baseline and trade pages, because one helper writes it.
- **The range shows from 5 bets.** At 5 and 6 narrow bets the profile reads "(+0.9% to +1.7%) · 95% range" and
  "Past results: above zero · Evidence: thin (5 bets, 27 days)". The negative record reads "below zero" the same
  way, in the down colour and in words.
- **A too-wide record keeps its range and draws no verdict.** On the profile the range sits in the stat, with "Too
  early to tell: the range is still too wide (8 bets, 45 days)" directly under it. The sentence refers to the range
  the reader has just seen. "Too early to tell" appears once.
  - The ticker baseline draws no "sits above" or "sits below" verdict on a too-wide record (engineer decision 1,
    correct).
  - No page visited shows "too early" next to a direction word.
- **The width is checked, not only the count.** The 40-bet, 198-day record reads too early by width, as the owner
  decided: never a count alone.
- **Layout.** No horizontal scroll on any page at 360 or 375. The longest new sentence wraps cleanly in light and
  dark.
- **Disclaimer.** The F3 disclaimer is on every page visited.
- **Share and meta text.** Profile and ticker meta descriptions read "Evidence: too early". The profile OG line
  "Too early to tell: the range is still too wide (40 bets, 198 days)" fits on one line at 1200 px. The ticker OG
  wraps to 2 lines inside its band.

## Findings

| # | Where | What a first-time viewer meets | Truth / consistency |
|---|---|---|---|
| F1 | Trade page, month page (shared-link landings) | "Past results: above zero · Evidence: thin (5 bets, 27 days) (+0.9% to +1.7%)" and directly below it: "Short record: 5 closed trades so far. **A short record shows wide uncertainty.**" (`trade-five-*`, `month-five-*`) | **Contradiction, new in PR 1.** Before, every record under 10 trades was too early with no range, so the sentence was true. Now the range printed above it is 0.8 points wide and carries a direction. The sentence is our implementation copy, not owner text: TR-7 fixes only the "New record" badge and its 30-day / 10-trade thresholds |
| F2 | Ticker "Compared with all other stocks" | "Too early to tell: the range is still too wide (9 bets, 28 days). **Not enough independent bets** for a comparison yet." (`t-wide-*`) | False for the width case: 9 bets is above the floor of 5 that the next page states, and the reason is the width |
| F3 | Compare page, every too-early side | "**too early.** Too early to tell: the range is still too wide (9 bets, 28 days)" and "**too early.** Too early to tell (4 of 5 bets)" (`cmp-*`) | The same words twice, the first in bold lower case. The pattern predates this PR; this PR edits the same file (`compare/page.tsx`) |
| F4 | Profile, too wide with trades > bets | Stats say "18 closed trades"; the line says "(6 bets, 67 days)", with no "from 18 trades" (`p-grpw-*`) | Inconsistent with the other two sentences: thin says "(8 bets from 18 trades, …)" and too early by count says "18 trades in 6 overlapping positions". This is the engineer's decision 3, which left the choice to me. A reader who counts 18 trades and reads "6 bets" gets no reason |
| F5 | Ticker page, first screen | Summary: big "+6.7%" in green and "(−22.2% to +32.1%) · 95% range". "Too early to tell" appears only far below, under the spread chart, after the concentration check and the baseline (`t-wide-375-dark`, about 3 screens down) | Not false, but inconsistent with the profile, where "too early" sits directly under the range. Before PR 1, this slot itself said "Too early to tell (9 of 10 bets)". A viewer who stops at the first screen sees a big green average and a range, with no "too early" |
| F6 | Profile "What's this?" | "95% range from independent bets (same-stock trades that overlap count as one). A wider range means less evidence." | Nothing tells the reader when "too wide" ends. "40 bets, 198 days" and still "too early" needs one sentence. Without a statistics background, "too wide" has no yardstick |
| F7 | Trade page, month page | "Too early to tell: the range is still too wide (8 bets, 45 days) **(−25.9% to +30.2%)**" (`trade-wide-*`, `month-wide-*`) | Two parentheticals in a row, and the range has no label, so the second reads as another detail of "8 bets, 45 days". Everywhere else the range is labelled "· 95% range". The unlabelled form predates this PR, but the new sentence refers to "the range", and on these pages nothing is called that |
| F8 | Ticker hold-time section | "Different traders, different sizes and timing. Hold time is not a **signal** on its own." (`HoldTime.tsx:38`) | A banned term (POLICY F3b list) reaches the UI. It is negated and not a label, and it predates this PR (`f815bb7`). This PR edits the same file (line 28) |

Notes, not demands:

- **N1 (feed section, business lead's call).** Under the 5-bet floor, a thin newcomer can win row 1 on weight (the
  engineer measured 0.028, the fixture's highest). The section's line says "Ordered by how much evidence each record
  has". A viewer who opens row 1 ("Evidence: thin") and row 2 ("Evidence: moderate") could read that line as false.
  This was already possible for 10–29-bet records, and PR 1 extends it to 5–9. If the business lead keeps C3 and
  option (a) for the reach test, I'm fine with it from the viewer's side, because rows carry no numbers. But the line
  should then read "Ordered by how clearly each record leans one way. Losses count the same as gains." I'll raise
  that wording in PR 2's copy review if it's not settled here.
- **N2 (PR 3).** The share prompt says "A short record means wide uncertainty … Right now the range is (+0.9% to
  +1.7%)", the same contradiction as F1, on the trader's own profile. `share-prompt.tsx` is already in PR 3's file
  list. The trade and month OG cards say "short record, wide uncertainty", but they print no range, so they are not
  contradicted on the card itself. Align them with D1 in PR 3.
- **N3 (pre-existing, out of scope).** All three are noted for the owner's backlog:
  - The ticker OG card clips "losses included" at the right edge (`og-ticker-wide.png`).
  - The profile colours "max drawdown 0.0%" red (`p-grp-375-dark`).
  - HTML ranges print a hyphen-minus where the card plan uses U+2212.

## Compliance

- **POLICY F1, F3b, no advice and no banned labels: PASS for this PR's change.** No new string carries confidence
  interval, standard error, p-value, alpha, Sharpe, edge, signal or skill. The engineer's scan test covers every
  `evidenceLine`/`tooEarlyText` output. The rename `edge` → `direction` stays identifier-only. The one hit, F8, is
  pre-existing and negated; it is a demand, not a fail of this build.
- **F3 disclaimer: PASS.** On every page visited, at both widths.
- **F4 / TR-9: PASS.**
  - The whole record is shown.
  - Losses are treated the same: "below zero" reads like "above zero".
  - The range appears from 5 bets.
  - Too early is never decided by a count alone.
- **A1 accessibility: PASS.**
  - No new control.
  - The new text uses the existing `.evidence`, `.range` and `.muted.small` styles, so contrast is unchanged in
    light and dark.
  - Direction is given in words as well as colour.
  - No horizontal scroll at 360 and 375.
  - The long sentences wrap and are never truncated.
- **Truth against what's shown: one failure (F1).** It is a usability and truth demand, not a POLICY breach.

## Demands (each small; how to verify)

| # | Demand | Verify |
|---|---|---|
| D1 (F1) | On the trade and month pages (`trade/[sellId]/page.tsx:64`, `month/[ym]/page.tsx:82`), keep "Short record: N closed trades so far." (TR-7 fact). Print "A short record shows wide uncertainty." only when the record is too early (`tier === 'too-early'`, carried from `confidence()` in `trade-share.ts`/`recap.ts` beside `evidence`) | e2e at 360 px. A 5-bet narrow record: the trade page and the month page both show "Short record: 5 closed trades so far." and contain no "wide uncertainty". A 4-bet record: the trade page still shows the sentence. A wide 8-bet record: it shows too |
| D2 (F2) | Baseline `too_few_trades` tail: "Not enough evidence for a comparison yet." (`Baseline.tsx:39`). It is true for both reasons | e2e or unit render. A too-wide ticker reads "…(9 bets, 28 days). Not enough evidence for a comparison yet."; no page contains "Not enough independent bets" |
| D3 (F3) | Compare: drop the bold `COMPARE_COPY.tooEarly` prefix (`compare/page.tsx:79`), so the evidence line alone says it. The constant may stay | e2e. The compare page for a 4-bet side and a wide side: each column's evidence text matches `/^Too early to tell/`, and the page text has no `too early. Too early` |
| D4 (F4) | `tooEarlyText` width branch carries the trades when they outnumber bets, as the thin line does: "Too early to tell: the range is still too wide (6 bets from 18 trades, 67 days)" | `confidence.test.ts`. With n > k the sentence is "(‹k› bets from ‹n› trades, ‹d› days)"; with n = k it is unchanged. The existing e2e regex `\(6 bets, \d+ days\)` stays valid (its fixture has n = k) |
| D5 (F5) | Ticker summary (`t/[symbol]/page.tsx:137`): when `c.tier === 'too-early'` and a range exists, show `tooEarlyText(c)` on its own line under "· 95% range", as the profile does. The line under the spread chart can stay | e2e at 360 px on a too-wide ticker. The `.stats` block contains both "· 95% range" and "Too early to tell: the range is still too wide". A thin ticker's `.stats` has no "Too early" |
| D6 (F6) | Profile "What's this?" gains one sentence built from the constants: "It says too early to tell until there are at least 5 independent bets and the range is no more than 20 points wide." Use `MIN_BETS` and `TOO_WIDE * 2 * 100`, not literals | Unit test (or e2e after opening `<details>`). The sentence contains `MIN_BETS` and `2*TOO_WIDE*100`, and no banned term |
| D7 (F7) | Trade and month pages: label the range as everywhere else. Print `‹range› · 95% range` on its own line above the evidence line, not appended after it (`trade/[sellId]/page.tsx:63`, `month/[ym]/page.tsx:72,81`) | e2e at 360 px. A wide record's trade page contains "· 95% range", and its text has no `) (` |
| D8 (F8) | `HoldTime.tsx:38`: "Hold time alone says little about results." (or equivalent without the word) | e2e or scan. `/t/<sym>` innerText has no `/\bsignal/i`. The compliance scanner still passes |

D1 to D5 and D7 are about the lines this PR changed or made reachable. D6 and D8 are one-line additions in files this
PR already edits. None changes an owner decision, the model, the ranking or a test expectation in a loosening
direction. After the fix round, I re-check F1–F8 on the same preview with the same fixture shapes.

COMPLIANCE: PASS · USABILITY: DEMANDS (D1 short-record sentence contradicts a narrow range on trade/month pages; D2 baseline "not enough independent bets" false when too wide; D3 compare "too early. Too early"; D4 too-wide line drops "from N trades"; D5 ticker first screen lacks "too early"; D6 explain when "too wide" ends; D7 unlabelled range on trade/month pages; D8 "signal" in hold-time note)

## Round 2

Date: 2026-10-25. Build under review: fix round 1, `8c27c88..7ec3c28`, on branch `autopilot/feature-4-tr9`. Read:
`ruling-pr1-h1.md`, `test-pr1-tester.md`, and the "Fix round 1" table in `build-pr1-engineer.md`.

### Method

- **Preview and viewer.** The same preview on :3600 (`stock_social_f4`), not rebuilt or stopped. A signed-out
  first-time viewer.
- **Browser.** Playwright Chromium at 360 px (light) and 375 px (dark), full-page screenshots with every `<details>`
  open, saved in `screenshots/pr1-ux2/` as `<page>-<width>-<scheme>.png`.
- **Fixtures.** 15 users under `ux2f4_`, with the same shapes as round 1 (four, five, neg, wide, grp, grpw, big, and
  t1–t7 behind U2TW wide, U2TN thin, U2T4 4 bets, U2TO overlapping). I added one: `same`, 5 identical +2% bets
  (ruling H1). I deleted them all afterwards along with their `signup_attempts` rows. Count after the delete: 0 users,
  0 closes.
- **Pages.** 24 pages at each width: 8 profiles, 4 tickers, 3 compares, 5 trade pages, 3 month pages, and the feed.
- **Text scan on every page.** Each page was checked for:
  - the banned terms in the page text and the meta tags;
  - the stale patterns "of 10 bets", "10 independent", "Not enough independent bets", "too early. Too early", ") (",
    and any range without "· 95% range" next to it;
  - horizontal scroll;
  - the F3 disclaimer.
- **Results of the scan.**
  - 0 banned terms.
  - 0 horizontal scroll.
  - The disclaimer is on all 48 page views.
  - 0 stale patterns. The one regex hit was the ticker's baseline verdict, which quotes the range inside a sentence;
    that is correct.

### Demands from round 1

| # | Verdict | Evidence |
|---|---|---|
| D1 | **Met** | The 5-bet trade and month pages read "Short record: 5 closed trades so far." with no "wide uncertainty" (`trade-five-*`, `month-five-*`). The same holds for the 5 identical bets (`trade-same-*`). The 4-bet pages (`trade-four-*`, `month-four-*`) and the wide 8-bet pages (`trade-wide-*`, `month-wide-*`) still print the sentence, and it is true there |
| D2 | **Met** | The wide ticker reads "Not enough evidence for a comparison yet." with no count as the reason. The tickers with 4 bets and with overlapping trades read the same. No page says "Not enough independent bets" (`t-*`) |
| D3 | **Met** | No "too early. Too early" anywhere. Each compare column says it once, and only in the evidence line: "Too early to tell: the range is still too wide (9 bets, 28 days)", "Too early to tell (4 of 5 bets)", "Too early to tell: 7 trades in 2 overlapping positions (5 independent bets needed)". The thin column beside it reads "Past results: above zero · Evidence: thin (8 bets, 28 days)" (`cmp-*`) |
| D4 | **Met** | The profile and trade page read "Too early to tell: the range is still too wide (6 bets from 18 trades, 67 days)", next to "18 closed trades" (`p-grpw-*`, `trade-grpw-*`). It matches the thin line's form. When trades equal bets, the line is unchanged ("(8 bets, 45 days)") |
| D5 | **Met** | The ticker's first screen holds "(−22.2% to +32.1%) · 95% range", then "Too early to tell: the range is still too wide (9 bets, 28 days)" in the same stat card. The line under the spread chart is gone. The thin ticker's stats carry no "Too early" (`t-wide-*`, `t-thin-*`) |
| D6 | **Met** | "What's this?" ends: "It says too early to tell until there are at least 5 independent bets and the range is no more than 20 points wide." It is built from the constants. On the pages, the 40-bet record's range (−18.2% to +10.0%) is 28 points wide and reads too early, so the sentence is true against what is shown (`p-big-*`) |
| D7 | **Met** | On the trade and month pages, the range is on its own line, "‹range› · 95% range", above the evidence line. This holds for the month and the whole record. No page text contains ") (" (`trade-*`, `month-*`) |
| D8 | **Met** | The hold-time note reads "Hold time alone says little about results." No page has `\bsignal` (`t-*`) |

### Regressions in the changed "too early" lines

- **Hold time.** A shown bucket prints its range, then its own "too early" line when it is too early (wide ticker,
  U2TW). A thin bucket prints only the range (U2TN). A bucket with overlapping trades prints the overlap sentence
  (U2TO). The wide ticker's single bucket holds all 9 trades, so it repeats the stock's own sentence word for word.
  That is consistent, not a contradiction.
- **Concentration.** Two shapes, both clean, with one too-early sentence each:
  - "Without them: 50% win rate, avg +2.5% over 6 trades. (−32.6% to +40.9%) · 95% range. Too early to tell: the range
    is still too wide (6 bets, 23 days).";
  - "… over 5 trades. (0.0% to +3.3%) · 95% range." This rest is thin and draws no verdict.
- **Variance floor (ruling H1), on the page.**
  - 5 identical +2% bets read "(+0.4% to +3.6%) · 95% range", not a zero-width range (`p-same-*`).
  - 5 narrow gains now read "(−0.3% to +3.0%) · Past results: unclear", where round 1 showed "above zero". It is more
    cautious, and true.
- **One new contradiction: see D9 below.**

### New demand

| # | Where | What a viewer meets | Demand | Verify |
|---|---|---|---|---|
| D9 | `rangeText` (`lib/trades.ts`), every range next to a direction | The profile of 6 small losses reads "(−2.6% to **0.0%**) · 95% range", and directly under it "Past results: **below zero**" (`p-neg-*`). The true upper bound is −0.018%, so the word is right but the printed range contradicts it: a reader sees the range reach zero. The variance floor makes this case common at 5 to 9 bets. A sweep in my scratchpad gave 126 of 7,800 records (5 to 30 bets) with a direction word and a bound printed as "0.0%". The engineer met the same case in `6182f57` and loosened the e2e pattern ("an unsigned 0.0% bound") instead of the display | When a bound is non-zero but rounds to 0.0%, print it to 2 decimals with its sign: "(−2.6% to −0.02%)". One condition in `rangeText` or `pct`. This changes the display only; the model, the tiers and the ranking stay as they are | Unit test in `confidence.test.ts`. On the neg fixture (6 bets, −0.9% to −1.8%, 3-day holds), `rangeText` contains no "0.0%", and its upper bound starts with "-". A sweep over records with direction `positive` or `negative` finds no bound printed as "0.0%". The existing e2e patterns stay valid |

### Notes, not demands

- **N4.** The profile meta for an all-loss record reads "6 verified trades · **%** win rate". A 0 win rate prints as
  empty. This was already present in round 1 (`uxf4p1_neg`), so it does not come from this PR. It goes to the owner's
  backlog.
- **N5.** D6's "It says…" follows "A wider range means less evidence.", so "It" could be read as the range. "We say too
  early to tell until…" would be clearer. This is my own wording, so it can wait for PR 2's copy review.
- **N1 to N3** stand as written in round 1. N1 is mostly moot, because a 5 to 9-bet record now weighs 0 (ruling H1).

### Compliance (round 2)

- **F1/F3b: PASS.** The banned terms appear nowhere in the UI or the meta tags, and the D8 hit is gone.
- **F3 disclaimer: PASS.** It is on every page.
- **F4/TR-9: PASS.**
  - The whole record is shown, and losses read like gains.
  - The range is never zero-width.
  - "Too early" is never decided by a count alone.
- **A1: PASS.** No horizontal scroll at 360 or 375, in light or dark. Direction is given in words as well as colour.
  The long lines wrap and are never cut.

COMPLIANCE: PASS · USABILITY: DEMANDS (D9 a range bound printed as "0.0%" beside "below zero"/"above zero"; print a non-zero bound that rounds to 0.0% to 2 decimals with its sign)

Ready to merge: no. D1–D8 are met. D9 is a one-condition display fix with a unit test, and after it, yes.
