# Chores cycle 3: QA log (tester)

Date: 2026-11-01 · Branch `claude/chores-cycle3` · Production build on :3000, `ALLOW_DEV_AUTH=1`, seeded demo data, no
billing env (checkout "not available right now"). Viewport 360x740. Plan: `plan.md` (Round 2 overrides §1-§5).

## Runs

- `node --test lib/chores-cycle3.test.ts`: 17/17 pass.
- `npx playwright test e2e/chores-cycle3.spec.ts e2e/f3-billing.spec.ts --reporter=line`: 13 passed, 3 skipped (the
  fake-billing-vendor tests, which need the server started with the billing env; expected here and in CI).

## Criteria

| Criterion | How checked | Result |
|---|---|---|
| C3-34 public body | `curl /api/health` with no header, `Bearer wrong`, `Bearer ` (empty) | pass: `{"status":"ok"}`, 200, `cache-control: no-store` each time |
| C3-34 bearer details | `curl` with `Bearer $CRON_SECRET` | pass: six keys in plan order (`status, db, lastRunAt, lastRunAgeHours, stalestSyncAgeHours, thresholdHours:1`), ISO time, hours only; no handle, id, `@`, `$`, `%` |
| C3-34 degraded = 503 (R2 §6) | unit test (thrown query → 503, public body, `db:false` with bearer); not forced live (would touch shared `sync_shards`) | pass (unit) |
| C3-34 threshold = `ROUND_MS`, stalest details only | read `lib/health.ts`; unit `healthStatus` cases | pass; see note N2 on the `3_600_000` literal |
| C3-34 non-GET | `POST /api/health` | 405 |
| C3-34 401 unchanged | `POST /api/sync`, `/api/billing/reconcile` with wrong, empty and missing bearer | pass: 401 `{"error":"unauthorized"}` |
| C3-34 one line per route per minute | 5+1+2 wrong calls to sync, 5+2 to reconcile in one window, then one more of each after 60 s; read `server.log` | pass: one line per route per window; next window `{"route":"sync","suppressed":8}` and `{"route":"billing-reconcile","suppressed":7}`, matching the counts sent |
| C3-34 no secret, header or IP in log | requests carried `Bearer s3cr3t-XYZ`, `X-Forwarded-For: 203.0.113.9`; grep of `server.log` for `s3cr3t|XYZ|bearer|203.0|forwarded|authorization` | pass: 0 matches |
| C3-34 exact line (R2 §7) | `server.log` | **fail**: prints `cron unauthorized s status 401 …`, not `CronUnauthorized` (D1) |
| C3-34 health wrong bearer not logged | `Bearer nope` on health, then `server.log` | pass: no line |
| C3-44 fresh account | new dev user, `/settings` | pass: notes line absent |
| C3-44 with a record | inserted one `closed_trades` row for my own user id, `/settings` | pass: line shown word for word; removed the row → line gone again |
| C3-44 confirm view | `/settings?confirm=1` with the trade row | pass: neither line |
| C3-44 demo trader, connection alone, fail-open | e2e + unit (`lib/delete.ts#notesLineApplies`) | pass |
| K20 home head | `curl /` | pass: `<title>Stock Social`, description = whole line + demo sentence, og/twitter title = first sentence, og/twitter description = `Losses included. Demo records are marked Demo.` (does not start with the title), og:image absolute `http://localhost:3000/home-card`, `summary_large_image` |
| K20 `/?after=abc` | `curl` | pass: preview plus `robots noindex` |
| K20 other routes unchanged | `/how`, `/u/momentum_maya` | pass: own descriptions, no `/home-card` image |
| K20 `/home-card` | `curl` + looked at the PNG | pass: 200 `image/png`, 1200x630, `public, max-age=3600`; white text on `#0b0b0f`, line + demo sentence, no name, logo, figure or chart |
| K20 360 px unfurl (R2 §10) | mocked a chat unfurl at 360 px from the live card and tags | pass: card readable at 328 px wide; title then description, no repeat between title and description (N3) |
| K22 | unit tests | pass |
| C3-39 `/account` never-subscribed (unavailable state) | 360 px, computed styles | pass: `See Record tools (not available right now)`, class `button secondary`, white bg / `#111118` text (~19:1), border `#7c818b` (~3.9:1), 68 px tall (wraps to 2 lines), no accent-background control, no horizontal scroll |
| C3-39 `/account` closed (`not open yet`) and billing-open states | unit test of `checkoutFor` + source; not reachable without the billing env | pass (unit only) |
| C3-39 locked `/tools` signed in and out | 360 px | pass: only link in `main` besides the disclaimer's Terms/Privacy/How is `Back to the feed` → `/`, 44 px tall; Tab reaches it (9th stop) with a 2 px accent outline; Enter lands on `/`; no horizontal scroll |
| C3-39 copy | no digit, `$`, soon, waitlist, notify, email, input | pass |
| Signed-out `/account` | Playwright | pass: redirects to `/login` |
| Home at 360 px | horizontal scroll check | pass |

## Defects

- **D1 · bug · low.** In the production build the 401 line reads `cron unauthorized s status 401 {"route":"sync",…}`:
  `logSafe` prints `e.constructor.name` (`lib/privacy-log.ts:11`) and the minifier renames the `CronUnauthorized` class
  (`lib/cron-auth.ts:18`) to `s`. Round 2 §7 requires `CronUnauthorized status 401`. The unit test passes only because
  tests run unminified. Repro: `POST /api/sync` with a wrong bearer on `npm run start`, read the server log. No
  privacy impact. Possible fix: give the class a fixed name, e.g. `Object.defineProperty(CronUnauthorized, 'name', { value: 'CronUnauthorized' })`.

## Notes (do not block)

- N1. The cron routes keep their inline `timingSafeEqual` check rather than calling `cronAuthorized` (plan §1 AC3).
  The committee recorded this as D13 because `lib/sync-route.test.ts:23` pins the inline check. Accepted.
- N2. `lib/health.ts:11` has `HOUR_MS = 3_600_000`, which §1 AC3's grep wording forbids. Here it converts units; it is
  not the threshold (that is `ROUND_MS`). Spec wording only.
- N3. The card image repeats the og:title sentence under it in a chat unfurl, because the plan puts the whole line on
  the image. This is by design.
- N4. The server log carries a Next `metadataBase is not set` warning from another route's metadata (not `/`, which
  now sets `metadataBase`). Not checked against main.

## Cleanup

Deleted the test user `qa_c3_*` (id 2085) and its inserted `closed_trades` row (`sell_id 'qa-c3-2085'`). Verified 0
rows remain.
