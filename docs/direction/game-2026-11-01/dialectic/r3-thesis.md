# F-8 dialectic, round 3: thesis (the first 10 seconds)

## Stance this round: delete until a new adult gets it with no words

Two rounds of fixes were right on maths and policy, but they piled onto the first screen. A new adult who taps
"Practice" should see, within 10 seconds, a chart, one question, one control and one button, and understand the
whole game from the first reveal. That gives four shell deletions, which every design below inherits.

1. **The first screen is the first card.** No intro card. The fixed strip stays as one line at the top. The
   question lives on the card ("Ends higher after the gap? How sure?"). The slider starts at 50, and Lock is the
   only button.
2. **The first reveal teaches the scoring.** **Coin-flip points** = round(100 x L), L = 1 + log2 q_outcome:
   50 scores 0; 70 scores +49 on a hit and -74 on a miss; 90 scores +85 / -232; 98 scores +97 / -464. A player who
   sees -232 after a 90 learns, with no text, that being sure costs more than it pays. Points are shown in the
   neutral text color, never green or red (no gain/loss look), and are never percents.
3. **Session 1 has none of the following:** doors, bosses, tiers, fans, luck lines, presets, tags, bands or pooled
   panels. Later sessions show them in place, with no "unlocked" banner.
4. **No jargon in the UI:** no bits, DS, NIS, OI or "index". **Copy-list conflict:** the r2 share line "Practice
   game. Not a record." uses the banned word "record". Replace it with "Practice game. Generated charts."

Reference seed R, players Honest / Bold (0.65 / 0.90 / 0.98) / Fifty and Wide as v3. Points on seed R (200,000
simulated runs): expected Honest +126, Bold -43, Fifty 0. P10 / P50 / P90: Honest -147 / 103 / 347, Bold
-600 / 11 / 506. Bold beats Honest on 26% of single runs.

---

### S2-01 · Dojo Ladder
**Case.** The only luck-free score in the set: DS compares q with p*, not with the outcome, so honest play gets the
same result every run. It is the cleanest teacher of "say what you believe".
**First 10 s.** A path, and a slider whose track runs only from 25 to 75. The short track is the rule, so no text
is needed. After Lock, two dots appear on one line: "You 60 · Generator 70".
**Delete.** Tier 40-60 (a near-dead first slider), so start at 25-75. The luck line (DS has no luck). The
reliability diagram in session 1 (there is no n yet). The Bits belt text (jargon).
**Session 1.** 12 cards at ~12 s. Summary: "Average gap from the generator: 7 points", then one sentence and Done.
**Maths (tier 2).** p_c = p* clamped. Honest: DS 1.00, OI 0, and it lifts after 60 cards (~5 sessions). Bold,
forced to 0.65 / 0.75 / 0.75: mean (q - p_c)^2 = 0.010 against a baseline of 0.0285, so DS 0.65; OI +0.08, which
blocks the lift. Fifty: DS 0, OI -0.13, which also blocks it (underconfidence counts too). So the lift rule rewards
only matching the evidence.
**Delight.** The track gets longer. You can now physically say 90. Earned boldness, shown and not said.
**Bold mutation: Read the forecaster.** Two cards per session reverse the roles. The player sees a generated
bot's 20 calls and their outcomes, and says how likely it is that this bot is overconfident (slider). It is scored
by the log score against the bot's known setting. The lesson transfers: you learn to spot overconfidence in
others, not only in yourself. Bots only, labelled "generated forecaster", never resembling a profile or a feed
card. The critic should test whether it edges toward judging real traders.

### S2-02 · Paper Call Run (literal ask #1)
**Case.** It is closest to the owner's words: a 10-room run of paper calls with bosses and a route.
**First 10 s.** Ten small dots ("room 1 of 10"), the room-1 chart and the slider. The first reveal is "+49".
**Delete.** The intro line, the second door, the per-room trace and the fan in session 1. The summary is one line:
"Expected for your calls: +126. This run: +103. The rest is luck."
**The index-free control (open point).** Coin-flip points are the control, and they are an exact monotone
transform of the index (index = 100 x 2^(points / 100)). Ranks, propriety and luck are identical, and only the
framing differs: additive, 0 = coin flip, no compounding and no balance. Compare the spread: points -147 to 347
against index 36 to 1,110. **My recommendation: points are the default, and the index is the test arm.** Keep the
index only if, over 4 weeks, it beats points on (a) the drop in pooled OI and (b) week-over-week voluntary
return, with no rise in back-to-back runs or in "felt like betting" survey answers. Otherwise delete it.
**Doors that teach, not pay (open point).** Doors equalised by door-matched baselines feel flat when their only
offer is score. So make the offer the *texture* of the next three rooms: "Snaps back", "Keeps going", "Sudden
jumps", each with a 2-second generated preview sparkline (not scored). The value is variety and a lesson. After
the third room, one line: "Snaps back: after a big move, these paths tended to come back." There is no count and no
completion list.
**Delight.** The boss reveal: the jump fires, and a 60 you held back reads +26 or -32, where a 98 would have cost -464.
**Bold mutation: Second look.** In boss rooms, after Lock the path runs 5 more steps and you may revise once. The
score is the mean of both calls' points, and each call is proper at its own information time, so the sum is
proper. It teaches updating, and every boss plays differently.

