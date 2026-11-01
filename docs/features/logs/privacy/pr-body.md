## What changes

The product work the Privacy Policy depends on (the legal committee's privacy findings). The policy and Terms text stays the owner's (`LEGAL_PLACEHOLDER` pages untouched).

1. **Launch gate** (`lib/launch-gate.ts`, `lib/privacy-gate-data.ts`): real sign-up and broker connection are **closed by default**.
   - `LAUNCH_OPEN=1` opens them.
   - `LAUNCH_ALLOWLIST` (handles) lets listed accounts connect while closed.
   - `LAUNCH_ALLOWLIST_EMAILS` (verified emails, env only) lets the owner create a test account and connect while closed.
   - A **sandbox** build counts as open. It needs all of: dev auth, the loopback vendor fake or no vendor, no real mail host, and no real sign-in provider. This is how the e2e suite keeps working with the switch closed. Each condition flipped alone closes it.
   - Enforced in: the email and provider callbacks (new accounts only; existing accounts still sign in), brokerage-first, `/connect`, `/connect/start` and `/connect/portal` (before any vendor call), and consent.
   - `lib/session.ts` and `lib/broker.ts` are untouched. The dev stub and demo data are allowed.
   - Closed states:
     - `/login` is titled "Sign in", shows a status line and hides "Connect a brokerage instead".
     - `?error=closed` shows a focused alert.
     - `/connect` says it isn't open, right under the heading, and keeps only the profile, settings or sign-in links.
     - Consent offers only "Don't import".
   - While closed, nobody can rename onto a listed handle. A production build with dev sign-in on lets no one connect, and its dev form creates no new accounts (existing handles still sign in).
2. **Policy-accuracy tests (CI):**
   - `COOKIE_TABLE` (`lib/privacy-cookies.ts`): a scanner fails on any cookie write not in the table, a row nothing sets, or a lifetime longer than the row says.
   - `PUBLIC_FIELDS` / `PRIVATE_FIELDS` (`lib/privacy-fields.ts`): the consent line must equal the text built from these lists, and every column of the public record tables must be classified.
   - `SCHEMA_MAP` (`lib/privacy-retention.ts`): every table needs a personal-data flag and a retention class; a new table without an entry fails.
3. **Copy:**
   - The consent screen's public-scope line is now the owner's "Public: … Private: … Your public record is also used …".
   - The other four consent lines stay, including "stays public if you disconnect", which P6 requires.
   - The likes line is the owner's text.
   - The consent page moves the deadline below the buttons and tightens spacing, so "Import my record" stays above the fold at 360×640 and 375×667.
4. **Log hygiene:**
   - `logSafe` (`lib/privacy-log.ts`) keeps only an error's class, status and code.
   - It is used in `lib/sync.ts`, `app/t/[symbol]/Watch.tsx`, `app/api/sync/route.ts` and `app/auth/email/route.ts`.
   - `lib/privacy-logs.test.ts` scans every console call in server code: any method, bracket access, aliases, and `JSON.stringify` of object literals with each entry checked. Before the fix it was red on `sync.ts` and the sync route.
5. **Purges on the tick** (`lib/privacy-purge.ts`, a fixed 5 s slot before the sync plus time left after it):
   - expired sessions;
   - unused sign-in links;
   - unfinished sign-ups older than 30 days, with their funnel steps, links and signed-out connections;
   - likes and rejects whose trade has been gone for 30 days. They are marked in `privacy_orphans` and unmarked if the trade returns. A like on a live trade is never removed on a timer.
6. **Append-only display log** (`display_log`, `lib/display-log.ts`):
   - One row per public record per UTC day: headline, 95% range, closed-trade count, open-position summary, evidence line. Percent only, from the profile's own functions.
   - A trigger refuses every update and direct delete. Rows go only with the account (the users cascade).
   - `displayedOn(user, day)` returns the latest row on or before the day, with `gap` set when that row is older than the day asked for, and `asOf` (when the row was taken, UTC).

## Decisions taken by the committee

The full record is at `docs/features/logs/privacy/committee-2026-11-01.md`: D1–D16 from planning, D17–D24 from review, D25–D28 from the orchestrator's review. The main ones:
- **D1:** an email allowlist, so the owner can create an account while closed.
- **D2:** the sandbox fails closed.
- **D5:** no account enumeration. The link is sent for any address; the refusal comes only after it is used.
- **D9:** the consent wording is untouched; the fold is fixed by layout.
- **D10:** a 30-day grace for orphaned likes and rejects, because trades can return.
- **D13/D19:** the privacy stages run after the sync, with their own lock `(41,0)`.
- **D14:** the display-log trigger.
- **D17:** account deletion keeps F-1's anonymous funnel rows (tested in `lib/delete.test.ts`) and now blanks vendor ids on them. Changing F-1's decision is the owner's call.
- **D25:** closed means no connection on a production build with dev sign-in, and the dev form creates accounts only while sign-up is open.
- **D26/D27:** a fixed privacy slot before the sync; the display log reports when each row was taken (`asOf`).
- **D24:** what Next.js logs for an uncaught error is outside the scanner's scope. `onRequestError` filtering is left to the security-hardening session.

Test changes: three existing tests changed to follow the new behavior.
- `lib/sync.test.ts`: now asserts the log line has the error class and not the message.
- `lib/likes.test.ts`, which-files check: names `lib/privacy-purge.ts` and adds a stricter check on its statements.
- `lib/likes.test.ts`, "no count" test: the original rule still applies to every other like line, and `LIKES.private` gets a new exact-string test.

Shared files, additive edits:
- `db/schema.sql`: new tables, indexes and a trigger, appended and idempotent.
- `lib/copy.ts`: the `LAUNCH` block, the scope line and the likes line.
- `app/globals.css`: a consent block.
- `lib/delete.ts`: one blanking statement.
- `e2e/connect.spec.ts`: one new test.

**Note for parallel sessions:** after merge, any new table must get a `SCHEMA_MAP` entry, any new cookie a `COOKIE_TABLE` row, and any new column on `closed_trades` or `open_positions` a classification in `lib/privacy-fields.ts`.

## Testing

All run locally against Postgres:
- `npx tsc --noEmit`: clean.
- `npm test`: 742 tests, 730 pass, 0 fail, 12 skipped. The base had 687 tests, so the count went up.
- `node scripts/autopilot.ts guard origin/main`: ok.
- `BASE_REF=main node scripts/compliance.ts auto`: one finding, in `node_modules/@img/sharp-wasm32` (an optional dependency's license). The untouched base branch shows the same finding in this container, so it comes from the local install, not this change.
- `npm run build`: ok.
- `npx playwright test e2e/privacy-gate.spec.ts e2e/connect.spec.ts e2e/signin.spec.ts e2e/likes.spec.ts e2e/section.spec.ts e2e/app.spec.ts e2e/follow.spec.ts`, against the vendor fake: 118 passed, 3 skipped. The skips are provider and send-failure tests that need configuration; the base skips the same three.

User tests at 360×640, light and dark, on a closed-gate server and a sandbox server. Screenshots are in `docs/features/logs/privacy/screenshots/`.
- UX lead: compliance PASS; the two usability demands were fixed in round 2.
- Business lead: compliance PASS; the display-log starvation it found was fixed (D18).
- Tester: gate bypasses probed, none found; the defects it reported were fixed.
- Independent code review: nothing blocking; every should-fix was applied.

## Compliance

1. **Performance shown?** Yes, only in the display log, which stores the profile's own text: percent only, losses read like gains, the same evidence line. Nothing new is shown to readers.
2. **Personal data?** Yes, and less of it is kept now.
   - Purges: sessions, sign-in links (they hold email addresses), unfinished attempts and connections, orphaned likes and rejects.
   - Logs carry no messages or personal fields.
   - The new tables (`privacy_orphans`, `display_log`) both cascade on account deletion.
   - The cookie, field and retention maps are what the Privacy Policy is written from.
   - The consent screen names every public and private field and keeps "stays public after disconnect" (P6).
3. **Money?** No.
4. **Email, push or tracking?** No new sends. No trackers.
5. **User text?** No.
6. **Sign-up, age, identity?** Yes: the launch gate closes real sign-up until the owner opens it (P6). The 18+ attestation is unchanged and every path keeps it.
7. **Vendors, dependencies?** None added. `package.json` is untouched by this PR.
8. **Accessibility:** closed notices use `role="status"`, and the refusals use a focused `role="alert"`. Controls are at least 44 px. No horizontal scroll at 360 px.
9. **Security:** the gate is checked before any vendor call. Allowlists are env only. While closed, a production build with dev sign-in on lets no one connect. Allowlisted handles can't be taken by a rename. The tick's report carries list sizes only.
10. **Claims?** The closed copy gives no date and makes no promise.
11. **Checkout?** No.

Committee record: `docs/features/logs/privacy/committee-2026-11-01.md` (plan: `plan.md`).

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01Cdty8pDmCujh84dwqLPFEZ
