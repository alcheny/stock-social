# F-8 dialectic, round 4: synthesis (five final answers for the committee vote)

Round 4 stops producing modes. Each of the five designs below is a **complete answer to "what is the F-8 game"**:
what ships, what the Practice menu holds, how it ends, and when it is built. The committee votes for one.
S4-01 to S4-04 differ in what they build; S4-05 differs in when and how little.

## Round 4 result

| In ids | Out id | Kept / merged / dropped | One-line reason |
|---|---|---|---|
| S3-01 Paper Call Run | S4-01 (also S4-04, S4-05) | kept (fixed), renamed Forecast Run | Literal ask, cheapest engine; "call" is an options word, so "forecast"; Exit rule, "Best expected", finish cue added. |
| S3-01 mutation: Ghost on the same seed | - | dropped | Killed: the sender saw every p*, so a seed is an answer key; needs a social graph the product lacks. |
| S3-03 Dojo Ladder | S4-01 (finish line) | merged | Business lead: its luck-free score already is the Run's "Expected for your forecasts" line; the row duplicates it. Its finish line and Read the forecaster become the Run's ending. Track ladder dropped: one slider range (2-98) across Practice. |
| S3-03 mutation: Mirror match | - | dropped | Ranks one session alone, leaks generator dots, creates a pending-friend state; no social graph (cross-cutting 6). |
| S3-02 Paper Ticket Run | S4-02 (also S4-04) | kept (fixed), renamed Range Run | Second engine; expected counterfactual only, two 44px stepper rows, fits 360 x 560. |
| S3-02 mutation: Cone room | S4-02, S4-04 | kept | Checked proper (mean of two interval scores); both ranges lock before any reveal. |
| S3-06 Bias Boss | S4-02 (boss family) | merged | A content family for range rooms, not an engine or a row; one unit phrase ("a full range-width"). |
| S3-06 mutation: Set a boss for a friend | - | dropped | Social graph for a small payoff; the return message made its summary meaningless. |
| S3-04 Shared Shelf | S4-03 | kept (fixed) | The only shared-seed answer; absolute close time, named 44px presets, opens only when weekly players reliably exceed 20. |
| S3-04 mutation: Read the room | - | dropped | Killed: manipulable at small n and makes question 3 improper (a beauty contest over a calibration card). |
| S3-05 Week Report | S4-03 (week report), S4-01..S4-05 (Report page) | merged | Not a mode; the Practice Report page for whatever ships, one n, plain words. |
| S3-05 mutation: Sealed letter | - | dropped | Vetoed: self-fulfilling (forecasts what the player controls) and sets a quota. |
| Business lead's "one row, dated test" verdict | S4-05 | new | The minimal answer: one row, one Report page, a dated test with a stop rule, so the committee can vote for "almost nothing". |

## Shared shell v5 (every S4 design inherits it; v4 rules stand unless changed here)

1. **Copy.** "Forecast", never "call" (an options word in a stock app) or "pick" (F1a). "Best expected here",
   never "best possible". One unit phrase per concept: "off by 7" (percent gap), "2 percent outside" (range miss),
   "a full range-width toward it" (bias lean). No jargon (bits, DS, NIS, OI, KL). "Points" is only the score.
2. **Targets and layout.** Every control is at least **44 x 44 px with 8 px gaps** (`app/globals.css` 44px rule;
   WCAG 2.5.8 is the floor, not the spec). ASCII wireframes are layout, not size. **Exit is top-left, Lock is
   bottom-right**, never on one row. Each card fits **360 x 560** with Lock visible, so it survives browser chrome
   on a 360 x 640 phone; chart height 120 px. 200% text and 320 px reflow are tested, and the card scrolls rather
   than clips (Lock stays reachable by Tab and by scroll).
