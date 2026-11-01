// OPTIONS (docs/features/logs/options/plan.md D5, D6): the option models lib/options-load.ts returns and the pure
// helpers the renders use. No reads here (client components import it: the pane).
import type { OptionSummary } from './options.ts';
import { pct } from './trades.ts';
import { OPTIONS } from './copy.ts';

export type OptionCounts = {
  shown: number; // long option closes in option_trades
  short: number; // users.excluded_options_short
  other: number; // users.excluded_options_other (exercise-day share closes included)
  openLong: number; openShort: number; unsupported: number;
};
// N of the count line: every option close, shown or counted; M: every open option, long or short.
export const closesOf = (c: OptionCounts) => c.shown + c.short + c.other;
export const openOf = (c: OptionCounts) => c.openLong + c.openShort;
/** D5: the "Share trades" label shows whenever the trader has any option closes or option exclusions (both gate states). */
export const shareLabel = (c: OptionCounts) => closesOf(c) > 0;
/** Anything to say about options at all (the count line or the open-gate lines). */
export const hasOptions = (c: OptionCounts) => closesOf(c) + openOf(c) > 0;

export type OptionTradeView = { id: string; underlying: string; right: 'CALL' | 'PUT'; expiry: string; closedAt: Date; openedAt: Date; returnPct: number; holdingDays: number; verified: boolean };
export type OpenOptionView = { key: string; underlying: string; right: 'CALL' | 'PUT'; expiry: string; pct: number };
export type OptionRecord =
  | { gate: 'closed'; counts: OptionCounts }
  | { gate: 'open'; counts: OptionCounts; summary: OptionSummary | null; trades: OptionTradeView[]; open: OpenOptionView[] };
export type OptionHeadline = { gate: 'closed'; counts: OptionCounts } | { gate: 'open'; counts: OptionCounts; summary: OptionSummary | null };

/** D6: the options line's text from a summary ("Options: 14 trades · 36% wins · -22.0% avg (-41.0% to -3.0%)"). */
export const optionsLineText = (s: OptionSummary) =>
  OPTIONS.line(s.n, `${(s.winRate * 100).toFixed(0)}%`, pct(s.avg), s.range ? `(${pct(s.range.low)} to ${pct(s.range.high)})` : null);

/** L9: the text the display log stores: the options line when open, the gated count line when closed, null when the
 *  trader has no options. Only what this file returned. */
export function optionDisplayText(m: OptionHeadline): string | null {
  if (!hasOptions(m.counts)) return null;
  if (m.gate === 'closed') return OPTIONS.gated(closesOf(m.counts), openOf(m.counts));
  return m.summary ? optionsLineText(m.summary) : null;
}
