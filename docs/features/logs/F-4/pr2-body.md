F-4 PR-2: card model and trust copy

Branch `autopilot/feature-4-card-model` (built on `autopilot/feature-4-tr9`, plan C7) → `main` after PR 1.
Feature: `docs/features/F-4-share-card.md`. Plan: `docs/features/logs/F-4/plan.md` PR-2, with the O1 amendment.
Log: `build-pr2-engineer.md`.

## Direction

One model holds every word, number, colour and chart shape on the record card. The two share images in PR 3 draw it
and nothing else, so the card can't say something the model's tests haven't checked. The trust copy is the owner's
10-cell table, worded the same for losses as for gains.

## What changes

- `lib/record-card.ts`, a pure model (no database, no React):
  - **Headline:** the average return per trade.
  - **Range:** "likely between …" from 5 bets.
  - **Trust line:** the owner's 10 cells. Direction is read from the range printed beside it.
  - **Evidence pill**, plus the period, the trade count with "losses included", and the 0% chart geometry for both
    layouts.
  - **Badge:** never blank; Verified only when the record earns it.
  - **Alt text:** every word on the card.
- `lib/card-glyphs.ts`: the bundled font's coverage. A display name the font can't draw shows as `@handle`, so
  rendering never fetches a glyph from a third-party service.
- `lib/copy.ts`: the card labels and the trust-line table, inside the existing copy scans.
- No route, schema, dependency or font change. The images are unchanged until PR 3.

## Tests

- 641 → 666 unit and DB tests, all passing (12 LOAD skipped). The added checks:
  - every trust-line cell, for gains and losses;
  - the reader test;
  - win/loss parity;
  - computed contrast;
  - the type-scale floors;
  - the glyph list against the font's cmap;
  - hostile display names;
  - the period cases;
  - a 10,000-close model;
  - model snapshots.
- No e2e test changes, because no route changes.
  - The heavy-feed test is a known failure; it also fails on `main` on the reseeded database.
  - In the fix-round run, the demo-only section test hit a parallel-fixture race; it passes alone.

## Checks

`tsc` clean · `npm test` 666 / 654 pass / 0 fail · `guard: ok` · `compliance: ok` · `CI=1 npm run build` ok ·
e2e 115 passed, 2 failed, 3 skipped (vendor fake attached). The failures are the known heavy-feed test and a
parallel-fixture race in the demo-only section test, which passes alone. Product diff +284 / −3 (cap 800).

## Known limits

- **O2 (owner; the UX lead asks for an answer before PR 3 merges).** The headline is the arithmetic average, as on the
  profile. The range is centred on the geometric mean, so on a volatile record the headline can sit outside its own
  range, or point the other way from the trust line.

  Here is what the model prints today for three fixtures, each pinned by a test:

  | Fixture | Headline | Range | Trust line |
  |---|---|---|---|
  | 200 bets alternating −50% and +80% | "+15.0%" (green) | "likely between −13.3% and +3.8%" | "Based on 200 bets over 1 year. A long record, with no clear pattern." |
  | 1,000 bets alternating −30% and +35% over 400 days | "+2.5%" (green) | "likely between −4.8% and −0.8%" | "Based on 1,000 bets over 1 year. A long record, with consistent losses." (the line ends at "≈−100.0%") |
  | 10,000 trades, returns uniform between −5% and +5% | "0.0%" | "likely between −0.13% and −0.02%" | "Based on 10,000 bets over 1 year. A long record, with consistent losses." |

  This PR does not change the headline method. The UX lead's recommendation, which is the owner's choice: headline the
  centre the range is built on, so the figure, the range, the line and the trust line cannot disagree.
- **Tall count size.** The tall count is 47 px, not the plan's 46, which missed the plan's own 16 px floor at 375 px.
- **Plot heights.** These are first values; PR 3 tunes them under its render checks.

## Compliance

Answers to `docs/COMPLIANCE.md` §1 for this PR.

1. **Performance shown: yes (§2), as model text that PR 3 draws.**
   - **F3:** the disclaimer is a required field of every model, in every state (tested).
   - **F3b:** the trust lines and the pill describe the sample, never the trader or a future outcome. "Consistent"
     appears only for a long record whose range lies on one side of 0, for losses exactly as for gains.
   - **F2:** the reader and PROMO scans cover every cell and every string.
   - **F4, TR-9:**
     - the range is shown from 5 bets;
     - a losing record's model matches the winning one in layout and prominence (tested);
     - U+2212 for minus.
   - **F1:** no advice, no call to action.
2. **Personal data: no new data.** The display name and handle are already public. Percentages only (P3). The glyph
   guard keeps the name from reaching a font service when PR 3 renders (P6).
3. **Money: no.**
4. **Email, push, SMS, tracking: no.**
5. **User text:** the display name, already shown. It is drawn only when the bundled font covers it, otherwise
   `@handle`, and never altered.
6. **Sign-up, age, identity: no.**
7. **Vendor, dependency, font, image: none.** The glyph list reads the font next/og already bundles.
8. **Screen reader and keyboard:** the alt text carries every word and the chart sentence. Contrast is computed. Signs
   are in text on every number.
9. **Security posture: no change.** No route reads the model yet.
10. **Claims (§11):**
    - "Verified from broker" appears only for a connected, all-verified, non-demo record with closes;
    - "‹N› trades · losses included";
    - no "every trade is" or "all trades" claim (the caption "Return if every trade were the same size" is the
      profile's hypothetical).
11. **Checkout: no.**

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01RjX5z9QgguBwmothFQGPnj
