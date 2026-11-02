# F-23 · Public payloads carry no more precision than the screens show

Status: built

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
- 2026-11-01: The wire helpers live in `lib/public-wire.ts` (`wirePct`, `wireHold`, `wireRate`, `wireDay`, `isoDay`,
  `isoHour`, `numericDay`), not in `lib/format.ts`. Why: decided by the committee under the owner's instruction of 2026-11-01; F-19's shared file stays untouched and one import is the contract.
- 2026-11-01: `wirePct` chooses the value from the prints alone: the 1-decimal percent; the fixed stand-in n.46% (n.54%
  where float error misprints the literal) when the 1-decimal value would move the 0-decimal print of the chart's
  accessible name; one fixed value for the "≈-100%" band; else the shortest decimal printing as stored (the extra digits
  pct() prints near -100%). Why: decided by the committee under the owner's instruction of 2026-11-01; a value derived from the prints says nothing the screen does not.
- 2026-11-01: Dates go out as UTC days and are printed in UTC (`numericDay`, `dateText`), not rebuilt at 12:00 UTC. A
  viewer whose local day differs from the UTC day now sees the UTC day in the pane rows and the chart's scrub line and
  sheet (a date, not a figure, tone or Flat label). Why: decided by the committee under the owner's instruction of 2026-11-01; the noon rebuild is wrong at UTC±12–14 and the server already
  prints UTC days; listed for the owner.
- 2026-11-01: Same-day closes keep an integer day on the wire; the browser spreads the k-th of m points of a day at
  (k+1)/(m+1) of it, and range ends decode to the first day's start and the last day's end. Why: decided by the committee under the owner's instruction of 2026-11-01; a shared x let a drag
  reach only one of the pair; the spread reveals only the order the list shows.
- 2026-11-01: The payload format is `PAYLOAD_V = 2`, in the URL (`?v=2`) and the body (`v`); the bare `/pane` and
  `/pane-chart` URLs answer 404 no-store, and a body of another version is a failed load. Why: decided by the committee under the owner's instruction of 2026-11-01; an open tab with
  pre-change code shows "could not be loaded" instead of misreading the new body, and no cache key holds an old body.
- 2026-11-01: Status-line `<time dateTime>` values carry a printed date's UTC day; a relative time ("2 hours ago", live
  pages) carries its UTC hour. This is the one named exception to "no time finer than a UTC day": account and sync
  instants, which carry no trade data, at the precision the line prints. Why: decided by the committee under the owner's instruction of 2026-11-01; the business lead required a named
  carve-out, not a silent one.
- 2026-11-01: The profile chart is packed on the server at full resolution (`profileChart`): every figure from stored
  values, the browser compounds nothing. Measured: the 2,828-close profile is 269 KB against the 400 KB budget, so no
  fallback; lazy range loading on the profile is out of scope. Why: decided by the committee under the owner's instruction of 2026-11-01; rounded points compounded in the browser would move
  printed totals and scrub values.
- 2026-11-01: The `/pane` body is `{ v, state, model, chart, status, options }`; `paneModel` (`lib/pane-model.ts`)
  computes every printed pane figure from stored values, and the feed renders its pane from the same function. Why: decided by the committee under the owner's instruction of 2026-11-01;
  only a server model keeps the pane headline equal to the profile's on a rounding edge.
- 2026-11-01: Existing assertions that pinned the old precision are replaced by the F-23 contract, each at least as
  strict, none deleted (list: `docs/features/logs/F-23/committee-2026-11-01.md`, decision 10). Why: decided by the committee under the owner's instruction of 2026-11-01; the council
  decision itself changes what they pinned.
- 2026-11-01: Closes at the same instant run in list order in the chart (the last key step is the list's top row), and
  one UTC day's closes drawn under 2 CSS px apart are one pointer target, the newest. Why: decided by the committee under the owner's instruction of 2026-11-01; the user test found the chart
  and the list disagreeing on two of three demo records (the council's scrub condition, DK).
- 2026-11-01: When no range is downsampled, the chart goes out in a compact form (`sfx`: ALL as [day, value] pairs, row
  indices from position, dated ranges as values only) that decodes to exactly the regular form. Why: decided by the committee under the owner's instruction of 2026-11-01; the tester measured
  a dense 4,700-close profile at 445 KB against the 400 KB budget; this is the business lead's allowed fallback (a).
- 2026-11-01: A drawdown goes out rounded as it prints (negated: `-wirePct(-dd)`); near -100% a wire return comes from
  the printed digits plus at most one; a chart whose closes fall on one UTC day prints one end date. Why: decided by the committee under the owner's instruction of 2026-11-01; the
  independent code review and the user test.
- 2026-11-02: Above ±100%, the cumulative figure prints at about 3 significant figures. The public payload carries no
  more precision than that print (this feature's rule). The F-23 session builds it as a follow-up; that session sets
  the status. Why: the owner's decision of 2026-11-02 (chart precision).

## Acceptance criteria
- [x] For a fixture with an odd return and a 14:31:07 close, `/pane`, `/pane-chart` and the feed HTML contain no return
      finer than the printed precision and no time finer than a UTC day (response test).
- [x] `unrealized_pct` and `openAsOf` are covered by the same test.
- [x] The pane headline equals the profile headline for the same record, including a value on the rounding edge
      (parity test).
- [x] Two closes on the same day keep their order in the chart and the scrub opens the right trade (e2e or unit).
- [x] A snapshot shows no displayed figure, tone or Flat label changes on profile, pane and feed.
- [x] Ranking and confidence-interval tests pass unchanged (computed on stored values).
- [x] The public cache key changes with the payload format, so a pre-change cached body is not served.

- [x] One test scans every signed-out response on the profile, pane, pane-chart, feed, trade and month pages (HTML, RSC
      flight including `?_rsc=`, JSON routes, OG alt, accessible names, `data-*` and `aria-*` values). It fails on any
      return finer than the printed precision or any time finer than a UTC day, checking the named return, date and
      stat fields plus any 13-digit epoch, so ids raise no false alarm.
- [x] `packPoints` output for a fixture with an odd return and a 14:31:07 close carries the rounded return and a UTC
      day. The scrub still opens the right one of two same-day closes.
- [x] The average, interval bounds and headline sent to the client are rounded. Ranking and interval tests pass
      unchanged.
- [x] The PR's fee-recovery probe states the smallest position size still at risk.

## Out of scope
- Private surfaces (Record tools, the trader's own views).
- Changing what is stored.

## Open questions
- None.

## Rework notes

## Build log
- 2026-11-01: Built on `claude/f23-payload-precision` after F3-2 (#85), F-26 (#87), F-11 (#85) and F-20 (#77) merged.
  Committee record: `docs/features/logs/F-23/committee-2026-11-01.md` (plan `plan.md`, inventory `inventory.md`, probe
  `probe.md`). Tests: `lib/f23-public-wire.test.ts`, `lib/chart-series.f23.test.ts`, `lib/pane-model.test.ts`,
  `e2e/f23-display.spec.ts`, `e2e/f23-payload-scan.spec.ts`. QA clean after one Medium (dense profile size) was fixed;
  independent review findings fixed; business lead and UX lead user tests: compliance pass, usability demands fixed.
