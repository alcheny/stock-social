# F-8 dialectic, round 2: synthesis (8 designs for round 3)

## Round 2 result

| In ids | Out id | Kept / merged / dropped | One-line reason |
|---|---|---|---|
| S1-01, S1-02 | S2-01 | merged | Both are slider drills on known p*; the antithesis's fixed Ladder lift rule *is* the Dojo belt test, so the cap becomes the Dojo's tier. |
| S1-01 Capital belt | S2-01 (Bits belt) | kept (fixed) | Regret in bits as text only; no capital lines; scored on DS. |
| S1-05 | S2-02 | kept (fixed to F6 veto) | Literal ask #1: forecast slider, practice index with expected-pace headline, weekly seeded index run, no house. |
| S1-05 Priced room, Price-setter boss | - | dropped | Priced-room exploit (Fifty earns KL(0.5‖π)), dominant door, can-only-lose boss, wager form. |
| S1-04, S1-08 | S2-03 | merged | Literal ask #2: the Bridge run gains the Cone checkpoint as a door and a direction field, giving a two-field paper ticket. |
| S1-03, S1-10 | S2-04 | merged | Both are shared-seed social play; one engine: the weekly five for everyone, pair gaps pooled across shared seeds. |
| S1-03 Capital Duel | - | dropped | A per-seed head-to-head balance is wager-shaped, luck-heavy (Bold beats Honest on 26% of seeds) and breaks pairing. |
| S1-06 | S2-05 | kept (mutation replaced) | Base kept; the Bucket split becomes optional "zone shapes" presets with a 1% floor. |
| S1-06 Bucket split | - | dropped | log2(0) loss, spread-betting form, inaccessible coupled sliders. |
| S1-07, S1-11 | S2-06 | merged | The week season's pooled score, final only at week close, *is* the report card's weekly closure. |
| S1-11 Season capital | - | dropped | A week-long balance that can be "down" invites loss-chasing. |
| S1-09 | S2-07 | kept (fixed) | Boss types normalised to equal honest value; Capital boss killed. |
| S1-09 Capital boss | - | dropped | Money-like number at the centre; inherits F6 issues. |
| S1-12 | S2-08 | kept (fixed) | Four-week window; fourth criterion is the plain log score, no price. |

## Shared shell v3 (every design inherits it; v2 rules stand unless changed here)

Carried from v2: separate Practice area with the fixed strip ("Practice game. Generated charts that follow game
rules, not market rules. Not investment advice."); synthetic data only; server-held futures and opaque seeds;
untimed input (every second below is an estimate, never a limit); the slider and range inputs; lines with 0% on the
axis, a text summary of every reveal, reduced motion; small-n rule (raw counts per run, claims only at pooled
n >= 60 with a 95% band); always-50 and s baselines; calm rules (no streaks, pushes, day numbers, daily caps, autostart,
prizes); block, mute, silent decline and sender-hidden on every link feature.

New or changed in v3:
1. **Copy list (scanner-enforced on F-8 strings).** Never: odds, bet, wager, stake, house, price (of a side),
   payout, pot, bankroll, all-in, jackpot, chips, cash out, capital, "becomes", return(s), P&L, record, skill,
   edge, signal. A side's probability is "generator chance". The unit of play is a **"paper call"** (the owner's
   "paper trade"; "trade" is not used as a UI label, so game play never reads like a real trade). Subtitles say
   "a forecasting run".
2. **One index surface only:** S2-02, under the five F6 conditions. Everything else uses forecasts and practice
   scores.
3. **Game scores are never percents,** never shown as a best, total or history across runs, and never shown as one
   player's per-seed number to another player.
4. **"Typical" means the median.** Any fan reports, in text: the expected pace for your calls (from the generator),
   then P10 / P50 / P90 labelled "same calls, different luck".
5. **Doors.** Seeded menus, the same for every player of a seed, never reading the score, never bought. Each door is a
   **trade-off pair** (more information paired with a harder horizon) *and* scored against a **door-matched
   baseline**: range scores divide by s_info, the spread an ideal forecaster with that door's information would
   state; probability scores subtract c_door, that ideal forecaster's expected bits, then add the menu mean. An honest
   player's expected room score is then equal across doors, so no door dominates and a door is a choice of style.
6. **Shared seeds** reveal generator truth (p*, family, fans) only after the seed closes. Personal seeds reveal at
   once.
7. **Pooled windows are final only at close.** Below n = 60 they show "not enough yet". Nothing mid-window updates
   after each session (no stopping when ahead).
8. **Advice copy is scoped and expected:** "moving toward an 80% fit raises the expected score", "in this
   generator". Counterfactuals come from the generator, never from outcomes, and are labelled "expected".
