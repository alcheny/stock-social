COMPLIANCE: PASS · USABILITY: DEMANDS

# F-1 · PR-2b committee review · Business lead

Date: 2026-10-23. `936787f`, port 3101, fake on 4141, 375×667, light and dark. No tick. Test users deleted, servers
stopped.

## Step 4: user test

**Brokerage-first.** The taps were: attest (1), "Connect a brokerage instead" (2), "Connect brokerage (read-only)" at
y 580–624 (3), the portal login, then "Import my record" at y 572–616 (4). The portal was visible 0.2 s after the
tap. The banner counted up while I watched, and "Your record is live." showed 11 s after consent for 60 activities.
Signed out: Verified, losses listed, the disclaimer. While importing: no badge, no stats.

**Fallbacks and results.**
- Popup blocked: straight to the vendor page, then consent. One extra tap.
- Frame refused: a blank white box (white in dark mode too) for 8 s, then the promoted button.
- S7a: three 44 px actions. Declined and expired: correct wording.

**What stopped me.** After 9 s on a working portal, the modal said "Taking longer than
usual." and showed a full-width purple "Open in a new page instead". The fake posts nothing until the trader acts,
like the open point's real portal.

## Compliance: PASS

- Nothing is public before consent (the user row is created at consent).
- A partial record is never Verified.
- The disclaimer is on every screen.
- No advice or endorsement words; the notice uses the vendor's own words.
- Requests go only to the app and the vendor frame.
- The 18+ gate holds on both routes.

## Demands

1. **No false alarm on a working portal.** It pushes traders out of the password-free embedded login mid-choice.
   - A silent, working portal shows no "Taking longer than usual." and nothing styled as a primary.
   - A refused frame still gets a way out of at least 44 px within 8 s.
   - *Verify (e2e):* a silent fake, a click into the frame at 2 s, then 20 s with no line and the link still a link.
     The refused-frame test still passes. Then check the real portal on the preview (#4, #9).
2. **One noun per count.** "0 closed trades so far" next to "60 trades imported from your broker", followed by a
   record of 30 trades, reads as 30 lost. Call the rows "transactions", or drop the line.
   - *Verify:* no S5 string uses "trade" for activity rows.
3. **Visitors are not "you".** Signed out and in `og:description` mid-import, the copy reads "Importing your record ·
   0 closed trades so far" and "…imported from your broker".
   - Use "Importing this record · N closed trades so far"; no read line for visitors.
   - *Verify:* the visitor's text and the meta tags contain no "your".
4. **One finish announcement.** "Import finished." (with about 45 px of reserved empty space) sits directly above
   "Your record is live.". The acceptance criterion says the banner disappears.
   - *Verify:* exactly one of the two shows, with no gap over 16 px between the name and "Record since".
5. **The promoted button touches the bottom edge of the dialog.**
   - *Verify:* the button's bottom is at most the dialog's bottom − 16 px.

Carried (not blocking): a 0.0% average return is shown in loss red on the live card.

## First-session activation

**Met on the fake:** sign-in to a published Verified record in one sitting, four app taps, about 12 s of app time.
Unproven: real import time and real portal behaviour.

## Demo sentence

"Four taps, log in to your broker once, and seconds later your verified record, losses included, is public."
