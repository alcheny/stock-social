# Fixes cycle 5: AI legal committee findings, 2026-11-02

**Not legal advice; committee findings the owner accepts in place of counsel** (`docs/POLICY.md`, owner decision
2026-11-01 at its top; `docs/process/decisions-and-authority.md`). Each condition below is a rule for the build and
has a test. Calls these findings leave open stay with the owner.

Read for this review: `docs/POLICY.md` (P3, P4, P6, F1-F4, A1, H), `docs/COMPLIANCE.md` §1, §2, §4 (pre-checked
boxes), §7, §11, §12, §13; `docs/direction/cycle5-2026-11-01.md` §5 (F5-6, F5-7, F5-9, F5-10, F5-13), §6 (ranks 2, 3, 8,
17) and §8 Q2; `docs/ideas/approval-2026-11-01-cycle5.md` "Fixes lane"; the F-23 committee log and the fixes-labels
plan's legal-committee items, for how earlier checks were recorded; `app/login/page.tsx`, `app/auth/actions.ts`
(`startSignIn`, `keepEmail`), `lib/auth/attempts.ts` (`createAttempt` refuses `attested: false`),
`lib/privacy-cookies.ts`, `proxy.ts`, `lib/copy.ts` (`TRUST_NOTICE`, `CONSENT`, `RECORD_STRIP`, `HOW`, `RECORD_TOOLS`, `FC5`),
`lib/connections.ts` (pending `broker_accounts` rows, `confirmed_at is null`), `scripts/compliance.ts` (`EMAIL_OK`
allows `@example.com`), and the Next.js `cookies` guide in `node_modules/next/dist/docs`.

| # | Item | Finding |
|---|---|---|
| 1 | 18+ tick survives an email-format error (cycle-5 Q2, F5-7) | CONFIRM WITH CONDITIONS (A1-A12) |
| 2a | F5-6 trust-notice connect line | CONFIRM WITH CONDITIONS (reworded; B1-B3) |
| 2b | F5-7 sign-in email error | CONFIRM WITH CONDITIONS (B4-B5) |
| 2c | F5-2 note-save alert and recovery line | CONFIRM WITH CONDITIONS (B6-B8) |
| 2d | F5-10 "Highest return" / "Lowest return" | CONFIRM WITH CONDITIONS (B9-B11) |
| 2e | F5-13 empty stock page title | CONFIRM WITH CONDITIONS (B12-B13) |
| 2f | F5-9 /me/record takeaway, all three forms | CONFIRM WITH CONDITIONS (B14-B17) |
| 3a | MK-P6 /how history sentence | CONFIRM WITH CONDITIONS (full sentence given; C1-C3) |
| 3b | C5-41 Record tools pitch | CONFIRM WITH CONDITIONS (C4-C8) |
| 3c | C5-4 zero-width range wording | CONFIRM WITH CONDITIONS (C9-C13) |
| 3d | C5-5 "per closed trade" on the strips | CONFIRM WITH CONDITIONS (C14-C16) |

No item is rejected. Two wordings are changed by condition: 2a ("No trades are imported", simulated accounts named)
and the sentence 3a asks for.

---

## 1. The 18+ tick survives an email-format error

**Finding: CONFIRM WITH CONDITIONS.**

### Reasons

1. **The attestation stays the trader's own affirmative act.** It is recorded only by `createAttempt`, which runs only
   when the submitted form carries `adult=on` (`app/auth/actions.ts`; `lib/auth/attempts.ts` throws
   `NotAttestedError` otherwise), and only on the submit that sends a link. A box re-shown ticked does not record
   anything. The trader still has to submit the form again, with the attestation text and the ticked box in view, and
   can untick it. The attestation recorded is the one from that second submit. The orchestrator's framing is correct:
   the cookie is **not** a consent record.
2. **This is not a "pre-checked box".** COMPLIANCE §4 (and FTC dark-pattern guidance behind it) bans boxes that the
   business ticks by default. Here the only source of the tick is the same trader's own tick, made seconds earlier in
   the same browser, on a form the server bounced for an unrelated field. Keeping a user's own input after a
   validation error is ordinary form behaviour, and WCAG 2.2 SC 3.3.7 Redundant Entry (Level A, within POLICY A1's
   2.2 AA baseline) favours it. The difference from a pre-checked box is the origin of the tick. That origin must be
   provable, hence A2-A4.
