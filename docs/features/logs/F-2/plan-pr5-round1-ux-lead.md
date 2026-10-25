# F-2 PR-5 (5a events, 5b personal scoring) · Round 1 · UX lead position

2026-10-25. Role: user-experience lead (`team/designer.md`). Inputs: `plan.md` §1 PR-5, the F-2 feature file (Decisions
to 2026-10-25, criteria incl. G1–G6), POLICY F1 as amended (opt-out clause in), `hardstops-resolution-business-lead.md`
§2 (G1–G6) and §3 (Privacy Parts A and B), `committee-pr3-ux-lead.md` (section heading), `committee-pr4-ux-lead.md`
and `build-pr4-engineer.md` (likes, hides, Undo record), and the code at `bcaac14` (`lib/copy.ts`, `app/settings/page.tsx`,
`app/me/following/page.tsx`, `app/suggest-section.tsx`, `lib/discovery/weights.ts`). `plan-guardrails.md` does not exist
yet, so where G1/G2 placement is open I propose it here. No code, no other file changed. Nothing here is legal advice.

## 0. Position in one paragraph

G3 changes what PR-5 can truthfully say. For a real viewer the product will know what they **follow, like and hide**
(and what they share), never what they **read**. So every viewer-facing word in PR-5 must be built from those inputs
only: the section heading, the reason lines, the Settings description and Privacy Part B. I propose a section with
four exact states (signed out, switch off, cold start, personal), three personal reason templates that are true by
construction, the G1 switch and G2 reset together on `/settings` under "Your feed", a documented "How your feed is
ordered" on `/how`, no change to like/follow/hide feedback except that nothing reorders under the reader, and five
drops that make PR-5 smaller and more honest (the implicit logger, two reasons that G3 makes false, symbol affinity,
duplicate event rows, a mixed personal/impersonal section).

## 1. Facts that shape the proposals (checked against the docs and code)

| # | Fact | Consequence for the viewer |
|---|---|---|
| F1 | G3: impressions, dwell, skip and swipe-open stay off for real viewers (packet §2 G3 lists swipe-open). | "More like what you **read**" (criterion 2) and the reasons "Trades symbols you read" and "New to you" (plan PR-5b) are not true for any real viewer. "New to you" needs impressions to be true at all. |
| F2 | Privacy Part B (packet §3, approved text) says we record "which records you scroll past quickly, and roughly how long you look at one". | Under G3 that sentence is false the day PR-5a merges. Part B needs a G3 version before it goes live (§10 below; the owner approves it). |
| F3 | The plan's emitters write a `like`/`follow`/`watch` event "in the same transaction as their row". Privacy Part A says Unlike "deletes it at once" and unfollow "deletes the follow". | A `like` event kept 90 days after an Unlike makes Part A untrue from the viewer's side. Scoring should read the state tables (`follows`, `trade_likes`, exclusions, trade hides), which already hold exactly what the viewer chose. |
| F4 | Today's section heading "Other traders' records" and its line were written to stay true at PR-5 (committee PR-3 UX §9). | The impersonal states keep them unchanged; only the personal state gets a new heading and line. |
| F5 | POLICY F1: "Rankings are ordered by the documented method." `/how` documents records, not the feed order, signed out or in. | Personal ordering needs a written, linked description before it ships, or "documented" is not met. |
| F6 | Criterion G1: off = "the signed-out order minus their own hides". Today's signed-in section also drops followed traders and the viewer's own record, and applies the ×0.8 demotions. | The test needs an exact definition of "off" (§5.4), or the engineer has to guess. |
| F7 | Criterion G3 says "while the switch is off". G1 is "the switch"; G3 is a constant. | I read it as "while the G3 constant is off, whatever G1 says; and always while G1 is off". Recorder to confirm the wording. |

## 2. The "More like what you read" section: four states

Placement, size and gestures are unchanged from PR-3/PR-4: one full-height stop at position 6 of each 30-card page,
3 rows, no performance number, Follow and "…" (Not interested), the row swipe, the pane sheet with the disclaimer.
Only the heading, the line under it and the reason on each row change by state. Exactly one state applies to a render.

