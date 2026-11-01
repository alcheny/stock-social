# F-15 · Measurement foundation, first slice: view counts and link sources

Status: built
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
- 2026-11-01: Mount point: the beacon mounts from a new `app/template.tsx` that renders a fragment
  (`{children}<ViewBeacon />`), so no DOM node is added and `app/layout.tsx` is untouched until F-13 merges; the beacon
  re-arms on each pathname. Why: decided by the committee under the owner's instruction of 2026-11-01; the only option
  that touches no F-13 file; per-page lines would edit F-13's files and be forgotten on new pages.
- 2026-11-01: Retention bound: rollup and drop rows are purged after 120 days by a `views` step in the existing privacy
  purge on the sync tick; the owner may change the number. Why: decided by the committee under the owner's instruction
  of 2026-11-01; covers the 8-week gate window plus re-reads, and matches E6's 120 days so the Privacy Policy can state
  one number.
- 2026-11-01: Invite codes: the registry holds two invite codes, `inv_t` (transparency-led recruiting segment) and
  `inv_h`; numbered codes are rejected. Why: decided by the committee under the owner's instruction of 2026-11-01;
  numbered codes invite one code per person, which breaks "a class, never a per-person id".
- 2026-11-01: Share classes: `card` (profile), `story` (profile shared with its story picture, only when the share sheet
  takes the picture), `trade`, `month`; the class is chosen at click time from the path the share took. Why: decided by
  the committee under the owner's instruction of 2026-11-01; the format split the market council asked for, without mis-
  tagging a copied link as a picture share.
- 2026-11-01: Rate cap: in memory, per server instance, 60 beacons per client per minute; the key is a salted hash (salt
  replaced hourly) of the trusted client address and user agent, never stored or logged; with no trusted address the cap
  is skipped. Why: decided by the committee under the owner's instruction of 2026-11-01; a reader swiping the pane can
  send one every 2 s; keying on the agent alone would undercount readers who share a common browser (business lead R1).
- 2026-11-01: Drop rollup: `view_drops` (day, surface or `other`, reason, count; no user id) is stored with the same
  retention. Why: decided by the committee under the owner's instruction of 2026-11-01; the only drift signal in weeks
  1-8 and the source of the false-count rate.
- 2026-11-01: No CHECK on `surface`, `via` or `reason`: they are validated in code against the closed lists and a db
  test fails on any stored value outside them; `ref_class` keeps its CHECK. Why: decided by the committee under the
  owner's instruction of 2026-11-01; adding a code later would need a `drop constraint`, which the CI schema rule
  forbids.
