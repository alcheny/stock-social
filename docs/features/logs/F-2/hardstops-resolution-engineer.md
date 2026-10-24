# F-2 · Hard stops H1, H2, H4 · Engineer's factual base

Date: 2026-10-24. Role: engineer (read only). Input to the business lead's drafts of H1 (POLICY F1 amendment),
H2 (counsel packet, plan §7) and H4 (Privacy text, plan §5). Nothing here is legal advice; it states what the
code does.

Tree read: branch `claude/peaceful-dirac-33bucv` at HEAD `740804b` (contains PR-4, commit `06b90b2`, **not yet on
`origin/main`**) plus the uncommitted PR-4 fix round 1 in the working tree (`lib/likes.ts`, `lib/copy.ts`,
`app/discovery-actions.ts`, `app/card-gestures.tsx`, `app/feed-hides.tsx`, `app/not-interested.tsx`, `app/ui.tsx`,
`app/feed-rows.tsx`, `app/page.tsx`, `app/me/following/*`). `origin/main` has PR-1, PR-1b, PR-2, PR-3, PR-3b:
`follows` and `viewer_exclusions` only; `trade_likes`, `trade_rejects`, `closed_trades.trade_key` and the
preference re-ranking (`lib/discovery/prefs.ts`) arrive with PR-4.

## 1. Data inventory from code

### 1.1 F-2 viewer tables (built)

Every row exists only for a signed-in, 18+-attested account. Signed out, no F-2 action writes anything: every
server action in `app/discovery-actions.ts` returns `{ ok: false, reason: 'signin' }` before any query
(`pair()`, `byKey()`), and `GET /me/liked` returns `{ liked: [] }` without a query.

#### `follows` (`db/schema.sql:324`, PR-2)

