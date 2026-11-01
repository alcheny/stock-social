# Fixes cycle 2 (trust rows): tester QA

2026-11-01 · branch `claude/fixes-cycle2-trust` at 6049e23 (after the orchestrator's re-scope) · scope:
`git diff origin/main...HEAD`. Findings on the dropped work (#1, #2, app/t/** copy, now on `claude/fix-truthful-labels`)
are left out. Playwright was not run (the build session owns port 3000); e2e specs were read, not run.

## Checks run
- `npx tsc --noEmit`: clean.
- `npm test`: 1007 tests, 989 pass, 16 skipped, 1 TODO (H4, owner), **1 fail**: `lib/connections.test.ts` "D1: the
  hourly sync never touches a pending link…". It passes alone twice (43/43). Origin/main has 994 tests, so the count
  rises (+13). See Low 6.

## Acceptance criteria (BUILD NOW set)
| Row | Implemented | Tested | Notes |
|---|---|---|---|
| #4 visible-user predicate | yes: stock page (4 reads), index (2), sitemap | unit source scan (≥ 7 reads) + DB test of the helper | compare, stock image, open-positions exempt via `PENDING_VISIBLE` (ponytail), Low 3 |
| #5 public statements | yes: join card, share prompt from `PUBLIC_FIELDS` | unit | Low 4 (wording) |
| #8 claims copy | yes | unit + existing `lib/claims.test.ts` | — |
| #11 pick/signal | yes: compare copy, /me/record (2 strings) | unit + e2e strings edited in place | HoldTime deferred (re-scope) |
| #19 tone on /me/likes, /me/record | yes | source regex only | Low 2 |
| #20 not-found page | yes, no own robots tag (Next adds noindex) | e2e (unknown URL → 404, title, noindex, link back) | invalid ticker deferred; `/t/%3Cscript%3E` e2e still expects 200, consistent |
| #21 titles | yes (9 pages) | unit (every page exports a title; no repeated static title) + e2e on 4 pages | Low 5 |
| #27 schema/action comments | yes | unit | — |
| #28 via=nav | yes + label | unit | Low 1 |
| #30 dead `.badge-embed` CSS | removed | unit | — |

## Findings

### Medium
1. **spec (POLICY F3a, P2): /me/record calls demo trades "verified".** `app/me/record/page.tsx:286` always prints
   "Percentages only. Computed from your verified closed trades each time you open this page." The same page shows the
   Demo badge when any row is unverified (`:68`, `:72`). The query at `:25` reads all of the user's `closed_trades`,
   demo rows included. Repro: `/login/dev`, handle `momentum_maya` (seeded demo trader), open `/me/record`: the h1 has
   **Demo** and the footer says "verified closed trades". Fix: "Computed from your closed trades…", or the word only
   when `!demo`. Nothing tests it: `lib/stock-labels`-style checks only cover `app/t/**`, which is on the other branch.

### Low
1. **note (measurement change, #28):** `app/auth/actions.ts:65` sets `source: r.surface ?? (r.ref ? 'profile' : 'direct')`.
   Now that `nav` passes `normalizeVia`, a nav sign-up from a **real** (non-demo) trader's page records `landed.source
   = 'nav'` (and `referred_surface = 'nav'`). Before, it recorded `'profile'`. That's the intended fix, but
   `e2e/signin.spec.ts:440-456` still says "landed.source is the profile" and passes only because `momentum_maya` is
   demo (`referredBy` null → `surface` null). No test covers a real referrer with `via=nav` end to end. Suggest a
   `lib/auth` DB test or an e2e with a non-demo referrer that expects `nav`.
2. **test (vacuous-ish, #19):** the #19 checks are source regexes (`const sign = toneClass;`,
   `className={toneClass(r.returnPct)}`). No test renders a flat 0.0% row. Also `app/me/record/page.tsx:128` and
   `:132` still hard-code `'up'`/`'down'` for Average win/loss. An average win under 0.05% prints "0.0%" in green.
   Repro: a user whose only wins are +0.04% → Average win "0.0%" coloured up. Use `toneClass` there too.
3. **test (stale exemption, #4):** `PENDING_VISIBLE` in `lib/fixes-cycle2-trust.test.ts` only asserts that the files
   exist. Once the follow-up moves a file onto the helper, the exemption stays and nothing forces it out. Assert that
   each pending file still lacks `visibleUser` (so it fails when fixed and the entry must be removed). Until the
   follow-up lands, a user being deleted is still counted on `/t/compare` (`app/t/compare/page.tsx` read has no
   filter) and the stock share image.
4. **usability (#5, 360 px):** the share prompt line is now about 330 characters:
   "Public: your handle, display name, any reasons you publish, percent returns, symbols, dates, holding periods,
   institution names, account count, your current open positions with unrealized percent; losses included. Never
   sizes, prices or balances. Your broker login stays private." "your … your current open positions" repeats, and the
   list is hard to scan in the prompt card. Not blocking; the owner flag on `CONSENT_SCOPE_LINE` is the place to settle
   one wording.
5. **test (#21 coverage):** the e2e checks titles on 4 of the 9 titled pages. `/login/sent`, `/connect`,
   `/connect/consent`, `/connect/continue` and `/connect/result` are covered only by the source regex, and that regex
   compares static `metadata` titles only (pages with `generateMetadata` are never compared). Acceptable for static
   titles; noting that the plan said "e2e: titles pairwise distinct".
6. **note (flaky, unrelated to this diff):** `lib/connections.test.ts` D1 failed once in the full `npm test` run while
   another session was using the shared DB, then passed alone twice. No file in this diff touches connections or sync.
   Rerun in CI before blaming the branch.

### Checked, no finding
- Old copy left in tests: `e2e/app.spec.ts` "Pick…" strings were edited in place. No e2e or lib test reads the old
  join-card, share-prompt, claims, `/me/record` or schema-comment text. `lib/compare.test.ts` still lists every
  `COMPARE_COPY` key.
- `visibleUser('u')` uses `sql(alias)` (identifier) and is exercised against Postgres in `lib/visible-users.db.test.ts`.
  The overlap query's outer rows come from the filtered subquery.
- `app/not-found.tsx` metadata is supported in this Next version (`node_modules/next/dist/docs/.../not-found.md`
  §Metadata, noindex injected automatically). Existing 404 tests (profile, trade, month) only check status.
- Signed out: none of the changed public surfaces (join card, `/t`, `/t/[symbol]`, sitemap, 404) depend on a session.