- 2026-11-01: Readout: weekly, owner-run (`scripts/f15-readout.ts --out <dir>`, refused inside the repo by a realpath
  check), Markdown; every cell from 1 to 4 prints "<5", a complementary cell is hidden so no small count can be worked
  out by subtraction, totals with hidden cells print "≥ n". Why: decided by the committee under the owner's instruction
  of 2026-11-01; POLICY P3 (the red team's invite-link case) and the engineer's subtraction finding.
- 2026-11-01: G1 in the readout: strict G1 is distinct non-demo, non-deleted users with a connection in state
  `connected`; users whose connections are all frozen or failed print on a separate row labelled partial. Why: decided
  by the committee under the owner's instruction of 2026-11-01; an exact definition before week 1 (business lead D3);
  counting frozen records is MRC2-3, the owner's.
- 2026-11-01: G4 in the readout: only the fixed line "strict G4 can't be read in this slice; signed-out D7 return is not
  measured"; no signed-in count is printed in this slice. Why: decided by the committee under the owner's instruction of
  2026-11-01; no server row holds a signed-in day-7 return without E6 (business lead D2).
- 2026-11-01: Rename test reading: counts are keyed by user id, never handle text, so nothing is found under the text of
  either handle and the new user A has none; the old rows stay with the renamed account (the same person). Why: decided
  by the committee under the owner's instruction of 2026-11-01; the literal "under either" would delete a renamed
  trader's counts; raised for the owner.
- 2026-11-01: Record surfaces count only pages that exist: a trade page needs that trader's closed trade, a month page a
  close in that month; unknown or deleted handles count nothing. Why: decided by the committee under the owner's
  instruction of 2026-11-01; a 404 page must not count as a view of a trader.
- 2026-11-01: Invite codes are counted on views only, not in sign-up attribution (`users.referred_surface`). Why:
  decided by the committee under the owner's instruction of 2026-11-01; sign-up attribution needs a referrer, and
  outreach links point at Demo profiles, which attribution ignores; widening it is MRC2-3 (ponytail).
- 2026-11-01: Bot validation: 200 scripted (50 no-script fetches, 50 script-running visits that declare themselves, 50
  with the automation flag hidden but a preview agent, 50 direct posts) and 50 human-like visits, plus forged and burst
  groups reported apart; the 95% bar must hold on the script-running subset alone. Why: decided by the committee under
  the owner's instruction of 2026-11-01; a no-script fetch can't send a beacon, so it alone would pass by construction
  (business lead D1, engineer E1).
- 2026-11-01: The `share_action` half (E5) is not in this PR; G2 prints "after the share_action slice". Why: decided by
  the committee under the owner's instruction of 2026-11-01; the feature file's start condition: it edits files F-13
  owns.
- 2026-11-01: A browser that reports automation sends no beacon at all; the route still drops a beacon flagged as
  automated. Why: decided by the committee under the owner's instruction of 2026-11-01; every automated test run and
  scripted browser would otherwise add a request to every page (the full e2e suite's request-counting tests caught it),
  and such a browser is never a person's view.
- 2026-11-01: Second half: share_action rows: one row per completed share of a trader's own record, holding the trader
  id, the UTC day (no time of day, no id column), the share class (card, story, trade, month), the outcome (sheet or
  copy) and the record's headline sign at that moment (up, down, flat, none); at most 20 a trader a UTC day, counted
  under an advisory lock. Why: decided by the committee under the owner's instruction of 2026-11-01; a day-only row
  holds what a daily total holds (the aggregate bar) while meeting "one row per share action"; G2 needs only "at least
  once", so the cap never moves a gate figure.
- 2026-11-01: Second half: No format column: the picture format is the story class (story = profile picture; card =
  profile link; trade and month are links). Why: decided by the committee under the owner's instruction of 2026-11-01; a
  field that is a function of another adds data without information (POLICY P3, minimum).
- 2026-11-01: Second half: Owner only: the server action writes a row only when the shared path is one of the three
  record routes and its handle is the signed-in, non-deleted, non-demo user's own; a viewer's share of someone else's
  record is never stored and the client sends nothing for it. Why: decided by the committee under the owner's
  instruction of 2026-11-01; a viewer's share would tie a viewer to a trader (POLICY P3) and is F-2's opt-in log
  territory; G2 counts traders only.
- 2026-11-01: Second half: Record sign: computed on the server from the same rows the profile's headline reads (every
  closed trade, one decimal), none while the profile shows no headline (no close, import running or failed). Why:
  decided by the committee under the owner's instruction of 2026-11-01; E5's "record sign at that moment", never sent by
  the client; a db test pins it to the profile's own stats and tone.
- 2026-11-01: Second half: Old columns: the four users share columns stay and are written exactly as before (a month
  share never sets trade_shared_at); the readout reads the new rows and not the old columns, and prints that shares
  before the rows began are not counted. Why: decided by the committee under the owner's instruction of 2026-11-01; the
  owner's additive rule; the old columns can't say "at least once" reliably (trade_shared_at is overwritten).
- 2026-11-01: Second half: Retention: share_action rows are purged after 120 days by a `shares` step in the existing
  privacy purge and deleted with the account (explicit delete in the mark transaction, then the cascade). Why: decided
  by the committee under the owner's instruction of 2026-11-01; one number with the view rollup for the Privacy Policy;
  covers the 8-week window plus re-reads.
- 2026-11-01: Second half: G2 readout: the strict row is strict-G1 traders with at least one card or story share, beside
  "≥ 60%"; partial rows (any surface, sheet, copy, picture, shared while down) count traders; all are built from
  disjoint per-trader cells with the readout's suppression so no count under 5 is derivable across rows or against G1;
  the 14-day cohort rate is not printed (MRC2-3); no date of the first share is printed. Why: decided by the committee
  under the owner's instruction of 2026-11-01; the strict DESIGN number first (MRC2-3 stays the owner's); POLICY P3
  small-count rule; a printed first-share date would say a trader shared that day.
- 2026-11-01: Second half: lib/display-log.ts is not changed. Why: decided by the committee under the owner's
  instruction of 2026-11-01; the approval record names it only as a file the share half would have collided with while
  F-4 and F-13 were open (sequencing); the sign is read live, "at that moment"; raised for the owner.
