# F-7 plan, round 2: engineer (response to the UX lead and the legal conditions; merged build plan)

**Position: REVISE, and I sign the merged plan in section 4.** It is one PR under the 800-line cap, using the UX
lead's screens, copy and counting rules, my data model and the legal member's L1-L12. Where we differed, I explain
below what I keep and what I concede. All names, identifiers and symbols are fictional (POLICY T1/T2).

**The size rule I measured against.** `scripts/autopilot.ts#productLines` (line 170) counts the additions plus
deletions of every changed file except:
- `*.test.ts` files;
- anything under `e2e/` or `docs/`;
- images.

The Gate turns a feature PR over `MAX_DIFF` (default 800, line 671) into needs-human (line 161). Two consequences for
the plan:
- The fake filing server and the XML fixtures go under `e2e/`, so they cost nothing. Node tests read them from
  there, which is the same rule `e2e/f6-open-positions.spec.ts` follows.
- Test names must still be found by `node --test` with no arguments (Node 24 default patterns) and by Playwright's
  default `testMatch`. A file ending in plain `.f7` would not run. So every F-7 test is `lib/f7-*.test.ts` or
  `e2e/f7-*.spec.ts`.

## 1. Point by point with the UX lead

### 1.1 Route: separate `/p/[slug]` and its own tables, or a `users` row on `/u/[handle]`

**I keep the `users` row and the `/u/[handle]` route, and I concede the UX lead's three reasons as conditions that
the build must meet.** Below is why, and how each reason is answered.

**Cost.** The feed is about 700 lines of ranking SQL keyed on `closed_trades.user_id ⇒ users`. That includes the
candidate window, the `late` cursor array, per-trader caps, exploration, the section, exclusions, follows, likes and
`recordStates`. The pane, the share card, the month and story pages, similar trades and display_log all key on
`users.id` too.

A sibling `public_closed_trades` table means a `union all` in every candidate statement, a second cursor source, and
a second copy of `/u/[handle]/{page,trade,month,story,pane,pane-chart,opengraph-image}`. I estimate 600 to 900 lines
before any F-7 logic, so it cannot be one PR. It would also break the owner's "identical" decision in small ways,
every time one copy changes and the other doesn't. The `users` row puts every existing component on public records
with no fork.

**UX reason 1: "users requires an 18+ attestation the filer never gave".** Agreed: the column must not pretend.
- **The value.** `adult_attested_at` and `signup_attempt_id` are NOT NULL. Relaxing them needs a `drop not null`,
  which the CI schema guard refuses (`guardFindings`, line 207), and evading the guard is not an option. So a
  filer's row carries one shared signup_attempts row per source (`method 'dev'`, `completed_at` set). The demo-seed
  precedent is `scripts/seed.ts:20-25`.
- **The schema comment says** that for rows in `public_filers` these columns record the import time, not an
  attestation. `public_filers` is the authority on what the row is.
- **Every reader of attestation or the signup funnel** excludes `user_id in (select user_id from public_filers)`.
  The test is "an import adds 0 to every funnel and attestation count".
- **The 18+ rule is kept by rule, not by attestation.** The importer creates a profile only for filers who report
  the relationship *director* or *officer*. Filers reporting only "large owner" or "other" are skipped and counted.
  Those are often entities, and the age is unknowable for them. This is selection by rule, as finding 9 asks.

**UX reason 2: "the dev stub signs in to any existing handle".**
- One guard in `app/actions.ts#login`, after line 36: an existing handle owned by a filer throws `LAUNCH.closed`.
- OIDC and email sign-in go through `identities`, and filers have none.
- `rebuildTrades` (`lib/sync.ts`) refuses a filer, so it can never wipe the public record.
- `resolveReferrer` (`lib/referral.ts`) ignores a filer as referrer, so the join CTA on a filer profile never
  attributes a signup to a person who hasn't joined.

**UX reason 3: "handles are user-chosen (U2 impersonation)".**
- Filer handles are generated as `pf_` + a slug of the filed name (≤ 20 characters, with a numeric suffix on
  collision; `handle_reservations` is checked).
- `createUserForAttempt` (`lib/auth/attempts.ts`) and the rename action refuse any handle starting `pf_`. So no
  person can register a lookalike in the public-filer namespace, and every `pf_` URL is a public record.
- `/u/pf_…` makes the source visible even in a bare link.