| State | When (all conditions) | Heading (h2, also the region name) | Line under the heading | Row reason |
|---|---|---|---|---|
| **S0 Signed out** | no session | "Other traders' records" (today) | "Ordered by how much evidence each record has. Losses count the same as gains." (today) | impersonal holding period (today) |
| **S1 Switch off** | signed in, G1 off | "Other traders' records" | today's line, then **"Not ordered by your activity."** and a link **"Change in Settings"** → `/settings#feed` | impersonal |
| **S2 Cold start** | signed in, G1 on, **no follow and no like** (on a trade that still exists) | "Other traders' records" | today's line, then **"Follow a trader or like a trade, and this section can show traders like them."** | impersonal |
| **S3 Personal** | signed in, G1 on, and **at least 3** candidates with a personal reason (§3) after every filter | **"More like what you follow and like"** (see owner question U1) | **"Based on the traders you follow and the trades you like. Losses count the same as gains."**, naming only the inputs this viewer has (only follows: "Based on the traders you follow."; only likes: "Based on the trades you like."), then **"Change in Settings"** | personal (§3) |

Rules:
- **No mixed section.** A signed-in viewer with signals but fewer than 3 personal candidates gets S2's heading and
  today's line **without** the cold-start hint (the hint would be false: they already follow or like). Never a personal
  heading over a row with an impersonal reason.
- **Hides alone are not a signal for S3.** "Not interested", hidden trades and unfollow notes only lower or remove; a
  viewer whose only actions are hides is S2 without the hint.
- The heading never says "for you", "picked", "suggested", "recommended", "top", "best", "smart", "AI" or
  "personalized" (added to the section scan, §12).
- "Change in Settings" is a real link (underlined, ≥ 44 px tall tap area, visible focus), not a button; with the
  section's region it is reachable by keyboard after the three rows' controls.
- Heading choice. Criterion 2 names "More like what you read". Under G3 the product has no reading signal for real
  viewers, so I propose **"More like what you follow and like"** until G3 lifts. The heading is one constant, so it
  goes back to "More like what you read" when G3 lifts. This changes the literal text of criterion 2 and needs the owner
  (U1).

## 3. Personal reason lines

One reason per row. Fixed templates, scanned, no ticker or number slot, true against the viewer's own rows at the
render's `asOf`. "Similar holding period" means **the row trader's median holding bucket equals @x's** (the same five
buckets as PR-3/PR-3b).

| Id | Template | True when | Priority |
|---|---|---|---|
| R1 | **"You liked one of their trades"** | the viewer has a like on a trade of this trader (they are not followed: followed traders never appear in the section) | 1 |
| R2 | **"Similar holding period to @x, who you follow"** | the viewer follows @x, @x is not excluded, and buckets are equal | 2 |
| R3 | **"Similar holding period to @x, whose trade you liked"** | the viewer liked a trade of @x, does not follow @x, @x is not excluded, and buckets are equal | 3 |

- When more than one @x fits, pick the most recent follow or like, then the handle (deterministic).
- @x is always a trader the viewer chose and never another viewer. The line shows the viewer's own follow or like only
  to that viewer, the same exposure as `/me/following`.
- The reason has to explain why the row is there. A row is a personal candidate only if one of R1 to R3 is true. The
  relevance term that picked it must be the one the reason states (the reason is chosen from the same terms the score
  used, not afterwards).
- "holding period" passes the scanner; "holds", "held by", "picks", "for you" fail. No "because", which reads as a
  claim about cause beyond the stated fact.
- **Not built (drops D2 and D3):** "Trades symbols you read" and "New to you" are false under G3. "Trades symbols on
  your watchlist" goes, along with symbol affinity (D3).

## 4. How a viewer understands why their feed changed

Three places, each true and one tap from the next. No per-card reason on feed cards: cards are records, criterion 7
asks for reasons on suggestions, and a label on every card would read as endorsement and add 30 more controls for a
screen reader.

