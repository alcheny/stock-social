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
