# F-29 · QA (tester, 2026-11-02)

Branch `claude/f29-gated-options-wording` at 6a28c863, plus the uncommitted user-test spacing change (the pane label rule
`margin-top: -10px; margin-bottom: 8px` in `app/globals.css`, the gap checks in `e2e/f29-gated-wording.spec.ts`, and the
CSS pin in `lib/f29-gated-wording.test.ts`). Everything below was run against a build of that working tree.

## Checks run
- `npm run build`: passes. `npx tsc --noEmit`: clean (at 07b34976). `node --test lib/f29-gated-wording.test.ts`: 14/14.
- Full Playwright suite, in four chunks against one `npm run start` (env as in the brief): **365 tests, 358 passed,
  6 skipped, 1 failed**.
  - The failure is `e2e/fixes-labels.spec.ts:242` (C1 AC7: `.hide-bar` stays empty after the touch swipe). It is the
    known pre-existing failure, it fails alone as well, and it does not touch F-29 code. The 7 tests after it in that
    file were skipped by the failure in the first chunk. Re-run with `--grep-invert "C1 \(AC7\)"`, all 7 pass.
  - `e2e/f29-gated-wording.spec.ts` and the six first-screen tests the plan names (`fixes-labels.spec.ts:119`, `:167`,
    `record-strip.spec.ts:84`, `:125`, `f13-first-visit.spec.ts:116`, `f10-followups.spec.ts:148`) all pass after
    the spacing change.
  - The e2e run rewrites `docs/features/logs/F-2/screenshots`. They were restored with
    `git checkout -- docs/features/logs/F-2/screenshots`.
- Exploratory, signed out, 360x740 and 320x740, light and dark (script output in the findings below). Screenshots are in
  `docs/features/logs/F-29/qa/`: `<w>-<scheme>-feed-card.png`, `-pane.png` (the pane as it opens), `-profile.png`,
  `-how.png`, `<w>-light-profile-full.png`, and `<w>-light-pane-figures.png` (the pane scrolled to its figures, shot
  again after the spacing change).

## Acceptance criteria, as observed in the app
| AC | Observed | Result |
|---|---|---|
| 1 /how, both states | /how `#options + p` is `data-options-how="interim"` with the signed words. "consented", "not asked" and "declined" appear nowhere on the page at either width or theme. The open state is checked only on the mounted component (the page itself cannot flip without a deploy). | Pass |
| 2 one qualifier per card and pane, in position | Feed card for yolo_yuki: 1 "Excluding options" (in the strip, 4 px under the average), 1 count line. Pane: 1 plus the chart caption ("· excluding options", lowercase), right after `section.stats`, then `.pane-options`. Profile: 1 (directly above the stats) plus the caption. | Pass |
| 3 shares and alt keep the qualifier | og:image:alt and twitter:image:alt carry "excluding options". The unit test re-asserts the F4-4 figures. | Pass |
| 4 announced with the headline | Reading order (e2e ariaSnapshot) passes. Pane: the label now sits 6 px under the tiles and 8+ px above the count line. | Pass |
| 5 no "not asked" or "declined" | Source scan, and the rendered text of feed, pane, profile, /how, trade and month pages. | Pass |
| 6 no pre-flip cache | curl: pane `?v=2&g=o0` gives `public, max-age=60`. `?v=2`, `&g=o1` and `&g=x` give `no-store` (200). Story `&g=o0` gives `public, max-age=300`, and `g=o1` or no g gives `no-store`. opengraph-image with any g, or none, gives `public, max-age=0, must-revalidate`. Profile, /how and feed give `private, no-store`. og:image and twitter:image are `…/opengraph-image?g=o0`. The client bundle's LazyPane fetches `withGate(...)`. | Pass |
| 7 sign-off recorded | `legal-signoff.md` quotes the words, which match the cycle-5 ballots (`approval-2026-11-01-cycle5-ballots.md:501`). The PR body is still to be checked by the reviewer. | Pass (file) |
| 8 words verbatim | Byte-equal on the running /how page. | Pass |
| 9 flip in one process | /how and pane bodies differ (mounted). The share part is not applicable by design and is left unticked for the business lead. | Pass (with the noted gap) |
| 10 360/320 with F-21/F-34 lines | Checked only on a mounted fictional pane that has no chart. See finding 1. | Partial |