1. **In the feed:** the section's line in S1 and S3 (§2) names the inputs and links "Change in Settings".
2. **On `/settings`, "Your feed"** (§5): the switch, its description of exactly what changes, and the reset.
3. **On `/how`, a new section "How your feed is ordered"** (`id="feed"`), linked from the Settings description. It
   meets F1's "documented method". Proposed copy, one sentence per tested fact:
   - "Signed out, everyone gets the same order: records with more evidence come first, losses count the same as gains,
     no trader or symbol appears more than twice in any 10 cards, and some cards come from further down the list."
   - "Signed in, with Order my feed by my activity on: traders you follow appear higher. So do traders whose typical
     holding period matches traders you follow or trades you like."
   - "Traders you unfollowed, and traders whose trade you hid, appear a little lower for 90 days. Traders you marked Not
     interested and trades you hid are left out of your feed for 90 days. Their profiles stay public and complete."
   - "The order never uses whether a trade gained or lost, how large a return was, or anyone else's activity. Nothing
     about which records you open or scroll past is used."
   - "Turn it off, or reset what it uses, in Settings."
   (The 90-day figures come from `EXCLUSION_DAYS`/`PREF_DAYS`/`TRADE_REJECT_DAYS`, so they follow O3.)

**When the change shows.** A follow, like, hide, switch change or reset takes effect at the viewer's **next page 1**
(a new `asOf`). Nothing on screen reorders under the reader (§9).

## 5. G1 switch: "Order my feed by my activity"

### 5.1 Placement
`/settings`, a new `h2` **"Your feed"** (`id="feed"`) placed **above** "Delete my profile" and below Sign out. It holds,
in order: the switch, its description, the "Following and hidden traders" link (moved here from its loose `<p>`), and
"Reset my feed" (§6). One place for every control that shapes the feed.

### 5.2 Control (A1)
- A native checkbox with `role="switch"`, visible label **"Order my feed by my activity"**, a visible state word
  **"On"/"Off"** next to it (state is not shown by colour or knob position alone), and `aria-describedby` pointing at
  the description. Tap target ≥ 44 px for the whole label row, visible focus in light and dark, no animation of the
  knob under `prefers-reduced-motion`.
- With JS: saves on change (optimistic, reverted on refusal with "Couldn't save that. Try again." in `role="status"`),
  then announces **"Saved."** politely. Without JS: the same checkbox in a form with a **"Save"** button. The server
  action redirects to `/settings#feed` with **no query** (G6: no target in a URL).
- Default **on** for every existing and new viewer (feature decision).

### 5.3 Description (changes with the state; true by construction)
- **On:** "Traders you follow appear higher, and so do traders with a holding period like theirs or like the trades you
  liked. Traders and trades you hid are left out. Gains and losses count the same. Nothing about which records you open
  or scroll past is recorded. How your feed is ordered" (link → `/how#feed`).
- **Off:** "Your feed and suggestions use the order everyone sees signed out, minus the traders and trades you hid.
  Your follows and likes are kept but don't change the order, and nothing about your activity is recorded. To delete
  what is stored, use Reset my feed."
- The "open or scroll past" sentence is tied to the G3 constant: it renders only while G3 is off for this viewer.

### 5.4 What "off" means, exactly (for the G1 test)
Off = the signed-out feed and section for that day and `asOf`, then **removing** the viewer's "Not interested"
traders and hidden trades, and the viewer's own record from the section (its heading says "Other traders'"). No ×0.8
demotions, no follow bonus, no follow exclusion from the section: a followed trader may appear in S1 with its button in
the true **"Following"** state (today the section hard-codes `following={false}`). No `discovery_events` row is
written for that viewer while off, the share event included. Turning it back on uses the existing follows, likes and
hides again from the next page 1. Nothing is deleted by turning it off; that is Reset's job, and the description says
so.

## 6. G2: "Reset my feed"

