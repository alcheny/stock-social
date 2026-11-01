# Design council, cycle 3 routed items: committee record (2026-11-01)

Docs only, no code. Approval council cycle 3 routed C3-41 and C3-45 to a design session
(`docs/ideas/approval-2026-11-01-cycle3.md`, "Routed in round 0"; evidence in `docs/direction/cycle3-2026-11-01.md`
§4.2, §5 F3-8, §6 Rank 14 and Rank 18, §8 CS-6). PR #71 (merged as 06edbdf) left three colour follow-ups for F-20's
design. Under the owner's instruction of 2026-11-01, a committee decides open questions in the owner's place. Anything
POLICY or an earlier decision reserves to the owner stays an owner question.

## Members
Each member was a fresh-context agent.
- **UX lead** (`team/ux-lead.md`) drafted and revised.
- **Business lead** (`team/business-lead.md`) reviewed.
- **Engineer** (`team/engineer.md`) reviewed.
- **Accessibility and legal reviewer** reviewed against POLICY, COMPLIANCE §1 and WCAG 2.2 AA.

The orchestrator chaired. Reviewers ran in parallel in each round.

## Outputs
- `docs/features/F-25-one-link-rule-for-trade-rows.md` (C3-41). Blocked on F-9 (PR #65), F-11 (branch
  `claude/fix-truthful-labels`) and F-26.
