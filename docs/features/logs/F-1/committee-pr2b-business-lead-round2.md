COMPLIANCE: PASS · USABILITY: PASS

# F-1 · PR-2b committee re-sit · Business lead

2026-10-23. Build of `43d083d` (later commits are tests and docs), 375×667, light and dark. No tick. Cleaned up.

## User test

- **First session.** 5 taps. Portal in 0.4 s; "Your record is live." 12 s after consent.
- **Loaded, idle 15 s, click into the frame at 2 s.** Never the slow line, never a filled control. At 8.2 s:
  "Page blank? Open it in a new page." and a 45 px secondary. Demand 1 delivered.
- **Refused frame.** The probe sends the trader to the vendor's page in 92 ms, with no dialog. A refusal that
  slips past the probe gets a 44 px link from 0.3 s, and the quiet line at 8.1 s.
- **Popup blocked.** One line, Continue, automatic continue at 2.0 s.
- **Banner.** Owner: "N activities imported". Visitor and `og:description`: "Importing this record", no "your",
  no activities line. Demands 2 and 3 delivered.
- **Finish.** "Import finished." alone for 0.75 s, then only "Your record is live." is drawn. The banner is gone
  4.8 s later, with no empty box. Demand 4 delivered.
- **Padding.** The control sits 17 px inside the left and bottom edges, before and after load. Demand 5 delivered.

## Compliance: PASS

- Nothing is public before consent, and a partial record is never Verified.
- The disclaimer is on every screen, `/connect/continue` included.
- No requests leave the app and the vendor.
- The 18+ gate holds.

## Remaining demands (taste, not blocking)

1. **One sentence, not two.** Over a working portal, "Page blank? Open it in a new page." repeats the button.
   *Verify:* the footer shows only the button.
2. **Plain words on `/connect/continue`.** Say "pop-up" and name the integrated vendor, not "the vendor's page".
   *Verify:* no S3 string contains "vendor" or "embedded".
3. **Carried.** A 0.0% average return shows in loss red. A refused frame is a white box in dark mode.

## Demo sentence

"Five taps, one broker login, and twelve seconds later your verified record, losses included, is public."
