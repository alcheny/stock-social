# F-2 PR-2 · Follow and "not interested" (tester)

2026-10-23. Branch `claude/adoring-euler-4469ys`, product code at `c477cab`. The two later commits (`9faf66e`,
`c0bbdd3`, the business lead's and UX lead's verdicts) change docs only: `git diff c477cab HEAD -- app lib e2e scripts db`
is empty. Postgres 16, Node 22.22 (`CLAUDE.md` asks for 24 or later). No product code changed.

Isolation: all checks and the walk ran on my own database, `ss_tst_pr2`, created from the shared server and dropped at the
end. Another session was running `next start` on port 3110 from the shared checkout, so the build, both e2e passes and my
server ran from a copy of `HEAD` in my scratch directory, with its own `.next`. `npm test`, the guard and the compliance
diff ran in the checkout.

**Verdict: DEFECTS.** There are 3 Low defects and no blocker. Everything the plan and the feature require of PR-2 holds:
- follows stay private;
- the 90-day exclusion and its boundaries work;
- the display filter between pages is exact;
- the purge and its lock behave as specified;
- deletion runs first and leaves zero rows, even when the vendor fails;
- the scale bounds hold;
- PR-1 has no regressions.

## 1. Checks

| Check | Result |
|---|---|
| Schema ×2, seed ×2 | Clean and idempotent, exit 0 both times. Present: `follows`, `viewer_exclusions` (with their checks and `on delete cascade` on both keys), `follows_trader`, `viewer_exclusions_trader`, `viewer_exclusions_until` and `users_referred_by`. `db/schema.sql` has no `drop`, `truncate` or `delete from`. |
| `npx tsc --noEmit` | clean |
| `npm test` ×3 | **574 tests, 564 pass, 10 skipped (LOAD), 0 fail** in every run (19–20 s) |
| Test count | `origin/main` (`8feddb9`), run on the same database: 559 → **574** (+15). E2e 100 → 102. |
| Weakened? | No. `git diff origin/main...HEAD -- '*.test.ts' e2e/` removes 2 lines and replaces both with supersets. `imports.test.ts` ROOTS gains 2 files. The `feed.signed-out.test.ts` query-log hook now also records parameters, and its signed-out assertions are untouched. |
| `LOAD=1 lib/follows.load.test.ts` ×2 | 1/1 both runs. Deleting a trader referenced by 100,000 viewers: **86 / 92 ms** (bound 5 s). Purging 100,000 ended exclusions: **237 / 299 ms** in one call (box 30 s). |
| `LOAD=1 lib/sync.load.test.ts` | 5/5. Fleet of 500 traders through 8 callers in 10,834 ms (bound 60 s), each trader once. |
| `LOAD=1 lib/feed.load.test.ts` | 4/4. With 12 heavy traders, p95 154 ms. With 50 heavy, p95 **266 ms** (bound 400). Late case, weights kept: p95 328 ms. |
| `CI=1 npm run build`, stdin closed | Run 1 stops on the framework's security advisory. That is tool output: nothing was upgraded and nothing was asked of anyone. The retry exits 0. `/me/following` is dynamic. |
| `npm run test:e2e` ×2 | **102 passed, 3 skipped, 0 failed** in both runs (4.2 / 4.1 min). Each run used a fresh `next start` with `CI=1` (no server reuse) and the vendor fake configured. The skips are the sign-in provider and email-sink tests. |
| `node scripts/compliance.ts diff origin/main` | 1 violation, already present: the `@img/sharp-wasm32` license (local `node_modules`). Nothing comes from this diff. |
| `node scripts/autopilot.ts guard main` | ok |

## 2. Follow and unfollow, as a user (vendor fake on, my server)

Fixture: 120 traders with 6 closes each, plus the demo seed (a 200-card list), and two viewers. Viewport 375 × 800
unless stated. Screenshots are in light and dark.