9. **Summary screens** carry the full line "Not investment advice. Past performance does not guarantee future
   results." beside the strip. Done always returns to the Practice menu.
10. **Corrected reference figures** (seed R): NIS Honest 3.51, Bold 4.33, Wide 4.11, so per range room Honest 47.4,
    Bold 35.0, Wide 38.4.

Notation as v2. Log score per call L = 1 + log2 q_outcome (always-50 scores 0; clamp 2-98).

---

### S2-01 · Dojo Ladder
**Lineage:** S1-01 (known-p* drill, DS, "luck this run", belts), S1-02 (cap tiers, reliability dots, cheap base),
antithesis lift rule (DS band + overconfidence index), S1-01 Capital belt reshaped as the Bits belt.
**Format and data.** 12 generated paths with known p*. Tiers cap the slider at 40-60, 25-75, 10-90, then 2-98, each
paired with a harder path family (trend, mean-reverting, noise, regime switch).
**Flow.** 0-8 s tier card ("You can say 25 to 75 percent"). 8-152 s: 12 cards at ~12 s (path 4 s, slider 5 s, Lock,
reveal 3 s: "Generator chance 70 percent. You said 75. Best allowed answer 70." then the outcome; the dot lands on the
reliability diagram). 152-180 s: DS, raw counts, luck line, Done.
**Input.** Shell slider; the cap is announced ("maximum 75 percent; widens with evidence"); the diagram has a table view.
**Scoring.** p_c = p* clamped to the tier. DS = 1 - mean((q - p_c)^2) / mean((0.5 - p_c)^2). Overconfidence index
OI = mean(|q - 0.5| - |p_c - 0.5|). On seed R at tier 2, capped Bold scores DS 0.65 but OI +0.08, a band that
excludes 0 after 60 cards, so it does **not** lift; Honest scores DS 1.00, OI 0. Being surer than the evidence is
measured directly, not hidden by the cap.
**Progression.** A tier lifts when, over >= 60 forecasts, DS lower band >= 0.5 and the OI band contains 0. The last
belt (**Bits belt**) adds a text line per card: "Saying 90 here is expected to cost 0.22 bits; saying 50 costs
0.12." It is still scored on DS and is the bridge to S2-02.
**Sharing.** None.
**Engaging, not compulsive.** Error shrinking in points, and "You may now say 90 percent" as earned boldness.
**Risks.** Known p* on market-looking paths may imply real markets have knowable chances (the strip mitigates). 60
cards per tier is about five sessions.

### S2-02 · Paper Call Run (literal ask #1: roguelike, paper calls, practice index)
**Lineage:** S1-05 (10 rooms, jump bosses, doors, ghost fan, luck line, no instant retry), antithesis F6 conditions
1-5 and copy, S1-04 (trade-off doors), S1-11 (weekly rule set shared by all).
**Format and data.** One **weekly seeded run** per player: the week's families and door menu are the same for
everyone, the paths are the player's own (so p* can be shown at once without leaking). 10 rooms: "chance the next 20
steps end higher". Rooms 4, 8 and 10 are jump bosses (the jump process fires; announced). Further runs that week and
free practice are unranked and use the plain log score with no index.
**Flow.** 0-6 s intro ("A forecasting run. Practice index: not money, not a return, nothing carries over."). 6-156 s:
7 rooms at ~13 s, 3 bosses at ~18 s (path, slider, Lock, reveal "Ended higher. This call: +0.49 bits"), plus doors
after rooms 3 and 6 (~4 s): 1 of 3 trade-off doors (Long sight with a 1.5x horizon; Fog with a 0.6x horizon; Jump
family announced with longer look-back). 156-180 s summary, read at leisure.
**Input.** Shell slider 2-98, read as "62 percent up". Doors are a radio group. A neutral bits trace, never the index,
updates per room.
**Scoring.** Run = Σ L, door-matched. Practice index = 100 x Π 2q_outcome, shown once at the end. The headline is the
**expected pace** for the player's calls: 2^E_p*[Σ L] per 10 rooms. On seed R: Honest 2.39x, Bold 0.74x; then
"This run: 204. Same calls, different luck: 36 / 204 / 1,110 (P10 / middle / P90)". Bold's middle is 108, which is
why pace, not the run's index, leads. The log score charges 4.6 bits for a missed 98 against +0.49 for a hit 70.
**Progression.** Harder jump families open when pooled door-matched L per room has a lower band > 0 over >= 60 rooms.
**Sharing.** An optional route card: door icons and "Practice game. Not a record." No numbers, no index, ever.
**Engaging, not compulsive.** Boss calls, a real route choice, and the luck-versus-craft sentence at the end.
**Risks.** The 30x decile spread may still feel like a lottery; round 3 should test the index removed entirely
(bits only) as a control. "Practice index" may still be read as a balance.

