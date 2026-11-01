# Chores from approval council cycle 3: implementation plan (UX lead)

Date: 2026-11-01 · Branch `claude/chores-cycle3` · Status: plan, awaiting business-lead and engineer sign-off.
Sources: `docs/ideas/approval-2026-11-01-cycle3.md` (Not approved; Routed in round 0), its ballots (legal C3-34 `:497`,
C3-39 `:504`, C3-44 `:576`), cycle 2 K20/K22 (`approval-2026-11-01-cycle2.md:483-495,661,663,746,748`),
`docs/direction/design-system-2026-11-01.md:27`. Items: C3-34, C3-44, K20, K22, C3-39 (not C3-40).

Shared rules: no edits to `lib/sync*.ts`, `lib/trades.ts`, `lib/broker.ts`, `lib/views*.ts`, `app/ui.tsx` or the other
files owned by other sessions (importing their constants is fine). New copy goes in one `// CHORES-3` block at the end of
`lib/copy.ts` (`export const CHORES_3 = {...}`, closed by `// end CHORES-3`). Tests in new files only:
`lib/chores-cycle3.test.ts` (unit, plus `dbTest` cases) and `e2e/chores-cycle3.spec.ts` (Playwright, 360x740). No new
dependency. No `app/globals.css` change is expected (`.rt .button.secondary` exists at `:460`); if one is needed it is
an appended `/* CHORES-3 */` block. Specs and tests name the processor only as "the billing vendor".

## 1. C3-34: `GET /api/health` and the cron 401 log line

**Behaviour.** New `app/api/health/route.ts`, `GET` only. One statement, both values in one round trip:
`select (select max(heartbeat_at) from sync_shards) as last, (select min(last_synced_at) from users where
snaptrade_user_id is not null and deleted_at is null) as stalest` (`sync_shards` is tiny; `min` uses the partial index
`users_sync_order`). `THRESHOLD_MS = ROUND_MS` imported from `lib/sync.ts:204` (one hourly round; the cron ticks every
5 min, so a healthy heartbeat is never older than ~5 min). Status:
- `degraded` if the query throws, or `last` is null (no run ever recorded), or `now - last > THRESHOLD_MS`;
- `ok` otherwise. **The stalest trader sync does not affect status** (details only): backoff and quarantine
  (`users.sync_failure_kind`) legitimately hold a trader for up to 24 h, so one held trader would page the owner.
Body without a valid bearer: exactly `{"status":"ok"}` or `{"status":"degraded"}`. With a valid bearer
(`Authorization: Bearer $CRON_SECRET`, same constant-time rule) the body adds, in this key order:
`{"status":…,"db":true|false,"lastRunAt":"<ISO>"|null,"lastRunAgeHours":n|null,"stalestSyncAgeHours":n|null,"thresholdHours":1}`.
Hours are rounded to 2 decimals and clamped at 0. On a query error `db:false` and the three time fields are null; the
error is logged as `console.error('health query failed', logSafe(e))`, never in the body. HTTP status is 200 in every
case (a monitor reads `status`; an unreachable app is the 5xx). Every response sets `cache-control: no-store`. A wrong or
missing bearer on health gets the public body, 200, and **no log line** (health is public; logging it would let anyone
fill the log). Health is linked from no page.

**Cron 401 line.** New `lib/cron-auth.ts`:
- `cronAuthorized(req: Request, env = process.env): boolean`: the check now at `app/api/sync/route.ts:34-36` moved
  verbatim (false when `CRON_SECRET` is unset; length check then `timingSafeEqual`).
- `logUnauthorized(route: 'sync' | 'billing-reconcile', now = Date.now()): boolean`: at most one line per route per
  `CRON_LOG_WINDOW_MS = 60_000` per server instance (module-level map). The line is exactly
  `console.warn('cron unauthorized', JSON.stringify({ route, suppressed }))`, where `suppressed` is the number of
  unlogged 401s for that route since the last line. Returns whether it logged (test hook). No token, prefix, hash,
  length, header, IP, user agent or URL. There is no error object, so `logSafe` is not called; the line uses only a
  literal and `JSON.stringify` of fixed fields, which `lib/privacy-logs.test.ts` already allows.
- `app/api/sync/route.ts` and `app/api/billing/reconcile/route.ts`: replace the inline check with
  `if (!cronAuthorized(req)) { logUnauthorized('sync'); return NextResponse.json({ error: 'unauthorized' }, { status: 401 }); }`
  (and `'billing-reconcile'`). The 401 response body and status are unchanged. Nothing else in these routes changes.
