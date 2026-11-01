# F-8 dialectic, round 5: synthesis (the five finalists for the committee vote)

Five complete, self-contained answers to "what is the F-8 game". Each inherits **Shared shell v6** below; the
committee votes for one. F-A to F-D differ in what they build; F-E differs in when and how little. Every number is
recomputed under the round-5 convention (shell 13). Sections run past ~350 words because the chair asked for
complete finalists (about 700 words each plus the shell).

## Round 5 result

| In ids | Out id | Kept / merged / dropped | One-line reason |
|---|---|---|---|
| S4-01 Forecast Run (+ Lenses mutation) | **F-A** Forecast Run | kept (fixed) | Literal roguelike; Lenses kept only with "each lens best in some weather" and ex-ante values; shown room counts; p* clamped; ACs reworded. |
| S4-02 Range Run (+ Two rings mutation) | **F-B** Range Run | kept (fixed) | Plank walk made constant, short, skippable (veto lifted); Two rings kept, compared on shortfall; Name the weather scored by the four-option rule; tails copy corrected. |
| S4-03 This Week's Five (+ week's weather) | **F-C** This Week's Five | kept (fixed), labelled "other game-like feature" | log4 rule with 2..94; seed hash at open; floor counted on Practice players; "stopped short of it" copy. |
| S4-04 Forecast + Range on one engine (+ Twin room) | **F-D** Practice, staged | kept (fixed) | Day one is F-A; Range row on a calendar unlock; implied chance shown only after both Locks; new coherence phrase. |
| S4-05 The dated test (+ One door) | **F-E** The dated test | kept (fixed) | Power corrected (~900 per arm at full uptake, ~20,500 at 20%); expected result "stop" signed in advance; D7 defined; views stop rule thresholded; -88 frame. |
| Thesis paper-stake sentence | design doc only (shell 14) | moved | Maths right, objective swapped (log growth, not average return); reads as a wager on the explainer page. |

## Shared shell v6 (every finalist inherits every rule)

1. **Copy.** "Forecast", never "call" or "pick". "Best expected here", never "best possible". One phrase per
   concept: "off by 7" (you vs the generator's chance), "2 percent outside" (range miss), "a full range-width toward
   it" (bias lean), "differ by 22" (two of your own answers). Distances, never closeness ("ended 0.4 percent inside",
   never "so close" or "just"). No jargon (bits, KL, interval score). "Points" is only the score. UI says "line" and
   "percent", never "price".
2. **Banned words.** No Practice page, including "How Practice is scored", matches
   `/\b(stake|odds|bet|wager|return|returns|payout|wealth|win|jackpot)\b/i` (copy scan in CI).
3. **Targets and layout.** Every control >= 44 x 44 px, gaps >= 8 px. Exit top-left, Lock bottom-right, never on one
   row. At viewport 360 x 560 Lock's bounding box is inside the viewport without scrolling (360 x 640 phone minus
   chrome); chart 120 px. At 200% text and 320 px reflow the card scrolls, never clips; Lock reachable by Tab and
   scroll. Wireframes are layout, not size.
4. **Strip and disclaimer.** First card of a session: full strip "Practice game. Generated charts, not market data.
   No money. Not investment advice." Later cards: "Practice game · generated · no money" with the full strip as its
   accessible name. Every reveal and summary contains "Not investment advice. Past performance does not guarantee
   future results." once, as one unbroken string (DOM textContent check). O1 may relax reveals only.
5. **Footer.** `footer.site nav.legal`: Terms, Privacy, "How Practice is scored", each 44 px.
6. **Slider.** 2-98 everywhere; [-1]/[+1] buttons; arrows 1, Page 10, Home/End; readout "70 percent: higher"; at 50
   "50: no view. Scores 0 every time." Room position as text ("Room 3 of 10 · boss at room 10"), in a live region.
7. **Shown counts (replaces the v5 Exit rule).** A room counts once its chart is shown. Exit on an unlocked card
   scores that room as no view (50, 0 points, full shortfall). Exit ends the run; no retry; a started seed is never
   reissued. "Run ended at room 4. 4 rooms scored; room 4 as no view."
