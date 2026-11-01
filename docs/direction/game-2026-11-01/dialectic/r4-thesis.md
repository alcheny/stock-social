# F-8 dialectic, round 4: thesis (one thing first, one Practice area)

## Stance this round: two engines, six modes, build the call card first

The chair asks two questions of every design: is it the ONE thing to build first, and what does it add as a mode
inside a single Practice area? The honest answer starts from the cards, not the modes. The six designs run on
**two card engines**:

| Engine | Card | Designs on it | Really one game? |
|---|---|---|---|
| **Call card** | "Ends higher in 20 steps?" slider 2-98, server-held future, known p* | S3-01 Run, S3-03 Dojo | **Yes.** The Dojo is the Run's card scored against p* instead of the outcome. Same generator, same input, same reveal with one dot added. |
| **Range card** | "Where does it end?" presets, tap-to-place, steppers; 100 - 15 x NIS | S3-02 Ticket Run, S3-04 Shelf, S3-05 Week Report, S3-06 Bias Boss | **Three pairs collapse.** Bias Boss is a content family (decoys) for Ticket Run rooms. Week Report is a pooled view over any range play, not a mode. Shelf is the only range mode with a shared seed. |

**Proposed Practice area (one menu, four rows, no badges):** *Run* (call rooms; ticket rooms from week 2; boss
rooms drawn from S3-06), *Dojo* (luck-free tier ladder on the call card, finite), *This week's five* (S3-04,
shared, calm), and *Report* (S3-05, a page, never pushed). That is two engines plus one shared-seed service.

**Thesis ranking for first build:** S3-01 first (literal ask, cheapest engine, and its p* already powers the Dojo
and the luck line); S3-03 ships as its second scoring in the same release if it fits; the range engine is the
second build. Each section below still makes the strongest case for its design being first.

Common to every section: reference players **Honest** (says p* / the generator's 80% range), **Bold** (90 on
the favoured side / a range a third as wide), **Fifty** (always 50 / the wide preset, "Wide"). Points =
round(100 x (1 + log2 q)): 55 → +14/-15, 60 → +26/-32, 65 → +38/-51, 70 → +49/-74, 72 → +53/-84, 90 → +85/-232.
Range card: NIS = width/s + 10 x miss/s; card = 100 - 15 x NIS. Week = 4-5 sessions; "session 20" = end of week 4.
Wireframes are 360px wide (38 monospace columns inside the frame); the strip keeps its full wording and wraps.
The chair's note asks for arcs and two wireframes each, so sections run past the usual ~350 words; prose is held to
that, the wireframes are extra.

---

### S3-01 · Paper Call Run
**Case for first.** It is the owner's words: a ~3-minute roguelike run of paper calls. One input (a slider), one
server-held future per room, and points that teach "surer than the evidence costs" through the luck line. Every
other call-card mode reuses it.
**As a mode.** It adds **outcome tension** (the line is still moving when you lock) and a **route** (doors).
The Dojo adds nothing it lacks except the luck-free score, and the Run already shows p* at every reveal.
**Worked example (3 rooms: p* = 0.72 higher, 0.55 higher, 0.35 higher).** Honest locks 72 higher, 55 higher, 65
lower: expected +14.6, +1.0, +6.9 = **+22**. Bold locks 90, 90, 90 lower: -3.8, -57.7, -26.0 = **-88**. Fifty: **0**.
Outcomes higher, lower, lower: Honest 53 - 15 + 38 = **+76**; Bold 85 - 232 + 85 = **-62**. If room 2 had ended
higher, Bold scores 85 + 85 + 85 = **+255** against Honest's 105, and the luck line says exactly that: "Expected for
your calls: -88. Best possible here: +22. This run: +255."
**Delight.** Room 10: the boss path, labelled "this path can jump", sits on the edge. You held 60. It jumps
against you: -32. The reveal adds "A 98 here would have cost -464."
**Arc.** W1: 10 even rooms, boss at 10, luck line, raw bucket line. W2: doors after rooms 3 and 6 ("Snaps back",
"Keeps going", "Sudden jumps"), bosses at 4, 8, 10, the mandatory second call at each boss. W3: pooled n >= 60, so
the first claim with a band: "Your 70s went your way 66 percent of the time (band 54-77)." Harder jump families
open on the lower band. W4 (session 20): the route card is a door-icon row you send a friend; the mutation below
gives the comparison.
**Bold mutation: Ghost on the same seed.** A friend's route card carries a seed code. You play their 10 rooms
blind; after your summary their locked calls appear beside yours per room, and the comparison is **expected
against expected** ("Expected for your calls: +31. Friend's: +12"), so the outcome both of you saw cannot decide
it. One ghost per seed, no ladder, friend link with block, mute, silent decline.

