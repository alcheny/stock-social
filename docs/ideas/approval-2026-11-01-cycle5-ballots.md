# Approval council cycle 5: every ballot (Appendix B)

Every member's files, by round, verbatim as filed in the chair's working directory. Members are simulations; every
trade named is fictional. Not legal advice. The record is [approval-2026-11-01-cycle5.md](approval-2026-11-01-cycle5.md).

Contents: the chair's ballot and notes; round 1 ballots; round 2 debate statements; round 3 revised ballots;
round 4 the leading set and the red team's case; round 5 final ballots.

## Chair's ballot (round 0)

## Read first (required)
- docs/direction/cycle5-2026-11-01.md: whole document; section 6 holds the 22 briefs, section 7 the hand-offs,
  section 8 the four new owner questions (cited below as "C5 Q1..Q4").
- docs/direction/owner-decisions-2026-11-01.md section 2 (owner questions "OD 2.n"; NONE is answered yet).
- docs/POLICY.md (binding), docs/COMPLIANCE.md section 1, team/approval-council.md (the approval rule),
  docs/ideas/approval-2026-11-01-cycle4.md (last cycle's record and format).
- For the four re-votes: docs/features/F-21-*.md, F-28-*.md, F-29-*.md, F-30-*.md.
Verify any claim you rely on in the code with `sed -n` / grep. Every trade you mention must be fictional.

## Rules (team/approval-council.md, binding)
- Approved = final vote at least 10 of 15 approve (with or without conditions) AND second-vote mean >= 3.5 AND no veto.
- Vetoes: legal committee member (breaks POLICY: blocks until the text is reshaped to fit); contrarian (common sense:
  confusing, dishonest or out of proportion); chair's decisions-keeper check (contradicts an owner decision -> the item
  goes to the owner: it can be approved only as "approved, waits on OD/C5 Q n").
- At most SIX new features per cycle (build slots; features touching the same files count as one slot). Re-approvals
  of lapsed features are not new.
- Approval never changes POLICY, overrules an owner decision, adds a dependency, touches credentials or deploy
  settings, or changes guardrails; such parts are flagged for the owner.
