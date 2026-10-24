# F-4 · Plan round 1 · Engineer

Date: 2026-10-24. Base: `7992bd6` (F-2 PR-3b merged; BL and UX round 1 committed).
Replies to `plan-round1-business-lead.md` and `plan-round1-ux-lead.md`.
Read: CLAUDE.md, AGENTS.md, POLICY, COMPLIANCE §1, IMPLEMENTATION (hard stops, conflicts 8 and 9), DESIGN Stage 5
(CH-1, TR-7, TR-9 as the owner edited it: "K < 5, or the interval's half-width exceeds 10 points per trade"),
the F-4 file and the F-2 plan (format).
Code read: `app/u/[handle]/{opengraph-image,story/route,page,share-card,share-prompt,chart}.tsx`, `app/share-button.tsx`,
`lib/{trades,chart-series,downsample,story-image,copy,share,connections,demo,feed}.ts`, `lib/discovery/section.ts`,
and the tests that touch any of them. Also read: `node_modules/next/dist/docs/…/image-response.md`, `opengraph-image.md`
and the `@vercel/og` / satori source at `node_modules/next/dist/compiled/@vercel/og/index.node.js`.

This file decides how, never what. Nothing here is legal advice.

**Method.** Each claim below was checked by running something, not by reading alone:
- **Renders:** throwaway scripts under the session scratchpad (outside the repo) rendered through the repo's own
  `next/og` (Next 16.4.0) with a stubbed `fetch`. Both layouts at the UX lead's sizes, with the longest content.
- **Floor change:** a copy of HEAD (`git archive`) with the 5-bet floor and the width rule applied ran the whole
  unit and DB suite (623 tests) against a scratch database.
- No repo file outside this folder was touched.

## 0. Position

**I sign the shape both leads agree on: one card model, one renderer, two layouts, no new dependency. I split it into
three PRs, not two.** The extra split separates the three things that get reviewed differently:
- the app-wide TR-9 change (feed, profile and ticker pages);
- the card's trust copy (compliance-heavy, and the only part an owner question touches);
- the visual rendering (taste rounds).

Each PR is well under 800 changed product lines (§6). Two engineering findings change the plan:
1. **D1 is real, and worse than stated.** The renderer cannot be told not to fetch, so the only no-dependency fix is
   to never hand it a glyph the bundled font lacks (§1).
2. **The renderer belongs in a `.ts` module built with `React.createElement`, not in `.tsx`.** Node's type
   stripping can't import JSX. A `.ts` renderer lets D1 (zero network), D2 (margin band), D3 (type scale), D5 (no
   `fontWeight`) and U9 run as fast unit tests on every state × both layouts, instead of only through e2e (§4).

## 1. D1: does `next/og` fetch fonts? Yes. How to make a render make zero requests

**Finding (source plus a run).** In `@vercel/og`'s `render()`, satori always gets
`loadAdditionalAsset: loadDynamicAsset({ emoji })`. `ImageResponse`'s options (`width`, `height`, `emoji`, `fonts`,
`debug`, `headers`) do not forward a `loadAdditionalAsset`, so it **cannot be switched off from the public API**.
satori calls it for every grapheme the loaded fonts lack (`getEngine(...).has`, i.e. `charToGlyphIndex`):
- **A missing glyph** (✓, CJK, Arabic, U+2009, U+202F, …): `loadGoogleFont` fetches
  `https://fonts.googleapis.com/css2?family=Noto+Sans…`. When the detector call succeeds, a second request carries the
  text itself in `&text=`. Measured: a "✓" fetched once, a Japanese name twice. Failures are caught and logged
  ("Failed to load dynamic font"), and the glyph renders as a box.
- **An emoji:** `loadEmoji` fetches `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/<code>.svg`.
  **This path has no try/catch: when the CDN is unreachable the render throws and the image fails.** Measured: "Maya 😀"
  threw.
- **Display names are unrestricted.** `createUserForAttempt` trims and cuts at 40 characters, nothing else. So today
  any trader can make the record card, the trade card and the month card send their name to a third party, or break
  the card.
- **Bold:** `fontWeight: 800` makes no request and renders the Regular face. The UX lead's D5 holds.
- **Not a network request:** satori loads its layout wasm through `fetch('data:application/octet-stream;base64,…')`.
  The D1 test must pass `data:` URLs through and count only `http(s)`.

**Options for zero requests, no new dependency:**

