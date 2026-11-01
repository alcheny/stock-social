# F-19 committee decisions, 2026-11-01 (first slice, `lib/` only)

Decided by the committee (UX lead, business lead, engineer) under the owner's instruction of 2026-11-01 (develop
autonomously; open questions take the committee's recommended option after debate). Two rounds:

- **Round 1.** The UX lead drafted the plan: move `pct()` into `lib/format.ts` with a second `'text'` style for the
  design system §3 form (U+2212, comma at 1,000% and above, two decimals at most, "≈−100.0%"), defaulting to today's
  ASCII output. The business lead signed with conditions: test where the two styles disagree, Flat must match the
  printed number, a `ponytail:` at the real limit, a count ratchet on inline tone sites, banned forecast words
  ("guarantee", "expect", "will"); cut the `'text'` style if it adds a second rounding path. The engineer did not sign:
  §3's near −100% rule is a different algorithm from today's (today `pct(-0.99996)` is "-99.996%"; "≈" appears only
  within about 5e-7 of −100%), so a `'text'` style is a second rounding path, exactly the drift F-19 removes; tone must
  round the way pct prints at every `digits`; the grep test must flag definitions only.
- **Round 2.** `'text'` cut; the rest folded in; the count ratchet deferred. Both signed (business lead: "SIGN-OFF:
  yes"; engineer: "SIGN-OFF: yes", non-blocking notes on whole-word banned matching and a named stand-in constant,
  both applied).

## Decisions

1. **`pct()` moves byte for byte; no second style.** `lib/format.ts#pct(x, digits = 1)` is today's algorithm; a
   `ponytail:` at it names the limit (ASCII hyphen, up to `digits + 4` decimals near −100%, no comma) and the next step
   (the sweep rework replaces the algorithm with §3's form, images and the display log keep the hyphen until a render
   test shows U+2212 drawn). Why: images and the display log import `pct` through `lib/trades.ts` and must keep the
   hyphen without call-site edits; about 45 pinned sign assertions in 16 files stay green while other sessions edit
   them; a second style would be a second rounding path.
2. **`tone(x, digits = 1)` rounds the way `pct(x, digits)` prints**: flat exactly when the printed number has no sign,
   at digits 0, 1 and 2 (NaN prints "NaN%" and is flat). Why: the chart prints `pct(x, 0)`; colour and word must never
   contradict the number shown.
3. **`toneWord(t)`: "Gain" / "Loss" / "Flat"**, one helper beside `tone()`; "about even" (accessible text) is the
   sweep's. Not wired into any screen in this slice. Why: Flat must have a word (POLICY A1) and it must live beside the
   decision so the two cannot drift; `lib/copy.ts` is under edit by other sessions.
4. **`winPct(wins, n)` takes counts**, returns a whole percent, never "100%" with a loss or "0%" with a win, and null
   for no trades. Not wired into `winRateText` or the display log. Why: counts make the clamp exact; D23 keeps the win
   rate's output untouched and the display log is append-only.
5. **One home, asserted.** The re-exports are the same function objects; `toneClass` delegates (equal outputs over
   fixtures, its source run against `tone()`); a grep test flags a definition of `pct`, `tone` or `winPct` outside
   `lib/format.ts` and is proven on planted and real non-definitions (`const pct = unrealizedPct(p)`, `tone:` props).
6. **Property test: `pct()` is monotonic** over 10,000 seeded values plus rounding boundaries at digits 0..2, with
   "≈-100.0%" parsed as just above −100 (`JUST_ABOVE_TOTAL_LOSS`). Why: a monotonic printer keeps any numerically
   ordered lo ≤ avg ≤ hi in order; the every-surface test stays with the sweep rework, after fix #7.
7. **`RANGE_NOTE`** ("the range is for the average, not one trade") is one constant at the end of `lib/copy.ts`; its
   test ties it to `cardEvidence` (the range's centre is `headline().avgReturn`, lo ≤ avg ≤ hi, and a single trade lies
   outside the range on each fixture) and checks whole-word banned terms (advice, signal, skill, edge, pick, guarantee,
   expect, will and more). It is not added to `allCopy()` in this slice (that line is edited by other sessions).
8. **Ponytail list, not per-site comments.** `F19_SWEEP_SITES` in `lib/format.ts` names each file that still formats or
   tones on its own; a test checks each named file exists. The zero-count grep (`>= 0 ?`, `> 0 ? 'up'`, "Gain " labels)
   is a sweep-rework acceptance item; a count ratchet now would fail other sessions' in-flight PRs. Why: per-site
   comments would conflict with F-18's stats-row rewrite and the open card, pane, trade, month and stock sessions.
9. **Ranking pinned in a new file** (`lib/ranking.f19.test.ts`): `confidence()` fields, `RANK_MIN_BETS`, `MIN_BETS`,
   evidence weights, `rankTraders` order and `headline()`'s D23 keys, values computed on origin/main and on this branch
   (identical). (The QA round below edited one existing F-6 test to follow the move.)
10. **Cut from this slice:** `imagePct`, `rangeLine`, `figureEms`, the §3 form. Why: not in the first slice's criteria;
    they wait for the render test (O-18) and F-18.

## QA and review (2026-11-01)

- **Tester:** compared origin/main's `pct` and `tone` with the moved ones over 100,017 values × digits 0..3: 0
  differences. Blocking: (1) `lib/open-split.test.ts`'s "the module holds no copy" scan read the new
  `from './format.ts'` specifier and missed the moved `'flat'`. Fixed by skipping module specifiers and updating the
  pinned set to `['down', 'up']`: an exact assertion still, updated, not weakened (DK veto condition: the one existing
  test edited, F-6's). (2) `F19_SWEEP_SITES` was incomplete. Completed from a repo grep (13 more files, including
  `lib/rules.ts#signedPct`, which prints "+0.0%", and `lib/ticker.ts#signed`). Non-blocking, applied: `winPct` returns
  null unless both counts are whole numbers with 0 ≤ wins ≤ n. Left: the grep test knows three names, one line at a
  time (`ponytail:` at the test).
- **Independent code review:** no blocking finding. Applied: `winPct` rounds half up in integers (23 of 40 prints
  "58%", not "57%"); the `toneClass` source extraction runs inside its test; the grep test's name says what it checks;
  the `rankTraders` pin also runs on reversed input.
