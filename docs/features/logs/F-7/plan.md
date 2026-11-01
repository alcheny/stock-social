# F-7 plan, round 3 (merged; for sign-off)

Date: 2026-11-01. Merged by the build session from the round-1 and round-2 documents in this folder
(`plan-round1-ux-lead.md`, `plan-round1-engineer.md`, `legal-findings.md`, `plan-round2-business-lead.md`,
`plan-round2-engineer.md`, `plan-round2-legal.md`). The build follows the engineer's round-2 plan §4
(`plan-round2-engineer.md`) **as amended below**. Where members disagreed, the rule used was: a legal condition
(L1-L12, C1-C24) wins on anything it covers, because a compliance failure sends the feature back (IMPLEMENTATION.md);
otherwise the business lead's and engineer's shared position wins over a lone position; size goes to the engineer.

## 1. Disagreements and how they were settled

| # | Point | Positions | Settled |
|---|---|---|---|
| 1 | Route and data model | UX lead: `/p/[slug]` and own tables. Engineer and business lead: a `users` row per filer, same `/u/[handle]` page | **`users` row, same page and components** (the owner's "identical"; legal (a) accepts it as structural reuse). |
| 2 | Attestation columns on filer rows | Engineer: import time and a shared `'dev'` attempt. Legal: that is a false consent record | **Legal C1:** `users.public_filer_id` marker, check `public_filer_id is null or snaptrade_user_id is null`, `adult_attested_at` = epoch sentinel, one placeholder `signup_attempts` row per source (`completed_at` null, `user_id` null), schema comment "placeholder, not an attestation". C2: every attestation, funnel, account and referral reader excludes marked rows, and no sign-in path can reach them. |
| 3 | Follow and likes | Business lead and engineer: keep (no alerts). Legal and UX lead: remove | **Removed on public-record surfaces (legal C16)**: a follow on a company insider reads as "follow their trades" (F-7 standing rule, finding 12). Viewer-only hide / Not interested stays. |
| 4 | Corrections path | Business lead: a `/how` section. Engineer, legal, UX lead: a `/public-records` page | **`/public-records` page** (C12) linked from every public profile, pane and trade page and from `/how`; `/how` also gets its short section (C24). |
| 5 | Import trigger | Business lead: script only. Engineer: a bounded stage of the hourly `/api/sync` | **Bounded stage in `/api/sync`** (+ cursor table): records must stay current like connected records ("identical"); it is ~10 lines. Off whenever the switch is off. |
| 6 | Feed embargo | Engineer: `feed_after` = filed time + 30 days. Legal C17: no ranking input from filing or import time | **`feed_after` = the closing sell's filed time + 30 days, used only as an eligibility floor, never as a score or order input.** Why: it guarantees no feed item lands within 30 days of a filing (F3b, C17 "no feed item whose timing comes from a filing"); ordering stays the documented score. Legal confirms in sign-off. |
| 7 | Demo badge on fixtures | Business lead: fixtures show "Public filing" only. Legal: Demo beside it (P2) | **Legal C11:** `public_filers.demo`; fictional filers show Demo and Public filing. e2e asserts both, and never Verified. |
| 8 | Adults | UX lead: rule-based; engineer: only filers reporting director or officer roles get a profile | **Director/officer filers only**; others skipped and counted in the run result. |
| 9 | Indexing | Legal C22: `noindex`, out of the sitemap | **Adopted.** |
| 10 | Production demand threshold | Business lead: switch-on waits for a dry run showing ≥ 100 filers with 5+ priced closes | **Recorded as an owner item** (the switch is the owner's). |
| 11 | Rate | Engineer round 1: 10/s. Legal: ≤ 5/s, one worker | **One serial worker, ≥ 250 ms between requests (≤ 4/s).** |

## 2. The decided open questions (feature file)
1. **Sources first:** company insiders' transaction reports on the securities regulator's public filing system only.
   Legislators' periodic transaction reports (amount ranges, no prices; a commercial-use limit) and large investors'
   quarterly holdings reports (no trade dates) are not built: no profiles from them.
2. **Market data:** no new vendor. Returns come only from prices in the reports (open-market buy FIFO-matched to a
   later open-market sell, same filer, same security, same holding). Every other acquisition is an unknown-cost lot;
   a sale touching one is excluded and counted by reason. Open positions show symbols only with no percent, and the
   partial TR-4 is flagged to the owner. A market-data vendor for unrealized percent and legislators' reports is the
   owner's (POLICY H).
3. **Legal limits:** the legal findings L1-L12 and conditions C1-C24 are build rules (summary in §3).
4. **Feed:** public records rank beside connected traders by the same score, eligibility (5+ closes) and TR-9 lower
   bound, losses like gains, with a "Public filing" badge and card line on every card; closed round trips only;
   30-day feed floor (§1 row 6); never in a section labeled Verified; no "New record" badge or slot; off `/t`.
5. **Launch switch:** `PUBLIC_TRADERS`. `0` off; `1` on (in production only with `PUBLIC_FILINGS_CONTACT` and
   `PUBLIC_RECORDS_CONTACT` set); unset: on outside production and in the e2e sandbox, off in production (incl.
   previews). When on only because of the sandbox, the importer reaches loopback only. e2e and node tests use
   fictional filers from a local fake (port 4103) or inserted rows; `db:seed` adds no filers.

## 3. Legal conditions carried into the build (short form; full text in plan-round2-legal.md)
C1-C2 marker, sentinel, excluded counts, no sign-in · C3 keyed to the filer id, name as filed · C4 raw keeps only
matcher fields (no addresses, signatures, remarks, footnotes) · C5 privacy maps · C6-C7 ≤ 5/s one worker, UA from env,
refuse without it, backoff · C8 logs counts only · C9 never Verified · C10 exclusions by reason on the profile ·
C11 Demo on fixtures · C12 `/public-records` · C13 operator remove (deletes profile, raw, derived; re-import never
recreates) and hide · C14 corrections log (no requester details) · C15 not-joined and non-endorsement line on every
profile, pane, trade page and share card · C16 no Follow / Like / thesis / share prompt / join CTA · C17 no
notifications; no ranking from filing time; no New-record badge · C18 no grouping insiders, off `/t`, banned words
("insider buying", "insider trading", "smart money", "signal", "copy", "follow their trades", "trade like",
completeness claims) · C19 switch · C20 insider source only · C21 free, signed-out readable · C22 noindex, out of the
sitemap · C23 fictional fixtures only · C24 `/how` section, filings can be late or amended.

## 4. Acceptance criteria
The 27 criteria of `plan-round2-engineer.md` §4.3, amended:
- **AC 13** also bans "insider trading", "trade like".
- **AC 14** asserts the Demo badge beside Public filing on fixtures, never Verified.
- **AC 28 (new, C16):** a public profile, its pane and its trade rows render no Follow button and no Like control;
  the server actions refuse a follow or like on a filer.
- **AC 29 (new, C1-C2):** a filer `users` row has `public_filer_id` set, `adult_attested_at` = epoch, no broker link
  (database check), and the funnel / attestation counts exclude it.
- **AC 30 (new, C22):** a public profile carries `robots: noindex` and is absent from `sitemap.xml`.
- **AC 31 (new, C17):** a public record never shows the "New record" badge and never fills the feed's new-record slot.
- **AC 32 (new, C4):** a stored raw row has no address, signature, remarks or footnote fields.
The final list is written into the feature file's Acceptance criteria.

## 5. Owner items (flagged, built up to the switch)
1. POLICY P3: confirm it covers traders who connect only (finding 10) or amend it, before the switch goes on.
2. Partial TR-4: open positions as symbols only until a market-data vendor is approved.
3. The two contacts (`PUBLIC_FILINGS_CONTACT` role address for the user agent, `PUBLIC_RECORDS_CONTACT` mailbox),
   the removal policy (legal default: remove on request for filers who are not elected officials), Terms and Privacy
   text covering these profiles, the production switch, and the business lead's dry-run threshold (≥ 100 filers with
   5+ priced closes).
4. Optional: a constraint change so filer rows hold null attestation fields instead of the sentinel.
5. Later sources (legislators' reports need a price vendor plus the owner's written acceptance of the commercial-use
   risk; holdings reports).

## Round 4 changes (from the sign-off round, 2026-11-01)

All four members answered REVISE (`plan-signoff-*.md`). These changes meet every demand; they override §1-§4 and
`plan-round2-engineer.md` §4 where they differ. Legal demands won where they overlapped.

1. **Top block, exact copy (UX 1, BL 3).** Three rows at 360 px; row 2 may wrap:
   1. Badges ("Public filing", plus "Demo" on fixtures) and "Company insider" (muted).
   2. "Built from public filings. This person has not joined Stock Social, has not connected a broker, has not
      reviewed this record and does not endorse it." (C15 plus finding 12.)
   3. "Record since ‹date› · last checked ‹date› · Request a correction or removal →", linking to `/public-records`.

   Then one caveat line: "Filings can be late, amended or missing." After 7 days it adds "This record may be out of
   date." AC 15 asserts this order, the link target and no horizontal scroll at 360 px.
2. **No page without a priced record (BL 2, UX 3).** The importer creates a filer's `users` row only once the filer
   has at least one priced closed round trip. Other filers stay in `public_filers` with no page and are counted in
   the run. AC 18's sentence about "No closed trades that can be priced…" is replaced: such a filer's handle 404s
   and is counted.
3. **No Like or Follow on public feed cards (UX 2, legal 4).** AC 28 also covers the feed card. On a public card
   there is no Like button, no card-menu Follow, and a double tap does nothing.
4. **Feed floor (legal 1).** §1 row 6 is confirmed with conditions:
   - `feed_after` also filters similar trades and suggest;
   - it is computed from the filed time of the closing sell's effective filing after amendments, on every rebuild;
   - crossing it is never shown, announced or logged.

   AC 21 gains the similar and suggest cases and the amendment case.
5. **Adults (legal, row 8).** Confirmed. The role comes from the filing's reporting-relationship fields. Filers who
   are only large holders, or only "other", are skipped and counted. AC 6 gains both cases.
6. **Loopback by default (legal 2).** When `PUBLIC_TRADERS` is unset (on by default outside production), the
   importer reaches loopback only. The official base URL needs an explicit `PUBLIC_TRADERS=1` and
   `PUBLIC_FILINGS_CONTACT`. AC 8 gains the case.
7. **Removal leaves suppression fields only (legal 3, C5).** `remove` deletes the `users`, raw and derived rows. It
   leaves `public_filers` with the filer id, source and `removed_at`, and clears `excluded`, `open_symbols` and
   `checked_at`. AC 23 asserts it.
8. **Dry run (BL 1, legal 5).** `scripts/public-filer.ts --dry-run` fetches and matches in memory and writes
   nothing. It needs an explicit `PUBLIC_TRADERS=1` and the contact, and uses the same worker and rate. It prints
   counts only: filers seen, filers with a priced close, filers with 5+, exclusions by reason, and skipped roles.
   New **AC 33:** against the fake, zero rows are written and no fixture name is in the output.
9. **Schema (engineer 2-4).**
   - Drop `public_filers.user_id`.
   - Add `users.public_filer_id int unique references public_filers on delete restrict`, plus the C1 check.
   - Replace the §4.1 "import time" comment with the C1 placeholder comment.
   - The placeholder attempt has `method 'dev'`, never `'brokerage'`. The importer finds or creates it, because the
     unfinished-attempt purge removes it once no filer points at it. A test runs the purge with zero filers, then
     an import.
   - `public_filer_log`: `action in ('hide','unhide','rebuild','remove')`, a `reason` code check, no `note_id`.
10. **AC 3 (engineer 5).** Drop "Theses and likes survive by `sell_id`" for filers, since filers have neither.
11. **Size (engineer 1).** The estimate is now ~820 product lines before cuts, because the stale line is required
    (C10) and is no longer a cut. Cuts, in order:
    1. the `/how` section to 15 lines (−15);
    2. the operator actions and `--dry-run` share one script and parser (−15);
    3. drop `unhide` (−10).

    Target ≤ 790. `productLines` runs before each push. If the diff is still over 800, the builder stops and
    flags it instead of cutting required items.
