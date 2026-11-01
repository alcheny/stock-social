# F-13 plan: UX lead and accessibility specialist (WCAG 2.2 AA)

Date: 2026-11-01. Branch `claude/f13-a11y-fixes` (from main). Inputs: `docs/features/F-13-first-visit-line.md`
(Status: ready), DESIGN Stage 5 SW-1, POLICY A1/F3/F3a/P2/P6, the approval council record (C6, D27). Copy in this
plan is verbatim where the decision is verbatim; new strings avoid the banned words (every, all, full/whole record,
signal, pick, buy/sell/hold, advice).

## 0. Constraints that shape the design

- Feed files are being rewritten by PR #30 (`app/page.tsx`, `app/feed-actions.tsx`, new `app/feed-notes.tsx`,
  `app/globals.css`, `lib/copy.ts`). #30 adds a signed-in "notes" paragraph above the first card as its own snap stop
  (`.feed .feed-notes { scroll-snap-align: start; padding: 64px … 12px }`). F-13's line is the signed-out twin of that
  slot: same position, same snap pattern, mutually exclusive with it (signed in vs signed out). One additive JSX line in
  `app/page.tsx`, placed next to where #30 puts `<FeedNotes>`; trivial merge either way.
- `feed-rows.tsx`, `feed-keys.tsx`, `ui.tsx` are not in #30's file list; changes there stay additive.
- PR #42 (security hardening) adds a nonce CSP (`script-src 'self' 'nonce-…' 'strict-dynamic'`). Any inline script
  must carry the request nonce (`headers().get('x-nonce')`), which is harmless before #42 merges.
- No new cookie (POLICY P6, `lib/privacy-cookies.test.ts`), no new dependency, no tracker.

## 1. The first-visit line (D27)

