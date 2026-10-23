# F-1 · PR-2b build log · Engineer

Date: 2026-10-23. Branch `claude/adoring-euler-4469ys` (equal to main after PR-2a). Built from `plan.md` §1 (PR-2b),
§2 (S2, S3, S5, S6 expired, S7a, S7b), §8 (round-2 changes 1–3) and the items carried from PR-2a's committee, review and
tester logs. No decision in `docs/features/F-1-broker-connection.md` changed. No new dependency (pre-authorization #5 has
no answer): the embedded portal is an in-repo iframe plus a message listener. `package.json` and `lib/broker.ts` are
untouched: minting the portal URL needed no change there. Nothing committed or pushed.

## What PR-2b delivers

- **S2 primary → S3 embedded portal** (`app/connect/portal-button.tsx`). The primary is still a link to `/connect/start`
  (the redirect flow). It navigates as before without script, in an in-app browser (an Android WebView `wv` token, or an
  iOS-style WebKit view with no browser token after `Mobile/<build>`), and for a site installed to the home screen
  (standalone). Everywhere else a click opens a native modal `<dialog>`:
  - It is labelled "Connect your brokerage". The page behind it is inert. Focus moves to Close, and Tab and Shift+Tab wrap
    inside the dialog.
  - The primary reads "Opening…" with `aria-busy` and `aria-disabled`. The dialog body is `aria-busy` until the frame
    loads. At 3 s it shows "Opening… Taking longer than usual.".
  - "Open in a new page instead" is a persistent footer link from the moment the dialog opens until success. If the portal
    is still loading at 8 s, the link is promoted to a button. It goes to `/connect/start`, the same attempt.
  - Escape or Close before the frame loads closes the dialog and returns focus to the primary, with its label restored.
    After the frame loads, closing means "closed without a link" and goes to `/connect/done?m=embedded`, which shows
    consent if a link did happen and S7a otherwise.
  - Messages count only when they come from the minted URL's origin and from the portal's own frame (`event.source`).
    SUCCESS, CLOSED / CLOSE_MODAL and ABANDONED go to `/connect/done?m=embedded`. ERROR (the vendor portal reports a
    blocked broker popup this way) falls back to the redirect flow on the same attempt.
  - The frame is sandboxed with scripts, same-origin, forms and popups allowed. Top navigation is not allowed.
- **Portal URL minting** (`app/connect/portal/route.ts`, `POST`). It works for the session user or for the attempt bound
  to this browser by the signed cookie, through the same `startConnection` as `/connect/start`, with `mode: 'embedded'`.
  - It returns `{url, origin}` with `no-store`. The origin comes from `lib/portal.ts#portalOrigin`: https only, and
    loopback http only while the test fake is configured.
  - An unbound request gets 401. A non-https vendor URL gets 502, and the browser then falls back to the redirect.
- **The lured-portal case** (carried from PR-2a fix round 4). The modal frames only what that endpoint mints for the
  bound user or attempt. Nothing from a query string, body or referrer is ever read as a URL, a postMessage can only
  select between two fixed same-origin paths, and the frame cannot navigate the top window.
  - A portal session an attacker opened can therefore never appear inside the app.
  - A victim who visits the attacker's raw vendor URL directly is outside the app's reach. That residual is unchanged and
    belongs to the vendor.
- **Portal mode is recorded.** `startConnection(…, mode)` sends `portal_opened {mode}` to the funnel.
  `completeLink(…, mode)` writes `connections.portal_mode`, `'embedded'` when `/connect/done` gets `m=embedded`. The
  default stays `redirect`, so every PR-2a caller and test is unchanged. This gives plan §5's "share of redirect opens".
- **S5 live banner** (`app/u/[handle]/import-banner.tsx`, with the state machine in `lib/import-banner.ts`).
  - Only the owner's open tab polls `POST /api/import/step`, every 2 s; each poll also advances the import. Visitors see
    the server's line.
  - The status line (`role="status"`, `aria-live="polite"`, "Importing your record · N closed trades so far") is
    committed at most once per 5 s. A change inside that window waits, and the latest value goes out when the window
    ends. Each commit runs `router.refresh()`, so the list under the banner matches the count.
  - A second line, "N trades imported from your broker" (distinct `activities` rows, returned as `read` by the step
    endpoint), is not a live region. It updates after every step.
  - After 60 s with no new rows the owner sees "Your broker is still sending history. You can leave; the import
    continues." in its own polite region.
  - At the end, "Import finished." replaces the status line as one static line, set apart by an accent rule and weight,
    with no motion. It stays until the next navigation, because the component is rendered in every state, so the refresh
    keeps its state.
  - A failed import hides the banner and refreshes, so the profile's own failed line shows.
  - Every line keeps a fixed box, and the badge line under the name reserves one line. The e2e measures the banner's box
    as unchanged from importing to finished.
