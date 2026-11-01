# F-7 plan, round 1: UX lead

Scope: public-trader profiles built from public filings, rendered with the existing profile components; their
closes in the feed, the pane, `/t/[symbol]` and the share card under their own source label; `/how`; a new
`/public-records` page (what these profiles are, how to ask for a correction or removal). No code in this round.
No new vendor or dependency. Real filers stay behind a launch switch that is off in production.

## 1. Recommended option for every open question
1. **Sources first: company insiders' transaction reports only.** They carry transaction date, share count, price
   per share and transaction type, so a percent return can be computed from the reports alone. Legislators'
   periodic transaction reports (dates and amount ranges, no prices) and large investors' quarterly holdings
   reports (holdings, no trade dates) cannot give an honest per-trade return without outside prices: **not
   built, no profile created** (an empty or estimated profile would mislead). Recorded as follow-ups in the
   feature file.
2. **Returns that need market prices wait.** No market-data vendor is added (POLICY H, owner's call). The insider
   source needs none. Consequence for TR-4: open positions on a public profile are listed by symbol, without an
   unrealized percent (section 4; owner item O2).
3. **Legal limits:** the legal member's findings govern. UX assumptions until then: (a) only the insider source is
   read, and only at the filing system's published fair-access rate, with a declared user-agent contact (owner
   supplies, O4); (b) legislative reports are not read at all, so their commercial-use limit is never touched;
   (c) every public profile says in plain view that it is built from public filings and that the person has not
   joined; (d) a corrections and removal path exists before the switch can be turned on (O3).
4. **Feed: yes, in the same ranking, labeled.** Public records enter the feed under the same eligibility (5+ closes)
   and the same TR-9 lower-bound ranking with |return|, so losses rank like gains: comparing on equal terms is the
   owner's reason for F-7. Each card carries the **Public filing** badge instead of Verified. Only closed round
   trips appear (a matched buy and sell); a lone buy or sell is never a card, so the feed never announces "an
   insider just bought" (F3b: looked up, not broadcast). No section, filter or sort that groups insiders.
5. **Launch switch:** `PUBLIC_TRADERS` env, read in one module (`lib/public-traders.ts#enabled()`): off unless set
   to `1`; the build sets it on in dev, test, CI and the demo seed. Off means: no public profile renders (404), no
   public close in the feed, pane, `/t` or sitemap, and the importer does not run. e2e and the demo seed use
   fictional filers ("Fictional Filer One") and fictional symbols (`ZQXA`, `ZQXB`) only, with source `'fixture'`
   rows that also carry the Demo badge beside Public filing (P2). Turning it on in production is the owner's.

## 2. What counts as a trade (honest or excluded and counted)
- Only open-market purchases and open-market sales of common stock, by the same filer, in the same security,
  matched first in, first out across that filer's reports. Direct and each indirect holding are matched separately
  (like accounts).
- Every other acquisition (grants, awards, option exercises, gifts, inheritance, conversions) enters the FIFO queue
  as a **lot of unknown cost**, in date order, as do the shares the filer already held before the first report we
  read (from "shares owned after the transaction" on that report). A sell that consumes any unknown-cost share is
  **excluded and counted**, never split or estimated. This is why most insider sells are excluded.
- Derivative transactions, amended reports that contradict an earlier one, and holdings that don't reconcile with
  the running total (a likely split or other corporate action, F3c) exclude every later sell in that security for
  that filer, counted. An amendment that replaces a report is applied and the record rebuilt (raw in, derived out).
- Return = sell price / matched average buy price − 1. Reports carry no fees: `/how` says returns are before fees.
- Stored like broker data: raw filing rows (with prices and share counts, private, never rendered) → the same
  `matchTrades` → `closed_trades` (percent only). Per-trade link: the filing URL of the closing sell (and of the
  matched buy on the trade page).

## 3. Screen flow at 360 px
Route: **`/p/[slug]`**, not `/u/[handle]`. Reason: `users` requires an 18+ attestation the filer never gave, the dev
auth stub signs in to any existing handle (anyone could "be" a filer), and handles are user-chosen (U2 impersonation).
Same components: headline grid, range, evidence line, secondary stats, `PerformanceChart`, closes list, trade page.

**Profile top (above the headline):**
```
Fictional Filer One                       (h1, name as reported)
[Public filing]  Company insider · ZQXA   (badge + kind line, muted)
Built from public filings. This person has not joined Stock Social.
Record since Mar 4, 2021 · last checked Nov 1, 2026. Only trades
reported and priced in public filings are shown.
Is this you, or is something wrong? Request a correction or removal →
```
Then the headline grid (win rate, avg return / trade, 95% range), evidence line, secondary stats, chart, exactly
as `/u`. Then:
- **Excluded line** (always shown when > 0, same style as excluded positions): "41 sells excluded: no priced
  open-market purchase before them in the filings (for example shares received as pay)." and, when > 0, "3 sells
  excluded: holdings didn't reconcile, possibly a stock split."
