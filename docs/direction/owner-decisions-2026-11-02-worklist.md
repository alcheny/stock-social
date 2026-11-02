# Owner decisions 2026-11-02: work map

Source: the owner's decisions of 2026-11-02, given in chat to the orchestrator and recorded in `docs/DECISIONS.md`
(entries dated 2026-11-02). They accept every recommendation in `docs/direction/owner-decisions-2026-11-01.md` §2
("the brief", items 2.1-2.63) and cycle-5 owner questions Q1-Q4 (`docs/direction/cycle5-2026-11-01.md` §8), with
the exceptions recorded there. Base: `origin/main` ca34767 (#97). Open PRs at that base: #100 (F-16/F-17), #102
(F-25). Committee check of the new features and fixes items: `docs/features/logs/owner-decisions-2026-11-02/committee.md`.
This map lists the work found in those sources; it is not a guarantee that nothing else is open. Not legal advice.

## Owner's actions outside the repository

- [ ] **Repository visibility:** switch the repository to private (2.55); check the Actions minutes on the plan.
- [ ] **Branch protection** on main with Code Owners review, if the plan allows (row 3; brief 4.3).
- [ ] **Role mailbox** for privacy, legal, takedown and vendor mail, forwarding to two places (2.21, row 9; 4.5).
      Several features below need its address in configuration.
- [ ] **Vendor letter:** refresh Appendix A and send it from the role mailbox (2.24; 4.1). Add: public display of
      unrealized values (owner decision on 2.25), MRC2-10 (F-32 Part B), whether derived percentages may stay public
      after a connection is deleted (2.12, F-37 Part B), the F-14 cadence, quota and cost. Record the written reply
      with a dated DECISIONS line. Start per-broker production access and sign-in providers' app reviews (row 11).
- [ ] **Privacy Policy and Terms:** commission the AI legal committee's drafts now; approve the final text with an
      effective date within two weeks (2.5, 2.6, 2.62, row 6). The drafts are repository work (L-1 below); the
      approval is yours.
- [ ] **Approve the consent and options lines:** the final consent line of F6-2 (2.7) and the amended options scope
      line (2.63, plan D5 wording) when their PRs show them.
- [ ] **Production environment and host:** `ALLOW_DEV_AUTH` unset on Production; separate random `APP_SECRET_KEY`,
      `SESSION_SECRET`, `CRON_SECRET` per environment; `NEXT_PUBLIC_SITE_URL`; `TRUST_PROXY_HEADERS` unset; vendor
      portal origins from a live URL; Postgres with point-in-time restore; edge rate limits; `LIVE_BILLING` off;
      `LAUNCH_OPEN` closed; `DAILY_PR_CAP` set (rows 1, 5; 2.1, 2.3, 2.47, 2.56; 4.3).
- [ ] **Cron:** merge the `vercel.json` cron PR (C-3 below) and confirm the plan's cron interval (row 12).
- [ ] **Copyright agent** registered before theses go live (2.18; 4.2). **Name clearance** search (row 28).
- [ ] **Qualified Individual** named; adopt the written safeguards program, key-rotation re-encrypt process and breach
      runbook once drafted (2.52; L-2 below). Name the data-inventory keeper (2.53).
- [ ] **Beta gate:** sign checklist B1-B15, dated, before setting `LAUNCH_ALLOWLIST_EMAILS`; choose wave 0 (10-20
      adults you know, no registered advisers or paid promoters); sign the week-8 gate definitions once drafted
      (2.1, 2.2, 2.61).
- [ ] **People tests:** the 5-second share-card test with 10 people outside finance (2.35); the 360 px keyboard and
      screen-reader walkthrough and the badges on a low-end phone (row 29; 4.4); the F-15 bot-filter check (4.4).
- [ ] **Production runs:** `scripts/rebuild-records.ts` on each matcher deploy (row 13); `scripts/shared-accounts.ts`
      counts (4.6); `scripts/review-theses.ts` daily during Beta (2.20); the dated accuracy sign-off after the rebuild
      (row 14).
- [ ] **Before live billing:** the limited attorney review (2.54), the processor's written confirmation and data
      terms (2.47; 4.2). **Entity and insurance** by Open; **postal address** before commercial email (rows 38-39).
- [ ] **Try built features** and mark each accepted or rework (4.4).

## Kinds

**code** (app or lib change, built by the pipeline or a session) · **copy** (product text only) · **protected** (a
protected file; prepared by the protected-files session and merged by the orchestrator once green and independently
reviewed, owner decision 2026-11-02) · **docs** (unprotected docs an agent writes) · **owner** (outside the repo, in
the checklist above) · **none** (already true on main, or decided not to build).

## Map: brief items 2.1-2.63

| Item | Decision | Covered by | Kind |
|---|---|---|---|
| 2.1 | Beta checklist signed before the allowlist | owner checklist | owner |
| 2.2 | Wave 0 composition | owner checklist | owner |
| 2.3 | `LAUNCH_OPEN` closed until Open sign-off; viewer sign-up behind its own switch after Terms and Privacy | `LAUNCH_OPEN` is the owner's env; the separate viewer switch is **F6-14** | owner, code |
| 2.4 | Ponytail notes accepted in bulk; agents clear the 11 launch-relevant ones before Beta | DECISIONS entry (this PR); **C-1** clears the 11 | docs, code |
| 2.5 | Privacy Policy and Terms drafts now; owner approves | **L-1** drafts; owner approves | docs, owner |
| 2.6 | EU/UK users not allowed, stated in Terms, enforced at sign-up | Terms text (L-1); sign-up enforcement **F6-13** | docs, code |
| 2.7 | One new consent version (handle, display name, reasons, status dates, public since) | **F6-2** | code, copy |
| 2.8 | Export = everything stored, percent only, consent records, raw activities, no secrets | **F-42** | code |
| 2.9 | No "permanently"; deletion leaves only a no-personal-data handle reservation | **F6-3** ("one profile, ever" is the phrase on main, `lib/copy.ts:107`, `lib/claims.ts:8`) | copy |
| 2.10 | In-app disconnect before real users | **F-37** Part A | code |
| 2.11 | Connect preview with a Demo record, no broker call | **F-38** | code |
| 2.12 | Delete the vendor connection on a confirmed freeze once the vendor confirms | **F-37** Part B (vendor answer); TR-5 amendment | code, protected, owner |
| 2.13 | Preference data deleted at 90 days | **F-43**; F-2 dated line (this PR) | code |
| 2.14 | Implicit logging stays off; only the owner flips it | none: off by default on main (`lib/discovery/activity.ts:23-33`); F-2 dated line corrects the +2 weight note | none |
| 2.15 | F-15 defaults en bloc | none for the 120-day bound (on main, `lib/privacy-retention.ts:89-93`); the 20-a-day `share_action` cap and the day-7 marker are checked in **F6-15** | code |
| 2.16 | Lured link: no session, decline and clean up | **F-39** | code |
| 2.17 | Handles: 365-day reservation, retire handles that had a record, one rename per 30 days | F-17 (#100) builds the 30-day rename; hand-off: #100's F-17 says "Nothing is retired forever", which conflicts with "never reissue": **H-1** | code |
| 2.18 | Takedown wording, anti-impersonation line, report on thesis and profile; copyright agent before theses go live | F-16 (#100); agent registration in the owner checklist | code, owner |
| 2.19 | One transactional-only email sender in one file, listed as a sub-processor | none for the file (`lib/auth/email.ts`); listing in the Privacy Policy (L-1) | docs |
| 2.20 | Held-thesis release duty, daily during Beta | owner checklist (`scripts/review-theses.ts`) | owner |
| 2.21 | Account claims reviewed by a person through the role mailbox, explained at connect and in Terms | **F6-3** (claims copy), **F-38** (connect line), Terms (L-1), mailbox (owner) | copy, code, owner |
| 2.22 | Under-18 report procedure | audited owner-run deletion script: F-16/F-17 session (owner decision 2026-11-02; F-16 dated line) | code |
| 2.23 | K18: non-personalized or follows-only order without age assurance; no age-assurance build | **F-44** | code |
| 2.24 | Vendor written reply is the hard gate; add unrealized values to the letter | owner checklist; **L-3** refreshes Appendix A text | owner, docs |
| 2.25 | **Overridden:** unrealized values keep showing; one Open line; thin names deferred | F-34 (building, shown-values variant); F-6 dated line; letter question (L-3) | code, owner |
| 2.26 | Count date-only same-instant pairs with evidence | none: overtaken by #89 (F-30 stays draft; dated line); the stamp-pattern readout row is in `claude/chores-cycle5` | none |
| 2.27 | Taint after an oversell | none: main counts every later sell (#89), stricter (F-28 stays draft; dated line) | none |
| 2.28 | Transfers are share moves; POLICY F3 names transfers out | **F-22** (`ready`); F-32 Part B (vendor MRC2-10); POLICY 3.17 | code, protected, owner |
| 2.29 | No early taint release; append-only revisions for vendor corrections; held rows counted | rows are insert-only on main (`lib/sync.ts:37`), so the rule holds; CLAUDE.md 3.4 text; held-line wording **F6-1**. Storing corrections waits on C3-9b | protected, copy |
| 2.30 | A confirmed freeze stays frozen; refusals back off, never freeze alone | main (fixes cycle 3, #79, confirmed freeze); a pin test is **F6-16** | code |
| 2.31 | Last known positions on a disconnected record | **F-40** | code |
| 2.32 | One range rule: arithmetic mean; "Too early to tell"; "average per trade so far, likely between X and Y" | **F-33** (it owns the printed range; dated line and AC). Main uses a geometric mean on the profile (`lib/trades.ts:559-583`) and an arithmetic one on the card (`lib/bets.ts:42`) | code, protected (TR-9) |
| 2.33 | Near-edge distance from 0, documented on /how | main already weighs the near edge of the pace interval (`lib/trades.ts:612-622`); **F-33** adds the floor and the /how text; CLAUDE.md 3.6 | code, protected |
| 2.34 | Open positions in the range | **F-45** | code |
| 2.35 | 5-second test first; then maybe amend CH-1 | owner checklist; a CH-1 change only after the result (new decision then) | owner |
| 2.36 | Keep win rate in the profile headline; none on trade and month images; preview descriptions with a return end with both sentences | **F6-7** (gaps: profile fallback description, importing trade and month descriptions, the story image) | code |
| 2.37 | New first-visit line | **F6-4** | copy |
| 2.38 | Neutral demo seed, fourth losing trader, no return on a security | **F-41** | code |
| 2.39 | Card date line "Last close ‹Mon D, YYYY›" | **F6-8** | copy |
| 2.40 | "Disconnected" on its own line; "‹n› excluded"; "independent trades"; "a clear pattern of gains/losses" | **F6-5** ("Disconnected" is already its own line, `app/ui.tsx:108`) | copy |
| 2.41 | Design-system rulings en bloc | **F6-6** (code and copy); DESIGN §1.2, §3.4, TR-7, TR-9, SW-1 text (3.20) | copy, code, protected |
| 2.42 | Dark share images use the page inks | none: applied in #77 | none |
| 2.43 | Flat tone ΔE00 ≥ 9 from both inks; the selected switch is the only non-focus outline | **F6-9** | code |
| 2.44 | Contrast floors in a protected file | protected (3.19, `scripts/invariants.test.ts`) | protected |
| 2.45 | Card Demo hue tuned plum if it meets A1; the image font for U+2212 once licence-checked | **F6-9** (hue); font licence check in F6-9, any font file is an asset under C3 | code |
| 2.46 | Accessibility rule engine as a dev dependency (MPL-2.0) | protected (`package.json`, lockfile, `LICENSE_REVIEWED`); then **F6-10** adds the automated scan | protected, code |
| 2.47 | Billing en bloc | `LIVE_BILLING` refusal on main (`lib/billing.ts:49`); the remaining conditions are checked before live billing, not now (no new work now) | owner |
| 2.48 | F3b literal reading | none: no email carries record content (`lib/copy.ts` LOGIN_MAIL only); #100 adds a guard test | none |
| 2.49 | F-7 switch-on checklist; T2 amendment | owner (switch stays closed); POLICY 3.16; mapping the importer to the real filing index waits for switch-on | owner, protected |
| 2.50 | Park F-5 and F-8; F-8 O6 describes a method, not a person | F-5 and F-8 dated lines (this PR) | docs |
| 2.51 | Share-move read daily with a "Last updated ‹date›" line | the read is daily on main (`lib/sync-cadence.ts`); the line is **F6-11** | copy |
| 2.52 | Safeguards program, Qualified Individual, re-encrypt process, breach runbook | **L-2** drafts; owner names and adopts | docs, owner |
| 2.53 | Compliance calendar, records list, inventory keeper, corrections process, admin read logs | **L-2** (calendar, records, corrections process); **F6-12** (admin read logs); owner names the keeper | docs, code, owner |
| 2.54 | Limited attorney review before live billing; POLICY "counsel" wording; DESIGN and feature files covered | owner (review); protected (3.18) | owner, protected |
| 2.55 | **Repository made private**; licence not decided | owner checklist | owner |
| 2.56 | Budget admission rule text, `capUsd` is a usage cap, `DAILY_PR_CAP`, per-PR cost log | **C-2** (docs/token-budget.md and `scripts/token-budget.ts`, not protected); `DAILY_PR_CAP` is the owner's | docs, code, owner |
| 2.57 | Process questions Q1-Q14 en bloc | protected: CLAUDE.md 3.7 (Q1), CODEOWNERS and `scripts/team.ts` 3.9 (Q7), `scripts/features.ts` (Q4), `.claude/agents/engineer.md` (Q10), POLICY T1 (Q11). **C-4** records the delegations in `docs/IMPLEMENTATION.md` and the docs/process answers (Q2, Q3, Q5, Q8, Q9, Q12-Q14) | protected, docs |
| 2.58 | Guardrails under CODEOWNERS; Doctor exception closed; seeded-defect audit and privacy-diff check | protected (3.10, `scripts/doctor.ts`, `.github/`) | protected |
| 2.59 | Four protected-path merges | protected-files session | protected |
| 2.60 | Stale status lines | this PR (F-11, F-16, F-17, F-21, F-25, F-32, F-33, F-35, F-36) | docs |
| 2.61 | Week-8 gate reading pre-registered; agents draft G1/G3/G4 and share-rate definitions | **L-4** drafts; owner signs | docs, owner |
| 2.62 | Terms ban paid signals; sellers held for the legal committee; ask at connect | Terms (L-1); **F-38** (the question) | docs, code |
| 2.63 | Options consent en bloc | options stay gated (main: `lib/options-gate.ts`); F-29 (building); the amended scope line waits for the owner's approval (checklist). Open: strike inference in the consent text or the Privacy Policy | owner, code |

## Map: cycle-5 owner questions

| Q | Decision | Covered by | Kind |
|---|---|---|---|
| Q1 | Fees in the denominator | **F-36** (blocked only on chore C5-43(b)); DESIGN §2.5 text | code, protected |
| Q2 | The 18+ tick survives one email-error round trip, if the legal committee confirms | F5-7's last part on `claude/fixes-cycle5`, after the committee's confirmation | code |
| Q3 | Evidence floor: moderate tier, 1-point spread floor | **F-33** | code, protected (TR-9) |
| Q4 | Row-count check around `npm test` in CI | protected (`.github/workflows/ci.yml`) | protected |

## Other owner decisions of 2026-11-02

| Decision | Covered by | Kind |
|---|---|---|
| Chart precision above ±100% | F-23 follow-up (F-23 session; dated line) | code |
| Held-sells wording | **F6-1** | copy |
| Protected-file PRs merged by the orchestrator when green and reviewed | protected-files session | protected |
| Development resumed; the 60% weekly cap applied to last week only | DECISIONS entry | none |

## Hand-offs to in-flight work

- **H-1 (#100, F-17):** 2.17 says a handle that ever had a connected record is retired and never reissued. #100's F-17
  file says "Nothing is retired forever". Change #100 to retire such handles (a neutral 404 for the old URL stays),
  or record why it can't, before #100 merges.
- **#100 and #102:** both PRs set F-16, F-17 and F-25 to `built` on their branches, while this PR sets them to `ready` on
  main. Whichever merges second gets a one-line conflict on the `Status:` line: keep `built`, and keep both sides'
  dated decision lines.
- **F-34 and F-35:** this PR carries their branches' file versions word for word, so their merges stay clean.
- **`claude/fixes-cycle5`:** F6 items that touch `lib/copy.ts` take that branch's `FC5` copy object if it merges first.

## Fixes list (cycle-5 format; no vote)

Ordered record trust first, then launch gates, then copy. "Home" names the in-flight branch that already touches the
files. Every test is added, never weakened; pinned copy tests change their expected value only. Fictional data only.

**F6-1: the held-sells line uses the owner's wording.**
- Fix: `PROFILE.excludedHeld` (`lib/copy.ts:88`) reads "‹N› sells excluded while a possible duplicate is checked."
  (singular for 1). Drop the ponytail at `lib/copy.ts:83-87`.
- Test: a unit test pins both forms; `e2e/f24-excluded-held.spec.ts` keeps reading the constant.
- Files: `lib/copy.ts`, a test. Home: `claude/fixes-cycle5` (copy object).

**F6-2: one new consent version (OD 2.7).**
- Fix: add version 2 to `lib/consent-versions.ts`: the scope line starts "Public: your handle, display name, any reasons
  you publish, percent returns, …" and adds "connection status dates (last update, disconnected, account removed)",
  the connection date an idle record falls back to, and "public since". `CONSENT_SCOPE_LINE` moves into
  `lib/consent-versions.ts` (3.8). Traders on version 1 see a re-consent prompt; until they accept, nothing they had
  not consented to becomes newly public. The exclusion counts (F-32 owner flag) are named if the owner approves.
- Test: the new line names every field `lib/privacy-fields.ts` marks public (guard); a version-1 trader sees the
  prompt; declining keeps the record as consented under version 1; the consent row stores the version.
- Files: `lib/consent-versions.ts`, `lib/copy.ts`, the consent page, `lib/privacy-fields.ts`, tests.
- Owner: approves the final string in the PR (checklist). Protection of these files is 3.8 (protected session).

**F6-3: deletion and claims wording (OD 2.9, 2.21).**
- Fix: replace "A broker account can belong to one profile, ever." (`lib/copy.ts:107`, `lib/claims.ts:8`) with a line
  that says a broker account belongs to one profile, deleting the profile removes the personal data, and only a handle
  reservation with no personal data remains. The claims refusal adds: "If you think this is a mistake, write to
  ‹role address›; a person reviews it." The address comes from configuration.
- Test: no copy says "ever" or "permanently" about the rule (scan); the claims message renders the configured address;
  with none set it omits the sentence and a test flags the missing configuration.
- Files: `lib/copy.ts`, `lib/claims.ts` (protected by 3.10 once applied; prepare before), tests.

**F6-4: the first-visit line (OD 2.37).**
- Fix: `lib/copy.ts:452` becomes "Closed trades imported read-only from connected broker accounts. Losses included."
- Test: `lib/f13-copy.test.ts` pins the new line; a scan finds no "Verified" in demo-facing first-visit copy.
- Files: `lib/copy.ts`, the test.

**F6-5: card and record copy (OD 2.40).**
- Fix: "independent trades" replaces "bets" in user copy (`lib/trades.ts:593-598`, `lib/copy.ts:564`, `:746`); "a
  clear pattern of gains" / "of losses" replaces "consistent" (`lib/confidence.ts:90`); one muted "‹n› excluded" line on
  the card when n > 0 (F-21's sum).
- Test: a copy scan finds no "bet"/"bets" in rendered user text and no "consistent"; the card shows "‹n› excluded"
  only when n > 0.
- Files: `lib/trades.ts` (copy strings only), `lib/confidence.ts`, `lib/copy.ts`, the card. Home: F-33 edits
  `lib/confidence.ts`; build after it or hand the strings to it.

**F6-6: design-system rulings (OD 2.41).**
- Fix: TR-7 label "Early record" (`lib/card-head.ts:41`, `lib/record-card.ts:325`); SW-1 hint "Press → for profile"
  where a fine pointer exists and "See profile →" otherwise (`lib/copy.ts:456`); keep "Held · closed"; the positioning
  lead "No per-trade hiding. Losses shown and ranked like gains." on the home and /how; viewer-only accounts get a
  noindex stub and stay out of the sitemap; D25's Stocks line becomes "Browse stocks that have closed trades on Stock
  Social."; one record-maturity signal per surface (DSP-8). Drop the bounce measure, keep pane-open rate (F-15).
- Test: string pins for each line; a viewer-only profile returns `noindex` and is absent from every sitemap; a
  render test finds one maturity signal per surface.
- Files: `lib/copy.ts`, `lib/card-head.ts`, `lib/record-card.ts`, the profile page, sitemaps, F-15 readout. DESIGN
  text: protected (3.20).

**F6-7: disclaimers and win rate on previews (OD 2.36).**
- Fix: the profile description's fallback (`app/u/[handle]/page.tsx:128-137`) and the importing trade and month
  descriptions end with both disclaimer sentences whenever they carry a return; no win rate on trade, month or story
  images (`lib/story-image.ts`).
- Test: every description builder with a return ends with `DISCLAIMER` (table test over every state); image text scan
  finds no win rate.
- Files: the profile page, `lib/trade-share.ts`, `lib/recap.ts`, `lib/story-image.ts`, tests. Home: F-25 (#102) edits
  the trade page; rebase.

**F6-8: the card date line (OD 2.39 A).**
- Fix: the card prints "Last close ‹Mon D, YYYY›".
- Test: render test with a fictional record; the year is always printed.
- Files: the card head and copy.

**F6-9: Flat tone and Demo hue (OD 2.43, 2.45).**
- Fix: a Flat tone at least ΔE00 9 from both inks for normal, protan, deutan and tritan views; the selected switch is
  the only non-focus outline; the card Demo hue becomes the tuned plum if it meets 4.5:1 on its background. The U+2212
  minus on images uses a font only after its licence is checked against C3 (record the licence in the PR).
- Test: F-20's colour-math test covers Flat against both inks; the contrast test covers the Demo hue; the outline scan
  allows only the switch.
- Files: `app/globals.css`, `lib/palette.ts`, tests. Floors move to the protected file in 3.19.

**F6-10: automated accessibility scan (OD 2.46).**
- Fix: once the protected-files PR adds the rule engine, an e2e pass runs it on the feed, a profile, the pane, a trade
  page, /how, connect and settings at 360 px in light and dark.
- Test: the scan reports zero serious or critical issues; the suite fails on any.
- Files: `e2e/`. Waits for the protected dependency PR.

**F6-11: "Last updated ‹date›" on the status line (OD 2.51).**
- Fix: the status line's "updated ‹when›" (`lib/copy.ts:1019`) reads "Last updated ‹Mon D, YYYY›".
- Test: render test; F-11's tests keep their structure with the new string.
- Files: `lib/copy.ts`, tests.

**F6-12: admin reads are logged (OD 2.53).**
- Fix: `scripts/review-theses.ts` and `/review/theses` write one audit row per read (who, when, how many rows, which
  queue) with no thesis text; #100's `trust_audit` table is reused if it has merged.
- Test: a read writes one row; the row holds no thesis text or user handle of the authors (scan).
- Files: the script, the review page, additive `db/schema.sql`. Home: #100 (`trust_audit`).

**F6-13: EU/UK sign-up stance (OD 2.6).**
- Fix: sign-up states that the service is for adults in the United States only and asks the user to confirm it with the
  18+ attestation (one recorded attestation, wording from the legal committee); no location lookup.
- Test: sign-up without the confirmation is refused; the attestation row records the version.
- Files: the sign-up form, `lib/auth/`, copy, tests. Wording: the legal committee, with the Terms (L-1).

**F6-14: viewer sign-up behind its own switch (OD 2.3).**
- Fix: viewer-only sign-up (no broker connect) opens only when a separate switch is on, independent of
  `LAUNCH_OPEN`; both stay closed until the owner opens them.
- Test: each of the four switch combinations admits exactly the expected sign-ups (`lib/launch-gate.test.ts`).
- Files: `lib/launch-gate.ts`, sign-up, `.env.example`, tests.

**F6-15: F-15 defaults are pinned (OD 2.15).**
- Fix: confirm, and add where missing, the cap of 20 `share_action` rows a trader a day, counts kept with the account
  id on rename, no trader-visible reach counts; the day-7 marker stays off until the privacy committee agrees and the
  Privacy Policy lists it.
- Test: the 21st row in a day is not stored; a rename keeps counts; no page shows reach counts (scan).
- Files: `lib/share-actions.ts`, tests.

**F6-16: freeze rules are pinned (OD 2.30).**
- Fix: tests only, unless one fails: a confirmed freeze never unfreezes on its own; 401/403/404 refusals count and back
  off but never freeze alone; new trades after a relisting need fresh consent and resume the same record.
- Test: one DB test per rule. Files: tests; `lib/sync.ts` only if a test fails.


## Docs and chore work (no product code)

- **L-1:** AI legal committee drafts of the Privacy Policy and Terms, covering every topic in brief row 6 plus 2.6,
  2.19, 2.21, 2.62 and 2.63, for the owner's approval. Lands as drafts outside `app/` until approved.
- **L-2:** drafts of the written safeguards program, the key-rotation re-encrypt process, a breach runbook with state
  timelines, the compliance review calendar, the records-to-keep list and a corrections process (2.52, 2.53).
- **L-3:** refresh the vendor letter (Appendix A) with the questions listed in the owner checklist.
- **L-4:** draft the G1/G3/G4 and share-rate definitions for the week-8 gate (2.61).
- **C-1:** clear the 11 launch-relevant ponytail notes (BUS:172-186) before Beta (2.4).
- **C-2:** budget rule text in `docs/token-budget.md` and `scripts/token-budget.ts`: "admit when unsure", an admission
  margin below the cap, `capUsd` described as a usage cap, the per-PR cost log (2.56).
- **C-3:** the `vercel.json` cron entry from docs/SYNC.md:211-213 (brief 4.3); fix docs/SYNC.md:206 and add the
  `LAUNCH_*`, billing and `REVIEW_QUEUE` names to `.env.example` ("Can wait" list).
- **C-4:** record the 2.57 delegations and answers in `docs/IMPLEMENTATION.md` and the unprotected docs/process files.

## New features (Status: ready after the committee check)

| Feature | Covers | Build slot / order |
|---|---|---|
| F-37 In-app disconnect | 2.10, 2.12 (Part B on the vendor's answer) | settings and sync; own slot |
| F-38 Connect preview and the licensed-user question | 2.11, 2.21, 2.62 | connect slot, after F6-2 |
| F-39 A finished connect link never signs a browser in | 2.16 | connect slot, with F-38 (one builder) |
| F-40 Last known positions on a disconnected record | 2.31 | pane/strip slot, after F-34 |
| F-41 Neutral demo seed; no return attached to a security | 2.38 | seed and `app/t`; after #102 |
| F-42 Export everything stored about the user | 2.8 | account slot |
| F-43 Preference data deleted at 90 days | 2.13 | discovery slot |
| F-44 Non-personalized order without age assurance | 2.23 | discovery slot, with F-43; on main before 2027-01-01 |
| F-45 Open positions in the range | 2.34 | ranking slot, after F-33 |

## Protected-file work (for the protected-files session)

Brief §3 items 3.1-3.25 as accepted, plus: the MPL-2.0 `LICENSE_REVIEWED` entry and the dev dependency (2.46); the CI
row-count step (Q4); TR-9 text with the evidence floor and near-edge ranking (Q3, 2.33); DESIGN §2.5 fee denominator
(Q1); TR-4 stays without a dated exception (2.25 overridden: 3.20's TR-4 item is dropped); POLICY F3's exclusion list
naming transfers out (3.17); TR-5 vendor deletion (2.12).
