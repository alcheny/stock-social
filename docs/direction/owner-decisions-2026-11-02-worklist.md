# Owner decisions 2026-11-02: work map

Source: the owner's decisions of 2026-11-02, given in chat to the orchestrator and recorded in `docs/DECISIONS.md`
(entries dated 2026-11-02). They accept every recommendation in `docs/direction/owner-decisions-2026-11-01.md` §2
("the brief", items 2.1-2.63) and cycle-5 owner questions Q1-Q4 (`docs/direction/cycle5-2026-11-01.md` §8), with
the exceptions recorded there. Base: `origin/main` ca34767 (#97). Open PRs at that base: #100 (F-16/F-17), #102
(F-25). Committee check of the new features and the fixes list (UX lead, business lead, engineer, legal committee; no
veto): `docs/features/logs/owner-decisions-2026-11-02/committee.md`. This map lists the work found in those sources; it
is not a guarantee that nothing else is open. Not legal advice.

## Owner's actions outside the repository

- [ ] **Repository visibility:** switch the repository to private (2.55); check the Actions minutes on the plan.
- [ ] **Branch protection** on main with Code Owners review, if the plan allows (brief row 3; 4.3).
- [ ] **Role mailbox** for privacy, legal, takedown and vendor mail, forwarding to two places (2.21; row 9; 4.5). Put its
      address in configuration: F6-3 and F-44 refuse connect for non-demo users until it is set.
- [ ] **Vendor letter:** refresh Appendix A (draft L-3) and send it from the role mailbox (2.24; 4.1). Add: public
      display of unrealized values, including last-known values after a disconnect (2.25 override; F-41); MRC2-10
      (F-32 Part B); whether derived percentages may stay public after a connection is deleted (2.12; F-48); the F-14
      cadence, quota and cost. Record the written reply with a dated DECISIONS line. Start per-broker production access
      and the sign-in providers' app reviews (row 11).
- [ ] **Privacy Policy and Terms:** commission the AI legal committee's drafts now (L-1) and approve the final text with
      an effective date within two weeks (2.5, 2.6, 2.62; row 6). The approval also covers the F-44 answer, the F-47
      backup window and the F-43 export contents.
- [ ] **Approve wording when the PRs show it:** the F6-2 consent line (2.7); the amended options scope line (2.63, plan
      D5 wording); the F6-13 sign-up attestation.
- [ ] **Production environment:** `ALLOW_DEV_AUTH` unset on Production; separate random `APP_SECRET_KEY`,
      `SESSION_SECRET` and `CRON_SECRET` per environment; `NEXT_PUBLIC_SITE_URL`; `TRUST_PROXY_HEADERS` unset; vendor
      portal origins from a live URL; Postgres with point-in-time restore; edge rate limits; `LIVE_BILLING` off;
      `LAUNCH_OPEN` closed; `DAILY_PR_CAP` set (rows 1, 5; 2.1, 2.3, 2.47, 2.56; 4.3).
- [ ] **Cron:** merge the `vercel.json` cron PR (C-3) and confirm the plan's cron interval (row 12).
- [ ] **Copyright agent** registered before theses go live (2.18; 4.2). **Name clearance** search (row 28).
- [ ] **Safeguards:** name the Qualified Individual and the data-inventory keeper; adopt the written program, the
      key-rotation re-encrypt process and the breach runbook once drafted (2.52, 2.53; L-2).
- [ ] **Beta gate:** sign checklist B1-B15, dated, before setting `LAUNCH_ALLOWLIST_EMAILS`; choose wave 0 (10-20 adults
      you know, no registered advisers or paid promoters); sign the week-8 gate definitions once drafted (2.1, 2.2,
      2.61; L-4).
- [ ] **Duties and switches:** release held theses with `scripts/review-theses.ts` daily during Beta (2.20); say who
      reviews the F-44 "yes" list and how often; name who runs the under-18 procedure (2.22) with the audited deletion
      script; turn on F-48 only after the vendor's reply, with a dated DECISIONS line.
- [ ] **K18 (2.23):** choose an age-assurance method, or confirm the shared order (F-42) stays; check F-42 is live in
      production before 2027-01-01 and 2027-01-25.
- [ ] **People tests:** the 5-second share-card test with 10 people outside finance (2.35); the 360 px keyboard and
      screen-reader walkthrough and the badges on a low-end phone (row 29; 4.4); the F-15 bot-filter check (4.4).
- [ ] **Production runs:** `scripts/rebuild-records.ts` on each matcher deploy (row 13); `scripts/shared-accounts.ts`
      counts (4.6); the dated accuracy sign-off after the rebuild (row 14).
- [ ] **Before live billing:** the limited attorney review (2.54); the processor's written confirmation and data terms
      (2.47; 4.2). **Entity and insurance** by Open; a **postal address** before commercial email (rows 38-39).
- [ ] **Try the built features** and mark each one accepted or rework (4.4).

## Kinds

**code** (app or lib change) · **copy** (product text only) · **protected** (a protected file: prepared by the
protected-files session, merged by the orchestrator once green and independently reviewed, owner decision 2026-11-02)
· **docs** (unprotected docs an agent writes) · **owner** (outside the repo, in the checklist above) · **none**
(already true on main, or decided not to build).

## Map: brief items 2.1-2.63

| Item | Decision | Covered by | Kind |
|---|---|---|---|
| 2.1 | Beta checklist signed before the allowlist | owner checklist | owner |
| 2.2 | Wave 0 composition | owner checklist | owner |
| 2.3 | `LAUNCH_OPEN` closed until the Open sign-off; viewer sign-up behind its own switch after Terms and Privacy | `LAUNCH_OPEN` is the owner's env; the viewer switch is **F6-14** | owner, code |
| 2.4 | Ponytail notes accepted in bulk; agents clear the 11 launch-relevant ones before Beta | DECISIONS entry (this PR); **C-1** | docs, code |
| 2.5 | Privacy Policy and Terms drafts now; owner approves | **L-1**; owner checklist | docs, owner |
| 2.6 | EU/UK users not allowed, in the Terms and enforced at sign-up | Terms (L-1); **F6-13** | docs, code |
| 2.7 | One new consent version | **F6-2** | code, copy |
| 2.8 | Export everything stored | **F-43** | code |
| 2.9 | No "permanently"; deletion leaves only a handle reservation with no personal data | **F6-3** (main says "one profile, ever", `lib/copy.ts:107`, `lib/claims.ts:8`) | copy |
| 2.10 | In-app disconnect before real users | **F-40** | code |
| 2.11 | Connect preview with a Demo record | **F-45** | code |
| 2.12 | Delete the vendor connection on a freeze once the vendor confirms | **F-48** (draft until the vendor answers); TR-5 text | code, protected, owner |
| 2.13 | Preference data deleted at 90 days | **F-47**; F-2 dated line | code |
| 2.14 | Implicit logging stays off; only the owner flips it | none: off by default (`lib/discovery/activity.ts:23-33`); F-2 dated line corrects the +2 weight note | none |
| 2.15 | F-15 defaults en bloc | the 120-day bound is on main (`lib/privacy-retention.ts:89-93`); the rest is pinned by **F6-15** | code |
| 2.16 | Lured link: no session; decline and clean up | **F-37** | code |
| 2.17 | Handles: 365-day reservation, retire handles that had a record, one rename per 30 days | 365 days on main (`lib/handles.ts:10`); F-17 (#100) builds the 30-day rename; retirement is hand-off **H-1** | code |
| 2.18 | Takedown wording, anti-impersonation line, report on thesis and profile; copyright agent before theses go live | F-16 (#100); the agent is an owner action | code, owner |
| 2.19 | One transactional-only sender in one file, listed as a sub-processor | the file exists (`lib/auth/email.ts`); the listing is in the Privacy Policy (L-1) | docs |
| 2.20 | Held-thesis release duty, daily during Beta | owner checklist | owner |
| 2.21 | Claims reviewed by a person through the mailbox, explained at connect and in the Terms | **F6-3**, **F-44**, Terms (L-1), mailbox (owner) | copy, code, owner |
| 2.22 | Under-18 report procedure | audited owner-run deletion script: the F-16/F-17 session (F-16 dated line); runner named by the owner | code, owner |
| 2.23 | K18: non-personalized or follows-only order; no age-assurance build | **F-42** | code |
| 2.24 | The vendor's written reply is the hard gate | owner checklist; **L-3** | owner, docs |
| 2.25 | **Overridden:** unrealized values keep showing; one Open line; thin names deferred | F-34 (building, shown-values variant); F-6 dated line; vendor letter | code, owner |
| 2.26 | Count date-only same-instant pairs with evidence | none: overtaken by #89 (F-30 stays draft); its readout row is on `claude/chores-cycle5` | none |
| 2.27 | Taint after an oversell | none: main counts every later sell (#89), which is stricter (F-28 stays draft) | none |
| 2.28 | Transfers are share moves; POLICY F3 names transfers out | **F-22** (`ready`); F-32 Part B (vendor MRC2-10); POLICY 3.17 | code, protected, owner |
| 2.29 | No early taint release; vendor corrections append-only; held rows counted | rows are insert-only (`lib/sync.ts:37`), so the rule holds; CLAUDE.md 3.4; wording **F6-1**; storing corrections waits on C3-9b | protected, copy |
| 2.30 | A confirmed freeze stays frozen; refusals back off, never freeze alone | on main (#79); pinned by **F6-16** | code |
| 2.31 | Last known positions on a disconnected record | **F-41** | code |
| 2.32 | One range rule: arithmetic mean; "Too early to tell"; "average per trade so far, likely between X and Y" | **F-33** (owns the printed range; dated line). Main uses a geometric mean on the profile (`lib/trades.ts:559-583`) and an arithmetic one on the card (`lib/bets.ts:42`) | code, protected (TR-9) |
| 2.33 | Near-edge distance from 0, documented on /how | main already weighs the near edge of the pace interval (`lib/trades.ts:612-622`); **F-33** adds the floor and the /how text; CLAUDE.md 3.6 | code, protected |
| 2.34 | Open positions in the range | **F-46** | code |
| 2.35 | 5-second test first | owner checklist; a CH-1 change only after the result | owner |
| 2.36 | Win rate stays in the profile headline, leaves trade and month images; descriptions with a return end with both sentences | **F6-7** | code |
| 2.37 | New first-visit line | **F6-4** | copy |
| 2.38 | Neutral demo seed; no return on a security | **F-38** (seed), **F-39** (stock pages) | code |
| 2.39 | Card date line "Last close ‹Mon D, YYYY›" | **F6-8** | copy |
| 2.40 | "Disconnected" on its own line; "‹n› excluded"; "independent trades"; "a clear pattern of gains/losses" | **F6-5** ("Disconnected" is already its own line, `app/ui.tsx:108`) | copy |
| 2.41 | Design-system rulings en bloc | **F6-6** (copy), **F6-17** (viewer-only noindex); DESIGN text (3.20) | copy, code, protected |
| 2.42 | Dark share images use the page inks | none: applied in #77 | none |
| 2.43 | Flat tone; the switch is the only non-focus outline | **F6-9** | code |
| 2.44 | Contrast floors in a protected file | protected (3.19) | protected |
| 2.45 | Card Demo hue; image font for U+2212 after its licence check | **F6-9** | code |
| 2.46 | Accessibility rule engine as a dev dependency (MPL-2.0) | protected (`package.json`, lockfile, `LICENSE_REVIEWED`); then **F6-10** | protected, code |
| 2.47 | Billing en bloc | `LIVE_BILLING` refusal on main (`lib/billing.ts:49`); the other conditions are checked before live billing | owner |
| 2.48 | F3b literal reading | none: no email carries record content; #100 adds a guard test | none |
| 2.49 | F-7 switch-on checklist; T2 amendment | owner (switch stays closed); POLICY 3.16; the filing-index mapping waits for switch-on | owner, protected |
| 2.50 | Park F-5 and F-8; F-8 O6 describes a method | F-5 and F-8 dated lines | docs |
| 2.51 | Share-move read daily, "Last updated ‹date›" shown | the read is daily (`lib/sync-cadence.ts`); the line is **F6-11** | copy |
| 2.52 | Safeguards program, Qualified Individual, re-encrypt process, breach runbook | **L-2**; owner | docs, owner |
| 2.53 | Calendar, records list, inventory keeper, corrections process, admin read logs | **L-2**; **F6-12**; owner names the keeper | docs, code, owner |
| 2.54 | Limited attorney review; POLICY "counsel" wording; DESIGN and feature files covered | owner; protected (3.18) | owner, protected |
| 2.55 | **Repository made private**; licence not decided | owner checklist | owner |
| 2.56 | Budget admission text, `capUsd` a usage cap, `DAILY_PR_CAP`, per-PR cost log | **C-2**; `DAILY_PR_CAP` is the owner's | docs, code, owner |
| 2.57 | Process questions Q1-Q14 | protected: CLAUDE.md 3.7 (Q1), CODEOWNERS and `scripts/team.ts` 3.9 (Q7), `scripts/features.ts` (Q4), `.claude/agents/engineer.md` (Q10), POLICY T1 (Q11); **C-4** for the rest | protected, docs |
| 2.58 | Guardrails under CODEOWNERS; Doctor exception closed; audits | protected (3.10, `scripts/doctor.ts`, `.github/`) | protected |
| 2.59 | Four protected-path merges | protected-files session | protected |
| 2.60 | Stale status lines | this PR | docs |
| 2.61 | Week-8 gate pre-registered; definitions drafted | **L-4**; owner signs | docs, owner |
| 2.62 | Terms ban paid signals; ask at connect | Terms (L-1); **F-44** | docs, code |
| 2.63 | Options consent en bloc | options stay gated (`lib/options-gate.ts`); F-29 (building); the scope line waits for the owner; open: strike inference in the consent text or the Privacy Policy | owner, code |

## Map: cycle-5 owner questions

| Q | Decision | Covered by | Kind |
|---|---|---|---|
| Q1 | Fees in the denominator | **F-36** (blocked only on chore C5-43(b)); DESIGN §2.5 text | code, protected |
| Q2 | The 18+ tick survives one email-error round trip, if the legal committee confirms | F5-7's last part on `claude/fixes-cycle5`, after the committee's confirmation | code |
| Q3 | Evidence floor: moderate tier, 1-point spread floor | **F-33**; TR-9 text | code, protected |
| Q4 | Row-count check around `npm test` in CI | protected (`.github/workflows/ci.yml`) | protected |

## Other owner decisions of 2026-11-02

| Decision | Covered by | Kind |
|---|---|---|
| Chart precision above ±100% | F-23 owner decision, merged in #105 | none |
| Held-sells wording | **F6-1** | copy |
| Protected-file PRs merged by the orchestrator when green and reviewed | protected-files session | protected |
| Development resumed; the 60% weekly cap applied to last week only | DECISIONS entry | none |
| Development paused: finish in-flight work, start nothing new; new items stay queued | DECISIONS entry; new feature files `blocked` on the pause; F6 items queued | none |

## Hand-offs to in-flight work

- **H-1 (#100, F-17):** 2.17 says a handle that ever had a connected record is retired and never reissued. #100's F-17
  file says "Nothing is retired forever". Before #100 merges, change it to retire such handles (the neutral 404 for the
  old URL stays), or record why it can't.
- **#100 and #102 status lines:** both PRs set F-16, F-17 and F-25 to `built` on their branches; this PR sets them to
  `ready` on main. Whichever merges second gets a one-line conflict on `Status:`: keep `built` and both sides' dated
  decision lines.
- **F-34 and F-35:** this PR carries their branches' file versions word for word, so their merges stay clean.
- **`claude/fixes-cycle5`:** F6 items that edit `lib/copy.ts` use that branch's `FC5` copy object if it merges first.
- **`lib/copy.ts:746`:** F-42 owns its rewrite; F6-5 and F6-6 leave it alone.

## Fixes list (cycle-5 format; no vote)

**Queued:** development paused by the owner 2026-11-02 (`docs/DECISIONS.md`). Every F6 item below, and every new feature
F-37 to F-48, is queued: none is built until the owner resumes development. The feature files carry `Status: blocked`
with a `Blocked:` line naming the pause (the pipeline builds only `ready` files); on resume each goes back to the status
shown in the table below.

Ordered: record trust, launch gates, then copy. "Home" names the in-flight branch that already touches the files.
Every test is added, never weakened; a pinned copy test changes only its expected value. Fictional data only.

**F6-1: the held-sells line uses the owner's wording.**
- Fix: `PROFILE.excludedHeld` (`lib/copy.ts:88`) reads "‹N› sells excluded while a possible duplicate is checked."
  (singular for 1). Drop the ponytail line at `lib/copy.ts:83` only; `:84-85` stay (they depend on `lib/session.ts`).
- Test: a unit test pins both forms; `e2e/f24-excluded-held.spec.ts` keeps reading the constant.
- Files: `lib/copy.ts`, a test. Home: `claude/fixes-cycle5` (copy object).

**F6-2: one new consent version and a re-consent prompt (OD 2.7).**
- Fix:
  - Versions are a per-connection hash (`consent_scope_hash`, `lib/connections.ts:439`); no re-consent prompt exists
    today (`lib/options-load.ts:13-15`). Build version 2 and the prompt.
  - Version 2's scope line starts "Public: your handle, display name, any reasons you publish, percent returns, …" and
    adds "connection status dates (last update, disconnected, account removed)", the connection date an idle record
    falls back to, and "public since".
  - Handle, display name and status dates are already public, so version 2 names them truthfully. The gate applies
    only to fields first shown after version 2 (the same way as the options gate): a version-1 trader never shows them.
  - The scope strings live in a crypto-free module that `lib/copy.ts` and `lib/consent-versions.ts` both import
    (`lib/consent-versions.ts` imports `node:crypto`; `lib/copy.ts` reaches client bundles).
  - The prompt has no pre-checked box, and declining is as easy and as visible as accepting. The consent row stores the
    version and the time.
- Test: version 2 names every field `lib/privacy-fields.ts` marks public (guard); a version-1 trader sees the prompt; a
  version-1 trader shows no post-version-2 field on the profile, pane, card, images, alt text or preview descriptions
  (one public producer, tested on each surface); declining keeps the version-1 record; no client bundle imports
  `node:crypto` (build check).
- Files: `lib/consent-versions.ts`, a new scope-strings module, `lib/copy.ts`, the consent page, `lib/privacy-fields.ts`,
  tests. Home: #102 edits `lib/privacy-fields.ts`; rebase.
- Owner: approves the final string in the PR. Protecting these files is 3.8 (protected-files session).

**F6-3: deletion and claims wording (OD 2.9, 2.21).**
- Fix: replace "A broker account can belong to one profile, ever." (`lib/copy.ts:107`, `lib/claims.ts:8`) with a line
  saying a broker account belongs to one profile, deleting the profile removes the personal data, and only a handle
  reservation with no personal data remains. The claims refusal adds "If you think this is a mistake, write to ‹role
  address›; a person reviews it." The address comes from the helper F-44 uses: with none set, connect refuses non-demo
  users; in development and previews the sentence is omitted.
- Test: no copy says "ever" or "permanently" about the rule (scan); the message renders the configured address; a
  deletion test pins that claims cascade on deletion (the sentence is true only while they do).
- Files: `lib/copy.ts`, `lib/claims.ts` (protected once 3.10 applies; this lands first or goes to that session), tests.

**F6-4: the first-visit line (OD 2.37).**
- Fix: `lib/copy.ts:452` becomes "Closed trades imported read-only from connected broker accounts. Losses included."
- Test: `lib/f13-copy.test.ts` pins the new line; no "Verified" in demo-facing first-visit copy (scan).
- Files: `lib/copy.ts`, the test.

**F6-5: record copy (OD 2.40).**
- Fix: "independent trades" replaces "bets" in user copy (`lib/trades.ts:593-598`, `lib/confidence.ts:88`, `:90`,
  `lib/copy.ts:564`); "a clear pattern of gains" / "of losses", in the past tense and never next to forward-looking
  words, replaces "consistent" (`lib/confidence.ts:90`); one muted "‹n› excluded" line on the card when n > 0 (F-21's
  sum). The `/t` strings (`app/t/[symbol]/page.tsx:128`, `:159`, `HoldTime.tsx:31`, `Concentration.tsx:30`) go with
  F-39; `lib/copy.ts:746` goes with F-42.
- Test: a scan finds no "bet"/"bets" or "consistent" in rendered user text outside `/t`; the card shows "‹n› excluded"
  only when n > 0.
- Files: `lib/trades.ts` (strings only), `lib/confidence.ts`, `lib/copy.ts`, the card. Home: F-33 edits
  `lib/confidence.ts`; build after it or hand it the strings.

**F6-6: design-system copy rulings (OD 2.41).**
- Fix: TR-7 label "Early record" (`lib/card-head.ts:41`, `lib/record-card.ts:325`); SW-1 hint "Press → for profile"
  where a fine pointer exists, with the arrow hidden from screen readers and the accessible text "Press the right arrow
  key for profile", and "See profile →" otherwise (`lib/copy.ts:456`); keep "Held · closed"; the positioning lead "No
  per-trade hiding. Losses shown and ranked like gains." on the home and /how, always next to the "How records are
  calculated" link and the "‹n› excluded" count; D25's Stocks line becomes "Browse stocks that have closed trades on
  Stock Social."; one record-maturity signal per surface (DSP-8); the bounce measure dropped, pane-open rate kept
  (F-15).
- Test: a pin per line; the hint's accessible text; one maturity signal per surface (render test); the lead renders
  only with the link and the count.
- Files: `lib/copy.ts`, `lib/card-head.ts`, `lib/record-card.ts`, the home, /how, the F-15 readout. DESIGN text:
  protected (3.20).

**F6-7: disclaimers and win rate on previews (OD 2.36).**
- Fix: the profile description's fallback (`app/u/[handle]/page.tsx:128-137`) and the importing trade and month
  descriptions end with both disclaimer sentences whenever they carry a return; no win rate on trade, month or story
  images (`lib/story-image.ts`).
- Test: every description builder with a return ends with `DISCLAIMER` (table test over every state); the image text
  scan finds no win rate.
- Files: the profile page, `lib/trade-share.ts`, `lib/recap.ts`, `lib/story-image.ts`, tests. Home: #102 edits the
  trade page and #100 the profile page and images; rebase on both.

**F6-8: the card date line (OD 2.39 A).**
- Fix: the card prints "Last close ‹Mon D, YYYY›".
- Test: a render test with a fictional record; the year is always printed; one shared date formatter test covers F6-8,
  F6-11 and F-41.
- Files: the card head and copy.

**F6-9: Flat tone and Demo hue (OD 2.43, 2.45).**
- Fix: a Flat tone at least ΔE00 9 from both inks under normal, protan, deutan and tritan views; the selected switch as
  the only non-focus outline; the card Demo hue becomes the tuned plum if it meets 4.5:1 on its background. The U+2212
  minus on images uses a font only after its licence is checked against POLICY C3, recorded in the PR.
- Test: F-20's colour-math test covers Flat against both inks; the contrast test covers the Demo hue; the outline scan
  allows only the switch.
- Files: `app/globals.css`, `lib/palette.ts`, tests. The floors move to the protected file in 3.19.

**F6-10: automated accessibility scan (OD 2.46).**
- Fix: once the protected PR adds the rule engine, an e2e pass runs it at 360 px in light and dark, and with reduced
  motion, on the feed, a profile, the pane, a trade page, /how, connect, settings, and the new screens: the F-40
  confirmation, the F-44 question, the F-45 preview, the F-37 result page, sign-up (F6-13) and the F-43 export.
- Test: zero serious or critical issues; the suite fails on any.
- Files: `e2e/`. Waits for the protected dependency PR.

**F6-11: "Last updated ‹date›" on the status line (OD 2.51).**
- Fix: "updated ‹when›" (`lib/copy.ts:1019`) reads "Last updated ‹Mon D, YYYY›".
- Test: one render test pins the whole joined status line ("Record since … · Last close … · Last updated …") at 360 px.
- Files: `lib/copy.ts`, tests.

**F6-12: admin reads are logged (OD 2.53).**
- Fix: `scripts/review-theses.ts` and `/review/theses` write one row per read (when, which queue, how many rows) to a
  new additive table with no user id and no thesis text. #100's `trust_audit` cannot take reads (its `user_id not
  null` and `action` check would need a `drop`, which CI blocks).
- Test: a read writes one row; the row holds no thesis text and no author handle (scan); `db/schema.sql` stays additive.
- Files: the script, the review page, `db/schema.sql`. Home: #102 edits `app/review/theses/page.tsx`; rebase.

**F6-13: EU/UK sign-up stance (OD 2.6).**
- Fix: the 18+ tick becomes one combined tick, "I am 18 or older and do not live in the EU or the UK.", collected on
  every first sign-in path including brokerage-first sign-up; the stored version text names both statements; no
  location lookup. The legal committee may reword it; the owner approves it (checklist).
- Test: sign-up without the tick is refused with a pinned, announced message; the attestation row records the version;
  the existing `adult_attested_at` test stays.
- Files: the sign-up form, `lib/auth/`, copy, tests. Terms text: L-1.

**F6-14: viewer sign-up behind its own switch (OD 2.3).**
- Fix: viewer-only sign-up (no broker connect) opens only when a separate switch is on, independent of `LAUNCH_OPEN`;
  both stay closed until the owner opens them.
- Test: each of the four switch combinations admits exactly the expected sign-ups (`lib/launch-gate.test.ts`).
- Files: `lib/launch-gate.ts`, sign-up, `.env.example`, tests.

**F6-15: F-15 defaults are pinned (OD 2.15).**
- Fix: confirm, and add where missing, the cap of 20 `share_action` rows a trader a day, counts kept with the account id
  on rename, and no trader-visible reach counts; the day-7 marker stays off until the privacy committee agrees and the
  Privacy Policy lists it.
- Test: the 21st row in a day is not stored; a rename keeps the counts; no page shows reach counts (scan).
- Files: `lib/share-actions.ts`, tests.

**F6-16: freeze rules are pinned (OD 2.30).**
- Fix: tests only, unless one fails: a confirmed freeze never unfreezes on its own; 401/403/404 refusals count and back
  off but never freeze alone; new trades after a relisting need fresh consent and resume the same record.
- Test: one DB test per rule. Files: tests; `lib/sync.ts` only if a test fails.

**F6-17: viewer-only accounts are not indexed (OD 2.41).**
- Fix: a viewer-only account's profile URL returns a `noindex` stub and appears in no sitemap (main's sitemaps list no
  profiles today; profile `noindex` is set only for F-7 filers, `app/u/[handle]/page.tsx:139`).
- Test: a viewer-only profile returns `noindex` and is absent from every sitemap; trader profiles are unchanged.
- Files: the profile page, sitemaps, tests. Home: #100 edits the profile page; rebase.

## Docs and chore work (no product code)

- **L-1:** the AI legal committee's drafts of the Privacy Policy and Terms, covering brief row 6 plus 2.6, 2.19, 2.21,
  2.62, 2.63, the F-44 answer, the F-47 backup window and the F-43 export, for the owner's approval.
- **L-2:** drafts of the written safeguards program, the key-rotation re-encrypt process, a breach runbook with state
  timelines, the compliance review calendar, the records-to-keep list and a corrections process (2.52, 2.53).
- **L-3:** refresh the vendor letter (Appendix A) with the questions in the owner checklist.
- **L-4:** draft the G1/G3/G4 and share-rate definitions for the week-8 gate (2.61).
- **C-1:** clear the 11 launch-relevant ponytail notes (BUS:172-186) before Beta (2.4).
- **C-2:** budget text in `docs/token-budget.md` and `scripts/token-budget.ts`: "admit when unsure", an admission margin
  below the cap, `capUsd` described as a usage cap, a per-PR cost log (2.56).
- **C-3:** the `vercel.json` cron entry (docs/SYNC.md:211-213; brief 4.3); fix docs/SYNC.md:206; add the `LAUNCH_*`,
  billing and `REVIEW_QUEUE` names to `.env.example` (the brief's "Can wait" list).
- **C-4:** record the 2.57 delegations and answers in `docs/IMPLEMENTATION.md` and the unprotected docs/process files.

## New features (approved by the committee check; numbers follow the business lead's build order)

**Queued:** development paused by the owner 2026-11-02 (`docs/DECISIONS.md`). Every F6 item below, and every new feature
F-37 to F-48, is queued: none is built until the owner resumes development. The feature files carry `Status: blocked`
with a `Blocked:` line naming the pause (the pipeline builds only `ready` files); on resume each goes back to the status
shown in the table below.

| Feature | Covers | Status on resume | Order and slot |
|---|---|---|---|
| F-37 A finished connect link never signs a browser in | 2.16 | ready | 1: the live security gap; connect route and sign-up |
| F-38 Neutral demo seed | 2.38 | ready | 2: seed only, no dependency |
| F-39 No return attached to a security | 2.38 | blocked (after #102, #100) | 3: `app/t` |
| F-40 In-app disconnect | 2.10 | ready | 4: settings and connections |
| F-41 Last known positions on a disconnected record | 2.31 | blocked (after F-34, F-40) | 5: pane/strip slot |
| F-42 One shared feed order without age assurance | 2.23 | ready | 6: deployed before 2027-01-01 |
| F-43 Export everything stored about the user | 2.8 | ready | 7: account slot |
| F-44 The licensed-user question and the claims line at connect | 2.21, 2.62 | blocked (after F6-2, F-43) | 8: connect consent slot |
| F-45 Connect preview | 2.11 | blocked (after F-44, F-38) | 9: connect consent slot |
| F-46 Open positions in the TR-9 range | 2.34 | blocked (after F-33) | 10: ranking slot |
| F-47 Preference data deleted after 90 days | 2.13 | ready | 11: discovery; copy with L-1 |
| F-48 The vendor connection is deleted when a record freezes | 2.12 | draft (vendor answer) | after F-40 and the vendor's reply |

## Protected-file work (for the protected-files session)

Brief §3 items 3.1-3.25 as accepted, plus: the MPL-2.0 `LICENSE_REVIEWED` entry and the dev dependency (2.46); the CI
row-count step (Q4); TR-9 text with the evidence floor and near-edge ranking (Q3, 2.33); DESIGN §2.5 fee denominator
(Q1); TR-5 vendor deletion (2.12, F-48); POLICY F3's exclusion list naming transfers out (3.17). Dropped: 3.20's TR-4
dated exception (2.25 overridden).