- **Placement:** in "Your feed" on `/settings`, as a secondary (not red) button. `/me/following` gains one line under
  its intro: "Hidden trades and unfollow notes aren't listed here. Reset my feed in Settings clears them." The link
  text is "Reset my feed in Settings". This answers the old finding that hidden trades can't be seen or ended after
  the 5-second Undo.
- **Two steps, like Delete.** Step 1 is the button, which opens the confirm view and deletes nothing. With JS, an
  inline region gets focus on its heading; without JS, `/settings?reset=1#feed` opens it (a flag, no target). Step 2:
  - heading **"Reset my feed?"**
  - "This deletes the trades you hid, the notes kept when you unfollowed someone, and the record of what you shared.
    Trades you hid can appear in your feed again."
  - "It keeps who you follow, your likes, your watchlist and your Not interested list."
  - primary **"Reset my feed"** (the only tap that deletes, a POST), secondary **"Keep it"** (returns focus to the
    Step 1 button).
- **After:** `role="status"` reads **"Your feed is reset."** and focus moves to it (`tabIndex=-1`). The change shows
  from the next page 1. No count, no animation. Without JS the result line comes from the action's redirect to
  `/settings#feed`. The page then shows the normal view, and the status may be omitted rather than put into the URL.
- It acts only on that viewer's rows; it never touches another viewer's (criterion G2).

## 7. Signed-out viewer

Identical to today, byte for byte, in everything PR-5 touches:
- S0 section: today's heading, line and impersonal reasons. No cold-start hint, no "Change in Settings", no personal
  template, and no "you follow", "you like", "your activity" anywhere in the feed HTML.
- No logger mounted, no events route called (PR-5 has none under drop D1), no new cookie or identifier.
- Follow and the row swipe behave as today (sign-in path; swipe does nothing). Shared links land on the same feed and
  profiles. PR-3b "Similar trades" stays the same for every viewer (it lives on public, shared profiles).

## 8. Feedback after a like, follow or hide (F6, A1)

PR-5 makes these actions change the order, but the feedback stays exactly as built and reviewed in PR-2 and PR-4:
- Like: the ♡ → ♥ glyph swap, `aria-pressed`, "Only you can see likes." in the name. Follow: "Following" plus the
  first-follow line "Following @x. Only you can see this.". Hide: "Hidden for 90 days." / "Trade hidden for 90 days."
  with the 5-second Undo (paused while keyboard-focused).
- **Added rule:** no message promises an effect: no "We'll show you more like this", "Your feed will improve", "Got
  it", and no score, count, progress or "signals collected". The effect is described once, in Settings and `/how`.
- No motion, sound, vibration or colour burst on any of them, on a gain or a loss alike (F6). The PR-4 record shows
  the like-feedback-near-the-thumb follow-up is still open. If PR-5 takes it, it is the static, non-animated "Liked.
  Only you can see likes." text, announced politely, nothing more. It is optional and not part of this position.

## 9. Nothing reorders under the reader

The viewer profile used for a page is computed from signals with `created_at ≤ asOf` (follows, likes, hides, and the
switch state at `asOf`). So a like, follow, unfollow, switch change or reset between page 1 and page 2:
- repeats no card and drops no card on pages 2 and 3 of that cursor, except PR-2's display filter for a hidden
  trader;
- leaves the rendered cards in place (no reflow, no jump);
- shows up from the next page 1.
This is the same contract as PR-2's demand B, extended to the positive signals.

## 10. Privacy Part B under G3 (proposed text for the owner to approve; replaces the approved Part B)

> **Discovery activity.** When you're signed in and "Order my feed by my activity" is on, we use your follows, likes and
> hides to order your own feed and suggestions and to write their reasons, such as "Similar holding period to
> @trader, who you follow". We also note when you share a record: which record, where in the app, and when. We don't
> record which records you open or scroll past, or how long you look at them. Each note contains only your account,
> what you did, which trader or trade it was about, where in the app, and when: no brokerage data, no amounts and no
> location. It is never used to suggest trades or securities, never shown to anyone, and never combined with other
> people's activity. After 90 days a note is no longer used, and our regular clean-up deletes it. You can turn this
> off in Settings with "Order my feed by my activity". We then stop noting anything, and your feed uses the order
> everyone sees signed out, minus what you hid. Reset my feed deletes these notes. Deleting your profile deletes them at
> once.

