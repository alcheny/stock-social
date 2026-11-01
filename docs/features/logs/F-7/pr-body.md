F-7 · Public traders: profiles built from publicly available trading records (docs/features/F-7-public-traders.md).

## What changes
- **Source:** company insiders' transaction reports on the securities regulator's public filing system. The importer
  is `lib/public-filings.ts`, the only file that fetches the source. It uses fetch only, with no new dependency. It
  sends a User-Agent from a deploy setting and refuses to run without one. It runs one worker at most 4 requests a
  second, backs off on refusals, caps body size and logs counts only. It runs as a bounded stage of the hourly
  `/api/sync`. A local fake (`e2e/fakes/public-filings.ts`) means CI never calls the internet.
- **Matching:** `lib/public-trades.ts` matches open-market purchases to later open-market sales first in, first out,
  using the unchanged `matchTrades`, and returns percent only. Every other case is excluded and counted by reason:
  - shares of unknown cost (grants, exercises, gifts, earlier holdings);
  - holdings that don't reconcile;
  - derivative rows;
  - indirectly held rows.

  Amendments replace what they amend. Raw rows (`public_transactions`) are immutable, and derived `closed_trades`
  rows are rebuilt with `verified = false` and the filing link.
- **Same profile:** each filer with at least one priced close gets a `users` row marked `public_filer_id` and the same
  `/u/[handle]` profile, chart, stats, range, pane, feed card and share card. These surfaces differ from a broker
  record:
  - a "Public filing" badge, never Verified, with Demo beside it on fictional fixtures;
  - a "Filing ↗" link per trade;
  - "Built from public filings. This person has not joined Stock Social, has not connected a broker, has not reviewed
    this record and does not endorse it." with a correction-or-removal link;
  - exclusions listed by reason;
  - open positions as symbols only;
  - no Follow, Like, thesis, share prompt or join button;
  - `noindex`, and not in the sitemap.
- **Feed:** public records rank beside connected traders with the same score, eligibility and lower bound, and losses
  rank like gains. Nothing from a filing reaches the feed, similar or suggest until 30 days after the latest filing
  behind the trade. Public records get no New-record badge, stay off stock pages and can't be added to paid record
  tools.
- **No consent fiction:** filer rows hold an epoch placeholder in the required attestation column. Every count
  excludes them, and no sign-in path can create a session for one (`lib/auth/sessions.ts`).
- **Corrections and removal:** `/public-records` shows the contact from a deploy setting. The operator script
  `scripts/public-filer.ts` covers hide, unhide, remove and a counts-only `--dry-run`; removal blocks re-import. A
  corrections log keeps no requester details. `/how` gains a "Public filing records" section.
- **Switch `PUBLIC_TRADERS`:**
  - `0` is off.
  - `1` is on; in production it needs both contacts set.
  - Unset, it is on outside production and in the e2e sandbox (importer reaches loopback only), and off in production.

## Decisions taken by the committee
Recorded in `docs/features/logs/F-7/committee-2026-11-01.md` and appended to the feature file. The committee was the UX
lead, business lead, engineer and legal-and-compliance member, and took five plan rounds. The UX lead, business lead
and legal member sent the plan back once each; their changes were adopted and all four signed.
1. Insider reports only. Legislators' periodic transaction reports and quarterly holdings reports are not fetched,
   parsed or stored.
2. No market-data vendor. Anything that can't be priced from the reports is excluded and counted.
3. Same `users` row and same page, not a separate route.
4. Never Verified, with its own label and a filing link per trade.
5. No consent fiction (epoch placeholder, excluded from counts, no sign-in). Directors and officers only.
6. No Follow or Like.
7. Same feed ranking, with a 30-day feed floor.
8. Launch switch.
9. Corrections and removal.
10. Importer rules from the filing system's fair-access rules.

Fix round 1 (decisions 11-14):
11. AC 15 aligned with the signed plan.
12. The feed pane may show closes inside the floor, since the viewer opened that filer.
13. Labeled share-image alt text, a `/public-records` description, and "Closed trades this month".
14. Older rounding and tap-size items left for a later fix.

Fix round 3, orchestrator review (decisions 15-21):
15. Holdings not given as a share count are unknown, so those sales are excluded and counted as unreconciled.
16. Real filers show in production only once the launch gate is open. The sandbox's fictional filers are unchanged.
17. Hiding a filer's trade from your own feed is allowed. `/me/hidden` labels it "Public filing", never just Demo.
18. A filer's trade and month pages are noindex.
19. An advisory lock allows one import run at a time; a run that finds it held skips the tick.
20. The day cursor re-lists the whole day and skips filings already read, so an entry listed late is not lost.
21. A filer's pane, chart and story picture are sent `no-store`.

The label stays "Public filing" rather than the design system council's "Public source". The legal conditions name it
verbatim; the reason is recorded in the committee record.

## Testing
Run on the merged head (origin/main merged in):
- `npx tsc --noEmit`: clean.
- `npm test`, twice: 1048 tests, 1031 pass, 0 fail, the rest skipped or todo, both runs.
- New tests:
  - node: `lib/f7-public-{gate,filings,trades,import}.test.ts`, `lib/f7-{trust,feed,routes}.test.ts`;
  - e2e: `e2e/f7-public-{profile,feed,records}.spec.ts`.
- `BASE_REF=main node scripts/compliance.ts auto`: `compliance: ok (tree)`.
- `node scripts/autopilot.ts guard origin/main`: `guard: ok`.
- `npm run build`: ok.
- Full `npx playwright test` on a fresh seeded database: 191 passed, 6 skipped, 0 failed.
- Product lines (`productLines`): 798 of the 800 cap.
- **Independent review** (`review.md`): no blocking findings; the six verified non-blocking items were fixed, each
  with a test.
