# F-4 PR-2: card model and trust copy (engineer build log)

2026-10-25. Built to `plan.md` PR-2, with:
- the business lead's C1 and C6 (`plan-signoff-business-lead.md`);
- the UX lead's changes 1, 3 and 5 (`plan-signoff-ux-lead.md`);
- the plan's "Amendment: O1 answered" (2026-10-24).

The owner's decisions are in `docs/features/F-4-share-card.md`, Decisions, including the two trust lines added on
2026-10-24. At the time of this build, that version of the file and the plan were in the main checkout's working copy,
not on this branch.

- Branch: `autopilot/feature-4-card-model`, created from `autopilot/feature-4-tr9` at `dab09f7` (plan C7), in worktree
  `.claude/worktrees/agent-af2a9d77f0b6999cf`.
- Database: `stock_social_f4`. `next start` on port 3600, vendor fake on 4602.
- Commits: `b98e7bc` the tests (failing), `bcb8912` the model, then this log.

No schema change, no dependency, no protected path, no route change, no font file.

## What it does

PR 2 is pure model and copy. The two images are unchanged until PR 3 draws this model.

- **`lib/record-card.ts` → `recordCard(input) → CardModel`.**
  - **Input:** the closed trades (with `verified`), the record state, the demo flag, the frozen end (or null), now,
    handle, display name and host.
  - **Output:** every string, colour token, the chart geometry per layout (`wide` 1200, `tall` 1080) and the alt
    text.
  - **Headline:** the average return per trade (`headline().avgReturn`, as on the profile), labelled "average return
    per trade".
    - Printed in the profile's `pct()` format with U+2212, so the card and the profile show the same number (UX change
      3).
    - The colour follows the printed sign: a "0.0%" is text-coloured.
    - There is no win-rate field.
  - **Range:** "likely between ‹low› and ‹high›" whenever the per-trade interval exists. That covers K ≥ 5, including a
    record too early by width.
    - Bounds go through `cardPct`: U+2212 for minus, and a non-zero bound never prints "0.0%" (2, then 3, then 4
      decimals, sign kept; U7).
  - **Trust line:** the owner's table, now 10 cells, via `trustLine(c, closes)`.
    - Direction comes from the per-trade range printed beside it (`cardDirection`), so the words never contradict it.
    - N is closed trades when the record is too early, independent bets otherwise.
    - D = max(1, ⌊days⌋), M = ⌊days / 30.44⌋, Y = ⌊days / 365.25⌋, with singulars.
    - "Consistent" appears only in the strong tier with the range on one side of 0, for losses as for gains.
    - A failed import puts `RECORD_BODY.failed`, in warn, in this row; the pill stays.
  - **Evidence pill:** "Evidence: too early / thin / moderate / strong".
  - **Period:** "Record since ‹Mon YYYY› · ‹N› months".
    - Whole calendar months in UTC; a month counts once its day and time are reached.
    - 0 reads "under a month", 1 reads "1 month".
    - It starts at the earliest entry and ends now, or at the frozen end (TR-5).
    - The format is pinned to `en-US`, short month, UTC.
  - **Count:** "‹N› trades" ("1 trade", "10,000 trades") and "losses included".
  - **Chart:**
    - the `ALL` series at most `CARD_POINTS` = 400 points, starting at 0%;
    - y domain from `curveDomain` (it contains 0);
    - per layout: the plot box, a 70 px gutter, the 0% baseline, the line path, the area path, and the gradient stop
      at the baseline (one gradient, `TINT` 16%);
    - the line colour follows the record's end value (text colour at exactly 0);
    - caption "Return if every trade were the same size", label "0%".
  - **Badge, never blank:** it comes from `shareCardText` with the check mark removed.
    - When that label is null: "No broker connected" for state `none`, else "Broker connected".
    - "Verified from broker" appears only for a connected, all-verified, non-demo record with closes. Demo reads "Demo
      data".
  - **Body states:**
    - **Empty:** "No closed trades yet" and "The record starts with the first closed trade.", with no chart, count,
      period, pill, trust line or headline.
    - **Importing:** `SHARE_CARD.importingBody` and the note; no stats, even with closes (TR-3).
  - **Display name:** drawn only when every code point of its NFC form is in the font (UX change 5). Otherwise the name
    slot shows `@handle` and the handle row is null. The name is never altered or partly drawn; truncation is the
    renderer's.
  - **Alt text (U14):** `profileCardAlt(handle, …)`, then every visible string and "Line from 0% to ‹end› total,
    lowest ‹min›".
  - **Exported tokens:** `PALETTE` (images only), `SCALE` and `FLOORS` per layout, `CANVAS_WIDTH`, `TINT`,
    `CARD_POINTS`, `FORMATS`, `parseFormat`, and `cardStrings(model, layout)`: every drawn string, in reading order,
    for the scans and the renderer.