| | |
|---|---|
| Columns | `viewer_id` (→ users, cascade), `trader_id` (→ users, cascade), `created_at`; pk `(viewer_id, trader_id)`; check viewer ≠ trader; index `(trader_id)` |
| Writes | `follow` / `followForm` → `lib/follows.ts#follow` (insert; also ends any running exclusion on that trader; sets `users.follow_notice_at` once). `unfollow` / `unfollowForm` → `#unfollow` (deletes the row **and writes a 90-day `viewer_exclusions` row with reason `unfollow`**, see below) |
| Reads (all `where viewer_id = <session id>`) | `followingAmong` (feed cards' and profile header's Follow state: `lib/feed.ts:347`, `app/u/[handle]/page.tsx:95`); `sectionSkips` (section leaves followed traders out: `lib/feed.ts:317`); `ownLists` (`/me/following`, joined to `users` for handle and name) |
| Ranking use today | None as a boost. A follow only removes the trader from the viewer's suggestions section. |
| Public read | None. Static scan: `lib/follows.test.ts`; behavioral: `lib/feed.signed-out.test.ts` (signed out no query names the table; signed in only the session's id) |
| Retention | Until the viewer unfollows, or either account is deleted. No time limit. |
| Deletion | `lib/delete.ts:22-30` first step (same transaction as the `deleted_at` mark, before the vendor call): `delete … where viewer_id = id or trader_id = id`; FK cascade covers rows written meanwhile |

#### `viewer_exclusions` (`db/schema.sql:336`, PR-2; reason semantics changed in PR-4)

| | |
|---|---|
| Columns | `viewer_id`, `trader_id` (both → users, cascade), `created_at`, `until`, `reason` ∈ {`not_interested`, `unfollow`}; pk `(viewer_id, trader_id)`; indexes `(trader_id)`, `(until)` |
| Writes | `notInterested` / `notInterestedForm` (menu on section rows, the section reject swipe) → `exclude(…, 'not_interested')`, `until = now() + 90 d`. `unfollow` → `exclude(…, 'unfollow')`, 90 d. `undoNotInterested`, `showAgainForm` and a new follow → `endExclusion` (`until = now()`, row kept) |
| Reads (all viewer-keyed) | `exclusionsFor` (feed: `not_interested` rows hide the trader; `unfollow` rows become a −1 preference, `lib/feed.ts:316-320`); `sectionSkips` (`not_interested` only); `hiddenTraders` (Similar trades on profiles, `lib/similar.ts:52`); `ownLists` (`/me/following` lists **`not_interested` only**); `isHidden`, `shownAgainJustNow` (no-JS confirmation lines) |
| Public read | None (same tests as `follows`) |
| Retention | Running for 90 days (`EXCLUSION_DAYS`); an ended row is deleted by `purgeDiscovery` once `until < now() − 1 day` (`lib/discovery/purge.ts`). Every read filters `until > now()` or `until > asOf`, so an ended row is invisible while it waits for the purge |
| Purge job | `purgeDiscovery()` in `POST /api/sync` (`app/api/sync/route.ts:34`), advisory lock 3, ≤ 30 s per call, batches of 10,000 by `(until)`. **Nothing calls `/api/sync` on a schedule today** (`vercel.json` has no cron; `docs/IMPLEMENTATION.md` item #7: "nothing calls it today", deploy settings are owner-only) |
| Deletion | `lib/delete.ts` first step, both directions, plus cascade |

#### `trade_likes` (`db/schema.sql:359`, PR-4)

| | |
|---|---|
| Columns | `viewer_id` (→ users, cascade), `trade_key` (sha256 hex of the closing sell's vendor id; `closed_trades.trade_key` is the same value as a generated column), `trader_id` (→ users, cascade), `created_at`; pk `(viewer_id, trade_key)`; index `(trader_id)` |
| Writes | `like` (double tap or heart on a feed card; signed in only, and in the working tree the heart is not rendered signed out) → `lib/likes.ts#like`; `unlike`, `unlikeForm` (`/me/following`, no-JS too) → `#unlike` (hard delete) |
| Reads (viewer-keyed) | `likedAmong` via `GET /me/liked?k=<up to 60 keys>` (`app/me/liked/route.ts`, `Cache-Control: private, no-store`; the heart's pressed state); `ownLikes` (`/me/following` "Liked records", inner join to `closed_trades`, newest 200: `LIKES_MAX`) |
| Ranking use today | **None.** The feed's own read never touches `trade_likes` (asserted in `lib/feed.signed-out.test.ts:100`). Stored for PR-5 (+3). |
| Public read | None. `lib/likes.test.ts:24` (static: only `lib/likes.ts`, `lib/delete.ts` and the purge name the table; nothing counts it; no share image, pane chart or sitemap imports it) |
| Retention | **No time limit and no purge.** A like whose trade a rebuild removes is kept and ignored on read (re-attaches if the trade returns) |
| Deletion | `lib/delete.ts:28` first step, both directions, plus cascade |

#### `trade_rejects` (`db/schema.sql:371`, PR-4)

| | |
|---|---|
| Columns | `viewer_id`, `trade_key`, `trader_id` (→ users, cascade), `created_at`, `until`; pk `(viewer_id, trade_key)`; indexes `(trader_id)`, `(until)` |
| Writes | `rejectTrade` (the feed card's reject drag, and in the working tree "Hide this trade" in the card's "…" menu, with a no-JS `rejectTradeForm` that redirects to `/`) → `lib/likes.ts#rejectTrade`, `until = now() + TRADE_REJECT_DAYS` (90 today; `'infinity'` if the owner makes it permanent, O3). `undoRejectTrade` (the 5 s Undo) → `until = now()` |
| Reads (viewer-keyed) | `rejectsFor` (feed: the trade is hidden for the viewer; its trader gets a −1 preference for `PREF_DAYS` = 90, `lib/discovery/prefs.ts`); `rejectedKeys` (Similar trades on profiles skip the trade) |
| Viewer access | **None after the 5 s Undo.** No page lists a viewer's rejected trades or lets them end one |
| Public read | None (`lib/likes.test.ts:24`) |
| Retention | 90 days + 1 day via `purgeDiscovery` (second step); **a permanent reject (`until = 'infinity'`) is never purged** |
| Deletion | `lib/delete.ts:29` first step, both directions, plus cascade |

#### Other per-viewer state F-2 added

- `users.follow_notice_at` (`db/schema.sql:347`): when the viewer first saw "Only you can see this." Set once by
  `follow`; read only by `follow`. Deleted with the users row.
- `closed_trades.trade_key`: derived from a trader's public record (not viewer data); listed because the client
  sees it in `data-key` and `/me/liked?k=`.
- In-memory caches (`lib/feed.ts#lists`, `lib/similar.ts#kept`, `#panes`) hold only impersonal lists, keyed by
  `(day, asOf)` or by hour. Viewer-shaped lists are computed per request and never cached.

### 1.2 Pre-F-2 per-user behavior data the Privacy text must also cover

| Data | Where | Written | Read by | Retention | Deletion |
|---|---|---|---|---|---|
| Ticker watchlist | `ticker_watches (user_id, symbol, created_at, last_seen_at)` (`db/schema.sql:131`) | Watch toggle (`app/actions.ts:100-107`); `last_seen_at` on each `/t/<symbol>` view (`app/t/[symbol]/Watch.tsx:22`) | Owner only (`/t`, `/t/<symbol>`). **PR-5 reads it for ranking** ("Trades symbols on your watchlist") | Until unwatched | Users-row cascade only (not in the first step) |
| Session activity | `sessions.last_seen_at`, `created_at`, `expires_at` (`db/schema.sql:223`) | Every signed-in request, at most hourly (`lib/auth/sessions.ts:46`) | Session lookup | 30-day sessions; **expired rows are never purged** (deleted only on sign-out, re-sign-in in the same browser, or account deletion) | Cascade |
| Owner prompts and views | `users.record_first/last/prev_viewed_at`, `record_view_count`, `share_prompt_seen_at/action`, `trades_prompt_seen_at/action`, `trade_shared_at`, `badge_copied_at`, `share_image_saved_at` | The owner's own pages and actions | Owner's own pages; measured by hand (schema comments) | Indefinite | With the users row |
| Sign-up funnel | `funnel_events (attempt_id, name, at, meta)`, incl. `own_profile_viewed` (`app/u/[handle]/page.tsx:104-106`) | Sign-in, connect, first own-profile view | Measured by hand | **No purge**; keyed by attempt, which survives account deletion (`signup_attempts.user_id` set null) | Not deleted with the account (no personal data by design: allow-listed meta) |
| Referral | `users.referred_by_user_id`, `referred_via`, `referred_surface` | Sign-up via a profile CTA | **The referrer sees the referred users' handles and surface on their own profile** (`app/u/[handle]/page.tsx:109-124`) | Indefinite | Set null when the referrer is deleted; gone with the referred user |

### 1.3 What PR-5 would add (as planned, `plan.md` §1 PR-5; not built)

- `discovery_events (id, viewer_id → users cascade, at, surface → discovery_surfaces, type →
  discovery_event_types, target_kind ∈ trader|trade|symbol, target_user_id → users cascade, target_trade_key,
  target_symbol)`; indexes `(viewer_id, at)`, `(at)`, `(target_user_id)`. Lookup tables
  `discovery_event_types` and `discovery_surfaces` hold no personal data.
  - Writes: explicit (follow, unfollow, not_interested, its undo, like, unlike, share, watch, unwatch, written in
    the same transaction as their state row) and implicit through `app/discovery-log.tsx` → `POST /api/events`:
    impression (60% visible for 500 ms, once per card per view), dwell buckets, skip (< 1 s), swipe_open,
    profile_open. Signed in only; signed out the logger is not mounted and the route returns 204 storing nothing.
    Note: the planned type list has no `reject`/`reject_undo` type, though PR-4 added the trade reject.
  - Reads: `viewerProfile(...)` on read, last 90 days, ≤ 2,000 events, for that viewer only.
  - Retention: `at < now() − 90 days` deleted by the same `purgeDiscovery` (batches of 10,000 by id), every read
    filters to 90 days. Deletion: the first step adds the table; cascade on both FKs.
- `discovery_trader_features (user_id pk → users cascade, symbols text[], hold_buckets real[5], updated_at)`:
  derived from public records, refreshed in the tick, never on a public read; gone with the trader.
- Conditional: `viewer_affinities` returns if scoring misses 10 ms per viewer (plan PR-5 budgets). Stage 2
  adds a serves table with positions and propensities (H3). Neither is in §5.
- PR-5 makes these ranking inputs: follows (boost), likes (+3), watchlist, implicit events, plus today's
  exclusions and rejects; exploration seed becomes viewer id + UTC day.

## 2. Discrepancies

Against plan §5 (D1 to D9), the Privacy placeholder (D10) and COMPLIANCE §3 (D11):

| # | Finding | Where | Matters for |
|---|---|---|---|
| D1 | **`trade_rejects` is missing from §5.** It is per-viewer, keyed to a trader, retained 90 d + 1 d, or forever if O3 makes it permanent | `db/schema.sql:371` | H4 |
| D2 | **Unfollow is not "deleted by the viewer".** It deletes the follow and writes a 90-day `viewer_exclusions` row (`reason = 'unfollow'`) that demotes the trader (×0.8). `/me/following` does not show it and the viewer cannot end it except by following again | `lib/follows.ts:33-37`, `#ownLists` | H4 |
| D3 | **Likes have no retention limit, and some are unreachable.** Likes on a trade a rebuild removed are kept but not listed (`ownLikes` inner-joins `closed_trades`). Likes past the newest 200 are not listed either. The viewer can see or remove neither except by deleting the account | `lib/likes.ts:41-48` | H4 (access and deletion rights, COMPLIANCE §3) |
| D4 | **Trade rejects are invisible to the viewer** after the 5 s Undo. No list, no "Show again" | — | H4 |
| D5 | **"Who sees it: the viewer only (`/me/following`)" is too narrow.** The same rows also shape the viewer's feed, section and Similar trades, and set Follow and heart state on cards, panes and profile headers. Every read is keyed by the session's viewer id and none is public, so the claim holds, but the text should say where the data is used | §1.1 | H4 |
| D6 | **Per-viewer ordering is already live before H2, beyond the mute Q6 describes.** In PR-4 an unfollow (−1) and each trade reject's trader part (−1, 90 d) re-rank the signed-in feed and the section pool (`lib/discovery/prefs.ts`, `lib/feed.ts:320,334`). A reject also hides one trade. Q6 covers only "Not interested". Counsel should be asked about explicit-action demotion and trade-level hides as built | plan §7 Q6 | H2, H1 |
| D7 | **The watchlist is not in §5**, though PR-5 reads it as a ranking input and a reason line | `db/schema.sql:131` | H4 (before PR-5) |
| D8 | **"No cookie beyond the existing session cookie" is not literally true.** The app sets six first-party, httpOnly cookies, none of them while merely viewing signed out: `sid` (session, 30 d), `login_email` (the typed address, 15 min, path `/login`), `login_attempt` (1 h), `auth_tx` (10 min), `connect_attempt` (attempt lifetime, path `/connect`), `auth_last_method` (365 d, path `/login`). None is a behavior or advertising identifier | `lib/session.ts:39,46`, `app/auth/actions.ts:45-84` | H4 |
| D9 | **The retention promised depends on a cron that does not exist yet.** Ended exclusions and rejects are purged only when `/api/sync` is called; item #7 is unscheduled. Until it is, the rows stay stored (invisible to every read). The same holds for PR-5's 90-day event purge | `vercel.json`, IMPLEMENTATION #7 | H4 (a stated retention must be true: FTC §5) |
| D10 | **The Privacy placeholder covers nothing.** `app/privacy/page.tsx` renders a title and "Placeholder: the owner supplies the final text before launch." Every row above, and the pre-F-2 data in §1.2, is uncovered | `app/privacy/page.tsx` | H4 |
| D11 | **The image renderer contacts third parties server-side.** `next/og` fetches `fonts.googleapis.com` (the uncovered glyphs travel in `&text=`) and an emoji CDN for any glyph its bundled font lacks. That carries trader-authored text (display name; thesis on the trade card), not viewer behavior, and no viewer IP or cookie. `lib/card-glyphs.ts` (the F-4 fix) is not built yet. This conflicts with COMPLIANCE §3, which allows outbound calls only to integrated vendors | `app/u/[handle]/opengraph-image.tsx`, `trade/[sellId]/opengraph-image.tsx`, `month/[ym]/opengraph-image.tsx`, `story/route.tsx`, `app/t/[symbol]/opengraph-image.tsx`; `docs/features/logs/F-4/plan-round1-engineer.md` §1 | H4, counsel |
| D12 | **Viewer actions reach the host's request logs in URLs.** The no-JS paths redirect to `/u/<handle>?done=follow\|unfollow\|hidden[&first=1]` and `/me/following?back=<handle>`. `GET /me/liked?k=…` lists the trade keys on the viewer's screen (an impression-like trail). Each is logged by the hosting platform with the IP address. That platform is a processor, not a script on the page | `app/discovery-actions.ts:36-45`, `app/me/liked/route.ts` | H4 (name the host and its logs), or a small fix: POST for `/me/liked` |
| D13 | **Test gap (not a privacy breach).** The behavioral guard `VIEWER_TABLES` does not name `trade_rejects` (or `ticker_watches`), though the feed reads `trade_rejects` signed in. The static scan in `lib/likes.test.ts:24` does cover it | `lib/feed.signed-out.test.ts:13` | PR-4 fix round or PR-5 |
| D14 | Minor: deletion's first step does not include `ticker_watches`, so a watchlist survives a failed vendor call until the retry tick finishes the deletion (follows, likes and the others do not). The referral read (§1.2) is the only place one account sees another account's action (joined via my link). It predates F-2 but belongs in the Privacy text | `lib/delete.ts`, `app/u/[handle]/page.tsx:109` | H4 |

What does hold, as §5 states: signed out, no F-2 table is read or written (tested, `lib/feed.signed-out.test.ts`).
No event table exists (`lib/likes.test.ts:24` asserts it). No count of follows or likes appears on any page,
pane, share card, OG image, `/pane-chart` or sitemap. Account deletion removes follows, exclusions, likes and
rejects in both directions, before the vendor call (`lib/delete.test.ts`, `lib/likes.test.ts:137`).

## 3. Technical facts for the counsel answers

### 3.1 Ordering inputs today (HEAD + working tree)

**Signed out, and the base for everyone:** one impersonal list per `(UTC day, asOf)`. Steps: `rankTraders` by
evidence weight × score (the TR-9 lower bound, sign-symmetric: `abs(return_pct)`), then `diversify` (≤ 2 per
trader and per symbol in any 10), then exploration (≥ 2 of 10, PRNG seeded by UTC day only), then paging. The
same list serves every viewer; no viewer data is read.

**Signed in, the feed** (`lib/feed.ts#loadFeedPage`), applied on top of that list, for that viewer only:
1. `not_interested` exclusions: the trader's cards removed (made by asOf), or filtered in place (made since).
2. Trade rejects: that one card removed or filtered the same way.
3. Preferences: each running unfollow −1, and each reject's trader part −1 (90 days). Each −1 multiplies the
   trader's ranking product by 0.8 (`PREF_BASE`). Only negative; nothing is ever boosted.
4. Not used for ordering: follows (Follow state only), likes, watchlist, views, dwell, clicks. No event is
   recorded.

**Signed in, the section** (`lib/feed.ts:334`): the impersonal pool, minus the viewer, followed traders and
`not_interested` traders, chosen with the same preferences (`preferPool`), rows in lower-bound order.

**Similar trades on profiles** (`lib/similar.ts`): the impersonal hourly pool, minus the viewer,
`not_interested` traders and rejected trades.

None of these reads a security as a recommendation input. Symbols enter only as the diversity cap, and
(PR-5) as similarity to what the viewer read or watches.

### 3.2 Does any third party receive behavior data?

- **Browser:** no. `app/layout.tsx` loads no external script, font or stylesheet (no `next/font`, no
  `next/script`, no `@import` or remote `url()` in `app/globals.css`). There is no analytics, session replay,
  pixel or tracker anywhere in `app/` or `lib/`. No `localStorage` or `sessionStorage`. The connect flow frames
  the broker vendor's portal (SnapTrade) during connect only.
- **Server:**
  - SnapTrade receives broker-linking calls only, no viewer behavior.
  - The email sender (`AUTH_EMAIL_SEND_URL`) receives the address and the link.
  - The sign-in providers receive the OIDC flow.
  - The image renderer's font and emoji fetches carry trader-authored glyphs or text, not viewer behavior (D11).
- **The hosting platform** stores request logs, which contain the URLs in D12.
- **PR-5 as planned** keeps everything first-party: `sendBeacon` to the app's own `/api/events`, same-origin,
  with no third party.

### 3.3 Cost of an opt-out from personalized ordering (Q4)

| When | What to build | Product lines | Test lines |
|---|---|---|---|
| **Today** (one small PR) | `schema_add_column('users', 'personal_order_off_at', 'timestamptz')`. A toggle on `/settings` (`app/settings/page.tsx` plus a server action, ~25). Copy in `lib/copy.ts#SETTINGS` (~4). In `lib/feed.ts#loadFeedPage`: read the flag with the viewer's rows and set `prefs` to an empty map when it is set (`:320`; the section's `preferPool` at `:334` takes the same map), ~8 | ~40 | ~60 (a DB test that an opted-out viewer gets the impersonal order, still minus their own mutes and hides; e2e for the toggle at 375 px, keyboard) |
| **With PR-5** | The same flag also: skips `viewerProfile` (relevance 0, impersonal reasons and heading), unmounts the logger, and makes `/api/events` return 204 storing nothing; optionally deletes the viewer's events on opt-out (~5) | +~20 | +~40 |

- No dependency is needed.
- With no preference and no exclusion, `loadFeedPage` already serves the shared `kept.mixed` list, so an
  opted-out viewer gets the signed-out list minus the hides they chose.
- Open for counsel: whether an opt-out must also drop viewer-set mutes and hides. That is the same lines with a
  different branch.
- Cheapest is to build it inside PR-5b, where scoring is written (it touches the same lines).

## 4. Where the Privacy text goes

- **Page:** `app/privacy/page.tsx`. Today it renders `LEGAL_PLACEHOLDER.privacyTitle` and `.placeholder`.
- **Copy:** add a `PRIVACY` export to `lib/copy.ts`, and add it to `allCopy()` (`lib/copy.ts:410`) so that
  `lib/copy.test.ts`'s copy scans cover it. Keep `LEGAL_PLACEHOLDER.placeholder`: `/terms` still uses it.
- **Tests that pin the page:**
  - `e2e/signin.spec.ts:122-123` expects "Placeholder: the owner supplies the final text before launch." visible
    on `/privacy`. This assertion must be replaced with one on the adopted text: a test edit the owner approves,
    never a deletion.
  - `lib/copy.test.ts:34` pins `LEGAL_PLACEHOLDER.placeholder`. It is unaffected if Terms keeps the placeholder.
  - `e2e/connect.spec.ts:117-123` checks the footer links on `/privacy`. Unaffected.
  - `e2e/signin.spec.ts:90,95` checks the login page's Privacy Policy link (href, `rel="noopener"`). Unaffected.
- **Scanner constraints (`scripts/compliance.ts`):**
  - A literal contact email address in the text fails the personal-data rule (only `example.*`/noreply addresses
    pass). Read it from an env var, as `VENDOR_SECURITY_URL` does.
  - Name only integrated vendors (SnapTrade, the host). The font CDN in D11 is not integrated: describe it, or
    fix D11 first.
  - The PROMO completeness patterns apply to `app/` and `lib/`.
- **Who adopts it:** POLICY H makes the Privacy Policy a human-only decision. `app/privacy/` is not in
  `.github/CODEOWNERS`, so the Gate would not stop an agent PR that changes it. The owner should merge that PR
  by hand (or protect the path).
