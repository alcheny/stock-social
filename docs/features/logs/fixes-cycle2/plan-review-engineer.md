# Fixes cycle 2 (trust rows): engineer review of plan-ux-lead.md

2026-11-01 · against the working tree (diff + the four untracked files) and pr53 rows 1-30. Next 16.4.3, postgres 3.4.9.

## Feasibility
- Every row fits one PR; #1/#4/#11/#19/#20/#22/#24/#27/#28 are mostly built. Where tree and plan differ, the plan is right and the tree
  must change: `Disclaimer` is still `muted small`; `/me/likes` renders it *after* the list, only when `rows.length > 0`; compare renders
  it once *above* the grid, not per column.
- `PUBLIC_SHORT` is already `{ join, sharePrompt }` in `lib/copy.ts`; the #5 test checks both. `tools/parts.tsx` already has `data-disclaimer`.
- #20: no `loading.tsx` or `template.tsx` anywhere under `app/`, and the page calls `notFound()` before any output, so the status is a
  real 404. The page's call is what sets the status; the call in `generateMetadata` (streamed for non-bot user agents in Next 16) only
  keeps the title in step. The edited app.spec.ts case covers both.

## postgres.js helper (lib/visible-users.ts): sound
- `sql(alias)` is the documented identifier helper: it renders a quoted `"u"`, so it is case-sensitive and safe from injection. Nested
  `sql\`\`` fragments are the documented builder pattern: lazy promises that never run on their own, with their parameters renumbered into
  the outer query. A fresh fragment per call, nothing shared between requests.
- `user_id in (select v.id from users v where …)` plans as a semi-join, `users.id` is not null, and the inner `v` shadows any outer `v`
  safely. The overlap query in `[symbol]/page.tsx` filters only its inner subquery, which is correct: the outer ids come from it.
- The #4 source scan needs a precise rule: count helper uses per `sql\`` template, at least one per `from closed_trades|open_positions`
  in it. "Followed in the same statement" lets one helper cover two scans.

## Testability of each AC
- #1, #8, #11: string tests, fine. Also scan JSX text on `/t` and `/t/compare` for `/\bverified\b/` so the word can't come back.
- #5, #22, #24, #28: testable as written (#22's e2e clicks through). #19: unit-test that `toneClass(0)` and `toneClass(-0.00004)` both give `''` (both print 0.0%).
- #21: "every page.tsx or an ancestor layout exports metadata" always passes, because the root layout exports `metadata`. Exclude the
  root layout; the pairwise-distinct e2e is the real test.
- #2 node:test (table complete both ways, images import `DISCLAIMER`, page import tree reaches `Disclaimer`): deterministic.

## The e2e guard: flakiness and correctness
- **Contradiction:** "exactly one `[data-disclaimer]`" fails on compare (one per column) and on `/tools` views that render `Disclaimer`
  twice. Instead: every `[data-disclaimer]` has exactly the text `DISCLAIMER`, and for each anchor match the nearest one after it passes beside.
- **The beside formula is wrong** when the disclaimer comes before the anchor (`/me/record`: under the h1, above `.rec-dl`). Use
  `max(bottoms) - min(tops) <= innerHeight - fixedTop - fixedBottom`, with fixed-bar heights read in the page.
- **Overlap:** the fixed/sticky scan must skip hidden elements (`display:none`, `visibility:hidden`, zero size, opacity 0) and the
  disclaimer's ancestors. Add `elementFromPoint` at 5 points of its box, each landing inside it; that catches non-fixed covers too.
- **Flake sources:** use `scrollIntoView({ block: 'center', behavior: 'instant' })`; await `document.fonts.ready` and `load` before
  measuring (`e2e/fonts.conf` pins the fonts); `.signin-line`, `.hide-bar` and F-13's first-visit bar render on the client, so wait for
  each bar's final state. Measured that way, the geometry doesn't depend on timing.
- **Fixtures:** `/me/likes` needs one like, made in the spec with the like button; with "always" the guard passes without one but never
  tests the placement. The seed has no open positions, so the profile sample never shows the TR-4 layout (stats, OpenGrid, CombinedLine,
  evidence, disclaimer), the layout most likely to miss the one-screen bound at 360 px. Add a sample using `e2e/f6-open-positions.spec.ts`'s fixture.
- **Pending entries** must not quietly exempt the feed: run `pendingF10F12` under `test.fail()`. When F-10/F-12 add the disclaimer, the
  test passes unexpectedly and CI forces the entry into `performance`.
- **Walker:** skip `(group)`, `_private`, `@slot` and intercepted (`(.)`, `(..)`) segments, plus `default`, `not-found` and `layout`
  files. Map `[...x]` and `[[...x]]`. Add `icon`, `apple-icon` and `manifest`, so that a new image route has to be classified.

## Open questions, decided (the recommended option)
1. Disclaimer: body size, not `small` (plain view is the legal bar). 2. Compare: one per non-empty column (B's figures are a screen
down at 360 px). 3. Likes: before the list, always (one path, beside the first figures). 4. Stock-image query (#4): stays here (row 4
names it; F-12 owns strip and size). 5. Title "NVDA demo trades" (shorter, already tested). 6. `CONSENT_SCOPE_LINE`: owner's call
(owner copy, P6). 7. #28 label "the sign-in link on your pages" (the nav sends `via=nav` from trade and month pages too).

## SIGN, with these demands built into the PR
1. Bring the tree in line with the plan: drop `small` from `Disclaimer`; likes disclaimer before the list, always; one per compare column.
2. Replace "exactly one `[data-disclaimer]`": every match has the exact text, and the nearest one to each anchor passes beside.
3. Beside uses `max(bottoms) - min(tops)`; overlap skips hidden/ancestors, adds `elementFromPoint`; instant scroll, fonts and bars settled.
4. `pendingF10F12` entries run under `test.fail()`, not a skip. 5. Fixtures: a like made in the spec; a profile sample with an open position.
6. #21's static check ignores the root layout; #4's source scan counts helper uses per template. 7. Plan's #5 text matches `PUBLIC_SHORT`.