8. **Times.** Absolute only ("Closes Thursday 18:00, your time"); no relative times, countdowns or timers.
9. **Counterfactuals** are generator expectations labelled "expected", never another outcome.
10. **Finish cues.** Each mode: n >= 60 shown rooms and upper 95% band of mean shortfall (mean + 1.96 x sd / sqrt(n))
    <= margin M. **M is a config value set in playtest**, default 5 per room for forecasts and 5 card points for
    ranges (a forecaster about 10 points off p* has shortfall about 3.1-3.6 per room, so 3 sat on the line). Target:
    25-50% of playtesters who reach 120 shown rooms pass. On pass the mode says so once; afterwards no "This run" or
    luck line, only expected lines.
11. **Compare on shortfall.** Whenever a door changes the scale (Two rings, Lenses), the Report and summaries
    compare shortfall against Best expected, never raw points or cards. Two scoring rules are never summed.
12. **Clamp.** Generator p* lives in 0.02..0.98; every implied chance is clamped to 2..98; four-option forecasts keep
    each option in 2..94, summing to 100.
13. **Convention.** Expected = 100 x (1 + p log2 q + (1 - p) log2(1 - q)) from the exact formula; Best expected = the
    same at q = p*; room points round(100 x (1 + log2 q_outcome)) rounded once per room; totals sum rounded room points.
14. **Owner note (design doc only, never in UI).** Points equal the log growth of a paper split at even odds, so
    maximising expected points means forecasting honestly. "A game that pays average return rewards going all-in;
    this one pays log growth, which rewards only the honest forecast." The explainer says only: "Points reward saying
    how sure you are, honestly. 50 scores 0. Saying 90 when 70 is right costs you on average, even when you are lucky."
15. **Animations** run at constant speed, <= 1.5 s, silent, skippable (any key or tap), never decelerate near an
    edge; a static frame under prefers-reduced-motion.
16. **No social graph.** No ghosts, mirrors, friend reveals, seed passing or head-to-head. Seeds personal and opaque.
17. **Placement.** Practice only in the signed-in, 18+ attested account menu. Never in the feed, on a profile, a share
    card or beside a verified number. No push, email or badge, ever (F3b). No in-app comment box.
18. **Report page**, never pushed: one n, plain words, bucket bands only at n >= 60, table view, export and delete (P3).
19. **Signed-out demo card** (if O2 allows): one public fixed path at "Try a practice forecast", footer link only,
    stores nothing, no share button. Reveal: "Your forecast: 70 percent higher. Generator chance: 72 percent. Expected
    for your forecast: +14. Best expected: +14." plus the full line and "Practice needs an account and is for adults
    (18+)." Its page views are counted apart from profile views.

**Reference players.** Honest (says p* / the generator's 80% range), Bold (90 on the favoured side / a range a third
as wide, same centre), Fifty (always 50 / Wide preset). Points: 55 → +14/-15, 65 → +38/-51, 70 → +49/-74, 72 →
+53/-84, 90 → +85/-232, 98 → +97/-464. Range card = 100 - 15 x (width/s + 10 x miss/s); with the end point normal,
sigma 4.68, s = 5: Honest -6..+6 **50.7**, Bold -2..+2 **25.9**, Wide -12..+12 **27.5**.

**Owner questions.** O1 points as "performance" under F3; O2 signed-out demo under P4; O3 timing (after week-8 gates,
or F-E now); O4 F-C's floor (20 distinct weekly Practice players, or higher).

**Business lead's dissent (binding on framing).** Phase fit 1, demand 2 for every finalist: none moves a week-8 gate.
Vote design and timing separately. Coherent staging: F-D (day one = F-A) with F-E as its timing gate; F-B is the
evidence-gated second row; F-C is the destination once there is a crowd.

---

### F-A · Forecast Run
**Lineage:** S4-01 (10 rooms, doors, jump bosses, second forecast, finish line, Read the forecaster, Lenses); S4-05
(fixed session-1 run); round-5 antithesis (shown counts, clamp, lens property, ACs).

**Summary.** Practice menu: **Forecast run** and **Report**. A ten-room run of generated lines; each room asks "Will
the line end higher at step 20?" as a chance on a slider. Doors choose the weather of later rooms, bosses ask a second
forecast, and the run ends in a summary that separates skill (expected) from luck (outcome). A stated finish says
when you forecast at the generator's level.

**Roguelike elements.** Fixed run of 10 rooms; route choice (doors after 3, lens door after 6); content families
(snap-back, trend, jump); bosses at 4, 8, 10; run summary; personal opaque seeds; no retry (permadeath analogue).

