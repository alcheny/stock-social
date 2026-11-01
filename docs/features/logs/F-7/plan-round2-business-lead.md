# F-7 plan, round 2: business lead

**Verdict: REVISE (demands 1-16 below).** The engineer's architecture wins: one `users` row per published filer,
the same `/u/[handle]` page, feed, follows, likes and share card, and a new `'public'` record state. The UX lead's
`/p/[slug]` route and separate tables are rejected. The plan must fit **one PR** (the build ships one), so the
engineer's three-PR split is replaced by the cuts in section 3. All names here are fictional (POLICY T1/T2).

**Demo sentence:** "This trader never signed up. Their record comes from public filings, with every loss, a link to
each filing, and the same stats as a trader who connected a broker."

## 1. Architecture: `/u` with a `users` row, not `/p`

The owner's word is **identical**. Measured against it:

| Question | `/p/[slug]` + own tables (UX) | `users` row + `'public'` state (engineer) |
|---|---|---|
| Identical to broker profiles | No. A second page has to be kept in step with `/u` for ever, so the two drift | Yes, by construction: one page, one set of components |
| Viewer value (compare on equal terms) | Follow dropped. Likes, feed and similar trades re-plumbed | Follow, likes, feed, pane, similar trades and the share card all work unchanged |
| Cost | Duplicates everything keyed on `users.id`, well over 400 lines | About 55 lines of state and trust branches, plus the importer |
| Risk of a wrong label | Lower: new code paths | Higher: `verified=false` means Demo today. Handled by demand 4 |
| Attestation / sign-in | Avoided | Needs a guard (dev login) and an honest marker (demand 3) |

The UX lead's "departures" mostly cost nothing under `/u`. The share prompt, thesis forms, connect CTA, settings and
referral blocks are all `isMe`-gated (`app/u/[handle]/page.tsx:142-221`), and nobody can be a filer once the login
guard is in. So they are absent without any new branch. The only real choice is **Follow**, and it stays:
- follows only reorder the viewer's own feed and fill `/me/following`; no email or push reads them (only auth
  mails exist), so F3b and L8 hold;
- dropping it would break "identical" for no compliance gain.

Its label stays the generic "Follow". No new follow copy.

## 2. Open questions, decided

1. **Sources first: company insiders' transaction reports only.**
   - Legislators' periodic reports carry no prices, and there is a statutory commercial-use bar (legal findings 2-3).
   - Large investors' quarterly holdings reports have no trade dates (finding 4).
   - Both are recorded as follow-ups. No profile is created from either.
   - A filer gets a profile (a `users` row) only once they have **at least one priced closed round trip**. Filers
     with only excluded sells stay in `public_filers` with `user_id` null and have no page. Reason: an all-excluded
     page shows no record and adds legal exposure about a real person (the reasoning of legal finding 3).
2. **Market data: none.** No new vendor or dependency (POLICY H). Open positions (TR-4) list symbols only, with the
   no-price sentence. The TR-4 partial is an owner item.
3. **Legal limits: legal-findings.md L1-L12 are build rules.** Where the plans differ, legal wins:
   - **5 requests/s**, not 10;
   - the structured data feeds only, no crawling of web pages;
   - exclusions counted **by reason**;
   - the full non-endorsement line from finding 12.

   L2 (a per-source flag) is met by the `public_filers.source` check constraint, which admits only
   `'insider_reports'`. Adding a source needs a schema change and the owner, which is a stronger lock than an env flag.
4. **Feed: yes, same ranking, same eligibility (5+ closes), labeled "Public filing".**
   - Only closed round trips become cards, so a lone purchase is never broadcast.
   - The feed's recency term keys on `closed_at` (the transaction date) and never on the filing date.
   - No "new", "just filed" or recency badge.
   - No section, filter or sort that groups insiders.
   - Public filers are kept off `/t` in v1 (F3b: no security-level insider signal). That is the engineer's
     `filing_url is null` clause.
5. **Launch switch:** `publicTradersOn(env)` as the engineer specified (`PUBLIC_TRADERS=1` on, `=0` off, otherwise
   on outside production or in the sandbox, so e2e sees fixtures). It is also forced **off** in production unless
   both `PUBLIC_FILINGS_USER_AGENT` and `PUBLIC_RECORDS_CONTACT` are set. That makes two of the owner's
   preconditions mechanical, not remembered.
6. **Demo and e2e data:**
   - e2e uses fictional filers served by the local fake filing server, or inserted straight into the DB, and removed
     afterwards. Their badge is "Public filing", following the precedent of fake-vendor data showing Verified in e2e.
   - `db:seed` gets **no** public filer: fabricated filings with filing links that go nowhere would break the Never
     list.
   - To see the feature in dev, run the import script against the local fake.

