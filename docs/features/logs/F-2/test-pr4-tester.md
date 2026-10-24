# F-2 PR-4 · Likes and gestures (tester)

2026-10-24. Branch `claude/peaceful-dirac-33bucv`, product code at `06b90b2` (diff `4741538..06b90b2`). Node 24.22.1, Postgres on
localhost:5432 (shared `stock_social` database). No product code changed.

Spec: `plan.md` → PR-4, as amended by the owner's O1, O3 (still open, default kept) and O4 in `F-2-personal-discovery.md`, and the
business lead's ruling in `committee-pr1b-business-lead.md` §5.

Setup: the production server already running on port 3000 (built from `06b90b2`, `ALLOW_DEV_AUTH=1`) was used as is, never
rebuilt or restarted. Two committee members used the same server and database at the same time. My fixture used the prefix
`zt4_` (40 traders × 5 fresh closes, accounts 60 days old). Three traders' sell ids contained a backslash, `\x41`, a trailing
`\` and non-ASCII text. My viewers were `zt4_v*`. Everything was removed after each run (0 `zt4%` users and 0 `zt4%` closes
left). The walk scripts drive Chromium with real touch events through CDP (`Input.dispatchTouchEvent`), as `e2e/likes.spec.ts`
does.

**Verdict: DEFECTS (0 Blocker, 1 High, 2 Medium, 3 Low).** Every deterministic check passes. The likes and the reject recognizer
behave as specified. Privacy holds everywhere I looked. The defects are in what happens after a reject: the Undo bar, where it
sits, and the liked list's layout.

## 1. Checks

| Check | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm test` (with DB) | **643 tests: 631 pass, 12 skipped (LOAD), 0 fail**. Count 643 ≥ 623. |
| Weakened? | The removed test lines (`git diff 4741538 06b90b2 -- '*.test.ts' e2e/`) are the restatements the business lead ordered in §5: the weights pin, the criterion-4 section case, `FEED_HIDES_UNFOLLOWED`, and "same order" → "same cards". The ROOTS list in `imports.test.ts` is a superset. No assertion was dropped. |
| `node scripts/autopilot.ts guard main` | ok |
| `node scripts/compliance.ts diff origin/main` | ok |
| `LOAD=1 … lib/sync.load.test.ts` | 5/5. Fleet: 500 traders × 2 accounts in 5,350 ms (bound 60,000). Heavy import 745 ms. |
| `LOAD=1 … lib/feed.load.test.ts` | 6/6. 50 heavy: page 1 p95 214 ms. Section signed out 188 ms, signed in 225 ms. **Own-late p95 398 ms against a 400 ms budget** (see Note 2). |
| `LOAD=1 … lib/follows.load.test.ts` | 1/1 |
| `npm run test:e2e` (full) | **87 passed, 1 failed, 32 skipped**. The 29 `connect.spec.ts` skips and 3 `signin.spec.ts` skips happen because the shared server has no vendor fake or sign-in providers configured (environment). The failure is `section.spec.ts:439` (PR-3 heavy use). Its section held a row `r3yx1q_0` from `similar.spec.ts`'s fixture, which runs in another worker and takes no feed lock. That is a pre-existing isolation problem, not PR-4 (Note 3). |
| e2e re-run: `section` + `likes` + `follow` | 11/12. `likes.spec.ts` passed **3/3**. `follow.spec.ts:23` timed out waiting for `dividend_dan` on page 1 while the section heavy fixture filled the feed; that test also takes no feed lock. `follow.spec.ts` alone: 3/3. |
| Screenshots | The e2e run rewrote the committed screenshots of PR-1 to PR-4. They were restored with `git checkout -- docs/features/logs/F-2/screenshots/`, and `git status` shows only `screenshots/pr4-test/`. |

## 2. Conformance (one row per PR-4 requirement)