**Where:** in the feed flow, inside `<main className="feed">`, after the sr-only `<h1>` and before the first `.row`.
Not fixed, not absolute, not a dialog. Its own scroll-snap stop at the top (the #30 pattern), so the feed opens on
the line with the top of the first card in view below it, and one scroll lands on the first card.

**When it renders (server):** `!page.viewer && page.offset === 0 && page.cards.length > 0`. Never signed in, never
on `?after=` pages, never on the empty feed. The server always renders it for that case (first visitors get it with
no layout shift); dismissal is hidden client-side (section 3).

**Markup** (server component `FirstVisit` in new `app/first-visit.tsx`, with a small client child for the button):

```html
<div class="first-visit" data-first-visit>
  <p class="fv-line">Verified trades, straight from the broker. Losses included.
     <a href="/how">How records are calculated</a></p>
  <!-- only while the page shows any demo record: -->
  <p class="fv-demo"><span class="badge demo">Demo</span> Demo data, not a real broker record.</p>
  <button type="button" class="quiet-x fv-x" aria-label="Dismiss">×</button>
</div>
```

- The sentence is exactly the D27 text. The link is a separate link whose text is the destination page's title
  (WCAG 2.4.4, 2.5.3), so the acceptance test can match the sentence exactly and the link by role.
- Dismiss: a real `<button>`, 44×44 (`.signin-line .quiet-x` style reused: transparent, muted ×), accessible name
  "Dismiss" (WCAG 4.1.2). It comes after the link in DOM and Tab order.
- After dismiss: the line is removed from the layout (`display:none` via the html token, then React returns null)
  and focus moves to the first card's first link (`.feed > .row .card .who`), so focus is never lost to `<body>`
  (WCAG 2.4.3). The feed snaps to the first row.
- Copy constants in `lib/copy.ts` (new block placed after `FOOTER`, away from #30's appended blocks):
  `FIRST_VISIT = { line, how: FOOTER.how, dismiss: 'Dismiss', demo: 'Demo data, not a real broker record.', hint: 'Swipe ← for profile' }`.
  "Demo data, not a real broker record." already ships on the profile card alt; no new claim.

**Style:** `.feed .first-visit { scroll-snap-align: start; display: grid; grid-template-columns: 1fr auto; gap: 4px 8px;
padding: 64px max(20px, calc((100% - 560px) / 2)) 12px; }`. Line text `--text` at 0.9375rem, demo line `--muted`
0.875rem with the badge at its normal size. Contrast: text on bg 17.88 (dark) / 18.01 (light); muted on bg 5.84 /
5.03; Demo badge 5.3 / 5.3 (existing test). No transition or animation at all, so reduced motion needs no override.

## 2. Demo badge in the same 360 px viewport

The first card is not always a demo record in a mixed feed, so relying on the card's own badge is not enough. The
line carries its own Demo badge row whenever `page.cards.some((c) => cardTrust(c, page.records.get(c.user_id)?.state).badge === 'demo')`
(pure, no new query; `lib/feed.signed-out.test.ts` stays green). Same `.badge.demo` component as the cards, so equal
weight with the card badges; placed directly under the sentence. Measured layout at 360×640: nav ≤ 56 px, line
block ≈ 64 + 3 text lines + 12 ≈ 150 px, so the line, its Demo badge and the first card's header badge are all
above y ≈ 240. When the line is dismissed the cards' own badges remain (POLICY P2).

## 3. Storage, server render, blocked storage

- Keys (device flags, values are constant strings, no ids, no timestamps):
  `ss.firstVisitLine` = `"dismissed"`, `ss.swipeHint` = `"seen"`.
- `lib/device-flag.ts` (pure, testable): `getFlag(key)` and `setFlag(key, value)` try `localStorage`, then
  `sessionStorage`, then an in-memory `Map`. Each access, including reading `window.localStorage` itself, is in
  try/catch (it can throw `SecurityError`). Never throws.
- No-flash for returning visitors: a tiny inline script, exported as a constant from `lib/device-flag.ts`
  (`SEEN_SCRIPT`), rendered once in `app/layout.tsx` as the first child of `<body>` with `nonce` from
  `headers().get('x-nonce') ?? undefined`. It reads both keys (same try/catch chain) and sets
  `document.documentElement.dataset.ssSeen = "line hint"` (tokens present only when the flag is set). CSS:
  `html[data-ss-seen~="line"] .first-visit, html[data-ss-seen~="hint"] .swipe-hint { display: none }`.
  `<html suppressHydrationWarning>` because the attribute is set before hydration. The attribute also survives
  client-side navigations back to `/`, so the line does not reappear there.
- Client fallback: on mount each client part reads `getFlag` too (covers a blocked inline script) and on dismiss
  writes `setFlag` and adds the token to `data-ss-seen` at once.
- Storage blocked (both stores throw): the server render still shows the line and the hint; dismissing works for
  the page's lifetime (in-memory + html token); a reload shows them again. With only `localStorage` blocked, the
  dismissal lasts for the tab session (`sessionStorage`). Neither path sets a cookie or throws.

## 4. The SW-1 hint "Swipe ← for profile"

- **Where:** inside the first card only (page 1, row index 0), in the card footer, as a line above the existing
  "See their record, wins and losses →" link: `<p class="swipe-hint muted small">Swipe ← for profile</p>`. In-flow,
  static position, never over the card link or focus (WCAG 2.4.11). Muted on bg 5.84 / 5.03.
- **Render:** server-rendered (no layout shift on a first visit) through a new optional `hint` prop on `TradeCard`
  (`app/ui.tsx`), passed by `feedRowNodes` as `hint={page.offset === 0 && i === 0}` (one additive change in
  `app/feed-rows.tsx`). Appended pages (offset > 0) never get it. Shown signed in and signed out (SW-1 is device
  first-run, not a guest feature). The hint element is a client component (`SwipeHint` in `app/first-visit.tsx`).
- **Gone after the first swipe or → key:** `SwipeHint` adds one capture `scroll` listener on `.feed`; when any
  `.feed > .row` has `scrollLeft > clientWidth / 2` (true after a swipe and after `FeedKeys`'s → scroll, with or
  without smooth scrolling), it calls `setFlag('ss.swipeHint','seen')`, adds the `hint` token and removes its
  listener. The hint disappears while the pane is on screen, so the card's height change is never seen.
- **Not shown again on that device:** the inline script hides it on later loads; the client check covers the rest.
- No dismiss button on the hint (it would add a Tab stop to the first card); swiping or → is its dismissal.
- Screen readers read the text as written (the arrow glyph is read as "left arrow"). The pointer gesture has
  non-gesture equivalents already: the → key and the card's profile link (WCAG 2.5.1).
- No motion: no fade in or out; hidden instantly.

## 5. Nav item "Stocks" → "Trades by stock"

`app/layout.tsx`: `<Link href="/t">Trades by stock</Link>`. Measured with the house font stack in a headless
browser: the longer label overflows the signed-out nav at 320 px (scrollWidth 365) and at 360 px (365). Fix in
the `/* A11Y-FIXES */` block (WCAG 1.4.10):

```css
@media (max-width: 420px) { nav.top { gap: 8px; padding: 12px; } }
@media (max-width: 360px) { nav.top a:not(.logo):not(.me) { white-space: normal; line-height: 1.1; text-align: center; } }
@media (max-width: 340px) { nav.top { font-size: 0.8125rem; } }
```

Measured result: no overflow at 320/340/360/390 signed in and out; nav height 53–56 px at ≤ 360 px, 45 px wider,
so the feed's 64 px top padding still clears it. `e2e/app.spec.ts:713` changes its link name from 'Stocks' to
'Trades by stock' (a rename, not a weakened test). The not-found page (fix #21) uses the same label.

## 6. Acceptance checks (one e2e file `e2e/f13-first-visit.spec.ts`, under `feedLock('shared')`)

1. Signed out, 360×640, fresh context: `.first-visit` has the exact sentence; `getByRole('link', { name: 'How
   records are calculated' })` inside it points to `/how`. Signed in: `.first-visit` count 0. `/?after=…`: count 0.
2. Dismiss via keyboard only: Tab from the page start reaches the Dismiss button (count ≤ 6 Tabs after the skip
   link); Enter removes it; `document.activeElement` is inside the first card. Reload: count visible 0. New context:
   visible again.
3. Demo: with the seeded demo feed, `.first-visit .badge.demo` and `.first-visit` both have bounding boxes inside
   0..640 at 360×640 (and 320×568).
4. Hint: first card contains "Swipe ← for profile"; second card does not. Press → (keyboard) → after the row scroll
   the hint is hidden; reload → not shown. Separate context, touch swipe (as the existing SW-1 swipe tests do) →
   hidden. Signed in, fresh context → shown on the first card.
5. Storage blocked: `context.addInitScript` redefines `localStorage` and `sessionStorage` getters to throw
   `DOMException('denied','SecurityError')`. Both render; Dismiss and → hide them; `page.on('pageerror')` collects
   nothing; reload shows them again.
6. Not an overlay: computed `position` of `.first-visit` and `.swipe-hint` is `static`; no `dialog[open]`, no
   `[role=dialog]`, no `aria-modal`; focus the first card's link and check the line's box does not intersect it
   (WCAG 2.4.11).
7. Reduced motion (`reducedMotion: 'reduce'`): `transition-duration` and `animation-name` of both are `0s`/`none`.
8. Cookies: `context.cookies()` before and after dismiss and swipe are equal; no third-party requests (existing
   request watcher).
9. Nav: `nav.top` link 'Trades by stock' navigates to `/t`; at 320 and 360, signed in and out,
   `nav.scrollWidth <= innerWidth` and `nav.offsetHeight <= 60`.

Unit tests (node:test):
- `lib/device-flag.test.ts`: working local store; local throws → session used; both throw → memory, no throw; the
  `window.localStorage` getter throws → handled; `SEEN_SCRIPT` run in `node:vm` with fake `document` and stores sets
  the right tokens and never throws.
- `lib/f13-copy.test.ts`: `FIRST_VISIT.line === 'Verified trades, straight from the broker. Losses included.'`,
  `FIRST_VISIT.hint === 'Swipe ← for profile'`, `FIRST_VISIT.how === FOOTER.how`; each string passes `PROMO`,
  `MARKS`, `MINORS` and a banned-word list (`every|all|full record|whole record|signal|pick|buy|sell|hold|advice`)
  in its own walk (avoids editing `allCopy()`, which #30 also touches).

## 7. Open questions (recommendation in bold)

1. **"First visit" lifetime.** (a) **Show on signed-out page-1 loads until dismissed** (matches the acceptance
   criterion "stays dismissed after dismissal"); (b) auto-mark as seen after the first load; (c) hide after the
   first vertical scroll past it. (b) and (c) remove the line before many visitors read it.
2. **Where the pre-paint script lives.** (a) **`app/layout.tsx`, every full load** (covers client navigation back
   to `/`); (b) only in the feed page (smaller, but a visit that starts on a profile and navigates to `/` flashes
   the line); (c) no script, hide after hydration (a visible jump for returning visitors).
3. **Dismiss control.** (a) **Quiet × with aria-label "Dismiss"** (house pattern, 44 px); (b) visible text button
   "Dismiss" (clearer for some users, more weight next to a one-line note); (c) "Got it".
4. **Demo badge placement.** (a) **A second line in the line block: badge + "Demo data, not a real broker
   record."**, only while any demo record is on the page; (b) badge only, no text (ambiguous to screen readers);
   (c) rely on the first card's badge (fails for a mixed feed). Note: council rule says the D27 sentence is not
   reworded; (a) adds an existing sentence beside it and changes nothing in it.
5. **Hint for signed-in viewers.** (a) **Yes, device first-run for everyone** (SW-1 wording); (b) signed out only.
6. **Hint once vs until used.** (a) **Until the first swipe or →, then never** (acceptance text); (b) also stop
   after N page-1 loads without a swipe. (b) needs a counter in storage; not needed now.
7. **Privacy page mention of device storage.** The two flags are user-requested UI state (no identifier, never sent
   to the server). The Privacy Policy is an owner placeholder; (a) **owner adds one sentence on device storage when
   writing the policy (note in the PR)**; (b) list them in `lib/privacy-cookies.ts` now (it is a cookie table and
   its test would need a new shape).
8. **F-7 interface.** If F-7 public profiles enter the feed the D27 sentence becomes false for them and goes back to
   the idea board (decision 2026-11-01). Nothing to build now; the PR body repeats the condition.