- **S7a** has three actions: "Try again" (`/connect`), **"Continue in a new page"** (`/connect/start`, the same attempt)
  and "Not now". **S7b** (failed or stale) keeps `role="alert"`, focus on the heading and "Try again"; the portal's own
  errors fall back to the redirect instead of ending there (see deviation 1).
- **S6 expired** has a short heading ("The time to decide ran out.") and the rest as body text, read through
  `aria-describedby` like S6b.
- **Carried items:**
  1. The profile unfurl for a record with no closes has no stats line. `profileDescription` gives the profile's own words:
     connected → the S8 line, none → "No trades yet.", failed → the incomplete line plus "No closed trades yet.".
  2. The Demo badge is muted text on `--surface` with a hairline: 5.35:1 dark and 5.25:1 light, up from 4.45 and 4.18.
  3. "Too early to tell" is said once, in the evidence line. The slot under avg return shows only a real range.
  4. "Connected:" names the institutions the vendor returned for real accounts of consented connections
     (`recordInstitutions`). With none it says "your broker"; it never shows the placeholder "broker".
  5. The lured-portal case, described above.

## Files

New: `lib/portal.ts`, `lib/import-banner.ts`, `app/connect/portal-button.tsx`, `app/connect/portal/route.ts`,
`app/u/[handle]/import-banner.tsx`, `lib/portal.test.ts`, `lib/import-banner.test.ts`, `lib/badge-contrast.test.ts`.
Changed: `lib/connections.ts` (`mode` on `startConnection` and `completeLink`; `importedRows`; `recordInstitutions`),
`lib/copy.ts` (`PORTAL`, `RESULT.continueNewPage`, `RECORD_BODY.imported` / `stillSending`, `connectedLine`,
`profileDescription`; `PORTAL` added to the banned-list walk), `app/connect/page.tsx`, `app/connect/done/route.ts`,
`app/connect/start/route.ts` (comment), `app/connect/result/page.tsx`, `app/api/import/step/route.ts` (adds `read`),
`app/u/[handle]/page.tsx`, `app/globals.css`, `e2e/fakes/vendor.ts`, `e2e/connect.spec.ts`, `lib/copy.test.ts`,
`lib/connections.test.ts`.

Product diff (app and lib, without tests): about 456 added and 35 removed, under the 800 cap.

## Tests added (unit 419 → 434; e2e 70 → 78)

