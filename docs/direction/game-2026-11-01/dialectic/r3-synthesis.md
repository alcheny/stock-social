# F-8 dialectic, round 3: synthesis (6 designs for round 4)

## Round 3 result

| In ids | Out id | Kept / merged / dropped | One-line reason |
|---|---|---|---|
| S2-02 | S3-01 | kept (fixed) | Literal ask #1. Index deleted (veto), "revise once" becomes a mandatory second call, room-10 boss and luck line stay in session 1. |
| S2-02 index test arm | - | dropped | Vetoed: an exact transform of points that adds only the multiplier look, and its keep rule rewards stickiness. |
| S2-03 | S3-02 | kept (fixed) | Literal ask #2. Presets stay in session 1, the reveal shows width and miss costs, Name the weather runs 25-95 with horizon-only doors. |
| S2-01, S2-08 | S3-03 | merged | The trials panel has no engine of its own; its finish line ("nothing left to prove") becomes the Dojo's last tier. |
| S2-08 cross-engine panel | - | dropped | Needs two built engines to mean anything; the Dojo's finish line keeps the finite-goal idea at no cost. |
| S2-04, S2-05 | S3-04 | merged | Both are a short set of range questions; one engine: a shared weekly five on a number line, presets, the room after. |
| S2-04 pair gap, S2-05 zone shapes | - | dropped (stand) | Round-3 deletions stand: the gap never resolves, zone shapes are a second input model. |
| S2-06 | S3-05 | kept (fixed) | Practice tip compares expected against expected; session 1 gets a raw-count mirror. |
| S2-07 | S3-06 | kept (fixed) | A generic boss is in session 1; the personal boss is disclosed, opt-out, and its lean profile falls under P3. |

## Shared shell v4 (every design inherits it; v3 rules stand unless changed here)

Carried from v3: the separate Practice area and fixed strip; synthetic data, server-held futures, opaque seeds;
untimed input; lines with 0% on the axis, text summary of every reveal, reduced motion; small-n rule (raw counts,
claims only at pooled n >= 60 with a 95% confidence band); calm rules; block / mute / silent decline on links; the
copy list ("paper call", never trade, bet, odds, record, skill, return...); door-matched baselines; shared seeds
reveal generator truth only after close; counterfactuals from the generator, labelled "expected"; the full
"Not investment advice. Past performance does not guarantee future results." line on every summary.

Changed in v4:
1. **The first screen is the first card.** No intro card. The strip sits on top in full wording and wraps at 360px
   (never truncated or shrunk). **Exit** sits beside Lock. Practice opens only for a signed-in, 18+ attested
   account (P4); the gate lives on the Practice menu, not on a card.
2. **Coin-flip points** score every outcome-scored probability: points = round(100 x (1 + log2 q_outcome)), clamp
   2-98. 50 → 0; 70 → +49 / -74; 90 → +85 / -232. Neutral text color, never percents, never green or red. **No
   index anywhere** (v3 rule 2 is deleted). "Points" means only the score: percent gaps read "off by 7", range
   misses read "2 percent outside".
3. **Session 1 has no** doors, tiers beyond the start, fans, tags, mutations, pooled panels or confidence bands.
   **Restored:** presets plus tap-to-place and steppers on every range (WCAG 2.5.7; drag is optional), announced
   bosses as content, and the luck line.
