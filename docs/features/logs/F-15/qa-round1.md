# F-15 QA, round 1 (tester, 2026-11-01)

Branch `claude/f15-measurement`. Started on 5a9aac1; cbaa7ed (review fixes) landed mid-run and was re-checked by unit
tests. The running server at :3000 was built at 12:02, before cbaa7ed, so the browser and curl results below are for the
older build unless marked.

## Runs
- `node --test lib/f15-*.test.ts lib/f15-*.db.test.ts scripts/f15-readout.test.ts`: 43/43 pass on 5a9aac1, 44/44 on
  cbaa7ed. `npx tsc --noEmit` is clean on cbaa7ed.
- Playwright f15-beacon, f15-beacon-human, f15-share: 10/10 pass on the old build. The two edited `e2e/app.spec.ts`
  share tests (via=card) pass. cbaa7ed's new test "landing on an uncounted page ... internal" fails against the stale
  server. That is expected: it reproduces defect 2 below. It needs a rebuild to confirm.

## Acceptance map
A1 db (delete, rename; the rename reading has been raised for the owner) · A2 db column allow-list · A3 unit + db fuzz ·
A4 unit · A5 existing suites · A6 db + CI rule · A7 isolation test · A8/A9/A10 readout tests · A11 log
bot-validation-2026-11-01.md · A12 db (50 → n=50) · A13 e2e covers route 500 and abort, unit covers the DB throw (gap:
no e2e has the DB write failing) · A14 e2e covers DOM, a11y, focusable and layout shift (gap: no measure of first-paint
delay) · A15 db + source test · A16 unit + e2e (trade, month, card) (gap: no e2e for story) · A17 unit · A18 deferred ·
A19 test · A20 ponytails present.

## By hand (curl / real Chromium at 360 px, throwaway user `qaf15x`, its rows only)
- 413: a body over 512 B, a chunked body over 512 B, and a 10 MB chunked body (33 ms). A small chunked body gives 204.
  A lying content-length gives 400. GET gives 405.
- 403: cross-site, same-site and `Origin: null`. No headers gives 204 and counts nothing. Huge numbers, repeated keys
  (the last key wins, sanitised) and `__proto__` are all handled. Month 2026-00 and 2026-13 are not counted. An
  encoded-slash handle or trade id is not counted. Unicode, RTL-override and bad-%-escape handles are not counted.
- 500 concurrent POSTs give 500 × 204 and one row with n=500. The feed still answered in 44 ms. No cookie is set
  (headers checked). Browser: no cookie, local or session storage; the beacon waits 2 s. Server log: no agent,
  address or path.
- Readout writes outside the repo and refuses `./docs` and a missing `--out`. Output has no handle.

## Defects
1. bug: a 404 profile, trade or month page is counted for the trader whose handle differs only by case or spaces.
   Repro: open `/u/QAF15X` (the page answers 404). The beacon sends `{"path":"/u/QAF15X"}` and `profile` +1 is stored
   for `qaf15x`. Same for `/u/%20qaf15x` (404, counted). Cause: `lib/views-shared.ts:31` runs `normalizeHandle`
   (trim and lowercase) and `lib/views.ts:100` matches the lowered handle, but the pages match exactly. Fix: drop
   the beacon unless the raw decoded segment equals the normalised handle.
2. bug (fixed in cbaa7ed, not checked on a rebuilt server): landing on an uncounted page from another site
   (`/privacy`, referer elsewhere), then soft-navigating to `/` sent `ref:"external"` as if it were a landing. The old
   `app/view-beacon.tsx` set the landing only on counted pages. Re-run e2e/f15-beacon-human.spec.ts:88 after a
   rebuild.
3. note: the A13 and A14 gaps above (DB-write failure only in a unit test; first paint not measured; no story e2e).
4. note: I left drops in `view_drops` from my curl runs (shared aggregate rows, not separable). The throwaway user and
   its rollup rows were deleted.
