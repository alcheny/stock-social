COMPLIANCE: PASS · USABILITY: DEMANDS

# F-1 · PR-2b committee · UX lead

Date: 2026-10-23, at `936787f`. Port 3102 with the vendor fake, no tick. At 375 and 360 px, light and dark, reduced
motion, keyboard only: no horizontal scroll and no animations. Screenshots: `screenshots/pr2b/committee-ux/`.

## Walk

- **S3:** the primary is 7 Tabs from the top.
  - Enter opens a modal dialog named "Connect your brokerage". Focus moves to Close with a 2 px ring, the primary
    reads "Opening…" (`aria-busy`) and the page is scroll-locked.
  - Tab and Shift+Tab wrap. Escape while loading returns focus to the primary with its label restored.
  - "Taking longer than usual." showed at 3.6 s, and the link became a 44 px button at 8.6 s.
- **S7a:** Escape after load lands here, with focus on the heading (`role="alert"`). "Try again", "Continue in a new
  page" and "Not now" are each 44 px. "Continue in a new page" is 2 Tabs and reaches consent on the same attempt. `abandoned` is recorded once and the mode as redirect.
- **Fallbacks:** popup blocked goes to the vendor's full page, then consent (mode redirect). A refused frame stays
  blank for 8 s, then shows the line and the button, which complete the flow.
- **S5:** the banner box stays at y 183, 106 px tall, from importing to finished.
  - The per-step line went 0 → 8 → 16 → 24. The live status line moved 0 → 12 at the rebuild.
  - The 60 s line appeared at 73 s, to the owner only.
  - "Import finished." was announced once, with no motion.
- **S6 expired:** a two-line heading, with the body read through `aria-describedby`.
- **Strings:** S2, S3, S5, S6 and S7a match the plan and its amendments.

## Carried items

- **(a) Met** through the per-step line. I accept deviation 2: the announced count moves at the rebuild.
- **(c) Met.**
- **(d) Met.**
- **(e) Met:** an empty profile previews as "No trades yet.".

## What confused or stopped me

1. A loaded, working portal said **"Taking longer than usual."** after 8 s, with a filled primary button that
   outweighs the portal's own Connect (`s3-loaded-idle-9s-375-light.png`). The fake posts nothing until the trader
   acts.
2. The 3 s line's `role="status"` sits inside `.portal-body[aria-busy=true]`, so a screen reader may hold it until
   loading ends.
3. Not blocking: on finish, stats and the share card insert above the list (page CLS 0.82, banner 0).
4. Not blocking: after a blocked popup, the vendor page reappears unexplained.

## Step 5

**(1) Compliance: PASS.**
- §3 consent: every pending connection had 0 activities until "Import my record".
- §3 loads: requests went only to the app and the vendor fake.
- §9 met; item 2 is a defect, not a breach.

**(2) Usability: DEMANDS.**

1. **No false "slow" line over a loaded portal.** Test (e2e) on the fake portal, loaded and idle for 15 s:
   - The dialog never shows "Taking longer than usual.".
   - The new-page control is never the filled primary style.
   - After 8 s of silence, the footer may show "Page blank? Open it in a new page." beside a secondary 44 px button,
     "Open in a new page instead".
   - A refused frame gets that same line and button.
   - The 3 s and 8 s rules before load are unchanged.
2. **No live region inside a busy container.** Test: in S3, no `[role=status]` has an `aria-busy="true"` ancestor;
   `aria-busy` goes on the frame only.

Round-1 demand 4 (the real portal with popups blocked) still waits on requests #4 and #9.

Server and fake stopped; 9 test users deleted.