```
+--------------------------------------+
| Practice game. Generated charts, not |
| market data. No money. Not invest-   |
| ment advice.                         |
+--------------------------------------+
| Room 3 of 10   * * o . . . . . . B   |
|  +6% |          _/\_                 |
|   0% |--/\_/\__/    \--.  ?          |
|  -6% |                  '            |
|      +---------------------- step 20 |
| Will the line end higher at step 20? |
| Lower |=========[]====| Higher       |
|         70 percent: higher           |
| [ Exit ]                  [ Lock ]   |
+--------------------------------------+
```
```
+--------------------------------------+
| (strip, full wording)                |
+--------------------------------------+
| Room 3 of 10: ended higher           |
|   0% |--/\_/\__/\_/\__/'''           |
|      +----------------------step 20  |
| Your call: 70 higher       +49       |
| Generator chance: 72 percent higher  |
| Text: path rose 4 percent in the     |
| last 20 steps; ended above start.    |
|                         [ Next room ]|
+--------------------------------------+
```

### S3-02 · Paper Ticket Run
**Case for first.** If the owner meant "predictions" as prices, not directions, this is the literal ask: a range
says more about belief than a coin side, and the plank walk is the best single animation in the set. It also
proves the range engine that four designs need.
**As a mode.** It adds **width as a judgement** and a **mystery per run** (Name the weather). It absorbs S3-06:
decoy rooms become one boss family here.
**Worked example (s = 5 percent; Honest -6..+6, Bold +1..+3, Wide -12..+12).** Width costs: Honest 36, Bold 6,
Wide 72. Truth +2: Honest 64, Bold 94, Wide 28. Truth +7 (Honest 1 outside, Bold 4 outside): Honest 100 - 36 - 30
= 34, Bold 100 - 6 - 120 = -26, Wide 28. Truth -4: Honest 64, Bold -56, Wide 28. Three rooms: **Honest 162, Bold
12, Wide 84**. Expected per room: 47.4 / 35.0 / 38.4. Full ticket adds the direction field at half weight; Fifty
on direction plus Wide on range ends at 192 against Honest's 300.
**Delight.** The plank walk: the path's tip creeps toward your right edge and stops a hair inside. The reveal
reads "Inside. Width -36, miss 0, room 64", and the next room shows what the Wide preset paid on the same path.
**Arc.** W1: range-only rooms, regime-switch keystone at room 10. W2: the direction field (full ticket). W3:
horizon doors (Long sight, Fog); Name the weather each run ("Snaps back / Keeps going / Sudden jumps / Calm",
chance 25-95). W4: pooled coverage with a band ("Your 80 percent ranges caught 74 percent, band 68-80"), new
families open on that band.
**Bold mutation: Cone room.** One room per run asks two ranges on the same path, at step 10 and step 20. The
reveal draws your two ranges as a cone beside the generator's cone. Score is the mean of the two cards (proper).
It teaches, without text, that honest width grows with the square root of time: a player who draws the same
width twice sees one range too wide and one too narrow.

```
+--------------------------------------+
| (strip, full wording, wraps)         |
+--------------------------------------+
| Room 4 of 10   * * * o . . . . . K   |
|  +8% |                 [  ]          |
|   0% |--/\_/\__/\_     [  ] <- range |
|  -8% |                 [  ]          |
|      +-------------------- step 20   |
| Where does this line end?            |
| [1 Narrow] [2 Medium] [3 Wide]       |
| Low  [-] -3 % [+]  High [-] +5 % [+] |
| from minus 3 to plus 5 percent       |
| [ Exit ]                  [ Lock ]   |
+--------------------------------------+
```
```
+--------------------------------------+
| Room 4: inside your range            |
|   0% |--/\_/\__/\_/\_/\--*  [  ]     |
| Range: minus 3 to plus 5 percent     |
| Ended: plus 4.6 percent              |
| Width -24   Miss 0   Room 76         |
| Wide preset here: room 28            |
| Text: ended 0.4 percent inside your  |
| top edge.                [ Next ]    |
+--------------------------------------+
```

