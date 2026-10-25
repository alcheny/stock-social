# F-2 · Guardrails G1 to G6 · Plan sign-off (business lead)

Date: 2026-10-25. Role: business lead. Reviewed: `plan-guardrails.md` (engineer, signed, commit `717ec34`) against the
F-2 Decisions and criteria G1 to G6 (2026-10-25), my spec in `hardstops-resolution-business-lead.md` §2 "Extra
guardrails" and §3, POLICY F1 (as amended in `bcaac14`), P3, P6 and A1, COMPLIANCE §1, and IMPLEMENTATION (plan rules,
"Parallel development"). I checked the plan's claims against the tree: `lib/feed.ts:312-334`, `lib/follows.ts:58-77`,
`lib/delete.ts:21-29`, `lib/auth/sessions.ts:46`, `app/t/[symbol]/Watch.tsx:22`, `app/t/page.tsx:24`, `db/schema.sql`
(`viewer_id` tables, `activities.source`) and `lib/feed.signed-out.test.ts:13`. Not legal advice.

**Verdict in one line:** a sound plan that decides how and changes no decision. Every criterion G1 to G6 maps to a
test. It needs nine precise changes, none of which changes scope or the PR split. The most important one: "demo
viewer" is undefined, and the obvious reading of it would switch G3 off for every real viewer who has no broker.

## 1. Rulings per item

| Item | Ruling | Why |
|---|---|---|
| Two PRs (PR-7 G1/G3/G4, PR-8 G2/G5/G6) | **Accept** | The one ranking change (G1) stays apart from five changes that don't touch the ranking (independence rule 4). Both stay under 800 lines. The independence table holds: the only shared files are append-mostly (`lib/copy.ts`, `app/globals.css`, `db/schema.sql`), and the schema changes touch different tables. |
| Order: both after PR-4, PR-7 has priority, PR-5a/5b wait on both | **Accept** | PR-4 owns `lib/feed.ts`, `app/me/*` and `lib/delete.ts`, so starting from its merge commit is right. The urgency is real: F1's last sentence is false on this branch until PR-7 merges. PR-4's review cites this plan. |
| G1 · switch, storage, `loadFeedPage` branch | **Accept with change** (C2, C5, C7) | A boolean with no timestamp is the P3 minimum. Showing followed traders in the section when the switch is off is the strict reading of "signed-out order minus their own hides", and it is the right one: leaving out a followed trader is itself ordering by the viewer's activity. T1.1(b) is the right equivalence test. |
| G1 · "records nothing about their reading" (T1.3) | **Accept with change** (C2) | The allowed writes are named, which is good. But the test never opens `/t/<sym>`, so the watchlist allowance is never exercised or bounded. |
| G3 · pinned constant, `mayRecord`/`usableTypes`, static guard | **Accept with change** (C1, C3) | A constant beats an env flag: turning it on needs a reviewed diff. The plan is stricter than criterion G3's wording ("while the switch is off"): implicit signals are off for every real viewer, which matches the Decision. Keep it that way. |
| G4 · copy and the watchlist in the first step | **Accept with change** (C6) | Two lines plus a test with a failed vendor call is the minimum. The copy is one 45-word sentence; split it. |
| G2 · Reset: hard delete, registry, confirmation page, no counts | **Accept with change** (C8) | A hard delete gives the stronger promise. The registry (T2.4) is how PR-5a gets caught, and it works because `discovery_events` is keyed `viewer_id` (`plan.md:275`). A confirmation page works without JS, and three taps is the minimum for a confirmed delete. |
| G5 · paging by page number | **Accept with change** (C4) | A page number names no trade, so it is G6-clean. A keyset cursor would put a like's timestamp in the URL. Unlikes on other pages can shift a row, but the row stays reachable, so "reachable" holds. |
| G6 · POST lookup, state-sourced confirmations, session purge | **Accept with change** (C3, C4) | This is the right design. Two test definitions are loose enough to pass wrongly or fail spuriously. |
| §4 schema | **Accept** | Additive and idempotent. The fallback index only if T8.L misses. |
| §5 rewritten assertions | **Accept** | Each is rewritten, none deleted; the reviewer checks this list against the diff. |
| §6 copy | **Accept with change** (C6, C8) | Every string passes the scans. Two strings use the team's internal term "signed-out order", which users don't use. |
| §7 Privacy coordination | **Accept with change** (C5) | One more Part A sentence becomes false with the switch off and isn't listed. |
| §9 accessibility, §10 budgets, §11 COMPLIANCE §1, §12 policy | **Accept** | Complete for A1 (name, state as text, 44 px, focus, reduced motion, contrast for text and non-text). P6 is strengthened by G4. COMPLIANCE answers 1 to 11 are true of the plan. |
| Line cost | **Accept, with a note** | ~490 product lines against my ~200-line estimate. Most of the difference is the G6 rework of the no-JS confirmations, which the Decision requires. The 40-line optimistic switch earns its place (the < 100 ms budget). Don't grow it. |

## 2. Q1 ruling: watched-symbol "last opened" while the switch is off