| Check | Result |
|---|---|
| Profile control | "Follow", `aria-pressed="false"`, 79 × 44 px. Absent on your own profile. |
| Optimistic | I held the action's POST for 1.5 s. Tap to `aria-pressed="true"` took **3.0 ms** on the profile and **7.7 ms** in the pane (budget 100 ms). |
| First follow | `role="status"`: "Following @tq5. Only you can see this." (`profile-first-follow-375`). A second follow shows nothing. |
| Unfollow | "Unfollowed @tq6. Hidden from your feed for 90 days." with Undo (65 × 44 px) for 5 s (`profile-unfollow-undo-375`). Undo follows again and ends the exclusion. The line goes after 5 s. |
| Pane | Follow is 79 × 44 px and "…" is 44 × 44 px (`aria-label` "More for @x"). Tab order: Back → name → Follow → "…". Every other copy of the same trader's pane on the page flips too. |
| Signed out | The pane and the profile show a link, "Sign in to follow @x", 81 × 45 px, going to `/login`. No "…" menu and no hide bar (`pane-signed-out-375`). |
| No JS | Profile follow, pane follow, pane "Not interested" (the `<details>` menu opens without JS), "Show again" and unfollow on `/me/following` all post and come back with the new state (`nojs-not-interested-375`, `nojs-me-following-375`). |
| 360 × 640 | No horizontal overflow on the feed, `/me/following` or the profile. The menu item fits (x 107 to 323). Every button on `/me/following` is 45 px tall. |
| Demo trader | The Demo badge stays, and Follow sits beside it. |

## 3. Privacy (POLICY F6 as the plan applies it: no count or list anywhere)

Setup: viewer A follows `tq8` and viewer B hides `tq8`. I fetched each surface signed out and as B, and searched for
either viewer's handle, "follower", "followed by" and "fan".

- **Pages, all 200 and clean:** `/`, `/u/tq8`, `/u/tq8/pane-chart`, `/u/tq8/trade/<id>`, `/u/tq8/month/<ym>`, `/t/<sym>`,
  `/t`, `/sitemap.xml`, `/robots.txt`, `/how`, `/privacy`.
- **Images, all 200 and clean:** the profile, trade, month and ticker `opengraph-image`, and `story` (square and
  default).
- **Byte comparison:** every image and `pane-chart` response is byte-identical before and after the follow and the hide,
  both signed out and as B.
- **The trader's own profile** names neither viewer and has no follow wording at all.
- **`/me/following` as B** lists only B's own rows. `?viewer=<A's id>`, `?handle=tqviewa` and `?id=<A's id>` change
  nothing. Signed out it is a 307 to `/login`; its body carries only the page title.
- **APIs:** `/api/sync` adds `purged: {ran, deleted, done}`, which is counts only and only behind the cron secret (401
  without it). `/api/import/step` is unchanged.
- **Another viewer's id in requests:** the actions take a handle only and read the viewer from the session.
  - An extra argument holding another viewer's id is ignored.
  - An object `{viewer, handle}` as the handle is refused (`invalid`).
  - Another viewer's numeric id as the handle is refused (`invalid`).

## 4. CSRF, auth and input on the four actions

I sent direct POSTs with the built action ids.

| Request | Result |
|---|---|
| Same origin, signed in | `{ok: true}` |
| Signed out (`follow`, `notInterested`) | `{ok: false, reason: 'signin'}`, no row |
| `Origin: https://evil.example`, `Origin: null`, empty Origin, each with a valid session | Refused by the framework ("Invalid Server Actions request", status 500). **No row written.** |
| Session cookie with a flipped token byte, a flipped signature byte, or the signature stripped | `signin`, no row |
| Handles: own handle, `TQ5`, NUL byte, `tq5' or 1=1--`, 21 characters, unknown, `''`, `5`, `null`, `['tq5']`, `{handle}`, a trader marked deleted | all `invalid`, no row, no 500 |
| 50 concurrent follows of one trader | all `ok`, one row |
| 100 concurrent hide/undo calls on 50 traders | every call answered, rows consistent |
| **Rate limits** | None on these actions: 300 sequential toggles took 3.7 s with no refusal. Rows stay bounded (one per viewer–trader pair). The plan asks rate limits only of PR-5's events route. See note N1. |

