# F-2 · PR-5 amendment · Sign-off · Business lead

Date: 2026-10-25. Reviews `plan-pr5-amendment.md` against the F-2 Decisions of 2026-10-25 (H1, H2, guardrails, Q1
reversed), POLICY F1 as amended, COMPLIANCE §1, `docs/IMPLEMENTATION.md` "Parallel development", and my round-1
position. Checked against `lib/copy.test.ts:333`, `lib/discovery/prefs.ts:17`, `lib/discovery/weights.ts:24-26`,
`lib/feed.signed-out.test.ts:70-104, 254-291`, `lib/feed.section.test.ts:105`. Nothing here is legal advice.

## 1. Decision

**Sign, with seven binding changes (§8).** PR-5 is still worth shipping: ~370 product lines, no schema, no route, no
new data, an owner decision (H1) delivered at its minimum. One defect is real and must be fixed before a line of
commit 1 is written: as specified, the ×2 cap erases the owner's O1 "slight negative" on any followed trader, and the
amendment's own invariant test would fail (§3).

## 2. The demo sentence

The amendment's sentence says "traders who hold about as long come higher". That is the wording the scan rejects, and
it promises the feed effect that is smallest (×1.14 at most). What a viewer actually sees is the section. Use:

"Like two trades, open the feed again, and a section called 'More like what you follow and like' shows traders with a
similar holding period, losses included, each with one line saying why."

## 3. The checks you asked for

| Point | Verdict | Evidence |
|---|---|---|
| "Holds trades…" dropped | **Accept.** My reason was wrong. | `lib/copy.test.ts:333` `SUGGESTION_WORDS` matches "Holds" (line 337 pins it). R1 to R3 are better: each names the viewer's own action that put the row there. |
| Watchlist dropped (S3) | **Accept; it beats my "constant at 0".** | A constant at 0 is dead code, not a guardrail. Deleting it removes the only input that ties a security to a trader (packet Q1 medium risk) and the only reason close to "about a security". |
| Follow +5 (S4) | **Accept the value; reject its stated reason.** | 1.25^5 = 3.05, so a follow alone sits at the cap. The S4 reason ("keeps a followed trader at the cap even when the viewer hid one of their trades") contradicts the owner's 2026-10-24 O1 decision: a reject applies "a slight negative preference to its trader". |
| m = clamp(1.25^r, 0.5, 2) (S5) | **Defect. Change it (§8 change 1).** | A single clamp on the sum lets positives absorb negatives. Followed twin: r = 5 → m = 2. Followed twin plus one reject: r = 4 → 2.44 → m = 2. They tie, so §4's invariant "an unfollowed or rejected trader ranks below its exact twin, with or without positive signals" fails whenever r − 1 ≥ log₁.₂₅2 ≈ 3.1, which is any follow or two fresh likes. |
| Build order (§7) | **Accept, with one acceleration (change 5).** | Commit 1 passes all five independence rules against PR-7, PR-8 and the Privacy PR (new files plus appends). Commit 2 correctly waits (rules 1, 2, 4). But the Privacy PR is serialized behind PR-8 although its file set (`lib/copy.ts` `PRIVACY`, append-mostly) and tests do not need PR-7 or PR-8 code. Only its merge must wait, because it states the guardrails as shipped. |
| Q1 (restatements) | **Accept, as one question.** | It is the bundle I asked for (round 1, demand 4). |
| Q2 (proposed values) | **Accept, with the changed factor.** | One constant each in `PROPOSED`; the owner promotes with a one-line diff. |
| Q3 (guard relaxation) | **The default "Yes" is wrong (change 2).** | A guard relaxation never takes a default. Worse, the gate is the hand merge, and Q8 offers an alternative that removes it: if the owner picks the separate Privacy PR, nothing stops PR-5 from auto-merging on Q3's default. `lib/feed.signed-out.test.ts` is not a protected path. |
| Q4, Q5, Q7 | **Accept.** | Not inputs, no share, opening swipe dormant: all follow from G3 and S3. |
| Q6 (removal bound) | **Accept.** | Same bound PR-7/PR-8 already accepted for Reset and the switch. Exactness would store removal history and make "Unlike deletes it at once" false. |
| Q8 (hand merge) | **Delete the question (change 2).** | PR-5 carries a guard relaxation, so it is owner-merged whatever Q8 says. One fewer owner question. |
| O3 | **Accept.** | 90 days for both, my round-1 §9 position. |
| §6.1 C3 tests | **Strong enough, with one fix (change 6).** | The row-count snapshot is the real guard; the 404s are cheap extras. §6 "No new data" scopes the snapshot to tables with a `viewer_id` column, while T5.C3a says every table. A new writer keyed some other way would escape the narrow one. |
| `feed.section.test.ts:105` rewrite (c) | **Do not weaken it (change 4).** | With (b)'s isolated-bucket follows, the only m ≠ 1 in that fixture is the unfollowed trader's ×0.8, so "reads after all of them" is still true in S2. Rewriting it to "below its exact twin" weakens a pinned assertion that still holds. |
| What to measure | **Missing (change 3).** | The amendment has no measurement section. Without one, PR-5 cannot be judged after merge. |

