-- Raw in, derived out (docs/DESIGN.md §2.3). `activities` is immutable broker data;
-- `closed_trades` is rebuilt from it on every sync and can be dropped and recomputed at any time.
-- `trade_reflections` is the exception: it is USER-SUPPLIED, not derived. Never remove it or rebuild it along with `closed_trades`.
-- `trade_rules` is user-supplied too, with the same rule.

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

-- set once, on the owner's first open of /me/record
alter table users add column if not exists record_first_viewed_at timestamptz;
-- repeat-visit record: a visit is an open 30+ minutes after the last one
alter table users add column if not exists record_last_viewed_at timestamptz;
alter table users add column if not exists record_prev_viewed_at timestamptz;
alter table users add column if not exists record_view_count int not null default 0;

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
