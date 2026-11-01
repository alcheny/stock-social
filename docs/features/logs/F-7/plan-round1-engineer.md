# F-7 plan, round 1: engineer (feasibility and data model)

**REVISE, buildable.** The source works: company insiders' transaction reports carry a transaction date, a code, a
share count, a price and the shares held after the transaction, so we can compute an honest percent with no new
vendor. The plan has to change in three places, though. (a) Today `verified = false` means "Demo" everywhere: in the
trust rule, the share card and every `/t` summary. Without a new record state, every public trade shows the Demo
badge. (b) Plain FIFO over open-market rows alone is wrong for insiders. Grants, exercises and earlier holdings sit
ahead of an open-market lot in the queue, so a sale has to be checked against the "shares held after" figure. A sale
that consumes a lot with no cost is excluded and counted, not credited to the open-market buy. (c) The required users
columns (an 18+ attestation and a signup attempt) were built for people who sign up. A filer needs them filled in
truthfully, and the dev sign-in has to refuse filer handles. No product code yet. All names below are fictional.

## 1. Data model (db/schema.sql, additive only: no drop, truncate or delete-from lines)

`activities.source` has `check (source in ('snaptrade','demo'))`. Widening it would need a drop, which CI refuses
(`scripts/autopilot.ts#guardFindings`, line 207). So the raw rows go in their own tables, and `rebuildTrades` never
sees them.

```sql
create table if not exists public_filers (
  id int generated always as identity primary key,
  source text not null check (source in ('insider_reports')),     -- one value per public source, added with the source
  filer_key text not null,                                         -- the filing system's stable filer id
  user_id int unique references users on delete set null,          -- the profile; null once removed
  removed_at timestamptz,                                          -- removal request: the importer skips this filer for good
  created_at timestamptz not null default now(),
  unique (source, filer_key)
);
create table if not exists public_transactions (                  -- raw, immutable, never shown
  id bigint generated always as identity primary key,
  filer_id int not null references public_filers on delete cascade,
  source text not null check (source in ('insider_reports')),
  external_id text not null,                                       -- '<filing id>:<row index>'
  filing_url text not null check (filing_url ~ '^https?://'),
  issuer_key text not null, symbol text not null,
  code text not null,                                              -- transaction code as filed
  direct boolean not null, side text check (side in ('BUY','SELL')),  -- null: a share change that is not a buy or sell
  units double precision not null check (units > 0),
  price double precision check (price >= 0),                       -- null or 0 for grants and gifts
  held_after double precision,                                     -- shares held after the row, as filed
  executed_at timestamptz not null, filed_at timestamptz not null,
  amends text,                                                     -- the filing id this filing amends, if any
  raw jsonb not null, created_at timestamptz not null default now(),
  unique (source, external_id)
);
create table if not exists public_import_state (source text primary key, cursor jsonb not null default '{}', last_run_at timestamptz);
select schema_add_column('closed_trades', 'filing_url', 'text');   -- the closing filing; null on every broker or demo trade
```

**Filer → users row (recommended over a separate profile path).** Follows, likes, rejects, exclusions, the feed,
display_log and the share card all key on `users.id`. A separate profile route would duplicate all of that, well
past 400 lines. Each users column, filled for a filer:
- `handle`: a slug of the filed name, cut to fit `^[a-z0-9_]{3,20}$`, with a numeric suffix on collision. The
  importer also checks `handle_reservations`.
- `display_name`: the filed name, cut to 40 characters.
- `snaptrade_*`: null.
- `adult_attested_at` and `signup_attempt_id`: both NOT NULL. The precedent is `scripts/seed.ts:20-25`, where demo
  traders get a `'dev'` signup attempt. **Risk:** both say a person attested. Widening
  `signup_attempts.method` needs a drop, so we can't add an honest method value. Proposal: one shared
  signup_attempts row per source, `method 'dev'`, `completed_at` set, with the importer's run time as the "attested"
  time. `public_filers` stays the source of truth, and every funnel or attestation count skips `user_id in (select
  user_id from public_filers)`. The legal member must accept this, or the owner must allow a constraint swap.
  Funnel readers to check: `lib/funnel.ts` and the privacy purge at `lib/privacy-purge.ts:106-113` (it purges
  attempts that no users row points at; ours stays pointed at, so it is safe).