**Session flow (session 2+).** 0-3 s first card. 3-45 s rooms 1-3 at ~14 s (path 1.5 s, forecast, Lock, reveal).
45-50 s door: "Snaps back / Keeps going / Sudden jumps". Boss at room 4 with a second forecast five steps later.
~95 s lens door: **Longer history** (40 steps), **Weather label** (family named), **Sister path** (one ended path,
same settings, dashed line plus text summary) for rooms 7-10. Bosses 8 and 10. 165-180 s summary. Session 1: even
rooms, no doors, one announced jump boss at 10.

**Scoring.** Room = round(100 x (1 + log2 q_outcome)); Expected and Best expected per shell 13; shortfall = Best -
Expected, zero only at q = p*. Boss = mean of its two forecasts. Worked (p* 0.72 / 0.55 / 0.35 higher): Expected
Honest **+22** (14.5 + 0.7 + 6.6 = 21.8), Bold **-88** (-4.0 / -57.8 / -26.1), Fifty **0**. Outcomes H, L, L: Honest
53 - 15 + 38 = **+76**, Bold 85 - 232 + 85 = **-62**, Fifty 0. Had room 2 ended higher: Bold **+255**, Honest +105;
the summary still reads "Expected for your forecasts: -88. Best expected here: +22." Lenses: p* is the generator's
chance given what the lens shows; the summary prices this run's lenses ex ante ("Weather label raised best expected
by +3 a room; Longer history would have raised it by +5"). Lens value depends on the run's weather, so choosing well
means reading rooms 1-6, not memorising a winner.

**Progression and finish.** W1 even rooms; W2 doors and bosses; W3 lenses and bucket bands at n >= 60. Finish cue
(shell 10): "You forecast at the generator's level here. What is left is luck." Then **Read the forecaster** (20
forecasts of a generated bot as a table, no handle or avatar), then "Nothing left to prove here." Runs stay playable,
expected lines only.

**Sharing.** "Copy route" gives text only: "Practice route: Snaps back, Keeps going, Weather label. Practice game.
Generated charts, not market data. No money." No numbers, seed, handle, link or image card.

**Players return because** each run asks a new question they can get better at, and the game says when they have,
**not because** a lucky run might come next: the luck line disappears after the finish.

```
+--------------------------------------+
| [ Exit ]  Room 3 of 10 · boss at 4   |
| Practice game · generated · no money |
+--------------------------------------+
|  +6% |          _/\_                 |
|   0% |--/\_/\__/    \--.  ?          |
|  -6% |                  '            |
|      +----------------------- step 20|
| Will the line end higher at step 20? |
| Lower |=========[]=========| Higher  |
| [ -1 ]  70 percent: higher  [ +1 ]   |
|                            [ Lock ]  |
+--------------------------------------+
| Terms · Privacy · How Practice is    |
| scored                               |
+--------------------------------------+
```
```
+--------------------------------------+
| [ Exit ]  Room 3 of 10: ended higher |
+--------------------------------------+
|   0% |--/\_/\__/\_/\__/'''           |
| Your forecast: 70 percent higher +49 |
| Generator chance: 72 percent higher  |
| Off by 2. Expected: +14 (best +14).  |
| Points vary by luck; expected do not.|
| Text: the line rose 4 percent in the |
| last 20 steps and ended above start. |
| Not investment advice. Past          |
| performance does not guarantee       |
| future results.                      |
|                        [ Next room ] |
+--------------------------------------+
```
```
+--------------------------------------+
| Run summary · 10 rooms               |
+--------------------------------------+
| Expected for your forecasts: +31     |
| Best expected here: +48              |
| This run: +112                       |
| Luck moved this run by +81 points.   |
| Your 70s: 4 of 6 went your way.      |
| Weather label raised best expected   |
| by +3 a room; Longer history would   |
| have raised it by +5.                |
| Not investment advice. Past          |
| performance does not guarantee       |
| future results.  [ Copy route ][Done]|
+--------------------------------------+
```
(Summary values other than the formulas are illustrative.)

**Metrics.** Learning: median shortfall per room falls >= 30% from runs 1-3 to runs 8-10 (target). Finish reach:
25-50% of players with 120 shown rooms. Health: verified-page views per Practice player not lower than holdout
(upper 95% band of change >= 0). Compulsion guard: < 5% of sessions with more than 3 runs back to back. **Stop** if
shortfall does not fall by week 8, the views band upper bound is < 0, or any compliance/T&S incident.

**Risks.** Players read only "This run" before the finish; lens posteriors need discrete family parameters;
M mis-tuned leaves only luck varying.