Table row: "Discovery activity | Shares: which record, where, when | No one; it orders your feed | 90 days; then
deleted by the regular clean-up | Turn off in Settings; Reset my feed; delete your profile". The PR-5b-day replacements
for Follows and Likes stand. The **Watchlist** replacement is not applied while drop D3 holds.

## 11. Drops for simplicity (each makes a viewer-facing claim simpler or truer)

| # | Drop from PR-5 | Why, from the viewer's side | Comes back when |
|---|---|---|---|
| D1 | The implicit logger `app/discovery-log.tsx`, `/api/events`, and the types impression, dwell_short/long, skip, swipe_open, profile_open | G3 keeps them off for every real viewer. The only users would be demo accounts, so this is code no viewer benefits from, plus a write endpoint to secure. Criterion 2's implicit half can't be met for real viewers anyway. | G3 lifts: a separate PR with its own Privacy text |
| D2 | Reasons "Trades symbols you read" and "New to you" | False without reading signals (F1) | G3 lifts |
| D3 | Symbol affinity (`cos(symbols)`, the symbol vector, "Trades symbols on your watchlist", watchlist as an input) | The packet rates symbol affinity the closest thing to advice (Q1, residual medium). Holding period alone gives true, plain reasons. Fewer inputs also make shorter Settings and Privacy copy. | The owner asks for it; it needs a reason line per input |
| D4 | Event rows for actions that already have a row (follow, unfollow, like, unlike, watch, hides) | Scoring reads the state tables, so Unlike, unfollow and Show again remove the signal at once, as Part A says (F3). The log keeps `share` (the only explicit action with no row of its own), which gives criteria 3 and 5 a real writer. | — |
| D5 | A mixed personal/impersonal section, and per-card reasons on feed cards | One state per render (§2). No 30 extra labels per page. | — |
| — | Keep, but UX needs nothing visible from it | `ReasonWriter` seam: the viewer only ever sees the §3 templates. | — |

If the committee keeps D3's watchlist input, it needs its own reason ("Trades symbols on your watchlist" is the only
true wording), its own words in the S3 line and the Settings description, and the Watchlist Privacy replacement.

## 12. Tests, one or more per proposal

