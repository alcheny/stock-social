# F-8 dialectic, round 4: antithesis (red-team bench, eight seats)

Seats: RED TEAM, RESPONSIBLE DESIGN (veto), LEGAL, TRUST AND SAFETY, ACCESSIBILITY, ENGINEER, GAME DESIGNER (kept
from round 3) and, new, BUSINESS LEAD (team/business-lead.md: does it earn its place, does it move a week-8 gate in
DESIGN 3.5, or does it distract from verified records?). Sections run past ~350 words because the chair asked for
wireframe and arc critique; each seat is held to a few lines.

**Maths: checked, nearly all correct.** S3-01: Honest expected +14.6 / +1.0 / +6.9 = +22.4; Bold -3.8 / -57.7 /
-26.0 = **-87.4, not -88** (round once, at the end); outcomes +76 / -62 / +255 / +105 hold; -32 and -464 hold. S3-02:
36 / 6 / 72, 34, -26, -56, 162 / 12 / 84 hold; 100 - 15 x NIS with a 10x miss weight is the proper interval score
for an **80% central** range (2/alpha, alpha = 0.2), so the formula is right. But "Bold +1..+3" is not "a third as
wide" of Honest's -6..+6 (that is -2..+2): it is narrow **and off-centre**, so the example mixes two errors. S3-03:
0.0275 / 0.0575, DS 0.52, OI +0.15, Fifty OI -0.22 hold. S3-04: 26 / 8 / 60, 74 / -39 / 40 hold. S3-05 letter: 63
and about -606 hold. S3-06: 64 and -20 hold.

**Wireframes at 360px: frames are a consistent 38 columns** (the "·" lines are 2-byte, not wide). At a 328px
content box one column is about 8.6px, so every `[-]`, `[+]`, `[1]` drawn as 3 glyphs is **about 26px wide and one
text line (about 20px) tall**: under the 24px height of WCAG 2.5.8 and far under the app's own 44px target rule
(`app/globals.css` line 26-28, "44px targets"). The wireframes are layout sketches, not sizes; the spec must say
44 x 44 with at least 8px gaps, and then the range card no longer fits on one row (below).

---

### The two-engine plan (chair's question, answered before the designs)
**Engineer.** "Two engines" undercounts. The call card is one engine. The "range engine" is one **scoring
function** over several **statistics**: end point (S3-02, S3-05, S3-06), biggest dip and crossings (S3-04, a
discrete count), a binomial self-count (S3-05 letter), the median player's width (S3-04 mutation). Each needs its
own scale s, its own honest-80% generator answer and its own reveal text. That calibration is the cost, not the
formula. Count it as one engine plus four statistic modules.
**Game designer.** The plan breaks the Dojo's progression. **The Run lets anyone say 98 in session 1; the Dojo
"earns" the track from 25-75 to 2-98 over ~5 sessions.** Same card, same menu, two slider limits: the earned range
is fake, because it is one row away. Either the Run also starts at 25-75 (and loses its boss lesson "a 98 would
have cost -464"), or the Dojo's track ladder goes.
**Business lead.** Delete before adding. The Run's summary line "Expected for your calls" *is* the Dojo's luck-free
score, and the Run already "shows p* at every reveal" (thesis). So the Dojo as a menu row adds only a finish line
and a track limit the Run contradicts. **Four menu rows is three too many for a first build**: ship one row
(*Run*) and a Report page; everything else waits for evidence.
**Verdict: fix.** 1) Count statistics, not engines, in the build plan. 2) One slider range across Practice. 3) First
build is one row.

