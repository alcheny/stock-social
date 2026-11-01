# F-4 · Committee round 1 · verdicts and the engineer's round 2

Date: 2026-10-26. Build reviewed: `build-engineer.md` (commits f146057..ff41cfd). Both members returned the build:
the business lead (**not passed**) and the UX lead (**not passed**). Their demands reached the engineer through the
coordinator as one merged list (below, items 1 to 10, with the items held for the owner, A to C); this file
summarises each demand faithfully and records what round 2 did. The coordinator pastes the members' verdicts into
the PR. Nothing here changes a decision in the feature file.

## Verdicts

- **Business lead: not passed.** **UX lead: not passed.**
- The engineer received the two verdicts as one merged list of demands from the coordinator, without the members'
  own wording or which member raised which item, so this file does not attribute the demands; the coordinator adds
  the verdict texts to the PR. In short: the card did not lead with what the owner chose (chart, count, period); it
  missed the planned 10 CSS px floor (round 1 loosened it to 9.5 at 375 px); its two durations, its labels per size
  and its alt text disagreed; "New record" was a grey suffix; the 0% label could sit under the line; the disclaimer
  and trust line left orphans; ten states had never been rendered; the share picture printed the request's Host
  header; the link-preview text printed "% win rate".

## Demands and what round 2 did