### S2-03 · Paper Ticket Run (literal ask #2: roguelike, paper calls with a movement range)
**Lineage:** S1-04 (fixed 10-room bridge, doors, keystone regime room, lens), S1-08 (checkpoint cone as a door,
sweep reveal), S1-05 (direction field and boss pacing), antithesis door fix.
**Format and data.** A personal seed of 10 generated rooms. Each room is a **paper ticket** with two fields: the
chance the path ends higher, and an 80% range for where it ends. Room 10 is the keystone (regime switch,
announced). A "light ticket" option, chosen before the run, keeps one field only and is scored as its own mode.
**Flow.** 0-6 s intro. 6-156 s: 10 rooms at ~15 s (path 3 s, both fields 8 s, Lock, the path walks the plank 4 s,
"landed 2 points outside"); doors after rooms 3 and 6 (Long sight + longer horizon; Fog + shorter horizon;
Two-step: adds a midpoint range, the cone; Steady wind + longer horizon). 156-180 s: direction bits, "8 of 10
inside, target about 8", route, Done.
**Input.** Slider, then two handles (Tab; arrows; presets narrow/medium/wide), read as "70 percent up, from minus 3 to
plus 5 percent".
**Scoring.** Room = 50 x L + (50 - 7.5 x NIS), with NIS divided by s_info (shell rule 5); in Two-step the range part
is 50 - 3.75 x (NIS_mid + NIS_end). Both parts are proper and separable, so the sum is proper. On seed R: Honest 300,
Fifty-plus-Wide 192, Bold 154: claiming certainty loses to having no view and lazy ranges.
**Progression.** New families open when pooled coverage band contains 80% and pooled L lower band > 0 (>= 60 rooms).
**Sharing.** None.
**Engaging, not compulsive.** Two judgements per ticket, a visible plank, and the cone sweep. Lens readouts (recent
volatility, family name) are door-matched, so they add style, not value.
**Risks.** Highest input load in the set (the light ticket mitigates). Information-matched normalisation removes the
value of information, which some players may find flat. "Movement range" copy is scoped to "in this generator"
(the √t growth holds only for diffusion families).

### S2-04 · Shared Seed Table
**Lineage:** S1-10 (weekly five for everyone, presets, spoiler-free pip grid), S1-03 (pair comparison pooled
across shared seeds, rematch limits, first-play-only), antithesis fixes (no Capital Duel, forced route).
**Format and data.** One shared weekly seed of five boss cards, range mode (S1-10), the same route for everyone (a
cosmetic door only). Pairs can also send a 10-card friend seed in probability mode. Truth (p*, family) is revealed
only after the week or friend seed closes.
**Flow.** 0-10 s seed card. 10-160 s: five bosses at ~30 s (path 6 s, one of five presets or own range 12 s, slow reveal
10 s with text). 160-180 s: pip grid and own score. A friend seed shows a stacked text reveal of both answers after
both have played: "You: minus 2 to plus 6. Friend: 0 to plus 4. Ended plus 5."
**Input.** Keys 1-5 for presets or "set my own" handles: the simplest accessible path in the set.
**Scoring.** Weekly: Σ (100 - 15 x NIS): Honest 237, Wide 192, Bold 175. Pair: paired gap per card in L (or NIS),
pooled over all shared first plays, with a paired bootstrap band; "too close to call" until the band excludes 0.
On seed R, Honest beats Bold by 0.17 bits per card in expectation; real players differ far less, so expect several
hundred cards. The other player's per-seed score is never shown.
**Progression.** None.
**Sharing.** Pip grid (inside / outside), seed code not a date, "Practice game. Not a record." Opt-in links, 5 a day,
no contact import, no rematch button, at most 1 new friend seed per pair per day.
**Engaging, not compulsive.** Same cards, a fair craft comparison, and a weekly topic a missed week just loses.
**Risks.** Outcomes still leak by word of mouth within a week. Alt accounts can pre-play. The stacked reveal can
still feel like a per-card verdict; test it.