## 5. "Not interested" and hides between pages

Throughout this section, the signed-out list (200 cards, 200 distinct) was identical to a signed-in viewer's page 1 with
no exclusions.

| Check | Result |
|---|---|
| Menu item | "Not interested in @tq4", 206 × 45 px, only in the pane header and never on a card (`pane-menu-375`, `pane-menu-360`) |
| Hide in place | The trader's page-1 cards drop and everything else keeps its order. The bar reads "**Hidden for 90 days.**" with Undo (70 × 44 px), and Undo has focus (`not-interested-hidden-375`, `not-interested-undo-360`). The row is `not_interested` with a span of 90 days. |
| After 5 s | The bar goes and focus lands on the next card's name |
| Undo | The cards return in place, with focus in a card. The row is kept and ended (`until ≤ now()`), not deleted. |
| **Display filter across a session, with two hides in two tabs** | Tab 1, page 1: I hid X (cards at 4, 14 and 69) from the pane. Tab 2, a new page 1: I paged on and hid Y (cards at 72, 82, 172 and 182). Back in tab 1, I paged to the end. Tab 1 rendered 195 rows with **0 repeats**. Its visible sequence **equals the signed-out list minus X's and Y's cards, in the same order** (193 cards). X and Y appear nowhere, and Y's cards are never even sent. Worst 10-card window: 2 per trader, 2 per symbol (stated bound 6). |
| Next session | A new page 1 had 193 cards, X and Y absent, worst window 2 |
| Hide among the last 6 cards of page 1 (360 × 640) | The pager skips the hidden row. The hide itself brings card 29 into the last six, so page 2 loads once, with no chain. Paging on: 0 repeats and the hidden trader never visible. |
| `/me/following` | `noindex, nofollow`. Lists each hidden trader with "until Jan 21, 2027" and the Following list with its controls (`me-following-375`, `me-following-360`). "Show again" removes the trader from the list, keeps the row (ended), and the next page 1 has the trader again. |
| 90-day boundary (backdated rows) | Excluded at 89 d 23 h 59 m (`until` one minute ahead). Back at 90 d + 1 s, and gone from `/me/following` ("No one is hidden."). |
| **Unfollow hides for 90 days** (engineer deviation 2) | Confirmed. After an unfollow mid-session, the trader's later-page cards are gone, though the already-rendered ones stay visible. The next page 1 leaves the trader out. `/me/following` lists the trader under hidden. **Owner question O-T1** below. |
| "Not interested" on a trader you follow (deviation 5) | The follow stays, so the trader is listed under both Following and hidden. Part of O-T1. |
| TR-1 | A hidden trader's profile lists every trade (the e2e check passes). Exclusions never touch a profile. |

## 6. Purge, lock and scale (through the real route, `POST /api/sync`)

Fixture: 100,000 viewers. Each one follows **and** hides trader T, which gives 200,000 rows naming T. Each also has an
exclusion of T2 that ended 1 d + 1 s ago (100,000 rows). Separately: 1,000 rows of T3 ended 23 h 59 m ago, and 1,000
running rows of T4.

| Check | Result |
|---|---|
| Another caller holds the purge lock (`pg_advisory_lock(3, 0)` on another connection) | `purged: {ran: false}`, nothing deleted, the route answers 200 in 95 ms |
| The same, with two connected traders due and two callers at once | Both skip the purge. **Each claims and syncs one trader** (`ok: 1` and `ok: 1`), so the purge never becomes a branch. |
| Two callers at once, lock free | A: `{ran: true, deleted: 100000, done: true}`, route 650 ms. B: `{ran: false}`, 53 ms. **100,000 purged in one call.** |
| Boundary | The 1 d + 1 s rows are deleted. The 23 h 59 m rows (1,000) and the running rows (1,000) are kept. A later tick deleted the 23 h 59 m rows once they passed a day (1,000). |
| `deleteProfile(T)`, T followed and hidden by 100,000 viewers | **152 ms**, 0 follows, 0 exclusions, user gone (bound < 5 s) |