3. **Strip and disclaimer.** The first card of a session shows the full strip ("Practice game. Generated charts,
   not market data. No money. Not investment advice."), wrapping, never shrunk. Later cards show a one-line header
   "Practice game · generated · no money" whose accessible name is the full strip. **Every reveal and every
   summary shows the full line "Not investment advice. Past performance does not guarantee future results." as one
   unbroken string** (wraps at word boundaries only, never hand-hyphenated, so the compliance scan and screen
   readers match it). Owner question O1 below.
4. **Footer.** Every Practice page has `footer.site nav.legal` with Terms, Privacy and "How Practice is scored",
   each 44 px, inside the height budget.
5. **Slider.** One range across all of Practice: **2-98**. Beside the readout, **[-1] and [+1]** buttons (44 px) for
   precise touch input; keys arrows 1, Page 10, Home/End. Readout "70 percent: higher"; at 50 "50: no view. Scores 0
   every time." Room position is text, not glyphs: "Room 3 of 10 · boss at room 10".
6. **Exit rule (abort scumming).** Exit ends the run; played rooms count in every pooled number; unplayed rooms
   are not scored. No "abandon and retry". Exit asks nothing back ("Run ended. 3 rooms scored." then the summary).
7. **Times.** Absolute only: "Closes Thursday 18:00, your time". No relative times, countdowns or timers anywhere.
8. **Counterfactuals** are generator expectations, labelled "expected", never another outcome ("Wide preset,
   expected: 28"). Summaries say "Expected for your forecasts / Best expected here / This run".
9. **Finish cues in every mode.** Each mode states one equivalence test (n >= 60, a 95% confidence band inside a
   small margin, never "band contains 0", which noise passes). When it passes, the mode says so once, in plain
   words, and after that the summary drops the outcome total ("This run") so nothing left varies by luck alone.
10. **No social graph features.** The product has one-way follows only (F-3) and no friend links. No ghosts,
    mirrors, friend reveals, set-a-boss, seeds passed between accounts or pending-friend states. A head-to-head
    may return only if the product gains a social graph, and then only on fresh seeds neither player has seen,
    compared on pooled expected scores. Seeds stay personal and opaque.
11. **Placement.** Practice is reached from the signed-in account menu ("Practice"). **Never** in the swipe feed,
    on a profile, on a share card, or beside any verified number. Practice is signed-in and 18+ attested (P4); the
    gate lives on the menu. No push, email or badge for Practice, ever (F3b).
12. **Report page** (from S3-05) in every design: a page, never pushed, covering whatever engine ships. One n, plain
    words: "Forecasts this week: 36. Expected per forecast: +6. Best expected: +9." Bucket lines get a confidence
    band only at pooled n >= 60. Table view. Export and delete (P3).

**Reference players** as round 4: Honest (says p* / the generator's 80% range), Bold (90 on the favoured side /
a range **a third as wide, same centre**), Fifty (always 50 / the Wide preset). Points = round(100 x (1 + log2 q)):
55 → +14/-15, 65 → +38/-51, 70 → +49/-74, 72 → +53/-84, 90 → +85/-232, 98 → +97/-464. Range card = 100 - 15 x
(width/s + 10 x miss/s), the proper interval score for an 80% central range. Expected range values below assume the
end point is normal with the generator's 80% range -6..+6 (sigma 4.68) and s = 5: Honest -6..+6 **50.7**, Bold
-2..+2 **25.9**, Wide -12..+12 **27.5**.

## Business lead's dissent (recorded, binding on the vote's framing)

The business lead (team/business-lead.md) scores every S4 design **phase fit 1, demand 2**: none moves a week-8
gate in DESIGN 3.5 (connected traders >= 50, card shares >= 60%, external profile views >= 5,000 a week, viewer D7
>= 15%). Practice is signed-in and 18+, so it cannot reach the signed-out link arrivals the gates count, and DESIGN
Stage 3 records the CEO deferring predictions until supply exists ("an engagement story with no supply is a pitch
deck, not a company"). Position: **build nothing before the gates pass; if the owner wants evidence sooner, only
S4-05**. Every design below carries "Build timing" so the committee can vote design and timing separately.

## Signed-out reach (the problem and a proposed answer)

Problem: shared links land signed out, and the gates count those arrivals; a signed-in game is invisible to them.
**Proposed answer: one signed-out demo card** at a public page "Try a practice forecast", linked only from the site
footer (never from feed items, profile content or share cards). It is one fixed, public demo path (same for
everyone, p* published on the page, so there is nothing to leak), runs in the browser, **is not ranked, stores
nothing** (no cookie, no account, no server write, no analytics beyond a page view) and has no share button. The
reveal shows "Your forecast: 70 percent higher. Generator chance: 72 percent. Expected for your forecast: +15. Best
expected: +15." and the full disclaimer line, then "Practice needs an account and is for adults (18+)." Honest
limit: it gives arrivals a taste, it does not move a gate, and its page views must never be counted as profile
views. Whether a signed-out game demo is compatible with adults-only (P4) is owner question O2.

## Owner questions (for the vote)

- **O1.** Are game points "performance" under F3? Default (kept until the owner rules): the full line on every
  reveal and summary. If ruled not performance, reveals keep "Not investment advice." only; summaries keep the full line.
- **O2.** Is the signed-out demo card allowed under P4, and is a site-footer link the right placement?
- **O3.** Timing: after the week-8 gates (business lead), or S4-05 as a dated test now?
- **O4.** S4-03's floor: open the shelf at 20 weekly players, or a higher number?

---

### S4-01 · Forecast Run (the Dojo is its finish line)
**Lineage:** S3-01 (10 rooms, jump bosses, doors, second forecast, luck line); S3-03 (luck-free "off by" against
the generator, the finish line, Read the forecaster); S3-05 (Report page); antithesis (Exit rule, "Best expected",
"forecast", Exit away from Lock, [-1]/[+1], Ghost killed).
**The answer.** Practice menu: **Forecast run** and **Report**. Nothing else.
**Format and data.** Personal opaque seed, 10 generated rooms: "Will the line end higher at step 20?" Server-held
futures; p* shown at every reveal. Session 1: room 10 is an announced jump boss. Session 2+: doors after rooms 3
and 6 ("Snaps back", "Keeps going", "Sudden jumps"), bosses at 4, 8, 10, each boss with a required second
forecast after 5 more steps (score is the mean).
**Flow (session 1).** 0-3 s: first card (full strip, chart, slider at 50). 3-135 s: rooms 1-9 at ~15 s (path 4 s,
forecast, Lock, reveal 3 s: points, generator chance, "off by 2", the full line). 135-160 s: boss. 160-180 s:
summary: luck line, one bucket line ("Your 70s: 4 of 6 went your way"), the full line, Done.
**Input.** Slider plus [-1]/[+1]; keys as shell 5; tap on track. The readout and "Room 3 of 10 · boss at room 10"
are live-region text; reveals have a one-sentence text summary of the path.
**Scoring.** Room = round(100 x (1 + log2 q_outcome)). Luck-free line per room: shortfall = (best expected) -
(expected for your forecast) = 100 x the information gap between p* and q, zero only at q = p*. Worked (p* = 0.72,
0.55, 0.35 higher): Honest expects +22, Bold -87, Fifty 0. Outcomes higher, lower, lower: Honest +76, Bold -62.
Had room 2 ended higher, Bold +255 and the summary reads "Expected for your forecasts: -87. Best expected here:
+22. This run: +255." Overconfidence costs in expectation every time: 90 on a 0.55 room expects -58.
**Progression and finish.** W1 even rooms; W2 doors and bosses; W3 pooled bucket bands at n >= 60, harder jump
families. **Finish cue:** when the upper 95% band of mean shortfall is <= 3 points per room (n >= 60): "You forecast
at the generator's level here. What is left is luck." Then one last challenge, **Read the forecaster** (20 forecasts
of a generated bot as a table: no handle, avatar, chart or profile link; truth binary), then "Nothing left to prove
here." Runs stay playable; summaries show expected lines only.
**Sharing.** Route card of door icons plus "Practice game. Generated charts, not market data." No numbers, no seed.
**Engaging, not compulsive.** Boss tension, route texture, the "off by" closeness game, a stated end.
**Risks.** One run's luck still dominates the "This run" line until the finish; some players will read only that line.
**Build timing.** After the week-8 gates.

```
+--------------------------------------+
| [ Exit ]  Room 3 of 10 · boss at 10  |
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
|      +----------------------- step 20|
| Your forecast: 70 percent higher +49 |
| Generator chance: 72 percent higher  |
| Off by 2. Expected: +15 (best +15).  |
| Points vary by luck; expected do not.|
| Text: the path rose 4 percent in the |
| last 20 steps and ended above start. |
| Not investment advice. Past          |
| performance does not guarantee       |
| future results.                      |
|                        [ Next room ] |
+--------------------------------------+
```

### S4-02 · Range Run (the bias bosses are its keystones)
**Lineage:** S3-02 (10 rooms, plank walk, ticket direction field, Name the weather, Cone room); S3-06 (decoy,
recent-spike and round-number bosses as keystone content; per-type lean that retires); S3-05 (Report page);
antithesis (expected counterfactual only, two stepper rows, Bold example fixed, one unit phrase).
**The answer.** Practice menu: **Range run** and **Report**. A prediction is a price range, not a side.
**Format and data.** Personal seed, 10 rooms: "Where does this line end?" Session 1: range only, room 10 a
regime-switch keystone. Session 2: the direction field. Session 3+: horizon doors (Long sight, Fog), bias bosses at
room 10, Name the weather at run end, one Cone room per run (ranges at step 10 and 20, both locked before any reveal).
**Flow (session 1).** 0-3 s first card. 3-150 s: 10 rooms at ~15 s (path 3 s, preset or steppers 6 s, Lock, plank
walk 4 s or a static frame under reduced motion, reveal). 150-180 s: summary: luck line, "Your ranges caught 8 of
10; an 80% range expects about 8", the full line, Done.
**Input.** Presets **Narrow, Medium, Wide** (named, keys 1-3); Low row and High row, each [-] value [+], step 1
percent; tap-to-place is optional. Readout "from minus 3 to plus 5 percent" in a live region.
**Scoring.** Card = 100 - 15 x (width/s + 10 x miss/s). Worked (s = 5): Honest -6..+6, Bold -2..+2, Wide -12..+12.
Truth +2: 64 / 88 / 28. Truth +7: 34 / -62 / 28. Truth -4: 64 / 28 / 28. Three rooms: **Honest 162, Bold 54, Wide
84**. Expected per room: 50.7 / 25.9 / 27.5, so a narrow range loses more in expectation than lazy width: each
percent outside costs ten times a percent of width.
**Progression and finish.** Bosses name the trap after the run: "The decoy line was on card 2. Your range sat a
full range-width toward it." A bias type retires when its lean band sits inside a small margin of 0. **Finish
cue:** upper band of mean shortfall against the generator's 80% range <= 3 per room (n >= 60): "Your ranges are as
wide as this generator needs." Then summaries show expected lines only.
**Sharing.** None (ranges never go on a share surface).
**Engaging, not compulsive.** The plank, a weather mystery each run, bosses aimed at your own lean, an end.
**Risks.** Highest input load; four statistic modules are the real cost; "inside" may read as winning.
**Build timing.** After the gates, and after evidence that Practice holds players at all.

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
| [ Exit ]  Room 4: inside your range  |
+--------------------------------------+
|   0% |--/\_/\__/\_/\_/\--*  [  ]     |
| Range: minus 3 to plus 5 percent     |
| Ended: plus 4.6 percent              |
| Width -24   Outside 0   Room 76      |
| Wide preset, expected: 28            |
| Text: ended 0.4 percent inside your  |
| top edge.                            |
| Not investment advice. Past          |
| performance does not guarantee       |
| future results.                      |
|                             [ Next ] |
+--------------------------------------+
```

### S4-03 · This Week's Five (shared seed, week report)
**Lineage:** S3-04 (same five for everyone, end-point / dip / crossing questions, the room after); S3-05 (week
report); antithesis (absolute close, named presets, the 20-player floor, Read the room and the friend reveal cut).
**The answer.** Practice menu: **This week's five** and **Report**. One calm weekly shelf; a missed week loses nothing.
**Format and data.** Every Monday 09:00 (owner's time zone, shown in yours) five synthetic paths open for
everyone, with one question each (end point, biggest dip, crossings). Close: "Closes Thursday 18:00, your time".
Generator truth and the room after appear only after close, so word of mouth cannot leak an answer before it.
**Flow (one sitting).** 0-3 s first question. 3-150 s: five questions at ~30 s (read, preset or steppers, Lock;
no reveal before close). 150-180 s: "Locked 5 of 5. Results after Thursday 18:00, your time." and Done.
**After close (a page, never pushed).** Each question: your range over the crowd density (only at >= 20 players;
otherwise "Fewer than 20 played; your result alone"), text line "31 percent of ranges held it", the card score,
the full line. The week report: "Ranges this week: 5. Average card: 52. Expected for your ranges: 48."
**Input.** As S4-02 (named presets Narrowest, Narrow, Medium, Wide, Widest; Low and High rows; 44 px).
**Scoring.** Range card as S4-02 with a scale s per statistic. Dip card (s = 4): Honest -9..-2, Bold -4..-2, Wide
-16..0; truth -7.5: **74 / -39 / 40**. Overconfidence is paid at ten times the miss.
**Progression and finish.** W2 Pick the question (one of three statistics per path). After 12 weeks the pooled
coverage band appears; **finish cue:** when your coverage band sits inside 70-90%: "Your ranges hold at the honest
rate here." The shelf stays, calm, with no streak or missed-week mark.
**Sharing.** None.
**Engaging, not compulsive.** A shared puzzle with a true surprise (the dip is wider than you think), five a week, final at close.
**Risks.** The room after needs volume the product will not have at week 8; the shelf **opens only when weekly
players reliably exceed 20** (O4). Opening it is still a return cue; it is never announced.
**Build timing.** After the gates and after Practice has volume.

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
| Text: 31 percent of ranges held it.  |
| Not investment advice. Past          |
| performance does not guarantee       |
| future results.                      |
|                             [ Next ] |
+--------------------------------------+
```

### S4-04 · Practice: Forecast and Range on one card engine
**Lineage:** S4-01 and S4-02 (the two strongest modes by the game designer's session-20 test); S3-03 (finish line);
S3-06 (boss family); S3-05 (one Report); antithesis (one slider range, "count statistics, not engines").
**The answer.** Practice menu: **Forecast run**, **Range run**, **Report**. One card engine: one card shell (header,
chart, question slot, Lock, reveal, text summary), one generator, one seed service, one scoring service with two
proper rules, one Report and one finish-cue test. The question slot holds a forecast slider or a range pair.
**Format and data.** As S4-01 and S4-02. Range run opens after **the Forecast run's first finish cue or session 6,
whichever is first**, with no banner (one menu row appears). Mixed content: Forecast bosses use jump families;
Range bosses use the bias family and the Cone room.
**Flow.** Session 1 is S4-01's session 1 exactly (one row only). Later sessions are one run of either kind, ~3
minutes each; the menu never suggests which.
**Input.** As S4-01 and S4-02; both share the header, Exit and Lock positions, so the muscle memory carries.
**Scoring.** Kept separate: forecast points (log rule) and range cards (interval rule) are never summed, because
the scales differ. The Report shows both, each with "Expected" and "Best expected". Both rules are proper, so in
each the honest answer is the only one that maximises the expected score: over S4-01's three rooms Bold expects
109 points less than Honest, and in S4-02 about 25 less per room.
**Progression and finish.** Each row has its own finish cue (shell 9). When both have passed: "Both modes are done
here. Your Report stays." No third row, no new currency.
**Sharing.** Route card from the Forecast run only.
**Engaging, not compulsive.** Two different judgements (which side and how sure; how wide), one feel, two ends.
**Risks.** The costliest answer: one engine plus four statistic modules; two scales on one Report may confuse.
**Build timing.** After the gates; Range run only after Forecast run shows players come back.

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
|   Forecasts: 60 · Ranges: 20         |
|                                      |
| Practice game. Generated charts, not |
| market data. No money. Not           |
| investment advice.                   |
+--------------------------------------+
| Terms · Privacy · How Practice is    |
| scored                               |
+--------------------------------------+
```
(The main card and reveal are S4-01's and S4-02's frames unchanged; this frame is the menu, which is what S4-04 adds.)
```
+--------------------------------------+
| [ Back ]  Report · this week         |
+--------------------------------------+
| Forecasts this week: 30              |
| Expected per forecast: +6            |
| Best expected per forecast: +9       |
| Ranges this week: 20                 |
| Average card: 44 · Expected: 46      |
| Your 70s: 14 of 20 went your way.    |
| A confidence band appears at 60.     |
| Not investment advice. Past          |
| performance does not guarantee       |
| future results.        [ Table ]     |
+--------------------------------------+
```

### S4-05 · The dated test (business lead's minimum)
**Lineage:** business lead's verdicts (one row, a dated D7 test with a stop rule, Report page from the first
build); S4-01 cut to its session 1; S3-03 finish cue; the signed-out demo card.
**The answer.** Practice menu: **Forecast run** and **Report**, behind a flag, for a fixed window, with a decision
date written before it starts. No doors, no second forecast, no Read the forecaster, no route card, no sharing.
**Format and data.** S4-01's session-1 run every time: 10 even rooms, an announced jump boss at room 10, p* at
every reveal, the luck line. The finish cue (shell 9) is kept, so the test has an end even inside 28 days.
**Flow.** S4-01 session 1, second by second, every session.
**Input.** As S4-01.
**Scoring.** As S4-01 (log rule; summary "Expected for your forecasts / Best expected here / This run").
**Test design.** Window: 28 days from an owner-set start date. Eligible: signed-in, 18+ attested accounts.
Holdout: half of them see no Practice entry (random by account, fixed). Primary metric: **viewer D7 return to
verified pages** (feed or profiles), Practice arm against holdout. **Stop rule (any one, at the decision date or
earlier):** the D7 lift's 95% lower band <= 0; verified profile views per viewer fall in the Practice arm (the game
crowds out the product); any compliance or T&S incident. On stop: entry removed, data exportable for 30 days then
deleted (P3). On pass: the owner chooses S4-01 or S4-04 as the next build.
**Progression.** None beyond the finish cue, deliberately.
**Sharing.** None. The signed-out demo card (above) may ship with it if O2 allows; its page views are reported
apart from profile views.
**Engaging, not compulsive.** The room-10 boss and the luck line in every run; a hard end date and a finish cue.
**Risks.** 28 days at week-8 scale may be too few accounts for a band that excludes 0: the test can fail by
being underpowered, which the stop rule treats as a stop. That is the business lead's intent.
**Build timing.** Now as a dated test (O3), or after the gates.

```
+--------------------------------------+
| Practice game. Generated charts, not |
| market data. No money. Not           |
| investment advice.                   |
+--------------------------------------+
| [ Exit ]  Room 1 of 10 · boss at 10  |
|  +6% |          _/\_                 |
|   0% |--/\_/\__/    \--.  ?          |
|  -6% |                  '            |
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
| Run ended after 3 rooms (Exit)       |
+--------------------------------------+
| Expected for your forecasts: -87     |
| Best expected here: +22              |
| This run: +255                       |
| Your 90s: 3 of 3 went your way.      |
| Most of this run's points were luck. |
| Not investment advice. Past          |
| performance does not guarantee       |
| future results.                      |
|                             [ Done ] |
+--------------------------------------+
```

Not investment advice. Past performance does not guarantee future results.
