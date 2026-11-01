# Round 2 review: accessibility and legal (2026-11-01)

Reviewer: accessibility/legal member of the design council. I re-read the revised F-25, F-26 and F-27 and
round2-changes.md against POLICY, COMPLIANCE §1, WCAG 2.2 AA and F-9's held-note rules. No draft or repo file was
edited.

## Verdicts

| File | Verdict |
|---|---|
| F-25-one-link-rule-for-trade-rows.md | SIGN, on condition of required change 1 (a one-line inventory fix, no re-review needed) |
| F-26-no-empty-note-line.md | SIGN |
| F-27-colour-follow-ups.md | SIGN |

## Scanner and wording check

I re-ran all three files and round2-changes.md through `scripts/compliance.ts`'s `MARKS`, `MINORS` and `PROMO` lists
and `LOCAL_PATH`: no hits. The wider word check finds "every trade" only in structural spec wording ("every trade
URL", "Every trade link") and "advice" only in the copy-test AC. Neither is a product claim. There are no
third-party names, no real people and no age cohorts. The new visible strings "This trade →" and "Their record, wins
and losses →" carry no advice, signal or completeness wording.

## Round 1 items

- **1-6 (F-25):** applied and checked.
  - Sign word: in the Shape C, Shape R and feed names, with an AC.
  - Targets: 44 × 44 for Shape C, 44 px tall at 320, 360 and 780 px.
  - WCAG 2.5.2: has an AC.
  - `aria-current`: on the `<a>`.
  - Focus ring: whole row, not clipped.
  - 2.5.3: holds for "This trade: ‹SYMBOL› ‹Gain|Loss|Flat› ‹%›" and for the Shape C name, because the visible text
    is a substring of each name.
  - Notes list: F-9's Report control stays outside the row link, which avoids nested interactive content.
  - The `aria-hidden` check glyph is a good addition.
- **7 (sell_id):** I accept chair ruling 1.
  - Moving to `trade_key` URLs with a 308 from `sell_id` URLs removes the exposure, which is better than my
    round-1 option.
  - It makes the consent line ("never shown") true again, so leaving only an owner note is correct.
  - The AC that keys survive a rebuild and the AC barring `sell_id` from every href and payload are what I would
    have asked for.
- **8-13 (F-26):** applied and checked.
  - The viewer ban covers text, rule, dates, report state and status; counts exclude held notes.
  - It covers paging responses and `pane-chart`.
  - Any response containing `heldLine` is `private, no-store`.
  - Metadata and image read no session (source test).
  - Viewers get the same SQL for held and none.
  - There is one report confirmation string.
  - I accept chair ruling 5's testable form in place of byte-identical images. Image bytes are not stable, and
    together the source test plus the identical `og:image` URL prove the image cannot branch on the hold.
- **14 (F-27):** applied as an owner question that states it blocks F-20's build and that no builder lowers the floor
  or exempts images.
- **15 (F-27):** the Blocked-line wording was not applied. I accept this, because F-27 itself builds without the
  answer and the dependency is stated in the open question.
- **16 (F-27):** superseded by chair ruling 4. Having no exemption at all, plus a render test that every `--warn` use
  is a `.warn-notice` with icon and words, is stronger than my wording. The warn-vs-loss closeness under deutan is
  then handled by redundancy (WCAG 1.4.1), not by hue. I accept this.

Owner questions are correctly left to the owner:
- the image gain/loss hue (F-20's "No image colour value changes", O-2);
- the F-20 conflict;
- Q1 (the three-version rule);
- the consent-copy wording.

None is decided by the committee.

## Remaining required change

1. In F-25's `trade_key` decision, add: "`lib/privacy-fields.ts` relabels `closed_trades.trade_key` from 'key (hash of
   sell_id)' to 'key (hash of sell_id; shown in trade-page URLs)', and `closed_trades.sell_id` keeps 'never shown'.
   The consent line (owner copy) is unchanged." The reason: the inventory must match the data flow (FTC Act §5,
   COMPLIANCE §3), and `trade_key` becomes public with this feature.

## Advisory (not required)

- `trade_key` is an unsalted SHA-256 of the vendor id. It reveals nothing while vendor ids are high-entropy, and only
  demo users have published `sell_id` URLs so far (P6: no non-demo user yet). If a future vendor's ids turn out to be
  guessable or sequential, revisit with a salted key.
- F-26: F-9's "already reported" response to a second report, if any, should also not depend on the note's status.
  The single confirmation string decided here likely covers this already.

---

# Round 3 addendum (2026-11-01)

I re-read F-25 and F-27 against the "Round 3" section of round2-changes.md. I edited nothing.

## Verdicts

| File | Verdict |
|---|---|
| F-25-one-link-rule-for-trade-rows.md | SIGN, on condition of changes R3-1 and R3-2 (accessible-name and spacing fixes, no re-review needed) |
| F-27-colour-follow-ups.md | SIGN, on condition of change R3-3 (widen the scan, no re-review needed) |

## Scanner and wording check

The revised files have no hits on `MARKS`, `MINORS`, `PROMO` or `LOCAL_PATH`. "Record, wins and losses →" has no
advice, signal or completeness wording, and it keeps "wins and losses" (POLICY F4).

## Checks on the round 3 changes

- **Privacy inventory (my round 2 item 1):** applied, with an AC on `lib/privacy-fields.test.ts`. Closed. I accept
  the salted-key advisory as declined, since there are no non-demo users and it is revisited if a vendor's ids are
  guessable.
- **Contrast at 14 px:**
  - The footer links inherit `.muted` (`a { color: inherit }`).
  - Light `--muted` #6b6b78 measures 5.25:1 on #fff and 5.03:1 on #fafafa.
  - Dark #8b8b98 measures 5.35:1 on surface #16161d and 5.84:1 on bg #0b0b0f.
  - All of these are ≥ 4.5:1 for 14 px text (WCAG 1.4.3). Pass.
- **Target size:**
  - The AC requires each footer link to be ≥ 44 px tall at 320, 360 and 780 px.
  - Each is wide (text of about 90 px and about 190 px), so 2.5.8 and POLICY A1 pass.
  - At 360 px the two sit side by side with about 34 px spare.
  - Nothing asserts that the hit boxes don't overlap. That matters with padded inline links, at 320 px where they
    stack and at 360 px where they sit edge to edge. See R3-2.
- **Link purpose in context (WCAG 2.4.4):**
  - "This trade →" is fine: its name carries the symbol, sign word and figure.
  - "Record, wins and losses →" is not, as written. Its only programmatic context is the card `<article>`, and an
    article is not one of the contexts 2.4.4 accepts (sentence, paragraph, list item, table cell, preceding heading).
  - The feed shows up to 30 cards, so a screen-reader links list or rotor would show 30 identical names going to 30
    different profiles.
  - This was already true of today's "See their record…", and shortening it (dropping "their") makes it weaker.
  - The arrow is also currently part of the name ("right arrow"), which the trade link avoids with `aria-hidden`.
  - See R3-1.
- **F-27 computed-style scan:**
  - Moving to e2e on card, pane, profile and trade page in both schemes is good.
  - It checks only border and stroke colour, though. Warn-coloured text or fill, the exact hue-only case F-27 exists
    to stop, would pass.
  - The CSS source test does not catch an SVG `fill`/`stroke` attribute or an inherited colour.
  - See R3-3.

## Remaining required changes

- **R3-1 (F-25, footer decision and its ACs):** the profile link's arrow is `aria-hidden` and the link carries a
  visually hidden handle after its visible text. The accessible name is "Record, wins and losses: @‹handle›", which
  starts with the visible text (WCAG 2.5.3). Add the AC: "- [ ] On a feed page with two or more traders, no two
  footer profile links share an accessible name, and each name starts with 'Record, wins and losses' (e2e
  accessibility tree)."
- **R3-2 (F-25, target AC):** append "and the two footer links' hit boxes do not overlap, with at least 8 px between
  them side by side at 360 and 780 px and stacked at 320 px (e2e bounding boxes)".
- **R3-3 (F-27, scan decision and AC):** replace "computed border or stroke colour" with "computed `color`,
  `border-*-color`, `outline-color`, `background-color`, `fill` or `stroke`", so warn-coloured text or fill outside a
  `.warn-notice` also fails.
