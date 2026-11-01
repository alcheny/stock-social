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

## Independent sign-off (fresh context)

Date: 2026-11-01. Written by the UX lead in a fresh context (team/ux-lead.md), not by the role-play above. Read:
the feature file, `plan.md` including "Round 4 changes", `plan-round2-engineer.md` §4 and `plan-round2-legal.md`.
All names are fictional.

### Verdict: REVISE

Round 4 fixes what the draft above asked for (top-block copy and order, no Like or Follow on public feed cards, no page
without a priced close), and I accept those. I don't accept the draft's SIGN, because four interface points are still
open or contradict a binding condition. A builder would have to choose them, and one would show a false "out of date"
warning on most real profiles.

### Blocking demands
1. **The not-joined line on every surface C15 names, with a test for each.** AC 15 tests the top block on the profile
   only. C15 and ruling (b) also require it on the pane, the trade page, the month page and the share image and unfurl
   description. Each of these surfaces must render, from one `PUBLIC` copy constant:
   - row 2 of the top block (the not-joined and non-endorsement sentence);
   - the "Request a correction or removal →" link to `/public-records`. The share image is the exception: it shows
     the line without the link.

   Test: e2e on a fixture filer asserts the sentence and the link's target on the pane, the trade page and the month
   page. It also asserts the not-joined line in the unfurl meta and the OG alt text. At 360 x 640 the pane's chart
   stays above the fold.
2. **Fix the feed card copy.** `plan.md` says "card line" but never gives its text. Use round-1 UX §3:
   - the thesis line reads "Company insider · from a public filing" (muted);
   - the footer reads "See their record, wins and losses →" and links to `/u/<handle>`;
   - there is no thesis, Like, Follow or double-tap hint.

   Test: e2e asserts both strings on a public card and none of those controls.
3. **"Last checked" must mean the source was checked, not that the filer filed.** `public_filers.checked_at` is
   "the last import that read this filer". Most filers don't file in any given week, so after 7 days the stale line
   ("This record may be out of date.") would show on nearly every honest profile. "Last checked" and the 7-day stale
   test must use the source's last successful import tick (`public_import_state.last_run_at`, set only when a tick
   finishes without stopping on backoff). Tests:
   - a filer with no filings for 10 days, whose source ran yesterday, shows no stale line;
   - when the source's last successful tick was 8 days ago, every filer shows the stale line.
4. **Keep `unhide`.** Round 4 §11 cut 3 drops `unhide`. C13 requires hide pending review to be reversible, and AC 23
   tests "unhide restores both". Without `unhide`, a hidden record can only be restored by hand-editing the database
   or by removing it outright. Drop cut 3. If the diff is over 800 lines, stop and flag it, as §11 already says.
   AC 23 stays as written, and the log check keeps `'unhide'`.

### Non-blocking notes
- The open-positions symbols are listed alphabetically, never by recency (legal ruling (d)). Add that to AC 19.
- The display name is shown as filed (C3). Don't apply CSS `text-transform` to it. Long names wrap without a
  horizontal scroll at 360 px.
- A hidden or removed filer's shared link lands on the app's normal 404, which links to the feed. It doesn't say why
  the record is gone, and it never names the person.
- Each "Filing ↗" link inside a row needs its own 44 px target, separate from the percent link (already in AC 26).
