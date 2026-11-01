# Fixes cycle 2, trust rows: committee log (2026-11-01)

Source: `docs/ideas/approval-2026-11-01-cycle2.md` "Fixes to build now". Branch `claude/fixes-cycle2-trust`.
Rows: #2 (first), #1, #4, #5, #8, #11, #19, #20, #21, #22, #24, #27, #28. #29 dropped (already fixed).
Roles (fresh-context subagents): UX lead (plan, `plan-ux-lead.md`), business lead (`plan-review-business-lead.md`),
engineer (`plan-review-engineer.md`), tester (`qa.md`), user tests (`user-test.md`), code reviewer (`code-review.md`).

## Plan round 1
UX lead drafted; business lead and engineer both SIGNED with demands. Every open question was decided by the
committee's recommended option, by majority where two roles disagreed. Decisions (all 2026-11-01, decided by the
committee under the owner's instruction of 2026-11-01):

1. Disclaimer at body size (`muted`), not `small`. Why: "plain view" is the legal bar (all three agreed).
2. Compare page: one disclaimer after each non-empty column's figures. Why: UX lead and engineer (2 of 3) — at 360 px
   column B's figures are a screen below column A; the business lead preferred one above the grid. The guard's rule is
   therefore "every marked line has the exact text, the one nearest the first figures shares one screen with them".
3. /me/likes: the line under the private note, before the list, always. Why: UX lead and engineer (2 of 3) — one code
   path, beside the first figures.
4. Profile: the line after the headline group's `.evidence` block. Why: keeps F-6's unrealized grid directly under the
   realized one (TR-4).
5. Feed `/`, pane routes, trade and month pages and all three images stay `pending` (owner F-10 or F-12) and run under
   `test.fail()`. Why: the orchestrator assigned those files to F-10/F-12; `test.fail()` makes their PR move the entry
   the moment it adds the line (engineer's demand), which answers the business lead's demand 1 without editing their
   files. The business lead's alternative (add the line to the feed here) is outside this session's files.
6. "Beside" is direction-independent: span from the higher top to the lower bottom of figures and line ≤ screen height
   between fixed bars; uncovered is checked with `elementFromPoint` at five points after an instant centre scroll, after
   fonts are ready and the network is idle. Why: engineer and business lead demands.
7. Image routes are checked for 200 + PNG and, statically, for rendering `DISCLAIMER` from `lib/share.ts`. Why: a pixel
   check needs OCR, a new dependency (ponytail; F-12 owns the 22 px raise).
8. The route walker also covers icons, manifest, parallel slots and intercepting routes; a stale table entry fails.
9. #1 wording: "verified" only when every trade is verified (`tradesWord`), demo data is "Demo" (one state name),
   title "NVDA demo trades". Explainer: "Closed trades in this stock, newest first. Fewer trades means a wider range."
   (business lead: no "Percentages only" claim). Why: POLICY F3a/P2.
10. #4: `lib/visible-users.ts` (`visibleUser(alias)`, `visibleUserIds()`, `isVisibleUser`) used by every stock query,
    the stock image's query and the sitemap; F-16 extends it with "hidden". The stock image query stays in this PR
    (row 4 names it; F-12 owns the strip and size). A source scan requires the predicate in every `closed_trades` /
    `open_positions` statement under `app/t/**` and the sitemap; one helper per statement suffices (the overlap query's
    outer rows come from the filtered subquery — engineer). `lib/feed.ts` keeps its own filter (F-10's area): F-16 note.
11. #5: join card says only what stays private ("Read-only broker connection. Sizes, prices and balances stay private.
    18+."); the share prompt builds its public line from `PUBLIC_FIELDS` plus handle, display name and reasons.
    Why: business lead demands 3-4 (no second hand-kept list).
12. #8: claims copy "…can belong to one profile, ever, so two profiles never share an account."
13. #11: "Choose two stocks…", "Choose two different stocks…", "Choose up to two rules…", "Your next sync will include
    them.", "Hold time alone doesn't explain the results."
14. #20: invalid symbol → `notFound()` (real 404, `app/not-found.tsx`, title "Page not found · Stock Social"); a valid
    symbol with no trades stays 200 + noindex.
15. #21: distinct static titles on /login, /login/sent, /login/dev, /connect, /connect/consent, /connect/continue,
    /connect/result, /terms, /privacy; a unit test requires a title export on every page and no repeated static title.
16. #22: thesis links go to `/u/<handle>/trade/<sell_id>`.
17. #24: the compare evidence prints `evidenceLine` once.
18. #27: schema and action comments say what the column records (first completed "Share my record" share).
19. #28: `nav` added to `REFERRED_SURFACES`; owner feedback label "the sign-in link on your pages".
20. #19 in this session's files only (stock page, theses, compare, likes, /me/record), via `toneClass` from
    `app/open-rows.tsx`; F-19 moves `tone` to `lib/format.ts` in parallel (note at the import).
21. #30 (dead `.badge-embed` CSS) not built: `app/globals.css` belongs to the a11y session; handed to it.

## Owner flags (not cleared here)
- `CONSENT_SCOPE_LINE` (owner copy) doesn't name handle, display name or published reasons, which are public (P6
  "exactly"). Proposed prefix: "Public: your handle, display name, any reasons you publish, percent returns, …".

## Re-scope by the orchestrator (2026-11-01, after plan round 1 and the first build)
The orchestrating session reported an overlap: branch `claude/fix-truthful-labels` already builds the route-tree
disclaimer guard, the plain-view disclaimer, #1 and the copy across `app/t/**`. This branch was trimmed in a new commit
(history kept; the first build, including a working guard spec, is commit 9bf8b73 for reference):
- **Dropped here (built on `claude/fix-truthful-labels`):** #1, #2 (guard and plain-view disclaimer, decisions 1-9 above
  move with it), #8's `app/t/page.tsx` part.
