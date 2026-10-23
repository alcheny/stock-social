# F-1 · PR-2b test log · Tester

Date: 2026-10-23. Branch `claude/adoring-euler-4469ys` at `f37a097`, against `origin/main`. No product code was changed.
Inputs: plan, engineer log, feature file, PR-2a carried items.

## Checks

| Check | Result |
|---|---|
| Schema applied twice, then seed (Postgres 16) | clean |
| `npx tsc --noEmit` | clean |
| `npm test` ×4 | 434 pass, 0 fail, 0 skipped, every run |
| `CI=1 npm run build < /dev/null` | compiles (`/connect/portal` listed, fresh `BUILD_ID`), then exits 1 on the framework advisory, as on main; nothing upgraded |
| `npm run test:e2e` | 78 passed, 3 skipped (unconfigured OIDC and email fakes, as before) |
| `compliance.ts diff origin/main` | only the existing `@img/sharp-wasm32` license line |
| `autopilot.ts guard main` | `guard: ok` |

After e2e I ran 33 scripted probes against my own server and vendor fake; all passed. Screenshots at 375 and 360 px, light and dark, are in `screenshots/pr2b/`.

## Security

- **Frame:** it only ever loads the minted URL for the session user's vendor user. Query and referrer lures are ignored
  (e2e). `/connect/done` with injected `r`, `next` or `url` stays on the app's origin.
- **Messages:**
  - A vendor-origin message from an injected second frame is ignored, so the `event.source` check holds.
  - A message from another origin is ignored (e2e).
  - A forged SUCCESS before the vendor callback leads to S7a and writes no row.
  - Five replayed SUCCESS messages cause one navigation and leave one row.
  - Replaying an old authorization id in a later session writes nothing.
- **Fallback:** an ERROR carrying `redirect`, `url` or `errorCode` set to an outside URL, or the string
  `ERROR:https://…`, always goes to `/connect/start` and then to the minted portal.
- **Portal route:** with no cookie, a forged cookie or a mis-signed cookie it returns 401 `no-store`, and GET gets 405.
  When signed in, a foreign attempt cookie is ignored. The sandbox has no top navigation.

## Edge cases

- **Timers:** the 3 s and 8 s timers pass, in e2e and at both widths.
- **Escape:** Escape during a slow mint (2.5 s) closes the dialog, returns focus and drops the late response, and the
  dialog then reopens normally. Close or Escape after the frame loads leads to S7a with focus on its heading.
- **Fallback paths:**
  - Popup blocked (e2e): falls back to the redirect flow.
  - Android WebView and an iOS-style WebKit view: go to the redirect flow.
  - iOS Safari: stays embedded.
  - No script: the redirect flow completes, recorded as `redirect`.
- **Hidden tab:** polling continues (2 polls in 6 s). That is acceptable, since each poll advances the import.
- **Second link pending:** while the record is connected and a second link is pending, there is no banner and no poll,
  and the institution is not named.
- **Banner:**
  - The 60 s line shows to the owner only, in its own box.
  - "Import finished." is committed once, and the poll then stops.
  - The banner box does not change size.
  - An anonymous visitor and another signed-in trader each made 0 step requests.

## Usability (375 and 360, light and dark, reduced motion)

- **Dialog:** a native modal with a label. Close is 74×45 and the link is 44 tall. There is no horizontal scroll and no
  animations. Focus wraps (e2e) and returns on Escape.
- **Result screens:** S7a has three actions of 44 px or more. S6 expired has a short heading and the body text below
  it. S5 and S8 are readable at 360.
- **Carried items:**
  - The Demo badge contrast is at least 4.5:1 in both schemes.
  - "Too early to tell" appears once.
  - The connected line names both institutions: "Connected: Fake Brokerage, Other Fake Bank (2 accounts)".
  - The empty-record unfurl is "No trades yet." (description, og and twitter), and a connected record with no closes
    gets the S8 line.

## Compliance

- Requests went only to the app and the vendor fake's origins, with no third-party fonts or scripts (§3).
- The only name used is the integrated vendor's.
- Funnel rows hold enums and counts only: 0 match `@`, 7 or more digits, or a test handle. The server log has no
  personal data.
- §9 is covered above. For §10, the portal endpoint is bound and `no-store`.

## Conformance gaps (behaviour verified by hand, no suite test)

G1. The `event.source` check: the only forged-message test fails the origin check first.
G2. The 401 for an unbound `POST /connect/portal`.
G3. A forged SUCCESS before the callback, and replayed messages.
G4. That visitors make no poll requests.
G5. That an ERROR carrying a URL cannot steer the fallback.

Every other PR-2b criterion and carried item (business lead 1–3, UX lead a, c, d, e, the lured portal, the badge) has a
passing test that asserts the plan's wording.

## Defects

1. **Low · usability · an empty modal when the portal frame is refused.**
   - Reproduction: serve the portal document with `Content-Security-Policy: frame-ancestors 'none'`, then open S3.
   - The frame's `load` still fires, so "Opening…" goes away and the 8 s promotion never happens. The trader sees a
     blank box with only the small footer link (`csp-blocked-frame-375-*.png`).
   - Fix: keep the timers running until the portal's first message arrives.
2. **Low · spec (plan §5) · `abandoned` is never recorded.**
   - Reproduction: open S3, let the frame load, then Close. S7a shows, but no `abandoned` row is written.
   - `lib/funnel.ts` allows the event, but no code writes it. The embedded close is now the main way to abandon.
3. **Low · spec (plan §4) · gaps G1 to G5 have no tests.** Each needs one e2e assertion; the probes above give the setup.

Note: S3's "error → S7b" is replaced by the redirect fallback (engineer deviation 1); reasonable, for the owner to see.

Cleanup: server and fake stopped; 11 test users and their claims deleted.

Verdict: DEFECTS (3 Low; every check green, every security probe passed)
