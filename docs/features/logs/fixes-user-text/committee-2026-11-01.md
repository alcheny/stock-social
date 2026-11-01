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

## Decisions taken after the build started (2026-11-01)

12. **"Verified" and copy trading are held only as claims** (business lead user test, revising decision 2): "verified"
    about the trader, the record, the returns or the site, and copy trading as an offer ("copy my trades"). "An
    unverified rumor" and "copy trading names were hot" publish.
13. **A small figure about this trade is talk.** A first-person figure under the big-claim threshold with a span, or one
    that names this trade or position, publishes; figures tied to the account, a system, a year or a monthly rate, dollar
    gains over a period, "turned X into Y", win-rate and accuracy claims, calls ("strong buy", "load up now") and
    the trader's own price targets (with "my", "$" or a price) are held. A single "my pick" or "best pick" is talk;
    plural, dated or free picks are held; an analyst's target is talk.
14. **The author's held line says why and what to do**, in plain words, muted: "Thesis held for review. Only you can see
    it. Held because it has ‹explanation›. Edit it to publish, or it stays held until reviewed." A report hold names no
    count. A reader is never told a note is held (every report answer reads "Reported. Thank you.").
15. **A report hold sticks** through an edit and through clearing and rewriting the note, until the owner releases it;
    reports count only after the last release (`thesis_reports_from`).
16. **Handle errors name the rule and the next step** ("That handle is taken. Try another." and the like), with the
    format rule visible under the field; the edit panel opens on an error. An active reservation answers "reserved".
17. **Handles:** reserved words are also matched with 1/l/i, 0/o and other digit-for-letter readings, plurals, "the_"
    forms and underscores removed; demo handles also with doubled letters collapsed. Concurrent renames to look-alike
    handles are serialized (advisory lock on the skeleton).
18. **The feed card's note has no byline** (the card already names the trader) and keeps F-10's two-line clamp.
19. **Stored text is kept as typed; only matching normalises** (2026-11-01, fix round 5, independent review; revises
    decision 1). The zero-width non-joiner U+200C stays in stored theses and names (Persian and Indic words need it), and
    so do emoji tag sequences (the black flag, tags, the cancel tag: the subdivision flags); a tag outside such a sequence
    is still removed. Arabic-Indic and Persian digits and the Arabic percent sign are stored as typed. Fullwidth and
    mathematical digits and the fullwidth and small percent signs are still turned into ASCII in stored text: they exist
    to imitate ASCII figures, which is D-02's spoof, so neutralising them on save protects surfaces that can't use
    `<bdi>` (titles, share images). The skeleton still removes the non-joiner and tags and reads every digit block as
    digits, so matching is unchanged. Why: the reviewer showed real names and words corrupted by the old cleanup; only the
    look-alikes carry D-02's risk.
20. **The start-up re-check holds only on rules added since a note was checked** (2026-11-01, fix round 5). Each note
    records the rules version it was checked at (`thesis_checked_version`; `MODERATION_VERSION` = 1, main's rules are
    version 0); the re-check reads only notes at an older version, matches them only against newer rules, marks them
    current, and never reads a note the owner released. The frozen HOLD and the scanner's PROMO list are read through
    exceptions (the payment-plan phrase for HOLD; single generic words such as a sector beating another or a company
    earning nothing yet for PROMO), never edited. Why: every start-up re-matched every note, so a rule change could
    re-hide notes the rules had already passed, and generic words held ordinary notes.
21. **A report made before a release counts again only after the note changes** (2026-11-01, fix round 5). After the
    owner releases a note, a reader who reported it before is answered "already" unless the author edited it after the
    release. Why: three accounts could otherwise re-hide a released note by pressing Report again.
22. **At most 3 rename holds per account** (2026-11-01, fix round 5). A rename that would give an account a fourth active
    reservation first releases its oldest one (its hold ends at once; ended reservations are purged by the tick). Why:
    repeated renames could park many handles for a year each. OD-12 (b) permanent retirement and (c) a rename limit
    remain the owner's call; this cap is neither.

## Build, QA, review

- **Build:** Engineer A (text safety, moderation, handles and names) and Engineer B (F-9) built in parallel worktrees,
  tests first; merged into the branch with concatenated schema blocks.
- **QA:** three tester rounds. Round 1: 3 blocking (release-then-edit re-counted old reports; invisible fillers
  survived; 10 of 80 ordinary theses held) plus 8 minor. Round 2: all fixed; 4 new blocking (decimals as sentence
  ends, singular "my pick", subject-dropped claims, pick word order). Round 3: all fixed; 1.6% false holds on 125 new
  ordinary theses and 30% of 50 new abuse attempts published, which drove fix round 3 (this-trade figures, DM offers,
  hype and calls, dollar claims, messenger handles, dotless domains). Each round's cases are now in
  `lib/moderation-v2.test.ts` (both directions).
- **User test at 360 px:** UX lead CHANGES (blocking: the handle error was hidden inside the collapsed "Change handle"
  panel) then SIGN; business lead CHANGES (held line, false holds on "verified" and copy trading, byline on the card)
  then SIGN.
- **Code review:** three independent passes. Fixed: an edit after a release re-counted old reports; a concurrent sync
  could undo a report hold (rows now locked); the dev sign-in could 500; clear-then-rewrite escaped a report hold; a
  link rule took polynomial time on adversarial input (now linear, with a timing test); a flaky CLI test; an empty
  published thesis after cleanup; the report rate slot spent on a lost race; "could not report" revealed hidden notes.

## Follow-ups and known limits (each marked `ponytail:` in code)

- 301 redirects from renamed handles (old links 404 for the 365-day hold).
- OD-12 (b) permanent retirement and (c) a rename limit: the owner's call. Until then one account holds at most 3 old
  handles at once (decision 22).
- Report action on profiles (POLICY U2, pre-launch); handle-led page titles (D-18).
- The review page stays off (and refused in production) until real admin identity exists; the owner CLI is the release
  path. The CLI lists 200 held notes at a time.
- The three-reporter hold means little while the dev sign-in stub makes accounts cheap.
- Report control not on `/t` rows or the chart sheet.
- Phrase rules are English only; a first-person gain under 20% with no time total publishes; spaced "@ plainword",
  spaced endings that are English words, phone digits spelt as words and a bare "name com" publish.
- Handles: other users' handles are compared with the basic skeleton only (1→l, underscores kept).
- Pre-existing items the user test saw outside this change: profile vs trade-page range rounding, the doubled brackets
  on the trade page's evidence line, the `/t` hold-time table header at 360 px.