**Never signable-into.** `app/actions.ts:36-40` (the dev `login`) signs any existing handle in. We add one guard
after line 36: `if (existing && await isPublicFiler(existing.id)) throw new Error(LAUNCH.closed)`. `lib/session.ts`
is protected and needs no change. OIDC and email sign-in go through `identities`, and filers have none. Renaming onto
a filer handle is already refused by `users.handle unique`. Test: a POST to the dev form with a filer handle creates
no session (node test plus e2e).

**Every reader of users or closed_trades that needs an F-7 branch or gate:**
- `lib/connections.ts:145-155` `recordStates` gets one more query (`select user_id from public_filers where user_id =
  any(ids) and removed_at is null`) and returns the new state `'public'`. `PublicState` at line 118 and `RecordState`
  at `lib/copy.ts:120` both gain `'public'`. `publicRecordDetail` (line 161) returns `{state:'public', paper:0}` with
  no connection. This is the single switch every trust rule reads.
- `lib/pane.ts:45-60`: `paneTrust`, `cardTrust` and `rowBadge` return badge `'public'` when the state is `'public'`.
  `app/ui.tsx:9-18`: `Badge` and `RowBadge` gain a `public` kind with the "Public filing" label and a CSS class.
  Callers are covered with no change of their own: `app/ui.tsx:42` (feed card), `app/pane.tsx:37`,
  `app/suggest-section.tsx:28`, `app/u/[handle]/similar-section.tsx:31` and `app/t/[symbol]/page.tsx:92`.
- `app/u/[handle]/page.tsx`: line 78 (`verified`), 148-150 (trust), 159 (`connectedLine`, which otherwise says
  "Demo data"), 176 (badge), 205 (the connect CTA, already gated by isMe), 284 (`recordBodyCopy`), 64 (positions
  query, skipped for `'public'`). Plus the per-trade "Filing" link (`closed_trades.filing_url`) and the "built from
  public filings, has not joined" line.
- `lib/copy.ts:177-209,259-264`: `imageTrust`, `wholeRecordView`, `recordCountText` ("public-filing trade") and
  `profileDescription`. `lib/record-card.ts:152-155` (share card label and tone) and
  `app/u/[handle]/record-card-data.ts:14-19`. `lib/recap-load.ts:15`, `lib/trade-share-load.ts:18` and
  `app/u/[handle]/month/[ym]/page.tsx:54` (they take state, so the new state flows through).
- `lib/display-log.ts:45-47`: demo is false, so a filer's daily row records what we displayed. That is useful for
  corrections.
- **`/t` surfaces treat `verified=false` as "sample data"** (`lib/ticker.ts:49,63,200,221,358`). v1 keeps public
  trades off `/t` with one clause, `filing_url is null`, in `app/t/[symbol]/page.tsx` (lines 36, 95-98, 105, 119),
  `app/t/[symbol]/opengraph-image.tsx:34`, `app/t/page.tsx:27,66` and `app/t/compare/page.tsx:22`. Showing them on
  stock pages under their own label is a follow-up (about 60 more lines across ticker.ts). `app/sitemap.ts` already
  counts only `verified` rows and needs no change.
- `lib/feed.ts:115-130` (`c` and `elig`) and `lib/similar.ts` get the launch gate `(public on or user not in
  public_filers)`. The feed cursor pins against `activities.created_at` (`late`, line 112). Public sells aren't in
  activities, so an import mid-scroll could shift a page. `lateArray` also reads `public_transactions.created_at`.
  `LOAD=1 lib/feed.load.test.ts` must stay in budget.
- `app/me/record`, settings, theses and share prompts can't be reached, because a filer can't sign in.
- Privacy: `lib/privacy-retention.ts#SCHEMA_MAP` gets entries for the three new tables (`personal: true`, retention
  "until removal request"; its test fails without them). `lib/privacy-fields.ts` adds `closed_trades.filing_url` to
  `NOT_A_FIELD` ("link to the public filing; public filers only"); its column test enforces this.
  `lib/privacy-purge.ts` needs no change (it keys on trade_key and users).
