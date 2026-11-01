# F-16 · Trust and safety slice: profile report, owner digest, audited hide, takedown page

Status: ready
Start conditions: F-9 (thesis safety, which adds `lib/reports.ts`) and fix #4 (one shared visible-user predicate)
merge first.

## Why
F-9 covers reports on theses only. Profiles have no report action (POLICY U2), and there is no takedown or notice page
(U3). Nobody sees open reports, held theses or the last sync tick, and there is no fast, audited way to hide a profile
or thesis while a report is handled. Real, linkable records also invite impersonation scams. This feature builds the
business council's BC-2 remainder and BC-17 and the market council's MRC2-6. Approved by the approval council
(`docs/ideas/approval-2026-11-01-cycle2.md`, K45: second-vote mean 3.93, final vote 15/15).

## Decisions
- 2026-11-01: A signed-in user can report a profile. The report reuses F-9's `lib/reports.ts`, with a profile target
  key; there is no parallel reports table and no second queue. Categories come from a short fixed factual list that
  includes "impersonating this trader elsewhere". No category names a platform or judges skill. Why: approved by the
  approval council (cycle 2); POLICY U2, T1 (veto condition: DK, LG, CS).
- 2026-11-01: Profile reports never hide anything on their own, whatever the reporter count. F-9's N-reporter
  auto-hold stays theses-only. Only the owner-run hide script hides. Why: approved by the approval council (cycle 2).
  The red team showed N fresh accounts could otherwise take down a real record (veto condition: LG).
- 2026-11-01: Reports are rate limited per reporter, and one reporter can report one profile once. The reporter's
  identity is never shown to the reported person. The form asks for no more personal data than the report needs.
  Why: approved by the approval council (cycle 2); TS, EN, UX; POLICY P3 (veto condition: LG, CS).
- 2026-11-01: The hide is an owner-run script under `scripts/`. It hides a whole profile or a thesis, never a single
  trade or trade card (TR-1). It never deletes and is reversible. Every hide and unhide writes an audit row: item id,
  kind, reason from a fixed list, actor, time. The audit row holds no thesis text. A hide can't be used to hide a
  trader's own losses: it is owner-run and report-driven only. Why: approved by the approval council (cycle 2);
  DESIGN TR-1; POLICY F4, H, P3 (veto condition: DK, LG, CS).
- 2026-11-01: Fix #4 lands first as one shared visible-user SQL predicate. The hidden state extends it, so every public
  read skips a hidden profile. Why: approved by the approval council (cycle 2). The red team showed `deleted_at` is
  already missed on stock pages, the stock image and the sitemap; a hide would leak the same way (veto condition:
  LG).
- 2026-11-01: A hidden profile shows one neutral state, never a partial record, for example "This profile is not
  available right now." The wording never says "reported", "review" or "under review". The page has its own title,
  one h1 and `noindex`, and its share image unfurls no figures. Why: approved by the approval council (cycle 2). The
  red team showed "Hidden pending review" would publicly mark an innocent trader after a false report (UX, CS, LG,
  GR, A11Y).
- 2026-11-01: The owner digest is a script under `scripts/`, or a page behind F-9's off-by-default flag. It never uses
  the dev-stub session. It shows counts and links: open reports, held theses, the last sync tick and
  `stoppedAtDeadline`. No email is sent until the owner chooses a sender. Any later email body or subject carries no
  handle, display name, thesis text, symbol or return. Why: approved by the approval council (cycle 2); CLAUDE.md auth
  stub rule; F-9 2026-11-01; POLICY H, P3 (veto condition: DK, LG, CS).
- 2026-11-01: A takedown and notice page is added with its own title. Its wording stays draft until the owner
  approves it, before real users can reach it. It claims no safe harbor, no designated agent and no response time that
  doesn't exist. Contact is a role mailbox, never a personal address. Why: approved by the approval council (cycle 2);
  POLICY U3, P1, H (veto condition: DK, LG, CS).
- 2026-11-01: A fixed anti-impersonation line appears on profiles and the profile pane only, never on the record
  card, link preview or story images. It is literally true (it holds only while F3b bars record-based messages), names
  no platform or company, and never says or implies identity verification. The product name comes from one constant,
  as plain text. The owner approves the wording before real users reach it. It never displaces or shrinks the F3
  disclaimer. Why: approved by the approval council (cycle 2); F-4 owner card decisions; POLICY F3a, F3b, T1, T4, T5a
  (veto condition: DK, LG, CS).
