# F-2 · Hard stops H1, H2, H4 · Draft for the owner's approval (business lead)

2026-10-24, revision 2. Revised against the engineer's verified inventory
(`hardstops-resolution-engineer.md`, commit 6cdb1e9; findings D1 to D14). Other inputs: `plan.md` §2, §5, §7 to §9;
POLICY F1, F3, F6, P6, H; COMPLIANCE §1 to §3; the F-2 feature file (Decisions to O5). The team drafts. Only the owner
changes POLICY, Terms and the Privacy Policy (POLICY H). Nothing here is legal advice.

## Owner decision table

| Item | What approving does | Still open before real (non-demo) viewers |
|---|---|---|
| **H1** · POLICY F1 (§1) | The owner replaces F1 with the "After" text by hand (the file is owner-only). That covers today's per-viewer demotions (PR-4) and PR-5's ordering. | **Counsel:** Q1 (advised, §2). |
| **H2** · counsel packet (§2) | The owner accepts the team's analysis in place of a counsel opinion as the gate for the PR-5 build. That is the owner's risk decision. The owner also picks guardrails G1 to G6. POLICY's "no public launch until counsel signs off" still holds. | **Counsel:** Q1 and Q4, plus Q5 if implicit events go live. **Code fix:** the share images' outside font fetch (Q8, D11). |
| **H4** · Privacy text (§3) | Part A goes on `/privacy` now, Part B with PR-5a. The copy goes through a PR the owner merges by hand (`app/privacy/` is not CODEOWNERS-protected). That PR replaces the placeholder assertion in `e2e/signin.spec.ts:122-123` with the owner's approval. **Approval depends on item #7 being scheduled**, because the retention lines describe its clean-up. | **Deploy setting:** schedule IMPLEMENTATION item #7 (the clean-up and deletion retries). **Owner fills:** the privacy contact (from an env var; a literal address fails the scanner), how long the host keeps request logs, backups. **Code fixes (G2, G4 to G6):** a way to clear trade hides and unfollow notes, likes the list can't reach, the expired-session purge, the watchlist in deletion's first step, `/me/liked` off the URL. **Rest of the policy:** account, sign-in, broker data, sign-up funnel, the trader's own prompt and view fields. |

## Facts the owner should know before approving

1. **The signed-in feed is already per viewer, in two ways, both downward only.** Since PR-4, each running unfollow
   multiplies that trader's ranking by ×0.8. Each trade the viewer hides removes that one trade and also multiplies its
   trader by ×0.8 for 90 days. The suggestions section applies the same demotions when choosing its rows. Nothing is
   ever boosted, and follows, likes and the watchlist do not order anything yet (D6, engineer §3.1). Counsel question 6
   in `plan.md` §7 assumed only a mute, so it is out of date. The current F1 ("no personalized suggestions") is stretched
   by this. That is why H1 is needed before real viewers reach PR-2 to PR-4, not only PR-5.