**Acceptance criteria.**
1. Points = round(100 x (1 + log2 q)); q = 50 scores 0 on either outcome (unit).
2. Expected = 100 x (1 + p log2 q + (1 - p) log2(1 - q)) and Best = Expected at q = p*, to 0.1 for p* in 0.02..0.98
   (property).
3. Fixture p* 0.72 / 0.55 / 0.35 reproduces Expected +22 / -88 / 0 and outcomes +76 / -62 / 0 (unit).
4. Exit after a room's chart is shown scores it 50; pooled n equals rooms shown; a started seed is never reissued (API).
5. Generator p* is in 0.02..0.98 for 10^5 sampled rooms (property).
6. Each lens has the highest expected value in at least one family mix (property).
7. Lens summary values are generator expectations, never another outcome (unit).
8. Every reveal and summary contains the full disclaimer string once (DOM textContent).
9. At 360 x 560, Lock's box is inside the viewport unscrolled; every control >= 44 x 44; gaps >= 8 (Playwright).
10. Fixture of 60 shown rooms with known shortfalls fires the cue exactly once at margin M; afterwards no "This run"
    or "Luck moved" text (unit + e2e).
11. Practice entry only in the signed-in account menu; absent from feed, profiles and share cards (e2e).
12. Copied route text contains no digits and the strip text (unit); copy scan passes shell 2.

---

### F-B · Range Run
**Lineage:** S4-02 (10 rooms, plank walk, horizon doors, bias bosses, Cone room, Name the weather, Two rings); round-5
antithesis (veto conditions, shortfall comparison, weather scoring, tails copy, retire rule).

**Summary.** Practice menu: **Range run** and **Report**. Each room asks "Where does this line end?" as a low and
high percent. The score rewards a range exactly as wide as the uncertainty: a percent outside costs ten times a
percent of width. Bias bosses aim at the player's own lean and retire when it is gone; the run ends by naming its
weather.

**Roguelike elements.** 10 rooms; horizon doors (Long sight, Fog) and a Two rings door; weather families; bias boss
at 10; one Cone room; Name the weather as the closing riddle; personal seeds; summary; no retry.

**Session flow (session 3+).** 0-3 s first card. 3-150 s ten rooms at ~14 s (path 1.5 s, preset or steppers, Lock,
plank walk <= 1.5 s, reveal). Door after room 5. Cone room: ranges at step 10 and 20, both locked before any reveal.
150-165 s Name the weather (four named options, chances summing to 100). 165-180 s summary. Session 1: range only;
session 2 adds doors.

**Scoring.** Card = 100 - 15 x (width/s + 10 x miss/s), s = 5. Worked: Honest -6..+6, Bold -2..+2, Wide -12..+12;
outcomes +2 / +7 / -4: Honest 64 + 34 + 64 = **162**, Bold 88 - 62 + 28 = **54**, Wide **84**. Expected per room
**50.7 / 25.9 / 27.5**. Two rings: card = 100 - 15 x mean of (w50 + 4 m50)/s and (w90 + 20 m90)/s; Best expected
**53.2**, Bold (both rings a third as wide) **21.0**, Wide (both rings at ±12) **27.4**; compared on shortfall only.
Copy: "Calm weather: outer ring about 2.4 times the inner. Jump weather: 3 times or more." Name the weather:
100 x (1 + log4 q) on the true option, each option 2..94: uniform 0, 60 on the truth **+63**, 94 **+96**, 2 **-182**;
shown on its own line, never added to cards.

**Progression and finish.** Bias bosses (decoy line, recent spike, round number) name the trap after the run: "The
decoy line was on card 2. Your range sat a full range-width toward it." Lean = signed (end - centre) / width toward
the bias; a type retires when its 95% band is inside ±0.25 with n >= 20 of that type. Finish cue (shell 10): "Your
ranges are as wide as this generator needs."

**Sharing.** None.

**Players return because** the run teaches a shape (how wide uncertainty really is) they visibly improve at, and each
bias retires, **not because** "inside" feels like a win to chase.

