# F-1 · PR-1 test report · Tester

Date: 2026-10-22. Branch `claude/adoring-euler-4469ys` (3964b94) vs `origin/main`. Inputs: the plan, the engineer's
log, the feature file, the diff. No product code changed. Local Postgres 16, schema applied twice, demo seed,
production build started with `ALLOW_DEV_AUTH=1` and the in-repo OIDC and email fakes configured.

## 1. Checks

| Command | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm test` with `DATABASE_URL`, 4 runs | 355 tests; **1 fails in 2 of 4 runs**: `lib/claims.test.ts` "schema applies twice", `deadlock detected` (40P01). The file alone: 8/8 |
| `npm test` without `DATABASE_URL` | 344 pass, 11 skipped |
| `npm run build` | success |
| `npx playwright test` (fakes configured) | **49 passed** (41 on main + 8); the log's "46 → 55" is miscounted |
| `node scripts/compliance.ts tree` | one pre-existing dependency finding, identical on main |
| `node scripts/autopilot.ts guard main` | ok |

## 2. Conformance (PR-1 criteria, plan §4 + feature file)

- Sign-in via either provider or email link, attestation before any user row on every method: tested
  (`e2e/signin.spec.ts`, `lib/auth/attempts.test.ts` NOT NULL + FK). Pass. **Gap:** the provider e2e tests skip in CI
  until request #12 is answered.
- Funnel per attempt, no personal data: `lib/funnel.test.ts` + e2e. Pass.
- Trust notice strings vs banned list: `lib/copy.test.ts`. Pass. `/how` is a 404 until PR-2a (expected).
- Deletion vendor-first, cascade, reservation without personal data: `lib/delete.test.ts` (DB-level; screen is
  PR-2a). Pass. Funnel rows survive deletion by design (no personal data).
- OIDC wrong audience, `alg: none`, HS256, unknown kid, signature, issuer, expiry, nonce: tested. Pass.
- S1 at 375px light/dark, 44px controls, no h-scroll, keyboard-only: tested. Pass.
- Untested: the `localStorage` "last method first" reorder, S2 in dark, the email send-failure path, resend limits.

## 3. Edge cases (run against the built app)

| Case | Result |
|---|---|
| Replayed link; expired link (clock via SQL) | `/login?error=expired` with alert; claim is atomic; expired row stays unused. OK |
| Link opened in another browser | signs in (links are not browser-bound; expected). OK |
| Two tabs submit the same address at once | two attempts, two links, both sign in the same user. OK |
| Tampered `sid`, unsigned token, old `uid=1` | all signed out. OK |
| Provider sign-in while signed in | new user and session; old session row stays valid 30 days (D6) |
| Pre-F-1 rows | backfilled `dev` attempt; NOT NULL holds; seed and e2e inserts go through an attempt. OK |
| Provider config half-set | no button (unit). OK |
| Email send failure | **generic "This page couldn't load"**; attempt and link rows already written (D2) |
| Provisional handle collision; taken handle on change | retries; inline error. OK |
| Deletion signed out / twice | redirect to `/login`; no session on the second call (code read). OK |
| Stranger resends with a guessed attempt id | 3 emails reach the victim before the per-attempt cap (D5) |
| Submit with JavaScript off | works. OK |
| `/connect?attempt=N` reloaded or hit by a stranger | one `notice_seen` row per render, any id (D7) |

## 4. Usability (375px and 360px, light and dark; `screenshots/pr1/`)

No horizontal scroll on any of the five pages or the error states. Disclaimer footer everywhere. Every control
labeled; a 2px focus ring on every tabbable element in order; primary controls 44–45px; keyboard-only path completes. Defects: a stray purple block above the checkbox (D1),
"← Back" and the S2 links 16–20px tall (D8), the attestation error clears the typed email (D4).

## 5. Compliance scan of the diff

Only the integrated vendor is named; provider labels come from env. No advice or promise words (`secure` is only a
cookie flag). No `console.*`; errors carry status or reason only. No third-party script, font or stylesheet.
Personal fields: `login_links.email`, `identities.email/subject`, session hashes; all cascade on delete (tested).
§7 attestation-first, signed httpOnly sessions; §9 labels and focus except D8; §10 PKCE/state/nonce, hashed tokens.

## 6. Defects

1. **must-fix** · The hidden default submit button renders as a 28×44px purple block above the attestation
   checkbox: `button, .button { display: inline-block }` overrides `[hidden]`, `.auth button` sets the height. It is
   clickable and unlabeled. Repro: open `/login`; see `screenshots/pr1/login-dark.png`.
2. **must-fix** · Email send failure shows Next's generic server error, no message or retry; the attempt and
   `login_links` rows are written first. Repro: point `AUTH_EMAIL_SEND_URL` at a closed port and submit.
3. **must-fix** · Flaky CI: the schema's backfill block (insert from `users`, update, `alter table users … set not
   null`) runs on every apply with exclusive locks; `node --test` applies the schema from 8 files in parallel and
   deadlocks in 2 of 4 runs (`lib/claims.test.ts:105`). Skip the block when nothing needs backfilling.
4. **nit** (usability) · Unchecked attestation redirects and drops the typed email.
5. **nit** (security) · `/login/sent?a=N` resend is unauthenticated for any open attempt; ids are sequential. Bind
   it to the originating browser.
6. **nit** · Signing in while signed in keeps the old session row; no sign-out control until PR-2a.
7. **nit** · `notice_seen` written per render, any id; dedupe like `own_profile_viewed`.
8. **nit** (usability) · "← Back" and the two S2 links are under 44px.
9. **nit** · `users.deleted_at` never written; `?method=brokerage` is ignored, so the signed-out brokerage-first
   path loops S1 → S2 → S1 with only "Sign in first" as explanation (PR-2 must close it).
10. **nit** · Build log miscounts e2e (41 → 49, not 46 → 55).

## Verdict

DEFECTS