**What the UX lead keeps.** Their screen, top block, copy and states, unchanged except for the route, plus their
data rule that "the record kind comes from data". Here the kind is the new record state `'public'`, read from
`public_filers`.

### 1.2 Dropping Follow, likes, the share prompt, theses and the similar seed

The owner decided "identical". So I drop only what the legal conditions or plain truth require. The rest costs 0
lines to keep and lines to remove.
- **Follow: keep.** In this product a follow only weights the follower's own feed: `lib/follows.ts` and
  `/me/following` send no email, push or alert. That is not "follow to get their trades" (finding 12) and not a
  notification from filings (L8). The button's copy is the generic "Follow"/"Following", and the plan forbids any
  F-7 copy that frames it otherwise. If the legal member reads finding 12 as covering in-app follows too, hiding it
  for `'public'` is 2 lines. That is my fallback, not my proposal.
- **Likes, Not interested, report: keep.** These are viewer actions on a trade, with no implication about the filer.
- **Share prompt and theses: nothing to drop.** Both are gated to the owner (`isMe`), and a filer can never sign in.
  The system share and Copy link stay, as the UX lead says.
- **The "Similar trades" seed from a filer profile: keep.** It suggests other traders by trade overlap, not
  securities by insider activity, so it scores no security (finding 14). It is 0 lines kept.
- **Join CTA: keep, with the referral cut.** The CTA speaks to the viewer. Only the `ref` attribution changes (see
  1.1).

### 1.3 Feed inclusion

I agree with the UX lead on all of these:
- the same eligibility (5+ closes);
- the same ranking (|return| size × recency, the TR-9 lower bound in `rankTraders`), so losses rank like gains;
- the **Public filing** badge on every card (L11);
- the card line "Company insider · from a public filing";
- only closed round trips, never a lone buy or sell;
- no section, filter or sort that groups insiders.

