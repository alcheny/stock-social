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
