# F-21 · Exclusion counts beside the headline (pane and record strip)

Status: blocked
Blocked: waits for F-23 (PR #97, edits the pane and its payload) and F-24 (PR #84, edits the future-count query in `lib/sync.ts` that the sells-only count needs, and adds `excludedHeld`) to merge
Start conditions: fix F3-2 merged in #85. It starts once #97 and #84 merge. It rides the pane/strip build slot with
F-29 and F-34 (one builder owns the pane's line order). F-22 (draft, OD 2.28) joins the shared sum if it lands later.

## Why
Excluded trades are counted, but the counts render only on the profile (`app/u/[handle]/page.tsx:302-311` at
3d66114). The swipe pane, which SW-1 makes the main record view, and the record strip on trade and month pages print
win rate, average and range with no sign that anything was left out. #52 added a further exclusion (`notShared`,
`lib/sync.ts:101`) that has no count anywhere. A headline that hides its exclusions where people read it implies a
completeness the record does not have (POLICY F3a, F4). Council cycle 3 brief C3-17 (rank 3), reshaped in round 0.
Approved by the approval council (`docs/ideas/approval-2026-11-01-cycle3.md`: second-vote mean 4.13, final vote
15/15, all with conditions).

## Decisions
- 2026-11-01: When the record's exclusions sum to more than 0, the swipe pane shows one muted line under its headline
  stating the count and linking to the profile's exclusion reasons; the record strip on trade and month pages carries
  the same line if it fits D22/F-10's one-line rule there. Nothing is shown when the sum is 0. Why: approved by the
  approval council (cycle 3); counts where records are read (all members).
- 2026-11-01: No second line on feed cards. The feed card keeps D22's single record line. Why: approved by the approval
  council (cycle 3); D22 (`docs/IDEAS.md:148`), F-10:12-18 (veto condition: DK).
- 2026-11-01: The share card and the F-12 trade, month and stock images are unchanged until the owner answers cycle-3
  owner question Q4 (exclusion count on the share card). D24 and idea-16 wording are unchanged. Why: approved by the
  approval council (cycle 3); F-4 card contents are the owner's (veto condition: DK, LG).
- 2026-11-01: One function computes the exclusion sum for the profile, the pane and the strip. It includes every
  exclusion counter the record keeps (today `users.excluded_positions`, `excluded_future` and `excluded_corporate`,
  `db/schema.sql:34`, `:319`, `:694`; F3-1's unpriceable rows and F-22's transfers out when they land; and `notShared`
  shared-account exclusions, which need a real per-sell counter computed in the rebuild, never an estimate). Paper
  (simulated) accounts are left out of the sum and named in the function as not a trade exclusion: they are whole
  accounts the record never includes, and the profile keeps their own line (`app/u/[handle]/page.tsx:311`). Where a kind is deliberately not an
  exclusion, it is named in the function with the reason. A new exclusion kind added outside the function fails a
  test. Why: approved by the approval council (cycle 3); red team (a kind left out of the sum is a place to route
  exclusions), RE, TS (veto condition: LG, CS).
- 2026-11-01: The wording is neutral ("excluded from these figures", never "hidden" or a blame word), muted, with no
  warning colour or icon, and the trader cannot turn it off. Why: approved by the approval council (cycle 3); LG, DV,
  PD, TS (veto condition: CS).
- 2026-11-01: The line never pushes the disclaimer out of view on the pane at 360 px. Why: approved by the approval
  council (cycle 3); POLICY disclaimer rule, D20 (veto condition: LG).
- 2026-11-01: Accessibility: the line sits right after the headline in DOM order, the link is a real link with a
  descriptive name (not tooltip-only), has a 44 px target, and reflows at 320 px; `--muted` text keeps AA contrast.
  Why: approved by the approval council (cycle 3); A11Y, UX.
- 2026-11-01: The `notShared` rename-chain gap (the chain read at `lib/sync.ts:123-129` lacks the filter `:101`
  applies) is fixed with a behavioural test before or with this feature, so the count matches what the record uses.
  Why: approved by the approval council (cycle 3); RE (found in round 1), MR.
- 2026-11-01: Sequencing and lapse: starts after fix F3-2 merges; if F3-2 has not merged by the next approval council
  (cycle 4), this approval lapses to that council. Why: approved by the approval council (cycle 3); lapse rule.

- 2026-11-01: Lapsed at approval council cycle 4: F3-2 had not merged and F-22 was not decided. It was voted again and
  not re-approved: second-vote mean 3.47, below the 3.5 approval floor (`docs/ideas/approval-2026-11-01-cycle4.md`). The
  file and every decision above are kept word for word. It returns to the next council once F3-2 merges, starting after
  F3-2 alone if the owner declines F-22. Why: approval council cycle 4; lapse rule; DK, EN, PF (a third lapse while F3-2
  sits on a branch with no PR).

- 2026-11-01: Returned to approval council cycle 5 (F3-2 merged in #85) and re-approved there
  (`docs/ideas/approval-2026-11-01-cycle5.md`: second-vote mean 4.13, final vote 15/15, all approving, 14 of them with
  conditions). Every decision above is kept word for word. Why: approval council cycle 5; bring-back condition met.
- 2026-11-01: The shared sum counts sells and option closes only, in the headline's unit. `excluded_future` also
  counts buys (`lib/sync.ts:181`), so its sell part comes from #84's future-count query. One number never mixes buys
  and sells under the word "trades". The sum also covers `excluded_options_*` and `excluded_exercise_shares`
  (`db/schema.sql:1030-1041`), #84's `excludedHeld` and F-32's "transfer" reason. It reads stored counters only, with no
  per-request scan. Why: approval council cycle 5; RT round 4, TE, RE, VW, UX, CO (veto condition: CO, buys and sells
  mixed under "trades").
- 2026-11-01: The new-counter guard enumerates every `excluded*` key of `MatchResult`, the options result and the
  public-filing result, as well as the schema columns. Why: approval council cycle 5; TE, RT round 4.
- 2026-11-01: The line links to the profile's per-reason lines (focus lands there), including F-32's "transfer"
  reason once it exists. The wording stays "excluded from these figures", never "hidden" or "removed". Why: approval
  council cycle 5; RT, UX, LC.
- 2026-11-01: The pane/strip slot's shared criterion: with the exclusions line, F-34's open line and F-29's options
  qualifier all present, the headline and disclaimer stay in view at 360 px and reflow at 320 px. The order is
  exclusions, then open, then options qualifier. Why: approval council cycle 5; UX, CO.
- 2026-11-01: Recorded as a decided limit: the share card and the feed card keep the clean headline (cycle-3 owner
  question Q4, D22). Owner flag: OD 2.7's consent version names the public exclusion counts before real users. Why:
  approval council cycle 5; BL, LC, PR.

## Acceptance criteria
- [ ] A fixture record with `excluded_corporate = 2` shows the exclusion line on the pane, signed out, at 360 px (e2e);
      a record with every count at 0 shows no line.
- [ ] The line's count equals the profile's exclusion total for the same record (equality test over profile, pane and
      strip, fed by one function).
- [ ] A test fails if an exclusion counter is added to the schema or the rebuild without being summed (or named as
      deliberately left out) in the shared function.
- [ ] The count includes `notShared` exclusions (or names them as not an exclusion, with the reason), and a behavioural
      test proves a marked shared account in a rename chain does not feed the record (`lib/sync.ts:123-129`).
- [ ] The line links to the profile's exclusion reasons; the link has a descriptive accessible name and a 44 px target.
- [ ] Feed cards render exactly one record line (D22): a test fails if the exclusion line appears on a feed card.
- [ ] The share card and the trade, month and stock image snapshots are unchanged.
- [ ] At 360 px signed out, the disclaimer stays in view on the pane with the line present (e2e).
- [ ] The line has no warning colour, no icon, and none of the words "hidden", "removed" or a cause that blames the
      trader (copy test).
- [ ] The line reflows without horizontal scroll at 320 px and passes the contrast test for muted text.
- [ ] The equality fixture includes a future BUY, and the line's count does not move when it matures (sells and option
      closes only).
- [ ] The guard is mutation-checked in the PR: a dummy `excludedX` key added to `MatchResult`, to the options result
      and to the public-filing result each fails the test.
- [ ] The line links to the per-reason lines, and focus lands there; once F-32 lands, its "transfer" reason is among them.
- [ ] With F-29's qualifier and F-34's open line present (once built), the headline and disclaimer stay in view at
      360 px in the order exclusions, open, options qualifier (e2e).

## Out of scope
- The share card's treatment (owner question Q4).
- A line on feed cards.
- New exclusion kinds (F-22 adds its own count; this feature only sums).

## Hand-offs from F-35 (2026-11-02)
- F-35 publishes a row only once its date has passed. `users.excluded_future` still counts waiting share rows, buys and
  sells; the sells-only sum must never read it (a maturing future BUY must never move this count, F-35 decision). Take
  the sell part from the rebuild's future-count query (`lib/sync.ts#rebuildTrades`, `side = 'SELL'`).
- F-35 adds `users.excluded_future_options` (option rows dated ahead, opens and closes): whether the sum counts its
  closes is F-21's call; a waiting option row is not classed as a close until it is matched.

## Open questions
- Owner (cycle-3 Q4): show "‹n› excluded" on the share card? The council recommends one muted line when n > 0.
- If the owner declines F-22, this feature starts after F3-2 alone (council's recommended order; the orchestrator
  records the start).

## Rework notes

## Build log