## 7. Account deletion end to end, with the vendor

Setup: trader `tqdel2` connected through the vendor fake (6 activities, 3 closes). It follows 1 trader, hides 1, and
has unfollowed 1. Another viewer follows it and a third hides it (2 follows and 3 exclusions in all).

- I made the vendor fail every call (`/_fail` 500) and deleted through `/settings` (two taps).
- Result: the user is marked `deleted_at`. **Zero rows** in `follows` and `viewer_exclusions` as viewer or trader. The
  vendor still has the user. The profile returns 404.
  - That proves the first step runs before the vendor call, in its own transaction.
- I cleared the failure and ran a tick: `deletions: {ok: 1}`, the user row is gone, the vendor user is gone, zero rows.
- Pre-existing, not from this PR: when the vendor call fails, the person deleting sees the generic "This page couldn't
  load" page (`deletion-vendor-failing-375`). `app/auth/actions.ts` is unchanged by this PR. The data side is correct.

## 8. Regressions on PR-1

- **Signed-in feed time with exclusions.** Scratch test, not committed: 500 traders, 50 heavy; a viewer with 3 shaping
  hides and 10 follows; 60 pages each.
  - Signed out: p95 71 / 67 ms.
  - Signed in: **66 ms**.
  - Signed in with a hide between pages 1 and 2: **64 ms**.
  - 0 repeats, the hidden traders never shown, worst window ≤ 2 / 2.
  - Here the shaped list is re-mixed in memory from the kept ranked list. This adds 2 indexed reads (the viewer's
    exclusions and follows).
- **Retry, jump, End.** PR-1's e2e tests pass in both runs. The End key from card 1, signed in at 360 × 640, loads one
  page (60 rows) and does not chain.
- **Variety.** Caps hold in every walk above (2 / 2), signed in and signed out.
- **Trust rule.** Demo stays "Demo" with Follow beside it. The TR-3 e2e tests pass.
- **Consent.** The consent e2e tests pass. Following needs only a non-deleted handle, the same condition under which a
  profile exists, so the action reveals nothing a profile URL doesn't.
- **Pane.** SW-1 and the heavy-pane chart pass in e2e. The pane header now reads "Name @handle" (the e2e check passes).
- **Server log over the whole walk.** The only errors are from my own forged-Origin requests and the forced vendor
  failure.

## 9. Defects

1. **Low · usability · `app/follow-button.tsx`: when the unfollow Undo expires with focus on it, focus drops to
   `<body>`.**
   - Reproduction on the profile: unfollow, Tab to Undo, wait 5 s. `document.activeElement` is `BODY`.
   - A keyboard or screen-reader user loses their place.
   - `app/feed-hides.tsx` already handles this case for "Not interested", moving focus to the next card. The follow
     control should do the same, for example by returning focus to the Follow button.
2. **Low · usability · `app/not-interested.tsx`: Escape does not close the "…" menu.**
   - The `<details>` menu stays open after Escape. Tab then goes into the menu item.
   - Clicking elsewhere does not close it either.
   - A popup menu is expected to close on Escape and return focus to its "…" button.
3. **Low · spec · the privacy line is not shown "once".**
   - `follow` returns `first` whenever the viewer follows no one at that moment. So "Following @x. Only you can see
     this." shows again whenever the viewer's list goes from empty to one.
   - That includes **Undo of an unfollow of the only trader followed** (`profile-undo-repeats-privacy-375`).
   - The plan says "Privacy line once: the status after the first follow". Either keep a "seen" flag or accept the
     current meaning and say so in the plan.