- **`lib/card-glyphs.ts`:** `CARD_GLYPHS` holds the 726 code points (112 ranges) of next/og's bundled Geist Regular, and
  `covered(s)` checks a string against them. This is the D1 fix. The renderer fetches any glyph its font lacks from a
  third-party service, and the public API can't stop it, so the model never hands it one.
- **`lib/copy.ts`:** `SHARE_CARD` gains `noBroker`, `emptyBody`, the card labels, `range`, `evidence`, the two period
  forms and the 10-cell `trust` table. `allCopy()` walks all of them into the existing copy scans (PROMO, banned
  claims, trademarks, minors). `shareCardText` is unchanged.
- **`FORMATS` and `parseFormat`** move to the model. `lib/story-image.ts` re-exports them until PR 3 removes it.

## Decisions (engineering; no owner decision changed)

1. **Tall trade count 47 px, not 46.** 46 × 375 / 1080 = 15.97 CSS px, which misses the plan's own 16 px floor for the
   count. 47 reads 16.3. Every other entry is as the plan's §3 table states. Where the table gives a range (34–36,
   36–38), I took the trust line at the low end and the range and period at the high end.
2. **Chart plot boxes** are wide 620 × 176 (the UX lead's measured column) and tall 952 × 180. PR 3 tunes the heights
   under its D2 and D7 checks. The UX lead allows a wide plot down to 140 px; no text size may shrink.
3. **The badge can't say Verified for state `none` with closes.** That state is unreachable today (round-1 engineer
   §5), but `shareCardText` would return Verified for it. The model maps it to "No broker connected", so the badge
   never depends on that being unreachable.
4. **Snapshots** use `node:test`'s `t.assert.snapshot`, stored in `lib/record-card.test.ts.snapshot` (committed).
   They cover winning, losing (log mirror) and empty (`none`) models, every field and both layouts' geometry. A
   deliberate model change regenerates them with `node --test --test-update-snapshots lib/record-card.test.ts`, and
   the diff is reviewed.
5. **No screenshots in `screenshots/pr2/`.** PR 2 changes nothing anyone can see: no route reads the model until PR 3.
   PR 3's D6 QA log carries the renders.

## Owner question O2, logged (not blocking, as planned)

A fixture of 200 bets alternating −50% and +80% shows the arithmetic headline "+15.0%". Its range, centred on the
geometric mean, lies entirely below that value, and the trust line reads "A long record, with no clear pattern."; the
test asserts this.

The 10,000-close load fixture shows the same thing from the other side: uniform returns between −5% and +5% (an
arithmetic mean near 0). Volatility drag puts the geometric mean just below 0, so 10,000 bets read "A long record, with
consistent losses."

Both follow from TR-9 as specified, and the profile has the same split today. The default stays arithmetic, matching
the profile; the owner answers before real users.

## Product lines

`git diff --numstat autopilot/feature-4-tr9 -- app lib`, without tests: **+241 / −3 = 244** (plan 280–330, cap 800).
- `lib/record-card.ts` +182
- `lib/copy.ts` +32
- `lib/card-glyphs.ts` +25
- `lib/story-image.ts` +2/−3

## Tests (written first, `b98e7bc`; none deleted or loosened)

`lib/record-card.test.ts` (+19) and `lib/card-glyphs.test.ts` (+2):