- `docs/features/F-26-no-empty-note-line.md` (C3-45, including the held-note finding). Blocked on F-9 (PR #65).
- `docs/features/F-27-colour-follow-ups.md` (the three PR #71 follow-ups). Blocked on F-20 and F-11.

**Scope change during the session.** The orchestrator moved the follow-ups out of F-20's file. #71 merged, which
unblocked F-20, and F-20's build session now owns that file. So F-20's file is not edited. The follow-ups became
F-27, and the image hue change became an owner question only, because F-20 keeps "No image colour changes (O-2
stays the owner's)".

## Rounds

**Round 1: UX lead draft** (`ux-draft-notes.md`). All three reviewers returned SIGN WITH CHANGES on every file
(`review-r1-*.md`). The main findings:
- **Business lead.** Trade URLs put the vendor's activity id (`sell_id`) on the signed-out feed, while
  `lib/privacy-fields.ts` calls it "never shown". A hashed `trade_key` already exists. F-26 must also close the next-page
  payload. F-27's warn notice should be one component and one class.
- **Engineer.**
  - A second 44 px footer link does not fit F-10's height budget as drafted, and the draft's "paid for by F-26" claim
    is false for cards that have a note.
  - Six e2e selectors need narrowing.
  - The pane's five keys can come from one correlated column in an existing statement.
  - F-11's branch already defines `--warn` with other values.
  - F-20's floor covers gain, loss and Flat only, so warn needs no exemption.
- **Accessibility and legal reviewer.**
  - Trade-link names need a Gain, Loss or Flat word, and figure links need 44 × 44 px.
  - Add a swipe-never-navigates test (WCAG 2.5.2), and move `aria-current` onto the link.
  - Close every held-note leak path: dates, report state, raw status, paging responses, cached routes, metadata,
    image, query count, and the report confirmation.
  - F-20 cannot pass as decided if the owner says no to the image hue change.

**Chair rulings for round 2.**
1. The committee decides the trade URL. F-25 moves to `trade_key`, with a 308 from old `sell_id` URLs. Only the
   consent-copy wording stays an owner note.
2. No feature file re-asks the three-version rule. One line points to standing owner Q1.
3. "This trade →" and the profile link share one line where they fit. The trade link never replaces the profile link.
   F-10's height checks pass unchanged, or the build stops and returns to a committee.
4. F-27 has no exemption, gets a usage test, and drops the conditional image-hue criterion. The F-20 conflict goes
   to the owner.
5. F-26 takes every leak-closing criterion.

**Round 2.** F-26 and F-27 were signed by all three reviewers. On F-25, the business lead and the engineer said NO.
The accessibility and legal reviewer signed on one condition.
- **F-7 AC20 fixes the old footer text.** Changing it needs a recorded amendment. Three more e2e checks need updating,
  and one would silently weaken if left unchanged (business lead, engineer).
- **The one-line fit claim was wrong** (engineer). At 360 px the content box is 320 px and the footer is 16 px. Only
  "Record, wins and losses →" at 0.875rem fits, with about 11% spare.
- **The pipeline builds one feature as one PR**, so the "PR 1 / PR 2" split cannot run. The cap is 800 product lines,
  and F-25 is about 315.
- **Remaining gaps.** `/me/record` posts `sell_id`. The redirect needs a `maxRedirects: 0` test and must stay out of
  `proxy.ts` and `generateMetadata`. The first-card budget must also be checked after the first-visit line is dismissed.
- **Privacy inventory** (accessibility and legal reviewer). The `trade_key` label must say the key is shown in
  trade-page URLs.

**Chair rulings for round 3.** No F-28 and no split: F-25 is one PR, blocked on F-26. The engineer's measured copy
and size are adopted, and the F-7 AC20 amendment is recorded in F-25. F-7's file is not edited.

**Round 3.** Every member signed.
- **Business lead:** signed F-25.
- **Engineer:** signed F-25 and F-27. One optional fix: the held-note criterion checks classes, not colours.
- **Accessibility and legal reviewer:** signed F-25 and F-27 on three wording conditions, which the reviewer said
  need no further review. The chair applied them, with the engineer's optional fix, in the final files:
  - **R3-1:** the profile link's accessible name is "Record, wins and losses: @‹handle›", with the arrow
    `aria-hidden`. A criterion requires that no two footer profile links on a feed page share a name. Card context
    does not count as link context under WCAG 2.4.4.
  - **R3-2:** the two footer links' hit boxes never overlap, with at least 8 px between them.
  - **R3-3:** F-27's colour scan covers `color`, border, outline, background, `fill` and `stroke`, not only border
    and stroke.

Item-by-item outcomes are in `revisions.md`.

## Signatures (round 3)
| Member | F-25 | F-26 | F-27 |
|---|---|---|---|
| UX lead | author | author | author |
| Business lead | SIGN | SIGN (r2) | SIGN (r2) |
| Engineer | SIGN | SIGN (r2) | SIGN |
| Accessibility and legal | SIGN (R3-1, R3-2 applied) | SIGN (r2) | SIGN (R3-3 applied) |

## Owner questions raised (not decided)
1. **F-27:** may the dark share images move gain and loss to the page tones #3cc4b4 / #ff8a5b? The committee
   recommends yes. Image colours are the owner's (F-20, O-2).
2. **F-27 → F-20:** if the answer to 1 is no, F-20 as decided cannot pass. Its colour-blind floor covers images,
   while its table must keep the old dark pair, which measures 6.3 ΔE00 under deutan. The owner must choose between
   a named image exemption recorded in F-20 and the hue change. No builder lowers the floor.
3. **F-25 (note, not a choice):** the consent copy and `lib/privacy-fields.ts` call `sell_id` "never shown". Every
   trade URL has carried it until F-25. With F-25 that statement is true again. The wording stays the owner's.
4. Standing owner Q1 (three versions for lane C product changes) applies to F-25 and F-26 and is not re-asked.

## Non-blocking notes for the builds
- `trade_key` is an unsalted SHA-256 of the vendor's activity id. That is acceptable while those ids are hard to
  guess. A future vendor with sequential ids would need a salted key.
- F-9's answer to a repeat report by the same user should not depend on whether the note is held.
- The `role="status"` on failed-import cards announces on every appended feed page. This is noted for F-11 and F-20.
- F-25 hides the "✓" glyph in the Verified badge from screen readers in the `Badge` component, so it applies everywhere the badge shows.
