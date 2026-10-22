COMPLIANCE: PASS

# F-1 · PR-1 committee re-sit · Engineer (round 2)

Date: 2026-10-22. Branch `claude/adoring-euler-4469ys` (4ff0b95), checked against the live code and the local
Postgres 16 (links, delete, attempts DB tests: 15 pass; SQL probes). No product code changed.

## My compliance failure (§3 / P6): gone

- Claim: `claimLink` sets `used_at` and `email = ''` in one atomic update; a second tap reads `used`.
- Expiry: `purgeExpiredLinks` deletes rows past `expires_at`, from `POST /api/sync` and before every send.
- Deletion: `lib/delete.ts` deletes `login_links` by the user's attempts and by the addresses on the user's
  identities, in the transaction, before the `users` row. Tested: zero rows carry the address afterwards.
- Probe: only send-failure rows (kept ≤ 15 min for "Send again") hold an address; none expired.
- Column sweep (schema and every write): addresses live only in `identities.email` (cascades) and open
  `login_links`; tokens sha256 at rest; vendor secrets AES-GCM. `funnel_events.meta` refuses address-shaped values.
  No `console.*` carries an address, token or link; provider `why` values are fixed strings.

## Redirect host: gone

Every redirect in `app/auth/*` and `app/connect/*` is `${await origin()}${path}`; `req.url` only reads `?t=`.
Cross-host e2e test covers it.

## Production link guard

`requireLinkOrigin()` runs first on the email path, before any row is written; throws in production without
`NEXT_PUBLIC_SITE_URL` unless `ALLOW_DEV_AUTH=1`. Unit-tested.

## Security self-review of the new paths

- Method memory: httpOnly cookie, path `/login`, method name only; checked against the available list, never
  rendered; `brokerage` stays last.
- `login_email`: httpOnly, Lax, path `/login`, 254-char cap, 15 min, cleared when empty, never in a URL; rendered
  only as an escaped `defaultValue` on an error state.
- Resend: HMAC-signed attempt cookie, open attempt only, per-address-hash and per-attempt limits.
- Purge in `/api/sync`: behind the timing-safe bearer check; returns a count.
- Handle change: session owner only, regex-normalized, reservation check; display name follows only if
  provisional or blank.

Observations, not blockers: a handle race past `handleAvailable` surfaces as a constraint error, not
`HandleTakenError`; `setHandle` does not refuse demo users (dev stub only); without the site URL `origin()` trusts
`x-forwarded-host`, so production must set it (the link guard forces it).
