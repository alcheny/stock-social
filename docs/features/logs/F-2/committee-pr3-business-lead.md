# F-2 · PR-3 committee · Business lead

2026-10-23. Build of `e84513e` (rebuilt with `CI=1 npm run build`, stdin closed: the first run stopped on the framework's
security advisory, the retry exited 0). `next start` on 3113 with `ALLOW_DEV_AUTH=1`, vendor fake on 4193, Postgres 16, my
own database (created as the superuser, owned by the shared role; schema and demo seed applied; dropped afterwards). No
sync tick. Fixture: the 3 demo traders plus 42 scratch traders: 30 established (25 closes over 60 days, accounts 120 days
old, all five holding buckets), 2 all-loss records, 1 hyperactive (80 closes in 2 days), 5 newcomers with 4 closes, 4
newcomers with 6 closes (accounts 4 days old). Three dev-signed-in viewers. All 45 scratch users were deleted before the
drop. 375×667 touch (CDP touch events, native scrolling), light and dark; the engineer's 1280 screenshots. Server and fake
stopped. No product code changed. Scripts and screenshots are in the scratchpad `bl/f2pr3` (not committed).

**Decision: one fix round, then merge.** The section is honest, quiet and compliant: no number on a row, a true heading,
losses ranked like gains (both all-loss records were rows on page 3), signed out it writes nothing. But the reject swipe
commits on a short flick, which the plan's own threshold forbids, and two of the three reason templates spend the row's
only line on something less useful than the fact they replace. The bigger problem is not this PR's to fix: today the
section shows only traders who already have cards in the same list, so it adds no reach. That is PR-1b's job, and I
accept a PR-1b before PR-4.

## User test

- **Signed out, page 1.** Five trade cards, then a full-height card: "More records", a two-line grey explainer, three
  rows (name, handle, badge, one reason line). A vertical swipe anywhere on it, rows included, moves to the next card
  (index 6 → 7 from the heading, a row and the empty area). The rhythm holds: it reads as one interstitial per 30 cards,
  the familiar "accounts to look at" card in a full-screen vertical feed (analogy).
- **The card is two-thirds full.** At 375×667 the rows end at 502 px; the bottom 165 px are empty, in light and dark. On
  a taller phone it is worse. It looks like a page that failed to load its last rows.
- **Tap a row → the sheet.** It opens the same pane as a feed card: chart, "+129.5% · All time", win rate, avg return,
  last trades, "See full profile →". Esc closes it and focus returns to the row. No non-GET request was sent signed
  out. The name is cut to "Stead…" at 375 to keep the handle whole (UX call; acceptable).
- **The sheet's disclaimer is not "in view".** The log (§8.1) says "the F3 line in view". It is at y 1,120 in a
  667 px viewport, below the stats, at the bottom of a 1,187 px scroll. That is the same place the layout footer puts it
  on the feed and the profile (the convention the F-1 committee accepted), so it is parity, not a regression. The log
  claim is wrong and must be corrected (demand 4).
- **Signed in.** Each row gains Follow (112 × 45, outline) and "…" (both ≥ 44 px). The reason line then wraps:
  "Typical holding / period: 1 to 6 months" and "Closed a trade this / week" (an orphan word). The menu item stays on
  screen (x 83 to 350 of 375). It opens over the row's reason text with no shadow (PR-2 follow-up 2, still open).
- **"Not interested" from a row.** The row collapses, "Hidden for 90 days." with Undo focused appears at the bottom, the
  reader stays on the section, and 2 rows remain (no backfill, so nothing moves under the finger: right). Undo restores
  the row.
- **The reject swipe.**
  - Signed in at 375, the swipeable part of a row (name and reason, Follow and "…" excluded) is **149 px** wide, so
    "half" is 75 px.
  - A slow 30% drag snaps back. A slow 70% drag commits. Opening the sheet with the other direction works.
  - **A fast 40% flick (60 px, no hold) committed a hide**: one exclusion written, row gone. That is the "native fling"
    the log lists as a known limit. It contradicts the plan ("commits past 50% of the row width") and the swipe's only
    safety argument. Measured against the row the reader sees (343 px), the hide fired at 17%.
