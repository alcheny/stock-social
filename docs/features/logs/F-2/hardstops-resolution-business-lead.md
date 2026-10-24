# F-2 · Hard stops H1, H2, H4 · Draft for the owner's approval (business lead)

2026-10-24. Inputs: `plan.md` §2, §5, §7 to §9; POLICY F1, F3, F6, P6, H; COMPLIANCE §1 to §3; the F-2 feature file
(Decisions to O5); `build-pr4-engineer.md`; the code as built (`lib/follows.ts`, `lib/likes.ts`, `lib/delete.ts`,
`lib/discovery/purge.ts`, `lib/discovery/weights.ts`, `app/me/following/page.tsx`). The team drafts; only the owner
changes POLICY, Terms and the Privacy Policy (POLICY H). Nothing here is legal advice.

**Two facts the owner should know before approving anything:**
1. **The feed is already per viewer for negative actions.** Since PR-4, an unfollow and a "Hide this trade" lower that
   trader in that viewer's feed (`WEIGHTS.unfollow = −1`, `WEIGHTS.rejectTrader = −1`, ×0.8 per point for 90 days).
   The plan's counsel question 6 still says a mute "is not a ranking"; that premise is now out of date, and the current
   F1 ("no personalized suggestions") is stretched by it. The H1 text below covers it explicitly. Real viewers must not
   reach PR-2 to PR-4 until H1 and H4 are approved, not only PR-5.
2. **A new legal area since the plan was written: state laws on personalized ("addictive") feeds for minors.** New
   York's final rules under its feeds law for minors were released 2026-07-28 and take effect 2027-01-25; they define
   the regulated feed as one ordered by data tied to the user or their past interactions, and they count follows as
   such an input (found: the state attorney general's release; the size thresholds below are from a secondary summary
   and need checking). California's comparable law requires age assurance from January 2027 and targets ordering by a
   user's behavior rather than explicit preferences (found: the state attorney general's 2026 proposed rulemaking).
   Our adults-only rule is attestation, not age assurance (COMPLIANCE §7 already warns that "adults only" is a
   mitigation, not an exemption). This changes the answer to question 4 and drives the extra guardrails in §2.

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

What each added sentence guards, so the owner can see nothing was loosened:
- "nothing personalized about a trade, a security or an action to take": replaces "no personalized suggestions" with
  the line that matters legally (records to read, never trades to make: COMPLIANCE §2, F-2 Out of scope). No "buy X".
- "only what to read … the viewer's own actions": the only inputs are the viewer's own; no third-party data, no other
  viewer's behavior (co-visitation, plan "Later stages", needs another amendment and H3).
- "never … the sign or size of a return": the personal part cannot steer viewers toward winners (F4, TR-9 stays the
  ordering inside the section); tested by the sign-invariance tests in PR-1, PR-3, PR-5.
- "fixed, scanned template … names no security": reasons are facts, never endorsements; no "AI" label (`lib/copy.test.ts`
  scan, plan §8).
- "no performance figure unless the F3 disclaimer is in plain view": rows carry no number; the pane carries the
  disclaimer.
- Unchanged and still binding alongside it: F3b (nothing pushed, no skill labels), F6 (no counts, no celebration).
- **Optional clause, only if the owner adopts the opt-out setting (§2, guardrail G1):** append "A viewer can turn
  personal ordering off in Settings." after "(follows, likes, hides, watchlist, what they read)."

How to apply: the owner edits `docs/POLICY.md` (CODEOWNERS-protected; no agent may). If the owner also wants the scanner
to enforce the template rule, that is plan request P5 (owner change to `scripts/compliance.ts`).

Owner approves: ____ (yes/no)

---

## 2. H2 · The counsel packet, answered by the team

**This is the team's analysis, not legal advice.** No one on the team is a lawyer, and nothing below is a legal
opinion. If the owner approves this section in place of a counsel opinion, that is the owner's risk decision, recorded
as such in the F-2 file and `docs/DECISIONS.md`. It clears COMPLIANCE §2's "counsel before build" step for PR-5 only by
the owner's choice; it does not change POLICY's "No public product launch until counsel signs off".