- Removal: `lib/delete.ts#deleteProfile` works for a filer as is (`snaptrade_user_id` is null, so no vendor call). A
  new operator script, `scripts/public-filer-remove.ts <handle>`, runs `deleteProfile`, sets `public_filers.removed_at`
  and deletes that filer's public_transactions (in code, not in schema.sql). It returns 404 afterwards, and the
  importer never recreates the filer (test).

## 2. Rebuild into closed_trades

`rebuildTrades` (`lib/sync.ts:52-117`) deletes the user's closed_trades and rebuilds them from activities only. Run
for a filer, it would wipe the record. Its callers are `syncUser` (it needs `snaptrade_user_id` and a connected
connection, so it never runs for a filer), `lib/connections.ts:525` and `scripts/seed.ts`. We add a guard: it throws
if a `public_filers` row exists. Its test is "a rebuild for a filer refuses and leaves rows".

New `lib/public-trades.ts#rebuildPublicTrades(filerId, tx)`, which reuses `matchTrades` unchanged:
- One FIFO queue per (filer, issuer_key, symbol): `accountId = 'pub:' + issuer_key`. Rows from amended filings
  replace the rows of the filing they amend (`amends`). A filing amended twice is resolved by `filed_at`.
- Every share-changing row goes into the queue, open-market or not.
  - An open-market purchase is a BUY lot with `verified: true`.
  - A grant, exercise or other acquisition, and the opening holdings implied by the first row's
    `held_after − units`, are BUY lots with `verified: false` (price 1 as a sentinel; never used).
  - An open-market sale is a SELL. A gift, tax withholding or other disposition is a SELL whose result is discarded.
- `matchTrades` already ANDs the lot flags (`lib/trades.ts:63`). We **keep only trades with `verified === true` that
  close on an open-market sale**. Everything else is counted into `users.excluded_positions`, together with the
  `excluded` count, so a sale that took any costless lot is never credited.
- **Reconciliation:** if our running total ever differs from the filed `held_after` (a split, a missing filing,
  indirect holdings), that whole queue is excluded and counted. We never guess. Indirect (`direct = false`) rows are
  their own queue under the same rules.
- Written rows: `verified: false`, `filing_url` = the closing sell's filing, `sell_id = 'pub:' + external_id`
  (globally unique, so theses, likes and trade_key keep working). Percent only, as for broker trades. The filings of
  the opening lots appear on the trade page by a read of the queue's BUY rows (links only).
- Open positions (TR-4): `open_positions.unrealized_pct` is NOT NULL and needs prices we don't have. So the profile
  lists the remaining open-market lots' symbols from the rebuild (`public_open` derived table, symbol only, no
  percent) under the line "current value not available from filings". This is the UX lead's O2.

Every existing component (chart, stats, confidence, feed card, pane, share card) reads closed_trades and works
unchanged. Only the labels branch, on the state `'public'`.

## 3. Vendor file and fake

