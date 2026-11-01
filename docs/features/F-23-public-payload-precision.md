# F-23 · Public payloads carry no more precision than the screens show

Status: blocked
Blocked: waits for fix F3-2 (cycle-3 fixes list, on `claude/fix-truthful-labels`, edits the pane and its route) and F-26 (`claude/f26-held-like-none`, edits the pane-chart route) to merge
Start conditions: fix F3-2 merges. Shares one build slot (the pane and payload slot) with F-21.

## Why
The public pane JSON sends `closedAt` in milliseconds and full-precision returns under a public cache
(`app/u/[handle]/pane/route.ts:23`, `:28` at 3d66114); the feed's series sends epochs (`lib/feed.ts:202-203`). The
screens print a day and a one-decimal percent, and consent tells traders prices stay private (`lib/copy.ts:80`). A
fictional probe in council cycle 3 recovered position size from the extra precision under a flat commission. Council
cycle 3 brief C3-36 (rank 8). Approved by the approval council (`docs/ideas/approval-2026-11-01-cycle3.md`:
second-vote mean 3.67, final vote 15/15, all with conditions).

## Decisions
- 2026-11-01: Every public payload rounds returns to the precision the screens print (`lib/format.ts`), unless the PR
  includes a fictional probe showing a finer precision still defeats fee-based size recovery, and sends dates as UTC
  days. Holding days go out at one decimal at most. Why: approved by the approval council (cycle 3); the red team
  showed 4 decimals is still finer than the screen.
- 2026-11-01: It covers every public field, including `unrealized_pct`, `openAsOf`, `closedAt`, the `/pane-chart`
  series and the feed's client data and HTML, and cached responses are re-keyed so no old precise payload is served.
  Why: approved by the approval council (cycle 3) (veto condition: LG).
- 2026-11-01: Rounding happens only where data is serialised to JSON or client props. Stats, confidence intervals,
  ranks and F-10's pinned floats are computed on stored values; nothing stored changes. Why: approved by the approval
  council (cycle 3) (veto condition: DK, LG, CS).
- 2026-11-01: Same-day closes keep a stable order: a tie-break is sent (or applied before rounding) so the chart scrub
  lands on the right trade. Why: approved by the approval council (cycle 3); DECISIONS click/swipe consistency (veto
  condition: DK).
- 2026-11-01: No displayed figure, tone or Flat changes, and accessible names carry no more precision than the visible
  text. Why: approved by the approval council (cycle 3); UX, A11Y, DV.
- 2026-11-01: Sequencing and lapse: starts after fix F3-2; if F3-2 has not merged by the next approval council
  (cycle 4), this approval lapses to that council. Why: approved by the approval council (cycle 3); lapse rule.

- 2026-11-01: Lapsed at approval council cycle 4 (F3-2 had not merged) and **re-approved by the approval council,
  cycle 4** (`docs/ideas/approval-2026-11-01-cycle4.md`: second-vote mean 3.73, final vote 15/15, all with conditions).
  Every decision above stands word for word. The council found the precision leak live on main for every connected
  trader (`app/u/[handle]/pane/route.ts:24`, `:28` at e6731d5), against the consent line (`lib/copy.ts:82`). Why:
  approved by the approval council (cycle 4); TS, RT, LG (veto condition: DK, every earlier condition kept).
- 2026-11-01: Scope widened by the red team's finding. The profile page sends its chart points through `packPoints`
  (`lib/paging.ts:41`, via `app/u/[handle]/page.tsx:323`), with returns to 1e-8 and millisecond `closedAt` in the RSC
  payload of the page shared links land on. `packPoints` rounds to the printed precision and sends UTC days. The
  scrub's same-day tie-break uses the list-order index, not milliseconds. The size grows from M toward M-L, still one
  slot. Why: approved by the approval council (cycle 4); RT, EN (veto condition: LG).
- 2026-11-01: The stats sent to the client (average, confidence-interval bounds, headline) are rounded too. Ranking
  and intervals are still computed on stored values. Why: approved by the approval council (cycle 4); RT (veto
  condition: LG, differencing unrounded stats before and after a close recovers its return).
- 2026-11-01: The fee-recovery probe in the PR states the smallest position size at which one-decimal output still
  reveals size. Any caveat to the consent words (`lib/copy.ts:80`, `:82`) is for the owner and the AI legal committee,
  not this build. Why: approved by the approval council (cycle 4); RT, LG.
- 2026-11-01: Sequencing and lapse: starts after fix F3-2 (on `claude/fix-truthful-labels`) and F-26
  (`claude/f26-held-like-none`, which edits the pane-chart route) merge. The council recommends rebase-first (owner
  Q6). If they have not merged by the next approval council (cycle 5), this approval lapses to that council. F-21, its
  former slot partner, was not re-approved, so F-23 holds the pane and payload slot alone. Why: approved by the approval
  council (cycle 4); lapse rule; EN.

## Acceptance criteria
- [ ] For a fixture with an odd return and a 14:31:07 close, `/pane`, `/pane-chart` and the feed HTML contain no return
      finer than the printed precision and no time finer than a UTC day (response test).
- [ ] `unrealized_pct` and `openAsOf` are covered by the same test.
- [ ] The pane headline equals the profile headline for the same record, including a value on the rounding edge
      (parity test).
- [ ] Two closes on the same day keep their order in the chart and the scrub opens the right trade (e2e or unit).
- [ ] A snapshot shows no displayed figure, tone or Flat label changes on profile, pane and feed.
- [ ] Ranking and confidence-interval tests pass unchanged (computed on stored values).
- [ ] The public cache key changes with the payload format, so a pre-change cached body is not served.

- [ ] One test scans every signed-out response on the profile, pane, pane-chart, feed, trade and month pages (HTML, RSC
      flight including `?_rsc=`, JSON routes, OG alt, accessible names, `data-*` and `aria-*` values). It fails on any
      return finer than the printed precision or any time finer than a UTC day, checking the named return, date and
      stat fields plus any 13-digit epoch, so ids raise no false alarm.
- [ ] `packPoints` output for a fixture with an odd return and a 14:31:07 close carries the rounded return and a UTC
      day. The scrub still opens the right one of two same-day closes.
- [ ] The average, interval bounds and headline sent to the client are rounded. Ranking and interval tests pass
      unchanged.
- [ ] The PR's fee-recovery probe states the smallest position size still at risk.

## Out of scope
- Private surfaces (Record tools, the trader's own views).
- Changing what is stored.

## Open questions
- None.

## Rework notes

## Build log