- 2026-11-01: Second half: The beacon moves into app/layout.tsx (last in the body after the page content) and
  app/template.tsx is deleted. Why: decided by the committee under the owner's instruction of 2026-11-01; F-13 has
  merged; a persistent layout keeps one beacon per pathname and removes the root template's remounts.
- 2026-11-01: Second half: Canonical links: the layout sets metadataBase from the configured public origin (lib/site.ts,
  which billing re-exports unchanged) and the profile, trade and month pages declare their untagged address; the trade
  page's canonical and Share link come from one helper over the matched sell id; og:url is not set. Why: decided by the
  committee under the owner's instruction of 2026-11-01; a shared ?via= copy is never indexed as its own page; og:url
  would make some previews drop the source class.

## Acceptance criteria
- [x] A db test inserts rollup rows for a profile, calls `deleteProfile` and finds no row naming that user or handle.
      A second test renames A to B, creates a new user A and finds none of the old counts under either (veto
      condition: LG).
- [x] A test fails if any rollup, beacon or `share_action` table stores an IP, user agent, viewer id, session id,
      cookie value or fingerprint (veto condition: DK, LG, CS).
- [x] A test fails on any stored `via` value outside the closed registry, and unknown values are dropped (unit test)
      (veto condition: LG).
- [x] No full referrer URL is stored; the referrer is stored only as a class (unit test) (veto condition: DK).
- [x] New tables have `SCHEMA_MAP` entries (`lib/privacy-retention.ts`). The cookie test (`COOKIE_TABLE`) and the log
      scanner pass with no new exception. The PR answers COMPLIANCE §1 Q2 (fields, location, visibility, deletion)
      (veto condition: DK).
- [x] `db/schema.sql` changes are additive only; the four `users` share columns remain (CI schema rule) (veto
      condition: DK, LG, CS).
- [x] A test asserts no `app/` page and no `lib/feed.ts` code reads the rollup (veto condition: DK).
- [x] A unit test asserts no printed readout cell for path × via × day is below 5, and small cells roll into "other".
- [x] The readout prints the four DESIGN §3.5 thresholds verbatim beside its figures. It states that strict G4 can't
      be read in this slice and that signed-out D7 return is not measured. Any signed-in day-7 count is labelled
      "signed-in viewers only". G2 reads "after the share_action slice" until it lands. G3 is labelled "views, not
      people" (unit test on the readout text) (veto condition: DK, LG, CS).
- [x] The readout script writes outside the repo and its output contains no handle or return (test).
- [x] The bot-filter validation (200 scripted, 50 human) is run before week 1 and its result (≥ 95% dropped, ≥ 95%
      counted) and false-count rate are in the PR.
- [x] A test fires 50 concurrent beacons for one key and gets one row with count 50.
- [x] With the beacon route returning 500, or the DB write failing, the page still returns 200 and stays usable, with
      no error shown to the viewer (e2e).
- [x] The beacon adds no focusable element, no visible UI and no layout shift, and never delays first paint (e2e).
- [x] Rollup rows older than the stated retention bound are purged by an existing cron path (test).
- [x] Share and copy-link append the right `?via=` class and stay one tap. "Link copied" is announced in a polite live
      region after the change (e2e).
- [x] Nav, invite and path codes are accepted by the registry (unit test).
- [x] `share_action` rows: one row per share action, deleted with the profile, no thesis text or account id (db test).
- [x] The beacon component does not touch `app/layout.tsx` before F-13 merges (checked at review).
- [x] Any limit the build leaves is marked in code with a `ponytail:` comment naming the limit and its next step, and
      the PR's hand-off note lists it.

## Out of scope
- Device-storage first-visit date (E4) and any signed-out D7 return measure: legal committee.
- Painted door (E8), test-and-roll and price arms: owner (MRC2-7).
- Gate redefinitions (MRC2-3), including making signed-in day-7 return the G4 number: owner.
- Any view count shown to traders or used in ranking.
- The Privacy Policy text: owner.

## Open questions
- Owner: confirm that `lib/display-log.ts` needs no change for the share_action half (second-half decision).
- Owner: confirm the 120-day bound and the cap of 20 shares a trader a day for share_action rows.
- Owner: confirm the committee's reading of the rename criterion (counts stay with the renamed account's id; none
  under the new holder of the handle, none under handle text).
- Owner: rule on MRC2-3 (gate definitions). Until then the readout reports strict DESIGN numbers and labels anything
  else as partial.
- Retention bound for rollup rows: the build proposes a number in the PR; the owner may change it.

## Rework notes
