# Plan v2 (round 2): D-01, D-02, D-08 + F-9 thesis safety + C9 overlap

New input since v1: the orchestrator folded the approved feature F-9 (scratchpad/F-9.md, Status ready, all acceptance
criteria must be met) and the overlapping parts of C9 (handle/name integrity: reserved list = product's own, staff
and generic terms; look-alikes vs reserved, demo and connected handles; display-name rules; a rejection that names
the rule; 365-day rename hold, 301s optional; OD-12 (b)/(c) out; no third-party names). Owner rule: every known limit
gets a `// ponytail: <limit> — <fix>` comment and a PR "Known limits" line.

## A. Text safety (lib/text-safety.ts)
- sanitizeUserText (stored, theses and display names): NFC; strip U+202A–202E, U+2066–2069, U+200E/F, U+061C, U+200B,
  U+200C, U+2060–2064, U+FEFF, U+00AD, U+180E, C0/C1 controls except \n. KEEP U+200D (emoji). Neutralise look-alike
  digits and percent signs to ASCII (fullwidth, mathematical, Arabic-Indic/extended digits; U+066A, U+FE6A, U+FF05),
  so a spoofed figure becomes a plain one and the stated-return rule sees it. Collapse spaces, trim, cut at 280 code
  points (Array.from).
- skeleton (matching only): NFKC, strip all \p{Cf} incl. ZWJ, lower-case, hand-written Cyrillic/Greek→Latin map,
  digit/percent neutralising. leet() and squash() only for word-list patterns ≥ 8 chars; never applied to numbers or
  $tickers; stated-return and URL/@ rules run on raw + skeleton only.

## B. Moderation (lib/moderation.ts)
- HOLD frozen (snapshot test untouched). HOLD_V2 {rule,label,re}[] + imported PROMO from scripts/compliance.ts
  (safe: import.meta.main guard; test asserts import has no side effects; comment: server-only).
- moderateDetail(text) → {status, rule|null}; moderate(text) unchanged signature.
- Classes: URLs/domains/email/phone (word≥2 + closed TLD list; guards BRK.B, 3.5x, v2.0, 10-K, Q3/FY25, approx.5,
  U.S., e.g., Inc.); signal selling/subscriptions; copy-trading/mirror; picks/tips/price targets; contact/messenger
  words; @contacts (not "@ 52"); product name / "verified" (any use) / "official" claim phrases; stated return % only
  as first-person or possessive claims ("I/we made|returned|gained N%", "my/our return… N%", "N% return on my
  account") or N% with time-total words (this year, YTD, per month, a week). Negative corpus includes "gapped up 9% on
  earnings", "+4% premarket", "sold half after a 12% move", "down 3% at the open", "stop 8% below entry", "sold at 2x
  ATR", non-Latin names, $XYZ, 5-day, Q3, 1.5R.
- remoderateAll(): flips published→held only (closed_trades and kept_theses), skips rows released by review; called
  from scripts/db-setup.ts after the schema; logs counts only.
- schema.sql cleanup: guarded `update … set x = regexp_replace(…) where x ~ '[…]'` on closed_trades.thesis,
  kept_theses.thesis, users.display_name.

## C. F-9 (reports, UserNote, dates, release)
- Columns (additive, closed_trades + kept_theses, re-attached by sell_id in lib/sync.ts): thesis_written_at,
  thesis_edited_at, thesis_hold_rule (label of matched rule or 'reports'), thesis_reviewed_at (set by release; an
  edit clears it). lib/privacy-fields.ts classifications.
- thesis_reports(reporter_id → users on delete cascade, trader_id → users cascade, sell_id, created_at,
  unique(reporter_id, trader_id, sell_id)). N = 3 distinct reporters (counted after thesis_reviewed_at) → held with
  rule 'reports'. Rate limit: lib/rate-limit.ts allow(), 1 report / user / minute. Signed-out can't report; owner
  can't report own. Never deletes a thesis, never touches trades. SCHEMA_MAP entry.
- app/user-note.tsx: `<bdi>` text, attribution ("Note by @handle"), "Written ‹date›, after the trade closed · edited
  ‹date›", set no larger than the figure; Report control (client island, accessible name "Report this note",
  polite live region "Reported. Thank you."). Swapped in on profile rows, trade page and /t theses now; feed card
  (app/ui.tsx) and pane after F-2 #30 merges (ponytail comment + follow-up).
- Author sees "Held for review: ‹rule label›" in muted text (not loss colour).
- scripts/review-theses.ts: list | publish <user_id> <sell_id> | keep <user_id> <sell_id>; publish sets
  published + thesis_reviewed_at; test.
- app/review/theses/page.tsx: notFound() unless REVIEW_QUEUE=1; never imports lib/session.ts; read-only list.
  ponytail: off until real admin identity.
- Thesis text and reporter ids never logged (test over logSafe); deletion cascades reporter ids (test).
- e2e: report control keyboard + live region; Tab walk + 320 px reflow on profile/trade with a note.

## D. Handles and names (lib/handles.ts, lib/auth/attempts.ts, app/auth/actions.ts)
- RESERVED exact: admin, administrator, support, help, helpdesk, moderator, mod, mods, staff, team, official,
  verified, demo, root, system, api, security, legal, press, privacy, terms, abuse, report, stocksocial,
  stock_social, the integrated vendor's name, routes (me, how, login, settings, connect, t, u, review).
  Reserved substrings: verified, official, stocksocial.
- hskel = lower, rn→m, 0→o, 1→l. Refused if hskel(h) equals hskel(any other user's handle or active reservation);
  or hskel(h minus trailing [0-9_]+) equals hskel(reserved or demo handle, also minus trailing run). Expression index
  on users. JS/SQL agreement test. Refused: stocksocial, admin, official, verified, momentum_maya1, momentum_maya_,
  rnomentum_maya. Accepted: trader_2024, maya_2024, provisional trader_*.
- Rule-naming rejection (C9): ?handle=taken|reserved|lookalike|format with copy "That handle is taken." / "That
  handle is reserved." / "That handle looks too much like another one." / "3–20 lowercase letters, numbers or _."
  (copy-only edit of the existing error line on the profile page).
- changeHandle: one transaction; reserves the old handle 365 days (HANDLE_RESERVED_DAYS) with a nullable
  handle_reservations.user_id (on delete set null → only the bare reservation stays after deletion, as C9 says); the
  same user may reclaim their own reserved old handle; 23505 → HandleTakenError. No 30-day limit (OD-12 owner).
- 301 from /u/old/** deferred (profile/trade/month routes owned by other sessions; user_id on the reservation makes
  it a lookup) — ponytail + Known limit.
- checkDisplayName in createUserForAttempt: sanitise; refuse check glyphs (✓✔☑✅🗸 and the like), "verified",
  "official", the product name, the vendor name; ≤ 2 emoji; ≤ 40 code points; ≥ 1 letter or digit.

## Deferred (follow-ups): Report on profiles (U2, F-9 out of scope), handle-led titles (D-18), feed/pane UserNote swap
after F-2 #30, 301s, OD-12 (b) retirement, turning the review queue on.

## Build split: Engineer A = sections A, B, D. Engineer B = section C (uses A's moderateDetail/sanitizeUserText).