### S3-01 · Paper Call Run
**Red team.** *Abort scumming*: the thesis never says what Exit does mid-run. If an exited run is unscored, players
exit after a bad room and only lucky runs reach pooled stats and route cards. Rule: Exit ends the run, played rooms
count, unplayed rooms are not scored. **Ghost on the same seed is broken by its own reveal:** the sender saw
"Generator chance: 72 percent" in every room, so they can hand the friend all ten p* values and the friend scores
the best expected exactly. Expected-against-expected makes that the whole game. A second account playing your own
seed does the same.
**Responsible (veto, used on the mutation).** Session 20 is the question. By week 4 the player has seen all three
door textures, all 9 routes and the boss families, and p* shown every room teaches the generator fast. **Once a
player's expected score is near the best possible, the only thing left that varies between runs is outcome luck.**
A scored game whose remaining variance is luck is a variable-ratio loop with the skill sanded off. Session 20 then
relies on the Ghost's social pull (a friend's pending seed) and on habit. The Run needs a finish cue like the
Dojo's: when the pooled lower band of "expected for your calls" reaches, say, 90% of best possible, say so once:
"You call at the generator's level here. What is left is luck." Harder families may follow, but no further
"this run" line is needed to stay interesting.
**Legal.** "Best possible here: +22. This run: +255" reads as a contradiction (the run beat the "best possible").
Say **"Best expected here"**. In a stock app, **"call" means an options contract**; "Paper call" and "70 higher"
read as a paper call option at 70. Since options are out of scope in the product (ponytail), "call" is a live
financial word. Prefer "forecast" (not "pick", which F1a bans).
**T&S.** Route card has no numbers: fine. The seed code in it is a solution key (above).
**Accessibility.** The room row `* * o . . . . . . B` carries meaning by glyph alone; "Room 3 of 10" covers the
count but not "boss at room 10". The slider track is about 24 columns (about 200px for 96 values, about 2px per
point): a thumb cannot set 72 by touch. Add 44px [-1] [+1] buttons beside the readout (2.5.7 single-pointer
alternative already met by tap-on-track, but precision is not). **Exit sits beside Lock on one row**: one slip of
the thumb ends the run. Put Exit top-left, Lock bottom-right.
**Engineer.** Cheap; the boss two-stage future is moderate. Ghost adds seed sharing, friend links, block and mute:
a social graph the product does not have (F-3 has follows only).
**Game designer.** Session 1 has a hook (room 10). Weeks 2-3 are good (doors, second call). Week 4 has nothing new
in the game itself; it borrows the Ghost.
**Business lead.** This is the cheapest first build and the literal ask, so if anything is built, this is it. But
it moves **no** week-8 gate: not connected traders, not card shares, not external profile views; at most viewer D7,
and only for viewers who sign in and attest 18+, while the gate counts signed-out link arrivals. DESIGN Stage 3
records the CEO deferring predictions until supply exists. Demo sentence: "Forecast ten generated charts; the game
tells you how much was judgement and how much was luck." It passes the demo test. Scorecard: demand 2 (analogy
only), adoption 4, phase fit 1, trust 5 if fenced, simplicity 4. **Fails the bar on demand and phase fit.**
**Verdict: fix (the mutation: kill).** 1) Build only after the week-8 gates pass, or as a dated D7 test with a stop
rule. 2) Exit rule, "Best expected", "forecast" not "call", Exit away from Lock, [-1] [+1]. 3) Replace Ghost with a
finish cue; if any head-to-head survives, it is S3-03's (one only, see below).

### S3-02 · Paper Ticket Run
**Red team.** "Wide preset here: room 28" on **every reveal** is an outcome counterfactual: on an inside room it
tells the narrow player narrow paid, on luck alone. Show "Wide preset, expected: 38" (generator) or nothing. Cone
room checked: the mean of two proper interval scores is proper. Both ranges must lock before the step-10 reveal,
which the thesis implies but does not state.
**Responsible.** Fine. Name the weather adds a mystery, not a timer.
**Legal.** "Honest width grows with the square root of time" is a true statistics fact that is also the core of
volatility scaling. Teach it as "in this generator", never with "price" or "stock". Ranges stay off share surfaces:
the thesis keeps that.
**T&S.** None.
**Accessibility, 360px.** The stepper row `Low [-] -3 % [+]  High [-] +5 % [+]` is 37 of 38 columns. At 44px
targets it needs 4 x 44 = 176px plus four labels in 328px; at 200% text (1.4.4) or 320px reflow (1.4.10) it breaks.
Use two rows (Low row, High row). Then the card is strip (4 lines) + room row + chart + question + presets + Low +
High + readout + Exit/Lock + F3 footer links (44px): **about 640px, more than a 360 x 640 phone shows under browser
chrome**. Lock falls below the fold. Fix: a shorter chart (120px) and the strip at the top only on the first card
of a run (below in Cross-cutting). Tap-to-place on a 3-row chart is decorative at this size; steppers are the real
input, so state their step (1 percent). **The reveal frame drops the strip**, unlike S3-01's; one rule for both.
**Engineer.** Moderate: range input with three entry methods, plank animation with a reduced-motion path, cone draw.
**Game designer.** Session 20 holds up best of the range modes: Name the weather is a new puzzle each run, and the
cone teaches something no other room does. Week 4's "new families open on that band" is content, not a hook.
**Business lead.** Highest input load in the set, for the same gate impact as S3-01 (none). Its real role is the
second engine; build it only if S3-01's D7 test passes.
**Verdict: fix.** 1) Expected counterfactual, or none. 2) Two stepper rows, 44px, the card fits 360 x 560 with Lock
visible. 3) Second build, conditional on S3-01's result.