## 10. Notes (not blocking)

- **N1.** No rate limit on `follow`, `unfollow`, `notInterested` or `undoNotInterested` (§4). The writes are bounded,
  but one session can do about 80 writes a second. Consider the per-process `minInterval` the import step uses.
- **N2.** Cross-origin action POSTs get the framework's 500 instead of a 4xx. Nothing is written. This is framework
  behavior, not product code.
- **N3.** The comment at the top of `app/feed-actions.tsx` still says the action "reads no cookie or session". It now
  reads the viewer id through `lib/viewer.ts`.
- **N4.** Every "Show again" button on `/me/following` has the same accessible name. A per-trader name such as "Show
  @x again" would read better out of list context.

## 11. Owner questions (recorded, not defects)

- **O-T1. Should unfollowing also hide the trader from the feed for 90 days?** The plan says yes (criterion 4) and the
  build does it. The status line says so, with Undo.
  - A viewer who unfollows may not expect the trader to leave their feed.
  - A viewer can also follow and hide the same trader at once (they appear in both lists).
  - The engineer's alternative: the feed honors only `not_interested`, and the suggestions section honors both.
- Deviations 1 ("Not interested" in the pane header until PR-3) and 3 (signed out goes to `/login` without `next`) hold
  as the engineer describes. I found no problem with either.

## 12. Cleanup

- Test users deleted (`tq*`, including the 100,000 scale viewers), along with their handle reservations.
- `ss_tst_pr2` dropped.
- My server (3218) and vendor fake (4218) stopped. The e2e servers stopped with their runs.
- The scratch copies of `HEAD` and `origin/main` removed.
- No other database touched. No product code changed.

Screenshots: `screenshots/pr2-test/`, light and dark for each name below.
- Profile: `profile-first-follow-375`, `profile-unfollow-undo-375`, `profile-undo-repeats-privacy-375`,
  `profile-following-360`.
- Pane: `pane-following-375`, `pane-menu-375`, `pane-menu-360`, `pane-signed-out-375`.
- Feed: `not-interested-hidden-375`, `not-interested-undo-360`, `feed-end-after-hides-375`.
- Lists: `me-following-375`, `me-following-360`.
- No JS: `nojs-not-interested-375`, `nojs-me-following-375`.
- Deletion: `deletion-vendor-failing-375`.

## Re-run 1

2026-10-23. Product code at `6fb8952` (engineer fix round 1). Postgres 16, Node 22.22. No product code changed.
Isolation: my own database `ss_tst_pr2r1` (created as the superuser, owned by the shared role; the shared `stock_social`
was never written). Other sessions were serving from the shared checkout (3111, 3112), so the build, both e2e passes and
my server (3219, vendor fake 4219) ran from a copy of `HEAD` in my scratch directory.

**Verdict: DEFECTS.** 3 Low, no blocker. Every fix in the engineer's table holds as a user sees it: the menu stays on
screen and closes on Esc, outside click or tap, and Tab; `/me/following` is reachable by taps; unfollow leaves the
feed alone; there is no signed-out Follow; the privacy line shows once per viewer; Undo focus and the pause work; no-JS
posts land with a line. My three earlier Lows are fixed. No regression on PR-1, deletion or purge.

### R1. Checks