```
+--------------------------------------+
| [ Exit ]  Room 4 of 10 · boss at 10  |
| Practice game · generated · no money |
+--------------------------------------+
|  +8% |                 [  ]          |
|   0% |--/\_/\__/\_     [  ] range    |
|  -8% |                 [  ]          |
|      +----------------------- step 20|
| Where does this line end?            |
| [ Narrow ]  [ Medium ]  [ Wide ]     |
| Low   [ - ]  minus 3 percent  [ + ]  |
| High  [ - ]  plus 5 percent   [ + ]  |
|                            [ Lock ]  |
+--------------------------------------+
| Terms · Privacy · How Practice is    |
| scored                               |
+--------------------------------------+
```
```
+--------------------------------------+
| [ Exit ]  Room 4: ended plus 4.6     |
+--------------------------------------+
|   0% |--/\_/\__/\_/\_/\--*  [  ]     |
| Range: minus 3 to plus 5 percent     |
| Width -24   Outside 0   Room 76      |
| Expected for your range: 44          |
| Best expected here: 51               |
| Wide preset, expected: 28            |
| Text: ended 0.4 percent inside your  |
| top edge.                            |
| Not investment advice. Past          |
| performance does not guarantee       |
| future results.             [ Next ] |
+--------------------------------------+
```
```
+--------------------------------------+
| Run summary · 10 rooms               |
+--------------------------------------+
| Shortfall per room: 6 (best 0)       |
| Expected per room: 45 · Best: 51     |
| This run: average room 58            |
| Ranges held 8 of 10; an 80% range    |
| expects about 8.                     |
| Weather: Sudden jumps. You gave it   |
| 60 percent: +63.                     |
| Not investment advice. Past          |
| performance does not guarantee       |
| future results.             [ Done ] |
+--------------------------------------+
```
(-3..+5 under sigma 4.68 expects 43.6, shown 44; summary run values illustrative.)

**Metrics.** Learning: median shortfall falls >= 30% runs 1-3 to 8-10; coverage moves toward 70-90%. At least one
bias type retires for >= 40% of players by 60 shown rooms. Health and compulsion guards as F-A. **Stop** if
shortfall does not fall, abandonment at the stepper card exceeds 30%, or any incident.

**Risks.** Highest input load; four statistic modules; Two rings' four rows scroll at 360 px.

**Acceptance criteria.**
1. Card formula reproduces 162 / 54 / 84 for the worked outcomes (unit).
2. Over all integer (Low, High) pairs, the argmax of expected card is the pair nearest the generator's 10% and 90%
   points (property).
3. Two-ring fixture gives 53 / 21 / 27 (unit); Report and summary show shortfall, never a raw card average across
   door types (unit).
4. Narrow, Medium, Wide are 44 px presets; Low/High step 1 percent; width >= 1 percent enforced; keys 1-3 (keyboard e2e).
5. Cone room: server rejects a second Lock after any reveal (API).
6. Every counterfactual line contains "expected" (copy regex).
7. Plank walk: constant velocity, duration <= 1.5 s, skippable, silent; static frame under reduced motion; reveal text
   names the end point (e2e timing + emulateMedia).
8. Retire rule fixture with n = 20 retires exactly when the band is inside ±0.25 (unit).
9. Weather score uses log4 with options 2..94 summing to 100; uniform scores 0 (unit).
10. No range on any share surface (share-card render test); copy scan rejects "so close", "just", "price".
11. At 360 x 560 Lock visible unscrolled on the base card; at 200% text Lock reachable by scroll and Tab (Playwright).

---

