F-4 PR-1: TR-9 floor of 5 bets and the 10-point width

Branch `autopilot/feature-4-tr9` → `main`. Feature: `docs/features/F-4-share-card.md` (owner decisions 2026-10-22).
Plan: `docs/features/logs/F-4/plan.md` PR-1. Rulings: `ruling-pr1-h1.md` (business lead; supersedes C3). Logs:
`build-pr1-engineer.md`, `test-pr1-tester.md`, `committee-pr1-*.md`.

## Direction

From 5 independent bets, a record shows an honest range. It is never a fake-precise one, and losses are ranked exactly
like gains. A record competes for the top of the feed only from 10 bets.

## What changes

- **TR-9 model (`lib/trades.ts`).**
  - "Too early" is a model state, never a trade count. It applies below 5 independent bets (`MIN_BETS`), or when the
    per-trade range's half-width is over 10 points (`TOO_WIDE`).
  - A record too early by width keeps its range and shows no direction.
  - t with K − 1 degrees of freedom, as before.
- **Variance floor (ruling H1).** The spread used for both intervals is never below the sample's own. It is moderated
  toward a 1% move per √day held, weighted as 5 bets (`SIGMA_DAY`, `PRIOR_BETS`). So 5 identical trades never print a
  zero-width range.
- **Ranking floor (ruling H1).** `evidenceWeight` is 0 below 10 bets (`RANK_MIN_BETS`), so the ranking of 5 to 9-bet
  records is unchanged from main. It is also 0 for any too-early record, and capped at a finite value, so a run of
  total losses never weighs Infinity.
- **Copy.** One helper, `tooEarlyText`, replaces every "of 10 bets":
  - "Too early to tell (4 of 5 bets)";
  - "… (5 independent bets needed)";
  - "Too early to tell: the range is still too wide (6 bets from 18 trades, 67 days)".

  The profile's "What's this?" states the rule from the constants.
- **Pages.**
  - Ticker: the stock's own "too early" sits under its range, once. Hold-time and concentration rows say "too early"
    when theirs is. The baseline draws no verdict from a too-early range ("Not enough evidence for a comparison
    yet."). The concentration line states its count once. "signal" is gone from the hold-time note.
  - Compare: one "too early" per column.
  - Trade and month pages: the range is labelled "· 95% range" on its own line. "A short record shows wide
    uncertainty." appears only when the record is too early.
- **Rename (identifiers only).** `Edge` → `Direction`, `edgeText` → `directionText`. No user-visible string changes.
- **Not changed.** TR-7's "New record" (under 10 closed trades or 30 days), the feed's section and slot code
  (`lib/discovery/section.ts`, `lib/feed.ts` are byte-identical to main), the share card (PR 2 and PR 3), and the
  schema.

## Tests

- 623 → 640 unit and DB tests, all passing, 12 LOAD skipped. Added:
  - t at K = 5/10/30/100;
  - the K = 5 hand-computed interval;
  - the range from 5 bets;
  - the width boundary (including 0.7–0.9);
  - "never by a count alone";
  - the lucky-5-bet ranking test, original and mirrored;
  - no zero-width range from K = 5;
  - the 10-bet ranking floor;
  - the width rule sign-blind;
  - the total-loss weight;
  - the banned-word scan;
  - the trade and month `tooEarly` flag.
- Seven expectations moved to the owner's floor of 5. Two moved to the ruling's variance floor. None is deleted or
  loosened. `lib/feed.reach.test.ts` is unchanged and passes.
- e2e 116 passed, 3 skipped, 0 failed. Two new F-4 tests at 360 px cover the profile, trade, month, ticker and compare
  pages.

## Checks

`tsc` clean · `npm test` 640 / 628 pass / 0 fail · `LOAD=1` sync 5/5 and feed 6/6 · `guard: ok` · `compliance: ok` ·
`CI=1 npm run build` ok · e2e 116 / 0 failed (vendor fake attached). Product diff +81 / −45 (cap 800).

## Known limits

- **Owner FYIs from ruling H1 §6 (not blocking).**
  - DESIGN TR-9 steps 2 and 3 should mention the variance floor and the 10-bet ranking floor.
  - From 10 bets, "small lucky samples can't top it" holds only in probability (about 2% of no-edge 10-bet records, as
    on main) until the population-shrunk estimate lands.
- **Share images.** The story and profile share images still show a range for a too-wide record without saying "too
  early" (tester L3). PR 2 and PR 3 replace the card.
- **Copy order on the ticker page.** Hold-time and concentration rows are separate records (a bucket; the rest without
  the leader), so they can say "too early" in addition to the stock's own line.
- **Test isolation.** `lib/feed.load.test.ts` can leave 10,000 rows on a demo trader when run against a seeded
  database. This is pre-existing and queued as its own task.

## Compliance

Answers to `docs/COMPLIANCE.md` §1 for this PR.

1. **Performance shown: yes (§2).**
   - **F3 disclaimer:** unchanged on every page.
   - **F3b:** labels describe evidence only ("thin", "too early", "the range is still too wide"). "edge" is gone from
     identifiers and from every string (scan test), and "signal" is gone from the hold-time note.
   - **F4 / TR-9:** the range shows from 5 bets and stays when wide. Losses mirror gains in tests, and the ranking
     stays on the pace lower bound in log space. Small samples can no longer top the feed (ruling H1).
   - **F1:** no advice. The ticker baseline no longer draws a verdict from a too-early range.
2. **Personal data: no.** No new field, read, log or tracker. Percentages only (P3).
3. **Money: no.** No trades, funds, payments or rewards.
4. **Email, push, SMS, tracking: no.**
5. **User text: no change.** No new user text is shown or stored.
6. **Sign-up, age, identity: no.**
7. **Vendor, dependency, font, image: none.** No package file changes.
8. **Screen reader and keyboard:**
   - text-only changes in existing styles;
   - no new control;
   - direction in words as well as colour;
   - no horizontal scroll at 360 px (e2e).
9. **Security posture: no change.** Same public routes; no new query input.
10. **Claims (§11):**
    - none added;
    - "Verified" is untouched;
    - no "every trade" or "all trades";
    - the false "A short record shows wide uncertainty" next to a narrow range is removed.
11. **Checkout: no.**

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01RjX5z9QgguBwmothFQGPnj
