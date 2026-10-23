# F-2 · Plan round 2 · Business lead

Date: 2026-10-23. Responds to `plan-round2-engineer.md` (base `cbab4e6`, F-2 file after the recorder's
restore). Read again: the F-2 file (Decisions, O1, O2), `app/page.tsx`, `lib/feed.ts`,
`app/api/sync/route.ts`, IMPLEMENTATION items #7, #10, #13, DESIGN SW-1 "Reserved gesture". Owner
decisions outrank my rulings: the reject swipe (section rows only, while O1 is open) and PR-3b (waits on
O2) are accepted as the engineer wrote them and are not reopened here. Nothing here is legal advice.

## 0. Verdict

**REVISE, narrowly.** The plan is close to signable: the order is right, PR-1 is the right first PR, and
six of my eight round-1 demands are met (some better than I asked). Three defects keep me from signing
"the text as it stands": a PR-1 test that PR-2 would have to weaken, an unspecified paging behavior on
the most common path of "not interested", and an event log in PR-2 that has no reader until PR-5 (my
own round-1 table put it there; that was my mistake, by my own minimization argument). Everything not
listed in §7 is accepted as written and carries into the signed plan unchanged.

Demo sentence (unchanged): "Follow the records you read, and the feed shows you more traders who trade
like them, losses included, each with the reason it is there."

## 1. My round-1 demands, checked

| # | Demand | Verdict |
|---|---|---|
| 1 | Diversity and exploration out of the blocked PR | **Met.** PR-1 holds `diversify`, `explore`, `pager`. The import-graph test is mis-scoped (demand A below). |
| 2 | Reorder; implicit logger behind H2 and H4 | **Met, and better than asked.** The foreign key to `discovery_event_types` makes an implicit insert fail in the database, not only in review. Moving the `swipe_open` e2e to PR-5 is right: my two demands conflicted and the engineer resolved it the correct way. Demand C makes it stronger still. |
| 3 | Deletions | **Met** except the profile row (owner, O2). Trader features returning in PR-5 is what I allowed. |
| 4 | −4 on "Not interested", section swipe opens the pane | **Met** for both parts I may still demand. One negative action: the reject swipe calls the same `notInterested`. |
| 5 | Section rows: no numbers, 3 rows, "…" on rows only, true heading | **Met.** Screenshots moving to PR-3's build log is fair; the wireframe answers the layout question for now. "More like what you read" only with at least one signal: exactly right. |
| 6 | Reasons without tickers or "You follow @x" | **Met.** Catching that "Usually holds" fails the scan was craft. |
| 7 | Auto-append; diversity window across the page join | **Met, better than asked**: slices of one frozen list make the join a window of the same list, by construction. It breaks the moment a viewer hides a trader mid-session (demand B). |
| 8 | H5; P3, P9 withdrawn; P4, P8 folded | **Met.** H5 resolved by the record; O1 and O2 filed. |
| §10.8 to §10.10 | Purge in the tick, heavy tests, counsel packet, policy checks kept | **Met**, with the purge simplified (demand D) and two counsel questions added (demand E). |

## 2. Is PR-1 right as the first PR? Yes

- **Reach:** it is the only F-2 PR that every visitor sees, signed out, on a shared link, in the first
  3 seconds. It needs no counsel and no owner answer.
- **It fixes a known defect:** F-1's tester and review measured the feed over 500 KB raw with about 6
  distinct heavy traders and the bound holding only to about 25 to 30 (`test-pr3-tester.md`,
  `review-pr3.md`). Testing at 50 distinct heavy traders is stricter than my 30. Good.
- **Budgets are right:** ≤ 500 KB per page, signed-out p95 < 400 ms at 500 traders, measured in PR-1
  itself. The real risk is server time, not bytes: `app/page.tsx:28-44` loads every candidate trader's
  full record and computes `confidence()` per trader on every request, and every appended page now
  repeats it for up to `FEED_CANDIDATES` = 200 (`lib/feed.ts:19`). The `feed_key` fallback is the right
  escape hatch; keep it conditional on the measurement.
- **The 200-candidate cap means the feed ends** at about 6 pages even when more records exist. That is
  acceptable and honest only if the end card claims nothing (demand E1).

## 3. "No implicit events before PR-5", enforced by the database

The mechanism is good (refusal by foreign key, plus a route-interception e2e). But the cleaner rule is
**no event rows of any kind before PR-5**, because nothing reads `discovery_events` before PR-5:

- Every explicit signal PR-2 and PR-4 log already lives in a state table the viewer chose: `follows`
  (`created_at`), `viewer_exclusions` (reason, `until`), `trade_likes` (`created_at`), the watchlist.
  PR-5 can read the −4, the follow and the like from those rows with the owner's weights.
- `share` and `watch` events would be behavioral records collected for a ranker that counsel may never
  allow (POLICY P3, COMPLIANCE §3). If counsel says no, PR-2 would have built a log, two lookup tables,
  an allow-list module and a purge for nothing.
- There are no real viewers, so no history is lost by waiting: the same argument that deleted the
  serves tables.

So the events table, its lookup tables, `events.ts`, `weights.ts`, the share and watch emitters and the
large purge move to PR-5 (demand C). The lookup-table design is kept there exactly. The invariant becomes
trivially true and needs no enforcement test before PR-5.

## 4. The purge in the sync tick

Right place: item #7 already says "the 90-day purge run[s] in that tick" (IMPLEMENTATION line 143), so P3
stays withdrawn. Wrong shape: the lock winner purging for up to 240 s and **skipping trader claiming**
adds a second code path to the route most likely to break, and runs before `tick()` and the deletion
retries (`app/api/sync/route.ts:26-31`), starving them on that caller. Delete the branch: purge under the
advisory lock with a **fixed time box of ≤ 30 s per call**, then continue exactly as today. With a call
every minute, a 4 M backlog drains in a few ticks at the engineer's own throughput estimate, reads already
filter `at > now() − 90 days`, and the F-1 fleet test stays untouched. Note for the owner: criterion 5 says
"nightly job"; a per-minute tick deletes sooner than nightly, so it satisfies the intent. The tester should
read it that way, and the plan should say so in one line.

## 5. 90 days or "never again": I back 90 days as the default

The owner decides (it travels with O1). My recommendation, with the reasons and their evidence tier:
- **It is the testable line the owner wrote** (criterion 4, "for 90 days"); the gesture decision's "not
  shown again" is satisfied for those 90 days. (Record, not inference.)
- **A swipe is easy to trigger by accident.** A 90-day exclusion bounds the cost of an accident that
  Undo missed; "never" makes it permanent and invisible. (Intuition.)
- **Supply first** (DECISIONS standing direction 1): a permanent mute removes a trader's reach to that
  viewer for good, though records change. (Intuition; the cost lands on the 50-trader gate.)
- **Honest copy:** the Undo line says the duration, "Hidden for 90 days. Undo", never "never" or "won't
  see again". `/me/following` keeps "Show again".
What would change my mind: the owner meant "never". Then it is one constant, and the Undo copy changes
with it.

## 6. Counsel packet

