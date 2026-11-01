# UX lead draft notes: F-25, F-26, F-27 (2026-11-01)

Scope change applied: F-20-append.md was not written; the three colour follow-ups are F-27 (orchestrator, PR #71
merged as 06edbdf).

## F-25 · One link rule for trade rows

Options for the feed card's trade link:
1. Return figure as the link (cycle-3 proposal). Rejected: `.ret` is the largest element in the middle of the card.
   A link there means the first tap of a double tap opens the page, so F-2's like gesture loses its most natural spot.
2. Card-wide link. Rejected: it takes every tap, which breaks F-2 outright.
3. Symbol to the trade page. Rejected: it breaks the symbol-to-`/t` convention the profile uses.
4. **Chosen: "See this trade →" in the footer**, before the profile link. Links are already `NOT_TAP`, so no gesture
   changes. Cost: one more footer line at 360 px, paid for by F-26 removing the 18 px empty-note line.

Rows elsewhere get two shapes, because nested links are invalid. Shape C (the figure is the link, the profile's
pattern) is for rows with other links. Shape R (the whole row is one link, named by its content plus a hidden
", open SYM trade page") is for rows with nothing else to link. On the stock page, the trades list moves from the
profile to the trade page, so it matches the notes list just above it. The profile is one tap further, via the
trade page's back link.

Found while reading: the feed deliberately keeps `sell_id` off the client ("the close's vendor id stays on the
server"), and `lib/privacy-fields.ts` calls it "never shown". Every existing trade URL already contains it. I kept
the existing route (one rule) and banned new `data-*` carriers. I limited the pane's payload to its last 5 rows and
raised a hash-based URL (`trade_key`) as an owner question. I did not block on it.

Helper is named `tradePageHref`, since `lib/paging.ts#tradeHref` already exists (it builds the profile-row anchor).

Reviewers, please test:
- BL: is losing the stock-page row's direct profile link acceptable? It is a discovery cost against consistency.
- Engineer: how to get `sell_id` for only the pane's 5 rows without a per-card query (F-10 load test). Also whether
  `records1` can add it cheaply.
- A11y: Shape R names (visible text first, hidden suffix, no aria-label) against 2.5.3/2.4.4. Check that the "✓"
  glyph inside Verified rows reads acceptably. Check that the footer's two 44 px links, wrapped, are clear.
- Everyone: footer budget at 320 px with a 280-character note. Is the F3 disclaimer still on screen 1?

## F-26 · No empty-note line

Options:
1. **Remove (chosen).** It is true for both held and none, and it matches every other surface (none of them show an
   absence line). It also frees card space.
2. Smaller muted line, "No thesis posted." at small size. Rejected: it is false for a held note.
3. Reword it, e.g. "No note" or "No note shown". Rejected: "shown" hints that something is hidden. Any absence wording
   either misstates held or leaks it.

On the trust-cue objection (XR-B): the cue that matters is that no trades are hidden, which TR-1 already guarantees.
An empty note slot hides no trade.

Held vs none: byte-identical for viewers on every surface, and enforced in the payloads too, not just in rendering.
Today `loadFeedPage` selects raw `thesis` for every card. The author sees F-9's full `heldLine(rule)` wherever there is
a note slot: their own feed card, the profile row, and the trade page (plus an edit link to the profile row via the
closes window). Surfaces without a note slot (pane rows, chart sheet, month, stock lists) show nothing for anyone.

"held 3d" collision: I kept F-9's decided wording and kept the holding-period text. The held line always starts with
"Thesis" and sits in the note slot, not the hero. I considered renaming the holding period ("3d hold"), but that
touches F-10/F-19 wording, so it is out of scope.

Reviewers, please test:
- Legal/T&S: is removal plus an author-only held line enough for U1 (held, never silently dropped)? The author is
  told on every slot.
- BL: should the author's feed card show the full reason (about 130 characters) or a short line plus a link? I chose
  the full line for F-9 consistency; it shows only on the author's own cards.
- Engineer: the trade page needs the hold rule only for the author (session read on the page, not in
  generateMetadata or the image).
- Process: three-version rule (owner Q1) for a removal.

## F-27 · Colour follow-ups

- (a) Image hues: F-20 decided "No image colour value changes", so I recommended rather than decided. The case for
  yes: one colour per meaning across share card and page, 20.1 vs 6.3 ΔE00, and 9.12/8.46:1 on the card background.
  The AC is conditional on the owner's yes, and it amends F-20's pin together with a dated owner decision. I noted the
  `ok` key (#22c55e, the Verified tone) separately.
- (b) Baseline: the lines are the bar baselines (count zero; in Timeline, where up and down months split), not
  Spread's vertical 0% line, which is already `--text`. The rule is `--control` for those two lines, and `--line`
  stays for separators. I considered `--text` and rejected it: too heavy next to the bars, and DS-2 names `--control`.
- (c) Warn: today the failed line is `class="down"`, which is loss-coloured text with no icon or box. That is worse
  than the follow-up assumed: a deutan reader sees "a loss". I decided on the warn notice (icon, box, words, text in
  `--text`) at all four sites, with `--warn` restricted to that notice. F-20's colour-blind test gets a named
  exemption tied to a usage test, not a lowered floor. `--warn` does not exist on main yet (F-20 adds it), so F-27
  blocks on F-20.

Reviewers, please test:
- A11y: is a 1 px `--warn` border enough of a "box", or should the box also have a tint (needs `--warn-bg` from F-20
  and its text pair)? Is the icon distinct from any loss mark?
- Engineer: is a source test that `var(--warn)` appears only in warn-notice rules practical once F-20 lands?
- Legal: the owner-question wording for (a) stays a recommendation, not a decision.
