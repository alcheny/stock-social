# Privacy product work: committee record (2026-11-01)

Plan: `plan.md` (draft). Round 1 reviews: business lead SEND BACK (8 demands), engineer SEND BACK (9), UX lead SEND
BACK (8). Each open question is decided by the committee's recommended option; this record supersedes the draft where
they differ.

## Decisions

| # | Question | Decision (recommended option) | Raised by |
|---|---|---|---|
| D1 | How does the owner create a test account in production while closed? (handles can't be allowlisted before they exist) | `LAUNCH_ALLOWLIST_EMAILS` (env only, never in the repo): a verified email on it may create an account while closed and connect. `LAUNCH_ALLOWLIST` (handles) stays as the task asks: a listed, existing handle may connect. Owner note: list handles that already exist (an unclaimed listed handle could be taken by a rename). | BL 2, Eng 1 |
| D2 | Sandbox rule | Fails closed. Open only when ALL hold: dev auth allowed (non-production, or `ALLOW_DEV_AUTH=1`); vendor is the loopback fake or unconfigured (`SNAPTRADE_CLIENT_ID` unset); mail goes nowhere real (`AUTH_EMAIL_SEND_URL` unset or loopback); every configured provider issuer is loopback. Loopback by parsed hostname (`lib/vendor-env.ts#isLoopbackUrl`). Env read at call time. Each condition flipped alone closes it (tested). | BL 3, Eng 5 |
| D3 | Gate state visible to the owner | The tick's JSON report carries `gate: open|sandbox|closed` and allowlist sizes (numbers only). | BL 3 |
| D4 | Where sign-up is refused | Only the new-user branch of `signInWithIdentity` (`allowNew`); known subjects and verified-email matches sign in as before. Both callbacks catch `SignUpClosedError` explicitly (the provider route before its generic catch) and go to `/login?error=closed`. | Eng 2 |
| D5 | Account enumeration | The email link is sent for any address while closed; the refusal comes only after the link is used. `/login/sent` is identical for known and unknown addresses. | BL 4 |
| D6 | `/login` while closed | A `role="status"` line (`LAUNCH.closed`) under the heading, before the age box. `?error=closed` turns it into one focused `role="alert"` with `LAUNCH.closedAfter`. "Connect a brokerage instead" and its divider are hidden while closed (it only signs up). | UX 1–3 |
| D7 | `/connect` while closed | Signed out: `LAUNCH.closed` replaces `signInFirst` (sign-in links stay). Signed in, not allowed: `LAUNCH.connectClosed`, no portal primary, profile and settings links stay. `?closed=1`: focused `role="alert"`. | UX 4–6 |
| D8 | Consent while closed | The consent page shows `LAUNCH.connectClosed` instead of "Import my record"; "Don't import" stays so the pending link can be removed. `consentAction` re-checks (defense in depth). | UX 6 |
| D9 | The longer consent line vs. the fold | The owner's wording is untouched. The consent page moves the deadline line below the buttons and tightens its list spacing (page-scoped CSS block), so the primary stays above the fold at 375×667 and 360×640 (e2e). The scope line replaces the old "Closed trades are published…" line; the other four lines stay (P6 needs "stays public after disconnect"). | UX 7 |
| D10 | Orphan likes and rejects | The task requires the purge; trades can leave and return (simulated flag, vendor correction). So: a 30-day grace. The tick marks a like/reject whose trade is gone in `privacy_orphans` (first seen), clears the mark when the trade is back, and deletes the like/reject only after 30 days orphaned. Not age-based: a like with a live trade is never deleted (owner: preference data kept indefinitely). `lib/likes.test.ts` names `lib/privacy-purge.ts` explicitly and holds its statements to orphan-only deletes (not loosened). | BL 1, Eng 3 |
| D11 | Unfinished sign-ups | Attempts with no user, not completed, older than 30 days, vendor user already cleaned, no live/uncleaned connection and no `users.signup_attempt_id` pointing at them. Deleted in one transaction per batch: funnel events, links, signed-out connections, attempt. Signed-in users' connections are never purged (they drive TR-3 state). | Eng 4 |
| D12 | Unused sign-in links | Expired links (existing purge) plus links whose attempt has completed. | plan |
| D13 | Purge placement | `lib/privacy-purge.ts`, own advisory lock `(41, 0)` tried never waited, 20 s box, after the discovery purge and before `syncTick`, in its own try/catch (a throw or held lock never stops the sync; tested). Not merged into `purgeDiscovery` (another session extends that file now). | BL 7, Eng 7 |
| D14 | Display log append-only | A trigger refuses every update, and a delete unless the users row is already gone (the cascade). Truncate can't be trapped (the schema guard forbids the word): known limit. Demo records are written with `demo = true`. Own time box; `on conflict do nothing` resumes on later ticks; deleted users skipped. | BL 5, Eng 6, 9 |
| D15 | Log scope | Server code only. `'use client'` files log to the viewer's own browser console, never to our logs (`share-card.tsx`, `share-prompt.tsx` out of scope, said here). Numeric user ids stay. `logSafe` (class, status, code) is the reducer; `errStatus` in `lib/connections.ts` stays for its control-flow use. The scanner was red on today's code (`app/api/sync/route.ts`, `lib/sync.ts`) before the fix. | BL 6, Eng 8 |
| D16 | Copy | Owner copy verbatim. The likes test "no like copy carries a count" allows only the owner's exact phrase "no one sees a count" (a statement that there is none). | BL 8 |

## Round 2 (after the build): user tests, QA and code review

Business lead: FAIL (display-log starvation), compliance PASS. UX lead: compliance PASS, usability FAIL (closed
`/connect` said so too late). Tester: 5 defects. Code review: nothing blocking, 5 should-fix. All fixed as below.

| # | Finding | Decision (recommended option) |
|---|---|---|
| D17 | Tester 1: a deleted account's sign-up attempts stay | Kept as F-1 designed and tested (`lib/delete.test.ts`: "the funnel row survives without the person"): deletion nulls the user link; it now also blanks any vendor id left on those attempts, so nothing on them points at the person. Retention map says so. Changing F-1's decision is the owner's call. |
| D18 | BL 1: empty records starve the display log | Empty records are filtered in SQL; test with four empty records before a real one and room for one snapshot. |
| D19 | BL 2: stages before the sync take its time | The privacy purge and display log run after `syncTick`, each boxed to min(10 s, time left before the route's end − 30 s), skipped when none is left; ms per stage in the tick JSON. |
| D20 | BL 3, code review 9: a missing day | `displayedOn` returns `asked`, `day` and `gap`; a day's row is "as of the start of the day (UTC)". |
| D21 | UX 1–4 | Closed `/connect` shows the status under the heading and only the way out (no trust notice); closed `/login` is titled "Sign in". The header nav's 21 px links and the chart's 35 px buttons predate this work: left to their owners. |
| D22 | Code review 2, tester 5, review 6: dev sign-in and renames vs. the handle allowlist | In a production build with the dev sign-in on, a handle alone never passes (only a verified email). While closed, nobody may rename onto a listed handle. |
| D23 | Code review 1, 4, 5; tester 2, 4: scanners | Log scanner: any console method or bracket access, aliasing is a failure, `JSON.stringify` only of an object literal with every entry checked (or the typed sync report). Cookie scanner: any variable assigned from `cookies()`, the object form, backticks, `cookieStore`, unresolved names fail, `proxy.ts`/`middleware.ts` scanned. Likes test: marking and removing statements must carry the closed-trade check; the original "no count" rule is restored for every other line and `LIKES.private` is held by an exact-string test. |
| D24 | Code review 10, tester 3: framework logs of uncaught errors | The email route reduces any other error with `logSafe` and answers like a used link; the provider callback already answers every error generically. Out of the scanner's scope (said in the test); `onRequestError` filtering is left to the security-hardening session. |

## Round 3: orchestrator review of PR #31

| # | Finding | Decision |
|---|---|---|
| D25 | Security: in production with the dev sign-in on, the stub signs anyone in as the allowlisted account | While closed, such a build lets no one connect (no allowlist entry passes); the dev `login` creates a new account only when `signUpOpen()` (existing handles still sign in; the e2e sandbox counts as open). Tested. |
| D26 | Busy ticks could skip the privacy stages | A fixed 5 s slot each before the sync, then up to 10 s each of the time left after it (never within 30 s of the route's end). |
| D27 | "As of the start of the day" overstated | `displayedOn` returns `asOf` (the row's created_at, UTC); shown as "as of <time> (UTC)". |
| D28 | Nits | Index on `login_links (expires_at)`; deletion blanks only the vendor id it just deleted at the vendor. |