- `lib/public-filings.ts` is the only file that talks to the filing system. It uses `fetch` only. `User-Agent` comes
  from `PUBLIC_FILINGS_USER_AGENT`; there is no default, and without it nothing is fetched. Base URL:
  `PUBLIC_FILINGS_BASE_URL`, refused in production unless loopback with `ALLOW_DEV_AUTH=1`, the same rule as
  `lib/vendor-env.ts#assertVendorBaseUrl` (we add a sibling `assertFilingsBaseUrl`, not an edit to instrumentation
  beyond one call).
  - Rate: a token bucket at ≤ 10 requests/s, shared by the module (a test counts timestamps). Retries: on 429/5xx,
    backoff, at most 2.
  - Parsing: no XML dependency. A bounded reader for the fixed element set (filer id and name, issuer key and symbol,
    the non-derivative rows' date, code, shares, price, held-after, direct/indirect; amendment marker). It decodes
    entities and caps the body at 2 MB. Unknown structure is skipped and counted. Derivative tables are ignored in v1.
    Pure parse functions are tested on fixture XML in `lib/fixtures/public-filings/*.xml` (fictional filer "Avery
    Sample", issuer "Fictional Widgets", symbol `FWDG`).
- `e2e/fakes/public-filings.ts`: an in-memory index plus filings on port 4103, with `/_scenario` and `/_state`. It
  follows `e2e/fakes/vendor.ts` and is never on the internet.
  - **How it starts:** `vendor.ts` is started by the spec itself (`e2e/connect.spec.ts:10-13`), not by
    `playwright.config.ts`. But the app server's env comes from `.github/workflows/ci.yml` and
    `playwright.config.ts`, which are both protected. So the server can't be pointed at the fake.
  - **Proposal:** node:test files (`lib/public-import.test.ts`) start the fake and call the import library directly
    with an explicit base URL. The e2e specs insert fixture filers and rows straight into the DB (as
    `e2e/f6-open-positions.spec.ts` does with `postgres`), call `rebuildPublicTrades` through a tiny
    `scripts/public-rebuild.ts`, or import the lib, and remove the fixtures in afterAll. No real filer data is ever
    seeded. `db:seed` gets none, because fabricated filings shown as real would break the Never list.

## 4. Launch switch

`lib/public-gate.ts#publicTradersOn(env)`: on when `PUBLIC_TRADERS=1`; off when `PUBLIC_TRADERS=0`; otherwise
`env.NODE_ENV !== 'production' || isSandbox(env)` (`lib/launch-gate.ts:24`). Note: the e2e server runs
`NODE_ENV=production` with `ALLOW_DEV_AUTH=1`, so "off in production" alone would hide the fixtures from e2e. With
the switch off:
- the profile returns 404 for filer handles;
- the feed, similar and suggest SQL exclude them;
- the share card falls back to neutral;
- the importer doesn't run.

Removal and the dev-login refusal work in every state. Unit tests cover the env table, matching
`lib/launch-gate.test.ts`.

## 5. Sync trigger

`app/api/sync/route.ts` gets one more stage after `syncTick`: `importPublicFilings({ boxMs: min(PUBLIC_SLOT_MS
= 20_000, left()) })` in its own try/catch.
- It reads the index from `public_import_state.cursor`, at most 50 filings per tick at ≤ 10 req/s.
- It inserts with `on conflict (source, external_id) do nothing`, then runs `rebuildPublicTrades` once per touched
  filer, under the same `USER_LOCK` advisory lock.
- It resumes from the cursor. Logs carry counts and ms only. It runs only when the switch is on and the UA is set.

A separate route would need a new cron entry outside the repo, so we reuse the tick.

## 6. Size, risk, shared files

Non-test lines, estimated:

| Part | Lines |
|---|---|
| schema | 45 |
| public-filings.ts | 120 |
| public-trades.ts | 80 |
| public-import.ts | 60 |
| gate | 15 |
| state/trust branches (connections, pane, ui, copy, record-card) | 55 |
| profile (label, filing links, open symbols) | 40 |
| feed/similar/t gates | 30 |
| login guard and rebuild guard | 10 |
| removal script | 35 |
| sync stage | 12 |
| css | 10 |
| /how and `/public-records` copy | 25 |
| **Total** | **≈ 540** |

That is over 400, so the work splits into three PRs:
- **PR-1:** data, import, rebuild, guards and switch. No UI; the profile 404s while hidden.
- **PR-2:** the `'public'` state, badge, profile, share card, /how and removal page.
- **PR-3:** feed and similar inclusion, plus the feed cursor.

Shared files with F-7 blocks: `db/schema.sql` (one block at the end), `lib/copy.ts` (`PUBLIC` object),
`app/globals.css` (`.badge.public`), `app/u/[handle]/page.tsx`, `lib/feed.ts`, `app/page.tsx` (none expected beyond
props), `lib/connections.ts`, `lib/pane.ts` and `app/ui.tsx`. Protected files: none needed.

Riskiest, in order:
1. A public trade mislabeled Demo or Verified somewhere we missed. Mitigation: `'public'` in the state unions makes
   tsc flag every exhaustive switch. An e2e test walks profile, feed card, pane, share card meta and month/trade
   pages and asserts no `.badge.verified` and no `.badge.demo`.
2. The FIFO-with-costless-lots rule. Tests: a grant before a buy, a sale bigger than the open-market lots, a split
   mismatch, an amendment and an indirect row, each with an exact expected percent or exclusion count.
3. The attestation and signup_attempt workaround (legal/owner).
4. Real names in production under T1/T2. Fixtures stay fictional, and the importer is the only path for real names.
5. The feed cursor and load budget.
