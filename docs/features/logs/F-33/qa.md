# F-33 QA log (tester, 2026-11-02)

Branch `claude/f33-ranking-evidence`. Fictional data only; every row the tester created was deleted afterwards.

## Builds
- **Build A** = `8e76e85` (the branch head when QA started). Runs 1 and the first edge-case pass used it.
- **Build B** = `6e9cfec4` (after the engineer's review fixes `d335d985`, section line "… Demo records last", ticker
  baseline and tools row "Too early to tell", options separator). Rebuilt with `npm run build`; every later run used it.

## Commands
```
set -a; . ./.env; set +a; export SNAPTRADE_BASE_URL=http://127.0.0.1:4102 SNAPTRADE_CLIENT_ID=e2e SNAPTRADE_CONSUMER_KEY=e2e
SEED=1 node --env-file=.env scripts/db-setup.ts
npm run build
npx playwright test <specs> --reporter=line
node --test lib/rank-weight.test.ts lib/zero-width.f33.test.ts lib/confidence.test.ts lib/discovery/section.test.ts \
  lib/discovery/similar.test.ts lib/ranking.f19.test.ts lib/record-card.rework.test.ts
node --test <scratch edge-case file>        # not committed (see Edge cases)
node <scratch screenshot script>            # Playwright library, 360x800, light + dark
```
Harness fix (no repo change): Playwright 1.64.1 wanted `chromium_headless_shell-1248`, the container had only 1243.
`npx playwright install chromium-headless-shell` fixed it. The first launch failed every test for that reason only.

## Runs and counts
| # | Build | Specs | Result |
|---|---|---|---|
| 1 | A | app, section, share-card, record-strip, options, f4-options-unfurl, f7-public-records, similar, f13-first-visit | 134 passed, 1 failed (flake, below) |
| 1a | A | `app.spec.ts:120` alone; then all of app.spec | 1 passed; 53 passed |
| 2 | A | full suite | stopped at 55/375 (no failures so far) to rebuild on B |
| 3 | B | section, f3-billing (/tools), options, f4-options-unfurl, record-strip, chores-cycle3, fixes-cycle4-part2, share-card | 82 passed, 2 failed, 3 skipped (test state, below) |
| 3a | B | section.spec after removing the aborted run's leftovers | 6 passed |
| 4 | B | full suite (375) | 356 passed, 3 failed, 6 skipped, 10 did not run (16.5 min) |
| 4a | B | each of the 3 failures alone | all 3 fail again (real) |
| 4b | origin/main `eb2a6492` (worktree, own build, same DB) | the same tests by name (9 incl. siblings) | 9 passed |
| 5 | B | F-33 unit files (list above) | 83 tests: 81 pass, 0 fail, 1 skipped, 1 todo (OD 2.34) |
| 6 | A and B | scratch edge cases | 11 pass, 0 fail |

**Failure diagnoses**
- Run 1, `app.spec.ts:120` (pane opens with →): `.row:first .pane .badge.demo` not found within 5 s. It was the 9th test
  after a cold server start; passes alone and in a full app.spec rerun. Flake (timing), not F-33.
- Run 4, **`fixes-labels.spec.ts:119` (C1 AC7, 360×740), `/how`**: after the first percent figure is scrolled into view,
  the F3 line's bottom is at 1,139 px (limit 629). F-33 added to `HOW.math` the sentence "The likely range is a 95% range
  around the average return per trade …", which is now the first percent figure on /how. The disclaimer sits 712 px
  below it (measured: first "%" at y 760, F3 line at y 1,472). Caused by F-33 (finding 1).
