# F-2 PR-5 + PR-6 · Business lead review of the UX lead plan

Date 2026-11-01. Reviewed: `plan-pr5-ux-lead.md` against F-2 (decisions of 2026-11-01, criteria 1-17), POLICY F1a,
F3, F6, P3/P6, A1, COMPLIANCE §1. The engineer's settled points (`traderPreference` keeps PR-4 semantics; the fade lives
in `viewerProfile`; personal ordering enters `loadFeedPage` as a loader option, with new guard cases) are not reopened.

**Verdict: SIGN**, with the 8 demands below as build conditions. I verify each in the committee user test. The plan
follows the owner's decisions where it counts: activity off by default, On and Off equally prominent, 90-day reads,
nothing deleted on a timer, hidden trades before scoring, and no number or ticker in any new line. Two gaps would
break a decision or a policy if built as written: demands 2 (an unremovable stored row) and 3 (a false ordering claim).

Demo sentence: "Follow, like or hide a few records and your feed reorders around them. Every choice fades out over
90 days, one Off switch gives you the order everyone gets, and your activity is never recorded unless you turn it on."

## Demands (priority order)
1. **Fix the plan text to match the settled engineer note.** §1's 4th bullet says PR-5 replaces `traderPreference`
   with the fade. It doesn't. Test: ordering reads likes and rejects only through `viewerProfile`. A like 91 days
   old changes nothing in `loadFeedPage` output, even though `traderPreference` still counts it unfaded.
2. **Every stored preference row stays visible and removable by the viewer (decision: "stored until the viewer
   removes it").** Q13 as written keeps a "Not interested" that ran its 90 days stored indefinitely, but no screen
   lists it, so only account deletion removes it. List expired ones on `/me/following` under one muted subheading
   "No longer applied", each with **Remove** (deletes the row). Test: an exclusion that expired 91 days ago shows on
   that list, Remove leaves 0 rows, and the purge never deletes it.
3. **The section's explain line must stay true.** "ordered by how much evidence each record has" holds only if
   relevance *chooses* the rows and evidence (the TR-9 lower bound) *orders* them, as `section.ts` does today. Test
   (C2/C8): within a personal section, row order equals the pool's evidence order for any profile. Otherwise
   change the copy before shipping. A false ordering claim is an FTC §5 and F1 ("documented method") problem.
4. **One quiet block above the first card, not two lines.** The order line, the hidden line and the existing
   explainer stack up at 360 px. Render the order and hidden lines as one muted paragraph: "Ordered using your
   follows, likes and hides. Change · 3 trades hidden by you. Show them". Keep the separate accessible names.
   Test: Playwright at 360×640, signed in with both lines present: the first card's headline is in the viewport
   without scrolling.
5. **Bound what one viewer can write.** Indefinite storage plus a public endpoint is unbounded growth (P3, COMPLIANCE
   §10). Cap at most 2,000 stored events per viewer per UTC day: extra events are dropped and get a 204. Keep the 2 s
   per-session limit in Postgres (no new infrastructure: the app has no cache), not in process memory. Tests:
   event 2,001 of a day stores nothing, and the rate limit holds across two route-handler instances.
6. **The Privacy Policy test can't pass trivially.** "Fails once the page has text" passes forever on a
   placeholder. Write it now as a named, visible skip (`todo: 'H4: Privacy Policy text'`) that asserts each
   `PREFERENCE_DATA` fact (storage until removed, 90-day use, activity opt-in, Clear) once the placeholder is gone.
   Test: the skip shows up in `npm test` output, and the test fails if the placeholder marker is removed while a
   fact is missing.
7. **The selected-state mark must not leak into the accessible name (A1).** "✓ " is visual only (`aria-hidden`),
   so names stay "On" and "Off", with `aria-pressed` carrying the state. Each button's name includes its group
   ("Personalize my feed: On") so screen-reader users hear which switch they changed. Test: axe passes, and
   `getByRole('button', { name: 'Personalize with my activity: On' })` resolves exactly once.
8. **Edit the feature file's criteria to match the owner's decisions; don't silently skip them.** Criterion 5 (the
   nightly 90-day delete) and the watchlist parts of 2 and 7 conflict with the 2026-11-01 decisions. The design
   session marks them superseded (see Q1) and the PR's test list maps each to its replacement (C5 amended, C16).
   Test: no criterion in the feature file asks for something a later dated decision contradicts.

## Open questions
- Q1 accept (the decision says "nothing is deleted on a timer"). Q2 accept: one screen with one job. Putting it on
  `/settings` would bury it next to account deletion.
- Q3 accept: Off stops use at once, and Clear stays one tap away. Q4 accept: minimum collection (P3). Q5 accept: the
  decision says "deletes at once", and the status line confirms.
- Q6 accept: an opening swipe is browsing, so counting it needs the opt-in. Q7 accept.
- Q8 accept as engineer-pinned constants in `weights.ts`, listed in the PR as awaiting the owner. A test pins that
  no implicit weight's absolute value exceeds an explicit one (passive signals never outweigh a like or a hide).
- Q9 accept, with demand 4's merge. Q10 accept: it's the viewer's own removal, and the like keeps its original date.
- Q11 accept with three edits. Block A "the section in it" becomes "its 'More like what you read' section". The order
  line drops categories the viewer has no signal in, so it never says "follows" to a viewer with no follows. Copy
  tests must cover the singular and plural hidden lines.
- Q12 accept: F1 requires the method to be documented. One paragraph on `/how`, built from the same constants.
- Q13 accept the storage rule, amended by demand 2 (listed and removable).

## Compliance spot check (COMPLIANCE §1)
1 Performance: no new numbers, disclaimer unchanged, sign invariance tested: holds. 2 Personal data: fields, access and
deletion are named. Demand 2 closes the one gap. 4 Tracking: first party only, opt-in, notice at the switch before
collection: holds. 9 Security: `/api/events` with demand 5. 10 Claims: no "AI", "smart" or "for you": holds. F6: likes
stay private, with no counts and no reward. H4 still gates real viewers.

## What would change my mind
If the C6 caps fail on 1,000 generated personal feeds, or the signed-out p95 regresses past 400 ms in PR-6, the
scoring is rejected, not tuned around the gate.
