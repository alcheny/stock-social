# Direction councils: market research, creative direction, design direction

Three standing councils give the product its outside view (market), its voice and look (creative) and its
experience (design). Each is a large committee of separate agents with fresh context, working in several passes,
using research with sources rather than opinion where facts exist. Their output is direction and proposals; code
still goes through the committee cycle (`docs/IMPLEMENTATION.md`), and every proposal that becomes a decision
goes through the idea board's consistency check first (`team/idea-board.md`).

Rules for all three: POLICY binds (no third-party names except integrated vendors, so competitors and products
are described generically: "a copy-trading app", "a single-line scrubbable price chart"; no advice; adults only;
no rewards for trading activity). Research is cited with sources; anything not verified is labelled. Nothing
invented is presented as real data: no fabricated quotes, survey numbers or user interviews. Simulated users
(persona walkthroughs) are labelled as simulations.

## Market research council

**Members:** market sizing analyst, competitive landscape analyst (patterns, not names), user researcher
(persona walkthroughs, labelled as simulations; public forum and review themes summarized with sources),
pricing analyst, distribution and growth analyst, regulatory-market analyst (what rules shape the market),
data analyst (the projection dashboard's assumptions), red team, fact-checker, chair.
**Passes:** (1) independent desk research with sources; (2) cross-examination: each member challenges two
others' claims; (3) fact-check of every number and claim the conclusions rest on; (4) synthesis by the chair;
(5) red-team pass on the synthesis and a final revision.
**Output:** `docs/direction/market-<date>.md`: segments and their jobs to be done, size estimates with ranges and
sources, the competitive pattern map, willingness to pay, channels, risks, the assumptions behind the week-8 kill
gates, and the cheapest tests to run first.

## Creative direction council

**Members:** brand strategist, copy lead (voice and tone), visual identity designer, motion and interaction
stylist, accessibility specialist, trust and safety reviewer (claims, scams, impersonation), legal reviewer
(POLICY T1 to T3 trade dress and trademarks, F2 claims), growth marketer (share card and links), red team, chair.
**Passes:** (1) audit of everything the product says and shows today (lib/copy.ts, every page, the share card,
the emails); (2) independent proposals for positioning, voice, naming rules and visual identity; (3) a judge
panel scores the proposals against the product's promise ("public, verified trading records"), POLICY and
accessibility; (4) synthesis of the winner with the best of the runners-up; (5) red-team and legal pass.
**Output:** `docs/direction/creative-<date>.md`: positioning line, voice and tone rules with do and don't
examples drawn from the real copy, a copy fix list (file and line), visual identity direction (color, type,
iconography within the built-in fonts unless the owner approves one), and share-card direction.

## Design direction council

**Members:** product designer, interaction designer (swipe feed, panes, gestures), data-visualization designer
(charts: DESIGN CH-1 and CH-2, percent only, 0% on the axis), mobile and responsive specialist (360 px first),
accessibility specialist (WCAG 2.2 AA), trust and record-integrity designer (TR-1 to TR-9), information
architect, design-systems engineer (tokens in app/globals.css), red team, chair.
**Passes:** (1) a full walkthrough of the running app on every route, at 360 px and 1,280 px, light and dark,
signed out and signed in as trader and viewer, with screenshots; (2) independent heuristic reviews by lens;
(3) cross-review and deduplication; (4) severity and effort ranking by a panel; (5) the chair's direction and a
red-team pass.
**Output:** `docs/direction/design-<date>.md`: principles, the issue list with severity, route, screenshot
and proposed fix, the design-system direction (tokens, spacing, type scale), and proposals for new features
written in the feature-file shape for the owner or the delegated process.

## What happens to proposals

Each council files its record in `docs/direction/` and adds its proposals to `docs/IDEAS.md`. The idea board
checks each one against existing decisions and common sense; adopted proposals become feature files (numbered by
the orchestrator, never by a council, so parallel councils do not collide) and go through the committee cycle.
