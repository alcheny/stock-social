# F-2 · PR-5 amendment · UX lead sign-off

2026-10-25. Role: user-experience lead (`team/designer.md`). Reviewed: `plan-pr5-amendment.md` against my round-1
position (`plan-pr5-round1-ux-lead.md`), the F-2 feature file (Decisions to 2026-10-25, including the guardrails Q1
reversal), `plan-guardrails.md` §13 and T1.9, my guardrails sign-off (items 2, 5 and 7), `lib/copy.ts` (`SECTION`) and
`lib/copy.test.ts:333-334`. I checked what the viewer sees: the heading, the reasons, the four section states, C9, A1,
F6, and whether every displayed line is true by construction. Nothing here is legal advice. I changed no other file.

## 1. Accepted as written

| Point | Verdict | Why, from the viewer's side |
|---|---|---|
| S1 heading "More like what you follow and like" (S3 only) | **Accept** | It names the only inputs. It is one constant, and it goes back to criterion 2's words only when G3 lifts (Q1). The S3 line (U-3 below) says exactly which kinds the rows use. |
| S2 reasons R1 to R3 | **Accept** | They are my templates. They pass `SUGGESTION_WORDS` ("holding" is not `\bhold\b`) and `ENDORSEMENT`, with no ticker or number slot. The truth conditions match the score terms (S12: holding bucket only). |
| S3 watchlist and symbols dropped | **Accept** | This is my U3/D3. It removes the one security-linked reason. |
| S8 no `share` event | **Accept, against my D4** | No note is stored, so there is no Part B, nothing extra for Reset to clear, and no sentence to keep true. That is better for the viewer than giving criteria 3 and 5 a writer. |
| S10 four states, with S1 reduced to S0 (C9) | **Accept** | I already signed this in guardrails item 2: `SECTION.personal` and "Feed settings" don't render when the switch is off. My round-1 "Not ordered by your activity." line is withdrawn. C9 is binding, and an off viewer gets no personal wording at all, so there is no claim left to keep true. The way back is Settings. |
| S11 removals bounded, not exact | **Accept, against my §9 "misses none"** | It is the same bound I accepted for Reset and the switch (guardrails item 7). Repeats stay impossible. The reason line's truth is protected separately (U-4). |
| No reason line on feed cards; no effect promised after a like, follow or hide | **Accept** | My D5 and §8. |
| §9 Privacy sentences | **Accept** | Each one is true of the §4 score: follows ×2, likes, the bucket term, −4 into `Hv` for the hide window, and the off sentence word for word with the owner's decision. |
| §6.1 C3 tests asserting absence | **Accept** | 404 plus an unchanged row count for every table, for non-demo, demo, signed-out and switched-off clients. From the viewer's side that is as strong as "nothing is recorded" can be tested. |

## 2. Changes (binding on PR-5; each one is a test)

**U-1. S2's section is ordered with PR-4's demotions only. `SECTION.personal` stays as it is.**
- *Problem:* the amendment says S2 shows "`SECTION.personal` as PR-5 rewrites it (demotions and follows)". It does not
  say whether S2's rows use m. With m, S2 is a mixed section in disguise:
  - a liked trader (R1 true) could be lifted into a row that shows only the impersonal holding reason;
  - "Ordered by how much evidence each record has" would then leave out a positive factor.
- *Change:* in S2 the section's rows are chosen with `prefFactor`, exactly as PR-4 does. That means no like, no
  follow bonus and no `Hv` term. Feed cards still use m.
  - Today's `SECTION.personal` ("Traders you unfollowed, or whose trades you hid, are placed a little lower, and
    traders you follow are left out.") is then exactly true of S2, so it is **not rewritten**. Its rewrite comes out
    of §3 commit 2's `lib/copy.ts` row.
  - §13's trigger ("once follows and likes order") does not apply to the section in S2.
  - `orderOnExplain` is still rewritten (U-7).
- *Test:* in S2, the section's rows and order equal PR-4's section for the same fixture with that viewer's likes and
  follows added. T1.9 passes unmodified.

**U-2. The cold-start hint depends on follows and likes only.**
- The amendment contradicts itself. §5 shows the hint "only when there is no follow and no like". §6 says "Hides only
  give S2 with no hint". My round 1 had the same contradiction, and I am correcting it here.
- A viewer with only hides has no follow and no like, and the hint is true for them. So the hint renders **iff
  `followsAt` and `likesAt` both return nothing at `asOf`** (the same reads that decide the state, so the hint and the
  state never disagree). Hides, rejects and unfollow notes don't affect it.
- *Test:* rewrite the §6 row to "Hides only give S2 **with** the hint". Two personal candidates give S2 without it.
- The hint is static text. It shows no count, progress or "n more to go", and S3 appears with no badge or motion (F6).