- `app/api/health/route.ts` uses `cronAuthorized` only.

**Acceptance criteria.**
1. (unit) `cronAuthorized`: right bearer true; wrong value of same length, wrong length, missing header, `Bearer ` with
   empty secret, and unset `CRON_SECRET` all false. The source uses `timingSafeEqual` (grep).
2. (unit) `logUnauthorized`: 5 calls within 60 s log once; the next line after the window carries `suppressed: 4`;
   routes are counted separately. Captured output, given a request bearing `Bearer s3cr3t-XYZ`, contains none of
   `s3cr3t`, `XYZ`, `Bearer`, `authorization`, an IPv4/IPv6 pattern or `x-forwarded-for`.
3. (unit, source) The two cron routes call `cronAuthorized` and `logUnauthorized`; neither has its own
   `timingSafeEqual`. The health route never calls `logUnauthorized`. `THRESHOLD_MS` is `ROUND_MS` from `lib/sync.ts`
   and the health source has no `20` minute or `1_200_000`/`3_600_000` literal.
4. (db) No `sync_shards` rows → `degraded`; heartbeat 10 min old → `ok`; heartbeat `ROUND_MS + 1 min` old → `degraded`;
   a trader with `last_synced_at` 30 h old and a fresh heartbeat → `ok` with `stalestSyncAgeHours ≈ 30` in details.
   A thrown query (injected) → `{"status":"degraded"}`, and with the bearer `db:false`.
5. (db/unit) Public body deep-equals one of the two allowed objects; detail keys are exactly the six listed; every value
   is a boolean, null, a finite number or an ISO-8601 string; a grep of both bodies finds no seeded handle, user id,
   `@`, `$`, `%` or error text. Every response has `cache-control: no-store`.
6. (e2e) `GET /api/health` signed out → 200, JSON `status` in {ok, degraded}, `no-store`; with a wrong bearer the same
   public body; `POST /api/sync` with a wrong bearer → 401 `{"error":"unauthorized"}` as today.

## 2. C3-44: the subscriber-notes line only when it applies

**Behaviour.** `app/settings/page.tsx` delete view 1 (`:42`) renders `BILLING.deleteNotes` only when
`notesLineApplies(me.id)` is true. The string stays exactly (F-3 plan `:151-152`, `lib/copy.ts:836`):
"If you publish a record, other subscribers' private notes about you are deleted and you are removed from their saved views."
New `lib/delete-notice.ts` (a new file; `lib/views*.ts` is not touched): one query
`select exists(select 1 from closed_trades where user_id = $1) or exists(select 1 from connections where user_id = $1)
or exists(select 1 from record_notes where trader_id = $1) or exists(select 1 from record_view_traders where trader_id = $1)`.
Connections count in any state (pending, importing, connected, declined, expired, failed). Demo data counts (it has
closed trades). On any thrown error it returns **true** (over-disclosure is safe) and logs
`console.error('delete notice check failed', logSafe(e))`. View 2, the `deleteBilling` line, order and styling are
unchanged. Privacy note: the gate can only reveal that someone notes or saves a user who has no record and no
connection, which the schema makes near-impossible; the line itself names no one.

**Acceptance criteria.**
1. (db) `notesLineApplies` is false for a fresh account with none of the four; true with each one alone (a closed
   trade; a connection in each of the six states; another user's note about them; them in another user's view).
2. (unit) With the query forced to throw it returns true.
3. (e2e) A brand-new signed-in account on `/settings` does not see the line; a seeded demo trader does, word for word;
   `/settings?confirm=1` shows neither line (as today).
4. (unit, source) `lib/copy.ts` `BILLING.deleteNotes` is byte-identical to the F-3 plan string above.

## 3. K20: the home link preview