- Run 4, **`fixes-cycle2-a11y.spec.ts:302` (AC14.1, thesis height 0 at 360×480)** and **`thesis-safety.spec.ts:136`
  (the note's `<bdi>` hidden at 780×360)**: both pass on origin/main. Mechanism: the seeded demo traders have 30 bets over
  60 to 61 days. On main `dividend_dan` weighs 0.0251 (old 10-bet floor) and leads the feed; under F-33 all three weigh
  0 (under 90 days). So each test's fresh fixture trader (big recent returns, highest base score) becomes feed card 1.
  Card 1's thesis slot holds the F-13 first-visit notice ("Dismiss this note" is in the failure snapshot), so the
  fixture's thesis or note is not shown. The F-33 ranking change works as intended; the tests assume a demo card comes
  first. Caused by F-33 (finding 2).
- Run 3, `section.spec.ts:78` and `:194`: four `heavy_feed_*` traders were in the feed. They were left by run 2, which I
  stopped in the middle of app.spec's heavy-feed test (its cleanup never ran). After deleting them, section.spec passes
  6/6. Test-state issue caused by the tester, not F-33.

## Edge cases (unit level, fictional records)
| Case | Result |
|---|---|
| K = 29 vs 30 bets (span 120 days) | 0 vs > 0 |
| span 89 / 89.999 vs 90 days (40 bets) | 0 / 0 vs > 0 |
| 40 × −100% vs 40 × +100% | both 29.904 (finite, exact mirror; see finding 3) |
| huge returns (50, 1e6, 1e12, MAX/1e10) with spread | finite, ≥ 0 (0: too wide) |
| one NaN holding day / one Infinity holding day / one NaN return | 0, never NaN |
| one symbol, 3,000 overlapping trades | 1 bet → 0, 3 ms; 3,000 non-overlapping same-symbol trades → finite > 0 |
| exact loss/gain mirror, 9 shapes (±1.3%, 5%, 20%; 30, 47, 200 bets) | `assert.equal` each |
| cycle-5 probe (10 × +1%, jitter, 10 × −1%) vs 200-bet record | all lower |
| range at or above the floor (40 bets, 3% ± 1 pt) | printed range has width, tier not too-early |

Zero-width printers, for 40 × +1% at the tier and 6 × +1% under it: `cardEvidence` tier too-early, no verdict;
`evidenceRangeText` and `rangeText` null; evidence line and trust line say "Too early to tell", no "Past results";
record card unfurl, square and story: range slot, `cardAlt` and `cardDescription` all carry "Too early to tell"; record
strip on feed, page, figures and image: visible text has it, alt has "too early to tell" (lower case mid-sentence, see
note 8); pane `rangeLine` = "Too early to tell", `range` null. Stock baseline and tools row are covered by
`lib/zero-width.f33.test.ts` (R5) and pass.

In the running app (Build B, fictional trader `qa_flat_f33`, 40 closes of exactly +1% over 117 days, one fictional symbol):
profile shows "Too early to tell: the returns so far are too alike to give a range (40 bets)", never "+1.0% to +1.0%" or
"Past results"; the og:image:alt and og:description carry "Too early to tell"; the three story/card formats return 200;
`/t/QAFLT` and `/t/compare?a=QAFLT&b=KO` show "Too early to tell" and no zero range; the pane payload (`/u/…/pane?v=2`)
carries it. The text node is not aria-hidden. The /tools page needs sign-in and billing; it was checked at unit level only.

## Screenshots (docs/features/logs/F-33/qa/, 360×800, JPEG q60, all under 75 KB)
`feed-360-{light,dark}`, `feed-section-360-{light,dark}` (suggestions section with "How ranking works"; fictional
fixture of 40 traders + `qa_flat_f33`), `how-360-*` (top), `how-ranking-360-*` (the ranking paragraph),
`profile-dividend_dan-360-*`, `ticker-KO-360-*`, `profile-zero-width-360-*`, `ticker-zero-width-360-*`.
No page scrolled horizontally at 360 px.

## Findings
1. **bug, high (CI red).** The /how F3 line is not in plain view next to the page's first percent figure at 360×740.
   This breaks POLICY F3 placement (`e2e/fixes-labels.spec.ts:119` fails). Cause: F-33's new `HOW.math` sentence with "95%"
   (lib/copy.ts) is now the first percent figure, about 710 px above the disclaimer. Fix options: word it without a
   percent sign, or move it below the disclaimer.
2. **bug, high (CI red; test fixtures, not product).** `fixes-cycle2-a11y.spec.ts:302` and `thesis-safety.spec.ts:136`
   fail because F-33 drops the demo traders' weight to 0, so the fixture trader becomes card 1 and the first-visit
   notice takes its thesis slot. The tests need retargeting (same intent), for example dismiss or pre-stamp the
   first-visit notice, or assert on a card that is not card 1. No test may be weakened.
3. **spec, high (owner, R2).** A zero-width record at the tier prints "Too early to tell" but gets far more ranking
   weight than the 200-bet record, so it ranks above it. Measured (`rankWeight`, 1-day holds, 90 days): 200-bet record
   (+3/−2, two to one) 0.306; 30 × +5% 1.388; 30 × −5% 1.388; 30 × +10% 2.888; 30 × +5%/+5.04% alternating 1.394;
   40 × −100% 29.9. The build log measured only 40 × +1% (0.204 < 0.299) and says the floored record stays below the
   200-bet record; that holds only for returns near 1%. The 1-point floor is small next to a mean of several percent, so
   a fixed take-profit pattern of 30 closes tops the feed while its own page says "Too early to tell". This works against
   the feature's "Why" (small lucky samples should not top the feed), but no AC as written fails (AC1 tests only the
   10-trade probe). In the app, `qa_flat_f33` was the first row of the suggestions section, under the line "records with
   ranking weight come first". Possible fixes for the owner: weight 0 when the printed range has zero width, or a floor
   relative to the mean.
4. **usability, medium.** /how's ranking text is one paragraph of about 30 lines at 360 px (see `how-ranking-360-*`).
   A first-time viewer has trouble finding the "30 bets over 90 days" rule. Suggest splitting it into short paragraphs or
   a list (tier, weight, floor, base order, not a penalty).
5. **usability, low.** In the section, a record whose own page says "Too early to tell" sits first under "Verified records
   with ranking weight come first". A first-time viewer reads this as a contradiction (same root as 3).
6. **usability, low.** `/t/<symbol>` intro says "Few trades means a wide range, and that is expected", while a 40-trade
   zero-width symbol shows "Too early to tell" under the average. Nothing explains why 40 trades are "too early" there; the
   profile's evidence line does ("the returns so far are too alike to give a range").
7. **note.** The "How ranking works" link is 16 px tall. It is inline in a sentence, so WCAG 2.5.8's inline exception
   applies, but it is a small tap target at 360 px.
8. **note.** The record strip's alt text says "too early to tell" in lower case mid-sentence while the visible text is
   "Too early to tell". Screen readers read them the same way; flagged only because the spec says "equal".
9. **note.** One NaN or Infinity holding day sets the whole record's weight to 0 (fails closed, never NaN). That is
   acceptable, but the record then silently loses its weight; a log line would help.

## Verdict
**Fail: findings 1 and 2 (CI red), and finding 3 goes to the owner.** The F-33 unit ACs pass (rank-weight, zero-width,
section, ranking pins), and the edge cases hold: tier boundaries, mirror, NaN, 3,000 overlaps. "Too early to tell" reaches
every printer in the plan with matching accessible text. The e2e suite has three real failures caused by F-33 (1, 2).
Finding 3 fails no AC as written, but it is the R2 risk at a larger size than the build log measured.
