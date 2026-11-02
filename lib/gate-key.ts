// F-29 (docs/features/logs/F-29/plan.md D3): the options gate's state as a cache key for URL-keyed public caches (the
// pane JSON, the story picture, the opengraph-image URLs). Pure, and its only import is ./privacy-fields.ts, so client
// components can use it (lib/options-gate.ts pulls node:crypto through lib/consent-versions.ts). After a gate flip
// (a deploy, PUBLIC_FIELDS changing), pages reference only URLs no cache saw before it, and a stale key is never stored.
import { PUBLIC_FIELDS, type Field } from './privacy-fields.ts';

// OPTIONS (docs/features/logs/options/plan.md D5): the option columns the owner's scope line must name before any option
// result is public. The one list; lib/options-gate.ts re-exports it.
export const OPTION_PUBLIC_COLUMNS = [
  'option_trades.underlying', 'option_trades.option_right', 'option_trades.option_expiry', 'option_trades.return_pct',
  'option_trades.opened_at', 'option_trades.closed_at', 'option_trades.holding_days',
  'open_option_positions.underlying', 'open_option_positions.option_right', 'open_option_positions.option_expiry', 'open_option_positions.unrealized_pct',
] as const;

/** The global half of the gate: every option column is in a public field of the scope line. */
export function optionColumnsPublic(fields: readonly Field[] = PUBLIC_FIELDS): boolean {
  const named = new Set(fields.flatMap((f) => f.columns));
  return OPTION_PUBLIC_COLUMNS.every((c) => named.has(c));
}

export function gateKey(fields: readonly Field[] = PUBLIC_FIELDS): 'o0' | 'o1' {
  return optionColumnsPublic(fields) ? 'o1' : 'o0';
}

/** The URL with `g=<gate key>` appended. */
export function withGate(url: string, fields?: readonly Field[]): string {
  return `${url}${url.includes('?') ? '&' : '?'}g=${gateKey(fields)}`;
}

// ponytail: a page opened before a flip keeps its g=o0 URLs, and shared caches may serve those for up to 60 s (pane) or
// 300 s (story) after the flip, to those pre-flip pages only — purge the CDN as part of the consent-version deploy.
/** `cacheable` only for a request made under the current key; a missing or stale key gets the body uncached. */
export function gateCacheControl(g: string | null, cacheable: string, fields?: readonly Field[]): string {
  return g === gateKey(fields) ? cacheable : 'no-store';
}
