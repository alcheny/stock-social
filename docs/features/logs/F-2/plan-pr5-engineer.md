# F-2 PR-5 + PR-6 · Engineer review of the UX lead plan and the drafts

Date 2026-11-01. Verdict: **REVISE**. The direction, screens and commit order are sound and fit one PR. The drafts have
one load-breaking bug and several correctness gaps; the plan needs the eight changes below before I sign.

## Demands
1. **personal.ts does not load.** It imports `IMPLICIT` and `FOLLOW_BONUS` from `weights.ts`; neither exists. Add them
   to `weights.ts`: `IMPLICIT` keyed by the `EVENT_TYPES` codes, with swipe_open = `WEIGHTS.swipeOpen`, and
   `FOLLOW_BONUS = 2`. Leave `traderPreference` and its tests (gestures, likes, feed.section) exactly as they are.
   Fix plan §1, which says PR-5 "replaces" `traderPreference`: the fade lives only in `viewerProfile`. Add
   `personal.ts` to `imports.test.ts` ROOTS as an added case, plus a test that `personal.ts` has no `return_pct`/`returnPct`.
2. **Page 2 must slice page 1's list.** `Inputs.follows` has no time, so a follow made between pages reorders the list
   and the viewer sees duplicate or missing cards. Read every input as of asOf: follows by `created_at`, and likes,
   rejects, exclusions and events made at or before asOf. Deletions after asOf (unlike, Show again, Clear, unfollow)
   can't be rebuilt, so keep the personal slot order in its own bounded in-memory map keyed by
   (viewer, day, asOf, ids). It must never go into the shared `lists` key, which has no viewer. Tests: a follow, like
   or unlike after page 1 leaves page 2 equal to the slice of page 1's list, and viewer A's order never reaches viewer B.
3. **Zero signals and Off must give the impersonal order.** `personalList` calls `mixFeed` without `extra`, while
   `kept.mixed` was mixed with it. A cold-start viewer would get a different list from a signed-out reader, which
   breaks C11 and C13 and also loses exploration of traders outside the candidates. Keep `extra` slots in `Kept` and
   pass them to both `shapeList` and `personalList`. Return `kept.mixed` (or `shapeList` if exclusions shape the
   list) when personalize is Off or `signals === 0`. Test that the order equals the signed-out order.
4. **Gate and cap storage on the server.** `recordEvents` checks only `activity_log_on_at`. Add `and personalize_feed`
   (Q4). A layout does not re-render on client navigation, so a mounted logger can outlive an Off switch, and only
   the server gate is reliable. Storage now has no timer, so add a per-viewer cap in the same insert statement:
   `EVENTS_PER_DAY = 2000`, with no rows stored past it in the last 24 h. Test the cap. Plan §3.4: drop
   "time clamped to [now − 1 h, now]". The draft already uses server time only, and that is right.
5. **Reasons are wrong as drafted.** Impressions weigh 0, so `add()` drops them and a trader the viewer has seen 50
   times still gets "New to you". It also fires with activity Off, which §3.5 forbids. Add `seen: Set<number>` to
   `Profile` (impression, open or like in the window). Emit `newToYou` only when activity is On and the trader is not
   in `seen`. `similarHold` draws on `direct > 0`, which includes dwell, open and share. Restrict it to follows and
   likes as §3.5 says, and pick deterministically (newest first). Tests: one per reason, with and without activity.
6. **C4 "same symbols" cannot pass.** A "Not interested" is trader-level and carries no symbol, so it never lowers a
   trader through symbols. Drop "same symbols" from C4 and keep the holding bucket, which `relevanceOf` does cover.
   Alternative: add the hidden trader's shape symbols to the vector as negatives. Recommend the drop.
7. **Exclusions and purge.**
   - The schema draft lacks `viewer_exclusions.ended_at`. Add it with `schema_add_column`. `endExclusion` sets it;
     `follow()` calls `endExclusion`, which is correct, because re-following ends the unfollow −1. The purge condition
     becomes `ended_at < now() − 1 day`, not `until`.
   - Add a one-time, idempotent backfill that deletes nothing:
     `update … set ended_at = until where ended_at is null and until < created_at + 90 days`.
   - Drop the orphan purge of likes, rejects and events "whose close no longer exists" from PR-5. Reads already ignore
     orphans, and a rebuild or quarantine can bring a close back, so the purge would delete a viewer's data for good.
     Trader deletion is already handled by cascade and `delete.ts`.
   - With that purge gone, the draft's `trade_likes_key` and `trade_exclusions_key` indexes have no reader. Remove them.
8. **Deletion, guard and load.**
   - Add `delete from discovery_events where viewer_id = $1 or target_user_id = $1` to the first step of `lib/delete.ts`.
   - Leave `lib/feed.signed-out.test.ts` unchanged. Its existing cases call `loadFeedPage` without `profileFor` and
     stay green. Add new cases:
     - signed out, `profileFor` is never called;
     - signed in, every `discovery_events`, `trade_likes` or `follows` read takes only the session viewer's id.
   - Hidden count: use `exists` against `closed_trades` by `trade_key`, and measure it at 10,000 rows. If it misses
     20 ms, count up to 1,000 and show "1,000+".

## Notes on the drafts (no demand)
- `setActivity` comment: the setting goes to null when activity is turned Off, so turning it On again sets a new
  time. It does not keep the first one. Fix the comment.
- The `target_symbol` column and the watch/unwatch types are dead while `SYMBOL_EVENTS = false`. Keep them: the
  `target_kind` CHECK can't be widened later without a `drop`, which CI blocks.
- The plan lists follow, like and the other explicit types "in the lookup". The draft leaves them out, so they are
  rejected as unknown. That is better; align the plan text with it.
- §3.1 Show again is "by trade key". Today `undoRejectTrade` takes a card id. Resolve the key to an id through
  `closed_trades` (the row is skipped when the close is gone anyway), or add a by-key variant.

## Open questions (accept or reject the recommended option)
- Q1 accept (owner decision). Q2 accept. Q3 accept.
- Q4 accept, enforced on the server (demand 4).
- Q5 accept. Q6 accept. Q7 accept.
- Q8 accept as proposed weights, owner-only as §9 says. Note that a follow counts twice: the +2 bonus plus its
  holding-period share, which is intended.
- Q9 accept. Q10 accept.
- Q11 accept, subject to the scanner. "holding period" already passes; add a test that "hidden" and "hide" pass too.
- Q12 accept, using the same constants.
- Q13 accept, which requires `ended_at` (demand 7).

I sign once demands 1-8 are in the plan and the drafts.
