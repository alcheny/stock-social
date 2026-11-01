# F-8 dialectic, round 3: antithesis (red-team bench, seven seats)

Seats: RED TEAM, RESPONSIBLE DESIGN (veto), LEGAL, TRUST AND SAFETY, ACCESSIBILITY, ENGINEER and, new this round,
GAME DESIGNER (is session 1 boring, and what is its hook?).

**Points maths: checked, all correct.** round(100 x (1 + log2 q)): 50 → 0; 60 → +26 / -32; 70 → +49 / -74;
75 → +58 / -100; 90 → +85 / -232; 98 → +97 / -464. Index = 100 x 2^(points/100) holds (P10 -147 → 36, P90 347 →
1,108, Honest +126 → 2.39x, Bold P50 +11 → 108). **The thesis draws the wrong lesson from correct numbers.**
"Being sure costs more than it pays" is false under a proper score: at a true belief of 0.9, saying 90 is worth
+53 per call in expectation, the best answer; saying 70 is worth +37. The true lesson is "being *surer than the
evidence* costs more than it pays" (on a card with chance 0.65, a 90 expects -26 and a 65 expects +7). A first
reveal cannot teach that, because one outcome is luck: the Bold player saying 90 on a 0.65 card sees **+85 on
65% of first cards** and learns that boldness pays. Over a run, Bold ends below zero on about half of runs
(P50 +11) and Honest ends below zero on more than 10% (P10 -147). Without an "expected for your calls" line, a
new honest player's first session tells them honesty loses roughly one time in seven.

---

### S2-01 · Dojo Ladder
**Red team.** DS is luck-free, so the run is unexploitable. Fifty and Bold both stay stuck (OI -0.13 / +0.08), as
the thesis claims. Maths checked: 0.35 x 0.0285 = 0.010.
**Responsible.** The calmest design. Fine.
**Legal.** "Average gap from the generator: 7 points" puts **percentage points** on the same word as coin-flip points.
Use "off by 7 on average".
**T&S, Read the forecaster.** It does edge toward judging real traders: "spot overconfidence in others" is the
exact skill a user would aim at a profile's record. Keep it only with these limits: bots have no handle, no
avatar, no percent returns and no chart shaped like a profile; the 20 calls show as a probability table, never
as a trade list; and no Practice surface links to, or names, a profile. Maths: the truth must be a binary class
(calibrated or overconfident by a fixed factor, 50/50 prior). Otherwise "how likely it is overconfident" has no
log-score truth.
**Accessibility.** A 25-75 track must still announce its limits ("maximum 75 percent"), because a short track
is not perceivable by screen reader alone. The 20-call grid needs a table view.
**Engineer.** Cheap. The mutation is moderate (bot generator plus a table).
**Game designer.** Session 1 is 12 "You 60 · Generator 70" reveals. That is the best per-card hook in the set (a
closeness game you feel at once), but the delight (a longer track) arrives about 5 sessions later.
**Verdict: keep.** 1) Never use "points" for percentage gaps. 2) Read the forecaster: a binary truth class, bot
table only, no profile-like visuals. 3) Session 1 ends on a raw line: "closest call: card 7, off by 1".

### S2-02 · Paper Call Run
**Red team.** Second look: the mean of two proper scores is proper. **But the boss jump can fire inside the
5-step look**, so the second call becomes near-certain (+97) and kills the boss surprise. Fire the jump only
after the look.
**Responsible (veto, used).** "Revise once" after watching the path move is **an in-play cash-out shape** (a
partial exit at a blended score). Make the second look a mandatory second forecast at every boss, untimed, with
the first one locked and shown beside it, and no "revise" verb. **The index test arm is vetoed.** Its keep rule
rewards "week-over-week voluntary return", so the more money-looking arm wins by being stickier. Points are an
exact transform of the index, so the index adds nothing but the multiplier look ("2.39x" reads as a return).
Delete it now.
**Legal.** Texture door copy "after a big move, these paths tended to come back" is a transferable trading
heuristic. Keep "in this generator" in the sentence itself, and pair every family line with its opposite family.
**T&S.** None.
**Accessibility.** Door preview sparklines must not animate under reduced motion, and need a text description.
**Engineer.** Cheap, apart from the two-stage server-held futures for Second look (moderate).
**Game designer. Session 1 is boring by room 5.** The shell deletes bosses, so session 1 is 10 identical rooms.
The design's own named delight is the boss reveal. Bosses are content, not a system: keep one announced boss
(room 10) in session 1.
**Verdict: fix.** 1) Kill the index outright. 2) Second look becomes a mandatory second forecast, with the jump
after the look. 3) Room 10 boss and the line "Expected for your calls: +126. This run: +103" stay in session 1.

