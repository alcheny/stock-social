# F-8 · Prediction game: short game-like sessions that reward good predictions

Status: draft

## Why
The owner wants a game-like layer that rewards good market judgement without real money: for example a roguelike
run of about three minutes in which the player makes trades, tries to maximize returns and predicts price
movements, or any other game-like feature that rewards good predictions.

## Decisions
- 2026-11-01: Design only for now; nothing is built until the design is settled and the owner (or the approval
  council, under the delegation of 2026-11-01) marks it ready. Why: the owner's direction ("only design ideas, no
  implementation").
- 2026-11-01: The design comes from a large committee of all agent roles iterating through 10,000 design rounds
  with thesis, antithesis and synthesis, aiming for the most engaging and ergonomic design. Why: the owner's
  direction.
- 2026-11-01: No real money is involved in any form. Why: the owner's direction.

Standing rules that apply unchanged (POLICY and CLAUDE.md product rules, not owner choices):
- No points or prizes convertible to money, no loot boxes, no rewards for trade frequency, no confetti or
  celebration on real trades, no placing trades or holding funds, no personalized "buy X" recommendations, no
  advice or signals; adults only (18+).
- Game results are kept apart from verified records: a game score is never shown as, or mixed into, a trader's
  verified record.
- 2026-11-01 (decided by the F-8 design council under the owner's instruction of 2026-11-01): The recommended design is **F-A · Forecast Run**: a 10-room, about 3-minute roguelike run over
  generated price lines in which the player gives the chance that the line ends higher (2..98 on a slider), with doors
  and lenses between rooms, bosses that ask a second forecast, a run summary that separates expected points (skill)
  from luck, and a finish cue. Alternates: F-D (Practice, staged: F-A first, a Range run row on evidence) and F-B
  (Range Run). Why: highest committee Borda count (65 of 80) and the only finalist all 20 members approved, after
  10,000 variants, a four-stage tournament and five thesis, antithesis and synthesis rounds
  (`docs/direction/game-2026-11-01.md`).
- 2026-11-01 (decided by the F-8 design council under the owner's instruction of 2026-11-01): Scoring is the log score in coin-flip points, `round(100 × (1 + log2 q))`; 50 always scores 0, and
  every summary shows expected points before outcome points. Why: a proper scoring rule makes the honest forecast the
  best strategy and punishes overconfidence; paper P&L, hit rate and rank-versus-field reward luck or risk-taking.
- 2026-11-01 (decided by the F-8 design council under the owner's instruction of 2026-11-01): The owner's "make trades and try to maximize returns" is kept as maths, not as UI: points equal the
  log growth of a paper split at even odds, so maximising expected points means forecasting honestly. The UI never
  shows a balance, stake, odds, payout or return, and says "forecast", not "trade" or "call". Why: a run with a house,
  prices, a compounding balance and payouts has the shape of a wager (POLICY F6) even with no money; "call" reads as an
  options contract.
- 2026-11-01 (decided by the F-8 design council under the owner's instruction of 2026-11-01): Generated lines only: no market data, tickers, dates or real securities in the game. Why: no data
  vendor or licence, nothing that reads as a call on a real stock (F1, F3b), and no re-identification of masked
  history.
- 2026-11-01 (decided by the F-8 design council under the owner's instruction of 2026-11-01): Practice lives only in the signed-in, 18+ account menu; never in the feed, on a profile, a share card
  or beside a verified number; never pushed; no social graph features (no friends, ghosts, duels or leaderboards);
  sharing is a text-only "Copy route" with no numbers. Why: game results stay apart from verified records (F3a, P3),
  nothing pushed may come from price moves (F3b), and the product has only one-way follows.
- 2026-11-01 (decided by the F-8 design council under the owner's instruction of 2026-11-01): Engagement comes from new questions, visible improvement and a stated end, never from compulsion: no
  streaks, timers, countdowns, currency, unlocks by play count, re-roll or Play again button, or outcome-based
  rewards, and the luck line disappears after the finish cue. Why: POLICY F6 and the responsible-design veto.
- 2026-11-01 (decided by the F-8 design council under the owner's instruction of 2026-11-01): Timing is the owner's call (record section 8, O3): 15 of 20 members want F-A's first session run
  first as **F-E**, a flagged 28-day test with a holdout, written start and decision dates and pre-written stop rules,
  whose expected result at week-8 scale is "stop" (meaning "build after the gates"). The business lead's phase-fit
  dissent stands. Open owner questions O1–O5 (points as "performance" under F3, a signed-out demo card under P4,
  timing, F-C's floor, the word "forecast") are in the record, section 8.

## Acceptance criteria
To be written once the design is settled.

Proposed (decided by the F-8 design council under the owner's instruction of 2026-11-01) for F-A, pending the owner's confirmation (Status stays draft). Each names how it is checked.
- AC-1 Points = `round(100 × (1 + log2 q))`; q = 50 scores 0 on either outcome (unit).
- AC-2 Expected = `100 × (1 + p* log2 q + (1 − p*) log2(1 − q))` and Best expected = Expected at q = p*, to 0.1, for
  p* in 0.02..0.98; Best − Expected ≥ 0 and is 0 only at q = p* (property).
- AC-3 Fixture rooms p* 0.72 / 0.55 / 0.35 reproduce Expected +22 / −88 / 0 for Honest / Bold / Fifty and outcome
  totals +76 / −62 / 0 for outcomes higher, lower, lower (unit).
- AC-4 A room counts once its chart is shown; Exit on an unlocked card scores it as 50; the pooled n equals rooms shown;
  a started seed is never reissued (API).
- AC-5 Generator p* lies in 0.02..0.98 over 10^5 sampled rooms; no line's future is sent to the client before Lock
  (property + API).
- AC-6 Each lens has the highest expected value in at least one generator family mix; lens summary values are
  generator expectations, never another outcome (property + unit).
- AC-7 Every reveal and summary contains "Not investment advice. Past performance does not guarantee future results."
  exactly once as one unbroken string (DOM textContent).
- AC-8 No Practice page matches `/\b(stake|odds|bet|wager|return|returns|payout|wealth|win|jackpot)\b/i`, relative
  times ("in N hours", "ago", "left", "remaining"), "so close" or "just"; runs in CI on every Practice route (copy scan).
- AC-9 At 360 × 560 Lock's box is inside the viewport unscrolled; every control ≥ 44 × 44 px with ≥ 8 px gaps; Exit and
  Lock never share a row; at 200% text and 320 px reflow nothing clips and Lock is reachable by Tab and scroll
  (Playwright).
- AC-10 The slider works by arrows (1), Page (10), Home/End and the [−1]/[+1] buttons; its readout and the room
  position are announced (keyboard e2e + accessibility snapshot).
- AC-11 Before Lock the shown line has a text description (start, end, high, low, recent trend in percent), and every
  reveal names the end point (axe + DOM test).
- AC-12 Practice styles use no `--up` or `--down` token; Practice's own tokens pass the contrast-pair test in light and
  dark (unit on CSS).
- AC-13 Every Practice animation lasts ≤ 400 ms, has no line draw-on, and is a static frame under
  `prefers-reduced-motion` (`getAnimations()` durations + emulateMedia).
- AC-14 On every reveal and summary, Expected and Best expected lines precede This run and Luck lines in DOM order at
  equal or larger computed font size (Playwright DOM order + computed style).
- AC-15 The run summary offers only Done and Copy route; no control or timer starts another run (e2e).
- AC-16 A fixture of 60 shown rooms with known shortfalls fires the finish cue exactly once at margin M (config);
  afterwards no "This run" or "Luck moved" text renders (unit + e2e).
- AC-17 The Practice entry appears only in the signed-in, 18+ attested account menu and is absent from the feed,
  profiles, `/t` pages and share-card renders (e2e).
- AC-18 Copy route text contains no digits, no handle and no link, and contains the strip text (unit).
- AC-19 No push, email, badge, streak, currency, level or play-count unlock exists for Practice (grep + e2e).
- AC-20 Profile deletion removes every Practice row and seed log (e2e finds zero rows); the Privacy Policy lists the
  Practice fields, purpose and retention before the flag can be enabled (config check).
- AC-21 If F-E is chosen: the flag refuses to enable without start date, decision date and the owner's signed
  expected result in config; holdout accounts (fixed by account hash) see no Practice entry; the decision-date
  analysis returns the unpooled two-proportion 95% band and the stop decision for fixture lift, views and incident
  cases, and writes them unchanged to docs/DECISIONS.md (unit + e2e).
- AC-22 The first card renders within 100 ms of tapping Forecast run on a throttled mid-range profile (Playwright
  trace); the build lands in PRs of ≤ 400 changed lines, the first being flag + session-1 run + Report.
- AC-23 Before launch, playtests show: ≥ 8 of 10 first-time players lock room 1 within 10 s without the explainer;
  ≥ 4 of 5 explain "Expected" and "Luck moved this run" after one run; median room time ≤ 15 s; each door option is
  chosen by 20–60% of runs (playtest record in `docs/features/logs/F-8/`).
- AC-24 Any known limit the build leaves (for example generator families, the margin M, lens posteriors) is marked in
  code with a `ponytail:` comment naming what would remove it (grep in review).

## Open questions
- Game format (roguelike run, prediction rounds, leagues, puzzles), data (historical replays vs live prices),
  scoring that rewards calibrated predictions over luck, session length, ergonomics on a phone, sharing.
- How engagement mechanics stay within POLICY and avoid compulsion patterns.
- How the game relates to verified records and the feed, if at all.

## Rework notes
