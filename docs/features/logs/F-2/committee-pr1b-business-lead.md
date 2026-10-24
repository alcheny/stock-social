# F-2 PR-1b "exploration and reach": business lead verdict (2026-10-24, HEAD 350522b)

Judged against my acceptance test (committee PR-3 §5), the plan's "Amendment: PR-1b", POLICY and COMPLIANCE §1.

## 1. Decision

**Merge.** It moves this phase's gate: a connected trader with 5 closes now gets seen, which before PR-1b could not
happen while 40 hot traders filled the 200 candidates.

Demo sentence: "Every trader who connects gets seen: new records come up in the swipe within days, with losses counted
like gains."

## 2. Verified as a user

Fresh production build of HEAD (a separate worktree, so the owner's server on 3000 was untouched), `next start` on 3117
with `ALLOW_DEV_AUTH=1`, the vendor fake on 4197, Postgres 16, my own database (created by the superuser, owned by the
shared role, dropped afterwards), the 3 demo traders seeded. No sync tick. My own fixture, independent of the engineer's
(different generator and seed, closes relative to today): 40 hot (30 closes in 72 h), 60 ordinary (8 to 20 closes),
5 newcomers with **5** closes each. Pages 1 to 4 with their sections, signed out, 7 consecutive day seeds.

| Check | Result |
|---|---|
| Eligible traders seen (cards + rows), union of 7 seeds | **101 / 105 (96%)**, bound ≥ 80%. Per seed 79 to 82. |
| Newcomers with 5 closes seen | **5 / 5** over the week; 2 to 4 per seed. Yes: a newcomer with 5 closes gets seen. |
| Section rows with no earlier card | 12 / 12 per seed (no row was a trader already carded). |
| Hot traders in the first 60 | 30 to 34 (no hot trader in the first 20 more than its share; rhythm reads h/o alternating, no visible cycle). |
| Page 1 over HTTP, signed out, 40 runs (with the demo traders) | median 93 ms, **p95 131 ms**, max 236 ms; HTML 353 KB (bound 500). |
| Engineer's LOAD numbers (p95 166 to 375 ms, 321 to 329 KB) | consistent with mine; not re-run at 500 traders. |

Where the slot works and where it does not: on every seed the **first** section gives row 3 to a newcomer; the 2nd to
4th sections never do (rows are hot, hot, ordinary). The hot pair holds 1 to 7 days, so a newcomer in that bucket loses
the slot to the bucket cap, the known limit. Exploration cards carry the rest of the newcomers' reach. Acceptable now;
demand 2 makes the slot survive the cap.

### The section's "newest zero-evidence record" slot

- Reason line: "Typical holding period: 1 to 4 weeks", true for the record, and the same template as every row. It
  does not say "new" and needs no extra word: the explainer "Ordered by how much evidence each record has" stays true
  because row 3 has weight 0 and no more closes than rows 1 and 2. **Honest. Keep it unlabeled.** A "New" chip would
  reintroduce the template I deleted in PR-3 and would be on every row at launch.
- Demo above verified: on page 1 the section read verified ordinary, **Demo**, verified newcomer; the engineer saw two
  Demo rows above a verified one. It is honest (badged Demo, true order), but it spends a reach slot on a fake trader
  ahead of a real connected one, which is the opposite of this PR's point. **Not acceptable as the steady state; not a
  merge blocker** (demo data exists only while real supply is thin, and it is badged). Demand 1.

### Feed rhythm with hyperactive traders discounted

The engineer's skewed result (repeated 3-trader run in 1 of 50 generated fixtures, from 40 of 50) is the right measure;
on my fixture no hot trader came back on a fixed beat in the first 20 on any seed. The discount only on the top 30 is
the right minimum: discounting every trader starved exploration (their measured 16 of 24). Accept.

## 3. Scorecard

| Dimension | Score | Evidence |
|---|---|---|
| Market demand | 4 | Supply retention depends on being seen; new creators getting early distribution is standard in vertical feeds (analogy). Owner placed exploration in the feed (F-2 decisions). |
| Ease of adoption | 5 | Zero new steps, zero new UI: the reader just meets more traders. |
| Phase fit | 5 | Directly the gate: 96 to 99% of eligible traders seen in 120 cards over a week, every newcomer included. |
| Revenue impact | 4 | More connected traders seen means more follows for PR-5 to rank on; still indirect. |
| Aesthetics & clarity | 4 | No visual change beyond 2 px under the sheet's disclaimer; rows read the same. |
| Trust & compliance | 5 | No number added; the slot reads no average, size or sign; Demo never takes the slot; signed-out read byte-identical to signed in (tested). |
| Simplicity | 4 | One statement, no schema, no dependency, 121 product lines; the 4-group ordering is one rule more than needed (demand 2 folds the slot in). |
| Craft & taste | 4 | Known limits stated honestly in the amendment; the slot losing to the cap on later pages is the one rough edge. |

## 4. Deleted / said no to

- No "New" label on the slot row (above).
- No to a second query for outside traders (engineer already measured 75 ms; one statement is right).
- No to discounting beyond the top 30.

## 5. Rulings for PR-4 and O3

**O4 (unfollow), engineer's proposal `WEIGHTS.unfollow = -1`, signed-in only: accept, with three conditions.**
- −1 is "slight" against reject −4: right order of magnitude. Signed-in only is automatic (signed out has no follows).
- Restate the F-2 criterion "unfollow does the same for the trader" to: "unfollow applies the unfollow weight to that
  trader's score for the viewer; it never removes the trader's cards or section rows." Restate the pinned
  `lib/feed.section.test.ts` case in the same PR, without lowering the test count.
- The −1 ages out with the event (90-day raw event deletion) and is deleted with the account. Test: an unfollowed
  trader still appears in the feed and the section, ranked below an otherwise identical trader; after 90 days, equal.

**O3 (hide duration), committee recommendation to the owner: rejected trade permanent, hidden trader 90 days.** Accept
as the recommendation. Why: a rejected trade is one closed record that never changes, so bringing it back has no value
to anyone; a trader keeps trading, so a permanent hide from one swipe would cost them reach forever (accidental swipes
exist even with the half-card threshold). Conditions: the trader-level −4 that a trade reject also applies expires at
90 days like the event; the permanent trade exclusion is a row in the exclusions table, not a raw event (so the 90-day
event purge does not undo it), and account deletion removes it the same day. No "hidden trades" management screen:
5-second Undo is enough for a single card.

## 6. Policy and compliance (COMPLIANCE §1)

Checked the engineer's §6 against the diff and my walk: no performance number added; losses weigh like gains; no new
personal data read or stored (impersonal read, byte-identical signed in and out); no user text; no new input beyond the
cursor bound of 350; the section line stays true; no third-party company named. `## Compliance` answered. PASS.

## 7. Demands

1. **Builder (PR-4 fix round, one line): Demo records go after every verified candidate in the section.** Reason: the
   section is a reach slot for real connected traders. Verify: e2e database, the first section shows no Demo row while
   3 verified candidates exist.
2. **Builder (PR-4): pick the slot first, then fill rows 1 and 2 under the bucket cap**, so a newcomer sharing the top
   rows' bucket still gets row 3. Verify: on the PR-1b fixture, sections 2 to 4 each carry a weight-0 newcomer while an
   unseen one exists.
3. **Builder (PR-4): O4 and O3 exactly as ruled in §5**, with the restated criterion and the tests named there.
4. **Reviewer:** for any reach change, measure per section, not only the union over the week (the union hid that
   sections 2 to 4 never show a newcomer).
5. **Engineer, log hygiene:** the flaky `lib/reflections.test.ts` foreign-key failure (run 1) gets its own issue.

## 8. What would change my mind

- If, at launch, newcomers seen per day stays below ~50% of those who connected that day, exploration needs a
  guaranteed card in the first 30 for each newcomer. Fastest test: the PR-1b fixture with 30 newcomers instead of 5.

COMPLIANCE: PASS · USABILITY: DEMANDS
1. Demo records after every verified candidate in the section (one line; PR-4 fix round).
2. Choose the new-record slot before the bucket cap, so later sections still carry a newcomer.
3. PR-4: `WEIGHTS.unfollow = -1`, signed in only, never a hide, ages out at 90 days; restate the criterion and its pinned test.
4. O3 to the owner: rejected trade permanent (an exclusion row, removed with the account), hidden trader 90 days, the trader-level −4 expires at 90 days.
5. Reviewer: measure reach per section, not only the weekly union.
6. Engineer: file the flaky reflections foreign-key failure.
