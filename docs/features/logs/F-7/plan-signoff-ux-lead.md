# F-7 plan sign-off: UX lead

Date: 2026-11-01. Reviewed: `plan.md` (round 3), against `plan-round1-ux-lead.md`, `plan-round2-engineer.md` §4,
`plan-round2-business-lead.md` and `plan-round2-legal.md`. Process note: this session had no subagent tool, so the
build session wrote this review in the UX lead's role (team/ux-lead.md), reading only the documents above and the
code they cite. All names in examples are fictional.

## Round 1 verdict: REVISE

The settlement keeps what mattered to me (no Follow, no Like, no thesis, no share prompt on a person who never
joined; a `/public-records` page; Demo beside Public filing on fixtures) and I accept the `/u` route on the owner's
"identical". Three gaps would leave the builder choosing interface details the committee did not agree.

### Blocking demands
1. **One final top-block copy.** Three versions exist (my round 1 §3, business lead demand 9, legal C15). Plan must
   fix the exact text and order: row 1 badge(s) + "Company insider" (muted); row 2 "Built from public filings. This
   person has not joined Stock Social, has not connected a broker, has not reviewed this record and does not
   endorse it."; row 3 "Record since ‹date› · last checked ‹date› · Request a correction or removal →" linking to
   `/public-records` (not `/how#…`), then "Filings can be late, amended or missing." and, after 7 days, "This record
   may be out of date." Test: e2e at 360 px asserts the rows in order, the link target and no horizontal scroll.
2. **No Like or Follow on public feed cards either.** AC 28 names the profile, pane and trade rows only. The feed
   card's Like button, the double-tap-to-like gesture (`app/feed-gestures.tsx`) and the card menu's Follow item must
   be absent on a public card, and a double tap on one does nothing (no hint, no animation). Test: e2e on a fixture
   public card; the server actions refuse a like or follow on a filer (already in AC 28).
3. **Decide the "no priced round trip" state.** AC 18 renders a page for a filer with no priced trade, while the
   business lead's demand 1 creates no `users` row for one. My recommendation: no page (the business lead's rule),
   so AC 18's second sentence is dropped and replaced by a test that such a filer 404s and is counted in the run.

### Non-blocking notes
- The pane gains the not-joined line and correction link; keep the pane's chart above the fold at 360 x 640.
- "Filing ↗" links inside rows need their own 44 px target; don't let them shrink the row's percent link.
- The share card's not-joined line must stay legible at the unfurl's small preview size (≥ 24 px at 1200 x 630).

## Round 2 verdict: SIGN

`plan.md` "Round 4 changes" items 1-3 meet demands 1-3: the top block's copy, order and link target are fixed and
tested at 360 px; public feed cards carry no Like, Follow or double-tap like; a filer without a priced trade has no
page. Notes above stand as non-blocking.
