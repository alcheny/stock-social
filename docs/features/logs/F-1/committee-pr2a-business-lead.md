COMPLIANCE: PASS · USABILITY: DEMANDS

# F-1 · PR-2a committee review · Business lead

Date: 2026-10-23. Branch at `ae9fb30`, fresh build, port 3101, in-repo vendor fake, 375×667, light and dark. Test
users deleted, server and fake stopped. No product code changed.

## Step 4: user test

**Signed-in path.** "Publish your trades" (1), then dev box and Continue (2, 3), then the profile ("You're in.
Next: connect your brokerage.") and its connect button (4). The trust notice's primary fits without scrolling (5).
Then the fake portal and consent: "2 accounts found (1 simulated, not imported)". "Import my record" (6) opened the
importing profile with "6 closed trades so far", the positions (QQQ +10.0%, XYZ -20.0%) and "1 simulated account
excluded". Finished: Verified, stats, chart; same signed out; share card with disclaimer. Calm and honest. A pending link plus an hourly tick stored and showed
nothing.

**Decline.** "Import not started. Nothing is connected." Vendor link gone.

**Failed import, signed out.** No Verified badge anywhere. The profile, feed card and the profile, trade and month
share images say "Import did not finish" and carry the incomplete line and the full disclaimer.

**What stopped me.**
1. **"Connect a brokerage instead" on `/login` is a dead end.** It lands on "Sign in first, then connect." with no
   connect button (`app/connect/page.tsx:35-41`). The server route `/connect/start?attempt=<id>` works end to end;
   no page links to it.
2. **The consent primary is below the fold at 667 px** (it ends at about 688 px). The scope lines repeat the trust
   notice, and "Decide by Oct 24, 1:28 AM UTC" is in a time zone the trader doesn't live in.
3. **A failed import tells the owner to celebrate.** Under the red incomplete line and "Try again" comes "Your record
   is live." with "Share my record": two primaries, contradicting each other.
4. While importing, "Your trades appear here as they import." sits above trades that already appeared.

Six taps where §5 demand 1 allows four.

## Step 5 (1): Compliance: PASS

Consent comes before any import or public fact: checked by hand and by tests. Failed and importing records are never
labelled Verified, and the importing state shows no stats. The disclaimer is on every performance image and page.
There are no advice or endorsement words. There are no third-party loads: the only external URL is the integrated
vendor's security page, a tapped link. The age gate is intact. The attempt-binding gap (demand 5) doesn't bypass
self-attestation.

## Step 5 (2): Usability and business: DEMANDS

1. **High: fix the brokerage-first dead end.** Signed out on `/connect?attempt=<id>` with an attested, unconsumed
   attempt, show the primary "Connect brokerage (read-only)" → `/connect/start?attempt=<id>`. Otherwise remove the
   `/login` option. Verify: an e2e test at 375 px from `/login` reaches the importing profile in four app taps.
2. **High: one primary on a failed record.** No share prompt in state `failed` or `importing`; "Try again" is the
   only primary. Verify: a failed-owner e2e test asserts neither "Your record is live" nor "Share my record".
3. **Medium: consent fits 375×667 with no scrolling.** Delete "Your brokerage is linked. Nothing has been imported
   yet." Merge the history and accounts lines into one. Replace the deadline with "Decide within 24 hours, or this
   link is removed automatically." Verify: a 667 px test shows the whole "Import my record" button in the viewport.
4. **Medium: no extra stop after signing in.** Sign-in from "Publish your trades" goes straight to the trust notice.
   Verify: an e2e test counts four taps from `/login` to the importing profile.
5. **Low: bind the attempt to its browser.** `/login` sets the signed `connect_attempt` cookie when it writes the
   attempt, and `/connect/start?attempt=` refuses the request without it. Verify: a second context with only the id gets no portal.
6. **Low: show the importing line only when no trades are listed.** Verify: a unit test by state and row count.

Engineer: 1 and 2 in PR-2a; 3 and 4 before Status: built.
Tester: add a walk from `/login`. Every walk started at `/login/dev`, which is how six rounds missed item 1.

## Demo sentence

"Connect your broker read-only, confirm once, and your record, losses included, is public behind a link that says
exactly what was verified."