2. **Stored retention depends on a job that is not scheduled.** Ended hides and unfollow notes, and later PR-5's 90-day
   events, are deleted only when `POST /api/sync` runs. Nothing calls it on a schedule today (item #7, D9). Until it
   does, ended rows stay stored, unused by every read. Expired sign-in sessions are never deleted (engineer §1.2).
3. **The share images send trader text to an outside service.** The image renderer fetches fonts, and in some cases
   emoji, from outside servers. The glyphs it can't draw travel in the request: a trader's display name, and on the
   trade card the thesis. It carries no viewer behavior, IP address or cookie. It still conflicts with COMPLIANCE §3
   (outbound calls only to integrated vendors). The F-4 glyph fix is not built yet (D11).
4. **State laws on personalized ("addictive") feeds for minors** are new since the plan.
   - **New York.** The final rules were released 2026-07-28 and take effect 2027-01-25. They define the regulated feed
     as one ordered by data tied to the user or their past interactions, follows included. (Found: the state attorney
     general's release. The size thresholds in Q4 come from a secondary summary and need checking.)
   - **California.** Age assurance is required from January 2027, and the law targets ordering by a user's behavior
     rather than explicit preferences. (Found: the state attorney general's 2026 proposed rulemaking.)
   - **Our 18+ rule is attestation, not age assurance** (COMPLIANCE §7).

---

## 1. H1 · POLICY F1 amendment

**Before (current `docs/POLICY.md`, F1, exact):**

```
- **F1.** Stock Social publishes records; it never gives advice. No recommendations to buy, sell or hold
  anything, no signals, no "top picks", no price targets, no personalized suggestions. Rankings are
  ordered by the documented method and never presented as endorsement.
```

**After (replacement, exact):**

```
- **F1.** Stock Social publishes records; it never gives advice. No recommendations to buy, sell or hold
  anything, no signals, no "top picks" or "AI picks", no price targets, and nothing personalized about a
  trade, a security or an action to take. Discovery may personalize only what to read: a signed-in
  viewer's feed and suggestions of records and traders may be ordered by that viewer's own actions
  (follows, likes, hides, watchlist, what they read). That ordering never uses another viewer's data or
  the sign or size of a return, so losses are found like gains. Every reason shown is a fixed, scanned
  template stating a fact about the record or the viewer's own actions; it names no security. Suggestions
  show no performance figure unless the F3 disclaimer is in plain view. Signed out, everyone gets the
  same documented order. Rankings are ordered by the documented method and never presented as
  endorsement.
```

What each added sentence guards (nothing is loosened):
- **"nothing personalized about a trade, a security or an action to take"** replaces "no personalized suggestions"
  with the line that matters legally: records to read, never trades to make (COMPLIANCE §2, F-2 Out of scope). No
  "buy X".
- **"only what to read … the viewer's own actions"** limits the inputs to the viewer's own actions. That covers today's
  demotions (unfollow, trade hide) and PR-5's signals. Co-visitation (another viewer's behavior, plan "Later stages")
  would need another amendment and H3.
- **"never … the sign or size of a return"** means the personal part can't steer viewers toward winners. Today's
  ×0.8 demotions read no return (`lib/discovery/prefs.ts`), and the sign-invariance tests cover PR-1, PR-3 and PR-5.
- **"fixed, scanned template … names no security"** keeps reasons to facts, never endorsements, with no "AI" label.
- **"no performance figure unless the F3 disclaimer is in plain view"**: rows carry no number, and the pane carries
  the disclaimer.
- **Still binding alongside it:** F3b (nothing pushed, no skill labels) and F6 (no counts, no celebration).
- **Optional clause, only if G1 ships:** after "(follows, likes, hides, watchlist, what they read)." add "A viewer can
  turn personal ordering off in Settings."

**How to apply:** the owner edits `docs/POLICY.md`; no agent may. Scanner enforcement of the template rule is plan
request P5.

Owner approves: **yes** (2026-10-25, in the chat: "of course there should be personalized suggestions"). The
"After" text above is approved, without the optional opt-out clause (added if G1 ships). Pending: the owner applies it
to `docs/POLICY.md` (owner-only).

---

## 2. H2 · The counsel packet, answered by the team

**This is the team's analysis, not legal advice.** No one on the team is a lawyer, and nothing below is a legal
opinion. If the owner approves this section in place of a counsel opinion, that is the owner's risk decision. It gets
recorded as such in the F-2 file and `docs/DECISIONS.md`. It clears COMPLIANCE §2's "counsel before build" for PR-5
only by the owner's choice. It does not change POLICY's "No public product launch until counsel signs off".

**Evidence tiers:**
- **Found:** statute, regulator text or a regulator's release, read for this draft.
- **Inferred:** the team's reading.

To our knowledge, no court or regulator has ruled on a behavior-ordered feed of third-party broker-verified trade
records. Every securities-law position below is inferred.

### Q1. Does per-viewer ordering keep the publisher's exclusion?
The ordering would be by what the viewer read, followed and liked (PR-5), on top of today's demotions.
- **Position (inferred):** probably yes, for ordering *which published records to read*.
  - The published record is the same, bona fide, regular and impersonal for everyone.
  - The ordering changes what a viewer sees first, not what is said.
  - It is never tailored to the viewer's finances, goals or holdings; we collect none of those from viewers.
  - The weak point is "impersonal": per-viewer selection is by definition tailored to reading interest.
- **Guardrails:**
  - Amended F1 (§1).
  - No suggestion per security.
  - Reasons are fixed templates with no ticker slot.
  - No figures on suggestion rows.
  - A sign-invariant personal score.
  - The disclaimer on every pane.
  - Nothing pushed (F3b).
  - No paid placement (F5).
- **Residual risk: medium.** The reading closest to advice is symbol affinity. "Trades symbols on your watchlist" ties
  a security the viewer cares about to traders who trade it. Penalties here are registration-level (COMPLIANCE §13).

### Q2. Is ranking followed traders higher a suggestion, or a display preference the viewer set?
- **Position (inferred):** a display preference. The viewer chose the trader explicitly, so it works like subscribing
  to a column. (No follow boost exists yet; it arrives with PR-5b.)
- **Guardrails:** following is explicit, private and reversible in one tap. The boost doesn't depend on performance.
- **Residual risk: low** for securities law. New York's minors' feed rules count follows as a feed input; see Q4.

### Q3. Is "Follow" acceptable if it never notifies, never pushes and shows no count?
- **Position (inferred):** yes. It is a private bookmark: no notification, no count, the trader is never told, nothing
  is copied.
- **Guardrails:**
  - F3b, F5 and F6.
  - The privacy scans in `lib/follows.test.ts` and `lib/likes.test.ts`.
  - The signed-out behavioral guard.
- **Residual risk: low.** It would rise only if follows ever announced new trades, which F3b forbids.

### Q4. Do any states require adviser registration for behavior-based ordering, or treat it as profiling with an opt-out duty?
- **Adviser registration (inferred).** State definitions largely track the federal one; some are stricter
  (COMPLIANCE §2). Same reasoning as Q1, state by state. **Residual: medium.**
- **Profiling under state comprehensive privacy laws (inferred from the common model).** The opt-out generally covers
  two things:
  - profiling for decisions with legal or similarly significant effects (credit, housing, employment, financial
    services);
  - targeted advertising.

  Ordering what to read is neither, and the laws' size thresholds aren't met today. **Residual: low now, rising with
  scale.**
- **Minors' feed laws (found).**
  - **New York:** final rules released 2026-07-28, effective 2027-01-25. A secondary summary reports they don't apply
    below 5 million monthly users or 20,000 monthly minor users. That needs checking against the rule text.
  - **California:** age assurance from January 2027. Its regulations are still in rulemaking and litigation.
  - **Our feed:** today's demotions and PR-5's ordering fit both definitions, and attestation is not age assurance.
  - **Residual:** low at today's size in New York, unclear in California, and the highest-growth risk in this packet.
- **Guardrails:**
  - 18+ attestation (P4).
  - No minors' features or copy.
  - G1 (opt-out, below): every viewer can have the non-personalized feed these laws require for minors.
  - G3: implicit behavior is the input California targets.

### Q5. Does keeping 90 days of behavior events need consent beyond the Privacy Policy?
- **Position (inferred):** notice should be enough.
  - Events are first-party and minimal (viewer, surface, type, target, time: criterion 3).
  - They are not a sensitive-data category as state laws commonly define them: they record which public records a
    viewer read.
  - They are never sold and never used for ads.
- **Guardrails:**
  - The column allow-list and the no-personal-data scan (criterion 3).
  - Nothing stored signed out.
  - No third party and no session replay.
  - The 90-day purge (true only once item #7 runs).
  - Deletion's first step.
  - G1.
- **Residual risk: low to medium.**
  - Reading financial content can reveal financial interests.
  - GLBA's reach to a viewer who connects no broker is untested here.
  - **Disclose:** the host's request logs already record some viewer actions in URLs (D12; G6 removes the worst one).

### Q6. Does a mute or hide the viewer sets keep the exclusion? (Restated to match what is built.)
- **As built:** three viewer actions change that viewer's feed.
  - "Not interested" removes a trader for 90 days.
  - "Hide this trade" removes one trade for 90 days and demotes its trader ×0.8 for 90 days.
  - An unfollow demotes the trader ×0.8 for 90 days.

  All three only lower, never raise.
- **Position (inferred):** the removals are the viewer's own filter and recommend nothing. The demotions are a
  per-viewer ranking, the same class as Q1 but smaller, because they come only from explicit negative actions and only
  lower.
- **Guardrails:**
  - A hide never touches a profile (TR-1).
  - Every effect ends at 90 days.
  - No boost from any action today.
  - The demotion reads no return.
- **Residual risk:** low for the removals; as Q1 but smaller for the demotions.

### Q7. Is a section that is the same for every viewer, ordered by the published lower bound, with factual reasons and no figures, the same class as today's feed?
- **Position (inferred):** yes. It is the same for everyone, uses the documented method, treats losses equally, shows
  no figures, and the record is one tap away with its disclaimer. Signed in, the pool drops followed and hidden traders
  and applies the Q6 demotions. That is Q6, not a new class.
- **Guardrails:** PR-3's tests (lower-bound order, sign invariance, copy scan, no `%` in rows).
- **Residual risk: low.**

### Q8 (new). The share images send trader-written text to an outside font service
- **What happens:**
  - Rendering a profile, trade, month, ticker or story image fetches font glyphs from an outside font host, and
    sometimes an emoji host.
  - The missing glyphs go in the request: a display name, and a thesis on the trade card.
  - No viewer data, IP address or cookie goes with it (D11).
- **Team position:** it conflicts with COMPLIANCE §3, so fix it in code rather than ask counsel. Build the F-4 glyph
  fix (`lib/card-glyphs.ts`: self-hosted fonts, no outside fetch) before real users.
- **If not fixed,** the Privacy Policy must disclose it, and that is a T1 problem too: the service can't be named
  because it isn't an integrated vendor.
- **Residual risk until fixed: medium** (an undisclosed transfer of user text).

### What the team would still send to counsel before real viewers, and why
1. **Q1.** It is the core question, there is no direct authority, and it carries the largest penalty class. Ask
   specifically about symbol affinity, the watchlist reason, and today's demotions.
2. **Q4.** It is fact-specific and differs by state; the minors' feed laws take effect in January 2027 and
   California's rules are still moving. Ask whether attestation plus G1 is enough, or whether age assurance must come
   before any personal ordering. That includes today's ×0.8 demotions.
3. **Q5, only if G3 is not adopted** (implicit events live for real viewers).

The owner can reasonably accept Q2, Q3, Q6 and Q7 on this analysis. Q8 is a code fix, not a counsel question.

### Extra guardrails the team recommends (with cost)
| # | Guardrail | Why | Cost |
|---|---|---|---|
| G1 | **Opt-out of personal ordering** on `/settings`: one switch, "Order my feed by my activity", on by default. When off, the feed and section use the signed-out order minus the viewer's own hides. With PR-5, it also skips scoring, unmounts the logger, and `/api/events` stores nothing. | Answers Q4: it gives every viewer the non-personalized feed those laws require. It strengthens Q5. | **Today: ~40 product and ~60 test lines** (one `users` column, a toggle and action, one branch in `loadFeedPage`; engineer §3.3). **With PR-5: +~20 product and +~40 test lines.** Cheapest built inside PR-5b; adding it today also covers the live demotions. |
| G2 | **"Reset my feed"** on the Following page. One confirmed button deletes the viewer's trade hides and unfollow notes, and after PR-5 their discovery events. | Today a viewer can't see or end a trade hide after the 5-second Undo, or an unfollow note, without deleting the whole profile (D2, D4). Required if O3 makes trade hides permanent, since those are never purged. | ~60 lines; one DB test, one e2e. |
| G3 | **Implicit signals off for real viewers until counsel answers Q4 and Q5.** Impressions, dwell, skip and swipe-open stay behind one constant; explicit signals stay live. | Implicit behavior is the input California targets. Criterion 2 lists implicit signals, so this is the owner's call. | ~10 lines, one test. |
| G4 | **Deletion copy and order.** The "Delete my profile" explanation names the follows, likes, hidden traders and trades, the watchlist, and later activity. Add `ticker_watches` to deletion's first step. | The screen should say what it deletes. The watchlist currently survives a failed vendor call until the retry tick (D14), which item #7 also runs. | Copy plus 1 line and a test case. |
| G5 | **Reachable likes.** "Liked records" lists every like: paging past the newest 200, and "Record no longer available · Unlike" for likes on trades a rebuild removed. Or add "Remove all likes". | Today some likes can be removed only by deleting the account (D3). | ~30 to 50 lines. |
| G6 | **Small log and retention fixes.** `GET /me/liked?k=…` becomes a POST. No-JS confirmations carry no handle in the URL. Expired sessions get purged in the tick. | Viewer actions reach the host's request logs (D12), and expired sessions are kept forever (engineer §1.2). | ~40 lines; the purge needs item #7. |

Owner decision (2026-10-25): **send to counsel** rather than accept this analysis in its place. The request is
`counsel-request.md`; the PR-5 build waits for the answer (H2 stays a hard stop). Guardrails adopted: G1 ____ G2 ____ G3 ____ G4 ____ G5 ____ G6 ____

---

## 3. H4 · Privacy Policy text

Final copy for one section of the Privacy page, true to the code as built (engineer inventory, PR-4 with its fix
round 1).
- **Part A** is for now.
- **Part B** is added the day PR-5a merges, with two replacements the day PR-5b merges.
- **[Bracketed] lines** go in only when the matching guardrail ships; then delete the sentence they replace.

The rest of the Privacy Policy (account, sign-in, broker data, the trader's own prompt and view fields, the sign-up
funnel, contact) is outside this section and still the owner's to write.

**Conditions for pasting:**
1. **IMPLEMENTATION item #7 is scheduled.** The "regular clean-up" lines describe it. Without it, ended rows are never
   deleted and those lines are false.
2. **The owner fills in** how long the hosting provider keeps request logs, and backups if the database host keeps
   them.
3. **If O3 makes trade hides permanent,** "Hide this trade" becomes "until you remove it", and G2 is required.
4. **Fix Q8 first,** or add a disclosure of the outside font fetch to the broader policy.

### Part A (paste once item #7 is scheduled)

> ## Your feed choices: follows, likes, hides and your watchlist
>
> When you're signed in, you can follow traders, like records, hide traders or trades from your feed, and keep a
> watchlist of symbols. Here is what we store when you do, who sees it, how long we keep it and how to remove it.
>
> **Only you see it.** Your follows, likes, "Not interested" list and watchlist are shown only to you: on Settings →
> Following and hidden traders, and on your watchlist. Your other choices are not shown anywhere; they only change your
> own feed. We use this data only to order your own feed and suggestions and to show your own Follow and like buttons.
> Traders are never told who follows, likes or hides them, and no follow or like count is shown anywhere. People who
> run Stock Social can access this data only to operate, secure and fix the service.
>
> **Nothing is stored when you're signed out.** Browsing the feed or a profile signed out stores none of this.
>
> **No one else receives it.** We don't sell or share it, and no advertiser, analytics company or tracker receives it.
> It is stored with the provider that hosts Stock Social. That provider's request logs record the address of each page
> you load, with your IP address, and a few of those addresses show an action, such as which trader you just followed
> or which records were on your screen. [Owner: how long the host keeps request logs.]
>
> **Follows.** We store which traders you follow and when. Followed traders are left out of your suggestions, since you
> already follow them. We keep a follow until you unfollow or delete your profile.
>
> **Unfollows.** When you unfollow, we delete the follow and keep a note, for 90 days, that you unfollowed that trader.
> The note isn't shown on your lists. For those 90 days the trader's records appear a little lower in your feed and
> suggestions; they are never hidden. Following them again ends the note early. [Reset my feed also ends it.]
>
> **"Not interested."** We store which trader you hid, when, and when the hide ends. That trader is left out of your
> feed, your suggestions and Similar trades for 90 days. Their profile stays public and nothing is removed from it. You
> can undo it right away, or later with "Show again" on your list.
>
> **Hide this trade.** We store which trade you hid, whose it is, when, and when the hide ends. That trade is left out of
> your feed and Similar trades for 90 days, and its trader appears a little lower in your feed and suggestions for those
> 90 days. The trade stays on the trader's public profile. You can undo it in the 5 seconds after hiding it. After that,
> the hide isn't shown anywhere and ends on its own after 90 days. [Reset my feed also ends it.]
>
> **Ended notes and hides.** Once an unfollow note or a hide ends, it is no longer used, and our regular clean-up deletes
> it, normally within a day.
>
> **Likes.** We store which records you liked, whose they are, and when. We keep a like until you unlike it or delete your
> profile; likes have no time limit. Your Liked records list shows your 200 newest likes on records that still exist,
> each with "Unlike", which deletes it at once. A like on a record that no longer appears is kept in case the record
> returns. [Owner: if G5 ships, replace the last two sentences with "Your Liked records list shows every like, each with
> Unlike, which deletes it at once."]
>
> **Watchlist.** We store which symbols you watch, when you added each, and when you last opened each symbol's page. It is
> shown only to you. We keep it until you stop watching a symbol or delete your profile.
>
> **Referrals.** If you signed up from a trader's profile, that trader can see your handle and where on their profile
> you signed up from, on their own profile page. No one else sees it.
>
> **Cookies.** Stock Social sets only its own cookies, and only when you sign in or connect a broker; browsing signed out
> sets none. One keeps you signed in, for 30 days. Short-lived ones carry a sign-in or broker-connection step through,
> lasting from 10 minutes to the length of that step; one of them holds the email address you typed, for 15 minutes. One
> remembers which sign-in method you used last, for a year. None of them tracks what you do, and none is used for ads.
>
> **Sign-in sessions.** Each sign-in session records when it started and when you last used the app, at most once an
> hour. A session lasts 30 days. Ended sessions are kept until you sign out, sign in again in the same browser, or delete
> your profile. [Owner: when G6 ships, replace the last sentence with "Ended sessions are deleted by our regular
> clean-up."]
>
> **Deleting your profile.** Settings → Delete my profile deletes your follows, likes, hides and unfollow notes at once,
> as its first step, and removes you from other people's lists the same way. Your watchlist and sign-in sessions are
> deleted when the deletion completes. [Owner: when G4 ships, move the watchlist into the first sentence.]
>
> | What | What we store | Who sees it | How long we keep it | How to remove it |
> |---|---|---|---|---|
> | Follows | Trader, date | Only you | Until you unfollow | Unfollow; delete your profile |
> | Unfollow notes | Trader, start and end date | No one; it lowers that trader in your feed | 90 days; deleted by the regular clean-up after it ends | Follow again; [Reset my feed;] delete your profile |
> | "Not interested" | Trader, start and end date | Only you | 90 days; deleted by the regular clean-up after it ends | Undo; Show again; delete your profile |
> | Hidden trades | Trade, trader, start and end date | No one; it removes the trade and lowers its trader in your feed | 90 days; deleted by the regular clean-up after it ends | Undo within 5 seconds; [Reset my feed;] delete your profile |
> | Likes | Record, trader, date | Only you | No time limit | Unlike (your 200 newest, on records that still exist); delete your profile |
> | Watchlist | Symbol, date added, last opened | Only you | Until you stop watching | Stop watching; delete your profile |
> | Referral | Which trader's profile you signed up from, and where on it | That trader | Until either profile is deleted | Delete your profile |
> | Sign-in sessions | Start, last use (hourly), expiry | No one | Until you sign out, sign in again in that browser, or delete your profile | Sign out; delete your profile |

### Part B (add the day PR-5a merges, before any activity is recorded for real viewers)

> **Discovery activity.** When you're signed in, we record what you do with records in the app so your feed can show you
> more records like the ones you read. That covers which records and profiles you open, like, share, hide or follow,
> which symbols you watch, which records you scroll past quickly, and roughly how long you look at one (as a range, not a
> timer). Each entry contains only your account, what you did, which trader, trade or symbol it was about, where in the
> app it happened, and when. It contains no brokerage data, no amounts and no location. We use it only to order your own
> feed and suggestions and to write their reasons, such as "Similar holding period to @trader". It is never used to
> suggest trades or securities, never shown to anyone, and never combined with other people's activity. After 90 days an
> entry is no longer used, and our regular clean-up deletes it. [You can turn this off in Settings with "Order my feed by
> my activity". We then stop recording it, and your feed uses the order everyone signed out sees, minus what you hid.]
> [Reset my feed also deletes it.] Deleting your profile deletes it at once.

Table row to add:

> | Discovery activity | What you did, which trader, trade or symbol, where, when | No one; it orders your feed | 90 days; then deleted by the regular clean-up | [Turn off in Settings; Reset my feed;] delete your profile |

Replacements the day PR-5b merges (personal ordering live):
- **Follows, second sentence:** "Followed traders appear higher in your feed and are left out of your suggestions,
  since you already follow them."
- **Likes, after the first sentence:** "Records like the ones you liked appear higher in your feed."
- **Watchlist, after "shown only to you":** "Traders who trade symbols on your watchlist can appear higher in your
  feed."

Owner approves: ____ (yes/no). Condition: item #7 scheduled ____ (yes/no)
