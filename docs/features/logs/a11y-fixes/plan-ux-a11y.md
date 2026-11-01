# A11y and copy fixes plan: UX lead and accessibility specialist (WCAG 2.2 AA)

Date: 2026-11-01. Branch `claude/f13-a11y-fixes`. Source: approval council record, "Fixes to build now" (fixes #5,
#8–#11, #13–#23, #25). Line numbers re-checked on this branch. Ownership: `app/t/**` belongs to another session
(ticker-page parts are **notes** below); feed files (`app/page.tsx`, `app/pane.tsx`, `app/feed-*.tsx`,
`app/card-menu.tsx`) get minimal additive edits only (PR #30); token changes go in one block at the end of
`app/globals.css` commented `/* A11Y-FIXES */` (the design-token council owns the tokens). New copy avoids every
banned word listed in POLICY F1a/F3a; it lives in `lib/copy.ts` in a new block placed after `FOOTER`.
Other overlaps: PR #35 (F-4) touches `app/u/[handle]/page.tsx` and `share-prompt.tsx`; PR #40 touches
`app/u/[handle]/page.tsx` and `lib/trades.ts`; PR #36 touches `app/globals.css`, `lib/copy.ts`.

Contrast values below are computed with the WCAG 2.x relative-luminance formula from the tokens in
`app/globals.css` (dark = `:root`, light = the `prefers-color-scheme: light` block; there is no `data-theme`
switch in this app). Tints are composited over the stated background.

## Copy fixes

| # | File / element | Change (new text) | Rule | Check |
|---|---|---|---|---|
| 5a | `app/u/[handle]/join-cta.tsx:9` | "**Verify your own record.** Read-only broker connection. Public: your handle, symbols, dates and percent returns, open positions included. Never quantities, prices or balances. 18+." | P6, P3 | unit: render string has no "only percentages"; e2e signed-out profile shows it |
| 5b | `app/u/[handle]/share-prompt.tsx:39` | "Public: your handle and name, each closed trade (symbol, dates, percent return, losses included), your open positions with unrealized percent, your win rate and average return, and any thesis you post. Never quantities, prices, fees or balances. Your broker login stays private." Constant `PUBLIC_SCOPE.share` in `lib/copy.ts`. | P6, P3 | `lib/share-prompt.test.ts`-style unit: string names handle, open positions, thesis, symbol |
| 8a | `trade/[sellId]/opengraph-image.tsx:11` alt | "One closed trade on Stock Social, with the trader's record" | F3a | unit: no `/full record|whole record/` in the alt exports |
| 8b | `month/[ym]/opengraph-image.tsx:12` alt | "A month of trades on Stock Social, with the trader's record" | F3a | same |
| 8c | `month/[ym]/page.tsx:29` description | "… this month · record to date: …" (was "whole record:"). Update `e2e/connect.spec.ts:558` regex to the new label so it still bites. | F3a | e2e description match |
| 8d | back links `trade/[sellId]/page.tsx:44`, `month/[ym]/page.tsx:53` | "← @h's profile" | F3a | e2e link name `/@\w+'s profile/` |
| 8e | `lib/claims.ts:7` | "…can only ever belong to one profile. This keeps a record from being restarted on a new profile. If you think…" | F3a | `lib/claims.test.ts` still passes; new assert: no "every" |
| 8f | `app/t/page.tsx:17` | **Note for the app/t session**: "Browse stocks with verified closed trades…" (drop "every"; fix #2 also reworks this file) | F3a | — |
| 9 | `app/ui.tsx:11` Verified badge `title` | "Imported read-only from the trader's broker. It doesn't verify identity or imply endorsement." (the footer's F3a definition) | F3a | unit/e2e: title equals the constant |
| 10 | `app/u/[handle]/page.tsx:186-188` | Demo profile: "Record since ‹date› · Demo data, not a real broker record." (the connected-accounts sentence only when `allVerified`) | P2, F3a | e2e app.spec:147 still finds "Demo data"; new assert: demo profile has no "connected accounts" |
| 11a | `app/me/record/page.tsx:198` | "Choose up to two rules for yourself. …" | F1a | grep test below |
| 11b | `lib/ticker.ts:318` `COMPARE_COPY.pick` / `:320` `same` | "Choose two stocks to compare." / "Choose two different stocks. You chose ‹A› twice." Update `e2e/app.spec.ts:758,760`. lib-only change, but the page is the app/t session's: **open question 4**. | F1a | e2e strings |
| 11c | `app/t/[symbol]/HoldTime.tsx:39` | **Note for app/t**: "Different traders, different sizes and timing. How long a trade stayed open doesn't explain its result on its own." | F1a, F3b | — |
| 25 | `app/t/compare/page.tsx:84` | **Note for app/t**: drop `<b>{COMPARE_COPY.tooEarly}. </b>`; `evidenceLine(c)` already starts "Too early to tell". | TR-9 copy | — |

Guard test (new `lib/a11y-copy.test.ts`): scans `app/**/*.tsx` and `lib/**/*.ts` (non-test) string literals for
`/\bnot a signal\b|\bPick (two|up to)\b|only percentages are ever public|full record|every record verified/`, with an
allow-list for the `app/t/**` items until that session lands them (the allow-list entries fail once the strings are gone,
so the list cannot rot).

## #13 Text contrast (WCAG 1.4.3)

Measured now: light Verified badge `#15803d` on its 18 % tint = **3.77** over bg, **3.92** over surface (fail).
Dark: 6.59 / 5.77 (pass). `:target` row at 14 % accent: light muted 4.01, up 3.83 (fail); dark down 4.46 (fail),
dark on surface down 3.97, muted 4.33 (fail). A lower tint does not rescue light `--up` (6 % still 4.36).

```css
/* A11Y-FIXES (2026-11-01, approval council fixes #13-#15, #19): minimal contrast and focus fixes. */
:root { --up-text: #22c55e; --control-line: #6b6b78; }
@media (prefers-color-scheme: light) { :root { --up-text: #166534; --control-line: #858591; } }
.badge.verified { color: var(--up-text); }               /* tint still built from --up */
.rows li:target { background: none; box-shadow: inset 4px 0 0 var(--accent); margin-left: -12px; padding-left: 12px; }
```

| Pair | Dark | Light |
|---|---|---|
| Verified text on tint over bg / surface | 6.59 / 5.77 (unchanged) | **5.36 / 5.57** (`#166534`) |
| `:target` row text (no fill): muted, up, down on bg | 5.84, 8.62, 5.35 | 5.03, 4.81, 6.02 |
| same on surface | 5.35, 7.90, 4.90 | 5.25, 5.02, 6.29 |
| `:target` bar (accent) vs bg | 7.22 | 6.81 |

The bar plus the negative margin keeps the text where it was (`.page` has 16 px side padding).
Test: new `lib/a11y-contrast.test.ts` (same token parser as `lib/badge-contrast.test.ts`, extended to read the
A11Y-FIXES block): Verified text ≥ 4.5 on its tint over bg and surface, both schemes; the `:target` rule sets no
background; every text token ≥ 4.5 on bg and surface.

## #14 Control boundaries (WCAG 1.4.11)

`--line` is 1.31/1.20 (dark bg/surface), 1.20/1.26 (light); surface on bg 1.09 / 1.04. New `--control-line`:
**dark `#6b6b78` = 3.74 vs bg, 3.43 vs surface; light `#858591` = 3.49 vs bg, 3.65 vs surface.** In the block,
`border-color: var(--control-line)` on the exact selectors that draw a control border today (specificity matched by
repeating them): `input, textarea, select`; `.pane .back`; `.share-prompt .actions .secondary`;
`.trade-share .secondary`; `.badge-embed .secondary`; `.new-trades .secondary`; `.rec-chips button`;
`.auth .button.secondary, .auth button.secondary`; `.handle-edit summary.secondary`; `.follow.secondary,
.more-menu .secondary, .people .secondary, .pane-actions .button.secondary`; `.more-menu summary`. Separators,
cards and stat tiles keep `--line` (not controls). PR #30's `.switch-pair .switch` gets the same line once #30
lands (note in the PR). Test: the contrast test asserts `--control-line` ≥ 3:1 vs bg and surface in both schemes and
that each listed selector appears in the block with `var(--control-line)`.

## #15 Fixed nav never hides focus (WCAG 2.4.11)

`html { scroll-padding-top: 72px; scroll-padding-bottom: 16px; }` (nav ≤ 56 px at every width after the F-13 nav
rule). Not on `.feed` (it would move every snap point). The pane scrolls inside itself under the fixed nav, so also
`.feed .pane { scroll-padding-top: 72px; }` (no snap inside the pane, safe). Check (e2e, 360×640, keyboard): on a
profile with 50+ closes, Tab through the closed-trades list; for each focused element `rect.top >= nav.bottom`.
In the feed, open a pane with → and Tab to its last link: the same assertion.

## #16 Signed-out "Sign in to like trades." bar: Esc-dismiss (chosen)

Chosen over inline: inline would move the line into the tapped card (feed markup, adds height to a card that already
clips, #19) and is a bigger diff in a #30-adjacent file. In `app/feed-gestures.tsx` (additive, inside the existing
effect, only while `askSignIn`): close on `keydown` Escape, on any `focusin` outside the line, and on a `.feed`
vertical scroll that changes the row in view. The line keeps `role="status"`, never takes focus. Result: it can
never be over a focused element. Check (e2e, touch context, 360): double tap → line shown; Esc → empty; double tap
→ Tab → empty; double tap → scroll to next row → empty. Existing likes.spec tests stay green.

## #17 Inert off-screen halves of a feed row (WCAG 2.4.3, 2.4.7, 2.4.11)

Strategy (JS-only progressive enhancement, in `app/feed-keys.tsx`, additive; no change to the scroll-snap CSS):
- A row "rests on the card" while `row.scrollLeft <= row.clientWidth / 2`, else "on the pane".
- On the card: `pane.inert = true`, `card.inert = false`. On the pane: `card.inert = true`, `pane.inert = false`.
  Applied on mount to each `.feed > .row`, to rows appended later (a `MutationObserver` on `.feed` childList), and on a
  rAF-throttled capture `scroll` listener when a row crosses the halfway point (touch swipes).
- Never server-rendered: without JavaScript nothing is inert (touch users can still swipe and tap the pane).
- **→ key:** `pane.inert = false; card.inert = true;` then focus the pane's Back button
  (`[data-back]`, `focus({ preventScroll: true })`), then the existing `row.scrollTo`. Screen readers announce the
  region "‹name›'s record" and "← Back, button"; the ring is already visible (`:focus-visible`).
- **Back button / ← key:** `card.inert = false; pane.inert = true;` focus returns to the element that had focus in the
  card before → (stored per row), else the card's `.who` link, with `preventScroll`, then `row.scrollTo({ left: 0 })`.
- **Touch swipe:** inert follows the scroll; focus moves only if `document.activeElement` is inside the half that just
  became inert (to that row's other half's first control), so focus is never dropped to `<body>`.
- Tab from a card at rest skips its pane and goes to the next row's card.
Checks (e2e, keyboard only, 360×640 and 320×568): from the first card's link press Tab 15 times; no
`activeElement` is inside a `.pane` whose row rests on the card. Press →: `activeElement` is the Back button and
its rect is within `0..innerWidth`. Enter on Back: focus inside the card, card rect within the viewport, pane
`inert`. Touch swipe to the pane, then Tab: focus lands in the pane, never at x < 0.

## #18 Like button name (WCAG 2.5.3, 4.1.2)

`app/card-menu.tsx:28`: remove `aria-label`; the name is the visible text ("Like" / "Liked"; the heart stays
`aria-hidden`), state via `aria-pressed`, the note via `aria-describedby="like-note-‹id›"` on a
`<span id hidden>` holding `LIKES.likeNote = 'Only you can see likes.'` (`likeLabel` removed). Check (e2e):
`getByRole('button', { name: 'Like', exact: true, pressed: false })`, after click
`{ name: 'Liked', pressed: true }`, and `toHaveAccessibleDescription('Only you can see likes.')`.

## #19 Reflow (WCAG 1.4.10, 1.4.4; POLICY P2)

In the block: `h1 { overflow-wrap: anywhere; }`; `.card header .who { flex: 1 1 auto; min-width: 0;
overflow-wrap: anywhere; } .card header .badge { flex: none; }`; short viewports:
`.ret { font-size: clamp(40px, min(22vw, 16dvh), 120px); }` (identical to today at 360×640 and 320×568, where 22vw is
the smaller term), `@media (max-height: 480px) { .feed .row > * { padding-top: 56px; padding-bottom: 8px; } .card
{ gap: 8px; } }`, and `.feed .row > .card { overflow-y: auto; scroll-padding-top: 56px; }` so nothing is cut off.
Checks (e2e): 320×568 with a 20-character handle and a long display name: document `scrollWidth <= 320` on the
profile and the feed; the Demo badge's rect is inside the viewport. 780×360 and 320×256: on the first card the
footer link is reachable (`scrollIntoViewIfNeeded` then `toBeInViewport`) and `.ret` bottom ≤ card bottom.

## #20 Distinct page titles (WCAG 2.4.2)

`export const metadata` with `TITLES` constants (pattern `"‹page› · Stock Social"`, as `/how` and `/settings` do):
`/login` "Sign in", `/login/sent` "Check your email", `/login/dev` "Dev sign-in", `/connect` "Before you connect",
`/connect/consent` "Confirm what gets imported", `/connect/continue` "Connecting your broker",
`/connect/result` "Connection result", `/terms` "Terms of Service", `/privacy` "Privacy Policy",
not-found "Page not found". No root `title.template` (it would double the existing explicit titles).
Checks: unit test reads each route file and asserts a `metadata`/`generateMetadata` export; e2e visits the
reachable routes and asserts the titles are pairwise distinct and none is exactly "Stock Social".

## #21 Real 404 (WCAG 2.4.2, 1.3.1)

New `app/not-found.tsx` (root, inside the layout so nav and footer stay): `<main className="page"><h1>Page not
found</h1><p>There's nothing at this address. The link may be mistyped, or the page has moved.</p>` and a list of
`.tap44` links: "Feed" `/`, "Trades by stock" `/t`, "How records are calculated" `/how`; `metadata.title`
"Page not found · Stock Social". Check: `request.get('/no-such-page')` status 404, heading level 1, three links.
**Note for app/t**: `app/t/[symbol]/page.tsx:68-74` should call `notFound()` for an invalid symbol (then this page
renders with 404).

## #22, #23: links and flat returns

- **#22 (note for app/t):** `Theses.tsx:24` link to `/u/${handle}/trade/${encodeURIComponent(sell_id)}`; the query in
  `lib/ticker.ts` (ThesisList) selects `sell_id`. `sell_id` is the key that survives `rebuildTrades`.
- **#23:** one helper next to the existing `tone()` in `lib/open-split.ts`: `signWord(x) = { up: 'Gain', down:
  'Loss', flat: 'No change' }[tone(x)]`; colour via the existing `toneClass` (`app/open-rows.tsx`; flat inherits
  `--text`). Replace `> 0 ? 'up' : 'down'` at `app/u/[handle]/page.tsx:232,276,293`, `chart.tsx:135 (>= 0), 194`,
  `similar-section.tsx:39`, `app/me/likes/page.tsx:31`, `app/pane.tsx:45,55,78` (three expression swaps, feed file,
  minimal); `< 0 ? 'Loss ' : 'Gain '` at `trade/[sellId]/page.tsx:51`, `month/[ym]/page.tsx:44,96`,
  `new-trades-prompt.tsx:33` → `` `${signWord(x)} ` ``. **Note for app/t**: `app/t/[symbol]/page.tsx:143,183`,
  `Theses.tsx:26`. Unit test: for a grid of x (incl. ±0.0004, ±0.0005, 0), `tone(x)==='flat'` iff `pct(x)==='0.0%'`,
  `'up'` iff `pct` starts with "+", else down; `signWord` matches. e2e: a seeded 0.0% trade (if a fixture exists)
  has no `.up`/`.down` class and reads "No change".

## Open questions (recommendation in bold)

1. **"Their whole record" headings** on trade and month pages (`WHOLE_RECORD`, e2e app.spec:400,454) are not in the
   fix list but read as completeness. (a) **Leave for F-4 #35, which owns those pages' record block; flag in the PR**;
   (b) rename now to "Their record so far" and update both e2e lines; (c) leave as is.
2. **#16 approach.** (a) **Esc + close on focus move or row change** (chosen); (b) inline in the card;
   (c) both.
3. **#17 focus target after →.** (a) **Back button** (a real control; region name announced on entry);
   (b) the pane `section` with `tabindex=-1` (announces the region, needs a focus style on a large box);
   (c) the pane's profile link.
4. **`lib/ticker.ts` copy (#11b).** (a) **Change the two strings here (lib, not app/t) and update the e2e; tell the
   app/t session**; (b) leave the whole item to the app/t session.
5. **Mixed demo and real records (#10).** A profile is demo-only by seed; (a) **treat `!allVerified` as demo (today's
   rule)**; (b) add a third "mixed" line now (no such profiles exist).
6. **`--control-line` naming/values.** The token council may prefer to retune `--line`. (a) **Add a new token only for
   controls (leaves separators alone)**; (b) darken `--line` globally (heavier look everywhere).
7. **Undo bar (`.hide-bar`, fixed bottom, signed in)** can also cover a focused card link; not in the list.
   (a) **Note it for F-2 (#30) with the same Esc/focus rule**; (b) fix here.
