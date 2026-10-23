# F-1 PR-2b fix round 2: committee fixes (engineer)

Date: 2026-10-23. Branch `claude/adoring-euler-4469ys`, from `da4a69d` (committee: compliance PASS from all three;
business lead DEMANDS 1–5, UX lead DEMANDS 1–2, engineer one Medium, three Lows, one Info). Compliance passed, so no
plan step; this fix plan comes before the code. Every item gets a test that fails before the change.

## Committee fix plan

### Portal dialog (business lead 1, UX lead 1 and 2, engineer walk notes)

1. **Decide the framing on the server.** `POST /connect/portal` mints the URL, then probes it from the server
   (`lib/portal-probe.ts`): one `HEAD` with no credentials, 1.5 s timeout, result cached per vendor origin for an hour
   (a failed or timed-out probe is cached for 5 minutes and means "embedded"; the client fallback stays). A pure
   `framingAllowed(headers, appOrigin, portalOrigin)` in `lib/portal.ts` reads `X-Frame-Options` (DENY, SAMEORIGIN)
   and `Content-Security-Policy: frame-ancestors` (which wins when present; every policy must allow). Refused →
   `{ mode: 'redirect' }`, recorded as `portal_opened {mode: 'redirect'}`, and the client navigates to the minted URL
   (origin re-checked) without opening the dialog. The dialog now opens when the answer is `embedded`, or after a 1 s
   grace while the mint is still running, so the before-load rules still have a dialog to live in.
   - Fake: scenario `portalFrameHeaders` serves the portal with `X-Frame-Options: DENY` and
     `frame-ancestors 'none'` on every request (HEAD too), on a separate origin (`localhost` instead of `127.0.0.1`)
     so its cached probe result never leaks into other tests. The existing `portalFrameBlocked` now sends its header on
     GET only, the "refusal that slipped past the probe".
   - Tests: unit (header parsing, cache, timeout → embedded); e2e (dialog never opens, redirect completes, mode
     recorded as redirect).
2. **No false alarm over a loaded portal.** `portalView` returns `{ line, control }`.
   - Before load, as before: "Opening…", the 3 s line, at 8 s the link becomes the filled primary.
   - After load, never the slow line and never the filled primary: a control promoted before load becomes the
     secondary button.
   - After 8 s of silence post-load, or a frame error: the footer reads "Page blank? Open it in a new page." beside
     the secondary 44 px "Open in a new page instead". A refused frame that slipped past the probe gets the same.
   - Tests: unit; e2e with a fake portal loaded and idle for 15 s (no slow line, no filled control). The blocked popup
     and refused frame tests still reach consent.
3. **No live region under `aria-busy`.** `aria-busy` moves from `.portal-body` to the iframe. E2e: no `[role=status]`
   in the dialog has an `[aria-busy="true"]` ancestor, while loading and after.
4. **One exit, a calm button behind, an explained fallback.**
   - The primary behind the dialog reads "Opening…" (`aria-busy`) only while the mint runs; its label is restored when
     the dialog opens.
   - The dialog's only app control that leaves is Close (the new-page link continues rather than exits); e2e counts it.
   - A portal ERROR (the blocked popup) goes to a new fixed path `/connect/continue`: one line, "Your browser blocked
     the embedded window; continuing on the vendor's page.", a Continue link to `/connect/start`, and an automatic
     continue after 2 s (the link works without script). E2e on the popup-blocked test.

### Banner and copy (business lead 2–5)

5. **One noun per count.** `RECORD_BODY.imported(n)` → "N activities imported" (one activity); the status line keeps
   "N closed trades so far". Unit: no S5 activity string matches `/trade/`.
6. **Visitors are not "you".** `RECORD_BODY.banner(closes, owner)`: "Importing your record · …" for the owner only,
   "Importing this record · …" for visitors and in `og:description` (`profileDescription`). Visitors get no
   activities line. Tests: unit for both; e2e on the visitor page and the meta tags.
7. **One finish announcement.** On finish the banner drops its other lines; the status element (the same live region)
   reads "Import finished." once, as a one-line note, for 5 s (or until navigation), then the banner is removed. While
   "Your record is live." shows, the note is visually hidden (still announced), so exactly one of the two is seen.
   No reserved empty box. Tests: unit for the state machine; e2e for the announcement, the 5 s removal and no empty box.
8. **Button off the edge.** The dialog footer gets 16 px padding. E2e: the control's box is at least 12 px inside
   the dialog's left, right and bottom edges, both before and after load.

### Security (engineer)

9. **Medium: parallel first mints.** New `mintPortal` in `lib/connections.ts` (used by `startConnection`, so both
   routes) takes a transaction-scoped advisory lock (the per-user `USER_LOCK` for a user, a new `ATTEMPT_LOCK` for a
   brokerage-first attempt), re-reads the stored vendor user, and registers only when none exists. The store is
   conditional (`where snaptrade_user_id is null`); if a writer outside the lock still won, the new vendor user is
   deleted at the vendor and the stored one is used. Everything inside the lock uses the transaction's connection
   (no second pool connection, so no pool deadlock). DB tests: 6 concurrent first mints register once; a forced race
   deletes the extra and keeps the stored one.