### S2-03 · Paper Ticket Run
**Red team.** Range-only figures checked: 100 - 15 x 3.51 / 4.11 / 4.33 = 47.4 / 38.4 / 35.0. Full ticket checked
(per room: Honest 23.7 + 6.3 = 30.0). **Name the weather is improper as written.** A confidence slider from 50
to 95 forces a player whose top family sits at 0.30 to overstate it. Within the "pick one, split the rest"
form, the log score is proper (pick the argmax, state its chance) only if the slider runs 25-95. It also
**conflicts with the texture doors**: if doors pick the next rooms' texture, the 10 rooms are not from one
hidden family. In this mode, doors may change only the horizon.
**Responsible.** Fine.
**Legal.** Ranges are percent moves on a market-like chart ("from minus 3 to plus 5 percent"). Keep them off
every share surface.
**T&S.** None (not shareable).
**Accessibility. Deleting presets in session 1 breaks WCAG 2.5.7** (dragging needs a single-pointer
alternative). Drag-only edges are the session-1 input here. Keep presets, or tap-to-place plus steppers.
**Engineer.** Moderate.
**Game designer.** The plank walk is a true session-1 hook. But the reveal "inside" reads as winning, which
teaches players to widen. The reveal must show the width cost beside the miss.
**Verdict: fix.** 1) Name the weather: slider 25-95, doors limited to horizon. 2) Presets stay in session 1. 3)
The reveal shows both parts of the range score; use "2 outside" with the unit "percent", never "points".

### S2-04 · Shared Seed Table
**Red team.** The 116-card figure is consistent: a 12.4 gap and a per-card SD of about 68 give 2 SE at n of
about 116. **The room after teaches a false lesson about a quarter of weeks.** An honest table's coverage on 5 shared
outcomes is Bin(5, 0.8), so "caught 3" or fewer happens 26% of the time by luck alone, and the outcomes are
shared, so the whole crowd is correlated. Compare the table with the generator's expected coverage, with a band,
pooled over at least 12 weeks.
**Responsible.** Fine. Calm weekly cadence.
**Legal.** Synthetic data, reveal after close, unnamed security: no crowd view on a live security. Fine.
**T&S.** The density can expose an individual's band at small tables. Show it only with at least 20 players. The
stacked friend reveal needs the friend link (block, mute, silent decline) even though the friend seed is gone.
**Accessibility.** The thesis is right that tapping a preset is the simplest input, **which contradicts shell
deletion 3 (no presets in session 1).** Presets are this design's core.
**Engineer.** Cheap. The density adds a close-time aggregation job.
**Game designer.** Session 1 is 5 cards, then nothing until close. The hook is social and delayed, and that is
acceptable for the calm mode only if close is at most a few days away. Otherwise show the close time.
**Verdict: keep.** 1) Room after: a pooled, banded crowd coverage, never one week's count. 2) A minimum of 20
players for the density. 3) Exempt presets from the deletion.

### S2-05 · Number Line Shelf
**Red team. Pick the question is equal in expectation only if s is conditional on the visible path.** "Biggest
dip" is partly revealed by the dip so far. If s is per statistic family rather than per path, the player picks
the statistic the chart has already half-answered. Normalise each statistic by s computed from that path's
visible part.
**Responsible.** Fine.
**Legal.** "Biggest dip" sits close to drawdown. Keep the copy "in this path".
**T&S.** None.
**Accessibility.** Same 2.5.7 point: keep presets. The three-option choice is a radio group.
**Engineer.** Conditional s means a Monte Carlo per path per statistic, precomputed per seed. Moderate.
**Game designer.** 90 seconds is fine. The "dip is wider than you think" surprise is a real session-1 hook.
**Verdict: keep.** 1) Conditional s per path. 2) Presets stay. 3) The reveal shows all three honest widths in
text.

