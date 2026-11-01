# fixes-cycle2-a11y committee record, 2026-11-01

Scope: approval council cycle 2, "Fixes to build now" rows #12, #13, #14, #17, #18 (CSS parts), #26
(`docs/ideas/approval-2026-11-01-cycle2.md`). Committee: UX lead (plan, `plan-ux.md`), business lead and engineer
(reviews), tester, independent code reviewer. Overlap: the unmerged F-13 branch (`claude/f13-a11y-fixes`) already
fixes the light Verified text, the `:target` fill, the control borders, top scroll padding, the Like name and the
h1 / `.who` / badge reflow; this branch builds only the remainder and carries F-13's needed lines byte-identical.

## Round 1

- UX lead: plan drafted (`plan-ux.md`, Q1-Q6 with recommendations).
- Business lead: DEMANDS 1-4 (copy the control list; prove the merge claim; name the DS-6 and axis-line follow-ups;
  never clip the figure, badge or record link at 360×640). The teal/orange retune is approved for the product.
- Engineer: DEMANDS 1-9 (copy the control list; short-height padding; layout jump recorded; AC18.2 headroom; own
  fixtures; faithful a11ylib port with a fidelity test; outline measured on the painted backdrop; Verified tint line;
  keep the `:empty` comment).

## Decisions

1. 2026-11-01: #26 retunes both schemes to the design-system DS-4 values: light up #0b6b70 / down #b2441b, dark up
   #3cc4b4 / down #ff8a5b, edited in place in the token blocks; base tokens unchanged. Why: decided by the committee
   under the owner's instruction of 2026-11-01; dark's deutan ΔE00 6.3 is also under the spec's one threshold (9),
   and an end-block dark `:root` override would beat the light media block.
2. 2026-11-01: #12 the pane's current-row cue `.pane .rows .line.hl` is drawn with `--focus` (solid, 2 px, offset
   2 px, weight 600 kept). Why: decided by the committee under the owner's instruction of 2026-11-01; `--focus` is
   the design system's "you are here" role (6.15-8.47:1); weight 600 is the second cue, so colour is not the only one.
3. 2026-11-01: #14 while a fixed bottom bar shows (`.signin-line:not(:empty)`, `.hide-bar > p`, `.nojs-done`), feed
   rows' children reserve the bar's room (94 px; 86 px under `max-height: 480px`), and `html` and the pane scroller
   get `scroll-padding-bottom: 94px`; nothing goes on `.feed`. Why: decided by the committee under the owner's
   instruction of 2026-11-01 (Q1 option a); measured: the sign-in line fully covered "See their record" at 360×740
   and 360×640; rows do not scroll, so scroll padding alone cannot help; snap points are unchanged.
4. 2026-11-01: #14 the content moves up while a bar shows (about 33 px for the figure, 66 px for the footer); no
   transition, so reduced motion needs nothing. Accepted. Why: decided by the committee under the owner's
   instruction of 2026-11-01; the move follows the user's own action, and focus never sits under the bar.
5. 2026-11-01: #14 at 360×640 the card may clip below its record link but never the signed return figure, the
   Demo/Verified badge or the "See their record" link; at 360×480 the card scrolls (F-13's short-viewport rule).
   Why: decided by the committee under the owner's instruction of 2026-11-01 (Q2, business lead demand 4); card
   layout at short heights is F-10's row.
6. 2026-11-01: #13 this branch carries F-13's `--control` / `--focus` tokens and its control-border rule
   byte-identical, tested unconditionally; whoever merges second keeps one copy. The fixed bars' own border also
   moves to `--control`. Why: decided by the committee under the owner's instruction of 2026-11-01 (Q4, Q5 as
   overridden by business lead and engineer); F-20 is blocked on #13, and a skipped test proves nothing shipped.
7. 2026-11-01: #18 carries F-13's `h1`, `.who` and badge reflow lines byte-identical; under 420 px the signed-in
   handle link is capped at 18vw so the nav with F-13's "Trades by stock" stays ≤ 54.4 px (85% of the card's 64 px
   content top) and ≤ 61 px (85% of the 72 px scroll padding). Why: decided by the committee under the owner's
   instruction of 2026-11-01; measured 71.5 px with F-13's label and the current 34vw cap.
8. 2026-11-01: #17 is F-13's (accessible name = visible "Like"/"Liked", `aria-pressed`, note via
   `aria-describedby`); not duplicated here. Why: decided by the committee under the owner's instruction of
   2026-11-01; it edits `app/card-menu.tsx` and `lib/copy.ts`, where a duplicate would conflict rather than merge.
9. 2026-11-01: colour-vision distance is tested by a TypeScript port of the design-system `a11ylib.py` (2009
   matrices, linear light, CIEDE2000), with a fidelity check against the spec's published numbers (2.8 / 6.3 before,
   27.8 / 20.1 after, ±0.2). Why: decided by the committee under the owner's instruction of 2026-11-01 (Q3).
10. 2026-11-01: our block sits after `.rt-card:focus`, not at the end of the file, so it merges with F-13 without a
    conflict. Why: decided by the committee under the owner's instruction of 2026-11-01 (business lead demand 2):
    `git merge-tree` of an end-of-file block against `origin/claude/f13-a11y-fixes` conflicted in app/globals.css.

