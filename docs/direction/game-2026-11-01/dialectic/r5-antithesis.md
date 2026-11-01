# F-8 dialectic, round 5: antithesis (last critique before the vote)

Seats: RED TEAM, RESPONSIBLE DESIGN (veto), LEGAL, TRUST AND SAFETY, ACCESSIBILITY, ENGINEER, GAME DESIGNER,
BUSINESS LEAD. The chair asked for every number recomputed, every acceptance criterion (AC) tested for
testability, every mutation tested, and a ruling on the paper-stake sentence. Sections run past ~350 words for
that reason; each seat is held to a few lines. Verdicts are final-round verdicts: decisive, with the edit that
makes each design votable.

## Maths audit (every number the thesis states)

| Claim | Recomputed | Ruling |
|---|---|---|
| Bold over 3 rooms -88 (-3.96 / -57.85 / -26.15) | -3.958 / -57.847 / -26.148 = **-87.95** | **Holds** with the exact formula. |
| "Round 4's antithesis mis-stated room 1" | R4 took the expectation of the **rounded** room points (+85 / -232): -3.76 / -57.65 / -25.95 = -87.4 | **Overclaim.** Not an error, a different convention. Both are right; the spec must pick one. |
| Honest +22 (14.5 + 0.7 + 6.6) | 14.455 + 0.723 + 6.593 = 21.77 (rounded convention 22.44) | Holds either way. |
| Outcomes H,L,L: +76 / -62 / 0; alt +255 / +105 | 53-15+38; 85-232+85; 85x3; 53+14+38 | Hold. |
| Reveal "Expected: +14 (best +14)" for q 0.70, p* 0.72 | exact 14.32 / 14.45 -> +14 / +14; rounded convention 14.56 / 14.64 -> +15 / +15 | Holds **only** under the exact convention. Round 4's +15 was not wrong either. |
| E[IS] = 4 sigma phi(z) / alpha -> 50.7 | 4 x 4.68 x 0.17550 / 0.2 = 16.43; 100 - 15 x 16.43/5 = **50.7** | Holds (it is the identity for the honest central range: width terms cancel). |
| Range per room 50.7 / 25.9 / 27.5; outcomes 162 / 54 / 84 | 50.71 / 25.88 / 27.53; 64+34+64, 88-62+28, 28x3 | Hold. |
| Two rings: Honest 53, Bold 21, Wide 27 | IS50 11.90, IS90 19.31 -> **53.2**; Bold 13.21 / 39.47 -> **21.0**; Wide (both rings +-12) 24.06 / 24.31 -> **27.4** | Hold, but Wide is only defined if both rings sit at +-12 (state it). |
| S4-03 dip 64 / 51 / 40 | Honest 64.07; Bold -7..-4 51.26; **Wide -16..0 = 39.2** under the stated normal | Wide's 40 is its *inside* score, not its expectation. Under the real dip (never above 0) it is exactly 40; under the illustrative normal it is 39. Say which. |
| S4-03 outcomes -7.5: 74 / 70 / 40; -11: -1 / -61 / 40 | 73.75 / 70 / 40; -1.25 / -61.25 / 40 | Hold. |
| S4-04 (round-4 text) "Bold expects 109 less" | 21.77 + 87.95 = 109.7 -> **110** | Fix to 110 (or drop the number; the thesis's +22 / -88 already says it). |
| S4-05: ~800 per arm (7.84 x 0.255 / 0.0025) | 0.255 = 2 x 0.15 x 0.85 uses the **base** variance in both arms. Correct unpooled: 7.85 x (0.1275 + 0.16) / 0.0025 = **903**; pooled ~906 | **Wrong by 13%.** About 900 per arm, 1,800 eligible accounts. See S4-05 for why the real number is far higher. |

**Ruling on convention:** Expected and Best expected are computed from the **exact** formula E = 100 x (1 + p log2 q +
(1 - p) log2(1 - q)); the room score shown is rounded once per room. Then -88, +22, +14 (best +14) stand, and two
leftover frames must change: the S4-05 summary wireframe still prints "-87" and the signed-out demo card text still
prints "+15. Best expected: +15." Both become -88 and +14 / +14.

**Two-ring lesson overclaims.** "In jump weather the honest outer ring is much more than twice the inner": for a
plain normal end point the 90/50 ratio is already 1.645 / 0.674 = **2.44**. So "more than twice" is true in calm
weather too and teaches nothing distinctive. Honest copy: "Calm weather: outer ring about 2.4 times the inner.
Jump weather: 3 times or more" (a heavy-tailed end point, e.g. a 3-degree-of-freedom shape, gives about 3.1).

## Ruling: the paper-stake explanation of "maximize returns"

**The maths is right.** Splitting a stake q / (1 - q) between "higher" and "lower" at even odds (each side pays 2x)
leaves wealth 2q if higher wins; 100 x log2(2q) = 100 x (1 + log2 q) = Points. Expected points are maximised only at
q = p*. **But the sentence is not fully honest**, and it does read as wagering:
- **Honest? Only half.** "Maximise returns" in the owner's words means average return. Average return at even odds
  is maximised by putting everything on the likelier side: the Bold player, pushed to 100. The log score maximises
  **log growth**, a different objective. Saying "maximising expected points is maximising expected log return" is
  true; presenting it as the answer to "maximize returns" quietly swaps the objective. The owner must be told the
  swap in one line: "A game that pays average return rewards going all-in; this one pays log growth, which rewards
  only the honest forecast."
- **Wagering on the explainer page? Yes.** "A stake split between higher and lower at even odds" is the textbook
  description of a two-outcome bet; on a page inside a stock app it describes a paper binary-direction wager and
  stake sizing. LEGAL: it pulls the game toward gambling-likeness (F5/F6 spirit) and toward position-sizing
  guidance (F1). The thesis already bans the words on cards; the page is no different, it is the most-read
  explanation of the score.
- **Decision.** Keep the sentence **in the F-8 design doc only**, addressed to the owner, with the swap line
  above. "How Practice is scored" says, in plain words and no stake, odds, bet, return, growth or wealth words:
  "Points reward saying how sure you are, honestly. 50 scores 0. Saying 90 when 70 is right costs you on average,
  even when you are lucky." Add an AC: copy scan of the explainer and every Practice page rejects
  `/\b(stake|odds|bet|wager|return|payout|wealth)\b/i`.

---

### S4-01 · Forecast Run (the Dojo is its finish line)
**Red team.** *Peek-and-exit scumming survives the Exit rule.* "Rooms 1..k appear in pooled numbers" counts only
locked rooms, so a player can open room k+1, see a hard card (p* near 50, low Best expected) and Exit unscored.
Avoiding hard rooms lowers mean shortfall and fires the finish cue early. Fix: **a room counts once its chart is
shown**; Exit on an unlocked card scores it as 50 (0 points, full shortfall). *Lenses become a solved choice*: if
each lens's value is a fixed property of the settings, the summary teaches "Longer history is worth +5" once and
every later run picks it. The door is then not a choice.
**Responsible (veto not used).** Lenses buy information with no currency or unlock: fine. The finish cue at
"shortfall <= 3" is strict: a human whose forecasts miss p* by about 10 points has shortfall of about
100 x 0.01 / (2 x 0.24 x ln 2) = **3.0 per room**, so most humans sit on the line and never see the end. Tune the
margin in playtest; the cue that never fires leaves only luck varying, the round-4 veto case.
**Legal.** No stake words on cards: good. "Sister path" (an ended path from the same settings) is a generated
outcome, not market data: fine.
**T&S.** Fenced off verified surfaces (AC7): good.
**Accessibility.** Sister path needs a non-colour line style (dashed) and its own text summary; 40 steps in a 120 px
chart needs the text summary to carry the information too.
**Engineer.** Lens p* is a posterior: Weather label is cheap (per-family chance); Longer history and Sister path
need a likelihood over families (cheap if families are a finite set with fixed parameters; Monte Carlo if not).
Keep family parameters discrete. The p* clamp is missing: if the generator emits 0.995, Best expected (q limited to
98) and "off by" disagree. **Generator p* lives in 0.02..0.98.**
**Game designer.** Lenses are the best mutation of the round if each lens wins in some weather. Require it.
**Business lead.** Lenses add one door type, no new screen: acceptable after the gates.
**AC testability.** 1 yes (unit). 2 "match the formula" names no formula: write E = 100 x (1 + p log2 q + (1 - p)
log2(1 - q)), Best = E at q = p*. 3 reword: "Exit after a room's chart is shown scores that room as 50; pooled n
equals rooms shown; a started seed is never reissued (API)". 4 yes (DOM textContent). 5 reword to a measurable
check: "at viewport 360 x 560, Lock's bounding box is inside the viewport without scrolling; every control's box
>= 44 x 44; gaps >= 8" (Playwright). 6 reword: "band = mean + 1.96 x sd / sqrt(n) over shown rooms; fixture of 60
rooms with known shortfalls fires the cue exactly once; afterwards no 'This run' text". 7 yes. 8 yes. **Add:**
fixture test reproducing Honest +22 / Bold -88 / Fifty 0; property test "each lens has the highest expected value
in at least one family mix".
**Verdict: fix.** 1) Shown room counts; Exit on an unlocked card scores 50. 2) Lens values are this run's ex-ante
values and each lens must be best in some weather (property test). 3) Reword AC2/3/5/6 as above; clamp p*.