## 3. One PR: scope that fits (target ≤ 450 non-test lines)

Deleted from the round-1 plans:
- **The cron stage in `/api/sync` and the `public_import_state` cursor table.** Automate last. Replace them with an
  operator script, `scripts/public-import.ts --since <date> [--dry-run]`, which fetches, inserts and rebuilds.
  `--dry-run` prints counts only (filers seen, priced closes, filers with 5+ closes, exclusions by reason) and never
  names. This removes about 50 lines and any risk to the hourly sync's time budget. It is also the demand test
  (section 6).
- **The `/public-records` page.** Use a "Public filing records" section on `/how` (anchor `#public-filings`), which
  holds the explanation and the correction contact.
- **The `public_open` table.** Store the open symbols as `public_filers.open_symbols text[]`, written by the rebuild.
- **The `/t` inclusion**, as above.
- **Two badges (Demo plus Public filing) on fixtures.** No such data exists now.
- **`public_filers.excluded_*` per reason** is the one exception that stays. L5 requires counts by reason, so add two
  columns: `excluded_unpriced` and `excluded_unreconciled`.

Kept: schema, parser and fetcher (one vendor file), FIFO with unknown-cost lots, the `'public'` state with its badge
and copy, profile additions, the feed and similar-trades gate plus the feed cursor fix, the login and rebuild guards,
the removal script, the `/how` section, CSS.

If the build runs over 480 lines, cut in this order:
1. Similar trades and suggest inclusion: gate public filers out of them.
2. The trade page's "Bought: filing" links: the closing filing link stays.

## 4. Scorecard (this plan, revised)

| Dimension | Score | Evidence |
|---|---|---|
| Market demand | 3 | Observed behavior is strongest for the legislator source we can't ship (a copy-trading category built on it reports tens of millions in copied volume; self-reported, tier 1-2). Insider-only trackers are small (modeled installs in the low thousands, tier 3). The owner's direction carries the build |
| Ease of adoption | 5 | Zero new steps: the same profile, feed card and share link a viewer already knows |
| Phase fit | 4 | Feeds the shared-link supply side without traders connecting; the owner decided it |
| Revenue impact | 3 | Supply for the feed; the legal limit L10 keeps these profiles free for ever |
| Aesthetics & clarity | 4 | One badge, one provenance block, same layout. Risk: the provenance block grows past 3 lines (demand 9) |
| Trust & compliance | 5 if demands 3-8 hold | Never Verified, filing links, exclusions counted, switch off in production, removal path |
| Simplicity | 4 | One page instead of two. The cron cut removes automation before the process is proven |
| Craft & taste | 4 | Depends on demand 9 |

Market demand is below the bar of 4. I sign anyway on the owner's recorded direction, which is precedent and not a
bar the committee can overrule. The honest consequence: **switch-on in production waits for the dry-run numbers**
(section 6). Without enough priced records, the feature ships dark.

## 5. Revenue chain (Phase 1: reach, not money)

| Factor | Low | Base | High |
|---|---|---|---|
| Insider filers with 5+ priced closes (feed-eligible) | 100 | 400 | 1,500 |
| Share-link views per profile per month | 1 | 5 | 20 |
| Monthly reach from public profiles | ~100 | ~2,000 | ~30,000 |

- The assumptions are unmeasured.
- The most sensitive one is the count of feed-eligible filers. Most insider sells consume granted shares and are
  excluded, so this number could be near zero.
- The cheapest test is one `--dry-run` over 3 months of filings. It takes a day, not two weeks.

## 6. Demands (numbered; each is testable)

**Engineer (build):**
1. **Users row per published filer**, as in plan-round1-engineer section 1, created only when the filer has at
   least one priced closed round trip. Verify: a unit test where a filer with only excluded sells gets no `users` row
   and `/u/<handle>` returns 404.
2. **Dev login refuses filer handles** (`app/actions.ts` after line 36). Verify: a node test plus an e2e test where a
   POST of a filer handle creates no session.
3. **Honest attestation marker.**
   - Use one shared `signup_attempts` row per source, as proposed.
   - Add an additive marker column (for example `signup_attempts.record_source text`, null for people,
     `'public_filings'` for the shared row) so that a reader of that table alone can tell this is not a person's
     attestation.
   - Every funnel, attestation or age count excludes marked rows.

   Verify: a test that the funnel and attestation readers return the same counts with and without a fixture filer.
   Owner item: whether to allow the constraint swap that would make the method value itself honest.