- **Tester and user tests** at 360 px, signed out and signed in (`test-tester.md`, `committee-business-lead.md`,
  `committee-ux-lead.md`, `screenshots/`): their blocking items were fixed in fix round 2. These passes were run by one
  session playing the three roles, and each report says so.

## Compliance
COMPLIANCE.md Section 1:
1. **Performance shown?** Yes, Section 2 applies.
   - The footer disclaimer is on every page.
   - Losses rank and show like gains.
   - The evidence label and range are the same as for connected records.
   - No advice, signal, "copy" or "follow their trades" wording. The copy test bans "insider buying", "insider
     trading", "smart money", "signal", "copy", "trade like" and completeness claims.
   - No alerts or feed items timed to filings (30-day floor, no New-record treatment, POLICY F3b).
   - Nothing groups insiders by security, and public records stay off stock pages.
2. **Personal data?** Yes, Section 3 applies.
   - Real people's names come only from public filings imported at runtime. Fixtures, tests, logs and this PR use
     fictional filers only (T1/T2).
   - Raw rows keep only matcher fields: no addresses, signatures, remarks, footnotes or indirect-holding labels.
   - The four new tables and two new columns are in `lib/privacy-retention.ts` and `lib/privacy-fields.ts`.
   - Removal deletes the profile, raw and derived rows.
   - The P3 consent reading is an owner item (below).
3. **Money, amounts, prices, quantities?** None shown. Percent only, even though the filings carry prices and share
   counts; the e2e scans HTML, alt text and meta for the fixtures' numbers. Public records can't be added to paid
   record tools.
4. **Messaging, notifications, tracking?** None. No message in any channel comes from a filing.
5. **User-generated text?** None. Filers have no theses.
6. **Accounts or age?** Filer rows are not accounts. The attestation column holds a placeholder, not an attestation.
   Every count excludes these rows, and a database check plus the session guard stop sign-in. Directors and officers
   only.
7. **New vendor, dependency or asset?** No dependency (`package.json` unchanged). The public filing system is a new
   data source, built up to the switch; switching it on is the owner's (below).
8. **Accessibility:**
   - 44 px filing links with names saying they open another site;
   - text beside every color;
   - no horizontal scroll at 360 px, including a 40-character name.

   No axe check: it needs a new dependency.
9. **Security:** fetch only, to the configured base, with `redirect: 'error'`. Filing links must share the base's
   origin, bodies are capped and the parser is linear. Filers are refused by `createSession`.
10. **Claims:** "Public filing" is never "Verified"; no completeness claim ("Filings can be late, amended or missing").
11. **Checkout or payments?** None.

**Owner items, built up to the switch and flagged:**
- POLICY P3: confirm it covers only traders who connect, or amend it, before real filers are shown.
- Partial TR-4: open positions show no percent until a market-data vendor is approved.
- The two contacts, `PUBLIC_FILINGS_CONTACT` (a role address) and `PUBLIC_RECORDS_CONTACT`.
- The removal policy. The legal default is to remove on request any filer who is not an elected official.
- Terms and Privacy text covering these profiles.
- The production switch and `PUBLIC_FILINGS_BASE_URL`.
- Whether real filers may show while the launch gate is closed. Built closed: in production they need `LAUNCH_OPEN=1`.
- The business lead's dry-run threshold: at least 100 filers with 5+ priced closes.
- Optionally, nulls instead of the attestation placeholder.
- Legislators' reports need a price vendor and the owner's written acceptance of the statutory commercial-use risk.

## Known limits
Each has a `ponytail:` note in the code.
- **Daily index format:** the index path and shape are a generic design served by the fake. The importer must be
  mapped to the real filing system's published index before the switch goes on (`lib/public-filings.ts`).
- **Other sources:** legislators' periodic transaction reports and quarterly holdings reports are not sources. They
  need a market-data vendor and, for legislators, the owner's ruling (`db/schema.sql`).
- **Open positions** carry no percent (`db/schema.sql`).
- **Attestation placeholder:** filer rows hold an epoch sentinel until an owner-approved constraint change (`db/schema.sql`).
- **No backfill:** a source with no cursor starts today; the dry run's day reads history (`lib/public-import.ts`).
- **Several reporting owners:** filings with more than one are skipped and counted (`lib/public-import.ts`).
- **Failed stores:** a filing that fails to store is passed over until a re-read (`lib/public-import.ts`).
- **Emptied records:** a filer left with no priced close keeps its handle reserved, and the page 404s (`lib/public-trades.ts`).
- **Taken handles:** if both candidate handles are taken, that filing fails on every read (`lib/public-trades.ts`).
- **Purchase links:** the trade page links purchase filings on the opening date only (`lib/trade-share-load.ts`).

Not marked in the code:
- No allow-list of the official host, because the policy keeps the agency's host out of the repo. The owner sets
  `PUBLIC_FILINGS_BASE_URL`.
- Existing pre-F-7 handles starting with `pf_` can't use the dev login.
- No axe check (dependency).

Committee record: `docs/features/logs/F-7/` (plan rounds 1-5, sign-offs, `legal-findings.md`, `committee-2026-11-01.md`,
`review.md`, `test-tester.md`, `committee-business-lead.md`, `committee-ux-lead.md`, `screenshots/`).

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01Cdty8nrwnJxfiGsQ3o7dq4