| Check | Test |
|---|---|
| Criterion 1 | ALL series from 0% at the gutter edge; baseline inside the plot (domain contains 0); count "12 trades" / "1 trade"; period; name and handle; ≤ 400 points |
| Criterion 2 | headline "+1.9%" with a range at K = 5; no range at K = 4; the range kept when too early by width; no `winRate` field and no "win rate" string in any of the 21 fixture models |
| Criterion 4 | one assertion per cell for all 10 cells; too-early counts trades ("2,828 trades"); singulars "1 trade", "1 day", "1 year"; D, M and Y floors at their boundaries |
| Criterion 4, direction | read from the range: "consistent" only strong and one-sided over all tier × direction pairs. Real mirrored fixtures give mirrored cells: thin, moderate and strong, positive ↔ negative, plus the three unclear cells |
| Criterion 5 | the reader terms (confidence interval, standard error, p-value, alpha, Sharpe, edge, signal, skill), PROMO and the claim words, scanned over every cell and every string of every fixture model; the longest cell plus the disclaimer is ≤ 50 words |
| C1 | "95%" and "confidence" never appear; "range" only in the too-early trust line |
| Criterion 6 | the model's keys are a fixed list; no symbol, ISO time or holding period appears in its JSON |
| Criterion 7, U6 | a mirrored losing record's model equals the winning one except colour tokens, signed numbers and the cell; the line is down when the record ends below 0 and text-coloured at exactly 0; U+2212 everywhere, no hyphen-minus before a digit |
| U5 | an average +5.0% with a compounded −10% gives a headline in up and a line in down; a "0.0%" headline is text-coloured |
| U7 | `cardPct`: −0.04%, +0.04%, −0.004%, +0.0004%, −0.0000%, 0.0%; a strong record with a −0.04% high bound reads consistent losses |
| U10, U11 | every fixture model: the disclaimer, a non-empty badge with no check mark, Verified exactly when the record is connected, verified, non-demo and has closes; the exact badges per state; empty is exactly "No closed trades yet" with no chart, count, period, pill or trust line; importing has no stats; failed keeps the layout with the warn line and the pill |
| U12, C6 | every palette token ≥ 4.5:1 on the background; up and down within 1.5; each line and the "0%" label ≥ 4.5:1 over its 16% tint (computed WCAG contrast) |
| U2 (scale half) | every `SCALE` entry × 375 / canvas width meets its `FLOORS` entry |
| U14 | the alt text starts with the profile card's alt and holds every visible string and the chart sentence |
| D4, U15 | the constant equals the font file's cmap (a test-only reader of formats 4 and 12); every string of every fixture model is covered. CJK, Arabic, emoji, "✓ Maya" and a zero-width-joiner name fall back to `@handle` with no handle row; NFD "José" draws as NFC "José" |
| Criterion 10 | snapshots of winning, losing and empty. Period at 0 months, 1 month, 19 months, a day-of-month boundary, an end-of-month case and a UTC year boundary; a frozen record ends at its disconnect. 10,000 closes: ≤ 400 points, the record's min and max drawn at the plot's top and bottom, "10,000 trades", built in < 200 ms (measured 10–15 ms warm) |
| Tester fixtures | a 40-character name kept whole; a five-digit count ("12,345 trades"); a failed import; O2 (above); a record that stopped trading a year ago reads its whole period to now |

**Unit and DB tests: 641 → 662** (650 pass, 12 LOAD skipped).

## Checks