### S3-03 · Dojo Ladder
**Red team.** The lift test "OI band containing 0" is **easier with less data**: a wider band contains 0 more often,
so noise passes it. Use an equivalence test (OI band inside -0.05..+0.05). **Mirror match contradicts itself:**
"Pooled only (one session is never ranked alone)" and "Two friends take the same 12 paths; after both lock, one
line: You off by 6, friend off by 9" is exactly one session ranked alone. The first friend to finish sees the
generator dots and can leak them to the second.
**Responsible.** Finite by design: the best answer to "is session 20 interesting?" is that session 20 is the last,
by plan. Mirror match's "after both lock" creates a **waiting state** ("your friend has not played yet"): a pending
social obligation, the oldest return hook. Show the line only when the second friend finishes, never a pending
badge or reminder.
**Legal.** Read the forecaster: keep r3's limits (no handle, no avatar, table only, no profile link).
**T&S.** Mirror match is a private pair: fine with block / mute / silent decline.
**Accessibility.** `25 |-------[Y]---[G]--------| 75`: at about 1.6 points per column, [Y] and [G] overlap within
about 5 points, so **the named delight (off by 1) is a visual collision**. Design the coincident state: one merged
mark and the text "You 64 · Generator 65 · off by 1". The three-line helper under the slider ("Maximum 75; widens
when your calls match the evidence") on every card is noise: visible on card 1, then only in the accessible
description.
**Engineer.** Cheapest, if the slider limit conflict is resolved (two-engine section).
**Game designer.** The per-card closeness game is the best feel in the set; the finish line is the best ending.
**Business lead.** As a separate row it duplicates the Run's "Expected for your calls" line. Its unique assets are
the finish line and Read the forecaster. Steal both into the Run (finish cue, one last challenge) and **delete the
row**, unless the D7 test shows Run players want a luck-free mode.
**Verdict: fix.** 1) Equivalence test for lift. 2) Merge Ghost and Mirror into one head-to-head that compares pooled
expected over at least three shared seeds, seeds that neither player has seen, no pending state. 3) Fold into the
Run as its finish; keep the row only on evidence.

### S3-04 · Shared Shelf (This week's five)
**Red team. Read the room is manipulable at small n.** At launch (the gate is 50 traders; Practice players will be
fewer) the "room after" floor is 20 players, so a group of five can move the median width they are predicting by
setting their own question-3 ranges. It also makes question 3 improper: a player gains by distorting their own
range toward their median forecast. A beauty contest over a calibration card undoes the card. Outcome leak before
close by word of mouth still stands from r3.
**Responsible (veto, on one line).** `Closes Thu 18:00 (in 51 hours)` is a **countdown**. At "in 2 hours" it is an
urgency cue, and timers are in the bench's veto list. Show the absolute close only ("Closes Thursday 18:00, your
time"), never relative time.
**Legal.** Synthetic paths, after-close crowd view, unnamed: no consensus on a live security. "Dip" copy stays "in
this path".
**T&S.** Density only at n >= 20: kept. Friend stacked reveal: kept with block / mute.
**Accessibility.** `[1][2][3][4][5] presets` are unnamed (accessible names 2.5.3 / 4.1.2) and touch each other
(2.5.8 spacing). Name them ("Narrowest ... Widest"), 44px, gaps. The density `..:::::::..` needs its text line,
which the thesis gives ("31 percent of ranges held it"): good.
**Engineer.** Shared seeds, close jobs, a statistic module per question type (dip and crossings are new scales).
**Game designer.** Session 20 does not exist here: the shared five is weekly, so week 4 is session 4 of this mode,
and W4's only change ("after 12 weeks only") is empty until week 12. The 20-session arc is carried by unseeded
shelf filler.
**Business lead.** Social on day one needs players on day one; at week-8 scale the room after will often be under
20, so the mode's one unique screen is mostly blank. Defer until Practice has volume.
**Verdict: fix (the mutation: kill).** 1) Delete Read the room. 2) Absolute close time, no countdown. 3) Named,
44px presets; ship only once weekly players reliably exceed 20.

