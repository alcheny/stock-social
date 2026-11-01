-- Raw in, derived out (docs/DESIGN.md §2.3). `activities` is immutable broker data;
-- `closed_trades` is rebuilt from it on every sync and can be dropped and recomputed at any time.
-- `trade_reflections` is the exception: it is USER-SUPPLIED, not derived. Never remove it or rebuild it along with `closed_trades`.
-- `trade_rules` is user-supplied too, with the same rule.

-- Serialized applies: node (scripts/db-setup.ts and every DB-backed test file) sends this file as one simple query,
-- which Postgres runs as a single transaction, so this lock is held for the whole apply and concurrent applies
-- (node --test runs several test files at once; CI starts from an empty database) wait instead of racing on
-- `create table`. With psql, `-1` gives the same single transaction.
select pg_advisory_xact_lock(hashtext('db/schema.sql'));

-- Idempotent additions without needless locks. A plain `add column if not exists` or `create index if not exists`
-- takes an ACCESS EXCLUSIVE or SHARE lock on the table before noticing nothing is missing; applied while another
-- session inserts rows that reference `users`, the two deadlock (F-1 PR-1 fix round 1). These helpers look in the
-- catalog first and take no table lock when the column or index is already there.
create or replace function schema_add_column(tbl text, col text, ddl text) returns void language plpgsql as $f$
begin
  if not exists (select 1 from information_schema.columns where table_schema = current_schema() and table_name = tbl and column_name = col) then
    execute format('alter table %I add column %I %s', tbl, col, ddl);
  end if;
end $f$;
create or replace function schema_add_index(idx text, ddl text) returns void language plpgsql as $f$
begin
  if not exists (select 1 from pg_indexes where schemaname = current_schema() and indexname = idx) then execute ddl; end if;
end $f$;

create table if not exists users (
  id int generated always as identity primary key,
  handle text unique not null check (handle ~ '^[a-z0-9_]{3,20}$'),
  display_name text not null check (char_length(display_name) between 1 and 40),
  adult_attested_at timestamptz not null,           -- Phase 1 is 18+ only
  snaptrade_user_id text unique,
  snaptrade_secret_enc text,                        -- AES-256-GCM, see lib/broker.ts; never sent to the client
  excluded_positions int not null default 0,        -- sells with no recorded entry (shown on profile)
  last_synced_at timestamptz,
  created_at timestamptz not null default now()
);