**Recommendation, and the default the build uses: keep the stamp** (`ticker_watches.last_seen_at`, written when a
watched symbol's page is opened).

Reasons:
- **What the switch is for.** It turns off ordering by activity (POLICY F1's last sentence; Q4's non-personalized
  feed) and discovery activity (Q5). The stamp orders nothing. It is the state of a feature the viewer turned on by
  tapping Watch, and the Privacy Watchlist row already discloses it.
- **What the user expects.** Someone who turns off feed ordering does not expect their watchlist to break. The
  alternative ("new since you started watching") produces a count that only ever grows.
- **The same class as `sessions.last_seen_at`.** It is state the feature needs to work, not a record of reading.

Conditions. The default is acceptable only with these, all in C2:
- the allowance is bounded to that one statement;
- the test exercises it;
- a static guard keeps the stamp out of every ranking path, so it can never become a reading signal by accident.

The orchestrator records Q1 and this default under the F-2 Open questions for the owner to confirm. The build does not
wait. If the owner says no, it costs ~3 lines plus a tighter T1.3, as the plan states.

## 3. Precise changes (all are part of this signature; the builder and the reviewer check each one)

1. **C1 (G3, highest): define "demo viewer" positively, on the server.**
   - The repo has no viewer-level demo flag. Demo is `activities.source = 'demo'` (`db/schema.sql:69`), which is a
     trader property.
   - A rule like "every activity of the viewer is demo" is vacuously true for a viewer with no broker. That would turn
     implicit signals on for every real viewer.
   - Required definition: `demo` = the viewer has ≥ 1 activity **and** every one of them has `source = 'demo'`. It is
     read from the database by the session's id, never from request input.
   - Add to T3.2: a viewer with zero activities, a viewer with only `snaptrade` activities and a viewer with mixed
     sources each get `demo: false`, so `mayRecord(implicit) === false`.
2. **C2 (G1, Q1): bound T1.3.**
   - Add `/t/<sym>` for a watched and an unwatched symbol to the pages rendered with the switch off.
   - The only allowed watchlist write is `update ticker_watches set last_seen_at … where user_id = <viewer> and symbol
     = <that symbol>`, on a watched symbol's page.
   - New static guard: no file under `lib/feed.ts`, `lib/similar.ts` or `lib/discovery/**` reads `last_seen_at` from
     `ticker_watches`.
3. **C3 (G3): make T3.3 about behavior, not imports.**
   - Scope the guard to `insert into discovery_events`, `from discovery_events` and the `/api/events` handler.
     Deletion and purge paths (`lib/delete.ts`, `purgeDiscovery`) are exempt through a named allow-list in the test.
   - Write into `plan.md` PR-5a's test list the behavioral pair PR-5 must add:
     - a non-demo viewer POSTing each implicit type stores 0 rows;
     - demo implicit rows seeded for a real viewer are absent from that viewer's `viewerProfile` input.
4. **C4 (G5, G6): remove two loose test definitions.**
   - (a) T5.2 vs §2.1: a non-numeric, ≤ 0 or > 10^6 `?likes=` value renders page 1 (200). A valid number past the last
     page renders the empty state with a "Newer likes" link. Each input asserts exactly one outcome, not "page 1 or an
     empty page".
   - (b) T6.1 compares URLs by path. The only query key allowed is the framework's own router key (`_rsc`); any other
     query key fails, as do the forbidden keys and a 64-hex key anywhere in the URL. Document this in the spec so the
     test can't be loosened to make a framework request pass.
5. **C5 (Privacy §7): one more sentence to change.**
   - Part A "Follows" says followed traders "are left out of your suggestions". That is false with the switch off.
   - §7 must require: "While "Order my feed by my activity" is on, followed traders are left out of your suggestions,
     since you already follow them."
   - The Privacy PR's reviewer checks it against PR-7 as merged.
6. **C6 (G4 copy): split `SETTINGS.deleteExplain` into three sentences.** The scans and T4.1 are unchanged. The UX lead
   may reword within the scans:
   - "Deleting removes your profile, record, sign-in details and the brokerage link at the vendor."
   - "It also removes your follows, likes, hidden traders and trades, unfollow notes, watchlist and reading activity."
   - "Your handle is held for a year."
7. **C7 (G6, JS path): exactly one confirmation.** `recentAction` runs on every signed-in profile render. With
   JavaScript, the client status line and the state-sourced line must not both appear. Add to T6.3/e2e: after a follow
   with JS, exactly one `role="status"` element carries "Following @h.", and it is announced once.
8. **C8 (copy, the UX lead decides the final words): effect first, no internal terms.**
   - `orderOffExplain`: "Off: you see the same order as everyone, minus the traders and trades you hid."
   - `orderSavedOff`: "Your feed now uses the same order as everyone's."
   - `RESET.explain` leads with what the viewer gets: "Hidden trades come back, and traders you unfollowed are no longer
     placed lower. Your follows, likes, “Not interested” list and watchlist stay."
   - `RESET.keep`: "Cancel" instead of "Keep them". "Them" has no referent on a page that lists both what goes and
     what stays.
9. **C9 (forward, written into `plan.md` PR-5b):** with the switch off, PR-5b's section shows the signed-out heading
   and explanation and no personal reason line ("similar holding period to @x" would be a false claim of
   personalization). PR-5b also rewrites `orderOnExplain` when follows and likes start ordering (already in the plan;
   T1.5 pins the string).

## 4. Demands on the other agents

- **Builder (PR-7, PR-8):** C1 and C2 come first, as tests that fail before the code. Each claim of "done" means
  signed in, at 375 and 320 px, light and dark, with and without JS.
- **Reviewer:** check C1 by reading the `demo` query, not the test name. Check C4(b) by running T6.1 against a build
  with `?done=` reintroduced: it must fail. Check the §5 list against the diff line by line.
- **UX lead:** rule on the words in C8. Rule on whether the "On"/"Off" prefixes in the two explain lines duplicate the
  switch's own state text; I'd drop the prefixes.

## 5. What would change my mind
- Two findings would send PR-7 back to plan:
  - the owner says "reading" includes the watchlist stamp (Q1 → no);
  - a check shows that `demo` can't be read without a new query on the hot path.
- Both are settled within a day: the owner's answer in the chat, and one `explain` of the `demo` read inside the
  existing `Promise.all`.

Business lead signs with changes C1 to C9 (§3) binding on PR-7 and PR-8.

SIGNED
