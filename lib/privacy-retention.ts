// Privacy work (2026-11-01): every table in db/schema.sql with whether it holds personal data and how long its rows
// live. The Privacy Policy's retention section is written from this map; lib/privacy-retention.test.ts fails when a
// table is added to the schema without an entry here (or an entry outlives its table).
//
// Classes:
//   account   kept until the account is deleted (deletion removes every row, lib/delete.ts and the users cascade)
//   session   kept until it expires, then purged by the tick (lib/privacy-purge.ts, lib/auth/links.ts)
//   short     unfinished or orphaned rows purged by the tick after a fixed window (lib/privacy-purge.ts)
//   reserved  no personal data; kept for a fixed period (a deleted handle's reservation)
//   none      no personal data; operational rows
export type RetentionClass = 'account' | 'session' | 'short' | 'reserved' | 'none';
export type TableEntry = { personal: boolean; retention: RetentionClass; holds: string };

export const SCHEMA_MAP: Record<string, TableEntry> = {
  users: { personal: true, retention: 'account', holds: 'handle, display name, 18+ attestation time, vendor user id and encrypted secret, referral' },
  activities: { personal: true, retention: 'account', holds: 'raw broker activities: symbols, quantities, prices, fees, account ids' },
  corporate_actions: { personal: true, retention: 'account', holds: 'raw broker corporate-action rows (splits, stock dividends, renames): symbols, share counts, account ids; deleted with the profile' },
  closed_trades: { personal: true, retention: 'account', holds: 'derived public record: symbols, dates, percent returns, holding periods, theses' },
  broker_accounts: { personal: true, retention: 'account', holds: 'vendor account ids claimed by a profile' },
  ticker_watches: { personal: true, retention: 'account', holds: 'private watchlist symbols' },
  kept_theses: { personal: true, retention: 'account', holds: 'theses whose trade is excluded' },
  trade_reflections: { personal: true, retention: 'account', holds: 'private trade reason tags' },
  trade_rules: { personal: true, retention: 'account', holds: 'private personal rules (kind and day count)' },
  signup_attempts: { personal: true, retention: 'short', holds: '18+ attestation, method, referral, vendor ids of a brokerage-first attempt; unfinished ones purged after 30 days; on account deletion finished ones lose their user link and vendor ids and stay as anonymous funnel rows' },
  identities: { personal: true, retention: 'account', holds: 'sign-in provider subject and email address' },
  sessions: { personal: true, retention: 'session', holds: 'hashed session token and user id; purged at expiry' },
  login_links: { personal: true, retention: 'session', holds: 'email address of a sign-in link; purged when expired or its attempt finished' },
  handle_reservations: { personal: false, retention: 'reserved', holds: 'a deleted handle and its release date' },
  funnel_events: { personal: false, retention: 'short', holds: 'sign-up step names and times per attempt; purged with an unfinished attempt' },
  connections: { personal: true, retention: 'short', holds: 'vendor authorization id, institution and account snapshot; a signed-out unfinished one is purged with its attempt' },
  open_positions: { personal: true, retention: 'account', holds: 'public open positions: symbol and unrealized percent' },
  follows: { personal: true, retention: 'account', holds: 'private follows' },
  viewer_exclusions: { personal: true, retention: 'short', holds: 'private "not interested" and unfollow; rows the viewer ended and ended unfollows purged after a day; a "not interested" that ran its 90 days is kept until removed (F-2 PR-5)' },
  trade_likes: { personal: true, retention: 'account', holds: 'private likes (preference data, kept indefinitely); a like whose trade is gone for 30 days is purged' },
  trade_exclusions: { personal: true, retention: 'account', holds: 'private rejected trades (preference data, kept indefinitely); one whose trade is gone for 30 days is purged' },
  privacy_orphans: { personal: true, retention: 'short', holds: 'when a like or reject first had no trade; removed when the trade returns or the row is purged' },
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
  billing_runs: { personal: false, retention: 'none', holds: 'when the daily billing reconciliation last started' },
  billing_consents: { personal: true, retention: 'reserved', holds: 'renewal consent: plan, disclosure version and hash, time; no IP, email or name. At account deletion the user link is removed and the row is kept 3 years under the processor customer id (legal defense of renewal consent), then purged' },
  record_views: { personal: true, retention: 'account', holds: 'a subscriber\'s private saved comparison: name only; deleted with the account' },
  record_view_traders: { personal: true, retention: 'account', holds: 'the traders in a private saved view and their order; deleted with the view or either account' },
  record_notes: { personal: true, retention: 'account', holds: 'a subscriber\'s private note about a trader; deleted with either account' },
  record_tool_notices: { personal: true, retention: 'account', holds: 'a count of traders removed from a subscriber\'s views and notes since the last dismissal; no trader id' },
  display_log: { personal: true, retention: 'account', holds: 'append-only daily snapshot of what a public record displayed' },
};

// Every `create table [if not exists] <name>` in a schema text.
export const schemaTables = (schema: string): string[] =>
  [...schema.replace(/--[^\n]*/g, '').matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?([a-z_][a-z0-9_]*)/gi)].map((m) => m[1].toLowerCase());
