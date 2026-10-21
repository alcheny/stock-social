-- Raw in, derived out (docs/DESIGN.md §2.3). `activities` is immutable broker data;
-- `closed_trades` is rebuilt from it on every sync and can be dropped and recomputed at any time.

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
alter table users add column if not exists share_prompt_seen_at timestamptz;
alter table users add column if not exists share_prompt_action text check (share_prompt_action in ('dismissed','copied','shared'));

-- New trade prompt. Measure: owners with trades_prompt_action not null vs trade_shared_at > trades_prompt_seen_at;
-- shown-but-no-action = trades_prompt_action is null. trade_shared_at covers any owner trade share: an upper bound on prompt-driven sharing.
alter table users add column if not exists trades_prompt_seen_at timestamptz;
alter table users add column if not exists trades_prompt_action text check (trades_prompt_action in ('dismissed','opened'));
alter table users add column if not exists trade_shared_at timestamptz;

-- Referral attribution. Set once, only when login inserts a new user via a profile CTA link.
-- Measure by hand: connected referred users / all connected users; per referrer, joined to share_prompt_action.
alter table users add column if not exists referred_by_user_id integer references users(id) on delete set null;
-- Which page's CTA brought the signup ('profile' or 'trade'); null = referred before this existed or no referrer. Insert-only.
-- Measure: among referred users with a snaptrade activity, count(*) filter (where referred_via = 'trade') vs 'profile'; nulls reported separately.
alter table users add column if not exists referred_via text check (referred_via in ('profile','trade'));
-- Which surface's CTA brought the signup: profile|trade|month|badge. Insert-only. No CHECK on purpose: widening the
-- referred_via CHECK needs drop+re-add, which CI forbids; the allow-list lives in normalizeVia.
-- Measure: among referred users with a snaptrade activity, count(*) by coalesce(referred_surface, referred_via); nulls reported separately.
alter table users add column if not exists referred_surface text;

-- Embeddable badge. Set once, on the owner's first copy of the embed snippet. Measure: count(*) where badge_copied_at is not null.
alter table users add column if not exists badge_copied_at timestamptz;

-- Story image. Set once, on the owner's first click of a Save image link. Intent to save, not posting.
alter table users add column if not exists share_image_saved_at timestamptz;

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
create index if not exists activities_user_time on activities (user_id, executed_at);

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
create index if not exists closed_trades_user on closed_trades (user_id, closed_at desc);
create index if not exists closed_trades_recent on closed_trades (closed_at desc);

-- TR-6: a broker account belongs to one profile, ever. Claimed on first sync, never released.
create table if not exists broker_accounts (
  account_id text primary key,                       -- vendor account id (SnapTrade account.id)
  source text not null default 'snaptrade' check (source = 'snaptrade'),
  user_id int not null references users on delete cascade,
  claimed_at timestamptz not null default now()
);
create index if not exists broker_accounts_user on broker_accounts (user_id);
-- Backfill: existing real data is claimed by its earliest user.
-- ponytail: if two users already share an account (the exploit) their rows stay; cleanup is a follow-up.
insert into broker_accounts (account_id, user_id)
  select distinct on (account_id) account_id, user_id from activities
  where source = 'snaptrade' order by account_id, executed_at
  on conflict (account_id) do nothing;

-- Private ticker watchlist: a user-owned preference. last_seen_at drives "new since you last looked".
create table if not exists ticker_watches (
  user_id int not null references users on delete cascade,
  symbol text not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (user_id, symbol)
);