### F-C · This Week's Five
**Lineage:** S4-03 (shared weekly five, end-point / dip / crossing statistics, week report, week's weather); round-5
antithesis (log4, seed commitment, Practice-player floor, attested density, copy).

**Summary.** **Honestly labelled the "other game-like feature", not a roguelike.** Practice menu: **This week's
five** and **Report**. Every Monday five generated paths open for everyone with one range question each; truth and
the crowd appear after Thursday's close. A missed week loses nothing.

**Game-like elements.** One fixed set of five (a short run); Pick the question (a choice of statistic); varied
statistics; a shared hidden regime; a week report; a shared seed committed by hash. No rooms, bosses or doors.

**Session flow.** 0-3 s first question. 3-150 s five questions at ~30 s (read, preset or steppers, Lock; no reveal).
150-170 s with the fifth Lock, forecast the week's weather (four options). 170-180 s "Locked 5 of 5. Results after
Thursday 18:00, your time." After close, a results page, never pushed.

**Scoring.** Range card per statistic scale (dip s = 4). Worked dip: Honest -9..-2 expects **64**, Bold -7..-4
**51**, Wide -16..0 **39 under the illustrative normal** (40 if the generator's dip never falls below -16; the build
uses the generator's own bounded, skewed distribution, never the normal). Truth -7.5: **74 / 70 / 40**; truth -11:
**-1 / -61 / 40**. Week's weather: 100 x (1 + log4 q), each option 2..94 summing to 100; uniform 0.

**Progression and finish.** W2 Pick the question. After 12 weeks a pooled coverage band; finish cue when it sits
inside 70-90%: "Your ranges hold at the honest rate here." The Report never shows "weeks played of N", gaps or a
calendar.

**Integrity.** A hash of the week's seed is published at open and the seed at close, so anyone can check the truth
was fixed before the crowd. Crowd density counts attested accounts only and renders only at >= 20 of them.

**Sharing.** None in-app; no comment box. Theories happen off-platform; truth exists only after close.

**Players return because** there is one shared puzzle a week, final at close, worth talking about, **not because** a
streak or a missed-week mark waits (there are none).

```
+--------------------------------------+
| [ Exit ]  This week's five · 2 of 5  |
| Practice game · generated · no money |
| Closes Thursday 18:00, your time     |
+--------------------------------------+
|   0% |--\/\_/\__   ?                 |
|      +----------------------- step 20|
| Biggest dip in this path, in percent |
| [ Narrowest ] [ Narrow ] [ Medium ]  |
| [ Wide ]  [ Widest ]                 |
| Low   [ - ]  minus 9 percent  [ + ]  |
| High  [ - ]  minus 2 percent  [ + ]  |
|                            [ Lock ]  |
+--------------------------------------+
| Terms · Privacy · How Practice is    |
| scored                               |
+--------------------------------------+
```
```
+--------------------------------------+
| [ Back ]  Question 2 · 214 played    |
+--------------------------------------+
|  -16%       ..:::::::..         0%   |
|              [===You===]             |
|                    ^ dip -7.5        |
| You: minus 9 to minus 2. Inside.     |
| Width -26   Outside 0   Card 74      |
| Text: 69 percent of ranges stopped   |
| short of it; yours held it.          |
| Seed check: matches the hash posted  |
| at open.                             |
| Not investment advice. Past          |
| performance does not guarantee       |
| future results.             [ Next ] |
+--------------------------------------+
```
```
+--------------------------------------+
| [ Back ]  Week report                |
+--------------------------------------+
| Ranges this week: 5                  |
| Expected for your ranges: 48         |
| Best expected here: 55               |
| This week: average card 52           |
| Week's weather: Slow trend. You gave |
| it 50 percent: +50.                  |
| Not investment advice. Past          |
| performance does not guarantee       |
| future results.             [ Done ] |
+--------------------------------------+
```
(Report values illustrative except the weather score: 100 x (1 + log4 0.5) = 50.)

**Metrics.** Opens only when distinct weekly Practice players >= floor (O4) for 4 consecutive weeks. Then: >= 50% of a
week's players open the results page; median coverage moves toward 80%. **Stop** (close the shelf, unannounced) if
players fall below the floor for 4 weeks or any incident.

**Risks.** Needs volume the product will not have at week 8; a weekly close is a soft deadline; Sybil pressure on the
density floor.

**Acceptance criteria.**
1. Truth and crowd endpoints return 403/empty before close (API).
2. Hash published at open equals hash of the seed revealed at close (API).
3. Copy scan rejects "in N hours", "left", "ago", "remaining"; close shown as absolute time (regex).
4. Density renders at 20 attested players, not at 19 (fixtures); unattested accounts excluded (unit).
5. Five 44 px presets, 8 px gaps; Lock reachable by scroll at 360 px (Playwright).
6. No streak, missed-week, "weeks played" or reminder state; no push, email or badge (grep + e2e).
7. Weather scored by 100 x (1 + log4 q), options 2..94 summing to 100, uniform 0 (unit).
8. Shelf route returns 404 until distinct weekly Practice players >= floor in 4 consecutive weeks (unit, fixture).
9. Dip fixture -7.5 gives 74 / 70 / 40 (unit).

---

### F-D · Practice, staged (Forecast run now, Range run on evidence)
**Lineage:** S4-04 (one card engine, two rows, Twin room); S4-01 (day-one build); S4-02 (Range row); round-5
antithesis (calendar unlock, implied chance after both Locks, width guard, new phrase).

**Summary.** Day one is **exactly F-A**: Forecast run plus Report. A **Range run** row (F-B's content) appears after
the first Forecast finish cue or 14 days after the first run, whichever is first, and only if the build gate (Range
row built only after Forecast shows players come back) has opened. One card shell: same header, Exit and Lock
positions, one generator, seed service, scoring service with two proper rules, one Report.

**Roguelike elements.** F-A's and F-B's, plus the **Twin room**: once both rows are open, one room per run asks both on
one path: range first (Lock), then side (Lock).

**Session flow.** Session 1 = F-A session 1. Later: one run of either kind, ~3 minutes; the menu never suggests which.

**Scoring.** Never summed. Forecast: Honest +22 / Bold -88 / Fifty 0 over F-A's three rooms (Bold expects 110 less).
Range: 50.7 / 25.9 / 27.5 per room. Twin room implied chance = Phi(centre / (half-width / 1.2816)), clamped 2..98,
unscored, shown only after both Locks: range -5..+7 (centre +1, half-width 6) implies **58**; "Your range and your
forecast differ by 22." when the forecast was 80.

**Progression and finish.** Each row has its own cue. Both passed: "Both modes are done here. Your Report stays." No
third row, no currency.

**Sharing.** F-A's text route from the Forecast run only.

**Players return because** two different judgements (which side and how sure; how wide) each have an end, **not
because** a new row or currency keeps appearing.

```
+--------------------------------------+
| [ Back ]  Practice                   |
+--------------------------------------+
| [ Forecast run ]                     |
|   10 rooms, about 3 minutes.         |
|   Finish: not yet reached.           |
| [ Range run ]                        |
|   10 rooms, about 3 minutes.         |
| [ Report ]                           |
| Practice game. Generated charts, not |
| market data. No money. Not           |
| investment advice.                   |
+--------------------------------------+
| Terms · Privacy · How Practice is    |
| scored                               |
+--------------------------------------+
```
```
+--------------------------------------+
| [ Exit ]  Twin room: ended plus 2.1  |
+--------------------------------------+
|   0% |--/\_/\__/\_/'''  [  ]         |
| Range: minus 5 to plus 7. Room 64    |
| Forecast: 80 percent higher. +68     |
| Your range implied 58 percent        |
| higher. Your range and your forecast |
| differ by 22.                        |
| Not investment advice. Past          |
| performance does not guarantee       |
| future results.             [ Next ] |
+--------------------------------------+
```
```
+--------------------------------------+
| [ Back ]  Report · this week         |
+--------------------------------------+
| Forecasts: 30 · shortfall 3 a room   |
| Expected per forecast: +6 (best +9)  |
| Range rooms: 20 · shortfall 5 a room |
| Expected per room: 46 (best 51)      |
| Your 70s: 14 of 20 went your way.    |
| A confidence band appears at 60.     |
| Not investment advice. Past          |
| performance does not guarantee       |
| future results.        [ Table ]     |
+--------------------------------------+
```
(Twin reveal: width 12, s = 5 gives card 64; 80 on the outcome gives round(67.8) = +68. Report values illustrative.)

**Metrics.** Range row is built only if F-A players' 28-day return to Practice is >= 25% and F-A's stop rules have not
fired. After both: shortfall falls in each row; Twin "differ by" median falls >= 30% over 10 Twin rooms.

**Risks.** Costliest engine; two scales on one Report (mitigated by shortfall lines).

**Acceptance criteria.**
1. Day-one build equals F-A: menu snapshot shows Forecast run and Report only (e2e).
2. Range row appears at first finish cue or day 14 after first run, whichever first; no banner (unit + e2e clock).
3. No sum line across forecast points and range cards anywhere (unit on Report model).
4. Exit and Lock bounding boxes equal across card types (Playwright).
5. Twin: side slider disabled until the range Locks; implied line not in DOM before the side Lock (e2e).
6. Implied = Phi(centre / (half-width / 1.2816)) to 1 point, clamped 2..98, width >= 1; unscored (unit).
7. After both cues: "Both modes are done here. Your Report stays." and no further rows (e2e).
8. All F-A ACs; F-B ACs for the Range row.

---

### F-E · The dated test (business lead's minimum)
**Lineage:** S4-05 (flagged dated test, holdout, stop rules, One door); S4-01 session 1; round-5 antithesis (power,
D7 definition, thresholds, frames).

**Summary.** Practice menu: **Forecast run** and **Report**, behind a flag, for 28 days, with start and decision
dates written first. **The owner signs, before the start, that the expected result is "stop", and that a stop means
"build after the gates", not "the idea failed".**

**Roguelike elements (roguelike-lite).** F-A's session-1 run every time (10 rooms, announced jump boss at 10) plus
**One door** after room 5 ("Snaps back" or "Keeps going") for every Practice-arm account; summary; seeds; no retry.

**Session flow.** 0-3 s first card; 3-75 s rooms 1-5; door; 80-150 s rooms 6-9; 150-165 s boss; 165-180 s summary.

**Scoring.** As F-A: Honest +22, Bold -88, Fifty 0 in expectation. Luck line: "Luck moved this run by N points".

**Test design.** Eligible: signed-in, 18+ attested accounts whose day 0 (first eligible visit) is >= 7 days before
the decision date. Holdout fixed by account hash, sees no entry. **D7** = returned to a verified page on any of days
1-7 after day 0. Band: two-proportion, unpooled, 95%. **Power:** +5 points on a 15% base at 80% power needs about
**900 per arm** (7.85 x (0.1275 + 0.16) / 0.0025 = 903) if the whole arm plays; at 20% uptake the arm-level lift is
+1 point and needs **about 20,500 per arm** (7.85 x (0.1275 + 0.1344) / 0.0001). At week-8 scale the test cannot
pass: hence the signed expectation. **Stop** if the lift's lower band <= 0; the upper 95% band of the change in
verified profile views per viewer is < 0; or any compliance/T&S incident. Privacy page states Practice use is
measured for a fixed test and deleted after (P3).

**Sharing.** None; no route card, no push, email or badge. Demo card (shell 19) if O2 allows.

**Players return because** a short run and an honest summary are worth a few minutes, **not because** anything
decays, resets or reminds them; the test ends on a date written in advance.

```
+--------------------------------------+
| Practice game. Generated charts, not |
| market data. No money. Not           |
| investment advice.                   |
+--------------------------------------+
| [ Exit ]  Room 1 of 10 · boss at 10  |
|   0% |--/\_/\__/    \--.  ?          |
|      +----------------------- step 20|
| Will the line end higher at step 20? |
| Lower |=========[]=========| Higher  |
| [ -1 ]  50: no view. Scores 0  [ +1 ]|
|                            [ Lock ]  |
+--------------------------------------+
| Terms · Privacy · How Practice is    |
| scored                               |
+--------------------------------------+
```
```
+--------------------------------------+
| [ Exit ]  Room 1 of 10: ended higher |
+--------------------------------------+
| Your forecast: 72 percent higher +53 |
| Generator chance: 72 percent higher  |
| Off by 0. Expected: +14 (best +14).  |
| Not investment advice. Past          |
| performance does not guarantee       |
| future results.        [ Next room ] |
+--------------------------------------+
```
```
+--------------------------------------+
| Run ended at room 4 (Exit)           |
| 4 rooms scored; room 4 as no view.   |
+--------------------------------------+
| Expected for your forecasts: -88     |
| Best expected here: +25              |
| This run: +255                       |
| Luck moved this run by +343 points.  |
| Your 90s: 3 of 3 went your way.      |
| Not investment advice. Past          |
| performance does not guarantee       |
| future results.             [ Done ] |
+--------------------------------------+
```
(Bold on the worked rooms with room 2 higher, then Exit on room 4, p* 0.60: Best +21.8 + 2.9 = +25; 255 - (-88) = 343.)

**Metrics.** Primary: D7 lift, Practice arm vs holdout. Guard: verified views per viewer. Counters: demo page views
apart from profile views. Stop rules above, evaluated once at the decision date (or earlier on incident).

**Risks.** Underpowered by design; a two-account holdout user sees both arms (minor at this n).

**Acceptance criteria.**
1. Holdout fixture account sees no Practice entry anywhere (e2e).
2. The flag refuses to enable without start date, decision date and signed-expectation fields in config (unit).
3. Analysis function on fixture data returns the unpooled two-proportion 95% band and the correct stop decision for
   lift, views and incident cases (unit).
4. D7 counts only accounts with day 0 >= 7 days before the decision date and a verified visit on days 1-7 (unit).
5. Flag off hides the entry (e2e); deletion job removes Practice rows older than stop + 30 days (unit). (Removal
   within one day is a runbook promise.)
6. Demo page views and profile views use separate counters (unit).
7. No share, route, push, email or badge (grep + e2e).
8. Summary fixture reproduces -88 / +25 / +255 / +343 (unit); demo reveal reads +14 / +14 (e2e).

Not investment advice. Past performance does not guarantee future results.
