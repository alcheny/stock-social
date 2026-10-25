# F-2 · Guardrails G1 to G6 · Implementation plan (engineer), round 3

Round 3 applies the business lead's build conditions R1 to R3 and the UX lead's four round-2 demands. See "Round 3
changes" at the end. Rounds 1 and 2 stand except where that table says otherwise.

Date: 2026-10-25. Role: engineer.

**Process.** `docs/IMPLEMENTATION.md` step 1 (plan), "Parallel development" (file sets per PR, the independence test)
and "Resolving hard stops with the team" step 6 (each adopted guardrail is planned and built through the normal cycle).

**Inputs.**
- `docs/features/F-2-personal-discovery.md`: the Decisions of 2026-10-25 ("guardrails", H1, H2, H4, and **Q1 as
  reversed the same day**) and criteria G1 to G6, with G1 as amended.
- `hardstops-resolution-business-lead.md` §2 and §3, and `hardstops-resolution-engineer.md`.
- `plan.md`.
- POLICY as amended in `bcaac14`.
- Round 1's reviews:
  - `plan-guardrails-signoff-business-lead.md`: SIGNED with changes C1 to C9.
  - `plan-guardrails-signoff-ux-lead.md`: REVISE, 11 demands, built on 22 numbered items.
- The tree: `claude/peaceful-dirac-33bucv` plus PR-4's uncommitted fix round 2.

**How round 2 was applied.**
- Every C1 to C9 and every UX demand is applied. The "Round 2 changes" table at the end maps each one to the change it
  made.
- Where the two members conflict, I took the stricter option and say so in that table.
- Copy for C6 and C8 uses the UX lead's wording, as the coordinator directed.

**The owner reversed Q1.** With the switch off, *nothing about the viewer's activity is recorded*. C2's one allowed
watchlist write is therefore dropped. §1.1 applies the reversal to every passive write the tree makes while a signed-in
viewer reads, not only the watched-symbol stamp. Each of those writes is listed there, so the owner can narrow the list.

This plan decides how, not what. It changes no decision in the feature file. Nothing here is legal advice.

## 0. Summary

| # | PR | Guardrails | Product lines | Test lines | Waits on |
|---|---|---|---|---|---|
| 7 | Feed controls · `autopilot/feature-2-feed-controls` | G1 (with the Q1 reversal), G3, G4 | ~365 | ~630 | PR-4 landed on the branch |
| 8 | Reachable and unlogged · `autopilot/feature-2-reach` | G2, G5, G6 | ~390 | ~720 | **PR-7 merged** |

- **The independence test between PR-7 and PR-8 no longer holds, so they build one after the other: PR-7, then PR-8.**
  - Round 2 puts "Reset my feed" in `app/settings/page.tsx` (UX demand 1), a file PR-7 owns.
  - The Q1 reversal puts five more of PR-8's files in PR-7: `app/t/[symbol]/Watch.tsx`, `app/u/[handle]/page.tsx`,
    `app/actions.ts`, `lib/auth/sessions.ts`, `app/t/page.tsx`.
  - Rule 2 fails on all of them (§3). By the rule, the higher-numbered item waits, so PR-8 branches from PR-7's merge
    commit.
  - Reshuffling into a third PR to win back parallelism would add a full committee cycle, and the business lead
    accepted the two-PR split. PR-7 is also the urgent one: POLICY F1's last sentence is false until it merges.
- **Both still wait on PR-4.** PR-4's last fix round owns `lib/feed.ts`, `app/me/following/*`, `app/me/liked/route.ts`,
  `app/card-gestures.tsx`, `lib/delete.ts` and `e2e/likes.spec.ts`.
- **PR-5a and PR-5b wait on PR-7 and PR-8.** PR-7 holds the gate PR-5 must call (G1, G3), and PR-8 the reset registry
  PR-5a must extend (G2). H1, H2 and H4 are cleared: H1 is applied in `bcaac14`, the owner accepted H2 with these
  guardrails as the mitigation, and H4 is approved with conditions.
- **Binding on PR-5's plan round, which I can't write myself.** I may edit only this file, so the additions C3 and C9
  make to `plan.md`'s PR-5a and PR-5b are recorded in §13. The orchestrator copies them into `plan.md`, or the PR-5
  plan round adopts them as the first items it settles.
- **The Privacy page PR** merges after PR-7 and PR-8. Its text has to match §7.
- **Urgency.** POLICY F1's last sentence ("A viewer can turn personal ordering off in Settings") is false on this branch
  until PR-7 merges. PR-4's review cites this plan.

Every PR follows these rules:
- ≤ 800 product lines.
- Tests are written first and fail before the code.
- Schema changes are additive and idempotent.
- No protected path is touched, and no dependency or vendor is added.
- The engineer reads `node_modules/next/dist/docs/` before using an API (AGENTS.md):
  - `01-getting-started/07-mutating-data.md` and `02-guides/forms.md`: server actions, no-JS submission and
    `refresh()`;
  - `02-guides/preserving-ui-state.md`;
  - React's `useActionState` with a server action, which shows the action's returned state before hydration.
- No test is weakened or deleted. §5 lists the pinned assertions the G6 decision makes obsolete. Each is rewritten,
  and the test count never drops.
- **e2e matrix (UX demand 11).** 320, 360 and 375 px; light and dark; with and without JS. On every new or changed
  view:
  - axe is clean;
  - there is no horizontal scroll (`scrollWidth ≤ clientWidth`);
  - keyboard-only use shows a visible ring at each stop;
  - `getAnimations()` is empty under reduced motion, and otherwise holds at most the 120 ms switch-knob change.

## 1. PR-7 · Feed controls (G1, G3, G4) · ~365 product lines

Branch `autopilot/feature-2-feed-controls`, database `stock_social_f2_controls`, ports 3110 and 3111.

### 1.1 Scope

**G1, the switch on `/settings` (UX items 1, 3, 4, 6).**
- **Stored state.** `users.personal_order_off boolean not null default false`. No timestamp, because we store the
  minimum (P3).
- **Server side.**
  - `lib/feed-settings.ts` (new):
    - `viewerFlags(viewer)` returns `{ orderOff, demo }` in one query (C1, below);
    - `setPersonalOrder(viewer, on)`;
    - the SQL fragment `recording(id)` = `not exists (select 1 from users where id = ${id} and personal_order_off)`.
      Each gated passive write appends it, so no extra round trip is needed.
  - `app/settings/actions.ts` (new): `setOrder(on)`, signed in only. It returns `{ ok, on }`. Without JS the form posts
    to `/settings` and the page renders again there through `refresh()`, with no query.
- **Order on `/settings` (UX item 1):**
  1. h1
  2. Sign out
  3. **h2 "Your feed"** (`id="your-feed"`, `tabIndex=-1`)
  4. the switch row, then both description lines
  5. [PR-8 adds the "Reset my feed" link here]
  6. the "Following and hidden traders" link
  7. h2 "Delete my profile"

  At 360×640 the switch is inside the first viewport.
- **The switch** (`app/settings/order-switch.tsx`, client):
  - `<button role="switch" aria-checked>` with `id`, inside a `<form>`. `<label for>` names it "Order my feed by my
    activity", and tapping the label toggles it.
  - The whole row is ≥ 44 px tall. At 320 the label wraps, and the switch keeps ≥ 44×44.
  - `aria-describedby` points to the two description lines.
  - "On" and "Off" are shown as text, so the state never depends on color.
  - Space and Enter toggle it, with a visible focus ring.
  - The knob doesn't move under reduced motion; otherwise it changes over at most 120 ms.
  - Text contrast is ≥ 4.5:1, and the track against its background is ≥ 3:1 **in both states and both themes**.
