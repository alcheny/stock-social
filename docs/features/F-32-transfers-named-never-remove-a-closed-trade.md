# F-32 · Transfers are named, and never remove a trade after it closes

Status: blocked
Blocked: Part A: development paused by the owner 2026-11-02 (resume: set back to ready; F-24 merged as #84 and chore C5-43(b) as #107); Part B also waits for the vendor's written answer to MRC2-10 (the owner said yes to OD 2.28 on 2026-11-02)
Start conditions: Part A starts when #84 merges; its version bump ships only once C5-43(b) is on main. Part B starts
when the owner answers OD 2.28 (`docs/direction/owner-decisions-2026-11-01.md` §2) and the vendor confirms in writing
that a split or stock dividend never arrives as a transfer row (MRC2-10). It is the matcher build slot, shared with F-36
(one builder, separate version bumps).

## Why
A one-share transfer can remove a loss on that stock in that account, closed up to 14 days earlier, chosen after the
loss is seen. The vendor's transfer rows become unpriceable actions (`lib/corporate-actions.ts:157`, `:186-187`,
`:204`), and the corporate-actions committee's Q2b puts every unpriceable action in the 14-day backward window
(`docs/features/logs/corporate-actions/committee-2026-11-01.md:28`; `lib/trades.ts:128-133`, `:149-153`). In the
cycle-5 audit's fictional end-to-end probe, a win rate of 80% became 100% and an average of −5.4% became +8.3%, and
the record still showed Verified with one generic "1 trade excluded" line (council cycle 5, C5-1, brief rank 1).

The council's red team then showed a second path (round 4, probe p4): a transfer dated *before* the sell taints every
open lot of the pair (`lib/trades.ts:73-75`), so a trader can still remove an open loser, with no time limit. Closing
that path is F-22's transfer rule (OD 2.28). This feature names every transfer exclusion now, and once OD 2.28 and the
vendor allow it, stops a transfer from reaching back over a trade that has already closed.

Approved by the approval council (`docs/ideas/approval-2026-11-01-cycle5.md`: second-vote mean 4.93, final vote 15/15,
all with conditions).

## Decisions
- 2026-11-01: Part A (interim, needs no owner answer): every sell that a transfer row excludes is counted under its own
  reason, "transfer", never under the generic corporate line. This covers the backward window (`latePosted`), the
  same-day rule (`sameDayAction`) and forward-tainted draws on a transfer row's units. The reason travels as one more
  `excluded*` key of `MatchResult`, so F-21's guard sees it, and forward taints carry their cause on the taint itself
  (`lib/trades.ts:73-75`), not in a second pass. Why: approved by the approval council (cycle 5); brief C5-1; RT round 4
  (the forward and same-day paths); EN.
- 2026-11-01: When a split or stock dividend and a transfer both exclude a sell, the split or stock dividend wins the
  reason. A transfer can never relabel a real corporate-action exclusion. Why: approved by the approval council (cycle
  5); RT round 4.
- 2026-11-01: The "transfer" count is a count only. It carries no units, no transfer date and no account, and stores
  no new units, date or account. Why: approved by the approval council (cycle 5); PR, LC (P3) (veto condition: LC).
- 2026-11-01: The reason's words are neutral and muted, with no blame and no warning colour or icon, for example
  "excluded: a share transfer in this stock". The label is one `lib/copy.ts` constant, which the profile's per-reason
  line and F-21's pane line both render. /how says, in plain words, that the count is a limit of matching and does not
  judge the trader, and it names transfers in (as POLICY F3 already does). Naming transfers out in POLICY F3 is the
  owner's edit (OD 2.28, brief §3.17). Why: approved by the approval council (cycle 5); VW, TR, UX, DS, LC, CO.
