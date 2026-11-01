# Fix committee 2026-11-01: user text and identity safety (D-01, D-02, D-08, F-9, C9 overlap)

Branch `claude/fix-user-text-safety`. Sources: `docs/direction/design-2026-11-01.md` (D-01, D-02, D-08, P-1, P-2,
OD-12), `docs/direction/creative-2026-11-01.md` (#33, #34), `docs/features/F-9-thesis-safety.md` (approved by the
approval council, folded into this fix by the orchestrator) and the approval record's C9 (handle and name integrity,
trimmed; only its overlap with D-08 is built here). Every role was a separate subagent.

## Process

- **Round 1.** The UX lead drafted the plan. The business lead asked for 8 changes (narrow the stated-return rule,
  ship the release path now, let a trader take back their own old handle, URL guards, limit the leet and squash
  forms, a side-effect test on the PROMO import, cleanup before remoderation, count-only logs). The engineer asked for
  10 (no SQL function, no "connected-record" join, one-transaction rename, no rename-history table, guarded cleanup
  updates, keep the zero-width joiner, status re-check in code, matching order, one place for the name check).
- **Round 2.** Plan v2 folded all of them in, plus F-9 and C9. Both reviewers asked for the same blocking item: F-9
  names the feed card and the pane, so `UserNote` goes on them in this PR, not after F-2 #30. The business lead added
  "never invent a Written date"; the engineer split file ownership between the two builders and asked for a test that
  the trade share image draws only published, cleaned text. All accepted; both signed v3.

## Decisions (2026-11-01, committee's recommended option unless noted)

1. **Clean on save, match on a skeleton, hold rather than reject.** Stored theses and display names are cleaned:
   direction controls (U+202A–202E, U+2066–2069, U+200E/F, U+061C), zero-width and invisible format characters
   (U+200B, U+200C, U+2060–2064, U+FEFF, U+00AD, U+180E) and control characters are removed; look-alike digits and
   percent signs (fullwidth, mathematical, Arabic-Indic) become plain ASCII, so a spoofed figure turns into a plain one
   that the rules can see. The zero-width joiner stays (it can't reverse text and emoji need it). Matching uses a
   skeleton (NFKC, all format characters removed, lower case, a hand-written Cyrillic/Greek look-alike map). Why: D-02's
   attack needs the stored characters; stripping them protects every surface, including `<title>` and the share images
   that can't use `<bdi>`. No confusables library (POLICY H).
2. **Hold classes (D-01).** Links and domains, email and phone shapes, signal or alert selling and paid groups,
   copy-trading and mirroring, picks and tips and price targets, contact and messenger words, @contacts, the product's
   name, "verified" (any use) and "official" claims, and stated returns. The scanner's PROMO list is imported, not
   copied, so no banned phrase is spelt out in `lib/`. The frozen `HOLD` list and its snapshot test stay unchanged.
3. **Stated returns are held only as claims.** First-person or possessive return claims and percentages tied to a
   time total ("this year", "a month") are held; ordinary price talk ("gapped up 9% on earnings", "stop 8% below
   entry") publishes. Why: business lead; D-02 is about a trader claiming a return the record doesn't show.
4. **Report action is built (F-9), even though D-01 alone did not need it.** One report per signed-in user per thesis,
   one per minute, keyed by `sell_id`; 3 distinct reporters hold the thesis (F-9 open question: N = 3). A single report
   changes nothing; reports never delete a thesis or touch trades.
5. **Release path.** `scripts/review-theses.ts` (owner-run) lists held theses and publishes or keeps one. A released
   thesis is not re-held by the start-up re-check; editing it starts moderation again. The review page is built behind
   `REVIEW_QUEUE=1`, is refused in production and never reads the dev session, until real admin identity exists.
6. **`UserNote` everywhere a thesis renders in the app now**: profile rows, trade page, `/t/[symbol]`, feed card and
   pane. `<bdi>`, an attribution line, and "Written ‹date›" only when a real date was recorded: older theses show no
   date line (never back-filled).
7. **Handles (D-08, C9).** A reserved list of the product's own, staff, generic and route words (no third-party
   names); a look-alike rule (lower case, rn→m, 0→o, 1→l) checked against every other handle and active reservation,
   and, with a trailing run of digits or `_` removed, against the reserved list and the demo handles only (so
   `trader_2024` stays free). A rejection names the rule (C9): taken, reserved, looks like another handle, or format.
8. **Rename hold: 365 days**, mirroring deletion, in one transaction with the rename. The reservation carries the
   renaming account (nulled if that account is deleted, so only the bare reservation stays), so the same trader can
   take their old handle back. The brief's "short hold" was weighed: a shorter hold would let saved share images and
   links point at an impostor, so the committee kept the design council's 365 days.
9. **No 30-day rename limit.** OD-12 (b) permanent retirement and (c) one rename per 30 days are the owner's call
   (OD-12); not built.
10. **301 redirects from `/u/old/**` are deferred.** The profile, trade and month routes belong to other sessions; the
    reservation's account link makes the redirect a single lookup later. Old links 404 meanwhile (Known limit).
11. **Display names** are cleaned on save and refused with check glyphs, "verified", "official", the product's or the
    vendor's name, more than 2 emoji, over 40 characters or no letter or digit. Existing names that break the rule
    fall back to the handle at start-up (count logged, never the names).

## Follow-ups (not built here)

- Report action on profiles (POLICY U2, a pre-launch item; F-9 leaves it out).
- Handle-led page titles (D-18).
- 301s for renamed handles (decision 10).
- OD-12 (b)/(c) after the owner decides.
- Turning the review page on once real admin identity exists; the 3-reporter hold only means something after real
  auth (the dev stub makes accounts cheap).

## Build, QA, review

(Filled in as the build runs.)