- **Open positions** (TR-4, section 4).
- **Closed trades** list: same rows; the percent links to the trade page; each row adds a small "Filing ↗" link
  (opens the public filing, `rel="noopener"`, accessible name "Public filing for ZQXA sell on Mar 4, 2024, opens
  the filing system's site").
- **No** Follow button, thesis forms, share prompt, join CTA or "Similar trades" seed from this profile (theses:
  filers can't post; follow: avoids "follow this insider" reading as a cue to act, O5). The profile can still
  appear inside other traders' "Similar trades" with its badge.

**Trade page** (`/p/[slug]/trade/[sell]`): same layout; "Bought: filing ↗ · Sold: filing ↗"; no thesis block.
**Feed card:** header name + **Public filing** badge; hero unchanged; the thesis line becomes "Company insider ·
from a public filing" (muted); footer link "See their record, wins and losses →" to `/p/[slug]`.
**Feed pane (SW-1):** name, Public filing badge, the "has not joined" line, headline stats, open-positions line,
chart, last 5 closes, "See full profile →". Gestures and keys unchanged.
**`/t/[symbol]`:** public closes appear in the rows like any trader's, with the badge; no line, count or aggregate
about insiders as a group (F3b: no security-level signal).
**Share card / unfurl:** label "Public filing" where Verified would be; description "Built from public filings ·
58% win rate · +1.3% avg return · Evidence: thin". No share prompt (nobody owns it), but the system share sheet
and Copy link work as on any profile.
**`/public-records`** (linked from every public profile and `/how`): what these profiles are, which source, what is
excluded, that the person did not join, and the contact to request a correction or removal (owner-supplied
address, O3), with the promise only of a reply, not of an outcome.

## 4. States
| State | Behaviour |
|---|---|
| Switch off | `/p/*` 404s; feed, pane, `/t`, sitemap carry no public record; `/public-records` still explains (no names) |
| Filer with closes | As above |
| Filer with no priced round trip | Profile renders the top block, "No closed trades that can be priced from the filings yet.", the excluded counts and open positions; not in the feed |
| All losses | Same layout; losses in the down color with "−"; ranks like gains |
| New record | "New record" badge by TR-7's thresholds, as `/u` |
| Open positions | "Open positions (shares bought in open-market purchases and not yet sold): ZQXA. Unrealized results need current prices, which these filings don't give." No percent, no combined line, no unrealized grid |
| Removed on request | Profile 404s, its closes leave every surface on the next rebuild; a suppression row stops re-import |
| Importer failed / stale | "last checked ‹date›" shows the age; older than 7 days adds "This record may be out of date." |
| Signed out | Identical (shared links land here) |
| Fixture / demo | Demo badge beside Public filing; fictional names and symbols |

## 5. Copy (new `PUBLIC` block in `lib/copy.ts`, run through `lib/copy.test.ts` banned claims)
- badge: "Public filing"; badge title: "Built from public filings, not from a broker connection. Not Verified."
- kind: "Company insider" (the only kind built). notJoined: "Built from public filings. This person has not
  joined Stock Social."
- since: "Record since ‹date› · last checked ‹date›. Only trades reported and priced in public filings are shown."
- correction: "Is this you, or is something wrong? Request a correction or removal →"
- excludedUnpriced(n), excludedUnreconciled(n): as in section 3, pluralized via `counted()`.
- openNoPrice: as in section 4. stale: "This record may be out of date."
- filingLink: "Filing ↗"; cardLine: "Company insider · from a public filing".
- `/how` adds a section "Public filing records": source; open-market purchases and sales only; FIFO per holding;
  unknown-cost lots and why most sells are excluded; returns before fees; no current prices, so open positions
  carry no percent; "Public filing" is not Verified and does not verify identity or completeness.
- Footer unchanged (disclaimer on every page); it gains nothing. Never: "insider buying", "copy", "follow their
  trades", "smart money", "signal", "all of their trades".

## 6. Data (for the engineer to refine)
- `public_filers(id, slug unique, display_name, kind check (kind = 'insider'), filer_key unique, issuer_symbol,
  checked_at, excluded_unpriced, excluded_unreconciled, removed_at)`; `filing_rows(id, filer_id, accession, url,
  line, symbol, holding, code, shares, price, executed_at, owned_after, raw, unique(accession, line))`, private.
- Closed trades: either `closed_trades.user_id` stays for brokers and public closes go to a sibling
  `public_closed_trades` (same columns + `buy_url`, `sell_url`), or one table with a nullable `filer_id`; the
  engineer picks, but the record kind must come from data (`'broker' | 'demo' | 'public'`), and `paneTrust` /
  `cardTrust` / `rowBadge` return `'public'` for it, never `'verified'`. Additive schema only.
- Importer: `lib/filings.ts` is the only file that fetches the filing system (vendor isolation pattern); fair-access
  rate limit and user-agent contact from env; never logs names with raw payloads.

## 7. Draft acceptance criteria (each with its test)
1. A public profile never shows "Verified" or the verified badge anywhere (profile, pane, card, `/t`, trade page,
   share image alt, unfurl text); it shows "Public filing". Unit on trust functions; e2e text and DOM assertions.
2. The top block shows the not-joined line, "Record since … last checked …", and a correction link that reaches
   `/public-records` with the contact. e2e at 360 px.
3. Every closed trade row and trade page links its public filing(s). e2e: each row has a `Filing` link whose href
   is the fixture filing URL.
4. No amount, share count or price appears in any rendered HTML, image alt or unfurl for public records. e2e scans
   the page HTML for the fixture's prices and share counts; unit on the derived rows (percent fields only).
5. FIFO rules (unit, `lib/filings.test.ts`): open-market buy then sell → return; sell after a grant only →
   excluded and counted; sell consuming pre-existing holdings → excluded; partial unknown-cost consumption →
   whole sell excluded; holdings that don't reconcile → later sells excluded; amendment rebuilds; direct and
   indirect matched separately; hand-computed return.
6. Excluded counts show on the profile whenever > 0, with the words in section 3. e2e.
7. Feed: an eligible public filer's close appears in the ranked feed with the Public filing badge, ordered by the
   same TR-9 lower bound (unit pins the order of a mixed connected + public set); a lone buy never appears.
8. Losses: an all-losing fixture filer shows losses in the down color with "−" and ranks like equal gains. unit+e2e.
9. Open positions list symbols with the no-price sentence and no percent. e2e.
10. Switch off: `/p/<slug>` 404s and the feed, `/t`, sitemap contain no public record (e2e with the env unset on a
    second server, or a unit on `enabled()` plus route guards).
11. Removal: marking a filer removed 404s the profile and drops its closes from every surface; re-import skips it.
12. Fixtures and seed use only fictional names and symbols; `scripts/compliance.ts` passes on the tree.
13. Disclaimer in the footer of every page visited; axe passes; no horizontal scroll at 360 px; every link and
    control 44 px tall; filing links say they open another site; color never alone.
14. Signed out sees identical content (e2e without cookie); `lib/feed.signed-out.test.ts` gains a case.

## 8. COMPLIANCE Section 1
1. Performance: yes → §2. Footer disclaimer; same ranking with losses like gains; "Public filing" never Verified;
   no advice, no insider-group signal, no lone-trade cards.
2. Personal data: yes, real people's names and trades from public filings, without their consent → §3. Minimum
   stored (name as filed, filer key, filing rows); percent only shown; removal path; switch off in production;
   names never in the repository (fictional fixtures). Owner item O1.
3. Money: none shown. 4. Comms/tracking: none; nothing pushed. 5. User text: none (no theses).
6. Accounts/age: filers are not accounts; no attestation is invented (hence `/p`, not `users`).
7. Vendor: the filing system is a new data source, read without a key or dependency; isolated in one file. O4.
8. Accessibility: section 7 item 13. 9. Security: one outbound fetcher, rate-limited; no new public endpoint
   beyond pages. 10. Claims: "Only trades reported and priced in public filings are shown"; no completeness claim.
11. Checkout: none.

## 9. Owner items (the build can proceed behind the switch; turning it on waits for these)
- **O1. POLICY P3 conflict.** P3 says public display of "a trader's record requires that trader's explicit consent
  at connect time". This plan reads P3 as covering traders who connect, per the brief, but the text does not say
  so. Only the owner can amend or interpret P3; until then the switch stays off in production.
- **O2. TR-4 partial:** open positions without unrealized percent until a price source is approved.
- **O3. Contact:** a working address for corrections and removal (P6); the switch can't turn on without it.
- **O4. Filing system access:** the user-agent contact it requires, and the legal member's findings on fair access.
- **O5. Departures from "identical":** route `/p`, no Follow button, no theses, no share prompt; reasons above.
- Follow-ups (not built): legislators' and large investors' reports, once a price source is the owner's call.
