COMPLIANCE: FAIL

# F-1 · PR-1 committee review · Engineer

Date: 2026-10-22. Branch `claude/adoring-euler-4469ys` (9aaeb27). Production build on port 3103, local
Postgres 16, in-repo fakes, Playwright at 375px light and dark. No product code changed.

## Step 4 · First-time trader and signed-out viewer

Worked: one attestation line, 44px controls, no horizontal scroll, disclaimer everywhere, inline
errors, a stranger at `/login/sent?a=N` gets no "Send again", legal pages
marked placeholders.

Confusion and hesitation:

1. **After the emailed link (and the provider) I landed signed out.** The link hit `127.0.0.1:3103`,
   the cookie was set there, and the redirect went to `http://localhost:3103/u/…`, where the header
   still says "Publish your trades". `app/auth/email/route.ts` and the callback redirect with
   `new URL(path, req.url)`; `req.url` carries the server hostname, not the request host. Behind a
   production proxy that sends a trader to `localhost`. Must fix before preview: redirect relatively.
2. **Own profile with nothing to do.** "No trades yet." plus a "Connect your broker" link; nothing says
   sign-in worked or what is next. The handle `trader_7lqhmoya` reads like an error.
3. **Brokerage-first loops.** Attest → "Connect a brokerage instead" → notice → primary → back to the
   sign-in page with "Sign in first" as the only explanation. Known, deferred to PR-2; a stranger leaves.
4. Small: 24px checkbox; email field narrower than the buttons; "Dev sign-in" visible to strangers;
   `/how` 404 from the notice; "expired" shown for an already-used link.

Signed-out viewer: new profile fine, "Verify your record" clear; demo profile unchanged.

## Step 5 · Compliance verdict on my own diff (§3, §7, §10)

- §7 age gate: every path (two providers, email, brokerage, dev) checks the attestation before
  `createAttempt`; `users.signup_attempt_id` NOT NULL. PASS.
- §10 sessions and links: 32-byte random tokens, HMAC-signed cookie, sha256 at rest, httpOnly, Lax,
  Secure under https; PKCE, state and nonce from a signed cookie deleted on use; single-use atomic
  link claim; no `console.*`, secret or address in any URL or error. PASS.
- §3 data minimization: **FAIL.** `login_links.email` is never deleted: not on claim, not on expiry,
  not on profile deletion (its FK points at `signup_attempts`, which survives). Proven: deleted a test
  user through `lib/delete.ts`: `users` 0, `identities` 0, `login_links` rows with the address 1. The
  tester's "all cascade" note is wrong for this table. Fix: delete on claim, purge expired rows from
  the hourly tick, delete by attempt on profile deletion; assert it in `lib/delete.test.ts`.
- §3 note: with `NEXT_PUBLIC_SITE_URL` unset, `origin()` trusts the Host header, so a forged Host puts
  an attacker's host into a victim's link. Production requires the variable; the sender should refuse
  to send without it.

## Security self-review

Link: guess the token (256 bits, hashed at rest); replay (atomic claim); after 15 minutes (rejected);
forged host (note above). Session: forge the cookie (HMAC, timing-safe compare); read by script
(httpOnly); CSRF (Lax, server actions origin-checked). Resend: guessed attempt id (needs the signed
per-browser cookie; 3 per attempt, 5 per address per 15 minutes, per process). Deletion: signed-out or
repeated call (session required); vendor failure (row stays marked, nothing else deleted).