4. **Every session-1 summary** is three lines and Done: the luck line ("Expected for your calls: X. Best possible
   here: Y. This run: Z."), one raw bucket line ("Your 70s: 4 of 6 went your way" or "Your ranges caught 9 of 12; an
   80% range expects about 10"), and the disclaimer.
5. **Slider copy.** Ends labelled "Lower" and "Higher"; the value reads "70 percent: higher". At 50 it reads "50:
   no view. Scores 0 every time." No jargon (bits, DS, NIS, OI, index, gap).
6. **Lesson copy** is "being surer than the evidence costs", never "being sure costs" and never implying 50 is safe.
7. **Share line:** "Practice game. Generated charts, not market data." Ranges are never on a share surface.
8. **"Range"** is the player's input; **"confidence band"** is only a statistic.
9. Every design names its **session-1 hook** in one sentence.

Notation as v3. Range score per card: 100 - 15 x NIS (width cost plus 10x the miss distance, over s).

---

### S3-01 · Paper Call Run (literal ask #1: roguelike run of paper calls)
**Lineage:** S2-02 (10 rooms, jump bosses, texture doors, luck line); antithesis veto (index deleted, mandatory
second call); S2-01 (best-possible line, from the Dojo's known p*).
**Session-1 hook:** the room-10 boss, where the announced jump fires and a held-back 60 costs -32 while a 98
would have cost -464.
**Format and data.** Personal seed of 10 generated rooms: "Will the line end higher in 20 steps?" Room 10 is an
announced jump boss in session 1; from session 2, rooms 4, 8 and 10 are bosses. p* is shown at each reveal.
**Flow (session 1).** 0-3 s first card visible (strip, chart, slider at 50, Lock, Exit). 3-135 s: 9 rooms at ~15 s
(path 4 s, slider, Lock, reveal 3 s: "Ended higher. +49. Generator chance 72 percent."). 135-155 s boss ("Boss:
this path can jump"). 155-180 s summary.
**Input.** Slider (arrows 1, Page 10, Home/End); readout announced. Ten room dots have a text "room 3 of 10".
**Scoring.** Run = Σ points. Seed R expected: Honest +126, Bold -43, Fifty 0; Bold's summary reads "Expected for
your calls: -43. Best possible here: +126. This run: +11", which separates luck from overconfidence. A 90 on a
0.65 card expects -26; a 65 expects +7.
**Progression (session 2+).** Doors after rooms 3 and 6 pick the texture of the next three rooms ("Snaps back",
"Keeps going", "Sudden jumps"), door-matched; each lesson line says "in this generator" and is paired with its
opposite family. Previews are static under reduced motion, with text. **Second call:** at each boss the path runs 5
more steps (the jump fires only after them), and a second forecast is required beside the locked first; score is
the mean. Harder jump families open at pooled points per room, lower band > 0, n >= 60.
**Sharing.** Route card of door icons plus the share line. No numbers.
**Engaging, not compulsive.** Boss tension, route texture, the best-possible line; no instant retry.
**Risks.** One run's luck still dominates (Bold beats Honest on 26% of runs); the luck line must be read.

### S3-02 · Paper Ticket Run (literal ask #2: roguelike run of paper calls with a range)
**Lineage:** S2-03 (10 rooms, keystone room, plank reveal, two-field ticket, Name the weather); antithesis fixes
(presets, two-part reveal, 25-95 slider, horizon-only doors); S3-01 (luck line).
**Session-1 hook:** the plank walk, where the path lands a hair inside your range edge and the reveal shows what
the extra width cost you.
**Format and data.** Personal seed of 10 rooms. Session 1: range only ("Where does this line end?"), room 10 an
announced regime-switch keystone. Session 2 adds the direction field (the full ticket).
**Flow (session 1).** 0-3 s first card. 3-150 s: 10 rooms at ~15 s (path 3 s, preset or own range 6 s, Lock, plank
walk 4 s, reveal: "2 percent outside. Width -31, miss -22, room 47."). 150-180 s summary: luck line, "caught 8 of
10; an 80% range expects 8".
**Input.** Keys 1-3 (narrow / medium / wide), tap-to-place each edge, steppers; read as "from minus 3 to plus 5
percent".
**Scoring.** Range room = 100 - 15 x NIS: per room Honest 47.4, Wide 38.4, Bold 35.0. Full ticket = 50 x L + (50 - 7.5
x NIS): run Honest 300, Fifty-plus-Wide 192, Bold 154. A narrow range pays 10x on its miss distance, so false
precision ranks below lazy width.
**Progression (session 3+).** Doors change only the horizon (Long sight + longer horizon; Fog + shorter). **Name
the weather:** all 10 rooms come from one hidden family; at the end pick one of four and set a chance 25-95 (the
rest split evenly); score round(100 x log4(4 q_true)), so 25 scores 0. New families open at pooled coverage band
containing 80%, n >= 60.
**Sharing.** None (percent ranges).
**Engaging, not compulsive.** Two judgements, a visible plank, a mystery each run.
**Risks.** Highest input load; "inside" may still read as winning until the width cost is noticed.

### S3-03 · Dojo Ladder
**Lineage:** S2-01 (known p*, DS, tiers, Read the forecaster); S2-08 (finish line, data stays reachable);
antithesis fixes (no "points" for gaps, binary bot truth, closest-call line).
**Session-1 hook:** two dots on one line, "You 60 · Generator 70 · off by 10", a closeness game felt on card one.
**Format and data.** 12 generated paths with known p*. The slider track runs 25-75 in tier 1, then 10-90, then 2-98.
**Flow (session 1).** 0-3 s first card. 3-150 s: 12 cards at ~12 s (path 4 s, slider, Lock, dots 3 s, outcome).
150-180 s: "Off by 7 on average. Closest call: card 7, off by 1. This score has no luck in it: it compares you with
the generator, not the outcome."
**Input.** Slider announces its limits ("maximum 75 percent; widens when your calls match the evidence").
**Scoring.** DS = 1 - mean((q - p_c)^2) / mean((0.5 - p_c)^2), p_c = p* clamped; OI = mean(|q - 0.5| - |p_c - 0.5|).
Tier 2: Honest DS 1.00, OI 0; Bold DS 0.65, OI +0.08; Fifty DS 0, OI -0.13. A tier lifts at >= 60 calls with DS
lower band >= 0.5 and the OI band containing 0, so over- and underconfidence both block it.
**Progression.** Longer tracks; after the 2-98 tier, **Read the forecaster**: 20 calls of a generated bot as a
probability table (no handle, avatar, returns or chart); the truth is binary (calibrated or overconfident by a fixed
factor, prior 50/50), scored in points. Then "Nothing left to prove here"; the Dojo leaves the menu, its data stays
exportable and deletable.
**Sharing.** None. **Engaging, not compulsive.** Earned boldness, finite by design.
**Risks.** The longer track arrives ~5 sessions in; Read the forecaster must never link to a profile.

### S3-04 · Shared Shelf
**Lineage:** S2-04 (same five for everyone, presets, room after, friend reveal); S2-05 (number-line statistics,
dip surprise, pick the question, unseeded shelf); antithesis fixes.
**Session-1 hook:** "biggest dip in this path" lands far wider than you guessed, a small true surprise about
randomness.
**Format and data.** A shared weekly five (end point, biggest dip in this path, crossings), close time shown on the
card, 72 h after opening; outside that, five unseeded shelf questions that reveal at once.
**Flow (session 1).** 0-3 s first card. 3-100 s: five questions at ~19 s (path 5 s, preset or own range, Lock,
reveal in text). 100-130 s summary (luck line, "caught 3 of 5; an 80% range expects 4").
**Input.** Keys 1-5 for presets, tap-to-place, steppers; the question choice later is a radio group.
**Scoring.** Σ (100 - 15 x NIS): Honest 237, Wide 192, Bold 175.
**Progression (session 2+).** **Pick the question:** three statistics per path, each normalised by s from that
path's visible part, so no choice is half-answered; the reveal shows all three honest widths in text. **Room after**
(after close, >= 20 players): one density of everyone's ranges per card; crowd coverage against the expected 80%
only pooled over >= 12 weeks with a confidence band.
**Sharing.** Pip row, seed code, share line. Friend stacked reveal ("You: minus 2 to plus 6. Friend: 0 to plus 4")
with block, mute, silent decline.
**Engaging, not compulsive.** Calmest mode; a missed week loses nothing.
**Risks.** Outcomes leak by word of mouth before close; "dip" copy must stay "in this path".

### S3-05 · Week Report
**Lineage:** S2-06 (one card type, week twist visible in the chart, report as stop cue); antithesis fixes
(practice tip, expected against expected, raw mirror).
**Session-1 hook:** "Your ranges caught 9 of 12; an 80% range expects about 10", the first hint you are narrower
than you think.
**Format and data.** A week with one twist drawn into the chart (a shorter visible history). 12 range cards per
session, any number of sessions; the report appears in Practice after close, never pushed.
**Flow (session 1).** 0-3 s first card. 3-160 s: 12 cards at ~13 s. 160-180 s: luck line, raw mirror, "Your first
report: after this week closes, here in Practice."
**Input.** Presets 1-3, tap-to-place, steppers.
**Scoring.** Mean 100 - 15 x NIS, pooled, final at close: Honest 47.4, Wide 38.4, Bold 35.0. Volume adds nothing.
**Progression.** Report lines with bands at n >= 60, in a table view. **Practice tip for this generator** ("widen
jumpy paths by a fifth"): switch it on and next week's report compares expected-with-tip against expected-without on
your own ranges, both from the generator; actual results appear only as raw counts. The tip never changes your
inputs.
**Sharing.** None. **Engaging, not compulsive.** A document that is a reason to stop.
**Risks.** Still the slowest payoff; test whether the mirror carries session 1.

### S3-06 · Bias Boss
**Lineage:** S2-07 (warm-ups, decoy boss, normalised types, Your own boss); antithesis fixes (boss in session 1,
disclosure and opt-out, P3).
**Session-1 hook:** "The decoy was on card 2. Your range leaned toward it": a trick you fell for, explained.
**Format and data.** 6 warm-ups, then a 6-card boss. Session 1 uses the generic boss "Boss: one card has a decoy
line"; later the game picks the less-met bias.
**Flow (session 1).** 0-3 s first card. 3-75 s warm-ups at ~12 s. 75-165 s boss at ~15 s. 165-180 s summary: luck
line, decoy line, raw count.
**Input.** Presets, tap-to-place, steppers; decoys are dashed and named in the chart text.
**Scoring.** 100 - 15 x NIS, each boss type normalised to equal honest value. Warm-ups: Honest 284, Wide 230, Bold
210; sandbagging costs ~9 per card and buys nothing.
**Progression.** After 60 warm-ups, **your own boss**, titled "built from your last 60 warm-ups", with an opt-out to
the generic boss. The lean profile is private, exportable and deletable (P3).
**Sharing.** None. **Engaging, not compulsive.** Difficulty aimed at your real error, always explained.
**Risks.** Personal decoys are a disclosed deception; 10 runs per bias is slow.

Not investment advice. Past performance does not guarantee future results.