3. **Third parties cannot cause it.** No URL parameter can tick it, and a cross-site link cannot set the cookie. That
   keeps the "a link sent by someone else arrives with the box ticked" risk at zero. A sibling-subdomain cookie plant
   is the one remaining path. Even then the trader still sees the box and submits it, so the act stays theirs (A9).
4. **Age-assurance dates (2027-01-01 California, Health & Safety Code §27001; 2027-01-25 New York rules).** Both
   ask for a *reasonable determination* or age assurance for activity-ordered feeds. A self-attested checkbox likely
   does not meet that bar, whether or not it survives a reload (board review item 6; F-2). This change neither
   strengthens nor weakens the age gate. It must not be cited as age assurance, and the F-2 choice due before
   those dates still stands (A10).
5. **Shared devices.** Within the cookie's life, the next person at the same browser could see a tick they did not
   make. A lifetime of seconds, not minutes, and clearing on the next action keep that window to the bounce itself.
   The visible box and the still-required submit cover the rest. The 15-minute `login_email` cookie is a larger,
   pre-existing shared-device exposure. It is outside this item but noted for the owner.
6. **Implementation fact.** In this Next.js, a Server Component can read cookies but cannot set or delete them during
   render (`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cookies.md`). "The page renders the box
   pre-ticked once and clears it" therefore cannot be done in `app/login/page.tsx` alone. "Once" must come from
   `proxy.ts` clearing the cookie on the response that serves `/login`, or from the short lifetime plus clearing on the
   next server action (A5-A6).
7. **Announcing the state.** On the email error, focus moves to the email field (F5-7), so a screen-reader user does
   not pass the box. If the box is silently ticked, the next submit attests without that user having perceived it.
   Their act would then not be affirmative. The box state must therefore be stated in the error (A7). This replaces
   the interim "Then tick “I am 18 or older” again." only while the box really is ticked.

### Conditions (each a testable rule)

- **A1. Scope.** The cookie is set only by `startSignIn`, only when the submitted form has `adult=on`, and only on the
  redirect to `/login?…error=email`. It is never set for `error=attest`, `rate`, `provider`, `closed`, `expired` or
  `used`. Any wider scope needs a new committee finding. *Test:* for each other error, the redirect response carries
  no attestation cookie.
- **A2. Fixed value, no personal data.** The value is one fixed constant (e.g. `1`). It never holds an email, an
  attempt id, a user id or a time. *Test:* the cookie value equals the constant.
- **A3. Attributes.** `httpOnly`, `sameSite=lax`, `path=/login`, `secure` whenever the origin is https, and
  `Max-Age` ≤ 60 seconds (recommended 30). It is never a session cookie without `Max-Age`. *Test:* `Set-Cookie`
  attributes are asserted.
- **A4. Only the cookie can tick it.** `/login` renders `defaultChecked` only when the cookie is present **and**
  `error=email`. No query parameter, hash or form field can tick it (`adult`, `attest`, `checked` or any other).
  *Test (e2e):* a fresh browser opening `/login?error=email&adult=on&attest=1` sees the box unticked. With the
  cookie but `error` absent or another value, the box is unticked too.
- **A5. Cleared after one use.** The cookie is gone after the first `/login` response that reads it. That is done
  either (preferred) by `proxy.ts` deleting it on the response for `GET /login`, or by its `Max-Age`. In both cases
  every later `startSignIn` call deletes or replaces it, and so do a completed sign-in and sign-out. *Test (e2e):*
  bounce, then reload: the first render is ticked and the reload is unticked (with the proxy route); or, without the
  proxy, the cookie has expired after `Max-Age` + 1 s and any submit clears it.
- **A6. The server never trusts the cookie.** `startSignIn` reads the attestation only from the submitted form
  field. *Test:* a POST carrying the cookie but no `adult` field returns `error=attest` and writes no
  `signup_attempts` row.
- **A7. The state is announced.** When the box renders ticked from the cookie, the email error's description (the
  text `#email` is described by) adds one sentence naming it, for example: "The “I am 18 or older” box is still
  ticked; untick it if that is not right." When the box renders unticked, the existing `FC5.attestAgain` line shows.
  Exactly one of the two appears, matching the box's real state. *Test (e2e):* the accessible description of
  `#email` contains the matching sentence in both cases.