- **Reach, in practice.**
  - All 40 eligible traders had cards in the list (36 to 40 traders across 200 cards). Every one of the 21 section rows
    across 7 sections was a trader who also had cards in the same list. The section today re-presents the feed; it
    does not widen it.
  - The 6-close newcomers (weight 0 under the lower bound) appeared as rows only in the 7th and last section, after
    card 185. Their reach comes from their feed cards (6 each), not the section. That follows criterion 8 and is fine,
    as long as the feed's exploration does the newcomer job.
  - The 4-close newcomers appear nowhere (the feed's ≥ 5-close rule from F-1, not PR-3).
  - "New here this month" appeared only on the two Demo seeds (accounts created by the seed) and on the 6-close
    newcomers in the last section. At launch it will be on every row (log §5), which says nothing.

## Questions asked of me

- **Does the section earn its place after card 5?** Yes as a slot, not yet as content. One quiet card per 30 does not
  break the swipe, and position 6 keeps the first five cards as records (my round-2 ruling). What it shows today adds no
  trader the reader would not reach anyway. PR-1b makes it earn the slot.
- **Heading "More records" vs the plan's "More verified records".** Accept. A Demo or failed-import record can be a row,
  so "verified" would be untrue on some rows. Delete "The same for everyone." from the explainer: it answers a question a
  first-time reader never asked. Keep "Records with more evidence come first, losses counted like gains.": that is F1's
  "ordered by the documented method", in eleven words.
- **The reason templates.** All three are true by construction (tests plus my fixture). None names a security, a
  direction or an outcome, so none reads as advice. But:
  - "Typical holding period: …" is the one fact a reader can use to choose whom to read. Keep it.
  - "Closed a trade this week" is chosen only so that two rows never read the same, not because it is why the row is
    there. Almost every trader in a recency-ranked feed closed a trade this week, so it carries no information. It is
    also the one line that reads as "something is happening now" next to a Follow button, the edge of F3b's "looked
    up, not broadcast". Delete it.
  - "New here this month" will be on every row for the first month and hides the holding period that would have been
    useful. The sheet already says "N closed trades since …". Delete it.
  - Result: one template, the holding period, on every row. Two rows in the same bucket read the same, which is true and
    fine; the ≤ 2-per-bucket rule already keeps the three rows varied.
- **The pane as a sheet, with the disclaimer.** Accept the sheet. It is the same pane component, it closes the familiar
  ways, and focus returns. Accept deviation 8 (the sheet carries the F3 line). The line sits below the fold, like the
  footer elsewhere. If the owner wants F3's "plain view" read as "on the first screen", that is a product-wide change
  for every pane and profile, not a PR-3 fix.
- **The reject swipe's feel and risk (O1 open).** The non-colliding form is right: feed cards keep SW-1, a vertical
  drag on a row scrolls the feed, a diagonal does nothing, and the menu is the visible button. The threshold is wrong:
  75 px of finger travel, or less on a flick, hides a trader for 90 days. Undo (5 s) and `/me/following` make it
  recoverable, so this is a small blocker, not a design failure. My recommendation to the owner for O1 is unchanged:
  section rows only.
- **Deviations.**
  1. Reject swipe in PR-3: accept (the brief moved it).
  2. "More records": accept (above).
  3. "Closed a trade this week" over "Closed a record this week": the wording fix is correct, and the template should go
     (above).
  4. Reason choice order: moot once one template remains.
  5. Traders not yet shown in an earlier section first: accept. It is the right instinct, and PR-1b should extend it to
     "traders with no card in this list first".
  6. The section is not a `.row`: accept. It keeps every PR-1/PR-2 index, the pager count and SW-1's keys intact; the
     arrow keys simply do nothing on the section, which has no pane of its own.
  7. Follow and "…" outside the swipe container: accept the reason (an unclipped menu). Its side effect, a 149 px swipe
     area, is what makes the threshold too short (demand 1).
  8. The sheet carries the F3 line: accept.
  9. "Not interested" kept in the pane header: accept (my PR-2 ruling).
- **The carried items and PR-1b.** Accept a PR-1b, built **before PR-4**. Likes and gestures add engagement on records
  readers already see; PR-1b decides whether a connected trader gets seen at all, which is this phase's gate. Scope, and
  nothing else:
  1. The exploration pool includes eligible traders outside the 200 candidates (best recent close, one card each,
     seeded order).
  2. The section's pool is every eligible trader, not the 200's traders. Traders with no card earlier in the list come
     first; within each group the order stays the TR-9 lower bound (criterion 8 unchanged).
  3. A per-card score discount, so the hyperactive traders stop recurring in the same order.

  Acceptance test (one fixture, signed out, 7 consecutive UTC day seeds): 40 hot traders, 60 ordinary traders and 5
  newcomers with 5 or 6 closes.
  - ≥ 80% of eligible traders appear as a card or a section row in the first 120 cards (with those pages' sections) at
    least once over the 7 seeds, and every newcomer appears at least once.
  - In every section rendered while an eligible trader with no card earlier in the list exists, at least 2 of the 3
    rows are such traders.
  - Skewed fixture: no 3-trader sequence repeats in the first 60 cards; hyperactive traders ≤ 27 of the first 60;
    the diversity caps and the sign-invariance property tests unchanged.
  - Budgets: signed-out p95 < 400 ms on the 50-heavy fixture plus 100 light traders; page HTML ≤ 500 KB.
  - ≤ 400 product lines.

## Scorecard

| Dimension | Score | Evidence |
|---|---|---|
| Market demand | 4 | An "accounts to look at" interstitial is common in full-screen vertical feeds (analogy). The owner placed suggestions as a feed section (F-2 decisions). |
| Ease of adoption | 4 | Zero new steps: it arrives in the swipe, a tap opens the familiar pane, Esc and Back close it. Signed out there is nothing to trip on. |
| Phase fit | 3 | Today every row is a trader the same list already shows (21 of 21 rows), so it adds no reach. 4 with PR-1b. |
| Revenue impact | 3 | Indirect: Follow from a row feeds PR-5. No reach gain yet for connected traders. |
| Aesthetics & clarity | 3 | Clean type and tokens in light and dark. The bottom 165 px are empty at 667. Reasons wrap to orphan words when signed in. The focus ring is inset and clipped at 1280. |
| Trust & compliance | 5 | No number on a row (e2e plus my walk). Losses ranked like gains (all-loss records were rows). No advice words. Signed out: no write and no viewer read. True heading. |
| Simplicity | 3 | Three reason templates where one does the job; an explainer sentence no one needs. |
| Craft & taste | 3 | Focus handling and Undo are excellent again. A 60 px flick hiding a trader for 90 days is not. |

Clears the bar for Market, Ease and Trust; the 3s are fixed by demands 1 to 3 and by PR-1b.

## Deleted, and what I said no to

- **Delete:** the "Closed a trade this week" and "New here this month" templates (one reason: the holding period); "The
  same for everyone." from the explainer.
- **No** to backfilling a row after a hide (nothing should move under the finger).
- **No** to a newcomer slot inside the section. Criterion 8 orders the section by evidence; exploration in the feed is
  where a new trader gets seen. PR-1b tests that.
- **No** to moving the disclaimer to the top of the sheet in this PR (product-wide question; owner's call if raised).

## Evidence

- Observed behavior, this build (tier: observed behavior, our own build): every number above, from my walk scripts.
- Engineer's log `build-pr3-engineer.md` §2 to §4 (595 unit, 109 e2e, p95 313 to 319 ms signed out with a section).
- I re-ran `lib/discovery/section.test.ts` and `lib/copy.test.ts`: 27 of 27 pass. `node scripts/compliance.ts diff
  origin/main`: only the pre-existing `@img/sharp-wasm32` licence line from local `node_modules`.
- Interstitial suggestion cards in vertical feeds, and unfollow-versus-mute: analogy only. We have no user data of our
  own (no event table before PR-5, by design).

## Revenue chain

- Eligible traders outside the 200 candidates × share reached by a section row or exploration card × share of those
  readers who follow = new private follows that PR-5 can rank on. Phase value is connected traders who get seen, which
  is what retains supply.
- Today the middle factor is 0 for the section: it reaches no trader the feed does not already show.
- The sensitive assumption is how fast eligible traders pass the ~35 that fit in 200 candidates. The cheapest test is
  PR-1b's 7-seed fixture, run in CI within two weeks, before any real viewer.

## Demands

1. **Blocker, builder: the reject swipe commits only on finger travel ≥ half the visible row card**, never on where the
   browser's fling lands.
   - Decide at `touchend` from the finger's travel; if it is under the threshold, snap back regardless of momentum. The
     threshold is half the row card (about 170 px at 375), not half the 149 px swipe area.
   - Verify (e2e, 375, touch): a fast flick at 40% of the row card (4 ms steps, no hold) writes no exclusion and the row
     is at rest; a slow drag at 51% commits; the existing 49%/51% unit cases are restated against the row card width.
2. **Builder (this fix round, deletion): one reason template.** Every row reads "Typical holding period: …". Delete
   `SECTION.week`, `SECTION.fresh`, the `week` and `new` branches of `reasonFor` and their tests' expectations (no test
   count drop: restate them as "every row's reason is its bucket").
   - Verify: on the e2e fixture every row's reason equals its record's bucket; the copy scan still passes.
3. **Builder, copy:** the explainer reads "Records with more evidence come first, losses counted like gains." only.
4. **Builder, log hygiene:** correct §8.1. The sheet's F3 line is at the bottom of the sheet (y 1,120 in a 667 px
   viewport), not in view; parity with the footer elsewhere.
5. **UX lead (taste, not blocking):**
   - The section card is two-thirds full at 375×667. Center the heading-plus-rows block vertically in the card, so it
     reads as an intentional interstitial on every phone height.
   - Signed in, the reason wraps to an orphan ("this / week", "holding / period"). Move Follow and "…" to the name line
     and give the badge and reason one full-width line, as signed out does.
   - 1280: the row's focus ring is drawn inset and clipped at the right edge; draw it on the row card's border.
   - Give the "…" popover the 1-step elevation (PR-2 follow-up 2): it still sits on the reason text with no shadow.
6. **Planner: PR-1b before PR-4**, with exactly the scope and acceptance test above.
7. **Reviewer, add to the checklist:**
   - Every gesture threshold tested with a fast flick, not only slow drags.
   - Every "in view" claim checked against the element's box and the viewport.
   - For any discovery surface: count how many of its traders the same list already shows.

## What would change my mind

- **Demand 2:** if five readers shown the section say "Closed a trade this week" helps them choose whom to read, keep it
  as a second line for that bucket. Fastest test: five readers, the section with and without it, one question.
- **Demand 1:** none. The plan's threshold is the swipe's safety case.
- **PR-1b before PR-4:** if the owner wants likes first for PR-5's signals, PR-1b can follow PR-4, but it must merge
  before eligible traders pass ~35, measured in production.

## Demo sentence

"Every 30 cards, three more records, ranked by evidence with losses counted like gains; tap one to see it whole."

COMPLIANCE: PASS · USABILITY: DEMANDS
1. Blocker: the reject swipe committed on a fast 60 px flick (40% of the 149 px swipe area, 17% of the row card). Decide
   on finger travel at touchend; threshold half the row card (~170 px at 375); e2e a fast 40% flick → no exclusion.
2. Builder (deletion): one reason template, the holding period, on every row. "Closed a trade this week" carries no
   information and reads as activity; "New here this month" will be on every row at launch and hides the useful fact.
3. Builder: explainer drops "The same for everyone.".
4. Builder: correct log §8.1; the sheet's disclaimer is below the fold (y 1,120 of 667), at parity with the footer.
5. UX lead (not blocking): center the section block vertically (165 px empty at 667); no orphan wraps signed in; focus
   ring at 1280; popover elevation.
6. Planner: PR-1b before PR-4: exploration beyond the 200, section pool = all eligible traders with uncarded traders
   first, per-card discount. Acceptance: ≥ 80% of eligible traders seen in the first 120 cards over 7 seeds, every
   newcomer seen, ≥ 2 of 3 rows uncarded while any exist, no repeated 3-trader run in the first 60, p95 < 400 ms.
7. Reviewer: test gestures with fast flicks; verify "in view" claims by box; count a discovery surface's overlap with
   the list.
8. Accepted: "More records"; section not a `.row`; new faces first; sheet with its own F3 line; "Not interested" kept in
   the pane; O1 default (section rows only).

## Round 2 (2026-10-23, HEAD 24d93d1, fix round 1)

Verified as a user: fresh production build of HEAD, `next start` on 3115, the vendor fake on 4195, my own database
(created by the superuser, owned by the shared role, dropped afterwards). No sync tick; the shared database untouched.

| Round 1 item | Check | Result |
|---|---|---|
| 1. Blocker: reject on a fast flick | Signed in, 375×667, real touch events on the first section row (343 px card) | Delivered. 60 px in 30 ms: no tray commit, no Undo bar. 40% (137 px) in 30 ms: nothing. 40% slow (480 ms): snaps back. 55% slow: commits, "Hidden for 90 days." bar with Undo. 60% fast: commits (the finger really travelled past half). Undo restores the row and ends the exclusion (`until` set at undo time); the sheet never opened on a rightward swipe. |
| 1. Tray label | Source and screenshot | "Hide", whole once revealed. |
| 2. One reason template | Page HTML | Every row reads "Typical holding period: …"; "Closed a trade this week" and "New here this month" are gone from the product. |
| 3. Explainer | Page HTML | Heading "Other traders' records"; line "Ordered by how much evidence each record has. Losses count the same as gains." Nothing about "the same for everyone". True signed in and out. |
| 4. Log §8.1 | Engineer log row 5i | Corrected. |
| Ordering (criterion 8) | Own fixture: 30 established, 2 all-loss records, 5 + 4 newcomers, 1 hyperactive; weights recomputed independently with `evidenceWeight(confidence())` | Delivered. After removing the 10 cards around the section (which held the 7 highest weights), the rows were exactly the next three by weight (ranks 8, 9, 10), bucket cap respected. The all-loss record ranked first by weight: losses weigh like gains. The 80-close hyperactive trader ranks by evidence, not volume. |
| Section on page 1 with 50 heavy traders | 50 traders × 60 closes, 45 sharing the 1–7 day bucket | Delivered. Section rendered on page 1, signed out; rows 2 × "1 to 7 days" + 1 × "1 to 4 weeks" (cap holds while choosing). Page 261 KB, 70–90 ms warm. |
| PR-1b scope | Engineer log "Next PR" | Recorded as I asked, with the acceptance test. |

Cleanup: 43 + 50 test users and my viewer deleted (`blp3_%`), server and fake stopped, database dropped. No product
code changed.

### Still open (not blocking, carried in the engineer's follow-ups)

- Section block two-thirds full at 375×667 (165 px empty below the third row, seen again this round): center it.
- Signed in, the reason still wraps to two lines beside Follow and "…" ("Typical holding / period: …"). One template
  made it shorter, not whole: put Follow and "…" on the name line so the reason gets the full width.
- Focus ring at 1280 and "…" popover elevation.
- PR-1b is the next PR, before PR-4. Today a newcomer with 4 to 6 closes has weight 0 and never reaches a section row
  while 12 established records exist: the section serves evidence, PR-1b must serve new faces.

### Ready-to-merge statement

PR-3 is ready to merge. The blocker is fixed where it matters, at the finger: a fast short flick no longer hides a
trader, and only a deliberate travel past half the row does, with Undo that really ends the exclusion. The section now
says one true thing per row, orders by the documented lower bound with losses weighted like gains (verified against an
independent recomputation, an all-loss record ranked first), and still appears on page 1 under a 50-heavy load within
budget. What remains is layout polish already queued for the UX lead and the exposure gap PR-1b closes next; neither
changes what a signed-out reader from a shared link sees or trusts.

COMPLIANCE: PASS · USABILITY: PASS