| Check | Result |
|---|---|
| Schema ×2, seed | exit 0 both times, no error. `users.follow_notice_at` is `timestamptz`, nullable, added by `schema_add_column` (idempotent). `db/schema.sql` has no `drop`, `truncate` or `delete from` |
| `npx tsc --noEmit` | clean |
| `npm test` ×3 (+2 extra) | **575 tests, 565 pass, 10 skipped (LOAD), 0 fail** in runs 1, 2, 4 and 5. Run 3: 4 fails, all in `lib/funnel.test.ts`, whose `before` hook (re-applying the schema) hit an FK error on the `broker_accounts` backfill. See N5: the cause is older than this PR |
| Test count | 575 (bound 575). E2e 102 → 103 |
| Weakened? | No. `git diff 8e7c59f HEAD -- '*.test.ts' e2e/` gives `lib/follows.test.ts` +39/−0. `e2e/follow.spec.ts` replaces 9 assertions. Each one tested behavior the fix removed and now checks the new behavior, the same or stronger: `[role=status]` becomes the polite live region with the same text; the unfollow line and Undo become "row written, no button, cards stay, still there on the next page 1"; the sign-in link becomes no control on the profile or feed; "Show again" now uses its per-trader name and also checks the feedback. Moving `shown` and the screenshot directory changes no assertion. Nothing from PR-1 or earlier changed |
| `LOAD=1` feed / follows / sync | 4/4, 1/1, 5/5. Feed p95: 12 heavy 151 ms, 50 heavy **283 ms** (bound 400), late weights-kept 258 ms, own-late 599 ms (PR-1's known limit, unchanged). Delete of a trader with 100,000 viewers: **84 ms**; purge 100,000: **316 ms**. Sync fleet of 62 traders in one tick, fine |
| `CI=1 npm run build`, stdin closed | exit 0 on the first run. It printed the framework's security advisory, which is tool output: nothing was upgraded. `/me/following` and `/settings` are dynamic |
| `npm run test:e2e` ×2 (`CI=1`, fresh `next start`, vendor fake configured) | **103 passed, 3 skipped, 0 failed** in both runs (4.2 / 4.2 min). Follow toggle feedback: 2.1 / 5.7 ms |
| `node scripts/compliance.ts diff origin/main` | 1 violation, the pre-existing `@img/sharp-wasm32` license line (local `node_modules`) |
| `node scripts/autopilot.ts guard main` | ok |

### R2. As a user

Fixture: 120 traders with 6 closes each, plus one trader with the longest handle (`tr1_long_handle_abcd`, 20 chars) and
a 25-char display name, plus the demo seed (a 200-card list).

| Check | Result |
|---|---|
| "…" menu, 375, 20-char handle, "Following" beside it | "…" 44 × 44 at x 311–355. The item spans x **20–355**, wraps to two lines (68 px tall), and no text is cut. No horizontal page scroll (`pane-menu-20char-375`) |
| Same at 320 | "…" at x 256–300; the item spans x **20–300**, no text cut, no page scroll (`pane-menu-20char-320`) |
| Close | Esc closes and focus returns to "…" ("More for @…"). A click outside closes it, and so does a click on the nav. A touch tap outside closes it. Tab moves into the item, and a second Tab closes the menu (focus goes to the chart). Shift+Tab out closes it. A second tap on "…" closes it. All at 375 and 320 |
| Tap-only path (touch, one `goto`) | Feed → `@handle` in the nav → own profile → **Settings** → "Following and hidden traders" → `/me/following` (h1 "Following and hidden traders"). Settings appears on your own profile only: not on another trader's, and not signed out. Its tap target is 61 × 20 px (Low 1, `own-profile-settings-375`) |
| Unfollow | Pane: Follow → Following → Follow. The status stays empty and there is no Undo. The visible sequence is **identical** before and after. One `unfollow` row is written, spanning 90 days. A new page 1 paged to the end equals the signed-out list exactly (200 cards, 0 repeats, the trader's 2 cards present). `/me/following` says "No one is hidden." and does not list the trader. The trader's profile shows "Follow" (`pane-unfollowed-375`) |
| Unfollow over a running "Not interested" | The `not_interested` row is unchanged: same reason, same `until`, `created_at` 10 days back kept |
| Signed out | Profile and feed, with and without JS: 0 `.profile-follow`, `button.follow`, `.more-menu` or `.pane-actions`, and no "Sign in to follow" text (`pane-signed-out-375`) |
| Privacy line once | First follow: "Following @tr1t10. Only you can see this." and `follow_notice_at` is set. Unfollow then re-follow of the only trader: no line. Another trader: no line, and the stamp is unchanged. Stamp backdated 400 days: no line. Stamp cleared: the line again, once. Two first follows at once from two tabs: the line shows in **exactly one**. The region is pre-rendered, `aria-live="polite"`, has no role and is 0 px tall when empty (`profile-first-follow-375`) |
| Undo, keyboard | Hide via "…" → Enter → Tab → Enter puts focus on Undo. The bar is **still up after 7 s** (`hide-bar-paused-375`). Tab closes it with focus on the next card's name (never `<body>`). A keyboard Undo puts focus on the "…" of the pane hidden from, with the row in view and the exclusion ended |
| Undo, mouse and touch | A click hide focuses Undo and expires at 5 s, with focus going to a card. Hover pauses it (still up at 6.5 s), and leaving lets it expire after 5 s. A mouse Undo also focuses the "…". On touch, Undo is 70 × 44 and on screen, and the bar expires at 5 s (`not-interested-undo-375`) |
| No JS | A first follow lands on `/u/x?done=follow&first=1` with "Following @x. Only you can see this." A second follow shows "Following @x."; an unfollow lands on `?done=unfollow` with "Unfollowed @x.". The pane's "Not interested" lands on the trader with "@x is hidden from your feed for 90 days. Their profile stays public." and the profile lists the trades (TR-1). "Show again" lands on `/me/following?back=x` with "@x is back in your feed." (`nojs-*-375`) |
| Crafted links | `?done=follow` when not following, `?done=hidden` when not hidden and `?done=unfollow` while following all show nothing, and so does any `done` signed out. But `/me/following?back=<any handle>` says "@x is back in your feed." even for a trader never hidden or a handle that does not exist (Low 2, `crafted-back-375`). `?done=follow&first=1` while following shows the privacy line again; that is true and harmless, so it is not a defect |
| `/me/following` at 320 | No page scroll, and both controls stay on one line inside the screen. A long display name is cut at the button and **the handle is not visible** (Low 3, `me-following-320`, `me-following-show-again-320`). The pane header at 320/375 does the same (scrollWidth 398 vs 101–156 px); that case is already a recorded UX follow-up |

### R3. Privacy sweep (viewer A follows T, viewer B hides T)

- **Byte comparison.** The profile, trade, month and ticker images, `story` (both formats) and `pane-chart` are all 200
  and **byte-identical** before and after, signed out and as B.
- **Page text.** `/`, the profile, trade, month, `/t/<sym>`, `/t`, `/t/compare`, sitemap, robots, `/how`, `/privacy`,
  `/terms` and both viewers' profiles are all 200. Signed out, none contains either viewer's handle, "follower",
  "followed by" or "follows". As B, the only match is B's own handle in the nav.
- **The trader's view.** T's own `/u/T`, `/`, `/settings` and `/me/following` name neither viewer.
- **`/me/following` as B** shows only B's rows. `?viewer=<A's id>` and `?handle=<A>` change nothing.
- **Routes.** Signed out, `/me/following` is a 307 to `/login`. `/api/sync` without the secret is 401.
- **A's public profile** lists nothing A follows.

### R4. Regressions

- **PR-1 paging and hides.** Tab 1 hid X on page 1. Tab 2 opened a new page 1, paged to card 57 and hid Y there. Back in
  tab 1 I paged to the end:
  - 194 cards, **0 repeats**;
  - **equal to the signed-out list minus X's and Y's cards, in the same order**;
  - worst 10-card window: 2 per trader;
  - a new session also leaves X and Y out (`feed-end-after-hides-375`).
- **End key at 360 × 640.** Signed in, the End key loads one page (30 → 60 cards) with no chain.
- **Deletion end to end.** A trader was registered with the vendor fake (`/connect/start`). It followed 1, hid 1 and had
  unfollowed 1; others followed it twice and hid it once.
  - With the vendor failing, two taps in `/settings` mark the user. **0 follows and 0 exclusions** remain either way, and
    the profile returns 404.
  - After clearing the failure, a tick gives `deletions: {ok: 1}`: the user row is gone, the vendor user is gone, and 0
    rows remain.
  - The person deleting still sees the generic error page while the vendor fails. That is pre-existing
    (`deletion-vendor-failing-375`).
- **Purge through `POST /api/sync`.**
  - Of 20 rows ended 1 d + 1 s ago, all were deleted. The 10 rows ended 23 h 59 m ago and the 10 running rows were kept.
  - With `pg_advisory_lock(3, 0)` held elsewhere: `{ran: false}`, nothing deleted.
  - With the lock released, the next tick deleted the 10 (by then over a day old).
- **Server log.** The only error is my forced vendor failure.

### R5. Defects

1. **Low · accessibility · `app/u/[handle]/page.tsx`: the "Settings" link on your own profile is 61 × 20 px.**
   - `className="tap"` gives 44 px only under `.auth` (`app/globals.css:285`), and the profile is not in `.auth`.
   - The fix-round claim "every action … 44 px" does not hold for this link. It is now the only way to reach Sign out,
     Delete and the lists, so it is worth a full-size target.
2. **Low · copy truth · `app/me/following/page.tsx`: `?back=<handle>` claims "@x is back in your feed." for any
   well-formed handle.**
   - It checks only that the handle is not currently hidden. A trader never hidden, or a handle that doesn't exist, also
     gets the line (`/me/following?back=nobody_here`).
   - The fix round says a crafted link "claims nothing", and the business lead's checklist asks for "status copy true on
     screen".
   - Fix: require a recently ended `not_interested` row for that trader (as `?done=` checks stored state).
3. **Low · usability · `/me/following` at 320 (and the pane header at 320/375): a long display name pushes the handle out
   of sight.**
   - The row shows only "Longest Display Nam…" beside "Following". You can't tell which trader it is from the visible
     text, and the list exists to manage specific traders.
   - The pane-header case is already a UX follow-up; this is the same problem on the new list. For example, wrap the
     handle under the name, or truncate the name before the handle.

### R6. Notes

- **N5 · test reliability, not from this PR.** 1 run in 5 had `lib/funnel.test.ts` fail in its `before` hook.
  - The hook re-runs `db/schema.sql`. That file's one-time `broker_accounts` backfill (`insert … select … from
    activities`, lines 124–126) raced another test file deleting its user: `broker_accounts_user_id_fkey`, 23503.
  - This PR adds more concurrent test files that delete users, which may make the race likelier. CI can flake on it.
  - A fix outside this PR: join `users` in the backfill, or take a lock in the hook.
- Earlier notes N1 (no rate limit) and N2 (cross-origin POSTs get the framework's 500) stand as recorded follow-ups.
  N3, N4, Low 1, Low 2 and Low 3 are fixed. O-T1 was answered by fix round 1 (deviation 7, the owner can reverse it).

### R7. Cleanup

- 130 test users (`tr1*`) deleted.
- `ss_tst_pr2r1` dropped.
- My server (3219) and vendor fake (4219) stopped. The e2e servers stopped with their runs.
- The scratch copy of `HEAD` removed.
- No other database touched. No product code changed.

Screenshots: `screenshots/pr2-test2/`, light and dark for each name below.
- Pane: `pane-menu-20char-375`, `pane-menu-20char-320`, `pane-unfollowed-375`, `pane-signed-out-375`.
- Profile: `own-profile-settings-375`, `profile-first-follow-375`.
- Feed: `hide-bar-paused-375`, `not-interested-undo-375`, `feed-end-after-hides-375`.
- Lists: `me-following-375`, `me-following-320`, `me-following-show-again-320`, `crafted-back-375`.
- No JS: `nojs-first-follow-375`, `nojs-unfollowed-375`, `nojs-hidden-375`, `nojs-show-again-375`.
- Deletion: `deletion-vendor-failing-375`.
