## What changes

F-2 PR-5 (event log, opt-in implicit logger, personal scoring) and PR-6 (heavy use), built as one PR.

- **Hidden trades** (criterion 15): `/me/hidden` lists the viewer's hidden trades with "Show again" (keyboard and no-JS). The feed's first page shows "N trades hidden by you. Show them" when N > 0.
- **Switches** (criteria 12, 13): `/me/personalize` has "Personalize my feed" (default On) and "Personalize with my activity" (default **Off**). On and Off are equal buttons named by their switch, and "Clear my activity" deletes in one tap. All of it works without JavaScript. Linked from Settings, `/me/following` and the feed's order line.
- **Activity log** (criteria 2, 3):
  - `discovery_events` stores viewer, surface, target (trader, trade or symbol), type and time only.
  - It is written by `POST /api/events` only for a signed-in viewer with both switches On; anyone else gets 204 and nothing is stored.
  - The route is same-origin only, takes ≤ 8 KB and ≤ 50 events a batch, one batch per viewer per 2 s (a row lock, so it holds across instances), and ≤ 2,000 events a day.
  - Only implicit reading events are logged; explicit choices stay in their own tables.
  - The logger (`app/discovery-log.tsx`) is mounted only when both switches are On.
- **Personal ordering** (criteria 1, 4, 7, 8, 11, 14, 16, 17):
  - `lib/discovery/personal.ts` (pure) builds the viewer's profile on read, at the cursor's asOf.
  - Likes, rejects, hides, unfollows and events fade linearly to 0 over 90 days. Follows count while they stand.
  - Relevance = direct + 0.6·cos(symbols) + 0.6·cos(holding) + follow bonus. It re-orders the TR-9 ranked list, then the same caps and exploration as everyone's.
  - It never reads a return or its sign, and the watchlist is never an input (`SYMBOL_EVENTS = false`).
  - Zero signals, or "Personalize my feed" Off, gives the order everyone gets minus the viewer's own hides.
  - The personal section heading is "More like what you read". Reason lines are "Similar holding period to @x", "Trades symbols you read" and "New to you": facts about the record or the viewer's own actions, with no ticker and no number.
- **Storage** (owner 2026-11-01, stored until removed):
  - The purge deletes only exclusions the viewer ended (new `viewer_exclusions.ended_at`) and ended unfollow rows, a day later.
  - Likes and hidden trades whose close is gone are marked and deleted 30 days later if still gone.
  - Expired hides stay stored and are listed on `/me/following` under "No longer applied" with Remove.
  - Account deletion removes the viewer's events and events naming them.
- `/how` documents how a signed-in feed is ordered.

## Decisions taken by the committee

Recorded in `docs/features/logs/F-2/committee-2026-11-01.md` and appended to the feature file. The main ones:
- Q1: criterion 5's nightly deletion is superseded by indefinite storage; reads use 90 days, fading.
- Q2–Q5: the switches live on `/me/personalize`. Activity Off keeps stored events unused, and Personalize Off logs nothing. Clear is one tap.
- Q6–Q8: the opening swipe +2 counts only with activity On. Proposed implicit weights await the owner.
- Q9–Q13: copy, placement, Show again, the /how paragraph, and expired hides stored but listed and removable.
- Orphans are marked first and deleted only after 30 days.
- The watchlist reason is superseded.
- `traderPreference` is unchanged; the fade lives in `viewerProfile`.

Guard tests: the page and its paging action call `lib/discovery/personal-feed.ts#loadFeedPage` with the same `{ viewer: await viewerId() }`, and `lib/feed.ts#loadFeedPage` takes the profile as a loader. The existing guards therefore hold unchanged: loadFeedPage alone reads no `trade_likes` or `discovery_events`, and only lib/follows.ts and lib/likes.ts name the preference tables. The orphan purge lives in `lib/delete.ts` for the same reason.

## Testing

- `npx tsc --noEmit`: clean.
- `npm test` on a fresh empty database: 716 pass, 0 fail, 16 skipped, 1 todo (H4 Privacy Policy text, owner).
- New tests:
  - `lib/discovery/f2-personal.test.ts`: 16 cases. Fade, weights, sign invariance, caps and exploration on 1,000 generated personal feeds, section evidence order, reasons, copy scan, event parsing, same-origin.
  - `lib/f2-personal.db.test.ts`: 16 cases. Columns, switches, gate and cap, Clear, watchlist, Off and cold-start orders, follow raises, page stability, two viewers, loader failure, guard on personal reads, deletion, purge rules, hidden trades.
  - `lib/discovery/f2-privacy.test.ts`: a visible todo until H4.
- `LOAD=1 node --test lib/discovery/f2-heavy.load.test.ts`:
  - 5,000 viewers × 500 events scored in 2.0 s.
  - Event batches: p95 25.7 ms with at most 10 in flight. All 200 at once queue on the pool's 10 connections: p95 ~450–500 ms, logged only. No rows lost.
  - Deleting a trader named by 100,000 viewers' events: 105 ms.
  - 200,000 orphan likes marked in 1 call and purged in 1 call.
- `npx playwright test e2e/f2-personal.spec.ts`: 4 passed at 360 px.
- The full e2e suite passes. likes and section were re-run alone after merging the date fix (12 passed).
- `BASE_REF=main node scripts/compliance.ts auto`: ok. `node scripts/autopilot.ts guard origin/main`: ok.
- `npm run build`: ok.

## Compliance

1. **Performance:** no new number on any row or line. The disclaimer is unchanged on the feed and pane. Losses weigh like gains (sign invariance tested). The ordering is documented on `/how`.
2. **Personal data:**
   - New data: `discovery_events` (viewer, surface, target, type, time) and `users.personalize_feed`, `activity_log_on_at` and `activity_batch_at`.
   - Only the viewer's own ordering reads it.
   - Deleted by Clear, by account deletion, and by the orphan purge for likes and hidden trades.
   - Activity is opt-in and off by default. Real viewers still wait for the Privacy Policy (H4).
3. **Money:** none.
4. **Tracking:** first-party only, opt-in, no third party, no notifications.
5. **User text:** none. Reasons are templates.
6. **Sign-up and age:** unchanged.
7. **Vendors or dependencies:** none added.
8. **Accessibility:** every control is ≥ 44 px. `aria-pressed` carries the switch state, and the ✓ mark is visual only. Accessible names start with the visible text. Status lines use `role="status"`. Keyboard and no-JS paths are tested.
9. **Security:** the events route is same-origin, auth-gated, size-capped and rate-limited in Postgres. Every query is parameterized and keyed by the viewer. Crafted `?saved=`/`?back=` values state nothing false.
10. **Claims:** no "AI", "smart" or "for you". The suggestion and endorsement word lists pass.
11. **Checkout:** none.

Committee record: `docs/features/logs/F-2/committee-2026-11-01.md` (plan: `plan-pr5-ux-lead.md`; reviews: `plan-pr5-business-lead.md`, `plan-pr5-engineer.md`; QA: `test-pr5-tester.md`, `committee-pr5-user-test.md`).

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01Cdty8nCrpEVPqzf5bfdaM6
