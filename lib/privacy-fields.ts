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
  { words: 'account numbers', columns: ['activities.account_id', 'corporate_actions.account_id', 'closed_trades.account_id', 'open_positions.account_id', 'broker_accounts.account_id', 'sync_read_marks.account_id'] },
];

export const PUBLIC_USE = 'Your public record is also used to describe your trading style and to order traders for readers.';

// Columns of the publicly read tables that are not fields: keys, flags and owner-written text (published only when the
// trader writes it, under its own moderation; not part of what the import publishes).
export const NOT_A_FIELD: Record<string, string> = {
  'closed_trades.id': 'key', 'closed_trades.user_id': 'key', 'closed_trades.sell_id': 'key (vendor activity id, never shown)',
  'closed_trades.trade_key': 'key (hash of sell_id)', 'closed_trades.verified': 'shown as the Verified badge',
  'closed_trades.thesis': 'written by the trader', 'closed_trades.thesis_status': 'moderation state',
  'closed_trades.filing_url': 'link to the public filing behind a public-record trade (F-7)', 'closed_trades.feed_after': 'feed floor, internal (F-7)',
  'open_positions.user_id': 'key', 'open_positions.fetched_at': 'freshness, internal',
  'closed_trades.sell_imported_at': 'when the closing sell was imported, internal (feed paging)',
};

const list = (xs: string[]) => (xs.length > 2 ? `${xs.slice(0, -1).join(', ')}, and ${xs.at(-1)}` : xs.join(' and '));
const listNoComma = (xs: string[]) => `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`;
/** The consent scope line these lists say. */
export const scopeLineFromFields = () =>
  `Public: ${list(PUBLIC_FIELDS.map((f) => f.words))}. Private: ${listNoComma(PRIVATE_FIELDS.map((f) => f.words))}. ${PUBLIC_USE}`;
