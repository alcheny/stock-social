# F-15 · Measurement foundation, first slice: view counts and link sources

Status: ready
Start conditions: fix #28 (`via=nav` in `lib/referral.ts`) merges first. The beacon mounts from its own component and
does not edit `app/layout.tsx` until F-13 merges. The `share_action` half starts after F-13 merges (F-4 has merged).

## Why
Nothing that happens in weeks 1-8 can be read today. No view or referrer is counted, shared links carry no source tag,
share events are mis-recorded or overwritten, and `via=nav` is dropped. The week-8 gates (DESIGN §3.5) can't be read
without first-party counts. This feature builds the first slice of the privacy-safe counters that cycle 1 left waiting
(C17), the market council's measurement items (MRC2-1) and the business council's BC-7. Approved by the approval
council (`docs/ideas/approval-2026-11-01-cycle2.md`, K3: second-vote mean 4.13, final vote 15/15).

## Decisions
- 2026-11-01: The first slice is an aggregate daily view rollup fed by a first-party beacon, sent after the page has
  been visible for 2 seconds, with a bot filter. It also adds one closed `via` registry of source classes and appends
  `?via=` to Share and copy-link. Nav, invite and path codes are accepted. Why: approved by the approval council
  (cycle 2); chair's adopted reshape (EN, RE, LG, TS).
- 2026-11-01: Stored rows are aggregates only. No IP, user agent, viewer id, session id, cookie, device-storage id or
  fingerprint is stored. The bot filter reads the user agent in memory and drops it. Any per-viewer or per-session
  event would be F-2's opt-in activity log and stays off by default. Why: approved by the approval council (cycle 2);
  POLICY P3, P6; F-2 2026-11-01; GTM "no cookie" (veto condition: DK, LG, CS).
- 2026-11-01: Per-profile rollup rows are keyed by `user_id references users on delete cascade`, never by handle text.
  Why: approved by the approval council (cycle 2). The red team showed handle-keyed counts outlive a deleted account
  and follow a stranger who later takes the handle; the retention test does not catch them (veto condition: LG).
- 2026-11-01: `via` values come from a closed registry of source classes. Unknown values are dropped. A `via` is a
  source class, never a per-person or per-link id. The referrer is reduced in memory to a class (internal, external,
  none or a `via` code); no full referrer URL and no platform domain list or platform name is stored or written in
  code. The existing per-referrer measure (`db/schema.sql`) is not extended. Why: approved by the approval council
  (cycle 2); POLICY P3, T1, T5 (veto condition: DK, LG).
