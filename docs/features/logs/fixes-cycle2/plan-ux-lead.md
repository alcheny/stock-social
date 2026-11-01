# Fixes cycle 2 (trust rows): UX lead plan

2026-11-01 · branch `claude/fixes-cycle2-trust` · source: `docs/ideas/approval-2026-11-01-cycle2.md` rows 1-30 (pr53).
Build order: #2 first (legal), then #1, #4, #5, #8, #11, #19, #20, #21, #22, #24, #27, #28. A build of #1/#4/#27/#28
is already in the working tree (`lib/stock-labels.ts`, `lib/visible-users.ts`, referral, schema comment): this plan
reviews it rather than restarting it (section 4). Files outside this session (ui.tsx, record-strip, pane, trade/**,
month/**, other images, layout, globals.css, format, moderation, handles, sync, first-visit, month-card, record-card)
are not touched; where a row needs them, a hand-off note goes to the owning feature.

## 1. Fix #2: disclaimer in plain view, and a guard generated from the route tree

**Component** `app/disclaimer.tsx`: `<p className="muted" data-disclaimer>{DISCLAIMER}</p>`.
- Changed: body size, not `small` (proposal had `muted small`). Reason: "plain view" is the legal bar, and 0.85rem
  muted text at 360 px is the size legal already asked us to raise on the images.

**Placement** (one per screen, after the first figures the viewer reads; text exactly `DISCLAIMER`):
| Route | Where | States |
|---|---|---|
| `/t/[symbol]` | right after `<section className="stats">`, before "n trades · traders" | also in the empty state when `OpenPositions` renders (unrealized % is performance); not on a 404 |
| `/t/compare?a&b` | in each non-empty `Column` after its `.stats`; once in the both-empty message when an open line shows | Changed from "once under the grid": at 360 px column B's figures sit a full screen below the grid's top |
| `/me/record` | directly under the h1 block, before "Since your last visit" | demo and real; the not-connected state too (one code path) |
| `/me/likes` | under `LIKES.private`, before the list | always (one code path; the page is about returns) |
| `/u/[handle]` | additive line after the `.evidence` block of the headline group, before the second `.stats` | Changed: not between `.stats` and `OpenGrid`, which would break F-6's "unrealized grid directly under" (TR-4) |
| `/tools` (+ views) | existing `Disclaimer` in `app/tools/parts.tsx`: add `data-disclaimer` to its `<p>` | text is already exact |

**Route table** `lib/disclaimer-routes.ts` (pure, no DB): `walkRoutes(appDir)` finds `page.tsx`, `route.ts(x)`,
`opengraph-image.tsx`, `twitter-image.tsx`, `sitemap.ts`, `robots.ts`, and returns patterns (`/u/[handle]/trade/[sellId]`).
`ROUTES: Record<pattern, Entry>` where Entry is one of:
- `performance { sample, signedIn?, anchor }`: `anchor` is the selector of the first figures (`.stats`, `.rec-dl`,
  `ul.likes`), because `/me/*` has no `.stats`. Samples from seed: `/u/momentum_maya`, `/t/NVDA`,
  `/t/compare?a=NVDA&b=AMD`, `/me/record` and `/me/likes` (signed in), `/tools` (signed in).
- `pendingF10F12 { ponytail }`: `/`, `/u/[handle]/pane`, `/u/[handle]/pane-chart`, trade and month pages and their
  images, the stock image's 22 px size. Each `ponytail` names the owner ("F-10 PR", "F-12 PR"), and the entry is
  moved to `performance`/`image` in that PR (their ACs already require it).
- `image { sample }`: `/u/[handle]/opengraph-image`, `/u/[handle]/story`, `/t/[symbol]/opengraph-image`.
- `notPerformance { reason }`: `/t` (counts only, no returns), `/how`, `/terms`, `/privacy`, `/login*`, `/connect*`,
  `/auth/*`, `/me/following|hidden|personalize`, `/settings`, `/account*`, `/api/*`, `/tools/signin`, sitemap, robots.
- Decided: a pattern in the table but not in the tree also fails (stale rows hide a renamed route).

**Tests**
- `lib/disclaimer-routes.test.ts` (node:test): every walked route has an entry and every entry has a route; every
  `image` and `pendingF10F12` image module source contains `{DISCLAIMER}` imported from `lib/share.ts`; every
  `performance` page's module tree (page + imported local components) imports `app/disclaimer.tsx` or `tools/parts.tsx`.
  The existing hard-coded list in `lib/share.test.ts` stays (never delete tests).
- `e2e/disclaimer-guard.spec.ts` at 360x740, signed out unless `signedIn`: for each `performance` entry, exactly one
  `[data-disclaimer]` whose `textContent.trim()` equals `DISCLAIMER` (the footer's longer copy has no attribute, so
  it can't satisfy this); **beside**: `disclaimer.bottom - anchor.top <= innerHeight - fixedTop - fixedBottom` (the
  first figures and the line fit on one screen under the fixed nav); then `scrollIntoView({block:'center'})`,
  `toBeInViewport()`, and no element with computed `position: fixed|sticky` intersects its box. Not depending on fix
  #14 (`scroll-padding`, globals.css), hence `block: 'center'`. For `image` entries: 200 + `image/png`.
- `ponytail:` pixel check of image disclaimers (size, in frame) needs OCR, i.e. a new dependency: out of scope; F-12
  owns the 22 px raise and its own image ACs.

## 2. Copy and behaviour rows

- **#1 (in tree, finish)**: all stock words from `lib/stock-labels.ts`. Still to do: `[symbol]/page.tsx` EXPLAINER,
  title, description (`tradesWord(s)` + `suffix`), empty text; `t/page.tsx` title "Stocks with closed trades",
  intro, empty "No closed trades yet.", no-match, list aria-label, watch-strip line (drop "verified " always;
  `WatchItem` has no mixed flag); compare title (`tradesWord` of both sides) and `compareDescription` suffix
  "Demo data." (update `lib/compare.test.ts`'s `/Sample data/` to `/Demo data/`); stock image wording only (alt,
  neutral lines, empty, "closed trades" under the symbol, `imageStatus`). Decided: keep the engineer's title "NVDA
  demo trades" over the proposal's "NVDA trades · Demo data" (shorter in a tab, already tested).
- **#4 (in tree)**: `visibleUser(alias)` / `visibleUserIds()` cover every app/t query and the sitemap. Add a
  source-scan node:test: every `from closed_trades` / `from open_positions` in `app/t/**` and `app/sitemap.ts` is
  followed (same statement) by `visibleUser`/`visibleUserIds`. `lib/feed.ts` keeps its own filter (F-10's file):
  note for F-16 to move it onto the helper. The query change in the stock image is not wording: **orchestrator to
  confirm** it may stay here (F-12 owns strip and size, not the query); otherwise hand it to F-12.
- **#5**: `join-cta.tsx`: "Read-only broker connection. Your handle, name, trades (symbol, dates, % return), open
  positions, broker name and any reasons you write are public; never sizes, prices or balances. 18+." as
  `PUBLIC_SHORT` in `lib/copy.ts`; `share-prompt.tsx` line becomes `CONSENT_SCOPE_LINE` + "Your handle, display name
  and any reasons you publish are public too." Changed: not CONSENT_SCOPE_LINE in the CTA (too long at 360 px, and
  it omits handle, name and theses). Test in `lib/privacy-fields.test.ts`: `PUBLIC_SHORT` names a word for every
  `PUBLIC_FIELDS` entry plus handle/name/reasons, and contains no "only percentages".
- **#8**: `t/page.tsx` description (covered by #1, no "every"); `lib/claims.ts` body: "...can only ever belong to one
  profile, so each record comes from its own broker account." Test: no `/\bevery record\b|\bevery stock\b/` in either.
- **#11**: HoldTime "Hold time alone doesn't explain a result."; `COMPARE_COPY.pick` "Choose two stocks to compare.",
  `.same` "Choose two different stocks. You chose X twice."; `/me/record` "Choose up to two rules…", "Your next
  sync will include them." Test: no `/\b(pick|signal)/i` in `COMPARE_COPY` values or JSX text of these files; edit
  e2e/app.spec.ts:758/760 strings in place.
- **#19 (these files only)**: `toneClass` + `pct` in `[symbol]/page.tsx` (stats, rows), `Theses.tsx`, compare
  stats, `/me/likes`. Others (ui, pane, chart, similar-section, trade/month, profile row) go to F-10/F-11/F-12.
- **#20**: `app/not-found.tsx` (metadata title "Page not found · Stock Social", h1, links to feed and `/t`, works
  signed out, no figures). `/t/[symbol]`: `notFound()` in page and `generateMetadata` when `toSymbol` fails;
  a valid symbol with no trades stays 200 + noindex (it is a real ticker; open positions may show). No
  `loading.tsx` in the segment, so the status is a real 404. Edit e2e app.spec.ts:698 in place: ZZZZ stays 200
  ("No closed trades in ZZZZ yet."), `%3Cscript%3E` expects 404 and the not-found h1. Trade/month image 404s: F-12.
- **#21**: static `metadata` titles: "Sign in", "Check your email", "Dev sign-in", "Connect your broker", the h1s of
  consent/continue/result, "Terms", "Privacy Policy" (each "· Stock Social"). Test: the #2 walker asserts every
  `page.tsx` exports `metadata`/`generateMetadata` (or an ancestor `layout.tsx` does); e2e: titles pairwise distinct.
- **#22**: select `t.sell_id` in the thesis query, carry `sellId` through `selectTheses`, link
  `/u/${handle}/trade/${encodeURIComponent(sellId)}` (the pattern likes/hidden already use). Test: e2e clicks a
  thesis on `/t/NVDA` (seed a published thesis) and lands on a 200 trade page.
- **#24**: drop the bold `COMPARE_COPY.tooEarly` prefix; `evidenceLine` already says it. Test: "too early" appears
  once in a too-early column's `.evidence`.
- **#27 (in tree)**: comments only; fine. **#28 (in tree)**: fine; change the label to "the sign-in link on your
  pages" (the nav sends `via=nav` from trade and month pages too, regex `^/u/h(/|$)`).

## 3. States
Signed out (shared link) is the e2e default; demo-only, mixed and verified wording each pinned in
`lib/stock-labels.test.ts`; empty stock page (200, no figures, disclaimer only with open positions); invalid symbol
(404); all-losses and flat 0.0% get no colour without a sign (#19). No loading states change.

## 4. Compliance (COMPLIANCE §1)
1 performance: yes, this is the F3 fix; no advice words added, removes "pick/signal" (F1a), "every" (F3a), demo
never "verified" (F3a, P2). 2 personal data: no new fields; #5 makes the public list true (P6, P3); #4 hides
deletion-in-progress users. 3 money, 4 messages, 6 sign-up, 7 vendors/deps, 11 checkout: no. 5 user text: thesis
links only. 8 a11y: titles (2.4.2), real 404, sign not colour alone (1.4.1). 9 security: none. 10 claims: removed.

## 5. Only the owner can clear
- `CONSENT_SCOPE_LINE` (owner copy) does not name handle, display name or theses, which are public: P6 says the
  connect step lists *exactly* what becomes public. Not changed here; owner decides the wording.
- The stock image query line (section 2, #4) if the orchestrator rules it outside "wording".