### S4-02 · Range Run (the bias bosses are its keystones)
**Red team.** Two rings door: Honest expects **53.2 vs 50.7** single-ring, Bold 21.0 vs 25.9. A calibrated player
gains from always taking the door, so the door is not a trade-off, and the Report's "Average card" now mixes two
scales. Compare rooms on **shortfall against Best expected**, never on raw card.
**Responsible (veto, conditional).** The named delight is a near miss: "the plank walk stops one tick inside your
top edge." An animation that walks toward the edge is the slow-reel suspense pattern. Veto unless the walk is
**constant speed, fixed duration (<= 1.5 s), skippable, silent, never slowing near an edge**, and the copy is a
distance ("ended 0.4 percent inside"), never "so close" or "just".
**Legal.** "A prediction is a price range" on a stock-like chart: keep "line" and "percent", never "price" in UI.
**T&S.** No share surface (AC8): good.
**Accessibility.** Two rings need patterns plus labels ("inner", "outer"), not two tints; steppers as specified.
**Engineer.** Name the weather has **no scoring rule** in the spec. Either unscored (say so) or the four-option log
rule with the S4-03 fix below. Two rings add a second pair of steppers: 360 x 560 will not hold four rows plus
presets; the door's card scrolls, and AC9's scroll rule must cover it.
**Game designer.** The tails lesson only lands with the corrected copy (2.4 calm vs 3+ jump).
**Business lead.** Second build, behind evidence. Agreed.
**AC testability.** 1 yes. 2 reword for integer steps: "over all integer (Low, High) pairs, the argmax of expected
card is the pair nearest the generator's 10% and 90% points" (property). 3 yes (keyboard e2e). 4 yes (API). 5 yes
(copy regex: every counterfactual line contains "expected"). 6 yes (emulateMedia reduced motion; static frame
present; text names the end point). 7 not checkable as written: define "lean = signed (end - centre) / width toward
the bias, retired when its 95% band is inside +-0.25 with n >= 20 of that boss type" (unit fixture). 8 yes. 9 yes.
**Add:** plank walk duration and constant velocity test (animation timing in e2e); two-ring card fixture 53 / 21 / 27.
**Verdict: fix.** 1) Plank walk constant, short, skippable; no near-miss copy. 2) Report compares shortfall, not raw
cards across door types. 3) Specify Name the weather's scoring (or "unscored"); correct the tails copy.