- **A8. Not a consent record.** The cookie gets a `COOKIE_TABLE` row in `lib/privacy-cookies.ts` stating its purpose
  (e.g. "Keeps your own 18+ tick for the one page load after an email-address error. It is not a record of
  consent.") and its lifetime in words, with `setIn` naming `app/auth/actions.ts` (and `proxy.ts` if it clears it).
  No database row, log line or funnel event is written when it is set or read. The privacy page lists it from the
  table. *Test:* the existing cookie-table test sees the new name; a source scan finds no `sql`/log call in the code
  that sets or reads it.
- **A9. Visible and changeable.** The box stays a normal, unticked-by-default control the trader can untick. Its
  label and its Terms and Privacy links are unchanged, and nothing skips or hides the box on any path. *Test:* the
  box is focusable and toggles, and unticking then submitting returns `error=attest`.
- **A10. Not age assurance.** No copy, doc or PR calls this change age assurance or age verification, and the
  attestation text and its stored version are unchanged. The F-2 choice due before 2027-01-01 / 2027-01-25 (F-2
  record) is not affected and stays the owner's.
- **A11. Every other sign-in path is unchanged.** Brokerage-first, provider and dev paths still require a fresh tick
  in the submitted form (COMPLIANCE §7). The existing test asserting no `users` row without `adult_attested_at`
  stays green.
- **A12. Record.** The PR's `## Compliance` section cites this finding and answers COMPLIANCE §1 items 2, 6 and 8.

The committee confirms the owner's acceptance of cycle-5 Q2 on these conditions. If any of A3-A7 cannot be met, the
interim behaviour (box unticked, alert names it) is the compliant fallback.

---

## 2. Copy re-signs (cycle-5 record)

### 2a. F5-6 trust-notice connect line

Proposed: "Every account under this login and the full trade history your broker provides are included. Nothing is
imported until you confirm on the next screen."

**Finding: CONFIRM WITH CONDITIONS, with a reworded line.**

Reasons:
- "the full trade history your broker provides" is right. It ties "full" to the broker's own limit instead of claiming
  completeness (F3a), and it matches the consent screen (`CONSENT.lines`, "Full trade history your broker provides,
  from every account under this login").
- "Every account under this login … are included" is not true for simulated accounts, which are found but never
  imported (the consent screen prints "(1 simulated, not imported)"). This trust notice is an advertising-style claim
  made before consent, so it must be literally true (FTC Act §5, COMPLIANCE §11).
- "Nothing is imported until you confirm" is broader than the code. Pending `broker_accounts` rows
  (`confirmed_at is null`) are written before confirmation and deleted on cancel (`lib/connections.ts`). No trades are
  imported before consent, so the narrower statement is the true one.

Signed wording:

> "Every account under this login, except simulated ones, and the full trade history your broker provides are
> included. No trades are imported until you confirm on the next screen."

- **B1.** The trust notice and the consent screen both contain "your broker provides". A copy test pins both (the F5-6
  test), and neither says "all of your trades", "every trade" or "complete".
- **B2.** *Test (DB):* a connection that reaches the consent screen and is cancelled leaves no `activities`,
  `closed_trades` or option rows for that user, and its pending `broker_accounts` rows are deleted. Pending rows are
  never public (they are already excluded by `confirmed_at is not null`; a test pins it).
- **B3.** If the owner prefers to keep "Nothing is imported", the pending account rows must first stop being written
  before confirmation. That is a code change, not a wording choice.

### 2b. F5-7 sign-in error: "Enter a full email address, like name@example.com."

**Finding: CONFIRM WITH CONDITIONS.** It describes the format and names no person or company. `example.com` is an
IANA-reserved example domain, and the scanner allows it (`scripts/compliance.ts` `EMAIL_OK`).
- **B4.** The example is only text in the error. It is never prefilled into the field or used as a `placeholder` that
  could be submitted. Example domains other than `example.com|org|net` are never used.
- **B5.** The error is the field's accessible description (`aria-describedby`, `aria-invalid`), and the 18+ sentence
  of A7 follows it in the same description.

### 2c. F5-2 note-save alert and recovery line

"Your note was not saved because this trade changed." / "Your unsaved note is below. Copy it before you leave this
page."

**Finding: CONFIRM WITH CONDITIONS.** The text is neutral and true, and it tells the author that nothing was stored.
U1's "never silently dropped" therefore holds, and the recovery box keeps the author's own words.
- **B6.** The unsaved text is shown only to its author, in the response to the author's own POST. It is never put in a
  URL, cookie, log line, error report or analytics event (POLICY P6: never log thesis text). *Test:* the redirect or
  response URL holds no note text, and a log capture during a failed save holds none.
- **B7.** Nothing is written when the key does not match. The second sentence shows only while the recovery box
  renders (as `FC5` says). The alert never says the note was "deleted" or "rejected" (that would misstate a
  moderation outcome).
- **B8.** The alert uses `role="alert"`, and focus or description reaches the recovery field (POLICY A1).

### 2d. F5-10 "Highest return" / "Lowest return" on month recaps

**Finding: CONFIRM WITH CONDITIONS.** The labels describe the evidence by rank, not the trade's merit. They match
F3b ("labels describe the evidence … never the trader's skill") better than "Best/Worst trade", and they no longer
call a gain "worst".
- **B9.** The labels apply by rank whatever the sign. The figure always prints its sign (true minus) and uses the
  loss token when negative, so a "Highest return" that is a loss still reads as a loss (A1: not by colour alone).
- **B10.** A loss is never left out to make a month look better. When the lowest return is a loss it is shown. When a
  month has one trade, it is shown once (no duplicate pick), and the full list below still shows every close (TR-1).
- **B11.** No "best", "worst", "top", "winner" or "pick" wording joins these labels (F1, F3b).

### 2e. F5-13 title "No closed trades in ‹TICKER› yet · Stock Social"

**Finding: CONFIRM WITH CONDITIONS.** The title is a fact about the record and says nothing about the security
(F3b). "yet" is the page's existing description wording and makes no forecast about the security.
- **B12.** The title prints only a symbol that passes the existing symbol normalizer. Any other path gets the existing
  404 and never echoes arbitrary URL text into a title, which stops crafted links from putting words in Stock
  Social's mouth (U2). *Test:* a path with spaces, lowercase words or over-length text does not produce this title.
- **B13.** The empty page keeps `noindex` and its 200 (open positions can still show), and it carries the F3
  disclaimer whenever it shows any open-position figure.

### 2f. F5-9 /me/record takeaway

"Your average win was +6.5%; 3 losses, too few to average." / "…; no losses." / "Your average loss was −4.0%; no
wins." (and "…; ‹n› wins, too few to average.")

**Finding: CONFIRM WITH CONDITIONS.** Naming the other side's count ends the one-sided summary that F4 ("show the
whole record … losses ranked like gains") argues against. The forms state counts, not judgments.
- **B14.** The counts are the same closed-trade counts the record prints (excluded sells not counted), and the
  average uses the same floor as the rest of the page. A test ties the "too few" threshold to that one constant.
- **B15.** When both sides are under the floor, no average is printed. Both counts are named, or the takeaway is
  omitted, and the sentence never names one side alone. When both are at or above the floor, both averages are named.
  *Test:* fixtures 5W/3L, 3W/5L, 5W/0L, 0W/5L, 2W/2L, 0W/0L.
- **B16.** Signs print as "+" and a true minus "−". "no losses" / "no wins" print only when the count is exactly 0.
- **B17.** The takeaway stays on the owner's own `/me/record` and carries the F3 disclaimer there. It is never put on a
  public surface, share image or message (F3b) without a new finding.

---

## 3. Part-2 items (council 5, fixes lane)

### 3a. MK-P6 /how sentence

The council's fragment, "History before the earliest date your broker provides", is not a sentence, and /how is read
by viewers as well as traders ("your" would be the wrong person). Signed full sentence, as one item of `HOW.excluded`:

> "Trades from before the earliest date the trader's broker provides: they are not imported, so a record can start
> later than the trader's first trade, and a sell of shares bought before that date is excluded and counted as a sell
> with no recorded entry."

**Finding: CONFIRM WITH CONDITIONS.**
- **C1.** It is placed in the "What is excluded, and counted" list, next to the existing "Transfers in, and sells with
  no recorded entry…" item. The second clause is true because such sells land in `users.excluded_positions`. A test
  pins the sentence in `HOW.excluded`.
- **C2.** No broker is named and no history length is stated. The vendor's actual window stays unverified until the
  engineer confirms the vendor field (MK-P6's first acceptance criterion). If that field exists and the profile line
  "Imported history starts ‹month year›" is built, it must use the same wording root ("the earliest date … broker
  provides") and change no figure.
- **C3.** Under COMPLIANCE §12, the PR records the dated /how change ("2026-11-0x: /how names history before the
  broker's earliest date"). No POLICY edit is needed: F3's list is a minimum.

### 3b. C5-41 Record tools pitch

"Compare whole public records side by side: closed trades imported from connected accounts, losses and ranges
included. Traders can't remove single trades."

**Finding: CONFIRM WITH CONDITIONS.** This is the committee's own reshaping of the council's "every closed trade /
nothing hidden", which made completeness claims (F3a). "whole" is limited by "public" and defined by the clause after
the colon. It means the entire public record, not the trader's entire trading. The pitch sits on a paid surface
(Record tools, F-3), so it is advertising and must be substantiated (COMPLIANCE §11).
- **C4.** The string is used verbatim and whole. It is never shortened to "Compare whole records", and "whole" never
  appears without "public" and the colon clause in the same string. *Test:* a copy test pins the full string, and a
  scan of `RECORD_TOOLS` finds no "whole" outside it and no "every trade", "all trades" or "nothing hidden".
- **C5.** "Traders can't remove single trades" must stay true. No route, server action or form lets a trader hide or
  delete one closed trade (TR-1), and disconnecting an account freezes its trades rather than removing them (TR-5).
  The F-16/F-17 owner-hide applies to notes, not trades. *Test:* a source scan finds no trader-facing action that
  deletes or hides `closed_trades` rows other than whole-profile deletion, and a DB test shows a disconnect keeps the
  record's closed trades.
- **C6.** Whole-profile deletion (P6) stays available and described in Terms/deletion copy. The pitch says "single"
  so it does not deny it, and no copy may add "ever", "permanent" or "forever" (OD 2.9 is open).
- **C7.** Every Record tools card shows the trader's losses (win rate and the lowest/loss figures as on the profile)
  and the 95% range, and demo records carry the Demo badge. If a card cannot show a range (too few bets), it prints
  the existing short-record wording, never a blank. `/tools` carries the F3 disclaimer and the /how link.
- **C8.** The PR quotes this finding under `## Compliance` (the "LC re-signs in the PR" step is satisfied by citing this
  file, provided C4-C7 are tested).

### 3c. C5-4 zero-width range: "Too early to tell", and "Past results: above zero" dropped

**Finding: CONFIRM WITH CONDITIONS.** A zero-width interval ("+1.0% to +1.0%") is a statistical artefact of identical
returns, not evidence. Printing a verdict ("above zero") on it overstates certainty, a misleading-performance risk
under the anti-fraud spirit COMPLIANCE §2 asks the product to follow. "Too early to tell" is the existing neutral
wording.
- **C9.** "Zero-width" is decided at printed precision. The range counts as zero-width when its low and high print as
  the same text with the surface's own formatter, so near-identical returns that round to one value are caught too.
  *Test:* ten +1.0% trades, ten −1.0% trades, and returns of 1.00/1.01/0.99% that print equal.
- **C10.** It is symmetric. The same rule drops "below zero" and "unclear" verdicts for a zero-width loss range.
  Losses and gains are treated alike (F4).
- **C11.** It applies on every surface that prints a range or a verdict: profile card, pane, profile evidence line,
  trade/month strips, `/t` pages, the share and link-preview images, OG descriptions and the public wire payloads
  (F-23: the payload carries no verdict the screen does not print). *Test:* a scan over those outputs for the
  zero-width fixture finds "Too early to tell" and no "Past results:" verdict.
- **C12.** It is never blank. Where "Too early to tell" replaces the range, the tier, bet count and span may stay. The
  F3 disclaimer is unchanged.
- **C13.** This is wording only. Ranking weight (the evidence floor) is cycle-5 Q3 / OD 2.33 for the owner, and
  nothing here changes ranking. F-33 later takes over the printed range under its own review.

### 3d. C5-5 "per closed trade" on the strips

**Finding: CONFIRM WITH CONDITIONS.** "average per closed trade" is more accurate than "average per trade" beside an
open count. It stops a realized average being read as covering open positions (TR-4, F3a). It is F-4's existing
wording (`SHARE_CARD.perClosedTrade`).
- **C14.** It changes everywhere the strip's average prints: the trade and month strips, their link previews and the
  images built from `lib/record-strip.ts`. *Test:* a scan of strip outputs finds "per closed trade" and no bare "average
  per trade".
- **C15.** It is wording only. It does not settle TR-4's prominence or OD 2.25 (unrealized values for real users),
  which stay with the owner, and no unrealized value is added to a surface that has none today.
- **C16.** The `/t` baseline lines ("95% range of the average per trade") are out of this item's scope. Aligning them
  later is a wording change the committee pre-approves on the same terms (C14-C15).

---

## For the owner (left open by these findings)

1. Item 1: the existing 15-minute `login_email` cookie keeps a typed address on shared devices. Consider shortening it
   or clearing it on sign-out (it is already cleared by a completed sign-in only if the code does so; verify).
2. Item 2a: approve the reworded trust line, or keep "Nothing is imported" and stop pending account rows first (B3).
3. Items 1 and 3c do not change the age-assurance or ranking decisions (F-2 dates; cycle-5 Q3, OD 2.33). Those remain
   yours.

Not legal advice; committee findings the owner accepts in place of counsel.

---

## Addendum 2026-11-02: C5-5 shorter visible form on the strips (re-sign for part 2, plan D1)

Asked by the orchestrator (`docs/features/logs/fixes-cycle5/plan-part2-round1.md`, §0 D1 and §1.5). "‹avg› average per
closed trade" (up to 30 glyphs) overflows the 582 px image band at F-12's pinned 35 px. Shrinking it breaks F-12 AC3, and a
second line breaks the band height (AC16). Proposed: the visible strip prints "‹avg› per closed trade" (the council's
literal words), and the image alt keeps "average per closed trade ‹avg›".

**Finding: CONFIRM WITH CONDITIONS (C17-C20).**

Reasons:
- What C5-5 protects is "closed". It stops a realized average being read as covering open positions (TR-4, F3a).
  The shorter form keeps that word, so the protection is intact.
- "‹figure› per closed trade" is the ordinary way to state an average rate, and it matches "the average return per
  trade" on /how. The risk is that it is read as "every trade returned ‹figure›", which would suggest consistency the
  record does not have (F2, COMPLIANCE §11). That risk is low because the same band prints the closed-trade count before
  the figure and the 95% range (or "Too early to tell") after it. C17 makes that dependency a rule.
- Layout pins (F-12 AC3, AC16) are accessibility and legibility requirements in their own right (POLICY A1). Keeping
  35 px is better than a smaller full phrase.
- Width-free text (alt, accessible names, link-preview descriptions) has no reason to drop "average" and keeps it.

Conditions:
- **C17.** The short form prints only inside a strip that also shows the closed-trade count before it and, after it,
  either the 95% range or "Too early to tell" (never neither). *Test:* for every strip output (HTML strips and the
  trade/month images), when the average part exists, the count part precedes it and a range or early part follows it.
- **C18.** Every text output without a width limit uses "average per closed trade": the image `alt`, the HTML strip's
  accessible name or alt text, and the link-preview/OG description built from the strip. *Test:* those strings contain
  "average per closed trade" and none contains a bare "average per trade".
- **C19.** The visible form is exactly "‹signed figure› per closed trade", with nothing else between the figure and the
  words (no "each", "every", "on every", "a"). One producer (`lib/record-strip.ts`) builds both forms from one constant,
  so the two cannot drift. *Test:* the visible average part matches `/^[+−]?[\d.,]+% per closed trade$/` (or the
  `pct()` "Flat"/"≈" forms followed by " per closed trade").
- **C20.** C14-C16 otherwise stand. "per closed trade" appears on every strip output, no output says "average per
  trade", and the change stays wording only (no unrealized value added; OD 2.25 is still the owner's). The PR's
  `## Compliance` section cites this addendum.

Not legal advice; committee findings the owner accepts in place of counsel.