- 2026-11-01: The report form has a visible label on every control. Errors name the field, use `role=alert` and take
  focus. "Sent" is announced in a `role=status` region. It follows the same entry pattern and labels as F-9's thesis
  report. Why: approved by the approval council (cycle 2); A11Y, PD, UX.
- 2026-11-01: A runbook doc covers hide and unhide, restore with deletion replay, and breach-notice steps (the 30-day
  regulator notice for 500 or more consumers and state timelines, listed as items to check, not settled law). It
  holds no secrets or personal data and never tells an agent to delete data. Why: approved by the approval council
  (cycle 2); BC-17; POLICY H (veto condition: DK, LG).
- 2026-11-01: Reports on F-7 public profiles use the same action but do not settle F-7's T2 question. Why: approved by
  the approval council (cycle 2) (LG).
- 2026-11-01: Sequencing: starts after F-9 and fix #4 merge. If F-9 has not merged by the next approval council, this
  approval lapses to that council. Why: approved by the approval council (cycle 2); EN, RT, BL, CS, MR, PF, RE, UX.

## Acceptance criteria
- [ ] A test fails on any `from closed_trades` read under `app/` or `lib/` that lacks the shared visible-user predicate
      (veto condition: LG).
- [ ] An e2e hides a demo profile with the script and finds its trades counted on none of: the feed (`/`), `/t`,
      `/t/<SYM>`, `/t/compare`, `/t/<SYM>/opengraph-image`, the profile share image and `/sitemap.xml` (veto
      condition: LG).
- [ ] A test files reports from N distinct signed-in accounts against one demo profile, and it stays public (veto
      condition: LG).
- [ ] Signed-out users can't report. A per-reporter rate limit holds, and one reporter can't report the same profile
      twice (unit and integration tests).
- [ ] Reports use F-9's `lib/reports.ts`; no second reports table exists (schema test) (veto condition: DK, CS).
- [ ] Report categories are a fixed list that includes "impersonating this trader elsewhere" and names no platform
      (unit test and compliance scanner) (veto condition: DK, LG).
- [ ] The reported person never sees the reporter's identity (test).
- [ ] The hide script hides only a whole profile or a thesis; a call for a single trade is refused (test). No code
      path deletes on hide or unhide (test) (veto condition: DK, LG, CS).
- [ ] Every hide and unhide writes an audit row (item id, kind, fixed reason, actor, time) with no thesis text, and the
      table has a `SCHEMA_MAP` entry (test) (veto condition: DK, LG).
- [ ] A hidden profile URL shows one neutral notice with no record parts, its own title, one h1 and `noindex`. The
      page text contains none of "reported", "review" or "under review" (e2e).
- [ ] The digest is a script, or its route returns 404 while F-9's flag is off. It never reads `lib/session.ts`'s dev
      session for owner rights (test) (veto condition: DK, LG, CS).
- [ ] No email is sent (no sender configured). A test over any email template finds no handle, display name, thesis
      text, symbol or return (veto condition: DK, LG).
- [ ] The takedown page has its own title, is marked draft, contains no safe-harbor or agent claim and no personal
      address, and is not reachable on a deploy that admits real users until the owner approves the wording (test on
      the launch gate) (veto condition: LG, CS).
- [ ] The anti-impersonation line renders on the profile and pane, and on no image route (e2e and image test). It
      names no platform (scanner) and the F3 disclaimer stays in view beside it at 360 px (e2e) (veto condition: DK,
      LG, CS).
- [ ] Report form: axe e2e and a keyboard-only e2e pass; errors and "sent" are announced and take focus.
- [ ] The digest page, if built, has its own title and one h1.
- [ ] The runbook exists, holds no secrets or personal data, and contains no instruction to delete data (review and
      compliance scanner).
- [ ] The PR answers COMPLIANCE §1 Q2 and Q4.
- [ ] Any limit the build leaves is marked in code with a `ponytail:` comment naming the limit and its next step, and
      the PR's hand-off note lists it.

## Out of scope
- The under-18 report category and attestation version (K18) wait for the next cycle.
- Email sending of the digest: waits for the owner to choose a sender.
- Hiding a single trade (never: TR-1).
- The anti-impersonation line on share cards, link previews or story images (F-4 owner decisions).
- F-7's T2 question and its source label: F-7's committee and the owner.
- Retiring handles forever (O-9): owner.

## Open questions
- Owner: approve the takedown page wording and the anti-impersonation line before real users reach them.
- Owner: choose an email sender, if the digest should ever be emailed.

## Rework notes
