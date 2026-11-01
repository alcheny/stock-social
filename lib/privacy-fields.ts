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
  // OPTIONS: the raw option columns join the existing words (no new words: the scope line is owner copy).
  { words: 'quantities', columns: ['activities.units', /* OPTIONS */ 'option_activities.contract_units'] },
  { words: 'prices', columns: ['activities.price', /* OPTIONS */ 'option_activities.share_price', 'option_activities.strike_milli', 'option_activities.cash_amount',
    'option_activities.occ_ticker', 'option_activities.contract_key' /* both carry the strike */] },
  { words: 'fees', columns: ['activities.fee', /* OPTIONS */ 'option_activities.fee'] },
  { words: 'account numbers', columns: ['activities.account_id', 'closed_trades.account_id', 'open_positions.account_id', 'broker_accounts.account_id',
    /* OPTIONS */ 'option_activities.account_id', 'option_trades.account_id', 'open_option_positions.account_id'] },
];

export const PUBLIC_USE = 'Your public record is also used to describe your trading style and to order traders for readers.';

// Columns of the publicly read tables that are not fields: keys, flags and owner-written text (published only when the
// trader writes it, under its own moderation; not part of what the import publishes).
export const NOT_A_FIELD: Record<string, string> = {
  'closed_trades.id': 'key', 'closed_trades.user_id': 'key', 'closed_trades.sell_id': 'key (vendor activity id, never shown)',
  'closed_trades.trade_key': 'key (hash of sell_id)', 'closed_trades.verified': 'shown as the Verified badge',
  'closed_trades.thesis': 'written by the trader', 'closed_trades.thesis_status': 'moderation state',
  'open_positions.user_id': 'key', 'open_positions.fetched_at': 'freshness, internal',
  // OPTIONS (docs/features/logs/options/plan.md D1, D5): keys and flags of the option tables.
  'option_trades.id': 'key', 'option_trades.user_id': 'key', 'option_trades.close_id': 'key (vendor activity id, never shown)',
  'option_trades.verified': 'shown as the Verified badge',
  'open_option_positions.user_id': 'key', 'open_option_positions.position_key': 'key (contract key, never shown)',
  'open_option_positions.fetched_at': 'freshness, internal',
};

// OPTIONS (D5): option columns the current scope line does not name. They are imported and counted but shown only once
// the owner's line names them (lib/options-gate.ts#optionsPublic) and the trader consented under it. A column moves
// from here to PUBLIC_FIELDS when the owner amends the line; lib/options-gate.test.ts puts each in exactly one map.
export const GATED_COLUMNS: string[] = [
  'option_trades.underlying', 'option_trades.option_right', 'option_trades.option_expiry', 'option_trades.return_pct',
  'option_trades.opened_at', 'option_trades.closed_at', 'option_trades.holding_days',
  'open_option_positions.underlying', 'open_option_positions.option_right', 'open_option_positions.option_expiry', 'open_option_positions.unrealized_pct',
];

const list = (xs: string[]) => (xs.length > 2 ? `${xs.slice(0, -1).join(', ')}, and ${xs.at(-1)}` : xs.join(' and '));
const listNoComma = (xs: string[]) => `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`;
/** The consent scope line these lists say. */
export const scopeLineFromFields = () =>
  `Public: ${list(PUBLIC_FIELDS.map((f) => f.words))}. Private: ${listNoComma(PRIVATE_FIELDS.map((f) => f.words))}. ${PUBLIC_USE}`;
