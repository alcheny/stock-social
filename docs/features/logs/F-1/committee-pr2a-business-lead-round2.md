COMPLIANCE: PASS · USABILITY: PASS

# F-1 · PR-2a committee review, round 2 · Business lead

Date: 2026-10-23. Branch at `814e880`, build current, port 3101, vendor fake on 4131, 375×667, light and dark.
No cron tick run. Test users deleted, server and fake stopped. No product code changed.

## Step 4: user test

**Brokerage-first from `/login`.** Attest (1), "Connect a brokerage instead" (2), "Connect brokerage (read-only)" at
y 580–624 (3), the portal, then "Import my record" (4). The importing profile came up 1.6 s after the first tap.
**4 taps to a record, down from 6.** Finished: Verified, a -18.0% loss listed, "1 simulated account excluded". Signed
out (dark) it looks the same.

**Consent.** "Import my record" spans y 572–616 with no scroll. One scope line, "Decide within 24 hours…", no time
zone.

**Failed owner.** "Try again" (101×44) is the only primary. No "Your record is live.", no "Share my record".

**Importing owner.** With 0 trades: the banner plus "Your trades appear here as they import." With 4 trades listed:
the banner only.

**Second browser holding only the id.** No primary; start and done both 307 to `/login`. Each is logged as
`{"reason":"unbound"}` and nothing more.

## Demands 1–6: all delivered

1 dead end fixed · 2 one primary on failed · 3 consent fits 667 px · 4 no extra stop · 5 attempt bound to browser ·
6 importing line only with nothing listed.

## Compliance: PASS

Consent comes before any import or public fact. Failed and importing records are never Verified, and the failed
preview says "closed". The disclaimer is on every performance surface. No advice words. The only external link is the
integrated vendor's security page.

## Carried to PR-2b (not blocking)

1. **The evidence line shows twice on the profile.** "Too early to tell (3 of 10 bets)" sits under avg return and
   again below the grid (already on main). Verify: exactly one match in the profile text.
2. **A profile with 0 trades previews as "0 verified trades · % win rate".** Say "No closed trades yet". Verify: a
   unit test on the description at 0 closes.
3. **"Connected: broker (1 account)".** "broker" is a placeholder: show the institution or drop the word. Verify: an
   e2e test on the connected line.

## Demo sentence

"Four taps from sign-in and your record, losses included, is public behind a link that says exactly what was
verified."