**What I add for L8 and finding 14** ("no recency-driven feed items from public filings, nothing timed to a new
filing"). The feed's recency term would otherwise lift a sale filed two days ago to the top of the feed. In effect
that is "an insider just sold +34%".
- **The embargo.** A public close enters the feed only when its closing filing is at least `PUBLIC_FEED_DELAY_DAYS =
  30` days old. It gets a new column, `closed_trades.feed_after` (null for every broker or demo trade), and one feed
  clause: `(ct.feed_after is null or ct.feed_after <= now())`.
- **Everywhere else is immediate.** The profile, pane, trade page and share card show the close at once (TR-2, full
  history).
- **Ranking is unchanged** once a close is in.
- **The honest consequence.** A 30-day-old close has decayed, so public records reach viewers mostly through the
  exploration slots and trader-level ranking, rarely the top cards. I accept that as the price of L8. The legal
  member confirms the 30 days, or names another number. The number is a constant, and a test pins it.

**The cursor.** Public closes come from `public_transactions`, not `activities`. So `lateArray` in `lib/feed.ts`
also unions `public_transactions.created_at > asOf` (one clause), and an import mid-scroll can't shift a page. The
`LOAD=1 lib/feed.load.test.ts` budget must hold.

### 1.4 Open positions: symbols only

**Agreed: the UX lead's O2 sentence, no percent, no combined line, no unrealized grid.**
- The rebuild writes the remaining open-market lots' symbols to `public_filers.open_symbols text[]`. These are
  derived and rewritten on every rebuild.
- I drop my round-1 `public_open` table: a column is fewer lines and is still raw-in, derived-out.
- Lots of unknown cost (grants and earlier holdings) are not "open positions bought in the market". They are
  excluded from the list, and the sentence says so.
- The positions query (`app/u/[handle]/page.tsx:64`) is skipped for `'public'`.

### 1.5 The UX lead's 14 draft acceptance criteria

| # | Verdict | Change |
|---|---|---|
| 1 | Keep | Add "no Verified in the share image alt and unfurl text" as a unit test on `imageTrust` and `profileDescription`, and the e2e DOM walk. `/t` is out of scope (1.6), so the `/t` part becomes "public closes never appear on `/t`". |
| 2 | Keep, extended | The top block carries the full L4 and finding 12 line (has not joined, has not connected a broker, has not reviewed the record, does not endorse). |
| 3 | Keep | Profile rows link the sell's filing. The trade page links the sell's filing and each matched buy's filing (`external_id` → `filing_url` read from `public_transactions`, links only). |
| 4 | Keep | The e2e test scans HTML, unfurl meta and OG alt for the fixture's share counts and prices. A unit test asserts `closed_trades` gets no new numeric column. |
| 5 | Keep, split | Into exact pure cases in `lib/f7-public-trades.test.ts`. |
| 6 | Keep, per reason | L5 wants a count per reason, not two lines. |
| 7 | Keep, plus the embargo | A unit test pins the order of a mixed set. A DB test shows a close is hidden before `feed_after` and appears after it. |
| 8 | Keep | |
| 9 | Keep | |
| 10 | Keep, reworked | A second e2e server needs `playwright.config.ts` (protected). Replaced by a gate env-table unit test, a DB test that the feed, similar and suggest SQL and the profile loader drop filers when the switch is off, and a structural test that every `app/u/[handle]/**` route calls the gate. |
| 11 | Keep, with hide | Add "hidden while under review" (finding 13) and the corrections log. |
| 12 | Keep | Plus: import logs contain no filer name (L9). |
| 13 | Keep | |
| 14 | Keep | Plus "not behind any paid feature" (L10): the same content signed out and signed in. |

### 1.6 Where my round 1 and the UX lead both change

- **`/t/[symbol]`: deferred.** Both the UX lead and my round 1 had public closes appear on `/t`. Now they stay off
  it. `lib/ticker.ts` treats `verified=false` as "sample data" in 5 places and computes per-symbol aggregates.
  Showing insider closes there costs about 60 lines and sits right next to finding 14's "no page that scores
  securities by insider buying". v1 adds `ct.filing_url is null` to the `/t` queries (about 12 lines). Deferred,
  with its own legal read.
- **Rate.** My 10 requests/s becomes ≤ 5 requests/s in one serial worker (L9, finding 15).

## 2. Legal conditions L1-L12: how each is built and tested

| Rule | Build | Test |
|---|---|---|
| L1 switch | `lib/public-gate.ts#publicTradersOn(env)`: `PUBLIC_TRADERS=0` → off; `=1` → on; unset → on only when `NODE_ENV !== 'production' \|\| isSandbox(env)` (the e2e server is sandbox). In production, "on" also needs `PUBLIC_RECORDS_CONTACT` set, else it stays off. Off: profile and all sub-routes 404; the feed, similar and suggest SQL drop filers; the importer doesn't run. | `lib/f7-public-gate.test.ts` env table; `lib/f7-feed.test.ts` switch-off; `lib/f7-routes.test.ts` structural |
| L2 per source | `publicSources(env)`: `PUBLIC_SOURCES` (comma list, default `insider`) ∩ `{insider}`. Any other name is ignored with a count in the log. `public_filers.source` check allows only `'insider_reports'`. | gate test: `legislator` and `holdings` are never enabled, even when listed |
| L3 fictional, Demo | Fixtures under `e2e/fixtures/public-filings/` are fictional only (filer "Avery Sample", issuer "Fictional Widgets", `ZQXA`/`ZQXB`). `public_filers.demo` is true whenever the importer's base URL is not the official one, and for every e2e insert. The badge shows **Public filing** + **Demo**. `db:seed` gets nothing (deferred). | `lib/f7-public-import.test.ts` (fake import → demo=true); e2e badge pair; `scripts/compliance.ts` on the tree |
| L4 labels | `'public'` state; badge "Public filing" on the profile, pane, feed card, trade, month and story pages, and the share card. Never Verified. Filing link on every entry. Non-endorsement line. Footer disclaimer unchanged. | `lib/f7-trust.test.ts`; `e2e/f7-public-profile.spec.ts` DOM walk (no `.badge.verified`) |
| L5 percent, reasons | No new numeric column on `closed_trades`. `public_filers.excluded jsonb` holds counts by reason: `no_price` (sale consumed an unknown-cost lot), `grant`, `gift`, `derivative`, `other` (other non-market change), `unreconciled`, `not_officer_director` (filer level, counted in the import log). Each count > 0 renders a line via `counted()`. | pure cases; e2e lines |
| L6 identity, amendments | `unique (source, filer_key)`; display_name copied as filed; never matched by name. An amendment replaces the rows of the filing it amends, then a full rebuild. Derived rows are never patched. | import test: same name with two keys gives two profiles; amendment changes the percent |
| L7 corrections, removal | `/public-records` page (L7, P6) with `PUBLIC_RECORDS_CONTACT` (role address, env, never committed). Without it in non-prod, it shows "Contact not set". A "Request a correction or removal" link on every public profile and pane. `scripts/public-filer.ts hide\|unhide\|remove <handle> <note-id>` sets `hidden_at`/`removed_at`, runs `deleteProfile` on remove, and appends to `public_filer_log`. | import test: hide 404s and drops from feed, unhide restores; remove deletes and re-import skips |
| L8 no recency or alerts | No notification code is touched. The feed embargo (1.3). No "new", "just filed" or recency badge on `'public'`: TR-7's "New record" badge is based on record age, not filing recency, and stays as on `/u`. | feed DB test (embargo); trust test (no recency copy) |
| L9 importer | `lib/public-filings.ts`: `User-Agent: "Stock Social <PUBLIC_FILINGS_CONTACT>"`, throws without it. One serial worker, min gap 250 ms (≤ 4 req/s). Backoff on 403/429/5xx (1 s, 2 s, then stop the tick). Structured daily index plus the per-filing XML only, never HTML pages. Logs carry the run id, counts and ms only. | `lib/f7-public-filings.test.ts` against the fake: UA header present and refused without it; timestamps ≥ 250 ms apart; stop on repeated refusals; captured logs exclude the fixture name |
| L10 free | No gating code. The content is identical signed in and out. | e2e signed-out vs signed-in text equality |
| L11 feed label | Card badge from `cardTrust(…, 'public')`. A public close can never return `'verified'`, so it can't reach any Verified-labeled surface. | trust test; e2e feed card |
| L12 `/how` | A "Public filing records" section (UX copy, section 5), plus "returns before fees" and "the two other public report types are not used, and why". | e2e `/how` text |

## 3. Scope cut for one PR, and what is deferred

**Kept, because the owner's decisions or L1-L12 require them:**
- the insider source, the importer and the rebuild;
- the `'public'` state on every existing surface (profile, pane, feed card, trade, month and story pages, share
  card);
- filing links, per-reason exclusions and symbols-only open positions;
- the switch and the per-source flag;
- `/public-records`, hide and remove with a log;
- the `/how` section.

**Deferred** (recorded as follow-ups in the feature file):
1. Legislator and holdings sources (findings 2-4; owner).
2. `/t/[symbol]` inclusion (about 60 lines, plus a legal read).
3. Unrealized percent on public open positions (needs a price source; POLICY H, O2).
4. Derivative-table matching (exercises are counted as `derivative`/`grant`, never matched).
5. A fictional demo-seed filer for `db:seed` (about 30 lines). e2e inserts its own fixtures.
6. A self-serve correction form. v1 is a contact link and the operator script.
7. Hiding Follow on filer profiles (2 lines, only if the legal member asks).

## 4. Merged build plan

### 4.1 Schema (`db/schema.sql`, one F-7 block at the end, additive only)

```sql
-- F-7 public-record traders (docs/features/logs/F-7/plan-round2-engineer.md). Raw filings in, derived out.
create table if not exists public_filers (
  id int generated always as identity primary key,
  source text not null check (source in ('insider_reports')),
  filer_key text not null,                          -- the filing system's unique filer id (L6); never a name match
  user_id int unique references users on delete set null,   -- users row: adult_attested_at/signup_attempt_id are the
                                                    -- import time, NOT an attestation; this table is the authority
  demo boolean not null default false,              -- fictional / non-official source (L3)
  checked_at timestamptz,                           -- last import that read this filer
  excluded jsonb not null default '{}',             -- counts by reason (L5)
  open_symbols text[] not null default '{}',        -- open-market lots not yet sold; no percent (TR-4 partial)
  hidden_at timestamptz, removed_at timestamptz,    -- under review / removed on request (L7); importer skips removed
  created_at timestamptz not null default now(),
  unique (source, filer_key)
);
create table if not exists public_transactions (    -- raw, private, never rendered (L5)
  id bigint generated always as identity primary key,
  filer_id int not null references public_filers on delete cascade,
  external_id text not null,                        -- '<filing id>:<row>'
  filing_id text not null, amends text,             -- amends: the filing id this one replaces
  filing_url text not null check (filing_url ~ '^https?://'),
  symbol text not null, holding text not null,      -- 'direct' or the indirect holding's label: one FIFO queue each
  code text not null, side text check (side in ('BUY','SELL')),
  units double precision not null check (units > 0), price double precision check (price >= 0),
  held_after double precision, derivative boolean not null default false,
  executed_at timestamptz not null, filed_at timestamptz not null,
  raw jsonb not null, created_at timestamptz not null default now(),
  unique (filer_id, external_id)
);
create table if not exists public_import_state (source text primary key, cursor jsonb not null default '{}', last_run_at timestamptz);
create table if not exists public_filer_log (       -- corrections log (COMPLIANCE §12); no free text, a note id only
  id bigint generated always as identity primary key,
  filer_id int references public_filers on delete set null,
  action text not null check (action in ('hide','unhide','remove')), note_id text, at timestamptz not null default now()
);
select schema_add_column('closed_trades', 'filing_url', 'text');        -- closing sell's filing; null for broker/demo
select schema_add_column('closed_trades', 'feed_after', 'timestamptz'); -- L8 embargo; null for broker/demo
```

### 4.2 Files

**New product files (counted):**

| File | Contents | Est. lines |
|---|---|---|
| `lib/public-gate.ts` | `publicTradersOn(env)`, `publicSources(env)`, `PUBLIC_FEED_DELAY_DAYS`, `filerHiddenSql()` (the one SQL fragment the feed, similar, suggest and profile loader use), `isPublicFiler(id)`, `assertFilerVisible(userId)` (calls `notFound()`) | 35 |
| `lib/public-filings.ts` | The only file that fetches the filing system. `fetch` only. UA, a 250 ms gap, backoff, `assertFilingsBaseUrl` (official or loopback; loopback is refused in production unless `ALLOW_DEV_AUTH=1`, as in `lib/vendor-env.ts`). `listFilings(cursor)` (daily structured index), `fetchFiling(id)`, and pure `parseFiling(xml)` (a bounded reader for the fixed element set, 2 MB cap, entities decoded; unknown structure is skipped and counted) | 130 |
| `lib/public-trades.ts` | Pure `toLots(rows)`: amendments applied by `filed_at`; queues per (symbol, holding); opening holdings from the first row's `held_after − units` become an unknown-cost lot; every non-market acquisition is an unknown-cost lot; non-market dispositions consume and are counted; reconciliation against `held_after`, where a mismatch excludes every later sell in that queue as `unreconciled`. Then `matchTrades` unchanged (`lib/trades.ts`), keeping only `verified===true` trades that close on an open-market sale. Plus `rebuildPublicTrades(filerId, tx)`: delete and insert that user's `closed_trades` (`verified:false`, `sell_id 'pub:'+external_id`, `filing_url`, `feed_after = filed_at + delay`), re-attach theses by `sell_id`, write `excluded` and `open_symbols` | 100 |
| `lib/public-import.ts` | `importPublicFilings({ boxMs, env })`: gate and sources check; read the cursor; at most 50 filings a tick; skip removed filers and non-officer/director filers (counted); create the filer and its `users` row (`pf_` handle, shared attempt row); insert `on conflict do nothing`; rebuild each touched filer under `USER_LOCK`; save the cursor; log counts | 75 |
| `app/public-records/page.tsx` | What these profiles are, the source, exclusions, "has not joined", the contact (`PUBLIC_RECORDS_CONTACT`), and a promise of a reply only, not an outcome. No names | 45 |
| `scripts/public-filer.ts` | Operator: `hide`, `unhide`, `remove`, each logged | 45 |

**Edits to existing files (counted):**

| File | Edit | Est. lines |
|---|---|---|
| `db/schema.sql` | the 4.1 block | 50 |
| `lib/connections.ts` | `PublicState` gains `'public'`. `recordStates` makes one more query to `public_filers` and returns `{state:'public', demo}`. `publicRecordDetail` short-circuits | 12 |
| `lib/pane.ts` | `paneTrust`, `cardTrust` and `rowBadge` return `'public'` / `'public_demo'` for state `'public'`, never `'verified'` | 8 |
| `app/ui.tsx` | `Badge`/`RowBadge` kinds `public` and `public_demo` (title: "Built from public filings, not from a broker connection. Not Verified.") | 10 |
| `lib/copy.ts` | `PUBLIC` block (UX section 5 plus the L4 non-endorsement line, the `excluded` reason lines and `stale`); `RecordState` gains `'public'`; branches in `imageTrust`, `wholeRecordView`, `recordCountText` and `profileDescription` | 50 |
| `lib/record-card.ts`, `app/u/[handle]/record-card-data.ts` | share card label and tone `'public'` | 10 |
| `app/u/[handle]/page.tsx` | gate; the top block (name, badge, kind line, not-joined and non-endorsement line, since/checked, stale, correction link); excluded lines; open symbols; a "Filing ↗" link per row; positions query skipped | 55 |
| `app/u/[handle]/trade/[sellId]/page.tsx` | gate; "Bought: filing ↗ · Sold: filing ↗" | 15 |
| `app/u/[handle]/{month/[ym]/page.tsx, month/[ym]/opengraph-image.tsx, story/route.tsx, pane/route.ts, pane-chart/route.ts, opengraph-image.tsx}` and `app/pane.tsx` | `assertFilerVisible`, one line each; the pane gets the not-joined line and the correction link | 14 |
| `lib/feed.ts` | `filerHiddenSql()` in `c`/`elig`; `feed_after` clause; `lateArray` + `public_transactions` | 12 |
| `app/ui.tsx` (feed card) | card line for `'public'` | 4 |
| `lib/similar.ts`, `app/suggest-section.tsx` source query | `filerHiddenSql()` | 6 |
| `app/t/[symbol]/page.tsx`, `app/t/[symbol]/opengraph-image.tsx`, `app/t/page.tsx`, `app/t/compare/page.tsx` | `ct.filing_url is null` | 12 |
| `app/actions.ts` | login refuses filer handles; rename refuses `pf_` | 4 |
| `lib/auth/attempts.ts` | `createUserForAttempt` refuses `pf_` | 2 |
| `lib/referral.ts` | `resolveReferrer` ignores filers | 2 |
| `lib/sync.ts` | `rebuildTrades` refuses a filer | 3 |
| `lib/funnel.ts` (and any attestation count) | exclude public filers | 4 |
| `app/api/sync/route.ts` | one stage after `syncTick`: `importPublicFilings({ boxMs: min(20_000, left()) })` in its own try/catch | 10 |
| `lib/vendor-env.ts`, `instrumentation.ts` | `assertFilingsBaseUrl` plus one call | 12 |
| `lib/privacy-retention.ts`, `lib/privacy-fields.ts` | the 4 new tables in `SCHEMA_MAP` (personal, kept until removal); `filing_url`, `feed_after` in `NOT_A_FIELD` | 14 |
| `app/how/page.tsx` | the "Public filing records" section | 30 |
| `app/globals.css` | `.badge.public`, using existing tokens | 6 |
| `.env.example` | `PUBLIC_TRADERS`, `PUBLIC_SOURCES`, `PUBLIC_FILINGS_CONTACT`, `PUBLIC_FILINGS_BASE_URL`, `PUBLIC_RECORDS_CONTACT` (empty values) | 6 |

**Estimated total ≈ 770 product lines** against the 800 cap. The margin is small, so the builder runs `productLines`
on the branch diff before each push. If it goes over, the cuts are, in order:
1. the `/how` section, cut to 15 lines;
2. `scripts/public-filer.ts` with `unhide` dropped (−10);
3. `stale` copy (−5).

Those three save about 30 lines. Nothing required is cut.

**Not counted:**
- `e2e/fakes/public-filings.ts`: in-memory structured index plus filings, port 4103, with `/_scenario` and `/_state`
  (`429`, `5xx`, amendment and unreconciled scenarios) and request timestamps and headers recorded. It is never on
  the internet and follows `e2e/fakes/vendor.ts`.
- `e2e/fixtures/public-filings/*.xml`, fictional.
- The tests in 4.3.

**Env switch summary:**
- `PUBLIC_TRADERS` (L1).
- `PUBLIC_SOURCES` (L2, default `insider`).
- `PUBLIC_FILINGS_CONTACT` (L9, a role address; the importer refuses without it).
- `PUBLIC_FILINGS_BASE_URL` (the fake in tests; official only in production).
- `PUBLIC_RECORDS_CONTACT` (L7; required for "on" in production).
- All are set by the owner in deploy settings. None are committed with values.

**How e2e gets data.** The app server's env lives in protected files (`playwright.config.ts`, `ci.yml`), so the
server can't be pointed at the fake. The plan splits the work:
- Node tests start the fake and call `importPublicFilings` with an explicit base URL.
- e2e specs insert fictional filers and rows with `postgres` (as `e2e/f6-open-positions.spec.ts` does), call
  `rebuildPublicTrades` by importing the lib, and clean up in `afterAll`.

Shared files carry F-7 blocks only: `db/schema.sql`, `lib/copy.ts`, `app/globals.css`, `lib/feed.ts`,
`lib/connections.ts`, `lib/pane.ts`, `app/ui.tsx` and `app/u/[handle]/page.tsx`. No protected path is touched.

### 4.3 Acceptance criteria (each maps to a test; node tests run with no args, Playwright with the default match)

1. **Insider FIFO math.** An open-market buy at 10 and a sell at 12 give +20.0%. Two buys (10 and 14, equal units)
   and one full sell at 13 give +8.33%. Losses come out negative, and an all-losing set stays negative. →
   `lib/f7-public-trades.test.ts`
2. **No guessing.**
   - A sale after only a grant is excluded as `no_price`.
   - A sale that consumes holdings from before the first report is excluded as `no_price`.
   - A sale that partly consumes an unknown-cost lot is excluded whole.
   - Gift and tax-withholding dispositions count as `gift` and `other`.
   - Derivative rows count as `derivative` and are never matched.
   - A `held_after` mismatch excludes every later sale in that queue as `unreconciled`.
   - Direct and indirect holdings are matched separately.
   → `lib/f7-public-trades.test.ts`
3. **Amendments.** An amending filing replaces the rows of the filing it amends, and the rebuilt percent changes.
   A double amendment resolves by `filed_at`. Theses and likes survive by `sell_id`. →
   `lib/f7-public-trades.test.ts`, `lib/f7-public-import.test.ts`
4. **Derived rows hold percent only.** `rebuildPublicTrades` writes no quantity, price or amount. The
   `closed_trades` column set is unchanged apart from `filing_url` and `feed_after`. →
   `lib/f7-public-import.test.ts`
5. **Identity is by filer key.** Two filers with the same name and different keys get two profiles. A re-import is
   idempotent (`on conflict do nothing`, the same row counts). The display name is copied as filed. →
   `lib/f7-public-import.test.ts`
6. **Adults by rule.** A filer reporting neither director nor officer gets no profile and is counted in the run
   result. → `lib/f7-public-import.test.ts`
7. **A filer is never an account.**
   - The dev login with a `pf_` filer handle creates no session.
   - Signup or rename to any `pf_` handle is refused.
   - `rebuildTrades` refuses a filer and leaves its rows.
   - A filer is never recorded as a referrer.
   - The import adds 0 to funnel and attestation counts.
   → `lib/f7-public-import.test.ts`, `e2e/f7-public-profile.spec.ts` (login form)
8. **Switch (L1).**
   - `PUBLIC_TRADERS=0` is off.
   - `=1` is on, except that in production it needs `PUBLIC_RECORDS_CONTACT`.
   - Unset, it is on in dev and sandbox and off in production.
   - The importer doesn't run when off.
   → `lib/f7-public-gate.test.ts`
9. **Switch off hides everything.** With the gate off, the feed, similar and suggest queries return no filer, and
   the profile loader 404s. Every route file under `app/u/[handle]/` calls `assertFilerVisible`. →
   `lib/f7-feed.test.ts`, `lib/f7-routes.test.ts`
10. **Sources (L2).** Only `insider` can be enabled. `legislator` and `holdings` are ignored even when listed. →
    `lib/f7-public-gate.test.ts`
11. **Fair access (L9).**
    - The importer throws before any request without `PUBLIC_FILINGS_CONTACT`.
    - Every request carries a `User-Agent` with the product name and the contact.
    - Requests to the fake are ≥ 250 ms apart from one worker.
    - On repeated 429 or 5xx it backs off and stops the tick.
    - A non-loopback, non-official base URL is refused.
    - Captured logs contain no fixture filer or issuer name.
    → `lib/f7-public-filings.test.ts`
12. **Parser.** Fixture XML gives the expected rows. A truncated, oversized (> 2 MB) or unknown-structure document
    is skipped and counted, never thrown into the tick. → `lib/f7-public-filings.test.ts`
13. **Never Verified (L4, L11).**
    - `paneTrust`, `cardTrust` and `rowBadge` with state `'public'` never return `'verified'`.
    - `imageTrust` and `profileDescription` say "Public filing".
    - The `PUBLIC` copy passes the `lib/copy.test.ts` banned-claims list, and it bans "insider buying", "smart money",
      "signal", "copy", "follow their trades", "all of their trades", "just filed" and "new buy".
    → `lib/f7-trust.test.ts`
14. **Labels on every surface.** On the profile, a feed card, the pane, the trade page, the month page and the share
    card meta for a fictional filer, the "Public filing" and "Demo" badges show and no `.badge.verified` does. →
    `e2e/f7-public-profile.spec.ts`
15. **The top block and non-endorsement line (L4, L7, finding 12).** The block shows:
    - "has not joined";
    - "has not connected a broker";
    - "has not reviewed this record";
    - "does not endorse";
    - "Record since … · last checked …";
    - a correction link that reaches `/public-records`, which shows the contact.
    → `e2e/f7-public-profile.spec.ts`, `e2e/f7-public-records.spec.ts`
16. **Filing links.** Each closed-trade row has a "Filing" link whose href is the fixture filing URL and whose
    accessible name says it opens another site. The trade page links the sell's filing and every matched buy's
    filing. → `e2e/f7-public-profile.spec.ts`
17. **No amounts (L5).** The profile and trade HTML, the OG alt and the unfurl meta contain none of the fixture's
    share counts or prices. → `e2e/f7-public-profile.spec.ts`
18. **Exclusions shown by reason.** Each reason with a count > 0 renders its line, pluralized via `counted()`. A
    filer with no priced round trip shows "No closed trades that can be priced from the filings yet." along with its
    exclusions. → `e2e/f7-public-profile.spec.ts`
19. **Open positions.** The symbols are listed with the no-price sentence. No percent and no unrealized grid render.
    → `e2e/f7-public-profile.spec.ts`
20. **Feed inclusion.**
    - An eligible fictional filer's close (5+ closes) appears with the Public filing badge and the card line.
    - A mixed connected and public set orders by the same score and TR-9 bound.
    - An all-losing filer ranks like equal gains.
    - A lone buy never appears.
    → `lib/f7-feed.test.ts`, `e2e/f7-public-feed.spec.ts`
21. **Feed embargo (L8).** A public close is absent from the feed while `feed_after > now()` and present after,
    while it shows on the profile at once. `PUBLIC_FEED_DELAY_DAYS === 30` is pinned. An import between two pages of
    a cursor doesn't shift page 2. → `lib/f7-feed.test.ts`
22. **Off `/t`.** No public close appears on `/t/[symbol]`, `/t`, `/t/compare` or the ticker OG image. →
    `lib/f7-feed.test.ts` (queries), `e2e/f7-public-feed.spec.ts`
23. **Hide and remove (L7).**
    - `hide` 404s the profile and all sub-routes and drops the filer from the feed. `unhide` restores both.
    - `remove` deletes the profile, and a re-import of the same filings never recreates it.
    - Each action writes a `public_filer_log` row.
    → `lib/f7-public-import.test.ts`
24. **Privacy registry.** The four new tables are in `SCHEMA_MAP`, and `filing_url` and `feed_after` are in
    `NOT_A_FIELD`. The existing column-coverage tests pass. → `lib/privacy-retention.test.ts` and
    `lib/privacy-fields.test.ts` (existing, unchanged) plus `lib/f7-public-import.test.ts`
25. **Signed out = signed in, free (L10, finding 9).** The profile text is identical with and without a session
    cookie. `lib/feed.signed-out.test.ts` gains a case with a public filer in the pool. → `e2e/f7-public-feed.spec.ts`,
    `lib/feed.signed-out.test.ts`
26. **Accessibility and policy.**
    - The footer disclaimer shows on every F-7 page visited.
    - axe passes.
    - There is no horizontal scroll at 360 px.
    - Every link and control is ≥ 44 px tall.
    - Color is never used alone.
    - `/how` contains the "Public filing records" section (L12).
    - `scripts/compliance.ts` passes on the tree, and the fixtures are fictional.
    → `e2e/f7-public-records.spec.ts`
27. **Size.** `productLines` on the PR diff is ≤ 800. This is checked by the Gate, and by the builder before each
    push.

## 5. Owner and legal items carried

These are unchanged from the UX lead's O1-O5, plus the following:
- **Legal confirms:**
  - the 30-day feed embargo as meeting L8;
  - that an in-app Follow with no alerts is outside finding 12;
  - the officer/director rule for adults;
  - the placeholder attestation columns as documented above.
- **Owner:** the P3 reading (finding 10), the removal policy, the two contact addresses, and the production switch
  (legal's launch list, items 1-6).
