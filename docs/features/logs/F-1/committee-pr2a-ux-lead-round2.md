COMPLIANCE: PASS · USABILITY: PASS

# F-1 · PR-2a committee, round 2 · UX lead

Date: 2026-10-23, at `814e880`. Current production build on port 3102, vendor fake, no cron tick.
I checked 375×667 and 360×640, light and dark, keyboard only; no horizontal scroll anywhere. Screenshots are in `screenshots/pr2a/committee-ux-round2/`.

## Re-test

- **Consent:** one scope line, and the deadline has no time zone ("Decide within 24 hours…"). "Import my record" ends
  at y 616 of 667 and at y 639 of 640, no scroll; 5 Tabs.
- **Landing:** an email sign-in (keyboard) lands on "Before you connect", signed in. The primary is 7 Tabs and "Your
  profile" is 44 px. A trader with a record lands on the profile.
- **Brokerage-first:** `/login` → notice (no id in the URL) → portal → consent → importing profile: 4 app
  actions, all by keyboard.
- **Failed owner:** no "Your record is live.", "Share my record" or new-trades prompt. "Try again" is 101×44 at 375
  and 360 and shows the 2 px ring. **Demands 1 and 2 met.**
- **Importing line:** only with 0 trades listed; with 5 listed, the banner alone. No share prompt while importing.
- **Link preview:**
  - importing: "Importing your record · 0 closed trades so far"
  - connected: "8 verified trades"
  - failed: "The import did not finish… 5 closed trades"
  - demo: "30 demo trades"

## Carried items

- **(a) Still deferred:** the banner read 0, 0, then 8 over a 3-page import.
- **(b) Moot:** the deadline has no clock time.
- **(c) Still deferred:** the abandoned result's second action is still "Not now".
- **(d) Still deferred:** the expired heading is still two sentences.

## Notes (not blocking)

- **(e) For PR-2b:** an empty profile previews as "0 closed trades · % win rate", with the number missing.
  Already on `main`; with 0 trades say "No trades yet.".
- At 360×640, "Don't import" is one scroll or one Tab below the primary. Acceptable.
- Outside the diff: chart range buttons are 35 px.

## Step 5

- **(1) Compliance: PASS.** §3 consent precedes reading; §7 every path is attested; TR-3 no partial or demo record
  previews as "verified" and a failed record invites no sharing; §9 focus, 44 px targets and 360 px reflow pass.
- **(2) Usability: PASS.** Both demands met; a, c and d stay with PR-2b, b is moot, e is added.

Server and fake stopped; 4 test users deleted.
