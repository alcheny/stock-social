# F-26 · No empty-note line, and the held note shown to its author only

Status: built

## Why
"No thesis posted." is the second-largest text on every feed card (`app/ui.tsx:57`, `.thesis` at 18 px) and says
nothing about the trade (C3-45, CS-6). It also shows for a held thesis, where it isn't true, and F-9's branch keeps
that on the card. The author must see their held note wherever the trade has a note slot. No one else may learn that
a note was held.

## Decisions
- 2026-11-01: The feed card shows no line when a trade has no published note. `thesisLine` renders nothing (no
  element, no empty `<p>`) unless the note is published (F-9's `UserNote`) or the card is an F-7 public-record card
  (its own card line, unchanged). "No thesis posted." is removed from the product. Why: decided by the committee
  under the owner's instruction of 2026-11-01; Every other surface (profile row, trade page, pane, stock page) already
  shows nothing when there is no note, so the card was the exception. Showing nothing is true for both "none" and
  "held", while "No thesis posted." is false for a held note. The space goes back to F-10's first-screen budget and
  F-25's footer link. The trust cue the line was meant to give (nothing hidden) belongs to trades, which TR-1 already
  guarantees; a missing note hides no trade.
- 2026-11-01: A smaller muted line ("No note", at `--fs-small`) was considered and rejected. Any absence wording
  either states something false about a held note or hints that a note might be hidden ("No note shown"). Why:
  decided by the committee under the owner's instruction of 2026-11-01; viewers must not learn a note was held (F-9).
- 2026-11-01: Viewers are anyone signed out, or signed in as anyone but the trader. For them, a held note and no note
  give the same output on every surface: feed card and its appended pages, pane (rows and chart sheet), profile row,
  trade page (with its title, description and share image), month page, and the stock page's trades and notes lists.
  None of the following is ever sent to a viewer, in HTML, RSC payload, JSON or metadata:
  - held note text;
  - its hold rule;
  - its written or edited dates;
  - its report state;
  - any `thesis_status` other than 'published' or null.

  No count shown to viewers includes held notes. For a viewer, the queries run for a held note are the same as for no
  note: one SQL `case when thesis_status = 'published'`, and no extra lookup. Why: decided by the committee under the
  owner's instruction of 2026-11-01; F-9 and POLICY U1 (held, never shown, never silently dropped for the author); a
  status field, a date or a count would leak the hold as surely as the text.
- 2026-11-01: The author sees F-9's held line, `heldLine(rule)` ("Thesis held for review. Only you can see it. Held
  because it has ‹rule›. Edit it to publish, or it stays held until reviewed."), wherever their trade has a note slot.
  It is in F-9's neutral tone (`.thesis-held`, small), never the loss or warn colour:
  - feed card (their own trade in their own feed): in the note slot, in place of the note, as the full line;
  - profile row: as F-9 built it, above the edit field;
  - trade page: in the "This trade" box where a published note would be, followed by a link "Edit it on your
    profile" to that row. The row's closes window comes from one `count(*)` of the author's closes ahead of this one
    in list order, run only for the author, then `lib/paging.ts#tradeHref`.

  Surfaces with no note slot show nothing for anyone, the author included:
  - pane last-trades rows;
  - chart sheet (it shows published notes only and has no absence line; its "Go to trade in list" reaches the row
    with the held line);
  - month page;
  - stock-page trades list;
  - stock-page notes list (published notes only);
  - likes;
  - hidden trades.

  Why: decided by the committee under the owner's instruction of 2026-11-01; This applies F-9's decision that the
  author sees "Held for review" and the matched rule to every place a note would appear. The full line on the
  author's own card was confirmed by the business lead in round 1.
- 2026-11-01: Any response that contains `heldLine` text is per-user and sent with `Cache-Control: private, no-store`.
  The publicly cached routes (`/u/<handle>/pane`, `/u/<handle>/pane-chart`) and every share image never contain it.
  Why: decided by the committee under the owner's instruction of 2026-11-01; an author-only line in a shared cache
  would reach viewers.
- 2026-11-01: The trade page's `generateMetadata` and its share-image route read no session and no hold field. Only
  the page body reads the session, for the author check, through a separate author loader that
  `lib/trade-share-load.ts`'s shared query never calls. Why: decided by the committee under the owner's instruction of
  2026-11-01; the image and metadata are shared and cached, so they must not branch on who is asking.
- 2026-11-01: F-9's report confirmation is one string ("Reported. Thank you.") whether or not that report reached the
  hold threshold. So a held note looks to every viewer, the reporter included, like a note its author removed. Why:
  decided by the committee under the owner's instruction of 2026-11-01; a different confirmation would tell the last
  reporter that the note is now held.
- 2026-11-01: Word clash with the holding period. The card without the record line shows "held 3d · closed" and the
  trade page shows "Held 3 days · closed". The held-note line keeps F-9's wording, always begins with "Thesis", and sits
  in the note slot below the hero, never in the hero or the figure row. The holding-period text is unchanged. Why:
  decided by the committee under the owner's instruction of 2026-11-01; F-9 decided the words, and in reading order the
  noun "Thesis" plus "for review" keeps the two uses apart.
- 2026-11-01: Where it lives:
  - `app/ui.tsx#thesisLine`: F-10 owns the card; this feature changes only the note slot.
  - `TradeCard` gets an `ownHeld?: OwnHeld | null` prop (`OwnHeld = { rule }`, set only on the author's own held card;
    `HeldNote` words it) rather than reading a status. (Build note 2026-11-01: was "the held line or nothing" as a string;
    the rule is passed so the card and the trade page share one markup.)
  - The feed's existing `page.viewer.id === t.user_id` check sets that prop. The feed's no-session rule stands
    (`lib/feed.signed-out.test.ts`).
  - Both `lib/feed.ts#loadFeedPage` statements that select `thesis` (the candidate statement and the page-row
    statement) return `thesis` and `thesis_status` as null unless published, and `thesis_hold_rule` only where
    `t.user_id` equals the signed-in viewer.
  - Copy stays in `lib/report-copy.ts` (F-9).

  Why: decided by the committee under the owner's instruction of 2026-11-01; held text must not reach a viewer's
  payload, not just stay unrendered.
- 2026-11-01: On the first card of page 1, F-13's first-visit line keeps the note slot (`.fv-slot`). With no published
  note, the slot holds the first-visit line alone. Why: decided by the committee under the owner's instruction of
  2026-11-01; F-13 D27 and F-10's one-screen budget.
- 2026-11-01: Merge order, not a block: if F-11's branch is still pending, F-26 builds after it. Both edit
  `app/ui.tsx`, `lib/feed.ts`, `lib/trade-share-load.ts` and the trade page. Why: decided by the committee under the
  owner's instruction of 2026-11-01; one rebase instead of two.
- 2026-11-01: The trade page's "Edit it on your profile" link sits on its own line under the author's held line
  (`p.held-edit`, a 44 px target), in the same note slot. Why: decided by the committee under the owner's instruction of
  2026-11-01; an inline 44 px link stretches one line of a 3-4 line muted paragraph, and "Edit it to publish…" directly
  followed by "Edit it on your profile" reads as a stutter (business lead and engineer, round 1, Q-A).
- 2026-11-01: `/u/<handle>/pane-chart` nulls a non-published thesis in its SQL, as the feed pane's `records()` does,
  instead of after the read. Why: decided by the committee under the owner's instruction of 2026-11-01; the guarantee
  holds where the data is read, and the change is one line in the route (Q-B).
- 2026-11-01: F-26 builds now and merges origin/main after F-11 lands, then re-runs the unit, database and e2e suites
  and checks F-11 for any new statement that selects a note. Why: decided by the committee under the owner's
  instruction of 2026-11-01; no F-11 branch was open at build start, and the merge-order decision asks for one rebase (Q-C).
- 2026-11-01: The author's held flag is "the row is the signed-in viewer's own and `thesis_status = 'held'`"; the rule
  column is read only under that condition and never decides the flag. Why: decided by the committee under the
  owner's instruction of 2026-11-01; a published note can keep a leftover rule (engineer, round 1).

## Acceptance criteria
- [x] The string "No thesis posted." appears nowhere in `app/` or `lib/` (source test).
- [x] For a viewer, `TradeCard` renders the same HTML for `thesis_status` null, 'held' (each rule) and every other
      non-published status when the other fields match. That HTML has no element in the note slot (render test).
- [x] `TradeCard` with a published note renders F-9's `UserNote`. An F-7 public card still renders its card line
      (render test).
- [x] For a signed-in author, the card for their own held trade shows `heldLine(rule)` in the note slot, in
      `.thesis-held`, with neither the loss nor the warn class (render test, and e2e on `/` signed in as the demo
      author).
- [x] Viewer payloads carry no held text, rule, note dates or report state. This covers:
      - the feed page HTML and its paging server-action responses;
      - `/u/<handle>/pane` and `/u/<handle>/pane-chart` JSON;
      - the profile HTML;
      - the trade page HTML, its `<title>` and meta description;
      - the share image request.

      None contains the held thesis text or its rule label, and none carries `thesis_status: 'held'` or F-9's note
      dates for a held note. Checked signed out and signed in as another user (e2e with a seeded held thesis that
      contains a unique marker string).
- [x] Any response that contains `heldLine` text is sent with `Cache-Control: private, no-store`. The responses of
      `/u/<handle>/pane`, `/u/<handle>/pane-chart`, `/u/<handle>/story` and every `opengraph-image` never contain it
      (e2e header and body check).
- [x] The trade page's `generateMetadata` and its `opengraph-image` route read no session and select no thesis status,
      hold rule or note date for a non-published note. Only the page body reads the session, for the author check
      (source test, as `lib/feed.signed-out.test.ts`).
- [x] For one seeded trade, a viewer fetches the trade page before and after its thesis is set to held. The `<main>`
      HTML, `<title>`, meta description and `og:image` URL are identical (e2e, same viewer, per-request tokens
      stripped).
- [x] For one seeded trade, the same viewer (signed out, and signed in as another user) fetches before and after the
      hold: `/`, one feed paging-action response, `/u/<handle>`, `/u/<handle>/pane`, `/u/<handle>/pane-chart`, the
      month page and `/t/<SYMBOL>`. Each body, with per-request tokens stripped, and each `Cache-Control` header is
      identical before and after (e2e).
- [x] For a viewer, the feed, pane, profile and trade page run the same SQL statements for a held note as for no note
      (query-log test). No count shown to viewers (notes count, "Showing N", likes or hidden counts) includes held
      notes.
- [x] F-9's report confirmation is the same string for a report below the hold threshold and for the report that
      reaches it (unit test on the report action's result). Reporting an already-held note gets the same response as
      reporting a note its author removed (unit test).
- [x] The trade page, viewed by its author, shows `heldLine(rule)` and an "Edit it on your profile" link that lands on
      the profile row with its edit field present, including for a trade outside the first 50 closes (e2e). The
      `count(*)` behind the link runs only for the author (query-log test).
- [x] The month page, the stock-page lists, the pane rows and the chart sheet render the same for held and none, for
      the author and for a viewer (render tests).
- [x] At 320×640, 360×640 and 780×360, the F-10 headroom and disclaimer checks pass unchanged in three cases: a card
      with no note, a card with a 280-character note, and the author's held card. The held line is about 130-150
      characters at 13 px, 3-4 lines at 320 px (e2e).
- [x] With F-13's first-visit line on card 1 and no published note, the slot holds only the first-visit line (render
      test).
- [x] `lib/feed.signed-out.test.ts` still passes: the feed page reads no session.

## Out of scope
- F-9's hold rules, release path, `heldLine` wording and `UserNote` styling.
- The note's type size on the card (F-9, design system DS-32).
- The holding-period wording on the card and the trade page.
- An "Add a note" prompt for the author in the empty slot (business lead: new scope, no evidence).

## Open questions
- Standing owner Q1 (docs/process/decisions-and-authority.md) applies; not re-asked here.

## Rework notes

## Build log
- 2026-11-01: Built on `claude/f26-held-like-none` after F-9 merged (ff25ad5). Committee record:
  `docs/features/logs/F-26/committee-2026-11-01.md`. Tests: `lib/f26-held-like-none.test.ts`,
  `lib/f26-held-like-none.db.test.ts`, `e2e/f26-held-like-none.spec.ts`. QA clean; business lead and UX lead user tests pass.