| # | Demand (summary) | Done | What changed, and the test |
|---|---|---|---|
| 1 | One duration per card: the period and the trust line give the same months/years from one span function (same end, same rounding); test the fixtures and spans of 29, 30, 31, 364, 365 days and a ~60-day demo-like record. | Done | `lib/confidence.ts`: `spanBetween(first entry, now)` (whole days, whole calendar months in UTC, years = months / 12) and `spanText(span, unit)`; the unit is the owner's per tier (thin days, moderate months, strong years; too early months). `recordCard` computes one span and both lines print `spanText` of it, so the period reads "Record since Aug 2026 · 61 days" beside "…over 61 days." Test R1 (11 records incl. 29/30/31/364/365/400/800 days and the demo-like 60-day record). Note for the owner: in the thin and strong tiers the period's unit follows the trust line (days / years), where AC1's example shows months. |
| 2 | Readability floor 10 CSS px at 343 px wide for every element (0% label, body text); restore 10; reach it by deleting, not shrinking: evidence label into the trust line's row; the unfurl disclaimer may wrap. | Done | Every font in `CARD_LAYOUT` ≥ 10 CSS px at 343 px (unfurl 35 px, square/story 32 px; the 0% label is its own `zero` role). Deleted to make room: the separate evidence line (now "Evidence: thin · Based on …"), the brand word on the unfurl (the link preview names the site; the square/story pictures keep it), the grey "· New record" suffix. The disclaimer takes two lines. Test R2. |
| 3 | Hierarchy: chart ≥ 30% of the card on every size (square ≥ 360 px tall, story ≥ 560 px); count and period at ≥ 1.5× body in the text colour; the average the one big number; layout test + re-render. | **Partly** | Square: 968×364 plot, 30.2% of the card. Story: 1080×580, edge to edge, 30.2%. Count and period at 1.5× body or more (53 / 48 / 52 px), text colour, each with its words under it ("48 closed trades / losses included", "14 months / Record since Jul 2025"). The average is the largest text on every size. **Unfurl: 556×322 = 23.7%, not 30%.** At 35 px minimum every required element (name, handle, badge, average, label, range, count, losses included, period, chart, caption, evidence + trust line on two lines, disclaimer on two lines) leaves at most about 363 px of height beside a text column that the range text needs at least 540 px wide for; 30% needs about 614×370. Reaching it needs one more deletion the committee or owner should choose (for example the chart caption, which waits on owner question A, or the handle, which AC1 requires). Test R3 pins square/story ≥ 30% and the unfurl at its measured floor (≥ 22%). |
| 4 | The same trust label at every size: Verified on square and story too (read-only wording only where it is the F3a explanation); test identical labels in every state; Demo a visible badge at least as strong as Verified (outlined pill, non-grey), with "Demo data, not a real broker record" on the unfurl too. | Done | One rule at every size (`imageTrust('profile')`): "Verified from broker" everywhere; the old story-only label "Imported read-only from the broker" is no longer a label. The label is an outlined pill on every size: Verified green, Demo sky blue (`tone: 'demo'`), failed amber, not verified / importing grey. Demo reads "Demo data, not a real broker record" on all three sizes. Test R4 (4 states × demo × verified × empty, all sizes identical; demo tone). |
| 5 | Render the missing states at unfurl, square and the 343/375 preview: 3 trades, 12 trades too wide, demo, not verified, failed import, importing, connected-but-empty, a 40-character name, a 3-digit month count, a 1-trade record. "New record" at least the count line's size in the text colour. The period never wraps. | Done | `e2e/share-card.spec.ts` now seeds 14 records (the 4 earlier + the 10 named) and renders each at unfurl, square and story, plus unfurl and square in a 343 px preview: 70 PNGs. "New record" is an outlined pill at the count line's size (53 / 48 / 52 px) in the text colour (unfurl: beside the trust badge; square/story: beside the name). The period's two parts are single short lines with `nowrap` ("under 1 month", "110 months"). When the badges crowd the name row the handle gives way first. Tests R5 and the e2e spec. |
| 6 | Move the 0% label off the plot (left gutter or right end); test path min x ≥ label width + gap. | Done | The plot keeps a left gutter (`zeroGutter`: label width 1.5× its size + 10 px; the story's also holds the page margin since its plot runs edge to edge); the line starts at the gutter and the dashed baseline starts after the label. Test R6 (every size, winning/losing/one-trade). |
| 7 | No orphans: break the square/story disclaimer after "advice."; the trust line never leaves a one-word last line. | Done | `disclaimerLines` breaks after "advice." on every size. `noOrphan` joins the trust row's last two words and binds every one- or two-letter word to the next ("A fair", "on 48 bets") with no-break spaces; the first re-render showed "…14 months. A / fair sample." and this fixed it. Test R7. |
| 8 | Security: the share picture printed the request's Host header (`url.host`) on a publicly cacheable image; use the configured origin; test a request with `Host: evil.example`. | Done | `cardLink(env, handle)` uses `siteUrl` (NEXT_PUBLIC_SITE_URL, then the deploy's production URL, then localhost), the same origin the sitemap uses; the story route no longer reads `url.host`. Unit test R8; e2e: the square and story pictures requested with `Host: evil.example` are byte-identical to the plain request. |
| 9 | Alt text: og:image:alt and the share prompt's preview alt (which always said "N verified trades") built from the same card model: label, name, average with range, gain or loss in words, count, period, trust line, disclaimer; test it contains each non-null model string for winning, losing, empty, demo, not-verified and no-broker, and never says "verified" unless the label does. | Done | `cardAlt(model)` in `lib/record-card.ts`; the profile's metadata and the share prompt both build it from `loadRecordCard` (the image's own read). Test R9 (8 cases, every drawn string present, "a gain" / "a loss", "verified" only with the label). Three e2e assertions that pinned the old one-line alt (`app.spec.ts` demo preview, `connect.spec.ts` importing and failed) now check the new alt's label, its absence of "verified" and its closing disclaimer. |
| 10 | The unfurl text under the card printed "% win rate" with no wins; fix now, leave win rate in that text until the owner rules. | Done | `winRateText` in `lib/copy.ts` ("0% win rate"); `page.tsx` uses it. Test R10. |
| A | Which series the chart plots and the caption wording. | Waits for the owner | Unchanged. |
| B | Whether the range is built for the arithmetic mean so the headline always sits inside it. | Waits for the owner | Unchanged (the heavy fixture still reads "+0.3%, likely between +0.1% and +0.3%"). |
| C | The trust table's negative rows and the under-5-bets wording. | Waits for the owner | Unchanged. |
| — | A new font file; the ranking floor. | Not now / no change | No font added; ranking stays at 10 bets. |

## Tests changed in round 2 (all written before the code)

- `lib/record-card.test.ts`: the AC snapshots now carry the round-2 fields (`countValue`, `countNote`,
  `periodSince`, `periodLength`) and the shared duration ("298 days" in both lines for the 12-bet thin fixture,
  where round 1 printed "9 months" and "115 days"); AC8 expects the demo label on every size; AC9's floor is back to
  10 CSS px at 375 (and R2 checks 10 at 343). New: R1 to R10 (10 tests; the suite went from 657 to 667).
- `lib/story-image.test.ts`: the verified label on the square/story is "Verified from broker" (demand 4).
- `e2e/share-card.spec.ts`: 14 records instead of 4; the preview at 343 px; the forged-Host test.
- `e2e/app.spec.ts` (1 assertion), `e2e/connect.spec.ts` (2 assertions): the og:image:alt expectations follow
  demand 9, each with more checks than before (label, no "verified", disclaimer).

## Results (this worktree, Node 24.22.1)

| Check | Result |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `npm test` (`node --env-file=.env --test`) | 667 tests: 655 pass, 0 fail, 12 skipped |
| `npm run build` | exit 0 |
| `e2e/share-card.spec.ts` | 3 pass |
| `e2e/app.spec.ts -g card` | 12 pass, 1 fail: the pre-existing heavy-feed test ("fix round 8, F-2 PR-1: 30-card pages…"), which fails the same way on the base commit 619ec80 (`build-engineer.md`) |
| `e2e/app.spec.ts -g share` / `-g story` | 5 pass / 1 pass |
| `e2e/app.spec.ts -g "fix round 6: the demo trader"` (alt) | 1 pass |
| `e2e/connect.spec.ts:499`, `:621` (alt; vendor fake env per the spec header) | 2 pass |
| `BASE_REF=main node scripts/compliance.ts auto` | 1 finding, not from this change: the installed `@img/sharp-wasm32` license (lockfile untouched) |
| `node scripts/autopilot.ts guard main` | ok (after the round-2 commit) |

`lib/trades.ts` did not change in round 2, so the load suite was not re-run (round 1: 5 pass).

## Screenshots (`screenshots/`, re-rendered)

14 records × `-unfurl.png`, `-square.png`, `-story.png`, `-unfurl-375.png`, `-square-375.png` (the last two: the
image 343 px wide in a 375 px viewport): `winning`, `losing`, `empty` (no broker), `connected` (connected, no
closes), `heavy` (4,200 trades), `three` (3 trades, too early, New record), `wide` (12 trades, range too wide),
`demo`, `unverified`, `failed`, `importing`, `longname` (40 characters), `months` (110 months), `one` (1 trade).
Looked at: every rendering shows its trust badge and both disclaimer lines; nothing overflows; the 0% label never
touches the line; names ellipsize after the handle gives way.

## Open after round 2

1. Demand 3 on the unfurl (23.7% against 30%): needs a further deletion chosen by the committee or the owner.
2. Owner questions A, B, C and the font, as the coordinator listed.
3. The period line's unit follows the trust line's (days in thin, years in strong), where AC1's example reads months.