| Proposal | Test |
|---|---|
| §2 states | DB+render: four fixtures (signed out; on, no signals; on, follows; off with follows) render S0/S2/S3/S1 exactly. Each asserts heading, line, link presence and reason kind. A viewer with only hides renders S2 **without** the hint. A viewer with signals but 2 personal candidates renders S2 without the hint and no personal reason. |
| §2 S3 line | Unit: the line names exactly the input kinds the viewer has (follows only, likes only, both). |
| §2 no mixed | Property (seeded, 1,000 viewers): every S3 section has 3 rows with R1 to R3 reasons. No S0/S1/S2 section has one. |
| §2/§3 copy scan | `lib/copy.test.ts`: new templates pass the PROMO and suggestion word lists. Add `for you`, `picked`, `curated`, `smart`, `personaliz`, `improve`, `better` to the section/settings scan. "holding period" passes, "holds" fails (existing). |
| §3 truth | Unit: for each row reason, R1 implies a like on that trader. R2 implies a follow of @x, equal buckets, and @x not excluded. R3 implies a like of @x's trade, no follow, equal buckets. Tie-break is deterministic (most recent, then handle). The reason names the term that put the row in the candidates. |
| §3 no other viewer | DB: two viewers. A's reasons cite only traders A follows or liked, never B's. |
| §4 `/how#feed` | Render: the section exists with the five statements. The 90-day numbers equal the constants. The "open or scroll past" sentence appears only while G3 is off. |
| §5.2 switch A1 | E2e (375, light and dark, keyboard and touch): `role=switch` named "Order my feed by my activity", the visible On/Off word changes, Space toggles, focus visible, "Saved." in `role=status`, a forced refusal reverts with the failure line. No-JS: Save posts, the page shows the new state, and the URL has no query. |
| §5.3 description | Render: the On and Off texts match their state. The Off text never claims anything is recorded. |
| §5.4 off | DB: with the switch off, feed pages 1 to 3 and the section equal the signed-out lists minus the viewer's hidden traders and trades (and own record in the section). No ×0.8 applied, and a followed trader shows "Following". Zero `discovery_events` rows are written after a share while off. Turning it on restores the personal order from the next page 1, with no data lost. |
| §6 reset | DB: Reset leaves zero trade hides, unfollow notes and share events for that viewer. Follows, likes, watchlist and Not interested are unchanged, and another viewer's rows are unchanged. E2e: step 1 deletes nothing. The confirm lists what it deletes and what it keeps. "Keep it" returns focus to step 1. After Reset, focus is on "Your feed is reset." in `role=status`. No-JS: `?reset=1` confirm, the POST, and no target in any URL. |
| §6 following line | Render: `/me/following` shows the Reset line and link. |
| §7 signed out | Existing behavioral guard plus signed-out page 1 to 3 HTML contains none of: the S1/S2/S3 lines, R1 to R3, "Change in Settings", "you follow", "you like". No request other than GET (route interception). Section equal to today's fixture. |
| §8 feedback | Copy scan: no "more like this", "improve", "got it" in LIKES/FOLLOW statuses. E2e: after a like, follow and hide there's no animation (computed `animation-name: none`, no transition on the glyph), no count, and a gain and a loss give identical DOM. |
| §9 asOf freeze | Property (1,000 seeded feeds): a like, follow, unfollow, switch-off or reset between pages 1 and 2 means pages 1 to 3 repeat no card and miss none (outside the hide display filter). The next page 1 reflects the change. |
| §10 Part B | `lib/privacy.test.ts` (or its successor): the live Part B contains no "scroll past quickly"/"how long you look" claim of recording while G3 is off, and does say it is not recorded. |
| D1 | DB: no route accepts implicit types for a non-demo viewer. The event type allow-list for writers excludes them while G3 is off. The e2e route interception finds no event request on the feed. |
| D4 | DB: like then Unlike leaves zero rows mentioning that trade for that viewer in every F-2 table. Unfollow leaves only the unfollow note. |

## 13. Owner questions (each with the default the build uses)

| # | Question | Default |
|---|---|---|
| U1 | Criterion 2's heading "More like what you read" is not true under G3. Use "More like what you follow and like" until G3 lifts? | Yes. One constant, so it returns when G3 lifts. |
| U2 | Privacy Part B as approved describes implicit recording that G3 turns off. Approve the §10 text in its place? | The §10 text, pending the owner. Part B does not go live untrue. |
| U3 | Drop the watchlist as a PR-5 input and reason (D3)? | Dropped in PR-5. |
| U4 | Wording of criterion G3 ("while the switch is off"). | Read as the G3 constant, and always while G1 is off (F7). |

## 14. Compliance view (COMPLIANCE §1, viewer side)

- **F1 (amended):** orders only what to read, from the viewer's own actions. Reasons are fixed, scanned and name no
  security (D3 removes the one symbol-linked reason). The documented method is on `/how#feed`. The opt-out is in
  Settings and visible from the feed.
- **F3:** rows carry no figure; the pane sheet keeps the disclaimer.
- **F3b:** nothing pushed; no message announces a trade.
- **F6:** no celebration, count, progress or promise after any action.
- **A1:** the switch has a name, a visible state word and focus. The reset confirm moves focus and announces. Links are
  underlined, ≥ 44 px, and work without JS.
- **Privacy:** fewer stored kinds (D1, D4). Part A stays true (Unlike and unfollow delete at once). Part B is rewritten
  to match G3. Nothing is stored signed out or while the switch is off. No target in any URL (G6).
- **TR-1:** hides never touch a profile; `/how` says so.
