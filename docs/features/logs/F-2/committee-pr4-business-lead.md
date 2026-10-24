# F-2 PR-4 · Likes and gestures · business lead verdict

Date: 2026-10-24. HEAD 8bb09bf. Judged against `plan.md` (PR-4), the owner's O1/O4 decisions and the O3
recommendation in `docs/features/F-2-personal-discovery.md`, my rulings in `committee-pr1b-business-lead.md` §5,
`docs/POLICY.md` and `docs/COMPLIANCE.md` §1. Checked as a user on a fresh `CI=1 npm run build`, `next start` port 3123,
own Postgres 16 database (owned by the shared role, seeded), in-repo vendor fake on 4203, 375 px touch emulation with
real touch events. Server and fake stopped, database dropped (test user with it). Port 3000 untouched, no sync tick, no
product code changed.

## 1. Decision

**Ship PR-4, with three small copy/state demands for the follow-up (none blocks).** The like is the quietest correct
version of the owner's gesture: no count, no animation (0 running animations measured after the double tap), same on a
loss as on a gain, private by construction.

Demo sentence: "Double-tap a trade to keep it for yourself; swipe it away and you won't see it again; nobody else ever
knows either."

## 2. Scorecard

| Dimension | Score | Evidence |
|---|---|---|
| Market demand | 4 | Double-tap save and swipe-dismiss are the dominant short-form feed vocabulary (observed behavior tier); the owner chose them (O1). |
| Ease of adoption | 4 | Zero new steps; a 45 % swipe snapped back, 60 % hid; the "…" menu is the visible route. Loses a point: nothing teaches the double tap (acceptable, it is a shortcut). |
| Phase fit | 4 | Stores the explicit signals PR-5 needs, no event table (plan demand C held). |
| Revenue impact | 3 | Indirect: better feed later, not now. Passes, not a reason to build alone. |
| Aesthetics & clarity | 4 | Muted ♥ beside "…" in light and dark; menu sits top right and does not touch the hero. |
| Trust & compliance | 5 | Likes unreadable by every public query (tests), no counts, no celebration, no rewards; read-only; deletion covers both new tables. |
| Simplicity | 4 | ~517 product lines vs ~650 planned; one menu, one action per gesture. |
| Craft & taste | 4 | See §4 for the three details. |

## 3. Plan and decision conformance

- **Likes (plan PR-4):** delivered. Double tap 300 ms / 24 px, links and chart excluded, `touch-action: manipulation`,
  icon button with "Like. Only you can see likes." and `aria-pressed`, ≥ 44 px; polite status "Liked. Only you can see
  likes." confirmed live. Placement of the button moved into the "…" menu: acceptable deviation, it keeps the card clean.
- **O1 (reject on the card):** delivered as the owner amended SW-1: opening direction still opens the pane, the other
  direction hides the trade with the section's guards. My 45 % swipe snapped back; 60 % committed with Undo.
- **O3:** built as the committee recommendation (trade permanent as an exclusion row, trader −4 for 90 days), clearly
  marked "still the owner's to confirm" in the feature file. Correct while the owner is silent.
- **O4 restated criterion:** matches the owner's intent and my ruling: −1, never removes cards or section rows, ages out
  at 90 days, scoring use waits for PR-5. The test asserts the unfollowed trader stays in feed and section.
- **Stored but unused (honesty):** nothing shown is ranked by likes or rejects yet; the only visible effects are the
  viewer's own hidden trade and likes list. No copy promises "we'll learn from your likes", so nothing is overclaimed.
  `/me/likes` says "Only you can see your likes. Traders are never told, and nothing counts them." True today.
- **Signed out:** no menu; a double tap shows one line "Sign in to like trades. Sign in ×". Right weight, one action.

## 4. Taste and usability findings (my run)

1. **Liked and hidden at once.** I liked the JNJ card, then swiped it away: the trade is hidden for good and still listed
   in "Liked trades". Contradictory state. The reject should remove the like (Undo restores both).
2. **Menu label does not change.** With the trade liked, the menu still reads "♥ Like"; only `aria-pressed` and the
   small ♥ by the menu say otherwise. Sighted users need "♥ Liked" (filled), tap to remove.
3. **Permanence is not said.** The card toast reads "Trade hidden." while the section/trader hide reads "Hidden for 90
   days." The difference is real (forever vs 90 days) but the user is not told; Undo is the only exit. Copy should be
   "Trade hidden. You won't see it again." so the 5 s Undo window is an informed choice.
- The "…" menu does not crowd the card: one 44 px button top right, the hero untouched (375 light/dark).
- Muted ♥ is enough feedback: the double tap's own confirmation is the status line plus the icon; anything louder
  edges toward celebration.
- No confusion between the reject and the opening swipe in my run; the 400 ms guard and the half-card threshold held.
- `/me/likes` as a page: earns its place (the only way to get back to a kept trade); linked from Following. Fine.

## 5. Compliance (COMPLIANCE.md §1)

No advice or signals; no counts or public like data; no celebration, rewards or frequency incentives; losses treated as
gains; read-only; no new vendor or personal data; deletion removes likes and exclusions the same day; no event table;
no third-party names. PASS.

## 6. Demands

1. **Builder (next PR touching likes, before PR-5):** rejecting a trade deletes the viewer's like on it; Undo restores
   it. Test: like, reject, the likes list is empty; Undo, the like is back.
2. **Builder/UX:** the menu item reads "♥ Liked" with a filled icon when pressed. Test: e2e asserts the visible text.
3. **Builder/UX:** card toast "Trade hidden. You won't see it again." (or the owner's O3 wording once confirmed).
4. **PR-5 (honesty):** the moment likes or rejects change ranking, `/me/likes` and the hide toast say so in one plain
   line; until then, no such copy.
5. **Owner:** confirm O3 (trade permanent, trader 90 days).

## 7. What would change my mind

Accidental-reject rate: if more than ~2 % of rejects are undone within 5 s in the first two weeks of real use, raise the
threshold or drop the gesture to menu-only. The Undo tap count against reject count settles it.

COMPLIANCE: PASS · USABILITY: DEMANDS
1. Reject removes the like on that trade (Undo restores it).
2. Menu item reads "♥ Liked" (filled) when the trade is liked.
3. Card toast states permanence: "Trade hidden. You won't see it again."
4. PR-5: disclose in copy when likes/rejects start shaping the feed.
5. Owner to confirm O3.
