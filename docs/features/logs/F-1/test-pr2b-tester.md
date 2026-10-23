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

## Re-run 1 (after fix round 2)

Date: 2026-10-23. Branch `claude/adoring-euler-4469ys` at `43d083d`, against `origin/main`. No product code was changed.
Inputs: the three committee verdicts and `build-pr2b-fix2.md`.

### Checks

| Check | Result |
|---|---|
| Schema applied twice, then seed (Postgres 16) | clean |
| `npx tsc --noEmit` | clean |
| `npm test` ×5 | runs 2–5: 448 pass, 0 fail. Run 1: 447 pass, **1 fail**, in `lib/schema.test.ts` "a repeat apply blanks accounts and institution…" (line 89, `0 !== 1`). See defect 1 below. |
| `CI=1 npm run build < /dev/null` | compiles (fresh `BUILD_ID`, `/connect/continue` and `/connect/portal` listed), then exits 1 on the framework's security advisory, as on main. This is tool output and was not acted on. |
| `npm run test:e2e` (fakes started by the specs) | 88 passed, 3 skipped (the unconfigured OIDC and email fakes, as before) |
| `compliance.ts diff origin/main` | only the existing `@img/sharp-wasm32` license line |
| `autopilot.ts guard main` | `guard: ok` |

### The "expiry with a clock" flake: reproduced, and it is a test race

- **What I saw.** It showed up once in five runs, from the other side of the same race: the schema test failed rather
  than the expiry test.
- **Cause.** `tick()` in `lib/connections.ts` (line 537) cleans every row in the database that is declined or expired
  with `cleanup_done_at is null`.
  - The expiry test in `lib/connections.test.ts` calls the global `tick` and asserts `cleaned === 1` and
    `deletedConnections` equal to its own row only.
  - `lib/schema.test.ts` inserts an "uncleaned" expired row (48 h old) and asserts that it keeps its snapshot.
  - When the two files overlap (node:test runs files in parallel), the tick cleans the schema test's row. The schema
    test then reads `accounts = []` (my run 1), or the expiry test counts 2 (the engineer's failure).
- **Deterministic reproduction.** I inserted one expired row with `cleanup_done_at` null, then ran
  `node --test --test-name-pattern="expiry with a clock" lib/connections.test.ts`. The result was `expected: 1, actual:
  2`, and the foreign row was cleaned (`accounts = []`).
- **Classification: test race, not a product bug.** Cleaning every uncleaned row is the tick's job.

### Verified as a user and as an attacker

I ran 85 scripted checks against my own server and vendor fake, started after e2e. 84 passed. The one that failed was
a selector error in my script; the screenshot confirms the behaviour.

- **Server-side framing probe.**
  - Probe timeout: a portal that holds HEAD for 3 s gets `mode: embedded` after about 1.7 s, and the dialog opens.
  - Refusing headers: on the `localhost` origin, the answer is `mode: redirect`. `showModal` is never called, the page
    goes straight to the vendor's page, and it completes to consent.
  - The probe is one HEAD with no cookie, and funnel rows record the mode as `redirect`.
  - Cache per origin: a second refused mint sends no new probe. The `127.0.0.1` origin stays embedded in the meantime.
- **Dialog at 375×667, light and dark.**
  - "Opening…" with `aria-busy` shows on the primary only while the mint is held. The label is restored when the
    dialog opens.
  - Before load, the frame has `aria-busy=true`. The 3 s line appears, and at 8 s the control becomes the filled
    primary.
  - After a late load, the control drops to secondary and there is no slow line.
  - A loaded portal left idle for 15 s, sampled every 250 ms, never showed the slow line or a filled control. "Page
    blank? Open it in a new page." appeared at about 8.15 s after load, beside a 45 px secondary control.
  - Close is the only app button, and the flow still completes.
  - No `[role=status]` sat under `[aria-busy="true"]`, either while loading or after load.
  - Control insets from the dialog's edges: 17 px left, right and bottom before load, and 17/97/17 px after. There is
    no horizontal scroll.
- **Blocked popup.** The app shows `/connect/continue` with the exact line, and its Continue link goes to
  `/connect/start`. It continues on its own after about 2.0 s, reaches the vendor and then consent. With lure query
  parameters and no script, no link leaves the app.
- **Banner.**
  - Owner: "Importing your record · 0 closed trades so far" and "0 activities imported".
  - Visitor: "Importing this record · …" with no "your" and no activities line. `description` and `og:description`
    read the same.
  - Finish: "Import finished." is announced exactly once and the other lines are dropped. "Your record is live." is the
    only thing drawn, with the note visually hidden.
  - The banner is removed 5.06 s after finish, and no empty box is left.
- **Concurrency and limits.**
  - Concurrent first opens: 6 parallel `POST /connect/portal` for a new trader all returned 200, and exactly 1 vendor
    user was registered (the one stored).
  - Mint limit:
    - Mints 7 to 10 returned 200.
    - The 11th returned `429 {"error":"rate"}` with `no-store`.
    - `/connect/start` returned a 429 page.
    - In the browser: the "Too many tries…" line, and no dialog.
    - 14 parallel mints for a new trader: exactly 10 returned 200 and 4 returned 429.
  - Polling:
    - Two steps within a second: one 200 and one 429 with `Retry-After: 1`, and both answers are `no-store`.
    - Steps at 2 per second alternate with 429s.
    - Signed out: 401 with `no-store`. GET returns 405.
- **Poll after a 401.** I cleared the cookies mid-import. The page showed "Signed out in another tab." with "Sign in
  again" (`/login`). The last poll was a `no-store` 401, and no polls followed in 6 s.
- **Anti-framing.**
  - `frame-ancestors 'none'` and `X-Frame-Options: DENY` are present on all 21 paths I tried:
    - pages: feed, login, the connect pages, consent, profile, the OG image, how, terms, privacy, settings, stocks
    - 404s
    - the step, portal and sync APIs
  - A foreign page that frames a profile renders nothing of it.
- **PR-2a regression.**
  - Consent gating:
    - Nothing is imported before consent.
    - Before consent, the signed-out profile shows no banner.
    - Another trader opening the consent URL gets "Connection not found."
  - Trust rule:
    - An importing record has no Verified badge; once connected, it does.
    - The demo profile shows Demo, no Verified, and its description says "demo trades".

Screenshots are in `screenshots/pr2b/rerun1/`. Cleanup: server and fake stopped; 18 test users (`rr1*`) and their
claims deleted.

### Defects

1. **Low · bug (test) · a cross-file race makes `npm test` flaky** (1 run in 5 here, and once in the engineer's
   runs).
   - The global `tick()` in the "expiry with a clock" test (`lib/connections.test.ts`) cleans the uncleaned expired
     row that `lib/schema.test.ts` inserts.
   - Whichever file asserts second fails. CI can go red on a correct change.
   - Fix, in the tests only: one of the following.
     - Scope the schema test's fixture so the tick never selects it, for example by marking its "uncleaned" row
       inside the same transaction as the apply and rolling back.
     - Make the expiry test assert only on its own row (`cleaned >= 1`, `deletedConnections` includes its id).
     - Serialize the two files.
   - Not a product defect.

Verdict: DEFECTS (1 Low, test race; product behaviour clean: every check other than the flaky run is green, and every
user and attacker probe passed)