**U-3. The S3 line names the kinds the rendered rows cite, not the kinds the viewer has.**
- A viewer who follows and likes, but whose three rows all come from likes, would otherwise read "Based on the traders
  you follow…". That is false for the rows on screen.
- R2 cites follows. R1 and R3 cite likes. Use exactly one of these:
  - both kinds: "Based on the traders you follow and the trades you like. Losses count the same as gains."
  - only R2: "Based on the traders you follow. Losses count the same as gains."
  - only R1 or R3: "Based on the trades you like. Losses count the same as gains."
- After the line comes "Feed settings".
- *Test:* the line's kinds equal the set of kinds among the rendered rows' reasons, over the 1,000-seed property.

**U-4. Reasons are computed for every render from the current rows and are never carried in the cursor.**
- Removals take effect at once and additions at `asOf`, so no reason can cite a like or follow that is gone.
- In R2 and R3, @x is never the viewer, never the row's trader, never deleted and never "Not interested".
- @x is plain text inside the row's accessible name, not a nested link (the row already opens the pane).
- *Test:* an unlike or unfollow between pages 1 and 2 leaves no reason on any later page citing it. The state may fall
  to S2 on that page, and that is allowed. No reason names the viewer's own handle.

**U-5. State S1's rule says exactly what differs from S0.**
- Replace "S1 equals S0 apart from the Following state" with: "S1 equals S0 minus the viewer's hidden traders, hidden
  trades and own record, with a followed trader's row showing Following (pressed)."
- T5.C9 asserts that equality, including the heading, `SECTION.explain` and every row reason. T1.9 asserts that
  `SECTION.personal`, "Feed settings" and the hint are absent.

**U-6. `/how#feed` gets corrected statements.** My round-1 §4 text has three statements that are false or incomplete
against the §4 score:

| # | Problem | Corrected statement |
|---|---|---|
| 2 | Leaves out the direct like effect | "Signed in, with Order my feed by my activity on: traders you follow, and traders whose trades you liked, appear higher. So do, a little, traders whose typical holding period matches theirs." |
| 3 | Leaves out the `Hv` −4 | "Traders you unfollowed, and traders whose trade you hid, appear a little lower for 90 days, and so do traders with a similar holding period to ones you hid or marked Not interested. Traders you marked Not interested and trades you hid are left out of your feed for 90 days. Their profiles stay public and complete." |
| 4 | "how large a return was" is false, because the base order is the evidence lower bound | "Your follows, likes and hides move a trader the same way whether their trades gained or lost, and the order never uses anyone else's activity. Nothing about which records you open or scroll past is used." |
| 5 | "Reset what it uses" overclaims: Reset keeps follows and likes | "Turn it off in Settings. Reset my feed, also in Settings, clears your hidden trades and unfollow notes." |

- Statement 1 stays.
- The 90-day figures come from the constants.
- *Test:* each statement maps to a pinned fact (the §6 invariants, the sign-invariance test, the Reset test).

**U-7. Exact text for `SETTINGS.orderOnExplain` (On):**
- The text: "Traders you follow, and traders whose trades you liked, appear higher in your feed, and so do traders with a
  similar holding period. Traders you unfollowed, or whose trade you hid, appear a little lower. Traders you marked
  Not interested and trades you hid are left out. Gains and losses count the same. Nothing about which records you
  open or scroll past is recorded. How your feed is ordered" (link → `/how#feed`).
- The "open or scroll past" sentence is backed by §6's scripted-session snapshot (scroll, open panes, swipe, dwell).
  It renders only while G3 holds. It never becomes "nothing you open is recorded", because of the watched symbol's
  `last_seen_at` stamp.
- *Test:* the truth test in §6.1 checks this string, and it passes the PR-5 scan words.

**U-8. A1.**
- No new colour or style:
  - the S2 and S3 lines sit in the existing `muted small` paragraph;
  - the reasons use `.sreason`;
  - both are already contrast-checked in light and dark.
- The region's `aria-labelledby` resolves to the state's heading in all four states.
- The hint and the S3 line are plain text, not live regions (nothing changes under the reader).
- *Test:* add these to the §6 demo e2e at 360 and 375 px, light and dark, keyboard and touch.

## 3. Owner questions

None new. Q1 (the heading and the restated criteria) and Q3 (the keyed-read guard) stay the owner's. U-1 removes the
`SECTION.personal` rewrite but does not change a criterion.

UX lead: signed, on the condition that U-1 to U-8 are applied to the amendment before commit 2 starts. Commit 1 (pure)
may start now. U-2, U-3 and U-4 change only `sectionState`, `reasonFor` and their tests.

SIGNED