- 2026-11-01: The counts are never an input to ordering, scores, streaks or badges, and are never shown to traders.
  Why: approved by the approval council (cycle 2); POLICY F6 (growth's condition; veto condition: DK).
- 2026-11-01: First-party only: the beacon posts to the app's own origin. No third-party script, pixel or session
  replay. Why: approved by the approval council (cycle 2); POLICY P6 "no third-party trackers" (veto condition: LG).
- 2026-11-01: `share_action` rows are additive. The four share columns on `users` stay in the schema (no `drop`, no
  data deleted); reads move to the new rows. Rows tied to a user are deleted with the profile and carry no thesis
  text or account id. This half is built after F-13 merges, because it edits `app/u/[handle]/share-prompt.tsx` and
  `lib/display-log.ts`. Why: approved by the approval council (cycle 2); CI schema rule; POLICY H, P6 (veto
  condition: DK, LG, CS).
- 2026-11-01: The weekly readout is descriptive counts only, owner-only, and never committed to the repo with real
  data. It names no handle and no return. It prints the strict DESIGN §3.5 numbers beside every figure and never
  redefines a gate (MRC2-3 stays with the owner). Why: approved by the approval council (cycle 2); POLICY P5, F3b
  (veto condition: DK, LG, CS).
- 2026-11-01: The readout says which parts of G4 (viewer D7 return) it can and cannot read. The strict DESIGN G4
  can't be read under this slice, because it bans every viewer id. Signed-out D7 return is not measured in this slice.
  The market council's proposed primary cohort is signed-in viewers, read from existing server rows; the readout may
  show that count only labelled "signed-in viewers only", never as G4 itself, until the owner rules on MRC2-3. G2 shows
  "after the share_action slice" until that half lands. G3 is labelled a count of views, not of people. Why: approved
  by the approval council (cycle 2); red team case 1; MR's point that G4's primary cohort is signed-in (market cycle 2
  §3); BL, DV.
- 2026-11-01: No readout cell for path × via × day is below 5. Smaller counts roll into "other". Why: approved by the
  approval council (cycle 2). The red team showed a count of 1 on an invite link reveals who opened it (POLICY P3).
- 2026-11-01: Before week 1, the bot filter is checked against 200 scripted preview fetches and 50 human visits. It
  passes when at least 95% of the scripted fetches are dropped and at least 95% of the human visits are counted. The
  result is recorded in the PR before any gate is read. Why: approved by the approval council (cycle 2); MR, BL, DV,
  PF, RT, GR.
- 2026-11-01: The beacon is fire-and-forget and never blocks the page. Writes are one idempotent upsert per beacon per
  key. No new paid service. The rollup has a stated retention bound and old rows are purged by an existing cron path.
  Why: approved by the approval council (cycle 2); RE, EN, PF.
- 2026-11-01: Share stays one tap. `?via=` is appended silently, and the "Link copied" confirmation stays in a polite
  live region. Why: approved by the approval council (cycle 2); A11Y, PD, UX.
- 2026-11-01: Device-storage first-visit date (E4, legal committee), the painted door (E8, owner, MRC2-7),
  test-and-roll (owner) and gate redefinitions (MRC2-3, owner) are excluded. Why: approved by the approval council
  (cycle 2) (veto condition: DK, LG).
- 2026-11-01: Real users stay behind the owner's Privacy Policy text describing this flow. Why: approved by the
  approval council (cycle 2); POLICY H, P6 (veto condition: DK, LG, CS).
- 2026-11-01: Sequencing: fix #28 merges first (same list at `lib/referral.ts`). The beacon mounts from its own
  component, not `app/layout.tsx`, until F-13 merges. If this build has not started by the next approval council,
  this approval lapses to that council. Why: approved by the approval council (cycle 2); RT, BL, PD, TS.
- 2026-11-01: unblocked by the orchestrator — fix #28 merged in #59 (3f216ba).

## Acceptance criteria
- [ ] A db test inserts rollup rows for a profile, calls `deleteProfile` and finds no row naming that user or handle.
      A second test renames A to B, creates a new user A and finds none of the old counts under either (veto
      condition: LG).
- [ ] A test fails if any rollup, beacon or `share_action` table stores an IP, user agent, viewer id, session id,
      cookie value or fingerprint (veto condition: DK, LG, CS).
- [ ] A test fails on any stored `via` value outside the closed registry, and unknown values are dropped (unit test)
      (veto condition: LG).
- [ ] No full referrer URL is stored; the referrer is stored only as a class (unit test) (veto condition: DK).
- [ ] New tables have `SCHEMA_MAP` entries (`lib/privacy-retention.ts`). The cookie test (`COOKIE_TABLE`) and the log
      scanner pass with no new exception. The PR answers COMPLIANCE §1 Q2 (fields, location, visibility, deletion)
      (veto condition: DK).
- [ ] `db/schema.sql` changes are additive only; the four `users` share columns remain (CI schema rule) (veto
      condition: DK, LG, CS).
- [ ] A test asserts no `app/` page and no `lib/feed.ts` code reads the rollup (veto condition: DK).
- [ ] A unit test asserts no printed readout cell for path × via × day is below 5, and small cells roll into "other".
- [ ] The readout prints the four DESIGN §3.5 thresholds verbatim beside its figures. It states that strict G4 can't
      be read in this slice and that signed-out D7 return is not measured. Any signed-in day-7 count is labelled
      "signed-in viewers only". G2 reads "after the share_action slice" until it lands. G3 is labelled "views, not
      people" (unit test on the readout text) (veto condition: DK, LG, CS).
- [ ] The readout script writes outside the repo and its output contains no handle or return (test).
- [ ] The bot-filter validation (200 scripted, 50 human) is run before week 1 and its result (≥ 95% dropped, ≥ 95%
      counted) and false-count rate are in the PR.
- [ ] A test fires 50 concurrent beacons for one key and gets one row with count 50.
- [ ] With the beacon route returning 500, or the DB write failing, the page still returns 200 and stays usable, with
      no error shown to the viewer (e2e).
- [ ] The beacon adds no focusable element, no visible UI and no layout shift, and never delays first paint (e2e).
- [ ] Rollup rows older than the stated retention bound are purged by an existing cron path (test).
- [ ] Share and copy-link append the right `?via=` class and stay one tap. "Link copied" is announced in a polite live
      region after the change (e2e).
- [ ] Nav, invite and path codes are accepted by the registry (unit test).
- [ ] `share_action` rows: one row per share action, deleted with the profile, no thesis text or account id (db test).
- [ ] The beacon component does not touch `app/layout.tsx` before F-13 merges (checked at review).
- [ ] Any limit the build leaves is marked in code with a `ponytail:` comment naming the limit and its next step, and
      the PR's hand-off note lists it.

## Out of scope
- Device-storage first-visit date (E4) and any signed-out D7 return measure: legal committee.
- Painted door (E8), test-and-roll and price arms: owner (MRC2-7).
- Gate redefinitions (MRC2-3), including making signed-in day-7 return the G4 number: owner.
- Any view count shown to traders or used in ranking.
- The Privacy Policy text: owner.

## Open questions
- Owner: rule on MRC2-3 (gate definitions). Until then the readout reports strict DESIGN numbers and labels anything
  else as partial.
- Retention bound for rollup rows: the build proposes a number in the PR; the owner may change it.

## Rework notes
