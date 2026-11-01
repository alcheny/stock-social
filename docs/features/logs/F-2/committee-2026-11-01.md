# F-2 PR-5 + PR-6 · Committee decisions (2026-11-01)

Under the owner's instruction of 2026-11-01 (develop autonomously; decide open questions with the committee's
recommended option after debate). Inputs: `plan-pr5-ux-lead.md` (draft, Q1–Q13), `plan-pr5-business-lead.md` (SIGN with
demands 1–8), `plan-pr5-engineer.md` (REVISE with demands 1–8; all applied in the build, see below).

## Decisions (each by the recommended option)
1. **Q1** Criterion 5's nightly deletion of events older than 90 days is superseded by the owner's 2026-11-01 decision
   (preference data and the activity log are stored until the viewer removes them or deletes the account). Ordering
   reads only the last 90 days, fading; account deletion removes events the same day (tested).
2. **Q2** The two switches live on `/me/personalize`, linked from Settings, `/me/following` and the feed's order line.
3. **Q3** Turning activity Off stops logging and use at once; stored events stay unused; "Clear my activity" deletes them.
4. **Q4** With "Personalize my feed" Off the logger is not mounted and `/api/events` stores nothing (server-side check).
5. **Q5** "Clear my activity" is one tap and deletes at once; the status line confirms.
6. **Q6** The opening swipe (+2) is an activity event: it counts only with activity On.
7. **Q7** "share" is an allowed event type (+1). Share buttons live on profile and trade pages, where PR-5 does not mount
   the logger, so no share event is written yet; the type is kept so adding it needs no schema change.
8. **Q8** Implicit weights (proposed for the owner, `lib/discovery/weights.ts#IMPLICIT`): dwell_long +1, profile_open +1,
   share +1, skip −0.5, impression 0, dwell_short 0; follow bonus +2. No implicit weight exceeds an explicit one (tested).
9. **Q9** The hidden-trades line is absent at 0; it shares one quiet paragraph with the order line above the first card
   (business lead demand 4), page 1 only.
10. **Q10** "Show again" on a hidden trade deletes the row at once and restores a like it carried, with its original date.
11. **Q11** Copy as in the UX plan, with the business lead's edits: the order line names only "follows, likes and hides"
    (plus "activity" when activity rows were read); singular and plural hidden lines tested.
12. **Q12** `/how` gains "How your feed is ordered" built from the same constants (POLICY F1: documented method).
13. **Q13** A "Not interested" that ran its 90 days stays stored and unread, listed on `/me/following` under "No longer
    applied" with Remove (business lead demand 2). The purge deletes only exclusions the viewer ended (new
    `viewer_exclusions.ended_at`), ended unfollow rows (the system's −1 record of a removed follow), and orphans.
14. **Orphans** (owner: "only orphans whose trade is gone are purged"; engineer demand 7 warned a rebuild or quarantine can
    bring a close back): a like or hidden trade whose close is gone is marked (`orphan_at`) and deleted only if still gone
    30 days later; a close that comes back clears the mark. Events are not purged (the 90-day read window applies).
15. **Watchlist** (criterion 16): never an ordering input; `SYMBOL_EVENTS = false` rejects watch/unwatch; the
    "symbols on your watchlist" reason of criteria 2 and 7 is superseded.
16. **Fade**: `traderPreference` keeps its PR-4 semantics (existing tests pin it); ordering reads choices only through
    `viewerProfile`, where every like, reject, hide, unfollow and event fades linearly to 0 over 90 days.
17. **No derived table**: the old plan's `discovery_trader_features` is dropped; the profile and trader shapes are
    computed on read (no affinity is stored, so Clear needs nothing else).
18. **Hidden trades before scoring** (criterion 15): both ship in this one PR; the list never ships after the ordering.
19. **Guard tests**: `lib/feed.ts#loadFeedPage` takes the profile as a `personal` loader; the page and its paging action call
    `lib/discovery/personal-feed.ts#loadFeedPage` with the same `{ viewer: await viewerId() }`, so the existing guards
    (loadFeedPage alone reads no `trade_likes` or `discovery_events`; only lib/follows.ts and lib/likes.ts name the
    preference tables) hold unchanged. The orphan purge lives in `lib/delete.ts` for the same reason.
20. **Events route bounds** (business lead demand 5): same-origin; ≤ 8 KB and ≤ 50 events a batch; one batch per viewer
    per 2 s held by a row lock in Postgres (across instances); ≤ 2,000 events per viewer per UTC day.
21. **Page stability** (engineer demand 2): the profile reads only choices made at or before the cursor's asOf, and the
    personal list is kept in its own per-viewer map for the cursor's lifetime.
22. **Privacy Policy** (business lead demand 6): `PREFERENCE_DATA` facts with a visible todo test until H4's text lands.

## Sign-off
- UX lead: author of the plan; the build follows it with the amendments above.
- Business lead: SIGNED 2026-11-01 with demands 1–8, verified in the user test.
- Engineer: REVISE → demands 1–8 applied in the build (IMPLICIT/FOLLOW_BONUS, asOf-pinned inputs and per-viewer cache,
  `extra` in the personal mix, server gate and cap, seen/liked reasons, holding-only "lowers similar", `ended_at`, deletion
  and guard cases).