| Option | Verdict |
|---|---|
| Pass a `loadAdditionalAsset` that returns nothing | Not reachable through `ImageResponse`. Calling the bundled satori and resvg directly means importing `next/dist/compiled/@vercel/og/*` internals: unsupported, breaks on any Next upgrade. **No** |
| Bundle a wider font (the font file in node_modules is the same Geist; nothing wider ships there) | A new font asset is the owner's call (COMPLIANCE §8, C3), and a CJK-capable face exceeds `ImageResponse`'s 500 KB bundle note. **Optional pre-authorization only** (plan P1) |
| **Never give the renderer an uncovered glyph** | **Yes.** satori only calls the loader for missing graphemes. If every string is inside Geist's coverage, the loader is never called |

**How (PR 2):**
- `lib/card-glyphs.ts` holds Geist Regular's coverage as a ranges constant: 726 code points in 112 ranges, about 20
  lines. Covered: U+0020–007E, Latin-1, Latin Extended A/B (most), basic Cyrillic, `·` `…` `−` (U+2212) `≈` `‹` `›`
  `→`. Not covered: `✓`, U+2009, U+202F, CJK, Arabic, Hebrew, emoji.
- The constant is checked against the font: a unit test parses the cmap (formats 4 and 12, about 40 lines of test
  code) of `node_modules/next/dist/compiled/@vercel/og/Geist-Regular.ttf` and asserts the constant equals the font's
  coverage. A Next upgrade that changes the font then fails a test instead of silently fetching. I wrote the parser
  in the scratchpad, and its output is the coverage listed above.
- **Display name rule (U15, D1):** the name is drawn only when every code point is covered. Otherwise the name slot
  shows `@handle` alone, and the handle row is not repeated. Handles are `[a-z0-9_]`, so they are always covered.
  This is the UX lead's proposal, it is predictable, and it never alters what a person wrote. Showing non-Latin names
  needs P1.
- **Every string the model can produce** (copy, numbers, dates, host) is scanned against the constant (D4).
  `toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })` gives "Mar 2025" with a plain
  space. Other options can emit U+202F, so the test pins the format.
- **The render test (U13):** stubs `globalThis.fetch` and records non-`data:` URLs. It renders every state × both
  layouts plus names in CJK, Arabic, emoji, "✓ Maya" and a zero-width joiner sequence. It asserts zero calls and a
  valid PNG.

**Outside F-4, same defect:** `app/u/[handle]/trade/[sellId]/opengraph-image.tsx` draws the display name **and the
thesis text**, and the month image draws the name. Thesis text sent to a font service conflicts with POLICY P6.
That is a follow-up using PR 2's `lib/card-glyphs.ts`. I tried to queue it as a suggested task, but the tool timed
out, so it is listed here and in the plan's §9.

## 2. Glyph and SVG check (the business lead's demand 1)

Rendered through the repo's `next/og`, read back with a 35-line PNG decoder on `node:zlib` (test-only code, no
dependency). Pixel values below.

| Feature | Works | Evidence |
|---|---|---|
| `·` U+00B7, `…` U+2026, `−` U+2212, `≈` U+2248, `‹ ›`, `%` | yes | in Geist's cmap; rendered with 0 requests |
| `✓` U+2713 | **no** | not in Geist; triggers a font fetch (the check mark is rightly gone today) |
| Inline `<svg>` with `<path>`, `stroke-linejoin`, `stroke-linecap` | yes | line pixel (34,197,94) at its coordinates |
| `stroke-dasharray` | yes | baseline alternates 161/49 along x |
| `<defs><linearGradient gradientUnits="userSpaceOnUse">` with a hard stop at the 0% line | yes | above 0: (14,41,28); below 0: (49,27,34). One path tints both sides, with no clip needed |
| `<clipPath>` | yes | clipped stroke absent where expected |
| `textOverflow: 'ellipsis'` on the name | yes | 40-character name cut to 13 (wide) and 8 (tall) characters plus "…" |
| `position: absolute` for the "0%" label | yes | |
| PNG encoder | `sharp` is present as Next's optional dependency, so it is used; otherwise resvg wasm. Both give 8-bit RGBA PNG; the D2 decoder handles both | |

## 3. Render time and PNG size (demand 4)

Prototype of both layouts at the UX lead's sizes, with:
- the longest content: a 40-character name, a 20-character handle, "12,345 trades", the thin-unclear trust line;
- the chart downsampled from 10,000 closes to 400 points, with area tint.

| Measure | Value | Budget |
|---|---|---|
| Wide 1200 × 630, 10,000 closes | 100–126 ms render (warm), **119 KB** | ≤ 1 s, ≤ 300 KB |
| Tall 1080 × 1080, 10,000 closes | 126 ms, **142 KB** | ≤ 1 s, ≤ 300 KB |
| Wide, 30 closes | 99 ms, 115 KB | |
| First render in a process (wasm init) | 282 ms | ≤ 1 s |
| Model inputs at 10,000 closes: `chartSeries(…, 'ALL', now, 400)` + `confidence()` + `stats()` | 11.7 + 9.7 + 5.5 ms | model ≤ 200 ms |