Evidence tiers used: **found** (statute, regulator text or a regulator's release, read for this draft) and **inferred**
(the team's reading). No court or regulator has, to our knowledge, ruled on a behavior-ordered feed of third-party
broker-verified trade records; every position on securities law below is inferred.

### Q1. Does per-viewer ordering (by what the viewer read, followed, liked) keep the publisher's exclusion?
- **Position (inferred):** probably yes for ordering *which published records to read*, because what is published is
  the same bona fide, regularly published, impersonal record for everyone; the ordering changes what a viewer sees
  first, not what is said, and it is never tailored to the viewer's finances, goals or holdings (we collect none of
  those from viewers). The exclusion's weak point is the word "impersonal": per-viewer selection is by definition
  tailored to the viewer's reading interest.
- **Guardrails:** amended F1 (§1); no per-security suggestion; reasons are fixed templates with no ticker slot; no
  performance number on suggestion rows; sign-invariant personal score; disclaimer on every pane; nothing pushed (F3b);
  no paid placement (F5).
- **Residual risk: medium.** The closest reading to "advice" is symbol affinity: "Trades symbols on your watchlist"
  links a security the viewer cares about to traders who trade it, which a regulator could frame as "whom to follow for
  X". The penalty class is registration-level (COMPLIANCE §13).

### Q2. Is ranking followed traders higher a "suggestion", or a display preference the viewer set?
- **Position (inferred):** a display preference. The viewer chose the trader explicitly; the effect is the same as
  subscribing to a column. It recommends nothing new.
- **Guardrails:** follow is explicit, private, reversible in one tap; the boost does not depend on performance.
- **Residual risk: low** for securities law. Note: New York's minors' feed rules count follows as an input to a
  regulated feed (see Q4), so this answer is about advice, not about minors' feed laws.

### Q3. Is "Follow" acceptable if it never notifies, never pushes and shows no count?
- **Position (inferred):** yes. It is a private bookmark: no notification, no count, the trader is never told, no copy
  or mirror of trades.
- **Guardrails:** F3b (no push), F5 (no copy trading), F6 (no counts); the privacy scans in `lib/follows.test.ts` and
  `lib/likes.test.ts` (no public read of follows or likes).
- **Residual risk: low.** It rises only if follows ever trigger alerts of new trades; F3b forbids that.

### Q4. Do any states require adviser registration for behavior-based ordering, or treat it as profiling with an opt-out duty?
- **Adviser registration (inferred):** state definitions largely track the federal one, with publisher exclusions;
  some are stricter (COMPLIANCE §2). Same reasoning as Q1, state by state. **Residual: medium.**
- **Profiling under state comprehensive privacy laws (inferred from the common statutory model):** the opt-out right
  generally covers profiling used for decisions with legal or similarly significant effects (credit, housing,
  employment, financial services) and targeted advertising. Ordering what to read is neither, and the laws' size
  thresholds are not met today. **Residual: low now**, rising with scale.
- **Minors' feed laws (found, new):** New York's final rules (released 2026-07-28, effective 2027-01-25) define the
  regulated feed by persistent user data or past interactions, follows included; a secondary summary reports they do
  not apply below 5 million monthly users or 20,000 monthly minor users (needs checking against the rule text).
  California's law requires age assurance from January 2027 and targets ordering by behavior rather than explicit
  preferences; its regulations are still in rulemaking and in litigation. After PR-5 our signed-in feed fits both
  definitions; attestation is not age assurance. **Residual: low at today's size in New York, unclear in California,
  and the highest-growth risk in this packet.**
- **Guardrails:** 18+ attestation (P4); no minors' features or copy; G1 (opt-out, below), which gives every viewer the
  non-personalized feed these laws require as the default for minors; G3 (implicit signals off for real viewers until
  counsel), since implicit behavior is the input California targets.

### Q5. Does keeping 90 days of behavior events need consent beyond the Privacy Policy?
- **Position (inferred):** notice should be enough. Events are first-party, minimal (viewer, surface, type, target,
  time: criterion 3), not in a sensitive-data category as the state laws commonly define them (they are which public
  records a viewer read, not account or credential data), never sold, never used for ads, kept 90 days.
- **Guardrails:** column allow-list and the no-personal-data scan (criterion 3); nothing stored signed out; no third
  party, no session replay (COMPLIANCE §5); 90-day purge; deletion's first step; G1 lets a viewer stop it.
- **Residual risk: low to medium.** The argument against: reading behavior on financial content reveals financial
  interests, and GLBA's reach to a viewer (who connects no broker) is untested here.

### Q6. Does a mute the viewer sets ("Not interested") keep the exclusion?
- **Position (inferred):** yes for the mute itself: the viewer removes a trader from their own view, which recommends
  nothing. **But the premise in `plan.md` §7 is out of date:** since PR-4 an unfollow and a trade hide also *lower* the
  trader in that viewer's order (a per-viewer ranking, not only a removal). That part is the same class as Q1, smaller.
- **Guardrails:** a hide never touches a profile (TR-1); the viewer sees and reverses "Not interested" ("Show again");
  90-day end; negative weights only, never a boost from negative actions; sign-invariant.
- **Residual risk: low** (the mute), **as Q1 but smaller** (the down-weights).

### Q7. Is a section that is the same for every viewer, ordered by the published lower bound, with factual reasons and no performance figures, the same class as today's feed?
- **Position (inferred):** yes. Same for everyone, documented method, losses equal, no figures, the record one tap away
  with its disclaimer. Signed-in filtering (own follows and hides removed) is Q6, not Q1.
- **Guardrails:** PR-3's tests (order equals the lower bound, sign invariance, copy scan, no `%` in rows).
- **Residual risk: low.**

### What the team would still send to counsel before real (non-demo) viewers, and why
1. **Q1**: the core question, no direct authority, and the largest penalty class (registration, disgorgement). Ask
   specifically about symbol affinity and the "Trades symbols on your watchlist" reason.
2. **Q4**: fact-specific and state by state, with minors' feed laws taking effect in January 2027 and California's
   rules still moving. Ask whether attestation plus G1 is enough, or age assurance is needed before personal ordering.
3. **Q5, only if G3 is not adopted** (implicit events live for real viewers).
Q2, Q3, Q6 and Q7 the owner can reasonably accept on this analysis.

### Extra guardrails the team recommends (with cost)
| # | Guardrail | Why | Cost |
|---|---|---|---|
| G1 | **Opt-out of personal ordering** in Settings: one switch, "Order my feed by my activity", on by default. Off: feed and section use the signed-out order; the implicit logger is not mounted; follows and "Not interested" still apply (they are the viewer's explicit choices). | Answers Q4's profiling and minors' feed concerns with the non-personalized feed those laws require; strengthens Q5. | ~120 lines in PR-5a: one `users` column via `schema_add_column`, a form and action, one branch in the feed read, the logger's mount check; tests: off equals signed-out order, off writes no event. |
| G2 | **"Reset my feed"** on the Following page: one button that deletes the viewer's trade hides, unfollow notes and (after PR-5) discovery events. | Today a viewer cannot see or remove a trade hide after the 5-second Undo, or an unfollow note, without deleting the whole profile. The Privacy text has to say how to delete; it should not have to say "you can't". Needed before real viewers even on PR-4. If O3 makes trade hides permanent, G2 becomes required. | ~60 lines and a confirm step; one DB test, one e2e. |
| G3 | **Implicit signals off for real viewers until counsel answers Q4 and Q5**: impressions, dwell, skip and swipe-open logged only for demo or internal accounts behind one constant; explicit signals (follow, like, hide, share, watch) live. | Implicit behavior is what California's law targets and what Q5 is about; explicit signals carry most of stage 1's value at today's scale. Criterion 2 lists implicit signals, so this is the owner's call. | ~10 lines and one test. |
| G4 | **Deletion copy**: Settings "Delete my profile" explanation adds "your follows, likes, hidden traders and trades, and your activity". | The deletion screen should name what it deletes (FTC §5: notice matches behavior). | Copy only. |

Owner approves: ____ (yes/no). Guardrails adopted: G1 ____ G2 ____ G3 ____ G4 ____

---

## 3. H4 · Privacy Policy text (follows, likes, hides, unfollows, discovery activity)

Final copy for the Privacy page, ready to paste as one section. Part A is true for what is built today (PR-2 to PR-4).
Part B is added the day PR-5a merges, and its two marked replacements the day PR-5b merges. Lines in [brackets] go in
only if the matching guardrail ships. The rest of the Privacy Policy (account, sign-in, broker data, watchlist,
contact, backups) is outside this section.

**Owner checks before pasting:** (1) if the database host keeps backups, add one sentence on how long backup copies
last; (2) if O3 makes trade hides permanent, "Hide this trade" changes to "until you remove it" and G2 becomes required;
(3) the page also stores a one-time flag that the follow privacy line was shown, which needs no separate line here.

### Part A (paste now)

> ## Your feed choices: follows, likes and hides
>
> When you're signed in, you can follow traders, like records, and hide traders or trades from your feed. Here is what
> we store when you do, who sees it, how long we keep it and how to remove it.
>
> **Only you see it.** Your follows, likes and hides are shown only to you, on Settings → Following and hidden traders.
> Traders are never told who follows, likes or hides them, and no follow or like count is shown anywhere. People who run
> Stock Social can access this data only to operate, secure and fix the service.
>
> **Nothing is stored when you're signed out.** Browsing the feed or a profile signed out stores none of it.
>
> **No one else receives it.** We don't sell or share it, and we don't send it to advertisers, analytics companies or
> trackers. It is stored on the servers that run Stock Social and is used only to order your own feed and suggestions.
>
> **Follows.** We store which traders you follow and when. Followed traders are left out of your suggestions, since you
> already follow them. We keep a follow until you unfollow.
>
> **Unfollows.** When you unfollow, we delete the follow and keep a note for 90 days that you unfollowed that trader.
> During those 90 days their records appear slightly lower in your feed; they are never hidden. Following them again ends
> the note early. It is deleted within a day after it ends.
>
> **"Not interested."** We store which trader you hid, when, and when the hide ends. That trader is left out of your
> feed and suggestions for 90 days. Their profile stays public and nothing is removed from it. You can undo it right away,
> or later with "Show again" on your list. The note is deleted within a day after the hide ends.
>
> **Likes.** We store which records you liked, whose they are, and when. They appear in your Liked records list. "Unlike"
> deletes a like at once.
>
> **Hide this trade.** We store which trade you hid, whose it is, when, and when the hide ends. That trade is left out of
> your feed and your Similar trades for 90 days, and its trader appears slightly lower in your feed for those 90 days.
> The trade stays on the trader's public profile. You can undo it in the 5 seconds after hiding it. The note is deleted
> within a day after the hide ends.
>
> [**Reset my feed.** "Reset my feed" on your Following and hidden traders page deletes your trade hides and unfollow
> notes at once.]
>
> **Deleting your profile.** Settings → Delete my profile deletes your follows, likes, hides and unfollow notes at once,
> as its first step, and removes you from other people's lists the same way.
>
> | What | What we store | Who sees it | How long we keep it | How to remove it |
> |---|---|---|---|---|
> | Follows | Trader, date | Only you | Until you unfollow | Unfollow; delete your profile |
> | Unfollow notes | Trader, start and end date | No one; it only orders your feed | 90 days, deleted within a day after | Follow again; [Reset my feed;] delete your profile |
> | "Not interested" | Trader, start and end date | Only you | 90 days, deleted within a day after | Undo; Show again; delete your profile |
> | Likes | Record, trader, date | Only you | Until you unlike | Unlike; delete your profile |
> | Hidden trades | Trade, trader, start and end date | No one; it only orders your feed | 90 days, deleted within a day after | Undo (5 seconds); [Reset my feed;] delete your profile |

### Part B (add the day PR-5a merges, before any discovery activity is recorded for real viewers)

> **Discovery activity.** When you're signed in, we record what you do with records in the app so your feed can show you
> more records like the ones you read: which records and profiles you open, like, share, hide or follow, which you scroll
> past quickly, and roughly how long you look at one (as a range, not a timer). Each entry contains only your account, what
> you did, which trader, trade or symbol it was about, where in the app it happened, and when. It contains no brokerage
> data, no amounts and no location. We use it only to order your own feed and suggestions and to write their reasons,
> such as "Similar holding period to @trader". It is never used to suggest trades or securities, never shown to anyone,
> and never combined with other people's activity. Entries are deleted automatically once they are 90 days old.
> [You can turn this off in Settings with "Order my feed by my activity": we then stop recording it and your feed uses
> the same order everyone signed out sees.] [Reset my feed also deletes it.] Deleting your profile deletes it at once.

Table row to add:

> | Discovery activity | What you did, which trader, trade or symbol, where, when | No one; it only orders your feed | 90 days, then deleted automatically | [Turn off in Settings; Reset my feed;] delete your profile |

Replacements the day PR-5b merges (personal ordering live):
- Follows, second sentence becomes: "Followed traders appear higher in your feed and are left out of your suggestions,
  since you already follow them."
- Likes, second sentence becomes: "They appear in your Liked records list, and records like the ones you liked appear
  higher in your feed."

Owner approves: ____ (yes/no)