### S3-03 · Dojo Ladder
**Case for first.** It is the only design whose score has **no luck at all**, so the first build cannot teach a
wrong lesson on day one, needs no luck line and is the cheapest to verify (every number is deterministic per
seed). It is finite by design, the safest answer to "engaging without compulsion".
**As a mode.** It is S3-01's card with the outcome removed from the score. It adds **earned range of expression**
(the slider track lengthens) and a **finish line**. It should not ship as a separate engine; it ships as the
call card's second scoring.
**Worked example (tier 2, track 10-90; p* = 0.70, 0.40, 0.85).** Honest 70, 40, 85: off by 0, DS 1.00, OI 0.
Bold 90, 20, 90: off by 20, 20, 5 (15 on average), mean squared 0.0275 against baseline 0.0575, **DS 0.52, OI
+0.15**. Fifty: off by 20, 10, 35 (21.7 on average), **DS 0, OI -0.22**. Lift needs n >= 60, DS lower band >= 0.5
and an OI band containing 0, so Bold and Fifty both stay on tier 2.
**Delight.** Card 7: your dot lands on the generator's dot. "You 64 · Generator 65 · off by 1." No outcome needed.
**Arc.** W1: tier 1 (25-75), "closest call" line. W2: ~session 6 the first pooled check; the track widens to
10-90 in place, no banner. W3: 2-98; your OI band shows where you lean ("slightly surer than the evidence, band
+0.01 to +0.06"). W4: Read the forecaster (bot probability table, binary truth, points), then "Nothing left to
prove here"; data stays exportable and deletable.
**Bold mutation: Mirror match.** Two friends take the same 12 paths; after both lock, one line: "You off by 6 on
average, friend off by 9." It is the only fair head-to-head in Practice because neither outcome nor luck enters
it. Pooled only (one session is never ranked alone), no public table, friend link rules.

```
+--------------------------------------+
| (strip, full wording, wraps)         |
+--------------------------------------+
| Card 5 of 12                         |
|   0% |__/\_/\/\__/\_  ?              |
|      +------------------ step 20     |
| Will it end higher at step 20?       |
| Lower 25 |======[]=====| 75 Higher   |
| 60 percent: higher. Maximum 75;      |
| widens when your calls match the     |
| evidence.                            |
| [ Exit ]                  [ Lock ]   |
+--------------------------------------+
```
```
+--------------------------------------+
| Card 5 of 12                         |
| 25 |-------[Y]---[G]--------| 75     |
|     You 60 · Generator 70            |
|     off by 10                        |
| (Outcome: ended lower. This score    |
|  compares you with the generator,    |
|  not the outcome.)                   |
|                          [ Next ]    |
+--------------------------------------+
```

### S3-04 · Shared Shelf (This week's five)
**Case for first.** It is the smallest build that is **social on day one**: five questions, everyone the same,
one close-time job. It is the calmest cadence in the set (a missed week loses nothing) and the dip question gives
a real "randomness is wider than you think" surprise.
**As a mode.** It is the only **shared-seed** surface; the range engine otherwise runs on personal seeds. The
room after (crowd density, n >= 20) is what no other mode can offer. Its pooled crowd line belongs on the Report
page, so S3-04 and S3-05 are one game seen at two cadences.
**Worked example (dip card, s = 4 percent; Honest -9..-2, Bold -4..-2, Wide -16..0).** Width costs: Honest 26,
Bold 8, Wide 60. Truth dip -7.5: Honest 74, Bold 100 - 8 - 131 = -39, Wide 40. Expected over five: **Honest 237,
Wide 192, Bold 175**.
**Delight.** After close, "Room after": your range as a solid bar over a soft density of everyone's, and the
dip falls where only a sliver of the room reached.
**Arc.** W1: five end-point / dip / crossing questions, close in 72 h, shelf otherwise. W2: Pick the question
(three statistics per path, conditional s). W3: friend stacked reveal. W4: after 12 weeks only, the pooled crowd
coverage with a band; until then the room shows the density alone.
**Bold mutation: Read the room.** One extra card per week: "How wide will the median player's range be on
question 3?" Scored by the same range formula at close, against a synthetic path's crowd, never a live security.
Social comparison becomes a judgement, not a rank.

```
+--------------------------------------+
| (strip, full wording, wraps)         |
+--------------------------------------+
| This week's five · 2 of 5            |
| Closes Thu 18:00 (in 51 hours)       |
|   0% |--\/\_/\__   ?                 |
| Biggest dip in this path, in percent |
| [1][2][3][4][5] presets              |
| Low [-] -9 % [+]  High [-] -2 % [+]  |
| [ Exit ]                  [ Lock ]   |
+--------------------------------------+
```
```
+--------------------------------------+
| Question 2 · room after (214 players)|
|  -16%        ..:::::::..        0%   |
|              [===You===]             |
|                    ^ dip -7.5        |
| You: minus 9 to minus 2. Inside.     |
| Width -26  Miss 0  Card 74           |
| Text: 31 percent of ranges held it.  |
+--------------------------------------+
```

### S3-05 · Week Report
**Case for first.** It is the most honest product: volume adds nothing, the score is final only at close, and
the report is a stop cue. If the owner wants the layer to visibly reward judgement over time, this is the only
design that is about the pooled window from the start.
**As a mode.** It is not a mode; it is the **Report page** for every range card played that week (Run, Shelf,
Boss). As a standalone first build it is the weakest session 1; as the Practice area's page it is essential.
**Worked example (12 cards, s = 5).** Expected per card Honest 47.4, Wide 38.4, Bold 35.0. Raw mirror after
session 1: Honest "caught 10 of 12; an 80% range expects about 10"; Bold "caught 6 of 12; an 80% range expects
about 10". Fifty (Wide) "caught 12 of 12" with an expected card of 38 against Honest's 47: full catches, lower score, the line that shows lazy width.
**Delight.** The report opens with your sealed letter (mutation) and its answer.
**Arc.** W1: mirror only. W2: first report with the one-twist week. W3: n >= 60, bands, table view; switch on
a practice tip. W4: the report shows expected-with-tip against expected-without on your own ranges.
**Bold mutation: Sealed letter.** In session 1 of a week you give a range for your own week: "How many of your
next 36 ranges will hold the line?" It is scored at close with the range formula (s = 2.4, binomial). Honest
writes 26-32, catches 29: 63. Bold writes 30-33, catches 19: about -600. Overconfidence about yourself, shown
once a week, kept apart from the week score.

```
+--------------------------------------+
| (strip, full wording, wraps)         |
+--------------------------------------+
| This week: shorter visible history   |
| Card 7 of 12                         |
|   0% |_/\_/  ?          (short view) |
| Where does this line end?            |
| [1 Narrow] [2 Medium] [3 Wide]       |
| Low [-] -4 % [+]  High [-] +4 % [+]  |
| [ Exit ]                  [ Lock ]   |
+--------------------------------------+
```
```
+--------------------------------------+
| Week report (closed Sun)  [Table]    |
| Your letter: 30 to 33 held. Held: 19 |
| An 80% range expects about 29.       |
| Cards 36 · mean card 31              |
| Expected for your ranges: 33         |
| Band (n=72): 27 to 36                |
| Not investment advice. Past perfor-  |
| mance does not guarantee future      |
| results.                   [ Done ]  |
+--------------------------------------+
```

### S3-06 · Bias Boss
**Case for first.** It is the only design whose difficulty aims at your real error and explains it; "the decoy
was on card 2, your range leaned toward it" is the most memorable sentence in the set.
**As a mode.** It is a **content family** for S3-02's range rooms (a decoy boss in place of the keystone), not
an engine. Built alone it carries a range engine and a per-user generator: the costliest first build.
**Worked example (decoy card, generator centre 0, dashed decoy line at +6, s = 5).** Honest -6..+6; Leaner
0..+10 (lean +1.0 s toward the decoy). Truth -3: Honest 64; Leaner 100 - 30 - 90 = -20. Warm-ups over six:
**Honest 284, Wide 230, Bold 210**; sandbagging costs ~9 per card and buys nothing (bosses normalised).
**Delight.** The boss summary names the card: "Card 2 had the decoy. Your range sat 1 width toward it."
**Arc.** W1: generic decoy boss. W2: three named types (decoy line, recent spike, round number). W3: after 60
warm-ups, "your own boss, built from your last 60 warm-ups" (opt-out). W4: per-type lean with a band; a type
retires when its band contains 0.
**Bold mutation: Set a boss for a friend.** Pick a decoy type and card from a menu (4 x 6, no free text) for a
friend's seed. They see "Set by a friend" on the boss title. The setter learns only "your boss caught them on 2
of 6", and only if the player chooses to send it back.

```
+--------------------------------------+
| (strip, full wording, wraps)         |
+--------------------------------------+
| Boss 2 of 6: one card has a decoy    |
|  +6% |- - - - - - - - - decoy        |
|   0% |__/\_/\/\__/\_  ?              |
| Where does this line end?            |
| [1 Narrow] [2 Medium] [3 Wide]       |
| Low [-] -6 % [+]  High [-] +6 % [+]  |
| [ Exit ]                  [ Lock ]   |
+--------------------------------------+
```
```
+--------------------------------------+
| Boss done                            |
| The decoy was on card 2 (dashed line |
| at plus 6 percent). Your range sat   |
| 1 width toward it. Cost: about -40.  |
| Expected for your calls: 182.        |
| Best possible here: 238. Run: 151.   |
| Not investment advice. Past perfor-  |
| mance does not guarantee future      |
| results.                   [ Done ]  |
+--------------------------------------+
```

Not investment advice. Past performance does not guarantee future results.