-- Share moment (issue #66). Measure: share of users with share_prompt_seen_at set whose action is copied/shared.
select schema_add_column('users', 'share_prompt_seen_at', 'timestamptz');
select schema_add_column('users', 'share_prompt_action', $d$text check (share_prompt_action in ('dismissed','copied','shared'))$d$);

-- New trade prompt. Measure: owners with trades_prompt_action not null vs trade_shared_at > trades_prompt_seen_at;
-- shown-but-no-action = trades_prompt_action is null. trade_shared_at covers any owner trade share: an upper bound on prompt-driven sharing.
select schema_add_column('users', 'trades_prompt_seen_at', 'timestamptz');
select schema_add_column('users', 'trades_prompt_action', $d$text check (trades_prompt_action in ('dismissed','opened'))$d$);
select schema_add_column('users', 'trade_shared_at', 'timestamptz');

-- Referral attribution. Set once, only when login inserts a new user via a profile CTA link.
-- Measure by hand: connected referred users / all connected users; per referrer, joined to share_prompt_action.
select schema_add_column('users', 'referred_by_user_id', 'integer references users(id) on delete set null');
-- Which page's CTA brought the signup ('profile' or 'trade'); null = referred before this existed or no referrer. Insert-only.
-- Measure: among referred users with a snaptrade activity, count(*) filter (where referred_via = 'trade') vs 'profile'; nulls reported separately.
select schema_add_column('users', 'referred_via', $d$text check (referred_via in ('profile','trade'))$d$);
-- Which surface's CTA brought the signup: profile|trade|month|badge. Insert-only. No CHECK on purpose: widening the
-- referred_via CHECK needs drop+re-add, which CI forbids; the allow-list lives in normalizeVia.
-- Measure: among referred users with a snaptrade activity, count(*) by coalesce(referred_surface, referred_via); nulls reported separately.
select schema_add_column('users', 'referred_surface', 'text');

-- Embeddable badge. Set once, on the owner's first copy of the embed snippet. Measure: count(*) where badge_copied_at is not null.
select schema_add_column('users', 'badge_copied_at', 'timestamptz');

-- Set once, on the owner's first completed share from the profile's "Share my record" button (share sheet or link
-- copied; fix #27). The name is from the removed Save image link it used to record.
select schema_add_column('users', 'share_image_saved_at', 'timestamptz');

create table if not exists activities (
  id bigint generated always as identity primary key,
  user_id int not null references users on delete cascade,
  source text not null check (source in ('snaptrade', 'demo')),  -- no manual-entry source, by design
  external_id text not null,
  account_id text not null,
  symbol text not null,
  side text not null check (side in ('BUY', 'SELL')),
  units double precision not null check (units > 0),
  price double precision not null check (price > 0),
  fee double precision not null default 0 check (fee >= 0),
  executed_at timestamptz not null,
  raw jsonb not null,                               -- full vendor payload, kept for re-derivation / vendor switch
  created_at timestamptz not null default now(),
  unique (source, external_id)                      -- makes sync idempotent
);
select schema_add_index('activities_user_time', 'create index activities_user_time on activities (user_id, executed_at)');

-- F-1 PR-3 (heavy-use): the rebuild reads a trader's activities in (account, symbol, time, id) keyset pages.
select schema_add_index('activities_user_pair', 'create index activities_user_pair on activities (user_id, account_id, symbol, executed_at, external_id)');
-- F-2 PR-1 fix round 1: a feed page cursor pins its list to what was imported by its asOf (lib/feed.ts): the closes
-- whose sell was imported after it are a small, recent set, read through this index.
select schema_add_index('activities_created', 'create index activities_created on activities (created_at)');
-- F-1 PR-3: the hourly tick's claim (lib/sync.ts#claimNextUser): each trader is synced by one caller per round.
select schema_add_column('users', 'sync_claimed_at', 'timestamptz');
-- F-1 PR-3 fix round 1: the claim's short in-flight lease, cleared when that trader's sync ends or fails.
select schema_add_column('users', 'sync_lease_until', 'timestamptz');

-- No quantities or prices here on purpose: the display layer can't leak position size it doesn't have.
create table if not exists closed_trades (
  id bigint generated always as identity primary key,
  user_id int not null references users on delete cascade,
  sell_id text not null unique,                     -- activities.external_id of the closing sell
  account_id text not null,
  symbol text not null,
  opened_at timestamptz not null,
  closed_at timestamptz not null,
  return_pct double precision not null,
  holding_days double precision not null,
  verified boolean not null,
  thesis text check (char_length(thesis) <= 280),
  thesis_status text check (thesis_status in ('published', 'held'))
);
select schema_add_index('closed_trades_user', 'create index closed_trades_user on closed_trades (user_id, closed_at desc)');
select schema_add_index('closed_trades_recent', 'create index closed_trades_recent on closed_trades (closed_at desc)');

-- TR-6: a broker account belongs to one profile, ever. Claimed on first sync, never released.
create table if not exists broker_accounts (
  account_id text primary key,                       -- vendor account id (SnapTrade account.id)
  source text not null default 'snaptrade' check (source = 'snaptrade'),
  user_id int not null references users on delete cascade,
  claimed_at timestamptz not null default now()
);
select schema_add_index('broker_accounts_user', 'create index broker_accounts_user on broker_accounts (user_id)');
-- Backfill: existing real data is claimed by its earliest user.
-- Profiles that already shared an account (the exploit) keep their raw rows: scripts/shared-accounts.ts reports them
-- and, when the owner asks, marks them (shared_account_marks, below) so only the claimant's record shows the account.
-- Already-claimed accounts are filtered in the same snapshot as the activities: a user deleted (with its claims and
-- activities) by a concurrent transaction is then never re-inserted and failed on the users FK (fix round 2, PR-2a).
-- CI review (2026-11-01, privacy PR): a users row deleted by another session between this snapshot and the insert's
-- foreign-key check raised 23503 and rolled back the whole apply (node:test files apply this file in parallel while
-- others delete their users). The backfill is idempotent, so on that error it is skipped and the next apply runs it.
do $bf$
begin
  insert into broker_accounts (account_id, user_id)
    select distinct on (account_id) account_id, user_id from activities a
    where source = 'snaptrade' and not exists (select 1 from broker_accounts b where b.account_id = a.account_id)
    order by account_id, executed_at
    on conflict (account_id) do nothing;
exception when foreign_key_violation then null;
end $bf$;

-- Private ticker watchlist: a user-owned preference. last_seen_at drives "new since you last looked".
create table if not exists ticker_watches (
  user_id int not null references users on delete cascade,
  symbol text not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (user_id, symbol)
);

-- set once, on the owner's first open of /me/record
select schema_add_column('users', 'record_first_viewed_at', 'timestamptz');
-- repeat-visit record: a visit is an open 30+ minutes after the last one
select schema_add_column('users', 'record_last_viewed_at', 'timestamptz');
select schema_add_column('users', 'record_prev_viewed_at', 'timestamptz');
select schema_add_column('users', 'record_view_count', 'int not null default 0');

-- Theses whose trade a rebuild no longer produces (an account flagged simulated, a vendor correction), kept by the
-- closing sell's id so rebuildTrades never deletes a thesis (published or held); re-attached when the trade returns.
-- Never read by any page: a thesis whose trade is excluded is simply not shown. sell_id has no foreign key on purpose.
-- A row stays after its trade returns (a thesis on the closed_trades row wins); saving or clearing that thesis removes it.
create table if not exists kept_theses (
  user_id int not null references users on delete cascade,
  sell_id text not null,
  thesis text not null check (char_length(thesis) <= 280),
  thesis_status text check (thesis_status in ('published', 'held')),
  unique (user_id, sell_id)
);

-- Private 'why I took it' tags. Rows reattach to trades by sell_id, like theses.
-- sell_id deliberately has NO foreign key: rebuildTrades deletes closed_trades rows.
-- Rows whose sell_id matches no trade are kept and ignored on read; never clean them up.
create table if not exists trade_reflections (
  user_id int not null references users on delete cascade,
  sell_id text not null,
  reason text not null check (reason in ('planned', 'catalyst', 'tip', 'impulse', 'other')),
  created_at timestamptz not null default now(),
  unique (user_id, sell_id)
);

-- Private personal rules. USER-SUPPLIED, not derived: never rebuild it with closed_trades and never remove it in rebuildTrades.
-- Stores a kind and a day count only: no quantities, no prices. Private to the owner; never read by public pages, the feed or the share card.
create table if not exists trade_rules (
  user_id int not null references users on delete cascade,
  kind text not null check (kind in ('cut_losers', 'hold_winners')),
  days int not null check (days between 1 and 365),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, kind)
);

-- F-1 sign-in (docs/features/logs/F-1/plan.md §3). The 18+ attestation lives on a signup_attempts row that
-- exists BEFORE any user row; users.signup_attempt_id is required, so no account exists without one.
-- No personal data here: method, timestamps, vendor ids and referral only.
create table if not exists signup_attempts (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  method text not null check (method in ('provider_a', 'provider_b', 'email', 'brokerage', 'dev')),
  adult_attested_at timestamptz not null,
  snaptrade_user_id text,
  snaptrade_secret_enc text,
  referred_by_user_id int references users(id) on delete set null,
  referred_surface text,
  user_id int references users(id) on delete set null,
  completed_at timestamptz
);
select schema_add_column('users', 'signup_attempt_id', 'bigint references signup_attempts(id)');
select schema_add_column('users', 'deleted_at', 'timestamptz');
-- Backfill, once: rows from before F-1 attested through the dev form at created_at; one attempt each, then the column is
-- required. Runs only while the column is still nullable (the first apply); afterwards no row can lack an attempt and
-- the block takes no lock at all.
do $b$
begin
  if exists (select 1 from information_schema.columns where table_schema = current_schema() and table_name = 'users'
             and column_name = 'signup_attempt_id' and is_nullable = 'YES') then
    insert into signup_attempts (method, adult_attested_at, user_id, completed_at, created_at)
      select 'dev', u.adult_attested_at, u.id, u.created_at, u.created_at from users u where u.signup_attempt_id is null;
    update users u set signup_attempt_id = a.id from signup_attempts a where a.user_id = u.id and u.signup_attempt_id is null;
    alter table users alter column signup_attempt_id set not null;
  end if;
end $b$;
-- The attempt purge's "no users row" check and the foreign-key check on every signup_attempts delete (lib/privacy-purge.ts).
select schema_add_index('users_signup_attempt', 'create index users_signup_attempt on users (signup_attempt_id)');

-- One row per sign-in method a user has used. subject is the provider's stable id (or the address for 'email').
create table if not exists identities (
  user_id int not null references users on delete cascade,
  provider text not null check (provider in ('provider_a', 'provider_b', 'email')),
  subject text not null,
  email text,
  created_at timestamptz not null default now(),
  unique (provider, subject)
);
select schema_add_index('identities_user', 'create index identities_user on identities (user_id)');
-- Sign-in by email (lib/auth/attempts.ts#signInWithIdentity).
select schema_add_index('identities_email', 'create index identities_email on identities (email) where email is not null');

-- Sessions: the cookie holds a signed random token; only its sha256 is stored.
create table if not exists sessions (
  token_hash text primary key,
  user_id int not null references users on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default now()
);
select schema_add_index('sessions_user', 'create index sessions_user on sessions (user_id)');

-- Passwordless email links: single use, 15 minutes, hashed token.
create table if not exists login_links (
  token_hash text primary key,
  email text not null,
  attempt_id bigint not null references signup_attempts(id),
  expires_at timestamptz not null,
  used_at timestamptz
);
select schema_add_index('login_links_attempt', 'create index login_links_attempt on login_links (attempt_id)');
-- Account deletion's email match (lib/delete.ts#LOGIN_LINKS_DELETE states email <> ''); claimed links are blanked to ''.
select schema_add_index('login_links_email', $$create index login_links_email on login_links (email) where email <> ''$$);

-- A deleted profile's handle stays unavailable for a year. Handle and date only: no personal data.
create table if not exists handle_reservations (
  handle text primary key,
  until timestamptz not null
);

-- Sign-up funnel, per attempt (plan §5). meta keys are allow-listed in lib/funnel.ts; never personal data.
create table if not exists funnel_events (
  id bigint generated always as identity primary key,
  attempt_id bigint not null references signup_attempts(id),
  name text not null check (name in ('landed', 'method_chosen', 'attested', 'notice_seen', 'portal_opened', 'link_succeeded',
    'no_real_account', 'consented', 'declined', 'expired', 'abandoned', 'failed', 'import_finished', 'own_profile_viewed')),
  at timestamptz not null default now(),
  meta jsonb not null default '{}'
);
select schema_add_index('funnel_events_attempt', 'create index funnel_events_attempt on funnel_events (attempt_id, at)');

-- F-1 PR-2a: one row per brokerage connection attempt (docs/features/logs/F-1/plan.md §1, §3). States and one
-- timestamp per state; the legal transitions live in lib/connections.ts. No personal data: vendor ids, counts and
-- timestamps only. `accounts` is the vendor's account list at link time (ids, institution, paper flag), the
-- provisional claim of a brokerage-first attempt that has no users row yet (confirmed into broker_accounts at consent).
create table if not exists connections (
  id bigint generated always as identity primary key,
  attempt_id bigint not null references signup_attempts(id),
  user_id int references users(id) on delete cascade,
  vendor_authorization_id text,
  institution text,
  state text not null check (state in ('pending', 'importing', 'connected', 'declined', 'expired', 'failed')),
  pending_at timestamptz not null default now(),
  importing_at timestamptz,
  connected_at timestamptz,
  declined_at timestamptz,
  expired_at timestamptz,
  failed_at timestamptz,
  consent_at timestamptz,
  import_cursor jsonb not null default '{}',
  imported_count int not null default 0,
  last_progress_at timestamptz,
  failure_reason text check (failure_reason in ('stale', 'vendor', 'link_closed', 'link_error')),
  portal_mode text check (portal_mode in ('embedded', 'redirect')),
  accounts jsonb not null default '[]',
  cleanup_done_at timestamptz,
  disconnected_at timestamptz
);
select schema_add_index('connections_user', 'create index connections_user on connections (user_id)');
select schema_add_index('connections_state', 'create index connections_state on connections (state)');
-- The attempt purge's per-attempt checks and deletes, and the foreign-key check on every signup_attempts delete.
select schema_add_index('connections_attempt', 'create index connections_attempt on connections (attempt_id)');
-- Committee fix (Low, PR-2a round 6): rows cleaned before cleanup blanked the snapshot still hold one. A declined or
-- expired row that cleanup has finished and that ended over 24 h ago keeps no account snapshot or institution; ids,
-- states and timestamps stay for the funnel. Idempotent (a blanked row no longer matches); never deletes a row.
update connections set accounts = '[]'::jsonb, institution = null
  where state in ('declined', 'expired') and cleanup_done_at is not null
    and coalesce(declined_at, expired_at, pending_at) < now() - interval '24 hours'
    and (accounts <> '[]'::jsonb or institution is not null);

-- Claims are provisional until consent (confirmed_at); provisional rows are released on decline, expiry or when no real
-- account was found, confirmed rows never. Simulated ("paper") accounts are claimed, excluded from the record and
-- counted; the flag is re-read on every sync.
select schema_add_column('broker_accounts', 'connection_id', 'bigint references connections(id) on delete set null');
select schema_add_column('broker_accounts', 'confirmed_at', 'timestamptz');
select schema_add_column('broker_accounts', 'removed_at', 'timestamptz');
select schema_add_column('broker_accounts', 'is_paper', 'boolean not null default false');
select schema_add_column('broker_accounts', 'paper_seen_at', 'timestamptz');

-- F-1 PR-3 fix round 6: activities dated more than a day in the future, quarantined by the rebuild (lib/sync.ts), counted.
select schema_add_column('users', 'excluded_future', 'int not null default 0');

-- Rows from before F-1 were claimed by a completed sync: confirmed.
update broker_accounts set confirmed_at = claimed_at where confirmed_at is null and connection_id is null;

-- Open positions (TR-4): symbol and unrealized percent only. No units, prices or amounts, on purpose.
create table if not exists open_positions (
  user_id int not null references users on delete cascade,
  account_id text not null,
  symbol text not null,
  unrealized_pct double precision not null,
  fetched_at timestamptz not null default now(),
  primary key (user_id, account_id, symbol)
);

-- F-2 PR-2 (docs/features/logs/F-2/plan.md): the state a signed-in viewer chose, private to that viewer. No page or
-- route reads it for anyone else and nothing counts it (POLICY F6). No event rows of any kind before PR-5.
-- Either account's deletion cascades; deleting the viewer also removes them first (lib/delete.ts).
create table if not exists follows (
  viewer_id int not null references users on delete cascade,
  trader_id int not null references users on delete cascade,
  created_at timestamptz not null default now(),
  primary key (viewer_id, trader_id),
  check (viewer_id <> trader_id)
);
select schema_add_index('follows_trader', 'create index follows_trader on follows (trader_id)');
-- "Not interested" and unfollow: 90-day exclusions. The feed honors only 'not_interested' (fix round 1; the owner can
-- switch it, lib/discovery/weights.ts#FEED_HIDES_UNFOLLOWED); 'unfollow' is kept for PR-3's suggestions. Undo and "Show again"
-- end it (until = now()) without deleting; the sync tick deletes rows ended over a day ago (lib/discovery/purge.ts).
create table if not exists viewer_exclusions (
  viewer_id int not null references users on delete cascade,
  trader_id int not null references users on delete cascade,
  created_at timestamptz not null default now(),
  until timestamptz not null,
  reason text not null check (reason in ('not_interested', 'unfollow')),
  primary key (viewer_id, trader_id),
  check (viewer_id <> trader_id)
);
select schema_add_index('viewer_exclusions_trader', 'create index viewer_exclusions_trader on viewer_exclusions (trader_id)');
-- Fix round 1: when the viewer saw "Only you can see this." (the privacy line shows once per viewer, ever).
select schema_add_column('users', 'follow_notice_at', 'timestamptz');
select schema_add_index('viewer_exclusions_until', 'create index viewer_exclusions_until on viewer_exclusions (until)');
-- Deleting a users row checks users.referred_by_user_id (on delete set null): without an index that is a scan of users
-- per deleted account (found by the heavy check: removing its 100,000 fixture viewers took minutes).
select schema_add_index('users_referred_by', 'create index users_referred_by on users (referred_by_user_id) where referred_by_user_id is not null');
-- F-2 PR-4 (plan §PR-4): a close's stable key across rebuilds. sha256 of the sell id's UTF-8 bytes; doubling every
-- backslash makes the bytea input read the text literally (no escape or \x parsing); every function is immutable.
-- Equal to node:crypto's sha256 hex (lib/likes.ts#tradeKey, lib/likes.test.ts).
select schema_add_column('closed_trades', 'trade_key', $$text generated always as (encode(sha256(replace(sell_id, chr(92), chr(92) || chr(92))::bytea), 'hex')) stored$$);
select schema_add_index('closed_trades_trade_key', 'create index closed_trades_trade_key on closed_trades (trade_key)');
-- Private likes (double tap, +3): one row per viewer and close, never counted or shown to anyone else. No foreign key on
-- trade_key: a rebuild deletes closed_trades rows; a like whose close is gone is kept and ignored on read.
create table if not exists trade_likes (
  viewer_id int not null references users on delete cascade,
  trade_key text not null,
  trader_id int not null references users on delete cascade,
  created_at timestamptz not null default now(),
  primary key (viewer_id, trade_key),
  check (viewer_id <> trader_id)
);
select schema_add_index('trade_likes_trader', 'create index trade_likes_trader on trade_likes (trader_id)');
select schema_add_index('trade_likes_viewer_at', 'create index trade_likes_viewer_at on trade_likes (viewer_id, created_at desc, trade_key desc)');
-- A rejected trade (the feed card's reject swipe or "Hide this trade"): hidden from this viewer's feed for good (O3,
-- committee recommendation). The trader-level −4 it also carries counts for 90 days from created_at (PR-5 reads it).
create table if not exists trade_exclusions (
  viewer_id int not null references users on delete cascade,
  trade_key text not null,
  trader_id int not null references users on delete cascade,
  created_at timestamptz not null default now(),
  primary key (viewer_id, trade_key),
  check (viewer_id <> trader_id)
);
-- Fix round 1: when the hidden trade was liked, the like's time (Undo restores the like; a hidden trade is never liked).
select schema_add_column('trade_exclusions', 'liked_at', 'timestamptz');
select schema_add_index('trade_exclusions_trader', 'create index trade_exclusions_trader on trade_exclusions (trader_id)');

-- Sharded hourly sync (docs/SYNC.md; committee docs/features/logs/sync/committee-2026-11-01.md). A trader's shard is
-- `id % of`; the per-user round claim above stays the durable record of who is synced this round.
-- Trader-specific failures back off (1 h doubling, capped at 24 h): the count and the earliest next attempt.
select schema_add_column('users', 'sync_failures', 'int not null default 0');
select schema_add_column('users', 'sync_retry_at', 'timestamptz');
-- Claims whose sync never finished (the process died): incremented at claim, cleared when an attempt ends. Two
-- unfinished claims quarantine the trader (a backoff), so one poison record never stalls its shard.
select schema_add_column('users', 'sync_attempts', 'int not null default 0');
-- The shard's queue order (stalest first), read a page at a time.
-- ponytail: the shard filter (`id % of = shard`) is applied after this index, so each shard's page reads past the other
-- shards' rows (measured 21-26 ms a page at 100k) — an expression index per fixed shard count would avoid it.
select schema_add_index('users_sync_order', 'create index users_sync_order on users (last_synced_at nulls first, id) where snaptrade_user_id is not null and deleted_at is null');
-- One row per shard of a shard count: the run lease (database clock, fenced by `holder`), a heartbeat, and the last
-- run's counters (numbers only) for the coverage report.
create table if not exists sync_shards (
  of int not null check (of between 1 and 1024),
  shard int not null check (shard >= 0 and shard < of),
  lease_until timestamptz,
  holder text,
  run_started_at timestamptz,
  heartbeat_at timestamptz,
  last_run jsonb,
  primary key (of, shard)
);
-- The current failure streak: its class ('refused', 'trader', 'quarantined') and when it began (shard 0's coverage line
-- reports refusals and the oldest one's age, numbers only). Cleared by a successful sync.
select schema_add_column('users', 'sync_failure_kind', $d$text check (sync_failure_kind in ('refused','trader','quarantined'))$d$);
select schema_add_column('users', 'sync_failing_since', 'timestamptz');
-- Consecutive transient failures (lib/sync-limits.ts#TRANSIENT_LIMIT): at the limit the trader is quarantined (backed
-- off) instead of being retried every round forever. Cleared by a successful sync.
select schema_add_column('users', 'sync_transients', 'int not null default 0');
-- ---- F-2 PR-5 (docs/features/logs/F-2/plan-pr5-ux-lead.md): the viewer's activity log and personalization settings ----
-- Two per-viewer switches. personalize_feed (default on): ordering may use the viewer's own follows, likes and hides;
-- off, the viewer gets the order everyone gets minus their own hides. activity_log_on_at (default null = off, owner
-- 2026-11-01): when set, the implicit logger runs and its events shape ordering; off, nothing is logged or used.
select schema_add_column('users', 'personalize_feed', 'boolean not null default true');
select schema_add_column('users', 'activity_log_on_at', 'timestamptz');
-- Lookup tables, not CHECKs (widening a CHECK needs a drop). Seeded idempotently.
create table if not exists discovery_event_types (code smallint primary key, name text not null unique);
create table if not exists discovery_surfaces (code smallint primary key, name text not null unique);
insert into discovery_event_types (code, name) values (1, 'impression'), (2, 'dwell_short'), (3, 'dwell_long'), (4, 'skip'),
  (5, 'swipe_open'), (6, 'profile_open'), (7, 'share'), (8, 'watch'), (9, 'unwatch') on conflict do nothing;
insert into discovery_surfaces (code, name) values (1, 'feed'), (2, 'pane'), (3, 'profile'), (4, 'section'), (5, 'me') on conflict do nothing;
-- One row per implicit event: viewer, surface, target (trader, trade or symbol), type and time only. No address, device,
-- IP, user agent, amount, price or broker field (criterion 3, lib/f2-personal.db.test.ts). A trade target keeps its
-- trader too (the close's stable trade_key; no foreign key: a rebuild deletes closed_trades rows). Stored until the
-- viewer clears it or deletes the account (owner 2026-11-01); only the last 90 days are read, fading.
create table if not exists discovery_events (
  id bigint generated always as identity primary key,
  viewer_id int not null references users on delete cascade,
  at timestamptz not null default now(),
  surface smallint not null references discovery_surfaces,
  type smallint not null references discovery_event_types,
  target_kind text not null check (target_kind in ('trader', 'trade', 'symbol')),
  target_user_id int references users on delete cascade,
  target_trade_key text,
  target_symbol text,
  check ((target_kind = 'trader' and target_user_id is not null and target_trade_key is null and target_symbol is null)
    or (target_kind = 'trade' and target_user_id is not null and target_trade_key is not null and target_symbol is null)
    or (target_kind = 'symbol' and target_user_id is null and target_trade_key is null and target_symbol is not null)),
  check (viewer_id <> target_user_id)
);
select schema_add_index('discovery_events_viewer_at', 'create index discovery_events_viewer_at on discovery_events (viewer_id, at desc)');
select schema_add_index('discovery_events_target_user', 'create index discovery_events_target_user on discovery_events (target_user_id)');
select schema_add_index('discovery_events_trade_key', 'create index discovery_events_trade_key on discovery_events (target_trade_key) where target_trade_key is not null');
-- Likes and rejected trades looked up by key (lib/privacy-purge.ts orphans, lib/discovery/personal-load.ts).
select schema_add_index('trade_likes_key', 'create index trade_likes_key on trade_likes (trade_key)');
select schema_add_index('trade_exclusions_key', 'create index trade_exclusions_key on trade_exclusions (trade_key)');
select schema_add_index('trade_exclusions_viewer_at', 'create index trade_exclusions_viewer_at on trade_exclusions (viewer_id, created_at desc, trade_key desc)');
-- The events route's per-viewer gate (one batch per 2 s, held by a row lock, so it holds across server instances).
select schema_add_column('users', 'activity_batch_at', 'timestamptz');
-- F-2 PR-5 (owner 2026-11-01: preference data is stored until the viewer removes it): when the viewer ended an
-- exclusion themselves (Undo, "Show again", a new follow). The purge deletes only those, a day later, and ended 'unfollow'
-- rows (the system's −1 record of a removed follow); a "Not interested" that ran its 90 days stays stored, unread.
-- Backfill once, when the column is added (deletes nothing): rows that ended before their 90 days were ended by the viewer.
-- Never on a later apply: every test file applies this file, and an update here would touch rows other sessions hold.
do $f$ begin
  if not exists (select 1 from information_schema.columns where table_schema = current_schema() and table_name = 'viewer_exclusions' and column_name = 'ended_at') then
    alter table viewer_exclusions add column ended_at timestamptz;
    update viewer_exclusions set ended_at = until where until <= now() and until < created_at + interval '90 days' - interval '1 minute';
  end if;
end $f$;
-- Orphaned likes and hidden trades are marked in privacy_orphans and purged by lib/privacy-purge.ts (one mechanism).
-- Review fix 5: the purge reads only the rows it may delete through a partial index (expired "Not interested" rows are
-- kept, so a scan over every exclusion would grow with history).
select schema_add_index('viewer_exclusions_purgeable', $$create index viewer_exclusions_purgeable on viewer_exclusions (until) where reason = 'unfollow' or ended_at is not null$$);
-- Tester finding 1: the events gate is a window (at most 3 batches per 10 s), so a page-leave batch right after the
-- periodic one is kept.
select schema_add_column('users', 'activity_batch_n', 'smallint not null default 0');
-- ---- F-3 · Viewer subscriptions and Record tools (docs/features/F-3-viewer-subscriptions.md; legal committee record
-- docs/features/logs/F-3/committee-2026-11-01.md). The processor holds charges, refunds, tax and card data; the app
-- keeps ids, plan, status and dates only (committee condition 20). No card, name, email, address or tax-location column.
create table if not exists billing_customers (
  user_id int primary key references users on delete cascade,
  vendor_customer_id text unique not null,
  created_at timestamptz not null default now()
);
-- Entitlements are read from this row, never from a live processor call. One live row per user (partial unique index).
create table if not exists subscriptions (
  id int generated always as identity primary key,
  user_id int not null references users on delete cascade,
  vendor_subscription_id text unique not null,
  vendor_customer_id text not null,
  plan text not null check (plan in ('monthly', 'annual')),
  status text not null check (status in ('trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused', 'incomplete')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  grace_until timestamptz,
  disputed_at timestamptz,
  ended_reason text check (ended_reason in ('refund', 'trader', 'deletion')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- ponytail: 'incomplete' (a first payment being confirmed) is outside the one-live index; lib/billing.ts#startCheckout
-- refuses a second checkout while one exists — add it to the index (a new index name) to enforce it in the database.
select schema_add_index('subscriptions_one_live', $$create unique index subscriptions_one_live on subscriptions (user_id) where status in ('trialing', 'active', 'past_due')$$);
select schema_add_index('subscriptions_user', 'create index subscriptions_user on subscriptions (user_id)');
-- The dispute webhooks' updates by customer (lib/billing.ts).
select schema_add_index('subscriptions_customer', 'create index subscriptions_customer on subscriptions (vendor_customer_id)');
-- The webhook inbox: one row per processor event id (duplicates are no-ops). No payload (committee condition 20); the
-- handler fetches the object from the processor by id. Purged 35 days after receipt by the nightly reconciliation.
create table if not exists billing_events (
  vendor_event_id text primary key,
  type text not null,
  vendor_object_id text,
  vendor_customer_id text,
  livemode boolean not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error_code text,
  flagged boolean not null default false,
  claimed_at timestamptz -- a delivery's 2-minute lease while it applies the event (concurrent duplicates are no-ops)
);
select schema_add_index('billing_events_received', 'create index billing_events_received on billing_events (received_at)');
select schema_add_index('billing_events_customer', 'create index billing_events_customer on billing_events (vendor_customer_id)');
-- When the daily reconciliation last started (lib/billing.ts#reconcileIfDue, run from the hourly sync tick).
create table if not exists billing_runs (
  job text primary key,
  last_at timestamptz not null
);
-- Renewal consent (committee condition 16): the full disclosure text's version and hash, never an IP, email or name.
-- At account deletion user_id is nulled and the row is kept 3 years under the processor customer id (retain_until).
create table if not exists billing_consents (
  id int generated always as identity primary key,
  user_id int references users on delete set null,
  vendor_customer_id text,
  plan text not null check (plan in ('monthly', 'annual')),
  disclosure_version text not null,
  disclosure_hash text not null,
  livemode boolean not null,
  created_at timestamptz not null default now(),
  retain_until timestamptz
);
select schema_add_index('billing_consents_user', 'create index billing_consents_user on billing_consents (user_id)');
-- Record tools: saved views (name and ordered traders only, never a snapshot of numbers) and private notes, visible only
-- to their owner. A view's id is random (owner-only URL). Either account's deletion cascades.
create table if not exists record_views (
  id uuid primary key default gen_random_uuid(),
  owner_id int not null references users on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
select schema_add_index('record_views_owner', 'create index record_views_owner on record_views (owner_id, created_at)');
create table if not exists record_view_traders (
  view_id uuid not null references record_views on delete cascade,
  trader_id int not null references users on delete cascade,
  position int not null,
  primary key (view_id, trader_id)
);
select schema_add_index('record_view_traders_trader', 'create index record_view_traders_trader on record_view_traders (trader_id)');
create table if not exists record_notes (
  owner_id int not null references users on delete cascade,
  trader_id int not null references users on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  updated_at timestamptz not null default now(),
  primary key (owner_id, trader_id),
  check (owner_id <> trader_id)
);
select schema_add_index('record_notes_trader', 'create index record_notes_trader on record_notes (trader_id)');
-- Committee condition 12: a count of removals from this owner's views and notes since the last visit, no trader id kept.
create table if not exists record_tool_notices (
  owner_id int primary key references users on delete cascade,
  removed int not null default 0
);

-- Privacy work (2026-11-01, docs/features/logs/privacy/committee-2026-11-01.md). Every table here is in
-- lib/privacy-retention.ts#SCHEMA_MAP (a test fails for a table without an entry).
-- D10: a like or rejected trade whose trade is gone. This supersedes "kept and ignored on read" above for likes and
-- rejects only: the tick (lib/privacy-purge.ts) marks one when its trade_key first matches no closed trade, clears the
-- mark when the trade is back (a simulated flag lifted, a vendor correction), and removes the like or reject only after
-- 30 days orphaned. A like with a live trade is never removed by any timer (owner, 2026-11-01).
create table if not exists privacy_orphans (
  kind text not null check (kind in ('like', 'reject')),
  viewer_id int not null references users on delete cascade,
  trade_key text not null,
  first_seen_at timestamptz not null default now(),
  primary key (kind, viewer_id, trade_key)
);
select schema_add_index('privacy_orphans_seen', 'create index privacy_orphans_seen on privacy_orphans (first_seen_at)');
select schema_add_index('sessions_expires', 'create index sessions_expires on sessions (expires_at)');
select schema_add_index('login_links_expires', 'create index login_links_expires on login_links (expires_at)');
select schema_add_index('signup_attempts_open', 'create index signup_attempts_open on signup_attempts (created_at) where user_id is null and completed_at is null');

-- D14: append-only display log. One row per public record per day: what the profile displayed (headline, 95% range,
-- trade count, open-position summary, evidence line), percent only, so the app can show what it displayed on a past
-- date (lib/display-log.ts). Never updated; never removed except with the account (the users cascade). The trigger
-- lets a row go only when its users row is already gone. Known limit: a truncate is not trapped.
create table if not exists display_log (
  user_id int not null references users on delete cascade,
  day date not null,
  demo boolean not null,
  headline text not null,
  range_text text,
  trade_count int not null,
  open_summary text not null,
  evidence text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, day)
);
create or replace function display_log_append_only() returns trigger language plpgsql as $f$
begin
  if tg_op = 'DELETE' and not exists (select 1 from users where id = old.user_id) then return old; end if;
  raise exception 'display_log is append-only (% refused)', tg_op;
end $f$;
do $t$
begin
  if not exists (select 1 from pg_trigger where tgname = 'display_log_append_only' and not tgisinternal) then
    create trigger display_log_append_only before update or delete on display_log for each row execute function display_log_append_only();
  end if;
end $t$;
-- F-6 (review N4): stock pages count open positions by symbol (aggregate only, docs/features/logs/F-6/plan.md §6).
select schema_add_index('open_positions_symbol', 'create index open_positions_symbol on open_positions (symbol)');
-- Deleting a users row sets signup_attempts.user_id and .referred_by_user_id to null (on delete set null): without an
-- index each is a scan of signup_attempts (one row per sign-up), for every user deleted (profile deletions; the sharded
-- sync load test deletes 100,000 traders: 5 minutes of scans). Partial, like users_referred_by.
select schema_add_index('signup_attempts_user', 'create index signup_attempts_user on signup_attempts (user_id) where user_id is not null');
select schema_add_index('signup_attempts_referred_by', 'create index signup_attempts_referred_by on signup_attempts (referred_by_user_id) where referred_by_user_id is not null');
-- The same for broker_accounts.connection_id (on delete set null): a deleted connection scanned every claim (sharded
-- sync load test: quadratic at 100,000 traders; profile deletions too).
select schema_add_index('broker_accounts_connection', 'create index broker_accounts_connection on broker_accounts (connection_id) where connection_id is not null');

-- Corporate actions (POLICY F3c, docs/features/logs/corporate-actions/committee-2026-11-01.md): the vendor's split,
-- stock-dividend, symbol-change and other share-moving rows, raw and immutable like `activities`, mapped by
-- lib/corporate-actions.ts#fromVendorRows. The rebuild applies them to the FIFO lots (lib/trades.ts#matchTrades).
-- Deleted with the profile (cascade). Filled by the sync and the import step (lib/broker.ts#fetchShareMoves).
create table if not exists corporate_actions (
  id bigint generated always as identity primary key,
  user_id int not null references users on delete cascade,
  source text not null check (source in ('snaptrade', 'demo')),
  external_id text not null,
  account_id text not null,
  symbol text not null,
  kind text not null check (kind in ('split', 'stock-dividend', 'symbol-change', 'unpriceable')),
  detail jsonb not null,                            -- the mapped fields: ratio, units, newSymbol, reason, scope
  executed_at timestamptz not null,
  raw jsonb not null,                               -- full vendor payload, kept for re-derivation
  created_at timestamptz not null default now(),
  unique (source, external_id)
);
select schema_add_index('corporate_actions_user', 'create index corporate_actions_user on corporate_actions (user_id, executed_at)');
-- Sells the importer can't price exactly because of a corporate action, counted by the rebuild (shown on the profile).
select schema_add_column('users', 'excluded_corporate', 'int not null default 0');

-- Security hardening (2026-11-01)
-- Shared fixed-window rate limits (lib/rate-limit.ts#hit): one row per key and window, counted by an upsert, so every
-- server instance sees the same count. Keys are scope + HMAC, never an address or an IP. Old windows are pruned by
-- hit() itself, never here.
create table if not exists rate_limits (
  key text not null,
  window_start timestamptz not null,
  n int not null,
  primary key (key, window_start)
);
-- The ticker page, its card, compare, browse and the sitemap read closed_trades by symbol.
select schema_add_index('closed_trades_symbol', 'create index closed_trades_symbol on closed_trades (symbol, closed_at desc)');
-- Security hardening review (2026-11-01): the prune in lib/rate-limit.ts reads old windows by start time.
select schema_add_index('rate_limits_window', 'create index rate_limits_window on rate_limits (window_start)');
-- The last time per key (the import poll: one step per trader per second, lib/rate-limit.ts#intervalAllowed), shared by
-- every instance. Keys are a scope and an id; marks older than a day are pruned by the same file, never here.
create table if not exists rate_marks (
  key text primary key,
  at timestamptz not null
);
-- The vendor portal framing probe's answer per vendor origin (lib/portal-probe.ts), shared by every instance. Vendor
-- origins only, no personal data; a row is overwritten when it is asked again after `until`.
create table if not exists portal_probes (
  origin text primary key,
  mode text not null check (mode in ('embedded', 'redirect')),
  until timestamptz not null
);

-- Known limits 2026-11-01 (docs/features/logs/known-limits/committee-2026-11-01.md).
-- TR-6, a stable account identity: a keyed hash of the institution and the vendor's institution account id
-- (lib/claims.ts#accountIdentity; never the raw identifier). Not unique: one profile may hold the same brokerage account
-- under several vendor ids (one per connection); a second profile may not (checked under a per-identity lock).
select schema_add_column('broker_accounts', 'identity', 'text');
select schema_add_index('broker_accounts_identity', 'create index broker_accounts_identity on broker_accounts (identity) where identity is not null');
-- TR-6, accounts shared before the claim existed: a profile holding activities of an account broker_accounts gives to
-- another profile (the earliest activity's, from the backfill above). Marked only by the owner's script
-- (scripts/shared-accounts.ts --mark), never by this file; nothing is deleted. A marked (account, profile) is left out
-- of that profile's rebuild like a simulated account, so the earliest claim alone shows the account's trades.
create table if not exists shared_account_marks (
  account_id text not null,
  user_id int not null references users on delete cascade,
  marked_at timestamptz not null default now(),
  primary key (user_id, account_id)
);
-- Feed paging, bounded (lib/feed.ts#importedBy): when the closing sell of each close was imported (its activity's
-- created_at). A feed page pinned to asOf leaves out closes whose sell was imported after asOf; reading this per close
-- replaced reading every sell imported since asOf, which a crafted `?after=` could make large. Set by the trigger below
-- on every insert (the rebuild inserts every close after its activities), so no writer has to set it. Null reads as
-- "imported before any cursor": added once with a backfill of only the sells of the last 49 hours (cursors live at
-- most 48 hours, lib/discovery/pager.ts#CURSOR_MAX_AGE_MS), inside the branch that adds the column, so later applies
-- and the parallel test files never run it.
-- One unique-index probe per row (activities' unique (source, external_id); no user index for the planner to prefer on
-- a fresh import's unanalyzed rows). The same match as the feed's old late filter: any source, the sell side.
create or replace function closed_trades_sell_imported_at() returns trigger language plpgsql as $f$
begin
  new.sell_imported_at := (select max(created_at) from activities where source in ('snaptrade', 'demo') and external_id = new.sell_id and side = 'SELL');
  return new;
end $f$;
do $si$
begin
  if not exists (select 1 from information_schema.columns where table_schema = current_schema() and table_name = 'closed_trades' and column_name = 'sell_imported_at') then
    alter table closed_trades add column sell_imported_at timestamptz;
    update closed_trades t set sell_imported_at = a.created_at
      from (select external_id, max(created_at) as created_at from activities where created_at > now() - interval '49 hours' and side = 'SELL' group by external_id) a
      where a.external_id = t.sell_id;
    -- In the same block (orchestrator review): no close is inserted between the backfill and the trigger.
    if not exists (select 1 from pg_trigger where tgname = 'closed_trades_sell_imported_at' and not tgisinternal) then
      create trigger closed_trades_sell_imported_at before insert on closed_trades for each row execute function closed_trades_sell_imported_at();
    end if;
  end if;
end $si$;
do $t$
begin
  if not exists (select 1 from pg_trigger where tgname = 'closed_trades_sell_imported_at' and not tgisinternal) then
    create trigger closed_trades_sell_imported_at before insert on closed_trades for each row execute function closed_trades_sell_imported_at();
  end if;
end $t$;
-- The weight fingerprint counts, per listed trader, the closes imported after asOf (lib/feed.ts candidateQuery `ol`).
select schema_add_index('closed_trades_imported', 'create index closed_trades_imported on closed_trades (user_id, sell_imported_at) where sell_imported_at is not null');