- **Both description lines are always shown (UX item 4).** "On: …" and "Off: …" are the lines' own labels, and the
  switch's text shows the current state.
- **The status line (UX item 3).**
  - An empty `role="status"` element is in the server HTML on load.
  - Its text is written only after `setOrder` resolves. The switch flips at once, so the < 100 ms feedback budget holds.
  - On failure, `aria-checked` reverts and the status reads `FOLLOW.failed`. The "saved" string never appears.
- **`lib/feed.ts#loadFeedPage`.** `viewerFlags` replaces the separate flag read, inside the existing `Promise.all`.
  With the switch off:
  - `prefs` is empty, so no demotion from an unfollow or from a reject's trader part applies;
  - hides still apply: "Not interested" traders and rejected trades;
  - the section leaves out only the viewer and their running "Not interested" traders, taken from the rows already
    loaded in `mine`;
  - with no hide, the viewer gets `kept.mixed`.

  The page result exposes `viewer.orderOff`.
- **A followed trader shows "Following" in the section (UX item 5, F-C).**
  - `followingAmong` is read for the page's card traders and the section's candidates together: `[...traders,
    ...candIds]`, in the same `Promise.all`.
  - `app/suggest-section.tsx` passes `following={page.viewer.following.has(r.userId)}`.
  - Tapping it unfollows, as it does on cards.
- **The section names its personal rules (UX item 2, F-B, F-D).**
  - When signed in with the switch on, the section shows `SECTION.personal` under `SECTION.explain`, then the link
    `SECTION.settings` "Feed settings" to `/settings#your-feed`. A fragment, not a query, so it meets G6.
  - A 3-line client effect on `/settings` focuses `#your-feed` when the hash names it, since browsers don't move
    `activeElement` to a fragment target on their own.
  - Signed out, or with the switch off, nothing new renders. Signed-out HTML stays byte-identical, under the existing
    guard.

**G1, recording nothing while the switch is off (owner, Q1 reversed; amended criterion).**

The rule: while the switch is off, no request writes anything except a deliberate action's own row. A deliberate action
here means follow, unfollow, like, unlike, a hide or Not interested and their undo, watch and unwatch, a thesis, a
reflection or rule, setting the switch, Reset, deletion, a prompt the viewer dismisses or acts on, and sign-in and
sign-out. Every passive write a signed-in reader causes today gets `recording(id)`, and the marker each one feeds is
**hidden rather than guessed** while the switch is off:

| Passive write today | Where | Gated in | Marker hidden while off |
|---|---|---|---|
| `ticker_watches.last_seen_at` (the owner's named case) | `app/t/[symbol]/Watch.tsx#markSeen` | the update statement | `/t` rows show no count line; `WATCH.markerOff` appears once under the h2, with "Feed settings" (round 3, below) |
| `sessions.last_seen_at`, hourly | `lib/auth/sessions.ts#userIdForSession` | the update statement (a join to `users`) | none: nothing reads it (checked: no reader in `app/` or `lib/`) |
| `users.record_first/last/prev_viewed_at`, `record_view_count` | `app/me/record/page.tsx` | both updates | the record page's "since your last visit" marker |
| `funnel_events` `own_profile_viewed` | `app/u/[handle]/page.tsx` | the call is skipped when `orderOff` | none |
| `share_prompt_seen_at`, `trades_prompt_seen_at` (on display) | `app/actions.ts#markSharePromptSeen`, `#markTradesPromptSeen` | the update statements | the new-trades prompt (it depends on the seen stamp). The share prompt keeps showing until the trader dismisses or uses it; that choice is a deliberate action and is stored |
| `share_image_saved_at`, `trade_shared_at`, and any other share or adoption stamp the guard finds (e.g. `badge_copied_at`) | `app/actions.ts` and wherever the guard finds them | the update statements | none |

- **Exempt, named (R1).** These are never gated, and T1.7's scan must not flag them:
  - funnel events written before sign-in (`landed`, `method_chosen`), since no account exists to read the switch from;
  - every funnel event the connection flow and its rate limit write: `portal_opened`, `link_succeeded`, `consented`,
    `declined`, `failed`, `abandoned`, `expired`, `import_finished`, `no_real_account`.

  Those connection events are security and integrity controls, not tracking: `lib/connections.ts:241-249` counts
  `portal_opened` rows to cap portal opens, and the error paths read `failed` / `abandoned` / `expired` (`:34`). T1.7
  holds this list as `EXEMPT_EVENTS`. Any other funnel event written while signed in must carry `recording(`.
- **Signed in with the switch off, `/connect`'s `notice_seen` is gated too.**
- **Watching a symbol while off** stores the watch row with `created_at` and `last_seen_at` at the moment of watching.
  That is the deliberate action's own row.
- **Turning the switch off clears every marker stamp (UX R2 demand 2).** This replaces round 2's "clears no existing
  stamp".
  - **The write.** `setOrder(false)`, in the same transaction as the flag:
    - sets `ticker_watches.last_seen_at = 'infinity'` for the viewer's watches (the column is `not null`; the tree
      already stores `'infinity'` for rejects);
    - nulls `users.record_first_viewed_at`, `record_last_viewed_at`, `record_prev_viewed_at` and
      `trades_prompt_seen_at`.
  - **Why at switch-off, not switch-on.** The viewer sees the same result after turning the switch back on. Clearing at
    switch-off also means the stale stamps aren't stored at all during the off period, which is the P3 minimum and the
    stricter option.
  - **Why `record_first_viewed_at` is nulled too.** `lib/insights.ts#visitDecision` falls back to it when `last` is
    null (`baseline: last ?? first`). Nulling only `last` and `prev` would count from the first visit ever, which is a
    guess.
  - **How the markers read the cleared values.** They treat them as "no marker", the way they treat a first visit:
    - `lib/ticker.ts#watchSummary` returns `newCount: null` for an invalid `lastSeenAt` (`'infinity'` reads as an
      invalid Date), and `/t` then shows no count line for that row. Without this the row would read "No new trades",
      which is a guess.
    - The record page's "Since your last visit" has no baseline, so it is hidden.
    - The profile's new-trades prompt has no seen stamp, so it takes its first-time path.
  - **After the switch is back on,** the next visit writes a real stamp, and each marker counts only from a visit
    recorded with the switch on.
  - **`record_view_count`** is kept (it is no marker input) and isn't incremented while the switch is off.
  - **Measurement cost, for the business lead to confirm.** Nulling `trades_prompt_seen_at` and
    `record_first_viewed_at` restarts the new-trades-prompt measure and the first-record-view measure for a viewer who
    turned the switch off. Their next stamp is written at their first visit with the switch on, so the measure counts
    them as first-time from then. The switch defaults on, so this touches only viewers who opted out, and those viewers
    asked not to be measured.
- **`/t` while off (UX R2 demand 3).**
  - Rendered only when the viewer is signed in, the switch is off, and they have at least one watch.
  - It shows `WATCH.markerOff` **once**, directly under the h2 "Your watched stocks", followed by `WATCH.settings`
    "Feed settings" to `/settings#your-feed`.
  - Rows show **no count line at all**: neither a count nor "No new trades".
- **`/me/record` while off (UX R2 demand 4).** `RECORD.markerOff`, then `RECORD.settings` "Feed settings" to
  `/settings#your-feed`, where the "Since your last visit" section would sit.
- **The profile's new-trades prompt** comes and goes on its own, so it gets no line of its own. `orderOffExplain`
  covers it (§6).
- **A static guard (T1.7)** keeps the list complete. Any SQL template under `app/` or `lib/` that writes a column in
  `PASSIVE_COLUMNS`, or inserts `own_profile_viewed` / `notice_seen`, must include `recording(`.
  `PASSIVE_COLUMNS` holds the columns above plus `badge_copied_at`. The `setOrder(false)` statements that clear stamps
  are exempt by name, because clearing is not recording.
