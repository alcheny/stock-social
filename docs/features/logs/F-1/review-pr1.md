approve: true

# F-1 · PR-1 (sign-in) · Reviewer

Date: 2026-10-22. Branch `claude/adoring-euler-4469ys` (e94a926) vs `origin/main`, 139 files. Read-only; no code
changed. Inputs: `team/reviewer.md`, POLICY, COMPLIANCE §1, CLAUDE.md, IMPLEMENTATION.md (pre-authorization of
`lib/session.ts`), the feature file, plan §1/§4, the round-2 committee verdicts, both logs.

## Checks run

| Check | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm test` (local Postgres) | 361 / 361 pass, 0 skipped |
| Test names `origin/main` → branch | 368 → 415; none removed or renamed; no `.skip`/`.only` (two e2e skips are conditional on missing fake config) |
| `node scripts/compliance.ts diff origin/main` | one finding: an optional prebuilt image package's license in local `node_modules`; lockfile unchanged, same on `origin/main`. Not from this PR |
| `npm run build`, seed, `npx playwright test` with the in-repo issuer and email sink | 56 passed, 0 failed (47 s) |

## Policy (ids)

- S1/S2: no secrets; `.env.example` placeholders only; errors carry status or reason only; no `console.*`.
- P1-P5: fake addresses on `example.com`; funnel meta refuses `@` and 7+ digit runs; link tokens hashed, address
  blanked on claim and purged on expiry; deletion removes links, identities, sessions and reserves the handle with
  no personal data (all tested). P4: attestation before the users row on every method (`signup_attempt_id` NOT NULL
  + FK; schema test and e2e). P6: Terms and Privacy are marked placeholders (owner's text, H).
- T1: only the integrated vendor is named; provider labels come from env. F1-F3a: new copy lives in `lib/copy.ts`,
  tested against the banned, marks and promo lists; the layout disclaimer stays on every page; the trust notice
  reports the vendor's own audit statement only. F6: "You're in." is one status line, no motion.
- A1: labeled controls, 44px targets, focus ring, no color-only information (contrast ≥ 7:1). R1-R4: no workflow
  or dependency change.

## Acceptance (PR-1 scope, plan §1; tests, plan §4)

Both providers (PKCE, state, nonce; wrong audience, `alg: none`, HS256, unknown kid, bad signature, issuer, expiry,
nonce rejected in `lib/auth/oidc.test.ts`; code flow e2e against the fake issuer), the email link (single use, 15 min,
a send failure leaves nothing claimable), attestation-before-user, funnel without personal data, trust-notice copy,
deletion vendor-first, hashed sessions replaced on re-sign-in, dev form at `/login/dev` under `ALLOW_DEV_AUTH=1`:
each has an asserting test that passes. Product rules hold: no manual trade path, `Verified` untouched, feed and
profiles work signed out, `lib/broker.ts` and `package.json` unchanged. Auth changes stay in the pre-authorized
`lib/session.ts` plus the new `lib/auth/*` the plan names. New network calls: one email POST behind
`AUTH_EMAIL_SEND_URL` and the two OIDC issuers from env. SQL is parameterized throughout; the schema helpers
`format('%I')` in-file literals only. No user-controlled HTML.

## Findings (non-blocking)

1. `app/connect/page.tsx:29` links to `/how`, a 404 until PR-2a (plan §1 assigns it there; committee carried it).
   F3 wants it live before real users: PR-2a lands before any deploy.
2. `app/connect/page.tsx:16-19` writes `notice_seen` for any open attempt id in the URL, unauthenticated, on every
   render; a stranger can inflate funnel rows. Carried to PR-2a (dedupe or ownership).
3. `lib/auth/attempts.ts:81-87` links a provider identity to an existing user by verified address alone
   (`callback/[provider]/route.ts:29` checks `email_verified`). Plan design; note the trust in the provider's
   verification in the privacy inventory (COMPLIANCE §3).
4. `lib/session.ts:56-60` `origin()` trusts `x-forwarded-host` without `NEXT_PUBLIC_SITE_URL`; link sends are
   refused in production without it and OIDC redirects are bounded by provider registration. Production must set it.
5. Style nit, `app/auth/actions.ts:116`: dynamic `await import` of a module already imported statically at line 8.

Verdict: approve. PR-1 does what plan §1 assigns it, every criterion has a passing test, nothing existing was
weakened, no POLICY rule is broken.