## Findings

### 1. Medium (usability/spec): in the real pane at 360x740 the qualifier and the bottom of the headline tiles open below the fold, and the AC 10 test does not see it
Repro: run `npm run start`, open the feed at 360x740, scroll to yolo_yuki's row and swipe to the pane (`row.scrollTo({left: row.clientWidth})`),
and leave the pane at scrollTop 0. Measured: disclaimer 478–517 (in view), headline `section.stats` 615–755 (its last
line, "95% range", is past 740), and "Excluding options" 761–781, off the first screen. At 320x740 the stats start at
694 and the label sits at 930. Before D5 the label sat above the stats (about 615), so it was in view when the pane
opened. A reader now sees 50% and +0.9% with no qualifier until they scroll. The hero "+12.6%" keeps its caption
qualifier, so the first screen is not unqualified, but the headline figures decision (b) names are.
The AC 10 and D5-stop e2e mount `ProfilePane` without a chart (`e2e/f29-render.ts` passes no `chart`), so the tiles
sit high and the "headline in view at 360" check passes on a layout that is not the real pane. Suggest: run the AC 10
check on the real seeded pane, or give the fixture the chart and range controls. Then decide, with the owner or
council, whether the label must be in view when the pane opens (the D5 fallback, label above the stats, would bring
it back).

### 2. Low (spec): the label sits in different places on the profile and in the pane
Repro: open `/u/yolo_yuki` at 360 (the label is above the tiles, 200–219, tiles from 227), then the pane (the label is
below the tiles). Both follow the plan (D4 and D5), but a reader who goes from the swipe pane to the profile sees the
same qualifier move. Worth a line in the user test.

### 3. Low (test strength): the qualifier counts are case-sensitive
`/Excluding options/g` in `paneQualifier` and in the card count does not count the lowercase "excluding options" (the
chart caption's wording). A second lowercase qualifier added outside a figcaption, in the pane or the card, would pass
AC 2. Today the only lowercase one is in a figcaption (checked case-insensitively: pane and profile each have 1
`.share-label` plus 1 FIGCAPTION, and the card has 1). Suggest `/excluding options/gi` after removing the figcaption.

### 4. Low (test/plan accuracy): "/how stays static" is not true at runtime
The build route table lists `/how` as `ƒ` (dynamic), and the response is `private, no-cache, no-store`. The unit test
"AC6 (E6): /how stays static" only checks the source (no `revalidate`/`dynamic` export). This is harmless, since a
dynamic, no-store /how can never serve a pre-flip body, but the plan's premise (D2, "/how is static") and the test's
name are wrong. Rename the test or drop the claim.

### 5. Low (cache, by design): opengraph-image routes ignore `g`
`/u/<h>/opengraph-image?g=o1` is served today with the same headers as `g=o0` (`max-age=0, must-revalidate`), so the key
only busts the URL. This is acceptable because the image body is identical in both gate states (plan B3/E7) and the
header forces revalidation. Noted for the AC 9 wording that goes back to the design session.

### 6. Low (pre-existing, not F-29): double full stop in the profile og:description
Repro: `curl -s localhost:3000/u/yolo_yuki | grep og:description` shows "…aren't shown on this record.. Not investment
advice." `OPTIONS.gated` ends in "." and `app/u/[handle]/page.tsx:138` appends `. ${DISCLAIMER}`. This is unchanged by
F-29 and belongs in a separate fix.

### Not exercised in the app
- The owner's share-prompt and story URLs (signed in), and the Similar sheet's LazyPane fetch (the seed has no Similar
  rows signed out). Both are covered by the source tests, and the built client chunk shows
  `fetch(withGate(\`/u/${…}/pane?v=${…}\`))`.

No Blocking findings.