4. **`'public'` in `PublicState`/`RecordState`**, read through `recordStates`, so that an exhaustive switch fails tsc
   wherever it is missed. Verify: an e2e walk of profile, feed card, pane, share card meta, month page and trade page
   asserting "Public filing" and no `.badge.verified` and no `.badge.demo`. The share-image alt and the unfurl
   description must not contain "Verified" or "Demo data".
5. **Percent only.** Verify: e2e scans the HTML, image alt and meta tags of every public surface for each fixture
   price and share count; a unit test checks that derived rows carry percent fields only.
6. **FIFO with unknown-cost lots**, as the engineer specified (keep only `verified === true` lots closed by an
   open-market sale; check reconciliation against held-after; an amendment supersedes and triggers a rebuild; direct
   and indirect queues kept separate). Verify: each case in UX section 7 item 5 with an exact percent or exclusion
   count, computed by hand.
7. **Importer rules:**
   - at most 5 requests/s (a test counts timestamps);
   - refuses to start without the User-Agent;
   - structured data endpoints only;
   - backoff on 429/5xx;
   - logs counts and run ids only, never names.

   Verify: unit tests against the local fake.
8. **Switch** as in section 2 item 5. Verify: an env-table unit test (`lib/public-gate.test.ts`), plus a test that
   with the switch off the profile returns 404 and the feed and similar SQL contain no filer.
9. **Provenance block at most 3 lines at 360 px**, in this order:
   1. "Public filing" badge, then "Company insider" (muted).
   2. "From public filings. This person hasn't joined, connected a broker or reviewed this record, and doesn't
      endorse Stock Social."
   3. "Record since ‹date› · checked ‹date› · Request a correction or removal →" (links to `/how#public-filings`).

   Older than 7 days appends "May be out of date." The name is shown as filed, with no text-transform. Verify: an
   e2e test at 360 px asserts the three lines, the link target and no horizontal scroll.
10. **Each closed-trade row links its filing** with the visible text "Filing ↗" and an accessible name that says it
    opens another site; the tap target is at least 44 px. Verify: an e2e test where the href equals the fixture
    URL.
11. **Exclusions shown by reason whenever > 0**, with the UX lead's two sentences pluralized through `counted()`.
    Verify: e2e.
12. **Removal script** (`scripts/public-filer-remove.ts`): `deleteProfile` plus `removed_at`, with deletion in code,
    never in `schema.sql`. Verify: a test that after removal the profile returns 404, the closes are gone from the
    feed, and a re-import skips the filer.
13. **`/how#public-filings`** covers the source, open-market only, FIFO per holding, unknown-cost lots and why most
    sells are excluded, returns before fees, no current prices, "Public filing is not Verified and does not confirm
    identity or completeness", and the contact from `PUBLIC_RECORDS_CONTACT` (or "Contact coming before launch" when
    unset). Run the copy through the banned-claims test in `lib/copy.test.ts`.
14. **Feed cursor:** `lateArray` also reads `public_transactions.created_at`. `LOAD=1 lib/feed.load.test.ts` stays
    in budget. Verify: a unit test where an import mid-scroll does not shift page 2.
15. **Fictional fixtures only**, and no hard-coded real filer or issuer list anywhere; `scripts/compliance.ts`
    passes. Verify: CI.

**UX lead:**
16. Re-issue section 3 for `/u`: drop the `/p` route, keep Follow, and fit the provenance block to demand 9. Keep
    the excluded and open-positions copy as written; it is good, because it says why and doesn't apologize.

**Reviewer:** reading the diff is not enough. Run the e2e label walk (demand 4) and the HTML price scan (demand 5)
on the running app, signed out, at 360 px, in light and dark.

## 7. Owner items (switch-on in production waits for all of them)

From legal "Turning the switch on" items 1-6, plus:
- **O-a.** The P3 reading (legal finding 10).
- **O-b.** The attestation marker or constraint swap (demand 3).
- **O-c.** TR-4 partial, open positions without percent.
- **O-d.** The dry-run result: feed-eligible filers ≥ 100 (the low case), otherwise stay dark and revisit the
  sources.
- **O-e.** The removal policy, and a live role contact.

## 8. What would change my mind

- The dry-run shows fewer than 100 feed-eligible insider filers. Then insider-only isn't worth turning on. The real
  demand sits in legislator records, which need an owner-approved price source and an owner-accepted legal risk.
- The `'public'` state can't be added without touching more than about 15 trust call sites. Then mislabel risk
  rises, and a dedicated badge component test matrix becomes mandatory before merge.

Evidence links (category only, tier noted):
- Copy-trading on legislators' filings, self-reported invested volume (tier 1-2):
  https://sg.news.yahoo.com/traders-invested-55-million-using-193917633.html
- Modeled installs for small insider and legislator trackers (tier 3): https://appgoblin.info/apps/6737145743