The 10,000-row SQL read is the existing one. The story route keeps `Cache-Control: public, max-age=300`.

## 4. Positions on the disputed points

**Trade count on the wide card: 52 px (the business lead), not 44.** I built the UX lead's own wide layout:
- padding 30/40, name row 64, a 480 + 620 column split;
- headline 108; range 36 on two lines; labels 32; trust line 34 on two lines; disclaimer 32 on one line;
- the count at 52.

With the longest content it fits with about 40 px to spare above the disclaimer, and the margin-band check (D2) is
clean. The UX lead's overflow was probably spacing, not the count. It also fits with the count moved under the chart
(also measured clean), so the fallback is moving it, never shrinking it. 52 keeps the business lead's "primary text
≥ 16 CSS px at 375" without an exception, and the count stays the second-largest text.

**Area tint: keep it (the UX lead).**
- DESIGN CH-1 "Look" specifies it ("area above 0% tinted with the up color, below 0% with the down color"), and the
  owner asked for CH-1's small version on the card.
- It is symmetric by construction: one gradient, one stop at 0. So it helps losing-record parity (U6) and adds no
  number, which answers the business lead's "second headline" objection.
- Cost: about 6 lines, PNG still ≤ 142 KB.
- Correction to the UX argument (b): the profile chart as built (`app/u/[handle]/chart.tsx`) draws **no** tint, only
  the 0% line and the curve. So the card will be ahead of the profile, not matching it. Logged as a later profile
  change, not part of F-4.
- The business lead's "noise at thumbnail" concern is judged on the 375 px screenshots (D6). At 16% opacity it reads
  as a wash, not a mark.

**Period placement: under the chart on the wide card (the UX lead); under the count on the tall card.** It labels the
x-axis span, and it frees the full-width row that pays for the 52 px count.

**Others where they differ:**
- **Headline label:** "average return per trade" (the UX lead). It is the criterion's own wording, and at 32 px it
  fits the 480 px column.
- **Muted color:** one muted #a1a1ad (the UX lead). The business lead's 5.8:1 figure was #8b8b98. #a1a1ad gives
  headroom for downscaling.
- **Down #fb7185 on images only:** agreed. Up 8.62, down 7.30, gap 1.32 ≤ 1.5 (U6).

## 5. Demands addressed to me

**BL 3a: is the "no label" state reachable after F-1? Yes, for an empty record.**
- How it arises: a user who signs in through email or an identity provider (`signInWithIdentity` →
  `createUserForAttempt`) and never connects, or whose link was declined or expired, has no consented connection.
  `aggregateRecord` returns `'none'` and `shareCardText` returns `label: null` (`lib/copy.ts:143`). Their public
  profile and its `opengraph-image` exist.
- The reverse case, `'none'` with closed trades, is not reachable:
  - closes need a consented connection;
  - a pre-F-1 claim reads `'connected'`;
  - demo is `isDemoUser`.
- `'connected'` with an unverified close and no demo is not reachable either: `verified = source === 'snaptrade'`,
  and any demo activity makes the profile demo.
- Default for the card model:
  - `label ?? (state === 'none' ? "No broker connected" : "Broker connected")`;
  - `shareCardText` stays as is, so `lib/copy.test.ts:66` keeps passing;
  - never "Verified".

**BL 3b: period end for a frozen record.**
- TR-5 freezes a record by setting `connections.disconnected_at` on a `connected` connection
  (`lib/sync.ts:317`); the state stays `connected`.
- Default: the period ends at the **latest `disconnected_at` when every consented connection is disconnected**
  (frozen), otherwise at now. Demo and pre-F-1 claims end at now. A failed import ends at now, and the incomplete
  line says the rest.
- Reason: after a disconnect the broker reports nothing, so "covers 26 months" would overstate. One query in the
  loader, tested.
- This does not change an owner decision, so it is an engineering default. The UX lead may add a "frozen" word later.

**BL 2: line estimates and the tests that change with 10 → 5.** §6 and §7.

**BL 1 and BL 4:** §2 and §3.

**UX D1 to D6:** accepted, with the mechanism in §1 and §8. One addition to D2: every row in the renderer has
`flexShrink: 0`, so an overflow pushes the last row into the band, where the test sees it, instead of squeezing rows
on top of each other, where it doesn't.

