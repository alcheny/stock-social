COMPLIANCE: FAIL

# F-1 PR-2a · committee · engineer (2026-10-23)

Ran `ae9fb30` on :3103 (`ALLOW_DEV_AUTH=1`) against the vendor fake. Test data deleted; processes stopped.

## Step 4: first-time trader

Worked: attestation, portal, consent, import, profile, decline (claim released, vendor link deleted), failed (owner sees "Try again"; strangers get "not found").

Confusing:
1. Brokerage-first lands on `/connect?attempt=`, which says "Sign in first, then connect" and offers only an email-link button. Nothing leads to `/connect/start`. PR-2b must fix it.
2. With the tab open, the import stays at "0 closed trades so far" until the hourly tick.
3. A failed import never says why. The deadline is in UTC.

## Step 5: compliance

**High (§7, §10, P3): an open brokerage-first attempt can be taken over.** `/connect/start?attempt=N` signs a `connect_attempt` cookie for any open brokerage attempt, and attempt ids are sequential. Reproduced two ways:
- (a) No lure: a trader waits on consent; an attacker calls `/connect/start?attempt=N` then `/connect/done`, consents to a new pending link over the trader's accounts, and is signed in to a profile publishing those trades with the accounts claimed for good.
- (b) A lured victim links through the attacker's attempt link, and the attacker consents.

Fix: bind the attempt to the browser in `startSignIn` (signed cookie, as `bindAttempt` does). `/connect/start` reads only that cookie, never the query string.

**Medium (§10): `SNAPTRADE_BASE_URL` has no production guard.** `lib/broker.ts` passes it straight to `basePath`. Set in production, it sends signed requests and vendor secrets to that host. Fix: throw when `NODE_ENV=production`, as `lib/session.ts` does for dev auth.

**Medium (§3): data kept beyond its use.** `connections.accounts` (account ids, institution) and `institution` stay on declined and expired rows after cleanup. A declined brokerage-first row hangs off an attempt that is never deleted. Fix: clear both at `cleanup_done_at`.

**Low (from the code, not reproduced):** a double tap on brokerage-first consent creates two users. The losing tap resets the attempt and copies the vendor secret back onto it.

Pass:
- Positions are percent-only.
- Nothing pending is public (`consent_at` gates the state, paper counts and positions).
- Attestation comes before the user row.
- The cron bearer is required and checked with a constant-time compare.
- Steps and syncs run under `USER_LOCK` (sync uses the try-lock).
- New logs hold ids and statuses only.
- The vendor secret is encrypted and moves from the attempt to the user at consent.

## Attacker attempts that fail

- **Other users' connections:** `ownsConnection` checks the user id or the HMAC-signed attempt cookie, which cannot be forged.
- **Import step:** no id is accepted; only the session user's importing rows are stepped. The `sameSite=lax` cookie blocks cross-site POSTs. Replays are idempotent.
- **Forged ids:** `parseConnectionId` accepts digits only.
- **Replayed consent or decline:** only a pending row transitions. Cleanup spares links a live connection holds and never touches confirmed claims.
- **Sync without the bearer:** 401. **Deletion:** removes the vendor user and retries from the tick.

FAIL until the attempt binding and production guard land; fix retention alongside.