### S4-03 · This Week's Five (shared seed, week report)
**Red team.** *The operator could pick the truth after seeing the crowd.* "Truth exists only after close" invites
that suspicion. Fix: **publish a hash of the week's seed at open; reveal the seed at close** so anyone can check.
Sybil accounts can push the crowd past 20; with no prize the harm is small, but the density must count attested
accounts only.
**Responsible.** A weekly close is a soft deadline. Acceptable only if the Report never shows "weeks played of N",
gaps or a calendar of missed weeks.
**Legal.** Weekly, scheduled timing, not price-driven: F3b clear. No push: good.
**T&S.** Theories before close are off-platform; there is no in-app talk: say so (no comment box on the shelf).
**Accessibility.** Five presets plus two rows at 360 px wrap to three rows: fine if scroll keeps Lock reachable.
**Engineer.** **The weather mutation's score is broken.** 100 x (1 + log2 q) over **four** options gives uniform
q = 25 a score of **-100**, not 0, breaking "no view scores 0". Use **100 x (1 + log4 q) = 100 x (1 + log2(q) / 2)**:
uniform 0, certain 100, q = 2 gives -182. And "each kept in 2..98" is impossible with four options summing to 100:
the cap is **94**. Dip statistics are bounded above by 0 and skewed: the build must not use the normal.
**Game designer.** The shared regime is the strongest replay idea in the round: five paths, one cause.
**Business lead.** The floor counts "weekly players" of a shelf that is hidden: circular. Count **weekly distinct
Practice players** (the shipped run) instead.
**AC testability.** 1 yes (API before close returns 403/empty). 2 yes (copy regex for "in N hours", "left",
"ago", "remaining"). 3 yes (fixtures at 19 and 20). 4 yes. 5 yes. 6 fix to log4 and the 2..94 range, then yes.
7 reword: "the shelf route returns 404 until distinct weekly Practice players >= floor in 4 consecutive weeks
(unit, fixture)". The delight line "deeper than 69 percent of ranges" is ambiguous (ranges can miss above too):
"69 percent of ranges stopped short of it". **Add:** seed-hash published at open matches revealed seed (API).
**Verdict: fix.** 1) log4 rule, 2..94. 2) Seed hash at open, seed at close. 3) Floor counted on Practice players.

