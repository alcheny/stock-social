// F-4 (owner decisions 2026-10-22) and DESIGN §5.2 TR-9: when the range around a record's average says something,
// and the one plain-language line that tells anyone how much a record's sample says. Pure; the statistics themselves
// are `confidence()` in lib/trades.ts, which reads the two thresholds below.
// Imports only types from trades.ts (trades.ts imports these constants), so there is no runtime import cycle.
import type { Confidence, Interval } from './trades.ts';
import { count, counted } from './format.ts';

// The owner's floor: below 5 independent bets the variance estimate is too unstable to mean anything, even with the
// t multiplier (t at K = 5 is about 2.8), so there is no range at all.
export const MIN_BETS = 5;
// The design record's "too early" width: while the per-trade range is wider than ±10 percentage points around the
// average, it is shown but said to be too wide to say much. Half-width of the simple-return interval; exactly 10 points
// is not too wide.
export const TOO_WIDE_HALF_WIDTH = 0.10;
// Ranking (TR-9 Must: the pace interval's lower bound; F-2's feed and suggestions) keeps its pre-F-4 floor: F-4 decides
// what the record shows, not how traders are ordered, so a record under 10 bets still weighs 0 there. Whether ranking
// follows the display floor of 5 is an open question for the owner (docs/features/logs/F-4/build-engineer.md).
export const RANK_MIN_BETS = 10;

export const halfWidth = (iv: Pick<Interval, 'low' | 'high'>): number => (iv.high - iv.low) / 2;
export const tooWide = (iv: Pick<Interval, 'low' | 'high'>): boolean => halfWidth(iv) > TOO_WIDE_HALF_WIDTH;

export const evidenceLabel = (c: Pick<Confidence, 'tier'>): string => `Evidence: ${c.tier === 'too-early' ? 'too early' : c.tier}`;

// The sign the trust line speaks of. Positive only when the per-trade range shown next to the average lies entirely
// above 0 and the TR-9 verdict (the pace interval) agrees; negative is the exact mirror. So the card never says
// "consistent" beside a range that crosses 0, and never contradicts the profile's "Past results" verdict.
export type TrustSign = 'positive' | 'negative' | 'unclear';
export function trustSign(c: Pick<Confidence, 'edge' | 'perTrade'>): TrustSign {
  if (!c.perTrade) return 'unclear';
  if (c.edge === 'positive' && c.perTrade.low > 0) return 'positive';
  if (c.edge === 'negative' && c.perTrade.high < 0) return 'negative';
  return 'unclear';
}

// Committee round 1, demand 1: one duration per card. The share card's period line and its trust line both print
// spanText(spanBetween(first entry, now), unit), so they cannot disagree ("1 month" beside "60 days"). Whole units
// (floors, so the sample is never overstated), calendar months in UTC, years = whole months / 12.
const DAY = 86_400_000;
export type Span = { days: number; months: number; years: number };
export function spanBetween(start: Date, end: Date): Span {
  const days = Math.max(0, Math.floor((end.getTime() - start.getTime()) / DAY));
  let months = (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + end.getUTCMonth() - start.getUTCMonth();
  if (end.getUTCDate() < start.getUTCDate()) months--;
  months = Math.max(0, months);
  return { days, months, years: Math.floor(months / 12) };
}
export type SpanUnit = 'days' | 'months' | 'years';
// The owner's table names the unit per tier: thin "D days", moderate "M months", strong "Y years". A record with no
// duration in its trust line (too early) reads in months, as the period line's format has it.
export const spanUnit = (tier: Confidence['tier']): SpanUnit => (tier === 'thin' ? 'days' : tier === 'strong' ? 'years' : 'months');
export function spanText(s: Span, unit: SpanUnit): string {
  if (unit === 'days') return counted(Math.max(1, s.days), 'day');
  if (unit === 'years') return counted(Math.max(1, s.years), 'year');
  return s.months < 1 ? 'under 1 month' : counted(s.months, 'month');
}
// Without a span from the card, the record's own span (first entry to last exit) is measured the same way.
const ownSpan = (c: Confidence): Span => spanBetween(new Date(0), new Date(c.spanDays * DAY));

// The owner's approved table (F-4, 2026-10-22). It describes the sample, never the trader (POLICY F3b): no skill, no
// future outcome, and "consistent" only in the strong tier with the range on one side of 0, losses exactly as gains.
// N is closed trades in the too-early row and independent bets (K) elsewhere. null for an empty record.
export function trustLine(c: Confidence, span: Span = ownSpan(c)): string | null {
  if (c.n === 0) return null;
  if (c.tier === 'too-early') return `Based on ${counted(c.n, 'trade')}. The range is still too wide to say much.`;
  const sign = trustSign(c);
  const over = spanText(span, spanUnit(c.tier));
  if (c.tier === 'thin') {
    return `Based on ${counted(c.k, 'separate bet')} over ${over}. ${sign === 'positive' ? 'Still early.' : 'Still early, and results could go either way.'}`;
  }
  if (c.tier === 'moderate') {
    return `Based on ${counted(c.k, 'bet')} over ${over}. ${sign === 'positive' ? 'A fair sample.' : 'A fair sample, with no clear pattern yet.'}`;
  }
  const end = sign === 'positive' ? 'A long, consistent record.' : sign === 'negative' ? 'A long record, with consistent losses.' : 'A long record, with no clear pattern.';
  return `Based on ${count(c.k)} bets over ${over}. ${end}`;
}

// AC5's reader test: words a person with no finance or statistics background should never meet in the trust line.
export const TRUST_BANNED = ['confidence interval', 'standard error', 'p-value', 'alpha', 'Sharpe', 'edge', 'signal', 'skill'] as const;