- **C2's other condition, kept:** no file under `lib/feed.ts`, `lib/similar.ts` or `lib/discovery/**` reads
  `ticker_watches.last_seen_at`.

**G3, implicit signals off for real viewers (C1, C3).**
- **`lib/discovery/signals.ts`** (new, pure, added to `imports.test.ts` ROOTS):
  - `IMPLICIT_SIGNALS = false`, pinned;
  - `IMPLICIT_TYPES`;
  - `mayRecord({ demo, orderOff }, type)`: false for every type when `orderOff`; false for an implicit type unless
    `IMPLICIT_SIGNALS || demo`; true for the explicit types;
  - `usableTypes({ demo, orderOff })` for reads.
- **A constant, not an environment flag.** Turning it on needs a reviewed diff that edits the pinned test.
- **C1, demo defined positively, on the server.**
  - `demo` means the viewer has **at least one activity, and every one of them has `source = 'demo'`**.
  - It is read by `viewerFlags` with the session's id, never from request input:
    `exists(select 1 from activities where user_id = $1) and not exists(select 1 from activities where user_id = $1
    and source <> 'demo')`, from the `activities_user_time` index.
  - A viewer with no broker is therefore **not** demo.
  - Today only PR-5's paths need `demo`. The feed reads `orderOff` from the same row, so no query is added to the hot
    path (T3.4 checks the plan).
- **The +2 opening-swipe weight.** It stays pinned in `weights.ts`. While G3 holds, it applies to demo viewers only.