| Requirement | Result | How |
|---|---|---|
| Double tap: two taps within 300 ms | PASS | A 250 ms gap likes. A 330 ms gap does not (and neither does 400 ms in e2e). Unit test: 299/300 ms. |
| … and within 24 px | PASS | Taps 20 px apart (16, 12) like. Taps 30 px apart do not. |
| Not on links, buttons or the chart | PASS | A double tap on the symbol link navigates to `/t/ZEV1` and writes no like. Taps on the heart toggle it as a button and never count as a double tap. The pane and its chart are outside `.card`, so `cardOf` ignores them. |
| Likes once; a second double tap never unlikes | PASS | Triple tap gives 1 row, pressed. Quadruple tap gives 1 row, still pressed. |
| `touch-action: manipulation`; outline to filled; no burst, animation, vibration or count | PASS | CSS sets it on the card. ♡ becomes ♥ with no transition. No `@keyframes` or `vibrate` was added. The heart has no text. |
| Tap-to-feedback < 100 ms | PASS | `aria-pressed` flips synchronously in the second tap's `pointerup` (about 0 ms; optimistic). |
| Like on a loss = like on a gain | PASS | Code path is sign-blind. Fixture losses were liked the same way. |
| Heart button: "Like. Only you can see likes.", `aria-pressed`, ≥ 44 px | PASS | 44.5 × 45.2 px at 360. Visible focus ring. Enter likes, Space unlikes, the feed does not scroll, and → still opens the pane from the heart. |
| Rapid heart taps | PASS | 5 taps in 200 ms, then 6 more bursts of 2 to 5 taps at 30 to 80 ms. The UI and the DB agree after every burst and after a reload. |
| Pressed state after reload, appended pages | PASS | `GET /me/liked` is called once per batch of new cards (6 calls in a long walk). A double tap on card 33 (page 2) likes it. |
| Private: no count or list anywhere public | PASS | Signed out, `/u/<h>`, `/u/<h>/pane`, `/u/<h>/pane-chart` and `/u/<h>/trade/<id>` contain no like words or `data-like`. The OG image is byte-identical with and without likes. `trade_likes` is named only in `lib/likes.ts`, `lib/delete.ts` and `lib/discovery/purge.ts`. |
| `/me/liked` | PASS | Signed out: `{"liked":[]}`. Another viewer asking for A's keys: `[]`. 70 keys plus garbage (`ZZ`, `../x`): 200. `Cache-Control: private, no-store`. |
| Signed out | PASS (with Low 2) | The heart shows one line, "Sign in to like records. Only you can see likes.", with a "Sign in" link. A double tap shows the same line. A reject-direction drag leaves the card unmoved (no tray, no "Hide this trade"). Nothing is written (0 non-GET requests). |
| `/me/following` "Liked records" with Unlike | PASS (with Medium 2) | The list shows the viewer's likes only. Unlike works with JS (e2e) and **without JS** (the form posts and the list re-renders, 2 rows → 1). Links to tricky sell ids resolve (`/u/zt4_t2/trade/zt4-trail%5C%233` → 200). Another viewer's list is empty. |
| Deletion removes `trade_likes` and `trade_rejects` the same day | PASS | Deleting a viewer through `/settings?confirm=1` → "Delete": 2 likes + 1 reject → 0 + 0 immediately. Deleting the trader: other viewers' likes and rejects of its trades → 0. |
| `trade_key` correctness | PASS | The column's expression equals `node:crypto` sha256 (UTF-8) on 2,024 ids. They include `a\b`, `\x41`, `\\`, `\001`, a trailing `\`, `\x`, `\xzz`, BMP and astral non-ASCII, tab, newline, quotes, a 5,000-char id and 2,000 random mixes. 0 mismatches, 0 errors. Through the UI, likes of cards with backslash/non-ASCII ids store exactly the sha256. `sell_id` is unique, so `trade_key` never collides (0 duplicates in the DB). |
| Reject swipe: past half commits | PASS | 55% at 360 and 375: the tray shows "Hide trade" mid-drag, the card drops, and 1 row is written with `until − created_at` = 90.0 days and the right trader. |
| Under half snaps back | PASS | 45% snaps back with `transform .2s ease-out`. Under reduced motion it snaps back with no transition. |
| Not while a pane is open, not within 400 ms after close | PASS | Straight back from the pane, then an immediate 70% drag: no reject. The return took 190 ms, then 250 ms more, then a 70% drag: no reject. After 400 ms the drag works again. |
| Diagonal scrolls | PASS | dx 0.6w, dy 0.45w (ratio 1.33): no reject. dx 0.6w, dy 0.25w (ratio 2.4): commits. A start 9 px right then mostly vertical: no reject. A two-finger drag: no reject. |
| Opening swipe still opens the pane, writes nothing (SW-1) | PASS | `scrollLeft` = row width; 0 rejects, 0 exclusions. |
| "Hidden for 90 days." + Undo, `role="status"`, 5 s | **FAIL (High 1)** | The text, the role and focus on Undo are right. Undo restores the card. Fast reject → Undo three times, and Undo while the reject request is still in flight (800 ms latency), all end with no running row and the card shown. **After a swipe the bar never closes.** |
| Only that trade; the trader's other cards stay | PASS | The trader's other cards keep `display: flex`. The next page 1 omits the rejected card and keeps the trader's other card. |
| Trader −1 for 90 days | PASS | The row stores `trader_id`. `prefRows` caps the trader part at `created_at + 90 d` and ends it at Undo (unit tests in `prefs.test.ts`, `feed.prefs.test.ts`). |
| O4: unfollow never hides; ranks below an identical trader; equal after 90 days | PASS | UI: Follow then unfollow from the pane writes an `unfollow` row, and after a reload the trader's cards are all displayed (page 1 held 2 of its cards before, 1 after: a slight demotion, no hide). Twin ordering and the 90-day equality are covered by `lib/feed.prefs.test.ts` (it passes). |
| Own cards | PASS | Signed in as a fixture trader, its own cards carry no heart, no "Hide this trade" and no tray. |
| No event table | PASS | The schema diff adds only `trade_likes` and `trade_rejects` (plus the generated column). The only `*event*` table is the F-1 `funnel_events`, which predates PR-4. No request to `/api/events` was made in any walk or e2e test. |
| No celebration (F6) | PASS | Nothing animates or counts. Liking is silent apart from the icon. |
| Swipe during paging | PASS | I held a reject drag on card 25 while page 2 appended, then released it past half: the held card was rejected, rows went 30 → 60, no duplicate keys. A card on page 2 (row 33) can be liked and rejected. |
| No page errors | PASS | 0 `pageerror` across the walks |

