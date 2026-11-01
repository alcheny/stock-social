# Owner decisions brief, 2026-11-01

**How to use this.** Section 2 is the part that needs you. Answer it in one reply, by number, for example
"2.1 yes, 2.2 yes, 2.39 B, 2.20 no", which takes about 15 minutes. A blank means you accept the councils'
recommendation shown. Items 2.61-2.63 were added late and sit in their topic groups. Section 1 lists what must be
done before any real user; most rows point to a section 2 question or a section 3 edit. Section 3 holds the exact
text for files only you can change. Section 4 is work outside the repository. Section 5 is for awareness only. The
brief covers the items found in the sources listed in section 6; it is not a guarantee that nothing else is open.

- Date: 2026-11-01
- Base commit: `origin/main` 8e3e9a5 (#85 merged). #88 (a likes paging test) merged since and changes nothing here.
  Open PRs: #77 (F-20 tokens), #84 (F-24), #87 (F-26; its body says "No owner or counsel item"), #89 (fixes cycle 4:
  a C4-1/C4-2 matcher rule and owner items; read it with 2.26-2.27 and 2.59).
- Citation keys. `BUS` docs/direction/business-2026-11-01.md · `MKT` docs/direction/market-2026-11-01.md ·
  `MKT2` docs/direction/market-2026-11-01-cycle2.md · `DES` docs/direction/design-2026-11-01.md · `DS`
  docs/direction/design-system-2026-11-01.md · `CRE` docs/direction/creative-2026-11-01.md · `GAME`
  docs/direction/game-2026-11-01.md · `C3` docs/direction/cycle3-2026-11-01.md · `C4`
  docs/direction/cycle4-2026-11-01.md · `A1` docs/ideas/approval-2026-11-01.md · `A2` …-cycle2.md · `A3`
  …-cycle3.md · `A3b` …-cycle3-ballots.md · `A4` …-cycle4.md · `BR` docs/ideas/2026-11-01-board-review.md · `DA`
  docs/process/decisions-and-authority.md · `SEC` docs/security/review-2026-11-01.md · `F-n` the feature file
  docs/features/F-n-*.md · `logs/` docs/features/logs/. Everything else is a full repo path or a PR number.

## 1. Launch blockers

Before any real (non-demo) user connects or signs up. Ranked: rows 1-5 are live gaps on main today. "Effort" is
your time, not agents' time.