10. **Lows and Info.**
    - Anti-framing: `next.config.ts` sends `Content-Security-Policy: frame-ancestors 'none'` and
      `X-Frame-Options: DENY` on every path. E2e checks pages, the profile, the connect pages and an API response.
    - Mint rate limit: at most 10 `portal_opened` per attempt (per user) in 10 minutes, counted under the same lock, so
      parallel calls cannot slip past. Over the limit: `429` JSON from `/connect/portal`, a short `429` page from
      `/connect/start`. The client shows "Too many tries. Wait a few minutes, then try again." DB and e2e tests.
    - Poll rate limit: at most one step per user per second (`lib/rate-limit.ts`, in-process; `429` with
      `Retry-After: 1`). The client keeps its 2 s rhythm and treats a 429 as "nothing new". Unit and e2e tests. The e2e
      `step()` helper honours `Retry-After`, so the older tests that step in a loop keep their assertions.
    - A 401 or 403 stops polling; the banner shows "Signed out in another tab." with a "Sign in again" link. E2e.
    - The step response (every status) carries `cache-control: no-store`. E2e.

## What was built

Each item follows the plan above. Notes where the code differs from the plan or where a test changed:

1. **Server-side framing decision.**
   - New files: `lib/portal-probe.ts` and `framingAllowed` in `lib/portal.ts`.
   - `POST /connect/portal` answers `{ url, origin, mode }`.
   - `app/connect/portal-button.tsx` now asks first and opens the dialog second. On `redirect` it calls
     `location.assign` on the minted URL, only if that URL's origin equals the origin the server vouched for; otherwise
     it uses `/connect/start`. The dialog opens on `embedded`, or after a 1 s grace while the mint is still running.
     The 3 s and 8 s timers count from the tap.
   - The probe uses an explicit timer rather than `AbortSignal.timeout`, whose unref'd timer let a hung fetch outlive
     its test.
2. **Quiet loaded state.** `portalView` now returns `{ line, control }`, rendered as `data-control` on the footer
   link.
   - Superseded fix-round-1 rule: "a button promoted while loading stays one after load (no flicker)". Business lead 1
     forbids a filled primary after load, so that control now becomes the secondary button. The unit test was
     rewritten to the new rule and checks more cases than before.
   - The dialog body is a flex column, so the frame shrinks and the footer, even with the extra line, stays inside the
     dialog at 375×667. Before this, the control's bottom sat 4.6 px below the dialog's edge (caught by the new e2e).
3. **`aria-busy`** is now on the iframe only.
4. **Behind the dialog and the fallback.**
   - The primary's "Opening…" now shows only during the mint.
   - ERROR goes to the fixed path `/connect/continue` (`PORTAL_CONTINUE`), and from there to `/connect/start`. The G5
     unit and e2e tests assert this extra fixed hop. No message content is ever used as a URL.
5. **Count wording.** "N activities imported" / "1 activity imported".
6. **Visitors.** `RECORD_BODY.banner(closes, owner)`; `og:description` uses `owner=false`. Visitors get no activities
   line.
7. **Finish.** `FINISHED_MS = 5_000`.
   - On finish the banner keeps only its status element (the same live region), then is removed.
   - `quiet` (the share prompt is showing) makes the note `sr-only`. It is sticky, because the prompt's own
     "mark seen" server action refreshes the route and the next render no longer reports it.
   - Found by the e2e: `.import-banner .import-finished` outranked `.sr-only`, which left a 12 px accent sliver
     visible. A specific reset fixes it.
   - The old e2e expectation "banner box unchanged at finish" is replaced by the acceptance criterion: no leftover
     boxes, and gone within 5 s.
8. **Footer padding** is 8/16/16 px. The e2e measures at least 12 px from the dialog's left, right and bottom edges,
   before load (primary) and after (secondary).
9. **Locked registration.** `mintPortal` and `ensureBrokerUser` in `lib/connections.ts`; `startConnection` wraps them.
   The funnel row is written with the transaction's own connection.
10. **Hardening.** `next.config.ts` (new) sets the anti-framing headers. The mint limit is `MINT_MAX = 10` per
    `MINT_WINDOW_MIN = 10`, counted from `portal_opened` rows, so no schema change. `lib/rate-limit.ts` limits polling.
    The banner handles 401/403 with `onUnauthorized`. The step route is `no-store` on every status.
    - The e2e `step()` helper honours `Retry-After` on 429. No assertion on a step's effect changed.

### Tests (unit 438 → 448; e2e connect spec 29 → 34, whole suite 91)

