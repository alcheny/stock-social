COMPLIANCE: PASS · USABILITY: DEMANDS

# F-1 · PR-1 committee review, round 2 · Business lead

Date: 2026-10-22. Branch `claude/adoring-euler-4469ys` (4ff0b95), rebuilt, production server on 3101 with the in-repo
issuer and sink, local Postgres 16, Chromium at 375px light and dark. Same user test as round 1 plus a check of every
table and the server log. No product code changed.

## 1. Compliance: PASS

The §3 / P6 failure is closed, as the DB shows for a trader I created: after the link signs in, zero `login_links`
rows hold the address (the row stays with `used_at` set, `email = ''`); the address lives only on `identities`.
Expiry: an expired row for the same address is gone after `POST /api/sync` (`purgedLinks: 1`); the live row stays.
Deletion: `deleteProfile` leaves zero rows with the address in `login_links` or `identities`, no `users` row, the
handle reserved. Server log: no address, token or link. Attestation first, consent unchecked, no advice words: unchanged.

## 2. The five demands, as the trader sees them

1. **Redirect host: met.** Link minted on `localhost:3101`, opened on `127.0.0.1:3101`, lands on that host signed in.
2. **Method memory: met.** Order identical before and after the attestation error, brokerage last; after a completed
   email sign-in `email` is first; after a provider sign-in, that provider.
3. **First screen: met.** `h1` = `@handle`, once in `main`; "You're in. Next: connect your brokerage."; "Change handle"
   is a 148×45px secondary button.
4. **Signed-in `/login`: met.** `GET /login?ref=…&via=nav` → 307 `/u/<handle>`.
5. **Attribution: met.** Nav on a profile links `/login?ref=<handle>&via=nav`; `landed.meta = {"source":"profile"}`.

**Handle-change fix: met on the page.** After Save: URL, `h1`, `<title>`, `og:title` read the new handle;
`users.display_name = handle`; the old handle is nowhere in `main`.

## 3. Remaining demand

1. **Stale nav after a handle change.** Right after Save the nav still shows `@<old>` linking to `/u/<old>`, now a
   404; a reload fixes it. `app/auth/actions.ts:118` redirects without revalidating the root layout
   (`app/layout.tsx:22`). Renaming is a new trader's first act; the tap after it must not be "not found". Fix:
   `revalidatePath('/', 'layout')` before the redirect (as `app/actions.ts:51` does). Test: extend the e2e
   handle-change test; after Save, without a reload, the nav `.me` link reads `@<new>` with `href` `/u/<new>`.

Carry to PR-2a, unchanged: `/how` 404, footer legal links, `notice_seen` dedupe, provider e2e in CI (#12).

## 4. Taste

S1, both themes: the email input is ~290px wide under 343px buttons; make it full width. The nav truncates a
provisional handle (`@trader_d8sa…`); acceptable, the rename control is the fix. Dark primaries now read clearly;
the signed-out S2 is honest and ends the loop.

Demo sentence: "Tap the link in your email and your record page is already yours, read-only, no password."
