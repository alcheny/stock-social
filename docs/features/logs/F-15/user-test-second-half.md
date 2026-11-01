# F-15 second half: user test (business lead and UX lead, 2026-11-01)

360 × 740, production build. Fresh trader via `/login/dev`, one closed trade (-3.4%) added by SQL; then signed out.

## First-time trader (owner)
- Profile card "Share my record" (156×44), "Share October recap" (191×45), trade page Share, month page Share: each one
  tap, "Link copied" within 35 ms in the polite region, no alert, no error UI, no new text, badge or count anywhere.
  Each wrote one row (card, month, trade, month; sign `down`); links carry `?via=`. Nothing changed on screen vs main.
- The share prompt did not appear for this trader (no connection), so it was not walked.

## First-time viewer (signed out, from shared links)
- `/u/h?via=card`, trade `?via=trade`, month `?via=month`: pages unchanged; canonical present and untagged on all
  three; Share on trade and month copies the tagged link, announces "Link copied", sends no server action, writes nothing.

## Owner readout, G2
Read with 0, 1, 3, 5, 6, 7 and 8 of 8 strict traders sharing. Legend, "traders, not actions", the window's last day,
the 120-day retention, the sheet/copy meaning and the cohort line are all clear; no small count can be worked out.

## Demands
- **BL-1** (business lead). A lower bound on the strict row prints "≥ 6 of 8" with no percent, so the owner can't set it
  against "≥ 60%" at a glance. Print the bound's percent too ("≥ 6 of 8 (≥ 75%)").
- **UX-1** (UX lead). "≥ 0 of 8" (seen at 1, 3 and 8 sharers on the strict, sheet and copied rows) reads as "nothing" or
  as a bug. When the visible part is 0, print "(s)".
- **UX-2** (UX lead, minor). The "Shares made before…" line has no closing period; the other G2 lines are sentences.

Verdict: both leads accept the trader and viewer experience (no change, as planned); G2 passes once BL-1 and UX-1 land.
