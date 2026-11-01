# Design council cycle 3, round 2: engineer review (2026-11-01)

I re-read the revised F-25, F-26 and F-27 and round2-changes.md. Checked against main 06edbdf. No repo file or draft
was edited.

| File | Verdict |
|---|---|
| F-25 | NO, as written. I sign once changes 1-7 are applied. They are mechanical, but two of them fix false facts. |
| F-26 | SIGN |
| F-27 | SIGN. Change 8 is a test-method fix, not a direction change. |

## A correction to my round 1: the size cap
The feature pipeline's cap is 800 lines, and it counts **product lines only**. Tests, e2e specs and docs don't count
(`docs/FEATURES.md` → Merge, `MAX_DIFF`, `scripts/autopilot.ts:677`). My round-1 "≤ 400 lines including tests" was
the autopilot variant rule, and it does not apply here. Separately, the pipeline builds **one feature as one PR**
(`F-<n>: …`). The reviewer checks every AC of the feature file against that PR. So "PR 1 / PR 2" and "PR 1a / 1b"
inside one feature file can't be run by the pipeline.

## Sizing PR 1 with the move to `trade_key`

| Part | Product lines | Test lines |
|---|---|---|
| Key route and 308 (page and image), `loadTradeShare` by key, legacy lookup | ~35 | ~40 |
| `lib/trade-href.ts`, `TRADE_LINK`, Verified glyph `aria-hidden` | ~25 | ~25 |
| Callers switched to `trade_key`: profile, month, notes list, stock list, similar, likes, hidden, new-trades prompt and its loader, `/me/record` reflection form and its action (see change 4) | ~70 | — |
| Shape R and Shape C rows, sign words, suffixes (stock, notes, month, profile, pane) | ~80 | ~110 |
| `records1` `limit 5` key column, `PaneTrade.tradeKey`, pane route and lazy pane | ~20 | ~25 |
| CSS (44 px rows, Shape C 44 × 44, focus ring) | ~25 | ~30 |
| Leak, rebuild, statement-count and source tests | — | ~90 |
| **Total** | **~275** | **~320** |

That is well under the 800 product-line cap, so the 1a/1b split is unnecessary. The feed-card footer link adds about
40 product lines and 120 test lines.

## Redirect and image route in Next's file routing: feasible

**Folder name.** The `[sellId]` segment name is internal. Next never exposes it, so a 64-hex `trade_key` fits the
same folder. Two options, both fine:
- keep the folder and rename only the destructured variable;
- `git mv` it to `[tradeKey]`. That touches about 9 path strings: the month page's `TradeShare` import,
  `lib/format.ts:34,45`, and the file-reading tests `lib/share.test.ts`, `lib/f12-followups.test.ts`,
  `lib/f12-strip.test.ts`, `lib/a11y-copy.test.ts`, `lib/a11y-fixes.test.ts` and `lib/record-strip.guard.test.ts`.
  These are path edits, not weakened tests, but they collide with F-11's branch, which edits the same tests.

**Do the 308 after a database lookup, in the route code, not in `proxy.ts`.** Hashing in `proxy.ts` would 308 any junk
segment (including `does-not-exist`) to a key that then 404s. That contradicts the AC "unknown is a 404" and puts
permanent redirects for nonexistent pages into caches. The lookup order:
1. by `(handle, trade_key)`, which is indexed;
2. otherwise by `(handle, sell_id)`, then `permanentRedirect(tradePageHref(...))`;
3. otherwise `notFound()`.

The redirect goes in the page body and the `opengraph-image` default export, not in `generateMetadata`. Next 16 can
stream metadata after the shell for browser user agents, and a redirect thrown there can become a soft
(meta-refresh) redirect. No `loading.tsx` sits above `/u/[handle]/trade/[sellId]`, so a redirect thrown in the page
body comes back as a real 308. A metadata image route is a route handler, so `permanentRedirect` there gives a 308
response as well.

The legacy branch costs one extra indexed query, and only on old URLs. No JS hash is needed, so there is no
Postgres/JS hash-parity risk. The AC must assert with `maxRedirects: 0` (change 3).

**Existing tests.**
- `e2e/app.spec.ts:519` asserts the new-trades link `href` ends in the `sell_id`. It must change to the `trade_key`
  (destination changed by decision).
- `e2e/app.spec.ts:413` fetches the image by `sell_id`, and `:417-418` expect 404. They keep passing through the
  redirect or the 404, and now exercise the legacy path.

## The shortened profile link text: checked
"Their record, wins and losses →" collides with:
- `lib/copy.ts:852` `PUBLIC.cardFooter` = "See their record, wins and losses →", pinned by `lib/f7-trust.test.ts:96`
  and written into F-7 AC 20 (`docs/features/F-7-public-traders.md:81`). Note that `app/ui.tsx:94` hard-codes the same
  string instead of using the constant.
- Regexes that will fail: `/See their record/` at `e2e/fixes-cycle2-a11y.spec.ts:288`, `e2e/f10-followups.spec.ts:79`
  and `e2e/record-strip.spec.ts:121`, and the exact string at `e2e/f7-public-feed.spec.ts:52`.
- **A test that would silently go vacuous:** `e2e/record-strip.spec.ts:168` asserts
  `/See their record, wins and losses/` has count 0 on the trade page ("the duplicate footer record link is gone").
  After the rename it passes whatever the page shows. It must be updated to the new text, or to
  `/record, wins and losses/i`.

**The one-line fit claim is wrong.** The draft says "about 300 px at 14 px against 328 px".
- The card footer is 16 px today (body font; no footer rule).
- Content width at 360 px is **320 px**: `padding: 64px max(20px, …)` with `box-sizing: border-box`.
- Widths below were measured in DejaVu Sans, the font the e2e runs pin (`e2e/fonts.conf`):