## 3. Findings

### High 1. After a swipe reject, the Undo bar never closes (it should last 5 s)

After a reject by swipe, `FeedHides` focuses Undo programmatically. Chromium then gives Undo `:focus-visible`, because no click
moved focus first. `paused()` treats `:focus-visible` as keyboard focus, so the 5 s timer is cleared and never restarted. The
bar stays open with a focus ring:
- it stayed for 16 s in my test, and for another 6 s after I swiped on to the next card;
- a tap on the card body first does not change this;
- tapping "Hide this trade" instead closes it at about 5 s, as specified.

While it is open it covers the next card's heart and "Hide this trade" (see Medium 1).

Reproduce (375 × 800, touch):
1. Sign in and open `/`.
2. Drag the first card right by about 60% of its width and release.
3. "Hidden for 90 days. Undo" appears with a focus ring on Undo. Wait 15 s: the bar is still there. Swipe up to the next card:
   the bar is still there.

Evidence: `screenshots/pr4-test/bar-stays-after-swipe-375-light.png`. The walk at 360 and 375 polled every 500 ms: open for the
whole 16 s.

The section-row swipe from PR-3 goes through the same `FeedHides` focus and pause code and probably behaves the same. My fixture
produced no section, so I did not verify it.

### Medium 1. Undo lands exactly under "Hide this trade", and the bar covers the next card's actions

When a card is hidden, the next card takes its place, so its footer sits where the previous one was. The fixed bar
(`bottom: 16px`) covers exactly that footer:
- at 375 the hide button spans y 726 to 771 and Undo spans y 731 to 775, with `elementFromPoint` at the hide button's centre
  returning Undo;
- the heart sits under the bar's text.

Results:
- **A double tap on "Hide this trade" hides and then immediately un-hides the trade** (0 rows, bar gone).
- Hiding two trades in a row with the button undoes the first one.
- A tap aimed at the next card's heart lands on the bar and pauses it.

Combined with High 1, after any swipe reject the next card's like and hide buttons cannot be reached until the user taps Undo.

Reproduce (360 or 375, touch, signed in): on `/`, tap "Hide this trade" twice about 120 ms apart. The card returns and no
reject is stored. Evidence: `hide-then-undo-under-finger-375-light.png`, `dt-hide-375-*.png`.

### Medium 2. "Liked records" rows cut off the handle (whose record it is)

