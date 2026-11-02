# Committee check: new work from the owner's decisions of 2026-11-02

Scope: the new features F-37 to F-48 and the fixes list F6-1 to F6-17 in
`docs/direction/owner-decisions-2026-11-02-worklist.md`. The owner decided *what* (brief items accepted en bloc on
2026-11-02; `docs/DECISIONS.md`); the committee checked *how*: usability, priority and scope, feasibility against the
code, and POLICY. Members, each a separate agent with fresh context, in parallel, read-only: UX lead, business lead,
engineer, legal committee (POLICY veto holder). One round on the first draft (nine features, F6-1..F6-16); the session
applied every requested change, splitting and renumbering where asked. Base: `origin/main` ca34767. Not legal advice;
every probe and fixture named is fictional.

## Result

- **No veto.** The legal committee stated "no veto" on every item, with conditions, all applied.
- **Approved:** all nine first-draft features, with changes to each except F-43 (90-day deletion) in the business
  lead's view and F-40/F-41/F-43 in the UX lead's. Two objections, both resolved by changes (below).
- **Splits:** the disconnect's vendor delete became its own `draft` feature (F-48; UX, business lead); the connect
  feature split into the Beta-blocking question and claims line (F-44) and the preview (F-45; business lead); the demo
  item split into the seed (F-38) and the stock pages (F-39; business lead, engineer); the viewer-only `noindex` change
  left F6-6 as F6-17 (business lead).
- **Renumbering:** new features are numbered in the business lead's build order (the number sets the build order,
  docs/FEATURES.md). First-draft numbers are not used anywhere else.

| First draft | Final |
|---|---|
| Lured-link handling | F-37 |
| Demo seed and stock pages | F-38 (seed), F-39 (stock pages) |
| In-app disconnect | F-40 (Part A), F-48 (Part B, draft) |
| Last known positions | F-41 |
| Non-personalized order | F-42 |
| Full data export | F-43 |
| Connect preview and licensed-user question | F-44 (question, claims line), F-45 (preview) |
| Open positions in the range | F-46 |
| Preference data 90-day deletion | F-47 |

## Objections and how they were resolved

1. **Engineer: object to the lured-link feature as written.** Brokerage-first sign-ups create a user with no other
   identity (`app/connect/actions.ts:37-40`, `lib/auth/attempts.ts:65-95`), so removing the sign-in would lock them out,
   and the owner's line "Sign in with the method you used before" would point nowhere. The decline and cleanup already
   exist (`lib/connections.ts:377-381`). The other-session case already refuses without revealing the owner. Resolved in
   F-37: brokerage-first sign-up adds an email or provider identity before it finishes; `completeAttempt` is dropped on
   this path; the other-session case stays as today; the cited lines and the vendor-delete AC were corrected.
2. **Engineer: object to F6-2 until revised.** Versions are a per-connection hash with no re-consent prompt; fields
   already public cannot be gated; moving the scope line next to `node:crypto` would pull it into client bundles.
   Resolved: F6-2 builds the prompt, gates only fields first shown after version 2, and keeps the strings in a
   crypto-free module.
3. **Engineer: object to F6-12.** #100's `trust_audit` cannot take read rows without a `drop`. Resolved: a new additive
   table with no user id.

## Changes applied, by member

**UX lead.** F-40: "record frozen" only when every connection is disconnected; button "Disconnect ‹broker name›"; Cancel
restores focus. F-44: a plain hint under the question, no preselected answer, a pinned announced error. F-41: the label
is text, pinned. F-43: the refusal copy pinned with `Retry-After`; button and live status. F-42: no control that does
nothing. F-46: the caption pinned and omitted at n = 0. F6-6: the arrow hidden from screen readers. F6-10: the new
screens and reduced motion added. F6-11: the whole joined status line pinned. F6-13: one label naming both statements.
Cross-cutting: every new string pinned; one shared date-format test; signed-out render tests. **Not applied:** new words
for the lured-link line. The line is the owner's (OD 2.16); it is kept and the proposal is an open question in F-37.

**Business lead.** Build order (F-37 first, the live security gap; then the seed, the disconnect and last known
positions together, the shared order, the export, the question, the preview, the range, the purge). Splits as above.
F-40: no protected-file note (the vendor delete exists, `lib/broker.ts:141`). F-41: after F-40 too, so a disconnect
never hides open losers for long. F-38: a fixed handle allowlist and the reserved symbol pattern, no list of real
symbols. F-42: no follows-only view (scope creep; the shared order meets the decision); `ageAssured` a code constant.
F-46: days held measured to the stored read time. F6-3 and F-44: one helper for a missing contact address.

**Engineer.** File and line corrections throughout. F-40: per connection, not per account; open positions move to
`unlisted_positions` on disconnect; the reconnect check at `lib/connections.ts:349`. F-41: fully frozen records'
positions too; only `disconnected_at` rows; options excluded; rebase on #100. F-39: every per-security figure on the
stock pages listed. F-43: the handle AC narrowed; rebase on #100. F-47: each table and its clock named. F-42: owns the
`lib/copy.ts:746` rewrite; follows and likes stop reordering. F-46: `rebuildTrades` sets `opened_at` from `openLots`;
no unmatched lot means excluded and counted; `now` pinned. F6-1: drop only the ponytail at `lib/copy.ts:83`. F6-5: the
missed strings listed and the `/t` ones routed to F-39. F6-7: rebase on #100. Protected files: nothing unflagged.

**Legal committee.** Conditions applied: F-40 never says "permanently" or "ever" and deletes no rows; F-48 switched on
only by the owner with a dated DECISIONS line citing the vendor's reply; F-44 answer listed in retention, exported,
deleted, never used for ranking or labels, never logged with an account id; F-45 disclaimer and Demo badge on every
element, F-38's fictional data; F-37 cleanup touches only what the link created, with a test that the owning record is
unchanged; F-41 only under a consent version that covers open positions after disconnect; F-38 symbol pattern
structurally unlisted; F-39 securities never ordered by count or return; F-43 the full list of tables and download-only
delivery; F-47 "deleted after 90 days" and the backup window in the Privacy Policy; F-42 `ageAssured` settable only by
an owner-chosen method, explicit hides only, accurate copy, deployed (not just merged) before 2027-01-01; F6-2 no
pre-checked box, decline as easy as accept, the version gate in the one public producer, version and time stored; F6-3 a
deletion test pinning the claims cascade; F6-5 past tense only; F6-6 the lead always next to the /how link and the
excluded count; F6-13 follows 2.6 (EU/UK) rather than a wider US-only scope, on every first sign-in path. Missing owner
actions were added to the worklist checklist: the F6-13 wording, the K18 method and deploy date, F-48's switch, the
F-44 review duty, the under-18 runner, last-known values in the vendor letter, and the Privacy Policy's coverage of
F-43, F-44 and F-47.

## Kept on record

- The UX lead's alternative lured-link wording (F-37, Open questions).
- UX wanted a follows-only toggle in F-42; the business lead and engineer called it new scope. The shared order alone
  meets the owner's "non-personalized or follows-only", so no toggle is built.
