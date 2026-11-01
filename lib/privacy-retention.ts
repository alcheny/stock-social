// Privacy work (2026-11-01): every table in db/schema.sql with whether it holds personal data and how long its rows
// live. The Privacy Policy's retention section is written from this map; lib/privacy-retention.test.ts fails when a
// table is added to the schema without an entry here (or an entry outlives its table).
//
// Classes:
//   account   kept until the account is deleted (deletion removes every row, lib/delete.ts and the users cascade)
//   session   kept until it expires, then purged by the tick (lib/privacy-purge.ts, lib/auth/links.ts)
//   short     unfinished or orphaned rows purged by the tick after a fixed window (lib/privacy-purge.ts)
//   reserved  kept for a fixed period (a deleted or renamed handle's reservation; no personal data once the account is gone)
//   none      no personal data; operational rows
export type RetentionClass = 'account' | 'session' | 'short' | 'reserved' | 'none';
export type TableEntry = { personal: boolean; retention: RetentionClass; holds: string };

export const SCHEMA_MAP: Record<string, TableEntry> = {
  users: { personal: true, retention: 'account', holds: 'handle, display name, 18+ attestation time, vendor user id and encrypted secret, referral' },
  activities: { personal: true, retention: 'account', holds: 'raw broker activities: symbols, quantities, prices, fees, account ids' },
  corporate_actions: { personal: true, retention: 'account', holds: 'raw broker corporate-action rows (splits, stock dividends, renames) and broker trade rows with no usable price, share count or date: symbols, share counts, prices, account ids; deleted with the profile' },
  closed_trades: { personal: true, retention: 'account', holds: 'derived public record: symbols, dates, percent returns, holding periods, theses' },
  // Sharded sync (docs/SYNC.md): one row per shard: its lease, heartbeat and last run's counts. No user ids.
  // F-14 sync cadence: per account (vendor account id), the last successful vendor reads, whatever the sync's outcome.
  sync_read_marks: { personal: true, retention: 'account', holds: 'vendor account id, the time of its last successful activities read and its last 4 positions reads, and (F-24) counts of failed late-postings page steps and widened confirm reads in a row (written after every hourly sync, whatever its outcome)' },
  // F-14: vendor reads per hour, counts only.
  sync_read_counts: { personal: false, retention: 'none', holds: 'hourly counts of vendor reads (numbers only)' },
  sync_shards: { personal: false, retention: 'none', holds: 'per-shard sync lease, heartbeat and run counters (numbers only)' },
  broker_accounts: { personal: true, retention: 'account', holds: 'vendor account ids claimed by a profile, with a keyed hash of the institution account identity (never the identifier itself); F-24: the late-postings read cursor (vendor activity ids listed by a running pass, cleared when it ends; the stored ids the last pass did not list, kept until a later pass lists them or the account stops being read)' },
  // F-24: possible re-issued vendor rows (ids only), held from the record until a complete read decides them.
  activity_reissues: { personal: true, retention: 'account', holds: 'vendor activity ids of a possible re-issue and its original, the account id and the decision state; deleted with the profile' },
  ticker_watches: { personal: true, retention: 'account', holds: 'private watchlist symbols' },
  kept_theses: { personal: true, retention: 'account', holds: 'theses whose trade is excluded' },
  trade_reflections: { personal: true, retention: 'account', holds: 'private trade reason tags' },
  trade_rules: { personal: true, retention: 'account', holds: 'private personal rules (kind and day count)' },
  signup_attempts: { personal: true, retention: 'short', holds: '18+ attestation, method, referral, vendor ids of a brokerage-first attempt; unfinished ones purged after 30 days; on account deletion finished ones lose their user link and vendor ids and stay as anonymous funnel rows' },
  identities: { personal: true, retention: 'account', holds: 'sign-in provider subject and email address' },
  sessions: { personal: true, retention: 'session', holds: 'hashed session token and user id; purged at expiry' },
  login_links: { personal: true, retention: 'session', holds: 'email address of a sign-in link; purged when expired or its attempt finished' },
  handle_reservations: { personal: true, retention: 'reserved', holds: 'a deleted or renamed handle and its release date (a year); a renamed one also links the renaming account so that trader can take it back, and that link is removed when the account is deleted; at most 3 per account (a further rename ends the oldest hold); purged by the tick once the hold has ended' },
  funnel_events: { personal: false, retention: 'short', holds: 'sign-up step names and times per attempt; purged with an unfinished attempt' },
  connections: { personal: true, retention: 'short', holds: 'vendor authorization id, institution and account snapshot (with a keyed hash of each account\'s institution identity, never the identifier); a signed-out unfinished one is purged with its attempt' },
  open_positions: { personal: true, retention: 'account', holds: 'public open positions: symbol and unrealized percent' },
  // Fixes cycle 3, F3-4: kept while the owner decides OD-9; rendered nowhere.
  unlisted_option_positions: { personal: true, retention: 'account', holds: 'private last-read long option positions (underlying, call or put, expiry, unrealized percent, read time) of an account the broker no longer lists; deleted with the profile' },
  unlisted_positions: { personal: true, retention: 'account', holds: 'private last-read open positions (symbol, unrealized percent, read time) of an account the broker no longer lists; deleted with the profile' },
  follows: { personal: true, retention: 'account', holds: 'private follows' },
  viewer_exclusions: { personal: true, retention: 'short', holds: 'private "not interested" and unfollow; rows the viewer ended and ended unfollows purged after a day; a "not interested" that ran its 90 days is kept until removed (F-2 PR-5)' },
  trade_likes: { personal: true, retention: 'account', holds: 'private likes (preference data, kept indefinitely); a like whose trade is gone for 30 days is purged' },
  trade_exclusions: { personal: true, retention: 'account', holds: 'private rejected trades (preference data, kept indefinitely); one whose trade is gone for 30 days is purged' },
  privacy_orphans: { personal: true, retention: 'short', holds: 'when a like or reject first had no trade; removed when the trade returns or the row is purged' },
  shared_account_marks: { personal: true, retention: 'account', holds: 'which profile held activities of an account claimed by another profile (vendor account id, user id), marked by the owner' },
  // F-2 PR-5: the opt-in activity log (stored until the viewer clears it or deletes the account, owner 2026-11-01) and its
  // lookup tables.
  discovery_events: { personal: true, retention: 'account', holds: 'opt-in activity log: viewer, surface, target (trader, trade or symbol), type and time; kept until cleared ("Clear my activity") or the account is deleted' },
  discovery_event_types: { personal: false, retention: 'none', holds: 'event type names' },
  discovery_surfaces: { personal: false, retention: 'none', holds: 'surface names' },
  // F-3 (docs/features/logs/F-3/committee-2026-11-01.md, conditions 16 and 20). The processor is the record holder for
  // charges, refunds and tax; the app keeps ids, plan, status and dates only.
  billing_customers: { personal: true, retention: 'account', holds: 'the processor customer id of a subscriber; deleted with the account after the processor customer is deleted' },
  subscriptions: { personal: true, retention: 'account', holds: 'processor subscription id, plan, status, period dates, grace and dispute times; deleted with the account after the subscription is canceled at the processor' },
  billing_events: { personal: false, retention: 'short', holds: 'processor event id, type, object and customer ids, processing state; no payload; purged 35 days after receipt and at the customer\'s account deletion' },
  billing_runs: { personal: false, retention: 'none', holds: 'when the daily billing reconciliation and the daily grace expiry and purges last ran; the pass in progress (start, phase, last processor subscription id handled, failures at it) and its lease' },
  billing_consents: { personal: true, retention: 'reserved', holds: 'renewal consent: plan, disclosure version and hash, time; no IP, email or name. At account deletion the user link is removed and the row is kept 3 years under the processor customer id (legal defense of renewal consent), then purged' },
  record_views: { personal: true, retention: 'account', holds: 'a subscriber\'s private saved comparison: name only; deleted with the account' },
  record_view_traders: { personal: true, retention: 'account', holds: 'the traders in a private saved view and their order; deleted with the view or either account' },
  record_notes: { personal: true, retention: 'account', holds: 'a subscriber\'s private note about a trader; deleted with either account' },
  record_tool_notices: { personal: true, retention: 'account', holds: 'a count of traders removed from a subscriber\'s views and notes since the last dismissal; no trader id' },
  // F-7 public-record traders: kept until a removal request (lib/public-import.ts#filerAction); class 'account' = the profile's life.
  public_filers: { personal: true, retention: 'account', holds: 'public filer id, demo flag, exclusion counts, open symbols, hidden/removed times; after removal only the id, source and removed time' },
  public_transactions: { personal: true, retention: 'account', holds: 'raw public filing rows: symbols, codes, share counts, prices, dates, filing links; deleted on removal' },
  public_import_state: { personal: false, retention: 'none', holds: 'import cursor and last successful run per source' },
  public_filer_log: { personal: true, retention: 'account', holds: 'corrections log: filer id, action, reason code and time; no requester details' },
  display_log: { personal: true, retention: 'account', holds: 'append-only daily snapshot of what a public record displayed' },
  // fix-user-text B (F-9): who reported which note; both user links cascade, so a deleted profile leaves no reporter id.
  thesis_reports: { personal: true, retention: 'account', holds: 'which signed-in reader reported which trader\'s note (by sell id) and when' },
  // OPTIONS (docs/features/logs/options/plan.md D1, L8): deleted with the account (the users cascade).
  option_activities: { personal: true, retention: 'account', holds: 'raw broker option activities: contract terms, strikes, quantities, prices, fees, cash, account ids' },
  option_trades: { personal: true, retention: 'account', holds: 'derived long option closes: underlying, call or put, expiry, dates, percent returns; public only through the consent gate' },
  open_option_positions: { personal: true, retention: 'account', holds: 'long open option positions: underlying, call or put, expiry, unrealized percent; public only through the consent gate' },
  // Security hardening (2026-11-01): pseudonymous (keyed hashes, never the address or IP itself), so counted as personal.
  rate_limits: { personal: true, retention: 'short', holds: 'rate-limit counters per window, keyed by a scope and a keyed hash of an email address, client IP or id; pruned by lib/rate-limit.ts after 2 days' },
  portal_probes: { personal: false, retention: 'none', holds: 'per vendor portal origin, whether it can be framed and until when' },
  rate_marks: { personal: true, retention: 'short', holds: 'the last import-poll time per user id; pruned by lib/rate-limit.ts after a day' },
  sitemap_chunks: { personal: false, retention: 'none', holds: 'sitemap chunk boundary symbols, indexable-symbol count, highest sitemap id published and build time (no user ids)' },
  similar_pools: { personal: true, retention: 'short', holds: 'the Similar trades section pool: user ids with ranking numbers derived from public records (no quantities or prices); one row per scope, overwritten every 10 s while profiles are viewed; rows idle past a day are deleted by lib/privacy-purge.ts' },
  privacy_purge_cursors: { personal: false, retention: 'none', holds: "the orphan purge's scan position per step: a number in the trade_key hash space, a window span, how much of the current lap is walked and a lap count (no user, key or trade)" },
  // F-15 (docs/features/F-15-measurement-foundation.md): aggregate daily view counts. No IP, user agent, viewer or session
  // id, cookie, referrer URL, path or time of day. Counted as personal because a row names the viewed trader's id.
  view_rollup: { personal: true, retention: 'short', holds: 'daily view counts per surface, viewed trader id (record pages), referrer class, source class, signed-in and self-view flags; deleted with the trader\'s account; purged after 120 days (lib/views.ts VIEW_RETENTION_DAYS)' },
  share_action: { personal: true, retention: 'short', holds: 'one row per completed share of a trader\'s own record: trader id, UTC day, share class (card, story, trade, month), outcome (sheet or copy), the record\'s headline sign (up, down, flat, none); no time of day, destination, thesis or account id; deleted with the account; purged after 120 days (lib/share-actions.ts SHARE_RETENTION_DAYS)' },
  view_drops: { personal: false, retention: 'short', holds: 'daily counts of beacons the bot filter dropped, per surface and reason (no user id); purged after 120 days' },
};

// Every `create table [if not exists] <name>` in a schema text.
export const schemaTables = (schema: string): string[] =>
  [...schema.replace(/--[^\n]*/g, '').matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?([a-z_][a-z0-9_]*)/gi)].map((m) => m[1].toLowerCase());