## 6. PR split and size (changed product lines = additions + deletions, as the Gate counts)

| PR | Content | Product lines | Tests (not counted) |
|---|---|---|---|
| **1. TR-9 floor and width** | `MIN_BETS = 5`, `TOO_WIDE = 0.10` and `tooWide()` in `lib/trades.ts`. Too early by width keeps both intervals. `evidenceWeight` is 0 for any too-early tier. The `Edge` → `Direction` rename. `tooEarlyText(c)` used by `evidenceLine`, `app/t/[symbol]/page.tsx` (2 sites), `HoldTime.tsx`, `Concentration.tsx`, `app/t/compare/page.tsx`, so no page says "of 10 bets". `isNewRecord`'s 10 closes is TR-7 and stays 10 | **70–110** | ~150 |
| **2. Card model and trust copy** | `lib/record-card.ts`: model, trust-line table, evidence label, period, `cardPct` (U+2212, U7), direction from the per-trade interval, palette, type scale, chart geometry, alt text. `lib/card-glyphs.ts`. `SHARE_CARD` additions | **280–330** | ~400 |
| **3. Render both images** | `lib/record-card-view.ts` (element tree, both layouts, every state). `lib/record-card-load.ts`. Both routes reduced to load → model → render. `lib/story-image.ts` folded in. `page.tsx` alt. `share-prompt.tsx` copy | **430–520** (about 190 of it deletions) | ~300 |

Why three:
- The business lead's PR 1 put the trust-line table, the only thing O1 touches, in the PR that changes the feed,
  profile and tickers, so O1 would have held up an app-wide change.
- In my split, PR 1 waits on nothing. PR 2 holds all the card copy, with O1 gating its merge only. PR 3 is the taste
  rounds.
- The business lead's PR 2 at 350–500 left out the deletions the Gate counts. With them, the card in one PR is
  about 700–850: too close to the cap.

Found while sizing (in PR 3): `share-prompt.tsx:43` tells the owner "the card is labelled New record", and its
alt text says "verified trade". Once the pill is cut, that sentence is false (COMPLIANCE §11). PR 3 replaces it with
the model's trust line and the model's alt.

## 7. Existing tests that change with the 10 → 5 floor

Measured, not guessed. I applied the floor, the width rule and the `evidenceWeight` tier guard to a copy of HEAD and
ran the full unit and DB suite against a scratch database: 623 tests, 611 pass at HEAD. **7 fail with the change.**
Each one is an expectation the owner's 2026-10-22 floor decision changes. None is deleted or loosened:

| # | Test | Why it changes | Change (coverage kept) |
|---|---|---|---|
| 1 | `lib/confidence.test.ts:23` "K<10 is too early with no interval or edge; K=0/1 are safe" | n = 9 is now thin | Loop over `[0, 1, MIN_BETS − 1]`; title "K<5"; same five assertions |
| 2 | `lib/confidence.test.ts:60` "tier boundaries" | `tier(9, 400)` is now thin | `tier(4, 400)` too-early **plus** a new `tier(5, 400)` thin (a boundary gained); other 7 lines unchanged |
| 3 | `lib/confidence.test.ts:81` "copy: too early, range, banned words" | line 83 "(4 of 10 bets)" | "(4 of 5 bets)" |
| 4 | `lib/confidence.test.ts:117` "evidence line explains overlapping positions…" | lines 127–129 "10 independent bets needed", `clusters(9, 50)` | "5 independent bets needed"; `clusters(4, 50)` → "(4 of 5 bets)" |
| 5 | `lib/discovery/section.test.ts:32` "the pool is ordered by the TR-9 lower-bound weight alone…" | trader 3, `record(6, 0.3)`, meant "too few bets", now has weight 2.885 | `record(4, 0.3)`; every assertion unchanged (passes, verified) |
| 6 | `lib/discovery/section.test.ts:106` "TR-9 order: a lower raw average with a higher lower bound…" | the equal-weight fixtures `record(6/9/9)` meant weight 0 | `record(2/4/4)`; the expected order [4, 5, 3] unchanged (passes, verified) |
| 7 | `lib/feed.reach.test.ts:41` "PR-1b acceptance…" (DB) | Its "newcomers with 5 or 6 closes" were records with no evidence weight; at 5 bets one gets weight 0.028 ("seed 3 page 4: no newcomer row") | **Not a one-line fix, flagged.** Feed eligibility needs ≥ 5 closes (`lib/feed.ts:126`), so newcomers can't drop below 5. Restoring the premise with too-early-by-width newcomers (returns ±40%) moved the failure to "seed 0 page 3": the new-record slot's documented order (not yet in an earlier section, then fewest closes) picked an ordinary weight-0 trader. PR 1 restores the premise from `MIN_BETS`/`TOO_WIDE`. If the slot assertion still fails, the business lead decides in PR 1's committee whether the slot reads "tier too early" instead of "weight 0". The assertion is never loosened |