### S2-06 · Week Report
**Red team. One rule for next week mixes expected and actual again.** "Expected with the rule against the actual
result" is a luck comparison. Compare expected-with-rule against expected-without on your own bands, both from
the generator; show actual only as raw counts. Say whether the rule changes inputs: it must never auto-widen
bands (the player still answers).
**Responsible.** Fine. A report as the stop cue. Never push it.
**Legal.** "A rule for next week" reads as a trading rule. Use "a practice tip for this generator".
**T&S.** None.
**Accessibility.** The report needs a table view. Fine.
**Engineer.** Moderate (counterfactual expected scores).
**Game designer. Session 1 is the dullest in the set.** It is 12 identical range cards, and the reward is up to a
week away. Give session 1 a raw mirror now ("your bands caught 9 of 12; an 80% band expects about 10").
**Verdict: fix.** 1) Expected against expected for the rule. 2) Rename it to practice tip. 3) A raw-count
session-1 line against the expected count.

### S2-07 · Bias Boss
**Red team.** Your own boss: a player who knows "decoys tilt the way I lean" can sandbag warm-ups to steer the
boss, but normalisation makes that worth nothing (it costs ~9 per card). Fine. It needs 60 warm-ups first.
**Responsible.** A trap built from your own weakness is a disclosed but personal deception. Say "built from your
last 60 warm-ups" on the boss title, and offer an opt-out to the generic boss.
**Legal / P3.** The lean profile is personal data: private, deletable and exportable.
**T&S.** None.
**Accessibility.** Decoy lines need text in the chart summary, and must be distinguished by pattern, not color.
**Engineer.** Moderate (per-user generator).
**Game designer. The shell deletes bosses in session 1, so this design has no session 1.** Its own first 10
seconds is a boss title. Exempt it: session 1 is 6 warm-ups plus a 6-card generic boss.
**Verdict: fix.** 1) Boss exempt from deletion. 2) Disclosed personal boss with opt-out. 3) The lean profile is
under P3.

### S2-08 · Mastery Trials
**Red team.** Fine. The "Bold DS 0.30" figure is at the full tier, and S2-01's 0.65 is at tier 2. Label which.
**Responsible.** The finish line is good: finite by design.
**Legal / P3.** "Hides itself" must not hide the data. It stays reachable for export and deletion.
**T&S / Accessibility.** None.
**Engineer.** It has no engine of its own. If only one of S2-01, S2-06 and S2-07 is built, the panel pools one
criterion. Build it last or not at all.
**Game designer.** Not a session-1 surface. Correct to demote.
**Verdict: keep (as a panel).** 1) State the tier for each figure. 2) Data stays reachable after hiding. 3) It
ships only with at least two source engines.

---

### Cross-cutting

1. **Rulings on the deletions.** Fine to delete: the intro card, doors, tiers beyond the start tier, fans, tags,
   pooled panels, bands at n < 60 and the jargon. **Needed, so restore:**
   (a) **the luck line**, as one sentence on every session-1 summary ("Expected for your calls: X. This run: Y.").
   It is the only thing that turns a luck-driven first reveal into a calibration lesson, and S2-02 keeps it
   anyway, which contradicts deletion 3.
   (b) **Presets or another non-drag range input**: WCAG 2.5.7, and S2-04's core input.
   (c) **Bosses, as content**: S2-02's hook and S2-07's whole identity.
   (d) Clarify that "bands" means confidence bands, not the range input.
2. **Calibration needs a count, not a reveal.** Add a raw bucket line to session 1: "Your 70s: 4 of 6 went your
   way." It is allowed under the small-n rule, cheap, and teaches more than any single -232.
3. **Wrong headline lesson.** Change "being sure costs more than it pays" to "being surer than the evidence
   costs". Copy must never imply that 50 is safe: Fifty scores 0 for ever.
4. **"Points" has three meanings** (score, percentage-point gap, price distance). Reserve "points" for the score.
5. **The strip "stays as one line"** must not mean truncation or small type at 360px (WCAG 1.4.4 / 1.4.10). It
   keeps its full wording and wraps. The share line fix works; prefer "Practice game. Generated charts, not
   market data."
6. **Gaps from deleting the intro.** The intro also held the sign-in and 18+ gate (P4) and an exit. Practice
   must still require a signed-in, attested account, and a back or exit control must exist beside Lock.
7. **The slider at 50 plus an enabled Lock** lets a new player tap through to "0" ten times and learn nothing.
   Label the slider ends "Lower" and "Higher" and read the value as "70 percent higher" or "70 percent lower".
   "How sure?" is ambiguous below 50, and "after the gap" is jargon.
8. **Game designer, overall.** After the deletions, the session-1 hooks that remain are S2-01 (the closeness
   dot), S2-03 (the plank), S2-05 (the dip surprise) and S2-02 only if its room-10 boss stays. S2-04, S2-06 and
   S2-07 have no session-1 hook as written.

Not investment advice. Past performance does not guarantee future results.