- Priority (cycle 4 precedent): anything false on screen today and anything that could publish a wrong Verified figure.
- In flight now (do not duplicate; note hand-offs): F-16/F-17 (#100), F-23 (#97), F-24 (#84), F-25, F-31 (#98) and the
  cycle-5 fixes list F5-2..F5-27 (branch claude/fixes-cycle5). Defects are on the fixes list, not on this ballot.

## Scoring
0 = harmful/reject, 1 = not worth a slot, 2 = weak, 3 = worth doing later, 4 = approve this cycle, 5 = top priority.
Score the item AS IT COULD BE APPROVED (owner-dependent items can be approved as "waits on OD n").

## The ballot (26 items)

### A. Cycle-5 briefs (cycle5 doc section 6, by rank)
| Item | Title | Chair's round-0 note (dependencies, home) |
|---|---|---|
| C5-1 | Transfers leave the backward window | Full form waits on OD 2.28 + vendor answer (MRC2-10). Interim (count the window's sells under their own "transfer" line) can build after #84. Matcher slot with F-28/F-30. |
| C5-4 | Ranking weight needs evidence | Waits on C5 Q3 (amends TR-9, protected DESIGN; replaces the owner's 10-bet floor). "Too early to tell" wording = OD 2.32. |
| C5-5 | One open-positions line on every surface | Values wait on OD 2.25; the one-producer helper and "per closed trade" wording can go now. After f16/f17 and f25 merge. |
| C5-10 (MK-P1) | Forward record (trades opened after connecting) | Waits on OD 2.7 (makes the connection date public on every record). Size M. |
| C5-32 (MK-P2) | Check code on every share picture + /check | No OD. A dedicated server key is a deploy setting (owner sets the env) unless derived from an existing key. Size M. |
| C5-30 | Publish a trade only once its date has passed | Amends the options-era 24 h grace (#62, an orchestrator ruling the council may amend). After #84. |
| C5-31 | Fees in the return's denominator | Waits on C5 Q1 (DESIGN §2.5, protected). Matcher version bump. |
| MK-P6 | Truthful history window ("Imported history starts ...") | Engineer checks the vendor field first; fallback is one /how sentence. Part 2 of F5-6. |
| C5-43 | Known limits 3 (four ponytails a-d) | Engineering/scale; (a) rebases on f16/f17. Could be a chore batch rather than a feature. |
| MK-P3 | Live record badge image for bios | New public image surface; OD 2.62 before outreach. |
| C5-34 | Owner previews own card before sharing | No OD. |
| C5-35 | Deletion looks and reads like what it does | Wording follows OD 2.9. Rebases on f16/f17 (app/auth/actions.ts). |
| MK-P5 | "How to read a trading claim" page | No OD. Static page; T1-T4, F1. |
| C5-33 | No check mark beside a security | Closest owner principle OD 2.38 (not blocking). After f25 (app/t/[symbol]/page.tsx). |
| C5-39 | Arrow glyphs out of accessible names | Merges with C4-34(c) (cycle 4 routed it to the a11y fixes lane as a chore). |
| C5-36 | One name for the record in the nav + copy frictions | Nav part "owner decides through F-18" (draft). Rebases on f16/f17 (app/layout.tsx). |
| C5-41 | Record tools pitch names the job | Legal committee re-signs (F-3). Copy only. |
| C5-38 | Selected range visible in forced-colours mode | Small CSS; possibly a chore. |
| C5-37 | /account without the performance-page furniture | Removes a disclaimer box from a page with no figures; footer keeps links. |
| C5-42 | Behaviour over source text in tests | Adds tests only; size M in slices. |
| C5-40 | JIT off for the app role | Ops doc + coverage flag; applying it in production is a deploy setting (owner). |
| MK-P4 | Evidence filters in Record tools (paid tier) | Needs legal committee review of the feature list and OD 2.47's week-8 reading. |

### B. Lapsed cycle-4 approvals (re-vote; their lapse clauses send them here)
| Item | Feature | State at e16d6aa |
|---|---|---|
| L-28 | F-28 a short's cover never prices a later trade | Owner has not answered OD 2.27 (= cycle-4 Q1(b)). Lapses unless re-approved (it would stay blocked on OD 2.27). |
| L-30 | F-30 same-instant order on date-only stamps | Owner has not answered OD 2.26 (= cycle-4 Q1(a)). Same. C5-1 shares its matcher slot. |
| L-29 | F-29 gated options wording true for every record | Code prerequisites MERGED (#85 labels branch, #77 F-20). Remaining: the legal committee's signed words, which its own AC records in the build PR. Could be re-approved as ready with the legal words as the build's first step. |

### C. Bring-back (cycle 4: "F-21 returns once F3-2 merges")
| Item | Feature | State |
|---|---|---|
| L-21 | F-21 exclusion counts beside the headline (pane and record strip) | F3-2 MERGED in #85. Its shared sum also takes F-22's count if F-22 lands first (F-22 is draft, OD 2.28). Same pane files as F-23 (#97, in review) and C5-5. |

## Chair's notes for round 2


Round 1 means are in r1-table.md. Every member's ballot is r1-<CODE>.md (read the ones on your speaker items).

1. **L-28 is overtaken by #89 (verified).** `lib/trades.ts:48-53`: after an oversell, every later sell of the pair is
   counted in `excluded`, never priced; a rename moves the mark (F-28's rename part is already on main, `:53`). The
   fixes-cycle-4 committee recorded the contradiction (`docs/features/logs/fixes-cycle4/committee-2026-11-01.md:119-122`:
   "F-28's build should start from this rule"; probes +65%/+60%/+25% published by the k-unit rule). F-28's decision
   "taint only the next k units, later lots fresh" would LOOSEN main. RT probes: rt/p1.ts, rt/p2.ts. Options: let it
   lapse with an owner note (OD 2.27 is overtaken by #89), or re-approve only a residual that never loosens #89.
2. **L-30 is mostly on main (RT).** With evidence, #89 counts every later sell. Residual: broker-position evidence
   (protected `lib/broker.ts` + stored units: owner) and the readout class-count row.
3. **MK-P6 (EN, verified):** the vendor client exposes no earliest-history date (`lib/broker.ts:89-94`), so by its own
   fallback MK-P6 becomes one /how sentence: fixes-lane size, arguably part of F5-6.
4. **Legal committee (LC) POLICY objections, with the reshaping that resolves each:**
   - C5-41 (F3a): "every closed trade" / "nothing hidden" are completeness claims. Reshape: "Compare whole public
     records side by side: closed trades imported from connected accounts, losses and ranges included. Traders can't
     remove single trades." LC re-signs in the PR.
   - MK-P3 (F6, F3, F3b): not a "badge" (rename "record image"); no award styling; both disclaimer sentences legible at
     the rendered size, else no figures at all; no symbol, last-trade or "new" indicator; outreach waits on OD 2.62.
   - C5-10 (P3/P6): forward figures only on records whose consent version names the connection date (OD 2.7).
   - C5-32 (F3a, S1/S2): /check claims only that the picture's figures match the stored record (never "authentic",
     "genuine", identity or completeness; a mismatch is never "forged"); key = dedicated env set by the owner, or
     HKDF-derived under a fixed purpose label, never raw APP_SECRET_KEY, never logged.
   - MK-P4 (F1; COMPLIANCE §2): blocked unless no filter on any return/win rate/range/rank, order = the free documented
     method, no alerts, no symbol; LC review under F-3; OD 2.47.
   - C5-37 (not POLICY): conflicts with the F-3 legal condition R8 (`docs/features/logs/F-3/committee-2026-11-01.md:41`).
     Keep the disclaimer sentence on /account (muted is fine); drop only the duplicate links.
5. **Contrarian (CO) veto:** MK-P3 as briefed (cannot be legible at bio size). Lifts if reshaped to a figure-free
   image (handle, trust state, "see full record") or a rendered-size legibility test passes, and deferred to OD 2.62.
   CO also asks to split C5-4: spread floor + "Too early to tell" now; replacing the owner's 10-bet floor waits on C5 Q3.
   Chair's caution: the spread floor changes the printed TR-9 interval (DESIGN, protected) and "Too early to tell" is
   OD 2.32's wording, so the split may not free anything from the owner. Argue it.
6. **Chore routing.** EN, A11Y, CO, BL, TE and RE want C5-39, C5-38, C5-40, C5-42 and C5-43 (and C5-33 per A11Y/BL)
   in the chore/fixes lanes, outside the six-slot cap and without feature files. In round 3 you may mark any item
   ROUTE=chore instead of scoring it for a feature slot.
7. **Slot map (EN), for the six-new cap:** matcher (C5-1, C5-31; L-28/L-30 would ride as re-approvals); pane/strip
   (C5-5 with L-21, L-29 re-approvals; after F-23 #97, f16/f17, f25); image (C5-32, MK-P3); forward (C5-10, later
   MK-P4); C5-4 alone; C5-30 alone (lib/sync.ts after #84, C5-43d may ride). Contrarian asks for 3 active slots at most.
8. **Privacy (PR):** public exclusion counts (`users.excluded_*`) are named neither in the consent scope line
   (`lib/copy.ts:88`) nor `lib/privacy-fields.ts`; C5-1 and L-21 add surfaces for them, so OD 2.7's consent version
   should name them. C5-10 needs OD 2.7 amended to name the first-connection date.
9. **Design system (DS):** C5-33 enforces design-system ruling 1 (bare "Verified", no glyph) and §4.3; a slice of
   F-18. VW: a demo-only stock page must keep a visible Demo label once the glyph leaves the heading.
10. **Growth (GR):** C5-34's preview must be the picture the Share button actually sends: the post-connect prompt
    previews the opengraph card (`app/u/[handle]/share-prompt.tsx:39-40`) while Share sends `/story?format=square`
    (`app/u/[handle]/share-card.tsx:15-16`).
11. **Tester (TE):** C5-5's "one producer" needs a render-equality test, not a text scan; C5-4's "keep today's order"
    would pin a method OD 2.33 may replace; L-21's guard must list in-memory `MatchResult` `excluded*` keys (e.g.
    #84's `excludedHeld`).

## Round 1: independent ballots

### TR (round 1)

#### Round 1 ballot: TR (trader)

Lens: a retail trader who connects a broker and shares a public record. Is the record fair to me? Is it worth
sharing? Does it avoid embarrassing or exposing me? Is it safe against people who game the board or fake my card?
Repo read at origin/main e16d6aa. Every trade mentioned is fictional.

| Item | Score | Reason (one or two lines) | Conditions you'd attach |
|---|---|---|---|
| C5-1 | 5 | A rival can drop a chosen loss with a one-share transfer and stay Verified. That makes my honest record lose to a steered one. Confirmed: TRANSFER and the external types are share-moving (`lib/corporate-actions.ts:157`), and every unpriceable action keys the backward window per pair (`lib/trades.ts:128-133`). | Approve the interim now (after #84): the window's sells counted under their own "transfer" line, never the generic one. The full form waits on OD 2.28 and the vendor answer (MRC2-10). AC: inserting a transfer never improves a shown average or win rate. Shares the matcher slot with L-28/L-30. |
| C5-4 | 4 | Ten flat +1% trades outrank my 200-bet record (0.299 vs 0.167). The spread can reach zero (`lib/bets.ts:47`), and the only floor is 10 bets (`lib/confidence.ts:18`). That is unfair to long records, and the fix is symmetric for losses. | Approved as "waits on C5 Q3". Split it into two parts the owner can answer separately: (1) the 1-point spread floor and "Too early to tell" for a zero-width range (OD 2.32); (2) the move to the moderate tier. Below the tier, a record must stay visible in the feed by recency and never be hidden. |
| C5-5 | 4 | A shared trade link shows my realized average in the gain colour beside "2 open, unrealized" (`lib/copy.ts:174`), while my card shows the open loser. A viewer who spots the mismatch thinks I dressed it up. | "per closed trade" wording and the one-producer helper now. The values follow OD 2.25. Build after f16/f17 and f25 merge. No new unrealized value on any surface until 2.25 is answered. |
| C5-10 | 4 | "Since connecting" is the strongest credibility line an honest trader can earn, and it only adds. The cost: my connection date becomes public on every record. | Approved as "waits on OD 2.7" (the consent version names the connection date first). The line is never larger than the headline. Shows "Too early to tell" below the floor. Hidden on Demo records. A reconnect never resets the date (pure-function test). |
| C5-32 | 4 | Protects me from an edited copy of my card, either faked better to scam people in my name or faked worse to smear me. Pictures travel without their link. | /check must say why figures differ (a later import or a matcher change) in neutral words, never implying the trader edited anything. The code stays small and does not crowd the card's figures or disclaimer. The key is derived from an existing server key, or the owner sets the env (deploy setting). A deleted trader's codes stop resolving. |
| C5-30 | 3 | Fair, small truth fix: a close dated tomorrow shows under "through today" (`lib/sync.ts:39` publishes up to 24 h ahead). The cost to me is a one-day delay. | The sync must schedule the rebuild when a quarantined row's date passes, so my trade is never stuck unpublished. Build after #84. |
| C5-31 | 4 | Small trades with big fees show inflated returns (+100% on +50% cash paid; the denominator is `cost` alone, `lib/trades.ts:317`), and the feed sorts by size, so they beat fairly priced records. | Approved as "waits on C5 Q1". Add a dated /how note. The rebuild reports how many figures moved. Pin the worse-than-−100% exit-fee case with a test. |
| MK-P6 | 4 | My record starting at the broker's history limit reads as "started right after a good run". Saying "Imported history starts ..." protects honest traders from that reading. | The engineer confirms the vendor field first. If it is missing, use the one /how sentence fallback. No figure changes. Never imply the trader chose the start date. |
| C5-43 | 3 | (b) Stale old-matcher figures for about 3 deploys, and (d) the freeze mark on the app clock, both touch my record's correctness. The rest is scale work. Better as a chore batch than a feature slot. | Run it as a chore batch. (b) and (d) go first. (a) rebases on f16/f17. |
| MK-P3 | 3 | A bio badge is worth sharing, but a tiny image carrying both disclaimer sentences is hard to make legible. Outreach depends on OD 2.62. | Later cycle, after C5-34 and C5-32 (the badge should carry the check code). Legibility test at the real size. |
| C5-34 | 5 | No trader shares a card they haven't seen. Seeing it first is what prevents an embarrassing unfurl, and it is the product's main share loop. S, no OD. | It must be the same image the unfurl serves, with its alt text. Loads only for the owner, lazy. Never a "hide this trade" control next to it (TR-1). |
| C5-35 | 4 | Deleting is the one irreversible action I take. Today it looks routine and nothing confirms it afterwards. A trader must know what stays and the one-year handle hold. | Wording follows OD 2.9, with no "permanently" until the owner answers. Rebase on f16/f17. An e2e walk at 320 px. |
| MK-P5 | 3 | Teaches viewers why a full record beats a screenshot, which indirectly helps honest traders. Low risk. | Demo examples only. Passes the banned-claims walk. Later is fine. |
| C5-33 | 3 | A check mark beside a ticker reads as a rating of the stock. A real wording fix, but small for traders. | Rebase on f25. A source scan pins it. |
| C5-39 | 3 | Accessibility polish. It belongs in the a11y chore lane with C4-34(c), not in a feature slot. | Route it as a chore. |
| C5-36 | 3 | "My record" opening a private page muddles what is public and what is private, which matters to a trader's sense of exposure. | Nav part through F-18 (owner). The copy lines can go as chores. |
| C5-41 | 2 | Copy for paying viewers. No trader impact. | Legal committee re-sign. |
| C5-38 | 2 | Real, but beyond AA. A chore. | Route it as a chore. |
| C5-37 | 2 | Cosmetic. Removing a disclaimer box needs care, even on a page with no figures. | Keep the F3 disclaimer test green, and keep the footer links. |
| C5-42 | 3 | Behavioural tests protect my record's math from silent regressions. Add-only, so safe. | Test count never drops. Slice it. Chore lane. |
| C5-40 | 2 | Ops note. Applying it in production is the owner's deploy setting. | Docs and the coverage flag only. Flag it to the owner. |
| MK-P4 | 2 | Paid filters ("Verified only", "closed trades ≥ n") would favour long honest records, but they wait on the legal review and OD 2.47. No symbol filter is right. | Not this cycle. When it comes back: no rank number, no "top". |
| L-28 | 5 | Publishes a wrong Verified figure: the fictional probe shows +28.6% where the truth was −10%. The priority precedent applies, and it was 15/15 last cycle. Over-counting my pre-history trades (probe A) is acceptable because they are counted, not misstated. | Re-approve, still blocked on OD 2.27. One matcher builder with L-30 and C5-1. A thesis survives as held or orphaned, never deleted. |
| L-30 | 4 | Same harm class (+7.1% Verified for a same-day short) but narrower, with a residual. The red team's narrowing keeps traders from steering it. | Re-approve, blocked on OD 2.26. Build with or after L-28. Intraday twin test. |
| L-29 | 5 | False on screen today, and it embarrasses me. /how says options show only for traders who consented, but every record is gated, so a trader who consented to everything reads as withholding. Prerequisites merged (#85 at 8e3e9a51, #77 at 63f48f44). | Re-approve as ready. Step one of the build is the legal committee's signed words, recorded in the PR. While the gate is closed, no public surface says "consented", "not asked" or "declined". |
| L-21 | 4 | Shows the exclusion count where readers look (the pane and the strip). The same rule holds for everyone, so no rival looks cleaner by having excluded trades nobody sees. F3-2 merged in #85. | Neutral muted wording; the trader can't turn it off, and no blame word. The shared sum takes C5-1's transfer line and F-22's count when they land. Same slot as F-23 and C5-5, so build after #97. |

### VW (round 1)

#### Round 1 ballot: VW (viewer: signed-out skeptic arriving from a shared link)

Base: origin/main e16d6aa. Every trade mentioned is fictional. Lens priority: anything false or misleading on screen
today, and anything that could publish a wrong Verified figure.

| Item | Score | Reason (one or two lines) | Conditions you'd attach |
|---|---|---|---|
| C5-1 | 5 | A viewer sees a Verified record whose loss the trader removed after the fact (80% -> 100% win rate) behind a generic "1 trade excluded" line; trust in "Verified" is the whole product. Exclusion path: `lib/trades.ts:128-133`, `:149-153`. | Approve the interim now (after #84): the window's sells counted under their own "transfer" line on the profile; full form waits on OD 2.28 + vendor answer (MRC2-10). Test: inserting a transfer never improves a shown average or win rate. |
| C5-4 | 4 | Ten identical +1% trades print "(+1.0% to +1.0%)" and "Past results: above zero" and outrank a 200-bet record: to a viewer that reads as near-certainty from almost nothing (`lib/bets.ts:47-49`, `lib/confidence.ts:18`). | Approved, waits on C5 Q3 (ranking floor) and OD 2.32 ("Too early to tell"). Symmetric for losses; losses still rank equal to gains. |
| C5-5 | 4 | A shared trade or month link shows a realized average in the gain colour beside a bare "2 open, unrealized" (`lib/record-strip.ts:119`, `lib/copy.ts:174`) while the card shows a -15% open loser: two surfaces, two stories. | "per closed trade" wording and the single producer now; values wait on OD 2.25. No new unrealized value on any surface before 2.25. After f16/f17 and f25. |
| C5-10 | 4 | The one selection a skeptic cannot check today: did they connect right after a hot run? A "since connecting" line answers it without hiding anything. | Waits on OD 2.7 (connection date public). Never larger than the headline; "Too early to tell" below the floor; never "proven"/"live track record"; Demo never shows it. |
| C5-32 | 4 | Screenshots of cards travel without their link; a viewer has no way to check one today. /check lets them, signed out. | /check never says "matches" when figures differ and states it proves the picture vs the record, not identity or completeness; key derived from an existing secret or set by the owner (deploy setting flagged); code small enough not to crowd the disclaimer on images. |
| C5-30 | 4 | False on screen today: "Trades close through today" above a close dated tomorrow (`lib/sync.ts:36-39`, `app/u/[handle]/month/[ym]/page.tsx:89`). | After #84; the future count shows the held row; the sync schedules the rebuild when its date passes. |
| C5-31 | 4 | "+100%" where the cash-paid return was +50%, and the feed sorts by size, so these lead what viewers see first (`lib/trades.ts:317` divides by cost alone). | Waits on C5 Q1 (DESIGN §2.5 protected). MATCHER_VERSION bump; dated /how formula note. |
| MK-P6 | 4 | "Record since <date>" reads as "trading since" when it is really the broker's history limit; cheap, no figure changes. | Vendor field checked first; fallback is the one /how sentence; wording never implies completeness (F3a). |
| C5-43 | 3 | Mostly scale; (b) matters to viewers (old-matcher figures stay up ~3 deploys after a fix), (d) freeze timing. Better as a chore batch than a slot. | Route as chore; (b) first. Rebase (a) on f16/f17. |
| MK-P3 | 2 | A tiny image of figures out of context, in bios: both disclaimer sentences "legible at that size" is doubtful, and it is a push-like marketing surface before outreach rules (OD 2.62). | If approved: legibility test at rendered size for disclaimers; Demo/frozen states; legal confirms OD 2.62 first. |
| C5-34 | 3 | Owner-facing; indirectly helps viewers because traders who see the card notice errors. | Same image the unfurl serves; owner only; no first-paint cost. |
| C5-35 | 3 | Owner-facing safety of an irreversible action; not a viewer issue. | Wording follows OD 2.9; no "permanently" until answered. |
| MK-P5 | 3 | Helpful to exactly my persona (how to read a claim), but it is a marketing/education page, not a fix to anything false. | Demo examples only; never advice on trading; banned-claims and marks scans; disclaimer. |
| C5-33 | 4 | "<TICKER> ✓ Verified" in the heading (`app/t/[symbol]/page.tsx:121`, badge text `app/ui.tsx:29`) reads as the stock being verified or rated (F3b). | The trust state must still show: a demo-only stock page keeps a visible Demo label, and mixed/public-filing states stay distinguishable. After f25. |
| C5-39 | 3 | Screen readers hear "left arrow Feed": noise, not deception. Chore lane with C4-34(c). | Route as a11y chore, not a slot. |
| C5-36 | 2 | Signed-out viewers never see "My record"; the nav name is F-18's (owner). Small copy wins only. | Copy parts as chores; nav waits on F-18. |
| C5-41 | 2 | Pitch copy for a paid tool; no viewer harm today. | Legal re-sign; no "best/top". |
| C5-38 | 3 | In forced colours a viewer cannot tell which range the chart shows, so they may misread its figures. Tiny CSS. | Chore; e2e with forced colours emulated. |
| C5-37 | 2 | Removing a disclaimer box from a figure-less page is fine but low value. | F3 disclaimer test still passes on every performance surface. |
| C5-42 | 2 | Test quality; worth doing, not worth a build slot. | Chore slices; test count never drops. |
| C5-40 | 2 | Ops doc; no viewer-visible effect beyond speed. | Production setting is the owner's. |
| MK-P4 | 1 | Filters that order records edge toward "top traders" lists for payers; waits on legal and OD 2.47; no viewer trust gain. | If ever: no symbol filter, no rank numbers or "top/best", free viewers see records unchanged. |
| L-28 | 5 | Publishes a wrong Verified figure today (fictional: +28.6% shown where the trade lost -10%). Re-approve as is. | Stays blocked on OD 2.27; same matcher builder as F-30 and C5-1. |
| L-30 | 4 | A phantom same-day trade can publish Verified on date-only stamps; narrower than F-28 and the residual case remains. | Stays blocked on OD 2.26; build with F-28. |
| L-29 | 5 | False on screen today for every record: /how says option results show "only on records whose trader has consented" (`lib/copy.ts:549`) while every trader is gated (`lib/options-gate.ts:4-5`), so a fully consenting trader reads as withholding. Prerequisites merged (#85, #77). | Ready now with the legal committee's signed words as the build's first step; keep the last qualifier on every headline surface. |
| L-21 | 5 | The swipe pane (SW-1's main record view) shows win rate and average with no sign of exclusions (no exclusion line in `app/pane.tsx`); the viewer sees a completeness the record lacks. F3-2 merged (#85). | One sum function shared with the profile; neutral muted wording; disclaimer stays in view at 360 px; one slot with F-23/C5-5 pane files. |

### BL (round 1)

#### Round 1 ballot: BL (business lead), approval council cycle 5

Lens: launch gates (DESIGN §3.5: G1 >= 50 connected traders, G2 >= 60% share their card, G3 >= 5,000 external
profile views/week, G4 viewer D7 >= 15%; OD 2.61 makes G0/G1 hard), trader supply, cost per build slot, what moves the
business before real users. Very high bar: 4 means "spend one of six slots now".

The market evidence (cycle5 §4.2, MK-3: "verified" is now free at scale in a large broker's own feed) means our only
defensible position is "a record the trader can't edit; losses can't be removed". So anything that lets a trader remove
a loss, or prints a wrong Verified figure, outranks growth surfaces. Growth items score only if cheap, OD-free and
aimed at G2/G3.

Code checked at e16d6aa: `lib/corporate-actions.ts:157` (TRANSFER types are share-moving), `lib/trades.ts:126-134`
(unpriceable actions keyed into the repricing window), `lib/confidence.ts:18` (`RANK_MIN_BETS = 10`), `:24-27` (tiers),
`lib/sync.ts:38-39` (24 h `notFuture` grace), `lib/trades.ts:317` (denominator is `cost` without `entryFees`),
`lib/record-strip.ts:119` + `lib/copy.ts:174` (bare "n open, unrealized"), `app/t/[symbol]/page.tsx:121` (Badge in the
ticker heading), `lib/privacy-fields.ts:71` (connection date public only for an idle record), `lib/copy.ts:833` (Record
tools pitch is mechanics).

Proposed slot map (six new max): (1) matcher slot = C5-1 interim + C5-31 (+ re-approved L-28/L-30, same builder);
(2) pane/strip slot = C5-5 (+ re-approved L-21, after F-23 #97); (3) C5-30 after #84; (4) C5-32; (5) C5-34;
(6) C5-4 (waits on C5 Q3). L-29 is a re-approval with its own copy slot.

| Item | Score | Reason (one or two lines) | Conditions you'd attach |
|---|---|---|---|
| C5-1 | 5 | A trader can delete a chosen loss and stay Verified (80% -> 100% win rate in the fictional probe). That kills the one claim the product still owns now that "verified" is free elsewhere. The interim costs little and builds after #84. | Interim now: the window's sells counted under their own "transfer" line, folded into L-21's one sum. Full form "approved, waits on OD 2.28 + the vendor's written MRC2-10 answer". One matcher builder with F-28/F-30/C5-31, one MATCHER_VERSION bump. Test: inserting a transfer never improves a shown average or win rate. |
| C5-4 | 4 | Ten identical +1% trades get "above zero" and out-rank a 200-bet record. At wave 0 (10-20 traders) one such record could lead the feed seen by every invited viewer. S. | "Approved, waits on C5 Q3" (replaces the owner's 10-bet floor, amends protected TR-9). Symmetric for losses. The "Too early to tell" wording follows OD 2.32. Below the tier, order by recency, never randomly. Readout shows how many records rank (counts only, under-5 suppressed). |
| C5-5 | 4 | Trade and month links are the most-shared surfaces (G2/G3), and today they show a realized average in the gain colour beside a bare "2 open". That is misleading on the growth loop. S. | The one-producer helper and "per closed trade" wording go now. Values "wait on OD 2.25". Build after f16/f17 and f25 merge, same slot as L-21. No unrealized value on a new surface before 2.25. |
| C5-10 | 3 | It is the right answer to selection bias and the free broker feed. But it is M, blocked on OD 2.7 (a new public field; C3-43 failed on the same point), and forward trades barely exist inside the week-8 window. | Revisit once OD 2.7 is answered. If approved, "waits on OD 2.7" and it takes no build slot until then. |
| C5-32 | 4 | Before outreach, share pictures are what travels, and they are the easiest thing to forge. A check code protects G3's referrer traffic and the brand. No OD. M. | Key: a new env var the owner sets (deploy setting, flagged), or an HKDF derivation from an existing key with a distinct label. Never the raw APP_SECRET_KEY (see C5-18). Never print "matches" when figures differ. Rate-limited. Deleted traders' codes stop resolving. Ships before outreach, not necessarily before wave 0. |
| C5-30 | 4 | False on screen today: a Nov 2 close under "through today" on Nov 1. S. Arguably a fix, but it amends #62. | Build after #84 (same future-count query). The sync schedules the publishing rebuild. Count shown meanwhile. |
| C5-31 | 4 | A wrong headline figure (+100% where cash returned +50%), and feed order by size puts exactly these trades first. S. Rides the matcher slot. | "Approved, waits on C5 Q1" (protected DESIGN §2.5). Same matcher builder and version bump as C5-1. Dated /how note. |
| MK-P6 | 3 | It is a real completeness nuance, but small, and F5-6 part 1 already fixes the false "full trade history" copy. Depends on a vendor field we haven't seen. | Engineer checks the field first; otherwise do the one /how sentence as a fix, not a slot. |
| C5-43 | 2 | Scale work for 15k traders, while we are trying to reach 50. It belongs in the chore lane, not a feature slot. | Route (a)-(d) as chores. (d), the freeze clock, has trust value: do it first. |
| MK-P3 | 2 | A second share surface before G2 proves the first one. It adds outreach risk (OD 2.62) and carries no check code. | Later. If ever built, carries C5-32's code and the via=badge class. |
| C5-34 | 4 | Aimed straight at G2 (>= 60% share): traders share what they have seen, and card quality was the BL's standing concern at sign-off. S, no OD, no vendor. | Lazy-loaded, owner-only, the same image as the unfurl. F-15 records preview-shown vs share_action (counts only) so G2 can read the effect. |
| C5-35 | 3 | Real trust and privacy value, but it moves no gate, and the wording waits on OD 2.9. | Fold into the fixes lane after f16/f17. |
| MK-P5 | 2 | Content marketing, cheap but not a gate mover. F1 risk sits in every sentence. | Later, as an outreach asset once outreach is approved. |
| C5-33 | 3 | Correct (a check mark beside a security reads as a rating) and tiny: it's a fix, not a feature slot. | Route to the fixes list after f25. |
| C5-39 | 2 | An a11y chore, already routed via C4-34(c). | Chore lane. |
| C5-36 | 2 | Nav naming is the owner's through F-18. The rest is copy polish. | Copy parts as fixes; the nav waits on F-18. |
| C5-41 | 1 | It sells a paid tier that stays off until the week-8 gates pass (OD 2.47). No slot now. | After the gates. |
| C5-38 | 2 | Beyond AA, small CSS: a chore. | Chore lane. |
| C5-37 | 1 | Removing a disclaimer saves nothing and risks a POLICY argument. | Leave as is. |
| C5-42 | 2 | Good hygiene, no business effect. Belongs in the test chore lane. | Slices, test count never drops. |
| C5-40 | 2 | Ops note. Applying it in production is the owner's deploy setting. | Docs/chore only; flag to the owner. |
| MK-P4 | 1 | Monetisation before supply exists. Billing is off until the gates pass, and it needs legal review. | After the week-8 gates and OD 2.47. |
| L-28 | 5 | A wrong Verified figure (+28.6% for a -10% trade). 15/15 last cycle. While blocked it costs nothing, and it shares the matcher slot. | Re-approve, "waits on OD 2.27". Same builder as C5-1/L-30. Lapses again to cycle 6 if still unanswered. |
| L-30 | 4 | Invents a day trade on date-only brokers. Narrowed well. It shares the matcher slot. | Re-approve, "waits on OD 2.26". Build with or after L-28. Same lapse rule. |
| L-29 | 4 | False on screen today for every record (/how says "consented" while every trader is gated). The code prerequisites have merged (#85, #77). | Re-approve as ready. The legal committee's signed words are the build's first step, recorded in the PR. Own copy slot. |
| L-21 | 4 | The pane is the main record view (SW-1), and it prints headline figures with no sign that anything was excluded (F3a). F3-2 has merged, so it is now unblocked. | Re-approve; same slot as C5-5, built after F-23 (#97). One exclusion-sum function that also absorbs C5-1's transfer line (and F-22's if it lands). Unchanged cycle-3 conditions. |

### UX (round 1)

#### Round 1 ballot: UX lead (code UX), approval council cycle 5

Base: origin/main e16d6aa. Lens: flows, clarity, consistency across surfaces, Stage 5 Musts (CH-1/2, TR-1..9, SW-1).
Every trade referenced is fictional (the audit's own probes). Citations re-read with `sed -n` at e16d6aa.

| Item | Score | Reason (one or two lines) | Conditions you'd attach |
|---|---|---|---|
| C5-1 | 5 | A steerable transfer silently removes a chosen loss and the record stays Verified (TR-1 in effect, F3c); the only on-screen trace is a generic "1 trade excluded". Highest record-trust harm on the ballot. | Interim now (after #84): the window's sells counted under their own visible "transfer" reason on the profile, never generic. Full form waits on OD 2.28 + vendor answer (MRC2-10). One matcher builder with F-28/F-30; property test "inserting a transfer never improves a shown average or win rate". |
| C5-4 | 4 | A zero-width "+1.0% to +1.0%" with "Past results: above zero" is false precision a viewer reads as certainty, and it lets ten near-identical trades out-rank 200 bets (TR-9 "small lucky samples can't top it"). | Approved as "waits on C5 Q3". "Too early to tell" wording identical on card, pane, profile and strip (one producer, OD 2.32). Symmetric for losses (test both signs). |
| C5-5 | 5 | Core consistency defect against a Must (TR-4): a shared trade link shows `"2 open, unrealized"` (`lib/copy.ts:174`, `lib/record-strip.ts:119`) beside a realized average in the gain colour while card and pane show the unrealized figures. Same record, different story per surface. | One producer for the open line on every surface (source-scan test). "per closed trade" wording ships now under either OD 2.25 answer. Values wait on OD 2.25; no unrealized value on a new surface before then. Build after f16/f17 and f25 merge. |
| C5-10 | 3 | Real selection gap and a good idea, but it adds a second figure line under the headline (clutter risk on the profile and card) and cannot ship before OD 2.7 makes the connection date public. Size M. | Waits on OD 2.7. Never larger than or above the headline; "Too early to tell" below TR-7's floor; no forward line on Demo; one /how definition. |
| C5-32 | 3 | Useful before outreach, but a code printed on every picture competes with the figures and disclaimers on small images, and the server key is a deploy setting. Worth doing later, close to outreach. | Code in caption-size muted text that never displaces the disclaimer or the trust label; /check never says "matches" when figures differ; key derived from an existing key or flagged to the owner. |
| C5-30 | 4 | False on screen today: the month page says "Trades close through today" (`app/u/[handle]/month/[ym]/page.tsx:89`) above a close dated tomorrow, which the 24 h grace publishes (`lib/sync.ts:38-39`). Small and contained. | After #84. Rebuild scheduled when a quarantined row's date passes; the future count line stays visible meanwhile; e2e on the month page's "through today". |
| C5-31 | 4 | A trade showing +100% where cash paid returned +50% is a wrong headline figure, and abs-ranking puts such trades on top of the feed. | Waits on C5 Q1. MATCHER_VERSION bump; dated /how formula note; pinned test for the only case worse than -100%. |
| MK-P6 | 3 | "Record since <date>" can read as when the trader began when it is the broker's history limit (TR-3 copy). Cheap if the vendor field exists; otherwise only a /how sentence. | Engineer confirms the vendor field first; no figure changes; fallback is the single /how sentence. Pairs with F5-6 copy. |
| C5-43 | 3 | Mostly scale chores; (b) matters to my lens because old-matcher figures stay on screen for ~3 deploys after a matcher change. Better as a chore batch than a feature slot. | Run as a chore batch; (b) lands before or with the next MATCHER_VERSION bump (C5-1/F-28/F-30/C5-31); (a) rebases on f16/f17. |
| MK-P3 | 2 | New public image surface where both disclaimer sentences plus range, count and as-of must stay legible at badge size; I doubt that fits. Outreach-dependent (OD 2.62). | If approved: legibility test at the smallest served size with both disclaimers; Demo/frozen states truthful. |
| C5-34 | 3 | Good flow fix (traders share what they have seen), S, but not urgent; the share prompt already passes a square image to the share sheet (`app/u/[handle]/share-prompt.tsx:50`). | Same image as the unfurl; owner-only; lazy, no first-paint cost; alt text shown. |
| C5-35 | 4 | The one irreversible action is styled like a routine button (`app/settings/page.tsx:35` same `button wide` as Connect), the confirm step drops what is removed, and the trader lands on the feed with no confirmation (`app/auth/actions.ts:163`). | Danger style on the final button only; confirm step repeats the removal list and the one-year hold; confirmation page focused on its heading; wording follows OD 2.9 ("permanently" stays out); e2e at 320 px. Rebase on f16/f17. Coordinate with F5-23 (focus on the alert). |
| MK-P5 | 2 | Neutral education page is fine but /how already covers most of it, and it buys no trust on the record itself. Not worth a slot this cycle. | Demo data only; banned-claims walk; disclaimer and footer. |
| C5-33 | 4 | "<TICKER> ✓ Verified" in the stock page h1 (`app/t/[symbol]/page.tsx:121`) reads as a rating of the security, not of the records; tiny fix, clear meaning gain. | The Demo badge still shows on a demo-only stock page (Demo must always show); the trust line stays directly under the heading; rebase on f25. |
| C5-39 | 3 | Real screen-reader noise ("left arrow Feed"), S; but it is already routed to the a11y chores lane with C4-34(c). | Chore lane, not a feature slot; one shared arrow component with `aria-hidden`; tree scan test. |
| C5-36 | 4 | Consistency inside my lens: the nav's "My record" opens a private stats page (`app/layout.tsx:50`) while "Share my record" shares the public profile; "Record tools" appears twice in Settings (`app/settings/page.tsx:28-29`). | Copy parts (Note held, single Record tools link, delete text) now; the nav label waits on the owner via F-18. One test per line. Rebase on f16/f17. |
| C5-41 | 2 | Copy-only pitch tweak for a paid tool before live billing; low user impact now. | Legal committee re-signs (F-3). |
| C5-38 | 3 | Beyond AA but real: the pressed range tab is background-only (`app/globals.css:190`), invisible in forced colours. One CSS rule. | Chore lane; system-colour border under `forced-colors: active`; emulated e2e. |
| C5-37 | 2 | Minor noise on /account; removing a disclaimer box saves little and invites a "where did the disclaimer go" question. | Only if the F3 disclaimer-surface test still passes and the footer keeps the links. |
| C5-42 | 2 | Test hygiene, not user-facing; fine as ongoing chore slices, not a feature slot. | Adds tests only; count never drops. |
| C5-40 | 2 | Ops doc plus a flag; applying it is the owner's deploy setting. Small value for a slot. | Doc + coverage flag only; production setting flagged to the owner. |
| MK-P4 | 1 | Paid filters before the week-8 reading and a legal review; risks a "top" ordering reading in practice. Not this cycle. | Legal committee review and OD 2.47 first; no symbol filter; no rank numbers. |
| L-28 | 4 | Publishes a wrong Verified figure (+28.6% instead of -10% in the fictional probe); still the right rule. Re-approve so it stays ready the day the owner answers. | Stays blocked on OD 2.27; all cycle-4 veto conditions kept; true-cause wording "a short sale or earlier history". One matcher builder with F-30 and C5-1. |
| L-30 | 4 | Same class: a same-day short on date-only stamps publishes as a Verified gain. Narrowed rule (evidence only) is not steerable. | Stays blocked on OD 2.26; cycle-4 conditions kept; shares the matcher slot with F-28 and C5-1. |
| L-29 | 5 | False on screen today for every record (/how implies non-consent while the gate is closed for all), and "Excluding options" repeated up to five times buries the headline in the pane. Prerequisites merged; only the legal words remain. | Re-approve as ready; legal committee's signed words are the build's first step, recorded in the PR; position test (qualifier in the headline block), not only a count; gate state in cache keys. |
| L-21 | 4 | The pane is SW-1's main record view and it shows win rate and average with no sign of exclusions (no exclusion line in `app/pane.tsx`); F3-2 has merged, so the blocker is gone. | One shared sum with the profile (equality test); muted neutral wording, no warning tone; never pushes the disclaimer out at 360 px; no line on feed cards (D22). Same pane slot as F-23 and C5-5: one builder or strict sequence. |

### EN (round 1)

#### Round 1 ballot: EN (engineer). Lens: feasibility, true size, risk, file overlap, build slots

Overlap source: `git diff origin/main...origin/<branch> --name-only` at e16d6aa (lists saved as en-*.txt here).
- f24 (#84): lib/trades.ts, lib/sync.ts, docs/SYNC.md, db/schema.sql.
- f16/f17: lib/feed.ts, lib/copy.ts, lib/record-status-load.ts, lib/record-tools.ts, app/layout.tsx, app/auth/actions.ts,
  app/globals.css, app/u/[handle]/page.tsx, all four image routes (profile, trade, month, /t opengraph-image.tsx).
- f25: lib/feed.ts, lib/copy.ts, lib/privacy-fields.ts, app/t/[symbol]/page.tsx, app/u/[handle]/page.tsx, trade/month pages + images.
- f23: app/pane.tsx, app/u/[handle]/chart.tsx, app/u/[handle]/page.tsx, lib/copy.ts, lib/pane-model.ts.
- f31: lib/views.ts, scripts/f15-readout.ts, db/schema.sql.
- No in-flight branch touches lib/corporate-actions.ts, lib/confidence.ts, lib/bets.ts, lib/record-strip.ts, lib/sitemaps.ts,
  lib/matcher-rebuild.ts, lib/sync-shard.ts, app/account/, app/how/.

| Item | Score | Reason (one or two lines) | Conditions you'd attach |
|---|---|---|---|
| C5-1 | 5 | Could publish a wrong Verified figure today: unpriceable transfers join the backward window (lib/trades.ts:128-133, :149-153). Interim "own transfer line" is S, no rule change. | Approve interim now, builds after #84 merges (f24 edits lib/trades.ts); full form "waits on OD 2.28 + vendor MRC2-10". One matcher builder with F-28/F-30/C5-31, one MATCHER_VERSION bump (lib/trades.ts:79). |
| C5-4 | 4 | Real ranking defect: se→0 for identical returns (lib/bets.ts:47-48) and the 10-bet floor (lib/confidence.ts:18). S; confidence.ts/bets.ts are untouched in flight, but lib/feed.ts is edited by f16 and f25. | "Waits on C5 Q3"; build after f16 and f25 merge; property test that the moderate+ order is unchanged. |
| C5-5 | 4 | TR-4 Must; one producer helper is a sound refactor. But it touches record-strip, copy, pane, profile and every image route: overlaps f16, f25 and f23. | Wording "per closed trade" + helper now; values wait on OD 2.25; build after f16, f25 and F-23 merge; same slot as L-21/L-29. |
| C5-10 | 3 | M; pure split in lib/trades.ts collides with the matcher slot; makes the connect date public (lib/privacy-fields.ts:70-71, also edited by f25). | "Waits on OD 2.7"; after the matcher slot lands. |
| C5-32 | 3 | Valuable, but M with real risk: new crypto, as-of recompute, and edits to all 5 image routes f16/f25 are rewriting. Key is NOT a deploy setting: HKDF from APP_SECRET_KEY has precedent (lib/claims.ts:1, :50). | Key derived by HKDF under its own label (no new env); doc that rotating APP_SECRET_KEY voids codes; after f16 and f25 merge; same slot as MK-P3. |
| C5-30 | 4 | False on screen ("through today" with a future-dated close). The filter is one line (lib/sync.ts:39) but the scheduled rebuild when the date passes is the true work (rebuild only when changed, lib/sync.ts:600-602). S-M. | Build after #84 (f24 edits lib/sync.ts and the future-count query :181); test the scheduled rebuild path, not just the filter. |
| C5-31 | 4 | Wrong figure (+100% vs +50%) that leads the feed; formula change is tiny but needs a matcher bump and full rebuild. | "Waits on C5 Q1"; in the matcher slot with C5-1 (one version bump); dated /how formula note. |
| MK-P6 | 3 | Our vendor client exposes no earliest-available-date field: only initial_sync_completed (lib/broker.ts:89-94); startDate is a request parameter we send (:254). So it degrades to the one /how sentence. | Approve as the fallback /how sentence only (chore size, no slot); the badge line only if a vendor field is shown. |
| C5-43 | 4 | Measured scale costs (531 ms per feed page, 3.1 s sitemap GET); each S; low risk; mostly files nobody has in flight. | Treat as a chore batch, not a feature slot; (a) after f16 (lib/record-status-load.ts); (d) after #84 (lib/sync.ts). Index added without drop (schema guard). |
| MK-P3 | 2 | New public image surface to maintain; shares the image-route code with C5-32/f16/f25; outreach-gated anyway. | If approved: same slot as C5-32; waits OD 2.62 before outreach. |
| C5-34 | 3 | S; but app/u/[handle]/page.tsx is edited by f16, f23 and f25 (three-way rebase). | After those merge; lazy, owner-only. |
| C5-35 | 3 | S and sensible for the one irreversible action; app/auth/actions.ts is edited by f16. | After f16; wording per OD 2.9 ("permanently" out). |
| MK-P5 | 3 | Static page, new folder, zero overlap, low risk. | Demo data only; legal walk; sitemap line only after MRC2-13. |
| C5-33 | 3 | S, removes a misreadable glyph; app/t/[symbol]/page.tsx is edited by f25. | After f25; bundle with C5-39 as one a11y/copy chore. |
| C5-39 | 3 | Chore; already routed to the a11y lane (C4-34(c)); f25 changes the link names. | Chore lane, after f25. |
| C5-36 | 2 | Copy bits trivial; the nav half waits on F-18; app/layout.tsx is edited by f16. | Copy lines as chore after f16; nav waits on F-18. |
| C5-41 | 2 | Copy only; legal re-sign is the real cost. | Legal committee re-signs; chore. |
| C5-38 | 3 | Tiny CSS; globals.css edited by f16 and f25 (append-only, low conflict). | Chore lane. |
| C5-37 | 2 | Removes a Disclaimer (app/account/page.tsx:32); low value, and any disclaimer removal invites a compliance-scan argument. | Only if the F3 scan proves /account shows no figure. |
| C5-42 | 3 | Good hygiene, no slot, but M and open-ended. | Slices; test count never drops; old assertions stay. |
| C5-40 | 3 | Doc + one coverage flag; prod apply is owner's. docs/SYNC.md edited by f24. | After #84; production setting flagged for owner. |
| MK-P4 | 1 | M, paid tier, waits legal review and OD 2.47; moves no gate; depends on C5-10. | Not this cycle. |
| L-28 | 4 | Keep alive: correct fix, not a new slot, shares the matcher slot. | Stays blocked on OD 2.27; builds with C5-1/F-30 after #84. |
| L-30 | 4 | Same as L-28. | Stays blocked on OD 2.26; matcher slot. |
| L-29 | 4 | False on screen today; code prerequisites merged (#85, #77). Touches pane, chart, record-strip, copy: all edited by f23. | Ready with the legal words as the build's first step; build after F-23 merges; same slot as C5-5/L-21. |
| L-21 | 4 | F3-2 merged; hidden exclusions beside the headline are a trust gap. Same pane files as F-23 and C5-5. | After F-23 merges; shared sum ready to take F-22's count; same slot as C5-5/L-29. |

#### SLOTS (engineer's count)
1. Matcher slot (lib/trades.ts, MATCHER_VERSION, after #84): C5-1 + C5-31 (+ L-28, L-30 not new). One version bump.
2. Pane/strip slot (record-strip, pane, chart, copy, after F-23/f16/f25): C5-5 (+ L-21, L-29 not new).
3. Ranking slot (confidence, bets, feed): C5-4.
4. Sync slot (lib/sync.ts, after #84): C5-30 (C5-43(d) rides with it).
5. Image slot (image routes, after f16/f25): C5-32 + MK-P3.
6. Forward slot: C5-10 (+ MK-P4 later).
Chores, no slot: C5-43, C5-39 + C5-33, C5-38, C5-40, C5-42, MK-P6 fallback, C5-36 copy bits, C5-41.
Separate small slots if room: MK-P5 (zero overlap), C5-34, C5-35.

### TE (round 1)

#### Round 1 ballot: TE (tester), approval council cycle 5

Base: origin/main e16d6aa. Lens: are the acceptance criteria testable and complete, what a test would miss, regression
risk to the existing suite (never weaken tests; CI guard `scripts/autopilot.ts:206` fails on a test-count drop).
All examples fictional. Code facts checked:
- `lib/bets.ts:47-49`: the error term is 0 when every bet sum is equal, so the C5-4 zero-width range is real.
- `lib/confidence.ts:15-18`: `RANK_MIN_BETS = 10`, the owner's floor. `:24`: MODERATE = 30 bets over 90 days.
- `lib/corporate-actions.ts:157` puts TRANSFER and the external types in SHARE_TYPES. Unpaired moves become
  `kind: 'unpriceable', reason: 'unknown'` (`:204`) and enter the late-posting window (`lib/trades.ts:128-153`). So
  the C5-1 path is real.
- `lib/sync.ts:39`: `notFuture` = now() + 24 h grace. `:600-602`: a rebuild runs only when `actIds.length > 0 ||
  changed`.
- `lib/sync.ts:207-208`: the ponytail on the freeze mark using the app clock (C5-43d).
- `lib/trades.ts:79`: `MATCHER_VERSION = 2`.
- `lib/copy.ts:173`: `openShort` is a bare count ("n open, unrealized").
- `app/account/page.tsx:32`: renders `<Disclaimer />`.
- #85 (F3-2, truthful labels) and #77 (F-20) are on main, so the code prerequisites for L-21 and L-29 are met.

| Item | Score | Reason (one or two lines) | Conditions you'd attach |
|---|---|---|---|
| C5-1 | 5 | A trader can remove a chosen loss and keep Verified (wrong figure, steerable). The key AC ("a transfer never improves a shown average or win rate") is a real property and the right test. | The property is a seeded property test: random fictional ledgers, insert a transfer at random offsets, assert win rate and average never rise. The interim form (transfer line only) does not keep the −60% close, so its AC must differ: the probe shows a "transfer" exclusion count of 1, not the generic line. Every existing window test (split inside the window) stays as is. MATCHER_VERSION bump only with the full form. Built in one matcher slot with F-28/F-30; each change's tests must stay green under the others. |
| C5-4 | 4 | Real defect, and the ACs are testable (probe ordering, no zero-width range, symmetry). Waits on C5 Q3 and on whichever method OD 2.33 picks. | "Keep today's order among moderate-tier records" must read "keep the order of the method OD 2.33 picks". Otherwise the property test pins a method the owner may replace. Add a symmetric twin (ten −1% trades). Make the order below the tier deterministic (recency with a stable tie-break), and test it. The 1-point spread floor applies only to ranking: test that the printed range is unchanged at or above the tier. |
| C5-5 | 4 | TR-4 Must; a shared link shows a realized average beside a bare open count. "Per closed trade" can go now. | "A source scan finds one producer" is a text-presence check (the C5-42 weakness). Pair it with a render-equality test: the same fictional −15% open loser gives byte-identical open-line text across the card, pane, profile, both strips and the image alts. Keep the image snapshot tests; their expected values change only on the open line. The values wait on OD 2.25. |
| C5-10 | 3 | Good ACs: a pure "forward" function with edge cases (connect day, a lot split across the date, reconnect). But it waits on OD 2.7, it is size M, and it takes a new-feature slot. | Add an edge case: a buy before the connect date whose sell is after it is never forward. Add a property: the forward count is never above the total count. Demo never shows the line (render test). The connection date never resets: test disconnect, then reconnect. |
| C5-32 | 4 | The strongest anti-forgery item; the ACs cover tampering, deletion, Demo and rate limits. | The key is derived (HKDF from an existing secret, labelled for this use) or set as an owner env (deploy setting). Tests for: a code from before a MATCHER_VERSION bump says "differs", never "matches"; a frozen record still resolves; a tampered code and an unknown handle get byte-identical responses (oracle test); the response time does not depend on whether the handle exists. Rotating the key orphans codes, and /check says so neutrally. |
| C5-30 | 4 | Removes a false "through today". The ACs are concrete and need a DB-clock fixture. | Tests use dates relative to the database's now(), not literal dates, so they don't rot. Add a test that the sync schedules a rebuild when a quarantined row's date passes with no new activity (the `lib/sync.ts:600-602` gap). Rewrite the existing 24 h-grace tests with twins, never delete them. Build after #84. |
| C5-31 | 3 | A correct formula change, but it waits on C5 Q1 (protected DESIGN). It changes many pinned fixture values. | The PR lists every changed expected value and why (an entry fee exists). A test proves zero-fee fixtures are byte-identical. The pinned case where the exit fee exceeds the proceeds. Rebuild script counts. Editing an expectation is not weakening it only when the fee justifies the change. |
| MK-P6 | 3 | Truthful, small, no figure changes. The vendor field is unconfirmed, so the AC branches. | The "no figure changes" AC is a snapshot test of stats before and after. The 31-day boundary is tested at 30, 31 and 32 days. The fallback is one /how sentence with a copy test. |
| C5-43 | 4 | Four measured scale items. (b) is needed because C5-1, F-28/F-30 and C5-31 all bump MATCHER_VERSION. Better as a chore batch than a slot. | (a) results equal `lib/record-status-load.test.ts`. Timing ACs go in LOAD tests (skipped by default), not the unit gate, so they don't flake. (b) the drain test runs with a fake shard budget. (d) skews the app clock by 2 h in a test. (c) a test asserts that no GET path calls the aggregation. |
| MK-P3 | 2 | A new public image surface, waits on OD 2.62 before outreach. Whether the disclaimer is "legible at badge size" is hard to test objectively. | If approved: a minimum font size in pixels asserted on the rendered image; a deleted trader's badge is byte-identical to the neutral blank; no viewer data stored (test the handler writes nothing). |
| C5-34 | 3 | Small and testable ("same image" = same URL). It helps traders see what they share. | The test asserts the preview `src` equals the og:image URL. Owner-only: a signed-out render contains no preview. Lazy loading: `loading="lazy"`, and the image is not in the first paint (e2e). |
| C5-35 | 3 | The one irreversible action should look like it. The e2e at 320 px is testable. | The e2e also asserts focus lands on the confirmation heading and that the page names the one-year handle hold. The wording waits on OD 2.9, so the copy test must reject "permanently" until then. Rebase on f16/f17. |
| MK-P5 | 3 | A static education page; the ACs are scanners only. | Add the disclaimer render test and the 320 px no-scroll test. Demo-only examples: a test fails if the page queries non-demo rows. A legal committee read of the six sections before merge. |
| C5-33 | 4 | "Ticker ✓ Verified" can read as rating the stock (POLICY F3b). A tiny change that removes something misleading on screen. | Test the rendered heading for no check glyph (U+2713/U+2714 or the icon component), not only the source text. The trust line stays under the heading (render test). Rebase on f25. Could also go to the fixes lane. |
| C5-39 | 4 | Accessible names with arrows are wrong today; an accessibility-tree scan is a strong, behavioural test. Chore, not a slot. | The scan covers the signed-out and signed-in pages and both themes. It merges with C4-34(c) so there is one test, not two. |
| C5-36 | 3 | Copy frictions worth fixing. The nav part waits on F-18. | Copy tests for each line. The nav part stays out until F-18 decides; the other three can go as a chore. |
| C5-41 | 2 | Copy only, needs a legal re-sign. The sample wording "every closed trade ... nothing hidden" sits close to POLICY's completeness-claim ban. | No "every", "all" or "nothing hidden" without the record's own exclusion qualifier. The banned-claims walk runs on the new text. |
| C5-38 | 3 | Real forced-colours gap; small CSS. Playwright can emulate forced colours. | The e2e uses `forcedColors: 'active'` and asserts the pressed tab's border is not `none`. Chore lane. |
| C5-37 | 2 | Removing a disclaimer has an asymmetric risk for little gain. /account renders `<Disclaimer />` today (`app/account/page.tsx:32`). | Only if a test proves /account renders no performance figure (no %, no win rate), and the footer still carries the links. The F3 disclaimer test is not edited. |
| C5-42 | 4 | Directly my lens: about 130 test reads of source files (`readFileSync` in `*.test.ts`) pin text, not behaviour. Adding behaviour tests beside them strengthens the suite with zero regression risk. | Add only, never remove. Each slice names the source-text assertion it shadows. Each new behaviour test is shown to fail on a seeded mutation in the PR log. The race windows get event-ordering assertions without new sleeps. Chore lane in slices, not a feature slot. |
| C5-40 | 2 | An ops note plus a flag. Applying it is a deploy setting (owner). Small value against the slot. | A DB test reads the flag in both settings. Doc change after #84. |
| MK-P4 | 1 | A paid-tier filter that needs a legal review and OD 2.47. Its "order is OD 2.33's method" is undecided, so it can't be tested yet. | Not this cycle. |
| L-28 | 5 | It stops a wrong Verified figure (+28.6% for a −10% trip). The ACs are among the most complete on the board (probes A and B, split, rename, thesis survival, test count). | Re-approve as blocked on OD 2.27, with the same lapse clause. It shares the matcher builder with L-30 and C5-1: one combined run of the shuffle property (`lib/fixes-cycle3.test.ts:39`) passes after all three. |
| L-30 | 4 | Narrow and testable. Its intraday-twin test guards against regressions; the F3-5 test is rewritten, not removed. | Re-approve as blocked on OD 2.26. Keep the residual-case statement in the PR. Build with or after F-28 (it reads F-28's pending count). |
| L-29 | 4 | The code prerequisites are merged (#85, #77). The gate-flip cache test and the position-not-count qualifier test are good ACs. | Re-approve as ready, with the legal committee's signed words as the build's first step. The build stops if the words are not signed. Tests run in both `optionsPublic()` states. The image qualifier snapshots are unchanged. |
| L-21 | 4 | F3-2 is merged, and the ACs are concrete. But the "a new counter fails a test" guard as written scans the schema and would miss in-memory counters. | The guard also enumerates every `excluded*` key of `MatchResult` (for example, #84's `excludedHeld`) as well as the schema columns. One slot with F-23 (#97) and C5-5's pane edits, built after #97. The equality test runs over profile, pane and strip. |

### RT (round 1)

#### Round 1 ballot: RT (record-trust red team), approval council cycle 5

Base: origin/main e16d6aa. Lens: can a trader make a Verified record lie (hide a loss, inflate a figure, steer an
exclusion), and does each item close or open such a path? Every trade below is fictional. My probes are in
`(chair dir)/rt/` (p1.ts matcher, p2.ts
ranking). Both run with node against main's `lib/trades.ts`.

#### Probe results on main (MATCHER_VERSION 2, `lib/trades.ts:79`)
| Probe (fictional) | Result on main |
|---|---|
| WX BUY 100 @100, SELL @40; YX BUY 100 @100, SELL @140; +1 WX TRANSFER in 12 days after the WX close | WX −60% gone, corp 1, win 50%→100%, avg −10%→+40% (C5-1 reproduces) |
| Same, but a −1 EXTERNAL_ASSET_TRANSFER_OUT with 0 held | same result: also hides the loss |
| Same, but a TRANSFER row with **no units** | same result: also hides the loss (`lib/corporate-actions.ts:186-188` makes it unpriceable/unknown) |
| Same, transfer 15 days after | the loss stays (window is 14 days, `lib/corporate-actions.ts:42`) |
| Two WX losers (−60%, −50%) + a YX +10%, one +1 transfer | both losers gone, avg −33.3%→+10%, corp 2: one transfer removes every close of the pair in the window |
| F-28's probe, intraday (SELL 100 @15 with none held, BUY @14, BUY @20, SELL @18) | nothing published, excluded 2: #89's blanket gap rule (`lib/trades.ts:48-53`) already covers it |
| F-30: date-only same-day short, no evidence | +7.1% published (accepted residual, ponytail in `replay`) |
| F-30: same short after an earlier oversell | counted (excl 2): F-30's evidence rule is already on main minus broker positions |
| F-30 probe C (losing same-day close vs winning overnight) | both published (−3%, +3%): no steer |
| C5-31: BUY 2 @5 fee 10, SELL @15 | +100% (cash-paid return is +50%); exit fee 20 on BUY 2 @5 / SELL @5: −200% |
| C5-4: ten closes of exactly +1% / −1% / +1% ±0.01 pt / 200 mixed bets | weight 0.299 / 0.302 / 0.296 (still printed "+1.0% to +1.0%") / 0.386 |

#### Key red-team findings for this ballot
1. **L-28 as written regresses main.** F-28 taints only the next k units and then prices later lots. The fixes-cycle-4
   committee recorded that this publishes wrong figures under the short reading: +65% where the true figure is +10%
   (`docs/features/logs/fixes-cycle4/committee-2026-11-01.md:20-22`, `:119-122`). #89 replaced it with "every later sell
   counted" (`lib/trades.ts:48-53`). A k-unit taint also makes a minted hide token: short k shares, cover, and the
   ledger keeps a phantom lot. The first later sell, at a time the trader picks after seeing prices, is counted. Every
   sell after that is priced one lot early, so a trader inflates by shorting and covering a rising stock. Re-approving
   F-28 as written would re-open a closed path.
2. **C5-1 is three paths, not one.** A transfer in, a transfer out with nothing held, and a no-units transfer row each
   hide a chosen loss. The full form must cover all three. The interim form (its own "transfer" count line) does not
   close the path. It only names it, and only where the count is shown. Today that is the profile alone, not the pane
   (L-21).
3. **L-21 is the visible counter to every at-will hide route still on main:** C5-1, and the one-extra-share oversell
   (cycle 3 C3-3; the business lead's follow-up at `committee-2026-11-01.md:128`). `app/pane.tsx` has no exclusion line
   today (grep: only the options caption).
4. **C5-4's realistic recipe is to hold losers open.** Close winners at a fixed +1% target and leave losers open. TR-4's
   open line (C5-5) and OD 2.34 are its counters, and a zero-width check alone misses it (the jitter probe).

#### Ballot
| Item | Score | Reason (one or two lines) | Conditions you'd attach |
|---|---|---|---|
| C5-1 | 5 | It closes the cheapest at-will way to delete a seen loss and keep Verified. Reproduced: one transfer row removes every close of the pair in the prior 14 days (avg −33.3%→+10%). | Waits on OD 2.28 + vendor (MRC2-10). The full form covers all three variants: transfer in, transfer out with 0 held, no-units row. Property test: any inserted transfer row (in, out or no units, any date) never raises a shown average or win rate. Unpaired ADJUSTMENT stays in the window and is named in the code as broker-initiated. The interim line is not called a fix, and it reaches the pane through L-21's sum. One matcher builder; bump to MATCHER_VERSION 3 rides C5-43(b). |
| C5-4 | 4 | A zero-spread record outranks 200 bets (0.299 vs 0.167; −1% gives 0.302). The fix is symmetric. | Waits on C5 Q3. The 1-pt spread floor applies in the error term, not only to exact zero (jitter probe: 0.296, printed zero width). Ranking below the tier never uses trade count or frequency (POLICY: no rewards for frequency). Test: winners closed at +1% with losers open never outrank. Cross-ref C5-5/OD 2.34. |
| C5-5 | 4 | The open line is the counter to "close winners, hold losers open". Today the strips show a bare count beside a gain-coloured realized average (`lib/copy.ts:174`). | Values wait on OD 2.25; "per closed trade" wording and the one-producer helper now. The source scan pins one producer. After f16/f17 and f25. |
| C5-10 | 3 | It adds a forward split that resists "connect after a good run" and never subtracts. But deletion and re-attach (MK-2, OD 2.9) could restart the forward clock. | Waits on OD 2.7. The forward date is per broker account and is not reset by profile deletion or re-attach; if P6 forbids keeping it, the line must say the record restarted. Demo never forward. Below TR-7's floor: "Too early to tell". |
| C5-32 | 4 | It closes picture forgery, the most copied object. A real code pasted onto an edited picture is caught only if /check shows figures. | /check shows the as-of figures and today's, never a bare "valid". The code binds kind + as-of + record. The key is derived from an existing server key or set by the owner (deploy setting). Deleted codes stop resolving; frozen codes resolve. |
| C5-30 | 3 | Truthful dates ("through today" over a Nov 2 close). No steering path either way, since vendor dates are not trader-set. | Schedules its rebuild when a held row's date passes. After #84. |
| C5-31 | 4 | It removes fee-inflated leaders: +100% shown vs +50% on cash paid, and the feed sorts by size. | Waits on C5 Q1. Pins the −200% exit-fee case. Dated /how note. MATCHER_VERSION bump with C5-43(b), so old figures do not stay up. |
| MK-P6 | 3 | It discloses a selection fact: history cut at the broker's limit. No figure changes. | Vendor field confirmed first, else one /how sentence. No completeness claim either way. |
| C5-43 | 4 | (b) is record trust: after any matcher bump (C5-1, C5-31), superseded Verified figures stay up for about 3 deploys. (d) keeps the TR-5 freeze honest. (a)/(c) are scale. | A chore batch is fine. (b) first. A test bumps the version, then no record serves an old-version figure after the drain. |
| MK-P3 | 2 | A live image is harder to forge than a screenshot, but it is a new public surface that must carry every trust line. | It carries the open line (C5-5) and the exclusion count once those land. OD 2.62 before outreach. |
| C5-34 | 3 | Neutral to record trust. Owners see what they share. | Same image as the unfurl. |
| C5-35 | 2 | Honest deletion copy. Deletion plus re-attach is a record-reset path that stays with OD 2.9. | Wording follows OD 2.9. |
| MK-P5 | 3 | It teaches viewers the selection tricks this lens hunts. Neutral, Demo data only. | It must not claim our records defeat every trick (C5-1 and the oversell are live). |
| C5-33 | 3 | A check beside a ticker reads as a rating (F3a/F3b). Small. | After f25. |
| C5-39 | 3 | A11y chore, no record effect. | Merge with C4-34(c). |
| C5-36 | 2 | Copy frictions. The nav part is the owner's (F-18). | — |
| C5-41 | 2 | The draft pitch "nothing hidden by the trader" is a completeness claim that is false today: C5-1 and the one-extra-share oversell hide a chosen loss (counted). | Reshape: "the trader can't hide single trades; exclusions are counted and shown". The legal committee re-signs. |
| C5-38 | 3 | A11y, small. | Chore lane. |
| C5-37 | 2 | Page with no figures. No record effect. | The F3 test still passes. |
| C5-42 | 3 | Text-presence tests cannot catch a matcher regression. Behavioural ones can. | First slices: steering properties (a transfer never improves an average; an oversell counts; a shuffle is invariant). The count never drops. |
| C5-40 | 2 | Ops. | The owner applies it in production. |
| MK-P4 | 1 | A "closed trades ≥ n" filter rewards churning tiny trades (POLICY: no rewards for frequency). Filters move no gate. | If kept: a length/bets filter uses TR-9 independent bets over a span, not raw count. No symbol filter. Legal review + OD 2.47. |
| L-28 | 0 | Superseded and harmful as written: #89's blanket gap already counts F-28's probe (excl 2). F-28's k-unit rule publishes +65% where the truth is +10% (fixes-cycle-4 committee :20-22, :119-122). A short-and-cover would mint a hide token and shift every later lot. | Let it lapse. Tell the owner that OD 2.27 is overtaken by #89. Any future release rule needs vendor position evidence (F-28's own probe-A question), never a k-unit taint. |
| L-30 | 2 | Mostly on main via #89: with evidence every sell is counted (probe). What remains is broker-position evidence (needs protected `lib/broker.ts` + stored units: owner) and the readout class count. | If re-approved: residual scope only. It never loosens #89's gap rule. Intraday results stay identical. |
| L-29 | 4 | False on screen today: /how says option results show "only on records whose trader has consented" (`lib/copy.ts:549`) while every record is gated. That is a truthful-record fix, and the code prerequisites are merged. | Ready, with the legal committee's signed words as the build's first step. Keep the last qualifier on each headline surface. |
| L-21 | 5 | It is the counter where records are read to every at-will hide route still on main (C5-1, the one-extra-share oversell). The pane shows no exclusion count today. F3-2 is merged. | The sum also covers the counters added since: `excluded_options_*`, `excluded_exercise_shares` (`db/schema.sql:1030-1041`), F-24's `excludedHeld` and C5-1's transfer line. Keep the new-counter test. Same slot as F-23/C5-5. |

### LC (round 1)

#### Round 1 ballot: LC (legal committee), approval council cycle 5

Lens: docs/POLICY.md (binding) and docs/COMPLIANCE.md. Read at origin/main e16d6aa. Not legal advice; these are the
AI legal committee's findings, which the owner accepts in place of counsel (POLICY, top). Every trade mentioned is
fictional.

| Item | Score | Reason (one or two lines) | Conditions you'd attach |
|---|---|---|---|
| C5-1 | 5 | A steerable transfer removes a chosen loss while the record stays Verified (`lib/corporate-actions.ts:157`, `:204`; `lib/trades.ts:128-133`): a wrong Verified figure, F3c and TR-1. The interim form (count under its own line) needs no owner and fixes the disclosure now. | Interim: the window's sells are counted on their own neutral "transfer" line on the profile and in the F-21 sum. The wording names the reason, never blames the trader. The full form (no backward window for transfers) waits on OD 2.28 and the vendor answer (MRC2-10). Test: inserting a transfer never improves a shown average or win rate. |
| C5-4 | 4 | "Past results: above zero" on a zero-width range from ten identical trades reads close to a forecast (F3b) and defeats TR-9/F4. The fix is symmetric for losses. | Approved, waits on C5 Q3 (protected DESIGN; replaces the owner's 10-bet floor). "Too early to tell" per OD 2.32. Losses rank equal to gains (test). |
| C5-5 | 4 | TR-4 (F4: open positions shown as prominently as the headline). One producer stops surfaces disagreeing. | No unrealized value on any new surface until OD 2.25 is answered (the vendor's market-data limits are a launch gate). "per closed trade" wording can go now. |
| C5-10 | 4 | Closes the survivorship gap (F4). Legally it makes the connection date inferable on every record, which P3/P6 consent does not yet cover (`lib/privacy-fields.ts:70-71`). | Waits on OD 2.7. Gated per trader: a record consented under an older version shows no forward line or count, because the earliest forward buy date reveals the connection date. Wording "since connecting", never "live", "proven" or "track record" (F2/F3b). Demo never shows it. |
| C5-32 | 4 | Counters edited profit pictures (U2, fraud), percent only (P3). It is a checking tool, not an identity claim, if the words stay narrow (F3a). | /check says it compares the picture's figures with the stored record. It never says "authentic", "genuine", "verified picture", or anything about identity or completeness. A mismatch is reported neutrally, never as "forged". Key (S1/S2): either a dedicated env key the owner sets (deploy setting), or one derived by HKDF from an existing key under a fixed purpose label. The raw key is never reused (C5-18) and never logged. A deleted record's codes stop resolving (P6), and the unknown and deleted cases read the same. Disclaimer and /how link on /check. |
| C5-30 | 4 | A close dated tomorrow, published under "through today", is false on screen today (F3c). | The future count is shown on its own line while a row waits. Publication is checked against the database clock. |
| C5-31 | 4 | A long share trade at −200% and +100% shown for +50% on cash paid: a platform-computed figure that is wrong while it carries Verified (F3c). | Waits on C5 Q1 (DESIGN §2.5). Dated /how note on the formula change (COMPLIANCE §12 history). Bump MATCHER_VERSION. |
| MK-P6 | 4 | "Record since" implies the record starts when the trader began: a completeness implication (F3a). The fallback /how sentence is additive and needs no POLICY edit. | Wording "Imported history starts ‹month year›", never "full" or "complete". Any change to POLICY F3's exclusion list is flagged for the owner, not made. |
| C5-43 | 3 | Engineering. (b) matters to F3c: old-matcher figures stay Verified for about 3 deploys after a fix. (d) keeps TR-5 freezes honest. | Better as a chore batch. If it is voted, (b) and (d) first. |
| MK-P3 | 2 | "Badge" collides with F6's wording, both disclaimer sentences must stay legible at bio size (F3), and adviser use in ads is a launch item (OD 2.62, POLICY launch list). Low priority for a slot. | Reshape below (POLICY line). Outreach waits on OD 2.62. No viewer data stored, no platform name or logo (T5). |
| C5-34 | 3 | Harmless. The preview is the same image, so the disclaimer is carried; owner only (P3). | It must be the identical served image, never a different render. |
| C5-35 | 4 | P6 deletion must be clear, and today the irreversible action looks routine. Supports the deletion right. | No "permanently" until OD 2.9. The confirmation page states truthfully what remains (the handle hold, records kept by law or for consent) and for how long. |
| MK-P5 | 3 | Neutral education on reading records fits F1 if it stays about reading, not choosing whom to follow or what to trade. | No named platform, company or person, and no "don't trust ‹anyone›" (T1-T4). Demo examples only. Never "how to pick a trader". The section on what "imported from a broker" proves follows F3a word for word. Disclaimer and footer links. |
| C5-33 | 4 | A check mark beside a ticker can read as a rating of the security (F3b; OD 2.38's principle) (`app/t/[symbol]/page.tsx:121`). | The trust line under the heading keeps F3a's meaning. A source scan pins it. |
| C5-39 | 3 | A1, chore-sized. | Route with C4-34(c) to the a11y chore lane. |
| C5-36 | 3 | Copy clarity. "My record" for a private page is mildly misleading. | The nav name follows F-18. The delete text stays truthful after "if you publish" is dropped. |
| C5-41 | 2 | As drafted, the copy says "every closed trade" (a banned completeness claim, F3a) and "nothing hidden by the trader" (false: the trader picks which brokers to connect, MK-4). | Reshape below. LC re-signs the words in the PR (F-3). |
| C5-38 | 3 | A1, beyond AA. Small. | Chore lane. |
| C5-37 | 2 | Not a POLICY breach (/account shows no figures, and the site footer carries the disclaimer and links, `app/layout.tsx:57-62`). But the F-3 legal committee's R8 (`docs/features/logs/F-3/committee-2026-11-01.md:41`) names the account page. It is a paid-service page, where the disclaimer protects the publisher reading. | Keep the disclaimer sentence on /account (it may be muted plain text, not a bold box). Drop only the duplicate links set. LC amends R8 to "satisfied by the site footer plus the sentence" in the PR. A test pins the sentence in the /account HTML. |
| C5-42 | 3 | Test quality. No legal effect; respects the never-weaken rule. | Test count never drops. |
| C5-40 | 2 | An ops doc. Applying it in production is a deploy setting (owner, POLICY H). | Flag for the owner. The doc and the coverage flag only. |
| MK-P4 | 1 | A paid, filtered list of traders ordered by the ranking method is the closest item on the ballot to "top traders to follow for returns" (COMPLIANCE §2; F1, publisher's exclusion). It needs my F-3 review and OD 2.47, and it moves no gate. | If it ever comes back: no filter on any return, win rate, range or rank. The order is identical to the free documented method. No saved-filter alerts (F3b). No symbol anywhere. Never "best", "top" or "find winners". Live billing stays off (OD 2.47). |
| L-28 | 4 | A short's cover pricing a later trade publishes a wrong Verified figure (F3c). Last cycle's top item. | Re-approved, still blocked on OD 2.27. One matcher slot with L-30 and C5-1. |
| L-30 | 4 | Same-instant date-only stamps can publish a short as a long close (F3c). | Re-approved, blocked on OD 2.26. Same slot. |
| L-29 | 5 | Today /how says option results show "only on records whose trader has consented" (`lib/copy.ts:549`) while every record is gated (`lib/options-gate.ts:1-5`). That is false on screen today, and it makes consenting traders read as withholding. Code prerequisites are merged; only my words remain. | LC proposes and signs these interim /how words (gate closed): "Option results are not shown on any record at present. Where option trades or open options were imported, the record shows how many, and its headline figures exclude options." Per-surface qualifier: the existing "Excluding options" (`lib/copy.ts:513`) and `altQualifier` (`:551`), placed as F-29 decision (b). The build PR records this sign-off. The rest of F-29's decisions are unchanged. Ready, with the words as the build's first step. |
| L-21 | 4 | Exclusions shown where records are read (F3a, F4). F3-2 has merged. | F-21's decisions unchanged (neutral words, no warning colour, disclaimer stays in view at 360 px). Coordinate with F-23 and C5-5 on the pane files. The C5-1 interim transfer count joins the shared sum. |

#### POLICY objections and reshaping

- **C5-41, F3a** (never claim "every trade"; never imply completeness). Reshape: replace the draft with "Compare whole
  public records side by side: closed trades imported from connected accounts, losses and ranges included. Traders
  can't remove single trades." No "every", "all", "nothing hidden" or "complete". LC re-signs the final words in the PR.
- **MK-P3, F6 and F3.**
  - F6: there are no badges tied to real-money outcomes. Rename the feature and route ("record image", for example
    `/u/‹handle›/record.png`), and use no award styling (medal, ribbon, star, tier).
  - F3: both disclaimer sentences are in plain view at the rendered size. Any size that can't hold them legibly shows
    no figures, only the handle, the trust state and the link.
  - Content: no symbol, no last-trade line and no recency or "new" indicator, so nothing reads as announcing trades
    (F3b).
  - Outreach and any adviser-facing copy wait on OD 2.62.
- **C5-10, P3/P6** (public display needs consent at connect). Reshape: the forward line and count show only on
  records whose consent version names the connection date (OD 2.7). Every other record shows none.
- **C5-32, F3a and S1/S2.** Reshape: /check claims only a figure comparison with the stored record. The key is a
  dedicated owner-set env key or an HKDF purpose-derived key, never raw reuse, never logged.
- **C5-37** (not POLICY, but the F-3 legal condition R8). Reshape: keep the disclaimer sentence on /account and drop
  only the duplicate links. LC records the R8 amendment in the PR.
- **MK-P4, F1** (publisher's exclusion; COMPLIANCE §2 "no top traders to follow for returns"). Blocked until it is
  reshaped as in the table and LC reviews the feature list under F-3. It also waits on OD 2.47.

### PR (round 1)

#### Round 1 ballot: PR (privacy member), approval council cycle 5

Lens: POLICY P3/P6 (minimum collected and stored, exactly what becomes public is named at connect, deletion is whole),
consent scope (`lib/copy.ts:88` CONSENT_SCOPE_LINE, `lib/privacy-fields.ts`), new public fields and surfaces.
Read at origin/main e16d6aa. Every trade mentioned is fictional.

Facts relied on:
- Today the consent line names percent returns, symbols, dates, holding periods, institution names, account count and
  open positions with unrealized percent as public, and quantities, prices, fees and account numbers as private
  (`lib/copy.ts:88`). The fields lists follow it (`lib/privacy-fields.ts:5-29`).
- The connection date (`connections.consent_at`) is public only as an idle record's fallback date, and is listed as
  record state that the line must name before real users connect (`lib/privacy-fields.ts:61-72`; ponytail at
  `lib/copy.ts:85-87`). OD 2.7 adds "the connection date an idle record falls back to", **not** a connection date
  shown on every record.
- View counting stores a per-day rollup keyed by profile, surface, ref class and `via`, with no viewer identity
  (`lib/views.ts:91-95`). A new `via` class adds no viewer data.
- Deletion copy: "removes your profile, record, sign-in details and the brokerage link at the vendor. Your handle is
  held for a year." (`lib/copy.ts:420`). Checkout consent kept 3 years without name or email (`lib/copy.ts:931`). The
  confirm step shows only `SETTINGS.confirm` and the button (`app/settings/page.tsx:31-36`), so the list of what is
  removed and the handle hold drop out at the step that deletes.
- `APP_SECRET_KEY` already encrypts vendor secrets and signs sessions when SESSION_SECRET is missing
  (`lib/secret-env.ts:1-3`). C5-18 calls that reuse a defect.
- The future grace publishes rows up to 24 h ahead (`lib/sync.ts:38-39`).

| Item | Score | Reason (one or two lines) | Conditions you'd attach |
|---|---|---|---|
| C5-1 | 5 | A Verified record can drop a chosen loss with a 1-share transfer: a wrong Verified figure, the cycle's top priority class. No new field: the interim form only renames an exclusion count that is already public. | Interim form now (after #84): sells excluded by the window are counted under their own transfer line. The full form waits on OD 2.28 + the vendor answer. The line shows a count only, never units or the transfer's date. One matcher slot with F-28/F-30. |
| C5-4 | 4 | The feed ranks a ten-trade record of identical results above a 200-bet one. That is record trust. Already within consent scope ("to order traders", `lib/copy.ts:88`). | Approved, waits on C5 Q3 (protected DESIGN; it replaces the owner's 10-bet floor). "Too early to tell" follows OD 2.32. Symmetric for losses (property test). |
| C5-5 | 4 | One producer for the open line removes a public mismatch across surfaces. The consent line already names open positions. The risk is extra exposure on three images, which the brief's AC blocks. | Ship the helper and "per closed trade" now. Unrealized values on any surface that has none today wait on OD 2.25. If 2.25 is yes, every surface shows 2.25's line, images included, and a leak-path test covers each image route. |
| C5-10 | 3 | Valuable trust signal, but it publishes a new fact on every record: the first consented connection date (stated, or bounded by "since connecting" counts). OD 2.7 as drafted covers only the idle fallback date. | Approved only as "waits on OD 2.7, amended to name 'the date you first connected each account' on every record". Then the owner moves `connections.consent_at` from RECORD_STATE_FIELDS to the public list (`lib/privacy-fields.ts`, owner file). Keeping that first date after a reconnect is disclosed in the consent line. Deletion removes it. Demo never shows it. |
| C5-32 | 4 | A strong anti-forgery measure with privacy-safe design: an opaque code, no lookup table, percent only, and a deleted trader's codes stop resolving (P6). Key handling is the open point. | (1) Key: a dedicated secret the owner sets in the env (deploy setting), or an HKDF subkey with its own label. Never raw `APP_SECRET_KEY` (C5-18's reuse class). (2) /check stores nothing about the viewer: no IP, referrer or code logged. Rate limiting uses the image routes' existing mechanism only. (3) A wrong code, an unknown code and a deleted trader's code give the same neutral line. (4) The code encodes no handle or user id in clear. (5) Frozen records resolve, as the consent line says ("stays public if you disconnect"). |
| C5-30 | 4 | Today a page publishes a trade dated tomorrow under "through today": false on screen. The fix publishes less, never more. | After #84. The re-check schedules the rebuild. The future count stays on its existing line. |
| C5-31 | 3 | It fixes a misleading +100% (+50% on cash paid). Fees stay private: the return reveals no fee amount, and /how states only the formula. Owner-dependent (C5 Q1). | Approved, waits on C5 Q1. MATCHER_VERSION bump with a dated /how note. No fee amount or fee share is shown anywhere. Matcher slot. |
| MK-P6 | 4 | Removes an implied completeness claim (F3a), at month granularity. Publishes nothing beyond the dates already public. | If the vendor field exists and is stored, the new column goes into the privacy inventory (`lib/privacy-fields.ts` lists, owner file) as not shown, and only the month is shown. The fallback is the one /how sentence. |
| C5-43 | 3 | Engineering batch. (d) makes the TR-5 freeze honest under clock skew. No new data. Better as a chore batch than a feature slot. | (a) The account-count index serves only the already-public count, and account ids stay unshown. |
| MK-P3 | 3 | Shows only already-public fields, but the image is hot-linked on third-party pages. Every load reaches our server with that page's viewer IP and referrer, which would make us the tracker. | No per-load logging or storage: no view_rollup row per image load, no IP or referrer. Long cache headers so the cache serves it. A deleted trader's badge is a neutral blank. No platform names. OD 2.62 before outreach. |
| C5-34 | 3 | Owner-only preview of the image that is already public: informed sharing, no new data. | Same URL and cache as the unfurl. Not rendered for other viewers (test). |
| C5-35 | 4 | The one irreversible privacy action reads like a routine one, and the confirm step drops what is removed (`app/settings/page.tsx:31-36`). Informed deletion is a P6 matter. | The confirm step repeats `SETTINGS.deleteExplain` and, when they apply, the billing and notes lines. The confirmation page is static: no handle or id in its URL (no personal data in logs), and it states only what the code keeps (handle hold 1 year; consent record 3 years without name or email if they subscribed), pinned by a test against `lib/delete.ts`. "Permanently" stays out until OD 2.9 is answered. |
| MK-P5 | 3 | Neutral education with Demo examples only. No data. | Demo data only, banned-claims and marks scans, disclaimer, no viewer data stored beyond the existing `via` class. |
| C5-33 | 3 | A check mark beside a security can read as a rating (F3b). Small. No privacy impact. | After F-25 merges. |
| C5-39 | 2 | Real a11y polish, but cycle 4 routed it to the a11y chore lane. Not a feature slot. | Fold into the C4-34(c) chore. |
| C5-36 | 2 | Copy frictions. The nav part waits on F-18. The "if you publish" text in `lib/copy.ts:932` already shows only when it applies (`app/settings/page.tsx:44`). | If built: the delete text never drops a case that applies. |
| C5-41 | 2 | Copy only, needs a legal re-sign. Low value. | Legal committee re-signs it. |
| C5-38 | 2 | Beyond AA. A small CSS chore. | Chore lane. |
| C5-37 | 2 | Cosmetic. Removing a disclaimer box is fine only if /account never shows a figure. | A test pins that /account renders no performance figure. |
| C5-42 | 3 | Behaviour tests help privacy most: today several leak checks are source scans. Adds only. | Start with the privacy leak paths (held notes, gated options, account ids). Test count never drops. |
| C5-40 | 2 | Ops doc. Applying it in production is the owner's deploy setting. | Flag for the owner. |
| MK-P4 | 2 | Paid tier needing a legal review and OD 2.47. The forward filter depends on C5-10's public connection date (OD 2.7). | If ever built: no stored per-viewer filter history beyond saved views the viewer creates, no forward filter before OD 2.7, no symbol parameter. |
| L-28 | 4 | Record trust, already 15/15 last cycle. Keep it approved, blocked on OD 2.27, so it doesn't lapse again. No privacy impact. | Stays blocked on OD 2.27. Matcher slot with L-30 and C5-1. |
| L-30 | 4 | Same as L-28. | Stays blocked on OD 2.26. Same matcher slot. |
| L-29 | 4 | Its prerequisites have merged. It keeps the privacy guard: no public "not asked" vs "declined" difference. | The legal words are the first build step. Its AC stands as written, including the source scan for "not asked" and "declined", and the gate state in cache keys. |
| L-21 | 4 | F3-2 has merged. It shows exclusion counts where records are read. The counts are already public. No new field. | Same slot as F-23 and C5-5 (pane files). The shared sum names paper accounts as not an exclusion, as decided. |

Flag for the owner (outside the council's power), from this lens:
- The exclusion counts (`users.excluded_*`) are public on profiles but appear in neither the consent line nor
  `lib/privacy-fields.ts`. C5-1's transfer line and L-21 add surfaces for them. Recommend naming them in OD 2.7's
  consent version ("counts of excluded trades").
- C5-10, and MK-P4's forward filter, need OD 2.7 extended to "the date you first connected each account".

### A11Y (round 1)

#### Round 1 ballot: A11Y (accessibility specialist), approval council cycle 5

Read at origin/main e16d6aa. Lens: WCAG 2.2 AA (POLICY A1), keyboard, screen readers, forced colours, reflow, focus,
and feature vs a11y chore. Every trade mentioned is fictional. Code facts checked:
- `app/globals.css:190`: the pressed range tab differs by `background` and `color` only; `grep forced-colors app/` finds
  nothing. So under forced colours the selected range vanishes (C5-38 holds).
- Arrow glyphs inside link and button text: `app/u/[handle]/page.tsx:438` ("← Feed"), `app/t/page.tsx:96`,
  `app/t/[symbol]/page.tsx:77`, `:120`, `app/u/[handle]/similar-section.tsx:38` ("← Back"), `app/lazy-pane.tsx:22`,
  `app/ui.tsx:116`, `app/me/*` back links (C5-39 holds).
- `app/ui.tsx:29`: the Verified badge text is "✓ Verified", so `/t/SYMBOL`'s h1 (`app/t/[symbol]/page.tsx:121`) reads
  "‹TICKER› check mark Verified" to a screen reader: C5-33 and C5-39 are the same glyph class.
- `app/u/[handle]/share-prompt.tsx:38-39`: the first-run share prompt already shows the card (opengraph image) with
  `cardAlt` alt text; the standing Share box `app/u/[handle]/share-card.tsx:11-20` does not, and it shares the square
  story image, not the opengraph card (C5-34 must preview what is actually sent).
- `app/settings/page.tsx:33-35`: delete step 2 is a plain `role="alert"` paragraph and an ordinary `button.wide` (C5-35,
  F5-23 overlap).
- `app/pane.tsx`: no exclusion count line today (L-21 still needed). `lib/sync.ts:38-39` grace and
  `app/u/[handle]/month/[ym]/page.tsx:89` "Trades close through today" (C5-30 holds).

| Item | Score | Reason (one or two lines) | Conditions you'd attach |
|---|---|---|---|
| C5-1 | 5 | A steerable path to a wrong Verified figure: top priority by the cycle-4 precedent. The interim (own "transfer" count line) is buildable after #84 without the owner. | Approve the interim now; full form "waits on OD 2.28 + vendor answer". The new count line joins F-21's shared sum, uses neutral wording, real link with a descriptive name, 44 px target, reflows at 320 px. One matcher slot with F-28/F-30. |
| C5-4 | 4 | Ten identical trades topping the feed and a zero-width "+1.0% to +1.0%" range is false on screen. Symmetric fix. | "Approved, waits on C5 Q3". "Too early to tell" is text, never a colour or icon alone; the range's screen-reader text matches the visible text. |
| C5-5 | 4 | TR-4 is a Must; one producer of the open line removes contradictory surfaces. "Per closed trade" wording can go now. | Split: wording + one-producer helper now (after f16/f17, f25 merge); values wait on OD 2.25. A negative open value carries a minus sign and the word, never the down colour alone (A1); image alt texts get the same line. |
| C5-10 | 3 | Good trust idea, but size M, it makes the connection date public on every record, and it waits on OD 2.7. | Waits on OD 2.7. The forward line sits after the headline in DOM order, never larger; "Too early to tell" in text; the card alt includes "‹n› trades since connecting". |
| C5-32 | 3 | Useful against forged pictures, but a new public surface and a key decision (deploy setting) before outreach exists. | Owner sets the key. The code also appears in each image's alt text; code alphabet avoids look-alikes (0/O, 1/l/I); `/check` has a visible label, `autocomplete="off"`, errors announced and focus moved to them (3.3.1, 4.1.3); results are text, not only a tick or colour. |
| C5-30 | 4 | "Trades close through today" above a close dated tomorrow is false on screen; small. | After #84. The future count line keeps its reason text on the profile; the scheduled rebuild is tested. |
| C5-31 | 4 | A return shown as +100% where cash paid earned +50% is a wrong Verified figure that the abs() ranking pushes to the top. | "Approved, waits on C5 Q1". `/how` states the formula in text (not an image), with a dated note. |
| MK-P6 | 4 | Removes an implied completeness claim (F3a); S; no figure changes. | Engineer confirms the vendor field first, else the one `/how` sentence. The date is a real text date (not abbreviated into ambiguity), and reflows at 320 px. |
| C5-43 | 3 | Real scale work, but these are chores (engineering ponytails), not features; should not take a build slot. | Route to the chores lane; (a) rebases on f16/f17. No user-visible change. |
| MK-P3 | 2 | An off-site image of text: we cannot control its alt where it is embedded, and both disclaimer sentences "legible at that size" is doubtful (1.4.3/1.4.4 at badge size). Outreach is not open (OD 2.62). | If ever built: the copy control supplies an embed snippet with the full alt text; minimum text size and 4.5:1 on the image; "Demo" and "frozen" in words. |
| C5-34 | 3 | Small and mostly exists already (first-run prompt shows the card with alt); worth doing, low priority. | Preview the image the Share button actually sends (square story), reuse `cardAlt`; lazy, owner only; failed load shows the existing text fallback; not focusable. |
| C5-35 | 4 | The one irreversible action reads like a routine one, and focus/confirmation are missing after it; S; strong a11y content (2.4.3, 3.3.4). | Merge with F5-23 (focus the alert on step 1) so focus is not managed twice. Danger style keeps 4.5:1 text and is not colour-only (the button's text names the action; "permanently" stays out until OD 2.9); confirmation page focuses its h1 and has a unique title. Rebase on f16/f17. |
| MK-P5 | 3 | Neutral, linkable education; static and cheap; not urgent before outreach. | Real heading structure (h1, one h2 per section); Demo examples rendered as text or with full alt, never screenshots of text alone; disclaimer and footer present. |
| C5-33 | 3 | Fair point (a check mark beside a security), and the same glyph is read aloud inside the h1. Small; can ride the glyph chore. | Fold into the C5-39 chore; after f25. The trust line stays in text under the heading. |
| C5-39 | 3 | Real screen-reader noise ("left arrow Feed" on 20+ links), but an a11y chore, as cycle 4 ruled for C4-34(c). Not a feature slot. | Build in the a11y fixes lane this cycle, outside the six-slot cap: wrap glyphs in `aria-hidden` spans, include `✓` in the badge; an accessibility-tree scan pins it. Coordinate with F-25's link names. |
| C5-36 | 3 | Consistent identification (3.2.4) argues for one name, but the nav part is the owner's via F-18; copy lines are chore sized. | Copy frictions as a chore; nav label waits on F-18. Rebase on f16/f17 (`app/layout.tsx`). |
| C5-41 | 2 | Copy for a paid tool with billing off and no viewers; needs a legal re-sign. Low value now. | Legal committee re-signs; plain language. |
| C5-38 | 3 | Beyond AA strictly (forced colours is not an AA requirement), but the selected range disappears entirely for forced-colours users (`app/globals.css:190`, no forced-colors rule). A few lines of CSS: a chore. | Build in the a11y fixes lane this cycle, outside the cap: `@media (forced-colors: active)` gives the pressed tab a `Highlight` border/outline and keeps `aria-pressed`; e2e with forced colours emulated. Same pass: audit other state shown by background only (`.rows li:target`, `:193`). |
| C5-37 | 3 | Less clutter on a page with no figures helps cognitive load; minor. Make sure no figure surface loses its disclaimer. | The F3 disclaimer test still passes; footer keeps the links; the skip link still targets the footer. |
| C5-42 | 3 | Good test hygiene, but a chore, not a feature. | Chores lane, in slices; test count never drops. |
| C5-40 | 2 | Ops note; applying it is the owner's deploy setting. | Docs line + coverage flag as a chore; owner applies. |
| MK-P4 | 2 | Paid filters with billing off and legal review pending; filter UI adds a11y surface (labels, result-count announcements) for no current viewer. | Waits on legal review of F-3's list and OD 2.47. If built: labelled controls, result count announced politely, no rank words. |
| L-28 | 4 | Fixes a wrong Verified figure (a later long trade priced from a short's cover). Keep it approved. | Re-approved, still "waits on OD 2.27". One matcher builder with F-30 and C5-1. |
| L-30 | 4 | Same priority class (a same-day short published as a gain). Keep it approved. | Re-approved, still "waits on OD 2.26". Same matcher slot as L-28 and C5-1. |
| L-29 | 4 | Code prerequisites merged; it trims repeated "Excluding options" that buries the headline for screen readers too, and its AC already ties the qualifier to the headline by reading order or `aria-describedby`. | Re-approve as ready; legal committee's signed words are the build's first step and are recorded in the PR. Keep the a11y AC (announced with the headline figures). |
| L-21 | 4 | F3-2 merged; the pane (SW-1's main record view) still shows headline figures with no exclusion count (`app/pane.tsx`). Its a11y decisions are already specific. | Starts after F3-2 alone unless F-22 lands first; one slot with F-23/C5-5 pane files. Keep all its a11y AC; C5-1's interim transfer count joins its shared sum. |

**Feature vs chore (my lens):** C5-38, C5-39 (with C5-33's glyph) and the copy half of C5-36 are a11y chores for the
a11y fixes lane, outside the six-slot cap; C5-43, C5-42 and C5-40 are engineering chores. They should not consume
build slots.

### GR (round 1)

#### Round 1 ballot: GR (growth), approval council cycle 5

Base: origin/main e16d6aa. Lens: sharing loops, unfurls, link-in-bio, first-visit conversion, F-15 measurement (the
closed `via` registry, `lib/referral.ts:55-67`), within POLICY F3b (pull, never push) and F5/F6 (no rewards for
activity, no wagering). Every trade mentioned is fictional. Not investment advice.

Code facts checked at e16d6aa:
- The registry today: `SHARE_VIAS = card, story, trade, month` (`lib/referral.ts:60`), `REFERRED_SURFACES` (`:13`),
  `INVITE_VIAS` (`:62`). A new code is a reviewed code change there, never a database value (`:56-58`).
- The owner's Share box shows no preview (`app/u/[handle]/share-card.tsx:9-25`). The one-time post-connect prompt
  already does, but it shows `/u/<h>/opengraph-image` (`app/u/[handle]/share-prompt.tsx:39-40`), while both Share
  buttons attach `/u/<h>/story?format=square` (`share-card.tsx:15-16`, `share-prompt.tsx:50`). So the picture a trader
  previews is not the picture the share sheet sends.
- Square and story pictures travel without a link preview (`lib/copy.ts:158-160` comment), which is C5-32's premise.
- An embed panel existed and was removed (`share-card.tsx:7-8`; cycle 2 fix 30 deleted its dead CSS,
  `docs/ideas/approval-2026-11-01-cycle2.md:267`). MK-P3 should say why a bio image returns.
- The stock heading: `app/t/[symbol]/page.tsx:121` (`{symbol} <Badge verified …/>`). The nav: `app/layout.tsx:50`
  ("My record" → `/me/record`). The ranking floor: `lib/confidence.ts:15-18`. The grace: `lib/sync.ts:38-39`. The
  connection date is public today only for an idle record: `lib/privacy-fields.ts:70-71`.

| Item | Score | Reason (one or two lines) | Conditions you'd attach |
|---|---|---|---|
| C5-1 | 5 | Publishes a wrong Verified figure the trader steers after seeing the loss (80% → 100% win rate on the probe): cycle-4 priority rule. A shared link carrying that record is the worst unfurl we could send. | Interim form now (after #84): the window's sells counted under their own "transfer" line on the profile. Full form waits on OD 2.28 + the vendor answer (MRC2-10). One matcher builder with F-28/F-30; property test "a transfer never improves a shown average or win rate". |
| C5-4 | 4 | The feed's top is the first-visit screen; ten +1.0% trades topping a 200-bet record makes the product look gameable to the first reader. Symmetric fix. | Approved as "waits on C5 Q3". "Too early to tell" wording follows OD 2.32. Property test: moderate tier and above keep today's order; losses rank like gains. |
| C5-5 | 4 | Trade and month links are the `via=trade`/`via=month` share paths; their unfurls show a realized average in gain colour beside a bare "2 open, unrealized" count. Unfurls must say the same as the card. | Wording part ("per closed trade") and the one-producer helper now, after f16/f17 and f25 merge; values wait on OD 2.25. Image snapshot tests for all link previews. |
| C5-10 | 4 | The strongest positioning answer once "verified" is free elsewhere (MK-3): "since connecting" is the one selection gap our trust rules leave. A reason to share a link, not just a screenshot. | Waits on OD 2.7 (connection date public on every record). Never "live track record" or "proven" (F3b/F2); never larger than the headline; Demo shows no forward line; card line only when n >= 1. |
| C5-32 | 4 | Pictures are the most copied object and travel without their link; a code plus `/check` turns every forwarded picture into a pull path back to the record, and fights forged profit screenshots. | `/check` links to the full record with a new registry code `via=check` (reviewed change in `lib/referral.ts`, F-15 test updated). Code and path legible on the square and story at phone size and never crowd out the disclaimer. Key derived from an existing server secret with node's crypto (no dependency), or flagged to the owner as a deploy setting. Copy never says "authentic trader" or "complete" (F3a). |
| C5-30 | 4 | False on screen today ("through today" above tomorrow's close); small, after #84. | Rebuild scheduled when a quarantined row's date passes; the future count shows the row until then. |
| C5-31 | 3 | Real but narrow (tiny trades with large fees lead an abs-sorted feed); a protected DESIGN amendment. | Approved only as "waits on C5 Q1"; dated /how note; matcher bump shared with the matcher slot. |
| MK-P6 | 3 | Honest "Record since" matters to a viewer judging selection, but the fallback is one /how sentence and may belong with F5-6. | Engineer confirms the vendor field first; no figure changes; if POLICY F3's list must name it, flagged to the owner. |
| C5-43 | 3 | (a) cuts 531 ms off every feed page (first-visit speed) and (c) stops crawlers triggering a 3.1 s aggregation (search arrival): useful, but a chore batch, not a feature slot. | Run as a ponytail chore batch; (a) rebases on f16/f17. |
| MK-P3 | 4 | Core growth surface: bio links and pinned posts carry the most views per share; `via=badge` makes it measurable. Pulled on view, never pushed (F3b). | Not called a "badge" anywhere in UI or copy (F6 vocabulary; OD 2.41 strikes "badges" from DESIGN §3.4): "record image". Both disclaimer sentences legible, with a minimum render size. The copy control gives a plain link with `via=badge` first, the image second. No per-request storage, no cookies, no viewer logging (P6: an image on third-party pages must not become a tracking pixel). No platform name or logo (T5). Demo, frozen, importing and deleted states tested. Legal confirms F3b and OD 2.62 before outreach. Say why it returns after the cycle-2 embed panel removal. |
| C5-34 | 5 | The cheapest share-rate lever on the ballot: traders share what they have seen, and today the Share box shows nothing. It also fixes a mismatch: the post-connect prompt previews the OG card while the button sends the square picture. | The preview shows the picture the Share button actually sends (square), with the link preview's card beside it if both travel, each labelled. Reuse `share-prompt.tsx`'s onError fallback. Owner-only, lazy, never delays first paint. Alt text equals the image's own alt. |
| C5-35 | 3 | The one irreversible action should read like one; not a growth lever but a trust one. | Wording follows OD 2.9 ("permanently" stays out); rebases on f16/f17; e2e at 320 px. |
| MK-P5 | 4 | A neutral, searchable page outreach can link without naming anyone; teaches the reader why our record differs, by pull. | New registry code `via=read`. Demo examples only; no lead with "verified" (MK-3); no CTA beyond the existing footer and sign-in link; banned-claims and marks scans; sitemap once MRC2-13 lands. |
| C5-33 | 3 | Right under F3b/OD 2.38 and tiny; a chore-sized change after f25. | Source scan pins no check glyph in `/t/*` headings; rebases on f25. |
| C5-39 | 2 | Correct, but already routed to the a11y fixes lane with C4-34(c); not a slot. | Fixes lane. |
| C5-36 | 3 | "My record" in the nav opens private stats while every shared link calls the public profile the record: confuses traders about what they share. | Nav part waits on F-18 / the owner; copy lines now; rebases on f16/f17. |
| C5-41 | 3 | Copy only; the pitch should name the viewer's job. Small. | Legal committee re-signs (F-3). |
| C5-38 | 2 | Small CSS fix beyond AA; fixes lane. | Fixes lane with an e2e forced-colours check. |
| C5-37 | 2 | Reasonable tidy-up, low impact. | F3 disclaimer test still passes; footer keeps the links. |
| C5-42 | 2 | Test quality; no slot needed. | Adds only; test count never drops. |
| C5-40 | 2 | Ops doc; the production change is the owner's. | Flag to the owner as a deploy setting. |
| MK-P4 | 2 | Paid filters do not move a growth gate and need legal review and OD 2.47 first. | Not this cycle. |
| L-28 | 4 | Stops a wrong Verified figure; nothing has changed but the owner's silence. Keep it alive. | Re-approve as blocked on OD 2.27, in the matcher slot with C5-1 and F-30; new lapse clause. |
| L-30 | 4 | Same class (a phantom day trade published Verified); narrowed so the trader cannot steer it. | Re-approve as blocked on OD 2.26; keep the readout's stamp-pattern class count. |
| L-29 | 4 | Prerequisites merged; fewer repeated "Excluding options" lines makes the pane, the main record view from shared links, readable. | Re-approve as ready, with the legal committee's signed words as the build's first step, recorded in the PR. |
| L-21 | 4 | F3-2 merged: exclusions belong where shared-link readers actually read (pane and strip), or the headline implies completeness (F3a). | Build in the pane slot after F-23 (#97); share card unchanged until the owner answers cycle-3 Q4; one shared sum also takes F-22's count if it lands first. |

Role line: GR asks that every new public surface on this ballot (C5-32 `/check`, MK-P3 record image, MK-P5 page) adds
its own closed `via` code in `lib/referral.ts` with the F-15 tests updated, so the week-8 reading can tell them apart.

### MA (round 1)

#### Round 1 ballot: MA (market analyst), approval council cycle 5

Base: origin/main e16d6aa. Lens: positioning now that "verified" is free at scale in a large broker's in-app feed
(cycle5 4.2, MK-3; market-2026-11-01.md finding 7, Medium-Low), differentiation, willingness to pay, evidence behind
each proposal. Competitors described generically only. All example trades fictional. No advice.

Positioning premise I score against: the label "Verified" no longer differentiates (`lib/copy.ts:444` still leads first
contact with "Verified trades, straight from the broker"). What still differentiates is whole-record integrity: no
per-trade hiding, losses ranked like gains, ranges, freeze on disconnect, readable signed out, across brokers
(market-2026-11-01.md:101-103). Items that protect or make visible that integrity score high; items that let a record
be steered, overstated or forged score as threats to the only moat left. Willingness to pay is unmeasured and likely
bimodal (market-2026-11-01.md:300-301, :590 "No willingness-to-pay data exists"), so paid-tier work scores low.

| Item | Score | Reason (one or two lines) | Conditions you'd attach |
|---|---|---|---|
| C5-1 | 5 | A trader can remove a chosen loss after seeing it and stay Verified (80% to 100% win rate in the fictional probe). "A record the trader can't edit" is the one claim a free chosen-posts feed cannot make; this breaks it. | Approve the interim now (window sells counted under their own "transfer" line, after #84); full form "waits on OD 2.28 + vendor answer MRC2-10". One matcher builder with F-28/F-30. AC: inserting a transfer never improves a shown average or win rate (property test). |
| C5-4 | 4 | Ranges and lower-bound ranking are a differentiator; ten identical +1% trades out-weighing a 200-bet record (0.299 vs 0.167, `lib/bets.ts:47`, `lib/confidence.ts:18`) makes it look gameable. | "Approved, waits on C5 Q3" (replaces owner's 10-bet floor). Symmetric for losses. "Too early to tell" wording follows OD 2.32. |
| C5-5 | 4 | Open positions are the crux of trust if the disposition effect holds (market:140-142); a shared trade link showing a green realized average beside a bare "2 open" (`lib/copy.ts:174`) is the selective-screenshot pattern. | Helper + "per closed trade" wording now; values wait on OD 2.25. Build after f16/f17 and f25. Shares a slot with L-21 / F-23 pane files where they overlap. |
| C5-10 (MK-P1) | 4 | The one selection gap left (who connects and when; market:143). Public sources show no such split in the free broker feed, so it is a real differentiator. Medium-Low evidence on the competitor side. | "Approved, waits on OD 2.7" (connection date becomes public on every record). Never larger than the headline; "since connecting", never "live/proven track record" (F3b); Demo never shows it. |
| C5-32 (MK-P2) | 4 | Distribution is image-first (market finding 10) and regulators name screenshots of wins as a scam red flag (market-cycle2:2083-2094); a checkable picture is what makes an honest image worth more than a fake. | /check states it proves the picture matches the stored record, not who posted it (real linkable records are impersonation bait, market-cycle2:139). Key: domain-separated derivation of an existing server secret, or the owner sets a new env (flag). Never "matches" when figures differ. |
| C5-30 | 4 | False on screen today ("Trades close through today" above a close dated tomorrow); cycle-4 priority rule. Cheap. | After #84 (same future-count query). The scheduled rebuild when a quarantined row's date passes is part of AC. |
| C5-31 | 4 | A Verified return that doubles the cash return (+100% vs +50%) and the feed sorts by size, so the overstated small trades lead: a wrong Verified figure in the most visible slot. | "Approved, waits on C5 Q1" (DESIGN §2.5 protected). MATCHER_VERSION bump with a dated /how note. |
| MK-P6 | 4 | A record that starts at the broker's history limit reading as the trader's start is a quiet completeness claim (F3a); cheap, and pairs with F5-6 (connect copy "your full trade history", `lib/copy.ts:51`). | Engineer confirms the vendor field first; fallback is the one /how sentence. No figure changes. |
| C5-43 | 3 | Real before-users scale work, no market effect by itself; reads as a chore batch, not a feature slot. | Route as a chore batch outside the six slots if the chair allows; (a) rebases on f16/f17. |
| MK-P3 | 3 | Bio links plausibly carry the most views per share, but that rate is labelled ASSUMPTION (market-cycle2:1246-1247); a free-floating image of a real record is impersonation bait. Worth doing after the check code exists. | Later cycle, after C5-32 so the badge carries a check code; OD 2.62 before outreach; both disclaimer sentences legible; no platform names/logos (T5). |
| C5-34 | 3 | Traders share what they have seen; plausible lift to share rate (G3) but no evidence; cheap. | Owner-only, lazy, same image as the unfurl. |
| C5-35 | 3 | Honest, irreversible action should look like one; low market weight. | Wording follows OD 2.9 ("permanently" stays out). Rebase on f16/f17. |
| MK-P5 | 4 | The positioning answer to a free chosen-posts feed: teach readers what to ask of any trading claim (chosen trades, survivorship, small samples, open positions) without naming anyone (T1-T4). Linkable from outreach; static, S. | Demo data only; F1 framing (reading records, never trading); banned-claims and marks scan; never claims this product is the only complete one (F3a "the only"). |
| C5-33 | 3 | A check mark beside a ticker can read as a rating (F3b); cheap and correct, small market effect. | After f25 (`app/t/[symbol]/page.tsx:121`). |
| C5-39 | 2 | Correct but a chore; already routed to the a11y fixes lane with C4-34(c). | Fold into the a11y chore, not a slot. |
| C5-36 | 2 | Copy friction is real but the nav part waits on F-18; small. | Nav part waits on the owner via F-18; copy lines can ride a chore. |
| C5-41 | 3 | The paying job is "choose whom to follow" (market:186-189); naming it is cheap, but billing is off so value is deferred. | Legal committee re-signs (F-3); no "best/top/pick". |
| C5-38 | 2 | Beyond AA; small CSS chore. | Chore lane. |
| C5-37 | 2 | Tidy, near-zero market effect; removing a disclaimer box is easy to get wrong. | F3 disclaimer test stays green; footer keeps links. |
| C5-42 | 2 | Test quality, no product effect. | Chore; test count never drops. |
| C5-40 | 2 | Ops doc; production setting is the owner's. | Flag the deploy part to the owner; doc + coverage flag only. |
| MK-P4 | 2 | No willingness-to-pay data exists (market:590); WTP likely bimodal and live billing is off until week 8 (OD 2.47). Building paid filters before the painted-door reading spends a slot on an untested wallet. | Not this cycle. If revived: legal committee reviews the list, no symbol filter or order, no "top/best", pull only. |
| L-28 | 4 | Wrong Verified figure (+28.6% published for a -10% trade); 15/15 last cycle. Re-approve so it is ready the day the owner answers. | "Re-approved, waits on OD 2.27"; matcher slot with F-30 and C5-1. |
| L-30 | 4 | Phantom same-day trade published as Verified on date-only brokers; same priority class. | "Re-approved, waits on OD 2.26"; build with F-28. |
| L-29 | 4 | Code prerequisites merged; /how saying "consented" makes every trader read as withholding: false on screen today. | Ready with the legal committee's signed words as the build's first step, recorded in the PR. |
| L-21 | 4 | Exclusion counts where the record is read make the "nothing hidden" claim visible, which is the positioning lead once "verified" is generic; F3-2 merged. | Shares the pane slot with F-23 (#97) and C5-5; build after F-23. One shared sum function; neutral muted wording. |

Slot note (MA view): matcher slot (C5-1 interim, L-28, L-30; C5-31 joins when Q1 answers), pane slot (L-21 with C5-5
helper), /check slot (C5-32), forward-record slot (C5-10, waits OD 2.7), C5-30 (lib/sync.ts after #84), MK-P6 + MK-P5
(copy/static). L-29 and the lapsed items are not new.

### DS (round 1)

#### Round 1 ballot: DS (design-system owner), council cycle 5

Lens: one trust language (F-18), tokens and contrast (F-20), one producer per string/component across surfaces,
the design-system rulings (`docs/direction/design-system-2026-11-01.md`, cited "DS"). Base: origin/main e16d6aa.
Code facts checked on main; all examples fictional.

| Item | Score | Reason (one or two lines) | Conditions you'd attach |
|---|---|---|---|
| C5-1 | 5 | A chosen loss can vanish from a Verified record (priority rule: a wrong Verified figure). The interim transfer line makes the exclusion visible now; the full form rightly waits on OD 2.28 + vendor. | Approve as "interim now, full form waits on OD 2.28 / MRC2-10". The interim "transfer" count enters F-21's single exclusion-sum function (no second producer) with F-21's neutral muted wording ("excluded from these figures", no warning colour). One matcher builder with F-28/F-30; after #84. |
| C5-4 | 4 | Ten identical trades print "(+1.0% to +1.0%)" and out-rank a 200-bet record; a zero-width range is a false precision display. Symmetric for losses. | Waits on C5 Q3. "Too early to tell" is the one string already used elsewhere (`app/t/[symbol]/page.tsx:127`); reuse that constant, never a new variant. Losses rank equal to gains (property test). |
| C5-5 | 4 | Core DS lens: one open-positions producer for card, pane, profile, strips and images; today the strip says "average per trade" + bare "n open, unrealized" (`lib/copy.ts:174`, `lib/record-strip.ts:119`) while the card says "average per closed trade" (`lib/copy.ts:172`). | Approve the one-producer helper and "per closed trade" wording now; values wait on OD 2.25. Down colour via the `--loss` token only, never a literal; image strip still fits F-12's safe area (render snapshot). After f16/f17 and f25 merge. |
| C5-10 | 3 | Worth it, but it adds a public field (OD 2.7) and a third maturity-style line under the headline, against DSP-8's "one record-maturity signal per surface" and the card-1 height budget (DS §4.3). | Waits on OD 2.7. Never larger than the headline; reuses TR-9 range and "Too early to tell" producers; card-1 budget e2e at 360 px keeps the disclaimer in view. |
| C5-32 | 3 | Useful against forged pictures, but every image band is already at its budget (DS §4.3: 502 px box, F-12 safe area), and the key is an owner deploy setting unless derived. | Code + "/check" fit inside F-12's safe area with a render-snapshot test on all five pictures; `/check` uses TRUST_LOOK states (Verified / Demo / Public source), never "matches" when figures differ; key is the owner's env (no reuse of APP_SECRET_KEY, cf. C5-18). |
| C5-30 | 4 | False on screen today: "Trades close through today" above a close dated tomorrow (`app/u/[handle]/month/[ym]/page.tsx:89`). Small. | After #84; the scheduled rebuild when a quarantined date passes is in scope; the future count keeps its own line. |
| C5-31 | 4 | +100% shown where +50% was earned on cash paid, on a Verified record, and the feed sorts by size. | Waits on C5 Q1. Dated `/how` formula note; shares the matcher slot/version bump with C5-1, F-28, F-30. |
| MK-P6 | 3 | "Record since" on a history-limited record implies when the trader began (F3a). Vendor field unknown. Today three producers print it (`lib/copy.ts:943`, `:1009`, `lib/record-card.ts:121`). | One producer for the record-start label on every surface (F-11 StatusLine, card, images); fallback is the single /how sentence. Pairs with fix F5-6 part 1. |
| C5-43 | 3 | Sound scale work, but it is a chore batch, not a product feature; should not take a build slot. | Route as chores (fixes lane); (a) rebases on f16/f17. |
| MK-P3 | 2 | A new image surface that must carry handle, trust state, count, average + range, "losses included", as-of date and both disclaimer sentences legibly at bio size: out of proportion for the space; risks an illegible or stripped-down trust language. | If kept: TRUST_LOOK pill, both disclaimers at ≥ the F-12 legibility floor with a render-snapshot fit test; no new badge look. OD 2.62 before outreach. |
| C5-34 | 3 | Good: the owner sees exactly the unfurl image. Not urgent. | Same image URL as the unfurl (no second renderer); lazy, owner only; alt text from the card's existing alt producer. |
| C5-35 | 4 | The one irreversible action is styled like Connect (`app/settings/page.tsx:35`, plain `button wide`). A component-consistency defect in effect. | No `--danger` token exists in `app/globals.css`: a new role token must pass F-20's contrast test and must NOT reuse `--loss` (loss red means a losing trade; DS ruling on meaning colours, cf. failed imports using loss red). Wording follows OD 2.9; focus on the confirmation heading. |
| MK-P5 | 3 | Neutral, linkable, education about reading records. Risk: a second explainer drifting from /how. | Pulls definitions (Verified, ranges, open positions) from the same `lib/copy.ts` constants /how uses; Demo-only examples; marks scanner + banned-claims walk. |
| C5-33 | 4 | Directly enforces DS ruling 1 (bare "Verified", no check glyph) and DS §4.3 (`/t`: no security-level Verified pill, F3b). Today the heading renders `<Badge>` whose text is "✓ Verified" (`app/t/[symbol]/page.tsx:121`, `app/ui.tsx:29`). | Build as a slice of F-18 (or with it): heading is the ticker alone; the existing `FL.tickerExplainer` line carries trust; per-row `plain` badges stay. Source scan: no badge or check glyph inside the `/t/*` h1. After f25. |
| C5-39 | 3 | Right fix; better as a chore in the a11y lane (C4-34(c) already routed there). | One shared back/forward link component with the arrow in an `aria-hidden` span, not 19 ad-hoc edits; accessibility-tree scan. |
| C5-36 | 3 | Real naming split ("My record" → private stats, `app/layout.tsx:50`) but the nav label is DSP-7/V-3, a three-variant test, and F-18's question. Copy frictions verified (`lib/report-copy.ts:37` "Thesis held"; duplicate "Record tools", `app/settings/page.tsx:28-29`). | Copy frictions as a chore now; nav label only via F-18 / the V-3 variants (CLAUDE.md three versions per product change). |
| C5-41 | 2 | The suggested line ("every closed trade ... nothing hidden by the trader") is itself a completeness claim POLICY bans; and F-3 copy needs the legal re-sign. | Reshape: no "every", "all", "nothing hidden"; legal committee signs the words; one constant in `RECORD_TOOLS`. |
| C5-38 | 3 | Selected range is background-only (`app/globals.css:190`), invisible in forced colours. Small CSS; chore-sized. | `@media (forced-colors: active)` border using system colours (`Highlight`/`ButtonText`), plus a non-colour cue; e2e with emulation. Route as chore. |
| C5-37 | 3 | A disclaimer box on a page with no figures dilutes the disclaimer's meaning elsewhere; footer keeps it. | Only `/account`; F3 disclaimer-on-performance-surfaces test still passes; `Disclaimer` component untouched for tool pages that show figures. |
| C5-42 | 3 | Better tests, adds only. Not a feature slot. | Chore lane, in slices; count never drops. |
| C5-40 | 2 | Ops doc + a coverage flag; production setting is the owner's. | Doc line only; owner applies it. Route as chore. |
| MK-P4 | 2 | Paid filters with legal review and OD 2.47 pending; moves no gate. Later. | Legal review first; no symbol filter, no "top/best"; OD 2.33's order. |
| L-28 | 4 | Matcher correctness on Verified figures; re-approval costs no new slot. | Re-approve as "waits on OD 2.27"; one matcher builder with C5-1/L-30/C5-31. |
| L-30 | 4 | Same: steerable same-instant order on date-only stamps. | Re-approve as "waits on OD 2.26"; same matcher slot. |
| L-29 | 5 | False on screen today: /how says option results show "only on records whose trader has consented" (`lib/copy.ts:549`) while every record is gated. Also DS lens: one options qualifier per card/pane instead of up to five. Prerequisites merged. | Re-approve as ready; the legal committee's signed words are the build's first step and recorded in the PR; qualifier keeps the muted caption token (no warning tone); positional render test. |
| L-21 | 4 | Exclusions should show where the record is read (pane, strip); one sum function is exactly the DS one-producer rule. | Same pane slot as F-23 and C5-5 (sequence after F-23); the C5-1 interim transfer count joins its sum; neutral muted wording via `--muted` with AA contrast; disclaimer stays in view at 360 px. |

#### Notes
- Slot view: C5-33 belongs with F-18 (one trust language) rather than as a standalone feature. C5-1, C5-31, L-28,
  L-30 are one matcher slot. C5-5 and L-21 share the pane/strip files with F-23. C5-39, C5-38, C5-43, C5-42, C5-40
  and the C5-36 copy frictions are chores, not slots.
- Observation (not on the ballot, for the chair): `/t/[symbol]` still shows a security-level win rate and average
  (`app/t/[symbol]/page.tsx:124-127`), which DS §4.3 lists as "no security-level win rate, average or Verified pill
  (F3b)". If an owner or feature decision superseded that row, fine; otherwise it is for OD 2.38 / the fixes lane.

### RE (round 1)

#### Round 1 ballot: RE (reliability engineer), cycle 5

Lens: scale, failure modes, rebuild/sync safety, ops cost, matcher version changes, 50 vs 50,000 traders.
Read at origin/main e16d6aa. All trades mentioned are fictional.

Key code facts I relied on:
- `lib/trades.ts:79` `MATCHER_VERSION = 2`; every bump forces a full per-record rebuild (`lib/matcher-rebuild.ts:18-43`),
  bounded by a 600 s deploy budget, leftovers wait for the next deploy (ponytail `lib/matcher-rebuild.ts:12-13`), and a
  failure's cause is swallowed (`:38`). At 15 k+ traders, old-matcher figures stay up for about 3 deploys (cycle5 C5-43b).
  So every matcher item on this ballot (C5-1, C5-31, L-28, L-30) multiplies that exposure unless they share ONE bump and
  the catch-up lands first.
- `lib/trades.ts:128-153`: every unpriceable action, transfers included (`lib/corporate-actions.ts:157`, `:204`),
  enters the 14-day backward window per pair: C5-1's steerable exclusion is real.
- `lib/sync.ts:600-602`: a rebuild runs only when activities were read or the account set changed, so C5-30 needs its
  own scheduled rebuild when a held future row matures (its AC already says so).
- `lib/record-status-load.ts:16-26`: the account count scans activities on every feed page (C5-43a).
- `lib/sitemaps.ts:70-71`: a crawler GET runs the whole-table aggregation (C5-43c); `lib/sync.ts:207-208` app clock (C5-43d).
- `app/u/[handle]/opengraph-image.tsx:15-20`: the card renders on every request with no cache directive; MK-P3 "cached
  like the card" would inherit that, and a badge in a forum signature is fetched per page view.
- `lib/trades.ts:317`: return divides by `cost` only (C5-31's evidence holds).
- `lib/bets.ts:47-48`: `se` goes to 0 on identical returns; `lib/confidence.ts:18` `RANK_MIN_BETS = 10` (C5-4 holds).

| Item | Score | Reason (one or two lines) | Conditions you'd attach |
|---|---|---|---|
| C5-1 | 5 | A steerable path that publishes a wrong Verified figure today (`lib/trades.ts:149-153` over transfer rows); top of the priority rule. Interim transfer line is safe now; full form waits on OD 2.28 + vendor. | One matcher builder and ONE `MATCHER_VERSION` bump (to 3) shared with F-28/F-30/C5-31; land C5-43(b) catch-up first or in the same slot; deploy rebuild reports counts moved published-to-counted; theses kept by `sell_id`; the interim "transfer" counter joins F-21's shared exclusion sum (its schema test enforces it); build after #84. |
| C5-4 | 4 | Pure read-side change (weights computed on read, `lib/feed.ts:391`), no rebuild, no migration; fixes a TR-9 hole symmetric for losses. | Waits on C5 Q3; property test that moderate+ order is unchanged; clear the in-memory weight cache on deploy (it is per process, `lib/feed.ts:395-396`, so a restart suffices; say so in the PR). |
| C5-5 | 4 | One producer for the open line removes a class of drift between seven surfaces; wording part ("per closed trade") is free now. | Values wait on OD 2.25; build after f16/f17 and f25 merge; same slot as L-21/F-23 (pane files); image snapshot tests for all three images. |
| C5-10 | 3 | Valuable, but needs a durable "first consented connection" date per account that never resets; today deletion releases claims (`lib/claims.ts:25`) and reconnect paths could reset it. | Waits on OD 2.7; date stored once per broker account (not per connection row) and never updated; test the delete-and-reconnect path; pure split in `lib/trades.ts` needs no matcher bump (derive on read, do not store in `closed_trades`). |
| C5-32 | 3 | Good against forged pictures, but adds key management and a per-request recompute endpoint. A key change silently voids every printed code. | Code carries a key-version byte so rotation keeps old codes resolvable; key derived from an existing secret with a distinct label or set by the owner (deploy setting flagged); /check recompute reads an indexed per-user range, cached per code, rate-limited like images; states plainly when figures changed after a rebuild/matcher change. |
| C5-30 | 4 | Removes a false on-screen statement ("through today" above tomorrow's close); small. | The maturity check is one indexed query per sync tick (no table scan), runs the rebuild under the per-user advisory lock, and a test drives the clock past the row's date without any new activity; build after #84. |
| C5-31 | 4 | A +100% shown where cash return was +50% leads an abs-sorted feed: a wrong Verified figure class. One-line formula change. | Waits on C5 Q1; ride the same single matcher bump as C5-1/F-28/F-30; dated /how note; test the exit-fee > proceeds case. |
| MK-P6 | 3 | Truthful, no figure changes, zero ops cost; depends on a vendor field that may not exist. | Engineer confirms the vendor field first; fallback is the one /how sentence; no new per-request vendor call (read at sync, store). |
| C5-43 | 5 | Core scale debt: (b) is the prerequisite that makes every matcher change safe at 50 k traders; (a) 531 ms per feed page; (c) crawler-triggered 3.1 s aggregation; (d) clock skew in freeze. All S, all chores. | Treat as a chore batch (no feature slot); (b) drains within each shard's budget under the per-user lock, logs each failure's cause (closes C5-15 too), never marks the version done while a failure remains; (a) rebases on f16/f17 and must equal `lib/record-status-load.test.ts`; (c) no GET aggregates `closed_trades`. |
| MK-P3 | 2 | New public per-handle image hit on every forum/bio page view; the card it copies renders per request with no cache directive (`opengraph-image.tsx:15-20`). At 50 k traders that is uncapped next/og CPU plus a DB read per view. | Only with explicit CDN caching (s-maxage + stale-while-revalidate keyed on last rebuild), rate limit, and a load test; OD 2.62 before outreach. |
| C5-34 | 3 | Fine; one extra lazy image render per owner visit. | Owner-only, lazy, the exact unfurl URL (no second render path). |
| C5-35 | 3 | Right for an irreversible action. Risk: a confirmation page that says "deleted" while vendor-side deletion is still pending in cron (C5-16). | Confirmation wording tells the truth about pending vendor deletion; wording per OD 2.9; rebase on f16/f17. |
| MK-P5 | 3 | Static, zero ops, educational; outreach asset. | Demo data only; banned-claims and marks scans. |
| C5-33 | 3 | Tiny and correct. | After f25; source-scan test. |
| C5-39 | 3 | A11y chore, belongs with C4-34(c). | Route to the a11y chore lane, no slot. |
| C5-36 | 2 | Copy; nav part is the owner's via F-18. | Copy parts as chore; nav waits on F-18. |
| C5-41 | 2 | Copy only; legal re-sign. | Legal committee re-signs. |
| C5-38 | 3 | Tiny CSS chore. | e2e with forced colours emulated; chore lane. |
| C5-37 | 2 | Small gain, small risk of weakening the F3 disclaimer test surface. | F3 disclaimer test unchanged and green. |
| C5-42 | 4 | Wall-clock race windows (2 s/5 s) are flaky CI waiting to happen; behaviour tests catch real regressions text checks miss. | Adds only, never removes; event-ordering assertions beside the timing ones; slices; no slot (chore). |
| C5-40 | 4 | JIT is 85% of a rollup read; doc + coverage flag is near-free ops value. | Doc and flag only; applying `jit = off` in production flagged to the owner (deploy setting). |
| MK-P4 | 2 | New filtered query shapes over all public records need indexes and load checks; also blocked on legal review and OD 2.47. | Legal review and OD 2.47 first; EXPLAIN at 2 M closes for each filter. |
| L-28 | 5 | Publishes a wrong Verified figure today (+28.6% for a −10% trip); counts more, never publishes more. | Re-approve, stays blocked on OD 2.27; matcher slot with one bump; C5-43(b) first; byte-identical rebuild for plain histories. |
| L-30 | 4 | Same class on date-only stamps, narrowed so it cannot be steered. | Re-approve, blocked on OD 2.26; built with F-28 in the same bump; intraday twin test. |
| L-29 | 4 | Code prerequisites merged; only signed words remain. Gate-state in cache keys (my cycle-4 condition) still essential. | Ready with the legal words as build step 1; cache keys include `optionsPublic()` state, tested both ways. |
| L-21 | 4 | F3-2 merged; one shared exclusion sum with a schema test is the right guard as new exclusion kinds (C5-1 interim, F-22, F-24 `excludedHeld`) arrive. | One slot with F-23/C5-5 (pane files); `excludedHeld` from #84 and any C5-1 transfer counter join the sum or are named as excluded with a reason. |

### CO (round 1)

#### Cycle 5, round 1 ballot: CO (contrarian / common sense)

Base: origin/main e16d6aa. Lens: is it needed before real users, in proportion, honest and clear to a reasonable
trader, viewer and owner? General objection: the ballot has 26 items and most of the top ones wait on an owner answer.
Approving many blocked items fills slots on paper with nothing buildable; I score blocked items for their merit but ask
that at most three *active* slots run at once (same as my cycle-4 V5), and that chores (C5-39, C5-38, C5-43, C5-40,
C5-42) go to the chore lane instead of taking feature slots.

| Item | Score | Reason (one or two lines) | Conditions you'd attach |
|---|---|---|---|
| C5-1 | 4 | A one-share transfer erases a chosen loss and the record stays Verified: dishonest on its face. Mechanism verified: TRANSFER and both external types are share types (`lib/corporate-actions.ts:157`), and every unpriceable action is keyed into the backward window (`lib/trades.ts:128-133`, `:149-153`). | Approve the interim only now (count the window's sells under their own "transfer" line, after #84); the full rule waits on OD 2.28 and the vendor answer. AC: inserting a transfer never improves a shown average or win rate. One matcher slot with F-28/F-30. |
| C5-4 | 4 | Ten identical +1% trades outranking 200 bets is plainly absurd to a viewer; zero-width "likely between +1.0% and +1.0%" is false precision (`lib/bets.ts:47` gives se = 0). | Split it: the 1-point spread floor and "Too early to tell" for a zero-width range can go now (inside OD 2.32's wording); replacing the owner's 10-bet floor (`lib/confidence.ts:15-18`) with the moderate tier is "approved, waits on C5 Q3". Losses symmetric (test). |
| C5-5 | 3 | A big green realized average beside "2 open, unrealized" (`lib/copy.ts:174`, `lib/record-strip.ts:119`) can mislead, but *what* to show is OD 2.25's call and the build waits on two branches. | Ship only the "per closed trade" wording now (copy fix). The one-producer helper waits on OD 2.25 and the f16/f17 + f25 merges. No new unrealized value before 2.25. |
| C5-10 | 3 | Honest idea (who connects and when is the last selection gap), but size M, a new public field that needs OD 2.7, and a second average under the headline risks reading as "the real number". Not needed before users exist. | Waits on OD 2.7. Never larger than or replacing the headline; "Too early to tell" below the floor; never "proven"/"live track record". |
| C5-32 | 2 | Out of proportion today: authenticated-encryption codes, a new server key (a deploy setting), a new signed-out page and recompute-as-of logic, before a single real share exists. The unfurl already carries the link. | Revisit before outreach. If built: key derived from an existing secret is not acceptable (S1 separation, C5-18); the owner sets a dedicated env. Never "matches" when figures differ. |
| C5-30 | 4 | A month page saying "through today" above a close dated tomorrow is false on screen. The code's own comment already promises publication "once its stored date is no longer in the future" (`lib/sync.ts:36-37`) while the query allows now()+24h (`:38-39`). Cheap. | After #84. AC includes the scheduled rebuild when a quarantined row's date passes, and the future count shows the row meanwhile. |
| C5-31 | 4 | +100% on a trade that made +50% on cash paid is a misleading headline, and the feed sorts by size. One-line formula (`lib/trades.ts:317`) plus a version bump. | Approved, waits on C5 Q1 (DESIGN §2.5 protected). Dated /how formula note. Same matcher slot as C5-1/F-28/F-30. |
| MK-P6 | 3 | Honest and cheap, and C5-8 (fixes list) already removes the "full trade history" claim. Depends on a vendor field nobody has confirmed. | Engineer confirms the field first; fallback is the one /how sentence only. No figure changes. Wording must not imply the trader started trading on that date. |
| C5-43 | 3 | Worth doing, but these are engineering chores at a scale (2 M closes, 15 k traders) we do not have. (b) matters most: old-matcher figures linger after a matcher change. | Route as a chore batch, not a feature slot. Do (b) before the next MATCHER_VERSION bump lands. |
| MK-P3 | 1 | A bio badge that must carry handle, trust state, count, average, range, "losses included", as-of date and both disclaimer sentences "legible at that size" cannot be legible at bio-badge size. A seventh public image surface before any users, built for outreach that OD 2.62 still gates. | VETO (see reply). |
| C5-34 | 4 | Plain common sense: a trader should see what they are about to share. Small, owner-only, lazy-loaded. | Same image the unfurl serves (no second rendering path); never delays first paint; alt text shown. |
| C5-35 | 4 | The one irreversible action looks like Connect (`app/settings/page.tsx:35`) and ends with no confirmation: confusing in the way that hurts people. | Wording follows OD 2.9 ("permanently" stays out until answered); focus to the confirmation heading; e2e at 320 px; rebase on f16/f17. |
| MK-P5 | 2 | A static essay page is marketing, not needed before users, and an education page about reading trading claims sits close to F1. | Later, if at all. Demo data only; legal walk; no "how to pick a trader" framing. |
| C5-33 | 4 | "TICKER ✓ Verified" (`app/t/[symbol]/page.tsx:121`) reads as a rating of the stock to any ordinary viewer. Tiny fix. | Rebase on f25. Trust line under the heading stays; source scan pins no check glyph in the /t heading. |
| C5-39 | 3 | Real a11y noise but chore-sized; cycle 4 already routed C4-34(c) to the a11y fixes lane. | Chore lane with C4-34(c), not a feature slot. |
| C5-36 | 3 | "My record" opening a private page while the public profile is "the record" (`app/layout.tsx:50`) is genuinely confusing; the other three lines are copy nits. | The three copy nits as a fix now; the nav label waits on F-18 / the owner. |
| C5-41 | 2 | Copy for a paid tier with live billing off and no subscribers. | Later; legal re-sign; no "best/top". |
| C5-38 | 3 | Beyond AA, tiny CSS. Fine, but a chore. | Chore lane; e2e with forced colours emulated. |
| C5-37 | 2 | Removing a disclaimer box saves little and invites the question "why is it gone here?"; the gain is negligible. | If done, the F3 disclaimer test still passes and the footer keeps the links. |
| C5-42 | 2 | Test hygiene, size M; worthy but not a council feature. | Chore lane, in slices; test count never drops. |
| C5-40 | 2 | One ops line; applying it is a deploy setting (owner). | Doc line + coverage flag only; owner applies. |
| MK-P4 | 1 | A paid filter to narrow public records to the "long, proven, live" ones, with no users and billing off, is a find-a-trader-to-copy tool in all but name; out of proportion now. | Not this cycle. Needs the legal committee's review and OD 2.47 first; never a symbol filter or order; no "top/best". |
| L-28 | 4 | Publishes a wrong Verified figure (+28.6% for a −10% trade) today; 15/15 last cycle; re-approval costs nothing. | Approved, waits on OD 2.27. Lapse clause again. True-cause wording ("a short sale or earlier history"). |
| L-30 | 4 | Same class (a same-day short published as +7.1% Verified on date-only stamps), narrowed so the trader cannot steer it. | Approved, waits on OD 2.26. Keep the "no rule the trader can steer" veto condition. One builder with L-28 and C5-1. |
| L-29 | 4 | /how says option results show only for traders who "consented", which reads as withholding for every trader while the gate is closed: false on screen today. Prerequisites merged. | Ready, legal committee's signed words as the build's first step; the last qualifier on a surface is never removed (my cycle-4 veto condition stands). |
| L-21 | 4 | Headlines on the pane and strip with no sign that trades were excluded imply completeness. F3-2 merged, so the cycle-4 blocker is gone. One muted line. | Starts after F3-2 alone unless F-22 is decided; neutral wording, no warning colour (CS veto condition stands); coordinate pane files with F-23 (#97) and C5-5 (one slot). |

## Round 2: debate statements

### TR (round 2)

#### Round 2: TR (trader). Debate statements

**C5-32 (for, 4).** For a trader, the forged picture is the real exposure. Someone can edit my card to look better and run a scam in my handle's name, or edit it worse to smear me. Today nothing lets a viewer check a picture: the share text carries no code (`lib/copy.ts:161`). I accept LC's reshaping in full. /check claims only "these figures match the stored record". A mismatch reads "figures changed since: a later import or a calculation update", never "forged". The key is HKDF-derived under a purpose label or a dedicated env. This is the honest trader's only defence against counterfeit cards.

**C5-43 (against, 3).** Two of its four parts touch my record's truth. (b) old-matcher figures stay up after a version bump, and (d) the freeze mark uses the app clock (`lib/sync.ts:207-208`, a ponytail). I want both done. But it is chore work and should not take a feature slot. Route (b) and (d) as chores, and do (b) before the matcher slot's bump. (a) and (c) are scale we do not have yet. My 3 is "chore, not slot", not "unimportant".

**MK-P3 (for, 3).** A trader's bio link is where a record actually gets seen, so the wish is real. But I support it only as LC and CO reshape it: a "record image" with no award styling and no symbol or "new" marker. It is either figure-free (handle, trust state, "see full record") or passes a legibility test of both disclaimer sentences at the rendered size. It goes after C5-34 and C5-32, and outreach waits on OD 2.62. Next cycle, not this one.

**C5-34 (for, 5).** Traders don't share what they haven't seen. If the unfurl surprises them, they stop sharing. GR's evidence makes the gap concrete. "Share my record" sends `/u/‹handle›/story?format=square` (`app/u/[handle]/share-card.tsx:16`). The only preview, shown once after connecting, is the opengraph card (`app/u/[handle]/share-prompt.tsx:39`). So today a trader can never see the picture they actually send. AC: the preview is that exact image, with its alt text, owner-only and lazy-loaded. Size S, no owner decision, no dependency. Best value per hour on the ballot for the people who create the content.

**C5-35 (for, 4).** Deletion is the only irreversible thing a trader does here. The final button looks like Connect, the confirm step drops what is removed and the one-year handle hold, and the trader lands on the feed with no confirmation (`app/auth/actions.ts:163`). A trader who isn't sure the record is gone will assume it isn't, and that is an exposure fear. Size S, rebases on f16/f17, wording follows OD 2.9. Sharing should feel reversible-by-leaving. Deleting should feel deliberate.

**MK-P5 (for, 3).** A neutral page on reading a trading claim (screenshots vs records, small samples, open positions) makes viewers prefer whole records over cropped screenshots. That market shift is what makes an honest record worth sharing. It is static, uses Demo data only and has low risk. It is not urgent: score 3, a later cycle or a light slot. It must pass the banned-claims walk, and nothing in it may teach trading.

**C5-39 (for, 3).** "← Feed" read aloud as "left arrow Feed" on 19 links is a real annoyance for screen-reader users, traders included. The fix is mechanical: `aria-hidden` on the glyph, plus one accessibility-tree scan. I agree with the chore routing (chair note 6). It should merge with C4-34(c) in the a11y lane, outside the cap.

**C5-36 (for, 3).** What is public and what is private is the question every trader asks before connecting. The nav's "My record" opens a private stats page (`app/layout.tsx:50`), while every other surface calls the public profile "the record". That trains traders to misjudge what strangers see. The nav part goes to the owner through F-18. The three copy lines ("Note held", the duplicate "Record tools", "if you publish") are chores.

**C5-41 (against, 2).** The pitch sells a paid tier whose billing stays off (OD 2.47), so it moves nothing now. As drafted, "nothing hidden by the trader" is false today. The trader can't hide single trades, but steerable exclusions (C5-1) exist and are only counted. LC's reshaped text fixes that. Even reshaped, it is copy for a closed door. Do it when billing nears, with LC's re-sign.

**C5-37 (against, 2).** The gain is cosmetic and the risk is real. The F-3 legal condition R8 keeps the disclaimer on /account (`docs/features/logs/F-3/committee-2026-11-01.md:41`). Dropping the box invites "why is it gone here?". At most, follow LC: mute the sentence and drop only the duplicate links, as a chore.

**C5-42 (for, 3).** My record's figures are only as safe as the tests that pin behaviour. A test that checks source text passes while the math silently changes. It is add-only: the count never drops and old assertions stay. It belongs in the chore lane in slices, starting with files that guard record math and sync (`lib/sync-route.test.ts:9`).

**C5-40 (against, 2).** It is an ops line plus a coverage flag. The JIT saving matters at a scale we don't have, and applying it in production is the owner's deploy setting. It is fine as a docs chore, or as a note in F-31's limits block (the hand-off already says so). It should not take a slot.

**L-28 (assigned for, 5; I concede).** I reproduced RT's probe on main (MATCHER_VERSION 2). F-28's own case (SELL 100 @15 with nothing held, BUY @14, BUY @20, SELL @18) now gives `trades: [], excl: 2`. #89 counts every later sell after an oversell (`lib/trades.ts:48-53`), so nothing wrong is published today. F-28's "later lots fresh" would loosen that. Let it lapse with an owner note: OD 2.27 is overtaken by #89. Keep the trader cost on record. The mark never clears, so one pre-history sale counts every later trade of that stock forever (`lib/trades.ts:55-57`, ponytail). The fair release needs vendor position units (owner).

**L-30 (assigned for, 4; I narrow it).** Same probe set. With evidence (an earlier oversell), the date-only same-day short gives `excl: 2` on main. Without evidence it still publishes +7.1%, the residual F-30 itself accepts. Probe C stays at 50%/0%, so no steering. What is left is broker-position evidence (protected `lib/broker.ts`, stored units: owner) and the readout class count. Re-approve only that residual, worded so it never loosens #89, or let it lapse alongside L-28. I will move below 4 in round 3.

### VW (round 2)

#### Round 2: VW (viewer lens) arguments

**C5-32 (for, 4).** On launch day the share pictures (square and story, `app/u/[handle]/share-card.tsx:16`) are what travels without a link. A skeptic who is shown a cropped or edited picture has no way to check it, and that is how fake profit displays usually work. I accept CO's proportion point by approving it as "build before outreach", not as a launch slot. I take LC's reshaping whole: /check says only that the figures match the stored record and never "authentic", and a mismatch never reads "forged". On the key: EN's HKDF purpose label under LC's terms needs no new env. The code is muted at caption size and never displaces the disclaimer (UX).

**C5-43 (against, 3).** Every part is real, but only (b) can be seen by a viewer: old-matcher figures stay up after a fix (`lib/matcher-rebuild.ts:12`). (a), (c) and (d) are latency and clock hygiene. None of the four needs a feature file, a design decision or an owner answer. They are ponytails with their fixes already written, so they belong in the chore lane, with (b) first and (d) riding C5-30's `lib/sync.ts` slot. Spending one of six feature slots on them would push out a trust item.

**MK-P3 (against, 2).** A viewer meets this image in a bio, cut off from the record. As briefed, it puts an average, a range and two disclaimer sentences into a signature-sized image, so either the disclaimer can't be read or the figures crowd it out. In both cases the stranger sees a bare number and a trust mark, which is exactly the screenshot problem C5-32 is meant to solve. I back CO's veto condition: figure-free (handle, trust state, "see full record") or a test that the text is legible at the rendered size, renamed away from "badge" (LC, F6), and outreach waits on OD 2.62.

**C5-34 (against, 3).** This is worth doing but owner-facing. GR's finding decides it, though (`share-prompt.tsx:39-40` previews the opengraph card while Share sends `/story?format=square`, `share-card.tsx:16`): the trader can already be shown a different picture from the one they send. Fixing that mismatch is a truthful-label defect for the fixes lane. The preview itself is size S and has no design question in it, so it should not take a feature slot from items where a viewer sees something false.

**C5-35 (against, 3).** A signed-out viewer never reaches the deletion flow. The real problems are a danger style, a list that is repeated, and a confirmation page. They are worth fixing, but the wording waits on OD 2.9 ("permanently") and the file waits on f16/f17 (`app/auth/actions.ts:163`). It is size S UX polish with no new rule in it, and most of it (focus, C5-26) is already on the fixes list. It fits as a fix or a ride-along in f16/f17's follow-up better than as one of six slots.

**C5-39 (for, 3).** For a screen-reader viewer, "left arrow Feed" (×7) and "See full profile right arrow" (×6) are noise at every navigation step, on the signed-out pages shared links land on. It is cheap and testable with one accessibility-tree scan. It merges with C4-34(c) and F-25's names. I support it as ROUTE=chore with that scan as its acceptance check, not as a feature slot. Either way it should not drop for a third cycle.

**C5-36 (against, 2).** Signed-out viewers never see the nav's "My record" (`app/layout.tsx:50`), and its name is F-18's to settle with the owner (draft). "Note held", the duplicate "Record tools" and "if you publish" are one-line copy fixes. They belong in the fixes lane, and they need no feature file or vote.

**C5-41 (against, 2).** The briefed line, "every closed trade … nothing hidden by the trader", is the kind of completeness claim that misleads my persona (F3a). Exclusions exist and are counted. LC's reshaping ("closed trades imported from connected accounts … Traders can't remove single trades") is true. Swapping that copy is a re-sign in the fixes or legal lane, not a slot. Approve the reshaped wording as copy at most.

**C5-37 (against, 2).** LC is right that F-3's R8 keeps the disclaimer on /account (`docs/features/logs/F-3/committee-2026-11-01.md:41`). What is left is dropping the duplicate legal links, a one-line fix with no viewer gain. It is not worth a feature.

**C5-42 (against, 2).** Behavioural tests beat source-text assertions. But this is test work in M-sized slices, with no product decision and no viewer-visible effect. It belongs in the test lane, built one file at a time, with the test count never dropping. A feature slot adds nothing.

**C5-40 (against, 2).** This is an ops doc line and a coverage flag (`docs/SYNC.md:194-195`, `lib/sync-shard.ts:462`), and production is the owner's deploy setting anyway. F-31's limits block can carry the note (section 7 hand-off). It is chore-sized, with no viewer effect beyond speed.

**L-28 (for, 5): I withdraw my "for".** The chair and RT are right. `lib/trades.ts:48-53` (#89) already counts every later sell after an oversell, and the rename part is on main (`:53`). F-28's "later lots stay fresh" would publish figures #89 now counts (fixes-cycle-4 committee `:119-122`). From the viewer's side, re-approving it as written risks wrong Verified figures, the very thing I scored it to prevent. Its true-cause wording is on main too (`lib/copy.ts:73`). Let it lapse, with an owner note that OD 2.27 is overtaken by #89. Keep the open release question (vendor position evidence) with the owner.

**L-30 (for, 4).** I hold a narrow "for". With evidence, #89 counts every later sell, so most of F-30 is on main (RT). What remains matters to viewers: the readout's stamp-pattern class count shows the owner whether date-only stamps also arrive at local midnight, the case that still publishes phantom same-day trades. Re-approve only that residual, with the conditions "never loosens #89" and "intraday results identical". Broker-position evidence goes to the owner (protected `lib/broker.ts`). Otherwise let it lapse with L-28.

**Chair note 5 (C5-4 split), one argument.** Splitting it frees nothing visible. A viewer is misled by the printed "(+1.0% to +1.0%)" and "Past results: above zero", and both the spread floor (TR-9's interval, protected DESIGN) and "Too early to tell" (OD 2.32) are owner calls. The only part that needs no owner is not printing a zero-width range, and that is a truthful-label fix: route it to the fixes lane as "suppress a zero-width range, show no range" until 2.32 is answered. The rest stays one item, waiting on C5 Q3.

### BL (round 2)

#### Round 2: BL (business lead)

**C5-32 (for, 4).** The share pictures are the product's whole outbound channel (G2 and G3), and a picture is the one
object that leaves our domain without the record attached. Until each picture carries a check code, a forged "+300%"
card is indistinguishable from ours, and one forgery story costs more than the slot. CO is right on timing: it gates
outreach, not wave 0 (10-20 known adults). It can sit in the image slot after f16 and f25. LC's reshape resolves the
key: an owner-set env, or HKDF under a fixed label. EN cites precedent for the HKDF route at `lib/claims.ts:1`, `:50`.
/check claims only that the figures match the stored record.

**C5-43 (against, 2).** I don't dispute the work. I dispute the feature slot. Each part is a measured chore: (a)
`lib/record-status-load.ts:16`, (c) `lib/sitemaps.ts:70`, (d) `lib/sync.ts:207`. EN, RE and TE all say "chore batch,
no slot" too. My 2 is "not a feature". RE's case that (b) must precede any matcher bump is strong, so put (b) first in
the chore lane, ahead of the matcher slot. Scoring it 4-5 as a feature would spend one of six slots on work that needs
no feature file.

**MK-P3 (against, 2).** G2 is not yet proven on the first share surface, and this adds a second one. CO's veto stands
(both disclaimers can't be legible at bio size). LC's reshape strips the figures, and a figure-free image is just a
link button. Outreach also waits on OD 2.62. If it comes back, it rides C5-32's image slot and carries the check code.

**C5-34 (for, 4).** This is the cheapest direct lever on G2 (at least 60% of traders share their card). People share
what they've seen, and card quality was the BL's standing concern at sign-off. GR found a real defect that makes it
sharper. The post-connect prompt previews the opengraph card (`app/u/[handle]/share-prompt.tsx:39`), but Share sends
`/story?format=square` (`app/u/[handle]/share-card.tsx:15-16`). Today the trader previews one picture and posts
another. Condition: the preview is the exact image Share sends, and F-15 counts preview-shown against `share_action`
so G2 can read the effect. S, no OD.

**C5-35 (against, 3).** It's worth doing, but it moves no gate. The final wording waits on OD 2.9 ("permanently"), and
it rebases on f16/f17's `app/auth/actions.ts`. The danger style and the focus-on-confirmation parts overlap the fixes
lane's C5-26 (`app/settings/page.tsx:33-35`). Fold them into the fixes lane after f16/f17. The wording follows when the
owner answers 2.9.

**MK-P5 (against, 2).** It's a static article. No gate reading would detect it, and every sentence carries F1 risk (it
teaches reading records, never trading). It becomes useful only once outreach exists, which waits on OD 2.62 and the
Beta checklist (OD 2.1). It's cheap, but cheap isn't a reason to take one of six slots this cycle.

**C5-39 (against, 2).** It's already routed: cycle 4 sent C4-34(c) to the a11y fixes lane. It's a chore, not a feature.
Route it there with the F-25 link names.

**C5-36 (against, 2).** The nav part is the owner's call through F-18 (draft). What's left is three copy fixes
("Note held", the duplicate "Record tools", "if you publish"). They belong on the fixes list after f16/f17
(`app/layout.tsx:50`), not in a feature slot.

**C5-41 (against, 1).** It pitches a paid tier that stays off until the week-8 gates pass (OD 2.47). LC also finds F3a
completeness claims in the draft ("every closed trade", "nothing hidden"; `lib/copy.ts:833` today is plain mechanics).
Even reshaped, it earns nothing before billing exists. If it's done at all, it's a copy fix that LC re-signs.

**C5-37 (against, 1).** LC shows that removing the disclaimer conflicts with F-3's legal condition R8
(`docs/features/logs/F-3/committee-2026-11-01.md:41`). What remains is dropping a duplicate link set, which is
polish, not a feature.

**C5-42 (against, 2).** It's good hygiene with no business effect, and it's size M in slices. It belongs in the test
chore lane under the existing rule that the test count never drops.

**C5-40 (against, 2).** It's a docs line plus a coverage flag. Applying `jit = off` in production is the owner's
deploy setting. It's a chore that rebases on #84's `docs/SYNC.md`. No feature file is needed.

**L-28 (for, 5): I concede the chair's evidence.** My round-1 reason ("+28.6% published today") is false at e16d6aa.
#89 already counts every later sell after an oversell (`lib/trades.ts:48-53`), and the rename part is on main (`:53`).
F-28's k-unit rule would publish later lots again. The fixes-cycle-4 committee recorded +65%/+60%/+25%
(`docs/features/logs/fixes-cycle4/committee-2026-11-01.md:119-122`). The strongest case left for "for" is narrow:
re-approve no build, record that OD 2.27 is overtaken, and note the true-cause copy is already on main (`lib/copy.ts:73`).
Absent that, let it lapse with the owner note. I will lower my score in round 3.

**L-30 (for, 4).** The strong part is on main: with evidence, #89 counts every later sell. Two things remain. The first
is the counts-only readout class row (stamp pattern, suppressed under 5). It's cheap, and it tells the owner whether
date-only brokers exist in our supply before G1. The second is broker-position evidence, which needs the protected
`lib/broker.ts` and stored units, so that part is the owner's. Re-approve the readout row only, riding the matcher
slot (or F-31's readout). It must never loosen #89, and intraday results must stay identical.

**Chair note 7 (slots).** I back CO's cap of three active slots for a business reason. Before G1 no figure is read by
a real viewer, so throughput matters less than merge safety. The active slots should be matcher (C5-1 + C5-31),
pane/strip (C5-5 + L-21 + L-29) and sync (C5-30). C5-32 and C5-34 queue behind f16 and f25 anyway.

### UX (round 2)

#### Round 2: UX lead (debate statements)

**C5-5 (for, 5).** A shared trade link is the surface most viewers see first, and today it tells a different story from the card. The strip prints `"2 open, unrealized"` (`lib/copy.ts:174`, pushed at `lib/record-strip.ts:119`) beside a realized average in the gain colour. The card and pane print the unrealized figures. TR-4 is a Must ("as prominent as the headline … down color when negative", `docs/DESIGN.md:327`). The "per closed trade" wording costs nothing, and it is already a constant (`lib/copy.ts:172`). I accept TE's render-equality test in place of a text scan.

**C5-32 (against, 3).** The idea is right, but the timing would mislead people. Three MATCHER_VERSION bumps are queued: C5-1, C5-31, and possibly F-28/F-30. After each one, every honest older picture's /check would read "figures differ". Viewers would learn to distrust real pictures before outreach even starts. It also adds a code to all five image routes while f16/f25 are rewriting them (EN). Build it after the matcher slot settles, with copy that explains a matcher change in plain words.

**C5-34 (against, 3).** GR's finding narrows this to a fix, not a feature. The post-connect prompt already shows a preview, but of the opengraph card (`app/u/[handle]/share-prompt.tsx:38`), while Share sends `/story?format=square` (`:50`). The standing box shows none (`app/u/[handle]/share-card.tsx:15-16`). That makes it a small fixes-lane item: preview exactly the image the button sends, in both places. It needs no slot, but it waits on the f16/f23/f25 rebase of the profile page.

**C5-35 (for, 4).** Today the irreversible action looks routine. Step 1 uses `button wide` (`app/settings/page.tsx:45`), the same class as the Connect primary (`app/connect/portal-button.tsx:145`). The final button is a default primary button (`app/settings/page.tsx:35`). No danger token exists in `app/globals.css`. After deletion, `redirect('/')` (`app/auth/actions.ts:163`) drops the trader on the feed with no confirmation. RT's record-reset concern is OD 2.9's and is untouched here. Fold it with F5-23 after f16 if slots are short. The confirmation page is a new surface, so it needs a decision line.

**MK-P5 (against, 2).** /how already explains how to read this record. A general "how to read a trading claim" page carries F1 risk in every sentence and is useful only once outreach is approved. RT's caution also binds: while C5-1 and the oversell residual are live, the page cannot imply our records defeat these tricks without overclaiming (F3a). It is not worth a slot now. Revisit it as an outreach asset.

**C5-36 (for, 4).** VW is right that signed-out viewers never see the nav label, but traders do, and it shapes what they think is public. "Share my record" shares `/u/<handle>` (`app/u/[handle]/share-card.tsx:15`). The nav's "My record" (`app/layout.tsx:50`) opens a private, noindex page that is also titled "My record" (`app/me/record/page.tsx:16`, `:73`). Two different things share one name, and the difference is public versus private: a privacy-relevant mismatch. The copy lines can go to chores. The nav label should go to the owner now as a one-line F-18 question, not wait undated.

**C5-42 (against, 2).** I agree with RT on content: the first slices should be steering properties, for example "a transfer never improves an average". But this adds tests only, moves no Must, and fits the test chore lane exactly. It should not compete for one of six feature slots. I'd mark it ROUTE=chore with RT's first slices as its order.

**L-28 (against, 4 → arguing lower).** The chair's note holds on main. After an oversell, every later sell of the pair is already counted in `excluded`, and a rename carries the mark (`lib/trades.ts:48-53`). F-28's core decision ("taint the next k units, later lots stay fresh") would publish trades main now counts. That is a loosening, and the opposite of its own "counts more, never publishes more" rationale. Re-approving it as written would set a ready rule against POLICY F3c. Let it lapse, tell the owner that OD 2.27 is overtaken by #89, and keep the true-cause wording in the fixes lane.

**Chair note 7 (slots).** The pane/strip slot (C5-5 + L-21 + L-29) adds up to three muted lines under one headline in the 360 px pane: an open line, an exclusion line and the options qualifier. Each item's AC checks the disclaimer alone. I propose one shared AC for the slot: with all three lines present on a fictional record, the headline and disclaimer stay in view at 360 px and the layout reflows at 320 px. One builder owns the layout order.

### EN (round 2)

#### Round 2: EN (engineer)

**C5-32 (against, 3).** This is more work than "M" suggests, and it lands on files that are changing right now. Every picture route is rewritten on f16/f17 (all four opengraph-image.tsx files) and f25 (trade and month), so building now means a rebase across five routes. The as-of recompute also cannot reproduce old figures. closed_trades rows are not keyed by matcher version (`lib/matcher-rebuild.ts:13-14` ponytail), so after any bump in the matcher slot (C5-1, C5-31) every older code reads "differs". The key itself is fine: HKDF from APP_SECRET_KEY, as `lib/claims.ts:1,:50` already does. But rotating that key voids every printed code. Build it after f16/f25 merge and the matcher slot lands, close to outreach.

**C5-43 (for, 4).** Part (b) is a prerequisite, not polish. Three items on this ballot bump MATCHER_VERSION (C5-1, C5-31, L-28/L-30). Today, records left over when the time budget runs out wait for the next deploy (`lib/matcher-rebuild.ts:10-11`, budget `:18`), so superseded Verified figures stay up. That is exactly the "wrong Verified figure" priority. Part (a) is a measured 531 ms on every feed page (`lib/record-status-load.ts:15-16` ponytail). No in-flight branch touches matcher-rebuild.ts, sitemaps.ts or sync-shard.ts. Run it as a chore batch with no slot, (b) first, landing before the first matcher bump.

**C5-34 (against, 3).** Most of this already exists. The post-connect prompt already previews the card (`app/u/[handle]/share-prompt.tsx:38`, eager, with an error fallback). The real defect is the mismatch GR found: the preview is the opengraph card, but Share sends `/story?format=square` (`share-prompt.tsx:50`, `share-card.tsx:16`). Fixing it means making the preview's `src` equal the image Share sends, and lazy-loading it in the Share box. That is fixes-lane size, not a feature slot. It also adds a rebase on `app/u/[handle]/page.tsx`, which f16, f23 and f25 all edit.

**C5-36 (against, 2).** The half that matters, the nav name, belongs to the owner through F-18. The rest is three copy lines, and one of them may be wrong. PR shows that the "if you publish" text (`lib/copy.ts:932`) already renders only when it applies (`app/settings/page.tsx:44`), so dropping it could remove a true case. The "Thesis held" (`lib/report-copy.ts:37`) and duplicate "Record tools" (`app/settings/page.tsx:28-29`) lines are chores. `app/layout.tsx` is edited on f16. Route the copy lines as a chore after f16; no feature slot.

**C5-40 (for, 3).** It is cheap and fills a real gap. Neither docs/SYNC.md nor lib/sync-shard.ts mentions JIT at all (grep: no hits; the only "jitter" hits are timing spreads, e.g. `lib/sync-shard.ts:25`). Meanwhile F-31's readout found its rollup read 85% JIT on a default server. A doc line plus a flag in `coverage()` (`lib/sync-shard.ts:462`) is under a day and needs no product decision. Applying it in production stays the owner's deploy setting. Route it as a chore after #84, which edits docs/SYNC.md.

**L-28 (against, 4; I lower in round 3).** I checked the chair's note in the code. Main is already stricter than F-28. After an oversell, every later sell of the pair is counted, never priced, and a rename moves the mark (`lib/trades.ts:48-53`). The fixes-cycle-4 committee recorded that F-28's k-unit rule published wrong figures (+65%, +60%, +25%) and that "F-28's build should start from this rule" (`docs/features/logs/fixes-cycle4/committee-2026-11-01.md:119-122`). Building F-28 as written would loosen #89. The real residual is clearing the mark from a vendor position read with units (`lib/trades.ts:54-56` ponytail). That needs the protected `lib/broker.ts` and stored units, so it belongs to the owner. Let L-28 lapse with that owner note.

**Chair note 7 (slots).** C5-43(b) has to land before the matcher slot ships its MATCHER_VERSION bump, otherwise each bump leaves old figures up until the next deploy (`lib/matcher-rebuild.ts:10-11`). With L-28 lapsing, the matcher slot is C5-1 + C5-31 (+ L-30's residual), with a single bump.

### TE (round 2)

#### Round 2: TE (tester)

**C5-43 (for, 4).** Part (b) is a dependency of this cycle's leading items, not just scale work. C5-1 and C5-31 each bump `MATCHER_VERSION` (`lib/trades.ts:79`). Today `rebuildAllForMatcher` drains on deploy within a budget (`lib/matcher-rebuild.ts:18`), so superseded Verified figures stay up between deploys. Part (d) fixes the freeze mark, which uses the app clock (`lib/sync.ts:207-208`). Both have deterministic tests: a fake shard budget, and a 2 h clock skew. I agree with routing it as a chore. My condition: (b) lands before the first matcher bump, and the timing ACs for (a) and (c) live in LOAD tests so the unit gate doesn't flake.

**C5-39 (for, 4).** About 93 lines in `app/**/*.tsx` contain a bare ← or → outside `aria-hidden`; 5 are already wrapped (grep). So this is a pattern, not a one-off. An accessibility-tree scan is a behaviour test: it catches the next arrow added anywhere, which a code review would miss. I agree it goes to the chore lane with C4-34(c). My score is for one shared arrow component plus one tree-scan test, signed in and signed out, built after f25 renames the links.

**C5-36 (for, 3).** The copy parts are real: "Record tools" appears twice in a row (`app/settings/page.tsx:28-29`), and "My record" opens a private page (`app/layout.tsx:50`). There is a regression trap, though. "Thesis held" is pinned by existing tests: `lib/report-copy.test.ts:10` and `lib/f26-held-like-none.test.ts:99`, which records a DS ruling that the line "always begins with 'Thesis'". Renaming it to "Note held" rewrites a pinned assertion and reverses that ruling. It needs a design-system sign-off and twin expectations, never deleted tests. The nav part waits on F-18. Chore lane.

**C5-42 (for, 4).** 165 test files read source text with `readFileSync`. A text check passes while the behaviour breaks. Two real race windows exist: `lib/connections.test.ts:1462` (a 2 s `Promise.race`) and `lib/connections.hardening.test.ts:147` (5 s). Those flake under CI load. Adding an event-ordering assertion beside each removes the flake without deleting anything. This is the only item on the ballot whose regression risk is negative. Chore lane in slices. RT and PR name the right first slices: the matcher steering properties and the privacy leak paths.

**Chair note 6 (chore routing), evidence.** Routing to chores must still carry the testable ACs, or chores land untested. The guard (`scripts/autopilot.ts:206`) checks only that the test count does not drop, not that new tests exist. So each routed chore (C5-39, C5-42, C5-43) should list its named test in the fixes-lane entry.

### RT (round 2)

#### Round 2: RT (record-trust red team)

**L-28 (against, 0).** Every ballot that scores L-28 4 or 5 cites "+28.6% published today", and that is false on
main. Running F-28's own probe against main's matcher (rt/p1.ts) publishes nothing: excluded 2. The reason is #89's
blanket gap (`lib/trades.ts:48-53`). F-28's rule is "taint the next k units, later lots fresh". It loosens main and
publishes +65% where the true figure is +10% (`docs/features/logs/fixes-cycle4/committee-2026-11-01.md:20-22`,
`:119-122`). It is not a harmless re-approval while blocked: if the owner says yes to OD 2.27, the feature regresses
main. Let it lapse, with an owner note that #89 has overtaken 2.27.

**L-30 (against, 2).** The "+7.1% same-day short" that ballots cite publishes only when the pair shows no evidence of
a short. F-30 accepts that residual itself (F-30 decision 1; the ponytail in `lib/trades.ts` `replay`). The
evidence part is already on main: after an earlier oversell, the same short is counted (rt/p1.ts: excluded 2;
`lib/trades.ts:65-69`). Two things remain. Broker-position evidence needs protected `lib/broker.ts` and stored units,
which are owner items. The readout's stamp-pattern count is a readout chore. Re-approving the whole file would
rebuild what #89 already does, and its "intraday unchanged" clause could freeze the wrong baseline. Re-approve only
that residual, or route it.

**C5-35 (against, 2).** The flow is honest and small, but it changes no figure, and its key words wait on OD 2.9. The
risk on my lens is the confirmation page. A deleted profile's accounts re-attach to a new profile with the full
history (ux-15; `lib/claims.ts:25`). A page saying "your profile is deleted" without saying that a reconnect brings
back the same trades, losses included, frames deletion as a clean slate. That is a record-reset path. It is
fixes-lane size; I'd fold it into F5-23 after f16/f17.

**Chair note 5 (C5-4 split).** A partial fix is weaker than CO's split assumes. "Too early to tell" for a zero-width
range does nothing against near-identical returns. Ten closes at +1% ±0.01 pt still weigh 0.296 and still print
"+1.0% to +1.0%" (rt/p2.ts; `lib/bets.ts:47`, `lib/trades.ts:572`). The spread floor in the error term is the part
that closes the path. That changes TR-9's interval, so it waits on C5 Q3 either way. Splitting frees only wording that
OD 2.32 owns.

### LC (round 2)

#### Round 2: LC (legal committee)

#### C5-35 (for, 4)

Deletion is the right that P6 guarantees, and today it reads as routine:
- The final button is the same plain `button wide` used elsewhere (`app/settings/page.tsx:35`).
- The confirm step shows only `SETTINGS.confirm` (`:34`), not the removal list.
- `deleteProfile` drops the trader on `/` with no confirmation (`app/auth/actions.ts:163`).

Informed consent to an irreversible act is a consumer-protection matter, not polish. The OD 2.9 dependency touches one word only: "permanently" stays out. The rest needs no owner. Answer to the risk RE raised: the confirmation page must say that vendor-side removal can finish later (C5-16, `:156-157`). It must be static, with no handle in the URL.

#### Chair note 5 (C5-4 split), evidence from the POLICY side

A zero-width range plus "Past results: above zero" states certainty from ten trades. That is a misleading performance statement (F2's spirit; F3b, no forecasts). It is a truthful-label defect, not a design change. When the half-width is 0, the fixes lane can suppress `trustSign` (`lib/confidence.ts:36-40`) and print the existing `early: 'Too early to tell'` (`lib/copy.ts:225`). That adds no new wording and leaves the TR-9 interval as it is.

Two parts still wait on C5 Q3, as the chair says: the spread floor (which changes the printed interval) and replacing `RANK_MIN_BETS` (`lib/confidence.ts:17`). So split it: the label goes to the fixes lane now, and the ranking part waits on Q3.

### PR (round 2)

#### Round 2: PR (privacy), speaker items and one chair-note argument

**MK-P3 (for, 3).** No one else has made this privacy case. A live image honours deletion and a screenshot never does. Today bios carry static screenshots, which outlive a deleted profile forever. A served record image goes blank the moment the trader deletes (the brief's AC), so P6's "delete the whole profile" covers it in practice. It publishes only fields already in the consent line (`lib/copy.ts:88`). The current `via` rollup stores no viewer identity (`lib/views.ts:91-95`). My 3 means later, reshaped:
- the LC/CO figure-free or legibility-tested form;
- after C5-32;
- no per-load logging of the IP or referrer;
- outreach waits on OD 2.62.

**C5-39 (against, 2).** My 2 is about where it goes, not whether it's right: the screen-reader noise is real. Cycle 4 already sent C4-34(c), the same glyph class, to the a11y fixes lane. Most round-1 ballots say chore. A feature file and a build slot would spend one of six slots on `aria-hidden` spans, and F-25 is rewriting the same link names. Route it as a chore after F-25, with one shared arrow component and the accessibility-tree scan (TE's test). I would mark it ROUTE=chore in round 3, not reject it.

**Chair note 4/7 (C5-32 key), evidence.** An HKDF subkey of APP_SECRET_KEY under its own label is already the repo's pattern. `lib/claims.ts:51-52` and `:65` (`hkdfSync('sha256', secret, '', IDENTITY_LABEL, 32)`) note that rotating the key orphans the hashes. So C5-32 needs no new env and is not a deploy setting for the owner. This is domain-separated, not raw reuse, so it falls outside C5-18's class. Condition: a fixed purpose label (`stock-social/share-check/v1`). The code and key never reach a log. A rotation voids old codes, and /check then says "can't be checked", never "forged".

### A11Y (round 2)

#### Round 2: A11Y (accessibility specialist)

**C5-37 (speaking for, 3).** There is a narrower accessibility case. /account renders the Record tools `Disclaimer` (`app/account/page.tsx:32`; `app/tools/parts.tsx:11-21`): a bold, boxed sentence plus `<nav aria-label="Legal">` (`parts.tsx:14`). The site footer has a second `nav aria-label="Legal"` (`app/layout.tsx:60`). So a screen-reader landmark list shows two identical "Legal" navigations, and keyboard users tab through three duplicate links before reaching the plan and the Cancel controls. Reshape to fit LC's R8 (`F-3/committee:41`): keep the sentence and the links (muted, not bold), drop the second landmark; a chore.

### GR (round 2)

#### Round 2: GR (growth) arguments

**MK-P3 (for, 4).** I accept CO's and LC's objection: a picture of figures cannot fit both disclaimer sentences at bio
size. The fix is CO's own lifting reshape. A figure-free record image shows the handle, the trust state in words
("Verified", "Demo" or "Frozen") and "See full record". It shows no figure, so F3's disclaimer is not triggered. It is
not award-styled (F6). It never goes stale. It is cacheable per handle; RE notes the card sets no cache directive
(`app/u/[handle]/opengraph-image.tsx:15-20`), so this image needs an explicit s-maxage. It stores nothing per load
(PR), uses `via=badge`, rides C5-32's image slot and waits on OD 2.62 for outreach.

**C5-34 (for, 5).** Every share leaves from this box, and today it renders no image (`app/u/[handle]/share-card.tsx:9-25`).
The one-time prompt shows a preview (`share-prompt.tsx:39-40`), but every later share goes out unseen. That is the G2
loop, at size S, with no OD and no vendor. TE's test resolves the "which image" question: the preview `src` equals
the URL the Share button attaches (`share-card.tsx:15-16`, the square card, which is "the same card at its own size"
per `opengraph-image.tsx:2-3`). BL's condition is a counts-only F-15 event "preview shown", so G2 can read the
effect. EN's rebase concern does not apply, because `share-card.tsx` is its own file.

**MK-P5 (for, 4).** MK-3 says "verified" is now free at scale through a chosen-posts feed. Our answer cannot be a
claim. It has to teach readers to ask what any record leaves out: chosen trades, survivorship, small samples and open
positions. A static page does that by pull (F3b), without naming anyone (T1-T4), and gives outreach a link that is
not a sales pitch. The objections ("near F1", "drift from /how") become conditions. It pulls the definitions from the
same `lib/copy.ts` constants that /how imports (`app/how/page.tsx:5`). It uses Demo examples only, and the legal
committee reads it. It is size S in a new folder, so it touches no other slot.

**C5-39 (against, 2).** I am against it as a feature slot, not against the fix. The fix is right, and I support it
landing this cycle. Cycle 4 already routed C4-34(c) to the a11y chore lane. F-25 is rewriting the same link names,
so a feature file would duplicate its work and spend one of six slots on an `aria-hidden` wrap. I propose ROUTE=chore
with one shared arrow component and an accessibility-tree scan, after F-25 merges.

**C5-41 (for, 3).** The paying viewer's job is choosing whose record to read. Today's pitch only lists mechanics
(`lib/copy.ts:833`, shown at `app/tools/page.tsx:73`). I accept LC's reshape word for word, because it drops the
completeness claims ("every", "nothing hidden") that RT and TR showed are false while C5-1 is live. That makes it a
one-constant copy change plus the legal re-sign. It belongs in the fixes or copy lane, not a feature slot, and that is
why I hold it at 3.

**Chair note 7 (slots).** If MK-P3 is reshaped figure-free, it shares the image routes and `lib/referral.ts` with
C5-32. That keeps the image slot as one slot, and each new surface gets its own `via` code (`check`, `badge`), so the
week-8 reading can tell them apart.

### MA (round 2)

#### Round 2: MA (market analyst)

**MK-P5 (for, 4).** Since a large broker's free in-app feed made "verified" generic (cycle5 4.2, MK-3), the label no longer sets us apart. What still does is the whole record, and readers only value that once they know what a feed of hand-picked posts leaves out. Our first contact still leads with the label (`lib/copy.ts:444`). Regulators already warn readers about screenshot claims (market-cycle2:2083-2094), and this page carries that warning without naming anyone (T1-T4). Size S, a new folder, no shared files. The objection that it overlaps /how is fixed by TE's condition: use the same `lib/copy.ts` constants. Add RT's: never claim our record defeats every trick.

**C5-41 (for, 3).** I accept LC's and RT's objection. My draft wording ("every closed trade", "nothing hidden") breaks F3a, and C5-1 shows it is false today. The case for the item still stands. The only plausible buyer is the person choosing whom to follow (market-2026-11-01.md:186-189), and the current pitch (`lib/copy.ts:833`) describes how the tool works, not what that buyer gets from it. Use LC's reshaped line, signed in the PR. It is a single constant with no figures and no slot cost, so it should ride the copy or chore lane and not take a feature slot. A 3 means "do it cheaply", not "spend a slot on it".

**Chair note 7 (slots).** Market-side evidence for which slots to fill: the only differentiator left is that the trader can't edit the record (market-2026-11-01.md:101-103). So build slots should go first to the items that stop a record being steered or overstated: matcher C5-1, C5-31, C5-30, then image C5-32. MK-P5 and C5-41 change copy or add a static page with no shared files, so they can ride outside the cap. Paid-tier work (MK-P4) should wait: there is no willingness-to-pay data (market-2026-11-01.md:590).

### DS (round 2)

#### Round 2: DS

**C5-37 (for, 3).** As briefed it conflicts with F-3's legal condition R8: the account page carries the disclaimer "with links to Terms, Privacy and How records are calculated" (`docs/features/logs/F-3/committee-2026-11-01.md:41`). So the defensible version keeps both the sentence and the links. What remains is a design-system point: `/account` (`app/account/page.tsx:32`) uses the bold boxed `Disclaimer` (`app/tools/parts.tsx:11-19`, `<b>` inside `.rt-disclaimer`) built for pages that show figures. Fix: add a `muted` variant to that one component, used only where no figure renders. No removal, no second producer. Worth a chore at most, not a slot.

**Chair note 6 (C5-33 routing).** C5-33 is not a pure chore. The glyph comes from the shared `Badge` text "✓ Verified" (`app/ui.tsx:29`), the producer for every surface. Taking it out of the `/t` heading alone is easy. Removing it everywhere is F-18's decision (bare word, design-system ruling 1). Route: build C5-33 as F-18's first slice in the same slot, with VW's condition that a demo-only stock page keeps a visible Demo label.

### RE (round 2)

#### Round 2: RE (reliability engineer)

**C5-43 (for, 5).** Every matcher item on this ballot (C5-1, C5-31, any F-28/F-30 residual) bumps `MATCHER_VERSION` (`lib/trades.ts:79`). Today a bump is drained only at deploy, under a 600 s budget. Leftovers, frozen records included, wait for the next deploy (`lib/matcher-rebuild.ts:12-13`, `:18`, `:29`). A failure's cause is swallowed (`:38`), so the version can stay open with no reason logged. Part (b) is how a fix actually reaches every record. Scale is beside the point. Score it as a prerequisite for the matcher slot, routed as a chore, with (b) landing first.

**C5-42 (for, 4).** The race tests use wall-clock deadlines as their oracle: `lib/connections.hardening.test.ts:147` (5 s reject) and `lib/connections.test.ts:1454` (2 s `Promise.race`). On a loaded CI runner a correct build can miss those deadlines. Then retries hide real regressions, or an agent "fixes" a test by loosening it. Ordering assertions alongside them remove the flake without deleting anything. The test count only rises. It also catches matcher regressions that text scans miss (RT, TE). This is chore work in slices and needs no slot. It protects every other build this cycle.

**C5-40 (for, 4).** This costs almost nothing. `coverage()` already reads `pg_settings` for `statement_timeout`, `idle_in_transaction_session_timeout` and `max_connections` and runs `dbConfigCheck` on them (`lib/sync-shard.ts:461-467`). Adding `jit` is one name in that list plus one check line. The `docs/SYNC.md:190-196` block already shows role-level `alter role` lines, so `jit = off` is one more line there. Measured: JIT is 485 of 570 ms in the readout rollup. The production setting stays the owner's. Route it as a chore after #84, not a slot. I accept a 2-3 score as "not a feature".

**Chair note 1 (L-28), from my lens.** I confirm main is stricter: after an oversell, every later sell of the pair is counted (`lib/trades.ts:48-53`). Re-approving F-28's "next k units only, later lots fresh" would loosen that. It would cost a second matcher bump and a full rebuild sweep that turns closes counted today back into published ones. At scale each sweep leaves mixed-version figures up for about 3 deploys. Let L-28 lapse with an owner note that OD 2.27 is overtaken by #89. Keep only the cover-flag wording residual, which must never loosen #89.

### CO (round 2)

#### Round 2: CO (contrarian / common sense)

**C5-5 (against, 3).** I agree the two stories are wrong. My point is that the helper is not free of OD 2.25. Under "yes" every surface prints 2.25's line, so the helper *is* 2.25's build. Under "no" it adds unrealized values to three public images. Built now, it gets rebuilt once the owner answers, on files that f16/f17, f25 and F-23 are rewriting. What can go now with no regret is the copy: the strip prints `SHARE_CARD.perTrade` "average per trade" (`lib/record-strip.ts:108`, `lib/copy.ts:166`) where the card says "per closed trade" (`:172`). That's a fixes-lane edit. Approve the rest as "waits on OD 2.25", in L-21's slot.

**C5-32 (against, 2).** The key objection is gone: HKDF under its own label already has precedent (`lib/claims.ts:1`, `:48-50`). The proportion objection stands. The common forgery is a picture with no code, or with the code cropped off, and /check catches neither. It catches only a pasted real code, and only if a viewer types it in. For that we get size M: new crypto, as-of recompute, a new signed-out page, and edits to all five image routes that f16/f25 are rewriting now. On top of that, DS says the image bands are already at budget. No real picture exists yet. Approve for the cycle before outreach, after f16/f25 merge, and not as a slot now.

**MK-P3 (against, 1; veto held).** Three other lenses add to my legibility veto. LC says "badge" breaks F6, and both disclaimers must be legible or there are no figures at all. PR says a hot-linked image turns every forum page view into a request to us carrying that viewer's IP and referrer. RE notes the card it copies renders per request with no cache directive (`app/u/[handle]/opengraph-image.tsx:15-20`). Even GR asks to rename it. The veto lifts on the shape LC and I share: a figure-free "record image" (handle, trust state, "see full record"), no per-load logging, cached, and deferred to OD 2.62.

**MK-P5 (against, 2).** It's honest, but it isn't needed. DS names the real cost: a second explainer that drifts from /how, which already defines Verified, ranges and open positions. It is outreach content, and outreach is gated (OD 2.62, MRC2-4). RT's own condition shows the trap: a page that teaches "survivorship" and "who connects and when" while C5-10 and C5-1 are unbuilt invites readers to apply the test to us, and we fail it today. Better as /how sections later, built from the same `lib/copy.ts` constants.

**Chair note 5 (C5-4 split): I concede.** The spread is TR-9 step 2's own formula, `SEₘ = √(K/(K−1)·Σ…)/n` in protected DESIGN (`docs/DESIGN.md:347-349`), so a floor on it amends DESIGN. "Too early to tell" is OD 2.32's wording. So the split frees nothing. Approve all of C5-4 as "approved, waits on C5 Q3 and OD 2.32", and ask the owner to answer both in the same sitting.

## Round 3: revised ballots

### TR (round 3)

#### Round 3: TR (trader). Revised ballot

| Item | R1 | R3 | Changed because |
|---|---|---|---|
| C5-1 | 5 | 5 | Unchanged. All 15 r2 files agree. Matcher slot, interim "transfer" line after #84, one MATCHER_VERSION bump, and C5-43(b) lands first (RE, EN chair note 7). |
| C5-4 | 4 | 4 | Unchanged score, narrower shape. LC (chair note 5): when the half-width is 0, the fixes lane suppresses `trustSign` and prints the existing "Too early to tell". RT and VW: the spread floor is the part that closes the path, and it waits on C5 Q3. So approve it as "waits on C5 Q3 (and OD 2.32)". |
| C5-5 | 4 | 4 | Unchanged. CO C5-5: the "per closed trade" copy goes to the fixes lane now, and the helper waits on OD 2.25 in L-21's slot. TE's render-equality test replaces the text scan. Add UX's shared slot AC: open, exclusion and options lines together, with the headline and disclaimer in view at 360 px. |
| C5-10 | 4 | 4 | Unchanged. Waits on OD 2.7, which must name the first-connection date (PR chair note 8, LC). |
| C5-32 | 4 | 4 | Unchanged score, timing condition added. EN and UX C5-32: build after f16/f25 merge and after the matcher slot's bump, or every honest older picture reads "differs". /check explains a calculation update in plain words and never says "forged". PR: HKDF key under a fixed label, so it needs no new env. |
| C5-30 | 3 | 3 | Unchanged. C5-43(d) can ride it (VW). |
| C5-31 | 4 | 4 | Unchanged. Waits on C5 Q1. Shares the single bump with C5-1. |
| MK-P6 | 4 | 3 | Chair note 3 and EN: the vendor client exposes no earliest-history date (`lib/broker.ts:89-94`), so by its own fallback it shrinks to one /how sentence. That is part of F5-6 and fixes-lane size. Still wanted, but not as a slot. |
| C5-43 | 3 | 4 | RE, EN, TE C5-43: part (b) is a prerequisite. Every matcher bump on this ballot leaves superseded Verified figures up until the next deploy (`lib/matcher-rebuild.ts:10-18`). (b) lands before the first bump. As a chore, not a slot. |
| MK-P3 | 3 | 2 | CO (veto held), VW, BL MK-P3: figures plus both disclaimers can't be legible at bio size. The figure-free reshape is close to a link button. Later, after C5-32, with no per-load logging (PR) and outreach waiting on OD 2.62. |
| C5-34 | 5 | 4 | EN, UX, VW C5-34: the post-connect prompt already previews (`app/u/[handle]/share-prompt.tsx:38`). The real defect is that the preview shows the opengraph card while Share sends `/story?format=square` (`app/u/[handle]/share-card.tsx:16`). GR: the standing Share box shows no image at all. Fixes-lane size. It still matters most to traders, so it should land this cycle. AC: in both places, the preview `src` equals the image Share sends. |
| C5-35 | 4 | 4 | Unchanged score, new condition from RT C5-35. The confirmation page must say that reconnecting the same broker accounts brings back the same trades, losses included, so deletion is never framed as a clean slate. LC: vendor-side removal may finish later, and the page is static with no handle in the URL. |
| MK-P5 | 3 | 2 | CO and UX MK-P5: a page that teaches survivorship and chosen trades, while C5-1 and C5-10 are unbuilt, invites readers to apply the test to us and overclaims (F3a). It also drifts from /how. Revisit as an outreach asset built from the `lib/copy.ts` constants. |
| C5-33 | 3 | 3 | Unchanged. DS: build it as F-18's first slice. VW: a demo-only stock page keeps a visible Demo label. |
| C5-39 | 3 | 3 | Unchanged score. Routed to chore (GR, PR, VW, TE): one shared arrow component and an accessibility-tree scan after F-25. |
| C5-36 | 3 | 3 | Unchanged score. Routed to chore. TE C5-36: "Thesis held" is pinned by tests and a DS ruling, so renaming it needs a DS sign-off and twin expectations. EN: "if you publish" already renders only when it is true, so leave it. UX: put the nav-name question to the owner now as a one-line F-18 question. |
| C5-41 | 2 | 2 | Unchanged. Use LC's reshaped line only, as a copy fix with LC's re-sign (MA, GR, VW). |
| C5-38 | 2 | 2 | Unchanged. Chore. |
| C5-37 | 2 | 2 | Unchanged. A11Y and DS: keep the sentence, muted, and the links, and drop the duplicate "Legal" landmark (R8). Chore. |
| C5-42 | 3 | 3 | Unchanged. Chore lane in slices, first slices from RT and RE (steering properties, race-test ordering assertions). TE: each chore names its test. |
| C5-40 | 2 | 2 | Unchanged. Chore after #84. The production setting is the owner's. |
| MK-P4 | 2 | 2 | Unchanged. Blocked per LC chair note 4 and OD 2.47. |
| L-28 | 5 | 0 | Chair note 1, RT, EN, RE, UX, VW L-28, and my own run of rt/p1.ts on main. F-28's probe already gives `excl: 2`, nothing published (`lib/trades.ts:48-53`, #89). F-28's "later lots fresh" would loosen main and publish wrong figures (fixes-cycle-4 committee `:119-122`). Let it lapse, with an owner note that OD 2.27 is overtaken by #89. The trader-fairness residual (the mark never clears, `lib/trades.ts:54-57`) goes to the owner as vendor-position evidence. |
| L-30 | 4 | 2 | RT L-30 and my run of rt/p1.ts: with evidence, main already counts (`excl: 2`). Only the readout stamp-pattern count (BL, VW) and broker-position evidence (owner, protected `lib/broker.ts`) remain. If re-approved, only that residual: it never loosens #89, and intraday results stay identical. |
| L-29 | 5 | 5 | Unchanged. Ready, and the legal words are step one. Plus UX's shared pane AC. |
| L-21 | 4 | 4 | Unchanged. TE: the guard lists in-memory `excluded*` keys (#84's `excludedHeld`). PR: OD 2.7's consent version names the public exclusion counts. Plus UX's shared pane AC. |

ROUTE: C5-43=chore, C5-39=chore, C5-36=chore, C5-38=chore, C5-37=chore, C5-42=chore, C5-40=chore, C5-34=fixes,
MK-P6=fixes, C5-41=fixes.

### VW (round 3)

#### Round 3: VW (viewer lens) revised ballot

| Item | R1 | R3 | Changed because |
|---|---|---|---|
| C5-1 | 5 | 5 | Unchanged. Add PR note 8: OD 2.7's consent version names the public exclusion counts. |
| C5-4 | 4 | 4 | Unchanged as one item waiting on C5 Q3 + OD 2.32. RT (note 5) shows the spread floor is the part that closes the path, so splitting frees little. I accept LC's (note 5) narrow fixes-lane step: drop `trustSign` and print the existing "Too early to tell" when half-width is 0. |
| C5-5 | 4 | 4 | Unchanged. Add CO (C5-5): "per closed trade" goes to the fixes lane now. Add UX (note 7): one shared AC for the slot, with all three muted lines present, headline and disclaimer in view at 360 px. Add TE: a render-equality test. |
| C5-10 | 4 | 4 | Unchanged; approved, waits on OD 2.7, and on LC/PR: forward figures only under a consent version naming the connection date. |
| C5-32 | 4 | 3 | UX (C5-32) and EN (C5-32): after each queued MATCHER_VERSION bump, every honest older picture would read "differs". Viewers would learn to distrust real pictures. Build after the matcher slot settles and f16/f25 merge, close to outreach. Key per PR/EN: HKDF purpose label. |
| C5-30 | 4 | 4 | Unchanged. |
| C5-31 | 4 | 4 | Unchanged (waits on C5 Q1). |
| MK-P6 | 4 | 3 | Chair note 3 / EN: the vendor client exposes no earliest-history date (`lib/broker.ts:89-94`), so by its own fallback it is one /how sentence in F5-6. ROUTE=fixes. |
| C5-43 | 3 | 4 | RE, EN, TE (C5-43): part (b) has to land before any MATCHER_VERSION bump, or superseded Verified figures stay up between deploys (`lib/matcher-rebuild.ts:10-18`). That is my priority class. ROUTE=chore, (b) first. |
| MK-P3 | 2 | 2 | Unchanged; CO veto shape (figure-free record image) accepted; later cycle, after C5-32, OD 2.62. |
| C5-34 | 3 | 3 | EN/UX (C5-34): the real defect is the preview/send mismatch (`share-prompt.tsx:38` vs `share-card.tsx:16`). ROUTE=fixes, with the preview `src` equal to the image Share sends. |
| C5-35 | 3 | 3 | Unchanged score. RT's (C5-35) condition added: the confirmation must not frame deletion as a clean slate, and must say a reconnect brings back the same trades, losses included. Fold with F5-23 after f16/f17 if slots are short. |
| MK-P5 | 3 | 2 | CO, UX, RT (MK-P5): a page teaching "who connects and when" while C5-1/C5-10 are unbuilt invites the test we fail today. It also drifts from /how and is outreach-gated. Later, as /how sections from the same constants. |
| C5-33 | 4 | 4 | Unchanged. DS (note 6): build as F-18's first slice; Demo label stays visible on a demo-only stock page. |
| C5-39 | 3 | 3 | ROUTE=chore (GR, PR, TE): one shared arrow component and an accessibility-tree scan, after F-25. |
| C5-36 | 2 | 2 | ROUTE=chore for the copy lines. TE: "Thesis held" is pinned (`lib/report-copy.test.ts:10`), so it needs a DS sign-off and twin expectations. EN: "if you publish" may be true where shown. UX: nav label to the owner as an F-18 question. |
| C5-41 | 2 | 2 | ROUTE=fixes with LC's reshaped wording only, re-signed by LC. |
| C5-38 | 3 | 3 | ROUTE=chore. |
| C5-37 | 2 | 2 | ROUTE=chore: keep the sentence (LC/DS, R8); a muted variant (DS); drop the duplicate "Legal" landmark (A11Y). |
| C5-42 | 2 | 3 | RE/TE (C5-42): the wall-clock race tests (`lib/connections.hardening.test.ts:147`) flake under load and invite loosening. Add-only. ROUTE=chore, with matcher steering properties as the first slice. |
| C5-40 | 2 | 2 | ROUTE=chore (RE: one name in `coverage()`'s list); production setting is the owner's. |
| MK-P4 | 1 | 1 | Unchanged. |
| L-28 | 5 | 0 | Chair note 1, RT, EN, UX, TR (L-28), and my own r2: #89 already counts every later sell (`lib/trades.ts:48-53`). F-28 as written would loosen main and publish wrong Verified figures. Let it lapse, with an owner note that OD 2.27 is overtaken by #89. |
| L-30 | 4 | 2 | RT and TR (L-30): the evidence part is on main. The residual is broker-position evidence (owner: protected `lib/broker.ts`) plus a readout class count (chore). Re-approve only that residual, never loosening #89, or let it lapse. |
| L-29 | 5 | 5 | Unchanged; UX slot AC (note 7) applies. |
| L-21 | 5 | 5 | Unchanged. Add TE: the guard lists in-memory `MatchResult` `excluded*` keys (for example #84's `excludedHeld`). UX slot AC applies. |

### BL (round 3)

#### Round 3: BL (business lead), revised ballot

| Item | R1 | R3 | Changed because |
|---|---|---|---|
| C5-1 | 5 | 5 | Unchanged. Added EN/RE/TE's sequencing condition: C5-43(b) lands before the matcher slot's single MATCHER_VERSION bump. The interim transfer counter joins L-21's sum (TE: the guard lists in-memory `excluded*` keys). PR: OD 2.7's consent version should name the public exclusion counts. |
| C5-4 | 4 | 4 | Unchanged score. CO, RT and VW (chair note 5) convinced me the split frees nothing from the owner: the spread floor is TR-9's protected interval and the wording is OD 2.32's. Approve whole as "waits on C5 Q3 + OD 2.32", one sitting. LC/VW: suppressing the zero-width range and `trustSign` (`lib/confidence.ts:36-40`) goes to the fixes lane now, using the existing `early` string (`lib/copy.ts:225`). |
| C5-5 | 4 | 4 | Unchanged score; CO (C5-5) changes the shape. The helper is OD 2.25's build, so approve it as "waits on OD 2.25". "per closed trade" (`lib/record-strip.ts:108`, `lib/copy.ts:166` vs `:172`) goes to the fixes lane now. TE's render-equality test replaces the text scan. UX's shared 360 px AC covers the pane/strip slot (C5-5 + L-21 + L-29). |
| C5-10 | 3 | 3 | Unchanged. LC/PR: forward figures only under a consent version that names the first-connection date (OD 2.7). Next cycle. |
| C5-32 | 4 | 4 | Unchanged score; sequence changed. UX/EN (C5-32) show every matcher bump makes honest older codes read "differs". So it builds after f16/f25 merge and after the matcher slot settles, before outreach, and is not an active slot now. CO's proportion point is accepted on timing. Key: HKDF under a fixed purpose label (PR/EN, `lib/claims.ts:50-52`). A rotation reads "can't be checked", never "forged" (LC). |
| C5-30 | 4 | 4 | Unchanged. C5-43(d) rides in the same `lib/sync.ts` slot (VW). After #84. |
| C5-31 | 4 | 4 | Unchanged. "Waits on C5 Q1"; it shares the matcher slot's single bump. |
| MK-P6 | 3 | 2 | Chair note 3 / EN: the vendor client exposes no earliest-history date (`lib/broker.ts:89-94`), so the item falls back to one /how sentence. That is fixes-lane work and part of F5-6. |
| C5-43 | 2 | 4 | EN, RE and TE (C5-43): part (b) is a prerequisite for the matcher slot. Without it, superseded Verified figures stay up between deploys (`lib/matcher-rebuild.ts:10-13`, `:18`), which is the priority rule. Score raised as a chore, not a slot. (b) goes first, with named tests (TE note 6). |
| MK-P3 | 2 | 2 | Unchanged. CO's veto plus LC/PR/VW: later, only as a figure-free "record image" in C5-32's slot, after OD 2.62. |
| C5-34 | 4 | 4 | Unchanged value to G2, but EN/UX/VW persuade me it is fixes-lane size. The defect is GR's mismatch: the prompt previews the opengraph card (`share-prompt.tsx:39`) while Share sends `/story?format=square` (`share-card.tsx:16`). Fix: the preview src equals the sent image in both places, the standing box gets a lazy preview, and F-15 counts preview-shown (counts only). |
| C5-35 | 3 | 3 | Unchanged. LC/TR/UX make it real; RT adds a condition: the confirmation must not frame deletion as a clean slate, so it says reconnecting restores the same trades (OD 2.9's wording). Fold with F5-23 after f16/f17. |
| MK-P5 | 2 | 2 | Unchanged. CO/UX: while C5-1 is unbuilt it invites the very test we fail today, and it would drift from /how. Revisit as /how sections built from `lib/copy.ts` when outreach opens. |
| C5-33 | 3 | 3 | Unchanged. DS (note 6): it's F-18's first slice, since the glyph is the shared `Badge` (`app/ui.tsx:29`). VW: a demo-only stock page keeps a visible Demo label. |
| C5-39 | 2 | 3 | TE (C5-39): about 93 unwrapped arrows. One shared component plus a tree scan is a real behaviour guard. Scored as a chore, after F-25. |
| C5-36 | 2 | 2 | Unchanged. TE: renaming "Thesis held" rewrites pinned tests and reverses a DS ruling. EN/PR: dropping "if you publish" may remove a true case. The nav goes to the owner via F-18 (UX: ask now). |
| C5-41 | 1 | 2 | GR/MA: with LC's reshaped wording it is one constant plus a legal re-sign, with no slot cost. Still sells a closed tier (TR), so it's a copy fix at most. |
| C5-38 | 2 | 2 | Unchanged; chore. |
| C5-37 | 1 | 2 | A11Y (C5-37): two identical "Legal" landmarks and duplicate tab stops (`app/account/page.tsx:32`, `app/layout.tsx:60`). Keep the sentence muted (DS variant, LC R8) and drop the second landmark, as a chore. |
| C5-42 | 2 | 3 | RE/TE (C5-42): the wall-clock race oracles (`lib/connections.hardening.test.ts:147`, `lib/connections.test.ts:1454`) flake under CI load and invite loosening. Add-only ordering assertions protect every build this cycle. As a chore; RT's steering properties go first. |
| C5-40 | 2 | 2 | Unchanged; chore after #84. The production setting is the owner's (RE: one name in `coverage()`). |
| MK-P4 | 1 | 1 | Unchanged. LC: blocked unless reshaped; OD 2.47; no willingness-to-pay data (MA). |
| L-28 | 5 | 0 | Chair note 1, RT, EN, RE, TR, UX and VW (L-28): my round-1 premise was false. #89 already counts every later sell after an oversell (`lib/trades.ts:48-53`). F-28's "later lots fresh" would loosen main, and the fixes-cycle-4 committee recorded +65%/+60%/+25% (`docs/features/logs/fixes-cycle4/committee-2026-11-01.md:119-122`). Re-approving it is harmful if the owner says yes. Let it lapse with an owner note: OD 2.27 is overtaken by #89; the release question (vendor position units) is the owner's. |
| L-30 | 4 | 2 | RT/TR/VW (L-30): the evidence part is on main via #89. Broker-position evidence is an owner item (protected `lib/broker.ts`). The readout stamp-pattern count is a readout chore (F-31). Re-approve only that residual (never loosens #89, intraday identical), or let it lapse. |
| L-29 | 4 | 4 | Unchanged. The legal words are the build's first step. It is in the pane/strip slot with UX's shared 360 px AC. |
| L-21 | 4 | 4 | Unchanged. After F-23 (#97). One sum covering C5-1's transfer line and #84's `excludedHeld` (TE). PR: OD 2.7 names the counts. |

ROUTE lines:
- ROUTE=chore: C5-43 ((b) before any MATCHER_VERSION bump), C5-39, C5-38, C5-42, C5-40, C5-37 (muted sentence, one Legal landmark), C5-36 (copy lines; nav to owner via F-18).
- ROUTE=fixes: C5-34 (preview equals sent image), MK-P6 (/how sentence, with F5-6), C5-41 (LC's reshaped line, LC re-signs), C5-35 (fold with F5-23).

Active slots I back (business reason: before G1 nothing is read by a real viewer, so merge safety beats throughput):
matcher (C5-1 interim + C5-31), pane/strip (C5-5 waits on 2.25 + L-21 + L-29), sync (C5-30 + C5-43d). C5-4 is approved and
waits on the owner. C5-32 is approved and queued for before outreach.

### UX (round 3)

#### Round 3: UX lead, revised ballot

| Item | R1 | R3 | Changed because |
|---|---|---|---|
| C5-1 | 5 | 5 | Unchanged. Its interim visible "transfer" reason should also be named in OD 2.7's consent version (PR, chair note 8). |
| C5-4 | 4 | 4 | Unchanged as one item, approved as "waits on C5 Q3 and OD 2.32" (CO and RT on chair note 5). Added (LC, VW): suppressing a zero-width range and "Past results: above zero" now is a fixes-lane truthful-label fix. |
| C5-5 | 5 | 4 | CO C5-5: the shared helper is OD 2.25's build under "yes" and would be rebuilt after the answer, on files f16/f25/F-23 are rewriting. The "per closed trade" wording goes to the fixes lane now (`lib/record-strip.ts:108`). The rest is approved "waits on OD 2.25", pane/strip slot with L-21/L-29, with TE's render-equality test and my shared 360 px layout AC. |
| C5-10 | 3 | 3 | Unchanged; LC/PR condition: only on records whose consent version names the connection date (OD 2.7). |
| C5-32 | 3 | 3 | Unchanged. Key objection resolved (PR, EN: HKDF under a purpose label, `lib/claims.ts:65`). My timing point stands, confirmed by EN: after a matcher bump every older code reads "differs". Build close to outreach, after f16/f25 and the matcher slot. |
| C5-30 | 4 | 4 | Unchanged; C5-43(d) may ride it (VW). |
| C5-31 | 4 | 4 | Unchanged (matcher slot, one bump with C5-1; C5-43(b) lands first per EN/RE). |
| MK-P6 | 3 | 2 | Chair note 3 / EN: the vendor client has no earliest-history field (`lib/broker.ts:89-94`), so by its own fallback it is one /how sentence. ROUTE=fixes with F5-6. |
| C5-43 | 3 | 3 | Score kept. ROUTE=chore with (b) first, before any MATCHER_VERSION bump (RE, EN, TE), and named tests in the fixes entry (TE note 6). |
| MK-P3 | 2 | 2 | Unchanged. I back CO's veto condition: figure-free "record image", no award styling, cached, no per-load logging (LC, PR, VW). Next cycle at the earliest. |
| C5-34 | 3 | 3 | Score kept, now ROUTE=fixes (EN, VW, GR): the real defect is the preview/sent mismatch (`share-prompt.tsx:38` opengraph vs `:50` square). AC: the preview `src` equals the image Share sends, in both the prompt and the standing box. |
| C5-35 | 4 | 4 | Kept, with added conditions. LC: the confirmation page says vendor-side removal can finish later and has no handle in the URL. RT: it must not frame deletion as a clean slate while OD 2.9 is open (reconnecting can bring back the same trades). BL/VW's fold into the fixes lane with F5-23 is acceptable if slots are short. |
| MK-P5 | 2 | 2 | Unchanged (CO: second explainer that drifts from /how; RT: invites a test we fail today while C5-1 is live). |
| C5-33 | 4 | 4 | Unchanged. Built as F-18's first slice (DS); the Demo label stays visible on a demo-only stock page (VW). |
| C5-39 | 3 | 3 | ROUTE=chore after F-25, one shared arrow component and an accessibility-tree scan (TE, GR, PR, VW). |
| C5-36 | 4 | 3 | EN: "if you publish" already renders only when it applies (`app/settings/page.tsx:44`), so dropping it can remove a true case. TE: "Thesis held" is pinned by a DS ruling (`lib/report-copy.test.ts:10`). ROUTE=chore for the duplicate "Record tools". The nav label goes to the owner as an F-18 question. |
| C5-41 | 2 | 2 | ROUTE=fixes with LC's reshaped words, re-signed in the PR (MA, GR, VW). |
| C5-38 | 3 | 3 | ROUTE=chore. |
| C5-37 | 2 | 2 | ROUTE=chore, reshaped (LC R8, A11Y): keep the sentence muted and drop the duplicate "Legal" landmark only. |
| C5-42 | 2 | 2 | ROUTE=chore; first slices are steering properties and the two wall-clock races (RE, RT, TE). |
| C5-40 | 2 | 2 | ROUTE=chore after #84 (RE, EN). |
| MK-P4 | 1 | 1 | Unchanged. |
| L-28 | 4 | 1 | Chair note 1, RT (rt/p1.ts), EN, RE, TR, VW: main is already stricter (`lib/trades.ts:48-53`). F-28's "later lots fresh" would loosen #89 and publish counted closes. Let it lapse, with an owner note that OD 2.27 is overtaken by #89. |
| L-30 | 4 | 2 | RT, TR: with evidence, #89 already counts. Only the readout stamp-pattern row remains (a readout chore), plus broker-position evidence, which is the owner's (protected `lib/broker.ts`). Re-approving the whole file would rebuild what #89 does. |
| L-29 | 5 | 5 | Unchanged. |
| L-21 | 4 | 4 | Unchanged. TE: the guard lists in-memory `excluded*` keys (e.g. #84's `excludedHeld`). PR: consent names the exclusion counts. |

### EN (round 3)

#### Round 3: EN (engineer), revised ballot

| Item | R1 | R3 | Changed because |
|---|---|---|---|
| C5-1 | 5 | 5 | — (interim own transfer line after #84; full form waits OD 2.28 + vendor; PR: OD 2.7 consent version names the exclusion counts) |
| C5-4 | 4 | 4 | — Accept RT/CO-concession (C5-4): the spread floor is the part that works and waits on C5 Q3 either way. LC's zero-width label suppression (`lib/confidence.ts:36-40`, existing `lib/copy.ts:225`) can go to fixes now. |
| C5-5 | 4 | 3 | CO (C5-5): under either OD 2.25 answer the helper is that answer's build, so building it now on files f16/f25/F-23 are rewriting means building it twice. "per closed trade" wording goes to fixes now; the helper waits on OD 2.25. Keep UX's shared 360 px AC for the pane/strip slot. |
| C5-10 | 3 | 3 | — (waits OD 2.7; LC/PR: forward figures only where the consent version names the date) |
| C5-32 | 3 | 3 | — My r2 view stands, reinforced by UX (C5-32): queued MATCHER_VERSION bumps would make honest pictures read "differs". Key: HKDF (PR, `lib/claims.ts:65`), not a deploy setting. Build after the matcher slot and f16/f25, before outreach. |
| C5-30 | 4 | 4 | — |
| C5-31 | 4 | 4 | — (waits C5 Q1; one bump with C5-1) |
| MK-P6 | 3 | 3 | — Chair note 3 confirms my finding: it is the /how sentence, part of F5-6. |
| C5-43 | 4 | 4 | — RE/TE (C5-43): (b) lands before the first matcher bump; TE (note 6): each chore lists its named test. Chore lane. |
| MK-P3 | 2 | 2 | — Only in LC/CO's figure-free "record image" form, in C5-32's image slot, after OD 2.62. |
| C5-34 | 3 | 3 | — GR is right that `share-card.tsx` is its own file (my rebase concern is weaker). But UX/VW (C5-34) show it is the mismatch fix: preview `src` = the image Share sends (`share-prompt.tsx:38` vs `:50`). Fixes size. |
| C5-35 | 3 | 3 | — LC's case is sound. RT's condition (C5-35): the confirmation page says a reconnect brings back the same trades. Fixes size after f16 (BL, VW: overlaps C5-26). |
| MK-P5 | 3 | 3 | — GR's condition (reuse /how's `lib/copy.ts` constants) answers DS/CO on drift. Zero overlap; fine outside the cap if the chair allows. |
| C5-33 | 3 | 3 | — DS (note 6): the glyph comes from the shared `Badge` (`app/ui.tsx:29`), so the `/t` heading alone is a fix and the rest is F-18's slice. VW's Demo condition applies. |
| C5-39 | 3 | 3 | — chore (TE: one shared arrow component + tree scan, after f25) |
| C5-36 | 2 | 2 | — TE (C5-36) adds a trap: "Thesis held" is pinned (`lib/report-copy.test.ts:10`, `lib/f26-held-like-none.test.ts:99`, DS ruling). The rename needs that ruling changed first. Nav waits on F-18. |
| C5-41 | 2 | 2 | — Only LC's reshaped line, as copy plus a legal re-sign. |
| C5-38 | 3 | 3 | — chore |
| C5-37 | 2 | 1 | LC/BL (C5-37): removing the disclaimer conflicts with F-3 R8. What is left is A11Y's duplicate "Legal" landmark (`app/tools/parts.tsx:14` vs `app/layout.tsx:60`), a chore. |
| C5-42 | 3 | 3 | — chore; RE's two wall-clock races first (`lib/connections.test.ts:1454`, `lib/connections.hardening.test.ts:147`). |
| C5-40 | 3 | 3 | — chore; RE: one `pg_settings` name in `coverage()` (`lib/sync-shard.ts:461-467`) plus one doc line after #84; owner applies it in production. |
| MK-P4 | 1 | 1 | — |
| L-28 | 4 | 0 | Chair note 1 and RT (L-28), which I verified (`lib/trades.ts:48-53`; fixes-cycle4 committee `:119-122`). TR/VW/BL concede. Re-approving it as written regresses main if OD 2.27 gets a yes. Let it lapse with an owner note that #89 overtakes OD 2.27. The residual (clearing the mark from a vendor position read, `lib/trades.ts:54-56`) is an owner item: protected broker.ts, stored units. |
| L-30 | 4 | 2 | RT/TR (L-30) and chair note 2: most of it is on main. The residual readout class-count row is a readout chore (F-31's readout), and broker-position evidence is an owner item. Re-approving the whole file would rebuild #89. |
| L-29 | 4 | 4 | — (after F-23; legal words first; UX's shared pane AC) |
| L-21 | 4 | 4 | — (after F-23; TE: the guard lists in-memory `excluded*` keys incl. #84's `excludedHeld`; PR: OD 2.7 names the counts) |

ROUTE: C5-43=chore, C5-39=chore, C5-38=chore, C5-40=chore, C5-42=chore, MK-P6=fixes, C5-34=fixes, C5-35=fixes, C5-36=fixes (copy only), C5-37=fixes, C5-41=fixes, L-30=chore (readout row only)

Slots after debate (new features): 1 matcher (C5-1 + C5-31, one bump, after #84 and C5-43(b)); 2 pane/strip (L-21 + L-29 re-approvals now; C5-5 helper joins once OD 2.25 is answered); 3 ranking (C5-4, waits on C5 Q3); 4 sync (C5-30, after #84); 5 image (C5-32, after the matcher slot and f16/f25; MK-P3 reshaped later); 6 forward (C5-10, waits on OD 2.7). Active now, without owner answers: matcher-interim (C5-1), sync (C5-30), pane/strip (L-21, L-29), which fits CO's cap of 3.

### TE (round 3)

#### Round 3: TE (tester), revised ballot

| Item | R1 | R3 | Changed because |
|---|---|---|---|
| C5-1 | 5 | 5 | No change. Two conditions stand. First, a seeded property test: inserting a transfer never raises win rate or average. Second, the interim form gets its own AC, a transfer count of 1, because it does not keep the −60% close. One MATCHER_VERSION bump for the matcher slot (EN note 7), landing after C5-43(b). |
| C5-4 | 4 | 4 | No change. RT (note 5) showed that only the spread floor closes the path: +1% ±0.01 still weighs 0.296. So the item stays whole and waits on C5 Q3 and OD 2.32. I accept LC's and VW's fixes-lane step: suppress `trustSign` when the half-width is 0. My order AC is restated: "keep the order of the method OD 2.33 picks". |
| C5-5 | 4 | 4 | No change. I accept CO's split: "per closed trade" goes to the fixes lane now, and the rest waits on OD 2.25. UX adopted my render-equality test. I add UX's shared-slot AC (note 7): with all three lines, the headline and disclaimer stay in view at 360 px. |
| C5-10 | 3 | 3 | No change. I add LC's and PR's condition: forward figures only on records whose consent version names the connection date (OD 2.7). |
| C5-32 | 4 | 3 | EN and UX (C5-32): `closed_trades` rows are not keyed by matcher version (`lib/matcher-rebuild.ts:13-14`). After each queued bump, every older code reads "differs", so the core AC would fail on honest pictures. Build it after the matcher slot settles, with LC's wording and PR's HKDF label. |
| C5-30 | 4 | 4 | No change. C5-43(d) can ride along in `lib/sync.ts` (VW). |
| C5-31 | 3 | 3 | No change. It shares the matcher slot's single bump (EN note 7). |
| MK-P6 | 3 | 2 | Chair note 3 / EN: the vendor client exposes no earliest-history date (`lib/broker.ts:89-94`). By its own fallback it shrinks to one /how sentence, which is fixes-lane size. |
| C5-43 | 4 | 4 | No change in score. RE and EN (C5-43): (b) is a prerequisite and lands before the first matcher bump. Every member agrees it is a chore. |
| MK-P3 | 2 | 1 | CO's veto, with LC, PR and VW (MK-P3): it can't be legible at bio size; logging forum viewers is a privacy issue; it is a second share surface before G2. If it returns, it should come back figure-free in C5-32's slot after OD 2.62. |
| C5-34 | 3 | 4 | GR, TR and BL (C5-34): the post-connect preview is the opengraph card (`app/u/[handle]/share-prompt.tsx:39`), but Share sends `/story?format=square` (`app/u/[handle]/share-card.tsx:16`). That is a real mismatch, and my src-equality test catches it. EN and UX say it is fixes-lane size, so I route it to fixes. |
| C5-35 | 3 | 3 | No change. I add LC's AC (the confirmation page says vendor-side removal can finish later; static, no handle in the URL) and RT's (it says a reconnect brings back the same history). |
| MK-P5 | 3 | 3 | No change. I add UX's and RT's condition: it never implies our records defeat every trick. Definitions come from the shared `lib/copy.ts` constants (GR, MA). |
| C5-33 | 4 | 4 | No change. DS: the glyph comes from the shared `Badge` (`app/ui.tsx:29`), so build it as F-18's first slice. VW's condition: a demo-only stock page keeps a visible Demo label. |
| C5-39 | 4 | 4 | No change in score. Routed to chore with C4-34(c), with one shared arrow component and the accessibility-tree scan (PR, GR, VW). |
| C5-36 | 3 | 3 | No change in score. EN and PR (C5-36): the "if you publish" text already renders only when it applies (`app/settings/page.tsx:44`), so drop that part. "Thesis held" is pinned by tests (`lib/report-copy.test.ts:10`, `lib/f26-held-like-none.test.ts:99`), so changing it needs a DS sign-off and rewritten twin tests. The nav label waits on F-18. Chore. |
| C5-41 | 2 | 2 | No change. Only with LC's reshaped line; copy fix. |
| C5-38 | 3 | 3 | No change. Chore. |
| C5-37 | 2 | 2 | No change. A11Y and DS reshape it: keep the sentence and links (F-3 R8), mute them, drop the second "Legal" landmark. Chore. |
| C5-42 | 4 | 4 | No change in score. RE confirmed the wall-clock oracles. RT and UX set the first slices (steering properties), and PR adds the privacy leak paths. Chore. |
| C5-40 | 2 | 2 | No change. RE: one name added to the existing `pg_settings` list (`lib/sync-shard.ts:461-467`). Chore. |
| MK-P4 | 1 | 1 | No change. |
| L-28 | 5 | 1 | Chair note 1, RT, EN, RE and TR (L-28): main already counts every later sell after an oversell (`lib/trades.ts:48-53`). F-28's "later lots fresh" would loosen #89: +65% where the true figure is +10%. My "+28.6% today" premise was false. Let it lapse, with an owner note that OD 2.27 is overtaken. |
| L-30 | 4 | 2 | RT and TR (L-30): with evidence, #89 already counts. The residuals are broker-position evidence (owner: `lib/broker.ts` and stored units) and the readout stamp-pattern row. Route the readout row as a chore under F-31. Its "intraday unchanged" twin must pin main's #89 baseline. |
| L-29 | 4 | 4 | No change. Ready, with the legal words as the first step. It shares UX's three-line pane AC. |
| L-21 | 4 | 4 | No change. My condition stands: the counter guard also lists the in-memory `MatchResult` `excluded*` keys. UX's shared pane AC applies. It builds after F-23 (#97). |

ROUTE: C5-43=chore, C5-39=chore, C5-42=chore, C5-40=chore, C5-38=chore, C5-36=chore, C5-37=chore, L-30=chore
(readout row only), C5-34=fixes, MK-P6=fixes, C5-41=fixes.

### RT (round 3)

#### Round 3: RT (record-trust red team), revised ballot

| Item | R1 | R3 | Changed because |
|---|---|---|---|
| C5-1 | 5 | 5 | — (my conditions stand: all three transfer variants, a property test that no transfer raises an average, waits on OD 2.28 + vendor) |
| C5-4 | 4 | 4 | — LC's split (zero-width label to fixes) is fine as a fixes item, but the jitter probe (rt/p2.ts: 0.296, printed "+1.0% to +1.0%") shows the spread floor is what closes the path; that part waits on C5 Q3 (CO, VW agree it is one owner item) |
| C5-5 | 4 | 4 | — accept TE's render-equality test and UX's shared 360 px slot AC; "per closed trade" wording to the fixes lane now (CO) |
| C5-10 | 3 | 3 | — plus LC's and PR's condition: only on records whose consent version names the connection date (OD 2.7) |
| C5-32 | 4 | 4 | — EN/UX: build after the matcher slot, because older codes read "differs" after a bump. /check copy must name a calculation update in plain words (TR). Key via HKDF purpose label (PR, `lib/claims.ts:65`) |
| C5-30 | 3 | 3 | — |
| C5-31 | 4 | 4 | — one matcher bump with C5-1, after C5-43(b) (EN, RE) |
| MK-P6 | 3 | 3 | — chair note 3: no vendor field (`lib/broker.ts:89-94`), so it becomes one /how sentence; ROUTE=fixes |
| C5-43 | 4 | 4 | — ROUTE=chore (BL, EN, RE, TE, VW), with (b) landing before the first matcher bump |
| MK-P3 | 2 | 2 | — acceptable on my lens only in the figure-free shape (CO veto, LC); next cycle |
| C5-34 | 3 | 3 | — GR/EN: the real defect is the preview showing a different picture from the one Share sends. That is a truthful-label fix; ROUTE=fixes |
| C5-35 | 2 | 3 | LC C5-35: informed consent to an irreversible act is a P6 matter, and the confirmation page must say vendor removal may finish later. My reset concern (re-attach brings the full history back) becomes a condition: the page must not frame deletion as a clean record. ROUTE=fixes with F5-23/C5-26 after f16/f17 (BL, VW) |
| MK-P5 | 3 | 2 | CO/UX MK-P5: while C5-1 and the oversell route are live, a page teaching "chosen trades/survivorship" invites a test our records fail today, and it drifts from /how (DS via CO). Later, as /how sections |
| C5-33 | 3 | 3 | — DS: build as F-18's first slice; VW's Demo-label condition |
| C5-39 | 3 | 3 | — ROUTE=chore (GR, PR, TE, VW) |
| C5-36 | 2 | 2 | — ROUTE=chore; TE: "Thesis held" is pinned (`lib/report-copy.test.ts:10`), so it needs twin expectations and DS sign-off |
| C5-41 | 2 | 2 | — only with LC's reshaped words (no "every"/"nothing hidden"); ROUTE=fixes |
| C5-38 | 3 | 3 | — ROUTE=chore |
| C5-37 | 2 | 2 | — LC/DS: keep the disclaimer (F-3 R8), mute it, drop the duplicate landmark (A11Y); ROUTE=chore |
| C5-42 | 3 | 3 | — ROUTE=chore; first slices are the matcher steering properties (TE, UX); each chore entry names its test (TE) |
| C5-40 | 2 | 2 | — ROUTE=chore after #84 |
| MK-P4 | 1 | 1 | — |
| L-28 | 0 | 0 | — confirmed by EN, RE, UX, TR (reproduced), VW and BL: F-28's k-unit rule loosens #89 (`lib/trades.ts:48-53`). Let it lapse with an owner note that OD 2.27 is overtaken by #89 |
| L-30 | 2 | 2 | — narrow residual only (readout stamp-pattern class count, per BL, VW, TR), worded so it never loosens #89; broker-position evidence goes to the owner |
| L-29 | 4 | 4 | — |
| L-21 | 5 | 5 | — plus TE: the guard lists in-memory `MatchResult` `excluded*` keys (`excludedHeld`) as well as schema columns |

### LC (round 3)

#### Round 3: LC (legal committee), revised ballot

| Item | R1 | R3 | Changed because |
|---|---|---|---|
| C5-1 | 5 | 5 | Unchanged. Added PR's note 8: OD 2.7's consent version should name the public exclusion counts. The interim transfer line can build now. |
| C5-4 | 4 | 4 | Unchanged score. RT (C5-4) shows that near-identical (not only identical) returns still evade, so the spread floor is the real fix, and it waits on C5 Q3 and OD 2.32 (CO conceded). VW and I agree on one no-owner part: suppressing a printed zero-width range and its "above zero" line is a truthful-label fix for the fixes lane. |
| C5-5 | 4 | 4 | Unchanged. CO (C5-5): "per closed trade" goes to the fixes lane now, and the rest is approved as "waits on OD 2.25". TE: a render-equality test. UX: one shared 360 px AC for the slot. |
| C5-10 | 4 | 4 | Unchanged. PR note 8: OD 2.7 must be amended to name the first-connection date, which is my P3/P6 reshape. |
| C5-32 | 4 | 4 | Unchanged. PR and EN (note 4) show the HKDF purpose-label precedent (`lib/claims.ts:50-52`, `:65`), so no new env is needed and S1 is satisfied. I add UX's and EN's timing point (C5-32): build it after the matcher slot. A mismatch reads "figures changed since: a later import or a calculation update", and a rotated key reads "can't be checked", never "forged". |
| C5-30 | 4 | 4 | Unchanged. |
| C5-31 | 4 | 4 | Unchanged (waits on C5 Q1). |
| MK-P6 | 4 | 4 | Score kept. The chair (note 3) and EN found no vendor earliest-date field (`lib/broker.ts:89-94`), so it is the one /how sentence. ROUTE=fixes, with F5-6. |
| C5-43 | 3 | 3 | Score kept. ROUTE=chore with (b) first, before any MATCHER_VERSION bump (EN, RE, TE C5-43): (b) is what stops superseded Verified figures staying up (F3c). |
| MK-P3 | 2 | 2 | Unchanged. It is acceptable only in the figure-free "record image" form (CO, GR, VW), with no per-load IP or referrer logging (PR) and an explicit cache. Outreach waits on OD 2.62. Next cycle. |
| C5-34 | 3 | 3 | Score kept. ROUTE=fixes: GR, EN and VW (C5-34) show the real defect is a preview that differs from the image Share sends. That is a truthful-label fix: the preview `src` equals the sent URL. |
| C5-35 | 4 | 4 | Score kept. I adopt RT's point (C5-35) as a truthfulness condition. The confirmation page says the deletion's vendor-side steps may finish later, and that reconnecting the same accounts brings back the same imported history, losses included (`lib/claims.ts:25`), until OD 2.9 decides otherwise. No "permanently". A static URL with no handle. It may fold with F5-23 after f16/f17 if slots are short. |
| MK-P5 | 3 | 2 | Lowered: UX, CO and RT (MK-P5). While C5-1 and the oversell residual are live, a page teaching "who connects and when" invites an F3a overclaim about our own records. It also drifts from /how (DS). Revisit as an outreach asset that uses /how's constants. |
| C5-33 | 4 | 4 | Unchanged. DS: build it as F-18's first slice (the shared `Badge`, `app/ui.tsx:29`). VW: a demo-only stock page keeps a visible Demo label (P2). |
| C5-39 | 3 | 3 | ROUTE=chore (chair note 6; GR, PR, TE, VW), with TE's accessibility-tree scan as the named test. |
| C5-36 | 3 | 3 | ROUTE=chore. TE: "Thesis held" is pinned by tests and a DS ruling, so it needs a DS sign-off and twin expectations, never deleted tests. EN and PR: "if you publish" is conditional (`app/settings/page.tsx:44`), so keep it where it is true. The nav name goes to the owner through F-18. |
| C5-41 | 2 | 2 | ROUTE=fixes (copy lane). MA (the proposer), GR, TR and VW accept my reshaped words. LC re-signs them in the PR. It waits for nothing, but earns little before billing (BL, TR). |
| C5-38 | 3 | 3 | ROUTE=chore. |
| C5-37 | 2 | 2 | ROUTE=chore. A11Y and DS reshape it within R8: keep the sentence and links (a muted variant of `Disclaimer`) and remove the duplicate "Legal" landmark. LC records that R8 is satisfied this way. |
| C5-42 | 3 | 3 | ROUTE=chore (RE, TE, UX), with RT's matcher-steering and privacy leak-path slices first. Test count never drops. |
| C5-40 | 2 | 2 | ROUTE=chore. Production `jit` stays the owner's deploy setting (POLICY H). |
| MK-P4 | 1 | 1 | Unchanged. The F1 block stands as reshaped in round 1. MA: no willingness-to-pay data, and OD 2.47. |
| L-28 | 4 | 1 | Lowered: chair note 1, RT, EN, RE, UX, TR, VW (L-28). Main already counts every later sell after an oversell (`lib/trades.ts:48-53`). F-28's "later lots fresh" would publish closes main counts today, against POLICY F3c (count, never guess). Let it lapse, with an owner note that OD 2.27 is overtaken by #89. The fair release (vendor position units) stays with the owner. |
| L-30 | 4 | 2 | Lowered: RT and TR (L-30). The evidence part is on main (`lib/trades.ts:65-69`). Broker-position evidence is the owner's (protected `lib/broker.ts`). Only the counts-only readout stamp-class row remains: a chore that never loosens #89. |
| L-29 | 5 | 5 | Unchanged. /how is false today (`lib/copy.ts:549`). The signed interim words are in r1-LC.md. |
| L-21 | 4 | 4 | Unchanged. TE: the guard lists in-memory `excluded*` keys (`excludedHeld`). UX: a shared 360 px AC with C5-5 and L-29. |

#### POLICY (updated)

- **L-28, F3c** (count, never guess). As written it would loosen #89. Reshaping: no re-approval. It lapses with an
  owner note that OD 2.27 is overtaken by #89. Any future residual must be worded "never publishes a close that main
  counts".
- **C5-41, F3a.** Use the reshaped words: "Compare whole public records side by side: closed trades imported from
  connected accounts, losses and ranges included. Traders can't remove single trades." LC re-signs them in the PR.
- **MK-P3, F6 / F3 / F3b / P3.** Reshaping:
  - a "record image", not a badge, with no award styling;
  - figure-free (handle, trust state in words, "See full record") or a passing rendered-size legibility test of both
    disclaimer sentences;
  - no symbol, last-trade line or "new" marker;
  - no per-load IP or referrer logging;
  - outreach waits on OD 2.62.
- **C5-10, P3/P6.** Forward figures and counts show only on records whose consent version names the first-connection
  date. OD 2.7 is amended to name it, and also the public exclusion counts (PR).
- **C5-32, F3a / S1 / S2.** /check claims only that the picture's figures match the stored record:
  - never "authentic", "genuine", identity or completeness;
  - a mismatch is described as a later import or a calculation update, never "forged";
  - a rotated key reads "can't be checked".

  Key: HKDF under a fixed purpose label (precedent `lib/claims.ts`) or an owner-set env, never raw reuse, never logged.
- **C5-35, F3a / P6** (truthful deletion). The confirmation page states what remains, that vendor-side steps may finish
  later, and that reconnecting the same accounts brings back their imported history. No "permanently" until OD 2.9.
- **MK-P4, F1** (publisher's exclusion). It stays blocked unless:
  - no filter on any return, win rate, range or rank;
  - the order is the free documented method;
  - no alerts and no symbol;
  - LC reviews it under F-3, and OD 2.47 is answered.
- **C5-37** (F-3 condition R8, not POLICY). Keep the sentence and links on /account (muted variant), and drop only the
  duplicate landmark.

### PR (round 3)

#### Round 3: PR (privacy), revised ballot

| Item | R1 | R3 | Changed because |
|---|---|---|---|
| C5-1 | 5 | 5 | Unchanged. Matcher slot. Needs C5-43(b) before its MATCHER_VERSION bump (EN, RE, TE on C5-43). |
| C5-4 | 4 | 4 | Unchanged. RT and VW (chair note 5) show the split frees nothing but wording. Approve whole as "waits on C5 Q3 + OD 2.32". LC's zero-width label suppression can go to the fixes lane. |
| C5-5 | 4 | 4 | Unchanged. I accept CO's point (C5-5): the "per closed trade" copy goes to the fixes lane and the helper waits on OD 2.25. Plus TE's render-equality test and UX's shared 360 px AC for the pane slot. |
| C5-10 | 3 | 3 | Unchanged. LC's reshape matches my condition: forward figures only on records whose consent version names the first-connection date (OD 2.7, amended). |
| C5-32 | 4 | 4 | Unchanged score. Conditions added from EN and UX (C5-32): build after f16/f25 merge and after the matcher slot's bump, and /check explains a matcher change in plain words. Key: HKDF under a fixed purpose label (`lib/claims.ts:51-52`, `:65`), never logged. LC's wording: "figures match the stored record", never "forged". |
| C5-30 | 4 | 4 | Unchanged. C5-43(d) may ride its `lib/sync.ts` slot (VW). |
| C5-31 | 3 | 3 | Unchanged. Waits on C5 Q1; one bump shared with C5-1. |
| MK-P6 | 4 | 2 | Chair note 3 (EN): the vendor client exposes no earliest-history date (`lib/broker.ts:89-94`), so by its own fallback it is one /how sentence, part of F5-6. Not a feature. |
| C5-43 | 3 | 4 | EN, RE and TE (C5-43): part (b) is a prerequisite for every matcher bump this cycle. Without it, superseded Verified figures stay up until the next deploy (`lib/matcher-rebuild.ts:10-18`). Chore lane, (b) first, each part with its named test (TE, chair note 6). |
| MK-P3 | 3 | 3 | Unchanged: "later", only in the reshaped form (GR, CO, LC, TR): figure-free "record image", not "badge", explicit cache, no per-load logging, after C5-32, outreach waits on OD 2.62. Not this cycle's slot. |
| C5-34 | 3 | 4 | GR, TR and BL (C5-34): the only preview shows the opengraph card (`share-prompt.tsx:39`) while Share sends `/story?format=square` (`share-card.tsx:16`). The trader shares a picture they have never seen, so informed sharing (my lens) is broken today. Small enough for the fixes lane (EN, UX, VW). |
| C5-35 | 4 | 4 | Unchanged. Conditions added from LC: the page says vendor-side removal can finish later. From RT: it never frames deletion as a clean slate (reconnecting the same accounts brings the history back, `lib/claims.ts:25`, until OD 2.9). UX: the confirmation page is a new surface, so it needs a decision line. Static page, no handle in the URL. |
| MK-P5 | 3 | 3 | Unchanged. Add DS and TE's condition (same `lib/copy.ts` constants as /how) and RT's (never claim our record defeats every trick). |
| C5-33 | 3 | 3 | Unchanged. DS (chair note 6): F-18's first slice. VW: a demo-only stock page keeps a visible Demo label. |
| C5-39 | 2 | 2 | Unchanged: a correct chore (TE: about 93 bare arrows; one shared component plus an a11y-tree scan, after F-25). |
| C5-36 | 2 | 2 | Unchanged. Add TE's trap: "Thesis held" is pinned by tests (`lib/report-copy.test.ts:10`), so any rename adds expectations and never rewrites them without a DS sign-off. My R1 point stands: `lib/copy.ts:932` already shows only when it applies. |
| C5-41 | 2 | 2 | Unchanged. Only in LC's reshaped words (no completeness claim), re-signed. |
| C5-38 | 2 | 2 | Unchanged. |
| C5-37 | 2 | 2 | Unchanged. As LC, DS and A11Y reshape it: keep the sentence (muted), drop only the duplicate "Legal" landmark (A11Y: two identical navs, `app/tools/parts.tsx:14`, `app/layout.tsx:60`). |
| C5-42 | 3 | 3 | Unchanged. First slices: steering properties (RT) and privacy leak paths (held notes, gated options, account ids). RE: ordering assertions beside the 2 s and 5 s race windows. |
| C5-40 | 2 | 2 | Unchanged. RE: one name in `coverage()` (`lib/sync-shard.ts:461-467`). Production setting stays the owner's. |
| MK-P4 | 2 | 2 | Unchanged. LC's blocking conditions (no filter on returns, rank or symbol) plus OD 2.7 for any forward filter. |
| L-28 | 4 | 1 | Chair note 1, RT, EN, RE, TR (L-28): #89 already counts every later sell after an oversell (`lib/trades.ts:48-53`). F-28's "later lots fresh" would loosen main and publish wrong Verified figures (+65% vs +10%). Let it lapse, with an owner note that OD 2.27 is overtaken by #89. |
| L-30 | 4 | 2 | RT, TR, VW (L-30) and chair note 2: the evidence case is on main. What remains is the readout class-count row (chore) and broker-position evidence (protected `lib/broker.ts`, owner). Re-approve only a residual that never loosens #89, or route it. |
| L-29 | 4 | 4 | Unchanged. Keeps the no-public-"not asked"/"declined" guard. UX's shared 360 px AC for the pane slot. |
| L-21 | 4 | 4 | Unchanged. TE: the guard lists in-memory `MatchResult` `excluded*` keys (e.g. #84's `excludedHeld`). My owner flag stands: name exclusion counts in OD 2.7's consent version. |

ROUTE: C5-39=chore, C5-38=chore, C5-40=chore, C5-42=chore, C5-43=chore, C5-36=chore, C5-37=chore, C5-41=fixes,
MK-P6=fixes, C5-34=fixes, L-30=chore (readout row only).

### A11Y (round 3)

#### Round 3: A11Y (accessibility specialist), revised ballot

| Item | R1 | R3 | Changed because |
|---|---|---|---|
| C5-1 | 5 | 5 | Unchanged. Interim transfer count after #84; the full form waits on OD 2.28 + vendor. Its count joins L-21's sum (PR note 8: OD 2.7's consent version names public exclusion counts). |
| C5-4 | 4 | 4 | Unchanged score. CO, RT, VW (C5-4 split): the spread floor is TR-9's formula, so the item waits on C5 Q3 + OD 2.32 as one. Not printing a zero-width range goes to the fixes lane (LC, VW). |
| C5-5 | 4 | 4 | Unchanged score; now "waits on OD 2.25" for the helper (CO C5-5: the helper is 2.25's build), and the "per closed trade" copy goes to the fixes lane. Added UX's slot AC (chair note 7): open + exclusion + options lines together keep headline and disclaimer in view at 360 px and reflow at 320 px, with one builder owning the DOM order. Render-equality test (TE). |
| C5-10 | 3 | 3 | Unchanged; waits on OD 2.7 (LC, PR). |
| C5-32 | 3 | 3 | Unchanged score. Key resolved (PR, EN: HKDF purpose label, `lib/claims.ts:51-52`). New timing condition from EN and UX (C5-32): after the matcher slot's bump, so honest pictures don't read "differs". Keep my a11y conditions (code in the alt text, no look-alike characters, labelled /check field, errors announced). |
| C5-30 | 4 | 4 | Unchanged; (d) of C5-43 may ride along (VW). |
| C5-31 | 4 | 4 | Unchanged; waits on C5 Q1. |
| MK-P6 | 4 | 3 | Chair note 3 / EN: the vendor client exposes no earliest-history date (`lib/broker.ts:89-94`), so by its own fallback it is one /how sentence, part of F5-6. ROUTE=fixes. |
| C5-43 | 3 | 3 | Same score as a feature; ROUTE=chore. EN, RE, TE (C5-43): (b) must land before the first MATCHER_VERSION bump. |
| MK-P3 | 2 | 2 | Unchanged. I back CO's veto and the figure-free "record image" reshape (LC, GR). Next cycle, after C5-32, OD 2.62. |
| C5-34 | 3 | 3 | Same score; ROUTE=fixes. GR, EN, UX, VW: the real defect is that the preview (opengraph) differs from the image Share sends (`share-card.tsx:16`). Preview exactly the sent image, with `cardAlt` alt text, in both places. |
| C5-35 | 4 | 4 | Score kept (LC, TR, UX). Build it with F5-23 so focus is set in one place. Added RT's and LC's confirmation-page conditions: say plainly what remains and that vendor-side removal can finish later, without framing deletion as a clean slate (wording within OD 2.9). Static URL, h1 focused, unique title. |
| MK-P5 | 3 | 3 | Unchanged. Later; DS/TE condition: same `lib/copy.ts` constants as /how. RT/UX: no claim that our records defeat every trick. |
| C5-33 | 3 | 3 | Unchanged. DS chair note 6: the glyph comes from the shared `Badge` (`app/ui.tsx:29`), so it is F-18's first slice, not a pure chore. VW: a demo-only stock page keeps a visible Demo label. |
| C5-39 | 3 | 3 | Same score; ROUTE=chore (GR, PR, VW, TR, TE). TE: about 93 lines; one shared arrow component plus an accessibility-tree scan, after F-25, merged with C4-34(c). It must not drop a third cycle. |
| C5-36 | 3 | 2 | VW, EN (C5-36): the nav part is the owner's via F-18, and the copy lines are chores. TE: "Thesis held" is pinned (`lib/report-copy.test.ts:10`), so it needs a DS sign-off and twin expectations. ROUTE=chore for the copy. |
| C5-41 | 2 | 2 | Unchanged; LC's reshaped wording only. ROUTE=chore (copy + LC re-sign). |
| C5-38 | 3 | 3 | Same score; ROUTE=chore (a11y lane, forced-colours e2e). |
| C5-37 | 3 | 2 | LC (R8, `F-3/committee:41`), DS: keep the sentence and links. What is left is my landmark point: duplicate "Legal" navs (`app/tools/parts.tsx:14`, `app/layout.tsx:60`), fixed with a muted variant and no second landmark. ROUTE=chore. |
| C5-42 | 3 | 3 | Same score; ROUTE=chore (RE, TE). TE chair note 6: each routed chore lists its named test. |
| C5-40 | 2 | 2 | Unchanged; ROUTE=chore after #84 (RE, EN). |
| MK-P4 | 2 | 2 | Unchanged; LC's block conditions; OD 2.47. |
| L-28 | 4 | 0 | Chair note 1, RT (rt/p1.ts), EN, RE: #89 already counts every later sell (`lib/trades.ts:48-53`). F-28's "later lots fresh" would loosen main and publish wrong Verified figures. Let it lapse, with an owner note that OD 2.27 is overtaken by #89. |
| L-30 | 4 | 2 | RT, TR, chair note 2: the evidence part is on main. The residual is broker-position evidence (owner, protected `lib/broker.ts`) plus a readout count row (a chore). Re-approve only that residual, worded so it never loosens #89, or let it lapse. |
| L-29 | 4 | 4 | Unchanged; ready, the legal words are step one; the a11y AC (qualifier announced with the headline) is kept. Pane slot with UX's shared AC. |
| L-21 | 4 | 4 | Unchanged; TE: the guard lists in-memory `MatchResult` `excluded*` keys (e.g. `excludedHeld`). UX's shared 360/320 px AC. |

### GR (round 3)

#### Round 3: GR (growth) revised ballot

| Item | R1 | R3 | Changed because |
|---|---|---|---|
| C5-1 | 5 | 5 | Unchanged. EN/RE/TE: C5-43(b) must land before its MATCHER_VERSION bump (condition added). |
| C5-4 | 4 | 4 | Unchanged. RT (note 5): only the spread floor closes the path, so it waits on C5 Q3. LC/VW: suppressing a zero-width range is a fixes-lane label fix now. |
| C5-5 | 4 | 4 | Unchanged. CO: the "per closed trade" copy goes to the fixes lane now; the rest waits on OD 2.25. TE: render-equality test. UX: one shared 360 px AC for the pane/strip slot. |
| C5-10 | 4 | 4 | Unchanged. LC/PR: forward figures only on records whose consent version names the first-connection date (OD 2.7). |
| C5-32 | 4 | 4 | Score held; timing changed. EN/UX: each matcher bump makes older codes read "differs", so build after the matcher slot settles and before outreach (BL/VW). PR/EN: HKDF purpose label, as in `lib/claims.ts:65`, so no new env. LC's /check wording. |
| C5-30 | 4 | 4 | Unchanged. VW: C5-43(d) may ride the same `lib/sync.ts` slot. |
| C5-31 | 3 | 3 | Unchanged. Waits on C5 Q1; one bump with C5-1. |
| MK-P6 | 3 | 2 | Chair note 3 / EN: the vendor client exposes no earliest-history date (`lib/broker.ts:89-94`), so it falls back to one /how sentence. That is fixes-lane size (F5-6). |
| C5-43 | 3 | 4 | EN/RE/TE: part (b) is a prerequisite for this cycle's matcher bumps (`lib/matcher-rebuild.ts:10-18`); without it, superseded Verified figures stay up. Chore, (b) first. |
| MK-P3 | 4 | 3 | BL/TR/VW/PR: next cycle, after C5-34 and C5-32 (it should carry the check code). Only CO/LC's figure-free reshape (my r2 position), cached, with no per-load logging. Outreach waits on OD 2.62. |
| C5-34 | 5 | 5 | Held. EN/UX/VW say it is fixes-sized. I agree on size, but TR/BL/CO back it as the main share-loop lever. Either lane, keep both ACs: the preview `src` equals the image Share sends (`share-card.tsx:15-16`), in both the box and the post-connect prompt; and the counts-only F-15 "preview shown" event (BL). |
| C5-35 | 3 | 3 | Unchanged. RT/LC: the confirmation page must not frame deletion as a clean slate, and it says vendor-side removal can finish later. |
| MK-P5 | 4 | 3 | RT/CO/UX: while C5-1 and C5-10 are unbuilt, a page teaching "survivorship" and "who connects when" invites a test we fail today, and outreach is gated (OD 2.62). Later, using the /how constants (DS/TE). |
| C5-33 | 3 | 3 | Unchanged. DS: build it as F-18's first slice. VW: a demo-only stock page keeps a visible Demo label. |
| C5-39 | 2 | 3 | VW/TE: it should not drop for a third cycle, and the accessibility-tree scan is a strong behaviour test. Chore lane after F-25. |
| C5-36 | 3 | 3 | Unchanged. UX: send the nav label to the owner now as a one-line F-18 question. TE: "Thesis held" is pinned (`lib/report-copy.test.ts:10`), so it needs a DS sign-off. |
| C5-41 | 3 | 2 | TR/BL: billing is off (OD 2.47), so it moves nothing now. Only LC's reshaped words, as copy. |
| C5-38 | 2 | 2 | Unchanged. |
| C5-37 | 2 | 2 | A11Y/DS/LC: keep the disclaimer and its links (R8); drop only the duplicate "Legal" landmark (muted variant). Chore. |
| C5-42 | 2 | 3 | RE/TE: the wall-clock race tests flake under CI load, and the work is add-only with negative regression risk. Chore lane in slices. |
| C5-40 | 2 | 2 | Unchanged. RE/EN: one name in `coverage()`; production stays the owner's. |
| MK-P4 | 2 | 1 | LC (note 4): blocked unless it has no return, win-rate, range or rank filter, plus OD 2.47. MA: no willingness-to-pay data. |
| L-28 | 4 | 1 | Chair note 1, RT, EN, RE, BL, TR, VW: #89 already counts every later sell (`lib/trades.ts:48-53`), and F-28's "later lots fresh" would loosen main. Let it lapse, with an owner note that #89 overtakes OD 2.27. |
| L-30 | 4 | 3 | RT/VW/BL/TR: most of it is on main. Re-approve only the readout stamp-pattern residual: never loosen #89, intraday results identical. Broker-position evidence goes to the owner. |
| L-29 | 4 | 4 | Unchanged. UX's shared 360 px pane AC. |
| L-21 | 4 | 4 | Unchanged. TE: the guard lists the in-memory `excluded*` keys (#84's `excludedHeld`). PR: OD 2.7 should name the exclusion counts. |

ROUTE: C5-39=chore, C5-42=chore, C5-43=chore, C5-40=chore, C5-38=chore, C5-37=chore, C5-36=chore (copy lines; nav to
owner via F-18), MK-P6=fixes, C5-41=fixes.

### MA (round 3)

#### Round 3: MA (market analyst), revised ballot

| Item | R1 | R3 | Changed because |
|---|---|---|---|
| C5-1 | 5 | 5 | Unchanged. The trader steering a loss off the record is the direct threat to the one claim a free chosen-posts feed can't make. Interim count line after #84; full form waits on OD 2.28 + vendor. PR's note: OD 2.7 should name the exclusion counts. |
| C5-4 | 4 | 4 | Unchanged score. Per CO/RT/VW (chair note 5): approve whole as "waits on C5 Q3 and OD 2.32". The no-owner part (suppress zero-width range / "above zero") goes to the fixes lane (LC, VW). |
| C5-5 | 4 | 4 | Unchanged. Per CO C5-5: "per closed trade" copy to fixes now; helper waits on OD 2.25 in L-21's pane slot; TE's render-equality test; UX's shared 360 px AC for the slot. |
| C5-10 | 4 | 4 | Unchanged; waits on OD 2.7 naming the first-connection date (LC, PR). |
| C5-32 | 4 | 4 | Score held; sequencing changed per EN/UX C5-32: build after f16/f25 and after the matcher slot's bump, before outreach (BL, VW). LC wording (figures match the stored record; never "forged"); HKDF under a fixed label (PR, `lib/claims.ts:65` precedent). |
| C5-30 | 4 | 4 | Unchanged. After #84; C5-43(d) may ride (VW). |
| C5-31 | 4 | 4 | Unchanged; waits on C5 Q1; one matcher bump with C5-1. |
| MK-P6 | 4 | 3 | Chair note 3 / EN: the vendor client has no earliest-history field (`lib/broker.ts:89-94`), so by its own fallback it is one /how sentence, part of F5-6. ROUTE=fixes. |
| C5-43 | 3 | 3 | Score held; ROUTE=chore with (b) landing before the first MATCHER_VERSION bump (EN, RE, TE C5-43). |
| MK-P3 | 3 | 2 | CO/VW/LC MK-P3: figures + both disclaimers can't be legible at bio size; BL: the figure-free reshape is close to a link button. Next cycle, after C5-32, OD 2.62. |
| C5-34 | 3 | 4 | GR/TR C5-34: the trader previews one picture (`share-prompt.tsx:39-40`) and sends another (`share-card.tsx:15-16`); that's a share-loop defect on the only outbound channel. EN/UX: fix size, so ROUTE=fixes. |
| C5-35 | 3 | 3 | Held. Add RT's condition: the confirmation page must not frame deletion as a clean slate (a reconnect brings the same history back), plus LC's vendor-removal line. |
| MK-P5 | 4 | 3 | CO/UX MK-P5: a page teaching "survivorship" and "who connects when" while C5-1 and C5-10 are unbuilt invites readers to apply the test to us and we fail it today. Do it after those land; same `lib/copy.ts` constants as /how (GR, TE). |
| C5-33 | 3 | 3 | Held; per DS build as F-18's first slice, VW's Demo-label condition. |
| C5-39 | 2 | 2 | ROUTE=chore (GR, PR, TE: one arrow component + tree scan after F-25). |
| C5-36 | 2 | 2 | ROUTE=chore for copy lines; TE's pinned "Thesis held" tests need twin expectations and DS sign-off; nav goes to owner via F-18 (UX). |
| C5-41 | 3 | 3 | Held with LC's reshaped words (my r2 concession); ROUTE=fixes (GR, VW: one constant, no slot). |
| C5-38 | 2 | 2 | ROUTE=chore. |
| C5-37 | 2 | 1 | LC/DS/A11Y: F-3 R8 keeps the disclaimer on /account; only the duplicate landmark/links go. ROUTE=chore. |
| C5-42 | 2 | 2 | ROUTE=chore (RE, TE: slices starting with matcher steering properties). |
| C5-40 | 2 | 2 | ROUTE=chore after #84 (EN, RE); production setting is the owner's. |
| MK-P4 | 2 | 2 | Unchanged: no WTP data (market-2026-11-01.md:590); LC's conditions; OD 2.47. |
| L-28 | 4 | 1 | Chair note 1, RT/EN/RE L-28: #89 already counts every later sell after an oversell (`lib/trades.ts:48-53`); F-28's "later lots fresh" would loosen main (+65% published). Let it lapse with an owner note that OD 2.27 is overtaken. |
| L-30 | 4 | 2 | RT/TR L-30: the evidence part is on main; only the readout stamp-pattern row and broker-position evidence (owner, protected `lib/broker.ts`) remain. Re-approve only the readout residual, never loosening #89. |
| L-29 | 4 | 4 | Unchanged; legal words as the first build step. |
| L-21 | 4 | 4 | Unchanged; pane slot after F-23; TE: guard lists in-memory `excluded*` keys incl. `excludedHeld`. |

### DS (round 3)

#### Round 3: DS (design-system owner), revised ballot

| Item | R1 | R3 | Changed because |
|---|---|---|---|
| C5-1 | 5 | 5 | Held. Add PR's chair note 8: the consent version (OD 2.7) should name the public exclusion counts. |
| C5-4 | 4 | 4 | Held. CO, RT and VW show the split frees nothing, because the floor amends TR-9 and the wording is OD 2.32's. Approve as "waits on C5 Q3 and OD 2.32". LC/VW: suppressing a zero-width range can go to the fixes lane now, with no new string. |
| C5-5 | 4 | 4 | Held. CO: the helper is effectively OD 2.25's build, so the helper waits on 2.25. "Per closed trade" (`lib/copy.ts:172`) goes now. TE: one render-equality test across surfaces. UX: one shared 360 px fit check for the pane/strip slot. |
| C5-10 | 3 | 3 | Held. LC: forward figures only under a consent version that names the connection date. |
| C5-32 | 3 | 3 | Held. PR and EN close the key question (HKDF under a purpose label, `lib/claims.ts:51-52`, `:65`). UX and EN show that every matcher bump makes honest codes read "differs", and the image bands are at budget (design system §4.3). Build after the matcher slot and f16/f25, before outreach. |
| C5-30 | 4 | 4 | Held. |
| C5-31 | 4 | 4 | Held. One version bump with C5-1. C5-43(b) lands first (EN, RE, TE). |
| MK-P6 | 3 | 2 | Chair note 3 and EN: the vendor client exposes no earliest-history date (`lib/broker.ts:89-94`), so the item reduces to one /how sentence, part of F5-6. |
| C5-43 | 3 | 4 | EN, RE and TE: part (b) is a prerequisite for this cycle's matcher bumps (`lib/matcher-rebuild.ts:10-18`). Otherwise superseded Verified figures stay up between deploys. Route as a chore, with (b) first. |
| MK-P3 | 2 | 2 | Held. Only in CO/LC's figure-free "record image" shape. It uses TRUST_LOOK words with no new badge look, rides C5-32's image slot, and waits on OD 2.62. |
| C5-34 | 3 | 4 | GR, TR and BL: today the trader previews the opengraph card (`app/u/[handle]/share-prompt.tsx:39`) but Share sends `/story?format=square` (`share-card.tsx:16`). That is a one-producer mismatch, my lens. EN, UX and VW: fixes-lane size, so routed there. |
| C5-35 | 4 | 4 | Held. LC: informed consent to an irreversible act. Conditions added: RT (the confirmation page says that reconnecting brings back the same trades, losses included) and LC (static, no handle in the URL). Also mine: a new role token, not `--loss`. |
| MK-P5 | 3 | 2 | CO and UX: a second explainer drifts from /how and cannot imply our records defeat these tricks while C5-1 is live (F3a). Later, as /how sections built from the same constants. |
| C5-33 | 4 | 4 | Held. Not a chore (my r2): the glyph comes from the shared `Badge` (`app/ui.tsx:29`). Build it as F-18's first slice. VW: a demo-only stock page keeps a visible Demo label. |
| C5-39 | 3 | 3 | Held. Chore with one shared arrow component and a tree scan (TE, GR, PR, VW). |
| C5-36 | 3 | 2 | TE: "Thesis held" is pinned by a design-system ruling (`lib/f26-held-like-none.test.ts:99`, "always begins with 'Thesis'"). As design-system owner, I keep that ruling: no rename to "Note held". EN and PR: the "if you publish" line already renders only when it applies (`app/settings/page.tsx:44`). What remains is the duplicate "Record tools" (chore), and the nav label goes to the owner through F-18 (UX). |
| C5-41 | 2 | 2 | Held. Only LC's reshaped line, re-signed. Copy chore, no slot (GR, MA). |
| C5-38 | 3 | 3 | Held. Chore. |
| C5-37 | 3 | 2 | LC: F-3 R8 keeps the disclaimer and links on /account (`docs/features/logs/F-3/committee-2026-11-01.md:41`). A11Y: drop the duplicate "Legal" landmark. What is left is a muted variant of the one `Disclaimer` component. Chore. |
| C5-42 | 3 | 3 | Held. Chore. TE: each routed chore names its test. |
| C5-40 | 2 | 2 | Held. Chore after #84. Production setting is the owner's. |
| MK-P4 | 2 | 2 | Held. LC's blocking conditions plus OD 2.47. |
| L-28 | 4 | 1 | Chair note 1, RT, EN, RE, TR, VW: main already counts every later sell after an oversell (`lib/trades.ts:48-53`). F-28's "later lots fresh" would loosen #89. Let it lapse, with an owner note that OD 2.27 is overtaken by #89. |
| L-30 | 4 | 2 | Chair note 2, RT, TR: most of it is on main. The residual is the readout's stamp-pattern count (chore) plus broker-position evidence (owner, protected `lib/broker.ts`). Re-approve the residual only, never loosening #89. |
| L-29 | 5 | 5 | Held. False on screen today (`lib/copy.ts:549`). Ready, with the legal words as the build's first step. |
| L-21 | 4 | 4 | Held. One sum function. TE: the guard lists in-memory `excluded*` keys (`excludedHeld`). UX: one shared 360 px fit check with C5-5 and L-29. |

ROUTE: C5-43=chore ((b) before any matcher bump), C5-39=chore, C5-38=chore, C5-42=chore, C5-40=chore, C5-37=chore,
C5-36=chore (duplicate "Record tools" only; nav label to the owner through F-18), C5-41=chore (LC's wording, re-signed),
C5-34=fixes, MK-P6=fixes (part of F5-6), C5-4's zero-width suppression=fixes (the rest waits on Q3).

### RE (round 3)

#### Round 3: RE (reliability engineer), revised ballot

| Item | R1 | R3 | Changed because |
|---|---|---|---|
| C5-1 | 5 | 5 | Unchanged. EN, TE and RE (chair note 7): the slot ships ONE `MATCHER_VERSION` bump (C5-1 with C5-31), after C5-43(b) lands. |
| C5-4 | 4 | 4 | Unchanged. CO, RT and VW (note 5): the spread floor is the only part that closes the path, and it waits on C5 Q3. LC/VW's "suppress a zero-width range" label can go to the fixes lane now. |
| C5-5 | 4 | 4 | Unchanged. I accept CO's (C5-5) rework risk as a condition: the helper builds only once OD 2.25 is answered, and the "per closed trade" copy goes to the fixes lane now. I add TE's render-equality test and UX's shared 360 px slot AC. |
| C5-10 | 3 | 3 | Unchanged. LC/PR: forward figures only under the OD 2.7 consent version that names the date. My condition stands: the first-connection date is stored per account and never reset. |
| C5-32 | 3 | 3 | Unchanged score, firmer timing. EN and UX (C5-32) confirm my concern: `closed_trades` is not keyed by matcher version (`lib/matcher-rebuild.ts:14-15`), so after each bump every older code reads "differs". Build after the matcher slot settles and before outreach. PR/EN (note 4) settle the key question: an HKDF subkey under a fixed label (`lib/claims.ts` precedent), plus my key-version byte. |
| C5-30 | 4 | 4 | Unchanged. VW (C5-43): (d) can ride this `lib/sync.ts` slot. |
| C5-31 | 4 | 4 | Unchanged. It rides the single matcher bump. |
| MK-P6 | 3 | 2 | Chair note 3 / EN: the vendor client exposes no earliest-history date (`lib/broker.ts:89-94`), so by the item's own fallback it is one /how sentence: part of F5-6. |
| C5-43 | 5 | 5 | Score kept. Routed as a chore (BL, EN, TE, TR, VW agree); (b) lands before the first matcher bump. TE (note 6): the fixes entry names each test, timing ACs in LOAD tests. |
| MK-P3 | 2 | 2 | Unchanged. If it is reshaped figure-free (GR, CO, LC), it still needs an explicit s-maxage cache, no per-load logging (PR) and a load check. It goes in C5-32's slot after that, and outreach waits on OD 2.62. |
| C5-34 | 3 | 3 | Score kept; routed to fixes. GR/EN/UX: the real defect is that the preview (`share-prompt.tsx:39`) differs from what Share sends (`share-card.tsx:16`). Fix: the preview `src` equals the sent image, lazy and owner-only. |
| C5-35 | 3 | 3 | Unchanged. LC answered my condition (the page says vendor removal can finish later). RT's reconnect-restores-history line belongs on that page too. |
| MK-P5 | 3 | 2 | DS/CO (MK-P5): a second explainer drifts from /how. UX/RT: it overclaims while C5-1 is live. Later, built from the `lib/copy.ts` constants. |
| C5-33 | 3 | 3 | Unchanged. DS (note 6): the glyph comes from the shared `Badge` (`app/ui.tsx:29`), so this is F-18's first slice. VW: a demo-only page keeps its Demo label. |
| C5-39 | 3 | 3 | Routed as a chore (GR, PR, TE, VW): one shared arrow component plus an accessibility-tree scan, after F-25. |
| C5-36 | 2 | 2 | Routed as a chore. TE: "Thesis held" is pinned by tests and a DS ruling, so twin expectations, never deletions. EN/PR: "if you publish" may be true where it renders. |
| C5-41 | 2 | 2 | Routed to fixes with LC's reshaped wording, re-signed in the PR (GR, MA accept). |
| C5-38 | 3 | 3 | Routed as a chore. |
| C5-37 | 2 | 2 | Routed as a chore, reshaped per LC (R8, `F-3/committee:41`), DS and A11Y: keep the sentence and links, muted variant, drop the duplicate "Legal" landmark. |
| C5-42 | 4 | 4 | Routed as a chore. TE: 165 files read source text, plus two wall-clock races (`lib/connections.test.ts:1462`, `lib/connections.hardening.test.ts:147`). First slices per RT/PR: steering properties and privacy leak paths. |
| C5-40 | 4 | 3 | I conceded "not a feature" in my own r2. EN/VW: a doc line plus one name in `coverage()`'s `pg_settings` list (`lib/sync-shard.ts:461-462`), after #84, or a note in F-31's limits block. Routed as a chore. |
| MK-P4 | 2 | 1 | LC's block conditions (no filter on returns, rank or symbol; F-3 review; OD 2.47). MA: no willingness-to-pay data. |
| L-28 | 5 | 0 | Chair note 1, RT (rt/p1.ts: `excl: 2`, nothing published), TR, UX, VW, EN and my own r2: #89 already counts every later sell (`lib/trades.ts:48-53`). F-28's "later lots fresh" would loosen main and cost a second rebuild sweep. Let it lapse with an owner note that OD 2.27 is overtaken by #89. |
| L-30 | 4 | 2 | RT/TR/VW (L-30): with evidence, the same-day short is already counted on main. Residual: the readout stamp-pattern row (a chore, or F-31's readout) and broker-position evidence (protected `lib/broker.ts`: owner). Re-approve only that residual, never loosening #89. Otherwise let it lapse. |
| L-29 | 4 | 4 | Unchanged. Gate state stays in the cache keys. UX: one layout AC for the pane slot. |
| L-21 | 4 | 4 | Unchanged. TE: the guard lists in-memory `MatchResult` `excluded*` keys (`excludedHeld` from #84). PR: OD 2.7's consent version should name public exclusion counts. |

ROUTE: C5-43=chore, C5-42=chore, C5-40=chore, C5-39=chore, C5-38=chore, C5-36=chore, C5-37=chore, C5-34=fixes, C5-41=fixes, MK-P6=fixes

### CO (round 3)

#### Round 3: CO (contrarian / common sense), revised ballot

| Item | R1 | R3 | Changed because |
|---|---|---|---|
| C5-1 | 4 | 4 | Unchanged. Interim transfer line after #84 now; full rule waits on OD 2.28 + vendor. PR's condition added: OD 2.7's consent version names public exclusion counts. |
| C5-4 | 4 | 4 | Score unchanged, my split is withdrawn (my r2 concession; RT r2: the spread floor is the part that closes the path, and it amends TR-9). The whole item is "approved, waits on C5 Q3 (+ OD 2.32)". LC/VW's narrow truthful-label fix (never print a zero-width range or "above zero" from it) goes to the fixes lane, with RT's warning that it alone does not close the ranking path. TE: no AC may pin today's order against OD 2.33. |
| C5-5 | 3 | 3 | Held. UX r2 is right that the wording costs nothing, which is why it belongs in the fixes lane. The helper still waits on OD 2.25 and three rebases (EN). Added UX's slot-wide AC (open line + exclusion line + options qualifier: headline and disclaimer in view at 360 px, reflow at 320) and TE's render-equality test. |
| C5-10 | 3 | 3 | Unchanged. Waits on OD 2.7 amended to name the first-connection date (PR, LC). |
| C5-32 | 2 | 3 | Raised: the key objection is gone (EN r2, PR r2: HKDF under a purpose label, `lib/claims.ts:1`, `:50`; no new env). Proportion and timing still hold me below 4: UX/EN r2 show every older code would read "differs" after each queued MATCHER_VERSION bump. Approve only as "build after the matcher slot and f16/f25 merge, before outreach", with LC's words (never "authentic"/"forged"). |
| C5-30 | 4 | 4 | Unchanged; C5-43(d) rides its `lib/sync.ts` slot (VW). |
| C5-31 | 4 | 4 | Unchanged; waits on C5 Q1; one MATCHER_VERSION bump shared with C5-1 (EN). |
| MK-P6 | 3 | 2 | Lowered: chair note 3 / EN. The vendor client exposes no earliest-history date (`lib/broker.ts:89-94`), so by its own fallback it is one /how sentence: fixes lane (F5-6). |
| C5-43 | 3 | 3 | Score held as "chore, not slot". RE/EN/TE r2: (b) must land before the first matcher bump (`lib/matcher-rebuild.ts:10-18`). |
| MK-P3 | 1 | 1 | Held; veto stands as briefed. GR/TR/VW/PR accept the figure-free reshape. BL r2 is right that a figure-free image is then just a link button, which is not worth a slot this cycle. |
| C5-34 | 4 | 3 | Lowered: EN/UX/VW r2. A preview already exists (`app/u/[handle]/share-prompt.tsx:38`). The real defect is GR's mismatch (it previews the opengraph card while Share sends `/story?format=square`, `share-card.tsx:16`), and that is fixes-lane size. AC: the preview `src` equals the URL Share sends. |
| C5-35 | 4 | 4 | Held. Added LC's condition (the confirmation page says vendor-side removal can finish later; static, no handle in the URL) and RT's (it must not frame deletion as a clean slate while reconnecting re-attaches the same history, ux-15; wording follows OD 2.9). It may ride f16/f17's follow-up with C5-26 (BL/VW). |
| MK-P5 | 2 | 2 | Held (UX, BL r2). GR/MA's conditions (shared `lib/copy.ts` constants, Demo only) would make it acceptable later, as an outreach asset once OD 2.62 opens. |
| C5-33 | 4 | 4 | Held. DS r2: build as F-18's first slice (the glyph comes from the shared `Badge`, `app/ui.tsx:29`); VW: a demo-only stock page keeps a visible Demo label. |
| C5-39 | 3 | 3 | Chore lane after F-25 with one shared arrow component and an a11y-tree scan (TE, GR, PR). |
| C5-36 | 3 | 2 | Lowered: TE r2 ("Thesis held" is pinned by `lib/report-copy.test.ts:10` and a DS ruling) and EN r2 ("if you publish" renders only when true, `app/settings/page.tsx:44`). Two of the three copy lines may be wrong. The nav goes to the owner via F-18 (UX: as a dated question). |
| C5-41 | 2 | 2 | Held; only LC's reshaped words, as a copy fix with the re-sign, when billing nears. |
| C5-38 | 3 | 3 | Chore. |
| C5-37 | 2 | 1 | Lowered: LC/DS r2. Removing the disclaimer conflicts with F-3 R8 (`docs/features/logs/F-3/committee-2026-11-01.md:41`). What remains is A11Y/DS's chore: a muted variant and no duplicate "Legal" landmark. |
| C5-42 | 2 | 3 | Raised: RE/TE r2. The wall-clock race tests (`lib/connections.test.ts:1454`, `lib/connections.hardening.test.ts:147`) flake under load and invite loosening. Add-only, chore lane, RT's steering properties first. |
| C5-40 | 2 | 2 | Chore after #84 (RE: one name in `coverage()`). |
| MK-P4 | 1 | 1 | Unchanged (LC's blocking conditions; no willingness-to-pay data, MA). |
| L-28 | 4 | 0 | Reversed: chair note 1, RT r2 (rt/p1.ts: F-28's own probe publishes nothing on main), EN/RE r2. #89 counts every later sell after an oversell (`lib/trades.ts:48-53`), and F-28's "later lots fresh" would publish +65% where the true figure is +10% (fixes-cycle4 committee `:119-122`). Re-approving it as written is harmful. Let it lapse, with an owner note that OD 2.27 is overtaken by #89. |
| L-30 | 4 | 2 | Lowered: RT/TR r2. With evidence, main already counts. Only residuals remain: broker-position evidence (protected `lib/broker.ts`, owner) and a readout class-count row (a chore, or F-31's block). |
| L-29 | 4 | 4 | Unchanged; build with the legal words first; UX's slot-wide 360 px AC. |
| L-21 | 4 | 4 | Unchanged; TE: the guard lists in-memory `excluded*` keys (e.g. #84's `excludedHeld`); PR: the consent version names exclusion counts. |

ROUTE: C5-43=chore, C5-39=chore, C5-38=chore, C5-40=chore, C5-42=chore, C5-36=chore, C5-37=chore, C5-34=fixes, C5-41=fixes, MK-P6=fixes, C5-5 (wording part)=fixes, C5-4 (zero-width label part)=fixes.

## Round 4: the leading set and the red team

### Chair's leading set and round-4 amendments


Round 3 means: r3-table.md. Approval needs a round-3 ("second vote") mean >= 3.5, then >= 10/15 in round 5, no veto.

#### Routed by round 3 (majority ROUTE; off the feature ballot, no feature file)
- Chore lane (15/15 each): C5-43 (part b lands before any MATCHER_VERSION bump), C5-39, C5-38, C5-40, C5-42, C5-36
  (duplicate "Record tools" and "if you publish" only; the nav label goes to the owner via F-18; "Thesis held" stays,
  pinned by a ruling at lib/f26-held-like-none.test.ts:99), C5-37 (keep the disclaimer sentence muted, per F-3 R8; drop
  only the duplicate legal links/landmark).
- Fixes lane: MK-P6 (one /how sentence; the vendor has no earliest-date field), C5-41 (LC's words only), C5-34 (14/15:
  the preview src equals the image Share sends; lazy in the Share box).
- Split-offs to the fixes lane (CO, DS, LC, EN): C5-4's zero-width range suppression ("show no range" until OD 2.32);
  C5-5's "per closed trade" wording.

#### Below 3.5 (wait for the next cycle): C5-32 3.47, C5-35 3.47, C5-33 3.40, C5-10 3.33, MK-P5, MK-P3, MK-P4, L-30, L-28.
- L-28 (0.47): lapses to draft. Owner note: OD 2.27 is overtaken by #89 (lib/trades.ts:48-53). LC and CO veto any
  re-approval as written.
- L-30 (2.07): lapses to draft. Residual readout class-count row -> chore; broker-position evidence -> owner.

#### Leading set (proposed F-numbers by round-3 mean; ties by round-1 mean)
1. **F-32 = C5-1 Transfers never hide a chosen loss (4.93).**
   - Part A (interim, builds after #84 merges): every sell the backward window excludes because of a transfer row is
     counted under its own reason "transfer", never the generic line, through F-21's one exclusion-sum function; count
     only (no units, no date of the transfer); neutral muted wording; one MATCHER_VERSION bump shared with F-36, after
     chore C5-43(b). Covers all three RT forms (transfer in, transfer out with 0 held, no-units row).
   - Part B (full form, waits on OD 2.28 + the vendor's written MRC2-10 answer that a split/stock dividend never arrives
     as a transfer row): transfer rows leave the backward window; forward taint unchanged; unpaired ADJUSTMENT stays.
   - AC: seeded property test, random fictional ledgers, a transfer row (in/out/no units, any date) inserted never
     raises a shown average or win rate (Part B); Part A: the p5 probe shows a "transfer" count of 1, not the generic
     line; a split inside the window still taints; every existing window test kept.
   - Status: blocked on #84 (F-24 edits replay/MatchResult in lib/trades.ts). Part B blocked on OD 2.28 + vendor.
2. **F-33 = C5-4 Ranking weight needs evidence (4.00).** Approved, waits on C5 Q3 (amends protected TR-9; replaces the
   owner's 10-bet floor) and OD 2.32 (wording); works inside OD 2.33's method. 1-point floor in the error term (jitter
   probe 0.296); symmetric for losses; below the tier ordered by recency with a stable tie-break, never hidden, never by
   trade count; property test "keeps the order of the method OD 2.33 picks" (not today's); the printed range unchanged
   at or above the floor. Status: blocked on owner.
3. **F-34 = C5-5 One open-positions line on every surface (3.87).** One producer; values follow OD 2.25 (yes: 2.25's
   line everywhere; no: F-4's card line, lowest first, down colour via --loss and a minus sign and word). No unrealized
   value on any surface that has none today before 2.25. Render-equality test (byte-identical open line across card,
   pane, profile, both strips and image alts) plus image snapshots. Status: blocked on OD 2.25, and on f16/f17 (#100)
   and f25 merging (they edit all four image routes).
4. **F-35 = C5-30 A trade is published once its date has passed (3.87).** Rows up to 24 h ahead stay stored and
   counted on their future line, publish when executed_at <= database now(); one indexed query per sync tick finds
   matured rows and schedules a rebuild under the per-user advisory lock with no new activity; tests relative to
   now(); existing 24 h-grace tests get twins, never deleted; e2e: the month page's "through today" holds. Status:
   blocked on #84 (same future-count query and lib/sync.ts).
5. **F-36 = C5-31 Fees in the return's denominator (3.80).** Approved, waits on C5 Q1 (DESIGN §2.5). One MATCHER_VERSION
   bump with F-32, after C5-43(b); dated /how formula note; the exit-fee > proceeds case pinned; zero-fee fixtures
   byte-identical; the PR lists every changed expectation; no fee amount shown anywhere. Status: blocked on owner.
6. **F-29 re-approved (L-29, 4.33).** LC has now signed the interim words (r1-LC.md): "Option results are not shown on any
   record at present. Where option trades or open options were imported, the record shows how many, and its headline
   figures exclude options." Code prerequisites merged (#85, #77). Every earlier decision kept word for word; the last
   qualifier on a surface is never removed; tests in both optionsPublic() states; gate state in cache keys. Status:
   ready (hand-off: rebase on F-23 #97 if it merges first, both edit app/pane.tsx).
7. **F-21 re-approved (L-21, 4.13).** Every earlier decision kept; the shared sum also covers excluded_options_*,
   excluded_exercise_shares, #84's excludedHeld and F-32's transfer reason; the new-counter guard enumerates MatchResult
   excluded* keys as well as schema columns; one slot with F-23/F-34 pane files. Status: blocked on F-23 (#97) merging.

Slots (new features only): matcher (F-32 + F-36), ranking (F-33), pane/strip (F-34; F-29 and F-21 ride as
re-approvals), sync (F-35) = 4 of 6. Active without owner answers: F-29 now; F-32 Part A and F-35 after #84; F-21 after
#97 = three slots (matcher, sync, pane), within CO's cap.

Privacy flags for the owner (PR, LC): OD 2.7's consent version should name the public exclusion counts (F-32, F-21).

#### Round 4 amendments (the chair adopts every fix in r4-RT.md; read it)
- **F-32** retitled "Transfers are named, and never remove a trade after it closes". Part A: the "transfer" reason covers
  every exclusion a transfer row causes (the backward window, the same-day rule, and forward-tainted draws); a split or
  stock dividend takes precedence when both apply. Part B's property test is scoped to transfers dated AFTER the sell;
  a second pinned test records the forward case (transfer before the sell, probe p4) as still excluded and counted
  under "transfer", routed by name to OD 2.28 / F-22. Part A gets its own MATCHER_VERSION bump after C5-43(b); no
  shared bump with F-36.
- **F-33** below the tier keeps today's score order (weight 0; `lib/feed.ts:26`), no new recency-only order; never by
  trade count or frequency. New AC: a fictional "30 winners at +1%, 10 losers held open at −20%" record never outranks a
  200-bet record with the same closed figures, or the file states it cannot pass without OD 2.34 and routes it to the
  owner with C5 Q3. The printed-range change lands in one place and supersedes the fixes-lane zero-width suppression.
- **F-34** the open line uses the record's account set (fixture with a paper and a notShared account); images carry the
  positions' as-of date beside any unrealized value; the render-equality test is written after OD 2.25 is answered.
- **F-35** a watermark so each matured row triggers exactly one rebuild; the e2e runs under TZ=UTC and one other zone.
- **F-36** its own MATCHER_VERSION bump (decoupled from F-32); a lot with no basis or zero price is never priced by fees
  (stays counted); the PR notes it aligns stocks with options' basis (`lib/options.ts:145`, `:220`); one /how formula.
- **F-29** UX's shared pane AC binds the pane slot (F-29, F-21, F-34): with all lines present on a fictional record the
  headline and disclaimer stay in view at 360 px and reflow at 320 px; one builder owns the line order.
- **F-21** the sum counts sells and option closes only (excluded_future also counts buys, `lib/sync.ts:181`), or the
  line says "items"; the guard covers the options and public-filing result keys as well as MatchResult excluded* keys.
- **Routing fix:** the C5-4 zero-width split in the fixes lane prints the existing "Too early to tell" string
  (`app/t/[symbol]/page.tsx:127`) and drops "Past results: above zero"; never a blank range.

### RT (round 4, the case against)

#### Round 4: RT, the case against each leading item as shaped

Base: origin/main e16d6aa. Probes use fictional trades and live only in the scratchpad: rt/p1.ts, rt/p2.ts and rt/p4.ts
(new in this round).

#### F-32 (C5-1) Transfers never hide a chosen loss: answerable (the title and one AC are false as shaped)
- **The forward path is untouched, and it is the bigger one.** p4.ts holds WX 100 @100 open, takes a +1 TRANSFER in
  30 days before the sell (outside the 14-day window), then sells @40. The −60% vanishes: corp 1, win 50%→100%,
  avg −10%→+40%. A no-units transfer row and a −1 transfer out while holding do the same. The unpriceable action
  taints every open lot of the pair (`lib/trades.ts:73-75`, "an unpriceable action taints them"). Part B keeps the
  forward taint "unchanged". So even after Part B a trader hides an open loser at will, with no time limit.
- **Consequences for the AC and the title.**
  - The title "never hide a chosen loss" is false as shaped (contrarian: dishonest label).
  - Part B's AC "a transfer row (in/out/no units, any date) inserted never raises a shown average or win rate" fails
    its own probe for any transfer dated before the sell.
  - Part A counts only window exclusions under "transfer". The forward-taint exclusions stay on the generic corporate
    line, so the more common at-will route keeps the vague label.
- **Same-day rule.** A transfer on the sell's own day (p4: same-day, after the sell) excludes through
  `sameDayAction`, not `latePosted`. Part A's text names only "the backward window".
- **Precedence.** With both a split and a transfer in the window (p4), the sell is excluded either way. Part A needs a
  rule for which reason it gets. A split must win, or a trader's transfer could relabel a real split exclusion. The
  reverse is harmless.
- **Sequencing.** "One MATCHER_VERSION bump shared with F-36" cannot hold. Part A can build after #84, but F-36 waits
  on C5 Q1. Either Part A waits for the owner or there are two bumps.

Fix that would answer it:
- Retitle: "Transfers are named, and never hide a loss after it is closed."
- Part A: the "transfer" reason covers every exclusion a transfer row causes. That means the window, the same-day
  rule, and forward-tainted draws from a transfer row. A split or stock dividend takes precedence when both apply.
- Part B's property test is scoped to transfers dated after the sell. Pin a second test that records the forward case
  as still hidden and counted under "transfer", and route that to OD 2.28/F-22 by name.
- Allow a separate bump for Part A, after C5-43(b).

#### F-33 (C5-4) Ranking weight needs evidence: answerable
- **The hold-losers-open recipe survives at the tier.** Close winners at a fixed +1% target and leave losers open:
  thirty closes over 90 days reach the moderate tier. A 1-point per-trade floor gives a standard error of about
  0.18 pt at k = 30, so the interval is still wholly above 0 and the record ranks. The floor raises the cost (30 bets
  over 90 days instead of ten closes). It does not close the path. Only open positions in the range (OD 2.34) or an
  open-loss check at rank time does.
- **"Below the tier ordered by recency" is a new order, not C5-4's need.** Weight 0 today already falls back to
  score order, which is size × recency decay (`lib/feed.ts:26`, `lib/trades.ts:575-579`). Pure recency lifts whoever
  closes most often, which is close to a reward for trade frequency (POLICY never-rule). "Never by trade count" does
  not prevent it.
- **Two producers.** The fixes-lane split suppresses a zero-width range now, and F-33's floor changes the printed
  interval later. The two need one owner of the printed range.

Fix that would answer it:
- Below the tier, keep today's score order (weight 0). No new recency-only order.
- Add an AC: a fictional "30 winners at +1%, 10 losers open at −20%" record never outranks a 200-bet record with the
  same closed figures. If that cannot pass without OD 2.34, say so in the file and route it to the owner with Q3.
- The printed-range change lands in one place, superseding the fixes-lane suppression.

#### F-34 (C5-5) One open-positions line on every surface: answerable
- **Its own AC cannot pass before OD 2.25.** A byte-identical open line across card, pane, strips and alts is
  impossible while card and pane show unrealized values and strips may not gain them. That is fine only because the
  status is blocked. The file must say the equality test is written after 2.25, or a builder will "fix" it by adding
  values to strips or stripping F-4's card content.
- **Same account set.** The open line must use the same accounts as the record. Positions come from `real` accounts
  per sync (`lib/sync.ts:604-606`). Paper and `notShared` accounts must not feed a public open line that the closed
  figures leave out, or the line describes a different record.
- **Staleness.** "Lowest first" on a cached image shows a value from the last positions read. It needs its as-of
  date, or a stale −3% beside a now −30% understates the open loss.

Fix that would answer it:
- An AC that the open line's account set equals the record's account set (fixture with a paper account and a
  `notShared` account).
- Images carry the positions' as-of date beside any unrealized value.
- The equality test applies after 2.25 is answered.

#### F-35 (C5-30) Publish once the date has passed: no fatal case
- No trader steering. Dates are the vendor's.
- The rebuild is from scratch, so a held BUY that matures fixes any temporary oversell or gap on its pair.
- Dates render in UTC (`lib/date-text.ts:5-6`), and `now()` is compared in UTC, so "through today" holds in UTC. The
  e2e must pin UTC, not the runner's zone.
- Two small risks.
  - The "matured rows" query must use a watermark. Without one it re-finds the same rows every tick and rebuilds each
    trader hourly.
  - `excluded_future` counts activities of both sides (`lib/sync.ts:181`). F-21 sums it into a trade-exclusion line
    (see F-21).

No fatal case. Add: a watermark (the last rebuild time, or the matured row's date) so each matured row triggers
exactly one rebuild, and the e2e runs under TZ=UTC plus one other zone.

#### F-36 (C5-31) Fees in the denominator: no fatal case
- No sign changes: the numerator is unchanged, so the win rate is unchanged and only magnitudes shrink.
- It aligns stocks with options, whose basis already includes the entry fee (`lib/options.ts:145`, `:220`). The PR
  should say so, and the /how note can state one formula for both.
- The one real conflict is the shared bump with F-32 Part A (above).
- Watch for lots with no basis or zero price (F3-1 rows) dividing by fees alone. They are counted today and must stay
  counted.

No fatal case. Add: a test that a no-basis lot is never priced by fees alone, and that the bump is decoupled from F-32
Part A.

#### F-29 Gated options wording: no fatal case
- The gate is global: `optionsPublic()` returns false for every trader, demo included (`lib/options-load.ts:36`;
  `lib/options-gate.ts:16-19`). So "Option results are not shown on any record at present" is true today. Today's
  /how line ("consented", `lib/copy.ts:549`) is the false one.
- One risk: on the day the gate opens, the switch back to the legal sentence re-creates the "consented reads as
  withheld" problem (F-29's own red-team note). That is the owner's checklist line, kept.
- The pane will carry the options qualifier, F-21's line and F-34's line together. UX's shared 360 px AC must bind
  this slot too.

No fatal case. Add UX's shared slot AC: all three lines present, and the headline and disclaimer stay in view at
360 px.

#### F-21 Exclusion counts beside the headline: answerable
- **Mixed units under one number.**
  - `excluded_future` counts activities, buys included (`lib/sync.ts:181`).
  - The option counters count option trades. `excluded_exercise_shares` is set from removed share rows
    (`lib/options-sync.ts:227`).
  - The pane line states one count, so a fictional record with one future BUY and two corporate sells reads
    "3 excluded" beside a headline of closed trades.
  - That overstates exclusions, and it lets a trader whose broker posts future-dated buys inflate the line. The
    reverse direction (the line hides nothing) is safe, but the number is not one thing.
- **The share card and feed card still show the clean headline** (owner Q4, D22), and those are the most copied
  surfaces. That is a decided limit, not a defect. Record it in the file as the remaining gap for at-will routes (F-32
  forward path).
- **The guard must cover the options matcher's result keys** as well as `MatchResult` (`lib/trades.ts:39`), and
  public filings' `excluded` record (`lib/public-trades.ts:25`), so a new kind in either is summed or named.

Fix that would answer it:
- The line's number counts sells and option closes only. `excluded_future` counts its sells, or the line reads "‹n›
  items excluded" with the profile's per-reason lines one tap away.
- The equality test runs over a fixture with a future BUY.
- The guard enumerates all three result shapes.

#### Routing
- **C5-4's fixes-lane split.** "Show no range until OD 2.32" on a zero-width record leaves that record ranked at
  0.299, near the top of the feed, now with no range at all. A reader then has less to judge the top card by than
  today. Print the existing constant `early: 'Too early to tell'` (`lib/copy.ts:225`, per LC, which needs no new
  wording), never a blank. Also drop "Past results: above zero" (`trustSign`) in that case.
- **L-28 lapse.** Correct. The owner note should also say that the true-cause wording is already on main
  (`lib/copy.ts:73`), so nothing of F-28 is pending.
- **L-30 residual to chore.** Correct. The readout row must stay counts-only and suppressed under 5 (F-30's own
  decision).
- Nothing else is wrong in the routing. C5-43(b) before any bump is the right gate.

## Round 5: final ballots

### TR (round 5)

#### Round 5: TR (trader). Final ballot

| Item | Vote | Conditions (beyond leading-set.md and its round-4 amendments) |
|---|---|---|
| F-32 (C5-1) Transfers are named, and never remove a trade after it closes | AC | Moving shares between one's own brokers is normal for an honest trader. The /how reason behind the "transfer" count must say it is a limit of matching, not a judgement of the trader: no blame word, same muted style as the other reasons. I accept RT's retitle and the pinned forward case routed to OD 2.28 / F-22. |
| F-33 (C5-4) Ranking weight needs evidence | AC | /how explains in plain words why a record below the tier does not yet carry ranking weight, so a new trader doesn't read it as a penalty. A record below the tier stays visible in the feed in today's score order (already in the amendment). |
| F-34 (C5-5) One open-positions line on every surface | AC | none beyond the amendments (account-set fixture, as-of date on images, the equality test written after OD 2.25). |
| F-35 (C5-30) Published once the date has passed | AC | none (watermark and the two-zone e2e already added). |
| F-36 (C5-31) Fees in the return's denominator | AC | none beyond the amendments. The changed figures appear through the normal rebuild, with no alert or "your return dropped" message pushed to the trader. The dated /how note is the record of the change. |
| F-29 (re-approval) Gated options wording | A | none. LC's signed words are true today: the gate is global (`lib/options-gate.ts:16-19`). UX's shared pane AC binds the slot. |
| F-21 (re-approval) Exclusion counts beside the headline | AC | none beyond the amendments (counts sells and option closes only, or reads "items"; the guard covers all three result shapes). |

Lapses: agree. L-28 lapses to draft, with the owner note that OD 2.27 is overtaken by #89 and the true-cause wording is
already on main (`lib/copy.ts:73`). The trader-fairness residual goes to the owner: the oversell mark never clears
(`lib/trades.ts:54-57`), and releasing it needs vendor position units. L-30 lapses to draft. Its readout class-count row
goes to the chore lane (counts only, suppressed under 5), and broker-position evidence goes to the owner.

Routing: agree, including RT's fix: the C5-4 zero-width split prints "Too early to tell" and drops "Past results: above
zero", never a blank range. Trader note: C5-34 (the fixes lane) should land this cycle, because it is the one place a
trader can see the exact picture Share sends.

Veto: n/a (TR holds no veto).

### VW (round 5)

#### Round 5: VW (viewer lens) final ballot

| Item | Vote | Conditions (beyond leading-set.md and its round-4 amendments) |
|---|---|---|
| F-32 (C5-1) | AC | A signed-out viewer can read the "transfer" reason without help: "excluded: shares moved into or out of the account", one tap to /how, no blame word. No copy anywhere claims transfers can no longer hide a loss while the forward case (p4) stands; the retitle is the honest limit. |
| F-33 (C5-4) | AC | Until the owner answers, the fixes-lane step (RT routing: print "Too early to tell", drop "Past results: above zero") is live on every surface that prints a range: card, pane, profile, strip and /t, never just one. |
| F-34 (C5-5) | AC | None beyond the amendments (the as-of date beside any unrealized value is the viewer condition I wanted). |
| F-35 (C5-30) | AC | The profile's future line says in plain words that the trade is dated after today and will appear once that date passes. |
| F-36 (C5-31) | AC | The dated /how note says that returns with entry fees were recalculated on that date, so a viewer comparing an older screenshot finds the reason. |
| F-29 (re-approval) | AC | None (LC's signed words are true today; the UX shared pane AC binds the slot). |
| F-21 (re-approval) | AC | Prefer the sells-and-option-closes count over "items", so the number shares the headline's unit (closed trades). If "items" is used, the per-reason lines are one tap away. |

Lapses: agree (L-28 to draft with the owner note that OD 2.27 is overtaken by #89, true-cause wording already on main at `lib/copy.ts:73`; L-30 to draft, readout row to chore, counts-only, suppressed under 5, broker-position evidence to the owner).
Routing: agree, including RT's fix to the C5-4 split (never a blank range).

### BL (round 5)

#### Round 5: BL (business lead), final ballot

Read: leading-set.md (with the round-4 amendments) and r4-RT.md. I vote on the shapes as amended.

| Item | Vote | Conditions (beyond leading-set.md and its round-4 amendments) |
|---|---|---|
| F-32 (C5-1) Transfers are named, and never remove a trade after it closes | AC | RT's p4 shows the forward at-will path survives even Part B. So the owner note puts OD 2.28 (F-22) on the launch-relevant list before Beta wave 0. No outreach or first-contact copy may say a trader "can't remove a loss" until Part B and F-22's forward rule land. Use "can't hide single trades" (LC's C5-41 wording). Part A ships before any real connect. |
| F-33 (C5-4) Ranking weight needs evidence | AC | The owner gets C5 Q3, OD 2.32 and OD 2.34 in the same sitting, because RT's hold-losers-open recipe is closed only with 2.34. The readout shows how many visible records carry rank weight above 0 (counts only, suppressed under 5), so the owner can see what the floor does to a wave-0 feed. |
| F-34 (C5-5) One open-positions line on every surface | AC | none |
| F-35 (C5-30) A trade is published once its date has passed | A | none |
| F-36 (C5-31) Fees in the return's denominator | AC | none |
| F-29 re-approved (L-29) | A | none (the pane-slot AC is already in the amendments) |
| F-21 re-approved (L-21) | AC | Record in the file, as a decided limit, that the share card and feed card keep the clean headline (owner Q4, D22) (RT, F-21). Those are the most copied surfaces, so the limit stays visible to the owner beside F-32's forward path. |

**Lapses (L-28, L-30 to draft with owner notes): agree.** The L-28 owner note also says the true-cause wording is
already on main (`lib/copy.ts:73`), so nothing of F-28 is pending (RT). The L-30 residual readout row stays counts-only
and suppressed under 5.

**Routing: agree.** That includes RT's fix to the C5-4 split (print the existing "Too early to tell" and drop "Past
results: above zero", never a blank range), and C5-43(b) before any MATCHER_VERSION bump.

Business note: this is 4 of 6 slots, 3 of them active without owner answers. That is right for a pre-G1 product: merge
safety over throughput.

### UX (round 5)

#### Round 5: UX lead, final ballot

| Item | Vote | Conditions (beyond leading-set.md and the round-4 amendments) |
|---|---|---|
| F-32 (C5-1) | AC | The "transfer" reason is one copy constant, worded identically on the profile's exclusion list and in F-21's pane line. It is plain and neutral ("a share transfer"), never a blame word. The retitle is adopted. |
| F-33 (C5-4) | AC | One producer of the printed range and "Too early to tell" across card, pane, profile and strip. A render-equality test covers it once OD 2.32 is answered. |
| F-34 (C5-5) | AC | TR-4 prominence: whichever answer OD 2.25 gets, the open line sits in the same block as the headline figures on every surface, never in a caption or foot. Under "yes", 2.25's line keeps that position. |
| F-35 (C5-30) | AC | none |
| F-36 (C5-31) | AC | The /how formula is in plain words with one fictional worked example (e.g. 2 @5, fee 10, sold @15 → +50%). |
| F-29 (re-approval) | AC | none (the shared 360/320 px pane AC is already bound). |
| F-21 (re-approval) | AC | Prefer the sells-and-option-closes count over the "items" fallback, because "items excluded" beside a closed-trade headline is vague. The link lands on the profile's exclusion reasons with focus there. |

Lapses (L-28, L-30 → draft with owner notes): agree; add RT's note that F-28's true-cause wording is already on main (`lib/copy.ts:73`).
Routing: agree, including RT's fix that the C5-4 zero-width split prints "Too early to tell" and drops "Past results: above zero", never a blank range.

### EN (round 5)

#### Round 5: EN (engineer), final ballot

| Item | Vote | Conditions (beyond leading-set.md + round-4 amendments) |
|---|---|---|
| F-32 (C5-1) | AC | Part A rebases on #84's `replay`/`MatchResult` (lib/trades.ts) and its `excludedHeld` key: "transfer" becomes one more `excluded*` key, so F-21's guard sees it. Forward-tainted draws need a per-lot cause tag on the taint (lib/trades.ts:73-75), not a second pass. Cap: one matcher builder at a time; F-32's bump and F-36's bump never land in the same deploy, so C5-43(b) can drain each. |
| F-33 (C5-4) | AC | Score-order fallback unchanged at weight 0 (lib/feed.ts:26). lib/feed.ts is edited by f16 and f25: build after both merge. The DESIGN TR-9 text edit goes in the owner's PR, never the build PR (protected path). |
| F-34 (C5-5) | AC | Build only after f16/f17 (#100), f25 and F-23 (#97) merge. The single producer lives in lib/record-strip.ts or lib/copy.ts and is imported by the image routes, never duplicated in a route. |
| F-35 (C5-30) | AC | The watermark is an additive column or a derived max over existing rows: no drop or rename (schema guard). f24 and f31 both edit db/schema.sql, so the migration rebases on whichever lands first. The matured-row query uses an index on (executed_at), or the PR measures it at LOAD scale. |
| F-36 (C5-31) | AC | Its own bump, never in the same deploy as F-32's. No new column (fees already stored on activities). The PR lists every changed fixture expectation. |
| F-29 (L-29) | AC | Ready now, but its first commit rebases on F-23 if #97 merges first (app/pane.tsx, app/u/[handle]/chart.tsx, lib/copy.ts on both). Cache-key change covered by a test in both `optionsPublic()` states. |
| F-21 (L-21) | AC | After #97. Its sum reads `excluded_future` sells-only, which needs #84's future-count query (lib/sync.ts:181 is edited on f24): build after #84 too, or use "items" wording. |

Lapses (L-28, L-30 to draft with owner notes): agree. Routing: agree, including RT's fix that the C5-4 zero-width split prints the existing "Too early to tell" and drops "Past results: above zero".
Slots: 4 of 6 (matcher F-32+F-36, ranking F-33, pane/strip F-34 with F-29/F-21, sync F-35); confirmed, no file overlap across slots except F-32/F-35 both rebasing on #84, which is serial anyway.

### TE (round 5)

#### Round 5: TE (tester), final ballot

All conditions in leading-set.md and its round-4 amendments are accepted. The conditions below are only the ones not
already there.

| Item | Vote | Conditions (beyond leading-set.md) |
|---|---|---|
| F-32 | AC | The property test logs its seed and replays a fixed seed set in CI, so a failure can be reproduced. The precedence rule ("a split wins over a transfer") is its own unit test with both rows in the window. The forward-case pin (p4) asserts both the "transfer" reason and the count, so a later relabel to "corporate" fails the test. |
| F-33 | AC | Boundary tests at the tier edge: 29 against 30 bets, and 89 against 90 days. The jitter probe (0.296) is pinned below the 200-bet record. If the hold-losers-open AC is routed to OD 2.34, it stays in the file as a `todo` test, never deleted. |
| F-34 | AC | Until OD 2.25 is answered, a guard test pins today's surfaces: no unrealized value on the strips or their images. The test is replaced by the equality test only when 2.25 is answered, and the test count never drops. Test that the as-of date sits beside every unrealized value on the images. |
| F-35 | AC | The watermark test runs two consecutive sync ticks with one matured row and asserts exactly one rebuild, counted with a stub. A third tick with no new matured rows triggers none. |
| F-36 | AC | A fixture check that every changed expectation's trade has an entry fee above 0, and every zero-fee fixture is byte-identical. The changed list in the PR comes from the test run's output, not a hand-written list. |
| F-29 | AC | The cache-key test flips the gate within one process and asserts that the next /how, profile and share bodies differ from the pre-flip bodies. A test asserts the legal committee's signed words verbatim. |
| F-21 | AC | The guard is mutation-checked in the PR: adding a dummy `excludedX` key to each of the three result shapes (MatchResult, the options result, public filings) makes the guard fail. The equality fixture includes a future BUY, per RT. |

**Lapses:** agree. L-28 goes to draft with the owner note "OD 2.27 is overtaken by #89; the true-cause wording is
already on main". L-30 goes to draft, with the readout row as a counts-only chore suppressed under 5, and the
broker-position evidence as an owner item.

**Routing:** agree. This includes C5-43(b) landing before any MATCHER_VERSION bump, "Thesis held" staying (pinned at
`lib/f26-held-like-none.test.ts:99`), and the C5-4 fixes-lane split printing the existing "Too early to tell" string,
never a blank range. Each chore lists its named test in its fixes-lane entry, because the test-count guard
(`scripts/autopilot.ts:206`) does not require new tests.

### RT (round 5)

#### Round 5: RT final ballot

| Item | Vote | Conditions (beyond leading-set.md and the round 4 amendments) |
|---|---|---|
| F-32 Transfers are named, and never remove a trade after it closes | AC | The /how line for "transfer" names a reason without blaming the trader. The PR says plainly that the forward path (transfer before the sell, probe p4) still excludes a loss until OD 2.28 / F-22. The build adds no `excluded_transfer` public field before OD 2.7's consent version names exclusion counts (PR flag); until then it reuses the existing public exclusion surface. |
| F-33 Ranking weight needs evidence | AC | Waits on C5 Q3 + OD 2.32. Run the open-losers AC first: if it cannot pass, the owner question names OD 2.34 explicitly. |
| F-34 One open-positions line | AC | Waits on OD 2.25. The as-of date uses the positions read time, not the page render time. |
| F-35 Publish once the date has passed | AC | After #84. The F-21 sum stays per the F-21 amendment (sells only), so maturing future buys never move the pane count. |
| F-36 Fees in the denominator | AC | Waits on C5 Q1. Every changed expectation is listed in the PR, and the deploy rebuild reports how many trades changed sign (expected 0). |
| F-29 (re-approval) | AC | The signed words are recorded in the PR. Tests run in both gate states. |
| F-21 (re-approval) | AC | Its line links to the per-reason lines, which include F-32's "transfer" reason once it lands. |

Lapses: agree (L-28 → draft, with the owner note that OD 2.27 is overtaken by #89 and that the true-cause wording is on main; L-30 → draft, with its readout row as a chore and broker-position evidence going to the owner).
Routing: agree, with the round 4 fix (C5-4 split prints "Too early to tell" and drops "above zero").

### LC (round 5)

#### Round 5: LC (legal committee), final ballot

Base: leading-set.md with the round-4 amendments (r4-RT.md adopted). Not legal advice; these are the AI legal
committee's findings, which the owner accepts in place of counsel.

| Item | Vote | Conditions (beyond leading-set.md) | Veto |
|---|---|---|---|
| F-32 (C5-1) | AC | **Labels.** The "transfer" reason's public words are neutral and muted ("‹n› excluded: a transfer"), with no blame word. The /how text names transfers in, as POLICY F3 already does. Naming transfers out in POLICY F3 is the owner's edit (OD 2.28 / 3.17). Until then, /how may describe "trades affected by a transfer" additively but must not amend POLICY's list. **Title.** "Never remove a trade after it closes" is true only once Part B lands, so the title is never used as product copy and Part A's PR says what stays open. **Privacy.** The count carries no transfer date or units (P3). | none |
| F-33 (C5-4) | AC | Ranking stays "ordered by the documented method, never endorsement" (F1). /how states the floor in plain words once Q3 and OD 2.32 are answered. No word like "proven", "top" or "skill" anywhere in the change (F3b). | none |
| F-34 (C5-5) | AC | No unrealized value appears on any surface that has none today until OD 2.25 is answered. The vendor's written market-data permission remains a launch gate (POLICY: before a public launch). The images' as-of date sits beside every unrealized value. | none |
| F-35 (C5-30) | A | none | none |
| F-36 (C5-31) | AC | A dated /how formula note, kept as history (COMPLIANCE §12). No fee amount shown anywhere (P3). | none |
| F-29 (L-29) | AC | The builder uses LC's signed words exactly. Any wording change needs LC's re-sign in the PR. While `optionsPublic()` is false, no surface says "consented". The gate-opening checklist line stays with the owner. | none |
| F-21 (L-21) | AC | The number counts sells and option closes only, or reads "items". The words stay "excluded from these figures", never "hidden" or "removed". The disclaimer stays in view at 360 px (F3). Owner flag (PR, LC): OD 2.7's consent version names the public exclusion counts before real users. | none |

#### Lapses and routing: agree

- **L-28** lapses to draft with an owner note: OD 2.27 is overtaken by #89, and the true-cause wording is already on
  main (`lib/copy.ts:73`). LC's F3c veto stands against any re-approval as written.
- **L-30** lapses to draft. The readout row is a counts-only chore, suppressed under 5. Broker-position evidence goes to
  the owner.
- **Routing.**
  - C5-41 in the fixes lane uses LC's words exactly, re-signed in the PR.
  - C5-37 keeps the disclaimer sentence (F-3 R8).
  - The C5-4 split prints "Too early to tell" and drops "Past results: above zero", never a blank range.

#### Veto line

LC veto: none on F-32, F-33, F-34, F-35, F-36, F-29 or F-21 as amended. Standing F3c veto: re-approving L-28 as
written.

### PR (round 5)

#### Round 5: PR (privacy), final ballot

| Item | Vote | Conditions (beyond leading-set.md and its round-4 amendments) |
|---|---|---|
| F-32 (C5-1) | AC | The "transfer" reason stores and shows a count only: no new column with the transfer's units, date or account. It uses the existing exclusion counters and the raw activity already stored. Owner flag kept: OD 2.7's consent version names the public exclusion counts. |
| F-33 (C5-4) | A | None. Ordering traders is within the consent line ("to order traders for readers", `lib/copy.ts:88`). |
| F-34 (C5-5) | AC | Round 4 adds the positions' as-of date to images. Today `open_positions.fetched_at` is labelled "freshness, internal" (`lib/privacy-fields.ts:41`), yet the profile already prints it (`app/u/[handle]/page.tsx:103`, `openAsOf`). The build therefore flags to the owner that the label moves to RECORD_STATE_FIELDS ("open positions as of"), named in OD 2.7's consent version (owner file). Until that happens, the image may show only what the profile already shows. No unrealized value on any new surface before OD 2.25 (already in the set). |
| F-35 (C5-30) | A | None. It publishes less. Keep the watermark internal (never shown). |
| F-36 (C5-31) | A | None beyond the set ("no fee amount shown anywhere"; fees stay private per `lib/copy.ts:88`). |
| F-29 (re-approval) | A | None. It keeps the guard: no public "not asked" or "declined" difference. |
| F-21 (re-approval) | A | None beyond the set. The OD 2.7 owner flag covers the exclusion counts. |

Lapses (L-28, L-30 to draft with owner notes) and routing: agree. That includes RT's notes (true-cause wording on main,
`lib/copy.ts:73`; the L-30 readout row stays counts-only, suppressed under 5) and the C5-4 split printing "Too early to
tell", never a blank.

### A11Y (round 5)

#### Round 5: A11Y (accessibility specialist), final ballot

| Item | Vote | Conditions (beyond leading-set.md and the round-4 amendments) |
|---|---|---|
| F-32 (C5-1) | AC | The "transfer" reason renders through F-21's line and keeps F-21's a11y decisions (text, not colour or icon; a real link to the per-reason lines with a descriptive name; 44 px target; reflows at 320 px). |
| F-33 (C5-4) | AC | "Too early to tell" is visible text, and the range's accessible text equals the visible text. Never a blank range, an icon or a colour alone. |
| F-34 (C5-5) | AC | Each image's alt text carries the same open line and the positions' as-of date as the picture (the alt is part of the render-equality test once OD 2.25 is answered). |
| F-35 (C5-30) | A | none |
| F-36 (C5-31) | AC | The /how formula is plain text (readable by screen readers, reflows at 320 px), not an image. |
| F-29 (L-29) | AC | Keep the AC that the qualifier is announced with the headline figures. UX's shared pane AC applies. |
| F-21 (L-21) | AC | If the line reads "items", the link's accessible name says what is counted (e.g. "‹n› items excluded: see reasons"). Keep every earlier a11y decision. |

Lapses (L-28, L-30 to draft with owner notes): agree.
Routing: agree. Condition, per TE's chair-note-6 point: each routed a11y chore lists its named test in its fixes-lane
entry and lands this cycle:
- C5-39: an accessibility-tree scan;
- C5-38: a forced-colours e2e;
- C5-37: a landmark-uniqueness check (one "Legal" nav).

C5-39 must not drop a third cycle.

### GR (round 5)

#### Round 5: GR (growth) final ballot

| Item | Vote | Conditions (beyond leading-set.md and the round-4 amendments, all accepted) |
|---|---|---|
| F-32 (C5-1) | AC | When the profile is the target of a shared link, the "transfer" count also appears in its link-preview description wherever that description already carries the exclusion line. No new image change (owner Q4 still owns the share card). |
| F-33 (C5-4) | AC | None beyond the amendments. Below the tier, keep today's score order (weight 0), so frequent closers get no lift. This matters for the first-visit feed. |
| F-34 (C5-5) | AC | The render-equality test (after OD 2.25) also covers the trade and month link-preview description text and the image alt texts, not just the rendered lines. Shared trade and month links are the `via=trade`/`via=month` share paths. |
| F-35 (C5-30) | A | None. |
| F-36 (C5-31) | AC | None beyond the amendments (its own bump, the no-basis lot stays counted, one /how formula). |
| F-29 (re-approval) | AC | None beyond UX's shared 360 px pane AC. |
| F-21 (re-approval) | AC | None beyond the amendments (sells and option closes only, or "items"; the guard covers all three result shapes). |

Lapses and routing: **agree.**
- L-28 to draft, with the owner note that #89 overtakes OD 2.27 and the true-cause wording is on main (`lib/copy.ts:73`).
- L-30 to draft. Its readout row becomes a counts-only chore, suppressed under 5.
- Chore and fixes routing as listed. One request for C5-34's fixes entry: the preview `src` equals the image Share
  attaches (`/u/<h>/story?format=square`, `app/u/[handle]/share-card.tsx:15-16`) in both places, the Share box and the
  post-connect prompt (`share-prompt.tsx:39-40`). It reuses the prompt's onError fallback.
- Noted for next cycle: C5-32 (3.47) should come back before any outreach, after the matcher bumps settle. MK-P3, if
  it returns, should be figure-free and carry C5-32's code.

LC veto line: n/a (GR). CO veto line: n/a (GR).

### MA (round 5)

#### Round 5: MA (market analyst), final ballot

| Item | Vote | Conditions |
|---|---|---|
| F-32 (C5-1, as amended in round 4) | AC | Everything in leading-set.md and r4-RT.md. Market-lens addition: until Part B lands and OD 2.28 closes the forward path (RT p4), no outreach or product copy says "nothing hidden", "can't be steered" or "a record the trader can't edit" without the exclusion qualifier. The positioning line has to stay true while the forward path is still open (F3a). |
| F-33 (C5-4) | AC | Approved, waits on C5 Q3 and OD 2.32, with the round-4 amendments (today's score order below the tier; the hold-losers-open AC routed with OD 2.34 if it cannot pass). No new condition. |
| F-34 (C5-5) | AC | Leading-set and round-4 conditions (same account set, as-of date on images, equality test written after OD 2.25). No new condition. |
| F-35 (C5-30) | A | As shaped, with the watermark and the TZ e2e. |
| F-36 (C5-31) | AC | Waits on C5 Q1; its own bump; the no-basis lot stays counted; one /how formula. No new condition. |
| F-29 (re-approval) | A | As shaped with LC's signed words and UX's shared 360 px pane AC. |
| F-21 (re-approval) | AC | Round-4 conditions (count sells and option closes only, or "items"; the guard covers all three result shapes; a future-BUY fixture). No new condition. |

**Lapses and routing: agree.** L-28 and L-30 go to draft with owner notes; L-28's note says the true-cause wording is already on main (RT). The C5-4 fixes-lane split prints "Too early to tell" and drops "above zero", never a blank range.

**Note for the next cycle.** C5-32 (3.47) and C5-10 (3.33) missed the cut narrowly. They are the two market differentiators that remain once "verified" is generic. C5-32 should return before outreach, after the matcher bumps settle (EN, UX). C5-10 should return once OD 2.7 is answered.

### DS (round 5)

#### Round 5: DS (design-system owner), final ballot

| Item | Vote | Conditions (beyond leading-set.md and its round-4 amendments) |
|---|---|---|
| F-32 (C5-1) | AC | The "transfer" reason label is one `lib/copy.ts` constant. The profile's per-reason line and F-21's pane line both render it, in neutral muted text (`--muted`, no warning colour or icon). No second wording on any surface. |
| F-33 (C5-4) | AC | One producer for "Too early to tell": the existing `lib/copy.ts:225` `early` constant. `app/t/[symbol]/page.tsx:127` builds its own literal today and moves onto that constant in the same change, so /t, the pane, the profile and the fixes-lane split print one string. |
| F-34 (C5-5) | AC | The down colour on images comes from F-20's image colour table, the same `--loss` value as on pages, never a literal hex. The positions' as-of date uses the design-system date rule for images: the year on every date (DSP-12 / F-11). |
| F-35 (C5-30) | A | none |
| F-36 (C5-31) | A | none (the one /how formula is already in the shape) |
| F-29 (re-approval) | A | none (the muted, caption-size qualifier with no warning tone is already an F-29 decision) |
| F-21 (re-approval) | AC | If the line reads "items", the word comes from one constant shared with the profile's exclusion total, so the pane and the profile never name the count differently. |

**Lapses (L-28, L-30 → draft with owner notes): agree.** Add RT's note to L-28 that the true-cause wording is already on main (`lib/copy.ts:73`).

**Routing: agree, with one clarification on C5-37.** F-3 R8 asks for the disclaimer on the account page "with links to Terms, Privacy and How records are calculated" (`docs/features/logs/F-3/committee-2026-11-01.md:41`). So keep the links, muted, inside the one `Disclaimer` component (a variant, not a second component), and drop only the duplicate `aria-label="Legal"` landmark (A11Y, `app/tools/parts.tsx:15`). If LC reads R8 as met by the site footer's links, dropping them is fine too.

### RE (round 5)

#### Round 5: RE (reliability engineer), final ballot

| Item | Vote | Conditions (beyond leading-set.md and its round-4 amendments) |
|---|---|---|
| F-32 (C5-1) | AC | Part A's bump ships only once chore C5-43(b) is on main. The deploy rebuild prints counts only: closes moved from published to counted, per reason, plus a failure count with each logged cause (C5-15 class). If F-36's bump follows before Part A's has drained, the catch-up rebuilds straight to the latest version and leaves no record on the intermediate one (test: two bumps over 50 fictional records, drained with no deploy). Theses are kept by `sell_id` through both. |
| F-33 (C5-4) | AC | It stays a pure read-side change: no rebuild and no `MATCHER_VERSION` bump. The per-process weight cache (`lib/feed.ts:395-396`) is keyed so a deploy never serves old-formula weights; the PR states this. The C5-Q3/OD 2.34 routing AC goes in as amended. |
| F-34 (C5-5) | AC | The open line and its as-of date come from stored positions (the last sync's read), never a vendor call during a page or image render. The images stay within today's render cost: no extra per-request query beyond what the card already loads. |
| F-35 (C5-30) | AC | The matured-rows query is index-backed and bounded per tick. The PR shows `EXPLAIN` at the 3 M-activity LOAD shape: no sequential scan. Matured rebuilds go through the sync's normal path (per-user advisory lock, shard budget), and the watermark advances only after a successful rebuild, so a failed one retries. |
| F-36 (C5-31) | AC | Its own bump, after C5-43(b), with the same no-intermediate-version and counts-only rebuild report conditions as F-32. Zero-fee fixtures rebuild byte-identical, which proves that records without fees are untouched by the sweep. |
| F-29 (L-29) | A | None beyond the kept decisions (gate state in cache keys, tested in both states) and UX's shared pane AC. |
| F-21 (L-21) | AC | The shared sum reads stored counters only (`users.excluded_*` plus counts the rebuild persists), so the pane line costs nothing per request: no scan of activities or closes. #84's `excludedHeld` and F-32's transfer reason are persisted by the rebuild before they are summed, never recomputed on read. |

Lapses: agree (L-28 and L-30 go to draft with owner notes; RT's addition that the true-cause wording is already on main, `lib/copy.ts:73`).
Routing: agree. C5-43(b) is the gate before any `MATCHER_VERSION` bump. Each routed chore names its test (TE). The C5-4 split prints "Too early to tell" and drops "Past results: above zero", never a blank range.

### CO (round 5)

#### Round 5: CO (contrarian / common sense), final ballot

| Item | Vote | Conditions (beyond leading-set.md and the round-4 amendments) | CO veto |
|---|---|---|---|
| F-32 (C5-1) | AC | The retitle is what makes the item honest, so keep it word for word. The "transfer" reason line uses plain words a reader understands without /how ("excluded: a share transfer in this stock"). It names neither the transfer's date nor its units, and never says "hidden". The file records in Out of scope that the forward path (p4) still removes an open loser at will until OD 2.28 / F-22 is answered, and the owner note says so in one sentence. | none (it would apply if the title or any copy claimed a loss can never be removed) |
| F-33 (C5-4) | AC | The file says in plain words that the 1-point floor raises the cost of a lucky streak but does not close the hold-losers-open path without OD 2.34. No copy may claim small samples "can't" top the feed until it does. | none |
| F-34 (C5-5) | AC | Blocked status stays explicit, and no builder adds values to strips before OD 2.25. With the pane carrying the open line, F-21's line and the options qualifier, the line order is fixed in the file (exclusions, then open, then qualifier, or one builder's stated order). At most one line each, no repeats. | none |
| F-35 (C5-30) | A | none | none |
| F-36 (C5-31) | AC | The /how note states the formula once in words, with one fictional worked example (for example: paid 100 plus a fee of 10, sold for 165: +50%). | none |
| F-29 (L-29) | AC | none new. The owner's gate-opening checklist line stays, so opening day never brings back the "consented reads as withheld" problem. | none (my cycle-4 condition stands: the last qualifier on a surface is never removed) |
| F-21 (L-21) | AC | Of the round-4 options, take "counts sells and option closes only". "‹n› items excluded" is vague to a reader beside a headline of closed trades. It is acceptable only if the line links straight to the per-reason lines. | none (it would apply if one number mixed buys and sells under the word "trades") |

**Lapses and routing: agree.** L-28 lapses to draft with an owner note: OD 2.27 is overtaken by #89, and the true-cause wording is already on main (`lib/copy.ts:73`). L-30 lapses with its residual readout row as a chore (counts-only, suppressed under 5) and broker-position evidence to the owner. I agree with the chore and fixes routing, including the corrected C5-4 split ("Too early to tell", drop "Past results: above zero", never a blank range) and C5-43(b) landing before any MATCHER_VERSION bump. MK-P3's veto stands for any future cycle unless it is reshaped figure-free.

