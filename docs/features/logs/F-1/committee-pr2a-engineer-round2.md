COMPLIANCE: PASS

# F-1 PR-2a · committee · engineer, round 2 (2026-10-23)

Ran `814e880` on :3103 with the vendor fake on :4133. `npm test`: 413 pass. Test data deleted, processes stopped, no tick run.

## Takeover: closed

- A stranger with only the attempt id is refused on `/connect/start`, `/connect/done`, `/connect` and `/connect/consent`. Replayed consent and decline actions go to `/connect`. Five `unbound` events, ids only.
- Forged cookies (unsigned, wrong signature, case-altered) are refused.
- Cookie A presented with B's id, or with the portal return after B's link: refused or "abandoned". Cookie A cannot consent B's link.
- After consent the cookie is cleared, and a replayed old cookie is refused everywhere.
- A cookie captured from another browser works until consent. It is a bearer secret (httpOnly, Lax, path `/connect`), like the session cookie.
- Double tap: one user; the attempt keeps no vendor user.

## Base-URL guard: holds

Case variants, `localhost.`, `[::ffff:127.0.0.1]`, `0.0.0.0`, `127.0.0.2` and userinfo or fragment tricks are refused. Everything allowed normalizes to loopback. `next start` with a remote or trailing-dot URL answers 500.
- Info: a redirecting loopback service would be followed, but only under `ALLOW_DEV_AUTH=1`, which is already undeployable.

## Cleanup: holds

A declined row gets `accounts=[]` and `institution=null`; claims, attempt vendor user and vendor user are gone.
- Low: 485 rows cleaned before the fix (test data) still hold snapshots. Backfill before real users.

## Self-review of new code

- **Cookie binding:** HMAC with constant-time compare; the method check stops email-attempt cookies being reused.
- **Low:** `boundAttempt` has no server-side age limit. Add `created_at > now() - 24 h`, which also keeps `cleanupAttempts` from removing a vendor user mid-portal.
- **Instrumentation guard:** runs before any route; skipped only in the build phase.
- **Landing redirect:** built from the database handle, never user input. No open redirect.
- **Metadata helper:** percent-only; "verified" only for whole broker records; no stats while importing.
- **Carried to PR-2b:** a victim lured into the attacker's own portal URL.
- **Owner:** the build step reports a framework security advisory.