| Test | Covers |
|---|---|
| `lib/portal.test.ts` (5) | The four events in both message formats; any other origin, a missing expected origin and unknown shapes ignored; an odd or long id dropped. The minted URL is https only, loopback only for the fake, with no credentials, `javascript:` or `data:`. In-app and standalone go to redirect, ordinary browsers embed. The 3 s and 8 s timings. |
| `lib/import-banner.test.ts` (7) | Poll 2 s, announce 5 s, 60 s. Only importing shows. The imported count changes at once while the status line is throttled and the latest value wins. "Import finished." is throttled, static and never reverts. The server can report the end first. Failed hides the banner and refreshes. The 60 s line appears for the owner only and a new row clears it. |
| `lib/copy.test.ts` (+1; the banned-list walk now includes `PORTAL`) | S3, S5, S6 and S7a strings verbatim. `connectedLine` never says "broker". `profileDescription` has no stats line at 0 closes in any state. |
| `lib/badge-contrast.test.ts` (1) | The Demo badge's colour and background tokens from `globals.css`, both schemes, at least 4.5:1 (it failed before the CSS change). |
| `lib/connections.test.ts` (+1 DB) | `portal_opened` modes embedded then redirect; `portal_mode` embedded or redirect per link. `importedRows` counts distinct rows across two links. `recordInstitutions` returns nothing before consent, real accounts in link order, never a simulated account's institution. |
| `e2e/connect.spec.ts` (+8) | (1) S2 → S3 → S4 embedded: dialog name, "Opening…" and `aria-busy`, focus on Close. The frame `src` equals the URL minted for this trader's vendor user even with a lure in the query and referrer, and the endpoint ignores a `?url=`. A SUCCESS posted from another origin is ignored. Consent lands with `portal_mode` embedded. (2) Keyboard only: Tab to the primary, Enter, focus on Close. Escape while loading returns focus. Loaded, 8 Tabs never leave the dialog and visit Close, the frame and the link; Shift+Tab wraps. Escape after load goes to S7a with focus on its heading and three 44 px actions, and "Continue in a new page" completes by keyboard (modes embedded, embedded, redirect). (3) Loading with the page clock: 3 s line, 8 s promotion, the link completes by redirect. (4) **Popup blocked**: `window.open` returns null in every frame, the portal reports ERROR, the app redirects and the trader completes (`portal_mode` redirect). (5) **In-app user agent** (WebView): no dialog, straight to the vendor, completes. (6) **S5 live**, no test-driven steps: the imported line goes 0 → 4 → 8 → 12. There is one status element, polite, with status changes at least 4.9 s apart. "Import finished." has its distinct class, the banner box is unchanged and the stats arrive in place. "Too early to tell" appears exactly once and "Connected: Fake Brokerage (3 accounts)" shows. After a reload, and for a visitor, there is no banner. (7) **60 s line** with the page clock (vendor sync unfinished): shown to the owner in its reserved box, never to a visitor. (8) **Carried**: the Demo badge's rendered contrast is at least 4.5:1 in both schemes, and a connected record with no closes unfurls as "No closed trades yet. Your record starts with your first close." |

Light and dark screenshots at 375 px are written by the walk (in the test output folders): `s2-notice`,
`s3-portal`, `s3-loading-slow`, `s4-consent`, `s5-importing`, `s5-finished`, `s5-still-sending`, `s7a-abandoned`,
`s8-empty-record`.

The fake vendor's portal page now behaves like the vendor's. Opened as a page it links and redirects, as before. Framed,
it opens the broker login in a popup: a null popup posts `{status:'ERROR', errorCode:'POPUP_BLOCKED'}`, otherwise it links
and posts `{status:'SUCCESS', authorizationId}`. Cancel posts `'CLOSED'`. `portalDelayMs` in `/_scenario` holds the page,
for the loading tests.

## Existing tests touched (no assertion dropped or loosened)

- `connectThrough` and the two inline primary clicks (the four-tap committee test and the retry test) now complete
  through the embedded dialog, because the primary no longer navigates. Each still asserts that the vendor's portal URL
  was reached (`iframe src ^vendor/portal` instead of the page URL) before its "Connect". The redirect flow keeps its own
  coverage through `/connect/start` in the existing tests and through the new fallback tests.
- The expired-heading assertion follows the split: heading "The time to decide ran out." and body "Import not started.
  Nothing is connected.", both asserted.
- `beforeEach` (harness only): for the tests written before PR-2b, the page's own background poll of `/api/import/step`
  is aborted with `context.route`. Those tests drive steps through `page.request` (not intercepted) and assert each
  step's exact effect: a forced 5xx consumed by the test's own call, backoff windows, "account 1 of 3". A concurrent poll
  from the open tab would race them. Every PR-2b test runs with the live poll.

## Commands run

