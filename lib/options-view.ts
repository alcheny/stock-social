// OPTIONS (docs/features/logs/options/plan.md D5, D6): the option models lib/options-load.ts returns and the pure
// helpers the renders use. No reads here (client components import it: the pane).
import type { OptionSummary } from './options.ts';
import { pct } from './trades.ts';
import { OPTIONS, RECORD_STRIP } from './copy.ts';
import { rangePair, zeroWidth } from './zero-width.ts'; // FIXES-CYCLE5 part 2 (C5-4)

export type OptionCounts = {
  shown: number; // long option closes in option_trades
  short: number; // users.excluded_options_short
  other: number; // users.excluded_options_other (option rows only)
  openLong: number; openShort: number;
  openOther: number; // users.open_options_other: open options that can't be priced exactly
  unsupported: number; // users.open_unsupported: futures, options on futures, CFDs
  exerciseShares: number; // users.excluded_exercise_shares: share closes held over an exercise or assignment day
};
// N of the count line: every option close, shown or counted (option rows only, fix round 1, QA 8); M: every open option.
export const closesOf = (c: OptionCounts) => c.shown + c.short + c.other;
export const openOf = (c: OptionCounts) => c.openLong + c.openShort + c.openOther;
/** D5: the "Share trades" label shows whenever the trader has any option closes or option exclusions (both gate states). */
export const shareLabel = (c: OptionCounts) => closesOf(c) > 0;
/** Anything to say about options at all (the count line or the open-gate lines). */
export const hasOptions = (c: OptionCounts) => closesOf(c) + openOf(c) > 0;

// Fix round 1 (QA 1, QA 2): only what the renders show. No contract key, strike, multiplier or row id: a server
// component's keys and props reach the page payload, so nothing here may carry them.
export type OptionTradeView = { underlying: string; right: 'CALL' | 'PUT'; expiry: string; closedAt: Date; returnPct: number; verified: boolean };
export type OpenOptionView = { underlying: string; right: 'CALL' | 'PUT'; expiry: string; pct: number };
export type OptionRecord =
  | { gate: 'closed'; counts: OptionCounts }
  | { gate: 'open'; counts: OptionCounts; summary: OptionSummary | null; trades: OptionTradeView[]; open: OpenOptionView[]; openAsOf: Date | null };
export type OptionHeadline = { gate: 'closed'; counts: OptionCounts } | { gate: 'open'; counts: OptionCounts; summary: OptionSummary | null };

/** D6: the options line's text from a summary ("Options: 14 trades · 36% wins · -22.0% avg (-41.0% to -3.0%)"). */
// FIXES-CYCLE5 part 2 (C5-4, round 2 item 3): the options line goes through the one zero-width rule; a zero-width range
// reads "Too early to tell", never "(+1.0% to +1.0%)".
export const optionRangeText = (s: Pick<OptionSummary, 'range'>): string | null =>
  rangePair(s.range) ?? (zeroWidth(s.range) ? RECORD_STRIP.early : null);
export const optionsLineText = (s: OptionSummary) =>
  OPTIONS.line(s.n, `${(s.winRate * 100).toFixed(0)}%`, pct(s.avg), rangePair(s.range) ?? (zeroWidth(s.range) ? `· ${RECORD_STRIP.early}` : null));

/** Fix round 1 (review 3): the open block's "as of": the oldest read across share and option positions, or null when
 *  there is none (Math.min of nothing is Infinity, which printed "Invalid Date"). */
export function oldestRead(shareReads: Date[], optionAsOf: Date | null): Date | null {
  const t = [...shareReads.map((d) => d.getTime()), ...(optionAsOf ? [optionAsOf.getTime()] : [])].filter(Number.isFinite);
  return t.length ? new Date(Math.min(...t)) : null;
}

/** Fix round 1 (QA 2): what the pane and the record card receive — the label flag and the one rendered line, never the
 *  per-kind counts (a client fetches the pane as JSON). */
// `open`: the gate is open for this trader (the pane's closing note follows it, fix round 4 N7); never a count.
export type PaneOptionsView = { label: boolean; line: string | null; open: boolean };
export const paneView = (m: OptionHeadline): PaneOptionsView => ({ label: shareLabel(m.counts), line: optionDisplayText(m), open: m.gate === 'open' && hasOptions(m.counts) });
/** Whether a pane line is the open-gate options line (the gated count line never starts with it). */
export const isOptionsLine = (line: string | null | undefined) => !!line && line.startsWith(OPTIONS.lineHead(0, '').slice(0, 'Options:'.length));

/** L9: the text the display log stores: the options line when open, the gated count line when closed, null when the
 *  trader has no options. Only what this file returned. */
export function optionDisplayText(m: OptionHeadline): string | null {
  if (!hasOptions(m.counts)) return null;
  if (m.gate === 'closed') return OPTIONS.gated(closesOf(m.counts), openOf(m.counts));
  if (m.summary) return optionsLineText(m.summary);
  // Fix round 4 (N7): open with no long close to summarize: the profile's short and technical lines, in their words.
  const c = m.counts;
  const lines = [c.short + c.openShort > 0 ? OPTIONS.short(c.short, c.openShort) : null, c.other > 0 ? OPTIONS.technical(c.other) : null,
    c.openOther > 0 ? OPTIONS.openOther(c.openOther) : null].filter(Boolean);
  return lines.length ? lines.join(' ') : null;
}