### S2-05 · Number Line Shelf
**Lineage:** S1-06 base (hidden statistic on a number line, weekly set, unranked shelf), antithesis zone-shape fix.
**Format and data.** 5 questions about a statistic of a generated path ("where it ends", "biggest dip in this
path", "number of crossings"), each an 80% range. Weekly set plus unlimited unseeded practice; past sets on a
shelf, unranked, no completion percentage.
**Flow.** 0-5 s card. 5-80 s: 5 questions at ~15 s. 80-100 s pip row and score. An optional second set fills 3 minutes.
**Input.** Two handles or presets. Optional **zone shapes**: 6 seeded zones (edges offset per question to avoid
anchoring) and 6 buttons (flat, 5 skews), read as "most likely zone 2, small chance of zone 6".
**Scoring.** Range: 100 - 15 x NIS: Honest 237, Wide 192, Bold 175 over five. Zone shapes: log2(6 x f_hit) with a 1%
floor per zone (renormalised), so flat scores 0 and no miss is infinite; the best preset is the one nearest your
belief in expected log score, and a confident skew that misses costs most.
**Progression.** Calibration score with band at pooled n >= 60; new statistics open then.
**Sharing.** Pip row only, seed code, "Practice game. Not a record."
**Engaging, not compulsive.** The calmest puzzle; a missed week loses nothing.
**Risks.** "Biggest dip" still sounds like drawdown (copy keeps it a path statistic). Zone shapes are coarse.

### S2-06 · Week Report
**Lineage:** S1-11 (week as a season with a rule twist, confidence buttons, pooling makes frequency worthless),
S1-07 (reason tags, report card as the stop cue, counterfactual column), antithesis fixes.
**Format and data.** A week with one published twist (shorter look-back, longer horizon). 12-card sessions, any
number, either direction cards or range cards. The report card appears in Practice after the week closes; never pushed.
**Flow.** 0-6 s twist card. 6-162 s: 12 cards at ~13 s (direction: Up/Down, then confidence 50 / 60 / 70 / 80 / 90 /
95; range: handles plus an optional reason tag). 162-180 s session card: raw counts only, no week number.
**Input.** Left/Right, keys 0-5 for confidence, keys 1-4 for tags; all skippable and untimed.
**Scoring.** Week BS (direction) and mean 100 - 15 x NIS (range), pooled, final at close; "not enough yet" below 60.
Seed R: BS Honest-nearest 0.160, Bold 0.074; range 47.4 / 38.4 / 35.0 (Honest / Wide / Bold). Expected score doesn't
rise with volume, and no mid-week number rewards stopping when ahead.
**Progression.** Report lines with bands ("ranges too narrow on choppy paths: 68%, band 61-75, 64 forecasts") and an
"expected at 80% fit" column computed from the generator, with a table view.
**Sharing.** Not shareable.
**Engaging, not compulsive.** A weekly document about your own judgement: a reason to stop.
**Risks.** Waiting a week for the number may feel dull. Rare tags take many weeks to reach 60.

### S2-07 · Bias Boss
**Lineage:** S1-09 (warm-ups, door to the less-met bias, explained decoy reveal), antithesis fixes.
**Format and data.** 6 mandatory warm-ups, a door choosing one of the two least-met biases (too-narrow, up-tilt,
decoy anchoring), 6 boss cards. Rotation until 60 warm-ups exist. Decoys are explained before the first run.
**Flow.** 0-5 s. 5-77 s warm-ups at ~12 s. 77-167 s boss at ~15 s. 167-180 s: "The decoy was on cards 2 and 5; your
ranges leaned toward it on 2 of 2", with pooled lean only at n >= 60.
**Input.** Shell handles or presets; the door is a two-option radio group.
**Scoring.** Card = 100 - 15 x NIS, each boss type normalised so an honest player's expected score is equal across
types. Sandbagging a warm-up costs ~9 points (47.4 vs 38.4) and steers the door to a boss that is worth the same,
so it never pays. Lean is reported in text, not as a separate score.
**Progression.** A bias is met when pooled boss cards (>= 60) have coverage band containing 80% and lean band
containing 0; a subtler version opens.
**Sharing.** None; bias data private and deletable (P3).
**Engaging, not compulsive.** Difficulty aimed at what you need, and the trick is explained.
**Risks.** 10 runs per bias is slow. Planted decoys are a mild, disclosed deception.

### S2-08 · Mastery Trials
**Lineage:** S1-12 (pooled trial window, private level), engines of S2-01, S2-06 and S2-07, antithesis fixes.
**Format and data.** A **four-week** window with up to four criteria; every attempt pools.
**Flow.** 180 s trial: 12 mixed cards at ~13 s; 156-180 s panel per criterion with pooled n and band, "not yet
decided" below 60.
**Input.** Inherited from the source engines.
**Scoring.** Pass, pooled over the window: DS lower band >= 0.5 and OI band containing 0 (S2-01); range coverage band
containing 80% and mean NIS below a fixed threshold; decoy-lean band containing 0; optional fourth: pooled L lower
band > 0 ("your calls beat a coin flip"; no price, door-matched). On seed R, Bold fails DS (0.30) and Fifty fails at
0. Extra attempts tighten the band but can't fish for a pass.
**Progression.** A private level for the next window; never on a profile, never shareable, no badge art.
**Sharing.** None (hard rule).
**Engaging, not compulsive.** Finite goals; a fail rolls into the next window.
**Risks.** Highest build cost, built last. About 15 sessions per four weeks for all criteria.