## Follow-ups owned elsewhere (business lead demand 3)

- DS-6 (share images, owned by the trust-fix session): the dark images hard-code #22c55e / #f43f5e; until DS-6 moves
  them to #3cc4b4 / #ff8a5b, a share card and the page it opens use different gain/loss hues.
- `app/t/[symbol]/Spread.tsx:35`, `app/t/[symbol]/Timeline.tsx:54` (owned by the trust-fix session): the 0% axis
  line is drawn in `--line` (1.20-1.31:1); DS-2 puts it on `--control`.
- Row #25 (warn): warn #8a5a00 vs the new loss #b2441b is 3.2 ΔE00 under deutan; the failed-import state keeps its
  icon, box and words (design system §2.7).

## Round 2

- Business lead: SIGN (condition: re-run `git merge-tree` against `origin/claude/f13-a11y-fixes` with the block at
  its new position and record the result below).
- Engineer: SIGN (decisions 1-10 cover demands 1-9; the cascade holds before and after F-13 merges; the unit test
  locates our block by its markers, not by end of file).

## Build (engineer), deviations recorded

11. 2026-11-01: under 420 px the nav also takes `body > nav.top { padding-block: 10px }`: the 18vw cap alone left it
    at 55.7 px (two-line links are 32 px), over 54.4; shipped 51.7 px at 360-420 and 48.6 at 320 with F-13's label.
    Why: decided by the committee under the owner's instruction of 2026-11-01; decision 7's limit needs it.
12. 2026-11-01: the F-13 twin also carries F-13's `max-height: 480px` card-scroll block and its three nav-wrap lines,
    byte-identical. Why: decided by the committee under the owner's instruction of 2026-11-01; decisions 3, 5 and 7
    assume them and they are not on main.
13. 2026-11-01: under 480 px tall the scrolling card also pads its own bottom (86 px) while a bar shows. Why: decided
    by the committee under the owner's instruction of 2026-11-01; without it a focused link scrolls under the bar
    (tested at 360×420).
14. 2026-11-01: AC12.2 is tested on the profile's "Similar trades" sheet, the only place a `.line.hl` row renders.
    Why: decided by the committee under the owner's instruction of 2026-11-01; feed panes mark no row.

Merge check (business lead's round 2 condition): `git merge-tree --write-tree <this tree> origin/claude/f13-a11y-fixes`
exits 0 with no conflict, with the block after `.rt-card:focus`.
15. 2026-11-01: after F-10 (#54) the room under 480 px tall is 90 px (bar 78 + F-10's 12 px card padding), the
    scrolling card pads 90 px, and the card's parts keep their size while a bar shows (the bar's room squeezed F-10's
    clamped thesis to 0 px at 320×420). F-10's card disclaimer joins the parts that are never clipped. Supersedes the
    86 px of decisions 3 and 13. Why: decided by the committee under the owner's instruction of 2026-11-01; measured.

## QA round 1 (user tests and independent code review)

- Business lead user test: PASS (compliance A1, F3, F4, P2; both journeys at 360 px, light and dark).
- UX lead user test: one demand — nav links are 16-21 px tall, under the 44 px target rule (pre-existing). Routed to
  #55 (F-13), which owns the nav rule from here on (orchestrator, 2026-11-01); see decision 17.
- Independent code review: 1 blocking (fixtures leaked `signup_attempts` rows), 6 non-blocking; all fixed or answered.

16. 2026-11-01: the room under 480 px tall is 94 px like everywhere else (no short override), and the scrolling card
    pads 94 px. Supersedes the 90 px of decision 15. Why: decided by the committee under the owner's instruction of
    2026-11-01 (code review finding 3): 90 px left 10 px clear for the two-line bar at 320 px, 2 px over the tested
    8 px floor; 94 px leaves ≥ 14 px for both bar heights.
17. 2026-11-01: the 18vw handle cap and nav padding move to #55, which adopts them; the 44 px nav-link target demand
    goes with them to #55's owner via the orchestrator. Why: decided by the committee under the owner's instruction
    of 2026-11-01; the orchestrator asked that the nav rule exist once, in #55.
- Tester QA: checks 1-6 clean (colours on every route, `.hl` 6.15 / 8.47:1, control borders, fixed bars with Tab at
  360×740/640/480 and 320×568, nav, feed snap and swipe); one High in the spec's cleanup (the attempts' child rows,
  `funnel_events`, blocked the delete) — fixed: the attempts' `login_links`, `funnel_events` and `connections` rows go
  first, in one transaction. Lows accepted: at 320×420 the disclaimer sits under the bar until the card is scrolled
  (decision 5); no-JS first card under the bar until the first snap (focus never obscured).
18. 2026-11-01: the profile chart's range buttons get `min-height: 44px; min-width: 44px` at every width (they were
    35 px tall); six stay on one row at 320 px. Why: decided by the committee under the owner's instruction of
    2026-11-01; target-size finding from the trust session's 360 px user test, added to this fix set by the
    orchestrator; POLICY A1 44 px targets. Tested at 320 and 360 (e2e, measured) and pinned in the unit test.