**Behaviour.** New constant `CHORES_3.position = 'Closed trades imported read-only from connected broker accounts. Losses included.'`
For `/` only, `app/page.tsx#generateMetadata` (additive; the `?after` `robots` rule is kept and merged) returns:
`description: CHORES_3.position`; `openGraph: { title: CHORES_3.homeTitle, description: CHORES_3.position, type:
'website', url: '/', images: [{ url: <abs>/home-card, width: 1200, height: 630, alt: CHORES_3.position }] }`;
`twitter: { card: 'summary_large_image', title: CHORES_3.homeTitle, description: CHORES_3.position, images:
[<abs>/home-card] }`. `CHORES_3.homeTitle = 'Closed trades imported read-only from connected broker accounts.'` (the first
sentence; the whole line is the description, so the two do not repeat). `<abs>` is `siteOrigin()` (`lib/billing.ts`),
never a request Host header. The browser `<title>` stays `Stock Social`; the root layout's description (D27) and
`FIRST_VISIT.line` are unchanged, so other routes are unaffected.
Image: new route handler `app/home-card/route.tsx` (same pattern as `app/u/[handle]/story/route.tsx`), `GET` returns
`new ImageResponse(...)` 1200x630, default bundled font, text only: the positioning line in two lines on a plain
`#0b0b0f` background, text `#f2f2f5`, ~64 px, left-aligned with 80 px padding. No name, logo, glyph, wordmark, chart,
figure, percent or disclaimer (none needed: no figure). `cache-control: public, max-age=86400`. A root
`app/opengraph-image.tsx` is **not** used: the file convention would be inherited by every child route without its own
image (`/how`, `/settings`, `/tools`...).

**Acceptance criteria.**
1. (unit, source) `CHORES_3.position` equals the design-system line byte for byte; neither it nor `homeTitle` contains
   `Stock Social`, a digit, `%`, `$`, `every`, `any broker`, `all trades`, `the only`, `complete`, `verified` (case-insensitive; `read-only` is allowed).
2. (unit, source) `app/home-card/route.tsx` renders only `CHORES_3.position` text: no `<img>`, `<svg>`, `fetch(`, font
   file, `Stock Social` or digit literal besides sizes; size is 1200x630. No `app/opengraph-image.*` or
   `app/twitter-image.*` exists.
3. (e2e) `GET /` head has `og:title` = homeTitle, `og:description` and `meta[name=description]` = position,
   `og:image` absolute ending `/home-card`, `twitter:card` = `summary_large_image`; `<title>` is `Stock Social`.
4. (e2e) `GET /home-card` → 200 `image/png`, 1200x630 (PNG header). On `/how` and `/u/<demo>` the description is not
   the positioning line (unchanged from main) and no og:image ends in `/home-card`.
5. (e2e) `/?after=…` still has `robots noindex`.

## 4. K22: billing hygiene tests (test mode only, no product change)

**Behaviour.** Tests only, in `lib/chores-cycle3.test.ts`. LIVE_BILLING, checkout and keys untouched. If a test fails,
the fix is a separate change reviewed on its own, not folded in here.

**Acceptance criteria.**
1. (db, with the in-repo fake billing vendor via `billingDeps.fetch`, as `lib/billing.test.ts:44`) For a subscriber
   with a live row, `portalUrl(id, origin, true)` sends exactly one request, to `/v1/billing_portal/sessions`, with
   `flow_data[type]=subscription_cancel` and that subscription id, and returns the vendor's URL.
2. (unit, source) `app/account/actions.ts#openCancel` calls `portal(true)`, which calls only `currentUser`,
   `portalUrl` and `redirect`: no other import, no `cookies`, no extra route, no `?save`/`offer`/`pause`/`discount`
   token; the Cancel button's `formAction` is `openCancel` (`app/account/page.tsx`). No app page under `app/account/`
   other than `page.tsx`, `export`, `actions.ts`, `activating.tsx`.
3. (unit) Every string (and every function called with sample args) in `BILLING` and `RECORD_TOOLS` matches none of:
   `/more accurate|accuracy|fresher|faster|real[- ]?time|instant|complete|exclusive|premium data|ahead of|first to/i`.
4. (unit, source) No `<s>`, `<s `, `<del`, `<strike`, `line-through` in `app/tools/**`, `app/account/**` or the
   `BILLING`/`RECORD_TOOLS` blocks; no `/\bwas\s*\$|\bwas\s+\d|previously|save\s+\d+\s*%|\d+\s*% off/i` there.
5. (unit, source) Every `$`-amount shown in `app/tools/**` comes from `PLANS` (`lib/billing.ts:20`): no `\$\d` literal
   in those files or the two copy blocks.

## 5. C3-39: Record tools while checkout is closed

**Closed for the viewer** = the rule at `app/tools/page.tsx:59-60`: `!(await checkoutOpen(me.id)) || !billingAvailable()`
(this covers both "billing unavailable" and "launch gate closed for them"). CI's e2e has no billing env, so CI runs the
closed state.

