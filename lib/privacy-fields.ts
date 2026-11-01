// Privacy work (2026-11-01): what a trader's public record shows and what stays private, each field with the columns
// behind it. The consent screen's scope line (lib/copy.ts#CONSENT_SCOPE_LINE, owner copy) names exactly these fields;
// lib/privacy-fields.test.ts holds the line, these lists and the schema equal.
export type Field = { words: string; columns: string[] };

export const PUBLIC_FIELDS: Field[] = [
  { words: 'percent returns', columns: ['closed_trades.return_pct'] },
  { words: 'symbols', columns: ['closed_trades.symbol'] },
  { words: 'dates', columns: ['closed_trades.opened_at', 'closed_trades.closed_at'] },
  { words: 'holding periods', columns: ['closed_trades.holding_days'] },
  { words: 'institution names', columns: ['connections.institution'] },
  { words: 'account count', columns: ['broker_accounts.account_id (counted, never shown)'] },
  { words: 'your current open positions with unrealized percent', columns: ['open_positions.symbol', 'open_positions.unrealized_pct'] },
];

export const PRIVATE_FIELDS: Field[] = [
  { words: 'quantities', columns: ['activities.units'] },
  { words: 'prices', columns: ['activities.price'] },
  { words: 'fees', columns: ['activities.fee'] },
  { words: 'account numbers', columns: ['activities.account_id', 'corporate_actions.account_id', 'closed_trades.account_id', 'open_positions.account_id', 'broker_accounts.account_id'] },
];

export const PUBLIC_USE = 'Your public record is also used to describe your trading style and to order traders for readers.';

// Columns of the publicly read tables that are not fields: keys, flags and owner-written text (published only when the
// trader writes it, under its own moderation; not part of what the import publishes).
export const NOT_A_FIELD: Record<string, string> = {
  'closed_trades.id': 'key', 'closed_trades.user_id': 'key', 'closed_trades.sell_id': 'key (vendor activity id, never shown)',
  'closed_trades.trade_key': 'key (hash of sell_id)', 'closed_trades.verified': 'shown as the Verified badge',
  'closed_trades.thesis': 'written by the trader', 'closed_trades.thesis_status': 'moderation state',
  'open_positions.user_id': 'key', 'open_positions.fetched_at': 'freshness, internal',
  // FIXES-LABELS (code review): the other columns the record status line's loader (lib/record-status-load.ts) reads;
  // lib/privacy-fields-status.test.ts holds every column that loader reads to one of these lists.
  'users.id': 'key', 'activities.user_id': 'key', 'connections.id': 'key', 'connections.user_id': 'key',
  'broker_accounts.user_id': 'key', 'broker_accounts.connection_id': 'key',
  'activities.source': 'shown as the Demo badge (record source)',
  'activities.account_id': 'counted for the public account count, never shown (the account number itself is private)',
  'activities.executed_at': 'trade time, compared only (a trade on a removed account after its removal), never shown by the status line',
  'connections.state': 'record state (importing, connected, failed), shown as which status line appears',
  'connections.accounts': 'the consented account list: ids counted and labelled "Account i of n", never shown; its paper flag filters; its institution names are the public institution names',
  'broker_accounts.confirmed_at': 'flag (a pre-connection claim), never shown',
};

// FIXES-LABELS (code review, POLICY P6): record state the status line publishes (DESIGN TR-5 / F-11), each date shown on
// the profile, the feed pane and the trade and month pages. Not in the consent line yet: CONSENT_SCOPE_LINE is owner
// copy, and the owner must name these before any non-demo user connects (ponytail at lib/copy.ts#CONSENT_SCOPE_LINE).
export type RecordStateField = Field & { reason: string };
const STATE_REASON = 'record state shown by the status line, DESIGN TR-5 / F-11; the consent line must name it before any non-demo user connects (POLICY P6) — owner copy';
export const RECORD_STATE_FIELDS: RecordStateField[] = [
  { words: 'last update', columns: ['users.last_synced_at'], reason: STATE_REASON },
  { words: 'disconnected date', columns: ['connections.disconnected_at'], reason: STATE_REASON },
  { words: 'account removed date', columns: ['broker_accounts.removed_at'], reason: STATE_REASON },
  // The idle line's date before a record's first sync is its earliest live consent (lib/record-status.ts#idleSince).
  { words: 'connection date (an idle record\'s date before its first update)', columns: ['connections.consent_at'], reason: STATE_REASON },
];

const list = (xs: string[]) => (xs.length > 2 ? `${xs.slice(0, -1).join(', ')}, and ${xs.at(-1)}` : xs.join(' and '));
const listNoComma = (xs: string[]) => `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`;
/** The consent scope line these lists say. */
export const scopeLineFromFields = () =>
  `Public: ${list(PUBLIC_FIELDS.map((f) => f.words))}. Private: ${listNoComma(PRIVATE_FIELDS.map((f) => f.words))}. ${PUBLIC_USE}`;