### S3-05 · Week Report
**Red team. The sealed letter is self-fulfilling.** "How many of your next 36 ranges will hold the line?" asks the
player to forecast something they control. Write 36 to 36 (width 0), then play Wide on all 36: 36 held, letter
scores 100. It rewards distorting the week's ranges, so it corrupts the very calibration the report measures.
**Responsible (veto, used).** The letter also sets a **quota**: it resolves only after 36 more ranges, three
sessions of 12, so it is a reason to keep playing this week. "Volume adds nothing" and "any number of sessions"
then contradict the mutation. Kill it.
**Legal.** The report carries the full F3 line: good.
**T&S.** None.
**Accessibility.** The report wireframe has jargon and a number mismatch: "Cards 36" beside "Band (n=72)"; "mean
card 31"; "Your letter: 30 to 33 held. Held: 19". The table view is promised: good.
**Engineer.** Cheap as a page over stored range scores.
**Game designer.** As a page, essential; W4's expected-with-tip comparison is interesting once.
**Business lead.** The report is the honest D7 mechanism in the set: a scheduled reason to look again that is
never pushed. Keep it as the Practice page from the first build (for call forecasts too, with the same bucket lines).
**Verdict: fix (the mutation: kill).** 1) Delete the sealed letter. 2) One n in the report, plain words ("Ranges
this week: 36. Average card: 31."). 3) The report covers whatever engine ships first.

### S3-06 · Bias Boss
**Red team.** "Set by a friend" tells the player a friend chose the decoy card; the setter can tell them which one.
Harmless in a private pair, but it makes the summary's "caught them on 2 of 6" meaningless. Sandbagging warm-ups to
pick your own boss still costs ~9 a card, as claimed.
**Responsible.** "Your own boss, built from your last 60 warm-ups" is disclosed and opt-out: fine.
**Legal.** A lean profile per bias type is personal profiling (P3): private, exportable, deletable, as stated.
**T&S.** Menu-only boss setting, no free text: low abuse. Fine.
**Accessibility.** Copy mixes units: "1 width toward it" (summary) against "lean +1.0 s" (arc). Pick one plain
phrase ("your range sat a full range-width toward it"). The dashed decoy must be named in the chart text (it is).
**Engineer.** A content family for S3-02 once the range engine exists; personal boss generation is the costly part.
**Game designer.** Session 20 is interesting: W4 retires bias types as their band reaches 0, a finite ladder aimed
at the player's own error.
**Business lead.** Good content, wrong time: it needs the second build. The friend mutation adds a social graph for
a small payoff. Cut it.
**Verdict: fix.** 1) Content family for S3-02, not a row. 2) Cut Set a boss for a friend, or keep it without the
return message. 3) One unit word in all bias copy.

### Cross-cutting
1. **No design moves a week-8 gate** (connected traders >= 50, card shares >= 60%, external profile views >= 5,000 a
   week, viewer D7 >= 15%). Practice is signed-in and 18+ only, so it cannot touch signed-out link arrivals, and
   DESIGN Stage 3 records the CEO deferring predictions until supply exists. Build nothing before the gates, or run
   S3-01 alone as a dated D7 test with a stop rule. The thesis never says **where the Practice entry sits**: never
   in the swipe feed, never on a profile or share card, so the game cannot dilute "verified, losses included".
2. **The disclaimer and the strip.** The strip carries "Not investment advice." but cuts "Past performance does not
   guarantee future results." from every card and reveal that shows points. Either rule game points are not
   performance (owner's call, record it) or show the full F3 line on every reveal. Never hyphenate it by hand
   ("invest-/ment", "perfor-/mance" in the mocks): the line must be one unbroken string that the compliance scan
   and a screen reader both match. F3 also wants Terms, Privacy and a "How Practice is scored" link on every
   Practice page (44px, `footer.site nav.legal`). Budget their height at 360 x 640.
3. **Touch targets.** Every 3-glyph button in the mocks is about 26 x 20px. Spec 44 x 44 with gaps; then redo the
   range card's height budget so Lock stays visible.
4. **Late game is luck or habit.** Where skill saturates (Run, Shelf filler), the remaining variance is outcome
   luck; where it does not, the arcs lean on social obligation (ghost seeds, pending friends). Give every mode a
   finish cue like the Dojo's, and never a pending-friend badge.
5. **Shared seeds leak p*.** Every reveal shows the generator chance, so any seed passed between friends is an
   answer key. Head-to-head only on fresh seeds neither has seen, compared on pooled expected scores.
6. **Five friend features (Ghost, Mirror, Shelf reveal, Read the room, Set a boss) need one social graph the product
   lacks.** Build zero in the first release; if one, the merged head-to-head.
7. **Copy.** "Best possible" means "best expected"; "call" is an options word in a stock app; one unit word per
   concept.

Not investment advice. Past performance does not guarantee future results.