**G4, deletion copy and first step (UX item 9; it supersedes C6's three sentences, as the coordinator directed).**
- `SETTINGS.deleteLead` "Deleting removes:" leads a `<ul>` from `SETTINGS.deleteItems` in view 1. Then
  `SETTINGS.deleteAfter`, the handle-and-backups sentence. Copy is in §6.
- `lib/delete.ts`'s first step gains `delete from ticker_watches where user_id = ${u.id}`.

**Test hardening (D13).** `lib/feed.signed-out.test.ts` `VIEWER_TABLES` gains `trade_rejects`, `ticker_watches` and
`personal_order_off`.

### 1.2 Files PR-7 expects to touch

Product:
- `db/schema.sql` (append)
- `lib/discovery/signals.ts` (new)
- `lib/feed-settings.ts` (new)
- `lib/feed.ts`
- `lib/delete.ts`
- `lib/auth/sessions.ts` (the `last_seen_at` gate only)
- `lib/copy.ts` (`SETTINGS`, `SECTION`, new `WATCH`; `allCopy`)
- `app/settings/page.tsx`
- `app/settings/order-switch.tsx` (new)
- `app/settings/actions.ts` (new)
- `app/settings/focus-hash.tsx` (new)
- `app/suggest-section.tsx`
- `lib/ticker.ts` (`watchSummary`: `newCount: null` for a cleared stamp)
- `app/t/page.tsx` (the off line, and no count line for a cleared row)
- `app/t/[symbol]/Watch.tsx` (`markSeen` only)
- `app/me/record/page.tsx` (the gates and `RECORD.markerOff`)
- `app/u/[handle]/page.tsx` (the funnel call and the trades-prompt condition only)
- `app/actions.ts` (the measurement stamps only)
- `app/connect/page.tsx` (`notice_seen` only)
- `app/globals.css` (append)

Tests:
- `lib/discovery/signals.test.ts` (new)
- `lib/discovery/imports.test.ts`
- `lib/feed.order-off.test.ts` (new)
- `lib/recording.test.ts` (new)
- `lib/feed.signed-out.test.ts`
- `lib/delete.test.ts`
- `lib/copy.test.ts`
- `lib/ticker.test.ts` (the `newCount: null` case)
- `lib/connections.test.ts` (R1: the portal-open cap with the switch off)
- `lib/auth/sessions.test.ts` (R3: a switch-off case added beside `:44-45`, which stays unchanged)
- `e2e/settings.spec.ts` (new)
- `e2e/section.spec.ts` (the section line and the following-state cases)
- `e2e/markers.spec.ts` (new: T1.4)

### 1.3 Tests first

| Criterion | Test | Kind |
|---|---|---|
| **G1** · off → feed and section equal the signed-out order minus own hides | **T1.1.** (a) A switch-off viewer with no hides gets pages 1 to 3 and the section equal to the signed-out ones, with the viewer left out. (b) Viewer A is switched off with 3 follows, 2 unfollows, 3 rejects and 1 Not interested. A gets the same pages and section as B, who has only the same hides and the switch off. A followed trader of A's sits in A's section exactly where it sits signed out, **and its button reads "Following", `aria-pressed="true"`** (UX item 5). | DB + e2e |
| G1 · the switch matters | **T1.2.** A with the switch on gets a different order. Off then on round-trips. | DB |
| **G1** · no activity recorded (amended criterion, Q1 reversed) | **T1.3.** A query-logging client watches a switch-off viewer render: feed pages 1 to 3; another trader's profile, pane, trade page and Similar trades; their own profile and `/me/record`; `/t`; **`/t/<sym>` for a watched and for an unwatched symbol**; `/me/following`; `/settings`; `/connect`. **Every `insert`, `update` and `delete` fails the test.** No write is allowed, `sessions.last_seen_at` included (the session is older than an hour, so the update would otherwise run). **R3:** `lib/auth/sessions.test.ts:44-45` stays unchanged and passes with the switch on, the default. The switch-off case is a new test beside it: with the switch off, a lookup two hours later leaves `last_seen_at` unchanged. The file's test count goes up by one. | DB, `lib/recording.test.ts`, `lib/auth/sessions.test.ts` |
| G1 · the connection flow's controls still work (R1) | **T1.10.** With the switch off, the portal-open cap trips at its existing limit: open the portal up to the cap and the next open is refused, as with the switch on. `failed`, `abandoned` and `expired` rows are still written on their paths. The build log records that the test was run. | DB, `lib/connections.test.ts` |
| G1 · `/t/<sym>` writes nothing (owner's named test) | **T1.3a.** The switch is off and the viewer watches the symbol, with a backdated `last_seen_at`. Rendering `/t/<sym>` leaves `ticker_watches` byte-identical. With the switch on, it updates. | DB |
| G1 · markers hidden, not guessed, off and after (UX R2 demands 2 to 4) | **T1.4**, `e2e/markers.spec.ts`, full matrix. **While off:** `/t` (signed in, ≥ 1 watch) has exactly one `WATCH.markerOff`, directly under "Your watched stocks", followed by "Feed settings" → `/settings#your-feed`. There is no "No new trades" and no "since you last looked" on any row, and no horizontal scroll at 320, 360 or 375. A viewer with no watches gets no line. `/me/record` shows `RECORD.markerOff` and "Feed settings" in place of "Since your last visit". The own profile shows no new-trades prompt. **After switching back on:** a trade in a watched symbol closes; the viewer turns the switch off, opens `/t/<sym>`, turns it on and opens `/t`. **No count line appears on that row.** Then a new trade closes, the viewer opens `/t/<sym>` and then `/t`, and the count is **1**. The same sequence runs on `/me/record` (no "Since your last visit" until a visit recorded with the switch on, then one fresh trade) and on the profile prompt (first-time path, then one new trade). **DB half:** after `setOrder(false)`, the viewer's `ticker_watches.last_seen_at` are `'infinity'`, the four `users` stamps are null, and another viewer's are unchanged. `watchSummary` returns `newCount: null` for an invalid date (`lib/ticker.test.ts`). The strings are imported from `WATCH` and `RECORD`. | e2e + DB + unit |
| G1 · passive actions write nothing | **T1.6.** With the switch off, `markSharePromptSeen`, `markTradesPromptSeen`, `markShareImageSaved`, `recordTradeShared` and the badge-copy stamp each leave `users` unchanged. A deliberate action (follow, watch, dismissing the share prompt) still writes its own row. | DB |
| G1 · the list stays complete | **T1.7.** Static: every SQL template writing a `PASSIVE_COLUMNS` column, or inserting `own_profile_viewed` / `notice_seen`, contains `recording(`. No file in `lib/feed.ts`, `lib/similar.ts` or `lib/discovery/**` reads `ticker_watches.last_seen_at` (C2). **R1:** the scan doesn't flag the `EXEMPT_EVENTS` list (§1.1), and the test asserts that list exactly, so an event can't be added to it silently. The `setOrder(false)` clearing statements are exempt by name. | unit |
| G1 · on by default | **T1.8.** A new account reads `personal_order_off = false`, and `/settings` shows "On" with `aria-checked="true"`. | DB + e2e |
| G1 · the switch UI | **T1.5**, `e2e/settings.spec.ts`, full matrix. **DOM order** as in §1.1. At 360×640 the switch is in the first viewport. **Accessibility tree:** name "Order my feed by my activity", checked true or false, and the description. **Label tap** flips it. The row is ≥ 44 px, and at 320 the switch is ≥ 44×44. **Status:** `[role=status]` is present and empty on load; with the action delayed 700 ms it stays empty until the reply; a forced failure reverts the switch and never shows a saved string. **Both explain lines** are rendered in both states. **Contrast:** the off-state track is ≥ 3:1 against the page in both themes. **No-JS:** the form posts and `/settings` renders again with the new state, with no query. **A second tab** that changed the switch causes no duplicated card in the first tab's feed (UX item 7). | e2e |
| G1 · section line (UX item 2) | **T1.9.** With the switch on, signed in: `SECTION.personal` and "Feed settings" are present. Following the link makes `#your-feed` the active element, and the next Tab reaches the switch. With the switch off or signed out, neither is present, and signed-out page-1 HTML is byte-identical to before PR-7. Two taps reach the switch from the feed. | e2e |
| **G3** | **T3.1:** `IMPLICIT_SIGNALS === false`. **T3.2:** the `mayRecord` / `usableTypes` matrix. **C1:** `viewerFlags` returns `demo: false` for a viewer with zero activities, one with only `snaptrade` activities and one with mixed sources, and `demo: true` only for all-`demo`. For each non-demo case `mayRecord(implicit) === false`. **T3.3 (C3, behavioral scope):** every SQL template matching `insert into discovery_events` or a `select … from discovery_events`, and the file `app/api/events/route.ts` if it exists, imports `mayRecord` or `usableTypes`. The named allow-list `lib/delete.ts`, `lib/discovery/purge.ts`, `lib/likes.ts#resetFeed` is exempt, and the test prints the list. **T3.4:** `explain` of the `viewerFlags` query uses `users_pkey` and an `activities_user_*` index, with no seq scan. | unit + DB |
| **G4** · the screen names what it deletes | **T4.1** (UX item 9's regexes, read through `SETTINGS`): `/follows/`, `/likes/`, `/hid/`, `/unfollowed/`, `/watchlist/`, `/reading activity/`, `/backups/`. View 1 renders a `<ul>`, with no horizontal scroll at 320. | unit + e2e |
| G4 · watchlist in the first step | **T4.2.** The vendor call throws, and the viewer has zero `ticker_watches` rows. Another account's watchlist is unchanged. | DB |
| Heavy use | **T7.L** (`LOAD=1`). A switch-off viewer with no hides has a p95 no more than the signed-out p95 plus 20 ms. `viewerFlags` takes < 2 ms for a trader with 10,000 activities. | load |

## 2. PR-8 · Reachable and unlogged (G2, G5, G6) · ~390 product lines

Branch `autopilot/feature-2-reach`, from PR-7's merge commit. Database `stock_social_f2_reach`, ports 3120 and 3121.

### 2.1 Scope

**G2, Reset in Settings → "Your feed", with its confirmation at `/settings/reset` (UX demand 1, items 11 to 13).**
- **`resetFeed(viewer)`** in `lib/likes.ts` runs one transaction:
  - `delete from trade_rejects where viewer_id = ${viewer}`;
  - `clearUnfollowNotes(viewer, tx)` in `lib/follows.ts`.

  It keeps follows, likes, Not interested and the watchlist.
- **The reset registry.** `RESET_DELETES` and `RESET_KEEPS` are as in round 1. T2.4 forces every `viewer_id` table into
  one of them.
- **Entry points.**
  - The Settings link "Reset my feed" (secondary style) sits right below the switch's description lines, as one line in
    `app/settings/page.tsx`.
  - `/me/following` gets one link to `/settings/reset`, **right after the Not interested list and before Liked
    records**, never after the liked list.
- **The confirmation page `/settings/reset`** (`page.tsx` server, signed in, `noindex`; `reset-form.tsx` client;
  `actions.ts`):
  - The h1 "Reset my feed" takes focus on load.
  - It shows `RESET.explain`, then "This cannot be undone.", the primary "Reset my feed" and the secondary `RESET.keep`
    "Don’t reset", which goes to `/settings`.
  - No counts.
- **The done state renders at the same URL.**
  - `useActionState`, with JS and without. The POST goes to `/settings/reset`, the page the action was taken on.
  - The explanation and both buttons are replaced by a focused `role="status"` "Your feed is reset." (`tabIndex=-1`),
    plus "Back to Settings" (`/settings`) and "Go to the feed" (`/`).
  - No Reset button remains.
  - The primary is `aria-disabled` while pending, so a double click sends one POST.
  - There is no celebration: text only, no motion.

**G5, every like reachable (C4a, UX items 14 and 15).**
- **`ownLikes(viewer, page)`:** a left join, `created_at desc, trade_key`, pages of 200 plus one look-ahead row.
- **Paging by `?likes=<n>#liked`.**
  - A non-numeric, ≤ 0 or > 10^6 value renders **page 1**.
  - A valid number past the last page renders **"No older likes."** with "Newer likes".
  - Each input has one outcome (C4a).
- **Unlike keeps page *n*.**
  - Without JS, `unlikeForm`'s `refresh()` renders `/me/following?likes=n` again.
  - With JS, the row is removed and PR-4's focus rule holds.
  - A page that becomes empty shows "No older likes." and keeps "Newer likes".
- **Arriving by paging.** The `#liked` heading is in view, and the next Tab reaches the first liked row's link.
- **Where the links sit.** "Older likes" is at the end of the list. On pages > 1, "Newer likes" is at both its start and
  its end. All are ≥ 44 px.
- **A removed trade.** `LIKES.gone(h)` "This trade is no longer in @h’s record." The row has **no link to a trade page**,
  `@h` links to `/u/h`, and Unlike has the accessible name `LIKES.unlikeGone(h)`. At 360 the line wraps and never
  truncates the handle.

**G6, no action or handle in a URL (C4b, C7, UX items 16 to 19).**
- **`/me/liked`** takes POST only, with the body `{ k: [...] }`, at most 60 keys, validated. Signed out it returns `[]`.
  A GET gets 405. `card-gestures.tsx` sends a POST.
- **Profile forms** (`from: 'profile'`): `refresh()` renders `/u/<h>` again. The line comes from
  `recentAction(viewer, trader)`, which reads this viewer's own rows from the last 60 s.
- **Section and pane forms** (`from` defaults to `'list'`, so `suggest-section.tsx` and `pane.tsx` don't change) and
  `showAgainForm` redirect to `/me/following`, which has no query.
  - Its existing `role="status"` line shows the confirmation for the viewer's most recent action in the last 60 s:
    `lastAction(viewer)` returns `FOLLOW.followed`, `.first`, `.hiddenFrom`, `.unfollowed` or `.back`.
  - Next to it is `FOLLOW.backToFeed` "Back to the feed" (`/`). `lastShownAgain` folds into `lastAction`.
- **Exactly one confirmation (C7).**
  - On the profile and on `/me/following`, the server line renders inside the **same** `role="status"` element the
    client writes to.
  - With JS, the client replaces that element's text and never adds a second element, so the line is announced once.
- **Watch cap (UX item 18).**
  - `toggleWatch` redirects to `/t/<sym>` with no `?watch=`.
  - The cap line is plain text with an `id` on load, and the Watch button has `aria-describedby` pointing to it.
  - With JS, a tap at the cap is caught by `watch-cap.tsx` (client), which writes the same text into a `role="status"`
    region. Nothing is posted, since the server would refuse.
- **Expired sessions.** `purgeExpiredSessions` runs in the tick after `purgeExpiredLinks`, in a `try`, ≤ 5 s per call,
  in batches of 10,000, on a new index `sessions (expires_at)`. It needs IMPLEMENTATION item #7 to be scheduled.
- **The rule T6.1 enforces (C4b).**
  - A viewer action may lead only to: the page it was taken on; `/`, `/me/following`, `/settings` or `/settings/reset`;
    or `/_next/…`.
  - URLs are compared **by path**. The only query keys allowed are:
    - the framework's router key `_rsc`;
    - **`likes`, digits only (`^[0-9]+$`), on `/me/following` only** (UX R2 demand 1), and only where it equals the
      `likes` value of the page the action was taken on, or comes from the "Older likes" or "Newer likes" link.
  - The only fragments allowed are `#liked` and `#your-feed`.
  - Any other query key fails, as do `done`, `first`, `back`, `k`, `watch` and a 64-hex key anywhere in the URL.
  - Reading a public page by its own path is allowed (`/u/<h>`, `/u/<h>/pane`, `/u/<h>/trade/<id>`, `/t/<sym>`, and
    `/login?next=` set to the page already loaded).
  - This definition is written into `docs/specs/` for the build, so the test can't be loosened to let a framework
    request pass. The reviewer re-runs T6.1 with `?done=` reintroduced, and it must fail.

### 2.2 Files PR-8 expects to touch

Product:
- `db/schema.sql` (append)
- `lib/likes.ts`
- `lib/follows.ts`
- `lib/auth/sessions.ts` (the purge)
- `lib/copy.ts` (`FOLLOW`, `LIKES`, new `RESET`; `allCopy`)
- `app/discovery-actions.ts`
- `app/follow-button.tsx`
- `app/not-interested.tsx`
- `app/u/[handle]/page.tsx`
- `app/u/[handle]/similar-section.tsx`
- `app/settings/page.tsx` (one line)
- `app/settings/reset/page.tsx` (new)
- `app/settings/reset/reset-form.tsx` (new)
- `app/settings/reset/actions.ts` (new)
- `app/me/following/page.tsx`
- `app/me/following/liked-list.tsx`
- `app/me/liked/route.ts`
- `app/card-gestures.tsx`
- `app/t/[symbol]/Watch.tsx`
- `app/t/[symbol]/watch-cap.tsx` (new)
- `app/t/[symbol]/page.tsx`
- `app/actions.ts` (`toggleWatch` only)
- `app/api/sync/route.ts`
- `app/globals.css` (append)

Tests:
- `lib/likes.test.ts`
- `lib/follows.test.ts`
- `lib/auth/sessions.test.ts`
- `lib/reset.test.ts` (new)
- `e2e/likes.spec.ts`
- `e2e/follow.spec.ts`
- `e2e/section.spec.ts`
- `e2e/reset.spec.ts` (new)
- `e2e/urls.spec.ts` (new)
- `e2e/settings.spec.ts` (the Reset link's DOM position)

### 2.3 Tests first

| Criterion | Test | Kind |
|---|---|---|
| **G2** · zero hides and notes for that viewer, nothing for others | **T2.1.** As in round 1. A's rejects (running, ended, `'infinity'`) and unfollow notes go to zero. Not interested, follows and likes are unchanged. B's rows are unchanged row for row. A third viewer still has none. | DB |
| G2 · confirmed, signed in | **T2.2.** Signed out, it does nothing and goes to `/login`. It takes no argument. It is reachable only through `/settings/reset`. | DB + e2e |
| G2 · UI | **T2.3**, `e2e/reset.spec.ts`, full matrix. Hide a trade and unfollow, then Settings → Reset → confirm. **The response is at `/settings/reset`, with no query, shows `RESET.done` and has no Reset button.** With JS, `activeElement` is the status line. A double click sends one POST. "Don’t reset" lands on `/settings`, with the viewer's rows unchanged. On page 1 of the feed, the trade is back and the demotion is gone. No rendered card is duplicated in a feed tab that was already open. | e2e |
| G2 · placement | **T2.5.** In Settings, the Reset link comes after the switch's description and before "Following and hidden traders". On `/me/following`, the reset link comes before `#liked` in the DOM. With 200 likes, its top is above `#liked`'s. | e2e |
| G2 · PR-5 can't skip it | **T2.4.** Every `viewer_id` table is in `RESET_DELETES` or `RESET_KEEPS`. | unit |
| **G5** · paging past 200 | **T5.1.** 450 likes, 3 of them on removed trades. Pages 1 to 3 list each like once, newest first. The removed ones have `gone: true` and a handle. Unlike on a gone row deletes it. | DB |
| G5 · UI | **T5.2**, full matrix. "Older likes" and "Newer likes" work, and are placed as in §2.1. **`?likes=abc`, `?likes=0` and `?likes=9999999` each render page 1. `?likes=4` with 450 likes renders "No older likes." with "Newer likes".** Unliking the last row of page 3 keeps the path at `/me/following?likes=3`, with and without JS. After paging, the next Tab reaches the first row's link. A gone row has no `a[href*="/trade/"]`, has one `a[href="/u/h"]`, and its button's name equals `LIKES.unlikeGone(h)`. At 360, `scrollWidth ≤ clientWidth` on the row. | e2e |
| **G6** · no URL carries an action target or handle | **T6.1**, `e2e/urls.spec.ts`. The C4b rule with UX R2 demand 1's two allowances, with and without JS. It passes on Unlike on page 2 (`/me/following?likes=2#liked`). It fails when `?done=` is reintroduced, when `likes=abc` appears, and when `likes=2` appears on any other path. It runs over every viewer action: follow, unfollow and Not interested from the profile, a section row and the pane; Show again; like and unlike; hide this trade and its Undo; Unlike on page 2; watch, unwatch and watch at the cap; the switch; Reset. | e2e |
| G6 · the liked lookup | **T6.2.** A GET gets 405. A POST validates keys, caps at 60, keys the read to the session, and returns `[]` signed out with no query run. **The PR-4 heart check over POST (UX item 19):** with `POST /me/liked` delayed 700 ms, a liked card never shows ♡ before ♥. | e2e + DB |
| G6 · confirmations from state | **T6.3.** `recentAction` and `lastAction` show 59 s and not 61 s, the viewer's own rows only, and nothing for another viewer within 60 s. **C7:** after a JS follow on the profile, exactly one `role="status"` element carries "Following @h.", announced once, and the same holds on `/me/following`. **UX item 17:** with JS off, Not interested from a section row lands on `/me/following` with no query; the status reads `FOLLOW.hiddenFrom(h)`; "Back to the feed" is present; the trader is listed with "Show again". | DB + e2e |
| G6 · watch cap | **T6.5.** At `WATCH_CAP` on an unwatched symbol, the line is visible on load, the button's description equals the cap message, and no URL has `watch=`. With JS, a tap fills a `role="status"` region and sends no POST. | e2e |
| G6 · expired sessions purged | **T6.4.** As in round 1: the boundary at `now`, the time box and the route placement. | DB |
| Heavy use | **T8.L.** As in round 1: reset < 300 ms; 5,000 likes page 25 at p95 < 300 ms; `POST /me/liked` p95 < 50 ms; 1 M expired sessions drain in ≤ 20 ticks. | load |

## 3. Independence test (IMPLEMENTATION "Parallel development")

| Rule | PR-7 vs PR-8 | Either vs PR-4 | Either vs the Privacy PR |
|---|---|---|---|
| 1 Waits on | PR-8 waits on PR-7 (result of rule 2) | Both wait on PR-4 | The Privacy PR waits on both |
| 2 File sets | **Fail:** `app/settings/page.tsx`, `app/t/[symbol]/Watch.tsx`, `app/u/[handle]/page.tsx`, `app/actions.ts`, `lib/auth/sessions.ts`, `e2e/section.spec.ts`, `e2e/settings.spec.ts` are in both. The shared append-mostly files (`db/schema.sql`, `lib/copy.ts`, `app/globals.css`) would be fine. | Overlap | `lib/copy.ts` only (append; the second to merge resolves the `allCopy` line) |
| 3 Schema | Different tables: a `users` column vs a `sessions` index | — | none |
| 4 Pinned behavior | Only PR-7 moves the ranking | — | — |
| 5 Protected paths or owner stops | none | — | — |

**Result:** PR-7 goes first and PR-8 builds from its merge. Number order decides it.

## 4. Schema (additive only)

```sql
-- PR-7 (G1): false = "Order my feed by my activity" on (the default); no timestamp (P3).
select schema_add_column('users', 'personal_order_off', 'boolean not null default false');
-- PR-8 (G6): the expired-session purge walks this index in batches.
select schema_add_index('sessions_expires', 'create index sessions_expires on sessions (expires_at)');
```

- **Optional, only if T8.L misses:** `trade_likes (viewer_id, created_at desc)`.
- No new table. No `drop`, `truncate` or `delete from`.
- **Known bound, as in round 1.** After a Reset or a switch change, an already open feed tab may repeat cards, which
  the pager drops, or skip a few. The next page 1 is exact. Tested in T1.5 and T2.3.

## 5. Pinned assertions the G6 decision makes obsolete (rewritten, never deleted)

| Where | Today | Rewritten to |
|---|---|---|
| `e2e/follow.spec.ts:133` | no-JS follow → `/u/<h>?done=follow` | `/u/<h>` with no query; one status line reads "Following @h." |
| `e2e/follow.spec.ts:137` | a crafted `?done=unfollow` claims nothing | another viewer within 60 s sees no line |
| `e2e/section.spec.ts:424` | → `/u/<x>?done=hidden` | → `/me/following` with no query; the status reads `FOLLOW.hiddenFrom(x)`; listed with Show again |
| `e2e/likes.spec.ts:143,154,349` | `GET /me/liked?k=` | `POST /me/liked`; GET → 405 |
| `lib/follows.test.ts:238` | "@x is back" via `?back=x` | via `lastAction(viewer)`, same 60-second rule |
| `LIKES.capped` assertions | "Showing your 200 most recent likes." | "Older likes" on a viewer with 201 likes |

## 6. Copy (scanned)

All of it goes in `lib/copy.ts` objects listed in `allCopy()`. That runs it through `PROMO`, `BANNED` and
`SUGGESTION_WORDS`. I checked every string against them. None contains a banned word, a completeness claim, a count, a
ticker slot, or the claim that nothing is recorded. The amended criterion makes "no activity recorded" true by test,
but the host's request logs still record the addresses of pages opened. That sentence belongs in the Privacy text
(§7), not here. The tests import the strings rather than repeating them. C6 and C8 use the UX lead's wording.

**PR-7.**
- **`SETTINGS`:**
  - `feedTitle` "Your feed"
  - `orderLabel` "Order my feed by my activity"
  - `on` "On"
  - `off` "Off"
  - `orderOnExplain` "On: traders you unfollowed, or whose trades you hid, appear a little lower in your feed and
    suggestions, and suggestions leave out traders you follow."
  - `orderOffExplain` "Off: your feed and suggestions use the order everyone sees signed out, minus the traders and
    trades you hid. Your watchlist and record don’t show what’s new since your last visit. Nothing you follow, like or
    hide is deleted." (Round 3, UX R2.3.)
  - `orderSavedOn` "Saved. Your feed is ordered by your activity again."
  - `orderSavedOff` "Saved. Your feed now uses the order everyone sees signed out."
  - `deleteLead` "Deleting removes:"
  - `deleteItems`:
    - "your profile, record and sign-in details"
    - "the brokerage link at the vendor"
    - "your follows, likes and watchlist"
    - "the traders and trades you hid, and our note of who you unfollowed"
    - "any reading activity we stored"
  - `deleteAfter` "Your handle is held for a year. Copies in our backups remain until those backups are replaced."
- **`SECTION`:**
  - `personal` "Traders you unfollowed, or whose trades you hid, are placed a little lower, and traders you follow are
    left out."
  - `settings` "Feed settings"
- **`WATCH`** (new; round 3, the UX lead's exact words):
  - `markerOff` "New closed trades since you last looked aren’t shown while “Order my feed by my activity” is off."
  - `settings` "Feed settings" (to `/settings#your-feed`)
- **`RECORD`** (new, in `allCopy`):
  - `markerOff` "“Since your last visit” isn’t shown while “Order my feed by my activity” is off."
  - `settings` "Feed settings" (to `/settings#your-feed`)

**PR-8.**
- **`RESET`:**
  - `heading` "Reset my feed"
  - `explain` "Deletes the trades you hid and our note of who you unfollowed, so those trades can show again and those
    traders are no longer placed lower. Your follows, likes, “Not interested” list and watchlist stay." PR-5a appends
    its sentence.
  - `confirm` "This cannot be undone."
  - `action` "Reset my feed"
  - `keep` "Don’t reset"
  - `done` "Your feed is reset."
  - `backToSettings` "Back to Settings"
  - `toFeed` "Go to the feed"
- **`LIKES`:**
  - `gone(h)` "This trade is no longer in @h’s record."
  - `unlikeGone(h)` "Unlike a trade no longer in @h’s record"
  - `older` "Older likes"
  - `newer` "Newer likes"
  - `noneOlder` "No older likes."
- **`FOLLOW`:** `backToFeed` "Back to the feed".

## 7. What the Privacy page PR must state (it merges after PR-7 and PR-8)

Packet §3 Part A and Part B, with the bracketed G1 to G6 lines filled in, and these changes:
1. **Request logs:** replace "a few of those addresses show an action, …" with "Those addresses show which pages you
   opened, not what you did on them."
2. **Likes:** "Your Liked records list shows every like, each with Unlike, which deletes it at once."
3. **Sessions:**
   - "Ended sessions are deleted by our regular clean-up."
   - The last-use sentence gains: "While “Order my feed by my activity” is off, we don't record when you last used the
     app."
4. **Deletion:** the watchlist moves into the first sentence.
5. **Follows (C5):** "While “Order my feed by my activity” is on, followed traders are left out of your suggestions,
   since you already follow them."
6. **Watchlist (owner, Q1 reversed):** "We store which symbols you watch, when you added each, and when you last opened
   each symbol's page. When you turn “Order my feed by my activity” off, we delete those last-opened times and stop
   recording when you open a symbol's page, and the watchlist doesn't show what's new since you last looked until you
   open a symbol's page with it back on."
7. **Opt-out:** Part B's bracketed line, plus a Part A line:
   - "With “Order my feed by my activity” off, your follows, unfollows and hidden trades don't change the order of your
     feed or suggestions (what you hid stays hidden). We record nothing about what you do in the app beyond the choices
     you make, such as follows, likes, hides and your watchlist."
   - The "beyond the choices you make" clause is needed because request logs are covered in item 1 and the explicit
     choices stay stored.
8. **Outside Part A, for the owner's broader policy:** the trader's own record-view counters and prompt stamps also stop
   while the switch is off. Turning the switch off deletes the record's visit times and the new-trades prompt's seen
   time (§1.1). The connection flow's own records (§1.1, R1) keep being written, because they enforce its limits.

The Privacy PR's reviewer checks every sentence against PR-7 and PR-8 as merged.

## 8. Owner questions

None open.
- **Q1 is answered and reversed.** With the switch off, nothing about the viewer's activity is recorded, and the
  watchlist marker is hidden. §1.1 applies that to every passive write the tree makes today: the watch stamp, session
  last use, own-record views, the own-profile funnel event, prompt-seen and share stamps.
- **If the owner wants a narrower reading** (only the watch stamp and PR-5's events), the change is to drop rows from
  §1.1's table and their T1.3 pages. About −20 lines.
- **Standing:** O3 (hide duration) is still open, default 90 days, and doesn't change this plan.
- **Owner action:** schedule IMPLEMENTATION item #7.

## 9. Accessibility (POLICY A1, WCAG 2.2 AA)

- **The switch (G1).** As §1.1:
  - name from `<label for>`, description through `aria-describedby`;
  - state shown as text;
  - the row ≥ 44 px and the switch ≥ 44×44 at 320;
  - Space and Enter toggle it, with a visible ring;
  - a status that speaks only what the server confirmed, with its element present on load;
  - reduced motion respected;
  - text ≥ 4.5:1 and the track ≥ 3:1 in both states and both themes.
- **The section line:** a link with visible text. `#your-feed` takes focus.
- **Reset:** the h1 takes focus on load. After the reset, focus moves to the status line. The primary is `aria-disabled`
  while pending. Both actions are ≥ 44 px and named by their text. It works without JS.
- **Liked records:** paging links ≥ 44 px, at the end, and at the start on pages > 1. Focus and Tab order are handled
  after paging. A gone row's Unlike has a distinct name that starts with the visible "Unlike" (WCAG 2.5.3), and the
  row is marked by text, not dimming.
- **Confirmations:** exactly one `role="status"` per page (C7).
- **Watch cap:** a static description on load, and `role="status"` only after a tap.
- **Every view:** the §0 e2e matrix (320, 360, 375; axe; no horizontal scroll; animations).

## 10. Performance budgets

| Budget | Value | Test |
|---|---|---|
| Signed-in feed, switch on | p95 < 800 ms. `viewerFlags` is one PK read in the existing `Promise.all`; the demo probes are index-only | existing load test, T3.4 |
| Signed-in feed, switch off, no hides | ≤ signed-out p95 + 20 ms | T7.L |
| `viewerFlags` | < 2 ms for a trader with 10,000 activities | T7.L |
| Switch tap to feedback | < 100 ms (it flips at once; the status waits for the server) | T1.5 |
| Passive-write gate | 0 extra round trips (a fragment inside each statement) | T1.3 |
| Reset (10,000 rejects + 5,000 notes) | < 300 ms | T8.L |
| `/me/following`, 5,000 likes, page 25 | p95 < 300 ms | T8.L |
| `POST /me/liked`, 60 keys | p95 < 50 ms | T8.L |
| Session purge | ≤ 5 s a tick; 1 M rows in ≤ 20 ticks; 0 live rows touched | T8.L |

## 11. Compliance checklist (COMPLIANCE §1)

1. **Performance.**
   - G1 only removes demotions, and it reads no return.
   - No new number is shown, and the new pages show no return.
   - F1's opt-out sentence becomes true with PR-7.
2. **Personal data.**
   - **New:** `users.personal_order_off`.
   - **Less is recorded:** with the switch off, every passive write stops: the watch stamp, session last use,
     own-record views, the own-profile funnel event, and prompt and share stamps.
   - **Removed on demand:** trade hides and unfollow notes (G2).
   - **Removed by the tick:** expired sessions (G6).
   - **Moved:** the watchlist goes into deletion's first step (G4).
   - **Out of URLs:** actions (G6).
   - The Privacy PR's text must match §7. Retention lines depend on item #7.
3. **Money:** none.
4. **Email, push, SMS, tracking:** less tracking. G3 is a pinned constant, `demo` is defined positively (C1), and there
   is no third party.
5. **User text:** none new.
6. **Accounts:** deletion gains one table in its first step. No sign-up change.
7. **Vendor, dependency or asset:** none.
8. **Screen reader and keyboard:** §9.
9. **Security:**
   - Every action is session-bound and takes no target argument.
   - `/me/liked` is POST only.
   - The purge runs under the cron bearer.
   - `?likes=` is validated.
   - `demo` comes only from the database.
10. **Claims:**
    - Every string is true of the code as built.
    - No copy claims that nothing is recorded; the Privacy text carries the exact claim, with request logs named.
    - PR-5b rewrites `orderOnExplain` and `SECTION.personal`.
11. **Checkout:** none.

## 12. Policy checks for both PRs

- **Privacy:** no counts anywhere.
- **TR-1:** a hide never touches a profile.
- **Signed out:** unchanged, with the guard stricter.
- **No celebration:** none on the switch, Reset or likes (F6).
- **G3:** a pinned constant.
- **Opting out is complete:** the switch off records nothing beyond deliberate choices.

## 13. Binding additions to `plan.md` PR-5a and PR-5b (C3, C9, the Q1 reversal)

I can edit only this file. **R2 (round 3):** the PR-5 amendment of `plan.md` adopts these items, and PR-5's plan isn't
signed without them. The reviewer verifies this in `plan.md`. Also for PR-5b's plan round, from the UX lead's R2.4
note: decide whether a switched-off viewer gets a bare "Feed settings" link under the section. It is not a reason
line, so it fits C9.
- **PR-5a tests (C3).** A non-demo viewer POSTing each implicit type to `/api/events` stores 0 rows. Implicit demo rows
  seeded for a real viewer are absent from that viewer's `viewerProfile` input. A switch-off viewer POSTing any type,
  explicit share included, stores 0 rows. A switch-off viewer's explicit actions write their state row and no
  `discovery_events` row.
- **PR-5a:** `discovery_events` goes into `RESET_DELETES` (T2.4 fails until it does) and into deletion's first step.
  `RESET.explain` gains its sentence.
- **PR-5b (C9).** With the switch off, the section keeps the signed-out heading and explanation, with no personal reason
  line. PR-5b rewrites `orderOnExplain` and `SECTION.personal` once follows and likes order the feed (T1.5 and T1.9 pin
  the strings).

## Sign-off

Engineer: **SIGNED** 2026-10-25 (round 3). I would stake my name on building PR-7 and then PR-8 as written, with every
criterion G1 to G6 (G1 as amended) mapped to a test in §1.3 and §2.3.

Business lead: SIGNED round 2 with R1 to R3. All three are applied in round 3. Please confirm one point: clearing the
stamps when the switch goes off restarts the new-trades-prompt and first-record-view measures for viewers who opt out
(§1.1).

UX lead: REVISE in round 2. All four demands are applied in round 3. The UX lead said a confirmation without a full
re-sit would do.

SIGNED: engineer. PENDING: business lead (confirm the measure point), UX lead (confirm round 3).

## Round 2 changes

| Demand | Change | Conflict and ruling |
|---|---|---|
| BL C1 · define demo | `viewerFlags`: ≥ 1 activity, all `source='demo'`, from the database by session id. T3.2 gets three non-demo cases, T3.4 the explain check | — |
| BL C2 · bound T1.3 | `/t/<sym>` watched and unwatched added to T1.3. The static guard on `last_seen_at` in ranking paths is kept (T1.7). **The one allowed watchlist write is dropped** | Superseded by the owner's Q1 reversal: no write is allowed (stricter). T1.3a added as the owner asked |
| BL C3 · T3.3 behavioral | Scoped to `insert into` / `select … from discovery_events` and the events route, with a named exempt list. PR-5a's behavioral pair is in §13 | — |
| BL C4a · one outcome per `?likes=` | Invalid → page 1; past the end → "No older likes." with Newer (T5.2) | — |
| BL C4b · URLs by path, `_rsc` only | T6.1's rule, written into the spec; the reviewer re-runs it with `?done=` | — |
| BL C5 · Privacy follows sentence | §7 item 5 | — |
| BL C6 · split the deletion sentence | Replaced by the UX list (item 9) with the backups sentence | BL three sentences vs UX list → **UX wording** (coordinator), and stricter: it adds backups. T4.1 uses UX's regexes |
| BL C7 · exactly one confirmation | One shared `role="status"` element on the profile and `/me/following` (T6.3) | — |
| BL C8 · effect-first copy, no internal terms | `orderOffExplain`, `orderSavedOff`, `RESET.explain`, `RESET.keep` | BL "same order as everyone" / "Cancel" vs UX "order everyone sees signed out" / "Don’t reset" → **UX wording** (coordinator). The BL point (lead with the effect) is kept in `RESET.explain`. BL's "drop the On/Off prefixes" vs UX's "keep both lines with their labels": **UX**, the stricter one, since the viewer can read what Off does before choosing |
| BL C9 · PR-5b section when off | §13 | — |
| UX 1 · Reset in Settings, `/settings/reset`; link on `/me/following` after Not interested | §2.1, T2.5. PR-8 adds the Settings line | Breaks the PR-7/PR-8 independence (§3): **PR-8 now waits on PR-7** |
| UX 2 · confirmation page wording and done state | `RESET.keep` "Don’t reset" → `/settings`; `useActionState` done state at the same URL; focus; `aria-disabled`; one POST (T2.3) | — |
| UX 3 · Following on a followed section row | `followingAmong` covers section candidates; the button is pressed (T1.1b) | — |
| UX 4 · section line and "Feed settings" link | `SECTION.personal`, `/settings#your-feed`, focus effect; nothing signed out or off (T1.9) | — |
| UX 5 · both explain lines always; status after the server | §1.1, T1.5, with the UX strings | — |
| UX 6 · deletion list | `deleteLead`, `deleteItems`, `deleteAfter`; T4.1 regexes | Applied over C6 (above) |
| UX 7 · `RESET.explain`, `LIKES.gone`, `unlikeGone`, no trade link | §6, T5.2 | — |
| UX 8 · Unlike keeps page *n*; "No older likes." | §2.1, T5.2 | — |
| UX 9 · `/me/following` status for no-JS section and pane actions; "Back to the feed" | `lastAction`, `FOLLOW.backToFeed` (T6.3) | — |
| UX 10 · watch cap described statically; status only after a tap | `aria-describedby`, `watch-cap.tsx` (T6.5) | — |
| UX 11 · 360 px everywhere; no horizontal scroll; animations; heart check over POST | §0 matrix; T6.2 | — |
| UX items 1, 3, 7, 22 (within the demands) | DOM order and first viewport; label tap, contrast in both states; second-tab duplicates; axe | — |
| Owner · Q1 reversed | §1.1: every passive write is gated by `recording(id)` and its marker hidden. T1.3 now forbids every write. T1.3a, T1.4, T1.6, T1.7. Privacy §7 items 3, 6, 7, 8 | Applied to every passive write in the tree, not only the watch stamp (stricter). The owner can narrow it (§8) |
| Line estimates | PR-7 ~170 → ~340 (the switch's UX, section state and line, deletion list, C1, the Q1 gates). PR-8 ~320 → ~390 (reset page with done state, status lines, watch cap, gone rows) | Both ≤ 800 |

## Round 3 changes

| Demand | Change | Conflict and ruling |
|---|---|---|
| BL R1 · name the connection-flow events as exempt; the portal-open cap still trips with the switch off | §1.1 names `EXEMPT_EVENTS` (`portal_opened`, `link_succeeded`, `consented`, `declined`, `failed`, `abandoned`, `expired`, `import_finished`, `no_real_account`, plus the pre-sign-in `landed` and `method_chosen`). T1.7 asserts the list exactly. T1.10 in `lib/connections.test.ts` checks the cap with the switch off, and it is run | — |
| BL R2 · §13 adopted by the PR-5 amendment | §13 records the adoption and the reviewer's check in `plan.md`. The UX lead's R2.4 note goes to PR-5b's plan round | — |
| BL R3 · `lib/auth/sessions.test.ts:44-45` unchanged | The switch-off case is a new test beside it, and the test count goes up by one (T1.3, §1.2) | — |
| UX R2-1 · T6.1 allows `?likes=<n>` and two fragments | Digits only, on `/me/following` only, equal to the page acted on or from Older/Newer. Fragments `#liked` and `#your-feed`. It still fails on `?done=`, on `likes=abc` and on `likes` on another path (§2.1, T6.1) | — |
| UX R2-2 · no marker counts from an unrecorded visit after the switch is back on | `setOrder(false)` sets watch stamps to `'infinity'` and nulls `record_first/last/prev_viewed_at` and `trades_prompt_seen_at`. `watchSummary` returns `newCount: null`, and markers take their first-visit path. T1.4 runs the off → visit → on sequence (no count), then a new trade (count 1), on `/t`, `/me/record` and the profile prompt | UX suggested clearing at switch-on. **I clear at switch-off instead:** the outcome is the same, and stale stamps aren't stored during the off period (P3; stricter). `record_first_viewed_at` is nulled too, because `visitDecision` falls back to it. Restarting the BL's prompt and first-view measures for opted-out viewers is for the BL to confirm |
| UX R2-3 · `/t` while off | `WATCH.markerOff` once under "Your watched stocks", with "Feed settings" → `/settings#your-feed`. No per-row count line, no "No new trades". Only when signed in, off, and ≥ 1 watch (T1.4) | — |
| UX R2-4 · `RECORD.markerOff` and the longer `orderOffExplain` | `RECORD` copy object added to `allCopy`. `/me/record` shows it with "Feed settings". `orderOffExplain` is the UX R2.3 string (§6, T1.4, T1.5) | — |
| Line estimates | PR-7 ~340 → ~365 product, ~560 → ~630 test (clearing in `setOrder`, `watchSummary` null, the two off lines, R1 and R3 tests, `e2e/markers.spec.ts`). PR-8 unchanged at ~390 / ~720 | Both ≤ 800. The order is unchanged: PR-7, then PR-8 |

## Round 4 (2026-10-25, UX lead's round-3 demand, applied by the orchestrator)

| Demand | Change |
|---|---|
| UX R3: a watch added while the switch is off gets `last_seen_at` = the moment of watching, so after the switch is back on its count includes trades already seen | A watch created while the switch is off stores `last_seen_at = 'infinity'` (no count until a visit is recorded with the switch on). T1.4 gains the case "off → watch → visit → on → `/t` shows no count line". |

With this applied the UX lead signs without a re-sit (`plan-guardrails-signoff-ux-lead.md`, Round 3). The business lead
signed round 3. **Plan signed by all three.**
