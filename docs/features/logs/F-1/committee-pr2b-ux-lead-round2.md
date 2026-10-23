COMPLIANCE: PASS · USABILITY: PASS

# F-1 · PR-2b committee · UX lead, round 2

2026-10-23, `b2cefed` (product unchanged since `43d083d`). Port 3102, vendor fake 4152, no tick. 375/360 px, light and
dark, reduced motion, keyboard only. Screenshots: `screenshots/pr2b/committee-ux-round2/`.

## Demands

1. **Met.** Four combinations, portal loaded (< 0.4 s) and idle 15 s, sampled every 250 ms:
   - never "Taking longer than usual.", never the filled primary;
   - "Page blank? Open it in a new page." at 7.9–8.2 s beside a 45 px secondary "Open in a new page instead"
     (`s3-loaded-idle-9s-*`); quiet, and it reached consent by keyboard.
   - Before load unchanged: 3.0 s line, filled primary at 8.1 s (`s3-held-9s`).
2. **Met.** No `[role=status]` had an `aria-busy="true"` ancestor, loading or loaded; `aria-busy` is on the iframe only.

## Fixes checked

- **"Opening…"** (`aria-busy`) only during the mint (60–150 ms); label restored before the dialog opens. Focus on
  Close (2 px ring). Loaded Tab order: frame, "Open in a new page instead", Close; Close is the only exit.
- **Inset** ≥ 17 px left, right and bottom, before and after load. No horizontal scroll, no animations.
- **`/connect/continue`:** exact line, 44 px Continue, auto-continues after 2.0 s, then vendor, then consent.
- **Finish:** "Import finished." announced once; hidden (0 px) while "Your record is live." shows; banner removed
  5.0 s after finish; no empty box.
- **Visitor:** "Importing this record · …", no "your", no activities line; `description` and `og:description` match.
  Owner: "N activities imported".
- Requests only to the app and the fake.

## Notes (not blocking)

- `/connect/continue` leaves focus on the body; a status present at load may not be read before the 2 s move.
- Finish still shifts the page (CLS 0.98) as stats and the card insert (round-1 note 3).
- Round-1 demand 4 still waits on requests #4 and #9.

Server and fake stopped; 9 test users deleted.
