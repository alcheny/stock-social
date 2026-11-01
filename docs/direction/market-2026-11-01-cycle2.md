# Market research council, cycle 2 (2026-11-01): demand validation, pricing tests, launch channels, early-kill risks

**What this is.** Cycle 2 of the market research council (`team/direction-councils.md`), run under the owner's standing
instruction to shift resources to market research, business and design while development load is low. It builds on cycle 1
(merged in #39: `docs/direction/market-2026-11-01.md` on main) and does not repeat it. It also takes in the creative and
design direction councils' proposal tables. Market research only: not legal or investment advice, no recommendation of any
security or trade, no interviews or user data. POLICY binds throughout: competitors and platforms are described
generically, and paper authors are not named.

**How it was produced (five passes, each member a separate fresh-context agent, run in parallel within a pass).**
1. **Desk research.** Nine members: demand on the trader side (DT), demand on the viewer side (DV), measurement and
   experimentation (ME), pricing and willingness to pay (PW), pricing experiment design (PT), channels to the first 100
   traders (CT), channels to the first 1,000 viewers (CV), regulatory and compliance (CO), and red team on risks (RK).
2. **Cross-examination.** Each member challenged two others' files and revised its own.
3. **Fact-check.** Three independent fact-checkers (research, legal, market/code/arithmetic) opened the sources themselves.
   Their verdicts override the members.
4. **Synthesis** by the chair.
5. **Red team.** A fresh red team attacked the synthesis, and the chair revised it (Part A, §11).

**Labels.** FACT (a source opened this session, URL where POLICY allows), ESTIMATE (arithmetic shown), HYPOTHESIS
(judgment); confidence High / Medium / Low.

**Where to start.** Part A: the executive summary (§1), the proposals for the approval council (§8), owner actions (§9) and
known limits (§10).

## Contents
- Part A. Chair's synthesis (pass 4, revised in pass 5)
- Part B. Pass 5: red team on the synthesis
- Part C. Pass 3: fact-checks (C1 research, C2 legal, C3 market, code and arithmetic)
- Part D. Pass 2: cross-examinations (D1-D9)
- Part E. Pass 1: desk research (E1-E9)
- Part F. The shared brief given to every member

---

# Part A. Chair's synthesis (pass 4, revised in pass 5)

## Market research council, cycle 2: chair's synthesis

**Member:** chair (does not vote). **Pass:** 4 (synthesis), revised in pass 5 after the red team. **Date:** 2026-11-01.
**Inputs:** the cycle-2 brief (Part F of this record); nine pass-1 files; nine pass-2 cross-examinations; three independent pass-3
fact-checks (research, legal, market/code/arithmetic), which override any member claim they correct; cycle 1's record
(merged in #39: `docs/direction/market-2026-11-01.md` on main); the creative and design direction councils' proposal
tables; the repo at `0d42f65`.

This is market research. It is not legal or investment advice and it recommends no security or trade. No interviews,
surveys or user tests were run; there are no real users yet. Persona reasoning is labelled SIMULATION where it appears.

**Labels.** **FACT**: a source a member opened this session (URL given where POLICY T1/T2 allow; company pages are
described, not linked), re-checked in pass 3 where a `[FC-…]` id is given. **ESTIMATE**: arithmetic on facts plus stated
assumptions. **HYPOTHESIS**: judgment. Confidence: High / Medium / Low.

**Member keys.** DT demand (traders) · DV demand (viewers) · ME measurement and experimentation · PW pricing
(willingness to pay) · PT pricing tests (statistics) · CT channels (first 100 traders) · CV channels (first 1,000 viewers)
· CO regulatory and compliance · RK red team (risks). `[DT-C3]` = claim 3 of DT's pass 1; `[DT-X2]` = challenge 2 of
DT's pass 2. `[FC-R#]` research, `[FC-L#]` legal, `[FC-M#]` market/code/arithmetic fact-check rows. `[C1 §n]` = cycle 1
chair synthesis section n. Gates: **G1** ≥50 connected traders · **G2** ≥60% share · **G3** ≥5,000 external profile
views/week · **G4** viewer D7 ≥15% · cycle 1's proposed **G0** (vendor's written answer) and **G5** (payment intent).

---

### 1. Executive summary: ten findings

1. **Nothing in weeks 1-8 can be read until a measurement build ships, and none has shipped since cycle 1.** No view or
   referrer capture exists; shared links carry no source tag; the profile Share button writes a mislabelled column;
   `trade_shared_at` is overwritten; month-recap shares are unrecorded; `via=nav` is silently dropped; the allow-lists
   reject the invite and path codes the demand tests need. [ME-C1, ME-C2, ME-X3..X5; FC-M28..M33] (FACT, High). Every
   demand test below depends on this build, so it is proposal **MRC2-1**.
2. **Demand evidence is strongest for readability, return paths and the instrument itself, not for new features.**
   - D22 (record line on feed cards) and D24 (plain labels) remove documented barriers: about a third of the US sample in
     the 2023 international adult-skills assessment scored at or below its lowest numeracy level [FC-R19], and lay
     readers misread a confidence interval of an average as the spread of single outcomes [FC-R18].
   - D23 (average and range first) should wait for a comprehension test (cycle 1's T10).
   - P-7 (safe return-to after sign-in) and D29/P-4 (freshness line) feed D7.
   - Viewer-side work moves D7, not external views. [DV-C10, DV-C13, DV-C14] (Medium)
3. **The trust rules are a cost to traders, and three sourced mechanisms say they are needed anyway.**
   - Becoming a followed "leader" increases the disposition effect [FC-R11].
   - Social-trading posters post after gains and go quiet after losses [FC-R13].
   - Funds stop reporting after poor returns [FC-R14].
   - Original disposition study: winners sold at about 1.5× the rate of losers, corrected from "68%" [FC-R12].
   - Together these support an answer to cycle 1's open "unflattering records" question: realized-only records flatter,
     so F-6 (open positions in every number), TR-5 (freeze) and "Disconnected ‹date›" are what keep a published set
     honest. Each costs traders share points (ESTIMATE −2 to −8 for F-6) [DT-C1..C4, DT-C10]. (Medium: the evidence comes
     from social-trading platforms where leaders may have been paid per follower, and from hedge-fund databases.)
4. **At n=50 no single card or copy item can be measured on share rate.** A 5-point effect needs about 1,505 traders per
   arm [FC-M17]. Trader-side card and copy items are therefore decided on principle.
   - What *is* powered in weeks 1-8: per-render viewer tests (pane-open, CTA clicks) at ≥1,000 impressions per arm, and
     founder outreach message tests on replies [ME §5, DV-X4, CT-X6].
   - Weekly readouts are descriptive; decisions come only at pre-registered points [ME-X13]. (High, arithmetic)
5. **Pricing: the arithmetic is settled and the evidence pulls conversion down.**
   - Net per payer is $9.28 monthly and $8.82 blended [FC-M1].
   - Against $9.99/$99.99, a $7.99/$79.99 arm needs 1.26× the conversion, $4.99/$49.99 needs 2.05×, $12.99/$129.99 wins
     unless conversion falls more than 23.5%, and $14.99 unless it falls more than 34% [FC-M3..M6].
   - The one peer-reviewed base rate found is a ceiling, not an anchor: 0.37-0.45% of registered users, all offered a
     free trial, paid within two years [FC-R1].
   - The stock among link viewers is plausibly at or below ~0.1% [RK-X1]. At 12,000 monthly uniques that is about $106 a
     month, against a vendor floor of ~$150 (ESTIMATE, Low).
6. **Only three pricing tests fit weeks 1-8, all at the owner's price.**
   - An anonymous painted door at $9.99/$99.99.
   - A one-question price survey shown to every exposed viewer.
   - Tool-interest tiles.
   - A person-assigned live price test needs roughly 12,500-250,000 unique viewers a week [PT-X5]. A significance test on
     revenue per visitor needs 32,000-38,000 per arm [FC-M18].
   - The profit-maximizing "test and roll" design needs about 640-5,200 per arm. Of the designs considered, it is the
     only one that can finish at this scale [FC-M19]. (High)
7. **Launch channels: G1 is at or below a coin flip and G3 misses in the central case.**
   - Founder-led supply gives ≈44-51 connected traders at week 8 (range 14-115), so P(G1) ≈ 35-50%, at ~26.5 founder
     hours a week and ~$350-450 cash [CT p2 revisions, DT-X2; arithmetic FC-M21].
   - Weekly external profile views at week 8: ≈100 / 1,150 / 4,300 (low / central / high), 1.2-50× short of 5,000.
     Trader cards carry 85-90% of them, ≈20 views per connected trader a week at mid (≈23 if supply is 44) [CV p2
     revisions; FC-M22].
   - Running both plans takes ≈37-40 founder hours a week [CV-X6].
   - Everything is ESTIMATE, Low; the biggest swing is the reply rate on one-to-one messages.
8. **POLICY F3b, read literally, removes the founder's most natural distribution lever; only the owner can draw the
   line.**
   - Read literally, F3b ("any message, in any channel, whose content or timing comes from traders' records") bars:
     - founder posts of any real card (the board already ruled out the founder's own);
     - outreach DMs linking an example profile;
     - written onboarding that mentions record fields;
     - reposts of traders' own posts;
     - possibly moderation notices quoting a thesis.
   - It cannot mean the maximal reading, because the trader's own Share button would fall under it too [CV-X1].
   - The permissive reading and its eight conditions are set out for the owner [CO-X10; FC-L F3b note].
   - Until the owner rules: only traders post records. (Medium-High)
9. **New kill risk found in the code: the importer can show wrong "Verified" returns.**
   - `lib/broker.ts:96,141,160` requests only BUY and SELL. Splits, stock dividends, dividend reinvestments and
     transfers-in are dropped [FC-M35].
   - `matchTrades` has no corporate-action adjustment [FC-M36], although the vendor SDK offers a `SPLIT` type [FC-M37].
   - A 2:1 split shows a false −45% and a 1:10 reverse split a false +800% [FC-M23]. That breaches POLICY F3c as built.
   - Vendor activity IDs can change on reprocessing, which can duplicate trades or orphan theses [RK p2].
   - Cheapest fix and test: about 11 hours, $0. (High)
10. **The market is flat, not fading, and the competition got stronger.**
    - Fed SHED 2025: 37% of adults hold investments outside retirement accounts [FC-R24]; SCF stock participation is
      56% (2025) [FC-R25]. Both include holdings beyond directly held stock, so both overstate direct stock traders and
      are not comparable to the 21% direct figure [FC-R23].
    - A commission-free app broker opened a feed of live, KYC-verified trades with P&L to its US customers. The launch
      facts are Medium; the October 2026 rollout is Low [RK-C5].
    - HYPOTHESIS: the wedge left is accountability-minded traders and long-record investors.
    - Real, linkable records are better bait for impersonation scams than fake screenshots [RK-C2, RK-X6]. Investment
      fraud losses were $8.65B in 2025 [FC-R28], about 83% of them crypto (scope note in FC-R28). (Medium)

---

### 2. Scope 1: demand validation of the approval-council candidates

**How to read the table.**
- "Verdict" is the chair's, combining DT and DV after cross-examination.
- Gate effects are ESTIMATE or HYPOTHESIS. **T** = G1, **S** = G2, **V** = G3, **D7** = G4.
- "Readable in wk 1-8" says whether a first-party metric can tell the effect apart from noise at expected volumes:
  - **yes**: per-render viewer test at ≥1,000 impressions per arm, or the outreach message test;
  - **descriptive**: counts and rates reported with intervals, no causal claim;
  - **principle**: decide on policy and evidence, not measurement.
- All metrics are first-party and aggregate. Signed-out views carry no identifier. Trader-side events may carry the
  trader's own id [ME §2, ME-X2].

| # | Candidate | Evidence (claim ids) | Week 1-8 metric (numerator / denominator · threshold · min n) | Gate effect | Readable wk 1-8 | Verdict |
|---|---|---|---|---|---|---|
| 1 | **MRC #3 + C30 measurement build** (views, `via` registry, share events) | Gates unreadable as built [FC-M28..M33]; cycle 1 [C1 §9] | Validation before week 1: ≥95% of 200 scripted preview fetches dropped and ≥95% of 50 human visits counted [ME G3] | Makes S, V, D7 readable; S *as measured* may fall 5-15 pts once failed shares stop counting (HYPOTHESIS) [DT row 2] | n/a (instrument) | **Prerequisite** |
| 2 | **IDEAS #13 go-to-market** (founder-led, open to all adults) | Wins-only posting norm means supply must be recruited by hand [FC-R13]; funnel in §5.1 | Contacts → replies → connects per channel code; week-2 checkpoint ≥100 contacts and ≥5 connects; cumulative stop only if the score-interval upper bound <4% at n≥200 [CT-X5, DT-X3] | T: the main lever (≈44-51 central) | yes (replies) | **Strong** |
| 3 | **D22** record line on every feed card | A lone big % is the screenshot pattern regulators name [DT-C5]; low numeracy in a third of the US assessment sample [FC-R19]; interval misread [FC-R18] | Pane-open per card impression, per-render arms. A +5-pt lift needs ≈1,320 impressions per arm and +3 needs ≈3,660 [DV-C11]; a −2-pt non-inferiority guard needs ≈6,500 per arm (ESTIMATE), so the guard is descriptive in weeks 1-8 | D7 small +; V 0 | descriptive in wk 1-8 (a large lift is readable at ≥1,320/arm) | **Strong** (ship on principle) |
| 4 | **D24** plain labels, "What's this?" | Same as #3; ranges are accepted [FC-R17] | "What's this?" opens per profile view (descriptive); T10 comprehension ≥70% (CI lower bound), n≥100 | D7 small + | descriptive + survey | **Strong** |
| 5 | **P-7** sign-in by intent, safe return-to (D21's split is already adopted) | G4 as defined is signed-in, so losing place at sign-in shrinks the gate's own cohort [DV row 3] | Sign-ins landing on origin route ÷ sign-ins from a record route ≥95%, n≥100; `path` key added to `method_chosen` [ME-X5] | D7 + (bigger, readable cohort) | yes (CTA rate) | **Strong** (cheap) |
| 6 | **D29 + P-4** freshness/status line incl. creative C7 "Disconnected ‹date›" | 18% rank "current and up to date" most important [FC-R20]; voluntary reporters leave after losses [FC-R14] | Repeat views of the same handle within 7 days (counter per handle-day, no viewer id) [DV-X5] | D7 +; T −0-3 (visible exit) | descriptive | **Plausible-strong** |
| 7 | **C25 / P-6** swipe hint, place memory, keyboard pane | SW-1 Musts the hint; not built [DV row 5] | Pane-open among first-session cards, per-render; +5 pts; ≥1,320 per arm | D7 + | yes | **Plausible** (a Must anyway) |
| 8 | **D27** first-visit line | Fast first impressions [DV-C7, Medium-Low, old sources]; young adults trust social info as much as national news [FC-R21] | Exits and pane-open after a signed-out landing, per-render; ≥3,660 landings per arm | D7 small +; V indirect via `/` → profile click-through [DV-X9] | yes, late (week 4+) | **Plausible** |
| 9 | **D23** average with range first (three versions) | Ranges barely cost trust [FC-R17]; win-rate bragging is a red flag [DT-C5]; **but** CI-of-mean misread [FC-R18] | Run T10 first (≥70% read the range as the *average*, n≥100); then follow rate per profile view by version, ≥1,000 views per arm | D7 ±; S may fall if traders prefer win rate (Low) | survey, then yes | **Plausible, conditional on T10** |
| 10 | **MRC #9** transparency-led recruiting segment (no "first 50" wording, MRC2-4) | Wins-only norm [FC-R13]; demand for commitment devices [DT-C7, abstract]; followed traders hide losers [FC-R11] | Enumerated invite codes `inv_<segment>` in `referred_surface`, attribution only, gating no access [ME-X3, FC-L2]; share within 14 days by segment; week-1 pool count ≥280 qualifying accounts [DT-X1] | T −5 to −10 vs broad pitch; S +5-10; V lower per trader | qualitative (±40 pts at 25/arm) | **Plausible**; segment size is the binding unknown |
| 11 | **MRC #11** whole-record preview as the connect disclosure | Preview replaces fear with facts [DT-C1]; prompted skepticism helps full disclosers [DT-C6, abstract] | `preview_viewed` → `consented`/`declined` + one-tap `decline_reason` bucket; report the rate, flag if >50% declined; n≥30 | T −3 to −10; S +5-10 among publishers | descriptive | **Plausible**; **live only after P6 and G0** [CO-X2, DT-X4] |
| 12 | **P-8** owner sees the public record | New traders land on an 8,347 px form with 49-60 inputs (design D-44) | First share ≤7 days after own-profile view ÷ traders who viewed it; n≥30 | S +3-8 (HYPOTHESIS) | descriptive | **Plausible** |
| 13 | **F-4 / C27** finish the share card (chart, trust table, period, preview text) | Images travel, links don't [C1 §6; FC-R33]; win-rate-led images resemble the red flag | Share rate before/after rebuild by record sign; no drop for down-sign records | S ±; V +10-30% per share | principle | **Plausible** |
| 14 | **C13** anti-crop band on trade and month images | Once cropped, an image is a screenshot again [DT-C5]; printed link | Visits with `via` per trade share | S −0-3; V +10-20% per share | principle | **Plausible** (protects honest sharers) |
| 15 | **C32** JoinCta under headline stats | Viewer → trader loop allowed under F5/F6 | CTA click rate per profile view (≈1% base, ±0.8 pts at 2,500 per arm); connects descriptive [ME-X6] | T 0-10 over 8 weeks at realistic views [CT-X7] | yes (clicks) | **Plausible** |
| 16 | **MRC #12 / C1** positioning line | Answers the named red flag [DT-C5, DV-C5]; aligned with fair-and-balanced standards (analogy) [FC-L18] | Outreach replies by wording, two wordings, ≥300 contacts each (±9 pts) [ME §5]; never "whole record" without "from the connected accounts" [CO-X5] | T ±3; V slight + | yes (replies) | **Plausible**; needs F3a review |
| 17 | **C33 + P-2 + C34** handle integrity, report action, impersonation category | Regulators document imposters built from real details [FC-L28 quote corrected]; real records are better bait [RK-X6] | Impostor reports per profile; triage ≤48 h; 0 confirmed impostor of a connected record | Protects V and brand | principle | **Plausible → required** (U2) |
| 18 | **C35** thesis written-at time and "· edited" | Traders write longer after losses [FC-R13] | Traders with ≥1 thesis ÷ connected ≥30% | S +1-3; D7 + | descriptive | **Plausible** |
| 19 | **C29** story size from the share control | Image-first is the strongest channel; no direct source | Story share of all shares ≥15%, n≥40 shares | S +0-3 | descriptive | **Plausible** (weak evidence, low cost) |
| 20 | **P-3** one trust language | "Verified" must not read as identity (F3a) | T10 add-on: ≥70% answer "imported from the broker", n≥100; badge-click beacon or `?from=badge` (fragments never reach the server) [ME-X7] | ~0; reduces a misread | survey | **Plausible** |
| 21 | **F-2** personal discovery | Young adults' trust disposition [FC-R21]; implicit logging off by default limits signal | D7 of signed-in viewers with ≥1 follow vs without (correlational), n≥200 per group | D7 + (signed-in only) | descriptive | **Plausible**, size unknown |
| 22 | **MRC #8** free limited Record tools | Paying job is narrow [C1 §5]; teaser content cut subscribe clicks 72-86% in paywalls [FC-R3] | Only with real charges; painted door first | Unknown; could cannibalize | after week 8 | **Unknown**; flag for owner |
| 23 | **Record tools (F-3)** itself | Bimodal willingness to pay [PW-C11, HYPOTHESIS]; brokerage tools are free to 75% of investors [FC-R22] | G5 painted door (§3.3) | Payers only | lower bound only | **Weak-plausible**, unmeasured |
| 24 | **D25 / D26 / D20** dev text out, production switch, disclaimer in plain view | Required by POLICY F3, P6. The standard disclaimer has no measured effect and can backfire for low-literacy readers; a concrete rule-statement helped [FC-R15, FC-R16] | Guard only, descriptive: pane-open vs control (a −2-pt guard needs ≈6,500 per arm) | ~0 | principle | **Required**, not demand |
| 25 | **P-5, P-9, P-10** one number format, wayfinding, design system | Consistency helps low numeracy (HYPOTHESIS) | 404 rate on shared paths <1% of external landings | ~0 | principle | **Hygiene** |
| 26 | **F-6** open positions in every number | Viewer trust; trader cost (followed traders hold losers) [FC-R11] | Share rate split by `has_open_losses`, as a standing diagnostic [DT-X7] | S −2 to −8 | descriptive | Required (TR-4) |
| 27 | **F-5** position size, opt-in | Blocked on vendor permission | Opt-in rate, descriptive | 0 in weeks 1-8 | n/a | **Unknown** |
| 28 | **MRC #13** delete vendor connection on disconnect | Removes a lingering-access fear; stops billing | Vendor delete confirmed ÷ disconnects = 100% | T +0-2 | principle | **Plausible**; needs G0 answer |

**Chair's reading.**
- Supply rests on three things, and none of them is a feature:
  - who is recruited (rows 2, 10);
  - whether the gates can be read (row 1);
  - whether a trader's first session shows the record visitors see (row 12).
  Card and copy items move share by a few points each and cannot be told apart from noise at n=50 [DT-C9, FC-M17].
- The trust rules together cost about 5-15 share points if recruiting skews to status-seeking hobbyists. They net about 0
  to +10 if recruiting follows MRC #9 (ESTIMATE, Low) [DT-C10].
- On the demand side, the evidence supports a **readability cluster** (D22 + D24 + T10, then D23) and a **return cluster**
  (P-7 + D29/P-4).
- None of the candidates closes the views gap. That stays a supply and distribution problem.

**Effect on the kill gates (summary, ESTIMATE, Low).**
- G1 moves with founder hours and recruiting mix, not features.
- G2 moves −15 to +10 points with recruiting mix and the trust rules.
- G3 moves with image-first sharing that carries a printed link (rows 13, 14, 19) and with the number of heavy-tail
  sharers.
- G4 moves with readability and return paths. It is probably unreadable at n<200 signed-in viewers (§3.2).

---

### 3. The measurement foundation every test needs

###### 3.1 Event dictionary (proposal) [ME §2, ME-X2..X7, DV-X3]

| # | Event | Kept | Never kept |
|---|---|---|---|
| E1 | `view` daily rollup, counted only on a first-party beacon after 2 s visible and a passed bot check | day; surface (feed, profile, trade, month, ticker, compare, login, how); target trader id (public); ref bucket (external, same-site, none); `via` code; signed-in flag; self-view flag | IP, user agent, full referrer, query, viewer id, time of day |
| E2 | `fetch_dropped` rollup | day; surface; reason (declared bot, no fetch metadata, no beacon, rate) | as E1 |
| E3 | `unfurl` rollup | day; target; route (page, og image, story) | as E1 |
| E4 | signed-out return: a first-visit **date value** in device local storage, sent only inside the E1 beacon (no cookie) | cohort day; arm | any per-browser id |
| E5 | `share_action` rows (replaces the four share columns) | trader id; time; surface; outcome (sheet or copy); record sign at that moment; format | destination, recipients |
| E6 | `active_day` rows for signed-in users, 120-day retention | user id; day | pages, times |
| E7 | funnel additions | `preview_viewed`, `declined` + reason bucket, `published` | as `lib/funnel.ts` |
| E8 | `door` rollup (painted door) | day; arm; step; signed-in returning flag | waitlist email (stored apart, deletable, never joined) |
| E9 | outreach log (founder's sheet, outside the repo) | week; channel; message variant; segment; replied; connected | names, handles, contacts |

**Fix-ups before E1-E9 (FACT-based, High):**
- add `nav` and `inv_<segment>` codes to `REFERRED_SURFACES`, and `path` to `META_KEYS.method_chosen`;
- append `?via=card` (and `trade`, `month`, `story`) on every Share and copy-link;
- keep `og:url` canonical;
- record month shares;
- one shared `via` registry for founder channels [CV-X5].

**Privacy (HYPOTHESIS, needs the legal committee):**
- aggregate-only counters with no viewer id;
- the device-storage date value is not a cookie, but it is storage on the device;
- both must be in the Privacy Policy before real users (P6).

###### 3.2 Gate definitions and power (pre-register before week 1)

**Proposal; it changes DESIGN §3.5 definitions, so flag for owner.** G1 here counts frozen records; G3 adds trade and
month surfaces and counts tagged views without an external referrer; G4 fixes day 7 ±1. Until the owner decides, every
readout **also reports the strict DESIGN number**: live connections only; profile surface with an external referrer
only.

| Gate | Definition | Power at expected volume (ESTIMATE, arithmetic High) |
|---|---|---|
| G1 | Distinct adults, non-demo, non-paper, ≥1 imported closed trade, connection live or frozen | A count; bands 50+ / 35-49 / <35 [C1 §9] |
| G2 | G1 traders with ≥1 E5 by week 8, plus a 14-day rate per weekly cohort; sheet and copy reported apart | At a true 60%: continue 56%, inconclusive 34%, stop 10% [FC-M8, M9]. Separating 60% from 45% needs ≈67 traders; from 50%, ≈151 [FC-M16] |
| G3 | Σ E1 on profile, trade and month surfaces, not self-views, with ref = external **or** `via` ≠ none; median of weeks 6-8 | A count; needs ±20% instrument accuracy. Report card-sourced and founder-sourced views separately [CV-C13] |
| G4 | Primary: signed-in non-trader viewers active on **day 7 ±1** [DV-X6]. Secondary: E4 signed-out cohort, labelled a **lower bound** (in-app browsers keep separate storage) [RK-X5] | ±4.9 pts at n=200; 15% vs 10% needs ≈282 [FC-M15]. At 2-20% signed-in, the 8-week cohort is ≈20-500, so G4 is likely **inconclusive by sample**. With a stop line of ≤21/200, a true 15% stops 4.2% of the time [FC-M11] |
| G5 | Painted-door joins ÷ signed-in returning viewers exposed, per person; impressions reported apart as a lower bound [PT-X7] | One-sample test against a fixed 1.5% floor: 525 one-sided, 648 two-sided [FC-M14]. 12-29 joins per 1,000 = **inconclusive** [ME-X10]. Two-arm 1.5% vs 3% needs ≈1,533 per arm [FC-M13] |

**Decision discipline (proposal):**
- inconclusive is not a miss;
- weekly readouts are descriptive;
- any early stop uses an always-valid or a conservative group-sequential boundary [ME-X13];
- mark G1/G2 "confounded" if a broad index drawdown of ≥10% happens in the window [RK R10].

###### 3.3 Reading a candidate without A/B infrastructure

- **Per-render randomization** is the default for outcomes that finish within the page view: pane-open, exits,
  "What's this?" taps, CTA clicks. The server picks the arm and the beacon reports arm plus outcome. No storage is
  needed, and traffic spikes balance across arms [DV-X4].
- **Switchbacks** only for D7, with ≥8 blocks per arm, stratified by ref bucket and `via`. Never for any price, trial or
  refund arm [PT-X6].
- **Test-and-roll** (roll the arm with the higher posterior expected outcome, within POLICY guardrails) for viewer UI
  that cannot reach 80% power. This needs the owner [ME-X revisions 7].
- **MDEs** [ME §5]:
  - 50 traders split 25/25: ±40 pts (±39-40 depending on base);
  - 1,000 viewers: D7 ±6.3 pts, a 3% click ±3.0 pts;
  - outreach A/B at 300 per arm: ±9 pts on a 20% rate, the best-powered test available.

---

### 4. Scope 2: pricing designs around $9.99

###### 4.1 Evidence (fact-checked)

- **Fees (FACT, High):** 2.9% + $0.30 per card charge, 0.7% billing, 0.5% tax [FC-M24]. Net per charge is
  P × 0.959 − $0.30: $9.28 monthly, $8.82 blended at 65/35 [FC-M1]. Fees take 10.1% at $4.99 and 6.1% at $14.99
  [FC-M2]. International cards (+1.5%), currency conversion (+1%), disputes and refunds are excluded, so $8.82 is an
  upper bound on net.
- **Revenue equivalence (ESTIMATE, High arithmetic):**

| Arm (monthly / annual) | Net per payer-month | Needs vs $9.99/$99.99 | BE conversion at trader share 0.46% / 2% / 10% ($1 data) | Same at $2 data (real-time tier) |
|---|---|---|---|---|
| $4.99 / $49.99 | $4.31 | 2.05× | 0.20% / 0.56% / 2.42% | 0.31% / 1.02% / 4.74% |
| $7.99 / $79.99 | $7.01 | 1.26× | 0.12% / 0.34% / 1.48% | 0.19% / 0.63% / 2.91% |
| **$9.99 / $99.99 (owner)** | **$8.82** | 1.00× | **0.10% / 0.27% / 1.18%** | **0.15% / 0.50% / 2.31%** |
| $12.99 / $129.99 | $11.53 | wins unless conversion falls >23.5% | 0.08% / 0.21% / 0.90% | 0.11% / 0.38% / 1.77% |
| $14.99 / $149.99 | $13.34 | wins unless conversion falls >34% | 0.06% / 0.18% / 0.78% | 0.10% / 0.33% / 1.53% |

  Sources: [FC-M3..M7, FC-M27]. The vendor's $1 per user is its daily tier; real-time is $2. An hourly manual sync at
  $0.05 a call would cost ≈$36 per connection a month, which reinforces cycle 1's sync-cadence proposal [FC-M26, M27].

- **Base rates (FACT → ESTIMATE):**
  - A randomized study of 680,588 registered users of a freemium app: 0.368% paid over two years with a 3-day trial,
    0.445% with a 7-day trial (+20.9%; delayed conversion rose 42%, significant; immediate conversion +7%, not
    significant) [FC-R1].
  - Every user in it was offered a trial, and the rate is cumulative among registrants. So it is a **ceiling** for link
    viewers, not a midpoint [FC-R1, PT-X4, RK-X1].
  - With 10-30% of viewers registering, a month's viewer cohort would eventually yield ≈0.04-0.12% payers over two
    years. A paying stock at or below ~0.1% of monthly uniques is therefore plausible (ESTIMATE, Low) [RK-X1].
- **Price perception (FACT, Medium):**
  - $9.99 beats $10.00 only through the left-digit change [FC-R4, R5]; one field study found no effect once substitutes
    were controlled for [FC-R6].
  - Decoy effects mostly fail to replicate (11 reliable out of 91 attempts) [FC-R8].
  - A discount was associated with 3.35× higher odds of paying across 21 news paywalls (non-experimental, CI 1.16-9.66).
    The firmer finding is that teaser content cut subscribe clicks by 72-86% [FC-R3].
  - Implication: the paid layer must sell something the free record does not answer.
- **Stated vs real willingness to pay (FACT, High):** hypothetical answers overstate value by 21% on average (77
  studies) and by a median ratio of 1.35 (28 studies) [FC-R9, R10]. These discounts apply to *value*, not to purchase
  *rates* [PW-X3].
- **What investors use (FACT, High):**
  - 40% of investors use paid newsletters or online resources, and 75% use brokerage tools [FC-R22].
  - 21% of families hold stock directly, with a median holding of $15,000 (2022) [FC-R23].
  - $99.99 a year is 0.67% of that median, so the buyer is the larger-portfolio repeat comparer [PW-C10].
  - No source measures dollars spent on investment information (gap, Medium).
- **Copy constraint:** only 2% of adults rank "I paid for it" as the most important credibility cue [FC-R20]. Record
  tools copy must never imply that paid data is more accurate [PW-X7].

###### 4.2 Test designs (sequence and decision rules)

| Stage | When | Test | Exposure unit and sample (ESTIMATE) | Decision rule | Owner? |
|---|---|---|---|---|---|
| 0 | Before week 1 | Pre-register metrics, units, arms, stops; measurement build (§3) | — | Nothing runs without written definitions | No |
| 1a | Weeks 1-8, charges off | **Anonymous painted door at $9.99/$99.99.** Before the click it reads "coming soon"; after the click, "not available yet; nothing is charged". No card form ever; no test-mode checkout for real viewers [PT-C2, CO-C25] | Signed-in returning viewers per person (gate line); impressions apart. One-sample vs 1.5%: n=525, likely after week 8 at 2-20% signed-in | Pass: lower bound >1.5%. Inconclusive: 12-29 per 1,000. Weak: upper bound <2% → put MRC #8 to the owner | No for a click count, but subject to F-3's open items (see note); **yes** for a waitlist email list |
| 1b | Same | **One-question monadic price survey** to all exposed viewers, labelled a survey, one random price each ($7.99 / $9.99 / $12.99, or $4.99 in place of $7.99) | Showing it only to clickers takes 33-163 weeks; showing it to all exposed takes 2.5-25 weeks at 10-20% response [PT-C5]. A 1.26× read needs ≈500-580 per arm [PW-X2]. Rank arms only; no numeric discount on the ratio [PW-X3] | Flags only; the price stays the owner's | **Yes**: it shows viewers prices other than $9.99 (as a labelled survey, not an offer) |
| 1c | Same | **Tool tiles** (compare, saved views, notes) in random order | ≈160-170 first clicks per pairwise contrast | Change build order only if the leader's CI excludes the runner-up | No |
| 2 | First ≥8 weeks live (owner switch) | Single price. **Refund-copy** arm (within the decided 14-day refund; never "risk-free") and **annual-first** display as test-and-roll | 1%→1.5% needs 7,747 per arm; annual-first prior ≈ +16% lifetime per payer if the mix moves 30%→45% [PW-X8] (Low: rests on app-store retention benchmarks; 1.8-3.1× annual/monthly value range [RK-X3]) | Roll the higher posterior net revenue per visitor; guardrails: refunds >2× control, disputes ≥0.75%, any different-price complaint | **Yes** (real charges and test-and-roll); no preselection, both plans shown |
| 3 | Only at ≈12,500-250,000 uniques a week | Two-arm price test, person-assigned, test-and-roll | n* ≈640-5,200 per arm [FC-M19]; a significance test needs 32,000-38,000 per arm, 26-76 weeks [FC-M18] | Roll the higher posterior; losing-arm subscribers keep the lower price ≥12 months | **Yes** |
| 4 | Only if the owner revokes "no trial" | 7-day card-up-front trial vs none | The evidence compares trial lengths only; no study shows a trial beats no trial [FC-R2] | Net paid at day 45 | **Yes** |

**F-3 open items (note to stages 1a and 1c).** The idea board's F-3 review already proposes an in-app priced
"nothing is charged now" control, so stage 1a is that same test, not a new one. F-3's open items also propose:
- no price on profiles or outside-link landings;
- no price ever shown to a connected trader.

F-3 decided that Record tools is built only after the legal committee reviews its exact feature list. So the door and
tiles run only on in-app surfaces off profiles and landings, are never shown to connected traders, and use only features
the legal committee has reviewed, pending the owner's call on those items.

**Legal limits** [CO-C20..C26, FC-L19..L24]:
- ROSCA disclosure and consent before billing details, plus simple cancel.
- No former ("was") price unless it was a bona fide price for a substantial period, so a test price never becomes a
  "was" price.
- Price arms assigned at random by user id, never from personal data.
- A painted door is a general deception question under FTC Act §5, not bait advertising under 16 CFR 238 [FC-L23]. The
  safeguards are a clear label, no card and an honoured price.
- California's annual reminder for *monthly* plans is **not established**: the 2024 analysis limits it to annual terms,
  and the statute text was not reached [FC-L22]. Prudent, not required.

---

### 5. Scope 3: founder-led launch channels

###### 5.1 Supply: first 100 connected traders (50 by week 8) [CT p1+p2, DT-X1..X6]

**Preconditions for week 1 (unchanged from the board's Idea 13):**
- Terms and Privacy Policy live; consent recorded; deletion; real auth; a contact;
- the vendor's written answer (G0);
- name clearance (T5a);
- report action and reserved handles;
- measurement build live.

**Week 1 is the first non-demo connect.** Connecting is **open to every adult on equal terms** from week 1. There is no
waitlist and no "first 50", "founding" or "invite-only" wording, because early access is a named material connection
under 16 CFR 255.5 [FC-L2]. Personal onboarding is offered to anyone who asks [CT-X3].

All rates and counts in this table are ESTIMATE, Low.

| # | Channel (generic) | 8-wk funnel, mid | Connects L / M / H | h/wk | Cash | Stop rule |
|---|---|---|---|---|---|---|
| 1 | One-to-one messages on an investor microblog to adults who already post full results, losses included | 280 contacts × 18% reply × 30% connect | 6 / 15 / 35 | 6 | $0 | <5% replies or <2 connects after 80 contacts; week-1 pool count <280 → move hours to #4 [DT-X1] |
| 2 | Topic communities on a link-aggregator forum (moderator-approved method post with Demo data, founder disclosed) | 2 posts × ~5,000 views × 1-3% visit × 2-4% connect [DT-X2] | 2 / 5-8 / 15 | 2.5 | $0 | Any moderator removal or warning |
| 3 | Free accountability or study group chats (admin-posted announcement only, never member DMs) [DT-X11] | 2 admin yes × ~300 members × ~2% | 2 / 7 / 15 | 2.5 | $0 | No admin yes after 8 asks; paid-signal rooms wait for the owner |
| 4 | Trading-journal communities | 120 × 25% × 34% | 4 / 10 / 21 | 3 | $0 | <5% replies after 40 |
| 5 | Small finance podcasts, as a guest (3-6 week lag) | 10 pitches → ~1 aired | 0 / 3 / 10 | 1.5 | $0 | No booking after 10 |
| 6 | Founder building in public (method notes, Demo cards; no reposts of traders) | — | 0 / 1 / 3 | 2 | $0 | <1 connect by week 4 |
| 7 | Journaling and risk educators who mention it unpaid | 15 pitches → 2 mentions | 2 / 5 / 12 | 2 | $0 | No mention after 15 |
| 8 | Adult meetups and investment clubs (10-minute Demo-data talk) | 3 sessions | 1 / 5 / 10 | 2.5 | ≤$100 | <1 connect per session after 2 |
| 9 | University alumni investment groups (alumni only, never student clubs) | 4 asks | 0 / 3 / 6 | 1 | $0 | — |
| 10 | JoinCta on trader profiles (C32) | at realistic views [CT-X7] | 0 / 3 / 8 | 0 | $0 | — |
| | Onboarding (live call; written follow-ups carry no record field), pre-send check | | | 3.5 | | |
| | **Total after a 15% duplicate/disconnect haircut** | | **≈14 / 44-51 / 115** | **≈26.5** | **≈$350-450** + mailbox | |

- **Central case.** CT keeps 51. DT's correction (2-4% connect per forum or newsletter visit, not 8-12%) gives 44. The
  chair reports **44-51**. P(G1 ≥50) ≈ 35-50%, and 100 traders arrive around week 14 at mid (ESTIMATE, Low)
  [CT p2 revisions; DT-X2; arithmetic in FC-M21].
- **High case.** CT kept 110 (129 raw), but the row cells sum to 135 raw, ≈115 after the haircut. The chair uses 115.
- **Biggest swing.** The microblog and journal reply rate: 10% vs 25% moves the total by about 40.
- **Checkpoint.** Cycle 1's two benchmarks contradict each other: its funnel converts 4% of contacts, but its T5 bar
  and the board's week-1 checkpoint assume 20% [CT-C1]. Replace them with:
  - T5 measured as connects ÷ replies ≥30%;
  - a week-2 checkpoint of ≥100 contacts and ≥5 connects;
  - stop only if the score-interval upper bound falls below 4% at n≥200 cumulative [DT-X3, CT-X5].
- **Cost.** SnapTrade at $100 a month plus $1 per connected user (daily tier) comes to ≈$250 over 8 weeks; meetups up to
  $100; a postal mailbox for CAN-SPAM [FC-M26].

###### 5.2 Demand: first 1,000 viewers and the views gate [CV p1+p2]

All figures in this table are ESTIMATE, Low.

| # | Channel (generic) | Week-8 external visits/wk | Reach a profile | h/wk | Stop rule |
|---|---|---|---|---|---|
| 1 | Trader-shared card images (link in reply, bio, chat; Share appends `via=card`) | **90 / 1,000 / 3,700** (connected × bio-link share × bio views + posts × views/post + heavy tail) | 100% | in §5.1 | <10 sharers by week 4 → change the recruiting mix, not the card |
| 2 | Founder short videos ("how to read a record", "why screenshots mislead"; Demo records, adult framing, under-18 stop trigger) | 10-300 | 15-40% | 6-8 | <30 tagged visits after 12 posts |
| 2b | Long-form explainer video (added: long-form video is the channel finfluencer followers most use *for investing information* [FC-R31 scope]) | ASSUMPTION; unmeasured | 15-40% | 3 | as #2 |
| 3 | Investor microblog image posts (link in reply) | 20-150 | 15-40% | 4 | <50/wk by week 6 |
| 4 | Large professional network (native post, link in comment) | 20-150 | 15-40% | 2 | two posts <20 visits |
| 5 | Link-aggregator forum (shared with §5.1 #2; count once) | 20-300 averaged, spiky | 15-40% | in §5.1 | one removal |
| 6 | Founder newsletter (education only under F3b; postal address, opt-out within 10 business days) | 1-20 | ~0 | 2 | keep only if its D7 beats average |
| 7 | SEO (`/how`, glossary, profiles past the 10-bet floor; the sitemap lists `/`, `/t` and tickers, no profiles [FC-M34]) | 0-100 | 15-40% | 1 | review at week 12 |
| 8 | Earned media on screenshot scams (regulator-sourced angle; never "fraud detection" or completeness) | 0-500 | 15-40% | 4-5 | no placement after 30 pitches |
| 9 | Launch directories | spike only; blocked until T5a and P6 | 10-30% | 8 once | one launch |
| 10 | Podcasts (shared with §5.1 #5) | 0-200 | 15-40% | in §5.1 | <25 per episode after 2 |

- **Week-8 external profile views:** ≈100 / 1,150 / 4,300 a week, 50× / 4.3× / 1.2× short of 5,000 [FC-M22].
- **First 1,000 cumulative viewers:** around week 4-6 at central; week 10 or later in the low case. Counted as views
  until a cookie-free unique estimate exists [DV-X1].
- **Reaching 5,000:** needs roughly CT's high supply case plus heavy-tail sharers, or an owner ruling that permits
  sign-blind founder posts of consented cards.
- **Paid ads stay out.** P6 bars trackers, not ads [CV-X2]. Ads are excluded because they lose money without
  optimisation, F5 bars paid visibility of records, and platform age-targeting relies on self-declared ages [CO-X9].
- **Founder time for both plans:** ≈37-40 h a week [CV-X6]. Cut, in order: directories, podcasts, short video.

###### 5.3 Compliance limits on every channel (20-item checklist, condensed) [CO §F, CO-X revisions; FC-L1..L27]

1. **Records.** Only traders post their own records. Founder and company content uses Demo records or method
   explainers, until the owner rules on F3b.
2. **Founder speech.** "I built this" goes in the post itself [FC-L8].
3. **Performance.** Anything showing performance carries the F3 disclaimer in the image. Cards are chosen by a
   sign-blind rule. A whole-record claim names "the connected accounts" and links the exclusions [CO-X5].
4. **Timing.** No posts timed to price moves; no "look at @x" replies to individuals. That protects the publisher's
   exclusion: "not timed to specific market activity" [FC-L15].
5. **Words.** None of the banned words (F2, F3a). No third-party names (T1, T2). Nothing youth-coded (COPPA factors
   [FC-L27]). No bought followers or views (16 CFR 465.8 [FC-L10]).
6. **Email (CAN-SPAM).**
   - Each email identifies itself as a solicitation (waived after prior consent), carries an opt-out, honours opt-outs
     within 10 business days and gives a postal address (a PO box is fine).
   - Up to $53,088 per violating email [FC-L11, L12].
   - No scraped addresses. No cold email at all; first contact happens on the platform [CT-X4].
7. **SMS.** None [FC-L14]. **Platform DMs:** individually written messages only, under a daily cap set by each
   platform's published rules, with "I built this" in each message. Stop at the first warning [CO-C11].
8. **Perks.** No perk to anyone for connecting, sharing or reviewing; traders get exactly what every user gets
   [FC-L2]. Unpaid asks carry a one-line guidance note [CO-X7].
9. **Representatives.** Registered representatives and advisers are not targeted. FINRA 2210 and the extracted-
   performance rule apply to their use of cards [FC-L17, L18].
10. **Reviews.** Review requests are neutral. Staff, friends or family who review must be told to disclose (16 CFR
    465.5(c), corrected [FC-L9]).
11. **Pricing tests.** As in §4.2.
12. **Pre-P6 tests.** No test connects or publishes a real person's record before P6, G0 and real auth. Pre-launch
    supply tests use Demo records and are labelled SIMULATION [CO-X2, DT-X4].

---

### 6. Scope 4: risks that would kill the product early, and the cheapest test for each

Ranked by expected damage × how early it shows. Costs are cash plus founder hours. Thresholds are proposals.

| Rank | Risk | L / I | Leading indicator | Cheapest test · pass/fail | Gate |
|---|---|---|---|---|---|
| 1 | **Supply refusal and selection**: traders won't publish whole records with losses; only green traders connect [RK R1; FC-R11..R14] | H / fatal | Preview→publish rate by record sign; decline reasons | Before P6: an unconnected walkthrough on a Demo record with a losing open book, labelled SIMULATION (stated intent only). After P6 and G0: live preview with `decline_reason`; report by sign with intervals; qualitative below 50 per sign [DT-X4, X5]. $0, ~15 h | G1, G2 |
| 2 | **Wrong "Verified" P&L** from splits, stock dividends, reinvestments and transfers-in; duplicates when vendor IDs change [FC-M35..M37; RK p2] | H / high (F3c breach, brand) | Lot units ≠ vendor position units; returns >+300% or <−90%; duplicate (account, symbol, side, date, units, price) under different ids | Forward and reverse split fixtures; request the extra activity types; exclude and count affected account-symbols until adjustment exists; reconcile lots to positions; duplicate query on each rebuild; one Build-plan account that held a split stock. $0, ~11 h. Fail on any unexcluded mismatch or duplicate | G2, brand |
| 3 | **Links don't travel**: the views gate misses [C1 §6; §5.2] | H / fatal | External views per connected trader per week (median), by `via` | Weeks 1-2 with the first 10 sharers and `via=card`: fail if the median is <10 views per sharer a week or the total is <500 (pace for G3 at 50 traders ≈ 100 each) [RK R2, revised to the live window] | G3 |
| 4 | **Vendor refusal, termination, repricing or per-broker approvals** [RK-C6; C1 §8] | M / fatal | Silence; brokers marked "approval required" | Written request (G0) plus a coverage check: approved brokers must cover ≥80% of the outreach list. $0, ~4 h | G0, G1 |
| 5 | **Founder bandwidth**: 26.5-40 h a week of channels on top of the P6 list [CT, CV-X6] | H / high | Contacts a week; slipped pre-launch items | One-week outreach sprint with a time log in week 1. Fail at <75 contacts, or replies <10% (aligned with CT's low case [DT-X6]). Re-plan before week 2 | G1 |
| 5b | **Founder account suspension** on the outreach platforms. Microblogs and group-chat apps ban unsolicited bulk DMs, and many trading communities ban promotion. Channel #1 carries ≈15 of the 44-51 connects [CO-C11, CT-C5] | M / high | Warnings, rate limits, removed posts | Individually written messages only, under the platform's published daily cap, "I built this" in each. At the first warning, stop and move hours to channel #4 | G1 |
| 6 | **Curiosity without return**: no push (F3b) | H / high | Follows per 100 signed-in viewers; second-visit rate | D7 of signed-in viewers, n≥200; likely needs more than 8 weeks if G3 misses [RK-X2] | G4 |
| 7 | **Scam bait and touting**: real records and open-position symbols used to fake credibility in chats [RK-C2, X6; FC-L28 quote corrected] | M / high | Impersonation reports; "is this you?" messages | Tabletop with Demo-badged cards (qualitative at n=8; at n≥50 the margin is ±11 pts near p=0.2 and ±14 at p=0.5) [DT-X8, CO-X3]; live report and impersonation category; a fixed line "Stock Social never runs chat groups or messages you about trades" | Brand, G3 |
| 8 | **Monetization far below break-even**: a stock ≤0.1% gives ≈$106 a month against ≈$150 vendor floor at 12,000 uniques [RK-X1] | H / fatal by month 2-4 | G5 joins per signed-in returner | Painted door (§4.2 stage 1a) | G5 |
| 9 | **Broker-native competition** for status-seeking traders [RK-C5] | M-H / medium | Share of outreach targets already posting on a broker feed | One question in the sprint; fail if their connect rate is less than half of others' | G1 |
| 10 | **Market drawdown in the window** correlates G1 and G2 through open positions (F-6) [RK-C3] | M / medium-high | Index drawdown ≥10% | Pre-register the "confounded" flag; standing share-by-`has_open_losses` diagnostic | G1, G2 |
| 11 | **State age laws** [FC-L25, L26] | L / medium | — | The swipe feed is infinite scrolling, and F-2 ordering analyses users, so only the statute's minor-usage criterion keeps the product outside Florida §501.1736. Enforceable since a 25 Nov 2025 stay. If covered, the statute's minor-account duties are largely ones an 18+ product already meets [FC-L25]. Test: the 18+ gate and delete-on-report are live and logged. Levers if needed: a non-personalized order on signed-out surfaces, a feed with a visible end [CO-X1] | Legal |
| 12 | **Adviser and publisher status; signal-seller users** [C1 §7] | L-M / high | Representatives among sign-ups | Sign-up question; weekly sample of 20 off-site card uses | Legal |
| 13 | **Privacy incident** [RK-C8] | L / high | Logs joining account ids to user ids | Log grep plus a deletion drill. $0, 3 h | P6 |

**Order of tests:** #2 (code) → #4 (vendor) → measurement validation → #5 sprint (week 1) → #1 live preview → #3
concierge (weeks 1-2) → #7 tabletop → #6 and #8 as volume allows. About $0 cash and ~130 founder hours, most of it
outreach that has to happen anyway.

---

### 7. Dissent and unresolved disagreements

- **Week-8 supply.** CT: 51. DT: 44, with forum and newsletter visit-to-connect at 2-4%. Unresolved; the chair reports
  44-51. Only week-2 data on replies and visit-to-connect settles it.
- **Signed-in share of viewers.** ME 2-5%; PT 10-20%. Neither is sourced. Both files now carry 2-20%. The person-level
  tests (G4, G5, price arms) swing about 4× on this one number, so it is the first thing to measure.
- **F3b scope.** CO, CT and CV accept the literal reading as the planning default. CV argues the maximal reading proves
  too much (it would catch the Share button). CO steelmans a permissive reading with eight conditions. The owner
  decides.
- **Base conversion.** PW: 0.5% as base, citing the trial study. PT, RK and FC-R1: that study is a ceiling, so ≤0.1% is
  plausible. The chair sides with the fact-check: 0.5% is the strong case, not the base.
- **Device-storage D7 counter.** DV: a usable secondary measure. RK: in-app browsers make it a lower bound that can fail
  G4 falsely. Settled as a secondary line labelled "lower bound", never the gate number.
- **Paid ads.** CO first said P6 bars ads; CV corrected that P6 bars trackers. Both agree ads stay out, for other
  reasons.
- **Florida exposure.** RK, then CO, treated it as a live design risk. The legal fact-check says coverage duties mostly
  coincide with an 18+ product's existing rules. Kept on the watch list.

---

### 8. Proposals for the approval council's next cycle

Each row is raised by the market research council, cycle 2 ("MRC2"). Rows that would change an owner decision, DESIGN or
POLICY say **flag for owner**. Ranking: precondition for reading the gates × evidence × cost (order revised in pass 5;
see §11). The idea board checks each row against existing decisions before the vote (`team/idea-board.md`). This
council does not edit `docs/IDEAS.md`.

| # | Proposal | Evidence | Size | Conflicts / owner |
|---|---|---|---|---|
| MRC2-1 | **Measurement foundation build.** Covers: E1-E9 (§3.1); beacon views with the bot filter and the 200/50 validation; a shared `via` registry, with `via=card`/`trade`/`month`/`story` appended automatically on Share and copy-link; `share_action` rows replacing the four share columns (C30); the `nav`, invite-code and `path` fixes; per-render arm assignment; a weekly descriptive readout. Supersedes and details MRC #3 and C30 | §1.1, §3; FC-M28..M33 | M (days) | Privacy Policy text (P6). The device-storage date value needs the legal committee. No owner-decision conflict |
| MRC2-2 | **Corporate-action and ID-change safety (F3c).** Request SPLIT, STOCK_DIVIDEND, REI, TRANSFER, EXTERNAL_ASSET_TRANSFER_IN and ADJUSTMENT. Exclude and count every account-symbol with a unit-changing non-trade event until adjustment is built. Make lot-to-position reconciliation the primary detector, because the vendor's tagging is best effort. Add split fixtures, duplicate detection on each rebuild, and a vendor question on split-adjusted history and id stability | §1.9, §6 #2; FC-M23, M35..M37 | S (~11 h) | None: it enforces POLICY F3c |
| MRC2-3 | **Pre-registered gate definitions and reporting (adds to MRC #4).** G1 counting frozen records; G3 including trade and month surfaces and tagged views, split into card-sourced and founder-sourced; carrying `via` across internal navigation; G4 primary = day 7 ±1, with the signed-out line as a lower bound; inconclusive ≠ miss; the drawdown "confounded" flag; standing share diagnostics by record sign and `has_open_losses`; G5 per person, impressions apart. The strict DESIGN number is always reported alongside | §3.2; CV-C13, CV-X7, DV-X6, RK R10 | S (definitions) | Changes DESIGN §3.5 definitions — **flag for owner** |
| MRC2-4 | **Go-to-market v2 (revises IDEAS #13).** Connect open to all adults from week 1 (no "first 50", founding or invite-only wording). Outreach by individually written platform DMs and admin-approved posts only; no cold email. Links to `/how`, `/` and Demo profiles only. Live onboarding open to anyone who asks. T5 = connects ÷ replies ≥30%. Week-2 checkpoint ≥100 contacts and ≥5 connects; cumulative stop rule at n≥200. Week-1 pool count. The 12-point channel checklist (§5.3) | §5.1, §5.3; FC-L2, L11, L12 | S (process) | Changes the board's week-1 checkpoint and the "first 50" framing in IDEAS #13 — **flag for owner** |
| MRC2-5 | **Readability cluster first.** Ship D22 and D24 on principle. Run T10 (n≥100; pass if the CI lower bound is ≥70% reading the range as the *average*, not one trade) before judging D23's versions. Add "the range is for the average, not one trade" to "What's this?" | §2 rows 3, 4, 9; FC-R17..R19 | S | D23 is "testing" on the register; consistent |
| MRC2-6 | **Anti-impersonation pack.** A report category "impersonating this trader elsewhere"; a fixed line on profiles and cards ("Stock Social never runs chat groups or messages you about trades"); handle integrity (C33/P-2); the anti-crop band (C13) | §6 #7; RK-C2, X6; FC-R28 | S-M | U2/U3 already require report and takedown before launch; consistent |
| MRC2-7 | **Pricing research sequence.** Stages 0-1c in §4.2: anonymous painted door at the owner's price with the one-sample rule and the 12-29 grey zone; a monadic survey shown to all exposed; tool tiles; all only on in-app surfaces and never to connected traders. No live price test below ≈12,500 uniques a week; test-and-roll for live arms | §4; FC-M13, M14, M18, M19; FC-R1, R9 | S | Survey prices other than $9.99, a waitlist email list, live arms and test-and-roll need the owner; F-3 open items — **flag for owner** |
| MRC2-8 | **Return cluster.** P-7 safe return-to (strict `next`) and the D29/P-4 freshness and status line, including "Disconnected ‹date›" on profile, pane and feed card | §2 rows 5, 6; FC-R14, R20 | S-M | Creative C7 on cards is an owner question; consistent otherwise |
| MRC2-9 | **Whole-record preview sequenced after P6 and G0** (MRC #11 timing). Before launch, only a labelled SIMULATION on a Demo record. Live, with `preview_viewed` and a one-tap decline reason | §2 row 11; CO-X2, DT-X4 | S | Builds on MRC #11 (its owner flag stands) |
| MRC2-10 | **Vendor question list extended (adds to MRC #1, G0).** Split-adjusted history; activity-id stability; the per-broker approval list and timing; Build-plan use for pre-launch testing; daily vs real-time tier for open-position values; eligibility for the introductory tier | §6 #2, #4; FC-M25..M27 | XS | Extends POLICY's written-permission gate. Sent by the owner (owner action 2) |
| MRC2-11 | **F-3 billing hygiene.** An annual reminder for monthly plans (prudent; not shown to be required [FC-L22]); no cancel "save" step that delays cancellation; copy never implies paid data is more accurate; a test price never becomes a "was" price; waitlist joiners get the price they saw | §4.1, §4.2; FC-L22, L24 | XS | Terms text is the owner's (POLICY H) — **flag for owner** |
| MRC2-12 | **Age-law posture.** Signed-out surfaces use the documented non-personalized lower-bound order; log the 18+ gate and delete-on-report; the legal committee reviews a visible-end feed option | §6 #11; FC-L25, L26 | S | F-2 (personalization signed-in only); legal committee |
| MRC2-13 | **Sitemap and SEO pages.** `/how`, a glossary, and profiles past the 10-bet floor | §5.2 #7; FC-M34 | XS | None; low priority (effect after week 8) |

**Top five for the next approval cycle:** MRC2-1, MRC2-2, MRC2-3, MRC2-4, MRC2-5.
- MRC2-3 and MRC2-4 are owner-flagged. The approval council can recommend them but not approve them alone.
- The red team would put MRC2-6 in place of MRC2-5. The chair keeps MRC2-5: MRC2-6's core (report action, reserved
  handles) is already a POLICY U2 pre-launch requirement and needs no vote, while MRC2-5 carries the strongest
  viewer-side evidence.
- MRC2-7 drops out of the top five because its stage 1a probably cannot read before week 8.

---

### 9. Owner actions (things only the owner can do)

1. **Rule on POLICY F3b's scope**, in four parts. Members worked from the brief's narrower paraphrase as well as
   POLICY's text, so the channel plans assume the literal reading until this ruling.
   - (a) Confirm the founder's own card is barred (the board said so).
   - (b) Consented trader cards on the company's accounts: the literal reading bars them; the permissive reading allows
     them under CO's eight conditions and needs a POLICY wording change.
   - (c) Moderation notices that quote a thesis.
   - (d) Confirm the trader's own Share is outside the bar.
2. **Send the written vendor request (G0)** with the extended list (MRC2-10). Only the owner can sign up for and email
   the vendor.
3. **Finish the P6 pre-launch list before week 1:**
   - Terms and a Privacy Policy, including the measurement design;
   - real auth, a contact, deletion;
   - start the T5a name clearance (it gates directory launches and a short spoken URL);
   - rent a postal address for CAN-SPAM.
4. **Decide gate revisions** (MRC2-3, with cycle 1's MRC #4):
   - G1 frozen records, G3 surfaces and tagged views, the G4 day-7 definition;
   - inconclusive ≠ miss; the G3 split; carrying `via` forward;
   - the replacement for the week-1 checkpoint (MRC2-4).
5. **Pricing calls:**
   - the survey arms (MRC2-7);
   - a waitlist email list, plus the legal committee's ruling on a launch email;
   - whether any second displayed price may appear;
   - whether a live price test may ever run, and how arm subscribers are honoured;
   - test-and-roll in place of significance;
   - the trial question (F-3: no trial at launch);
   - the F-3 open items on where prices may appear.
6. **Commit founder hours:** 26.5 h a week for supply alone, 37-40 h for both plans. Choose which channels to cut if
   fewer.
7. **Decide on paid-signal sellers** (they change channel 3 and the views gate) and on asking at connect whether the
   user is a registered representative or adviser.
8. **Approve the Terms text** for F-3 billing hygiene (MRC2-11), and get the chaptered California §17602 text read
   before live charges [FC-L22].
9. **Turn the cron on only after** cycle 1's MRC #2 sync cadence is in. An hourly sync would cost ≈$36 per connection a
   month *only if* it calls the vendor's paid manual refresh; the code at HEAD makes no such call [FC-M26, M27].

---

### 10. Known limits (evidence and method), and what would remove each

| Limit | What would remove it |
|---|---|
| No primary research: no interviews, surveys, user tests or real traffic. Every rate in §4-§5 is assumed | Week 1-8 first-party data from MRC2-1; cycle 1's 10-15 interviews per segment |
| Funnel rates (reply 10-25%, connect 21-40%, views per post, bio-link share, founder-to-profile 15-40%) have no non-vendor source | Week-2 outreach log (E9) and week-1-2 `via` counts |
| Signed-in share of viewers (2-20%) is unsourced and drives every person-level test | E1 `signed_in` in the first week |
| The base conversion rests on one randomized study of registrants with trials, which is a ceiling [FC-R1] | Stage 1a painted door; then live single-price data |
| Net per payer excludes international cards (+1.5%), currency conversion (+1%), dispute fees and refunds, so $8.82 is an upper bound [FC-M24] | Processor statements once billing runs |
| Vendor tier unknown: daily ($1) vs real-time ($2) moves break-even from 0.10% to 0.15% at 0.46% trader share; introductory-tier eligibility unknown [FC-M26, M27] | MRC2-10 answer |
| Retention, plan mix, lifetime value and the annual-first prior rest on app-store industry benchmarks with unknown price bands; the test-and-roll formula was not re-opened [FC-M19, M20; RK-X3] | 8+ weeks of live billing |
| The holdings base ($15,000 median, 2022) is stale; the 2025 table was not opened [RK-X4] | Open the 2025 bulletin table |
| The 1.5× disposition figure comes from secondary summaries (the primary returned 403); the number-vs-source trust split is unverified [FC-R12, R17] | Full-text reads |
| Several abstract-only sources: commitment devices, adaptive skepticism, decoy limits, temporal-reframing reversal, money-back returns [FC-R7, R8, R35] | Full-text reads; none drives a decision here |
| Paraphrased quotes in four places: the FINRA Dec 2025 "clean records" line, the "steady returns" line, the SEC 2026-95 label, the "actively encouraged" phrase [FC-L5, L28, L29, L32] | Use exact text before any public copy |
| Two investor.gov alerts (22 Dec 2025, 6 Feb 2026) unopened (403) [FC-L30, L33] | Open from another network |
| California §17602 statute text unopened (403); New York pricing-disclosure law unopened [FC-L22] | Official text before live billing |
| The Florida merits appeal after the Nov 2025 stay is unverified, and criterion 2's wording is ambiguous [FC-L25, L26] | Docket check; the legal committee |
| POLICY F3b's text vs the brief's narrower paraphrase: members worked under two wordings [FC-L F3b note] | The owner's ruling (owner action 1); the brief aligned for cycle 3 |
| Whether vendor history is split-adjusted, and whether activity ids are stable; activity types are mapped on a best-effort basis, so a split may arrive untagged [RK p2] | MRC2-10 answer; one Build-plan account that held a split stock; reconciliation (MRC2-2) |
| The broker feed's October 2026 full rollout, the retail share of volume and the data-rights fee proposal rest on unopened secondary sources [RK S12] | Primary releases |
| The 65+ trust figure (24%) is not on the cited page [FC-R21] | Not used in conclusions |
| Members' web reads were sometimes truncated (e.g. the FTC FAQ, first 100k characters) | Full reads where a claim depends on it |
| No persona walkthroughs were run this cycle; DESIGN's "interviews of ICP-S1" remain unrecorded | Real interviews (cycle 1 MRC #10) |
| The council is AI agents reading public sources; legal points are findings, not counsel's opinion (POLICY owner decision 2026-11-01) | The legal committee's review where flagged |
| Member files were edited for POLICY T2 before commit: paper authors and eponymous method names were removed and replaced by generic descriptions; substance is unchanged | — |

---

### 11. Red-team changes (pass 5) and responses

| Item | Change made |
|---|---|
| R1 | Eponymous method names replaced ("score-interval", "conservative group-sequential"), here and in the member files |
| R2 | The numeracy figure is now stated as "about a third of the US sample in an international adult-skills assessment", with no age frame |
| R3 | The header now cites Part F (the brief), which is included |
| R4 | The trial-study wording is corrected to FC-R1 |
| R5 | The units are fixed: a two-year cohort yield, not a monthly rate |
| R6 | Source ids for the G1 odds and week 14 are corrected; "at or below a coin flip" |
| R7 | The high case is 115 everywhere |
| R8 | ≈20 views per trader (≈23 at 44 traders) |
| R9 | 1.26× only |
| R10 | The −2-pt guard needs ≈6,500 per arm, so it is descriptive in weeks 1-8 |
| R11 | §3.2 is flagged for owner, with the strict DESIGN number always reported; all three redefinitions are in MRC2-3 and owner action 4 |
| R12 | Stages 1b and 2 are now "Yes (owner)" |
| R13 | F-3 open items note added; door and tiles in-app only, never shown to traders, reviewed features only |
| R14 | The account-suspension risk is added (§6 #5b, §5.3 item 7) |
| R15 | Eight Known-limits rows added |
| R16 | Member files scrubbed of author names and eponymous method names before commit |
| R17 | "Support an answer to" (Medium); "of the designs considered" |
| O1-O9 | All taken: O2 (no cohort ages), O3 (extra activity types), O4 (sync cost condition), O5 (no "first 50" in row 10), O6, O7, O8 and O9 |
| Top five | Partly taken: MRC2-3 (gate definitions) and MRC2-4 move up and MRC2-7 (pricing) moves down. The chair keeps the readability cluster over the anti-impersonation pack, for the reason in §8 |

---

# Part B. Pass 5: red team on the synthesis

### Cycle 2, pass 5: red team of the chair's synthesis (p4-chair.md)

**Member:** red team (fresh context). **Pass:** 5. **Date:** 2026-11-01. Not legal or investment advice.
**Read:** BRIEF, p4-chair, the three pass-3 fact-checks, POLICY, DESIGN §3.5, F-3; spot-checked p1/p2 CT, DT, DV, RK.
**Overall:** most numbers match the fact-checks. The pricing table (all 30 cells), G2/G4/G5 power, MDEs, fees, split
examples and the views arithmetic all recompute correctly. The problems are: two eponymous method names (T2; now replaced), one
minors-frame statistic (P4), a few wrong citations and units, gate redefinitions presented as settled, owner flags that
disagree between sections, and gaps in the risks and Known limits.

#### Required changes

**R1. T2: method names taken from surnames.** §2 row 2 and §5.1 Checkpoint: an eponymous interval name. §3.2 decision discipline:
an eponymous boundary name. BRIEF bars method names derived from real people's surnames.
Fix: "score-interval upper bound" (both places), and "an always-valid or conservative group-sequential boundary".

**R2. P4: a minors-inclusive frame.** §1 #2 and §2 row 3/4 cite "34% of US adults at or below Level 1 numeracy" [FC-R19].
FC-R19 says the assessment's sample frame starts below age 18, so the figure covers a cohort that includes minors.
Fix: "about a third of the US sample in an international adult-skills assessment (2023) scored at or below its lowest
numeracy level [FC-R19]". Do not state the age frame.

**R3. Header claims a pass that hasn't happened, and cites a missing appendix.** Line 3 says "revised in pass 5 after the
red team". Line 4 cites "the cycle-2 brief (Appendix H)", and there is no Appendix H.
Fix: put "Pass: 4 (synthesis)" until the revision is done. Either add Appendix H (the brief) or cite "BRIEF.md".

**R4. Trial-study wording that FC-R1 corrected.** §4.1 Base rates: "(+20.9%, all delayed conversion)".
Fix: "(+20.9%; delayed conversion rose 42%, significant; immediate conversion +7%, not significant) [FC-R1]".

**R5. Units error: a two-year flow is presented as a monthly rate.** §4.1: "new payers are ≈0.04-0.12% of monthly
viewers". The input is the share of registrants who *ever* pay within two years (RK-X1 copies the same slip).
Fix: "a month's viewer cohort would eventually yield ≈0.04-0.12% payers over two years (ESTIMATE, Low), so a paying
stock at or below ~0.1% of monthly uniques is plausible".

**R6. Wrong source ids for G1 odds and the week-14 figure.** §5.1 Central case: "P(G1 ≥50) ≈ 35-50%, and 100 traders
arrive around week 14 at mid [FC-M21]". FC-M21 contains neither number. CT p2 says ≈50% and week 14; DT-X2 says 35-45%.
Fix: cite "[CT p2 revisions; DT-X2]" and label it ESTIMATE, Low. In §1 #7, "G1 is about a coin flip" contradicts
35-50% with a central case of 44-51. Say "G1 is at or below a coin flip".

**R7. The high-case total doesn't add up.** §5.1 table, High column: 35+15+15+21+10+3+12+10+6+8 = 135, ×0.85 ≈ 115, not 110.
CT p2 claims #10 offsets #6, but in fact it adds 6.
Fix: either show ≈115 (and range 14-115 everywhere: §1 #7, §7), or footnote "high case kept at CT's 129 raw [FC-M21];
the row cells sum to 135".

**R8. A figure that FC-M22 corrected.** §1 #7: "≈18 views per connected trader a week at mid". FC-M22: 1,000/51 ≈ 20
(18 fits 54 traders).
Fix: "≈20 (≈23 if supply is 44)".

**R9. A withdrawn multiplier.** §4.2 stage 1b: "A 1.26-1.28× read". FC-M3 confirms 1.26×, and PT withdrew 1.28×.
Fix: "A 1.26× read".

**R10. Underpowered guard tests.** §2 row 3 (D22) and row 24 (D20/D25/D26) use "not below control −2 pts" at ≥1,320
impressions per arm. In DV p1, 1,320 is the sample for a +5-point lift and +3 needs 3,660. A −2-point non-inferiority
margin on a 30% base needs roughly 6,500 per arm (ESTIMATE: (1.645+0.84)² × 0.42 / 0.02²).
Fix: state "≈6,500 per arm for the −2-point guard (likely beyond weeks 1-8 at central views); until then the guard is
descriptive". Change row 3's "yes, 2-6 weeks" to "descriptive in weeks 1-8".

**R11. Gate redefinitions presented as settled.** §3.2:
- G3 adds trade and month surfaces, and counts views with `via` ≠ none even with no external referrer. DESIGN §3.5 says
  "profile views from external referrers".
- G1 counts "connection live or frozen". A frozen record is disconnected, and DESIGN says "with a connected broker".
- G4 "day 7 ±1" is also a redefinition.

MRC2-8 flags only the G3 split, `via` carry-forward and day 7.
Fix: add to §3.2 the line "Proposal; changes DESIGN §3.5 definitions, **flag for owner**. Always also report the strict
DESIGN number (profile surface, external referrer only; live connections only)". List all three in MRC2-8 and in owner
action 4.

**R12. Owner flags contradict each other.**
- §4.2 stage 1b shows $12.99 / $7.99 / $4.99 to viewers with Owner "No". MRC2-5 says any displayed price other than
  $9.99/$99.99 needs the owner. Set stage 1b to "**Yes**".
- Stage 2 runs test-and-roll with Owner "No". §3.3 and MRC2-5 say test-and-roll needs the owner. Set stage 2 to
  "**Yes** (test-and-roll; arms on real charges)".

**R13. The painted door ignores open F-3 items.** F-3's open questions (idea board 2026-11-01) propose: no price on
profiles or outside-link landings; a connected trader is never shown a price; an in-app priced "nothing is charged now"
control; and Record tools built only after the legal committee reviews the exact feature list (a decision).
Fix: in stage 1a/1c and MRC2-5, add "door and tiles only on in-app surfaces off profiles and outside-link landings,
never shown to connected traders, pending the owner's call on the F-3 open items; tile copy uses only features the legal
committee has reviewed". Cite the idea board's control as the same test, so the council doesn't present it as new.

**R14. A risk is missing: founder account suspension on the outreach platforms.** CO p1 (lines 60-62): investor
microblogs and group-chat apps ban unsolicited bulk DMs, and a ban "removes the founder's only channel". Channel #1
carries about 15 of the 44-51 connects through 280 cold one-to-one DMs. CT p1 adds that many trading communities ban
promotion.
Fix: add to §6 the row "Platform anti-spam or self-promotion enforcement | M / high | warnings, rate limits, removed
posts | individually written messages only, a daily cap set by the platform's published rules, 'I built this' in each
message; stop and move hours to #4 at the first warning | G1". Add a matching line to §5.3.

**R15. Known limits is missing rows.** Add:
- POLICY F3b text vs BRIEF's narrower paraphrase. Members worked under two wordings, so the channel plans may assume
  the narrow one [FC-L §B]. Removed by the owner's ruling and aligning BRIEF.
- The Florida merits appeal after the Nov 2025 stay is unverified, and criterion 2's wording is ambiguous [FC-L25, L26].
- Fees exclude international cards (+1.5%), currency conversion (+1%) and the $15 dispute fee. Whether a refund returns
  the fee is unknown. So $8.82 is an upper bound on net [FC-M24].
- The vendor tier is unknown: Daily vs Real-time moves break-even from 0.10% to 0.15% at 0.46% trader share. Eligibility
  for the $0 introductory tier is unknown [FC-M26, M27].
- Lifetime value and annual-first rest on retention inputs that were not re-verified. The test-and-roll formula was not
  re-opened [FC-M19, M20].
- The 1.5× disposition figure comes from secondary summaries (the primary returned 403) [FC-R12]. The number-vs-source
  trust split is unverified [FC-R17].
- The holdings base ($15,000 median, 2022) is stale. The 2025 survey table was not opened [RK-X4].
- The vendor's activity types are "best effort" mapped, so a split may arrive untagged [RK p2].

**R16. The council record carries T2 violations.** FC-M and FC-R: p1-pricing-tests still names about 20 paper authors and
two eponymous price-survey methods. If the council record is committed (cycle 1 went into a PR), CI's T1/T2 scan and
POLICY fail.
Fix: add to Known limits / §9 the line "Before committing any council file, scrub p1-pricing-tests [S4]-[S8], [S17],
[S18] and its method names (chair task, not owner)".

**R17. Overclaims.**
- §1 #3: "settle cycle 1's open 'unflattering records' question … (Medium-High)". The evidence is from forex and
  social-trading platforms where leaders may have been paid per follower (FC-R11 unverified; FC-R13's pay link is the
  authors' interpretation) and from hedge-fund databases (an opposing view is noted) [FC-R14]. Use "support an answer
  to", Medium.
- §1 #6: "is the only price method that can finish at this scale" is a completeness phrasing. Use "the only one of the
  designs considered that can finish".

#### Optional changes

**O1.** §1 #10 sets 37% (includes bonds and funds) beside 56% (includes retirement and indirect holdings). Add "both
overstate direct stock traders; not comparable to the 21% direct figure" [FC-R24, R25]. Label "The wedge left…" as
HYPOTHESIS.

**O2.** §6 #11: replace the listed minor age bands with "the statute's minor-account duties". That avoids
naming minor cohorts (P4 says "mention") and loses nothing.

**O3.** MRC2-2: add `EXTERNAL_ASSET_TRANSFER_IN` and `ADJUSTMENT` to the requested types [FC-M35, RK p2]. Make lot-to-position
reconciliation the primary detector, because the tagging is "best effort".

**O4.** Owner action 9: "an hourly sync costs ≈$36 per connection a month *only if it calls the vendor's paid manual
refresh*. The code at HEAD makes no such call [FC-M27]".

**O5.** §2 row 10: rename "first 50 from transparency-led traders" to "transparency-led recruiting segment". MRC2-4 bans
"first 50" wording. State that `inv_<segment>` codes are attribution only and gate no access [FC-L2].

**O6.** §6 #7: "n≥50 for ±11 pts" holds only near p=0.2. At p=0.5 it is ±14. State the p.

**O7.** §5.1/§5.2 tables: add "ESTIMATE, Low" in the headers. §2 row 10 "±39" vs §3.3 "±40": pick one.

**O8.** §10: replace "WebFetch reads" with "members' web reads" (tool name not needed).

**O9.** Add to §9 owner actions: get the chaptered California §17602(h) read before live charges [FC-L22]. Decide the
F-3 open items that touch pricing tests (R13).

#### Top five: reorder

The chair ranks by "precondition for reading the gates × evidence × cost". On that rule:
- **MRC2-8** (gate definitions) has to be pre-registered before week 1, or the gates can't be read. It ranks above
  MRC2-3 and MRC2-5.
- **MRC2-7** contains U2 items (report action, reserved handles) that §5.1 lists as week-1 preconditions. A POLICY
  precondition shouldn't sit outside the top five.
- **MRC2-5**: stage 1a can't read before about 525 signed-in returners, which is probably after week 8 at 2-20%
  signed-in. MRC2-3's tests are underpowered (R10), so its value is in shipping on principle.

Proposed top five: **MRC2-1, MRC2-2, MRC2-8, MRC2-4, MRC2-7**. Then MRC2-3, MRC2-5 and MRC2-10. MRC2-10 is XS and feeds
G0, but it is the owner's action 2.

#### Checks that passed (no change)

- Pricing equivalence and break-even cells at $1 and $2, net per payer, fee shares [FC-M1..M7, M27].
- G2 56/34/10; G4 4.2%; 525/648; 1,533; 282; 67/151; RPV 32-38k and 26-76 weeks; test-and-roll 640-5,200.
- Views 100 / 1,150 / 4,300 and 50 / 4.3 / 1.2×; ≈$106 vs $150; $53,088 as a maximum; California reminder "prudent".
- Legal corrections carried (painted door as §5, 465.5(c), Florida stay); 1.5× disposition; 83% crypto; 2% "paid for it".
- No banned phrases, URLs or competitor names beyond R1/R2/O2. F3b left to the owner throughout. No other unflagged
  overrule of an owner decision beyond R11/R12.

---

# Part C. Pass 3: fact-checks

## C1. Research figures

### Cycle 2, pass 3: Fact-checker (research: academic studies, surveys, statistics)

Member: independent fact-checker, research domain. Cycle 2, pass 3, 2026-11-01. I opened every source below myself this
session, unless the verdict says UNVERIFIED. Paper authors are not named (T2/T4). Papers are cited by title description and
DOI. URLs are given only where the domain and path carry no third-party brand. A publisher landing page, a platform's own
report, or an author-named lab page is described generically instead.

File keys: PW = p1/p2-pricing-wtp, PT = pricing-tests, DT = demand-traders, DV = demand-viewers, CV = channels-viewers,
CT = channels-traders, RK = risks, ME = measurement, CO = compliance.

#### 1. Verdict table (35 claims)

| # | Claim id · file | Claim as stated | Verdict | Source opened | Scope / misuse note |
|---|---|---|---|---|---|
| 1 | PW C6 [S10]; p2-PW X3; p2-PT; p2-RK | Randomized 7-day vs 3-day trial, n=680,588: total paid 0.368% → 0.445% (+20.9%) over two years; all of the lift came from delayed conversion | **CONFIRMED** (figures). Small wording fix: immediate conversion also rose +7.3% (0.224 → 0.241%), but not significantly. Delayed conversion rose +42% (significant) | https://pmc.ncbi.nlm.nih.gov/articles/PMC12217587/ (full text). The 2025 correction (PMC12642629) only adds an author affiliation | New *registered* users of a freemium image-editing app in about 190 countries. Uneven split (70/30). Abstract says 2023-24, methods say registrations Jul-Aug 2022. **Both arms had a free trial**, so this is paid conversion *with* a trial. It is a two-year cumulative flow, not a monthly paying stock |
| 2 | PW C6 [S9]; PT [S8] | SaaS field test: shorter trials maximized acquisition, retention and profit; 7-day was the best uniform policy (+5.59% subscriptions); arms were 7/14/30 days, with no no-trial arm | **CONFIRMED** | https://arxiv.org/abs/2006.13420 (abstract); DOI 10.1287/mnsc.2022.4507 resolves to the same paper | **PW S9 and PT S8 are the same study** (preprint and journal version). Count it once, not as two confirmations. It cannot show that a trial beats no trial |
| 3 | PW C4 [S7] | 21 paywalled news sites, about 28,500 weighted cases: a discount raises the odds of paying 3.35× (95% CI 1.16-9.66); price, trial length and paid trial not significant; a teaser intro cuts "subscribe" clicks 72% | **CONFIRMED** (OR 3.345, CI 1.159-9.658, weights 28,506; intro −72.2%) | Open-access accepted manuscript, university repository: https://openaccess.city.ac.uk/id/eprint/34508/ (PDF Table 2); DOI 10.1080/1461670X.2024.2438229 | Observational and cross-sectional. The regression runs on **site-level proportions (21 data points)**, with weights standing for individuals, which is why the CI is so wide. Sites are German and Austrian local and regional news, 2022. The paper also found a stand-first (deck) cut clicks **86.3%**, a stronger teaser effect than the one cited |
| 4 | PW C3 [S2] | Five experiments: a 9-ending reads as smaller than the price one cent higher only when the left digit changes, and more so when the competing price is close | **CONFIRMED** | Abstract via index: https://ideas.repec.org/a/oup/jconrs/v32y2005i1p54-64.html; DOI 10.1086/429600 | Lab study of perception, not purchase |
| 5 | PW C3 [S3] | Three catalog field experiments: a $9 ending raised demand in all three, more for new items, less with "Sale" cues | **CONFIRMED** | https://ideas.repec.org/a/kap/qmktec/v1y2003i1p93-110.html; DOI 10.1023/A:1023581927405 | Physical catalog goods ($9 endings at the dollar level, not $x.99) |
| 6 | PW C3 [S4] | Field experiment: the apparent .99 effect vanished once substitute prices were controlled for | **CONFIRMED** | https://ideas.repec.org/a/jec/journl/v9y2013i2p211-229.html; working-paper abstract https://ideas.repec.org/p/mil/wpdepa/2009-26.html | One retailer and one item category |
| 7 | PW C4 [S5][S6] | Per-day reframing ("pennies a day") raises compliance in lab studies; a follow-up says the effect reverses at large magnitudes | **CONFIRMED** [S5]. **UNVERIFIED** [S6]: the reversal is reported only in secondary summaries; primary not opened | https://ideas.repec.org/a/oup/jconrs/v24y1998i4p395-408.html; DOI 10.1086/209517 | Lab studies, partly donation scenarios |
| 8 | PW C5 [S8] | Replication program: 91 attempts at an attraction (decoy) effect across 23 product classes gave only 11 reliable effects | **CORRECTED (citation)**. The figures are right but come from a *different* 2014 marketing-research-journal article, DOI 10.1509/jmr.14.0020. The DOI cited (10.1509/jmr.12.0061) is the companion "limits of attraction" paper, which found decoy effects only with numeric attribute descriptions | https://ecommons.cornell.edu/entities/publication/0c5b506a-f8d3-4a4c-8825-b2c715e9f956 (abstract). That abstract adds "only chance levels" with verbal or pictorial stimuli | The conclusion "don't design on decoys" is strengthened |
| 9 | PT C (line 35) [S4] | Meta-analysis, 77 studies / 115 effect sizes: hypothetical WTP overstates real WTP by 21% on average; bias larger for higher-value, specialty, within-subject and indirect methods | **CONFIRMED** (also 47 papers; 24,347 hypothetical and 20,656 real observations) | https://ideas.repec.org/a/spr/joamsc/v48y2020i3d10.1007_s11747-019-00666-6.html | Consumer goods. An *average* ratio. Price-intent tests of a new digital service may sit at the high end |
| 10 | PT C (line 36) [S5] | Earlier meta-analysis, 28 studies / 83 observations: median hypothetical/actual ratio 1.35; choice formats reduce the bias | **CONFIRMED** | https://econpapers.repec.org/RePEc:kap:enreec:v:30:y:2005:i:3:p:313-325 | Environmental and public-goods valuation, not subscriptions. Median, with a right-skewed distribution |
| 11 | DT C1 [S1] | Diff-in-diff on a social trading platform: becoming a followed "leader" increases the disposition effect, in forex and in stocks and indices | **CONFIRMED** | https://ideas.repec.org/a/eee/jbfina/v94y2018icp75-88.html (abstract) | The abstract does **not** say leaders were paid per follower. DT open question 4 ("measured leaders paid per follower") is UNVERIFIED from the abstract |
| 12 | DT C2 [S3→S2]; RK C3 [S4] | Founding study, 10,000 discount-brokerage accounts: stocks with gains were about 68% more likely to be sold than stocks with losses | **CORRECTED**. "68%" appears in the secondary working paper (MPRA 43570, verified in its text), but the primary's headline full-year rates (14.8% of gains vs 9.8% of losses realized) imply **≈1.5×, i.e. about 50% more likely**. Use "about 1.5×". RK's qualitative quote is CONFIRMED | https://mpra.ub.uni-muenchen.de/43570/ (PDF text); primary DOI 10.1111/0022-1082.00072 (403); proportions confirmed through multiple academic summaries | US accounts, 1987-1993. Reversed in December (tax selling). The direction of DT C2 is unchanged |
| 13 | DT C3 [S4] | Social trading platform 2013-14, >2,000 shared portfolios, about 30,000 comments: more posts after good returns; positive tone rises with returns, negative tone does not track losses; longer comments after bad outcomes; platform paid traders by follower count | **CONFIRMED** (period Jan 2013-Dec 2014; negative tone "not statistically significant"; the paper names the follower-based pay scheme) | https://topcat.aeaweb.org/conference/2018/preliminary/paper/k6sdiHa8 (full text) | European exchange-run platform. The pay link is the authors' interpretation |
| 14 | DT C4 [S5] | Funds that report voluntarily had significantly worse returns at the end of their reporting lives; better and larger funds had lower hazard of leaving | **CONFIRMED** | Abstract via index: https://ideas.repec.org/p/pri/cepsud/124.html (working paper No. 124, 2006) | One commercial hedge-fund database. The paper notes an opposing industry view (good funds stop because they no longer need investors), and later work agrees delisting usually signals deterioration |
| 15 | DV C1 [S1] | The mandated mutual-fund "past performance" disclaimer had no effect on willingness to invest or on expected returns; a stronger "high returns don't persist" statement worked | **CONFIRMED** ("completely ineffective") | https://econpapers.repec.org/RePEc:wly:empleg:v:7:y:2010:i:3:p:429-459 | Online experiment. Ads, not records |
| 16 | DV C1 [S2] | Three preregistered experiments (N=1,600): the standard disclaimer didn't help most participants and backfired for low literacy; an alternative concrete disclaimer helped | **CONFIRMED** | https://doi.org/10.1037/xap0000358 (accepted manuscript on a university repository) | The helpful alternative was specifically a **fee-minimization** message, not just any concrete rule |
| 17 | DV C2 [S3] | Five experiments (5,780 people) including a news-site field test: numeric ranges barely lowered trust in the number and did not lower trust in the source; verbal uncertainty caused most of the loss | **CONFIRMED** on the abstract (n=5,780; "mostly for verbal"). The split between number and source is from a secondary summary (UNVERIFIED in primary) | PMC full text listed (PMC7149229), DOI 10.1073/pnas.1913678117; abstract via index | UK samples, facts about public topics |
| 18 | DV C3 [S5] | Crowdsourced experiment (**n=1,000**): 95% CIs led people to overestimate effects and pay more than prediction intervals did, and to underestimate individual variability | **CORRECTED (n)**. Effects confirmed. The sample is **two experiments, each recruiting 2,400 US online crowd workers: 1,743 and 1,830 analyzed**. "1,000" is the number of simulated outcomes in the stimuli | University lab PDF (path carries no name): https://mucollective.northwestern.edu/files/2020-Visualizing-Inferential-Uncertainty.pdf; DOI 10.1145/3313831.3376454 | Larger n strengthens the finding. Stimulus was a game scenario. A published commentary questions WTP as the measure |
| 19 | DV C4 [S6] | 34% of US adults at or below Level 1 in numeracy in 2023, up from 29% in 2017 | **CONFIRMED** | https://ies.ed.gov/learn/press-release/u-s-adults-score-par-international-average-literacy-skills-below-international-average-numeracy-and | Scope: the international adult-skills assessment's sample frame, not all adults; cite as "about a third of the US sample" |
| 20 | DV C6 [S10] | n=1,031 (April 2025, ±3.7): most-important factor: research 32%, well-regarded 26%, current 18%, relevant 17%; least important: "many liked" 54%, "paid for it" 21%; 24% get money info from social media, 35% of 18-29 | **CONFIRMED** (fielded Apr 18-21 2025, probability panel) | https://finrafoundation.org/sites/finrafoundation/files/2025-09/What-Matters-to-Consumers-When-Assessing-Information-for-Financial-Decision-Making.pdf | The source says "under 30" (the panel is 18+), which equals 18-29. Stated importance, not behaviour |
| 21 | DV C9 [S14] | Adults under 30: 50% have at least some trust in social-media information vs 51% for national news; **24% for social media at 65+** | **CONFIRMED** 50% / 51%, n=5,195, Sep 8-14 2025. **UNVERIFIED** 24%: not on the page (other pages from the same publisher report 28% for 65+ in 2025) | https://www.pewresearch.org/short-reads/2025/10/29/how-americans-trust-in-information-from-news-organizations-and-social-media-sites-has-changed-over-time/ | Drop the 65+ figure or re-source it |
| 22 | PW C9 [S11]; p2-PW | 2024 Investor Survey (2,861; Jul-Dec 2024): 40% use paid newsletters or online resources (40% in 2021); 75% brokerage research and tools; 36% mobile-app popular investments; 29% social groups or boards; 26% finfluencer recommendations (61% / 31% / 6% by age) | **CONFIRMED** (chart legend order read as first bar 2021, second 2024, which matches the text) | https://www.finrafoundation.org/sites/finrafoundation/files/2025-11/NFCS_Investor_Survey_Report_White_Paper.pdf pp. 24-27 | Population is **adults with non-retirement investments**, not all adults. Measures *use*, not spend. The 26% splits as 22% "sometimes" + 4% "frequently" |
| 23 | PW C9-C10 [S12] | 2022 national family-finance survey: 21% of families held stock directly (15% in 2019); conditional median fell $29,000 → $15,000 | **CONFIRMED** | https://www.federalreserve.gov/publications/files/scf23.pdf | Direct holdings only, 2022 dollars. The drop reflects new small entrants |
| 24 | RK C4 [S5] | 2025 household well-being survey (~13,000; Oct 2025): 37% hold stocks, bonds, ETFs or mutual funds outside retirement; 18% at 18-24, 33% at 25-54, 45-48% at 55+; crypto 9% (7% 2024, 11% 2021) | **CONFIRMED** (n=12,934; Table 28 and Table 33) | https://www.federalreserve.gov/publications/files/2025-report-economic-well-being-us-households-202605.pdf | Includes bonds and funds, so it overstates *stock traders* |
| 25 | RK C4 [S6] | Family-finance survey: stock-market participation 58% (2022) → 56% (2025); median holdings among holders +36% | **CONFIRMED** ($56,900 → $77,400) | https://federalreserve.gov/newsevents/pressreleases/other20261009a.htm | **Includes indirect holdings (retirement accounts and funds).** Do not set 56% against the 21% direct figure (#23) as if they measured the same thing |
| 26 | CV C4 [S2]; p2-DV X7; p2-CO | FTC: $7.9B reported 2025 investment-scam losses, about half of all fraud losses, average loss above $10,000 | **CONFIRMED** $7.9B of $15.9B (≈50%). **WRONG / unsupported**: no average loss appears in the release. Pass 2 already dropped it | https://www.ftc.gov/news-events/news/press-releases/2026/03/ftc-testifies-joint-economic-committee-agencys-efforts-combat-fraud | Consumer-reported losses (self-selected reports) |
| 27 | CV C4 [S3]; DT C5 [S8]; DV [S8] | FTC: $2.1B lost in 2025 to scams that began on social media (about 8× 2020); $1.1B of it investment scams; fake platforms show fake profits | **CONFIRMED** (2020 ≈ $261M) | https://www.ftc.gov/news-events/data-visualizations/data-spotlight/2026/04/reported-losses-scams-social-media-eight-times-higher-2020 | Includes crypto. Reported losses only |
| 28 | RK C2 [S2] | Federal crime-complaint centre: investment-fraud losses $4.57B (2023), $6.57B (2024), $8.65B (2025) | **CONFIRMED** ($4,570,275,683; $6,570,639,864; $8,648,617,756) | https://www.ic3.gov/AnnualReport/Reports/2025_IC3Report.pdf | The same report puts **cryptocurrency investment fraud at $7.2B of 2025's total (~83%)**. Stock-related "fake proof" fraud is a small slice. Complaint-based |
| 29 | CT C9 [S5] | About half of US adults and two-thirds of 18-29 listened to a podcast in the past year; finance listening not reported | **CONFIRMED** | https://www.pewresearch.org/journalism/2023/04/18/podcasts-as-a-source-of-news-and-information/ | 2022 survey (published 2023). Three years old |
| 30 | CV C5 [S7]; p2-DV [S16] | 21% of adults regularly get news from news influencers, 38% at 18-29; 69% mostly come across it (77% at 18-29) | **CONFIRMED** (Aug 18-24 2025) | https://www.pewresearch.org/journalism/fact-sheet/news-influencers-fact-sheet/ | News influencers in general, not finance |
| 31 | p2-DV X2 (c1 FC-R3) | Among finfluencer followers who use social media, 77% use long-form video, 40% short video | **CONFIRMED** (figures), with an important **scope correction**. The question is about channels used *for information about investing*, asked of adults with non-retirement investments. "Followers" here are the 20% of investors who both use social media and follow finfluencers | https://finrafoundation.org/sites/finrafoundation/files/2026-03/FINRA_Foundation_Research_Brief_Social_Media_Finfluencers.pdf p. 3-4, Fig. 1 | Not general platform use. The brief's other 77% (followers who use social groups or boards) must not be mixed in |
| 32 | p2-DV X2 (c1 FC-R31) | 95% of adults 18-29 use the long-form video platform, 65% the short-video platform | **CONFIRMED** (all adults 84% / 31%; boards 40% at 18-29) | https://www.pewresearch.org/internet/fact-sheet/social-media/ (19 Oct 2026; survey Jan 30-Jun 18 2026) | General use, any purpose |
| 33 | Cycle 1 (CV C5, BRIEF) | Link posts were 1.1% of US feed views on a large general network in Q2 2026 (1.3% Q1) | **CONFIRMED** | [S-a] The network's own widely-viewed-content transparency report, Q2 2026, opened 2026-11-01 (URL withheld under T1) | A *share of views*. It mixes how few link posts there are with how little reach each gets. It is not a click-through rate. One network |
| 34 | ME C9 [S6] | Bot study: about half of web requests are automated; user-agent keyword and list matching caught 67.6% of bots at 3.0% false positives on 4.6M requests; about 11% of bot IPs requested robots.txt | **CORRECTED (minor)**. 67.6% (abstract: 67.7%) is the paper's **combined user-agent + favicon method**, not user-agent matching alone. 3.0%, 4.6M and 11% (351/3,185) confirmed. "Half" refers to *HTML page* requests, citing an edge-network report | https://arxiv.org/abs/2603.28546 and the v2 full text | One site's logs. The filter-stack lesson (UA alone is insufficient) stands, even more strongly |
| 35 | ME C9 [S7]; CV C6 [S8]; DT C6 [S11] | Behavioral bot framework ≥98% precision and recall; popularity on two news aggregators reflects quality "more than expected"; buyers adapt skepticism when the setup signals withholding | **CONFIRMED** (all three abstracts). CV's front-page and exponential-decay detail remains **UNVERIFIED** (as CV said) | https://arxiv.org/abs/2412.02266 (one e-commerce site, 40M monthly visits); https://arxiv.org/abs/1501.07860; https://ideas.repec.org/p/uea/wcbess/25-02.html | Lab or single-site evidence; transfer is HYPOTHESIS |

Tally: 29 rows CONFIRMED on their main figure (#26 includes a WRONG sub-claim, the average loss) · 6 CORRECTED (#1
wording, #8, #12, #18, #31 scope, #34) · UNVERIFIED sub-claims in #7, #11, #17, #21 and #35 · 0 rows wholly wrong.

#### 2. Corrections that change conclusions

1. **The 0.37-0.45% base rate is weaker support than PW and p2 suggest (#1).** Every user in that study was offered a free
   trial. The figure is the two-year paid share of *registrants* of an image-editing app across about 190 countries, so it is
   a flow with a committed denominator. Stock Social launches with **no trial** (F-3) and has visitors, not registrants.
   Both differences push the expected rate *below* the study's range. Read it as an upper reference for registered,
   trial-offered users. It is not evidence for PT's 0.5% base case (p2-PW item 3 should be withdrawn or labelled
   HYPOTHESIS). The council's 0.1-0.5% stock prior keeps its lower half and loses any claimed peer-reviewed anchor for its
   upper end.
2. **"Discounts are the one lever with field support" (#3) rests on 21 site-level data points.** It is observational, and
   the CI runs from 1.16 to 9.66. The study's strongest finding is about teasers: a stand-first cut clicks 86%, an intro
   72%. That *supports* PW's point that the more the free record answers, the less people pay. The discount OR is not
   strong enough to size a test, and F-3 and 16 CFR 233.1 limit "discount" framing in any case.
3. **Disposition magnitude (#12): use about 1.5× (about 50% more likely), not 68%.** DT C2, RK C3 and anything quoting the
   gap between closed-trade and whole-book records keep their direction. Any ESTIMATE built on 68% shrinks.
4. **Two "independent" trial studies are one (#2).** The evidence that 7 days beats 14 or 30, and the 3-day vs 7-day
   result, still give a non-monotonic picture with **no no-trial arm anywhere**. The board's UNVERIFIED tag on "trials beat
   no trial" stands.
5. **Long-form video (#31).** The 77% is a channel used for investing information by a self-selected investor subgroup
   (about 20% of investors). It supports adding a long-form explainer row (p2-DV X2). It must not be used as reach or as a
   share of viewers. For sizing, use the general-use figures (#32), and give any click rate as an ASSUMPTION.
6. **Fraud figures (#26-28) for the press angle.** About 83% of 2025's $8.65B in investment-fraud complaints was crypto, and
   the FTC figures also include crypto. A pitch about stock "screenshot proof" must not imply these totals are about stock
   records. Drop the "average loss above $10,000" (no source). Do not mix the 56% (indirect-inclusive) participation figure
   with the 21% direct-holder figure in viewer-market sizing (#23, #25).
7. **Interval misreading (#18) is better powered than stated.** About 1,700-1,800 analyzed per experiment, not 1,000.
   DV C3's warning that a per-trade average interval will be read as a per-trade band gains weight. Test that item
   explicitly (DV open question 2).
8. **Citation fixes with no change to conclusions:** decoy DOI (#8), bot-study method attribution (#34), unverified 65+ trust
   figure (#21), and an unverified detail in DT's open question 4 (#11).

#### 3. POLICY T1/T2 problems found in the files

| File · location | Problem | Fix |
|---|---|---|
| p1-pricing-tests.md lines 173-187 ([S4], [S5], [S6], [S7], [S8], [S17], [S18]) | **T2/T4: paper authors named** (about 20 surnames) | Cite as "meta-analysis of hypothetical bias, marketing-science journal, 2020, DOI …", and so on, as PW does |
| p1-pricing-tests.md lines 40-46, 153 | **Eponymous method names** built from real people's surnames (two price-survey methods) | Use "price-sensitivity meter (four-question)" and "direct price-acceptance ladder" |
| p1-demand-traders.md, p1-demand-viewers.md, p1-pricing-tests.md sources | Journal and conference titles written out (finance, science-academy, computing-conference, publisher journal names) | Low risk. These are venues, not competitors, but they are publisher products. For consistency, use venue type + DOI (PW's convention) |
| p1-measurement.md [S5] | A metadata protocol named and linked; it was originated by a social network | Low risk (it is a technical standard, and `og:` tags must be named in code). Keep the tag names and describe the spec generically |
| p1-demand-viewers.md [S2] | Repository domain carries a consortium name | Low. The DOI link alone suffices |
| p1-risks.md, p1-pricing-wtp.md | Integrated vendors (SnapTrade, Stripe) named and linked | Allowed (BRIEF list). No action |

I found no minors cohorts, no banned phrases outside rule quotations, and no named competitor platforms in pass-1 or
pass-2 files.

#### Sources

The sources are the URLs in the table, all opened 2026-11-01 unless marked UNVERIFIED. [S-a] is a platform transparency
report, URL withheld under T1, opened: yes. Paywalled publisher pages (the journalism-studies journal, the
computing-conference library, the finance journal for #12) returned 403. Their figures were checked through the
open-access copies or indexes listed.

#### Open questions

1. Can anyone open the primary disposition-effect paper (DOI 10.1111/0022-1082.00072) to settle the 1.5× vs 68% framing?
2. Is there any peer-reviewed visitor-to-paid rate *without* a trial for a subscription content product? None was found.
3. Should the council replace the 65+ trust figure with the 28% figure after opening its source?

## C2. Legal and regulatory citations

### Cycle 2, pass 3: fact-check of legal and regulatory citations

**Member:** independent fact-checker (legal and regulatory citations). **Pass:** 3. **Date:** 2026-11-01.
This is market research, not legal advice. I opened each primary source myself this session, unless the row says otherwise. Members are cited by file: CO = compliance, CT = channels-traders, CV = channels-viewers, DT = demand-traders, DV = demand-viewers, PT = pricing-tests, PW = pricing-wtp, RK = risks. Under T1/T2, court parties, people and platforms are not named, and I withhold any URL whose path carries a brand or a person's name.

**Verdicts:** CONFIRMED (the source says what the member says); CORRECTED (the substance is right but a quote, cite, scope or number needs fixing); UNVERIFIED (I could not open a primary source this session); WRONG (the source contradicts the claim).

#### A. Claim table

| # | Claim id (file) | Claim as stated (short) | Verdict | URL opened | Note |
|---|---|---|---|---|---|
| 1 | CO C1 (p1) | 16 CFR 255.0: an "endorsement" is any promotional message consumers are likely to believe reflects a party other than the sponsoring advertiser; "product" includes a "service, brand, company"; in social media a disclosure "should be unavoidable" | CONFIRMED | https://www.law.cornell.edu/cfr/text/16/255.0 | All three quotes are verbatim. The inference that company reposts make a card *our* advertising follows from the definition (HYPOTHESIS, High). |
| 2 | CO C2 (p1); CT; CO X7 (p2) | 255.5: material connections include free or discounted products "regardless of whether the advertiser requires an endorsement in return", and "early access to a product"; disclose when "a significant minority of the audience" would not expect the connection | CONFIRMED | https://www.law.cornell.edu/cfr/text/16/255.5 | Verbatim. The text also names "the possibility of being paid, of winning a prize, or of appearing on television or in other media promotions". Note that last item: **featured placement in company media is itself a named connection**, which supports CO X10 condition 7. |
| 3 | CO C4 (p1) | 255.1: an advertiser "may be liable for a deceptive endorsement even when the endorser is not liable"; advertisers should provide guidance, monitor and act | CONFIRMED | https://www.law.cornell.edu/cfr/text/16/255.1 | Verbatim. |
| 4 | CO C4 (p1) | FTC staff: a platform's built-in tool is "not necessarily" enough; a disclosure goes "in each and every ad" | CONFIRMED | https://www.ftc.gov/business-guidance/resources/ftcs-endorsement-guides | Both phrases are on the staff FAQ ("each and every ad that would require a disclosure if that ad were viewed in isolation"). |
| 5 | CO X7 (p2) | Staff say a company that "actively encouraged" posts takes on monitoring duties | UNVERIFIED | same FAQ (first 100k of 108k characters read) | The phrase was not in the part I read. The FAQ does say advertisers need "reasonable programs in place to train and monitor". The point is substantively supported by 255.1(d), but drop the quotation marks. |
| 6 | CO C5 (p1) | 255.2: without substantiation that a result is representative, the ad must disclose "the generally expected performance"; "Results not typical" does not cure | CONFIRMED | https://www.law.cornell.edu/cfr/text/16/255.2 | Both points are in the text and its examples. The text says "should clearly and conspicuously disclose" plus "must possess and rely on adequate substantiation". |
| 7 | CO C6 (p1) | Part 465 in force since 21 Oct 2024, with civil penalties for knowing violations | CONFIRMED | https://www.federalregister.gov/documents/2024/08/22/2024-18519 (FR API: 89 FR 68034, effective 2024-10-21) | The effective date is confirmed. The penalty point rests on FTC Act 5(m)(1)(A) for rule violations; the current maximum is $53,088 (row 11). |
| 8 | CO C6 (p1) | 465.5(a): an officer or manager writing a review or testimonial must disclose the relationship "unless, in the case of a consumer testimonial, the relationship is otherwise clear" | CONFIRMED | https://www.law.cornell.edu/cfr/text/16/465.5 | Verbatim. |
| 9 | CO C6 (p1) | §465.2(c) bars procuring reviews from officers, employees, agents "or any of their immediate relatives" for third-party sites *without disclosure* | CORRECTED | https://www.law.cornell.edu/cfr/text/16/465.2 and /465.5 | 465.2(c) applies only where the business knew the review **misrepresented** that the reviewer exists or had the experience. Undisclosed insider reviews fall under **465.5(c)**. That section bars an officer soliciting reviews from relatives or employees only when the review appears without disclosure *and* the officer encouraged non-disclosure, did not tell them to disclose, or failed to remediate. CO's "friends and family are not asked" is stricter than the rule (fine as policy). The rule itself is met by "ask, and tell them to disclose". |
| 10 | CO C6/C7/C8 (p1) | 465.4 no incentives "conditioned … on" a sentiment; 465.8 bars buying "fake indicators of social media influence"; 465.7(b) bars implying displayed reviews are all reviews while suppressing on sentiment; neutral criteria are allowed | CONFIRMED | https://www.law.cornell.edu/cfr/text/16/465.4, /465.8, /465.7 | Verbatim. 465.8 needs "knew or should have known" the indicators were fake and that they "materially misrepresent … influence or importance for a commercial purpose". It covers both selling (a) and purchasing (b). |
| 11 | CO C9/C27 (p1); CT; DT X10 (p2) | CAN-SPAM penalties "up to $53,088 per email"; "no exception for business-to-business email"; "covers all commercial messages" | CONFIRMED | https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business; eCFR 16 CFR 1.98 as of 2026-10-29 via https://www.ecfr.gov/api/versioner/v1/full/2026-10-29/title-16.xml?part=1&section=1.98 | 1.98(d) still reads $53,088 (90 FR 5581, Jan 2025), so no 2026 adjustment had been codified by 29 Oct 2026. It is a statutory **maximum**, and courts weigh culpability, so CO C27's $8.5M (160 × $53,088 = $8,494,080, arithmetic correct) is a theoretical ceiling. CT X4's "conditional on email being used" framing is the right one. |
| 12 | CO C9 (p1); CO X6 (p2); CT; CV (p2) | Each commercial email needs: identification as an ad (waived after prior affirmative consent), an opt-out notice and mechanism, opt-outs honored within **10 business days**, a valid physical postal address (registered PO box OK); harvesting is aggravated | CONFIRMED | https://www.law.cornell.edu/uscode/text/15/7704; https://www.law.cornell.edu/cfr/text/16/316.2 | 7704(a)(4) gives "more than 10 business days" and 7704(a)(5)(A)(i)-(iii) gives ad identification, opt-out and "valid physical postal address". (a)(5)(B) waives ad identification after "prior affirmative consent". 316.2 defines the address as including a USPS-registered PO box or a registered private mailbox. 7704(b)(1) covers harvesting and dictionary attacks. The FTC guide also says the opt-out must work for 30 days after sending. |
| 13 | CO C9 (p1) | "Primary purpose" test (16 CFR 316.3); staff include email "that promotes content on commercial websites" | CONFIRMED | https://www.law.cornell.edu/cfr/text/16/316.3; FTC guide (row 11) | Applying this to a free connect invitation is a HYPOTHESIS (Medium), as CO labelled it. DT X10's relabel (one-to-one coverage = HYPOTHESIS, High) is right: the guide does not address one-to-one email by name. |
| 14 | CO C10 (p1); CT | TCPA rule: autodialed or prerecorded calls need prior express (written, for telemarketing) consent, and a "call" includes a text | CONFIRMED (with nuance) | https://www.law.cornell.edu/cfr/text/47/64.1200 | 64.1200(a)(2) requires "prior express written consent" for telemarketing by autodialer or prerecorded voice. The words "call includes a text message" appear in the rule text in (a)(9). Applying the TCPA to texts generally rests on FCC interpretation, not quoted here. A 2021 Supreme Court decision (592 U.S. 395) narrowed "autodialer", but the do-not-call rules in 64.1200(c) still reach telephone solicitations. "No SMS" stands. |
| 15 | CO C13 (p1); CO X10 (p2) | Adviser exclusion for "the publisher of any bona fide newspaper … of general and regular circulation"; 472 U.S. 181 read "regular" as "no indication that they have been timed to specific market activity"; "factual information about past transactions" protected; communications "entirely impersonal" | CONFIRMED | https://www.law.cornell.edu/uscode/text/15/80b-2; https://www.law.cornell.edu/supremecourt/text/472/181 | All verbatim. The full phrase continues "…or to events affecting or having the ability to affect the securities industry". The Court also read "bona fide" as "genuine" and stressed publications "advertised and sold in an open market". Lowe's conditions describe the **publication**. Extending them to the founder's marketing posts, as CO C13 and X10 do, is HYPOTHESIS, as labelled. |
| 16 | CO C14 (p1) | Securities Act 17(b) bars describing a security "for a consideration received … from an issuer, underwriter, or dealer" without disclosing the consideration and amount | CONFIRMED | https://www.law.cornell.edu/uscode/text/15/77q | Verbatim. |
| 17 | CO C15 (p1) | FINRA 2210: retail communication = more than 25 retail investors within 30 days; posts on an "online interactive electronic forum" are exempt from principal approval and filing but not content standards; may not "predict or project performance, imply that past performance will recur"; testimonials must disclose they "may not be representative" and are "no guarantee of future performance" | CONFIRMED | https://www.finra.org/rules-guidance/rulebooks/finra-rules/2210 | All verbatim: (a)(5), (b)(1)(D)(ii), (c)(7)(M), (d)(1)(F), (d)(6)(A). Scope note: (d)(6) covers testimonials "concerning the investment advice or investment performance of a member or its products". A rep's own card is a retail-communication question for the firm, not a (d)(6) testimonial about the firm. CO's hypothesis wording is otherwise fine. |
| 18 | CO C16 (p1); DV C8 (p1) | SEC marketing rule: bars presenting results "in a manner that is not fair and balanced"; extracted performance only if the ad "provides, or offers to provide promptly, the performance results of the total portfolio"; 1/5/10-year periods "with equal prominence" | CONFIRMED | https://www.law.cornell.edu/cfr/text/17/275.206(4)-1 | Verbatim: (a)(6), (d)(5) and (d)(2). The 1/5/10-year rule applies to a portfolio or composite **other than a private fund**, and "advertisement" is the adviser's own communication. DV's "design analogy only" caveat is correct. |
| 19 | CO C20 (p1); PT Part 3 | ROSCA, 15 U.S.C. 8403: disclose all material terms "before obtaining the consumer's billing information"; "express informed consent" before charging; "simple mechanisms" to stop recurring charges | CONFIRMED | https://www.law.cornell.edu/uscode/text/15/8403 | Verbatim. "Negative option feature" is defined by reference to the Telemarketing Sales Rule (16 CFR 310). |
| 20 | CO C21 (p1); PT Part 3 | Negative Option Rule recodified on 12 Feb 2026 to its pre-2024 text (91 FR 6509), covering prenotification plans only; ANPRM on 13 Mar 2026; no NPRM since; PT: comments closed April 2026 | CONFIRMED | https://www.federalregister.gov/api/v1/documents/2026-02866.json; FR API search of FTC "negative option" documents since 2025-06-01 | Final rule effective 2026-02-12, "in light of Federal court decisions". The document starts at 91 FR **6507** (LII's part-425 source note says 6509; both are right). ANPRM: 91 FR 12318, published 2026-03-13, titled "Rule Concerning the Use of Prenotification Negative Option Plans", comments closed **2026-04-13**. No NPRM or final rule had appeared in the Federal Register by 1 Nov 2026 (there was a Dec 2025 petition for rulemaking and an Aug 2026 regulatory agenda). I did not open the vacating court's opinion. The ftc.gov rule page was not reachable by my tools. |
| 21 | CO C22 (p1) | California ARL (amended, effective 1 Jul 2025): renewal notice **15-45 days** before renewal for initial terms of a year or more; fee-change notice **7-30 days** before | CONFIRMED (secondary-official) | https://sjud.senate.ca.gov/media/1470 (Senate Judiciary analysis of AB 2863, version of 17 Jun 2024) | The analysis states existing §17602(b) (15-45 days for initial terms ≥1 year) and the bill's fee-change notice ("no more than 30 days", lower bound seven days). The statute page on leginfo returned 403 to me as well. Also relevant to PT's trial arm: a free trial or promotional price **lasting more than 31 days** needs a notice 3-21 days before it ends. |
| 22 | CO C22/C23 (p1) | California requires "an annual reminder for **every** auto-renewal plan", so F-3 has a gap for monthly plans | UNVERIFIED (disputed scope) | https://apcp.assembly.ca.gov/media/795 (Assembly analysis, 21 Mar 2024 version); Senate analysis (row 21) | The March 2024 bill required a reminder for any automatic renewal agreement. The **June 2024 version** as described by Senate Judiciary requires it "under an **annual** automatic renewal agreement" and "under annual contracts". I could not open the chaptered text, and secondary summaries disagree. Under the later reading, monthly plans may need no annual reminder. The cheap fix (send one anyway: a billing-event email with no record fields, allowed by F3b) is safe either way. Call it "prudent", not "required", until §17602(h) is read. |
| 23 | CO C24 (p1); PT Part 3 | 16 CFR 238.1: no ad "when the offer is not a bona fide effort to sell"; 238.0: bait is an "alluring but insincere offer". PT: "an insincere offer to get leads is bait advertising" | CONFIRMED (CO) / CORRECTED (PT) | https://www.law.cornell.edu/cfr/text/16/238.0 and /238.1 | CO quotes verbatim. 238.0 defines bait by its purpose: "to switch consumers from buying the advertised merchandise, in order to sell something else". A painted door with no switch to another product is not classic bait. Its real exposure is FTC Act §5 deception (implying something is purchasable when it isn't). PT's and CO's mitigation (label "coming soon" before the click, collect no payment details) addresses that, so the conclusion stands. |
| 24 | CO C24 (p1); PT; PW (p2) | 16 CFR 233.1: a former price is legitimate only if "the actual, bona fide price at which the article was offered to the public on a regular basis for a reasonably substantial period of time" | CONFIRMED | https://www.law.cornell.edu/cfr/text/16/233.1 | Verbatim. The PT/PW rule (a test-arm price never becomes a "was" price) follows. |
| 25 | CO C19 (p1); CO X1 (p2); RK C7 (p1) | Florida §501.1736: a covered platform meets **each** of four criteria: (1) upload or view content; (2) ≥10% of under-16 daily users average ≥2 h/day; (3) algorithms that analyze user data to select content; (4) **any** addictive feature: infinite scrolling, push notifications, reaction/share counts, auto-play, live-streaming. Penalty up to $50,000 per violation plus liability to the minor | CONFIRMED (with two corrections to the inference) | https://www.flsenate.gov/Laws/Statutes/2025/501.1736 | The criteria and penalties are verbatim: (1)(e)1-4, (5) $50,000, punitive damages for a pattern, and (6) liability "to the minor account holder". X1 is right that infinite scrolling alone meets criterion 4, so removing reaction counts changes nothing. **Corrections:** (i) Criterion 2 reads "ten percent or more of the daily active users who are younger than 16 years of age spend on average 2 hours per day", and "daily active users" means users active on ≥80% of days. The wording is ambiguous, so the threshold is less certain than "≥10% of DAU". (ii) Coverage imposes duties to bar under-14 accounts, require parental consent for 14-15, and terminate and delete. An 18+ service that terminates any minor account already meets most of that substance. Being covered matters mainly for the "treats or categorizes as likely younger than 14" duty and for how good the evidence is. So RK R12 / CO C19 overstate the consequence of losing the usage-criterion shield (HYPOTHESIS, Medium). |
| 26 | RK C7 (p1); RK S12 | An appeals court let the Florida law be enforced from Nov 2025 | CONFIRMED | Eleventh Circuit No. 25-11881, order of 25 Nov 2025, filed as N.D. Fla. No. 4:24-cv-00438 Doc. 136 (federal court docket PDF on a public court-records archive; URL withheld because the archive is a named service) | A 2-1 panel granted a **stay of the preliminary injunction** pending appeal, so enforcement may proceed. The order notes the injunction had covered "parties and nonparties alike". The merits appeal outcome after Nov 2025 was not verified. RK's "Medium" can rise to High for the stay itself. |
| 27 | CO C18 (p1); CO X9 (p2) | COPPA 312.2 "directed to children" factors include subject matter, visual content, animated characters, music, ages of models, "whether advertising promoting or appearing on the website … is directed to children", and audience evidence including "marketing or promotional materials or plans" | CONFIRMED | https://www.law.cornell.edu/cfr/text/16/312.2 | Verbatim (current text includes "presence of child celebrities"). Scope: "child" = **under 13**. For an 18+ product the factors are evidence-hygiene guidance, not a likely trigger. |
| 28 | RK C2 (p1); RK p2 | FINRA 9 Dec 2025 alert: scammers use "the names of real advisers with clean records"; FBI saw at least a 300% rise in ramp-and-dump complaints vs 2024 | CORRECTED (quote) | https://www.finra.org/investors/insights/investment-group-imposter-scams | Date and the 300% figure are confirmed: an FBI PSA of July 2025, "at least a 300 percent increase … as compared to 2024". The quoted phrase is a paraphrase. The text says scammers take "the name and other publicly available details about an actual registered investment professional with a spotless disciplinary history". Remove the quotation marks or use the real wording. DT's deepfake point is confirmed. |
| 29 | CO C17 (p1); CV C4 (p1) | FINRA 29 Apr 2026: members "who appear to be successful investors sharing screenshots … might actually be accomplices"; CV adds that "unusually steady or high returns are a red flag" | CONFIRMED / CORRECTED (CV paraphrase) | https://www.finra.org/investors/insights/be-alert-signs-imposter-investment-scams | The quote and date are verbatim. The page warns of "unrealistic rates of return". I found no "steady" wording, so CV should say "unrealistic returns". |
| 30 | CO C17 (p1); CV (p1) | SEC investor alert "Group Chats as a Gateway to Investment Scams", 22 Dec 2025: members posted "screenshots … of purportedly successful trades" | UNVERIFIED | investor.gov page returned 403 (curl and fetch) | The search index shows the title, the date 22 Dec 2025, and the "purportedly successful trades" wording. CO marks it opened, CV marks it 403. Keep it at Medium until it is re-opened. |
| 31 | CV C4 (p1) | SEC press release 2025-144, 22 Dec 2025: fake trading platforms and investment clubs, $14 million taken | CONFIRMED | https://www.sec.gov/newsroom/press-releases/2025-144-sec-charges-three-purported-crypto-asset-trading-platforms-four-investment-clubs-scheme-targeted | "misappropriated $14 million from retail investors". |
| 32 | RK C2 (p1) | SEC 2026-95, 29 Sep 2026: "investment club" chat schemes took ≥$15M with fictitious profits and a falsified regulatory filing shown as proof | CORRECTED (minor) | sec.gov release 2026-95 (URL withheld: the path names a messaging app); title and date also confirmed in the sec.gov press-release RSS | Date, "at least $15 Million" ($12.5M + $2.8M), "the reflected profits were fictitious" and "a falsified Form D" are all confirmed. The release calls them "investment confidence scams", not "investment clubs" (that label is 2025-144's). |
| 33 | CO C14 (p1) | SEC investor alert of 6 Feb 2026, "Social Media and Stock Tip Scams", names scalping and touting | UNVERIFIED | investor.gov returned 403 | The search index shows the title, the date 6 Feb 2026, and definitions of scalping and touting. It is consistent with CO but was not opened by me. |

**Totals:** 33 rows. 22 CONFIRMED (3 of them with scope notes), 1 CONFIRMED/CORRECTED split, 6 CORRECTED (one also part of a split row), 4 UNVERIFIED, 0 WRONG.

#### B. POLICY F3b: is "the founder may not post traders' cards" a fair reading?

**The clause** (docs/POLICY.md F3b, scope sentence amended by the owner 2026-11-01): *"…analysis is never pushed (no notifications, emails or feed items announcing trades as they happen): records are looked up, not broadcast. … Scope (amended by the owner 2026-11-01): the bar covers any message, in any channel, whose content or timing comes from traders' records, entries, positions, closes, theses, follows, likes or price moves. Sign-in links, receipts, and renewal, price-change and payment notices that carry no handle, symbol, return or record field, sent only on account or billing events, are allowed."*

- **Broad (literal) reading (CO C12, X4):**
  - "Any message, in any channel" plus "content … comes from traders' records" covers a founder's social post of a trader's card on its face.
  - "Not broadcast" describes exactly what a post to followers does.
  - The exceptions are a closed list of account and billing notices, and they name no social posts.
  - On this reading the founder's own card is also barred, because its content comes from a record.
  - The bar falls on the founder's conduct, not the trader's. A trader sharing their own card is not "our" message.
- **Narrow (purposive) reading (CO X10):**
  - The clause's stated mischief is *pushed* analysis, "announcing trades as they happen".
  - Every listed exception is a product-to-user message. That suggests "message … channel" means channels through which the product reaches its users: email, notification, SMS, in-app.
  - Elsewhere POLICY contemplates public share cards (F3: "every screen and share card"), and F-4 builds the card to be posted.
  - A scheduled, non-event-timed public post is closer to publication (pull) than to a push.
- **Observation for the owner (no verdict):**
  - BRIEF.md paraphrases F3b narrowly ("no notifications/emails whose content or timing comes from records"), while POLICY's text says "any message, in any channel". The council has been working under two wordings.
  - Under either reading, the "content or **timing**" limb independently bars posts timed to closes or price moves. That matches the "not timed to specific market activity" language in 472 U.S. 181 (row 15).
  - Only the owner can settle the reading, by ruling or by amending POLICY.

#### C. Corrections that change conclusions

1. **California annual reminder (row 22).** "F-3 has a legal gap for monthly plans" is not established. The best official evidence I could open (the Senate Judiciary analysis of the June 2024 version) limits the annual reminder to *annual* agreements. Keep the recommendation as a low-cost precaution, but reword it from "required" to "prudent pending §17602(h) text". Before live charges, the owner should get the chaptered text read.
2. **Florida §501.1736 (row 25).** The coverage analysis holds (infinite scrolling alone meets criterion 4; removing reaction counts is no lever). But the *consequence* of coverage is mostly duties an 18+ product already meets (the statute's minor-account duties: barring, consent and deletion). RK R12 and CO C19 should lower the stakes: the residual risk is evidence quality for likely minors, not a redesign. The 18+ gate and delete-on-report log remain the test. The stay is confirmed (Nov 2025).
3. **Insider reviews (row 9).** §465.2(c) is miscited. Under §465.5(c), asking relatives or staff for reviews is unlawful only without disclosure instructions or remediation. CO's "never ask friends or family" is policy, not law. The checklist item can say "if anyone close to the founder posts, they disclose; the founder instructs them to".
4. **Bait advertising (row 23).** The painted door is a §5 deception question, not classic bait-and-switch. The mitigations are unchanged, but PT should stop calling it "bait advertising".
5. **CAN-SPAM exposure (row 11).** $53,088 is the current per-email maximum (confirmed in eCFR as of 29 Oct 2026). CO C27's $8.5M is a ceiling that applies only if outreach uses email. Adopt CT's conditional framing. The 10-business-day, postal-address and PO-box points are all confirmed.
6. **Quote hygiene (rows 5, 28, 29, 32).** Four quoted phrases are paraphrases. Fix them before any line reaches channel copy or a press pitch, because these lines are what the "regulator angle" (CV C4) would quote publicly.
7. **No change:** 255.2/255.5 (including early access, and featured placement as a connection), 465.5/465.8, ROSCA, the negative-option status (recodified 12 Feb 2026; ANPRM 13 Mar 2026, comments closed 13 Apr 2026; no NPRM by 1 Nov 2026), FINRA 2210, the marketing rule's extracted-performance and total-portfolio provision, Lowe's "not timed to specific market activity", 17(b), COPPA factors, SEC 2025-144.

#### Sources (all opened 2026-11-01 unless marked)
- [F1] 16 CFR 255.0, 255.1, 255.2, 255.5 via LII: https://www.law.cornell.edu/cfr/text/16/255.0 (and .1, .2, .5). Opened: yes.
- [F2] FTC staff, Endorsement Guides FAQ: https://www.ftc.gov/business-guidance/resources/ftcs-endorsement-guides. Opened: yes (first ~100k characters).
- [F3] 16 CFR 465.2, 465.4, 465.5, 465.7, 465.8 via LII: https://www.law.cornell.edu/cfr/text/16/465.5 (same path for the others). Opened: yes.
- [F4] Federal Register API, Consumer Reviews and Testimonials rule, 89 FR 68034 (effective 2024-10-21); Negative Option recodification 2026-02866 (91 FR 6507); ANPRM 2026-04952 (91 FR 12318): https://www.federalregister.gov/api/v1/documents/2026-02866.json and https://www.federalregister.gov/api/v1/documents/2026-04952.json. Opened: yes.
- [F5] FTC CAN-SPAM guide: https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business. Opened: yes. 15 U.S.C. 7704: https://www.law.cornell.edu/uscode/text/15/7704. Opened: yes. 16 CFR 316.2, 316.3 via LII. Opened: yes. 16 CFR 1.98 via the eCFR versioner API (as of 2026-10-29). Opened: yes.
- [F6] 47 CFR 64.1200 via LII: https://www.law.cornell.edu/cfr/text/47/64.1200. Opened: yes.
- [F7] 15 U.S.C. 80b-2: https://www.law.cornell.edu/uscode/text/15/80b-2. 472 U.S. 181 (1985): https://www.law.cornell.edu/supremecourt/text/472/181. 15 U.S.C. 77q: https://www.law.cornell.edu/uscode/text/15/77q. Opened: yes.
- [F8] FINRA Rule 2210: https://www.finra.org/rules-guidance/rulebooks/finra-rules/2210. Opened: yes.
- [F9] 17 CFR 275.206(4)-1 via LII: https://www.law.cornell.edu/cfr/text/17/275.206(4)-1. Opened: yes.
- [F10] 15 U.S.C. 8403: https://www.law.cornell.edu/uscode/text/15/8403. 16 CFR part 425 via LII. Opened: yes.
- [F11] California Assembly Privacy Committee analysis of AB 2863 (21 Mar 2024 version): https://apcp.assembly.ca.gov/media/795. Senate Judiciary analysis (17 Jun 2024 version): https://sjud.senate.ca.gov/media/1470. Opened: yes (PDF text). Cal. Bus. & Prof. Code §17602 on leginfo.legislature.ca.gov: opened: no (403). A law-firm alert on the enacted bill (URL withheld, T1): opened: yes; it is silent on term length.
- [F12] 16 CFR 238.0, 238.1, 233.1, 312.2 via LII. Opened: yes.
- [F13] Florida Statutes §501.1736 (2025): https://www.flsenate.gov/Laws/Statutes/2025/501.1736. Opened: yes.
- [F14] Eleventh Circuit No. 25-11881, stay order of 25 Nov 2025 (filed as N.D. Fla. 4:24-cv-00438 Doc. 136), PDF on a public court-records archive (URL withheld, named service). Opened: yes (pp. 1-3).
- [F15] FINRA investor alerts, 9 Dec 2025 and 29 Apr 2026: https://www.finra.org/investors/insights/investment-group-imposter-scams and https://www.finra.org/investors/insights/be-alert-signs-imposter-investment-scams. Opened: yes.
- [F16] SEC press release 2025-144 (22 Dec 2025): sec.gov URL as in row 31. Opened: yes. SEC press release 2026-95 (29 Sep 2026): URL withheld (T1). Opened: yes, with title and date also in https://www.sec.gov/news/pressreleases.rss.
- [F17] SEC/investor.gov alerts of 22 Dec 2025 (group chats) and 6 Feb 2026 (social media stock tips). Opened: no (403); search-index snippets only.

#### Open questions
1. Owner: read the chaptered §17602(h) (row 22) before real charges. Does the annual reminder reach monthly plans?
2. Owner: which F3b reading applies (Section B)? Align BRIEF.md's paraphrase with POLICY's text either way.
3. Re-open the two investor.gov alerts (rows 30, 33) from a client that gets past the 403 before quoting them in any public copy.
4. Check the Florida merits appeal (No. 25-11881) for any ruling after the Nov 2025 stay.

## C3. Market, vendor, arithmetic and code

### Cycle 2, pass 3: fact-check (market, vendor, pricing and statistics arithmetic, code claims)

**Member:** independent fact-checker. **Pass:** 3. **Date:** 2026-11-01. **Repo:** the repository at HEAD 0d42f65, read-only.
**Method:** I recomputed every number in one script (a local calculation script, not committed) using exact binomial sums, score intervals
and the NIST normal-approximation sample-size formulas (z 1.960 / 1.645 / 0.8416). I opened two integrated-vendor pricing pages this
session. I checked the vendor SDK by downloading the exact locked tarball, snaptrade-typescript-sdk 13.1.11 from package-lock.json,
into a separate scratch folder and grepping its type file without running it. `node_modules` is absent from the repo.
**Labels:** each verdict is a FACT (the source was opened) or an ESTIMATE (my own arithmetic). Nothing here recommends any security or trade.

#### Verdict table

| id | File(s) | Claim | Verdict | Evidence | Note |
|---|---|---|---|---|---|
| F1 | p1-pricing-wtp C1 | Net per $9.99 monthly charge = $9.28; blended 65/35 with $99.99/yr = $8.82 | CONFIRMED | 9.99×0.959−0.30 = 9.2804. Annual: 99.99×0.959−0.30 = 95.59, ÷12 = 7.966. Blend: 0.65×9.280 + 0.35×7.966 = 8.820 | Fees exclude international cards (+1.5%), currency conversion (+1%) and the $15 dispute fee [S1]. |
| F2 | p1-pricing-wtp C1 | Fee share is 10.1% / 7.9% / 7.1% / 6.1% at $4.99 / $7.99 / $9.99 / $14.99 | CONFIRMED | 1 − net/P = 10.11%, 7.85%, 7.10%, 6.10% | |
| F3 | p1-pricing-wtp C2; p2-pricing-tests X1; p2-pricing-wtp X1 | $7.99/$79.99 needs 1.26× the conversion | CONFIRMED | Blend $7.014. 8.820 ÷ 7.014 = 1.257. Monthly only: 9.280 ÷ 7.362 = 1.261 | PT's original 1.28× (linear fit) is correctly withdrawn in PT pass 2. |
| F4 | p1-pricing-wtp C2 | $4.99/$49.99 needs 2.05× | CONFIRMED | Blend $4.305. 8.820 ÷ 4.305 = 2.049 | Cycle 1's $4.03 is the $4.99/**$39.99** pair (recomputed $4.025, needing 2.19×). Name the annual price whenever $4.99 is quoted. |
| F5 | p2-pricing-tests X1; p2-pricing-wtp X1 | $12.99/$129.99 wins unless conversion falls more than 23.5% | CONFIRMED | Blend $11.529. 1 − 8.820/11.529 = 23.50%. Monthly only: 23.66% | PT C9's 24.5% is superseded. |
| F6 | p1-pricing-wtp C2 | $14.99/$149.99 wins unless conversion falls more than 34% | CONFIRMED | Blend $13.336. 1 − 8.820/13.336 = 33.9% | |
| F7 | p1-pricing-wtp C2 | Break-even conversion 0.10% / 0.27% / 1.18% at trader share 0.46% / 2% / 10% | CONFIRMED (arithmetic) | (0.0046+0.004)/8.820 = 0.0975%; (0.02+0.004)/8.820 = 0.272%; (0.10+0.004)/8.820 = 1.179% | The $1 term assumes the vendor's **Daily** tier. See F27. |
| F8 | p1-demand-traders; p1-measurement G2 | P(≥30/50 \| p=0.6) = 56% | CONFIRMED | Exact binomial 0.5610 | |
| F9 | p1-measurement G2 table | Continue / inconclusive (26-29) / stop (≤25) split at true 45/50/55/60/65% | CONFIRMED | 45%: 2.35 / 17.31 / 80.34. 50%: 10.13 / 34.25 / 55.61. 55%: 28.62 / 42.99 / 28.40. 60%: 56.10 / 34.12 / 9.78. 65%: 81.39 / 16.54 / 2.07 | Matches to 0.1 point. The n=100 extension also checks: P(≥60) = 54.3%, P(≤50) = 2.7%. |
| F10 | p1-measurement G2 | score-interval CIs: 30/50 = 46-72%, 26/50 = 39-65%, 30/200 = 10.7-20.6%, 30/1,000 = 2.1-4.3% | CONFIRMED | 46.2-72.4; 38.5-65.2; 10.7-20.6; 2.11-4.25 | |
| F11 | p1-measurement G4 table | P(stop, ≤21/200) at true D7 of 10/12/15/18% = 55.9 / 22.7 / 2.5 / 0.1% | **CORRECTED** | Those figures are P(**≤20**/200): 55.9 / 22.7 / 2.6 / 0.1. With the file's own band (inconclusive 22-29, so stop is ≤21), P(≤21) = **64.8 / 30.0 / 4.2 / 0.2%** | Either relabel the column ≤20 or use the ≤21 numbers. A true 15% then stops 4.2% of the time, not 2.5%. The continue column (≥30) is correct: 1.6 / 11.8 / 53.0 / 88.6. |
| F12 | p1-pricing-tests C1; p2-measurement X11 | 3% vs 5% needs 1,506 per arm (and 1% vs 2% needs 2,318) | CONFIRMED | Two-sided two-sample: 1,505.8 and 2,318.2 | |
| F13 | p2-pricing-tests X2 | 1.5% vs 3%, two arms: about 1,533 per arm two-sided (1,208 one-sided) | CONFIRMED | 1,533.3 and 1,207.7 | |
| F14 | p2-pricing-tests X2 | One-sample, one-sided, 3% against a fixed 1.5%: n = 525 (648 two-sided); MEAS's 652 is the two-sided figure | CONFIRMED | 524.4 and 647.9 | MEAS pass 2, revision 8, calls 652 "one-sided". That is wrong: 652 is the two-sided figure (≈648). PT's reading stands. |
| F15 | p1-measurement G4 | D7 15% vs 10% needs n ≈ 282; 15% vs 12% needs ≈ 824 | CONFIRMED with note | One-sided one-sample, with the null variance at 15% and the alternative at 10%: 282.1. 15% vs 12%: 823.4. With the roles swapped (null 10%): 252 and 775 | State the convention. Either figure keeps G4 at "inconclusive by sample" for 20-500 signed-in viewers. |
| F16 | p1-measurement G2 | Separating 60% from 45% needs ≈67 traders; 60% vs 50% needs ≈151 | CONFIRMED | The formula as written gives 66.7. With the null variance at 45%: 67.3. 60% vs 50%: 152.5 (≈151-153) | |
| F17 | p2-measurement X1 | A 5-point share effect needs ≈1,505 traders per arm; 8 points needs 588 | CONFIRMED | 7.84×0.48/0.05² = 1,505.3; /0.08² = 588. Exact two-sample: 60→65% = 1,471, 60→55% = 1,533 | |
| F18 | p1-pricing-tests C8 (task said "32,000-43,000") | ±20% revenue per visitor needs 32,460-38,086 per arm; 30-80 weeks at 1,000-2,500 uniques a week | **CORRECTED** | Recomputed per-arm n: 36,594 (+23.5%), 38,086 (+20%), 32,461 (−22%). The range is **32,000-38,000**, not up to 43,000. Weeks for two arms at 2,500 / 1,000 uniques a week: 26-76 | Rounding only. The conclusion (no price test in weeks 1-8) holds. Var at $12.99 / 0.95% is 1.588, not 1.63; MEAS X11 is right about that. |
| F19 | p1-pricing-tests C10 | Test-and-roll n* = 640-950 at N=8,000 and 2,860-5,220 at N=100,000 | CONFIRMED | n* = √(N/4·k + (0.75k)²) − 0.75k, with k = (s/σ)², s = √(.01·.99) and σ = 25-50% of mean RPV: 641/952; 1,141/1,867; 1,715/2,965; 2,863/5,216 | The formula is quoted from the cited paper, which I did not reopen. |
| F20 | p2-pricing-wtp X8; p1-pricing-wtp C7 | Lifetime net ≈$68 per monthly payer and ≈$171 per annual payer; ≈$104 blended at 35% annual | CONFIRMED (arithmetic) | Monthly churn 1 − 0.17^(1/12) = 13.7%, life 7.3 months × $9.28 = $67.7. Annual life 1/(1−0.441) = 1.79 years × $95.59 = $171. Blend 0.65×68 + 0.35×171 = $104 | The retention inputs come from cycle 1 benchmarks. Not re-verified. |
| F21 | p2-channels-traders | Week-8 connected traders ≈51 (14-110), down from 54 (16-110); DT pass 2 says ≈44 | CONFIRMED (arithmetic) | 280×.18×.30 = 15.1; 120×.25×.34 = 10.2; other channels 35; total 60 × 0.85 = 51. Low 17×.85 = 14.5. High 129×.85 = 109.7 | The council range for the central estimate is 44-54, and the full range 14-110. All inputs are assumptions (Low). |
| F22 | p2-channels-viewers | Weekly external profile views at week 8: ~100 / ~1,150 / ~4,300; shortfall ~50× / ~4.3× / ~1.2× | CONFIRMED (arithmetic) | 90+10, 1,000+150, 3,700+600. 5,000 ÷ each = 50, 4.35, 1.16 | Low case: 10/80 = 12.5% reach a profile, below the stated 15-40% band (would be 12, not 10; immaterial). "≈18 views per trader" fits 1,000/54, not 1,000/51 (19.6). |
| F23 | p1-risks C1 | Split examples: a 2:1 split shows −45% Verified; a 1:10 reverse split shows +800% | CONFIRMED | (55−100)/100 = −45%. (9−1)/1 = +800%. `lib/trades.ts:57-69` matches FIFO by units and increments `excluded` once per sell with leftover units. In the reverse case 90 units stay in the open lot | "The other 10 units are counted as excluded": the counter is per **sell**, not per unit. |
| F24 | p1-pricing-wtp C1, [S1] | Card pricing 2.9% + $0.30; Billing 0.7%; Tax 0.5% | CONFIRMED (FACT) | Stripe pricing page [S1]: "2.9% + 30¢" domestic cards; +1.5% international; +1% conversion; Billing "0.7%" pay-as-you-go; Tax no-code "0.5%"; dispute $15 | Refunds: "no fees for issuing refunds" on card methods. The page does not say whether the original fee is returned, so WTP's open question (≈$0.59 per refund) remains open. |
| F25 | p1-risks C6 [S11] | Vendor Build plan: $0, up to 5 connections, "personal and testing use only" | **CORRECTED** (wording) | SnapTrade pricing page [S2] (dateModified 2026-09-23): Build is "For developing and testing your integration", "Up to 5 brokerage connections", real-time data | The meaning is unchanged (not a production plan). Quote the current wording. |
| F26 | p1-channels-traders C7; p1-risks C6 | Vendor cost: $1 per connected user a month plus a $100/month platform fee; manual sync $0.05 | CONFIRMED, with a qualifier | [S2]: Launch is $100/month plus $1 per app-managed user a month on **Daily** (read-only), or **$2** on Real-time. Manual sync is $0.05 "per connection per sync". "Personal/OAuth users" are currently at an introductory $0 connected-user price | The $1 figure holds only on the Daily tier. |
| F27 | cycle-1 break-even formula used in p1-pricing-wtp | trader_share × $1 is the vendor cost term | CONFIRMED for Daily; **sensitivity needed** | [S2] as F26 | If the product needs fresher than daily data, the term becomes $2 (Real-time). Break-even then rises to 0.15% / 0.50% / 2.31% at 0.46% / 2% / 10% trader share. An hourly manual sync on Daily would cost 720 × $0.05 = $36 per connection a month and must never be used. Code check: there are no manual-refresh calls in `lib/broker.ts` or `lib/sync.ts`, and `vercel.json` defines no cron at HEAD. |
| F28 | p1-measurement; cycle-1 #3; brief | No page-view or referrer capture exists | CONFIRMED | `funnel_events.name` CHECK (`db/schema.sql:252-253`) lists sign-up steps only. There is no views table among the tables in `db/schema.sql`. No middleware or proxy file exists. The only `headers()` reads are user-agent and session (`app/login/page.tsx:24`, `lib/session.ts`). No code reads the Referer header | |
| F29 | p1-measurement; p2-measurement X3/X4 | The `referred_via` CHECK allows two values | CONFIRMED | `db/schema.sql:54`: `check (referred_via in ('profile','trade'))`. `referred_surface` has no CHECK (`:55-56`); its allow-list is `REFERRED_SURFACES = ['profile','trade','month']` at `lib/referral.ts:12` | The schema comment at `:55` lists "badge", but the code does not accept it, so the comment and the code disagree. |
| F30 | p1-measurement C2; p2-measurement X3 | `normalizeVia` drops `via=nav` | CONFIRMED | `app/nav-login.tsx:9` builds `/login?ref=<h>&via=nav`. `lib/referral.ts:14-18` accepts only profile/trade/month. `app/login/page.tsx:20` and `app/auth/actions.ts:30` pass the value through `normalizeVia`, which returns null | `ref` survives, so the referrer id is kept. Only the surface is lost. The comment at nav-login.tsx:5-6 claims attribution that does not happen. |
| F31 | p1-demand-traders (C30 mislabel); p1-measurement | The main share button writes `share_image_saved_at` | CONFIRMED | `app/u/[handle]/share-card.tsx:15-16`: "Share my record" calls `onShared={() => best(markShareImageSaved())}`. `app/actions.ts:55-59` is commented "Story-image adoption: first click on a Save link" and sets it once (`is null`) | The column measures profile shares from the share card, not image saves. The prompt path (`share-prompt.tsx:49-50`) writes `share_prompt_action` instead. |
| F32 | p1-measurement ("stop overwriting") | `trade_shared_at` is overwritten | CONFIRMED | `app/actions.ts:89-92`: `update users set trade_shared_at = now()` with no `is null` guard. It is called only from `trade-share.tsx:10` when `isOwner` | The column holds the last share, so a first-share date cannot be derived. |
| F33 | p1-measurement; creative C30 | The month-recap share is unrecorded | CONFIRMED | `share-card.tsx:18-19`: the recap `ShareButton` has no `onShared`. `app/u/[handle]/month/[ym]/page.tsx:102` passes `isOwner={false}` to `TradeShare`, so `recordTradeShared` never fires there | Both recap share paths are invisible to the share gate. |
| F34 | p1-channels-viewers / measurement | The sitemap lists ticker pages only | **CORRECTED** (minor) | `lib/ticker.ts:279` returns `/`, `/t` and `/t/<symbol>` entries (from `app/sitemap.ts`) | Profiles (`/u/<handle>`), trade pages and month pages are absent. The conclusion (no profile discovery through search via the sitemap) holds. |
| F35 | p1-risks C1 | `lib/broker.ts` requests only BUY,SELL, so splits are dropped | CONFIRMED | `lib/broker.ts:96` and `:160` pass `type: 'BUY,SELL'`; `toActivities` at `:141` skips any other type | The same filter also drops `REI` (dividend reinvestment), `STOCK_DIVIDEND`, `TRANSFER` and `EXTERNAL_ASSET_TRANSFER_IN`. Reinvested or transferred-in shares later sold become excluded sells, or, when they mix with bought lots, FIFO-misdated entries. This widens risk R1 beyond splits. |
| F36 | p1-risks C1 | `matchTrades` has no split adjustment | CONFIRMED | `lib/trades.ts:36-80`: FIFO by `accountId|symbol`, units and price only. A grep of trades/sync/broker for split, corporate and ratio finds no hits | |
| F37 | p1-risks C1 | The vendor SDK has a SPLIT activity type | CONFIRMED (FACT) | snaptrade-typescript-sdk 13.1.11 (locked version) `dist/index.d.ts:4021` and `:8846`: "`SPLIT` - A stock share split." The type filter parameter accepts it | The data to fix F3c exists upstream. Whether the vendor also restates prior BUY units in split-adjusted terms is still unverified. |

#### POLICY T1/T2 flags (FACT, High)

- **p1-pricing-tests Sources [S4]-[S8], [S17], [S18] name paper authors.** That breaks T2/T4. MEAS X12 and WTP X5 already flagged it, but the file is not yet fixed. Cite by title, venue, year and DOI or arXiv id only.
- **p1-pricing-tests C4 and Part 4 use two eponymous method names**: a price-sensitivity meter named after its originator, and a direct price-response ladder named after two researchers. Both are real people's surnames. Rename them generically: "four-question price-sensitivity meter" and "direct 'would you buy at $X' ladder".
- **p1-measurement [S5]** cites a link-preview metadata protocol's own site. The protocol originated at a large social network, and its name doubles as a product term. Low risk; describing it as "the link-preview metadata protocol (og: tags)" is safer.
- Repository-hosted academic URLs (ideas.repec, econpapers, an aeaweb conference page, a university eprints server) carry no brand. The investor-foundation PDF URLs belong to a regulator's foundation. No other company, product or person names were found in the p1/p2 files, beyond integrated vendors and government bodies.

#### Corrections that change conclusions

1. **F27, vendor tier sensitivity (new).** The $1-per-trader cost holds only on the vendor's Daily, read-only tier. Real-time is $2, and manual syncs are $0.05 each. The break-even conversion should carry a $2 row: 0.15% / 0.50% / 2.31%. Sync design must not trigger manual refreshes. Cycle 1's hourly-sync concern now has a price attached: an hourly manual refresh would cost $36 per connection a month.
2. **F35, broader import gap (new).** The BUY,SELL filter drops dividend reinvestments, stock dividends and transfers-in as well as splits. The F3c exposure ("never shown with a wrong return") is therefore wider than splits. The SDK exposes SPLIT, REI and TRANSFER types (F37), so the fix starts in `lib/broker.ts`, not with the vendor.
3. **F11, G4 stop probabilities.** P(stop | true D7 15%) is 4.2%, not 2.5%, under the file's own bands. Stop errors at a true 12% rise to 30%. The direction stays the same: G4 remains inconclusive at the sample sizes expected.
4. **F14, one-sided vs two-sided.** 652 is two-sided. MEAS's pass-2 relabel as "one-sided" is wrong, and the one-sided one-sample figure is 525.
5. Minor corrections that do not change conclusions: F18 (RPV range 32-38k per arm, 26-76 weeks), F25 (vendor wording), F34 (sitemap also lists `/` and `/t`), F22 (low-case reach arithmetic), F29 (schema comment lists "badge", which the code does not accept), F30 (nav comment claims attribution that does not happen).

#### Sources

- [S1] Stripe public pricing page (integrated vendor), US, https://stripe.com/pricing. Opened: yes, 2026-11-01.
- [S2] SnapTrade public pricing page (integrated vendor), https://snaptrade.com/pricing, dateModified 2026-09-23. Opened: yes, 2026-11-01 (rendered and raw HTML).
- [S3] snaptrade-typescript-sdk 13.1.11 package tarball (npm registry, the version locked in package-lock.json), `dist/index.d.ts`. Opened: yes (grep only, not executed).
- [S4] Repository files at HEAD 0d42f65: lib/broker.ts, lib/trades.ts, lib/referral.ts, lib/funnel.ts, lib/ticker.ts, app/actions.ts, app/nav-login.tsx, app/login/page.tsx, app/auth/actions.ts, app/sitemap.ts, app/u/[handle]/share-card.tsx, share-prompt.tsx, trade/[sellId]/trade-share.tsx, month/[ym]/page.tsx, db/schema.sql, vercel.json. Opened: yes.
- [S5] a national standards institute's engineering statistics e-handbook §7.2.4.2 (formula reference as cited by PT). Not reopened; formulas reproduced independently.

#### Open questions

- Does the vendor restate historical BUY units after a split, or only emit a SPLIT row? A test account or the vendor's written answer (cycle 1 G0) settles it.
- Which vendor tier does the product need? Daily is enough for closed trades. Open positions shown "updated" (D29) may push toward Real-time.
- Does an app-managed connection qualify for the introductory $0 "Personal/OAuth" price? This product registers users itself, so probably not (HYPOTHESIS, Low).

---

# Part D. Pass 2: cross-examinations

## D1. Demand, traders (DT)

### Cycle 2, pass 2: demand analyst (supply side), cross-examination

**Member:** demand-validation analyst, supply side. **Pass:** 2. **Date:** 2026-11-01.
**Targets:** p1-channels-traders.md (CH) and p1-risks.md (RK). **Re-opened this pass:** the vendor's pricing page and the
FTC CAN-SPAM guide. My pass-1 sources are cited as [P1-Sn]. The labels and POLICY rules are the same as in pass 1.

#### Challenges

**X1. CH-C3, channel #1. The reply × connect rates are stacked assumptions, and the supply pool is assumed, not counted.**
HYPOTHESIS, Medium.
- **The rates.** CH's mid case is 18% reply × 35% connect = 6.3% of contacts connecting. That is above cycle 1's own 4%
  funnel, and both rates are unsourced. CH-C2 itself puts sourced cold-reply rates at 0.45-0.74%.
- **The pool.** Channel #1 needs about 280 adults who "already post their full results, losses included". My pass 1 found
  that this behaviour runs against the norm:
  - posters talk about gains and go quiet on losses [P1-S4];
  - being followed makes traders hold losers longer [P1-S1].
  The week-1 list holds only about 150 names.
- **Correction:** in week 1, count the qualifying pool before relying on #1. If fewer than 280 qualifying accounts are
  found, shift the hours to #4 (journal communities). Report mid-case connects for #1 with a pool cap of
  min(pool, 280) × 6%.

**X2. CH-C3, channels #2, #7, #8. Visit-to-connect rates of 8-12% are an order of magnitude above cycle 1's ratio of
traders to viewers.** ESTIMATE, Medium.
- Cycle 1 puts traders at 0.2-4.5% of viewers (c1 §3, §5). My pass-1 C32 estimate is 0.1-0.3% of profile views starting a
  connect.
- A forum reader who clicks through is more self-selected than a feed viewer, but connecting a live broker account and
  passing a whole-record preview (MRC #11) is a high bar.
- **Correction:** use a mid of 2-4% per visit (forum, newsletter) and 5% of meetup attendees. On that basis channels #2,
  #7 and #8 fall from 18 to about 5-8 mid connects, and the 8-week central total drops from about 54 to about 44.
- **Effect on G1 odds:** P(G1 ≥50) at week 8 then falls below a coin flip, to roughly 35-45% (ESTIMATE). That agrees with
  RK's R6 bandwidth warning.

**X3. CH-C1. The week-2 checkpoint can't tell 6% from 3%.** ESTIMATE, High (arithmetic).
- With 6 connects out of 100 contacts, the 95% score interval runs from about 2.8% to 12.5%.
- A "below 3 → re-pitch" rule triggers on noise. The chance of seeing ≤2 when the true rate is 6% is about 6%. That part
  is acceptable, but a pass at 6 does not rule out a true 3%.
- **Correction:** make the rule cumulative (weeks 2-3, n≥200), and stop only if the upper bound of the interval falls
  below 4%. I agree with CH that T5's "≥20% connect" is mislabelled. It should be measured per *reply*.

**X4. RK-R1. The cheapest supply test as designed breaks POLICY P6 and the vendor plan's purpose.** FACT (rules), High.
- RK proposes a whole-record preview for 30 recruited adults on the vendor's Build plan.
- **Vendor plan:** the pricing page describes Build as "for developing and testing your integration … before going live"
  (opened this pass). It caps the plan at 5 connections, so 30 people would have to cycle through it. Cycling real
  outsiders' brokerage accounts through a testing plan is not "testing" in any ordinary reading.
- **POLICY P6:** before *any* non-demo user connects, Terms, a Privacy Policy, recorded consent, deletion and a contact must
  be live. IDEAS #13 also puts all of this in week 0.
- **Correction:** move R1 to week 1 on the Launch plan, with the real preview (MRC #11) and the `preview_viewed` /
  `declined` + `decline_reason` metrics from my pass 1.
- **Pre-launch version:** an unconnected walkthrough is all that's allowed before then. It shows a Demo record with a
  losing open book and asks "would you publish this if it were yours?". It must be labelled SIMULATION, and its answers are
  stated intent only.

**X5. RK-R1 pass/fail. "No negative-record previewer publishes" needs a sample big enough to mean anything.** ESTIMATE, High.
- If about half of 30 previewers have negative records (n≈15), and the true publish rate among them is 10%, then
  P(0 of 15) = 21%. So a fifth of the time the test "fails" a viable segment.
- The recruits also come from transparency-led channels, which biases the result toward passing.
- **Correction:** report publish rates by sign with intervals, call the result qualitative below n=50 per sign (as my
  pass 1 did), and match recruits to the outreach mix.

**X6. RK-R6 versus CH-C2/C3. The two files contradict each other on reply rate.** HYPOTHESIS, Medium.
- RK-R6 fails the bandwidth sprint at a reply rate under 20%.
- CH's mid case is 18%, and its low is 10%. CH's own central plan would fail RK's test.
- **Correction:** align both files on reply rate as the key unknown. Set RK-R6's fail line at under 10%, which matches CH's
  low and its stop rule of 5%, and report the measured rate with an interval.

**X7. RK-C3 / R10. The disposition effect is sourced, but the size of the effect for this cohort is understated.** FACT
(High) via [P1-S1], [P1-S3].
- RK cites only the 1998 retail result. The social-trading study [P1-S1] shows the effect *grows* once a trader has
  followers. So the open book of a published record skews further toward losses than the retail baseline suggests.
- Under F-6, that lowers G2 even with no drawdown. My pass-1 estimate is −2 to −8 share points.
- **Correction:** add [P1-S1] to RK-C3. Make "share rate by `has_open_losses`" a standing diagnostic, not one used only if
  a drawdown happens.

**X8. RK-R7 tabletop. A test of 8 people can't measure 80%.** ESTIMATE, High.
- With n=8, one person moves the result 12.5 points, and the 95% interval at 7 of 8 is about 53-98%.
- **Correction:** call it qualitative, or use n≥50 for a ±11-point read. The missing alternative is one that serves
  traders directly:
  - a fixed line on every profile and card: "Stock Social never runs chat groups or messages you about trades";
  - an "impersonating this trader elsewhere" report category (RK open question 4).
- Both protect honest traders' credibility, and that is a supply benefit (my pass-1 C5, items 10 and 17).

**X9. RK-R4, wrong split returns. This is a supply-side barrier the risk file frames only as a brand risk.** HYPOTHESIS,
Medium.
- A trader who sees a false −45% on their own "Verified" record has a reason to disconnect and to warn peers in the very
  communities CH recruits from.
- **Correction:** add a trader-side indicator: record-dispute contacts ÷ connected traders, 0 unresolved after 7 days. Run
  R4 before channel #1 starts, as RK already orders.

**X10. CH-C5. The CAN-SPAM points check out, with one refinement.** FACT, High.
- The FTC guide confirms the law "covers all commercial messages", makes "no exception for business-to-business email",
  and sets up to $53,088 per email. CH is correct on all three.
- **Refinement:** the guide does not address one-to-one email by name. Covering it is a reading of "all commercial
  messages", so label that application HYPOTHESIS (High).

**X11. Missing alternative in CH: channel #3 (group chats) is where regulators locate the scams.** FACT (High) on venue
([P1-S8], [P1-S9], RK [S3]).
- Recruiting in chat servers puts the product's links into the same setting as impersonation (RK-C2).
- **Correction:** restrict #3 to admin-posted announcements in groups with public rules, never member DMs. Pair it with the
  never-runs-chats line from X8.

#### Revisions to my pass 1

1. **Item 3 (MRC #9).** Add a pool-count metric (qualifying transparency posters found in week 1 ≥280) and the X1 cap.
   Keep "plausible", with segment size flagged as the binding unknown.
2. **Item 6 (MRC #11).** State that the preview test cannot run before week 0 (P6, vendor plan). Before then only a
   labelled SIMULATION is allowed (X4).
3. **Item 9 (C32).** Keep 0.1-0.3% and flag it as the anchor that contradicts CH's 8-12%.
4. **Item 18 (F-6).** Add the market confound from RK-R10. Report share by `has_open_losses` and flag gates as confounded
   after a ≥10% drawdown.
5. **New row (rank ~9): split-adjusted P&L correctness (RK-R4)** as a supply barrier.
   - Metric: record-dispute contacts ÷ connected traders.
   - Effect: T −0-5 if one wrong record circulates.
   - Verdict: strong as barrier removal.
6. **Items 10 and 17 (handle integrity, report action).** Add the X8 line and report category. Raise item 17 from "weak" to
   "plausible", given the impersonation evidence in RK-C2.
7. **Synthesis C10.** Lower the central supply outlook. With X2's correction applied to CH, P(G1 ≥50) is about 35-45%, so
   share-rate items matter less than recruiting throughput.
8. **Wording.** Every per-item threshold stays directional at n=50, as in pass 1. I add score intervals for count-based
   checkpoints.

## D2. Demand, viewers (DV)

### Cycle 2, pass 2: demand validation, viewers: cross-examination

**Member:** demand-validation analyst (viewers). **Pass:** 2. **Date:** 2026-11-01.
**Targets:** p1-channels-viewers.md (prefix CV-) and p1-measurement.md (prefix ME-). Labels and POLICY rules as in pass 1. New
sources were opened this pass ([S15] [S16]); the rest are cited from my pass-1 file (p1-demand-viewers.md, prefix DV-).

#### Challenges

**X1. CV-C12 and ME-E1 count different things, so the "views" in the gate model are not the views the gate will read.**
- CV-C10 and C12 count *visits* (clicks that land).
- ME-E1 counts a view only when the page fires a beacon after 2 visible seconds and passes the bot check.
- CV's "first 1,000 viewers" divides views by an assumed 1.5 views per visitor. No source supports that figure (HYPOTHESIS presented as an input).

ESTIMATE: ME's beacon rule removes the quick bounces that CV counts as visits. CV's 350-3,000 is therefore an upper bound on ME's G3 at the same traffic. The direction is certain; the size is unknown.
*Correction:* CV restates its table in ME-E1 units (beaconed views) and drops the 1.5 factor. "First 1,000 viewers" is reported as a range of views until a cookie-free unique estimate exists (X3).

**X2. CV-C10 leaves out long-form video, the channel finfluencer followers use most.** Cycle 1 verified the figures [FC-R3, FC-R31]:
- Among finfluencer followers who use social media, 77% use long-form video and 40% use short video.
- 95% of adults 18-29 use long-form video, against 65% for short video.

CV's table has short video (row 2) and podcasts (row 10) but no long-form video row. Row 2's 0.3-1% bio-link rate also has no source.
*Correction:* add a long-form explainer row ("how to read a record", using Demo records and the F3 disclaimer). Its ESTIMATE should be shown with arithmetic, and the bio-link rate labelled ASSUMPTION.

**X3. Three incompatible designs for counting signed-out return. Two of them break the go-to-market "no cookie" decision.**

| Design | Storage used | Conflict |
|---|---|---|
| ME-E4 | A first-party cookie holding the first-visit date | Breaks "no cookie" (IDEAS, go-to-market decision 2026-11-01) |
| ME §5 | An arm-letter cookie for switchbacks | Breaks "no cookie" |
| CV-C1 | None ("no cookie") | Proposes no way to measure signed-out return at all |
| My DV-C12 | Device local storage | Not a cookie, but still storage on the device |

FACT: a cookie is sent with every request. Local storage is read only by the page's own script, which posts a coarse value in the beacon [ME-S2 covers headers only; the storage behaviour is a HYPOTHESIS, High].
*Correction:*
- Use one design: the date value in local storage, sent only inside the E1 beacon. That keeps "no cookie" literal and matches ME's privacy model.
- The legal committee rules once on whether any storage on the device needs consent (ME open question 3, my open question 1).

**X4. ME §5's day switchback is fragile at this traffic, and an alternative that needs no storage is missing.**
- ME assumes ICC 0.02 and a design effect of about 2. CV-C10/C12 expect most weekly traffic to come in 1-2 spikes (forum, press, one heavy-tail trader).
- One spike on an "A" day makes day the dominant variance. An ABBA run of 2-day blocks over 2 weeks gives about 3-4 clusters per arm (ESTIMATE). At t with about 3 degrees of freedom, the minimum detectable effect is far wider than ME's table shows.
- Missing alternative: **per-render randomisation for outcomes that finish within the same page view.** The server picks the arm on each render, and the beacon reports the arm plus the outcome. This needs no identifier and no storage, and spikes balance across arms automatically. It fits pane-open (D22, C25/P-6), exits and the first-visit line's effect on pane-open (D27), "What's this?" taps (D24) and CTA clicks (C32/P-7).
- Day or week switchbacks are needed only for D7. For D7, stratify the analysis by ref bucket and `via` so a spike does not land in one arm.

*Correction:* ME §5 makes per-render randomisation the default for within-page outcomes. Switchbacks stay for D7 only, with a minimum of 8 blocks per arm.

**X5. ME §6 files D24, D29 and D23 under "cannot measure, comprehension only". Behavioural proxies exist.**
- D24: "What's this?" opens per profile view (DV table row 2).
- D29: repeat views of the same handle within 7 days, from a counter per handle-day with no viewer id (DV row 4).
- D23: follow rate per profile view.

None of these proves comprehension, so T10 stays necessary. They do let the council see within weeks 2-6 whether viewers use the label or the freshness line.
*Correction:* move D24 and D29 into "measurable (descriptive)". Keep D23 under T10 first, for the reason in DV-C3: a confidence interval for the average may be read as the spread of single trades [S5 in DV].

**X6. ME-G4 open question 2 says day-7 and within-7-days definitions "differ by roughly 2×". No source supports the 2×.**
HYPOTHESIS. Rolling "within 7 days" is always ≥ day-7 by construction. The ratio is unmeasured for link-driven web visitors, and cycle 1 already called the app D7 benchmarks unfit [FC-R34].
My own DV-C12 uses "days 1-7", which is the looser metric. Choosing it after seeing the data would move the goalposts.
*Correction:* pre-register day 7 ±1 as primary, because it is the usual meaning of "D7". Report days 1-7 next to it. ME's 2× is relabelled ASSUMPTION.

**X7. CV-C4: the FTC figure is half-verified.** I opened the March 2026 FTC release [S15]. It states $7.9 billion reported lost to investment scams in 2025, out of $15.9 billion in total fraud losses. "Roughly half" is therefore a correct ESTIMATE (7.9 ÷ 15.9 = 50%). The release gives **no average individual loss**, so "above $10,000" is unsupported there.
*Correction:* mark the source opened, keep $7.9 billion and about 50% (ESTIMATE), and drop the average loss unless the testimony PDF is opened.

**X8. CV-C5 transfers news-influencer data to finance content without a label.** I opened the fact sheet [S16]:
- 21% of adults and 38% of adults 18-29 regularly get news from news influencers (survey 2025-08-18 to 24).
- 69% mostly come across it; 77% at 18-29.
- The definition covers news, political and social issues. Finance is not mentioned.

*Correction:* state the transfer as HYPOTHESIS. Cycle 1 made the same caveat for the 2024 version [FC-R33]. Also, under T1, the text should name the source generically ("a national nonpartisan research organization") rather than by its brand name, as cycle 1 did. The URL on the brief's allowed domain can stay.

**X9. CV-C2's 30-60% founder-to-profile rate is unsupported. It is also the rate that viewer-side candidates move.**
If founder content lands on `/` and `/how`, the click-through from there to a profile is the hinge for CV's founder channels. That hinge is what D27 (first-visit line), C31 (the `/` share image) and P-9 (unique titles) act on. The number can be measured with ME-E1: views on `/` or `/how` followed by a profile view in the same session.
That measurement needs a session link without an id. The HYPOTHESIS is that a per-tab session-storage flag sent in the beacon is enough.
*Correction:* label 30-60% an ASSUMPTION and make it a week-2 measured input. The council then reads D27 and C31 against it.

#### Revisions to my pass 1

1. **DV-C12:** adopt the single local-storage design from X3, sending only the date value inside the E1 beacon. Make day 7 ±1 the primary definition and report days 1-7 beside it (X6).
2. **DV table, column (b):** replace "alternating days" with **per-render randomisation** for D22, C25/P-6, D27 (pane-open and exits), D24 and P-7 (X4). Keep switchbacks, stratified by ref bucket and `via`, only for D7 reads.
3. **DV-C11:** the pane-open read takes 2-4 weeks, not 1. Feed card impressions from external visitors are a fraction of the 5,000 profile views; that is a HYPOTHESIS, and CV-C12's central case is about 1,000 views a week. Add ME's design-effect warning for any clustered design.
4. **DV-C10 and ranking:** founder content mostly lands on `/` and `/how` (CV-C2), so the views gate is partly moved by `/` → profile click-through. Raise **C31** from rank 13 to 9 (weak → plausible) and **D27** from 6 to 5. Their G3 effect is indirect but real, and readable through X9's metric.
5. **DV-C9 and S14:** describe the research organization generically in the text, consistent with X8.
6. Open question added: the session-linking flag (X9) needs the same legal committee ruling as X3.

#### Sources (new this pass)
- [S15] US Federal Trade Commission press release on testimony to a congressional committee about fraud, 2026-03-25. https://www.ftc.gov/news-events/news/press-releases/2026/03/ftc-testifies-joint-economic-committee-agencys-efforts-combat-fraud (opened: yes)
- [S16] National nonpartisan research organization, news influencers fact sheet, survey 2025-08-18 to 24. https://www.pewresearch.org/journalism/fact-sheet/news-influencers-fact-sheet/ (opened: yes)
- Cycle 1 rows FC-R3, FC-R31, FC-R33, FC-R34 (docs/direction/market-2026-11-01.md D1), not re-opened.

## D3. Measurement and experimentation (ME)

### Cycle 2, pass 2: measurement analyst, cross-examination

**Member:** measurement and experimentation analyst. **Pass:** 2. **Date:** 2026-11-01. **Targets:** p1-demand-traders.md (DT) and
p1-pricing-tests.md (PT). Labels as in pass 1. Repo HEAD 0d42f65, read-only. Arithmetic: z=1.96 (two-sided) and 0.842 (80% power),
with score intervals.

#### Challenges

**X1. DT gate baseline: "a quantitative read needs ≥100 traders per arm (c1 T4)". (ESTIMATE, H)**
- At 100 per arm and a 60% base, the MDE is 2.80·√(2·.24/100) = **±19 points**.
- DT's item effects are +3 to +8 points. A 5-point effect needs 7.84·.48/.05² ≈ **1,505 traders per arm**. An 8-point effect needs
  about 588.
- *Correction:* drop "≥100 per arm makes it quantitative". State instead that no single card or copy item is measurable on share
  rate in this product's first year, and that items 4-7 and 11-14 are decided on principle (as in my pass-1 §6).

**X2. DT row 2 (C30): `share_events` "no user id in the row", with numerator "distinct sharers / connected traders". (FACT on
logic, H)**
- Distinct sharers cannot be counted without a per-trader key.
- The share is the trader's own action on their own account. Keeping the trader id is consistent with P3 and with the existing
  `users.share_prompt_action` (`db/schema.sql:41`).
- *Correction:* keep the trader id, as in my E5. What must never be kept is the destination or recipients.
- `format=unfurl` is also not a share event. Unfurls are server-side preview fetches (my E3).

**X3. DT row 3 (#9): the segment tag is "never stored with the user", but the metric is "share within 14 days, per segment".
(FACT on logic, H)**
- Joining a segment to share behaviour needs the segment on some row.
- *Correction:* give founder invite links an enumerated code (`via=inv_t` or `inv_h`) stored in
  `signup_attempts.referred_surface`. It is a bucket, not personal data.
- That needs `REFERRED_SURFACES` widened (`lib/referral.ts:12`), and today's list already drops `nav` (my pass-1 C2).
- At about 25 per arm the MDE is **±39 points**. The read is qualitative, and the row should say so.

**X4. DT row 1: `landed{source=invite}`. (FACT, H)**
- `normalizeVia` accepts only profile, trade and month (`lib/referral.ts:12-17`).
- `landed` fires only after the 18+ attestation (`lib/auth/attempts.ts:24`), so invitees who never start signing up are invisible.
- *Correction:* the denominator is the founder's outreach sheet (my E9, no personal data in the repo). The numerator needs the X3
  code.
- At 20/100 the score-interval CI is 13-29%. A 20% bar at n=100 cannot tell 15% from 25%.

**X5. DT row 8 (D21): `method_chosen{path}` and "signed-out returners". (FACT, H)**
- `META_KEYS.method_chosen` allows only `method` (`lib/funnel.ts:9-12`), so a `path` key is silently dropped.
- There is no view capture for the sign-in page, so the denominator does not exist.
- "Signed-out returners" cannot be counted per person without an identifier.
- *Correction:* add `path` to the allow-list; count sign-in page views with E1 (surface=login); read signed-out return only as the
  date-cookie cohort (my E4, biased low).

**X6. DT row 9 (C32): threshold ≥0.1% connects per view at n≥5,000. (ESTIMATE, H)**
- DT's own estimate: CTA 0.1-0.3% × 40% completion = **0.04-0.12% connects per view**. The 0.1% bar sits at the top of that range,
  so the row nearly fails by construction.
- At 5,000 views, 0.1% is 5 events. The score-interval CI for 5/5,000 is 0.04-0.23%, which cannot separate 0.05% from 0.2%.
- *Correction:* measure the CTA click rate (about 1% base: ±0.8 points at 2,500 views per arm, my pass-1 §5). Report connects
  descriptively.

**X7. DT row 13 (P-3): "/how#verified visits from badge clicks". (FACT, H [pass-1 S2])**
- The URL fragment is never sent to the server. RFC 9110 §10.1.3 also requires Referer to omit it.
- *Correction:* send a first-party click beacon or a `?from=badge` query, counted in E1.
- Row 14 (C13), "visits with ?via= per trade share", also assumes a tag that shared URLs do not carry today
  (`trade-share.tsx:10`, pass-1 C2).

**X8. PT C2/C5: signed-out exposure "counted per first-party session with no cookie". (FACT on mechanism, H)**
- Without a cookie or an identifier there is no session to dedupe on. The unit becomes a page load.
- Repeat exposures inflate the denominator and bias the click rate **down**. Mixing them with signed-in users (deduped by id) gives
  an undefined unit.
- The one-question survey has the same problem: with no person key, repeat answers cannot be deduped.
- *Correction:* use two separate rates. One is signed-in exposures per person (the decision metric). The other is signed-out clicks
  per exposed page view, which is diagnostic only. Never pool them.

**X9. PT traffic assumption: signed-in viewers are 10-20% of uniques, giving 200-1,000 exposed a week. (HYPOTHESIS vs HYPOTHESIS,
M)**
- Neither file sources this. My pass 1 assumed 2-5%.
- Exposure is also limited to an in-app Compare entry, so only a fraction of uniques can be exposed at all.
- At 2-5% signed-in, decision-grade exposure is 20-125 a week. PT's Stage 1a (≥1,000 exposed) would then need 8-50 weeks.
- *Correction:* make the signed-in share the first number measured (E1 `signed_in`), and present Stage 1a's timing as a range across
  both assumptions.

**X10. PT C2 and Stage 1a decision bands. (ESTIMATE, H)**
- At n=1,000, a "weak" result (upper bound <2%) needs **≤11 joins (1.1%)**. "Pass" needs ≥30 (3%).
- So **12-29 joins, a 1.2-2.9% rate**, is an unlabelled grey zone. Cycle 1's stock prior of 0.1-0.5% maps into it after any
  intent discount.
- *Correction:* label 12-29 "inconclusive: extend or decide on principle". Do not read it as a failure.

**X11. PT arithmetic spot-checks. (ESTIMATE, H)**
- 3% vs 5% gives 1,506 per arm, and 1% vs 2% gives 2,318. Both verified.
- Fee line ($0.73 + 4.6% of price), break-even ratios (1.28×, −24.5%), test-and-roll n* (640-950 at N=8,000) and the 16.6%
  savings: all verified.
- Small error: Var for $12.99 at 0.95% is 168.74·.0094 ≈ **1.59**, not 1.63. That changes n to ≈36,600, so the conclusion stands.
- PT's no-price-test-in-weeks-1-8 verdict is right.

**X12. PT sources name individual authors (S4-S8, S17, S18). (FACT on POLICY, H)**
- POLICY T2 (BRIEF: never write a real person's name) applies to citations too.
- *Correction:* cite by title, venue, year and DOI or arXiv id only, as DT does.

**X13. PT C11 is right, and it binds my readout too. (FACT via PT [S6], which I did not open; HYPOTHESIS on application, M)**
- Weekly looks at a fixed-horizon test inflate false decisions.

#### Revisions to my pass 1

1. **Weekly readouts are descriptive.** Gate and candidate decisions are taken only at the pre-registered week-8 read and the
   pre-registered extension. Any early stop uses an always-valid or conservative group-sequential boundary (X13).
2. **Sensitivity on signed-in share.** G4 and G5 reachability are restated over 2-20% signed-in. G4 needs n≥200, which is
   reachable at the high end and very likely not at the low end. G5 at ≥652 exposed is reachable only at the high end, and is
   otherwise a lower bound (X9).
3. **E8 painted door:** the decision rate is signed-in per person only. Signed-out exposure is per page view, kept apart and
   diagnostic (X8). Add PT's 12-29/1,000 grey zone, labelled inconclusive (X10).
4. **E1 surfaces:** add `login`, `how` and `compare`, and a click beacon or `?from=` for in-page anchors, so D21, P-3 and the Compare
   entry have denominators (X5, X7).
5. **Attribution fix-ups:** widen `REFERRED_SURFACES` with `nav` and enumerated invite codes (`inv_<segment>`). Also add `path` to
   `META_KEYS.method_chosen` (X3, X4, X5).
6. **New MDE row:** a 5-point share-rate effect needs about 1,505 traders per arm, which makes "decide on principle" for trader-side
   card and copy items explicit (X1).
7. **Test-and-roll** (PT C10) is adopted as the decision rule for viewer-facing UI candidates that cannot reach 80% power. Roll
   the arm with the higher posterior expected outcome, subject to POLICY guardrails (no hiding, F3 disclaimer intact). Marked
   HYPOTHESIS, M. It needs the owner's acceptance.
8. **G5 one-sided vs two-sided:** my 652 is one-sided against a fixed 1.5%. PT's tables are two-sided two-sample. Both are labelled
   so they are not compared directly.

## D4. Pricing, willingness to pay (PW)

### Cycle 2, pass 2: Pricing analyst (willingness to pay), cross-examination

Member: pricing analyst (willingness to pay and benchmarks). Pass 2, 2026-11-01. Targets: p1-pricing-tests.md (PT) and
p1-demand-viewers.md (DV). Same labels and POLICY rules as pass 1. Source ids [Sx] refer to my pass-1 list unless prefixed
PT/DV. One source re-opened this pass: DV [S10] (FINRA Foundation, "What Matters to Consumers...", September 2025, PDF text).

#### Challenges

**X1. PT C9 (fee model, "$7.99 needs 1.28×, $12.99 loses unless conversion falls >24.5%"). ESTIMATE, High.**
Evidence: PT fits a line ($0.73 + 4.6% of price) through cycle 1's two nets, $8.80 and $4.03. Those are *blended* nets of
different plan pairs: $8.80 = $9.99 / $99.99 (annual 16.6% off) and $4.03 = $4.99 / **$39.99** (annual 33% off). Recomputed per
charge at P × 0.959 − $0.30 (Stripe 2.9% + $0.30, billing 0.7%, tax 0.5% [S1]) with a 65/35 mix: $4.99/$39.99 → $4.03 (this
matches cycle 1, which shows where it came from). The line therefore puts the deeper annual discount into the "fee", which
overstates the fee at low prices. Consistent per-arm results: $7.99/$79.99 → $7.01 net, 1.26× needed (monthly only: 1.26×);
$12.99/$129.99 → $11.53, so $12.99 wins unless conversion falls more than **23.5%** (monthly only 23.7%).
Correction: replace PT's linear fee with the per-charge formula and state the plan pair of each arm. The gap (1.26 vs 1.28)
does not change any decision. It matters once annual discounts differ between arms.

**X2. PT Part 4 stage 1b ("'Yes' at $7.99 ≥ 1.28× $9.99 → flag a lower price") is underpowered at PT's own n. ESTIMATE, High.**
PT C5 sizes the monadic survey at 162 per arm (detects 30% → 45%, i.e. 1.5×). With the NIST pooled formula PT uses, detecting
30% → 38.4% (1.28×) needs ≈ **500 per arm** (≈580 for 1.26×). That means three arms × 500 = 1,500 responses, or 7.5-75 weeks at PT's 20-200
responses a week. Correction: either size 1b at ≥500 per arm and say it reads only at the upper exposure scenario, or replace
the $7.99 arm with $4.99 (needs ~2×, readable at n≈160-670). This matches my pass-1 C8.

**X3. PT Part 4 stage 1b applies the C3 hypothetical-bias discount to a *rate ratio*. HYPOTHESIS, Medium.**
PT C3 says correctly that the 21% / 1.35 discounts are for stated **value** and "do not discount purchase **rates**". Stage 1b
then compares yes-rates "after the C3 discount". That contradicts C3. Correction: use stated yes-rates by price only to
rank arms; no numeric discount on the ratio. Treat any stated rate as an upper bound.

**X4. PT C8/C12 base conversion of 1% is above the only peer-reviewed base rate opened this cycle. FACT (High) / ESTIMATE.**
A randomized experiment on 680,588 registered users of a freemium product found 0.37-0.45% paid over **two years** [S10].
Share-link viewers are less committed than registrants. PT's 0.5% rows (n ≈ 15,600 per arm for +50%; 6,000 eligible
signed-in viewers per arm for 30 conversions) should be the base case, with 1% as the strong case. Correction: swap PT's
base and strong rows. C12's traffic threshold then sits at the upper end (≈25,000-50,000 uniques a week).

**X5. PT Sources name real people. FACT (repo rule), High.** PT [S4]-[S8], [S17], [S18] list author names. BRIEF/POLICY
T4: no real people's names. Correction: cite by venue, year and DOI or arXiv id (as my pass 1 does). The URLs can stay.

**X6. PT C2 and DV row 16 share a 3% threshold on different denominators. ESTIMATE, Medium.**
PT: clicks ÷ **all exposed viewers** (signed-in plus signed-out sessions). DV: joins ÷ **signed-in returning viewers**. With
signed-in at 10-20% of uniques (PT's assumption), the same 3% pass mark could differ several-fold between the two. Correction:
one primary denominator (exposed signed-in returning viewers, which is closest to cycle 1's paying job), with the all-exposed
rate reported as secondary. The cycle 1 T8 rule should be rewritten to name it.

**X7. DV C6 implication ("payment is not a credibility signal, mildly negative for Record tools as a trust product"). FACT
on the numbers (High), challenge on the inference (Medium).**
I re-opened DV [S10]: 2% named "I paid for the information" as most important for judging money information and 21% as
least important (n=1,031 adults, not only investors). Both are correct. But Record tools is sold as convenience, not as more
reliable information. F-3 makes the record identical for payers and non-payers. The finding is about cues to information
quality, not willingness to pay. Investors use paid resources widely: 40% in the 2024 FINRA investor survey [S11].
Correction: reword DV C6's implication to say paying does not signal quality to viewers, so Record tools copy must never
imply paid data is more accurate. That is a POLICY-consistent copy constraint. Delete "mildly negative for Record tools".

**X8. PT C13 (annual-first test) lacks an expected effect size; my pass-1 numbers supply one. ESTIMATE, Low.**
Using cycle 1's retention facts (17.0% monthly / 44.1% yearly still paying at 12 months), lifetime net is ≈ $68 per monthly
payer and ≈ $171 per annual payer. Lifetime per payer is $99 at 30% annual, $104 at 35% and $114 at 45%. An annual-first display that moves the mix
from 30% to 45% is worth ≈ +16% per payer at equal conversion. That gives PT's test-and-roll prior a concrete mean.
Correction: add it to PT C13 as the prior, and flag that it rests on app-store retention benchmarks.

#### Revisions to my pass 1

1. **C2:** add the $12.99/$129.99 row (net $11.53; wins unless conversion falls >23.5%). Add one line saying PT's 1.28× comes
   from a linear fee fit across unequal annual discounts (X1).
2. **C8:** recompute with the pooled NIST formula for consistency with PT. Figures barely move: 1.26× from 3% needs ≈8,450
   per arm; 2.07× ≈670. Narrow the claim to *painted-door click rates*. For a high-base stated survey (≈30% yes), 1.26-1.28×
   needs ≈500-580 per arm: feasible only at PT's upper exposure scenario, not impossible.
3. **C6:** say explicitly that the 0.37-0.45% two-year registrant base rate argues for PT's 0.5% row as the base case (X4).
4. **C13 step 2:** split the two routes. A $4.99 *survey* arm needs no new price decision (PT C7). A *displayed* $4.99 offer
   needs the owner.
5. **C10/C11:** add DV [S10] (2% / 21%) as corroboration that payment is not a quality cue. Add the copy constraint from X7:
   never imply paid data is more accurate.
6. **C12:** no change to the lever table. Add PT's point that a test-arm price may never later become a "was" price
   (16 CFR §233.1).

## D5. Pricing tests, statistics (PT)

### Cycle 2, pass 2: cross-examination by the pricing experiment designer (statistics)

**Member:** pricing experiment designer (statistics). **Pass:** 2. **Date:** 2026-11-01.
**Targets:** p1-pricing-wtp.md (WTP) and p1-measurement.md (MEAS). My own file is p1-pricing-tests.md (PT).
All arithmetic below was recomputed this session in a script. Labels and POLICY rules are as in pass 1.

---

**X1. The $7.99 break-even is 1.26×, not 1.28×. WTP is right and I was wrong. Target: PT C9 vs WTP C2 (ESTIMATE, High).**
- **WTP's model.** It uses the processor's published fees: net = P × 0.959 − $0.30.
  - Monthly: $9.28 at $9.99 and $7.36 at $7.99, a ratio of **1.261**.
  - Blended 65/35 with $99.99 and $79.99 annual plans: $8.82 vs $7.01, a ratio of **1.257**.
- **Where my 1.28× came from.** I fitted a line through cycle 1's two nets, $9.99 → $8.80 and $4.99 → $4.03. But $4.03 is the blend of $4.99 with a **$39.99** annual plan. Recomputed: 0.65 × 4.49 + 0.35 × (38.05 ÷ 12) = $4.03. My "fee line" therefore mixed in a lower annual-plan price.
- **$12.99 arm.** Under WTP's model, with a $129.99 annual plan, net is $11.53. $12.99 beats $9.99 unless conversion falls more than **23.5%**. I had 24.5%.
- **Correction.** PT C9 should read 1.26× and 23.5%, citing WTP C1's fee model.

**X2. The 652 in MEAS answers a different question from PT's 1,506, and the stated convention gives 525. Target: MEAS G5 (ESTIMATE, High).**
- MEAS states one-sided α=0.05 at 80% power as its convention. A **one-sample** test of H0: p=1.5% against p=3% then needs n = ((1.645·√(.015·.985) + 0.842·√(.03·.97)) ÷ .015)² = **525** (591 with NIST's 1/δ continuity term).
- 652 matches the **two-sided** one-sample figure (648). That contradicts MEAS's own convention.
- A one-sample test treats 1.5% as a known benchmark. If the comparison is instead two arms (two prices, or a door with and without a price) at 1.5% vs 3%, it needs **1,533 per arm** two-sided (1,208 one-sided), about 3,070 exposed in total. That is the same order as PT's 3% vs 5% (1,506 per arm).
- **Correction.** MEAS G5 should state "525 one-sided (648 two-sided) one-sample against a fixed 1.5% floor; a two-arm contrast needs about 1,500 per arm".

**X3. WTP's arm sample sizes check out, but its feasibility claim does not. Target: WTP C8 and C13 step 2 (ESTIMATE, High).**
- **The numbers are right.** Two-sided two-sample, recomputed: 1.26× from 3% needs 8,449 per arm; 1.5× needs 2,517; 2.07× needs 668. From a 1% base: 25,943 / 7,750 / 2,071. All match WTP.
- **"Feasible in weeks" is not shown.** WTP derives it from "5,000 external views a week with about 15% D7 return". Views are not unique viewers. Cycle 1 put the views gate's likely miss at 1.5-50×. MEAS (§6) estimates **20-500 signed-in viewers in all 8 weeks**.
- **What the arms actually need.** A two-arm notify-me test of $4.99 vs $9.99 needs 1,336 (3% base) to 4,142 (1% base) exposed returning viewers. Even at the top of MEAS's range, that is 3-8 times what 8 weeks can supply.
- **Policy check.** WTP itself notes that showing $4.99 needs the owner (F-3).
- **Correction.** Make step 2 conditional on measured exposure of at least 700 per arm at a 3% base, not on the gate target.

**X4. A cumulative paid rate among registrants is not a stock among viewers. Target: WTP C6 "first peer-reviewed anchor for the 0.1-0.5% stock prior" (HYPOTHESIS, Medium).**
- WTP's [S10] measures paid conversion of **new registered users, cumulated over two years** (0.37-0.45%). That is a flow, and its denominator is far more committed than monthly viewers.
- Cycle 1 §5 defines the stock as monthly flow × new-viewer share × paying life, and flags the implied flow, 0.01-0.07% of new viewers a month, as the least-anchored number.
- [S10] is evidence about the **flow among registrants**. Mapping it to the viewer stock needs the registrant ÷ viewer ratio and paying life, and none of the three files measures either.
- **Correction.** Say "a flow anchor among registrants; consistent in order of magnitude, not a stock anchor". Downgrade to Low.

**X5. The signed-in share differs about 4× between files, which changes every person-level test. Target: MEAS G4 ESTIMATE (2-5%) vs PT working assumption (10-20%) (HYPOTHESIS, Low, both).**
- Neither number is sourced.
- MEAS's lower figure is more conservative and matches the dev-stub auth reality.
- Price arms must be assigned to a stable person, so they need signed-in users (PT C12). At 2-5% signed in, PT C12's 2,500-5,000 signed-in eligible viewers a week means **50,000-250,000 uniques a week**, not 12,500-50,000.
- **Correction.** Both files should carry the range 2-20%, show results at both ends, and measure the share first (cycle 1 #3, MEAS E1 `signed_in`).

**X6. MEAS's switchback template must exclude price and offer tests. Target: MEAS §5 "Day switchback (ABBA) for viewer-facing UI" (FACT/HYPOTHESIS, Medium).**
- In a day switchback, the same person can see $9.99 on Monday and another price on Wednesday. Regulators are scrutinizing personalized and variable pricing (PT S14).
- Any price shown as an offer must be honoured (cycle 1 #6(c)). A day-varying price makes that rule hard to apply, and it invites the complaint guardrail in PT C11.
- **Correction.** Add one line to MEAS §5: "Never use switchbacks for prices, trial or refund terms; those arms are assigned per signed-in user and fixed for the test."

**X7. MEAS G5's denominator and PT C2's exposure unit disagree. Target: MEAS G5 / E8 and PT C2 (FACT from repo, High).**
- MEAS counts signed-in returning viewers, as cycle 1 T8 did. Its E8 stores no per-viewer id, so for signed-out viewers "returning" would rest on the date cookie (E4).
- PT C2 counted signed-out sessions too. Without a per-browser id, those sessions cannot be deduplicated, so a "rate per viewer" is really a rate per impression.
- **Proposal.**
  - Report two G5 lines: signed-in returning (per person, the gate line) and all impressions (per impression, labelled "inflated denominator, lower bound on rate").
  - Neither line needs personal data.

**X8. Two minor items. Target: WTP C5 and C12 (FACT, Medium).**
- **Unopened abstracts.** WTP's decoy finding (C5) and money-back finding (C12) rest on abstracts it did not open, labelled correctly. They should not drive design. I agree with the conclusions (do not design on decoys; the refund window is a trust choice). The refund-copy A/B (PT C14) remains the only way to learn its conversion effect.
- **The "pennies a day" reframing (WTP C4).** Its reversal at large amounts comes from an abstract WTP did not open. "$8.33 a month" should be tested as an annual-first arm (PT C13) before it is adopted as copy.

---

#### Revisions to my pass 1

1. **C9:** $7.99 needs **1.26×** (not 1.28×); $12.99 wins unless conversion falls more than **23.5%** (not 24.5%). Fee model: WTP C1 (processor's published fees). Drop my linear fit.
2. **Working assumption:** signed-in share **2-20%** (was 10-20%). **C12:** the minimum traffic for a person-assigned price test becomes **roughly 12,500-250,000 uniques a week**, so the conclusion "not in weeks 1-8" is strengthened.
3. **C2:** the exposure unit is split. The gate line uses signed-in returning viewers per person. The impression line, which includes signed-out viewers, is labelled a lower bound. Weeks-to-n for the gate line uses MEAS's 20-500 signed-in viewers over 8 weeks. So the C1 two-arm contrasts **are not reachable** on the gate line in weeks 1-8. Only the impression line or a single-arm read reaches n.
4. **C1:** add the one-sample benchmark case: 3% against a fixed 1.5% floor needs 525 one-sided (648 two-sided). That is the right test for the cycle 1 T8 pass rule, which compares the lower bound against 1.5%.
5. **C11:** add "no switchback or day-varying assignment for any price, trial or refund arm".
6. **Sources:** add WTP's fee source (the integrated processor's public pricing page, per WTP [S1]; not reopened by me).

## D6. Channels, first 100 traders (CT)

### Pass 2: trader channels analyst, cross-examination

**Member:** distribution analyst (supply). **Cycle 2, pass 2**, 2026-11-01.
**Targets:** p1-demand-traders.md (DT), p1-compliance.md (CO). **Own file:** p1-channels-traders.md (CH).
I made no new fetches this pass. Evidence comes from the repo, from the sources already opened in CH, DT and CO, and from
arithmetic. Platforms are described generically (T1). This is not legal or investment advice.

#### Challenges

**X1. CO-C12 (F3b scope): partly settled already. The open part is narrower than CO says.** HYPOTHESIS, Medium-High.
- **Settled.** CO asks the owner whether the founder may post (a) their own card. The board already decided this: company
  content built from real records is barred, "That includes the founder's own real record", and growth's founder-record
  content was dropped for F3b ([R1] Idea 13, Conflicts and Debate). So (a) is settled as **no**.
- **Still open.** (b) A consented trader's card posted by the company on a sign-blind schedule. Its content comes from
  records, so the literal text of F3b also bars it.
- **Contradiction inside CO.** CO-C5 proposes "the founder's own card, with a disclosure" and a "sign-blind rule" as
  alternatives. Both conflict with CO-C12 and with [R1].
- **Proposed correction.** CO-C5 keeps only demo cards and method explainers. CO-C12's open question becomes (b) alone.
  Distribution plans assume that only the trader posts their own record.

**X2. CO-C12 goes further than CO says: one-to-one founder messages are "messages in any channel" too.** HYPOTHESIS, Medium.
CO limits the effect to founder *posts*. Under the same literal reading, three parts of my CH plan are touched:
- **Outreach messages.** A DM linking to an example trader's profile unfurls that trader's card, so the message's content
  comes from records. Outreach should link to /how and the home page, which uses the static image, not a trader record
  (C31). CH channels #1 and #4 lose their strongest proof point. A prospect can still open the public feed themselves.
- **Onboarding.** A written message such as "your profile shows X" or "your card is ready, share it" carries record fields.
  Personal onboarding moves to a live call or screen-share in which the trader views their own page. Any written follow-up
  carries no handle, symbol, return or record field.
- **Moderation notices.** Notices from the 48-hour human check ("your thesis was held") take their content from a thesis,
  which F3b lists. This needs an owner ruling. It is a gap neither file names.
- **Reposts.** The founder must not repost or quote traders' own card posts. That would adopt them as our advertising
  (CO-C1) and break F3b. This takes away the natural lever of CH channel #6 (build in public).

**X3. CO-C2/C3 (early access is a material connection) affects the share gate, not connects. Open signup avoids it.**
HYPOTHESIS, Medium.
- **The risk.** CO notes that early access is named in the FTC rule. If weeks 1-8 run as "invite-only" or as "the first
  50", every card a recruit shares would need an "early tester" disclosure, or recruits would be asked not to post. That
  hits the 60% share gate directly.
- **Proposed correction.** From week 1, connecting is open to any adult on equal terms. There is no waitlist and no
  "first 50", "founding" or "exclusive" wording. A founder invitation then confers nothing beyond what everyone gets.
- **Onboarding.** Personal onboarding is offered to anyone who asks, through a line on /how, so it is not a recruit-only
  perk.
- **CH change.** My pitch and schedule add this. My pass-1 phrase "first 20 personally" becomes "anyone who asks; the
  founder proactively offers it to the first 20".

**X4. CO-C9/C27 (CAN-SPAM, the $8.5M exposure) attacks a channel my plan doesn't use.** FACT for the rule [CH S2, CO S9];
HYPOTHESIS for scope, Medium.
- **The figure.** CO-C27 multiplies 160 contacts by $53,088. It assumes cycle 1's contacts are emails. In CH, cold contacts
  are in-platform messages, forum posts and admin requests. Email goes only to people who replied and asked for it.
- **Scope.** The FTC guide addresses electronic mail. Whether platform DMs count as email is not settled by any source I
  opened (HYPOTHESIS: they generally don't, but platform terms bar bulk messages either way, CO-C11).
- **What changes.**
  - Every email still carries a postal address and a working opt-out.
  - Once someone has asked for details, the ad label may be waived (prior affirmative consent, CO-C9), but the opt-out and
    the address stay.
  - Cold email stays out entirely, because an ad label on a first contact would also cut replies (HYPOTHESIS).
- **Cost.** A mailbox, not priced. No change to the funnel numbers.
- **Proposed correction to CO-C27.** Show the exposure as conditional ("if outreach used email"). Endorse the CH rule: no
  cold email, platform-native first contact.

**X5. DT item 1 metric (connects / invites ≥20%, c1 T5): the same contradiction I flagged in CH-C1.** ESTIMATE, High.
- **The arithmetic.** Cycle 1's own funnel gives 4% of contacts connecting. DT's "+30-50 traders over 8 weeks" implies
  roughly 600-1,300 invites at 4%. At a 20% bar, 100 invites would give 20 connects. The bar and the expected yield cannot
  both hold.
- **Proposed correction.** Use connects ÷ replies ≥30%, plus a contact-level checkpoint at week 2: at least 100 contacts and
  at least 5 connects. That is lowered from 6, see Revisions.

**X6. DT item 11 (A/B of two invite wordings, n≥100 per wording, outcome = connects) cannot read anything.** ESTIMATE, High.
- **Why.** At about 5% contact-to-connect, 100 per arm gives about 5 vs 5 connects, so any difference is noise. Even with
  replies (about 18%) as the outcome, 100 per arm gives a ±11-point 95% CI on each arm.
- **Time.** 200 contacts take about 5 weeks of CH channel #1.
- **Proposed correction.** Measure replies, call the result qualitative, and don't let wording choice wait on it.

**X7. DT item 9 (JoinCta, 0.4-6 traders a week) rests on 1,000-5,000 outside views a week that cycle 1 expects to miss
by 1.5-50×.** ESTIMATE, Low.
- **Arithmetic.** At a realistic 100-3,000 views a week in weeks 4-8: × 0.1-0.3% × 40% ≈ 0.04-3.6 a week, which is
  **0-10 over the 8 weeks**.
- **Correction to DT.** Restate the range on cycle 1's views estimate.
- **CH change.** Add it to CH as channel #10 at 0 / 3 / 8.

**X8. DT-C10 and item 6 (the preview costs 3-10 connects) is right, and my CH replies-to-connect rates partly double-count
it.** HYPOTHESIS, Medium.
- CH said the rate "includes preview declines" but used 35% and 40% without any discount.
- Combined with X2 (no example profiles in outreach), I lower the mid rates to 30% (#1) and 34% (#4).
- DT-C1 (followed traders hold losers longer) has a caveat DT states itself: the evidence is from paid-per-follower leaders
  (DT open question 4). The evidence supports recruiting small-audience transparency posters. It deepens, and does not
  solve, the conflict between supply quality and the views gate.

#### Revisions to my pass 1

| Change | Reason |
|---|---|
| Replies → connect, mid: #1 35% → 30%; #4 40% → 34% (low 25/30% → 21/25%; high unchanged) | X2, X8 |
| #6 build in public: 0/2/5 → 0/1/3; no reposting traders' posts | X2 |
| New #10, JoinCta on trader profiles: 0/3/8 | X7 |
| Outreach links to /how and home only; written onboarding carries no record fields; onboarding is live and open to anyone who asks | X2, X3 |
| Connect open to all adults from week 1; no "first 50", "founding" or "exclusive" wording | X3 |
| No cold email; email only to repliers who ask, with opt-out and postal address | X4 |
| Week-2 checkpoint: ≥100 contacts and ≥5 connects (stop and re-pitch below 3) | X5, new mid |
| +0.5 h/wk pre-send check (no record fields, affiliation stated) → ≈26.5 h/wk, ≈212 h total; cash unchanged plus a mailbox (not priced) | X2, X4 |
| Owner rulings needed: F3b for moderation notices and for (b) company posts of consented cards | X1, X2 |

**Revised week-8 count (ESTIMATE, Low).**

| Case | #1 | #4 | Other channels | Raw total | After 15% haircut |
|---|---|---|---|---|---|
| Mid | 280 × 18% × 30% ≈ 15 | 120 × 25% × 34% ≈ 10 | #2 8 + #3 7 + #5 3 + #6 1 + #7 5 + #8 5 + #9 3 + #10 3 | 60 | **≈51** |
| Low | ≈6 | ≈4 | #2 2 + #3 2 + #7 2 + #8 1 | ≈17 | **≈14** |
| High | — | — | — | ≈129 | **≈110** |

The high case is unchanged: the high rates stand and #10 offsets #6.

**Revised: ≈51 connected traders at week 8 (range 14-110), down from 54 (16-110).** P(≥50) stays about 50%. At the mid run
rate, 100 traders arrive around week 14, previously week 13. The views gate is unchanged or worse: the founder can't
amplify traders' cards, so external views depend entirely on traders' own posts.

## D7. Channels, first 1,000 viewers (CV)

### Cycle 2, pass 2: Distribution analyst (demand), cross-examination

**Member:** distribution analyst for demand (viewers, 5,000 external views/week gate). **Pass:** 2, 2026-11-01.
**Targets:** p1-compliance.md (CO) and p1-channels-traders.md (TR). My pass 1 is p1-channels-viewers.md (V1). Labels and
POLICY rules are the same as in pass 1, and all platforms are described generically (T1). This is not legal advice.

#### Challenges

**X1. CO-C12 (F3b may bar the founder from posting real traders' cards). Verdict: STANDS as the planning default. The literal reading proves too much, so the owner has to draw the line.**
- Evidence (FACT, docs/POLICY.md F3b): the bar covers "any message, in any channel, whose content or timing comes from
  traders' records". Its stated purpose is "records are looked up, not broadcast".
- Read literally, the bar would also cover the product's own Share button. That button produces an image whose content
  comes from a record, and the 60% share gate depends on it. So the owner cannot mean the maximal reading.
- The workable line has two parts (HYPOTHESIS, Medium):
  - *who sends*: a trader's own share is the trader's speech, while a company or founder post is our message;
  - *timing*: anything triggered by a close or a price move is barred.
- CO itself pulls both ways. CO-C5 allows founder posts of cards "chosen by a published, sign-blind rule", but CO-C12
  tells planners to assume none.
- Proposed correction: until the owner rules, founder and company content shows Demo records and method explainers
  only, and links to `/`, `/how` or Demo profiles. CO-C5's sign-blind option becomes an owner question (CO Q1), not a
  usable channel. I accept this, and it removes the "permissioned trader profile" route from my V1-C2.

**X2. CO-C19 (short-video platforms are higher-risk for under-18 leakage; "never run paid ads, which are also barred by P6"). Verdict: PARTLY WRONG.**
- P6 bars third-party trackers, not ads (FACT, POLICY P6). Paid ads are out of my plan because they are unprofitable
  without pixels (cycle 1, V1-C9) and because F5 bars paid visibility of records. They are not barred by P6.
- Minor leakage is real (CO-C18 cites the COPPA factors, FACT). For organic founder video, though, the risk sits in
  the creative and the targeting more than in the platform itself.
- Proposed correction: keep founder short video (V1 channel 2) under adults-only creative. That means no school,
  first-job or game framing and an adult presenter. Add a stop trigger: any under-18 signal in comments or at signup
  pauses the channel for owner review (TR-C4 has the same rule). Fix the P6 attribution in CO.

**X3. TR-C3 and TR-C8 (≈54 connected at week 8, range 16-110). Verdict: STANDS as supply. My V1 channel-1 views were not tied to it, and the arrival curve matters.**
- TR's mid curve reaches 34 connected at week 6 and 43 at week 7 (ESTIMATE). About 20 of the 54 connect in weeks 7-8,
  too late to have a pinned bio link or a second post by week 8.
- TR's cohort (accountability posters, journal users, small servers, no signal sellers) has small audiences. Cycle 1
  E8 already says this pulls against the views gate.
- Re-derived card views at week 8 (ESTIMATE, Low; all rates assumed):
  views = connected × bio-link share × bio views/wk + weekly card posts × views/post + heavy-tail traders.

| Case | Connected | Bio links | Posts/wk (60% ever × share this week) | Heavy tail | Card views/wk |
|---|---|---|---|---|---|
| Low | 16 | 30% × 10 = 48 | 4 × 10 = 40 | 0 | **~90** |
| Mid | 54 | 40% × 20 = 430 | 16 × 15 = 240 | 2 × 150 = 300 | **~1,000** |
| High | 110 | 50% × 30 = 1,650 | 33 × 25 = 825 | 4 × 300 = 1,200 | **~3,700** |

- The low case pairs few traders with few views per trader. These are correlated (same cohort, same founder), so the
  joint low is plausible, not a stacked tail.
- Proposed correction to TR: add a "views per connected trader" line (mid ≈18/week). Supply and the views gate then
  share one model.

**X4. TR-C3 #2 (forum post: ~5,000 views × 1% visit ≈ 50 visits) versus my V1-C10 #5 (300-3,000 visits per post that lands). Verdict: TR is the better base rate; mine was the spike case.**
- The 2015 aggregator study I opened [V1 S8] says quality drives popularity. It gives no click-through rate.
- Neither file has a sourced click rate. TR's 1% applies to all posts, while mine assumed a front-page landing.
- Proposed correction: a typical post brings 50-150 visits (5,000 views × 1-3%), with a 1-in-4 chance of a
  1,000-3,000 spike. Averaged at week 8, that is **20-300 visits a week**, not 50-600. Each post serves both plans and
  should be counted once.

**X5. TR-C6 (per-post `via` codes such as `fr-<community>-<post>`) versus my V1-C1 codes. Verdict: compatible, but two namespaces will break counting.**
- FACT (repo): `?via=` today goes only to the JoinCta link, and its legacy CHECK allows two values (lib/referral.ts:8).
- Proposed correction: one code registry, kept in the repo as non-personal config.
  - Prefix = channel (`card`, `mb`, `fr`, `pod`, `mtg`, `fsv`, `fpn`, `pr`, `dir`, `nl`), with an optional
    post suffix.
  - The same code is counted on `/u/*`, `/`, `/how` and `/login`.
  - The Share button and copy-link append `via=card` automatically. Without that, image shares arrive as "direct"
    (cycle 1 measurement trap) and the largest gate source goes uncounted. This is a small code change, so it goes in
    week 0.

**X6. TR-C7 (≈26 founder h/week) versus my V1-C11 (30-45 h/week). Verdict: the two plans overlap and must not be added together.**
- Forum posts, podcasts, build-in-public posts (microblog and professional network) and educator mentions appear in
  both plans.
- ESTIMATE: TR's 26 h plus my channels that are not in TR (founder short video 6-8 h, press 4-5 h, SEO pages ~1 h/wk
  averaged) comes to **~37-40 h/week**. Cutting short video gives ~31 h.
- Whichever channel gets cut, the gate arithmetic in X7 favours recruiting hours over content hours.

**X7. Founder content's share of the gate falls once real records are out of it (X1). Verdict: a revision to my own V1-C2 and V1-C12.**
- Visitors who land on `/` or `/how` and then swipe to a profile (SW-1) arrive with an internal Referer.
- The gate counts them only if the landing `via` is carried in internal links. That is a cookie-free option, but it is
  a design choice the owner has to make, or they are left uncounted.
- Proposed correction: lower the founder-channel profile factor from 30-60% to **15-40%**, and make carrying `via`
  forward an explicit gate-definition decision (input to MRC #4).

#### Revisions to my pass 1

1. **V1-C2:** founder content links only to `/`, `/how` and Demo profiles. The "permissioned trader profile" route is
   dropped until the owner rules on CO Q1 (X1).
2. **V1-C9:** ads stay excluded for profitability and F5, not P6 (X2).
3. **V1-C10:**
   - channel 1 uses the X3 model: ~90 / ~1,000 / ~3,700;
   - channel 2 adds adults-only creative and an under-18 stop trigger (X2);
   - channel 5 drops to 20-300 visits a week (X4);
   - the channel 6 newsletter adds a postal address and an opt-out handled within 10 business days (CO-C9).
4. **V1-C1 and V1-C11:** week 0 adds one shared `via` registry, the automatic `via=card` on shares, and a decision on
   carrying `via` forward (X5, X7).
5. **V1-C11 hours:** the combined supply and demand plan is ~37-40 h/week (X6). Cut channels 9, 10 and then 2 first.
6. **V1-C12, revised week-8 external profile views a week** (ESTIMATE, Low):

| Component | Low | Central | High |
|---|---|---|---|
| Trader cards (X3) | 90 | 1,000 | 3,700 |
| Founder, press and other channels: visits | 80 | 600 | 1,500 |
| … of which reach a profile (15-40%, X7) | 10 | 150 | 600 |
| **Total profile views from external referrers** | **~100** | **~1,150** | **~4,300** |
| Shortfall against 5,000 | ~50× | ~4.3× | ~1.2× |

- Trader cards now carry about 85-90% of the gate. Each connected trader is worth about 18 views a week at mid.
- Below 5,000 at every point in the range. Reaching it needs roughly TR's high case for supply plus heavy-tail
  sharers, or the owner allowing sign-blind founder posts of consented cards.
- The first 1,000 cumulative viewers arrive around week 4-6 at central (previously 3-6), and only around week 10 or
  later in the low case.
- My V1-C13 recommendation stands: report card-sourced and founder-sourced views separately.

#### Sources
Same as pass 1 (V1 S1-S8). Rule text checked against docs/POLICY.md (F3b, P6, F5) and lib/referral.ts this pass.
No new external sources were opened.

## D8. Regulatory and compliance (CO)

### Cycle 2, pass 2: compliance cross-examination

**Member:** regulatory and compliance analyst. **Pass:** 2. **Date:** 2026-11-01. This is market research, not legal advice.
**Targets:** p1-channels-viewers.md (CV) and p1-risks.md (RK). Source ids [S#] refer to my pass-1 list (p1-compliance.md).

#### Challenges

**X1. RK C7 / R12: "keep public reaction counts off, so the addictive-feature test fails" is wrong. FACT (High).**
- §501.1736(1)(e)4 is met when the platform "has *any* of the following addictive features" [S21].
- Feature (a) is infinite scrolling, defined as "continuously loading content … as the user scrolls … without the need to open a separate page" or "pages with no visible or apparent end".
- The full-screen swipe feed meets (a) on its own. So removing reaction counts (feature c) changes nothing.
- R12's fail line, "meets 3 of the 4 tests", is already true by design:
  - criterion 1: users can view other users' content;
  - criterion 3: F-2 per-viewer ordering "analyze[s] … information on users";
  - criterion 4: infinite scrolling.
- Correction: R12 should say "only the under-16 usage criterion (2) keeps us out." The test becomes whether the 18+ gate and delete-on-report rule are live and logged. Cutting reaction counts is not the test.
- Two more options are worth recording:
  - **HYPOTHESIS (Medium):** a non-personalized ranking (the documented lower-bound order, not viewer-specific) arguably does not analyze "information on users". That would take criterion 3 off the table on signed-out surfaces.
  - **HYPOTHESIS (Low-Medium):** a paged feed with a visible end ("You've reached today's records") would take criterion 4 off the table.
- RK's penalty claims are correct. I checked them: "up to $50,000 per violation" from the state department, plus liability "to the minor account holder" for knowing or reckless violations [S21].

**X2. RK R1, R2 and R5 are not $0 pre-launch tests. They connect or publish real people's records. FACT (rule, High).**
- POLICY P6 says "Before any non-demo user connects a broker", all of these must be live: Terms, Privacy Policy, the public-scope consent, deletion and a contact.
- CLAUDE.md requires real auth before any public deploy.
- RK C6 itself says the vendor's Build plan is "personal and testing use only". Connecting 30 recruited adults (R1) or running 10 to 20 live sharers (R2, R5) on it likely breaks that plan's terms (HYPOTHESIS, Medium).
- Correction: before P6 is met, only these versions can run:
  - R1 on demo records, or on screenshots of a mock whole-record preview;
  - R2 with demo cards that carry the Demo badge;
  - R5 not at all.

  The live versions are sequenced after P6 and G0, on the paid plan.

**X3. RK R7: the tabletop uses "a real card". FACT (rule, High).** POLICY P5 bars real user data in prompts and docs, and P2 requires demo data that is obviously fictional. Correction: use a Demo-badged card. The test is unchanged.

**X4. CV C2, C10 rows 2 and 8, and C11: founder content that links "permissioned" named traders. HYPOTHESIS (Medium-High).**
- Under the literal F3b scope ("any message, in any channel, whose content … comes from traders' records") this is barred.
- CV's open question 3 already sees the conflict, but its table builds on the permissive reading: 30-60% of founder visits reaching a profile.
- Correction: show both cases, because the owner's ruling decides which one applies.
  - Under the literal reading, founder channels link to `/how`, `/` and demo profiles. Most founder views then fall outside the profile-only gate, so CV C12's founder share of profile views shrinks toward 0.
  - The permissive reading is set out in X10.

**X5. CV C4: the allowed pitch says "a broker-imported record shows the whole record". FACT (rule, High).**
- F3a bars implying completeness, and the record excludes options, short sales, transfers in, entries it cannot price, and unconnected brokers.
- Correction: "a broker-imported record shows every closed trade *from the connected accounts*, losses ranked like gains, with what's excluded listed."
- The FTC $7.9B figure is marked "opened: no", so it should not appear in a pitch until it is opened.

**X6. CV C3 and row 6: the newsletter rules leave out CAN-SPAM content. FACT (High).**
- The rules CV lists are unsubscribe, double opt-in and Privacy. CAN-SPAM also requires a valid physical postal address in every commercial email, opt-outs honored within 10 business days, and non-deceptive headers and subjects [S10, S9].
- Double opt-in is good practice, not a legal requirement (HYPOTHESIS, Medium).

**X7. CV C11 week 3 ("ask each connected trader for a bio link and a pinned card") and week 8 ("ask lapsed sharers once"). HYPOTHESIS (Medium).**
- An unpaid request creates no material connection under §255.5 [S2], so no disclosure is needed. That holds only if the request comes with nothing attached:
  - no early access tied to it;
  - no featured placement;
  - no Record tools.
- FTC staff say a company that "actively encouraged" posts takes on monitoring duties [S5]. The cheap fix is a one-line guidance note with each ask: "post only if you want to; no claims about future returns; keep the disclaimer visible."
- Pre-launch testers who post while access is invite-only add "early tester". "Early access" is a named connection [S2].

**X8. CV C11 week 0 ("shortlist 150 transparency-led traders"). FACT (High) and HYPOTHESIS.**
- Contact lists are personal data. Under P1/P5 they never go into the repo or prompts.
- Emailing addresses scraped from public pages risks CAN-SPAM's harvesting "aggravated violation" (§7704(b)(1)) [S10].
- Correction: contact people through the platform where they already publish, following its rules, or use addresses they published for business contact. Log opt-outs.

**X9. CV C9 (paid ads excluded). HYPOTHESIS (Medium).** I agree. One reason should be added: COPPA's "directed to children" test weighs "whether advertising promoting … the website" is aimed at children and the audience it reaches [S20]. Platform age targeting relies on self-declared ages. Exclusion is the safer default.

**X10. Steelman: the founder may post a trader's card with consent. Both sides for the owner.**
- **The permissive reading (HYPOTHESIS, Medium):**
  - F3b's operative concern is stated in its first sentence. Analysis is "never pushed (no notifications, emails or feed items announcing trades as they happen): records are looked up, not broadcast".
  - The listed exceptions (sign-in links, receipts, renewal and payment notices) are all *messages to our users*. That suggests "channel" means channels that reach users: email, notification, SMS, in-app.
  - A post on the founder's public social account is pull content that followers chose, like the public profile it links to.
  - The card is the artifact F-4 was designed to be posted publicly. The trader may post it themselves.
  - Under 472 U.S. 181, regular publication "not timed to specific market activity" is the protected mode [S13].
- **The literal reading (HYPOTHESIS, Medium-High):**
  - "Any message, in any channel" plus "content … comes from traders' records" covers a social post on its face.
  - A broadcast to followers is what "not broadcast" forbids.
  - Company use also turns the card into *our* advertising: §255.1/.2 duties apply, and so does the typical-results implication [S3, S4].
  - The exceptions list is closed and names no social posts.
- **Conditions if the owner adopts the permissive reading** (each is checkable):
  1. Written per-card consent from the trader, revocable, with the post removed on revocation (§255.1(b)-(c) [S3]).
  2. Closed trades only; no open positions; the card is at least 7 days old.
  3. A fixed posting calendar with no timing tied to closes or price moves.
  4. A published, sign-blind selection rule, with gains and losses posted in proportion.
  5. The F3 disclaimer and the anti-crop band in the image.
  6. No caption that comments on skill or future results (F3b labels; §255.2(b)).
  7. No benefit of any kind to the featured trader (§255.5 [S2]; F5).
  8. A log of every post for the "records to keep" list (COMPLIANCE §12).
- **The owner decides.** The permissive reading needs a POLICY wording change, because only the owner changes POLICY.

#### Revisions to my pass 1

- **C19:** I should have stated plainly what X1 states. Infinite scrolling alone meets criterion 4, and a paged feed or non-personalized ordering are the only design levers. I also add that the penalties are confirmed: $50,000 per violation, plus a minor's private action.
- **C12:** add the X10 steelman and its conditions, so the owner sees both readings. The working assumption until the ruling stays "only traders post records".
- **C3:** unchanged. I add X7: unpaid asks to traders are fine, but each carries a guidance line, and no perk is tied to an ask.
- **Checklist:**
  - New item 20: "Does this test connect or publish a real person's record? Not before P6, G0 and real auth (X2)."
  - Item 3 now reads: "In company posts, a whole-record claim names the connected accounts and links the exclusions (X5)."

## D9. Red team, risks (RK)

### Cycle 2, pass 2: red team cross-examination

**Member:** red team / risk analyst. **Pass:** 2. **Date:** 2026-11-01.
**Targets:** p1-pricing-wtp.md (PW) and p1-demand-viewers.md (DV), plus a check of my own stock-split finding.
Labels and POLICY rules are as in the brief. This is not legal or investment advice.

#### Split check (my p1 C1 / R4)

**FACT (High), from the SDK 13.1.11 type definitions.**
- I read `dist/index.d.ts` from the package tarball, unpacked into its own scratch folder; nothing was run. The repo has
  no node_modules.
- The activity `type` field lists `SPLIT` ("A stock share split"), `STOCK_DIVIDEND`, `REI`, `TRANSFER`,
  `EXTERNAL_ASSET_TRANSFER_IN` and `ADJUSTMENT`. These are mapped by "best effort", so a split may not always carry the
  `SPLIT` tag.
- `units` and `price` are documented only as "the number of units … for the transaction" and "the price … for the
  transaction". Nothing says history is restated after a split.

**FACT (High), from the repo.** `lib/broker.ts:96` and `:160` request `type: 'BUY,SELL'`, and line 141 drops every other
type. `SPLIT` events therefore never reach `matchTrades`.

**HYPOTHESIS (Medium).** History is probably not restated in split-adjusted units. Neither the type docs nor any public
vendor page I could find says otherwise. Not verified; only a live account with a known split can settle it.

**Verdict.** The finding stands, refined:
- The vendor offers a signal (`SPLIT`), and the app discards it.
- F3c ("excluded and counted, never shown with a wrong return") is not met as built.

**New FACT (High), same SDK file.** The activity ID "_can_ change if the transaction is deleted and re-added" when the
vendor reprocesses data. Under `unique(source, external_id)`, a reprocessed trade would come back as a second row:
- a doubled sell, which shows as a spurious excluded sell, or a doubled closed trade if a lot remains;
- a thesis orphaned from its `sell_id`.
This is a second "Verified" accuracy risk, and it is unmeasured.

#### Challenges

**X1. PW C6: the trial study does not "support the lower half" of the 0.1-0.5% prior. It points at or below its floor.**
- Evidence: [PW S10] reports 0.37-0.45% *cumulative over two years* among *registered* users. Cycle 1's prior is a
  *stock*: payers at a point in time ÷ that month's unique viewers.
- Most monthly viewers here are new link arrivals who never register. Registration plus a two-year horizon makes S10 an
  upper bound on the stock, not a midpoint.
- ESTIMATE: if 10-30% of monthly viewers register and 0.4% of registrants ever pay, the month's new payers are 0.04-0.12%
  of viewers.
- Correction: "consistent with a stock at or below ~0.1%". At 12,000 monthly uniques that is about 12 payers × $8.82 ≈
  $106 a month, below the ~$150 vendor floor (50 × $1 + $100).

**X2. PW C8: the detectability arithmetic assumes the views gate is met.**
- Evidence: "5,000 external views a week with ~15% D7" are the gate targets, not forecasts. Cycle 1 puts the views gate
  1.5-50× short, and views are not uniques.
- ESTIMATE: at 1/10 of the gate (500 views a week × 15% ≈ 75 returning viewers a week), the $4.99 vs $9.99 arm needs
  670-2,100 per arm. That takes **18-56 weeks**, not "weeks".
- Correction: give a low-traffic row. State that no price arm is readable before week 8 unless G3 roughly passes.

**X3. PW C7: the 2.5× annual-to-monthly value rests on an ambiguous retention figure.**
- Evidence: "44.1% of yearly plans still paying at 12 months" may be measured before the first renewal or after it.
  Before renewal, it says nothing about renewal.
- The 1/(1−0.441) life also assumes a constant renewal rate.
- Correction: show the ratio over a range of renewal rates (30-60% gives roughly 1.8-3.1×, ESTIMATE). Mark the
  "≥52% annual share" threshold as Low.

**X4. PW C10: stale holdings base.**
- Evidence: PW uses SCF 2022 ($15,000 median direct holding). The SCF 2025 results came out 9 Oct 2026: participation 56%
  (58% in 2022); median stock holdings among holders up 36% [my p1 S6, which includes indirect holdings].
- Correction: re-base on SCF 2025 direct holdings once the bulletin table is opened. The direction (a ceiling for median
  holders) probably holds.

**X5. DV C12: the device-storage D7 counter is biased far more than "conservative" suggests.**
- Evidence: shared links open largely inside the in-app browsers of social and chat apps. Their storage is often separate
  from the user's main browser, and often short-lived. A return visit through another app or the main browser looks like
  a new visitor. (HYPOTHESIS, Medium; I opened no source on in-app browser storage.)
- Script-running crawlers would add cohort starts that never return.
- Either effect can push measured D7 well below the true rate and fail G4 falsely.
- Correction: report it as a lower bound next to the signed-in cohort, never as the G4 number. Log the share of landings
  from in-app browsers by a coarse first-party referrer bucket (no user agent is stored). Keep the legal-committee
  condition.

**X6. DV C5: "no per-trade hiding answers the exact red flag" overclaims.**
- Evidence:
  - FINRA's Dec 2025 alert: scammers use "the names of real advisers with clean records" [my p1 S1].
  - SEC 2026-95: fabricated proof is shown in chat groups [my p1 S3].
  - A real, verified, linkable record is better bait than a fake screenshot.
- Correction: add "a trust product raises the value of impersonating its traders". Tie MRC #12 to U2/U3 (report action,
  off-site impersonation category) and to the C13 anti-crop band.

**X7. DV C9 and C6: the inferences outrun the surveys.**
- Evidence:
  - [DV S14] measures trust in "information from social media sites" generally, not in screenshots of returns.
  - [DV S10] "paid for it" ranks low *as a credibility cue*, which says nothing about paying for convenience tools.
- Correction: downgrade both implications to Low. Drop "mildly negative for Record tools".

**X8. DV C11 and the table: A/B readouts assume gate traffic and use day-alternation.**
- Evidence: "reads in about 1 week" needs 1,320 impressions per arm. Alternating days confounds arms with market days:
  records change on trading days, and traffic differs by weekday.
- Correction: alternate by hour or by page load. Give read times at 1/10 of the gate; the pane-open test then takes about
  3-6 weeks (ESTIMATE).

**Stands (no challenge).** DV C3, on interval misreading, is the strongest new claim, and it supports running T10 before
D23. PW C1 (fees) and C2 (equivalence) check out.

#### Revisions to my pass 1

1. **C1 / R4:** replace "unless the vendor restates history" with the split check above. Add the cheapest fix:
   - request `SPLIT`, `STOCK_DIVIDEND`, `REI` and the `TRANSFER` types;
   - treat any account-symbol with a unit-changing non-trade event as excluded and counted until adjustment is built;
   - test one Build-plan account that held a split stock.
   Cost: $0, ~8 h.
2. **New R14, Medium/High: duplicate or orphaned activities when vendor IDs change.**
   - Leading indicator: rows that share account, symbol, side, trade date, units and price under different `external_id`
     values.
   - Test: a duplicate-detection query on each rebuild, plus one fixture. $0, ~3 h. Fail on any duplicate.
   - Rank it just below R4.
3. **R8:** re-base the arithmetic on X1 (about 0.1% gives ≈$106 a month against ≈$150). The failure is now likely to show
   at month 2-4, not month 6.
4. **R2 and R5:** add low-traffic read times (X2, X8). R5's n≥200 D7 cohort may need more than 4 weeks if G3 misses.
5. **R7:** cite DV C5 as the mechanism and add the X6 correction.
6. **Length:** trim p1 to the 2,500-word cap in the next revision. Merge R9 into R1 and R10 into C3.

---

# Part E. Pass 1: desk research

## E1. Demand, traders (DT)

### Cycle 2, pass 1: demand validation, supply side (traders who publish)

**Member:** demand-validation analyst, supply side. **Pass:** 1 (independent desk research). **Date:** 2026-11-01.
**Inputs:** c2/BRIEF.md; POLICY; DESIGN §1.2, §3.5, Stage 5; F-1, F-4, F-5, F-6; IDEAS register and decisions; c1 chair
synthesis (Part A) and the c1 supply researcher's pass 1 and pass 2; creative §11 and §6.7; design P-2, P-3, P-8; `db/schema.sql`
and `lib/funnel.ts` (to name metrics that already exist). Market research only: not legal or investment advice, and it
recommends no security or trade. No interviews exist; nothing here is primary data.

**Framing.** Most trust rules are a *cost* to the trader and a *benefit* to the viewer. So "demand" here means one of two
things: traders want the item, or the item removes a barrier to connecting, publishing or sharing. A rule that viewers need
but traders resist gets a low verdict here even if it is required. The verdict says how it lands with traders; it is not a
reason to drop it.

**Gate baseline (from c1).** True share rate is probably 55-62%. P(≥30/50 | true 60%) = 56%. A split of 50 traders by
record sign (say 20 vs 30) gives a ±28-point CI on the difference. **So every per-item share comparison below is
qualitative in weeks 1-8.** A quantitative read needs ≥100 traders per arm (c1 T4).

---

#### Claims (new evidence this cycle)

**C1. FACT (Medium-High). Being followed makes traders hold losers longer.** In a difference-in-differences study on a
social trading platform, becoming a first-time "leader" (someone others follow) *increased* the disposition effect. Leaders
showed more of it than unfollowed investors, in forex and in stocks and indices. The authors' candidate mechanisms are
responsibility to followers, fear of losing followers by admitting a poor trade, and managing one's self-image [S1].
*Implication (HYPOTHESIS):* publishing itself pushes realized-only records to look better than the account is doing.
That makes F-6/TR-4 a necessity created by the product's own audience, and it also makes F-6 a barrier for traders. This
answers c1's open counter-hypothesis (§2.1, §12 "Unflattering records") with a sourced mechanism.

**C2. FACT (Medium; secondary for the figure). Closed trades flatter.** In the founding dataset of retail brokerage
accounts, stocks with gains were about 68% more likely to be sold than stocks with losses (corrected to about 1.5×, see FC-R12) ([S3], citing [S2]; [S2] itself
could not be opened, HTTP 403). *ESTIMATE:* a closed-trade win rate overstates a whole-book win rate. That gap grows for
traders with an audience (C1). Under F-6, the combined figure sits below the realized one for the typical trader.

**C3. FACT (High). Traders talk about wins and go quiet on losses. Pay-per-follower makes this worse.** On a social trading
platform (2013-14, >2,000 shared portfolios, ~30,000 comments), traders posted more after good returns. Positive wording
rose with past returns, but negative wording did not rise with losses. Comments were *longer* after bad outcomes, as
traders explained them. The authors link this to the platform paying traders by follower count [S4].
*Implications:*
- A wins-only posting habit is the norm for current posters, so mainstream posters are the wrong first 50 (supports MRC #9).
- Traders want room to *explain* losses, which is a supply-side reason for theses with timestamps (C35, P-1). HYPOTHESIS.
- F5 (traders are never paid) removes the payment driver of this bias.

**C4. FACT (High). In voluntary performance reporting, the poor performers drop out.** Funds that report to a database
voluntarily had significantly worse returns at the end of their reporting lives. Better-performing and larger funds had
lower hazard of leaving [S5]. *Implication:* if a record could simply vanish, it would vanish mostly after losses. TR-5
freeze plus C7 "Disconnected ‹date›" is what keeps a published set of records honest. For traders, though, the freeze
removes the quiet exit, which is a cost.

**C5. FACT (High). Regulators name win percentages, screenshots and fake profiles as red flags.**
- A US derivatives regulator's advisory: fraudulent profiles "brag about huge 'win' rates", and screenshots of winning
  trades or balances can be fabricated. It tells readers not to rely on claims seen online [S6].
- The SEC's investor alert (2022-08-29): depictions of accounts "rapidly increasing in value" are often fake, and
  fraudsters "create entirely fake profiles, or impersonate legitimate sources" [S7].
- FTC (2026-04-27): reported losses to scams that began on social media were $2.1B in 2025, about 8× 2020. Investment scams
  were $1.1B of that, including groups full of fake testimonials and fake platforms that show fabricated profits [S8].
- FINRA (2025-12-09): imposters build fake personas from real professionals' names and public details, and deepfake videos
  have been used [S9].

*Implications:*
- Honest traders compete with fakes. A record that can't be cropped back into a screenshot, and a handle that can't be
  spoofed, protects the *trader's* credibility, not only the viewer (C13, C33/P-2).
- Leading with win rate looks like the red flag regulators describe (supports D23 and F-4 dropping win rate).

**C6. FACT (Medium) → HYPOTHESIS on transfer. Viewers often fail to discount what a seller leaves out, unless the context
prompts it.** Earlier experiments found receivers too trusting of selective disclosure. A 2025 experiment found buyers did
adjust their skepticism when the institutional setup signalled that information might be withheld [S11].
*Implication:* publishing the "previewed, didn't publish" count (MRC #11) and the "no per-trade hiding" line (MRC #12) are
that kind of prompt. They make selective screenshots look selective, which raises the relative value of a full record for
honest traders.

**C7. FACT (Medium) on demand for commitment. HYPOTHESIS on size.** A review of lab and field evidence documents demand for
commitment devices, both hard and soft [S10]. A public record that can't be edited (TR-1, TR-5) is a soft commitment
device. That supports c1's S3 "accountability trader" as a segment that *wants* the restrictions. How many such traders
exist is unmeasured.

**C8. cycle-1 FACT, not re-opened this session.**
- Selective, convex transmission of returns between investors (c1 UT-S4).
- Peer-network entry roughly doubles the disposition effect (c1 UT-S5).
- 43% of investors aged 18-34 have traded options, and the sync skips options (c1 UT-P2).
- 56% of fintech-app users want per-account control (c1 UT-S12, 2018, industry-sponsored).

C1-C3 now give three independent results that point the same way: audiences make traders hide losses.

---

#### Per-candidate assessment

Gate key: **T** = traders ≥50, **S** = share ≥60%, **V** = external views ≥5,000/wk, **D7** = viewer D7 ≥15%. All gate effects
are ESTIMATE (rough, with assumptions stated) or HYPOTHESIS. "pts" = percentage points. Minimum n is the count needed for a
directional read. Metrics are first-party and aggregate, with no IP, user agent or third-party tags (P3, P6). Each one is
stored as a step or bucket, never joined to identity in logs.

| Rank | Item | (a) Evidence for trader demand / barrier removed | (b) Metric, weeks 1-8 (event · numerator / denominator · threshold · min n) | (c) Gate effect | (d) Verdict |
|---|---|---|---|---|---|
| 1 | **IDEAS #13** go-to-market (founder-led one-to-one, 10-20 anchors, time-based share prompt) + gate counters | C3: current posters are wins-only, so supply has to be hand-picked. c1: 75-160 contacts a week for 50 connects; links are 4-7× less visible than images | `funnel_events.landed{source=invite}` → `consented` · connects / invites sent (count kept outside the app) · ≥20% (c1 T5) · n≥100 invites | T: the main lever, +30-50 traders over 8 weeks if founder time is spent (ESTIMATE from c1 funnel). S: +5-10 pts from anchor mix. V: anchors drive most views (heavy tail). D7: indirect | **strong** |
| 2 | **C30** fix share-saved mislabel; split share rate by sign and tier; story vs square (part of MRC #3) | Instrument, not demand. As built, S is a proxy (c1 FC-K4..K6). C1-C2 predict that losing and thin records share less, and this split is what shows it | New `share_events(mode∈file/link/copy, format∈square/story/unfurl, sign∈up/down/flat, tier)`, no user id in the row · distinct sharers / connected traders · S≥60% · n=50 (report the CI) | Makes S readable and closes a possible false pass, so S *as measured* may fall 5-15 pts once failed shares stop counting (HYPOTHESIS) | **strong** (prerequisite) |
| 3 | **MRC #9** first 50 from transparency-led traders (hold paid-signal sellers) | C3 (wins-only norm), C7 (demand for commitment), C1 (followed traders hide losses, so pick people already committed to showing them), c1 UT-C10. Options gap: 43% of investors aged 18-34 | `landed{source}` bucket by recruit segment (founder's private tag, never stored with the user) · share within 14 days of import, per segment · transparency arm ≥ hobbyist arm · qualitative at n≈25/arm | T: −5 to −10 vs a broad pitch (smaller pool). S: +5-10 pts. V: lower per trader (small audiences). D7: neutral | **plausible** (supported by mechanism; segment size unknown) |
| 4 | **P-8** owner sees the public record ("View as visitor", closed editors, save status, preview when empty) | F-1 lands every new trader on their own profile. An 8,347 px form with 49-60 open inputs (design D-44) hides the thing they'd share. Seeing exactly what visitors see is the precondition for a confident share (HYPOTHESIS, consistent with c1 fear (b)) | `own_profile_viewed` → first share ≤7 days · sharers / traders who viewed own profile · ≥60% · n≥30 | S: +3-8 pts (HYPOTHESIS). T: +1-3 (the empty-profile preview cuts post-import confusion). V/D7: small | **plausible** |
| 5 | **F-4 / C27** finish card gaps: chart, trust table, period, preview text; no win rate | Owner's virality judgment (chart). C5: win-rate-led images resemble the regulators' red flag. c1 H1: shares follow chart shape and sign | `share_events` by card version (before/after the rebuild) · share rate · no drop for down-sign records · n=50, qualitative | S: +3-8 pts for up records, −0-5 for down (the chart makes losses visible). V: +10-30% per share (images travel; c1). D7: neutral | **plausible** |
| 6 | **MRC #11** whole-record preview as the connect disclosure; publish the "previewed, didn't publish" count | C1 (fear of losing followers on admitting losses): a preview replaces fear with facts. C6: the public count makes selection visible. P6 requires a disclosure anyway | New `funnel_events.preview_viewed`; existing `consented`/`declined` + `decline_reason` bucket (whole record, open positions, accounts under login, privacy, other) · declined / preview_viewed · report the rate, no pass line; flag if >50% · n≥30 (qualitative) | T: −3 to −10 (honest declines now happen before connect). S: +5-10 pts among publishers (no surprise after import). V/D7: neutral | **plausible** |
| 7 | **C29** story size reachable from the share control | Image-first is the channel c1 found strongest (§6). Vertical formats suit the short-video habits of adults 18-29. No direct source found | `share_events.format=story` / all shares · ≥15% of shares use story · n≥40 shares | S: +0-3 pts. V: +0-10% (a story without a link gets few clicks unless the printed handle is read) | **plausible** (weak evidence, low cost) |
| 8 | **D21** neutral "Sign in" with two paths, "Publish my record" first | Removes the "sign in = publish" fear for viewers; keeps the trader path first. F-1 instruments method and step | `funnel_events.method_chosen{path=publish|follow}` · publish-path starts / sign-in views; follow-path sign-ins / signed-out returners · publish ≥ before; follow path >0 · n≥200 sign-in views | T: 0 to +2. D7: + (more viewers become measurable; c1 G4 needs n≥200). S/V: 0 | **plausible** (viewer-led) |
| 9 | **C32** JoinCta, reworded, under the headline stats; referral aggregate only | Converts viewers who arrive via a shared card into traders, a no-cost acquisition loop allowed under F5/F6 | `landed{source=profile_cta}` → `consented` · connects / signed-out profile views · ≥0.1% · n≥5,000 views | T: at 1,000-5,000 views/wk × 0.1-0.3% × 40% completion ≈ 0.4-6 traders/wk (ESTIMATE). V/S/D7: 0 | **plausible** |
| 10 | **C33 + P-2** handle and name integrity (reserved, look-alike, 365-day rename hold, no "verified" names) | C5: regulators document fake profiles and imposters built from real people's details [S7][S9]. A trader with an audience needs their handle to be theirs | `handle_refused{rule}` count; impostor reports / profiles · 0 confirmed impostor of a connected record · n = all signups | T: ~0 (protects; may refuse a few handles). S: +0-2 for audience traders. V: protects V from spoofed traffic | **plausible** |
| 11 | **MRC #12** lead with "No per-trade hiding. Losses shown and ranked like gains." | C6 (prompting skepticism helps full disclosers), C5 (screenshot problem), C7 (S3 wants exactly this). S2 hobbyists want status, and this line is a cost to them | Invite-message variant tag in `landed{source}` (two founder message wordings) · connects / invites per wording · difference shown with CI · n≥100 per wording | T: + for S3/transparency, − for S2. Net ±3. S: +2-5 pts (self-selects honest sharers). V: slight + | **plausible** for S3; **weak** for S2 |
| 12 | **C35** thesis written-at time, "· edited", attribution | C3: traders write *longer* after losses. Theses give them a place to explain, which lowers the cost of a visible loss. A timestamp makes a pre-close thesis credible | `thesis_saved{state=published|held}` · traders with ≥1 thesis / connected traders · ≥30% · n=50 | S: +1-3 pts (down records with an explanation). D7: + (content worth returning for). T/V: 0 | **plausible** |
| 13 | **P-3** one trust language ("Verified from broker", Demo equal weight, anchored /how) | C5: traders want to look unlike the fakes. A badge that overclaims (reads as identity) is a liability for the trader too (F3a) | `/how#verified` visits from badge clicks / profile views (aggregate) · ≥1% · n≥2,000 views | S: +0-2. V/D7: + via viewer trust (unmeasured). T: 0 | **plausible** (indirect) |
| 14 | **C13** anti-crop band on trade and month images | C5: once cropped, an image is just a screenshot. The band keeps the date, Verified/Demo, record line and printed link next to the figure. For S2 it removes the wins-only crop (cost) | `share_events.format=trade` with the band vs before; visits with `?via=` per trade share · no drop in trade-share rate; via-visits per share up · n≥50 trade shares | S: −0-3 pts (less flattering). V: +10-20% per trade share (printed link) (HYPOTHESIS) | **weak** as trader demand; protects honest sharers |
| 15 | **MRC #13** delete the vendor connection on disconnect; keep the frozen record | c1 C6(d): 56% want control and fear lingering access. "Disconnect really ends access" removes a fear at connect time. Also stops vendor billing | `connections.disconnected_at` with vendor delete confirmed / disconnects · 100% · n = all disconnects | T: +0-2 (trust notice can say it). S/V/D7: 0 | **plausible** (cheap barrier removal; needs MRC #1 answer) |
| 16 | **D29** "Last close · updated", "Account 1 of 2", idle marker | Traders want their record to look current, and the honest flag helps active traders over dormant ones (C4 analogue). An idle marker is a cost to dormant traders | Profiles with `updated` older than 48 h / connected profiles · ≤5% (sync health) · n = all | S: −0-2 (idle traders). V/D7: slight + (fresh content). T: 0 | **weak** (trader side); viewer-led |
| 17 | **C34** report action on every profile and thesis | No trader demand found. It protects traders against impostors and abuse (C5) and is required before launch (U2) | `report_submitted{kind}` / profile views · triaged ≤48 h: 100% · n = all | Gates: ~0 | **weak** (required anyway) |
| 18 | **F-6** open positions in every number | Viewer trust is strong (C1, C2). For traders it is a barrier: followed traders hold losers (C1), so the unrealized side skews negative | Share rate split by `has_open_losses` (aggregate bucket) · gap ≤10 pts · qualitative at n=50 | S: −2 to −8 pts (HYPOTHESIS: records with open losses share less). T: −0-5 (consent screen shows it). V/D7: + trust, unmeasured | **weak** as trader demand; required (TR-4) |
| 19 | **C7** "Disconnected ‹date›" on profile, pane and feed card | C4: without it, records leave quietly after losses. For traders it removes the quiet exit, a pure cost | Disconnects / connected traders per week · disconnects within 7 days of a losing close vs other weeks · descriptive · n≥10 disconnects | T: −0-3 (fear of a visible exit, already implied by TR-5). Others: ~0 | **weak** as trader demand; required (TR-5) |
| 20 | **F-5** position size, opt-in | The owner's reasoning, plus c1 SIM C (careful sizers want it). The biggest fear in c1 is dollar exposure: one dollar figure posted elsewhere reveals the account. Blocked on vendor permission | Opt-in rate: `size_opt_in` / connected traders · descriptive · n≥50 | Weeks 1-8: 0 (blocked). Later: S + for careful sizers, T − if the opt-in is misread as required | **unknown** |

**Ranking logic.** Expected effect on T and S × strength of evidence × whether it is a precondition for reading the gates.
Items 18-20 rank low *as trader demand only*. They are product rules (TR-4, TR-5) or owner decisions, and nothing here argues
for dropping them.

---

#### Synthesis claims

**C9. HYPOTHESIS (Medium). Supply rests on three things, and none is a feature:** who is recruited (1, 3), whether the
gates can be read at all (2), and whether the trader's first session shows them the record visitors see (4). Card and
copy items (5-14) move share by a few points each. At n=50 none of them can be told apart from noise.

**C10. ESTIMATE (Low). The trust rules together cost share and connects:**
- F-6: −2 to −8 pts.
- C13: −0 to −3.
- MRC #11: −3 to −10 connects.
- C7 and D29: −0 to −3.

Selecting transparency-led supply recovers them: MRC #9 adds +5-10, and #11 adds +5-10 among publishers. The net for share
is about 0 to +10 pts when recruiting follows #9, and about −5 to −15 when it does not (S2-heavy). In the second case the
60% gate probably fails (P(pass) <30% at a true 50-55%, c1 table).

**C11. HYPOTHESIS (Medium). The main lever on V from the supply side is image-first sharing that carries a printed handle or
link:** C27 card, C29 story, C13 band. It is not more traders. c1's ~1.5-50× miss on V is not closed by any item here.

---

#### Sources

- **[S1]** "About the fear of reputational loss: social trading and the disposition effect". Journal of Banking & Finance
  94 (2018), 75-88. doi:10.1016/j.jbankfin.2018.07.003. Index page: https://ideas.repec.org/a/eee/jbfina/v94y2018icp75-88.html.
  Opened: yes (abstract only; the full text is paywalled).
- **[S2]** "Are investors reluctant to realize their losses?". Journal of Finance 53(5) (1998), 1775-1798.
  doi:10.1111/0022-1082.00072. Opened: no (HTTP 403). The figure is taken through [S3].
- **[S3]** "The disposition effect and investor experience". University working paper, MPRA No. 43570, 2013.
  https://mpra.ub.uni-muenchen.de/43570/. Opened: yes (PDF text). Cites [S2]: stocks with positive returns were 68% more
  likely to be sold.
- **[S4]** "The Impact of Internet Postings on Individual Investors". Working paper, 2017-12-01, AEA 2018 conference;
  published as "Do Individual Investors Trade on Investment-related Internet Postings?", Management Science, 2020.
  https://topcat.aeaweb.org/conference/2018/preliminary/paper/k6sdiHa8. Opened: yes (full text).
- **[S5]** "Why Do Hedge Funds Stop Reporting Their Performance?". University policy-studies centre working paper No. 124,
  March 2006. URL withheld (the path carries an author's name, T2). Opened: yes (PDF text).
- **[S6]** CFTC customer advisory "There's Nothing to Like About Scammers on Social Media" (the page is undated; search
  results date it to 2019). https://www.cftc.gov/ConsumerProtection/FraudAwarenessPrevention/CFTCFraudAdvisories/nothing_to_like_about_social_media_scammers.html.
  Opened: yes.
- **[S7]** SEC Office of Investor Education and Advocacy, "Social Media and Investment Fraud – Investor Alert", 2022-08-29.
  https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-alerts/social-media-and-investment-fraud-investor-alert.
  Opened: yes (text retrieved).
- **[S8]** FTC Data Spotlight, "Reported losses to scams on social media eight times higher than 2020", 2026-04-27.
  https://www.ftc.gov/news-events/data-visualizations/data-spotlight/2026/04/reported-losses-scams-social-media-eight-times-higher-2020.
  Opened: yes.
- **[S9]** FINRA Investor Insights, "Investment group imposter scams", 2025-12-09.
  https://finra.org/investors/insights/investment-group-imposter-scams. Opened: yes.
- **[S10]** "Commitment Devices". Annual Review of Economics 2(1) (2010), 671-698.
  https://ideas.repec.org/a/anr/reveco/v2y2010p671-698.html. Opened: yes (abstract).
- **[S11]** "Adaptive Skepticism in the Face of Uncertainty: An Experimental Study on Verifiable Information Disclosure".
  University working paper (CBESS 25-02), 2025. https://ideas.repec.org/p/uea/wcbess/25-02.html. Opened: yes (abstract).
- **Cycle 1 (not re-opened):** c1 UT-S4, UT-S5, UT-S12, UT-S15 and UT-P2 [V3], as cited in docs/direction/market-2026-11-01.md lines 3243-3420
  and 2039-2140.

#### Open questions

1. Does the vendor's written answer (MRC #1) allow deleting the connection while keeping the derived record (MRC #13)? If
   not, C7 and #13 conflict with billing.
2. How many transparency-led and accountability traders with supported brokers exist? Nothing sources this; founder
   outreach (c1 T5) is the practical measurement.
3. Should `decline_reason` (MRC #11) be one optional tap? It is the cheapest way to learn whether F-6, TR-2 or privacy drives
   declines. P3 allows a bucket with no identity.
4. C1 measured leaders who were *paid per follower*. Does the disposition rise persist without pay (F5)? C3 suggests that pay
   amplifies it, so the effect here may be smaller.
5. Owner: should share-gate reporting add the split by sign and tier (C30) as a parity diagnostic, not a gate?

## E2. Demand, viewers (DV)

### Cycle 2, pass 1: demand validation, viewers of records

**Member:** demand-validation analyst, demand side (viewers arriving from a shared link). **Pass:** 1, independent desk research.
**Date:** 2026-11-01. **Repo read:** POLICY, DESIGN §1.2/§3.5/Stage 5, F-2, F-3, F-4, F-6, IDEAS (D20-D29), cycle 1 Part A and F6/E6, creative §11, design proposals table. Repo state checked by grep at 0d42f65: no SW-1 first-run hint, no `/` og:image, no view table.
This is market research. It is not legal or investment advice, and it recommends no security or trade. No interviews exist; nothing below is user data.

#### Claims

**C1. FACT (High). The standard "past performance" disclaimer does not change what investors do, and it can backfire for low-literacy readers.** In an experiment, the regulator-mandated mutual-fund disclaimer had no effect on willingness to invest or on expected returns. A stronger statement, that high returns generally do not persist, did work [S1]. Three preregistered experiments (N=1,600) found the standard disclaimer did not help most participants. It was counterproductive for those with low financial literacy, while an alternative disclaimer stating a concrete rule did help [S2].
*Implication (HYPOTHESIS, Medium):* D20 is a compliance rule (POLICY F3) and costs nothing to keep. It will not build viewer trust or move any gate. The text adjacent to it does the protective work: the range, the evidence line and "losses included". Any wording change to the F3 sentence is the owner's.

**C2. FACT (High). Lay adults handle numeric ranges better than verbal hedges.** Across five experiments (5,780 people), including a field test on a national broadcaster's news site, numeric ranges barely lowered trust in a number and did not lower trust in the source. Verbal uncertainty caused most of the small loss [S3; full text 403, so this comes from the abstract and press summaries]. A review of forecast-communication studies reports that numeric uncertainty, including predictive intervals given as plain text, improved decisions and trust, at both high-school and college education levels [S4].
*Implication:* D23 (range first), F-4's "likely between" line and D24 have support. F-4's verbal tier lines ("Still early, and results could go either way") are the kind of verbal hedge that [S3] found costs a little trust. That favours keeping the numbers next to them.

**C3. FACT (High) on the effect, HYPOTHESIS (Medium) on transfer. Confidence intervals of a mean can mislead lay readers about individual outcomes.** In a crowdsourced experiment (n=1,000), people shown 95% confidence intervals overestimated a treatment's effect and paid more than people shown prediction intervals. They also underestimated how much individual outcomes vary [S5]. TR-9's interval is the interval of the *average trade*. "+1.3% per trade, likely between −0.1% and +2.7%" may therefore be read as "each trade lands in this band" (HYPOTHESIS). Single trades on the same profile will often fall far outside it.
*Implication:* this is the strongest new reason to run cycle 1's T10 comprehension test before D23 ships as the headline. It is also a reason for the "What's this?" line (D24) to say "the range is for the average, not for one trade".

**C4. FACT (High). About a third of the US sample has very low numeracy.** In the 2023 international adult-skills assessment, 34% of the US sample scored at or below its lowest numeracy level (Level 1), up from 29% in 2017 [S6].
*Implication (ESTIMATE):* roughly 1 in 3 people landing from a share card cannot reliably read a percent range unaided. That makes plain labels (D24), one number format (P-5) and one plain-language line (F-4) barrier removers, not polish.

**C5. FACT (High). Regulators describe the fake-record pattern this product inverts.** A derivatives regulator's advisory warns that scam profiles "flaunt wealth" and "brag about their huge 'win' percentages", post screenshots of winning trades or balances, and tells people to verify claims [S7]. The consumer-protection agency's April 2026 spotlight describes group-chat rooms full of fake "successful investors" and fake platforms that show fake profits [S8]. The securities self-regulator's December 2025 report flags misleading content and undisclosed conflicts in social investing content [S9].
*Implication (HYPOTHESIS, Medium):* two things follow. First, a headline that *leads with win rate* echoes the scam pattern, which supports D23. Second, "no per-trade hiding, losses shown" (MRC #12) answers the exact red flag regulators name. Both are claims about what reduces a documented harm. Neither is evidence that viewers seek them out.

**C6. FACT (High). Being up to date is a top-tier credibility factor, and popularity is the least valued.** In a probability-panel survey (n=1,031 adults, April 2025, ±3.7 pts), the factors picked most often as most important for judging money information were: based on research 32%, well-regarded source 26%, current and up to date 18%, relevant to people like me 17%. 54% named "many people liked it" as *least* important, and 21% named "I paid for it" [S10]. The same survey: 24% get money information from social media, 35% of adults 18-29 [S10].
*Implication:* D29 and P-4's freshness line ("Last close · updated") serve a factor about one adult in five ranks first. The absence of like counts (F-2) matches what viewers say they value. Payment is not a credibility signal, which is mildly negative for Record tools as a trust product.

**C7. FACT (Medium). Visual impression drives credibility judgments, and it forms fast.** In a 2,684-person study by a university web-credibility lab (2002), "design look" appeared in 46.1% of credibility comments, the most of any category [S11, company page]. A related experiment found visual appeal is judged within 50 ms, consistent with longer viewing [S12, not opened; citation only].
*Implication (HYPOTHESIS):* developer text and the completeness slip (D25), mismatched labels (P-3) and inconsistent numbers (P-5) cost credibility in the first glance, before any stat is read. The sources are old (2002/2006) and not finance-app specific, so confidence is Medium-Low.

**C8. FACT (High). Regulators treat selective display of results as misleading.** The adviser marketing rule bars including or excluding "performance results, or present[ing] performance time periods, in a manner that is not fair and balanced". Where it applies, it requires "one-, five-, and ten-year periods, each presented with equal prominence" [S13]. The rule is cited here as a design analogy only; whether it applies to this product is for the legal committee.
*Implication:* this supports TR-1/TR-7 and the MRC #12 positioning as aligned with an existing standard. It is not evidence of viewer demand.

**C9. FACT (High). Adults 18-29 trust social media information about as much as national news.** In September 2025, 50% of adults under 30 had at least some trust in information from social media sites. The figure was 51% for national news organizations, against 24% for social media at 65+ [S14].
*Implication (HYPOTHESIS):* the young adult viewer arrives *disposed to trust* a screenshot. The product's job is to make the record's limits visible (range, freshness, connected brokers), not to win trust from nothing. This cuts against heavy explanation copy.

**C10. HYPOTHESIS (Medium). Viewer-side features barely move the external-views gate. They move D7 and the readability of D7.** External profile views are produced by trader shares times reach (cycle 1: 1.5-50× miss). The only viewer-side items that touch views are those that change the unfurl or the landing-to-click path: the positioning line in metadata (C1/#12), the `/` image (C31; `/` is not a profile, so it does not count toward G3) and unique titles (P-9). Everything else acts on D7 or on conversion.

**C11. ESTIMATE (High arithmetic). Minimum samples.** These sizes give 80% power at α=0.05, using n ≈ 2(1.96+0.84)²·p(1−p)/d² per arm:
- Pane-open rate (base assumed 30%, lift +5 pts): ≈1,320 card impressions per arm.
- A lift of +3 pts: ≈3,660 per arm.
- D7 at 15%: ±4.9 pts at n=200 (cycle 1).
- A comprehension item at 80% correct: ±7.8 at n=100.
At the views gate (5,000 a week), a pane-open A/B reads in about 1 week. A D7 A/B needs ≥200 cohort members per arm, so 2-4 weeks at plausible sign-in rates.

**C12. HYPOTHESIS (High on the design, Low on legal fit). Signed-out D7 can be counted without identifiers.**
- On a first visit the page stores `first_visit_date` in first-party local storage and sends one `cohort_start` event (date only).
- On a visit 1-7 days later it sends one `cohort_return_d7` event carrying the cohort date. It then sets a flag so the event never repeats.
- The server stores daily counts only: no IP, user agent, token or user id. Bots are filtered before counting.
- D7 = Σreturns(cohort day) ÷ Σstarts(cohort day).
- Cleared storage and multiple devices bias D7 downward (conservative).
- Device storage is not a cookie, but the go-to-market decision says "no cookie". The legal committee should confirm this design fits P6 and the Privacy Policy before real viewers. The fallback is cycle 1's signed-in G4 cohort only.

#### Per-candidate validation

Columns: (a) evidence, with claim ids; (b) the first-party metric (event; numerator/denominator; threshold; minimum n); (c) expected effect on the gates: G1 traders, G2 share rate, G3 external views, G4 D7 (all HYPOTHESIS unless marked); (d) demand verdict and rank. All events are first-party counters with no identifiers on signed-out views (C12). "Pane-open" = SW-1 pane opens ÷ feed card impressions.

| Rank | Candidate | (a) Evidence | (b) Metric, threshold, min n | (c) Gate effect | (d) Verdict |
|---|---|---|---|---|---|
| 1 | **D22** record line on every feed card | C3, C4, C5: a lone big % on a card is the screenshot pattern; the line gives sample and range | Pane-open, D22 vs current card by alternating days; pass if not below control −2 pts, hope for +3; ≥1,320 impressions/arm. Secondary: "Too early to tell" share of cards | G4 small + (better choice of whom to follow); G3 0 | **Strong** (removes a barrier) |
| 2 | **D24** plain labels, "What's this?" | C4 (34% low numeracy), C3 (range misread), C2 | "What's this?" opens ÷ profile views (expect 5-15%, falling); T10 comprehension ≥70% (CI lower bound) at n≥100 | G4 small +; G3 0 | **Strong** |
| 3 | **P-7** sign-in by intent, safe return-to | C12: G4 as defined is signed-in, so losing the viewer's place at sign-in costs the cohort that gate reads | Return-to success = sign-ins landing on the origin route ÷ sign-ins from a record route; ≥95%; n≥100 sign-ins. Follow within the session after sign-in | G4 + (larger, readable cohort); G2 0 | **Plausible-strong** |
| 4 | **D29 + P-4** freshness and status line (incl. creative C7 "Disconnected") | C6 (18% rank "current" first), C5 | Profile views with a status line rendered ÷ profile views = 100% (test). Demand read: share of profile views that are repeat views of the same handle within 7 days (counter per handle-day, no viewer id) | G4 + (a reason to recheck "updated"); G3 0 | **Plausible-strong** |
| 5 | **C25 / P-6** swipe hint, place memory | SW-1 already Musts the hint; not built. Hidden gestures are rarely found (HYPOTHESIS; no source opened) | Pane-open among first-session cards, hint vs none for 1 week each; pass +5 pts; ≥1,320/arm. Back-navigation landing on the same card ≥95% (e2e) | G4 + (the pane is where records are met, F-6); G3 0 | **Plausible** (it is a Must anyway) |
| 6 | **D27** first-visit line | C7 (fast first judgments), C9 (viewers arrive disposed to trust), C6 | Signed-out landings: single-page exits ÷ landings and pane-open, line vs none (alternating days); pass if exits fall ≥3 pts or pane-open rises; ≥3,660 landings/arm | G4 small +; G3 0 | **Plausible** |
| 7 | **D23** average with range first | C2 for, C5 for (win-rate bragging is a red flag), C3 against (CI misread) | T10 first (≥70%), then three-version test: follow rate per profile view and "What's this?" opens; ≥1,000 profile views/arm | G4 ±0-small; G2 could fall if traders prefer win rate (HYPOTHESIS, Low) | **Plausible**, conditional on T10 |
| 8 | **MRC #12 / C1** positioning line | C5, C8: answers the named red flag; C10 | Click-through from unfurl = external landings ÷ shares recorded (by `via`), #12 wording vs C1 wording in alternating weeks; detect a 20% relative difference; ≥200 shares/arm (likely week 6+) | G3 small +; G2 + if traders like stating it (HYPOTHESIS) | **Plausible**; needs F3a review |
| 9 | **D25** remove developer text, "every stock" claim | C7; F3a compliance | No demand metric; a test asserts the strings are absent. Guard: empty-state exits | All ~0; removes a downside | **Plausible** (cheap; do it) |
| 10 | **F-2** personal discovery | C9; cycle 1 C6 herding risk; implicit logging off by default limits signal | D7 of viewers with ≥1 follow vs without (signed-in cohort; correlational); "More like what you read" opens ÷ section impressions ≥10%; n≥200 per group | G4 + (only for signed-in followers); G3 0 | **Plausible**, size unknown |
| 11 | **P-3** one trust language | C5, C7; F3a ("Verified" must not read as identity or audit) | T10 add-on item "what does Verified mean?" ≥70% answer "imported from the broker", n≥100 | ~0; reduces a misread | **Plausible** |
| 12 | **MRC #8** free limited Record tools | Cycle 1: payer is a narrow follower-chooser; C6 (paid ≠ credible) | Painted door (T8), free compare vs none: saved-view creation ÷ signed-in returning viewers; D7 of savers vs non-savers; ≥1,000 exposed per arm | G4 + for a small group; revenue unknown | **Unknown** (flag for owner; F-3 decision) |
| 13 | **C31** static og:image for `/` | C10; link posts are penalised (cycle 1) | External landings on `/` ÷ all external landings; no threshold (diagnostic) | G3 0 (not a profile); brand only | **Weak** |
| 14 | **P-9** wayfinding, unique titles, real 404s | C7; titles become unfurl text | 404 rate on shared paths ÷ external landings <1% | G3 tiny +; G4 tiny + | **Weak-plausible** (hygiene) |
| 15 | **P-5** one number format | C4 (consistency helps low numeracy, HYPOTHESIS) | A test that every surface uses the module; no demand metric | ~0 | **Weak** as demand; do it as hygiene |
| 16 | **Record tools (F-3)** | Cycle 1 (narrow paying job, $9.99 ceiling); C6: 2% rank "paid for it" first, 21% rank it least important | Painted door G5: joins ÷ signed-in returning viewers ≥3%, CI lower bound >1.5%, ≥1,000 exposed (T8) | G4 + for payers only (tiny); no gate tests it | **Weak-plausible** (unmeasured) |
| 17 | **D20** disclaimer in plain view | C1: no measurable behavioural or trust effect | Guard metric only: pane-open not below control −2 pts at ≥1,320/arm | ~0 | **Weak** as demand; **required** (F3) |

#### Cross-cutting conclusions

**C13. HYPOTHESIS (Medium). The top demand cluster is readability: D22 + D24 + T10, plus the D23 order.** The evidence agrees on three points:
- Numbers with ranges are accepted (C2).
- One-third of adults struggle with them (C4).
- The specific interval shown is easy to misread (C3).
So ship D22 and D24 first, and run T10 *before* D23's three versions are judged. If T10 fails, change the "What's this?" wording first. Do not drop the range: it is a TR-9 Must.

**C14. HYPOTHESIS (Medium). D7 is the gate viewer work can move, and signed-out return is unmeasured.** Without push (F3b), return depends on habit, links and follows. Candidates that feed a reason to come back are P-7, D29/P-4, F-2 and #8. Of those, P-7 and D29 are cheap and policy-safe. The C12 counter would turn D7 from a signed-in proxy into an all-visitor measure. That needs a legal committee check, and it should be committed before week 0 so definitions are fixed in advance (cycle 1 T3).

**C15. HYPOTHESIS (Low-Medium). Compliance items are not demand items, and the council should not credit them with growth.** D20, D25, P-5 and C31 are worth doing for policy and hygiene. Treating them as gate levers would double-count. The views gate stays a supply and distribution problem (cycle 1 §1.10).

#### Sources

- [S1] Academic paper "Worthless Warnings? Testing the Effectiveness of Disclaimers in Mutual Fund Advertisements", Journal of Empirical Legal Studies 7(3), 2010, doi 10.1111/j.1740-1461.2010.01184.x. https://econpapers.repec.org/RePEc:wly:empleg:v:7:y:2010:i:3:p:429-459 (opened: yes, abstract)
- [S2] Academic paper "Persistence is futile: Chasing of past performance in repeated investment choices", Journal of Experimental Psychology: Applied 28(2), 2022, https://doi.org/10.1037/xap0000358. Accepted manuscript on a university repository: https://eprints.whiterose.ac.uk/id/eprint/172480/ (opened: yes, PDF text)
- [S3] Academic paper "The effects of communicating uncertainty on public trust in facts and numbers", PNAS 2020, https://doi.org/10.1073/pnas.1913678117, PMID 32205438 (opened: no, 403 at the publisher and PubMed; findings from the indexed abstract and search summaries; Medium)
- [S4] Academic review on visualizing uncertainty for non-expert end users, Frontiers in Computer Science, 2021, https://doi.org/10.3389/fcomp.2020.590232 (opened: yes, first 100k characters)
- [S5] Academic paper "How Visualizing Inferential Uncertainty Can Mislead Readers About Treatment Effects in Scientific Results", ACM CHI 2020, https://doi.org/10.1145/3313831.3376454. Summary on a university lab page (URL withheld: path carries a person's name) (opened: yes, summary page)
- [S6] US Department of Education research institute press release on 2023 adult skills (PIAAC), 2024-12-10. https://ies.ed.gov/learn/press-release/u-s-adults-score-par-international-average-literacy-skills-below-international-average-numeracy-and (opened: yes)
- [S7] US derivatives regulator customer advisory on scammers on social media (undated page; first issued 2019). https://www.cftc.gov/LearnAndProtect/AdvisoriesAndArticles/nothing_to_like_about_social_media_scammers.html (opened: yes)
- [S8] US Federal Trade Commission data spotlight, social media scam losses, 2026-04-27. https://www.ftc.gov/news-events/data-visualizations/data-spotlight/2026/04/reported-losses-scams-social-media-eight-times-higher-2020 (opened: yes)
- [S9] Securities self-regulator report "Social Media-Influenced Investing", December 2025. https://www.finra.org/sites/default/files/2025-12/2025-social-media-influenced-investing.pdf (opened: yes, PDF text)
- [S10] Securities self-regulator's investor education foundation, "What Matters to Consumers When Assessing Information for Financial Decision Making", September 2025, n=1,031. https://finrafoundation.org/sites/finrafoundation/files/2025-09/What-Matters-to-Consumers-When-Assessing-Information-for-Financial-Decision-Making.pdf (opened: yes, PDF text)
- [S11] Company page, a consumer-advocacy nonprofit's summary of a university web-credibility lab study, 2002-10-29, opened 2026-11-01 (URL withheld under T1) (opened: yes)
- [S12] Academic paper on first impressions of web pages in 50 ms, Behaviour and Information Technology 25, 2006 (opened: no; citation from search results only; Low)
- [S13] Adviser marketing rule, 17 CFR 275.206(4)-1, (a)(6) and (d)(2). https://www.law.cornell.edu/cfr/text/17/275.206(4)-1 (opened: yes)
- [S14] National nonpartisan research organization, short read on trust in information from news organizations and social media, survey 2025-09-08 to 09-14, n=5,195. https://www.pewresearch.org/short-reads/2025/10/29/how-americans-trust-in-information-from-news-organizations-and-social-media-sites-has-changed-over-time/ (opened: yes)
- Cycle 1 record (docs/direction/market-2026-11-01.md Part A, F6, D1 R1-R34) for figures it already verified; not re-opened.

#### Open questions

1. Does the C12 device-storage counter fit P6 and the go-to-market decision's "no cookie" rule? This is a legal committee question.
2. T10 wording: does "likely between" for the *average* get read as a per-trade band (C3)? Test that item explicitly.
3. Can an alternative, concrete statement placed next to the mandated F3 sentence (C1, [S2]) be added without changing the F3 sentence? That is the owner's call.
4. No openable source gives D7 for web visitors arriving from a shared link. G4's 15% remains an unanchored target.
5. Who would see the pane-open A/B? It needs ≥1,320 impressions per arm, so it is readable only once external traffic exists (week 2+).

## E3. Measurement and experimentation (ME)

### Cycle 2, pass 1: measurement and experimentation plan (weeks 1-8)

**Member:** measurement and experimentation analyst. **Pass:** 1. **Date:** 2026-11-01. **Repo HEAD:** 0d42f65 (read-only).
This is market research, not legal or investment advice. It recommends no security or trade. Labels: FACT (code at file:line, or a
source opened this session), ESTIMATE (arithmetic shown), HYPOTHESIS (judgment). Confidence: H/M/L.

---

#### 1. State of the code: nothing changed since cycle 1

**C1. FACT (H).** In the 12 commits from cycle 1's audit commit (15ca6c3) to HEAD (F-4 share card #25, F-6 open positions #33, CI
shards, the idea board), no measurement file changed: `lib/funnel.ts`, `lib/referral.ts`, `app/share-button.tsx`, `app/actions.ts`,
`app/u/[handle]/share-card.tsx`, `lib/auth/sessions.ts`, `app/nav-login.tsx`. The only schema change is one index
(`git diff 15ca6c3 HEAD -- db/schema.sql`, +3 lines at L381-383). Cycle 1's findings FC-K1..K6 and K10 all still hold.

**C2. FACT (H). Inventory as built.**

| Need | Exists today | Evidence |
|---|---|---|
| Profile or feed view capture | **None.** The schema has 20 `create table` statements and none is a view table. No code reads `Referer`; the only hits are `rel=noreferrer` and the `?ref` helpers. There is no middleware or proxy file at the repo root | `db/schema.sql`; `grep -i referer app lib` |
| Visitor landing | `landed` is written only inside `createAttempt`, after the 18+ box is ticked | `lib/auth/attempts.ts:24`; `app/auth/actions.ts:59` |
| Source tag on shared links | **None.** The share URL is the bare path | `app/u/[handle]/share-card.tsx:15`; `trade/[sellId]/trade-share.tsx:10` |
| Nav attribution | **New finding:** `via=nav` is sent, but `'nav'` is missing from `REFERRED_SURFACES`, so `normalizeVia` returns null and the landing is recorded as `'profile'` | `app/nav-login.tsx:9`; `lib/referral.ts:12-17`; `app/auth/actions.ts:30,59` |
| Trader share | `share_prompt_action`: first positive action wins | `db/schema.sql:41`; `app/actions.ts:62-69` |
| | `share_image_saved_at`: its schema comment says "Save image link", but the profile "Share my record" button sets it (**mislabel**) | `db/schema.sql:63-64`; `share-card.tsx:16` |
| | Month-recap share is unrecorded in both places | `share-card.tsx:18-19` (no `onShared`); `month/[ym]/page.tsx:102` (`isOwner={false}`) |
| | `trade_shared_at` is overwritten on every share, so shares cannot be counted | `app/actions.ts:92` |
| | `badge_copied_at` has no writer | `db/schema.sql:61` |
| What counts as a share | A copy or a share-sheet completion. A cancelled sheet is not counted; a failed copy is not counted. A copy is not a post | `app/share-button.tsx:36-56` |
| Signed-in return | `sessions.last_seen_at` is overwritten, at most hourly | `lib/auth/sessions.ts:46`; `db/schema.sql:228` |
| Connected traders (G1) | Measurable from the connection state and timestamps, `disconnected_at` and the `is_paper` flag | `db/schema.sql:263-285, 302` |
| Connect funnel | 14 enumerated steps. `declined` takes no reason | `db/schema.sql:249-256`; `lib/funnel.ts:9-12` |
| Unfurl images | Image routes exist and log nothing | `app/u/[handle]/opengraph-image.tsx`, `trade/[sellId]/opengraph-image.tsx`, `story/` |
| Payment intent (G5) | None. F-3 billing is not built and the schema has no billing tables | `db/schema.sql`; F-3 Status: ready |

**C3. FACT (H) → constraint.** F-2 allows viewer-id events only when "Personalize with my activity" is On. Its raw events are deleted
at 90 days, and its events feed ordering (F-2 L85-92, L105-107). The schema has no table for F-2 events yet. So measurement events
**must be a separate store that never feeds ranking**: POLICY F6 forbids counting likes or follows, and F-2 makes personalization
logging opt-in. This plan therefore keeps gate counters aggregate-only, with no viewer id.

---

#### 2. Event dictionary (proposal; aggregate counters wherever possible)

Design rule (HYPOTHESIS, H on fit with P3/P6):
- Every viewer-side event is an **increment on a daily rollup row**, not a per-visit row. Rows carry no timestamp finer than the day
  and no viewer identifier.
- IP and user agent are read once, in memory, for the bot check, then dropped. The full `Referer` is reduced to a 3-value bucket.
- Trader-side events can carry the trader's own user id, because the action is on the trader's own account.
- None of this needs a third-party script.

| # | Event (table) | Fires when | Fields kept | Never kept |
|---|---|---|---|---|
| E1 | `view` (rollup `view_counts`) | A first-party beacon posted by the page after it has been visible for 2 seconds, for a request that passed the bot check (§4) | day; surface (feed / profile / trade / month / ticker / compare); target trader id (public, null for feed); ref_bucket (`external` / `same_site` / `none`); via (`card` / `trade` / `month` / `story` / `none`); signed_in (bool); self_view (bool, so the owner's own views are excluded) | IP, user agent, full referrer, query string, viewer id, cookie value, time of day |
| E2 | `fetch_dropped` (rollup) | A server render rejected by the bot check, or one with no beacon within 30 minutes | day; surface; reason (`declared_bot` / `no_fetch_metadata` / `no_beacon` / `rate`) | Same as E1 |
| E3 | `unfurl` (rollup) | A link-preview client fetches the page or an og or story image | day; target trader id; route (`page` / `og_image` / `story`); class (`preview` / `search` / `other`) | Same as E1 |
| E4 | `cohort_visit` (rollup) | First beacon of the day from a signed-out browser | day; first_visit_day, read from a first-party cookie whose **value is a date, not an id**; arm (A/B/none) | Any per-browser identifier |
| E5 | `share_action` (rows) | The trader's share sheet completes or a copy succeeds | trader id; at; surface (`profile_card` / `prompt` / `trade` / `month` / `story`); outcome (`sheet` / `copy`); record_sign at that moment (`pos` / `neg` / `flat`, for C30's split) | Destination app, link text, recipients |
| E6 | `active_day` (rows) | First authenticated request of the day | user id; day. Retention 120 days | Pages, surfaces, timestamps |
| E7 | funnel additions | Add `declined` with an enumerated non-identifying reason; add `previewed` and `published` (#11) | Existing `funnel_events` schema | Same as `lib/funnel.ts` |
| E8 | `door` (rollup) | A Record tools painted door is shown, clicked or joined (#6) | day; arm; step; returning (bool) | The waitlist email: stored separately, deletable, never joined to E1 or E8 |
| E9 | `outreach` (founder's sheet, no personal data in the repo) | Each founder contact | week; message variant; segment; connected (y/n) | Names, handles, contact details |

Fix-ups that come before E1-E9 (FACT-based, H):
- Make `share_image_saved_at` mean what its comment says.
- Record month shares by the owner.
- Add `nav` to the surfaces list.
- Stop overwriting `trade_shared_at` (E5 replaces all four share columns).
- Append `?v=<via>` to the URLs the share button produces.

**C4. FACT (H) [S2][S4].** Senders must or should omit `Referer` in several cases: typed or bookmarked URIs, secure-to-insecure, and
cross-origin without explicit allowance. The policy model sends only the origin cross-site, or nothing under `no-referrer`.
**ESTIMATE/HYPOTHESIS (M):** many app webviews and messaging clients arrive with no referrer. A referrer-only "external" count
undercounts the gate. G3 therefore counts `ref_bucket=external OR via≠none`, and reports `none` without `via` as its own bucket.

**C5. HYPOTHESIS (M), privacy.** The E4 date cookie is first-party and holds a value shared by everyone who first visited that day.
It is not a tracker under P6's wording.
- It is still a cookie, and it must appear in the Privacy Policy before real users (P6).
- The legal committee should confirm whether it needs consent where consent rules apply.
- Cookie loss (private windows, in-app browsers with separate cookie jars) biases signed-out D7 **downward**. A difference between
  arms is unbiased only if the loss is equal in both arms.

---

#### 3. Gate definitions, power, inconclusive bands, readout

All definitions are pre-registered in `docs/` before week 1, and readings use only post-launch, non-demo data. Arithmetic: exact
binomial, score intervals, and one-sided α=0.05 with 80% power (z 1.645 + 0.842) unless stated.

**G1, connected traders (ESTIMATE, H).** Distinct users at week end who meet all of these:
- a connection in state `connected` with `disconnected_at` null, or frozen after a connect;
- at least one confirmed non-paper account;
- at least one imported closed trade;
- not demo.

It is a count, so it has no sampling error. Bands (cycle 1): continue ≥50, inconclusive 35-49, stop <35.

**G2, share rate (ESTIMATE, H).** The numerator is G1 traders with at least one E5 by the end of week 8. A second line reports the
**14-day share rate per weekly connect cohort**, because late joiners have less time to share.

| True rate | P(continue, ≥30/50) | P(inconclusive, 26-29) | P(stop, ≤25) |
|---|---|---|---|
| 45% | 2.4% | 17.3% | 80.3% |
| 50% | 10.1% | 34.3% | 55.6% |
| 55% | 28.6% | 43.0% | 28.4% |
| 60% | 56.1% | 34.1% | 9.8% |
| 65% | 81.4% | 16.5% | 2.1% |

- 30/50 has a score-interval CI of 46-72%. 26/50 has 39-65%.
- Telling 60% apart from 45% needs n = ((1.645·√.24 + 0.842·√.2475)/.15)² ≈ **67**. Telling 60% from 50% needs ≈ **151**.
- At n=100 (the extension), a true 60% passes ≥60/100 54% of the time and stops at ≤50 2.7% of the time.
- Conclusion: n=50 sorts out ≤45% or ≥65% reasonably well. The band between is genuinely inconclusive.
- Report "copy" and "sheet" separately. Add E3 unfurls per share as a **proxy for actually posting**. HYPOTHESIS (M): a pasted link
  triggers a preview fetch on most messaging and social clients, but caching by those clients makes this a lower bound.

**G3, external views a week (ESTIMATE, M).** The sum of E1 where surface ∈ {profile, trade, month}, self_view is false, and
(ref_bucket=external or via≠none), over ISO weeks.
- It is a count, so the noise is week-to-week burstiness, not sampling error. One viral post can supply most of a week.
- Continue: the median of weeks 6-8 is ≥5,000.
- Inconclusive: the median is 3,500-4,999, or ≥5,000 in only one week.
- Stop: <3,500.
- Shown alongside: monthly uniques per connected trader (cycle 1's floor of ≥56), the share of views from the top trader (a
  concentration warning above 50%), E2 drops and E3 unfurls.
- Cycle 1 put the likely miss at 1.5-50×. So this gate needs instrument precision of about ±20%, not statistics.
- **Validation:** before week 1, run 200 scripted preview fetches and 50 human visits on test profiles. Pass if ≥95% of the scripted
  fetches are dropped and ≥95% of the human visits are counted.

**G4, viewer D7 (ESTIMATE, H).**
- Primary cohort: signed-in non-trader viewers (E6), by first active day. A return counts if the viewer is active on day 7 (±1 day
  for timezone).
- Secondary: signed-out returns from E4 cohorts, labelled "biased low".
- At n=200 the ±1.96·√(.15·.85/200) margin is **±4.9 points**. 30/200 has a score-interval CI of 10.7-20.6%.

| True D7 | P(≥30/200, continue) | P(≤21/200, stop below ~10.5%) |
|---|---|---|
| 10% | 1.6% | 55.9% |
| 12% | 11.8% | 22.7% |
| 15% | 53.0% | 2.5% |
| 18% | 88.6% | 0.1% |

- Telling 15% apart from 10% needs n ≈ **282**. Telling 15% from 12% needs n ≈ **824**.
- Inconclusive: 22-29 of 200, or a cohort under 200.
- **ESTIMATE (L):** with signed-in viewers at 2-5% of 1,000-10,000 monthly uniques, the signed-in cohort is 20-500 over 8 weeks. G4 is
  quite likely **inconclusive by sample**. Pre-register that a short cohort is not a miss.

**G5, payment intent (directional; ESTIMATE, M).** Waitlist joins as a share of signed-in returning viewers exposed to the door.
- 30 joins out of 1,000 exposed is a 3% rate with a score-interval CI of 2.1-4.3%.
- Telling 3% apart from 1.5% needs ≈ **652** exposed.
- At the G4 volumes above, 8 weeks reaches at most a few hundred exposed. Read G5 as a **lower bound on interest** and do not use it
  as a pass/fail gate in this window. Converting it to a paying stock still needs cycle 1's assumed discount.

**G0** (the vendor's written answer) is a document, not a metric.

**Weekly readout (one table, published every Monday; HYPOTHESIS on format):**

| Week | G1 count (new / disconnected) | G2 cumulative x/n, score-interval CI; 14-day cohort rate; sheet:copy; pos:neg share rate | G3 external views (via / referrer / none-only); uniques per trader; top-trader share; dropped; unfurls | G4 cohort n, D7 x/n, CI; signed-out D7 (biased low) | G5 exposed / joined | Status per gate: on track / inconclusive / off track |
|---|---|---|---|---|---|---|

Every line that shows performance carries F3: "Not investment advice. Past performance does not guarantee future results."

---

#### 4. Bot and crawler filtering

**C6. FACT (H) [S1].** Crawlers identify themselves with a product token that should appear in the User-Agent. RFC 9309 says
robots.txt rules "are not a form of access authorization", and it has no enforcement mechanism. Link-preview fetchers act on a
user's paste, so robots.txt does not stop them. They have to be filtered at count time.

**C7. FACT (H) [S2].** User-Agent SHOULD be sent and SHOULD name the product. This is self-declared and trivially forged.

**C8. FACT (M) [S3].** Browsers send `Sec-Fetch-Mode: navigate` and `Sec-Fetch-Dest: document` on page navigations. Support in
major engines dates from 2019-2023 versions. The spec is a W3C Working Draft (2026-09-21).

**C9. FACT (M) [S6][S7].**
- A 2026 academic study reports about half of web requests are automated, citing an edge-network provider's report.
- Matching user agents to bot keywords and lists caught 67.6% of bots with 3.0% false positives on 4.6M requests.
- Only about 11% of bot IPs requested robots.txt.
- A 2024 framework reaches ≥98% precision and recall from browsing behavior.

Lesson: user-agent filtering alone is not enough. A behavioral signal is needed.

**Filter stack, cheapest first (HYPOTHESIS, M):**
1. Drop requests whose user agent is a declared bot: a generic regex (bot, crawl, spider, preview, fetch, http-client libraries) plus a
   maintained list kept in code under generic names.
2. Drop page requests without `Sec-Fetch-Mode: navigate`. Count them as `no_fetch_metadata` so false drops from old browsers stay
   visible.
3. **Count a view only on the visible-for-2-seconds beacon.** Most preview fetchers read the `<head>` meta tags [S5] and do not run
   scripts or stay visible.
4. A per-IP in-memory rate cap (more than 30 renders in 10 minutes) that is never persisted.
5. Classify image-route and HEAD fetches with no beacon as E3 unfurls, not views.

Only counters by reason are stored. The 200/50 validation in §3 G3 is the acceptance test.

---

#### 5. Reading a candidate's effect without A/B infrastructure

**Template (HYPOTHESIS, M).**
1. Pre-register a single outcome and its denominator. Prefer per-view rates to weekly totals, because totals swing with bursts.
2. Choose a design:
   - **Day switchback (ABBA blocks of 2 days)** for viewer-facing UI. A first-party cookie holds the arm letter, shared by all
     viewers in that arm, so a viewer stays in their first-day arm for D7 reads.
   - **Holdout weeks (ABAB by week)** for site-wide changes.
   - **Within-trader alternation** (odd and even weeks per trader) for trader-side surfaces.
3. Analyze with day or trader as the cluster. Design effect = 1 + (m−1)·ICC. At m=50 views per trader-day and ICC 0.02 this is about
   2, which multiplies the MDE by about 1.41 (ICC is an assumption).
4. Interpret against the MDE below. Smaller effects are "not detectable", not "no effect".

**MDEs (ESTIMATE, H on arithmetic; two-sided α=.05, power 80%, z=2.80):**

| Unit / design | Baseline | MDE |
|---|---|---|
| 50 traders, split 25/25, binary outcome | 50-60% | 2.80·√(2·.25/25) = **±39-40 points** |
| 50 traders, paired before/after, log weekly views, ρ=0.5 | SD 1.0 (assumed) | 2.80·√(2·.5/50) = 0.40 SD, about **×1.49**; ×1.75 with DEFF 2 |
| 50 traders, independent halves, same metric | SD 1.0 | 0.79 SD, about **×2.2** |
| 1,000 viewers (500/500), D7 | 15% | 2.80·√(2·.1275/500) = **±6.3 points** |
| 1,000 viewers, CTA or join click | 3% | **±3.0 points** (a doubling) |
| 1,000 viewers, CTA click | 1% | ±1.8 points; at 2,500 per arm ±0.8 points |
| 1,000 vs 1,000 before/after, D7 | 15% | ±4.5 points, with secular drift confounded |
| Weekly totals, 8-week switchback 4 vs 4 | week-level SD | (2.447+0.906)·√(2/4) = **2.37 SD**; with 12 weeks, 6 vs 6: 1.79 SD |
| Founder outreach message A/B, 300 contacts per arm | 20% connect | **±9.1 points** |

Conclusion (ESTIMATE, H): at n=50, trader-level experiments detect only very large effects. Viewer-level per-view rates at 1,000 or
more per arm detect effects that double the rate or shift it by 5-6 points. Weekly totals detect almost nothing.

---

#### 6. What can and cannot be measured in 8 weeks

Expected volumes (ESTIMATE, L):
- 50 traders or fewer.
- 75-160 founder contacts a week, so about 600-1,280 in total.
- External views 100-3,300 a week, from cycle 1's 1.5-50× miss.
- Signed-in viewers 20-500.

| Class | Candidates | Readable outcome / design | Verdict |
|---|---|---|---|
| **Measurable (viewer rates, volume permitting)** | D22 record line on feed cards; P-6 reading mode; C25 swipe hint | cards advanced per page load (beacon carries a count, no id); day switchback | Yes if ≥1,000 page loads per arm. Big effects only |
| | C32 JoinCta under stats; D21 / P-7 sign-in paths | CTA click per profile view → `landed` → `consented`; switchback | CTA click: yes at ≥2,500 views per arm. Funnel completion: about ±13-20 points at 150-300 attempts, so large effects only |
| | D27 first-visit explanation | signed-out D7 by arm (E4) | Only if ≥1,000 new visitors per arm, about ±6 points |
| **Measurable by outreach A/B** | #12 / C1 positioning line; #9 transparency-led segment | connect rate per message or segment (E9) | ±9 points at 300 per arm. The best-powered test available |
| **Descriptive only (no comparator)** | #11 whole-record preview; C30 split by record sign | previewed→published (about ±11 points at n=80); share rate pos vs neg | Report. No causal claim |
| | #6 painted door (G5) | joins per signed-in returner | A lower bound; under 652 exposed |
| **Instrument, not experiment** | #3, #13 (IDEAS), #4, #5; C7; C31; C27 | E1-E8 themselves | Build before week 1 |
| **Cannot measure in 8 weeks → decide on principle** | D20 disclaimer, D25 developer text and completeness slip, D26 production switch (POLICY F3 and F-claims) | — | Required by policy, not optional |
| | #1 vendor answer, #2 sync cadence, #13 delete the vendor connection, #14 deny-list (vendor and cost compliance) | — | Principle |
| | C33-C36, P-1, P-2 (integrity and moderation): rare events | — | Principle |
| | D23, D24, D29, P-3, P-4, P-5, P-9 (comprehension) | a T10-style comprehension check, n≥100 | Not behavioral |
| | C13, C29, C27 (share-image changes: trader n is too small) | — | Principle; E3 unfurls only as a descriptive check |
| | #7 trial arm, #8 free limited tools | need real charges (F-3 test mode) | After week 8 |
| | P-8, P-10 | — | Engineering quality |

---

#### Open questions
1. Does the owner accept aggregate-only views, with no per-visit rows? Per-visit rows would allow cluster analysis but raise P3 cost.
2. G4 primary definition: day-7 activity (±1 day) or any return within 7 days? These differ by roughly 2×. Pre-register one.
3. Does the date cookie in E4 need consent where consent rules apply? Question for the legal committee.
4. Does adding `?v=` to shared URLs change preview caching or the canonical URL? `og:url` should stay canonical [S5].
5. Should "inconclusive" count as a miss under "miss two or more"? Cycle 1 proposed not; the owner has not decided.

#### Sources
- [S1] RFC 9309, Robots Exclusion Protocol, IETF standard, 2022. https://www.rfc-editor.org/rfc/rfc9309.html. Opened: yes.
- [S2] RFC 9110, HTTP Semantics, §10.1.3 Referer and §10.1.5 User-Agent, IETF standard, 2022.
  https://www.rfc-editor.org/rfc/rfc9110.html. Opened: yes.
- [S3] Fetch Metadata Request Headers, W3C Working Draft, 2026-09-21. https://www.w3.org/TR/fetch-metadata/. Opened: yes.
- [S4] Referrer Policy, W3C Candidate Recommendation, 2017. https://www.w3.org/TR/referrer-policy/. Opened: yes.
- [S5] The link-preview metadata protocol specification (meta tags in `<head>`; og:image and og:url); protocol site, URL withheld under T1. Opened: yes.
- [S6] An academic paper on lightweight robot detection from web-server logs (university authors), arXiv 2603.28546 v2, 2026-03-31.
  https://arxiv.org/abs/2603.28546. Opened: yes.
- [S7] An academic framework for telling bots from humans by behavior, arXiv 2412.02266, 2024-12-03. https://arxiv.org/abs/2412.02266.
  Opened: yes (abstract).
- [S8] Cycle 1 chair's synthesis, internal, docs/direction/market-2026-11-01.md Part A §9 and §11. Opened: yes.
- Repo files cited at file:line: HEAD 0d42f65, read-only.

## E4. Pricing, willingness to pay (PW)

### Cycle 2, pass 1: Pricing analyst (willingness to pay and benchmarks)

Member: pricing analyst (willingness to pay and benchmarks). Cycle 2, pass 1 (independent desk research), 2026-11-01.
Repo inputs read: docs/features/F-3 (all decisions and open questions), docs/IDEAS.md #1/#3/#14 and the 2026-11-01 board
review of ideas 1, 3 and 14, docs/POLICY.md F1-F6, cycle 1 chair synthesis §5 and §10, cycle 1 pricing analyst pass 1 (F7),
c1/projection-assumptions.json. Nothing here recommends any security or trade. Author names of papers are omitted (T4);
papers are cited by venue type, year and DOI.

Arithmetic conventions (used throughout): processor fee 2.9% + $0.30 per successful US card charge, subscription billing
0.7%, tax 0.5% [S1]. Net per charge = P × 0.959 − $0.30. Plan mix 65% monthly / 35% annual (projection base). Cycle 1
break-even at scale: BE conversion = (trader_share × $1 + $0.004) ÷ net per payer-month.

#### Claims

**C1. FACT (High). Fees verified; $9.99 nets $9.28 a month, and fees take a larger bite the lower the price.**
The processor's public pricing page lists 2.9% + 30¢ for domestic cards, +1.5% international, +1% currency conversion,
0.7% subscription billing (pay-as-you-go) and 0.5% per transaction for no-code tax [S1]. ESTIMATE from those: fee share is
10.1% at $4.99, 7.9% at $7.99, 7.1% at $9.99, 6.1% at $14.99; annual plans 4.3-4.9%. Blended net at $9.99/$99.99 is $8.82,
reproducing cycle 1's $8.80. International cards add 1.5 points; disputes and refunds are not in these numbers.

**C2. ESTIMATE (High on arithmetic, Low on inputs). Revenue-equivalence table: what conversion lift each arm needs to beat
$9.99/$99.99.** Trader data cost is independent of price, so profit per viewer equals conversion × net minus a fixed cost per
viewer; an arm beats the control only if conversion × net is higher.

| Arm (monthly / annual) | Net per payer-month (blended) | Conversion multiple needed vs $9.99 | BE conv at trader_share 0.46% / 2% / 10% |
|---|---|---|---|
| $4.99 / $49.99 | $4.31 | 2.05× | 0.20% / 0.56% / 2.42% |
| $7.99 / $79.99 | $7.01 | 1.26× | 0.12% / 0.34% / 1.48% |
| $8.99 monthly only | $8.32 (monthly) | 1.12× (monthly) | — |
| **$9.99 / $99.99 (owner)** | **$8.82** | 1.00× | **0.10% / 0.27% / 1.18%** |
| $14.99 / $149.99 | $13.34 | 0.66× (wins unless conversion falls >34%) | 0.06% / 0.18% / 0.78% |
| $9.99 / $79.99 (deeper annual, 33% off) | $8.26 at 35% annual | see C7 | — |

Annual-only comparisons: $49.99 needs 2.01×, $79.99 needs 1.25×, $149.99 needs 0.67× the conversion of $99.99.
$10.00 vs $9.99 changes net by one cent; the choice there is perceptual only (C3).

**C3. FACT (Medium) on the source; HYPOTHESIS (Medium) on application. Charm pricing: keep the 9-ending where it changes the
left digit; it is worth little elsewhere.**
- A five-experiment lab study found nine-ending prices are perceived as smaller than the price one cent higher only when the
  leftmost digit changes ($2.99 vs $3.00), and more so when the comparison price is close [S2].
- Three randomized field experiments at a catalog retailer found a $9 ending raised demand in all three, more for new items
  and less when "Sale" cues were present; the authors suggest it works best when buyers have little price information [S3].
- A later field experiment found the apparent .99 effect vanished once substitute prices were controlled for [S4].
- Application: $9.99 vs $10.00 is the strongest case (left digit and digit count change), and a new product with no
  reference price is where the field evidence is strongest. $7.99 vs $8.00 is the same pattern. Charm endings do not make a
  lower arm cheaper to test; they decide the ending only.

**C4. FACT (Medium) on the source; HYPOTHESIS (Low) on transfer. Annual framing: per-month restatement helps small totals,
hurts large ones; discounts are the one offer lever with peer-reviewed field support in paid content.**
- Lab studies: restating an aggregate price as small recurring amounts ("pennies a day") shifts the comparison people
  retrieve toward small everyday expenses and raised compliance across product categories [S5]. Search-result abstract of a
  follow-up paper (not opened): the effect reverses at large magnitudes [S6]. $99.99/year shown as "$8.33 a month" is a
  small-magnitude case.
- Observational field study on 21 paywalled news sites (about 28,500 weighted cases): a discount raised the odds of paying
  3.35× (95% CI 1.16-9.66); base price, trial length and paid trials were not significant; showing a teaser intro cut
  "subscribe" clicks by 72% [S7]. The teaser finding is the closest evidence for this product's structure: the more free
  content answers the visitor's question, the less they pay. Stock Social's whole record is free by rule (F-3), so the paid
  layer must sell something the free record does not answer.
- Constraint: the board resolved no plan preselected and both prices shown equally (COMPLIANCE §4); savings copy "about 17%".
  "$8.33 a month, billed $99.99 yearly" is presentation, not a preselection, but needs the legal reviewer to confirm it
  meets the ROSCA/state disclosure order.

**C5. FACT (Medium) on the sources; HYPOTHESIS (Low) on transfer. Decoy/anchor effects are too unreliable to design on.**
A journal replication program reported that 91 attempts to produce an attraction (decoy) effect across 23 product classes
yielded only 11 reliable effects, smaller with meaningful descriptions [S8, search abstract only, not opened]. A three-plan
ladder built to push a middle plan would also sit badly with the no-preselection condition. A $14.99 arm is worth testing as
a price, not as an anchor.

**C6. FACT (High) on the sources; ESTIMATE (Medium). Trials: peer-reviewed field experiments say a short trial raises
conversion modestly; base rates support cycle 1's low prior.**
- A large randomized trial-length experiment in a software-as-a-service product found that, on average, shorter trials
  maximized acquisition, retention and profit versus a uniform 30-day trial; inactivity late in a trial predicted
  non-conversion [S9].
- A two-year randomized experiment on 680,588 new registered users of a freemium image-editing product: 7-day vs 3-day
  trial raised total paid conversion from 0.368% to 0.445% (+20.9%), all of it delayed conversion; immediate conversion was
  unchanged [S10].
- ESTIMATE: [S10]'s two-year cumulative paid rate among *registered* users is 0.37-0.45%. Share-link viewers of Stock Social
  are less committed than registrants, and the paid layer is thinner than an editing tool's. This is the first peer-reviewed
  anchor for cycle 1's 0.1-0.5% stock prior and supports its lower half. Neither study compares trial vs no trial on
  visitor-to-paid; the board's UNVERIFIED tag on "trials beat no trial" stands.

**C7. ESTIMATE (Low). A deeper annual discount pays only if it shifts plan mix a lot.**
Using cycle 1's facts (17.0% of monthly plans and 44.1% of yearly plans still paying at 12 months): monthly churn ≈ 13.7%, paying
life ≈ 7.3 months × $9.28 = $68; annual expected life ≈ 1 ÷ (1 − 0.441) = 1.79 years × $95.59 net = $171. An annual payer is
worth about 2.5× a monthly payer. Blended lifetime per payer at 35% annual: $104. With a $79.99 annual (net $76.41, life value
$137), lifetime per payer stays at $104 only if the annual share rises from 35% to ≥52% at equal conversion.
Cycle 1's retention-by-price figures (monthly 12-month retention 22.5% low-priced vs 16.4% mid) imply ≈1.2× longer life at a
lower price; if $7.99 fell in the "low" band and $9.99 in "mid", the $7.99 arm's needed lift drops from 1.26× to ≈1.05× on
lifetime value. Band definitions in that report are unknown, so this is a sensitivity, not a finding.

**C8. ESTIMATE (High). Only a 2× arm is detectable at gate-scale traffic; a $7.99 arm is not testable before scale.**
Two-sided α 0.05, power 0.8, priced notify-me rate as the outcome: detecting 1.26× from a 3% base needs ≈8,400 exposed
returning viewers per arm (≈25,900 from a 1% base); 1.5× needs ≈2,500 (≈7,700); 2.07× needs ≈670 (≈2,100). At the gate's
5,000 external views a week with ~15% D7 return, a two-arm test of $4.99 vs $9.99 is feasible in weeks; $7.99 vs $9.99 is
not. Stated intent overstates paying (hypothetical bias), so these arms rank prices, they do not forecast conversion.

**C9. FACT (High). What adult retail investors use and hold: use of paid information is common, dollars spent are unmeasured.**
- FINRA Investor Education Foundation 2024 Investor Survey (2,861 US adults with non-retirement investments, fielded
  July-December 2024): 40% use "financial newsletters or online resources that you pay for" (40% in 2021 too); 75% use
  research and tools from their brokerage; 36% "popular investments displayed on a mobile trading app"; 29% social media
  groups or message boards; 26% use social-media personality recommendations (61% of investors 18-34, 31% of 35-54, 6% of
  55+) [S11].
- Federal Reserve Survey of Consumer Finances 2022: 21% of families held stock directly (15% in 2019); conditional median
  direct holding fell from $29,000 to $15,000 [S12].
- No statistics-agency or regulator source I found measures dollars spent by retail investors on information or tools; the
  FINRA item measures use, not spend, and does not separate a $5 app from a $300 research service. Confidence the gap is real:
  Medium (searched FINRA Foundation and Fed sources only; no CFPB, SEC or SHED item found this session).

**C10. ESTIMATE (Medium) / HYPOTHESIS (Low). Price as a share of portfolio is a useful ceiling test.**
$99.99/year is 0.67% of the $15,000 median direct holding [S12]; 12 × $9.99 is 0.80%. HYPOTHESIS: a convenience tool costing
more each year than a typical fund fee level on the whole portfolio is a hard sell to median direct holders; the buyer is the
larger-portfolio, repeat follower-chooser, which matches cycle 1's narrow paying job. Brokerage tools are free to 75% of
investors [S11], which sets the reference price for "tools" near zero.

**C11. HYPOTHESIS (Medium). What Record tools is worth against free alternatives.**

| Job | Free alternative | Record tools' edge | Likely value |
|---|---|---|---|
| Compare two to five traders | Two browser tabs; copy % into a spreadsheet | Same scale, intervals side by side, no copying, stays current on rebuild | Minutes saved per comparison; worth paying only for frequent comparers |
| Saved views | Bookmarks, free follows | Viewer's own list and order persist | Near zero alone |
| Private notes | Any notes app; a free trading journal (for one's own trades) | Notes pinned to a record's dates, survive rebuilds, export | Small unless tied to record history |
Willingness to pay = time saved × frequency × the viewer's value of time, plus trust that numbers are current. A viewer
comparing weekly for 20 minutes who values time at $30/hour gives ≈$43/month of time (assumption, not data); a monthly
browser gives ≈$10. The bimodal-demand view from cycle 1 holds: high value for a few repeat comparers, near zero for the
swipe-feed majority. Free trading journals are not substitutes for the paid job (they track one's own trades), but they set
an expectation that note-taking is free.

**C12. FACT (High) from repo rules; HYPOTHESIS on fit. Packaging levers.**

| Lever | Allowed by POLICY/F-3 now? | Needs |
|---|---|---|
| $9.99 vs $10.00 ending | Yes (owner price is $9.99) | — |
| Show annual as "$8.33/mo billed yearly", no preselection | Likely | Legal reviewer on disclosure order |
| Any price other than $9.99/$99.99 (incl. $4.99, $7.99, $14.99, $79.99) in a notify-me arm | No | Owner (F-3 price decision) |
| Free trial (any length) | No ("no free trial at launch") | Owner; board deferred to after launch |
| 14-day refund window stated at checkout | Yes (decided 2026-11-01; never "risk-free") | Owner approves Terms text |
| Free limited Record tools (2 traders, 1 view) | Not decided | Legal committee (disguised access gate?) + owner |
| Supporter plan, no public badge | Not decided | Owner; F5/F6 check |
| Paid visibility, boosted profiles, charging or paying traders, alerts/pushed content, paid open positions, paid follow limits, gating any part of the record | **Barred** (F5, F3b, F-3) | — |
Note: cycle 1's money-back field evidence is thin; a search abstract of three field experiments at an online retailer
reports money-back offers raised product returns [S13, not opened]. The decided 14-day window is a compliance and trust
choice, not a conversion lever with evidence behind it.

**C13. HYPOTHESIS (Medium). Recommended price-research sequence (all before live billing, nothing charged).**
1. Owner's price only: priced notify-me control at $9.99/$99.99 (board idea 3), measure rate among returning signed-in viewers.
2. If the owner allows a second arm: $4.99/$49.99 (the only arm detectable at gate scale, C8), not $7.99.
3. A $14.99 arm only if step 1 exceeds the cycle 1 decision rule (≥3% of returning viewers).
4. Trial vs refund-window question goes to the owner after launch, using [S9]/[S10] (short trial, modest gain).

#### Sources
- [S1] Stripe public pricing page (integrated vendor), US, opened 2026-11-01. https://stripe.com/pricing — opened: yes.
- [S2] Peer-reviewed consumer-research journal, 2005, five experiments on the left-digit effect, https://doi.org/10.1086/429600 — opened: abstract page yes (full text paywalled).
- [S3] Peer-reviewed quantitative-marketing journal, 2003, three field experiments on $9 endings, https://doi.org/10.1023/A:1023581927405 — opened: abstract page yes.
- [S4] Peer-reviewed economics/management journal, 2013, field experiment on .99 endings with substitutes control, RePEc handle jec:journl:v9y2013i2p211-229 (no DOI found) — opened: abstract page yes.
- [S5] Peer-reviewed consumer-research journal, 1998, temporal reframing ("pennies-a-day"), https://doi.org/10.1086/209517 — opened: abstract page yes.
- [S6] Peer-reviewed marketing letters journal, 2003, magnitude reversal of temporal reframing, https://doi.org/10.1023/A:1025467002310 — opened: no (search abstract).
- [S7] Peer-reviewed journalism-studies journal, 2025, paywall strategies on 21 news sites, https://doi.org/10.1080/1461670X.2024.2438229 — opened: yes (full text, Table 2).
- [S8] Peer-reviewed marketing-research journal, 2014, limits of the attraction effect, https://doi.org/10.1509/jmr.12.0061 — opened: no (publisher 403; search abstract).
- [S9] Peer-reviewed management-science journal, 2023, optimal free-trial length field experiment, https://doi.org/10.1287/mnsc.2022.4507 — opened: abstract page yes.
- [S10] Peer-reviewed open-access psychology journal, 2025 (with a 2025 correction), randomized 3-day vs 7-day trial, n=680,588, https://pmc.ncbi.nlm.nih.gov/articles/PMC12217587/ — opened: yes.
- [S11] FINRA Investor Education Foundation, "Investors in the United States" (2024 Investor Survey), published 2025-12, https://www.finrafoundation.org/sites/finrafoundation/files/2025-11/NFCS_Investor_Survey_Report_White_Paper.pdf — opened: yes (pp. 1-2, 24-27, methods).
- [S12] Federal Reserve Bulletin, Changes in U.S. Family Finances 2019-2022 (SCF), https://www.federalreserve.gov/publications/files/scf23.pdf — opened: yes.
- [S13] Peer-reviewed electronic-markets journal, 2017, field experiments on money-back offers and returns, https://doi.org/10.1007/s12525-017-0259-0 — opened: no (search abstract).
- Cycle 1 facts reused (not reopened): subscription-app industry reports (retention by plan and price band, plan mix), cited in docs/direction/market-2026-11-01.md §5 and F7.

#### Open questions
- Owner: may the notify-me control show a second price arm, and which ($4.99/$49.99 is the only one measurable at gate scale)?
- Legal reviewer: is "$8.33/mo billed $99.99 yearly" compatible with the checkout disclosure order and equal-prominence rule?
- Does the processor return its fee on a refunded charge? If not, each 14-day refund costs ≈$0.59 on $9.99 (2.9% + $0.30); not verified this session.
- Which price bands did the retention-by-price report use (C7 sensitivity)?
- Is any regulator or statistics source measuring retail investors' dollar spend on information (CFPB, SEC investor research, SHED)? None found this session.

## E5. Pricing tests, statistics (PT)

### Cycle 2, pass 1: pricing experiment designs (statistics)

**Member:** pricing experiment designer (statistics). **Pass:** 1. **Date:** 2026-11-01.
**Scope:** test designs for Record tools at and around $9.99/month ($99.99/year) when real charges are off (F-3 test mode) and traffic in weeks 1-8 is about 1,000 viewers (up to 5,000 views) a week.

**Working traffic assumption (HYPOTHESIS, stated once and used throughout).** 1,000-2,500 unique viewers a week. The Record tools entry may not appear on profiles or on outside-link landings (F-3 open question, idea 1), so only an in-app "Compare" entry can expose viewers. Three exposure scenarios follow: **200 / 500 / 1,000 exposed viewers a week**. Signed-in viewers are about 10-20% of uniques.

---

#### Part 1. Pre-money tests (charges off)

**C1. Power arithmetic used in every table (FACT for the formula, ESTIMATE for the numbers, High).** NIST gives the normal-approximation sample size for a proportion test [S9]. The two-sample form, per arm, two-sided α=0.05, power 0.80 (z=1.960, 0.842), is
n = [1.960·√(2p̄q̄) + 0.842·√(p₁q₁+p₂q₂)]² ÷ (p₁−p₂)².

| Contrast | n per arm | n total | Weeks at 200 / 500 / 1,000 exposed a week |
|---|---|---|---|
| 3% vs 5% | 1,506 | 3,012 | 15 / 6 / 3 |
| 1% vs 2% | 2,318 | 4,636 | 23 / 9.3 / 4.6 |
| 0.5% vs 1% | 4,673 | 9,346 | 47 / 19 / 9.3 |
| 2% vs 3% | 3,825 | 7,650 | 38 / 15 / 7.7 |
| 5% vs 8% | 1,059 | 2,118 | 11 / 4.2 / 2.1 |
| 30% vs 45% (stated "yes" between two prices) | 162 | 324 | depends on poll response (C5) |

For a single arm (no comparison), 1,000 exposed gives 3% ± 1.06 points and 1% ± 0.62 points (95% CI). That takes 5 / 2 / 1 weeks. **Conclusion (ESTIMATE, High):** in weeks 1-8, only a single-price read and a coarse two-arm contrast (3%→5%) fit, and only at the 500+ exposure scenarios. A 1%→2% two-arm test fits only at 1,000 a week.

**C2. Painted door at the owner's price (design, HYPOTHESIS for the thresholds, Medium).**
- *Measured:* the share of exposed viewers who click "Get Record tools · $9.99/month or $99.99/year".
- *Exposure unit:* a viewer exposed to the entry. Signed-in viewers are counted by user id. Signed-out viewers are counted per first-party session with no cookie, per cycle 1 #3. That count is approximate, because one person can be counted twice.
- *Disclosure:* on the click, before anything else, show "Record tools isn't available yet. Nothing is charged." No card form, ever. Never send a real viewer into a test-mode checkout, because test mode accepts only test cards.
- *Default with no personal data:* count the click only. Collect a waitlist email only after the Privacy Policy is live (P3, P6). Whether a launch email may be sent is still the legal committee's call, as cycle 1 #6(b) said; F3b allows only billing and account messages.
- *Pass/fail* (cycle 1 T8, kept): ≥1,000 exposed; pass at ≥3% with the score-interval lower bound >1.5%; weak if the upper bound is <2%.
- *Bias:* a click costs nothing, so it is closer to stated intent than to purchase. No source I opened gives a click-to-purchase rate. Cycle 1's 10-50% discount stays an **assumption** (HYPOTHESIS, Low).

**C3. The stated-vs-revealed discount is about 21-26% on value, more for specialty goods (FACT, Medium).**
- A meta-analysis of 77 studies (115 effect sizes) finds hypothetical WTP overstates real WTP by **21% on average**. The bias is larger for higher-valued products, specialty goods and within-subject designs, and larger for indirect methods than for direct ones [S4].
- An earlier meta-analysis of 28 studies (83 observations) finds a **median hypothetical/actual ratio of 1.35**, with a heavily right-skewed distribution. Choice-based elicitation reduces the bias [S5].
- *Application (ESTIMATE):* divide stated price thresholds by 1.21-1.35 at least. A stated "getting expensive" median of $12.50 implies a revealed level near $9.26-$10.33.
- These are **value** discounts. They do not discount purchase **rates**, which can fall much further (HYPOTHESIS).

**C4. the price-sensitivity meter and price-ladder question: method status (FACT/HYPOTHESIS, Medium).**
- I opened no peer-reviewed validation of the price-sensitivity meter this session. Its origin is a 1976 practitioner conference paper. A peer-reviewed review of WTP methods exists [S18, not opened, 403]. Treat the price-sensitivity meter as descriptive: it gives a price **range**, not a demand curve.
- price-ladder question ("would you buy at $X?") yields stated demand by price. Use it **monadic, between-subject**: one random price per respondent. Within-subject designs inflate the bias [S4], and a choice format reduces it [S5].
- A de-biased direct question method has been proposed [S17, abstract only, no numbers given].

**C5. The survey is infeasible if shown only to clickers. Show one question to all exposed viewers (ESTIMATE, High).**
- *Clickers only:* at a 3% click rate, 200/500/1,000 exposed a week give 6/15/30 clickers. With 50% completion (assumption), that is 3/7.5/15 responses a week. A monadic price-ladder question at three prices × 162 = 486 responses would take **163/65/33 weeks**, and the price-sensitivity meter at n=200 would take 67/27/13 weeks.
- *All exposed viewers:* one in-app question, "We're deciding the price. At $X a month, would you subscribe?", with X randomly $7.99/$9.99/$12.99 and labelled as a survey. At 10-20% response (assumption), that is 20-200 responses a week, so 486 takes **2.5-25 weeks**.
- This measures stated demand among non-clickers too. That is useful for the curve's shape, not its level.
- *Pass rule:* a monadic "yes" at $12.99 that is not significantly lower than at $9.99 (n=162 per arm detects 30%→45%) flags $9.99 as possibly low. That contradicts cycle 1's "ceiling" opinion, so it is worth knowing.

**C6. Fake-door interest by tool (design, ESTIMATE for n, Medium).**
- *Display:* three "coming" tiles inside the Compare entry: compare side by side, saved views, private notes. Shown in random order per viewer, because position bias is real.
- *Measured:* the share of each tool among **first clicks**.
- *Exposure unit:* a clicker.
- *Sample:* separating a 45% from a 30% share needs about 160-170 first clicks for a pairwise contrast. That takes 5-27 weeks at the clicker rates in C5 (all-tiles click rate assumed 5-10% of exposed).
- *Decision:* build order follows the leader only if its interval excludes the runner-up. Otherwise keep the owner's order (compare first).

**C7. Price-display arms before money ($7.99 / $9.99 / $12.99 on the painted door) need the owner (FACT from repo, High).** F-3 sets $9.99/$99.99 (2026-10-25/26). Any other price shown as an offer must either be honoured at launch, or be shown only as a survey question (cycle 1 #6(c)). The C5 survey version needs no new price decision. A displayed-price painted door does.

---

#### Part 2. Real-money tests (after the owner sets `LIVE_BILLING=on`)

**C8. Revenue per visitor (RPV) is very noisy (ESTIMATE, High).**
- For a visitor in an arm with price P and conversion c, revenue is X = P·B, where B ~ Bernoulli(c).
- So E[X] = Pc, Var[X] = P²c(1−c), and the coefficient of variation is √((1−c)/c): **14.1 at 0.5%, 9.9 at 1%, 7.0 at 2%**. Price cancels out of the CV.
- Sample size per arm: n = (1.960+0.842)²·(σ_A²+σ_B²) ÷ Δ².
- *Worked example:* $9.99 at 1% conversion gives RPV $0.0999 and σ²=0.988. $12.99 at 0.95% gives RPV $0.1234 and σ²=1.63. Δ=$0.0235 (+23.5%), so n = 7.85 × 2.62 ÷ 0.000552 ≈ **36,600 per arm**.

| Comparison | RPV lift | n per arm |
|---|---|---|
| $9.99 at 1% vs $12.99 at 0.95% | +23.5% | 36,593 |
| $9.99 at 1% vs $7.99 at 1.5% | +20% | 38,086 |
| $9.99 at 1% vs $12.99 at 0.6% | −22% | 32,460 |
| same price, 1%→1.5% (e.g. refund copy) | +50% | 7,747 |
| same price, 0.5%→0.75% | +50% | 15,596 |
| $9.99 at 0.5% vs $12.99 at 0.4% | +4% | 2.27 million |

At 1,000-2,500 uniques a week, a classic price test detecting ±20% RPV takes **30-80 weeks**. **No price test is worth running as a hypothesis test in weeks 1-8 (ESTIMATE, High).**

**C9. Break-even ratios between price arms on net revenue (ESTIMATE, Medium).**
- Cycle 1 nets: $9.99 → $8.80 and $4.99 → $4.03. Those imply a linear fee of about $0.73 + 4.6% of price. That gives $7.99 → $6.89 and $12.99 → $11.66 net.
- $7.99 beats $9.99 only if conversion rises **more than 1.28×**.
- $12.99 beats $9.99 unless conversion falls **more than 24.5%**.
- Trader data cost does not change with price, so these ratios hold at any trader share.

**C10. Use a profit-maximizing "test and roll", not a significance test (FACT for the method, ESTIMATE for the numbers, Medium).**
- A peer-reviewed method sets equal arm sizes n* = √(N/4·(s/σ)² + (¾(s/σ)²)²) − ¾(s/σ)². Here N is the population that will see the winning price over the decision horizon, s is the response SD and σ is the prior SD of an arm's mean RPV [S7, eq. 10, full text opened].
- The optimal n grows sub-linearly in N. It is "substantially smaller" than a hypothesis-test n, especially for noisy responses and small populations [S7].
- *At 1% conversion, prior σ = 25-50% of mean RPV (ESTIMATE):*

| N | n* per arm |
|---|---|
| 8,000 | 640-950 |
| 20,000 | 1,140-1,870 |
| 40,000 | 1,720-2,970 |
| 100,000 | 2,860-5,220 |

- Its errors are frequent only when the arms are nearly equal, which is when errors cost little. Report the posterior, not "significance".

**C11. Sequential monitoring and stopping (FACT/HYPOTHESIS, Medium).**
- Repeatedly checking a fixed-horizon test invalidates its p-values. Always-valid p-values and CIs fix this [S6]. For conversion contrasts, either use those, or pre-register at most 2 interim looks with conservative group-sequential boundaries (standard tabulated z ≈ 3.47 / 2.45 / 2.00 for three looks; not opened this session).
- *Guardrails that stop an arm immediately (HYPOTHESIS):*
  - 14-day refund rate >2× control;
  - disputes ≥0.75% (idea board alarm);
  - any complaint about seeing a different price;
  - a cancellation-flow failure.
- *Futility:* stop the test at the planned N without a winner and keep $9.99.

**C12. Minimum traffic at which any price test is worth running (ESTIMATE, Medium).** All four conditions must hold:
1. at least about 30 paying conversions expected per arm during the test, so a price-arm read is not dominated by a handful of buyers;
2. a decision horizon N ≥ 10× the test size;
3. a stable baseline conversion from ≥8 weeks at the single owner price;
4. assignment by signed-in user id, so each person always sees one price.

At 1% conversion, condition 1 means ≥3,000 eligible signed-in viewers per arm. At 0.5% it means ≥6,000. With signed-in viewers at 10-20% of uniques, a two-arm test in ~12 weeks needs **about 2,500-5,000 signed-in eligible viewers a week, i.e. roughly 12,500-50,000 uniques a week**. That is 5-50× the week 1-8 traffic. Below it, keep $9.99 and learn from the survey (C5) and the funnel.

**C13. Annual-first vs monthly-first display (design, Medium).**
- *Allowed only with no plan preselected and an unchecked consent box* (idea board conditions). Only the order and the visual lead change.
- *Primary metric:* first-year expected revenue per visitor. Annual counts $99.99 minus 14-day refunds. Monthly counts its observed first charges × modeled 12-month life, with cycle 1's 13.7% monthly churn as a sensitivity.
- *Variance* is larger than in C8, because revenue mixes $99.99 and ~$9.99×life. So treat it as a test-and-roll on a secondary metric. The proportion read (annual share 30% vs 45%) needs only 162 **buyers** per arm, which at 1% conversion means 16,200 viewers per arm.
- No owner decision is needed if both orders show both plans equally truthfully. The savings copy stays "about 17%" ($99.99 vs $119.88 = 16.6%).

**C14. Trial vs no trial vs refund messaging (FACT/HYPOTHESIS, Medium).**
- *Refund-copy arm:* "Full refund on request within 14 days of your first charge" placed next to the price, vs the standard placement. This is within the existing F-3 refund decision, so it is a copy test needing no owner decision, provided it never says "risk-free".
- *Metric:* net paid conversion at day 15+, i.e. after the refund window.
- *Trial arm:* conflicts with F-3 "No free trial at launch", so it needs the owner. The evidence opened is a field experiment that randomized only **7/14/30-day** trials, with no no-trial arm. It found the 7-day trial best among uniform policies (+5.59% subscriptions) [S8, abstract]. It **does not** show that a trial beats no trial (HYPOTHESIS that it does, Low).
- *Sample:* a 1%→1.5% conversion contrast needs 7,747 per arm (C8).

---

#### Part 3. Legal and policy constraints

| Test | Constraint | Source | Owner decision? |
|---|---|---|---|
| Painted door | An insincere offer to get leads is "bait advertising" [S12]. Disclose on the click, never collect payment details, never imply the offer exists. Emails are personal data (P3/P6); a launch email needs a legal committee ruling (F3b) | S12, S2, S3 | Yes for any email list; no for an anonymous click count at $9.99 |
| Price-display arms | A shown price is a price the owner hasn't set (F-3). Honour it at launch (e.g. 12 months at the arm price) or label it a survey | S1, S3 | **Yes** |
| Later "was $12.99" copy | Only a bona fide price offered openly for a reasonably substantial period may be a reference price [S11]. A test arm's price may never become a "was" price | S11 | No (rule) |
| Random price arms, live | The federal commodity price-discrimination statute covers "commodities" [S13]. Applying it to a digital subscription is my reading (HYPOTHESIS, Low; legal committee). Regulators are scrutinizing prices set from personal data [S14]. Use random assignment by user id only, never behaviour or profile data. Settle the losing arm at the lower price | S13, S14 | **Yes** (live price test at all) |
| Moving arm subscribers to the winner | Raising a price triggers F-3's 25-30-day notice from the next renewal (California 7-30-day window, per F-3). Lowering is immediate. Proposal: lower-arm subscribers keep their price ≥12 months | S1 | **Yes** |
| Any auto-renewing checkout | ROSCA: clear disclosure of all material terms before billing info, express informed consent before charging, and a simple way to stop recurring charges [S10]. The FTC's broader negative-option rulemaking is at the advance-notice stage (comments closed April 2026) [S15, S16]. ROSCA applies regardless | S10, S15, S16 | No (built in) |
| Trial arm | Turns a free period into a negative option: disclosures and consent at signup, a reminder before the first charge (F-3 design: 3 days) | S10, S1 | **Yes** (against F-3) |
| All | No trackers (P6); no record content in any message (F3b); disclaimer on Record tools surfaces (F3); no pricing shown to connected traders (F-3 AC) | S2, S1 | No |

---

#### Part 4. Recommended sequence and decision rules

| Stage | When | Test | Decision rule |
|---|---|---|---|
| 0 | Before week 1 | Pre-register metrics, exposure unit, arms and stopping rules; build the cycle 1 #3 count first | Nothing runs without written definitions |
| 1a | Weeks 1-8, test mode | Anonymous painted door at **$9.99/$99.99 only** (C2) | ≥3% with lower bound >1.5% → build Record tools as planned. Upper bound <2% → weak demand: put cycle 1 #8 (free limited compare) to the owner before building more |
| 1b | Same | One-question monadic price-ladder question to all exposed viewers, labelled a survey (C5) | "Yes" at $12.99 not lower than at $9.99 → flag $9.99 as possibly low. "Yes" at $7.99 ≥1.28× $9.99 after the C3 discount → flag a lower price. Neither flag changes the price; the owner decides |
| 1c | Same | Tool tiles (C6) | Change build order only if the leader's CI excludes the runner-up |
| 2 | First 8+ weeks live (owner switch) | Single price; refund-copy A/B (C14) and annual-first A/B (C13) as test-and-roll | Establishes baseline conversion. Roll whichever arm's posterior expected net RPV is higher; guardrails as in C11 |
| 3 | Only when C12 traffic holds | Two-arm price test: $9.99 vs the one alternative flagged in 1b, by test-and-roll (C10), assigned by user id | Roll to the higher posterior net RPV. Losing-arm subscribers settle at the lower price |
| 4 | Only if the owner revokes "no trial" | 7-day card-up-front trial vs no trial | Net paid conversion at day 45, refund- and dispute-adjusted |

**Owner decisions needed:**
1. any price other than $9.99/$99.99 shown as an offer;
2. a waitlist email list, plus the legal committee's ruling on a launch email;
3. whether a live price test runs at all, and the honouring rule for arm subscribers;
4. the trial arm (against F-3);
5. adopting test-and-roll (posterior) decisions in place of significance thresholds.

---

#### Sources

- [S1] docs/features/F-3-viewer-subscriptions.md, repository, 2026-11-01. Opened: yes.
- [S2] docs/POLICY.md (F3, F3b, P3, P6, H), repository. Opened: yes.
- [S3] Cycle 1 market research council record, docs/direction/market-2026-11-01.md §5, §9, §11, §13. Opened: yes.
- [S4] "Accurately measuring willingness to pay for consumer goods: a meta-analysis of the hypothetical bias", J. Academy of Marketing Science 48(3), 2020, doi.org/10.1007/s11747-019-00666-6. Abstract opened via ideas.repec.org/a/spr/joamsc/v48y2020i3d10.1007_s11747-019-00666-6.html (yes). Full text: no (403).
- [S5] "A meta-analysis of hypothetical bias in stated preference valuation", Environmental & Resource Economics 30(3), 2005, doi.org/10.1007/s10640-004-3332-z. Abstract opened via econpapers.repec.org/RePEc:kap:enreec:v:30:y:2005:i:3:p:313-325 (yes).
- [S6] "Always valid inference: bringing sequential analysis to A/B testing", arxiv.org/abs/1512.04922. Opened: yes (abstract).
- [S7] "Test & Roll: profit-maximizing A/B tests", arxiv.org/abs/1811.00457 (Marketing Science, doi 10.1287/mksc.2019.1194). Opened: yes (full text, eq. 10).
- [S8] "Design and evaluation of personalized free trials", arxiv.org/abs/2006.13420 (Management Science 2023). Opened: yes (abstract).
- [S9] a national standards institute's engineering statistics e-handbook §7.2.4.2, sample sizes for proportion tests, itl.nist.gov/div898/handbook/prc/section2/prc242.htm. Opened: yes.
- [S10] 15 U.S.C. §8403 (ROSCA), law.cornell.edu/uscode/text/15/8403. Opened: yes.
- [S11] 16 CFR §233.1, former price comparisons, law.cornell.edu/cfr/text/16/233.1. Opened: yes.
- [S12] 16 CFR §238.0, bait advertising, law.cornell.edu/cfr/text/16/238.0. Opened: yes.
- [S13] 15 U.S.C. §13(a), law.cornell.edu/uscode/text/15/13. Opened: yes.
- [S14] FTC press release, surveillance pricing study interim findings, 2025-01-17, ftc.gov/news-events/news/press-releases/2025/01/ftc-surveillance-pricing-study-indicates-wide-range-personal-data-used-set-individualized-consumer. Opened: yes.
- [S15] FTC press release, ANPRM on negative option practices, 2026-03-11, ftc.gov/news-events/news/press-releases/2026/03/ftc-seeks-public-comment-response-advance-notice-proposed-rulemaking-regarding-negative-option. Opened: yes.
- [S16] FTC Negative Option Rule page, ftc.gov/legal-library/browse/rules/negative-option-rule. Opened: yes.
- [S17] "A de-biased direct question approach to measuring consumers' willingness to pay", arxiv.org/abs/2005.11318 (IJRM 2021). Opened: yes (abstract; no numbers).
- [S18] "A review of methods for measuring willingness-to-pay", Innovative Marketing 2(4), 2006. Opened: no (403).
- California Bus. & Prof. Code §17602 (leginfo.legislature.ca.gov). Opened: no (403). The 7-30-day window is cited from F-3 only.

#### Open questions

1. What is the real signed-in share of uniques, and how much traffic reaches the Compare entry? All week counts scale with it, and cycle 1 #3 must measure it.
2. Can signed-out exposure be counted per person without a cookie? If not, arms are signed-in only, which cuts eligible traffic 5-10×.
3. A painted-door click-to-purchase discount from a peer-reviewed source. None was opened; cycle 1's 10-50% remains an assumption.
4. Does the legal committee read the commodity price-discrimination statute and state personalized-pricing disclosure laws as reaching random, non-personal price arms?
5. Will the owner accept posterior "test and roll" decisions in place of significance? At this traffic, it is the only price test that finishes.

## E6. Channels, first 100 traders (CT)

### Supply channels: first 100 connected traders (50 by week 8)

**Member:** distribution analyst (supply). **Cycle 2, pass 1**, 2026-11-01. Repo read-only. Inputs: BRIEF.md, docs/POLICY.md,
DESIGN §1.2 and §3.5, IDEAS #13 and its board review [R1], cycle 1 Part A §6 and §11 and the F8/E8 distribution sections [R2].
All platforms are described generically (T1). Rates are mine unless a source is given. Nothing here is advice.

**Precondition (unchanged from [R1]).** Week 1 can't start until week 0 is done: Terms and a Privacy Policy are live, consent
is recorded, deletion works, real auth is in place, there is a contact, the vendor has answered in writing (MRC #1), the name is
cleared, report and reserved handles exist, and first-party gate counters are live. "Week n" below counts from the first
non-demo connection.

#### Claims

**C1. Cycle 1's two supply benchmarks contradict each other. Fix the checkpoint before week 1.** ESTIMATE, High.
Cycle 1's funnel (F8 C5) gives 1,000 × 20% × 40% × 50% = **4% of contacts connecting**. Test T5 (§11) instead passes at
"≥20% connect". The board's week-1 checkpoint ("50 invitations, fewer than 10 connects means gate 1 is out of reach" [R1])
needs 20% of invitations to connect, which is five times cycle 1's own funnel. At my central rates (C3) 50 invitations give
about 3 connects, so the founder would wrongly declare the gate dead in week 1. Proposed fix: define T5 as connects ÷
*replies* (pass ≥30%). Replace the week-1 checkpoint with **week 2: at least 100 personal contacts and at least 6 connects
(6%)**. Below 3, re-pitch. Below 3 again in week 3, the supply gate is out of reach. [R1, R2]

**C2. Published cold-outreach benchmarks set a floor, not an estimate.** FACT, High (numbers). HYPOTHESIS, Medium (how they apply).
- An agency benchmark covering 7.53M B2B emails in 2025 reports a 0.45% reply rate per email sent; founder/owner recipients
  reply at 0.57% [S3].
- A software vendor's Jan-Jun 2026 dataset (850M+ emails) reports a median of 0.74% per contact, about 1 reply per 135 [S4].

Both measure bulk, templated B2B mail. Founder outreach here is different: hand-written, sent to people who already post their
own results in public, offering a free tool that fits a habit they already have. I assume a 10-25% reply rate for that. It is
HYPOTHESIS with no non-vendor source. If week 2 shows replies under 5%, the founder is effectively sending bulk mail and should
stop that channel (C4 stop rule).

**C3. Channel plan. Contacts → replies → connects, hours and cash per channel.** ESTIMATE, Low (rates assumed). Figures are
8-week totals as low / mid / high. "Connect" means the broker is connected after the whole-record preview (MRC #11), which
includes preview declines and unsupported brokers.

| # | Channel and audience | Funnel (8-wk, mid) | Connects L/M/H | Founder h/wk | Cash |
|---|---|---|---|---|---|
| 1 | **One-to-one messages on an investor microblog** to adults who already post their full results, losses included (accountability posters, public journals) | 280 contacts (40/wk × 7) → 18% reply = 50 → 35% connect = 18 | 7 / 18 / 35 | 6 | $0 |
| 2 | **Topic communities on a link-aggregator forum** (trading, journaling, personal-finance tooling). One "feedback wanted" or method post (Demo data) per community, only with moderator approval | 2 approved posts × ~5,000 views × 1% visit × 8-10% connect ≈ 4 each | 2 / 8 / 15 | 2.5 | $0 |
| 3 | **Trading group chats and servers** (free accountability or study groups, not paid signal rooms). The admin posts or allows one announcement | 8 admin asks → 2 yes × ~300 active members × ~2% connect ≈ 3-4 each | 2 / 7 / 15 | 2.5 | $0 |
| 4 | **Trading-journal communities** (users who already log trades; some share journals) | 120 contacts → 25% reply = 30 → 40% connect = 12 | 5 / 12 / 21 | 3 | $0 |
| 5 | **Guest spots on small finance podcasts** (under ~5k listens/episode): why a screenshot isn't a record, how to read a range | 10 pitches → 3 booked → ~1 aired by wk 8 (3-6 wk lag) × ~2,000 listens × 0.15% | 0 / 3 / 10 | 1.5 | $0 |
| 6 | **Founder building in public** (microblog plus a large professional network): method notes and Demo cards only | Credibility for #1-#4; few direct connects | 0 / 2 / 5 | 2 | $0 |
| 7 | **Small trading educators and newsletters** that teach journaling or risk, not signals. They mention it unpaid | 15 pitches → 2 mentions × ~2,000 readers × 1% click × 12% connect ≈ 2-3 each | 2 / 5 / 12 | 2 | $0 |
| 8 | **Meetups and investment clubs for adults** (in person or video): a 10-minute demo on Demo data, with the organizer's OK | 3 sessions × ~15 attendees × ~12% | 1 / 5 / 10 | 2.5 | ≤$100 travel |
| 9 | **University alumni investment groups** (alumni only, never student clubs): a talk or a note in the alumni group | 4 asks → 1-2 yes → 3 connects | 0 / 3 / 6 | 1 | $0 |
| — | Onboarding (first 20 personally), 48-hour human check of each profile [R1], weekly funnel review | — | — | 3 | — |
| | **Total** | | **19 / 63 / 129** raw | **≈26** | **≈$100 + vendor** |

After a 15% haircut for duplicates across channels and disconnects within 14 days, the totals are **≈16 / 54 / 110 by week 8**.
Trader-to-trader word of mouth (attribution only, no reward) could add 0-10. I leave it out of the central figure. [R2 F8 C5,
E8 §1]

**C4. Stop rule for each channel.** HYPOTHESIS, Medium. A channel stops, or drops to one hour a week, when any of these holds:

| Channel | Stop when |
|---|---|
| #1 | Under 5% replies or under 2 connects after 80 contacts |
| #4 | Under 5% replies or under 2 connects after 40 contacts |
| #2 | Any moderator removal or warning in that community (never repost), or fewer than 2 connects from a post |
| #3 | No admin yes after 8 asks |
| #5 | No booking after 10 pitches |
| #7 | No mention after 15 pitches |
| #8, #9 | Under 1 connect per session after 2 sessions |
| #6 | Under 1 connect by week 4 (it continues at 1 h/wk as support for the others) |
| Any | A report of misleading pitching, any sign of an under-18 contact, or a moderator or admin complaint pauses it for owner review |

Freed hours go to whichever channel has the best connects per hour, read every Friday.

**C5. Compliance limits for every channel.** FACT for the rules, with sources. HYPOTHESIS for how they apply.
- **Pitch** [R1]: "a link instead of a screenshot, imported read-only from your broker, losses included." Never promise more
  followers, buyers or growth. Never say "verified" without its F3a meaning. No completeness claims. No performance numbers
  and no Demo returns presented as real (F2, F3a).
- **No paying or rewarding traders** (F5/F6): no cash, credits, free Record tools, prizes, gift cards, or "first 50"
  badges. Referral codes are attribution only.
- **Meetups**: food or drinks that depend on connecting count as a reward. Anything offered goes to every attendee
  unconditionally, or there is nothing.
- **No paid promotion of records.** A record never appears in company content, including the founder's own (F3b, [R1]).
  Company posts, podcast segments and meetup decks use Demo data or explain the method only.
- **Anything showing performance** carries "Not investment advice. Past performance does not guarantee future results." (F3).
  That includes a slide or a forum post with a Demo card.
- **FTC Endorsement Guides** [S1]. Any material connection needs a clear disclosure next to the endorsement, in every post:
  payment, free product, employment, family or friendship, affiliate or discount codes. In video it goes at the start,
  spoken and shown. "#ambassador"-style tags and platform tools alone are not enough. The advertiser must train endorsers,
  monitor what they post and act on problems.
  - A friend or relative of the founder who promotes the product must disclose the relationship.
  - A paid podcast spot is an ad and is labelled as one. Prefer unpaid guest spots.
  - Free Record tools given to an educator create a material connection. Don't give them.
  - This plan pays no one, which keeps the FTC exposure minimal.
- **CAN-SPAM** [S2] applies to *all* commercial email, including one-to-one messages. Each email needs:
  - accurate headers and a subject that isn't deceptive;
  - identification as an ad;
  - a valid postal address;
  - a working opt-out, honoured within 10 business days.

  Penalties run up to $53,088 per email. Prefer replying inside the platform where the person posted, and email only people
  who replied and asked for it. No texts [R1].
- **Community rules.** The link-aggregator forum ended site-wide enforcement of its "1 in 10" self-promotion guideline in
  2017. Communities now set their own rules, and several cap promotion at under 10% of activity and one promotion a week
  (HYPOTHESIS, Low: seen only in search results, pages not opened, S6). Many trading communities ban promotion outright.
  Rules for #2: read the rules first, ask the moderators first, disclose being the founder in every post, comment more than
  you promote, and never message members found through member lists. Messaging scraped members is a scraped list, which
  [R1] bars.
- **Platform messaging rules** (#1): microblogs restrict bulk or automated unsolicited messages (HYPOTHESIS, terms not opened
  this session). All messages are written and sent by hand, at most about 10 a day.
- **Adults only** (P4):
  - Contact only accounts that present as adults.
  - Skip any profile that mentions school grades, or any age signal under 18.
  - Alumni groups only. No student clubs, whose members can include people under 18.
  - Meetups that admit adults only.
  - Attestation at signup stays in place.
- **Held groups**: paid-signal sellers wait for the owner's launch decision [R1, R2 E8]. Registered securities
  representatives get a note to check their firm's rules [R2 F8 C9]. The founder never recruits anyone *as* a representative.

**C6. Measure with first-party `?via=` codes per channel and per post, never per person.** HYPOTHESIS, Medium.
- **Code format**: `?via=mb1`, `?via=fr-<community#>-<post#>`, `?via=pod-<ep#>`, `?via=mtg-<n>` and so on. A code per
  individual would tie a visit to a named person and makes the outreach list personal data (P3/P5). Keep the contact log
  outside the repo [R1].
- **Count per code**: landings, previews started, preview declines (with the reason key that cycle 1 found missing, E8
  §0), connects, connected at day 14, and shared within 14 days. The share count splits winning and losing records (C30).
- **Founder's sheet (outside the repo)**: contacts and replies per channel. Gate 1 is read from the database, not the sheet.
- **Podcasts**: the spoken path is a short memorable URL. It has to wait until the name is cleared (T5a), so until then
  say "search the handle" and accept that those visits arrive uncoded.

**C7. Time and cost: about 26 founder hours a week, ≈210 hours over 8 weeks, about $350-450 cash.** ESTIMATE, Medium.
- **Hours**: one hand-written message plus reading the person's posts takes about 8 minutes, so 40 a week ≈ 5.3 h plus
  replies.
- **Vendor cost**: SnapTrade costs $1 per connected user a month plus a $100/month platform fee. These figures are verified
  in [R1] idea 14. At a mid ramp that is ≈$100 + ~$10 in month 1 and ≈$100 + ~$40 in month 2, about $250.
- **Other cash**: meetups up to $100. A postal mailbox for CAN-SPAM, only if commercial email is used (not priced). No ads,
  no paid placements, no tools with trackers (P6).
- **Comparison with cycle 1**: cycle 1 said 75-160 contacts a week, "a full-time job" [R2 §6]. This plan needs about 60
  personal contacts a week (#1 and #4) plus one-to-many channels. That is about two-thirds of full time, because the
  one-to-many channels (#2, #3, #5, #7-#9) supply roughly a third of connects at mid.

**C8. Gate 1 at week 8 is about a coin flip. 100 traders arrive around week 13-16.** ESTIMATE, Low.
- **Week 8**: central ≈54, range 16-110. P(≥50) is near 50-60% on these assumptions.
- **Biggest swing**: the reply rate on #1 and #4. 10% versus 25% moves the total by about 40 connects.
- **100 traders**: after week 8, the mid run rate is about 9 a week (podcast and newsletter lags have matured). 100 then
  lands around week 13 at mid, week 16 or later at low, and around week 7 at high.
- **Views gate**: the trust-friendly cohort this plan recruits has small audiences. Cycle 1's warning stands: the views gate
  pulls against this cohort [R2 E8 §1]. The plan does not try to fix that by recruiting signal sellers.

**C9. Podcasts and newsletters affect weeks 5-8, so pitch them in week 1.** ESTIMATE, Medium.
- About two-thirds of US adults aged 18-29 and about half of all adults listened to a podcast in the past year [S5] (FACT,
  High, 2023).
- Finance-specific listening was not reported [S5].
- The lag between booking and airing is HYPOTHESIS (3-6 weeks). Pitches sent in week 3 or later will mostly air after the
  gate.

#### Week-by-week schedule (weeks 1-8)

| Wk | Actions | h | Cum. connects L / M / H |
|---|---|---|---|
| 1 | List of ~150 transparency posters (outside repo); 40 messages on the microblog (#1); 10 journal-community contacts (#4); ask 3 moderators (#2) and 4 server admins (#3); pitch 6 podcasts (#5) and 6 educators (#7); first build-in-public post (#6); book 2 meetups (#8); 2 alumni asks (#9) | 28 | 0 / 2 / 5 |
| 2 | 40 #1 + 20 #4; first approved forum post; personal onboarding of everyone so far; **checkpoint C1: ≥100 contacts and ≥6 connects** | 27 | 2 / 6 / 13 |
| 3 | 40 #1 + 20 #4; 4 more admin asks; 4 podcast + 5 educator pitches; meetup 1; card test with the first real traders [R1] | 27 | 4 / 11 / 24 |
| 4 | 40 #1 + 20 #4; server announcement 1; second forum community; apply stop rules (C4) and move hours | 26 | 6 / 18 / 38 |
| 5 | 40 #1 + 20 #4; newsletter mention 1; meetup 2; alumni talk | 26 | 9 / 26 / 54 |
| 6 | 40 #1 + 20 #4; podcast 1 airs; server announcement 2; board checkpoint: 40 connected [R1] (mid tracks ~34) | 25 | 11 / 34 / 70 |
| 7 | 40 #1 + 20 #4; meetup 3; newsletter mention 2; human check of all profiles up to date | 25 | 14 / 43 / 89 |
| 8 | 40 #1; forum post 2 if allowed; record gate values and definitions; no lowering of thresholds afterwards [R1] | 24 | 16 / 54 / 110 |

**Totals:** ≈210 founder hours; ≈$350-450 cash (≈$250 vendor, ≤$100 meetups, plus a possible mailbox). Expected connected
traders at week 8: **≈54 (range 16-110)**. 100 at about week 13 (mid).

#### Open questions
1. Owner: redefine T5 and the week-1 checkpoint as in C1?
2. The owner's decision on paid-signal sellers changes channel #3, where many servers are paid rooms, and the views gate.
3. Do the vendor's end-user terms allow a connect started from a podcast or meetup without a personal onboarding?
4. Is there a short spoken URL before name clearance? If not, podcast attribution stays partial.
5. A non-vendor source for reply rates on personalized peer-to-peer outreach (none found; C2).

#### Sources
- [S1] FTC, "FTC's Endorsement Guides: What People Are Asking", government guidance, https://www.ftc.gov/business-guidance/resources/ftcs-endorsement-guides-what-people-are-asking, opened: yes.
- [S2] FTC, "CAN-SPAM Act: A Compliance Guide for Business", government guidance, https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business, opened: yes.
- [S3] Company page, B2B outreach agency, cold-email reply benchmark (2025 data, 7.53M emails), opened 2026-11-01 (URL withheld under T1). Opened: yes.
- [S4] Company page, email-outreach software vendor, reply-rate benchmark (Jan-Jun 2026, 850M+ emails), opened 2026-11-01 (URL withheld under T1). Opened: yes.
- [S5] A national nonpartisan research organization, "Podcasts as a Source of News and Information", 2023-04-18, https://www.pewresearch.org/journalism/2023/04/18/podcasts-as-a-source-of-news-and-information/, opened: yes.
- [S6] Search-result summaries of the link-aggregator forum's 2017 moderator announcement and community self-promotion rules (mirrors failed to load). Opened: no.
- [R1] docs/ideas/2026-11-01-board-review.md, Idea 13 (chair's decision, checkpoints) and Idea 14 (vendor pricing), repo.
- [R2] Cycle 1 market.md: Part A §6 and §11; F8 (distribution pass 1, C3-C10); E8 (pass 2). Scratchpad.
- [R3] docs/POLICY.md (P3-P6, T1-T5a, F1-F6); [R4] docs/DESIGN.md §1.2, §3.5.

## E7. Channels, first 1,000 viewers (CV)

### Cycle 2, pass 1: Distribution analyst (demand: first 1,000 viewers and the 5,000 external views/week gate)

Member: distribution analyst for demand. Pass 1, 2026-11-01. Repo read-only at commit 0d42f65.
Inputs: c2 BRIEF; docs/POLICY.md (F2, F3, F3a, F3b, F5, F6, P4, P6, T5, T5a); docs/features/F-4; docs/IDEAS.md #13;
c1 market.md §6 (lines 320-362), F8 (pass 1) and E8 (pass 2); `app/sitemap.ts`, `app/robots.ts`, `lib/referral.ts`,
`app/u/[handle]/join-cta.tsx`. All platforms are described generically (T1).

#### Claims

**C1. Counting is still not built. Without it, no channel below can be judged or stopped.** FACT (repo). Confidence: High.
No code outside tests reads the HTTP Referer or stores page views. A `?via=` exists, but only for the JoinCta signup
link (`/login?ref=<handle>&via=<surface>`, join-cta.tsx:4), and its legacy column CHECK allows two values only
(lib/referral.ts:8). Cycle 1 already asked for this (MRC #3). This pass adds the channel codes it needs:
- Every link the founder or a trader posts carries `?via=<code>`. Codes: `card` (trader share), `fsv` (founder short
  video), `fmb` (microblog), `fpn` (professional network), `ffo` (forum), `fnl` (newsletter), `pr` (press),
  `pod` (podcast), `dir` (launch directory).
- Requests without a code fall into a referrer-host bucket: search, video, microblog, forum, professional network,
  email, chat, none, other.
- Storage is one daily counter row per (route kind, bucket, via). No IP, no user id, no cookie (P6; COMPLIANCE §5).
- The gate counts profile routes only (`/u/*`). `/how`, the feed and ticker pages are reported next to it, not
  inside it.

**C2. Most founder content lands on `/how` or the feed, not on profiles, so it feeds the gate only indirectly.**
HYPOTHESIS. Confidence: Medium. Educational posts should link to `/how` or `/`. Linking a named trader's profile from
founder content needs three things:
- the trader's permission;
- a documented, outcome-blind selection rule (for example a random pick from records past the 10-bet ranking floor),
  so the founder does not cherry-pick winners (F4) or appear to endorse anyone (F1);
- the F3 disclaimer in the post image.
The plan therefore assumes **30-60% of founder-channel visits reach a profile** (ESTIMATE: feed and `/how`
click-through to a profile is assumed, not measured).

**C3. The founder's own newsletter can bring almost no profile views under F3b.** FACT (rule) + HYPOTHESIS (effect).
Confidence: High for the rule. F3b's 2026-11-01 scope bars any message, in any channel, whose content or timing comes
from traders' records: handles, returns, closes, follows. So a "records worth reading this week" email is out. A
newsletter can carry only education (how to read a range, why screenshots mislead), link to `/how` and `/`, and go
out on a fixed calendar. It is a retention and trust channel, not a gate channel. Collecting emails also needs the
Privacy Policy live and an unsubscribe in every send (P6).

**C4. Regulators give a timely, citable press angle. It must stay on "what the product is", never "fraud detection".**
FACT. Confidence: High (sources opened).
- FINRA (2026-04-29): group members who share screenshots of their returns "might actually be accomplices"; unusually
  steady or high returns are a red flag [S1].
- FTC: about $7.9 billion in reported 2025 losses to investment scams, roughly half of all reported fraud losses,
  with an average individual loss above $10,000 [S2] (search summary of the testimony; PDF not opened, Medium).
- FTC Data Spotlight (2026-04-27): $2.1 billion reported lost to scams that started on social media in 2025, of which
  $1.1 billion went to investment scams; victims "see fake profits" on fake platforms [S3].
- FTC consumer alert (2025-05-28): a hacked friend's account posts account screenshots to suggest quick earnings [S4].
- SEC press release 2025-144 (2025-12-22): fake trading platforms, at least $14 million taken from retail investors [S5].
- SEC 2022-221: eight social-media traders charged in an alleged ~$100 million scheme (cycle 1, re-cited) [S6].

Allowed pitch: "a screenshot shows what someone chose to show; a broker-imported record shows the whole record,
losses included, ranked like gains." Not allowed: detecting fraud, verifying identity, completeness, "the only"
(F3a); naming or disparaging anyone (T2, T4).

**C5. Influencer-mediated content reaches young adults heavily, and most of them come across it rather than seek it.**
FACT. Confidence: High.
- 21% of US adults regularly get news from news influencers; 38% of adults 18-29 [S7].
- 69% happen to come across it rather than seek it out [S7].

Implication (HYPOTHESIS): founder education works only if it is native to the feed it sits in (an image or video that
makes its point without a click), with the link as an afterthought. This matches cycle 1's "images travel, links
don't" (link posts were 1.1% of feed views on a large network; non-news links cut microblog visibility ~4-7×).

**C6. Link-aggregator forums reward quality more than expected, but each post is a one-time spike, not steady traffic.**
FACT + HYPOTHESIS. Confidence: Low-Medium. A 2015 study of two social news aggregators found popularity "a stronger
reflection of intrinsic quality than expected" [S8]. A search summary says front-page placement adds votes and that
attention decays exponentially with rank, but that is not in the abstract I opened (unverified).
HYPOTHESIS: an educational post that reaches a topic community's top list yields a few hundred to a few thousand visits
within 48 hours, then almost nothing. Many investing communities ban self-promotion, so the founder posts only where
the rules allow it and discloses being the founder.

**C7. SEO adds ~0 by week 8, and the sitemap still has gaps.** FACT (repo) + ESTIMATE. Confidence: Medium.
- `app/sitemap.ts` lists ticker pages only (capped at 5,000).
- `/how`, any glossary and profiles are missing from it; `robots.ts` allows them.
- Fix: add `/how`, a glossary (range, bet, Verified, excluded positions) and only profiles past the 10-bet ranking floor
  (thin profiles could hurt site quality, per cycle 1).
- New domains typically take months to rank (HYPOTHESIS). Expect 0-100 search views/week at week 8.

**C8. Launch directories and the launch itself are blocked by T5a and P6 until the owner clears them.** FACT (rule).
Confidence: High.
- A directory listing needs a product name and usually a logo. T5a requires a trademark clearance search before any
  launch, logo or domain spend (a near-identical name exists).
- P6 (Terms, Privacy, consent, deletion, contact) must hold before non-demo users connect.

So the directory launch sits at week 5-6 at the earliest, and only if both clear. Its audience is product people, not
investors (HYPOTHESIS): a one-day spike that lands mostly on `/`.

**C9. Paid ads stay out of the 8-week plan.** HYPOTHESIS on a FACT base. Confidence: Medium.
POLICY allows an ad only if it meets all of these:
- adults-only targeting (P4);
- F2-clean copy, with the F3 disclaimer on any image that shows performance;
- no pixel or tracker (P6), so there is no optimisation loop;
- it never promotes a trader's record (F5: no paying for visibility; brief rule).

That leaves ads pointing to `/how`, which is not the gate route. Cycle 1's $150 acquisition cost against $65-119
contribution per payer still applies. Excluded.

**C10. Channel table (week-8 steady-state, external visits per week; all ESTIMATE, Low unless noted).**

Visit figures are rounded. "Profile" applies C2's 30-60% factor to founder channels; trader cards land on a profile
directly.

| # | Channel (generic) | Reach assumption (arithmetic) | Visits/wk wk 8 | of which profile | Founder h/wk | Cash | Compliance limits | First-party measure | Stop rule |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Trader-shared card image; link in reply, bio, chat or forum thread | 15-40 sharers by wk 8 (of 25-50 connected) × median 5-15 views + 2-5 heavy-tail sharers at 50-300 (c1 C4: 2 views/post for 1k followers, 150 per 500-member chat post) | 300-2,000 | 100% | 15-25 (recruiting, 75-160 contacts/wk, c1) | ~$1/trader/mo vendor | System share sheet and copy link only, no platform logos (T5); disclaimer and anti-crop band on image (F3, C13); no reward for sharing (F5/F6) | `via=card`; share events split by record sign (C30) | If fewer than 10 sharers by wk 4, change the recruiting mix (C11), not the card |
| 2 | Founder short videos ("how to read a record", "why screenshots mislead") | 3 posts/wk; new account 200-2,000 plays/video; 0.3-1% follow the bio link | 10-300 (one video that travels: +500 once) | 30-60% | 6-8 | $0 | Demo or permissioned records only, with disclaimer burned in; no tickers named as picks (F1); adults-only framing (P4); bio-link eligibility may need a follower threshold (c1, unverified) | `via=fsv` | Under 30 tagged visits after 12 posts: drop to 1/wk |
| 3 | Investor microblog | 1-2 image posts/day; link in reply; 200-800 followers by wk 8; 4-7× link penalty | 20-150 | 30-60% | 4 | $0 | Same; never comment on live trades (F3b) | `via=fmb` | Under 50 tagged visits/wk by wk 6: maintenance only |
| 4 | Large professional network | Founder's existing network (assume 500-1,500); native image or document post with link in comment; link posts 1.1% of feed views (c1) | 20-150 | 30-60% | 2 | $0 | Disclose founder role; no performance claims | `via=fpn` | Two posts under 20 visits each: monthly only |
| 5 | Link-aggregator forum, topic communities | 1 substantive post/2 wks where rules allow; 1 in 4 lands: 300-3,000 visits once | 50-600 (averaged; spiky) | 30-60% | 3 | $0 | Follow community self-promotion rules; disclose; no brigading | `via=ffo` + forum bucket | One removal by moderators in a community: stop there |
| 6 | Founder email newsletter | List 100-400 by wk 8 from site signups; open 30-40%, click 3-5% (generic assumption) | 1-20 | ~0 (C3) | 2 | $0-20/mo | F3b: no record content or record-timed sends; Privacy Policy and unsubscribe; double opt-in | `via=fnl` | Keep only if the D7 cohort from it beats the site average |
| 7 | SEO pages (`/how`, glossary, records past 10 bets) | Indexing lag | 0-100 | 30-60% | 2 (one-off 8-10) | $0 | Ticker pages never rate a security (F3b); no "every trade" (F3a) | search bucket | Review at wk 12, not wk 8 |
| 8 | Earned media on screenshot scams (C4) | 15-30 pitches → 0-2 placements; 500-3,000 visits per placement, decaying over ~2 wks | 0-500 | 20-40% | 4-5 | $0 | No fraud-detection, identity or completeness claim; name no one | `via=pr` + referrer host | No placement after 30 pitches: pause until real records exist |
| 9 | Launch directories | One-day spike 200-2,000, mostly `/` | 0-100 at wk 8 (spike wk 6: 200-2,000) | 10-30% | 8 on launch week | $0 | Blocked until T5a and P6 clear (C8) | `via=dir` | One launch only |
| 10 | Podcasts (guest, small investing shows) | 3-6 wk lead time; 2-4 episodes by wk 8; 500-5,000 listeners; 0.5-2% type the URL | 0-200 | 30-60% | 2-3 | $0 | Disclose no payment either way; if the host is a registered rep, their firm's rules apply (c1 C9); no performance talk | `via=pod` (spoken short path, e.g. `/how?via=pod`) | Under 25 visits per episode after 2: stop |

**C11. Week 1-8 schedule.** HYPOTHESIS. Confidence: Low-Medium.

| Week | Supply (gate channel 1) | Founder content | Infrastructure and compliance |
|---|---|---|---|
| 0 (pre) | Shortlist 150 transparency-led traders (no paid-signal sellers, c1 E8) | Write 6 evergreen scripts; build a demo-record video kit | View counter + `via` codes (C1); sitemap fix (C7); confirm P6 and D26; start T5a search |
| 1 | 75-100 contacts | 3 short videos, microblog daily, 1 professional post | Baseline dashboard; gate definition frozen |
| 2 | 100 contacts; first 5-10 connects | Same; first forum post | Newsletter signup on `/how` (if Privacy Policy is live) |
| 3 | 100-160 contacts; ask each connected trader for a bio link and a pinned card | Same; pitch 10 reporters (C4) | First channel review: drop anything at zero |
| 4 | Contacts continue; target 20-25 connected | Podcast pitches out (they air wks 6-8) | Stop rules applied (C10) |
| 5 | Target 30 connected; name the 3-5 heavy-tail traders | Second forum post; 10 more pitches | T5a/P6 decision for the launch |
| 6 | Target 40 connected | Directory launch if cleared | Mid-plan readout to owner |
| 7 | Target 45-50 connected | First podcasts air | |
| 8 | Hold 50; ask lapsed sharers once (no reward) | Keep the 2 best founder channels only | Gate readout: profile views by bucket and `via` |

Founder time: 15-25 h/wk recruiting + 15-20 h/wk content and press = **30-45 h/wk** (ESTIMATE). If the founder has
under ~30 h, cut channels 6, 9 and 10 first. They add the least profile views per hour.

**C12. Week-8 outcome: external profile views about 350-3,000 a week (central ~1,000), short of 5,000 by about
1.7-14× (central ~5×).** ESTIMATE, Low.
- Trader cards: 300-2,000 (all profile).
- Founder channels 2-10: about 100-2,100 visits a week, of which ~50-1,000 reach a profile.
- Total profile views: ~350-3,000 a week.
- This narrows cycle 1's 1.5-50× miss. It assumes the founder-content channels run. The central case still misses.

Getting to 5,000 needs one of:
- roughly 10 heavy-tail traders with 10k+ engaged followers posting twice a week, plus pinned bio links (c1 C4). That
  pulls against the trust-safe cohort (c1 E8);
- repeated forum or press spikes;
- a founder video series that compounds.

**The first 1,000 viewers** (cumulative, counted as views ÷ an assumed 1.5 views per visitor, since cookie-free
counting cannot count unique visitors) arrive by **week 3-6** in the central case. They come mainly from trader cards
plus one forum or press spike. ESTIMATE, Low.

**C13. Recommendation to the gate owner (input to MRC #4, gate revisions).** HYPOTHESIS. Confidence: Medium.
- Report the gate two ways: views from trader cards (`via=card` plus the trader-sourced buckets) and views from
  founder or press channels.
- Week 8 should judge the share loop on the first number. The second number tells how much the founder is carrying.
  A 5,000 reached mostly through founder content would not show that the card travels.

#### Sources
- [S1] FINRA, "Be Alert to Signs of Imposter Investment Scams", regulator investor insight, 2026-04-29,
  https://www.finra.org/investors/insights/be-alert-signs-imposter-investment-scams, opened: yes.
- [S2] FTC press release, testimony before a congressional economic committee on fraud, 2026-03,
  https://www.ftc.gov/news-events/news/press-releases/2026/03/ftc-testifies-joint-economic-committee-agencys-efforts-combat-fraud,
  opened: no (search summary only; $7.9B figure from the linked testimony PDF, not opened).
- [S3] FTC Data Spotlight, "Reported losses to scams on social media eight times higher than in 2020", 2026-04-27,
  https://www.ftc.gov/news-events/data-visualizations/data-spotlight/2026/04/reported-losses-scams-social-media-eight-times-higher-2020,
  opened: yes.
- [S4] FTC consumer alert, "Can you spot an investment scam on social media?", 2025-05-28,
  https://consumer.ftc.gov/consumer-alerts/2025/05/can-you-spot-investment-scam-social-media, opened: yes.
- [S5] SEC press release 2025-144, fake trading platforms and investment clubs, 2025-12-22,
  https://www.sec.gov/newsroom/press-releases/2025-144-sec-charges-three-purported-crypto-asset-trading-platforms-four-investment-clubs-scheme-targeted,
  opened: yes.
- [S6] SEC press release 2022-221, social-media manipulation charges, 2022-12-14,
  https://www.sec.gov/newsroom/press-releases/2022-221, opened: no this session (cycle 1 opened it).
- [S7] A national nonpartisan research organization, News Influencers Fact Sheet, 2025-11-04 (survey 2025-08-18 to 24),
  https://www.pewresearch.org/journalism/fact-sheet/news-influencers-fact-sheet/, opened: yes.
- [S8] Academic preprint on popularity vs. quality on two social news aggregators, 2015,
  https://arxiv.org/abs/1501.07860, opened: yes (abstract).
- SEC investor alert on group chats and screenshots (investor.gov, "gateway to investment scams"): opened: no (403).
  Not relied on.
- Cycle 1 figures (1.1% link-post share, 4-7× link penalty, funnel rates) are re-used from c1 market.md, not re-opened.

#### Open questions
1. Will the owner split the gate into card-sourced and founder-sourced views (C13)?
2. Who may link a named trader's profile from founder content, and under which selection rule (C2)? This needs a
   POLICY or F1 reading.
3. Does a profile link in founder content count as a "message whose content comes from records" under F3b when the
   post is not timed to a trade? The safe reading is assumed here: link only with permission and an outcome-blind pick.
4. T5a clearance date: it gates the directory launch and any branded video kit.
5. Bio-link eligibility thresholds on the short-video platform (cycle 1, unverified). They set channel 2's ceiling and
   small traders' ability to pin a link.
6. Is the founder's real weekly time 30-45 h? The plan's ranges assume it.

## E8. Regulatory and compliance (CO)

### Cycle 2, pass 1: Regulatory and compliance limits on launch channels and pricing tests

**Member:** regulatory and compliance analyst (launch channels, pricing tests). **Pass:** 1. **Date:** 2026-11-01.
This is market research, not legal advice. Labels: **FACT** means a primary source I opened this session (listed in Sources with "opened: yes"). **ESTIMATE** means arithmetic on stated inputs. **HYPOTHESIS** means my judgment. Cycle 1 §7 already covers the publisher's exclusion in outline, the finfluencer enforcement themes, broker "entanglement" and the fact that unrewarded trader cards need no disclosure. This file goes further: the exact rule text, where the founder's own conduct triggers duties, and gaps in F-3.

#### A. Endorsements, testimonials and perks (16 CFR 255, 16 CFR 465)

**C1. FACT (High).** An "endorsement" is "any advertising, marketing, or promotional message for a product that consumers are likely to believe reflects the opinions, beliefs, findings, or experiences of a party other than the sponsoring advertiser", and "product" includes a "service, brand, company". In interactive media a disclosure "should be unavoidable" [S1].
*So:* a trader posting their own card on their own initiative, with no benefit from us, is not our advertising message, which confirms cycle 1. The moment the company reposts that card, quotes it or puts it in a deck, the card becomes *our* advertising and all of §255 applies to it.

**C2. FACT (High).** Material connections "can include … the provision of free or discounted products (including products unrelated to the endorsed product) … regardless of whether the advertiser requires an endorsement in return", and also "early access to a product or the possibility of being paid, of winning a prize". Disclosure is required when "a significant minority of the audience" would not expect the connection [S2].
*So:* each of these creates a material connection on every later card that trader shares: free Record tools for a trader, invite-only early access for the "first 50" (MRC #9), or a contest. This applies even with no request to post.

**C3. HYPOTHESIS (Medium).** Two cases follow from C2.
- A free limited tier of Record tools (MRC #8) that every viewer gets on equal terms, without conditions, is not a connection that the audience would not expect. It needs no disclosure.
- A perk given only to traders, or only to recruits, does need disclosure. It also collides with F5/F6 (no rewarding traders).

Rule for channels: **traders get exactly what every signed-in user gets, and nothing else.** Pre-launch testers are the hard case, because early access is named in the rule. Two options:
- (a) Don't ask testers to post until the product is publicly available.
- (b) If they do post while access is invite-only, they add "early tester" to the post.

**C4. FACT (High).** Advertisers "should … provide guidance to their endorsers …; monitor their endorsers' compliance; and take action" [S3]. An advertiser "may be liable for a deceptive endorsement even when the endorser is not liable" [S3]. FTC staff say a platform's built-in paid-partnership tool is "not necessarily" enough, and a disclosure is needed "in each and every ad" [S5].

**C5. FACT (High).** When an endorsement relates a consumer's experience on a key attribute, it implies that experience is representative. Without substantiation, the ad must disclose "the generally expected performance", and staff say "Results not typical" does not cure this [S4, S5].
*So:* a company post showing one strong card implies typical results. That is the cherry-pick risk named in COMPLIANCE §11. **HYPOTHESIS (Medium):** the founder should use one of these instead:
- demo cards (Demo badge);
- the founder's own card, with a disclosure;
- cards chosen by a published, sign-blind rule, for example "the most recent card shared with consent, whatever its sign", always shown next to the "Not investment advice …" line.

**C6. FACT (High).** Part 465 (in force since 21 Oct 2024; civil penalties for knowing violations [S7]) has three provisions that apply here.
- Officers or managers who write a review or testimonial about their own business must disclose the relationship clearly and conspicuously, "unless, in the case of a consumer testimonial, the relationship is otherwise clear to the audience" (§465.5(a)) [S6c].
- A business may not procure reviews from "officers, managers, employees, or agents, or any of their immediate relatives" for third-party sites without disclosure (§465.2(c)) [S6a].
- No incentives "conditioned … on" a particular sentiment (§465.4) [S6b].

*So:*
- When the founder posts their own card, or praises the app from a personal account, the post says "I built this".
- Friends and family are not asked to leave app-store or forum reviews.
- Any "review us" prompt is neutral about sentiment.

**C7. FACT (High).** §465.8 makes it unlawful to buy "fake indicators of social media influence" that misrepresent importance for a commercial purpose [S6d].
*So:* no purchased followers, views or engagement, for the founder or for traders. **HYPOTHESIS (High):** bought views would also corrupt the ≥5,000 external-referrer views gate.

**C8. FACT (High).** §465.7(b) bars implying that the displayed reviews are all reviews while reviews are suppressed for negative sentiment. Withholding on neutral criteria applied to everyone (abuse, personal data, clearly false content) is allowed [S6e]. *So:* this is consistent with U1. Any "what users say" page must not filter on sentiment.

#### B. Outreach messages

**C9. FACT (High).** CAN-SPAM covers email whose "primary purpose" is commercial promotion (16 CFR 316.3). There is "no exception for business-to-business email", and penalties run to $53,088 per email [S8, S9]. Each commercial email needs four things:
- clear identification that it is an advertisement or solicitation (waived after prior affirmative consent);
- notice of how to opt out, with a working return mechanism;
- opt-outs honored within **10 business days**;
- a valid physical postal address, which may be a registered PO box [S10, S9].

Harvested or dictionary-generated addresses are "aggravated violations" (§7704(b)(1)) [S10].
**HYPOTHESIS (Medium):** a founder email inviting a trader to connect counts as commercial even though connecting is free, because staff include email "that promotes content on commercial websites" [S9]. Plain-text one-to-one founder emails therefore still carry an opt-out line and a postal address. Addresses are never scraped.

**C10. FACT (High).** Under the TCPA rule, autodialed or prerecorded calls need prior express (written, for telemarketing) consent, and a "call" includes a text message [S11]. COMPLIANCE's default of no SMS stands. **HYPOTHESIS (High):** don't text-blast phone lists from waitlists or group chats.

**C11. HYPOTHESIS (Medium).** Direct messages and posts on social platforms are mainly governed by platform terms. Typical generic patterns:
- link-aggregator forums with topic communities cap self-promotion and require stated affiliation;
- investor microblogs and group-chat apps ban unsolicited bulk DMs.

Breaking these risks account bans, which removes the founder's only channel. Saying "I built this" meets both platform norms and §465.5/§255.5.

**C12. HYPOTHESIS (Medium–High); new finding.** POLICY F3b as amended on 2026-11-01 bars "any message, in any channel, whose content or timing comes from traders' records". Read literally, it covers **founder posts of other traders' cards**, and posts like "this week's closes" or "someone just closed −18%", on any social channel. A trader sharing their own card is their speech and is not barred. The founder can post:
- explainers of the method;
- demo cards;
- product screenshots without live record fields.

Whether the founder may post *their own* card, or a consented trader's card on a fixed schedule, needs an owner ruling. Until then, distribution plans should assume **only traders post records**. This tightens cycle 1's "founder-led, image-first" plan.

#### C. Securities-adjacent limits on marketing

**C13. FACT (High).** The adviser definition excludes "the publisher of any bona fide newspaper, news magazine or business or financial publication of general and regular circulation" (15 U.S.C. 80b-2(a)(11)(D)) [S12]. In 472 U.S. 181 the Court read "regular" as there being "no indication that they have been timed to specific market activity". It treated "factual information about past transactions" as plainly protected, so long as communications stay "entirely impersonal" [S13].
**HYPOTHESIS (Medium):** marketing is where the product could drift outside the exclusion. Examples:
- event-timed posts ("big move today, see who called it");
- replies to individuals of the form "you should look at @x";
- copy that sells returns ("find traders who win 70%").

Marketing should sell the method (whole record, losses ranked like gains, intervals), not outcomes, and it should not be timed to price moves.

**C14. FACT (High).** Securities Act §17(b) bars publicizing a security "for a consideration received … from an issuer, underwriter, or dealer" without disclosing the consideration and its amount [S14]. The SEC's 6 Feb 2026 alert names "scalping" and "touting" as social-media schemes [S15]. *So:* never accept issuer or dealer money for any placement or co-marketing. POLICY F5 already bars paid visibility.

**C15. FACT (High).** FINRA Rule 2210 has four provisions that matter if a trader is a registered representative.
- A retail communication is any written communication to more than 25 retail investors within 30 days.
- Posts on an "online interactive electronic forum" are exempt from pre-approval and filing, but not from the content standards.
- Communications "may not predict or project performance, imply that past performance will recur".
- Testimonials about performance must disclose that they may not be representative and are "no guarantee of future performance" [S16].

**HYPOTHESIS (Medium):** when a rep shares a card in a business capacity, it is likely the firm's retail communication. Our footer covers part of (d)(6), but firms may forbid such posts outright. Recruiting reps into the first 50 adds supervision friction. Ask at connect "Are you a registered representative or adviser?" and don't target them in outreach.

**C16. FACT (High).** The SEC Marketing Rule (206(4)-1) has three relevant provisions.
- It bars presenting performance "in a manner that is not fair and balanced".
- Paid testimonials and endorsements need disclosures.
- "Extracted performance" (a subset of a portfolio) may appear only if the ad "provides, or offers to provide promptly, the performance results of the total portfolio" [S17].

**HYPOTHESIS (Medium):** a card of closed trades from one connected account is likely extracted performance when an adviser uses it in an ad. Stock Social must never pay or reward advisers to feature us, because a compensated endorsement of an adviser triggers (b) for them.

**C17. FACT (High).** Regulator alerts warn about fake trading proof:
- members posting "screenshots … of purportedly successful trades" in group chats (SEC, 22 Dec 2025) [S18];
- "group members who appear to be successful investors sharing screenshots" who "might actually be accomplices" (FINRA, 29 Apr 2026) [S19].

**HYPOTHESIS (Medium):** this is the positioning opening (broker-sourced, whole record). It is also a hazard. Marketing must not imply that a Stock Social card proves someone is trustworthy to follow. F3a ("Verified" means broker-sourced, nothing more) has to appear in channel copy too.

#### D. Adults-only marketing

**C18. FACT (High).** Under COPPA, deciding whether a service is "directed to children" considers subject matter, visual content, animated characters, music, ages of models, "whether advertising promoting or appearing on the website … is directed to children", and evidence on audience composition, "including marketing or promotional materials or plans" [S20].
*So:* channel choice and creative are themselves evidence. **HYPOTHESIS (High):** for every post and placement, avoid the following:
- school, campus or "first job" framing;
- game or anime styling;
- slang coded to cohorts that include minors;
- communities whose stated audience includes minors.

**C19. FACT (High) / HYPOTHESIS (Medium).** One state's minors' social-media statute applies only where *each* of four criteria holds [S21]:
1. users can upload or view content;
2. **≥10% of daily active users under 16 average ≥2 hours a day**;
3. algorithms select content;
4. any one "addictive feature", including infinite scrolling.

The swipe feed plus F-2 personalization meets criteria 1, 3 and 4. *So:* only the minor-usage criterion (2) keeps the product outside, which means the 18+ attestation and delete-on-report rules carry the legal weight. **HYPOTHESIS:** treat channels with large minor audiences, such as short-video platforms, as higher-risk for leaking under-18 sign-ups. Never run paid ads, which are also barred by P6 and are unprofitable (cycle 1). If paid ads are ever allowed, age-target them to 18+, while knowing that self-declared platform ages are weak.

#### E. Pricing tests and subscriptions

**C20. FACT (High).** ROSCA (15 U.S.C. 8403) requires three things for online negative-option charges:
1. clear and conspicuous disclosure of all material terms "before obtaining the consumer's billing information";
2. "express informed consent" before charging;
3. "simple mechanisms" to stop recurring charges [S22].

**C21. FACT (High).** The federal Negative Option Rule was recodified on **12 Feb 2026** (91 FR 6509) to its pre-2024 text, which covers prenotification plans only [S23, S24]. An ANPRM followed on 13 Mar 2026. The FTC rule page lists no NPRM or final rule after it [S25]. *So:* ROSCA plus state laws are the binding layer today. A new federal rule is possible.

**C22. FACT (High), from the California AG's summary [S26]; statute text 403'd and not opened.** The California rules, as amended effective 1 July 2025:
- express affirmative consent;
- for initial terms of a year or more, a renewal notice **15–45 days** before renewal;
- for a fee change, notice **7–30 days** before;
- **an annual reminder for every auto-renewal plan**, sent by the enrollment channel, with product, amount and frequency, and how to cancel;
- online enrollees may cancel online "at will", with no steps that "obstruct or delay".

**C23. HYPOTHESIS (Medium–High); F-3 gap.** F-3's annual-plan reminder (30–40 days) and price-change notice (25–30 days) fall inside the California windows. F-3 has **no annual reminder for monthly subscribers**, so add one. Any cancel-flow "save offer" must not delay cancellation. Both are billing-event emails with no record fields, so F3b allows them.

**C24. FACT (High).** Two pricing guides apply.
- The Bait Advertising Guides: "No advertisement containing an offer to sell a product should be published when the offer is not a bona fide effort to sell" (§238.1); bait is an "alluring but insincere offer" (§238.0) [S27].
- The Deceptive Pricing Guides: a former price is legitimate only if it is "the actual, bona fide price at which the article was offered to the public on a regular basis for a reasonably substantial period" (§233.1) [S28].

**C25. HYPOTHESIS (Medium).** A painted-door test (MRC #6, G5) is low-risk under §5 if all of the following hold:
1. Before the click, the button says what it is, for example "Record tools: coming soon. Join the waitlist (launch price $9.99/mo)". It never says "Subscribe now".
2. No card or billing details are collected. That keeps ROSCA out and keeps the test inside F-3's test-mode rule.
3. The click lands on an honest "not available yet" page.
4. Waitlist joiners are offered the price they saw, or lower, at launch for at least the first term.
5. The launch email is CAN-SPAM-compliant and carries no record fields (F3b).

Never show a struck-through "regular" price before one has been bona fide offered.

**C26. HYPOTHESIS (Medium).** On price-arm fairness:
- Assign arms at random, sticky per visitor, never by personal data (location, device or inferred traits).
- Log the arm.
- If live charging ever runs multiple prices, anyone who saw a lower price can get it.

One state has an algorithmic-pricing disclosure law for prices set using personal data (I did not open it, so this is unverified). Random assignment that uses no personal data plausibly stays outside it. Any real-money arm other than $9.99/$99.99 changes an owner decision (F-3) and needs the owner.

**C27. ESTIMATE (Medium).** Exposure if a CAN-SPAM violation repeats across a 160-contact weekly batch (cycle 1's upper bound): 160 × $53,088 ≈ **$8.5M** theoretical maximum per batch. That is why the opt-out line and the postal address are non-negotiable even in "personal" founder email.

#### F. Channel compliance checklist (one page; run it for every post, message and test)

**Every post (founder or company account)**
1. Does the post show any trader's record (card, return, close, position)? Only the trader posts their own. The founder uses demo cards or method explainers until the owner rules on F3b scope (C12).
2. Is the founder speaking about the product? Say "I built this" in the post itself, not only in the bio (C6).
3. Does it show performance? It carries "Not investment advice. Past performance does not guarantee future results." in the image, not only in the caption. It is selected by a sign-blind rule, never because the number is high (C5).
4. Is it timed to a price move or market event, or addressed to one person as "look at @x"? Don't post it (C13).
5. Does it use any of these words: guaranteed, risk-free, beat the market, copy their trades, signal, edge, every trade, any broker, the only, best traders? Rewrite it (F2/F3a).
6. Does it use a third-party name or logo, or name a real person? Remove them (T1/T2).
7. Is anything about the creative, community or slang youth-coded? Change the channel or the creative (C18).
8. Has the post been boosted, or have followers or views been bought? Never (C7, P6, F5).

**Every outreach message**

9. Email: accurate From line and subject; identifies itself as a solicitation; opt-out line; postal address (PO box OK); opt-outs logged and honored within 10 business days; no scraped addresses (C9).
10. SMS: none (C10).
11. Platform DMs and forum posts: follow that community's self-promotion rules; state the affiliation; no bulk DMs (C11).
12. Does the recipient get anything for connecting, sharing or reviewing? Nothing beyond what every user gets. If invite-only early access is involved, the post says "early tester" (C2, C3, F5/F6).
13. Is the recipient a registered representative or adviser? Don't target them; flag at connect (C15, C16).
14. Is it a review request? Neutral wording, never to staff, friends or family (C6).

**Every pricing or offer test**

15. Painted door: labeled "coming soon" before the click; no card collected; waitlist price honored (C25).
16. Arms: random, sticky, no personal data; logged; the lower price is honored if charging ever goes live (C26).
17. No fictitious "was" price; no "risk-free"; refund wording as F-3 (C24).
18. Live checkout (owner switch only): material terms before billing details; express consent; online cancel with no obstruction; renewal and fee notices in the California windows; annual reminder for monthly plans too (C20–C23).
19. Does the test message contain any handle, symbol, return or record field? Don't send it (F3b).

#### Sources
- [S1] 16 CFR 255.0, eCFR text via LII. https://www.law.cornell.edu/cfr/text/16/255.0. Opened: yes.
- [S2] 16 CFR 255.5. https://www.law.cornell.edu/cfr/text/16/255.5. Opened: yes.
- [S3] 16 CFR 255.1. https://www.law.cornell.edu/cfr/text/16/255.1. Opened: yes.
- [S4] 16 CFR 255.2. https://www.law.cornell.edu/cfr/text/16/255.2. Opened: yes.
- [S5] FTC staff, "FTC's Endorsement Guides: What People Are Asking". https://www.ftc.gov/business-guidance/resources/ftcs-endorsement-guides. Opened: yes.
- [S6] 16 CFR 465: (a) §465.2, (b) §465.4, (c) §465.5, (d) §465.8, (e) §465.7. https://www.law.cornell.edu/cfr/text/16/465.2 (and the same path for .4, .5, .7, .8; definitions at .1). Opened: yes.
- [S7] FTC staff, Consumer Reviews and Testimonials Rule Q&A. https://www.ftc.gov/business-guidance/resources/consumer-reviews-testimonials-rule-questions-answers. Opened: yes.
- [S8] 16 CFR 316.3. https://www.law.cornell.edu/cfr/text/16/316.3. Opened: yes.
- [S9] FTC, CAN-SPAM Act compliance guide for business. https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business. Opened: yes.
- [S10] 15 U.S.C. 7704. https://www.law.cornell.edu/uscode/text/15/7704. Opened: yes.
- [S11] 47 CFR 64.1200. https://www.law.cornell.edu/cfr/text/47/64.1200. Opened: yes.
- [S12] 15 U.S.C. 80b-2. https://www.law.cornell.edu/uscode/text/15/80b-2. Opened: yes.
- [S13] 472 U.S. 181 (1985), Supreme Court opinion. https://www.law.cornell.edu/supremecourt/text/472/181. Opened: yes.
- [S14] 15 U.S.C. 77q(b). https://www.law.cornell.edu/uscode/text/15/77q. Opened: yes.
- [S15] SEC investor alert, "Social Media and Stock Tip Scams", 6 Feb 2026. https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-bulletins/social-media-stock-scams. Opened: yes.
- [S16] FINRA Rule 2210. https://www.finra.org/rules-guidance/rulebooks/finra-rules/2210. Opened: yes.
- [S17] 17 CFR 275.206(4)-1. https://www.law.cornell.edu/cfr/text/17/275.206(4)-1. Opened: yes.
- [S18] SEC investor alert, "Group Chats as a Gateway to Investment Scams", 22 Dec 2025. https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-alerts/gateway-to-investment-scams. Opened: yes.
- [S19] FINRA investor insight on imposter investment scams, 29 Apr 2026. https://www.finra.org/investors/insights/be-alert-signs-imposter-investment-scams. Opened: yes.
- [S20] 16 CFR 312.2 (COPPA definitions). https://www.law.cornell.edu/cfr/text/16/312.2. Opened: yes.
- [S21] Florida Statutes §501.1736 (2025), official legislature site. https://www.flsenate.gov/Laws/Statutes/2025/501.1736. Opened: yes.
- [S22] 15 U.S.C. 8403 (ROSCA). https://www.law.cornell.edu/uscode/text/15/8403. Opened: yes.
- [S23] Federal Register 2026-02866, 12 Feb 2026 (Negative Option Rule recodified). https://www.federalregister.gov/api/v1/documents/2026-02866.json. Opened: yes.
- [S24] 16 CFR Part 425 (source 91 FR 6509). https://www.law.cornell.edu/cfr/text/16/part-425. Opened: yes.
- [S25] FTC, Negative Option Rule page. https://www.ftc.gov/legal-library/browse/rules/negative-option-rule. Opened: yes.
- [S26] California Attorney General consumer alert on the Automatic Renewal Law (2025), oag.ca.gov press release (URL withheld under T2: its path contains a real person's name). Opened: yes. The statute itself, Cal. Bus. & Prof. Code §17602 on leginfo.legislature.ca.gov, returned 403. Opened: no.
- [S27] 16 CFR 238.0, 238.1, 238.3. https://www.law.cornell.edu/cfr/text/16/238.1. Opened: yes.
- [S28] 16 CFR 233.1. https://www.law.cornell.edu/cfr/text/16/233.1. Opened: yes.
- [S29] SEC Investor Advisory Committee, finfluencer recommendation, 22 Nov 2024. https://www.sec.gov/files/sec-iac-finfluencer-recommendation-11222024.pdf. Opened: yes. Background only: it says the compensation element is generally met by "any economic benefit".
- Not opened (403): FTC Policy Statement on Deception PDF. The page (ftc.gov, dated 14 Oct 1983) opened, but its text was not retrieved. The New York algorithmic-pricing statute was not opened.

#### Open questions
1. **Owner:** does F3b's "any channel" scope bar the founder from posting (a) their own card, or (b) a consenting trader's card on a fixed, sign-blind schedule? This decides whether founder-led distribution can show real records at all (C12).
2. Are pre-launch testers "early access" endorsers? Decide between "no posting until public access" and an "early tester" tag (C3).
3. Should connect ask about registered representative or adviser status, and should a yes change anything (an extra note on their card, or nothing)? (C15, C16)
4. F-3: add an annual reminder for monthly plans; confirm the cancel flow has no save step that delays cancellation (C23).
5. Verify the California §17602 text and the New York pricing-disclosure statute from the official sites before the owner switches on live billing.

## E9. Red team, risks (RK)

### Cycle 2, pass 1: early-kill risks and the cheapest test for each

**Member:** red team / risk analyst. **Pass:** 1. **Date:** 2026-11-01. **Repo read at:** 0d42f65 (read-only).
Scope: risks that could kill Stock Social before launch or in the first 8 weeks to ~6 months, each with the cheapest test
that would reveal it. Builds on cycle 1 (c1 §8, §9, §11, F11) and does not repeat it. New evidence this cycle: a P&L
defect in the code, new fraud and participation data, a sourced disposition effect, the live state of the vendor's
terms, a state age law now in force, and a broker feed now open to all its customers. Not legal or investment advice.

Gate keys: **G0** vendor written answer (c1 proposal) · **G1** ≥50 connected traders · **G2** ≥60% share · **G3** ≥5,000
external views/week · **G4** viewer D7 ≥15% · **G5** payment intent (c1 proposal).

---

#### Claims

**C1. Wrong "Verified" returns from stock splits are built into the current matcher. FACT (repo, High); how often it hits:
HYPOTHESIS (Medium).**
- `lib/broker.ts:96,160` asks the vendor only for `type: 'BUY,SELL'`, and `toActivities` drops every other type (line 141).
- `lib/trades.ts#matchTrades` matches sells to lots by units and price, with no split, reverse-split, symbol-change or
  spin-off adjustment. Nothing in `lib/`, `app/` or `scripts/` reconciles lots against vendor positions (grep: no hits).
- Worked example (ESTIMATE, arithmetic only):
  - 2:1 split: buy 10 @ $100, sell 20 @ $55. FIFO matches 10 units at $100 and shows **−45%** as a Verified loss. The other
    10 units are counted as excluded.
  - 1:10 reverse split: buy 100 @ $1, sell 10 @ $9. FIFO matches 10 units at $1 and shows **+800%**. The other 90 units
    stay as a phantom open lot.
- POLICY F3c says trades the importer "can't price correctly (stock splits and other corporate actions…) are excluded and
  counted, never shown with a wrong return". The code as built does not meet F3c unless the vendor restates history in
  split-adjusted units. That is unverified, and it is the one fact that would remove this risk.
- Reverse splits are routine among low-priced listings. One listed issuer's 2025 proxy, filed on sec.gov, asks
  shareholders to allow a 1:2 to 1:20 split at any time before 2026-12-31 [S9]. The exchanges also had to restrict
  repeated reverse splits in 2025 (not opened; Low). TR-3 imports full history, so among 50 active traders, at least one
  affected record looks likely (HYPOTHESIS, Medium).
- A single +800% card shared publicly is the trust incident that ends a "Verified" brand.

**C2. Real, linkable winning records are good bait for impersonation scams. FACT (High) on the threat; HYPOTHESIS
(Medium) on transfer to this product.**
- FINRA's 9 Dec 2025 alert describes the pattern [S1]:
  - fake "investment groups" promoted on social media, then moved into encrypted group chats;
  - scammers who use "the names of real advisers with clean records";
  - an FBI figure of at least a **300% rise** in complaints about ramp-and-dump schemes over 2024.
- FBI IC3 investment-fraud losses [S2]:

  | Year | Reported losses |
  |---|---|
  | 2023 | $4.57B |
  | 2024 | $6.57B |
  | 2025 | $8.65B |

  2025 was +32% on 2024 and +89% on 2023. Victims are "introduced to investment groups… shown fake profits".
- On 29 Sep 2026 the SEC charged "investment club" chat schemes that took ≥$15M with fictitious profits and a falsified
  regulatory filing shown as proof [S3].
- Transfer (HYPOTHESIS): today's bait is *fake* proof. A public, broker-sourced profile is *real* proof that anyone can
  link to while posing as that trader in a chat.
  - The anti-crop band (C13) and handle integrity (P-2) protect the image, but not a link pasted into a chat by someone
    claiming to be the handle.
  - F-6 lists open-position symbols on profiles. Those are the raw material for "watch what I hold" touting.
    (Position *size* is kept off open positions, F-5.)

**C3. The disposition effect is now sourced, and it makes timing risk sharper. FACT (High) on the study; HYPOTHESIS
(Medium) on transfer.**
- In 10,000 discount-brokerage accounts, investors showed "a strong preference for realizing winners rather than
  losers" [S4]. This sources c1's unsourced RT5-15.
- Implication: closed-trade win rates flatter a record, and losses sit in open positions. Since F-6 (2026-11-01), open
  positions appear in every number. So a market drawdown inside the 8-week window pushes the cohort's visible records red
  at once, and both G2 (sharing) and G1 (connects) fall together. The gates are correlated through the market, not only
  through cohort mix (c1 §9).

**C4. Participation is flat, not fading. The near-term risk is launching into a drawdown. FACT (High) on the surveys;
Low on the activity figures.**
- Fed SHED 2025 (survey of ~13,000 adults, Oct 2025) [S5]:
  - 37% of adults hold stocks, bonds, ETFs or mutual funds outside a retirement account (c1 used 35%, from SHED 2024);
  - by age: 18% at 18-24, 33% at 25-54, 45-48% at 55+;
  - crypto bought or held: 9% (7% in 2024, 11% in 2021).
- Fed SCF: stock-market participation 58% (2022) → 56% (2025); median holdings among holders up 36% [S6].
- Secondary sources put retail at ~20-25% of US equity volume in 2025, with record spikes [S12]. Not opened; Low; not
  used as a number.
- Net: c1's "fading cycle" (RT-C10) is weakened. The risk is cyclical: elevated activity now, with a 10%+ drawdown during
  weeks 1-8 as the trigger (C3).
- The youngest adults hold the least outside retirement accounts. The adults 18-29 audience the feed suits has the
  smallest accounts, which fits c1 finding #9 (a narrow paying job).

**C5. Broker-native social is now general, live and frictionless. FACT (Medium) for the launch facts; Low for the
rollout date.**
- A commission-free app broker's 18 Mar 2026 beta offered [S7]:
  - KYC-verified profiles;
  - trades "verified live", with followers seeing when a poster "enters or exits a position";
  - 1-year and daily P&L and a profit rate.
  Beta seats went to customers chosen partly for trading frequency.
- Secondary reports say it opened to all eligible US customers in Oct 2026 [S12]. Also reported, unopened: a copy-trading
  platform offering copying to US users since Oct 2025, and an independent app where users link brokers and post
  verified positions under pseudonyms (Low).
- Transfer (HYPOTHESIS): for status-seeking S2 traders, the broker feed gives live reach and lets them choose what to post,
  at no cost. Stock Social's whole-record rule is then purely a cost to them.
- The real wedge is accountability-minded traders (S3) and long-record investors (S4). The live, push-style features the
  broker offers are ones POLICY F3b bars here, so they cannot be matched, and should not be.

**C6. Vendor: the live terms are unchanged, but two pre-launch dependencies are easy to miss. FACT (High).**
- The Developer Terms are still "Last Updated: May 22, 2026" [S8]:
  - termination or suspension "at any time";
  - no re-packaging "to third parties";
  - no storing of Market Data;
  - "Some brokerages require Client to be approved before accessing the integration."
- The Application Compliance Policy (2024-09-19) requires compliance "prior to launching in production", ongoing
  monitoring, and the right to "shut off access… for non-compliance" [S10].
- Pricing [S11]:
  - Build: $0, up to 5 connections, personal and testing use only. This is a free pre-launch rig.
  - Launch, daily data: $100 a month plus $1 per user; manual sync $0.05.
- New point (HYPOTHESIS, Medium): F-1's "about 95% of retail accounts" target may depend on **per-broker approvals**
  that take time. G1 can fail on coverage rather than demand.
- Upstream: the federal data-rights rule is being rewritten, and secondary reports say it may allow data providers to
  charge fees (proposal at White House review, Aug 2026; not opened; Low) [S12]. Brokerage accounts were outside the 2024
  rule, but fees anywhere in the data chain can reach the vendor's price, which can change on 30 days' notice.

**C7. State age laws now reach feed designs, not only adult content. FACT (High) on the statute; HYPOTHESIS (Medium)
on exposure.**
- Florida §501.1736 defines a covered platform by four tests together [S13]:
  - users can upload or view content;
  - ≥10% of daily users under 16 average ≥2 hours a day;
  - algorithmic selection of content;
  - one "addictive feature": infinite scrolling, public reaction or share counts, autoplay, push notifications or
    live-streaming.
  Penalties reach $50,000 per violation, plus a private right of action.
- An appeals court let it be enforced from Nov 2025 (secondary; not opened; Medium).
- Exposure: the swipe feed (infinite scrolling) plus F-2 ordering (algorithmic selection) meets two tests by design. The
  under-16 test is the only shield, and 18+ attestation alone cannot prove it.
- Injunctions in other states often protect only the plaintiffs' members (c1 FC-L34), not a non-member startup.

**C8. Privacy enforcement is active, but unlikely to be the first killer. FACT (Medium); HYPOTHESIS on timing.**
- California's attorney general reached a $12.75M settlement in May 2026, described as its first data-minimization case
  [S14]. The state privacy agency keeps fining data brokers [S14].
- Early exposure is reputational (one leak of broker-linked identities) more than regulatory. Statutory revenue and volume
  thresholds probably exclude a pre-revenue startup (not verified this pass). GLBA/Safeguards duties apply anyway
  (c1 §7).

---

#### Risk register

L = likelihood, I = impact. Costs are cash plus founder hours. Pass/fail thresholds are proposals.

| # | Risk | L | I | Shows by | Leading indicator | Cheapest test (cost · pass/fail) | Gate |
|---|---|---|---|---|---|---|---|
| R1 | **Supply refusal and selection.** Traders won't publish whole records with losses; only currently-green traders connect (c1 C1-C2, plus C3 here) | H | Fatal | Weeks 1-4 | Preview→publish rate; publish rate by record sign; declines that cite losses | Whole-record preview (c1 T4) on the Build plan with ≤5 live links, plus 30 recruited adults. **$0, ~15 h.** Fail if under 1 in 3 previewers publish, or if no negative-record previewer publishes | G1, G2 |
| R2 | **Distribution: links don't travel.** Platforms suppress outbound links; images get no click-through (c1 §6) | H | Fatal | Weeks 2-6 | External uniques per sharer per week (median, not mean), split by `?via=` | 2-week concierge: 10 traders post the card image with the link in a reply or bio; count first-party `?via=` uniques. **$0, ~20 h.** Fail if under 1,000 external uniques/week in total (pace for G3 ≈ 100/trader) or a median under 25 | G3 |
| R3 | **Vendor refusal, termination or repricing** (c1 §8, plus per-broker approvals, C6) | M | Fatal | Before launch | Silence from the vendor; brokers marked "approval required" | Written request (c1 T1) **plus** a list of which brokers the first-50 outreach list uses that need client approval. **$0, ~4 h.** Fail if no written yes on public closed %, stored open % and the paid tier, or if approved brokers cover under 80% of the outreach list | G0, G1 |
| R4 | **Wrong P&L on a "Verified" record** from splits and other corporate actions (C1) | H (≥1 of 50) | High: trust incident, F3c breach | First full import | Lot units ≠ vendor position units for the same symbol; returns over +300% or under −90% | (a) Two synthetic fixtures (forward and reverse split) in `lib/trades.test.ts`. (b) Ask the vendor whether historical activities are split-adjusted. (c) Reconcile open lots against vendor positions for each test account. **$0, ~6 h.** Fail if any mismatch is not excluded and counted | G2 (honest sharing), brand |
| R5 | **Curiosity without return.** Viewers look once; no push (F3b) means nothing brings them back (c1 C6) | H | High | Weeks 3-8 | Follows per 100 signed-in viewers; second-visit rate among followers | One-niche seed: 20 traders, 4 weeks, D7 of followers with n≥200. **$0, ~25 h.** Fail if under 10% (the CI excludes 15%) | G4 |
| R6 | **Founder bandwidth.** 75-160 contacts a week (c1 §6) on top of the pre-launch list (auth, Terms, vendor, age and privacy items) | H | High: delays week 1 or starves outreach | Weeks 1-3 | Contacts sent a week; slipped pre-launch items | 1-week outreach sprint with a time log. **$0, 40 h.** Fail if under 75 contacts or a reply rate under 20%. Then G1 needs >8 weeks; re-plan before launch, not at week 8 | G1 |
| R7 | **Scam bait and pump touting** (C2): profiles and cards used to fake credibility in chats; open-position symbols used to tout | M | High: reputational, regulatory | Months 1-6 | Impersonation reports; handles seen off-site; inbound "is this you?" messages | Tabletop exercise: 8 adult testers see a real card pasted into a mock group chat by a fake account. **$0, ~6 h.** Fail if under 80% can tell the post isn't from the trader, or if no report or takedown path is live (U2/U3) | Brand, G3 |
| R8 | **Monetization far below break-even** (c1 §5, §10) | H | Fatal by month 6, not by week 8 | Months 2-6 | Painted-door joins per 1,000 signed-in returning viewers | Painted door (c1 T8, under its conditions). **$0, ~8 h.** Fail if under 1.5% join (CI lower bound) at ≥1,000 exposed. At ~12k monthly uniques, 0.25% is 30 payers ≈ $264 net against ≈$150 of vendor cost (50×$1+$100), so it covers the vendor but no people (ESTIMATE) | G5 |
| R9 | **Broker-native competition** (C5): S2 traders already post on a broker feed | M-H | Medium (narrows supply to S3/S4) | Weeks 1-4 | Share of outreach targets already posting on a broker feed | One extra question in R6's outreach. **$0, 1 h.** Fail if their connect rate is under half of other targets' | G1 |
| R10 | **Market drawdown in the window** (C3, C4) | M | Medium-High (correlated miss of G1+G2) | Any week | Broad index drawdown ≥10% during weeks 1-8 | Pre-register: report share rate by record sign (C30) and mark gates "confounded" if a ≥10% drawdown occurs. **$0, 1 h** | G1, G2 |
| R11 | **Adviser/publisher status, signal-seller users** (c1 §7) | L-M | High | Months 2-6 | Registered representatives among sign-ups; cards used in paid-group ads | Sign-up question "registered adviser or representative?" plus a weekly sample of 20 off-site card uses. **$0, 2 h/week.** Fail at >5% yes without the conditions F-5 requires | Legal |
| R12 | **State age laws** (C7) | L | Medium-High | Months 1-6 | Infinite feed + algorithmic ordering + public counts all live | Design check: keep public reaction counts off, so the addictive-feature test fails, and log the legal committee's state map. **$0, 3 h.** Fail if the product meets 3 of the 4 tests | Legal |
| R13 | **Privacy incident or enforcement** (C8) | L | High | Any time | Logs joining account ids to user ids; deletion requests unmet within 30 days | Grep logs plus a deletion drill on a test user. **$0, 3 h.** Fail if any raw payload or secret is in logs, or deletion leaves data behind | Pre-launch (P6) |

---

#### Top 8, ranked by expected damage × how early it shows

1. **R1 supply refusal and selection.** Fatal, early and cheap to test; everything else depends on it.
2. **R2 distribution.** The views gate is the likeliest single miss (c1: 1.5-50× short).
3. **R4 wrong Verified P&L.** Likely, costs $0 to find and destroys the brand if missed. Run it before any real import.
4. **R3 vendor.** Lower likelihood, but nothing survives it. Per-broker approvals add a coverage failure mode.
5. **R6 founder bandwidth.** The quiet cause of R1 and R2 misses. Measure it in week 0, not week 8.
6. **R5 curiosity without return.** F3b removes the usual return lever by design.
7. **R7 scam bait and pump touting.** Fraud volume is up 32% in a year and ramp-and-dump complaints are up ≥300%.
   Damage is slower but asymmetric.
8. **R8 monetization.** Near-certain to look weak; it kills at month 3-6 unless G5 data arrives early.

Watch list: R9 (it mostly sharpens R1), R10 (it confounds R1 and R2), R11-R13.

**Order of tests (ESTIMATE): R4, R3, R6 sprint, R1 preview, R2 concierge, R7 tabletop, R5 seed, R8 door.**
Total about $0 cash and ~125 founder hours, most of it outreach that has to happen anyway.

---

#### Sources (all opened 2026-11-01 unless marked)

- [S1] FINRA investor alert, "investment group" imposter scams, 9 Dec 2025. https://www.finra.org/investors/insights/investment-group-imposter-scams. Opened: yes.
- [S2] FBI Internet Crime Complaint Center, 2025 annual report. https://www.ic3.gov/AnnualReport/Reports/2025_IC3Report.pdf. Opened: yes (text extracted).
- [S3] SEC press release 2026-95, charges against chat-group "investment club" schemes, 29 Sep 2026. URL withheld (the path names a messaging app, T1). Opened: yes.
- [S4] Journal article on the disposition effect, 10,000 discount-brokerage accounts, 1998. https://doi.org/10.1111/0022-1082.00072 (abstract read on the author's academic page; URL withheld because it carries a person's name, T2). Opened: yes.
- [S5] Federal Reserve Board, Economic Well-Being of U.S. Households in 2025 (May 2026), Table 28 and Table 33. https://www.federalreserve.gov/publications/files/2025-report-economic-well-being-us-households-202605.pdf. Opened: yes.
- [S6] Federal Reserve Board press release, 2025 Survey of Consumer Finances, 9 Oct 2026. https://federalreserve.gov/newsevents/pressreleases/other20261009a.htm. Opened: yes.
- [S7] Company page, a commission-free app broker's newsroom post on its social beta, 18 Mar 2026. URL withheld (T1). Opened: yes.
- [S8] SnapTrade Developer Terms of Use, last updated 22 May 2026. https://snaptrade.com/developer-terms-of-use. Opened: yes.
- [S9] sec.gov EDGAR, a listed issuer's 2025 definitive proxy seeking reverse-split authority. URL withheld (the file name carries the issuer's ticker). Opened: yes (partial).
- [S10] SnapTrade Application Compliance Policy, updated 19 Sep 2024. https://snaptrade.com/compliance-policy. Opened: yes.
- [S11] SnapTrade pricing page, 2026. https://snaptrade.com/pricing. Opened: yes.
- [S12] Secondary news and law-firm summaries: retail share of volume, the broker feed's full rollout (Oct 2026), copy-trading in the US, the data-rights proposal at White House review (Aug 2026), the Florida stay (Nov 2025). Opened: no (search results only). Low.
- [S13] Florida Statutes §501.1736 (2025). https://www.flsenate.gov/Laws/Statutes/2025/501.1736. Opened: yes.
- [S14] California DOJ and privacy agency enforcement announcements, 2026. https://oag.ca.gov/news/press-releases and https://cppa.ca.gov/announcements/2026/20260108.html. Opened: no (search summaries). Medium.
- Repo: `lib/broker.ts` (lines 96, 135-145, 160), `lib/trades.ts` (lines 36-86), docs/POLICY.md (F3c, U2, U3, P6), docs/features/F-1, F-5, F-6; cycle 1 record docs/direction/market-2026-11-01.md (§6, §8, §9, §11, F11).

#### Open questions

1. Does the vendor return historical activities in split-adjusted units, and does it expose split or corporate-action
   activity types? This decides whether R4 is a bug or a non-issue.
2. Which brokers in the day-one coverage set need per-client approval, and how long does approval take?
3. Will profiles show public reaction counts (likes, follows)? If they do, the product meets three of Florida's four tests.
4. Should the report and takedown path (U2/U3) include an "impersonation of this trader off-site" category before
   launch?
5. Is there a primary source (an SEC or academic series) for the retail share of volume from 2025 to 2026, to replace S12?

---

# Part F. The shared brief given to every member

Paths to the council's scratch folder are replaced by descriptions (POLICY P1).

### Market research council, cycle 2 (2026-11-01): shared brief — read fully before working

You are one member of cycle 2 of the market research council for **Stock Social** (repo: the repository,
READ-ONLY for you; write only your own output file in the council folder). Do not edit the repo, do not commit, do not run git commands that change state.

#### Product in one paragraph
Public, verified trading records pulled read-only from supported brokers via the data vendor SnapTrade. Traders connect a
broker; closed trades (percent returns only, never dollar amounts or quantities) appear on a public profile and in a
full-screen vertical swipe feed; the profile link unfurls as a share card. Losses rank like gains; whole record shown
(no per-trade hiding, open positions, confidence intervals, rankings by interval lower bound, records freeze on disconnect).
Traders never pay and are never paid. Viewers pay for "Record tools" (compare traders side by side, saved views, private
notes; pull-only, nothing pushed) at $9.99/month or $99.99/year, no free trial at launch (owner decisions, F-3). Billing runs
in the processor's test mode only until the owner switches on real charges. Adults only (18+). No advice, signals, alerts
on trades, or rewards for trading activity. Pre-launch: no real users yet; auth is still a dev stub.

#### Week-8 kill gates (docs/DESIGN.md §3.5) — owner's targets, unchanged
≥50 traders with a connected broker; ≥60% of them share their card at least once; ≥5,000 profile views from external
referrers per week; viewer D7 return ≥15%. Miss two or more → stop and re-interview ICP-S1.

#### Cycle 1 already found (do NOT repeat; build on it, challenge it where you have new evidence)
Cycle 1's full record is at docs/direction/market-2026-11-01.md (460 KB; read Part A lines 39-670 = chair's synthesis;
then grep for what your role needs). Key cycle-1 conclusions:
- Break-even conversion at scale = (trader_share × $1 + $0.004) ÷ $8.80; ranges 0.07-1.18% depending on viewers per trader.
- Conversion and trader share are unmeasured; council prior 0.1-0.5% paying as a stock.
- Gates not instrumented as built (no view capture, dead share column, D7 signed-in only); at n=50 the 60% share gate is a coin
  flip (P(≥30/50 | true 60%) = 56%). Proposed G0 (vendor written answer), G5 (painted-door payment intent).
- Vendor terms may cover stored open %, public display and the paid tier; hourly sync would exceed vendor polling guidance.
- "Verified" alone no longer differentiates (a commission-free app broker has a free identity-verified feed where posters
  choose what to post). The unique combination is no per-trade hiding + losses ranked like gains + intervals + freeze.
- $9.99 looks like a ceiling (opinion, Low); paying job is narrow (repeat follower-choosers).
- Distribution must be founder-led and image-first: link posts get ~1.1% of feed views on a large network; non-news links cut
  visibility ~4-7×; paid ads lose money with no trackers (P6); views gate likely misses by 1.5-50× depending on mix;
  founder needs 75-160 contacts a week for 50 connects.
- Cycle 1 tests T1-T11 and proposals #1-#14 (Part A §11 and §13).
Creative direction council proposals: docs/direction/creative-2026-11-01.md §11 (line 1111+). Design direction council proposals:
docs/direction/design-2026-11-01.md "Proposals" (line 1188+ detail, 1467+ table).

#### Approval-council candidates (the list cycle 2 validates; group them as your role needs)
From docs/IDEAS.md (candidate column): #13 go-to-market + gate counters; #14 projection assumptions + cheapest test; D20 disclaimer
in plain view; D21 neutral sign-in with two paths; D22 record line on every feed card; D23 profile headline leads with average and
range; D24 plain labels; D25 remove developer text / completeness slip; D26 production switch until Terms live; D27 first-visit
explanation; D29 "last close · updated" freshness.
From cycle 1 (MRC): #1 vendor written answer; #2 sync cadence; #3 first-party cookie-free view counting + share-event fix;
#4 gate revisions; #5 dashboard restatement; #6 painted-door with disclosure; #7 trial/money-back arm; #8 free limited Record tools;
#9 first 50 from transparency-led traders; #10 interviews; #11 whole-record preview as the connect disclosure + publish
"previewed, didn't publish" count; #12 positioning "No per-trade hiding. Losses shown and ranked like gains."; #13 delete vendor
connection on disconnect, keep frozen record; #14 deny-list simulated brokerages, honest coverage copy.
From creative council (selected, non-duplicate): C1 positioning line; C7 "Disconnected ‹date›" on all surfaces; C13 anti-crop band
on images; C25 swipe hint; C27 finish F-4 share card gaps; C29 story size; C30 fix share mislabel + split share rate by record sign;
C31 static og:image for /; C32 JoinCta under headline stats; C33-C36 handle/name integrity, report action, thesis timestamps,
moderation additions.
From design council: P-1 thesis safety v2; P-2 handle integrity; P-3 one trust language; P-4 record context everywhere; P-5 one number
format; P-6 feed reading mode; P-7 sign-in by intent / safe return-to; P-8 owner sees public record; P-9 wayfinding; P-10
design-system foundation + CI gate.
Already decided features: docs/features/F-1..F-6 (read the ones relevant to you; F-3 = pricing/billing decisions).

#### Binding rules (docs/POLICY.md — read it)
- **T1/T2/T4: never write a third-party company, product, app, platform or real person's name** in your file — not even when
  describing competitors or channels. Describe generically: "a large professional social network", "a short-video platform",
  "a link-aggregator forum with topic communities", "an investor microblog", "a commission-free app broker", "a group-chat
  app", "a newsletter platform", "a podcast directory", "an app store". Only integrated vendors may be named: SnapTrade,
  Stripe, Next.js, React, Vercel, Postgres, Playwright, GitHub, Claude/Anthropic.
- **Source URLs**: label every claim **FACT** (a source you actually opened this session, with URL), **ESTIMATE** (arithmetic shown
  on facts + stated assumptions), or **HYPOTHESIS** (judgment). URLs only when the domain/path contains no third-party brand:
  prefer government, regulator, court, academic, statistics, standards (sec.gov, finra.org, ftc.gov, consumerfinance.gov,
  federalreserve.gov, bls.gov, census.gov, ecfr.gov, law.cornell.edu, doi.org, arxiv.org, ssrn.com, nber.org, pewresearch.org,
  w3.org, nist.gov...). A company / platform page may be used as a source but cited as "[S<n>] company page, <generic
  description>, <date>, opened 2026-11-01 (URL withheld under T1)". Say "opened: yes/no".
- **No invented data**: no fabricated quotes, surveys, interviews, numbers. Persona walkthroughs are labelled "SIMULATION — not
  research data". Forum/review themes summarized without quotes or usernames.
- **No advice**: nothing recommending securities or trades. No performance promises. No completeness claims ("every trade",
  "any broker", "the only").
- **Adults only**: never minors or cohorts including minors (any age cohort that includes minors); say "adults 18-29".
- Avoid the words "guaranteed", "risk-free", "beat the market", "copy their trades" except when quoting a rule.
- Hard product limits for any channel or test you propose: no paid promotion of records, no paying or rewarding traders
  (F5/F6), no pushed record content (F3b: no notifications/emails whose content or timing comes from records), no third-party
  trackers or pixels (P6), adults only (P4), no performance promises (F2), disclaimer on anything showing performance (F3).
- Confidence on each claim: High / Medium / Low.

#### Output format
Markdown file at the path your task gives. Header (member, pass). Numbered claims C1..Cn each with label (FACT/ESTIMATE/
HYPOTHESIS), evidence, source ids, confidence. Tables welcome. A sources list [S1]... (generic description, publisher type, date,
URL if T1 allows, opened yes/no). Open questions. Dense: 1,200-2,500 words. Write ONLY your own file.
