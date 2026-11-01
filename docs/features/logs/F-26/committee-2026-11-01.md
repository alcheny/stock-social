# F-26 committee log, 2026-11-01

Build session for F-26 (`docs/features/F-26-no-empty-note-line.md`), branch `claude/f26-held-like-none`, under the owner's
instruction of 2026-11-01 (develop autonomously; open questions decided by the committee's recommended option).

## Prerequisite
F-9 (PR #65, `claude/fix-user-text-safety`) merged into main as ff25ad5: `UserNote` (lib/user-note.ts,
app/user-note.tsx), `heldLine` (lib/report-copy.ts), `closed_trades.thesis_hold_rule`, lib/reports.ts. Confirmed with
`git log origin/main` at build start; F-26's `Blocked:` line is therefore lifted.

## Round 1: UX lead's plan
1. `lib/report-copy.ts`: add `HELD_EDIT_LINK = 'Edit it on your profile'` (copy stays in F-9's file).
2. `app/ui.tsx#thesisLine`: public card line; else published → `UserNote`; else `ownHeld` → `<p class="muted thesis-held"
   data-own-held>`; else nothing. "No thesis posted." deleted. `TradeCard` gets `ownHeld?: string | null`. The `.fv-slot`
   holds only the first-visit line when there is no note.
3. `lib/feed.ts`: candidate statement and page-row statement select `thesis`, `thesis_status` and the note dates as
   `case when t.thesis_status = 'published' …`; the page-row statement adds the hold rule only where `t.user_id` is the
   signed-in viewer (`own_held`, `own_hold_rule`). The candidate statement is shared by every viewer, so no hold field.
4. `app/feed-rows.tsx`: `ownHeld` from the existing `page.viewer.id === t.user_id` check plus `heldLine`.
5. New author loader (`lib/own-note.ts`): one statement, the held row plus one `count(*)` of the author's closes ahead of
   it in list order (`(closed_at, id) >` tuple); never imported by `lib/trade-share-load.ts`.
6. Trade page body: for the author only, the held line with "Edit it on your profile" → `lib/paging.ts#tradeHref`.
   `generateMetadata`, `loadOnce` and the share image untouched.
7. `/u/<h>/pane-chart`: null the thesis in SQL rather than in JS.
8. Profile: no change (author-only held line already; tests only).
9. `lib/f10-feed-card.test.ts`: its hero regex anchored on the removed empty-note paragraph; re-anchor on the next
   element (`<footer`), equally strict.
Tests mapped to every AC: `lib/f26-held-like-none.test.ts` (render, source, report), `lib/f26-held-like-none.db.test.ts`
(payload equality, query log, author loader), `e2e/f26-held-like-none.spec.ts` (identity, headers, author link, F-10 headroom).

Open questions raised, each with the UX lead's recommended option:
- Q-A: the edit link inline in the held line or on its own line? Recommended: inline, in the same `<p>`, `tap44`.
- Q-B: change `pane-chart`'s SQL (F-11-adjacent)? Recommended: yes, one line, the guarantee holds in SQL.
- Q-C: merge order with F-11? Recommended: build now; merge origin/main after F-11 lands (no F-11 branch open at start).

## Round 1 reviews
Business lead: SIGN with demands. (1) e2e: `/` signed in as the author is `private` + `no-store`, and `/` signed out holds
no marker; (2) hold fields null on every row not the viewer's own, and payload equality diffs the RSC payload, not only
HTML; (3) the author link lands on the right row, tested at positions 50 and 51; (4) unit proof that reported, held and
not-found give the reader `REPORT_COPY.done`; (5) the re-anchored F-10 regex also asserts no `<p class="thesis">`.
Q-A rejected (link on its own line below the held line, 44 px target, same slot: an inline `tap44` in a 3-4 line muted
paragraph stretches one line box, and "Edit it to publish…" followed by "Edit it on your profile" reads as a stutter).
Q-B accepted. Q-C accepted (check F-11 for any new statement selecting `thesis` before merging).

Engineer: DEMANDS, then SIGN once met. (1) the author flag from `thesis_status = 'held'` and the author check, never from
the rule column (a published note may keep a leftover rule); (2) the count in the same statement as the held-row
lookup, matching the profile's list exactly (no feed filters), tested at 0, 49, 50, the last row and a `closed_at` tie;
(3) Q-A: reject inline (same reasons); (4) Q-B: accept, the `records()` form; (5) Q-C: accept, re-run every suite after
merging F-11; (6) e2e identity: exclusive feed lock for the whole before/after pair, a dedicated fixture trader, "before"
= no note, strip CSP nonces, cursors and build ids, replay one recorded paging-action request; (7) Cache-Control
checked by token (`private`, `no-store`) for the author's responses, full-value equality before/after.

## Round 2: plan amended, both sign
All demands taken into the plan; the engineer's gate "`me.id === t.user_id`" is met by the existing handle comparison
(`me.handle === t.handle`: handles are unique and the trade is loaded by handle), so `TradeView` gains no user id.
Business lead and engineer: SIGN.

## Decisions (appended to the feature file)
- D1: the edit link sits on its own line under the author's held line (`p.held-edit`, a 44 px `tap44` link).
- D2: `/u/<h>/pane-chart` nulls a non-published thesis in SQL (`case when thesis_status = 'published'`).
- D3: F-26 builds now and merges origin/main after F-11 lands, re-running unit, db and e2e suites.
- D4: the author's held flag is `t.user_id = viewer and thesis_status = 'held' and thesis is not null`; the rule is
  read only under that condition.
