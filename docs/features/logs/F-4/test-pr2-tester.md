# F-4 PR 2 · Card model and trust copy · Tester

Date: 2026-10-25. Branch `autopilot/feature-4-card-model`, commits `dab09f7..c7aee59` (HEAD `c7aee59`, based on
`origin/main` `0666990`). Spec: `plan.md` PR-2, both sign-offs, "Amendment: O1 answered"; owner decisions in the
session-branch `docs/features/F-4-share-card.md` (10-cell table, 2026-10-24 negative rows).

**Verdict: pass with 2 Medium findings (no Blocker, no High).** Both Medium findings are one-line fixes in
`lib/record-card.ts`, and each needs a test.

## Checks run (Node 24.22.1)

| Check | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm test` (`.env` DATABASE_URL → `stock_social_f4`) | 662 tests, 650 pass, 0 fail, 12 skipped (the `LOAD=1` heavy-use suite, as on main) |
| `node --test lib/record-card.test.ts lib/card-glyphs.test.ts` | 21/21 pass |
| `node scripts/autopilot.ts guard main` | `guard: ok`, exit 0 |
| `node scripts/compliance.ts diff origin/main` | `compliance: ok`, exit 0 |

Probe scripts (not committed) are at
`/tmp/claude-0/-home-user-stock-social/6ee99173-c7dc-59c5-a07f-0eb5e1cd1afd/scratchpad/probe.ts`, `probe2.ts` and `probe3.ts`.
Run each with `node <path>` from the worktree.

## Conformance

| Item | Result |
|---|---|
| 10 trust cells, word for word (`lib/copy.ts` `SHARE_CARD.trust`) vs the owner's table | **Match**, all 10, including the 2026-10-24 thin and moderate negative rows. Each cell is asserted once in `record-card.test.ts`; real mirrored fixtures give mirrored cells (thin, moderate, strong) |
| Direction from the printed range | `cardDirection(perTrade)`: low > 0 positive, high < 0 negative, else unclear. `cardPct` never prints `0.0%` for a nonzero bound, so the printed sign always agrees with the cell (U7 `−0.0004` → "−0.04%" + consistent losses) |
| "Consistent" only strong + one side | Holds over tier × {pos, neg, spanning, null}; the probe also covers singulars (K = 1) |
| Reader scan (banned list + PROMO) | Holds on every cell at K = 1 and K = 12,345, on every fixture's wide and tall strings, and on the alt text. Longest cell + disclaimer ≤ 50 words |
| t multiplier at K = 5, 10, 30, 100 | 2.776, 2.262, 2.045, 1.984 (`lib/confidence.test.ts:165`, PR 1); a hand-computed interval at K = 5 is also tested |
| Too early | K = 4: no range, "Based on 4 trades. …". K = 5 narrow: range + thin. 5 trades in 4 bets (overlap): too early (the trade count doesn't decide). Half-width exactly 0.10: not too wide (`tooWide`, including the 0.7..0.9 float case); 0.1000001: too wide. Too early by width keeps the range |
| Period at 0 / 1 / many months | "under a month", "1 month", "19 months", day-of-month, end-of-month and UTC year boundary: all pass |
| Glyph filter | CJK, Hebrew, Arabic, emoji, ZWJ, RTL override U+202E, VS16, most Greek, tab and newline, empty and whitespace-only names → `@handle`, handle row null. NFD "José" → NFC "José" drawn. A covered combining mark (U+0301 on "q") is drawn, which is correct: it is in the font's cmap, so nothing is fetched. `CARD_GLYPHS` = the cmap of the font file (test) |
| No per-trade data | Model keys fixed; no symbol, timestamp, "held" or "holding" in any string or JSON (also on a 5,000-trade probe) |
| Downsampling | 5,000 and 10,000 closes: 400 points, min and max drawn at the plot edges, "10,000 trades", about 12 ms warm |
| Edge cases | All losses: down tone, U+2212 everywhere, the thin negative line. Zero variance (+1% ×10, 0% ×10): finite range (prior floor), sensible cells. Empty (connected, `none`, failed, demo): "No closed trades yet" + body, no stats, badge set. Frozen: period ends at the disconnect ("10 months"). One trade and same-instant closes: no NaN, the line starts at the 0% baseline. 20-character names (ASCII and Latin-1 accented) kept whole |
| O2 | Logged in `build-pr2-engineer.md` "Owner question O2, logged". Pinned in `record-card.test.ts` ("tester fixtures"): 200 bets alternating −50%/+80% give the headline "+15.0%", the range high < 0.15, "Evidence: strong" and "A long record, with no clear pattern." **Confirmed** |

## Findings

### Blocker
None.

### High
None.

### Medium

**M1 · spec/bug: the strong tier can read "over 0 years".** The strong tier starts at `spanDays ≥ 365`
(`lib/trades.ts:271`), but Y = ⌊days / 365.25⌋, so a strong record with a span in [365, 365.25) days prints
"Based on 100 bets over 0 years. A long, consistent record." on the share card and in its alt text. The case is rare
(a 6-hour window), but it stays on the card until the next trade, because the span depends only on trades. The tests
pick 365.25 as the boundary, so they miss it. (Moderate can't hit "0 months", because it needs ≥ 90 days, which
gives M ≥ 2.)
- Repro: 100 trades, symbols distinct, opens spaced `(365.1 − 2) / 99` days apart, each held 2 days, returns
  `0.01 ± 0.003`. Run `recordCard(...)`. Then `confidence().tier === 'strong'`, `spanDays = 365.1`, and
  `trust.text === "Based on 100 bets over 0 years. A long, consistent record."` (`probe.ts`, first block).
- Fix suggestion: Y = max(1, ⌊days / 365.25⌋), the same way D already does it. Add a test at `spanDays: 365`.

**M2 · bug (POLICY F3a, A1): the alt text says "Verified from broker" while the visible badge says "No broker
connected".** `badgeFor` correctly drops Verified when `state !== 'connected'`. The alt prefix is still
`profileCardAlt(handle, shareCardText(...))`, and `shareCardText` returns the verified label for any non-empty,
all-verified record in state `none`. So the screen-reader text claims something the image denies. U14 asserts that
prefix, but no fixture has state `none` with closes, so the test passes.
- Repro: `recordCard({ trades: <12 verified trades>, state: 'none', demo: false, frozenEnd: null, ... })`. Then
  `badge.text === 'No broker connected'` and `alt.startsWith('Trading record card for @probe on Stock Social: Verified
  from broker.')` (`probe.ts`, "frozen, state none").
- Reachability: TR-5 disconnects keep `state = 'connected'` (`lib/sync.ts:318` only sets `disconnected_at`), so a
  frozen record is not affected. The bug needs a record whose consented connections are gone but whose verified
  activities remain.
- Fix suggestion: build the alt prefix from the model's own badge, e.g. `Trading record card for @h on Stock Social:
  ${m.badge.text}`. Add a `['none with closes', input(WIN, { state: 'none' })]` fixture to the U10/U14 matrix.

### Low

**L1 · usability: range bounds can print with different precision.** "likely between −0.1% and +0.04%" (5,000-trade
probe). U7 requires this, so it is per spec, but a lay reader may wonder why one bound has more decimals. Suggestion for
PR 3's taste round: use the same number of decimals for both bounds whenever either needs more.
- Repro: `probe.ts`, "5000" block, `range`.

**L2 · usability: a total-loss record prints "likely between ≈−100.0% and ≈−100.0%".** `cardPct` passes through
`pct`'s "≈" form, so the range collapses to two identical approximations. The cell (thin negative) is correct, and
U+2248 is covered by the font. This is an extreme input (every trade −100%).
- Repro: `recordCard(input(trades(Array(6).fill(-1))))`, field `.range`.

**L3 · note: the card and the profile round the day count differently.** The card's thin line uses D = ⌊days⌋ (plan),
while the profile's `evidenceLine` uses `Math.round(spanDays)`. For a 61.9-day record the card reads "over 61 days" and
the profile reads "62 days". Both follow their own spec. Raise it only if the owner wants one number.
- Repro: `trustLine(conf({ k: 30, spanDays: 61.9, perTrade: pos }), 30)` vs `evidenceLine` for the same `Confidence`.

**L4 · note: the name is trimmed.** "  Spaced  " is drawn as "Spaced". This is reasonable. It touches the "never altered" wording only
at the whitespace level.

## Not tested here (PR 3)
Pixels, 375 px readability, zero outbound requests during render (U13), and truncation of long names: no route
reads the model yet.