| Command | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm test` (`DATABASE_URL=postgres://stock_social:stock_social@localhost:5432/stock_social`, Postgres 16), three runs | 434 pass, 0 fail, 0 skipped, each run |
| `CI=1 npm run build < /dev/null` | compiles and generates all routes, including the new `/connect/portal` (fresh `.next/BUILD_ID`), then exits 1 on the framework's own security advisory (`SecurityFatalError`), as on main. Nothing upgraded; the advisory is the owner's dependency bump |
| `npm run test:e2e` (`CI=1`, `SNAPTRADE_BASE_URL=http://127.0.0.1:4102`, `SNAPTRADE_CLIENT_ID=e2e`, `SNAPTRADE_CONSUMER_KEY=e2e`; fakes started by the specs) | 78 passed, 3 skipped (the two OIDC provider tests and the email-send-failure test in `signin.spec.ts`, whose fakes' variables were unset, as in the PR-2a review) |
| `npx playwright test e2e/connect.spec.ts`, two more runs | 24 passed, 24 passed |
| `node scripts/compliance.ts diff origin/main` | only the existing `node_modules/@img/sharp-wasm32` license line (`package.json` and lockfile unchanged) |
| `node scripts/autopilot.ts guard main` | `guard: ok` |

Seen during e2e, not from this diff: each tick logs `connection cleanup failed 4632`. That row is an `expired` connection
left in the local database by a test run on 2026-10-21, whose vendor user does not exist in a freshly started fake, so
every tick's cleanup retries it.

## Not done, or done differently, and why

1. **A portal ERROR falls back to the redirect instead of showing S7b.** Plan §2 S3 says both "automatic redirect … on
   any portal error event" and "error → S7b". The broker popup runs inside the vendor's frame, so a blocked popup is
   visible to the app only as the portal's error event (engineer round 1). Showing S7b there would strand exactly the
   browsers the fallback exists for. A genuine broker error in the redirect flow returns with no link and lands on S7a,
   and S7b stays the import-failure screen (failed or stale), as PR-2a built it.
2. **The banner count stays "closed trades so far"**, matching the list under it (PR-2a fix round 4). "Counts update
   after each step" comes from the new imported-rows line, not from rebuilding `closed_trades` per step.
   - A per-step or per-account rebuild would publish partial FIFO results mid-account.
   - It would also break PR-2a's tested rules: a failed import publishes nothing (D5), and a 5xx mid-step leaves
     `closed_trades` untouched.
   - The closed count still moves at each rebuild, and the list refreshes with it.
3. **Visitors' banner does not poll.** The step endpoint is owner-only and advances the import, and a public status
   endpoint would be new surface for little gain. Visitors see the line as of their page load.
4. **The 8 s rule promotes the link instead of revealing it**, because UX demand 1 makes the link visible from the first
   moment. At 8 s of loading it becomes a full-width button.
5. **In-app detection is a generic heuristic** (no app names, POLICY T1). A browser it misreads still has the persistent
   link and the error fallback.
6. **The 60 s line is the owner's only**: it tells the trader they can leave.
7. **Owner check on the preview** (UX lead round-1 demand 4): the real portal with popups blocked can only be checked on
   a preview with real test credentials (requests #4 and #9). The fake covers the same protocol.

## Compliance checklist (docs/COMPLIANCE.md §1)

1. **Performance shown?** No new performance surface. The banner shows counts only. The empty record's unfurl drops the
   empty stats line. The disclaimer footer is unchanged on every page.
2. **Personal data?** None new. `portal_mode` and the funnel `mode` are enums. The institution name shown is the vendor's
   label for a consented real account, already stored on the connection row and never in funnel events. Nothing from a
   pending, declined or expired link is shown.
3. **Money?** No.
4. **Email, SMS or tracking?** None.
5. **User text?** None.
6. **Sign-up, age or identity?** Unchanged. The portal endpoint serves only a session user or an attested, bound
   attempt.
7. **Vendor, dependency or asset?** No dependency; the protocol is in-repo. The vendor's portal is framed only from the
   URL its API returned to the server.
8. **Screen reader and keyboard?** The dialog is labelled, inert behind, traps focus and returns it. There is
   `aria-busy` while loading, one throttled polite status line, a separate polite 60 s line, focus on the S6/S7 headings,
   44 px controls and no motion. The Demo badge is at least 4.5:1 in both schemes. All of this is tested.
9. **Security posture?**
   - The frame's URL comes from the server only, and its origin is pinned per open.
   - A message counts only from that origin and that frame, and only picks between two fixed same-origin paths.
   - The frame is sandboxed with no top navigation, and the endpoint returns `no-store`.
   - A lure in the query or referrer is ignored (e2e). The step endpoint stays session-only.
10. **Claims in copy?** Every new string is in `lib/copy.ts` and passes the banned, marks, minors and promo lists. No
    "Verified" change.
11. **Checkout?** No.

Owner note (tool output, not acted on): the build reports a framework security advisory and recommends an upgrade. This
needs the owner's dependency bump.
