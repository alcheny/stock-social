# F-13 · First-visit line and the swipe hint

Status: built

## Why
A signed-out first visitor sees a stock and a percentage with no idea what the product is. The SW-1 first-run hint
("Swipe ← for profile"), a DESIGN Stage 5 Must, is missing. The idea board decided D27 (`docs/IDEAS.md`,
2026-11-01), and the go-to-market decision lists it as a week-0 item. Approved by the approval council
(`docs/ideas/approval-2026-11-01.md`, C6: second-vote mean 3.87, final vote 15/15).

## Decisions
- 2026-11-01: D27, verbatim: "signed-out first visits get one dismissible line, 'Verified trades, straight from the
  broker. Losses included.', linking to 'How records are calculated', never a modal; the 'Stocks' nav item becomes
  'Trades by stock'; bounce and pane-open rate are measured before and after." Why: decided by the idea board; approved
  for build by the approval council.
- 2026-11-01: SW-1 first run, verbatim: "the first card shows a subtle 'Swipe ← for profile' hint once (remembered on
  the device), gone after the first swipe." Why: DESIGN Stage 5 Must.
- 2026-11-01: While any record shown is demo, the Demo badge sits in the same viewport as the line, at equal weight.
  Why: approved by the approval council. Without the badge the line overclaims on demo-only data (POLICY F3a, P2);
  legal and common sense would veto it.
- 2026-11-01: The line and the hint render and can be dismissed with storage blocked. Storage access is wrapped, and
  the fallback is a cookie-free, session-only dismissal or the server render. The line is inline, never an overlay,
  and never covers the card, its link or focus. Why: approved by the approval council (reliability, accessibility).
- 2026-11-01: No before/after effect is claimed until the privacy-safe counters exist (C17, waiting). D27's
  measurement runs when they land. Why: approved by the approval council; C17 was not approved this cycle.
- 2026-11-01: If F-7 public profiles enter the feed, the line becomes false for them. It then goes back to the idea
  board for new wording, which the council may not change. Why: the decisions keeper's F-7 interface condition.

- 2026-11-01 (build, after F-10 #54 and its follow-ups #60 merged): the line sits inside page 1's first card, in its
  thesis slot, and stands in for the thesis excerpt until it is dismissed (the thesis stays on the trade page and in the
  pane). Why: F-10 requires card 1's return, record strip and disclaimer on the first 360×640 screen with 15% headroom
  (its e2e); a block above card 1, or an extra block in it, broke that budget. The Demo badge sits inline with the line and
  "Demo records are marked Demo." is screen-reader text (the business lead's committee F1 fallback). The swipe hint follows
  the design system council's slot rule: it waits while the line shows and appears on card 1 after dismissal (or on a later
  visit), on the footer link's line. On short screens (≤ 480 px tall), while the line shows, card 1's symbol and return are
  smaller. Decided in the build (F-10 budget conflict); the owner may revisit the trade-off.
- 2026-11-02: The owner accepted OD 2.37: the first-visit line becomes "Closed trades imported read-only from
  connected broker accounts. Losses included." (fixes-list item F6-4). The pin test changes its expected value. Why:
  the owner's decision of 2026-11-02 (OD 2.37); POLICY F3a (the old line called demo cards verified).

## Acceptance criteria
- [ ] Signed out, the first visit shows exactly "Verified trades, straight from the broker. Losses included." linking to
      the "How records are calculated" page. It never shows signed in, and it stays dismissed after dismissal (e2e).
- [ ] While the feed shows any demo record, the Demo badge is in the same 360 px viewport as the line (e2e).
- [ ] The first card shows "Swipe ← for profile" once. It is gone after the first swipe or → key and not shown again
      on that device (e2e).
- [ ] With storage blocked, both render, can be dismissed for the session and throw no error (e2e with storage
      disabled).
- [ ] The dismiss control is a labelled button reachable by keyboard. The line never covers focused content or the
      card link (WCAG 2.4.11). There is no animation under `prefers-reduced-motion` (e2e).
- [ ] The nav item reads "Trades by stock" (e2e). Every other nav test still passes.
- [ ] No modal and no overlay over the card (DOM test).
- [ ] No new cookie (POLICY P6; `lib/privacy-cookies.test.ts` still passes) and no third-party tracker.

## Out of scope
- Measuring bounce and pane-open rate (waits for C17), the sign-in paths (D21, waiting) and other copy changes.

## Open questions
- Owner item (2026-11-01): the design system council (PR #48, `docs/direction/design-system-2026-11-01.md` §2.5 R5)
  proposes the line "Closed trades imported read-only from connected broker accounts. Losses included." because D27's
  sentence calls demo cards verified and "straight from" hides that Stock Social calculates the returns (POLICY F3a). D27
  is a decided line, so it ships verbatim until the owner or a council amendment changes it. The build uses that
  council's labels for the parts D27 does not fix: "Demo records are marked Demo." beside the Demo badge, the link "How
  records are calculated →" and the dismiss name "Dismiss this note".
- Resolved 2026-11-01: the design system council's slot rule is built (the hint waits until the line is dismissed).

## Rework notes

## Build log
- 2026-11-01: Merged to main in #55 (92d03f4) by the orchestrator session; Status set to built (the pipeline sets it in its own PRs; interactive builds did not), so the feature pipeline does not pick it up as ready again. Waiting for the owner to try it.
