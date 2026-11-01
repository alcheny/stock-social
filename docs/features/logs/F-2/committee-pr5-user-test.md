# F-2 PR-5/PR-6 · Committee user test (business lead + UX lens), 2026-11-01

Ran the built app (`next start`, ALLOW_DEV_AUTH=1, seeded DB) at 360×640 with Playwright, plus the PR's screenshots.
**Decision: usability FAIL, compliance PASS.** The reason: the "N trades hidden by you. Show them" and "Ordered using…"
paragraph is on the page but nobody can see it. The feed (`.feed`, globals.css:84) snaps every scroll to a card
(scroll-snap y mandatory), and `.feed-notes` (globals.css:446) is not a snap point, so the feed opens scrolled 104 px
down. Measured: the paragraph's rect is top −96, bottom −8, and `scrollTo(0,0)` snaps back to 104. Even at scrollTop 0
it would sit under the fixed nav (globals.css:73). The feed-notes and feed-personal screenshots show no line in light or
dark. The e2e passes anyway, because `toContainText` doesn't check visibility and `first.y < 640` is always true.
Demo sentence: "Hide a trade and the feed says so in one quiet line you can undo; turn activity on, then clear it in one tap."

## Journey 1: first-time trader (signed in via /login/dev)
- Hid the first card from its "…" menu: it left the feed. Looked for the promised line: **not visible**, so the hidden
  trade can't be found from the feed. The only path is Settings → Following and hidden → Hidden trades (3 taps).
- /me/hidden: the row and "Show again" work by keyboard, and the status line names the trader. The row wraps badly:
  "JNJ, closed Nov 1," / "2026 Trade page →". The 44 px link stretches the second line.
- /me/personalize: activity Off by default; On and Off are the same size, side by side, with ✓ and an outline (not
  color alone). On → "Activity is on. Recording starts now."; reading the feed stored 4 events; Clear →
  "Your activity is cleared." and 0 rows. The Off state (dark) shows the paused note. Clear and honest.
- Copy: the feed switch still says "the section in it" (lib/copy.ts:451). My Q11 edit ("its 'More like what you read'
  section") wasn't applied.

## Journey 2: first-time viewer, signed out, from a shared link
No `.feed-notes`, no "More like what you read" heading, 0 requests to `/api/events` after scrolling, and an anonymous
POST returns 204 and stores nothing. The order equals the signed-in cold start (e2e criterion 13), and the guard
db test reads no viewer table signed out. **Pass.**
## Business lead demands 1–8
1 Fade only via viewerProfile: delivered (db test "fade… the 91-day like is still stored"; committee decision 16).
2 Expired hides listed and removable: delivered (app/me/following/page.tsx "No longer applied" + Remove; db purge test).
3 Evidence orders the section: delivered (lib/discovery/f2-personal.test.ts:150; db test "rows read in evidence order").
4 One quiet block, first card in view: **contradicts the case.** It's one paragraph (app/feed-notes.tsx), but it's off
  screen and unreachable, and the test can't fail.
5 Write bounds: delivered (db test: 2 s refusal through a Postgres row lock, day cap 1,999 + 5 → 1).
6 Privacy todo: delivered (lib/discovery/f2-privacy.test.ts:12, named todo; it fails if the placeholder goes with a fact missing).
7 Accessible names: names and aria-pressed are delivered (e2e:42-47; ✓ is aria-hidden). Axe: **not delivered.** No e2e
  runs axe, and adding a dependency is the owner's call, so I waive it rather than demand it.
8 Superseded criteria marked: delivered (feature file criteria 2, 5 and 7 struck out with dates, plus Decisions).

## Compliance verdict: PASS
F1a: reasons describe the record or the viewer's own actions, and no security is suggested (criterion 9/17 tests). F3: the
disclaimer appears on every screen tested. F6: likes and the hidden count are private, and nothing reaches other viewers
(two-viewer test). P: activity is opt-in, with the notice at the switch before collection; Clear deletes at once; every
stored row is listed and removable; nothing is deleted on a timer. H4 (Privacy Policy) still gates real viewers. A1: the
switches pass, but the notes links take focus while hidden under the snap or the nav (WCAG 2.4.11), which is usability demand 1.
COMPLIANCE §1: no new numbers, first-party tracking only, events route bounded, no "AI"/"for you" claims.

## Usability verdict: FAIL. Demands, in priority order
1. **Make the notes paragraph visible on arrival.** Signed in at 360×640 with both lines, `.feed-notes` must be fully in
   the viewport below the nav (rect.top ≥ nav bottom; `toBeInViewport({ ratio: 1 })`) on load, and still be there after
   `scrollTo(0,0)`. The first card's ticker and return must also be in the viewport. Put it inside the first snap area
   (for example the first card's top band), not as a sibling of the snap rows. Verify: e2e at 360×640, light and dark.
2. **Replace the two always-pass assertions** (e2e/f2-personal.spec.ts:142 `y < 640`, and `toContainText` on
   `.feed-notes`) with visibility checks. Add: focusing "Show them" by keyboard leaves it unobscured (WCAG 2.4.11).
3. **Retake feed-notes-360 and feed-personal-360** (light and dark) so they show the line. The committee judges the screenshots.
4. **Hidden-trades row: keep "JNJ, closed Nov 1, 2026" on one unbroken line.** Use nowrap on the symbol and date, and put
   "Trade page →" on its own line with its 44 px target. Verify: at 360 px the date's text box has one line-box height.
5. **Copy fix in PERSONALIZE.feedExplain:** "the section in it" → "its \"More like what you read\" section". Verify: copy test.

Reviewer: approved demand 4 by reading the diff. Add the check: every "is shown" assertion uses a visibility matcher.
What would change my mind: none on demand 1. A line that can't be seen fails criterion 15's "persistent" line.
