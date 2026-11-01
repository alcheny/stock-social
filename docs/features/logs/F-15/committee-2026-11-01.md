# F-15 committee record, 2026-11-01

Build session for F-15 (measurement foundation, first slice), started by the owner's orchestrating session. The owner's
instruction of 2026-11-01: decide open questions with the committee's recommended option after debate. Roles were played
by subagents with fresh context (no member graded its own work).

## Cycle
1. Fact sheet (engineer's sketch): `facts.md`.
2. Plan drafted by the UX lead: `plan.md` §1-11, with seven open questions and a recommendation each.
3. Round 1 reviews: business lead DEMANDS D1-D10 (validation not tautological, no G4 signed-in count, exact G1, rate cap
   60/min, fetch metadata, template e2e, small-cell subtraction, drops surface, body validation, G3 order); engineer
   DEMANDS E1-E14 (human visits vs the automation rule, no platform names, n = 1 on insert, purge clock and batch key, no
   CHECK on reason, story mis-tag on desktop, exact e2e updates, rename wording, realpath guard, complementary
   suppression, route seam, A14 method, beacon lifecycle, trusted address).
4. Round 2: all demands folded into `plan.md` → "Round 2 revisions". Business lead SIGN with R1 (skip the cap with no
   trusted address); engineer SIGN with two build notes (validation order; `--out` equal to the repo root). UX lead: plan
   author; revisions keep every screen decision.
5. Build: tests first per criterion, then code (orchestrator as engineer; readout built by an engineer subagent).
6. QA, user tests and independent review: `qa-round1.md`, `user-test-round1.md`, and the review section below.

## Decisions (each also appended to the feature file's Decisions)
1. Mount point: the beacon mounts from a new `app/template.tsx` that renders a fragment (`{children}<ViewBeacon />`), so no DOM node is added and `app/layout.tsx` is untouched until F-13 merges; the beacon re-arms on each pathname. Why: the only option that touches no F-13 file; per-page lines would edit F-13's files and be forgotten on new pages.
2. Retention bound: rollup and drop rows are purged after 120 days by a `views` step in the existing privacy purge on the sync tick; the owner may change the number. Why: covers the 8-week gate window plus re-reads, and matches E6's 120 days so the Privacy Policy can state one number.
3. Invite codes: the registry holds two invite codes, `inv_t` (transparency-led recruiting segment) and `inv_h`; numbered codes are rejected. Why: numbered codes invite one code per person, which breaks "a class, never a per-person id".
4. Share classes: `card` (profile), `story` (profile shared with its story picture, only when the share sheet takes the picture), `trade`, `month`; the class is chosen at click time from the path the share took. Why: the format split the market council asked for, without mis-tagging a copied link as a picture share.
5. Rate cap: in memory, per server instance, 60 beacons per client per minute; the key is a salted hash (salt replaced hourly) of the trusted client address and user agent, never stored or logged; with no trusted address the cap is skipped. Why: a reader swiping the pane can send one every 2 s; keying on the agent alone would undercount readers who share a common browser (business lead R1).
6. Drop rollup: `view_drops` (day, surface or `other`, reason, count; no user id) is stored with the same retention. Why: the only drift signal in weeks 1-8 and the source of the false-count rate.
7. No CHECK on `surface`, `via` or `reason`: they are validated in code against the closed lists and a db test fails on any stored value outside them; `ref_class` keeps its CHECK. Why: adding a code later would need a `drop constraint`, which the CI schema rule forbids.
8. Readout: weekly, owner-run (`scripts/f15-readout.ts --out <dir>`, refused inside the repo by a realpath check), Markdown; every cell from 1 to 4 prints "<5", a complementary cell is hidden so no small count can be worked out by subtraction, totals with hidden cells print "≥ n". Why: POLICY P3 (the red team's invite-link case) and the engineer's subtraction finding.
9. G1 in the readout: strict G1 is distinct non-demo, non-deleted users with a connection in state `connected`; users whose connections are all frozen or failed print on a separate row labelled partial. Why: an exact definition before week 1 (business lead D3); counting frozen records is MRC2-3, the owner's.
10. G4 in the readout: only the fixed line "strict G4 can't be read in this slice; signed-out D7 return is not measured"; no signed-in count is printed in this slice. Why: no server row holds a signed-in day-7 return without E6 (business lead D2).
11. Rename test reading: counts are keyed by user id, never handle text, so nothing is found under the text of either handle and the new user A has none; the old rows stay with the renamed account (the same person). Why: the literal "under either" would delete a renamed trader's counts; raised for the owner.
12. Record surfaces count only pages that exist: a trade page needs that trader's closed trade, a month page a close in that month; unknown or deleted handles count nothing. Why: a 404 page must not count as a view of a trader.
13. Invite codes are counted on views only, not in sign-up attribution (`users.referred_surface`). Why: sign-up attribution needs a referrer, and outreach links point at Demo profiles, which attribution ignores; widening it is MRC2-3 (ponytail).
14. Bot validation: 200 scripted (50 no-script fetches, 50 script-running visits that declare themselves, 50 with the automation flag hidden but a preview agent, 50 direct posts) and 50 human-like visits, plus forged and burst groups reported apart; the 95% bar must hold on the script-running subset alone. Why: a no-script fetch can't send a beacon, so it alone would pass by construction (business lead D1, engineer E1).
15. The `share_action` half (E5) is not in this PR; G2 prints "after the share_action slice". Why: the feature file's start condition: it edits files F-13 owns.

## Owner items (not decided here)
- Privacy Policy text describing this flow (POLICY P6, H) before any real user.
- MRC2-3 gate definitions; until ruled, the readout prints strict DESIGN §3.5 numbers and labels the rest partial.
- Confirm the 120-day retention bound.
- Real-device check of the bot filter (real preview services, real phones) before week 1, logging drop reasons only.
- Confirm the rename reading (decision 11).