| Size | "This trade →" | "Their record, wins and losses →" | Sum with 12-16 px gap | Fits 320 px? |
|---|---|---|---|---|
| 16 px | 99.0 | 251.2 | 362-366 | no |
| 14 px | 86.6 | 219.6 | 318-322 | 0-2 px spare, which fails the repo's 15% headroom lesson |
| 13 px | 80.3 | 203.8 | 296-300 | ~7% spare |
| 14 px with "Record, wins and losses →" (183.2) | 86.6 | 183.2 | 282-286 | ~11% spare |

Page 1's first card also puts the swipe hint inline on the same footer line (`.feed .card .swipe-hint { display:
inline }`). Once the first-visit line is dismissed, that card wraps regardless of the text.

## Remaining required changes

### F-25
1. Move the feed-card footer link into its own feature file, F-28 "Trade link on the feed card", with `Blocked: waits for F-25 and F-26 to merge into main`. It takes the footer decision, the budget-stop decision, the gesture decision and their ACs. Delete the "two PRs / PR 1a, 1b" decision from F-25, because the pipeline builds one feature as one PR and PR 1 is about 275 product lines against an 800 cap. F-25's Blocked line then drops "and PR 2 also for F-26".
2. Replace the width sentence with "At 360 px the card's content box is 320 px and the footer is 16 px today; the footer links are set at 0.875rem and read 'This trade →' and 'Record, wins and losses →' (about 286 px in the e2e font, about 11% spare), sharing one line at 360 px and wider". Alternatively, if the committee keeps "Their record, wins and losses →", it must set 0.8125rem: about 300 px, about 7% spare. 14 px with that text has no spare and must not be chosen.
3. Change the redirect AC to: "`GET /u/<handle>/trade/<sell_id>` and `…/<sell_id>/opengraph-image` with `maxRedirects: 0` answer 308 with `Location` equal to the `tradePageHref` form; an unknown segment in either form, including another handle's `sell_id`, answers 404 with no redirect (e2e)". Add to the decision: "the legacy lookup is a database read in the page body and the image route, not a hash in `proxy.ts`, and never in `generateMetadata`".
4. Add `/me/record` to the decision and the leak AC: "the reflection form posts the `trade_key` (hidden input `tradeKey`), and `app/actions.ts` resolves it to the row with `user_id = me and trade_key = $1`". Today it renders `sell_id` in a hidden input and posts it, and the "no `sell_id` in any rendered HTML" decision covers that page.
5. Add an AC: "the profile link's text is one constant used by `app/ui.tsx` and `PUBLIC.cardFooter`; `lib/f7-trust.test.ts:96`, the regexes at `e2e/fixes-cycle2-a11y.spec.ts:288`, `e2e/f10-followups.spec.ts:79`, `e2e/record-strip.spec.ts:121`, the string at `e2e/f7-public-feed.spec.ts:52` and the count-zero check at `e2e/record-strip.spec.ts:168` are updated to the new text (that last one must still fail if the duplicate record link returns)". Also add a dated decision in F-7 (or a line in this file) saying it supersedes F-7 AC 20's footer string. This belongs in F-28 if change 1 is applied.
6. Add to the budget AC: "including page 1's first card with the first-visit line dismissed (`data-ss-seen~="line"`), where the swipe hint shares the footer line". This belongs in F-28 if change 1 is applied.
7. Change `e2e/app.spec.ts:519`'s expected href to the `trade_key` form in the existing-tests AC (destination changed by decision); `e2e/app.spec.ts:413-418` stay as they are.

### F-27
8. Replace "A render test asserts that every element styled with `--warn` is a `.warn-notice`…" with "an e2e computed-style scan of a failed record's card, pane, profile and trade page in light and dark finds every element whose computed border or stroke colour equals `--warn` inside a `.warn-notice` that holds `[data-warn-icon]` and visible words". A node render test can't compute styles.

### F-26
None.

## Advisory, not required
- F-26: "No count shown to viewers includes held notes" is already true on main: Theses counts published rows. The AC
  is a regression guard, which is fine.
- F-25: keep the `[sellId]` folder name in this feature to avoid churning six test files that F-11's branch also
  edits. A rename can follow on its own.

## Round 3 (2026-11-01)

I re-read the revised F-25 and F-27 and the "Round 3" section of round2-changes.md. No draft or repo file was edited.

| File | Verdict |
|---|---|
| F-25 | SIGN |
| F-27 | SIGN |

**F-25.** Items 1-7 are applied as I asked. Specifically:
- one PR, about 315 product lines against the 800 cap;
- "This trade →" and "Record, wins and losses →" at 0.875rem, about 286 of 320 px, with stacking below 360 px;
- the 308 checked with `maxRedirects: 0`, the legacy lookup kept out of `proxy.ts` and `generateMetadata`, and an
  unknown segment answering 404 without a redirect;
- `/me/record` posting `tradeKey`;
- one footer constant shared by `app/ui.tsx` and `PUBLIC.cardFooter`, with the full list of tests to update and the
  `:168` count-zero regex, which now matches both the old and the new text;
- the dismissed first-card budget case, and `e2e/app.spec.ts:519`.

The `Blocked:` line is a single line and parses with `scripts/features.ts#blockedOn`. I have no remaining required
changes.

**F-27.** Item 8 is applied (e2e computed-style scan, light and dark). No remaining required changes. One optional
wording fix: "No element with the held-note class uses `--warn` or `--down` (render test)" could say "carries neither
the `down` class nor `.warn-notice`", since a node render test checks classes, not computed colours. This is not
blocking.
