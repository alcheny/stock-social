# F-9 · Thesis safety: normalised moderation, report action and a release path

Status: built

## Why
Theses are the only free text the public reads beside a Verified record. Today the moderation regex list lets links,
contact handles, solicitations, look-alike spellings and direction-control characters through. A held thesis can't be
released, so in practice "held" means silently dropped (POLICY U1). There is also no report action (POLICY U2), and
the go-to-market decision (idea 13) lists one as a week-0 prerequisite. Source: design direction council P-1 and
creative direction council CR-34..CR-36, approved by the approval council
(`docs/ideas/approval-2026-11-01.md`, C8: second-vote mean 4.20, final vote 15/15).

## Decisions
- 2026-11-01: Normalise every thesis before matching: NFKC, strip zero-width, format and direction-control characters
  (U+202A–202E, U+2066–2069, U+200E/F), then check against a hand-written confusables map. Why: approved by the
  approval council; the design council found bidi and look-alike bypasses (D-01, D-02). No new dependency (POLICY C2, H).
- 2026-11-01: Hold, never drop: links and domains, contact or messenger words and @contacts, solicitations to buy or
  copy trades, claims that name the product, "verified" or "official", and stated return percentages. Patterns that
  would need a phrase the compliance scanner bans are left out unless the owner adds a scanner exception. Why:
  approved by the approval council; POLICY U1, F1, H; DECISIONS 2026-10-12 (rules plus a review queue, no LLM).
- 2026-11-01: Every thesis renders through one `UserNote` component with an attribution line, `<bdi>` and a written
  date ("Written ‹date›, after the trade closed · edited ‹date›"), stored as additive `thesis_written_at` and
  `thesis_edited_at` columns re-attached by `sell_id`. Why: approved by the approval council; theses read as platform
  copy and after-the-fact notes read as pre-trade reasoning (D-33, D-49).
- 2026-11-01: A signed-in user can report a thesis once, rate-limited. Reports are keyed by `sell_id`. A thesis is
  auto-held only after N distinct signed-in reporters, and a single report changes nothing. Reports and holds only
  hold or release, never delete, and never touch trades (TR-1). Why: approved by the approval council; POLICY U2.
  The red team showed how brigading could abuse a single-report hold.
- 2026-11-01: An owner-run release path (a script under `scripts/`) ships in the same PR as auto-hold, so any held
  thesis can be published or kept held. The review-queue page is built behind a flag that is off by default until
  real admin identity exists; it never uses the dev-stub session. Why: approved by the approval council; U1 forbids
  held meaning silently dropped (legal's veto condition); CLAUDE.md forbids building on the auth stub.
- 2026-11-01: The author sees "Held for review" and the rule that matched, in neutral tone (never the loss colour).
  Why: approved by the approval council; U1 "never silently".
- 2026-11-01: Report actions on profiles (U2) and on F-7 public profiles are out of this feature. F-7 profiles have no
  theses. Why: approved by the approval council (the decisions keeper's F-7 interface condition).
- 2026-11-01: Built inside the user-text safety fix (D-01, D-02, D-08; branch `claude/fix-user-text-safety`), as the
  orchestrator folded it in. N = 3 distinct signed-in reporters, one report per reader per minute (the shared database
  limiter), counted only after the last owner release. Why: the council's suggestion, kept by the fix committee
  (`docs/features/logs/fixes-user-text/committee-2026-11-01.md`).
- 2026-11-01: "verified" in a thesis is held only as a claim about the trader, the record or the site, and copy trading
  only as an offer; ordinary words ("an unverified rumor", "copy trading names were hot") publish. Why: the business
  lead's user test found those false holds; the fix committee accepted it.
- 2026-11-01: The feed card's note has no "Note by @handle" line (the card's header already names the trader); every
  other surface keeps it. Why: business lead user test.
- 2026-11-02: The owner accepted OD 2.20: the owner takes the held-thesis release duty with
  `scripts/review-theses.ts`, daily during Beta, until admin identity exists. Each admin read is logged (OD 2.53;
  fixes-list item F6-12). Why: the owner's decisions of 2026-11-02 (accepted en bloc).

## Acceptance criteria
- [x] Every entry of a bypass corpus in `lib/moderation.test.ts` (built as the new file `lib/moderation-v2.test.ts`, so
      the frozen HOLD snapshot stays untouched) returns `held`: zero-width characters inside a word, a
      Cyrillic look-alike spelling, a direction-override spoof, a URL, a contact handle and a solicitation, each
      paraphrased with no scanner-banned phrase.
- [x] A negative corpus of ordinary theses returns `published` with zero false holds. It covers stop-loss levels,
      earnings notes, "sold at 2x ATR", a plain reflection on selling early and theses containing non-Latin names.
- [x] Saved thesis text contains no U+202A–202E, U+2066–2069 or U+200E/F characters (unit test).
- [x] The profile row, feed card, pane and `/t/[symbol]` render every thesis through the same `UserNote` markup, with
      `<bdi>` and the attribution label (component test). A `UserNote` is never set larger than the verified figure
      on the same surface.
- [x] `thesis_written_at` and `thesis_edited_at` survive `rebuildTrades` (integration test) and show on public views.
- [x] Signed-out users can't report. One signed-in report doesn't change `thesis_status`; N distinct signed-in
      reporters do; one user can't report the same thesis twice; reports are rate-limited (unit and integration tests).
- [x] Reports and holds survive `rebuildTrades` because they are keyed by `sell_id` (integration test).
- [x] No code path deletes a thesis on report, hold or release (test). The owner-run release script can publish any
      held thesis (test), and it ships in the same PR as auto-hold.
- [x] The review-queue route returns 404 while its flag is off (default) and never reads `lib/session.ts`'s dev
      session for admin rights.
- [x] The author sees "Held for review" and the matched rule as text, not by colour alone. The report control has an
      accessible name, works from the keyboard and confirms in a polite live region (e2e).
- [x] Thesis text and reporter ids never appear in logs (test over the logger), and a profile deletion removes that
      user's reporter ids. Removing reports never publishes a thesis: one already auto-held stays held until it is released
      through the release path, and the deleted user's reports stop counting toward N for later holds (test).
- [x] `db/schema.sql` changes are additive and idempotent, with no drop, truncate or delete from.
- [x] No new dependency (package.json unchanged), and `node scripts/compliance.ts tree` passes.
- [x] The touched surfaces pass a Tab walk and the 320 px / 400% reflow check (POLICY A1).

## Out of scope
- A report action on profiles, handle and name integrity (C9, next cycle), and an LLM classifier.
- Any scanner exception (owner only, creative council Q15).
- Turning the review-queue page on (waits for real admin identity).

## Open questions
- (Resolved 2026-11-01) N = 3 and one report per reader per minute; the confusables map is hand-written (no Unicode data
  files). See Decisions.

## Rework notes