The five questions are right and the removal of the ticker question is correct. Two are missing, both
about PRs that the plan builds **before** H2 on the argument that they are "the same order for everyone":
- **Q6.** "Not interested" removes a trader from that viewer's feed (`Exclusions are honored on the
  signed-in feed`). That is a viewer-chosen mute, not a ranking, but it makes the feed per-viewer before
  H2. Ask whether a mute the viewer sets keeps the exclusion.
- **Q7.** Is a section of traders that is the same for every viewer, ordered by the published lower-bound
  method, with factual reason lines and no performance figures, the same class as today's feed? The
  build of PR-3 does not wait on the answer (my round-1 position stands), but the answer is needed
  before real viewers see it.

## 7. Demands on the engineer for round 3 (prioritized; each small)

A. **Re-scope the import-graph test so no later PR has to weaken it.** As written it greps
   `app/page.tsx` for `follows`, `events` and friends; PR-2 then honors exclusions on the signed-in feed in
   that page, so PR-2 must either weaken a PR-1 test (forbidden; CI counts tests) or route around the grep.
   Scope it to the pure modules (`diversity.ts`, `explore.ts`, `pager.ts` import nothing from
   `lib/db.ts` or any per-viewer module) and add the behavioral guard: a signed-out feed render issues no
   query against `follows`, `viewer_exclusions`, `trade_likes` or `discovery_events` (query log in the DB
   test). Verify: PR-2's diff changes no PR-1 assertion.

B. **State what happens when a viewer hides a trader between pages.** "Not interested" lives in the
   section at position 6 of page 1, so it happens mid-session almost every time. Recomputing the list
   with the new exclusion shifts every later position: cards repeat or vanish at the join, and the
   by-construction window breaks. Required behavior: no card repeats, no card vanishes except the hidden
   trader's, the hidden trader never appears again in the session (including already-rendered cards
   below), and the caps either hold or the plan states the exact bound in a session where the viewer
   hid someone. Likely simplest: `viewer_exclusions.created_at`, the cursor list applies exclusions
   created ≤ `asOf`, newer ones act as a display filter. Verify: a property test on 1,000 feeds with a
   hide between pages 1 and 2.

C. **Move the event log out of PR-2 (§3).** PR-2 = `follows`, `viewer_exclusions` (+ `created_at`),
   the four actions, Follow on the profile header and pane, the first-follow status line,
   `/me/following`, the deletion first step, and a bounded `delete from viewer_exclusions where until <
   now()` in the tick. `discovery_events`, the lookup tables, `events.ts`, `weights.ts`, the share and
   watch emitters and the large purge go to PR-5; criterion 3 is tested there. Verify: PR-2 to PR-4 create
   no event table; the data inventory (§4 of the plan) shows no behavioral rows before PR-5.

D. **Purge shape (§4):** ≤ 30 s per call under the advisory lock, no skip-claiming branch, placed after
   `purgeExpiredLinks()` as planned. PR-6's test becomes: a 4 M backlog drains within 10 consecutive
   ticks, zero live rows touched, the F-1 fleet test unchanged. One line on criterion 5's "nightly".

E. **Text fixes, one line each:**
   1. End-card placeholder "You're up to date." is a completeness claim (the list is capped at 200
      candidates). Use "End of today's feed." (true: the order is seeded per UTC day) until the UX lead
      writes it; it keeps "Publish your trades".
   2. PR-3 says "after the shared-link landing card"; the feed has none (`app/page.tsx:56-65` renders
      ranked cards only). Say "position 6, so the first five cards are records".
   3. Undo copy states the duration (§5).
   4. PR-4 `trade_key`: `sell_id::bytea` parses backslashes as escape sequences and errors on some
      inputs; use an escape-free immutable conversion and test a `sell_id` containing a backslash.
   5. Counsel packet gains Q6 and Q7 (§6).

Everything else in round 2, including PR-1's scope and budgets, PR-3b as written, the reject swipe in its
non-colliding form, the hard stops H1 to H4 with H5 resolved, O1 and O2, and P1 to P9, carries into the
signed plan unchanged. If A to E come back as written, I sign without another debate round.

For the reviewer: fail PR-2 if it edits a PR-1 test assertion, and fail any PR before PR-5 that creates
an event table.

## 8. Scorecard (the plan with A to E applied)

| Dimension | Score | Evidence |
|---|---|---|
| Market demand | 4 | Unchanged from round 1: follow and per-viewer feeds are standard in the social-investing category (competitor product behavior, no usage numbers found). |
| Ease of adoption | 4 | Nothing added to the signed-out path; auto-append, no tap; the section is one card with 3 rows. |
| Phase fit | 4 | PR-1 fixes the feed every shared link lands on; PR-3b's supply risk is the owner's call (O2). |
| Revenue impact | 3 | Indirect only; accepted for an owner-decided feature. |
| Aesthetics and clarity | 3 | Unproven until PR-3's 375 px screenshots; the UX lead owns the heading and end card. |
| Trust and compliance | 5 with A to E | Losses symmetric, no numbers without the disclaimer, no behavioral rows before counsel, honest end card. Round-2 text scores 4: event rows before a permitted use and a completeness claim on the end card. |
| Simplicity | 4 with C and D | Round 2 already deleted five tables; C removes a log, two lookup tables and the large purge from the pre-counsel half, D removes a branch from the sync route. |
| Craft and taste | none yet | Nothing built. |

## 9. What would change my mind

- The engineer shows a consumer of explicit events before PR-5 that the owner asked for (a measure in
  the F-2 file, not one we invent): the log stays in PR-2, explicit types only, as written.
- B turns out larger than ~60 lines: then exclusions take effect from the next page 1 only, the hidden
  trader's cards collapse client-side, and the plan says so.

REVISE
A. Scope the PR-1 import-graph test to the pure modules plus a signed-out no-per-viewer-query test, so
   PR-2 never weakens it.
B. Specify and test a hide between pages: no repeats, no vanished cards but the hidden trader's, caps or
   a stated bound.
C. No event table before PR-5: PR-2 keeps follows and exclusions; the log, lookup tables, emitters and
   large purge move to PR-5.
D. Purge: ≤ 30 s per call under the lock, no skip-claiming branch; 4 M backlog drains within 10 ticks.
E. End card "End of today's feed."; no phantom landing card; Undo states 90 days; safe `trade_key`
   conversion; counsel Q6 (viewer mute) and Q7 (impersonal section).

REVISE