Identifier-only edits from the rename (business lead item 9), listed so a reviewer doesn't read them as weakening:
- `lib/confidence.test.ts`: six `.edge` → `.direction`;
- `lib/ticker-baseline.test.ts:17`: fixture `edge: null` → `direction: null`.

Comments only:
- `lib/feed.test.ts:192` "Records under 10 bets": the test passes; the comment is updated.

Passed unchanged, but worth watching:
- **e2e (not run here, port 3000 is in use):** `e2e/connect.spec.ts:1140` ("Too early to tell" once) and
  `e2e/app.spec.ts:150` use count-tolerant regexes. The tester runs them in PR 1.

Tests PR 3 migrates, because `lib/story-image.ts` folds into `lib/record-card.ts`:
- `lib/story-image.test.ts` keeps all 7 tests; its imports change.
- 4 expectations follow owner decisions: no win rate and no worst trade (2026-10-22 contents decision), no "New
  record, wide uncertainty" pill (the too-early trust line replaces it), and the badge reads "Verified from broker" /
  "Demo data". Criterion 8 names "Verified"; the old "Imported read-only from the broker" and "Demo data, not a real
  broker record" don't fit the badge slot.
- The properties stay: demo never Verified, failed is warn plus the incomplete line, importing has no stats, empty
  doesn't throw, no price/quantity/$ fields, `parseFormat`.

Kept unchanged:
- `lib/share.test.ts:26`: the routes keep `{DISCLAIMER}` in their source, because the disclaimer is a required JSX
  prop typed as the literal `typeof DISCLAIMER`.
- `lib/copy.test.ts`: `shareCardText`, `imageTrust` and `profileCardAlt` are unchanged; the new alt text starts with
  `profileCardAlt`.

## 8. The UX checks U1–U15

Accepted, all of them:
- U1–U8, U10–U14 as written.
- U9 as an element-tree test: the range slot has a fixed `height` at K = 4 and at K = 5, so the chart's top offset is
  equal.
- U15 via `textOverflow: 'ellipsis'` (verified working) plus the glyph rule.
- U7 rule, precisely: a nonzero bound that prints "0.0%" gets 2, then 3, then 4 decimals until nonzero, keeping its
  sign ("−0.04%"); after 4 decimals it prints its sign with 4 zeros.

## 9. Owner questions (only where an answer would change a decision)

| # | Question | Blocks | Default the build uses | My view |
|---|---|---|---|---|
| O1 (BL Q1) | Thin and moderate rows give a fully negative range the "either way" / "no clear pattern" line | **PR 2 merge** (hard stop 5, the business lead's position, scoped to the PR holding the copy) | the owner's table, as written | Support the business lead's recommendation: it removes a sign asymmetry. One table constant, so either answer is a one-line change |
| O2 (BL Q5) | Headline is the arithmetic mean; the range is around the geometric center | nothing | arithmetic (matches the profile) | **Not rare for heavy traders.** The mean leaves its range when per-trade SD ≳ 2t/√K: about 75% at 30 bets, 40% at 100, **12% at 1,000**. A swing trader with 1,000 closes can show "+1.3% … likely between −0.3% and +1.3%". The profile has the same issue today. Ask before real users |
| O3 (BL Q6) | Too-early line counts trades when trades outnumber bets | nothing | as written | Support "N trades in K separate bets" |

Engineering defaults, not owner questions (no decision changes):
- Q2: direction is read from the per-trade interval shown on the card.
- Q3: "never by a count alone" means never by the trade count; K < 5 is the only count rule.
- The frozen-record period (§5).
- D = max(1, floor(days)), so 5 bets inside one day read "over 1 day", never "over 0 days".
- The non-Latin name fallback (§1).
- `confidence()` stays in `lib/trades.ts` (DESIGN names it there). The owner fixes IMPLEMENTATION conflict 8's
  `lib/confidence.ts` and TR-9's "Edge:" display line (the business lead's Q4).

## 10. Pre-authorization

None is needed to build. Optional:
- **P1:** a self-hosted OFL font with wider script coverage, if the owner wants non-Latin display names on cards.
  It is a font asset under COMPLIANCE §8/C3, and it costs bundle size.
- Running preview: still item #9.

## Sign-off

Engineer: I would build every PR in `plan.md` as written. Signed there.