| Check | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm test` (`stock_social_f4`) | **662 tests: 650 pass, 0 fail, 12 skipped (LOAD)** |
| LOAD runs | not required: `lib/trades.ts`, `lib/sync.ts`, `lib/connections.ts` and `lib/broker.ts` are unchanged (IMPLEMENTATION interim rule) |
| `node scripts/autopilot.ts guard main` | `guard: ok` |
| `node scripts/compliance.ts diff origin/main` | `compliance: ok (diff vs origin/main)` |
| `CI=1 npm run build` (stdin closed) | exit 0 on the retry (the first attempt stops on the framework's upgrade notice; tool output, ignored) |
| e2e, port 3600, vendor fake on 4602 | **116 passed, 1 failed, 3 skipped** of 120 (4.3 min). The failure is the heavy-feed test (29 of 30 heavy cards on page 1), known and pre-existing on `main` on the reseeded database (PR-1 log, fix round 2; queued as a suggested task). PR 2 changes no route. The committed screenshots the run rewrites were restored |

A fresh `next start -p 3600` with ALLOW_DEV_AUTH=1 is running from this build, without the vendor fake. It stops when
the 2-hour background limit runs out.

## Fix round 1 (2026-10-25)

Inputs:
- `committee-pr2-business-lead.md` (B1, B2);
- `committee-pr2-ux-lead.md` (U-1 to U-4, notes N1 to N4);
- `test-pr2-tester.md` (M1, M2, L1 to L4).

All three pass compliance.

Commits: `c2b459d` tests first (failing), `60b3384` the code with the regenerated snapshot, then this log and the PR
body.

| Demand | Change | How verified |
|---|---|---|
| **B1 / U-3** (alt text) | `alt` is now `{ wide, tall }`. It is read once, in this order: plain prefix "Trading record card for @h on Stock Social"; the display name (skipped when the name slot already shows `@handle`); the badge; "+2.0% average return per trade"; the range; "12 trades, losses included"; the period; the pill and trust line; the chart sentence and caption; the disclaimer; the link on tall only. The lone "0%" is gone, because the chart sentence says "Line from 0% to …" | U14, rewritten per layout over 23 fixtures. Every visible string is contained. The sentence after the prefix starts as specified. No sentence repeats. No lone "0%". The badge and the handle each appear exactly once. "‹figure› ‹label›" is present. The link appears exactly on tall |
| **M2** (the alt follows the model's badge) | The prefix names no label, and the badge in the body is the model's `badge.text`, never `shareCardText`'s label | New fixtures "none with closes" (badge "No broker connected"; neither alt says "Verified") and "name outside the font", both in the U10, U14 and D4 matrices |
| **B2 / U-1** (O2 in the owner's words) | Test and PR body only; the headline method is unchanged (O2 is the owner's) | The exact strings are pinned. 200-bet: "likely between −13.3% and +3.8%" with "…A long record, with no clear pattern." 1,000-bet −30%/+35% over 400 days: headline "+2.5%" in up, "likely between −4.8% and −0.8%", "Based on 1,000 bets over 1 year. A long record, with consistent losses.", the line in down ending "≈−100.0%". `pr2-body.md` Known limits quotes these two and the 10,000-trade case: "0.0%", "likely between −0.13% and −0.02%", "…with consistent losses." |
| **M1** | Y = max(1, ⌊days / 365.25⌋), as D already does | `spanDays` 365 and 365.1 read "over 1 year". The tester's repro (100 bets over 365.1 days, through `recordCard`) is now a test |
| **L1** | `cardBounds(low, high)`: both bounds take the larger decimal count. U7's per-bound rules stay (2 to 4 decimals; a tiny bound reads its sign and 4 zeros; short of −100% reads "≈−100.0%") | "−0.10% and +0.04%", "−0.004% and +2.700%", "−2.60% and +0.04%", "0.0% and +2.7%". Every two-bound range over the fixture matrix has equal decimals. The U7 single-bound test passes unchanged |
| **L2** | When both bounds print the same value, the range reads "likely about ‹value›" (the "≈" is dropped, because "about" says it) | An all −100% record reads "likely about −100.0%", parts ["likely about", "−100.0%"] |
| **U-2** | `periodParts` ["Record since Sep 2026", "· under a month"] and `rangeParts` ["likely between", "−0.1% and +2.7%"], both built from new `SHARE_CARD` pieces (`since`, `underAMonth`, `months`, `rangeLead`, `rangeBounds`, `rangeOneLead`). `period` and `range` stay as the joined strings | Each pair joins with a space to the printed string, for every fixture; both are null exactly when the string is null; exact pieces checked |
| **U-4** | The chart's x-domain is the printed period: the 0% point sits at the first entry, and the last value is held flat to now or to the disconnect. The series is downsampled to 399 points, so the added end point keeps it ≤ 400 | A record that stopped trading 12 months ago: the first point is at the gutter on the baseline, the last x is the right edge, the last segment is horizontal, and the last close sits in the left fifth. A frozen record's axis ends at its right edge. The snapshot is regenerated, and its line now runs 17 days of closes across the 19-month axis |
| **N1** (not blocking; for PR 3's D7) | Logged | A five-digit average, "+12345.6%", is 541 px against the 480 px wide headline column at 108 px (UX lead's measure). Nothing caps it (F3c excludes unpriceable trades, so it is unlikely). PR 3's D7 adds it as a fixture and says what the row does (for example, the headline spans the full width above the chart). Text never shrinks |
| N2 to N4, L3, L4 | Not changed | Notes for the owner or PR 3, and per spec. N2: a connected record whose closes aren't all verified gets "Broker connected" in up; it is unreachable today, and muted would be safer if it ever becomes reachable. L3: the card floors days, the profile rounds them |

**Product lines** (`git diff --numstat autopilot/feature-4-tr9 -- app lib`, without tests): **+284 / −3 = 287** (cap
800). By file: `lib/record-card.ts` +221, `lib/copy.ts` +36, `lib/card-glyphs.ts` +25, `lib/story-image.ts` +2/−3.

**Tests:** 662 → **666** (+4: M1, L1/L2, U-2, U-4). The U14 test is rewritten per layout, as the demands require. The
O2 test gains the exact strings and the 1,000-bet card. Nothing is deleted or loosened.

### Checks (fix round 1)

| Check | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm test` (`stock_social_f4`) | **666 tests: 654 pass, 0 fail, 12 skipped (LOAD)** |
| LOAD runs | not required (`lib/trades.ts`, `lib/sync.ts`, `lib/connections.ts`, `lib/broker.ts` unchanged) |
| `node scripts/autopilot.ts guard main` | `guard: ok` |
| `node scripts/compliance.ts diff origin/main` | `compliance: ok (diff vs origin/main)` |
| `CI=1 npm run build` (stdin closed) | exit 0 on the retry (the first attempt stops on the framework's upgrade notice; tool output, ignored) |
| e2e, port 3600, vendor fake on 4602 | **115 passed, 2 failed, 3 skipped** of 120 (4.1 min). (1) The heavy-feed test is the known failure that is pre-existing on `main`. (2) `section.spec.ts:78` "the demo-only feed renders no section" saw another test's fixture user (`livviwbxex4`) in the feed during the parallel run; run alone, it passes (1/1). PR 2 changes no route or feed code. The committed screenshots the run rewrites were restored |

A fresh `next start -p 3600` with ALLOW_DEV_AUTH=1 is running from this build, without the vendor fake.