## 4. Scorecard (the amendment with §8 applied)

| Dimension | Score | Evidence |
|---|---|---|
| Market demand | 4 | Observed behavior tier: the 2023 peer-reviewed field study (round 1 §8) found users moved off a ranked feed were less active. Caveat: that ranking used implicit signals; explicit-only is weaker. |
| Ease of adoption | 5 | Zero new steps; the viewer already likes and follows. No new control (COMPLIANCE §1 item 8). |
| Phase fit | 4 | Targets D7 return. Honest limit: with fewer than 50 traders, reordering moves little. |
| Revenue impact | 3 | Indirect; round-1 §10 chain stands (base 0.015·V extra profile views a week). |
| Aesthetics & clarity | 4 | One heading, one reason line per row, four states, each true by construction (§5). |
| Trust & compliance | 5 with changes 1 and 2; **4 as written** | As written: a default "Yes" on a privacy-guard relaxation, and an O1 contradiction hidden by the cap. |
| Simplicity | 5 | ~370 lines (sum of the §3 tables), 0 schema, 0 routes, 0 vendors; down from ~1,100. |
| Craft & taste | 4 | The section states and R1 to R3 are exact; the demo sentence needed the fix in §2. |

It clears the bar only with changes 1 and 2.

## 5. What I deleted or said no to here

- Deleted: Q8 (moot), and the S4 rationale sentence about hidden trades.
- No to the "reads below its exact twin" rewrite where "after all of them" still holds.
- No to a "what to measure" that logs anything: every metric below comes from existing state rows. Logging section
  renders to measure S3 reach would be recording activity, which G3 and the Q1 reversal forbid.

## 6. Revenue chain

Unchanged from round 1 §10. Most sensitive assumption: **a**, the share of viewers who give at least one like or
follow in week 1. Cheapest test: one query over `trade_likes` and `follows` `created_at`, two weeks after real viewers
arrive.

## 7. Urgency

PR-5 does not unblock real users; item #7 being scheduled and the share-image font fix do. PR-5 commit 1 may use idle
worktree time only, never a reviewer slot those two need (§7 says so; keep it).

## 8. Binding changes (the engineer applies them to the amendment; I verify each)