- **Built now:** #4 (`lib/visible-users.ts`; used in the stock page's four queries, the stock index's two, the sitemap),
  #5, #8 (`lib/claims.ts`), #11 (`lib/ticker.ts` "Choose two stocks…", `/me/record`), #19 on `/me/likes` and
  `/me/record` only, #20 (`app/not-found.tsx`), #21, #27, #28, #30 (dead `.badge-embed` CSS; re-assigned here).
- **Later, after `claude/fix-truthful-labels` merges (follow-up on this branch):** #4 in `app/t/compare/page.tsx`,
  `app/t/[symbol]/opengraph-image.tsx`, `app/t/open-positions.ts` (listed as PENDING_VISIBLE with a ponytail in
  `lib/fixes-cycle2-trust.test.ts`); #11 HoldTime "not a signal"; #20 `notFound()` for invalid tickers; #22 thesis links
  by sell_id; #24 compare "too early" twice; #19 in `app/t/**`.
- 2026-11-01: `app/not-found.tsx` sets no robots tag of its own. Why: decided by the committee under the owner's
  instruction of 2026-11-01; Next.js adds noindex to the 404 page itself, so a second tag only duplicated it.

## QA, review and user test (2026-11-01)
- Tester round 1 (`qa.md`): 1 Medium, 6 Low. Fixed: /me/record said "verified closed trades" on a demo record (now
  "closed trades (including demo data)"); average win/loss toned by sign; PENDING_VISIBLE fails once a listed file adopts
  the predicate. Left as noted: real-referrer `via=nav` e2e (unit-tested), dynamic-title duplicates (generateMetadata).
- Code review round 1 (`code-review.md`): nothing blocking; 4 non-blocking fixed (predicate and 404 comments now say
  what is pending, with ponytails; #19 check survives F-19's move; the DB test removes its attempts and funnel rows).
- User test round 1 (`user-test.md`, UX lead + business lead, 360 px, both personas): every item compliant; 2 usability
  demands fixed: the share prompt reads as one list (", and …. Losses are included."), the 404 links are 44 px targets.
  Out-of-scope observations passed to the orchestrator: nav link height and handle truncation (a11y session), "verified"
  titles on demo stock pages (`claude/fix-truthful-labels`, #1), 35 px chart range buttons.

## Follow-up PR 1 (branch `claude/fixes-cycle2-trust-2`, after #59 merged as 3f216ba)
Orchestrator's review nits (3) and (4), built before the labels branch merges:
- 2026-11-01: a join button's surface is never 'nav' (`CtaSurface`, `ctaVia` maps nav → profile). Why: decided by the
  committee under the owner's instruction of 2026-11-01; with #28 a hand-typed `/u/x?via=nav` attributed the profile's
  own join button to the nav. Only the nav link (app/nav-login.tsx) sends nav.
- 2026-11-01: a missing profile's `generateMetadata` calls `notFound()`. Why: decided by the committee under the
  owner's instruction of 2026-11-01; the new e2e found the 404 inherited the site's default title ("Stock Social")
  instead of "Page not found". Its share preview says "Page not found" and its card image link is a 404.
Nits (1) and (2) (compare and stock image onto the predicate, HoldTime "not a signal") wait for
`claude/fix-truthful-labels` (`app/t/**`).