- 2026-11-01: Part B (full form; waits on OD 2.28 and the vendor's MRC2-10 answer): transfer rows (TRANSFER and the two
  external transfer types, unpaired) get their own `reason: 'transfer'` and leave the backward window. A later sell that
  draws on transferred-in units is still tainted forward (C3-2 and F-22's forward rule unchanged). An unpaired
  ADJUSTMENT stays in the window and is named in the code as broker-initiated. Why: approved by the approval council
  (cycle 5); brief C5-1; the condition from the cycle-5 audit (the window exists because the vendor may post an
  event's row on another day, `lib/trades.ts:53-56`).
- 2026-11-01: The title is never product copy. Until Part B and F-22 (OD 2.28) land, no outreach, first-contact or
  product copy says a trader "can't remove a loss", "nothing hidden" or "can't be steered" without the exclusion
  qualifier. Use "can't hide single trades". Why: approved by the approval council (cycle 5); MA, BL, LC (F3a), CO
  (veto condition: CO, a claim that a loss can never be removed).
- 2026-11-01: Version bumps: Part A has its own MATCHER_VERSION bump, and Part B another. Neither ships in the same
  deploy as F-36's bump. Each bump ships only once chore C5-43(b) (matcher catch-up in the sync tick) is on main.
  If a second bump arrives before the first has drained, the catch-up rebuilds straight to the latest version. The
  deploy rebuild reports counts only: published-to-counted moves per reason, plus failures with each cause logged.
  Theses survive by `sell_id`. Why: approved by the approval council (cycle 5); RT round 4, RE, EN.
- 2026-11-01: Owner flags, recommended, not decided here:
  - OD 2.28 (F-22) goes on the launch-relevant list before Beta wave 0, because the forward path survives even Part B.
  - OD 2.7's consent version names the public exclusion counts, which this feature splits by reason.

  Why: approved by the approval council (cycle 5); BL, PR, LC.
- 2026-11-02: The owner said yes to OD 2.28 (F-22 approved, `Status: ready`). Part B now waits only for the vendor's
  written MRC2-10 answer. F-24 (#84) has merged, so Part A waited only for chore C5-43(b) before its version bump
  ships; that merged as #107, so Part A now waits only for the owner to resume development. Why: the owner's decision
  of 2026-11-02 (OD 2.28).

- 2026-11-02: Part A build (committee `docs/features/logs/F-32/committee-2026-11-01.md`): transfers are recognised in
  the loader from the stored vendor row's type, so nothing new is stored and older rows read the same; a lot keeps
  "transfer" as its cause only while every taint on it came from a transfer; a non-transfer action that reaches the sell
  (taint, window or day, the oversell path included) wins the reason; the gap a transfer leaves on an empty ledger stays
  "no recorded entry". The label is `TRANSFER_REASON` ("a share transfer in the same stock"); /how says "close to the
  sell's date" and does not print the 14-day window (owner item); the corporate line keeps "a share move" (unpaired
  adjustments). Why: committee rounds 1-2 (UX lead, business lead, engineer); OD 2.28 answered yes (relayed by the
  orchestrator, 2026-11-02), F-22 follows as its own PR.

- 2026-11-02: Part A build (committee `docs/features/logs/F-32/committee-2026-11-01.md`): transfers are recognised in
  the loader from the stored vendor row's type, so nothing new is stored and older rows read the same; a lot keeps
  "transfer" as its cause only while every taint on it came from a transfer; a non-transfer action that reaches the sell
  (taint, window or day, the oversell path included) wins the reason; the gap a transfer leaves on an empty ledger stays
  "no recorded entry". The label is `TRANSFER_REASON` ("a share transfer in the same stock"); /how says "close to the
  sell's date" and does not print the 14-day window (owner item); the corporate line keeps "a share move" (unpaired
  adjustments). Why: committee rounds 1-2 (UX lead, business lead, engineer); OD 2.28 answered yes (relayed by the
  orchestrator, 2026-11-02), F-22 follows as its own PR.

## Acceptance criteria
Part A:
- [ ] The audit's p5 probe (fictional: WX bought 100 @100 and sold @40; YX bought 100 @100 and sold @140; a +1 WX
      transfer in 12 days after the WX close) shows a "transfer" count of 1 and no generic corporate line for that sell.
- [ ] RT's three forms each count under "transfer": a transfer in, a transfer out with 0 held, and a transfer row
      with no units. So do the same-day form and a forward-tainted draw on transferred-in units.
- [ ] A unit test: a split and a transfer inside the same window give the sell the split's reason.
- [ ] A pinned test records the forward case (probe p4: a transfer before the sell) as still excluded, counted under
      "transfer", with a comment naming OD 2.28 / F-22. It asserts both the reason and the count.
- [ ] A split inside the window still taints as today. Every existing window test is kept unchanged.
- [ ] The reason is a `MatchResult` `excluded*` key, and F-21's guard fails if it is left out of the shared sum.
- [ ] No row, payload or page carries the transfer's units, date or account (source scan plus a render test).
- [ ] The /how sentence and the profile line render the same `lib/copy.ts` constant, in muted text that is a real link
      with a descriptive name, a 44 px target, reflowing at 320 px.

Part B (after OD 2.28 and MRC2-10):
- [ ] A seeded property test over random fictional ledgers: inserting a transfer row (in, out or no units) dated after
      the sell never raises a shown average or win rate. It logs its seed, and CI replays fixed seeds.
- [ ] On the p5 probe the −60% close stays published (win rate 50%), and the transfer count is 0 for that sell.
- [ ] A sell that draws on transferred-in units is still counted.

Both bumps:
- [ ] Two bumps over 50 fictional records, with no deploy, drain to the latest version, and no record is left on an
      intermediate one. The rebuild report gives counts per reason only.

## Out of scope
- Closing the forward path (a transfer dated before the sell). That is F-22's basis rule, which waits on OD 2.28.
- Clearing the oversell mark from vendor position reads (owner item; `lib/broker.ts` is protected).
- Any change to POLICY F3's exclusion list (owner, brief §3.17).

## Open questions
- Resolved 2026-11-02 (OD 2.28): yes; F-22 is `ready`.
- Vendor (MRC2-10): can a split or stock dividend ever arrive as a transfer row? Part B waits on a written "no".
- Owner (OD 2.7): name the public exclusion counts in the next consent version?

## POLICY notes
- F3c (never guess, count what is excluded): every exclusion stays counted, now with its true cause.
- F3a: the title and the label never claim completeness. The words are "can't hide single trades", never "can't
  remove a loss", until Part B and F-22.
- P3: count only. No transfer units, dates or accounts are stored or shown.
- TR-1 (no per-trade hiding): Part B removes a path a trader can steer, and Part A makes the remaining path visible.

## Hand-offs to in-flight work
- F-24 (#84): Part A rebases on #84's `replay` and `MatchResult`, and on its `excludedHeld` key.
- F-21 (re-approved this cycle): the "transfer" reason joins F-21's one exclusion-sum function, and F-21's line links to
  the per-reason lines.
- F-36 (same slot): one builder, separate MATCHER_VERSION bumps, never in the same deploy.
- Cycle-5 chore C5-43(b): it must be on main before either bump ships.
- F-28/F-30 lapsed this cycle (draft). No shared bump with them.

## Rework notes

## Build log
- 2026-11-02: Part A built on `claude/f32-transfers-part-a` (PR pending): matcher, `users.excluded_transfer`, profile and
  compare-card line, /how sentence, `EXCLUDED_KEYS`/`exclusionSum`, MATCHER_VERSION 3, per-reason report helper. Merges
  only after chore C5-43(b), which must be merged in first so the report is wired into its rebuild loop.