| # | Blocker | What the owner does | Effort | Source |
|---|---|---|---|---|
| 1 | **Sign-in: confirm the dev sign-in is off in production; replace the remaining stub.** Real sessions exist (lib/session.ts:1-3, lib/auth/); only `/login/dev` is a stub, guarded by `devGuard()` (lib/session.ts:8-13, app/login/dev/page.tsx). CLAUDE.md:77 still calls all auth a stub. | Confirm `ALLOW_DEV_AUTH` is unset on Production (Preview only); confirm one real sign-in method is configured; confirm MFA is offered and sign-in rate limits are on; merge the CLAUDE.md fix (3.5). | 30 min | docs/POLICY.md:23-24, :235-236; docs/COMPLIANCE.md:137 |
| 2 | **Security patches O1-O6 in protected files.** Main still breaks POLICY R2/R3 in workflows and has three code gaps: injectable `run:` line (.github/workflows/review.yml:88), unpinned installer in four workflows (plan.yml:44, build.yml:190, features.yml:177, doctor.yml:70), no session check for deleted profiles (lib/session.ts:26), unchecked forwarded headers (lib/session.ts:60), GCM tag not pinned (lib/broker.ts:57). | Apply 3.11-3.13 (3.14, O8, can follow). | 1 hour | SEC:24-47; BUS:528 |
| 3 | **Branch protection on main.** Main has none; protected paths rely on the Gate only. | Turn on protection with "Require review from Code Owners" if the plan allows (4.3). | 10 min | .github/CODEOWNERS:2 |
| 4 | **Framework advisory: re-check at deploy.** Main is on 16.4.3 (package-lock.json:1507-1508), not 16.4.0. A fresh build today printed no security notice; earlier build logs did (logs/F-1/build-pr2b-fix2.md:265). | Run `npm audit` and read the framework's advisories on the deploy commit. A bump edits protected `package.json`/`package-lock.json`. | 15 min at deploy | logs/F-2/test-pr4-tester.md:25 |
| 5 | **Production environment.** Separate random `APP_SECRET_KEY`, `SESSION_SECRET`, `CRON_SECRET` per environment; previews never hold production keys; Postgres with point-in-time restore; preview databases seeded, never copied from production; `TRUST_PROXY_HEADERS` unset; `VENDOR_PORTAL_ORIGIN` confirmed from a live portal URL; edge rate limits on feed paging and image routes. | Set the host (4.3); merge the O9 doc text (3.15). | half day | BUS:149; SEC:38, :45-46; docs/AUTOPILOT.md:319-320 |
| 6 | **Privacy Policy and Terms written, approved, live.** Both pages are placeholders (app/privacy/page.tsx:7-12, app/terms/page.tsx:7-12); a todo test waits on the text (lib/discovery/f2-privacy.test.ts:12). Must also cover: sub-processors (incl. the email sender), F-15 counters and retention, device-storage flags, raw option fields, licence to display records and theses, 18+, freeze, one profile per broker account, deletion, the paid-signals ban (2.62), EU/UK stance (2.6), cookie and opt-out-signal posture. | Answer 2.5; commission drafts from the AI legal committee now; approve the final text with an effective date. | 2 weeks elapsed, 2 h reading | docs/POLICY.md:54-59; BUS:147, :535; docs/COMPLIANCE.md:94, :129 |
| 7 | **Consent line must name the record-status dates.** #85 made it live: the status line publishes last update, disconnected and account-removed dates (lib/privacy-fields.ts:66) that the consent scope line (lib/copy.ts:85) does not name. The code marks it as owner copy (lib/copy.ts:82-84). | Answer 2.7 (one new consent version); approve the text. | 15 min | #85; docs/POLICY.md:54-55 |
| 8 | **Vendor end-user terms accepted at connect** "the way its developer terms require". Not in any council list. | Read the broker-data vendor's developer terms; tell agents what the connect step must show or record. | 1 hour | docs/POLICY.md:56-57 |
| 9 | **Role mailbox** (privacy, legal, takedown, vendor mail), forwarding to two places. P6 needs a working contact. | Set it up (4.5). | 30 min | BUS:138, :526 |
| 10 | **Vendor written permission.** The letter (Appendix A) is unsent and stale. A written reply covering closed-trade percentages, public display and a beta of 50 or fewer is the hard gate. | Answer 2.24; refresh and send the letter (4.1). | 1 hour, then wait | BUS:139, :148, :441-518; C4:820-828 |
| 11 | **Production approvals with their own clocks** (the vendor's per-broker production access; sign-in providers' app reviews). | Start now (4.1). | 1 hour | docs/IMPLEMENTATION.md:66-74 |
| 12 | **Schedule the sync cron.** `vercel.json` holds only `{"git":{"deploymentEnabled":false}}`; no sync ever runs and `/api/health` reads degraded (503) until it does. | Add the cron entry (4.3 has the JSON), set a random 32+ character `CRON_SECRET`, confirm the plan allows 5-minute crons (else hourly with `SYNC_CRON_EVERY_MIN=60`). | 20 min | vercel.json; docs/SYNC.md:202-213; app/api/health/route.ts:1-2; BUS:142 |
| 13 | **Run `scripts/rebuild-records.ts` once on deploy, and after any matcher change.** It is not wired into `vercel-build` (package.json:14). | `node --env-file=.env scripts/rebuild-records.ts` against production; check "failed: 0"; keep the log. | 10 min each | scripts/rebuild-records.ts:1-27; logs/fixes-cycle3/committee-2026-11-01.md:189 |
| 14 | **Accuracy sign-off for platform-computed figures** after the matcher rebuild has run and been checked. | Dated sign-off. | 30 min | docs/POLICY.md:234-235; A3b:659 |
| 15 | **Lured-link sign-in.** Finishing a connect link signs that browser in (app/connect/done/route.ts:33-36). | Answer 2.16. | 1 word | BUS:527; SEC:20 |
| 16 | **Unrealized values shown without market-data permission.** F-6 shows unrealized percentages publicly and the code has no market-data gate (#45). | Answer 2.25. | 1 word | BUS:532; F-6:60-63 |
| 17 | **First-visit line calls demo cards verified** (POLICY F3a conflict on main). | Answer 2.37. | 1 word | lib/copy.ts:437; F-13:56-61 |
| 18 | **Link-preview descriptions with a return lack the disclaimer** (POLICY F3). | Answer 2.36. | 1 word | CRE:881-883; DS:732 |
| 19 | **Demo seed and stock pages.** Demo tickers resemble listed companies and a slang handle; compare and Baseline pages attach returns to a security. | Answer 2.38. | 1 word | CRE:868-873, :884-885; DES:1046-1048 |
| 20 | **Handle reissue and renames.** No rename limit and no permanent retirement; one account can hold a few old handles at once (capped, lib/auth/attempts.ts:156-158). | Answer 2.17. | 1 word | DES:1057-1061; DS:730 |
| 21 | **Takedown page, report action, anti-impersonation line; DMCA agent before user content goes live.** | Answer 2.18; register the agent (4.2). | 1 hour | F-16:45-46; docs/COMPLIANCE.md:126; docs/POLICY.md:145-149 |
| 22 | **Email sender** for sign-in links and account-event mail. | Answer 2.19. | 1 word | F-16:42, :146 |
| 23 | **Held-thesis release duty** until admin identity exists (`scripts/review-theses.ts`). | Answer 2.20. | 1 word | scripts/review-theses.ts:1-9 |
| 24 | **Account claims and multi-owner accounts.** Mistaken claims need a human path; co-holders of one brokerage login need a stated policy. | Answer 2.6 and 2.21. | 1 word | docs/COMPLIANCE.md:138; docs/POLICY.md:231 |
| 25 | **Export, deletion wording and in-app disconnect.** Export scope undecided; "permanently" may misstate deletion rights; consent copy promises a disconnect that is not built. | Answer 2.8-2.10. | 1 word each | C3:611-620; CRE:898-899; A3:195 |
| 26 | **Under-18 report procedure** (delete, log, review the gate). Not in any council list. | Answer 2.22. | 1 word | docs/COMPLIANCE.md:135 |
| 27 | **Minors' feed laws, dated 2027-01-01 (one state) and 2027-01-25 (another).** | Answer 2.23. | 1 word | F-2:150-153; F-16:143-144; BUS:162 |
| 28 | **Name clearance (T5a)** before any domain, logo or outreach. | Commission the search (4.2). | 30 min, then wait | BUS:151, :536; docs/POLICY.md:76-78 |
| 29 | **Accessibility (A1).** No automated checker; no human 360 px pass; badges unchecked on real phones. | Answer 2.46; do 4.4. | half day | BUS:146; BR:777-787; DS:786 |
| 30 | **Safeguards program and breach runbook** (Qualified Individual, written program, key-rotation re-encrypt step, breach timelines). | Answer 2.52. | 2 hours | BUS:161; docs/COMPLIANCE.md:159 |
| 31 | **Corrections process** for platform-computed figures (POLICY launch list). Not in any council list. | Answer 2.53. | 1 word | docs/POLICY.md:234-235 |
| 32 | **Access logs for admin reads** (`scripts/review-theses.ts`, `/review`). Not in any council list. | Answer 2.53. | 1 word | docs/COMPLIANCE.md:96-98 |
| 33 | **Shared-account counts** before the identity-claim line lands. | Run 4.6. | 15 min | logs/known-limits/committee-2026-11-01.md:180-181; #52 |
| 34 | **Consent copy is not protected**; an agent could widen consent silently. | Apply 3.8. | 10 min | #62 |
| 35 | **Owner-only edits to CLAUDE.md and POLICY** (stale auth, sync and options lines; T2 and F3 wording; "counsel" wording). | Apply section 3. | 1 hour | section 3 |
| 36 | **Beta gate set.** Checklist B1-B15 signed; wave 0 composition; private dry run on production; takedown, restore and key-rotation drills; `LAUNCH_OPEN` kept closed; viewer sign-up behind its own switch. | Answer 2.1-2.4. | 1 hour | BUS:136-166; lib/launch-gate.ts:1-13 |
| 37 | **Repository licence.** The repository is public with no licence (all rights reserved by default). | Answer 2.55. | 1 word | BUS:546; docs/POLICY.md:212-219 |
| 38 | **Entity and insurance** by Open (not Beta). | 4.2. | external | BUS:158-160 |
| 39 | **Postal address** before any commercial (non-transactional) email. | 4.5. | 30 min | MKT2:549 |
| 40 | **Before live billing only:** keep `LIVE_BILLING` off; checkout conditions; processor written confirmation. | Answer 2.47; 4.2. | 1 word | F-3:239-254; BUS:539-540 |

## 2. One-sitting decisions

Format: question. **Rec:** council recommendation (source). Conflicts are flagged in one line. "POLICY:" marks a
recommendation changed to keep within docs/POLICY.md.

### Launch gates

- **2.1** Adopt the Beta checklist B1-B15 and sign it, dated, before setting `LAUNCH_ALLOWLIST_EMAILS`; live
  billing stays off? **Rec:** yes (BUS:152; #45).
- **2.2** Wave 0 is 10-20 adults you know, no registered advisers or paid promoters? **Rec:** yes (BUS:537).
- **2.3** Keep `LAUNCH_OPEN` closed until the dated Open sign-off (O-1..O-9), and open viewer sign-up only after
  Terms and Privacy are live, through a separate viewer switch? **Rec:** yes (BUS:166; C3:693-694).
- **2.4** Ponytail notes: accept engineering-only notes in bulk in DECISIONS.md and have agents clear the 11
  launch-relevant ones (BUS:172-186) before Beta? **Rec:** yes. Note: main now has 214 `ponytail:` markers in
  app/, lib/, db/ and scripts/ (225 with e2e/ and .github/), not 179.
- **2.61** Pre-register the week-8 gate reading now: the clock starts at the first real connect; week 12 is the base
  plan; G0 and G1 are hard; an inconclusive result is not a miss; keep "miss two or more"; agents draft the G1/G3/G4
  and share-rate definitions for your sign-off? **Rec:** yes (BUS:538; MKT:496-500).
- **2.5** Privacy Policy and Terms: commission drafts from the AI legal committee now and approve within two
  weeks? **Rec:** yes (BUS:535). Also: write the delegation into POLICY H? **Rec:** no change; you approve the
  final text (docs/POLICY.md:18-24).
- **2.6** EU/UK users not allowed at launch, stated in the Terms and enforced at sign-up? **Rec:** yes
  (docs/COMPLIANCE.md:199 mitigation). Not in any council list.

### Privacy and consent

- **2.7** One new consent version that adds, in one go: handle, display name and published reasons (prefix
  "Public: your handle, display name, any reasons you publish, percent returns, …"); "connection status dates
  (last update, disconnected, account removed)" and the connection date an idle record falls back to; and "public
  since"? **Rec:** yes (logs/fixes-cycle2/committee-2026-11-01.md:58-59; lib/copy.ts:83-84; C3:641-648).
- **2.8** Export = everything stored about the user, percent only for trades, consent and attestation records, no
  secrets, and the raw activities as stored? **Rec:** yes (C3:611-620; legal rater adds raw activities).
- **2.9** Drop "permanently" from the one-profile rule; say deletion removes the personal data and only a
  no-personal-data handle reservation remains? **Rec:** yes (CRE:898-899).
- **2.10** Build the in-app disconnect before real users (the consent copy promises it); no vendor-side delete
  until 2.12 is decided? **Rec:** yes (A3:195).
- **2.11** Connect preview shows a Demo record of what becomes public (no broker call before consent)?
  **Rec:** yes (#44; A2:183-185).
- **2.12** Once the vendor confirms derived percentages may stay public, delete the vendor connection when a
  record freezes (amends DESIGN TR-5)? **Rec:** yes, decided before real users. Conflict: A1:172-175 recommends
  none now; the legal committee wants it decided before real users (A3b:661).
- **2.13** F-2 preference data: delete the implicit activity log and expired like/reject events at 90 days?
  **Rec:** yes (BR:566-575). POLICY: the earlier indefinite-storage decision conflicts with P3 "store the minimum".
- **2.14** F-2 implicit logging stays Off; only you flip it? **Rec:** yes (F-2:148). Correction: the +2 weight is
  the opening swipe (lib/discovery/weights.ts:7), not follow.
- **2.15** Accept the F-15 defaults en bloc: 120-day bound and a cap of 20 `share_action` rows a trader a day;
  counts stay with the account id on rename; no trader-visible reach counts for now; the day-7 marker only if the
  privacy committee agrees and the Privacy Policy lists it? **Rec:** yes (F-15:216-220; C3:699-700;
  A3:228-229).
- **2.63** Options consent en bloc: options stay gated until you approve an amended scope line (plan D5 wording,
  logs/options/plan.md:121) as a new consent version with a re-consent prompt; a private "not asked yet" vs "declined"
  fact on the trader's own view, worded by the legal committee; `optionsPublic()` stays closed until that exists;
  a size caveat (F-23) only if the fee probe shows leakage; keep "never shown" for `sell_id` only once F-25 makes it
  true? **Rec:** yes (C4:873-876; F-29:40-44, :67-69; F-23:47-49; F-25:219-221). Conflict on strike inference:
  the engineer accepts it with a Privacy Policy line; the legal rater wants it in the consent text.

### Sign-in, trust and safety

- **2.16** Lured link: no session; show "These accounts are on @x's record. Sign in with the method you used
  before", decline and clean up the link? **Rec:** yes; the sources agree (BUS:527).
- **2.17** Handles (OD-12): reserve an old handle 365 days, retire handles that had a connected record (never reissue),
  one rename per 30 days? **Rec:** yes (DES:1057-1061; DS:730).
- **2.18** Approve the takedown page wording, the anti-impersonation line and a report action on each thesis and
  profile; register the DMCA agent before theses go live (not at Open)? **Rec:** yes. POLICY: BUS:544 says "at
  Open"; docs/COMPLIANCE.md:126 requires it before user content goes live.
- **2.19** One transactional-only email sender, isolated in one file, listed as a sub-processor? **Rec:** yes
  (F-16:42; docs/IMPLEMENTATION.md:146-155 request 6).
- **2.20** Accept the held-thesis release duty with `scripts/review-theses.ts`, with a stated cadence (suggest:
  daily during Beta)? **Rec:** yes (#65).
- **2.21** Account claims: human review through the role mailbox, explained at connect and in the Terms; a
  co-holder who re-links while signed out stays refused until the identity claim lands? **Rec:** yes
  (docs/COMPLIANCE.md:138; logs/known-limits/committee-2026-11-01.md:177-181).
- **2.22** Under-18 report procedure: treat a report like a child-privacy notice: delete, log, review the age gate?
  **Rec:** yes (docs/COMPLIANCE.md:135). Not in any council list.
- **2.23** Minors' feed laws (K18), before 2027-01-01: viewers without age assurance get a non-personalized or
  follows-only order; no age-assurance build now (no date of birth, ID or age estimation)? **Rec:** yes (business
  lead; MKT2:522 leans this way; F-16:143-144). No council chose; the K18 method stays yours.
- **2.62** Terms ban selling signals or paid access through a profile, thesis or card; paid-signal sellers held for
  the legal committee; ask at connect whether the user is a registered representative or adviser? **Rec:** yes
  (F-3:247-248; MKT2:564-565).

### Vendor and open positions

- **2.24** Treat a written vendor reply covering closed-trade percentages, public display and a beta of 50 or fewer
  as the hard gate before any real connect? **Rec:** yes (BUS:148).
- **2.25** Open positions: a dated exception in F-6/TR-4: unrealized values hidden for real users until the vendor
  answers in writing, line "Open positions exist and aren't shown yet", tests on each leak path; no market-data
  vendor for now; one "Open" line, defer withholding thin names? **Rec:** yes (BUS:532; A2:176-182). Conflict:
  the legal rater would withhold symbols on thinly traded names now; the engineer would defer.

### Matcher rules (decide in one sitting, #86)

- **2.26** Q1(a): count, not publish, a same-instant sell on 00:00:00Z stamps when the pair shows evidence it may
  not be a long close, per broker once the vendor names its date-only brokerages? **Rec:** yes, as narrowed
  (C4:861-866; A4:294). Trade-off: a same-day short with no evidence still publishes.
- **2.27** Q1(b): after a k-unit oversell, taint the next k units bought (amends "later buys start fresh lots",
  lib/trades.ts:46)? **Rec:** yes; cycle 4's top item, 15/15 (C4:861-866). If silent, F-28 and F-30 lapse.
- **2.28** F-22: a transfer is a share move, with the basis rule (oldest first only where it cannot change a basis;
  moved-in units excluded and counted; every transfer out counted; unknown kinds still tainted), and amend POLICY
  F3's exclusion list to name transfers out (3.17)? **Rec:** yes (A3:217-218; A4:294). Note: the cycle-4
  re-approval failed (mean 3.47); four members rate it "the one at-will way to remove a loss today" (A4:259).
- **2.29** Matcher housekeeping en bloc: no early release of F-28's taint without documented evidence (never a time
  guess); vendor corrections go in an append-only revisions table ("raw, immutable" read as "never updated in
  place", 3.4); F-24 held rows stay out of the record, counted for you only, option twins held too? **Rec:** yes
  (F-28:72-73; C3:684-686; #84).

### Freeze rules

- **2.30** TR-5 / Q1: a confirmed freeze stays frozen; new trades after a relisting need fresh consent, which
  resumes the same record (TR-6); refusals (401/403/404) count and back off but never freeze on their own?
  **Rec:** yes (C3:676-680). If silent: nothing unfreezes. The 24 h confirmation window has no council view; keep it
  unless you say otherwise.
- **2.31** OD-9: show a disconnected account's last positions labelled "last known ‹date›"? **Rec:** yes (DES:1049-1051;
  C3:681-683).

### Ranges, charts and headline stats

- **2.32** One range rule everywhere: arithmetic mean of simple returns (amend TR-9 step 2); "Too early to tell"
  for a zero-width range; wording "average per trade so far, likely between X and Y"? **Rec:** yes (DS:737-738;
  CRE:844-847).
- **2.33** Ranking: (c) near-edge distance from 0, documented on /how, and amend CLAUDE.md:92 (3.6)? **Rec:** (c)
  (DES:1027-1032). Conflict: the engineer reads TR-9 as lower-bound ranking; either way, one documented method.
- **2.34** Open a feature to include open positions in the TR-9 range (docs/DESIGN.md:340-341 already includes them;
  lib/trades.ts:382 does not)? **Rec:** yes (F-6:58-59).
- **2.35** Share-card chart: run the 5-second test with 10 people outside finance first; if most read the end point
  as account growth, use the running average with its range and amend CH-1? **Rec:** yes (BR:723-730; BUS:543).
  Conflict: DES wants both series captioned; CRE one series.
- **2.36** Headline and image stats en bloc: keep win rate in the profile headline until the D23 result; drop
  win rate from trade and month images; end each link-preview description that carries a return with both
  disclaimer sentences? **Rec:** yes (BR:1295-1298; CRE:881-889). Profit factor: the board moved it to a secondary
  row and left removal from DESIGN §2.5 to you (BR:1310-1313); the engineer would drop it, the legal rater keep it
  with a plain definition on /how.

### Card and product copy

- **2.37** Replace the D27 first-visit line with "Closed trades imported read-only from connected broker accounts.
  Losses included."? **Rec:** yes (F-13:57). POLICY: the current line calls demo cards verified (F3a).
- **2.38** Demo and stock pages: neutral fictional handles and theses, tickers that resolve to no listed company,
  a fourth losing demo trader; attach no return to a security (remove the compare return, reword Baseline)?
  **Rec:** yes (CRE:868-873, :884-885).
- **2.39** Card date line: **A** "Last close ‹Mon D, YYYY›" (DS:724) or **B** "Last trade ‹month year›" when idle
  over 30 days (F-4:174-176)? **Rec:** A (DS:724; business lead, engineer). The legal rater prefers B; CRE wanted
  "Imported ‹date›".
- **2.40** Card copy en bloc: "Disconnected ‹date›" on its own line under the Verified pill, not in it; one muted
  "‹n› excluded" line when n > 0; "independent trades" instead of "bets"; "a clear pattern of gains/losses"
  instead of "consistent"? **Rec:** yes (DS:725; C3:687-688; CRE:841-843, :877-880). POLICY: DS:728 "keep bet"
  works against F6 (no wagering vocabulary).
- **2.41** Design-system rulings en bloc: TR-7 "Early record"; SW-1 hint "Press → for profile" where a fine pointer
  exists and "See profile →"; drop bounce, keep pane-open rate; keep "Held · closed"; drop the "Edge: …" string
  from TR-9; positioning lead "No per-trade hiding. Losses shown and ranked like gains."; amend DESIGN §1.2
  persona and strike §3.4 "skill"/"badges"; viewer-only accounts get a noindex stub out of the sitemap; DSP-3
  (D25's Stocks line becomes "Browse stocks that have closed trades on Stock Social.") and DSP-8 (one
  record-maturity signal per surface)? **Rec:**
  yes (DS:722-736; C4:877-883; MKT:596; BR:1367-1370; DES:1040-1042). DESIGN edits are yours (3.20).

### Colour (F-20, #77)

- **2.42** OQ-1: dark share images move gain/loss from #22c55e / #f43f5e to the page's #3cc4b4 / #ff8a5b? **Rec:**
  yes (F-27:104). Already applied in #77; revert is two values.
- **2.43** OQ-2: route a Flat tone at least ΔE00 9 from both inks via the fixes list (protan 2.8 today); OQ-3:
  the selected switch is the only non-focus outline exception? **Rec:** yes (#77).
- **2.44** OQ-7: move the contrast floors into a protected file so the change that breaks them cannot lower them
  (3.19)? **Rec:** yes (F-20:58-61; A3:231-232).
- **2.45** Card Demo hue = tuned plum (if it meets A1 contrast); approve the image font for U+2212 minus once its
  licence is checked? **Rec:** yes (DS:723, :739; CRE:855-857).
- **2.46** Approve the accessibility rule engine as a dev dependency, with a licence-review entry? **Rec:** yes
  (BUS:534); dependency-free tests meanwhile (DES:1052-1054).

### Billing, marketing scope (before live billing)

- **2.47** Billing en bloc: `LIVE_BILLING` off until the week-8 gates pass, then switch on only after the checklist
  plus the C4-41 line ("the configured price equals `PLANS` in amount, currency and interval, with a fake-processor
  test"); adopt the checkout conditions (unchecked box, no preselected plan, reminder 30-40 days before renewal,
  no trial); a connected trader never sees a price, with one plain line; no pricing tests now; run the priced
  notify-me test ("nothing is charged now"); no creator payouts for now? **Rec:** yes (A4:306-308; F-3:241-251;
  A1:172-175).
- **2.48** F3b scope: literal reading, bar (a) the founder's own card, (b) trader cards on company accounts, (c)
  moderation notices quoting a thesis; allow (d) the trader's own Share; "your broker link needs attention" email
  allowed, "import finished" not yet; "connect and get Record tools" held for the legal committee? **Rec:** yes
  (MKT2:536-542; C3:689-692). POLICY: allowing (a)-(c) would break F3b.

### F-7, F-5, F-8

- **2.49** F-7 switch-on: adopt the checklist and the counts-only dry run (threshold 100 filers with 5+ priced
  closes, stated in advance); confirm P3 covers only traders who connect (or amend it); remove any filer who is not
  an elected official on request; map the importer to the real filing index before switch-on (#56); keep it built
  closed; amend T2 (3.16)? **Rec:** yes (C4:867-872;
  logs/F-7/legal-findings.md:134-146). POLICY: real filers breach T2 and P3 until you amend them.
- **2.50** Park F-5 (blocked until the vendor answers C) and F-8 (off your list, $0 ceiling); F-8 O6: describe a
  method instead of naming it after a person? **Rec:** yes (BUS:541; GAME:474-476). POLICY: GAME's "allowed as method
  names in docs" breaks T2.

### Operations and compliance housekeeping

- **2.51** Share-move read runs daily, with the "Last updated ‹date›" line shown? **Rec:** yes (docs/SYNC.md:245-250).
- **2.52** Safeguards: assume covered; name a Qualified Individual; adopt the written program, the key-rotation
  re-encrypt process and a breach runbook with state timelines? **Rec:** yes (docs/COMPLIANCE.md:159; BUS:161).
  The runbook is not in any council list.
- **2.53** Adopt the compliance review calendar and records-to-keep list, name who keeps the data inventory, add a
  corrections process for platform-computed figures, and log admin reads? **Rec:** yes
  (docs/COMPLIANCE.md:170-182). Inventory owner, corrections and admin logs are not in any council list.
- **2.54** Buy one limited, staged attorney review before live billing; fix POLICY's "counsel" wording (3.18); does
  the AI-findings replacement also cover DESIGN and the feature files? **Rec:** yes, yes, yes (BR:450-459; BR:139-162
  item 9).
- **2.55** Repository licence: **A** none on purpose (all rights reserved) or **B** a named licence? **Rec:** your
  call (BUS:546). Note: the repository is already public, so POLICY's "Before publishing" steps (delete old
  workflow runs, review issues and PRs, noreply email) apply now (docs/POLICY.md:212-219).
- **2.56** Agent spend and token-budget admission: budget rule 4 reads "admit when unsure", with an admission
  margin below the cap (most windows end rejected today); state that `capUsd` is a usage cap, not a spending
  ceiling; set `DAILY_PR_CAP` as a spend guard; no weekly budget change; per-PR cost log yes; "merge oldest PRs
  first" and the "state of main" note not adopted (they limit the rate)? **Rec:** yes (DA:286-294; C4:308; BUS:529,
  :545). Conflict: BR idea 11 wants a hard monthly spend cap pinned by a test (2.58).
- **2.57** Process questions: accept DA's recommendations en bloc? Q1 (b) exempt owner-decided and council-approved
  features from three versions, stated in CLAUDE.md (3.7); Q2 (a) idea board is the single writer; Q3 (a)
  delegation covers open points, not disagreements; Q4 (a) filter `featurePrs()` to `feature/` heads; Q5 (a)
  design sessions open a docs PR; Q6 (b) orchestrator merges protected PRs after your approval at the head SHA; Q7
  (b) protect docs/process except coordination.md (3.9); Q8 (a) orchestrator sets `built`; Q9 (a); Q10 (a) resync
  the agent copy of the engineer spec; Q11 (a) name the billing vendor in T1 (3.17); Q12 (a); Q13 (a) for scope
  and process, (b) for owner-only items; Q14 (a) admit. Plus: one owner queue of at most 7 items; a rebase-first
  slot for stale branches; re-approvals are not new and the cap counts build slots; record today's delegations in
  docs/IMPLEMENTATION.md. **Rec:** yes (DA:144-294; C3:701-704; C4:884-890; A4:313-314). Q13 note: a relayed
  approval never covers POLICY H items.
- **2.58** Autonomous-build guardrails: put billing, consent, deletion, auth, trade math, moderation, disclaimer,
  claims, share card and /how under CODEOWNERS (3.10); close the Doctor's protected-path exception; monthly
  seeded-defect audit and a privacy-diff check? **Rec:** yes (BR:104-111).
- **2.59** Ratify the four protected-path merges when green: `scripts/compliance.ts` (move `PROMO` into `lib/`,
  keeping its coverage), `lib/broker.ts` (count symbol-less and future-dated rows), CLAUDE.md:155, and e2e trace
  and screenshot on failure (uploads only from jobs with no secrets)? **Rec:** yes (C4:891-895; A4:275-276).
- **2.60** Correct stale feature-file status lines: F-11 and F-14 still say `Status: ready` though merged; F-16,
  F-17 and F-24 cite merged blockers; F-20's blocker (fix #26) needs a check? **Rec:** yes (3.21).

### Can wait

Low value or not yet relevant; the council default stands if you say nothing.
- Pane opener (b), portal S2, card 1 thesis slot, small 360 px follow-ups, smaller ticker test (DES:1013-1017,
  :1043-1045; #55; #76; #54).
- Negative-row card table (logs/F-4/build-engineer.md:106-109), `chart.tsx` gap (DS:771-772), F-3 stale lines
  (F-3:7-10).
- Go-to-market v2, projections and founder hours (MKT2:552-563); creator payouts; later public sources
  (logs/F-7/legal-findings.md:145-146).
- Sharded-sync switch-on (docs/SYNC.md:239-258), waits on the vendor's quota.
- 350-card day list membership (#81): same ranking as the feed; the rule goes on /how.
- WCAG 2.1 vs 2.2 in docs/COMPLIANCE.md:153 (POLICY says 2.2 and wins; not a protected file, agents can fix it);
  the other BR:139-162 doc conflicts (FEATURES "agents can't change docs/features/", SW-1 vs F-2 O1, "the
  orchestrator merges" vs POLICY S4); docs/SYNC.md:206 says there is no vercel.json, and .env.example lacks the
  `LAUNCH_*`, billing and `REVIEW_QUEUE` names (agents can fix both).
- IMPLEMENTATION pre-authorization requests 4-10 and 13 (docs/IMPLEMENTATION.md:146-155): mark them answered by
  2.5, 2.19, rows 5 and 12; the rest can wait.
- POLICY pointer to docs/process (#50), DECISIONS #11 annotation (docs/DECISIONS.md:36, :75), optional
  `@img/sharp-wasm32` licence exception, budget rule 8 baseline, process-docs read-through.
- `/me/record` corporate-action count (#40), e2e billing globalSetup and `scripts/handoff.ts:248` truncation
  (#52), #81 protected ponytail notes.

## 3. Owner-only edits to protected files

"Protected" means listed in .github/CODEOWNERS (the Gate never auto-merges) and/or `PROTECTED` in
scripts/team.ts:118 (agents' edits are reverted). Text marked **draft** was written for this brief because no
source gave exact text.

### CLAUDE.md (CODEOWNERS and scripts/team.ts:118)

**3.1 Sync paths (CLAUDE.md:70-71).** Replace "(hourly cron," with (logs/F-14/pr-body.md:47-50):
```text
`POST /api/sync` runs hourly; each account's activities are read at most once a day and its positions at most 4 times a day (F-14, docs/SYNC.md → Read cadence).
```

**3.2 Known limits, options (CLAUDE.md:155).** Replace "Options are skipped in `fetchActivities`; long-only FIFO." (#62):
```text
Options: short options, exercises, assignments and unpriceable contracts are excluded and counted; option results are public only under the per-trader consent gate (lib/options-gate.ts); see docs/features/logs/options/.
```
C4:587-591 (#83) asks to keep "long-only FIFO" for shares in the same line.

**3.3 Known limits, sync (CLAUDE.md:156).** Replace the sequential-loop line (#46):
```text
`/api/sync` is sharded (`?shard=i&of=N`, docs/SYNC.md): ≈155k traders a round on 40 shards × 6 workers at 12 req/s, extrapolated from the measured per-shard rate (1.55× over 100k). Switch-on gate in docs/SYNC.md (vendor quota and cost in writing, the "Last updated" line, the owner's TR-5 refusal rule, `dbConfigOk`, the housekeeping cron entry). Remaining ponytail (lib/sync.ts): a sync past SYNC_FIT_CAP accounts, or reading more than one vendor page per account, can still overrun and roll back. The runner quarantines such a trader; per-account checkpoints are a follow-up PR.
```
Add the two #52 lines:
```text
- TR-6 identity claim is inactive until `lib/broker.ts` passes `institution_account_id` (see `lib/claims.ts`).
- Shared-account cleanup is owner-run: `scripts/shared-accounts.ts`.
```

**3.4 Raw activities (CLAUDE.md:62), if 2.29 is yes. Draft:**
```text
`activities` table (raw, never updated in place: vendor corrections are appended as revisions, `unique(source, external_id)`)
```

**3.5 Auth section (CLAUDE.md:77-79).** Replace the "Auth is a dev stub" paragraph (suggested in the code collector's review; matches lib/session.ts:1-3):
```text
**Auth:** Sessions are real (F-1, lib/auth/). Only /login/dev is a stub, guarded by devGuard(); never set ALLOW_DEV_AUTH on production.
```

**3.6 Ranking (CLAUDE.md:92), after 2.33. Draft:**
```text
- Rank losses equal to gains of the same size, by the one method documented on /how (DESIGN TR-9). Never hide losses.
```

**3.7 Three versions (CLAUDE.md:140), if 2.57 Q1 is (b). Draft** from DA:150-152:
```text
Exemption (owner decision 2026-11-01): features the owner decided in a design session or the approval council approved are built as one version; three versions stay for open-direction product changes.
```

### .github/CODEOWNERS and scripts/team.ts (both protected)

**3.8 Consent (2.7; #62). Draft.** `CONSENT_SCOPE_LINE` lives in the shared lib/copy.ts:85; have an agent move it
into lib/consent-versions.ts first, or protect lib/copy.ts whole.
```text
# Consent scope and public fields (POLICY P3, P6): owner only
/lib/consent-versions.ts @<owner>
/lib/privacy-fields.ts @<owner>
/lib/privacy-fields.test.ts @<owner>
```

**3.9 docs/process, option (b) (DA:215-221). Draft.** CODEOWNERS (use the owner handle of the existing entries):
```text
/docs/process/README.md @<owner>
/docs/process/architecture.md @<owner>
/docs/process/budget-and-rate.md @<owner>
/docs/process/collaboration.md @<owner>
/docs/process/decisions-and-authority.md @<owner>
/docs/process/lifecycle.md @<owner>
/docs/process/quality.md @<owner>
/docs/process/review-2026-11-01.md @<owner>
```
and the same paths as `'./docs/process/<file>'` entries in `PROTECTED` (scripts/team.ts:118).

**3.10 Guardrails (2.58; BR:104-111). Draft:**
```text
/lib/billing.ts @<owner>
/lib/delete.ts @<owner>
/lib/privacy-purge.ts @<owner>
/lib/auth/ @<owner>
/lib/trades.ts @<owner>
/lib/moderation.ts @<owner>
/lib/claims.ts @<owner>
/app/disclaimer.tsx @<owner>
/app/how/ @<owner>
/app/u/[handle]/opengraph-image.tsx @<owner>
```
Check how the Gate matches `[handle]` before relying on the last line.

### Security patches (SEC; #42)

**3.11 lib/session.ts O1 and O2** (SEC:24, :40). Test: a session for a user with `deleted_at` set returns no user;
production with no site URL throws; `x-forwarded-proto: javascript` gives `http://`.
```diff
@@ export async function currentUser(): Promise<User | null> {
-  const [u] = await sql<User[]>`select * from users where id = ${id}`;
+  const [u] = await sql<User[]>`select * from users where id = ${id} and deleted_at is null`;
```
```diff
 export async function origin(): Promise<string> {
   const site = process.env.NEXT_PUBLIC_SITE_URL;
   if (site) return site.replace(/\/$/, '');
+  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEV_AUTH !== '1') throw new Error('NEXT_PUBLIC_SITE_URL is required in production');
   const h = await headers();
-  return `${h.get('x-forwarded-proto') ?? 'http'}://${h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'}`;
+  const proto = h.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
+  return `${proto}://${h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'}`;
 }
```

**3.12 lib/broker.ts O3** (SEC:47; lib/broker.ts:57). Test: a tag cut to 4 bytes throws.
```diff
-  const d = createDecipheriv('aes-256-gcm', key(), iv);
+  const d = createDecipheriv('aes-256-gcm', key(), iv, { authTagLength: 16 });
```
Later, after 2.21's counts (4.6), the identity-claim field (#52):
```ts
export type VendorAccount = { id: string; authorizationId: string; institution: string; isPaper: boolean; initialSyncCompleted: boolean; institutionAccountId: string | null };
// in listAccounts' map:
institutionAccountId: a.institution_account_id ?? null,
```

**3.13 Workflows O4, O5, O6** (SEC:31-33).
O4, .github/workflows/review.yml:88:
```diff
       - env:
           GH_TOKEN: ${{ github.token }}
-        run: gh workflow run gate.yml -R "$GITHUB_REPOSITORY" --ref main -f branch="${{ needs.review.outputs.branch }}"
+          BRANCH: ${{ needs.review.outputs.branch }}
+        run: gh workflow run gate.yml -R "$GITHUB_REPOSITORY" --ref main -f branch="$BRANCH"
```
Extend the `run:` scan in scripts/workflow-security.test.ts to each `${{ }}` carrying `needs.`, `steps.`,
`inputs.` or `github.head_ref`.
O5: add `persist-credentials: false` under `with:` of the checkouts in review.yml and judge.yml; check that the
judge job's push step still has credentials.
O6: in plan.yml:44, build.yml:190, features.yml:177 and doctor.yml:70 replace
`curl -fsSL https://claude.ai/install.sh | bash` with `... | bash -s <exact version>` (or a lockfile-pinned CLI),
and add a test that rejects an unpinned `| bash`.

**3.14 O8: package.json and .github/dependabot.yml** (SEC:39):
```json
"engines": { "node": ">=24" }
```
```yaml
cooldown:
  default-days: 7
```

**3.15 O9: docs/AUTOPILOT.md:319-320** (text from #42; BUS:149). Replace "random strings, all environments" with:
```text
separate random `APP_SECRET_KEY`, `SESSION_SECRET` and `CRON_SECRET` per Vercel environment. Preview builds run unmerged PR code; they must never hold production's keys.
```

### docs/POLICY.md (CODEOWNERS and scripts/team.ts:118)

**3.16 T2 (docs/POLICY.md:70-71), if 2.49 is yes. Draft** built on BUS:347-348's phrase "production data from public
filings, never in the repository". Append:
```text
Real people's names may appear in production data from public filings, never in the repository.
```

**3.17 F3 /how list (docs/POLICY.md:115-116) and T1.** "short, exercised and assigned options" is #62's text;
"transfers in and out" is **draft**, for use if 2.28 is yes:
```text
"How records are calculated" (what Verified means and what is excluded: short, exercised and assigned options, short sales,
transfers in and out, positions with no recorded entry, unconnected brokers).
```
T1 (2.57 Q11): add the billing processor that lib/billing.ts integrates to the integrated-vendor list.

**3.18 "Counsel" wording (docs/POLICY.md:15-16, :221; BR:139-162 item 9). Draft:**
```text
This is a risk-reduction policy written by AI, not legal advice. Before any public product launch, the
owner signs off on it against the AI legal committee's findings (see the owner decision below and
**Before a public launch**).
```
```text
## Before a public launch (owner sign-off)
```
If 2.54's third part is yes, add to the owner decision (docs/POLICY.md:18-24): "This also covers docs/DESIGN.md
and the feature files."

### Other protected files

**3.19 scripts/invariants.test.ts** (2.44): pin the contrast floors from F-20:58-61 there. No exact text in the
sources; an agent drafts the test, you merge it.

**3.20 docs/DESIGN.md** (protected), per your answers: TR-9 step 2 arithmetic mean and no "Edge: …" string
(2.32, 2.41); TR-7 label (2.41); SW-1 pointer hint (2.41); CH-1 after the 5-second test (2.35); TR-5 freeze and
vendor deletion (2.12, 2.30); TR-4 dated exception (2.25); §1.2, §3.4, §3.5 (2.41); §2.5 profit factor (2.36);
§3 "counsel" notes (2.54). No exact text in the sources beyond these rulings.

**3.21 Feature files** (protected by scripts/team.ts:118 `./docs/features/**`, not by CODEOWNERS, whose lines
25-26 are a comment). Set F-11:3 and F-14:3 to `Status: built`; drop the merged "waits for" lines in F-16, F-17,
F-24 and F-20; restate F-2's 90-day criterion (2.13). Record in docs/features/F-14-sync-cadence.md
(logs/F-14/pr-body.md:82-85):
```text
An account whose sync rolls back after its activities read can be read again after the 6 h floor, up to 4 times a day (G2).
```

**3.22 docs/DECISIONS.md** (protected): the "Deferred until Open" table (BUS:384), with the DMCA agent moved
before user content (2.18); the dated vendor-reply line (2.24); ponytail acceptances (2.4).

**3.23 playwright.config.ts** (protected): ratify `workers: 1` (playwright.config.ts:13, #81) and the font pin
(playwright.config.ts:7, #41). Add on 2.59 (C4:804; C4-40):
```ts
use: { trace: 'retain-on-failure', screenshot: 'only-on-failure' },
```
with no retries, and in .github/workflows/ci.yml an `if: failure()` upload of `test-results/` kept 7 days.

**3.24 scripts/compliance.ts** (protected): the third-party resource rule that docs/COMPLIANCE.md:87 says is "not
there yet". **Draft spec:** in `app/`, `lib/`, `public/` (not tests), flag `<script src=` or a stylesheet or font
`<link href=` that points to another origin, and imports from hosted-font loaders; today's code has none. Add the
O-8 banned strings and "every stock" after live hits are removed (DS:729); any moderation-pattern exception comes
from you only (POLICY: agents cannot add exceptions).

**3.25 Process files** (protected): copy team/engineer.md over .claude/agents/engineer.md (2.57 Q10); filter
`featurePrs()` in scripts/features.ts to `feature/` heads (Q4); fix scripts/handoff.ts:248 dropping findings past
50 without a count (#52). Not protected: docs/IMPLEMENTATION.md, so agents can record the delegations there.

## 4. External actions

**4.1 Vendor.** Refresh Appendix A (BUS:441-518) with options, the whole-history share-move read, F-14 cadence,
the MRC2-10 list, public-record coverage, quota and cost, option-derived figures (C4:820-828), and send it from
the role mailbox; keep the reply private with a dated DECISIONS line. Add the data questions in the same letter
(F-14:50-51; F-24:61). Name one real test account per day-one brokerage (F-1:150). Start per-broker production
access and sign-in providers' app reviews (docs/IMPLEMENTATION.md:66-74).

**4.2 Legal and business.** Commission Privacy Policy and Terms drafts (2.5). Name-clearance search (BUS:536).
DMCA agent with a repeat-infringer policy, before theses go live (docs/COMPLIANCE.md:126). Entity and insurance by
Open (BUS:158-160). Safeguards memo, then 2.52 (BUS:161). Optional limited attorney review (2.54). Before live
billing: the processor's written confirmation, data-processing terms, one-click cancel, dispute alarm at 0.75%,
and a test-mode check of the `starting_after` cursor (F-3:252-254; #82).

**4.3 Host and repository settings.**
- Cron in `vercel.json` (not protected; an agent can open the PR), from docs/SYNC.md:211-213:
  ```json
  { "crons": [ { "path": "/api/sync", "schedule": "0,5,10,15,20,25,35,40,45,50,55 * * * *" } ] }
  ```
- Env vars: `CRON_SECRET`, `APP_SECRET_KEY`, `SESSION_SECRET` per environment; `ALLOW_DEV_AUTH` on Preview only;
  `NEXT_PUBLIC_SITE_URL`; never `SNAPTRADE_BASE_URL` in production; `TRUST_PROXY_HEADERS` unset;
  `VENDOR_PORTAL_ORIGIN` and `NEXT_PUBLIC_VENDOR_SECURITY_URL` from a live portal URL (.env.example:19, :45,
  :47); F-7 contacts `PUBLIC_FILINGS_CONTACT`, `PUBLIC_RECORDS_CONTACT` as role addresses (lib/public-gate.ts:15-19).
- Paid host tier, Postgres with point-in-time restore, deployment protection, monitoring on `/api/health`, edge
  rate limits (SEC:45, :70); decide git deployments on or manual.
- Branch protection on main with Code Owners review (.github/CODEOWNERS:2).
- Repository variables: confirm `AUTOPILOT`, `AUTOPILOT_MODE`, `FEATURES`, `FEATURE_PARALLEL`; set `DAILY_PR_CAP`
  (docs/AUTOPILOT.md:343).
- Later, after the vendor's quota in writing: the sharded cron entries and `SYNC_CONCURRENCY=6`,
  `SYNC_VENDOR_RPS=12`, `DATABASE_POOL_MAX` (docs/SYNC.md:239-258).

**4.4 Real devices and people.** A human 360 px walkthrough with a keyboard-only and screen-reader pass
(BR:777-787). Demo, gain, loss and warn badges on a low-end phone in both schemes before the first public card
(DS:786). F-15 bot filter before week 1: 200 scripted preview fetches and 50 human visits, passing at 95% and 95%
(F-15:53-55). Try each built feature and mark it accepted or rework: F-2, F-3, F-4, F-6, F-7, F-9, F-10, F-11,
F-12, F-13, F-14, F-15 (only F-1 is accepted, F-1:97).

**4.5 Mailboxes.** Role mailbox this week (BUS:526). Postal address before any commercial email (MKT2:549).

**4.6 Production runs.** `scripts/rebuild-records.ts` on each matcher deploy (row 13). `node --env-file=.env
scripts/shared-accounts.ts` for counts, then `--mark` / `--rebuild` as needed; deleting data stays with you (#52).
`scripts/review-theses.ts` on your stated cadence (2.20). The private dry run, then takedown, restore and
key-rotation drills, then seven clean days (BUS:150, :163-164).

## 5. Already decided by the councils under your delegation

For awareness; you may overturn any.
- **5.1** Corporate actions: a partial oversell excluded whole, a same-day repricing excluded, an oversell
  excludes only the oversold sell; protected `lib/broker.ts` change (#40; logs/corporate-actions/committee-2026-11-01.md:114, :130).
- **5.2** `playwright.config.ts`: font pin (#41) and `workers: 1` (#81); approval cap of six a cycle (#41).
- **5.3** The stock image shows no pooled average or range (#54).
- **5.4** F-2 committee rulings (F-2:78-85); F-3 test-mode legal clearance (F-3:43-53).
- **5.5** F-4 card wording, layout, range and per-trade depth (F-4:104-132).
- **5.6** F-6 rulings (F-6:24-37); F-7 sources, no market-data vendor, labels, switch built closed (F-7:18-29).
- **5.7** F-8 format, data and scoring (F-8:18-30); F-9 N = 3 (F-9:81-82); F-14 S1-S5 (logs/F-14/pr-body.md:57-63).
- **5.8** F-25 and F-26 decisions (F-25:15-126; F-26:16-94); F-27 except the hues (2.42).
- **5.9** Approval cycles 1-4 (A1:10-17; A2:13-20; A3:15-23; A4:15-21).
- **5.10** Idea-board decisions D20-D29 and the Terms disputes clause, liability cap, model-training and deletion
  statements; you approve the final text (docs/IDEAS.md:133-215).
- **5.11** Design-system settled conflicts (DS:20-36); the design council's twelve (DES:1071-1084).
- **5.12** Cycle-3 and cycle-4 rulings (C3:715-736; C4:907-934); market chair rulings (MKT:561-562, :574-575; MKT2:491-494).
- **5.13** A budget menu instead of a dollar cap (BUS:118-120).
- **5.14** #85 shipped the F-11 status line and the F3-2 pane evidence; this is what made row 7 urgent.
- Check: none of these decides Terms or Privacy text, real users, payments or data deletion (POLICY H).

## 6. Appendix: source index

| Source | Cited by |
|---|---|
| docs/POLICY.md | 1 (rows 1, 6-8, 14, 21, 24, 31, 35, 37), 2.5, 2.13, 2.18, 2.49, 2.55, 3.16-3.18 |
| docs/COMPLIANCE.md | rows 1, 6, 21, 24, 26, 30, 32; 2.6, 2.18, 2.21-2.22, 2.52-2.53; 3.24; 4.2 |
| docs/security/review-2026-11-01.md | rows 2, 5, 15; 3.11-3.15; 4.3 |
| docs/direction/business-2026-11-01.md | rows 2, 5-6, 9-10, 12, 15-16, 28-30, 36-38, 40; 2.1-2.5, 2.16, 2.24-2.25, 2.35, 2.46, 2.50, 2.52, 2.55-2.56, 2.61; 3.15-3.16, 3.22; 4.1-4.2, 4.5-4.6; 5.13 |
| docs/direction/market-2026-11-01.md, -cycle2.md | row 39; 2.23, 2.41, 2.48, 2.61-2.62; 4.5; 5.12; Can wait |
| docs/direction/design-2026-11-01.md | rows 19-20; 2.17, 2.31, 2.33, 2.41, 2.46; 5.11; Can wait |
| docs/direction/design-system-2026-11-01.md | rows 18, 20, 29; 2.17, 2.32, 2.39-2.41, 2.45; 3.24; 4.4; 5.11; Can wait |
| docs/direction/creative-2026-11-01.md | rows 18-19, 25; 2.9, 2.32, 2.36, 2.38-2.40, 2.45 |
| docs/direction/game-2026-11-01.md | 2.50 |
| docs/direction/cycle3-2026-11-01.md | row 25; 2.3, 2.7-2.8, 2.15, 2.29-2.31, 2.40, 2.48, 2.57; 5.12 |
| docs/direction/cycle4-2026-11-01.md | row 10; 2.26-2.27, 2.41, 2.49, 2.56-2.57, 2.59, 2.63; 3.23; 4.1; 5.12 |
| docs/ideas/approval-2026-11-01*.md | rows 14, 25; 2.10-2.12, 2.15, 2.26, 2.28, 2.44, 2.47, 2.57, 2.59; 5.9 |
| docs/ideas/2026-11-01-board-review.md | row 29; 2.13, 2.35-2.36, 2.41, 2.54, 2.58; 3.10, 3.18; 4.4 |
| docs/process/decisions-and-authority.md | 2.56-2.57; 3.7, 3.9 |
| docs/features/F-2, F-3, F-4, F-6, F-13, F-15, F-16, F-20, F-23, F-25, F-27, F-28, F-29 | rows 16-17, 21-22, 27, 40; 2.13-2.15, 2.19, 2.23, 2.29, 2.34, 2.37, 2.39, 2.42, 2.44, 2.47, 2.62-2.63; 3.19; 4.4; 5.4-5.8 |
| docs/features/F-11, F-14, F-16, F-17, F-20, F-24 status lines | 2.60; 3.21 |
| docs/features/logs/ (F-1, F-2, F-4, F-7, F-14, options, fixes-cycle2, fixes-cycle3, known-limits, corporate-actions) | rows 4, 7, 13, 33; 2.7, 2.21, 2.49, 2.63; 3.1, 3.21; 5.1, 5.7; Can wait |
| docs/SYNC.md | row 12; 2.51; 4.3 |
| docs/AUTOPILOT.md | row 5; 3.15; 4.3 |
| docs/IMPLEMENTATION.md | row 11; 2.19, 2.57; 3.25; 4.1 |
| docs/IDEAS.md | 5.10 |
| CLAUDE.md | row 1; 2.33; 3.1-3.7 |
| .github/CODEOWNERS, scripts/team.ts | row 3; 3 (header), 3.8-3.10, 3.21; 4.3 |
| .github/workflows/review.yml, plan.yml, build.yml, features.yml, doctor.yml | row 2; 3.13 |
| lib/session.ts, lib/broker.ts, lib/auth/, app/login/dev/page.tsx | rows 1-2; 3.5, 3.11-3.12 |
| lib/copy.ts, lib/privacy-fields.ts, lib/consent-versions.ts | rows 7, 17; 2.7; 3.8 |
| app/privacy/page.tsx, app/terms/page.tsx, lib/discovery/f2-privacy.test.ts | row 6 |
| vercel.json, app/api/health/route.ts, package.json, package-lock.json, scripts/rebuild-records.ts | rows 4, 12-13; 3.14; 4.3 |
| app/connect/done/route.ts, lib/launch-gate.ts, lib/auth/attempts.ts, lib/trades.ts, lib/sync-limits.ts, lib/discovery/weights.ts | rows 15, 20, 36; 2.14, 2.27, 2.30, 2.34 |
| playwright.config.ts | 3.23; 5.2 |
| scripts/compliance.ts, scripts/review-theses.ts, scripts/handoff.ts | rows 23, 32; 3.24-3.25 |
| PRs #40-#42, #44-#46, #50, #52, #54-#56, #62, #65, #76, #77, #81-#89 | header; rows 7, 33-34; 2.1, 2.11, 2.29, 2.42-2.43, 2.49; 3.2-3.3, 3.8, 3.11-3.15; 4.2, 4.6; 5.1-5.3, 5.14; Can wait |