### S2-03 · Paper Ticket Run (literal ask #2)
**Case.** The movement range is the most "trading-shaped" judgement and the most visual: a band on the future.
**First 10 s.** The chart has a shaded band to its right. Drag either edge, then Lock. The path walks into the
band: "inside" or "2 points outside".
**Delete.** In session 1, play the light ticket with the range only (the direction field arrives in session 2).
Delete the lens readouts: they are door-matched, so they add text and no value. Delete Two-step as a door; it
becomes the mutation below. The doors become S2-02's texture doors.
**Maths.** Full ticket = 50 x L + (50 - 7.5 x NIS). On seed R: Honest 300, Fifty-plus-Wide 192, Bold 154.
Range-only per room (100 - 15 x NIS): Honest 47.4, Wide 38.4, Bold 35.0. Bold's narrow band ranks last, below
lazy width.
**Delight.** The plank walk: the path landing a hair inside your edge.
**Bold mutation: Name the weather.** All 10 rooms come from one hidden family. At the end, pick which of four it
was and say how sure you are (50-95). Scoring is the log score, with the remainder split evenly. A mystery layer
each run, and the lesson is to read the process, not the last move.

### S2-04 · Shared Seed Table
**Case.** The same five cards for everyone: the purest social craft comparison.
**First 10 s.** "This week's five. Same five for everyone." Card 1 is visible with five bands under it. Tap one.
That is the simplest input in the set.
**Delete.** The pair gap verdict. At 5 cards a week, separating Honest from Bold takes 116 cards (23 weeks), and
two real people take years, so it would show "too close to call" forever. Also delete the friend 10-card seed
(a second mode). Keep the stacked reveal after close: "You: -2 to +6. Friend: 0 to +4. Ended +5." It compares
answers, never scores.
**Maths.** Weekly sum of 100 - 15 x NIS: Honest 237, Wide 192, Bold 175. The expected Honest-over-Bold gap is
12.4 per card.
**Delight.** After close: "We thought about card 3 completely differently."
**Bold mutation: The room after.** After close, all players' bands for each card are drawn as one density with the
outcome. "An honest 80% band catches 4 of 5; this table caught 3." The data is synthetic, the security is not
named and the reveal comes after close, so it is not a crowd view on a live security. It teaches that crowds
can be miscalibrated too.

### S2-05 · Number Line Shelf
**Case.** The calmest design, with no chart literacy needed: "Where does this path end?" on a number line.
**First 10 s.** One question, one band, Lock.
**Delete.** Zone shapes (a second input model). The optional second set. Session 1 is 5 questions in ~90 s, and
short is fine.
**Maths.** Honest 237, Wide 192, Bold 175 over five.
**Delight.** "Biggest dip" turns out wider than anyone guesses. A small surprise about randomness.
**Bold mutation: Pick the question.** Each path offers three statistics, and you answer one. Each is normalised
by its own s, so the choice is equal in expectation, and the reveal shows how wide an honest band was for all
three. You learn which questions are predictable, and that is a door whose value is learning.

### S2-06 · Week Report
**Case.** The only design whose output is a reason to stop: a document about your judgement.
**First 10 s.** It is the same range card as S2-03's first session. The twist is visible in the chart (a shorter
look-back), so it needs no card.
**Delete.** Direction cards (keep one card type). Reason tags (rare tags need months to reach n = 60). The twist
card. Session 1 ends: "inside 9 of 12. Your first report: after this week closes, here in Practice."
**Maths.** Mean range score per card: Honest 47.4, Wide 38.4, Bold 35.0. Volume adds nothing to the expected
score.
**Delight.** Opening a report that tells you something true about yourself: "Your bands were too narrow on jumpy
paths: 68% inside, band 61-75."
**Bold mutation: One rule for next week.** The report offers one rule ("widen jumpy paths by a fifth"). You may
switch it on. Next week's report compares, from the generator, the expected score with the rule against the
actual result. A self-experiment, not a streak.

### S2-07 · Bias Boss
**Case.** It aims difficulty at what you actually get wrong, and explains the trick.
**First 10 s.** It looks like any card. The boss is titled "Boss: one card has a decoy line". That is content,
not a tutorial, and it is the disclosure.
**Delete.** The door between biases. Normalisation already makes both biases worth the same, so the choice is
empty. The game picks the less-met bias.
**Maths.** Warm-ups over 6 cards: Honest 284, Wide 230, Bold 210. Sandbagging costs ~9 per card, for no gain.
**Delight.** "The decoy was on card 2. Your band leaned toward it."
**Bold mutation: Your own boss.** The boss is generated from your last 60 warm-ups. If you lean up by 0.3 s, the
decoys tilt up by 0.3 s. It is normalised to equal honest value. Personal, and different every time.

### S2-08 · Mastery Trials
**Case.** Finite, banded goals, and passing is decided by the evidence, not by grinding.
**First 10 s.** Its first 10 seconds are the same as other modes, which is the problem.
**Delete.** The trial *mode*. Every card in S2-01, S2-06 and S2-07 already pools, so the trials become one
four-week panel at the bottom of the Practice menu.
**Maths.** Honest passes (DS 1.00, OI 0, coverage 80%, L band > 0). Bold fails (DS 0.30, OI > 0). Fifty fails (DS 0,
expected L 0).
**Delight.** "Decided: your bands fit." It is final, with a band.
**Bold mutation: Finish line.** The trials have a last level. After it, the panel says "Nothing left to prove here"
and hides itself. Finite by design.
