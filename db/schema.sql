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

-- Story image. Set once, on the owner's first click of a Save image link. Intent to save, not posting.
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
-- ponytail: if two users already share an account (the exploit) their rows stay; cleanup is a follow-up.
-- Already-claimed accounts are filtered in the same snapshot as the activities: a user deleted (with its claims and
-- activities) by a concurrent transaction is then never re-inserted and failed on the users FK (fix round 2, PR-2a).
insert into broker_accounts (account_id, user_id)
  select distinct on (account_id) account_id, user_id from activities a
  where source = 'snaptrade' and not exists (select 1 from broker_accounts b where b.account_id = a.account_id)
  order by account_id, executed_at
  on conflict (account_id) do nothing;

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