| Test | Covers |
|---|---|
| `lib/portal.test.ts` (+2, 1 rewritten) | `portalView` rules: before load unchanged; after load never `opening-slow` or `primary`; quiet line plus secondary after 8 s or on error; handshake clears it. `framingAllowed`: XFO DENY and SAMEORIGIN; CSP `'none'`, `'self'`, `*`, scheme, host, wildcard and port sources; CSP wins over XFO; two policies must both allow. Probe: HEAD, `credentials: 'omit'`, has a signal, cached 1 h per origin, a failure means embedded and is retried after 5 min, a real hang is aborted. |
| `lib/copy.test.ts` (+1) | No activity string says "trade"; "your" only for the owner; the preview reads "Importing this record"; new strings are in the banned-list walk. |
| `lib/import-banner.test.ts` (+3) | Finish is announced once and the banner is gone 5 s after it went out, with no refresh and nothing coming back. Owner and visitor wording. 401 stops polling for good and hides the 60 s line. |
| `lib/rate-limit.test.ts` (+2, new) | Minimum interval per key, independent keys, bounded map. The step route's 429, Retry-After, 401 and no-store. |
| `lib/connections.test.ts` (+2 DB) | Six parallel first mints (both routes) register one vendor user, for a trader and for a brokerage-first attempt. A writer outside the lock that wins gets the loser deleted at the vendor, and the stored user is used. Rate limit: 14 parallel calls stop at 10 total with `RateLimitedError`; the window frees after 10 min; the recorded mode is the probe's. |
| e2e (+5) | (1) Refusing headers: `mode: 'redirect'`, `showModal` never called, the minted page completes to consent, modes `[redirect, redirect]`, every probe is a HEAD without cookies. (2) Before load: 3 s/8 s rules, status never under `aria-busy`, frame `aria-busy=true`, primary label restored, filled control 12 px inside. Loaded and idle 15 s with a click at 2 s: never the slow line or a filled control, then the quiet line and a 44 px secondary 12 px inside, Close the only app button, still completes. (3) CSP and XFO on `/`, `/login`, `/connect`, `/connect/continue`, a profile, `/how` and the step API; a foreign page framing `/connect` shows nothing of it. (4) Step: 401 no-store signed out, one of two parallel steps 429 with `Retry-After: 1`, all no-store. Mints: 10 then 429 from both routes, and S2 shows the line with no dialog. (5) Clearing cookies mid-import shows "Signed out in another tab. Sign in again" (`/login`); the last answer is 401 and no polls follow in 6 s. |
| e2e (changed to the demands) | S2→S3: label restored, `aria-busy` on the frame, `mode: 'embedded'`. Popup blocked: `/connect/continue` line, then the vendor, then consent. Frame refused past the probe: quiet line plus secondary. G5 via `/connect/continue`. S5: "activities", no leftover boxes, exactly one of note and "Your record is live." drawn, banner gone within 8 s. Visitors: "Importing this record" in the banner, `description` and `og:description`, with no "your" in the banner. |

Screenshots (375 px, light and dark): `screenshots/pr2b/fix2/` contains `s3-loaded-idle-15s`,
`s3-popup-blocked-continue`, `s3-frame-refused` and `s5-finished`.

### Commands run

| Command | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm test` (`DATABASE_URL=postgres://stock_social:stock_social@localhost:5432/stock_social`), three final runs | 448 pass, 0 fail, each run. During development one run had a single failure in the pre-existing "expiry with a clock" DB test (it asserts on the global tick's count). It passed alone and in the four full runs after; nothing in this diff touches it. |
| `CI=1 npm run build < /dev/null` | Compiles and lists `/connect/continue` and `/connect/portal`. On alternate runs it then exits 1 on the framework's security advisory (`SecurityFatalError`, recommending an upgrade), as on main. Tool output, not acted on: the upgrade is the owner's dependency decision. |
| `npm run test:e2e` (`CI=1`, `SNAPTRADE_BASE_URL=http://127.0.0.1:4102`, `SNAPTRADE_CLIENT_ID=e2e`, `SNAPTRADE_CONSUMER_KEY=e2e`; fakes started by the specs), two runs | 88 passed, 3 skipped (the OIDC and email-failure tests whose fakes' variables were unset, as before), both runs |
| `node scripts/compliance.ts diff origin/main` | only the existing `@img/sharp-wasm32` license line |
| `node scripts/autopilot.ts guard main` | `guard: ok` |

### Known limits and owner notes

- The poll limit is per server process (`ponytail:` in `lib/rate-limit.ts`). The mint limit and the registration lock
  are in the database and hold across instances.
- The probe sends HEAD to a one-time portal URL at most once per hour per vendor origin and process. Whether the real
  vendor answers HEAD with its framing headers is unverified until the preview check (requests #4 and #9). If it does
  not, the result is "embedded" and the browser fallback remains.
- The build's framework security advisory remains for the owner.