**Behaviour.**
- `/account`, never-subscribed branch only (`a.kind === 'none'`, no subscription row, `app/account/page.tsx:61`), when
  closed: `BILLING.none` stays; the link becomes `<Link className="button secondary" href="/tools">` with text
  `CHORES_3.seeToolsClosed = 'See Record tools (not open yet)'`. The "(not open yet)" is visible text, not
  `aria-disabled` or greyed styling. The page then has no primary-styled control in that state (Download stays
  secondary). When open: the current markup and `BILLING.seeTools` unchanged. Lapsed, confirming, subscriber and trader
  branches unchanged.
- Locked `/tools` (`:69-78`), closed state only (`!billing`): after the existing muted `notOpen`/`unavailable` line,
  add `<p><Link href="/">{CHORES_3.backToFeed}</Link></p>` with `CHORES_3.backToFeed = 'Back to the feed'`. Plain link,
  ≥44 px tap height via the existing `.rt` link style (or an appended CHORES-3 rule if it falls short). The K8/R8
  disclaimer stays. With billing open the Subscribe screen is unchanged, and no new link is added.
- No price, date, "coming soon", waitlist or email field anywhere. `/settings` is not changed by C3-39 (C3-40 is not
  approved).
- Amends F-3 plan `docs/features/logs/F-3/plan.md:142` and §1 entry points in the closed state only: the engineer adds a
  dated decision line there citing this plan; the **business lead signs it off** before merge.

**Acceptance criteria.**
1. (e2e, 360 px, closed) A never-subscribed account on `/account` sees a link named exactly "See Record tools (not open
   yet)" with class `secondary`, and no element styled as a primary button (computed background ≠ `--accent`) in
   `main`; no horizontal scroll.
2. (e2e, closed) Signed in and signed out, locked `/tools` shows exactly one link in `main` besides the disclaimer's legal
   links, named "Back to the feed", `href="/"`; keyboard: Tab reaches it, Enter lands on `/`; its box is ≥44 px tall.
3. (unit, source) Neither new string nor the closed-state markup contains a digit, `$`, `soon`, `waitlist`, `notify`,
   `email` or `<input`.
4. (e2e) `e2e/f3-billing.spec.ts` is unchanged (`git diff --exit-code` on it in CI review) and passes where it ran
   before; with the fake billing vendor env and an allowlisted account, `/account` shows `See Record tools` as the
   current primary and `/tools` shows no "Back to the feed".
5. (e2e) Axe on `/account` and `/tools` in the closed state: no violations at AA.

## Compliance (COMPLIANCE §1)
1 Performance: no (no figures; K20 image carries none). 2 Personal data: C3-34 logs a route name and a count only; the
health body holds no ids, handles or counts of users; C3-44 reads existing rows, stores nothing. 3 Money: no price,
checkout or charge changes; K22 is tests only. 4 Comms/tracking: none. 5 User text: none. 6 Accounts: none.
7 Vendors/deps/fonts: none; next/og's bundled default font. 8 A11y: §5 criteria 2 and 5, visible "(not open yet)".
9 Security: new public endpoint (health), body minimal, details behind the cron bearer, constant-time compare, no token
in logs; 401 line rate-limited. 10 Claims: positioning line checked against completeness words. 11 Checkout: no.
Nothing here needs the owner or counsel; the only external sign-off is the business lead's on §5.

## Open questions (with my recommendation)
1. Stalest trader sync in `status`? **Recommend: details only** (24 h backoff/quarantine is legitimate).
2. Health on a wrong bearer: log? **Recommend: no** (public endpoint; would let anyone fill the log).
3. 401 window: **recommend 60 s per route per instance**, with a `suppressed` count on the next line.
4. "Through `logSafe`": the 401 line has no error object; **recommend** literal + `JSON.stringify({route, suppressed})`
   (already allowed by `lib/privacy-logs.test.ts`), and `logSafe` for the health and notes-gate query errors.
5. Health HTTP status when degraded: **recommend 200** (body carries the state); 503 is the alternative if the owner's
   monitor reads status codes only.
6. og:title: **recommend the first sentence** ("Closed trades imported read-only from connected broker accounts.");
   whole line as description; no name. `<title>` stays "Stock Social".
7. Image route: **recommend `app/home-card/route.tsx`**, referenced only from `app/page.tsx`; not a root
   `opengraph-image.tsx` (inherited by every child route).
8. C3-39 /account style: **recommend `button secondary` with "(not open yet)" in the text** (orchestrator's lean); the
   designer ballot preferred muted plain text, also acceptable if the business lead prefers it.
9. Locked /tools link copy: **recommend "Back to the feed" → `/`**.
