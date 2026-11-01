// OPTIONS (docs/features/logs/options/plan.md D5): every consent scope line the connect screen has shown, append-only,
// each with the public columns it named. A connection stores the sha256 of the line it was consented under
// (`connections.consent_scope_hash`, lib/connections.ts#consent); a trader's option results are public only when that
// line named every option column (lib/options-gate.ts#consentCoversOptions). Entries are never removed or edited: a new
// line is a new entry at the end (lib/consent-versions.test.ts pins each hash). Owner copy: the owner adds entries.
import { createHash } from 'node:crypto';

export type ConsentVersion = { line: string; publicColumns: readonly string[] };

export const CONSENT_VERSIONS: readonly ConsentVersion[] = [
  {
    // 2026-11-01: the scope line of the privacy work (lib/copy.ts#CONSENT_SCOPE_LINE). Options are not named.
    line: 'Public: percent returns, symbols, dates, holding periods, institution names, account count, and your current open positions with unrealized percent. Private: quantities, prices, fees and account numbers. Your public record is also used to describe your trading style and to order traders for readers.',
    publicColumns: ['closed_trades.return_pct', 'closed_trades.symbol', 'closed_trades.opened_at', 'closed_trades.closed_at', 'closed_trades.holding_days',
      'connections.institution', 'broker_accounts.account_id (counted, never shown)', 'open_positions.symbol', 'open_positions.unrealized_pct'],
  },
];

export const consentHash = (line: string) => createHash('sha256').update(line).digest('hex');
/** The hash written beside `consent_at` now: the last entry's line (equal to CONSENT_SCOPE_LINE, tested). */
export const CURRENT_CONSENT_HASH = consentHash(CONSENT_VERSIONS[CONSENT_VERSIONS.length - 1].line);
export const versionFor = (hash: string | null | undefined): ConsentVersion | null =>
  (hash ? CONSENT_VERSIONS.find((v) => consentHash(v.line) === hash) : null) ?? null;
