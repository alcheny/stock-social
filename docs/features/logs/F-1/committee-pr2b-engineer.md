COMPLIANCE: PASS

# F-1 PR-2b · committee · engineer (2026-10-23)

Ran `936787f` on :3103, vendor fake on :4143, a hostile page on a third origin. No tick run. All stopped; my 4 test users deleted (`deleteProfile`).

## Walk as a stranger (S1 → S2 → S3 → S4 → S5)

Completed in four taps. What confused me:
- Two exits: the app's Close and the portal's Cancel. Which counts is unclear; both reach S7a.
- Behind the dialog the primary still says "Opening…" after the portal shows.

## §3 What the client sends and stores: pass

- The poll returns `{state, imported, closes, read}` only. No client storage.
- Funnel meta is enums and counts (`mode`, `accounts`, `paper`); no handles, ids or text.

## §9 Accessibility: pass

Labelled native modal, inert page, focus to Close and back, status throttled to 5 s, no motion added.

## §10 Security self-review

Holds:
- **Messages:** exact origin and `event.source`; no `eval`, no HTML sinks; a message only picks one of two fixed paths; ids are token-filtered and never navigated to.
- **Fallback:** goes only to `/connect/start`, which mints server side.
- **Portal route:** 401 unbound, `no-store`. Cross-site `fetch` and form POST both got 401 (Lax cookies).
- **Malicious portal page:** the sandbox has no top navigation and no `allow` permissions. A popup opened with `allow-popups-to-escape-sandbox` tried `opener.top.location`; Chromium refused it. Left: spoofed UI in the frame and forged SUCCESS or CLOSED, which only reach `/connect/done` (it re-asks the vendor).
- **Poll from two tabs:** 12 parallel polls all returned 200. 500 distinct rows, 250 closes, no duplicates (advisory lock).

Findings:
1. **Medium (from PR-2a, now with a second entry point): a concurrent first mint orphans vendor users.**
   - 6 parallel mints on a new user registered 4 vendor users (`/connect/start` too); only the last is stored.
   - A tab framing a losing URL can link a broker under a vendor user we cannot list or delete (P6).
   - Fix: register under the per-user advisory lock and delete the losers.
2. **Low: no anti-framing on the app.** No `frame-ancestors` or `X-Frame-Options` on any page; `/connect` renders inside a foreign page.
   Lax cookies keep that frame signed out, so not exploitable today. Add `frame-ancestors 'none'` before launch.
3. **Low: no rate limit on minting or polling.** Each call reaches the vendor. Parallel mints added 14 `portal_opened` rows, which skews plan §5's redirect share.
   Fix: a per-user minimum interval.
4. **Low:** the banner keeps polling every 2 s after a 401 (signed out in another tab). Stop on 401.
5. **Info:** the step response has no `no-store` (POST, so not cached in practice).

Owner: the build still reports the framework security advisory.