The link text "SYMBOL · closed Mon D, YYYY · @handle" is in a `.people .who-col a`, which is `display: flex` with
`white-space: nowrap; overflow: hidden`. `text-overflow: ellipsis` has no effect on a flex container's text, so the row is cut
off with no "…":
- at 375 it reads "ZCN3 · closed Oct 24, 2026 · @zt";
- at 360 the link's `scrollWidth` is 288 against a `clientWidth` of 241 with a 6-character handle;
- a 20-character handle is never visible.

The Unlike button's accessible name carries symbol and handle, so screen readers are fine. Sighted users cannot tell whose record
each row is.

Reproduce: like any card, then open `/me/following` at 360 or 375. Evidence: `liked-list-375-light.png`, `liked-list-360-*.png`.

### Low 1. Without JavaScript the heart and "Hide this trade" are inert

Signed in with no JS, both are `type="button"` with no form: a click writes nothing and nothing happens. Signed out with no JS,
the heart does nothing and the sign-in line stays `hidden`. PR-2's Follow posts a form without JS, and the liked list's Unlike
works without JS.

Reproduce: disable JS and open `/`, signed in or out. Tap the heart, or "Hide this trade": no request is sent.

Suggestion: hide them until hydration, or post a form.

### Low 2. The signed-out "Sign in" link does not look like a link and does not return

`.card footer a { text-decoration: none }` also applies to the new "Sign in" link. It renders in body-text colour with no
underline, under a sentence of the same colour (`signed-out-like-360-dark.png`). It goes to `/login` with no return, so after
sign-in the viewer lands on their own profile, not on the card they wanted to like.

Reproduce: signed out at 360, tap the heart on the first card.

### Low 3. "Liked records" stops at 200 with no paging

`ownLikes` has `limit 200`. A viewer with more likes cannot see or unlike the older ones from the only list that shows them. The
copy makes no completeness claim, so this is not a policy problem.

Found by reading the code (`lib/likes.ts#ownLikes`), not run. Reproduce: insert 201 likes for one viewer and open
`/me/following`: 200 rows are expected.

## 4. Notes (not defects of this PR)

1. **Trader part of a reject: −1, not −4.** The business lead's §5 wording mentions "the trader-level −4 that a trade reject also
   applies". The engineer followed the owner's later O1 text ("a slight negative preference"), using −1 for 90 days. The committee
   should confirm this explicitly (decision 2 in the engineer's log).
2. **Feed load margin.** The own-late case's p95 was 398 ms against a 400 ms budget. It passed, but the engineer saw 410 ms once.
   PR-4 did not change that case, but it is one noisy run from failing.
3. **e2e isolation, pre-existing.** These insert feed-eligible traders without taking `feedLock`, and broke other tests in this
   shared-database run:
   - `e2e/similar.spec.ts` (PR-3b);
   - `e2e/follow.spec.ts:23`.

   Each passes alone. A follow-up could give them the shared lock.
4. 32 e2e skips are environmental: the shared server on port 3000 has no vendor fake or sign-in providers.
5. With the keyboard, the offscreen pane's controls ("← Back", Follow, "…") follow "Hide this trade" in the Tab order. That has
   been true since PR-1/PR-2 and is not new here.

## Screenshots (`screenshots/pr4-test/`, 360 and 375, light and dark where useful)

- Likes: `card-liked-360-*`, `kbd-heart-focus-375-light`.
- Reject: `reject-mid-drag-{360,375}-*`, `reject-undo-bar-{360,375}-*`, `kbd-undo-375-*`.
- Defects: `bar-stays-after-swipe-375-light` (High 1); `hide-then-undo-under-finger-{360,375}-light` and `dt-hide-{360,375}-*`
  (Medium 1).
- Liked list: `liked-list-{360,375}-*` (Medium 2), `liked-list-nojs-360-light`.
- Signed out: `signed-out-card-360-*`, `signed-out-like-360-*` (Low 2).

## Cleanup

- Every `zt4_*` user and close was deleted (cascades remove their likes, rejects and exclusions). A check found 0 left.
- The database `stock_social_f4` and other worktrees were not touched.
- The server on port 3000 was not restarted.
- Committed screenshots of other PRs that the e2e run rewrote were restored.
- Walk scripts are in my scratch directory, not in the repo.