1. **Split the factor so positives cannot absorb negatives.** Replace S5 and §4's `m` with
   `m(T) = P(T)·N(T)`, `P = min(1.25^r⁺, 2)`, `N = max(1.25^r⁻, 0.5)`, where `r⁺` is the follow term, the like terms and
   the bucket term when positive, and `r⁻` is the unfollow and reject terms and the bucket term when negative. The range
   stays [0.5, 2]. With no positives, N is exactly today's ×0.8 per −1, so PR-4's pinned tests are unchanged. A followed
   trader with one rejected trade gets 2 × 0.8 = 1.6, not 2. Update §4's factor table ("a follow: ×2; with a reject:
   ×1.6") and delete S4's second sentence. Verify: §4's invariant "rejected ranks below its exact twin, with or without
   positive signals" passes for a followed twin and for a twin with two fresh likes, over 1,000 seeds; `m ∈ [0.5, 2]`.
2. **Q3 has no default, and PR-5 is owner-merged regardless.** Q3's default becomes: "None. The build proceeds; PR-5
   does not merge until the owner's explicit answer is recorded in the F-2 file." Delete Q8; §3 says PR-5 is
   owner-merged because it carries both Privacy text and a guard relaxation. Strengthen the rewritten keyed assertion
   in `lib/feed.signed-out.test.ts` with a behavioral check, in the same case: seed another viewer's likes on the same
   traders and assert this viewer's pages 1 to 3 and section are byte-identical with and without them (F1 "never
   another viewer's data"), and that the `trade_likes` statement has exactly one viewer predicate, `l.viewer_id = $1`,
   with `$1` equal to the session's id. Verify: the case and the verbatim switched-off copy both exist; the test count
   rises.
3. **Add §13 "What to measure"**, all from existing rows, no new data: (a) share of viewers active in week 1 with at
   least one like or follow; (b) share of switched-on viewers whose rows give S3 (at least 3 personal candidates),
   computed offline by `sectionState` over their rows; (c) likes per 100 hides per active viewer-week, before and
   after, same cohort; (d) D7 return for viewers with signals, directional at small n. Kill line: if (a) is below 10%
   two weeks after real viewers arrive, stop investing in personal ordering, and PR-5x gets no plan round on demand
   grounds. Verify: the section exists with these four and the kill line.
4. **`feed.section.test.ts:105` keeps "reads after all of them"** in the S2 fixture of (b), where it is still true. "Below
   its exact twin" is asserted only in the new S3 sibling (d). Verify: line 105's assertion text unchanged in the diff.
5. **Build the Privacy PR alongside PR-7**, in its own worktree (it passes rules 1 to 5: `PRIVACY` entries only,
   append-mostly, no ranking change); it merges after PR-8. Update §7's order. Verify: the order table shows it in
   step 2, merge gated on PR-8.
6. **One snapshot scope:** §6 "No new data" and T5.C3a to T5.C3d all snapshot the row count of every table in
   `db/schema.sql`, not only tables with a `viewer_id`. Verify: the test enumerates tables from the schema file.
7. **Replace the amendment's demo sentence** with §2's. Verify: the line under the title.

## 9. Demands

**Engineer (amendment):** changes 1, 2, 3 before commit 1 starts (1 changes `personal.ts`'s core function); 4 to 7 in
the same edit.

**Builder (PR-5):** done is the §6 demo e2e at 375 px, light and dark, signed in and signed out, with screenshots, and
the R3 row text matching a fixture you can name. Not unit tests alone.

**Reviewer:** run the rewritten guard cases and T5.C9 yourself against a real database with the query log. An approval
from the diff alone is not an approval: the risk is a `trade_likes` read on the switched-off or signed-out path, or one
that reaches another viewer's rows, and only the query log and the byte-identity check show it.

## 10. What would change my mind

- (a) below 10% after two weeks of real viewers: personal ordering reaches almost no one; stop (change 3).
- The owner says no to Q3: PR-5 cannot read likes in `loadFeedPage`. Then ship follows only (they are already read,
  keyed) and drop R1 and R3. Do not move the read elsewhere to dodge the guard.
- The engineer's measured commit 1 exceeds 250 lines: the scoring is over-built; cut the bucket term before anything
  else.

SIGNED (with changes 1 to 7 in §8 binding; 1 and 2 before commit 1 starts)