### S4-04 · Practice: Forecast and Range on one card engine
**Red team.** Twin room: if the implied chance is shown before the side Lock, the second forecast is copied from
the first. Show it only after both Locks.
**Responsible.** "Session 6" unlock is a play-count unlock: play more, get a row. Mild but avoidable. Prefer
"after the first finish cue or 14 days after the first run, whichever is first" (calendar, not count). If the
committee keeps the count, define a session as one started run.
**Legal / T&S.** Nothing new.
**Accessibility.** Same Exit/Lock positions (AC4): good.
**Engineer.** AC6 divides by half-width: Low = High gives a zero. Require width >= 1 percent at the stepper, and
clamp the implied chance to 2..98 to match the slider.
**Game designer.** "Off by 22" reuses the shell's unit phrase for a different concept (your two answers, not you vs
the generator). Shell rule 1 says one phrase per concept: write "Your range and your forecast differ by 22."
**Business lead.** On day one it is S4-01. A vote for S4-04 is a vote for S4-01 now plus an evidence-gated row:
the cleanest staged answer.
**AC testability.** 1 yes (menu snapshot). 2 reword with the defined trigger (unit + e2e). 3 yes (Report has no sum
line; unit). 4 yes (bounding-box equality). 5 yes. 6 yes after the width guard and clamp; add "not rendered before
the side Lock". 7 yes.
**Verdict: keep (with fixes).** 1) Implied chance shown after both Locks; width >= 1; clamp. 2) Calendar or
defined-count unlock. 3) New phrase for the coherence line.

### S4-05 · The dated test (business lead's minimum)
**Red team.** Holdout by account hash is sound; a holdout user with two accounts sees both arms, minor at this n.
**Responsible.** One door is harmless.
**Legal.** A random holdout is fine; P3 needs the privacy page to say Practice usage is measured for a fixed test
and deleted after.
**Engineer.** D7 is undefined: say "returned to a verified page on any of days 1-7 after first eligible visit", and
only accounts whose day 0 is at least 7 days before the decision date count.
**Business lead (the number).** The thesis's ~800 is ~**900 per arm** (above). Worse, it assumes the whole Practice
arm plays. It does not: if 20% of the arm ever opens Practice, the arm-level lift is a fifth of the user-level one,
and a +5-point user effect becomes +1 point at arm level: **about 20,500 accounts per arm** (7.85 x (0.1275 +
0.1344) / 0.0001). At week-8 scale (50 connected traders, a few thousand signed-in viewers at most) the test cannot
pass. That is acceptable only if the owner signs, before the start, that **the expected result is "stop"** and that
a stop means "build after the gates", not "the idea failed". The second stop rule has no threshold: "profile views
fall" fires on noise. Use "the 95% upper band of the change is below 0".
**Game designer.** One door makes a pass mean "the roguelike holds", not "a quiz holds": keep it.
**AC testability.** 1 yes (e2e on a holdout fixture account). 2 testable as "the flag refuses to enable without
start and decision dates in config" (unit). 3 and 4 are analysis rules: testable as a unit test on the analysis
function with fixture data; write the band method (two-proportion, unpooled, 95%). 5 split: "flag off hides the
entry (e2e)" and "deletion job removes Practice rows older than stop + 30 days (unit)"; "within one day" is a
process promise, not a test: move it to the runbook. 6 yes (separate counters). 7 yes.
**Verdict: fix.** 1) Correct the power line (900 per arm full uptake; ~20,000 at 20% uptake) and state the
expected outcome is stop. 2) Define D7 and the eligible window. 3) Threshold the views stop rule; fix the -87 frame.

### Cross-cutting
1. **Convention for Expected.** Exact formula, room points rounded once; update the two stale frames (-87, +15).
2. **No stake, odds, bet or return words anywhere users read**, including "How Practice is scored"; the paper-stake
   equivalence lives in the design doc for the owner, with the "log growth, not average return" swap stated.
3. **Count what was shown, not what was locked.** Every mode: a shown card is a played card; Exit scores it as no
   view. This closes peek-and-exit scumming in S4-01, S4-02, S4-04, S4-05.
4. **Compare on shortfall, never on raw score**, whenever doors change the scoring scale (two rings, lenses).
5. **Clamp everything to the slider's 2..98** (generator p*, implied chance; four-option weather caps at 94).
6. **ACs must name their method**: band formula, n, fixture, viewport. "Fits", "matches the formula", "falls" and
   "within one day" are not tests until reworded as above.
7. **Animations never decelerate toward an edge**; reveal copy states distances, never closeness.
8. **The finish cue margin (3 per room) is at the edge of what a good human reaches**: set it in playtest, or the
   end that justified every design never arrives.
9. **Vote framing.** S4-04 with S4-05 as its timing gate is the coherent answer: S4-01 is the first build in every
   case except S4-03; S4-02 is its evidence-gated second row; S4-03 is the destination once there is a crowd.

Not investment advice. Past performance does not guarantee future results.
