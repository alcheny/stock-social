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
// what the record shows, not how traders are ordered, so a record under 10 bets still weighs 0 there. Owner decision
// 2026-11-01: records show a range from 5 bets but only rank from 10, so lucky short streaks can't climb the feed.
export const RANK_MIN_BETS = 10;

// Evidence tiers (DESIGN §5.2 TR-9): the thresholds confidence() in lib/trades.ts applies inline. The card recomputes its
// tier from them (lib/record-card.ts) because its "too wide" check reads the arithmetic range it prints (F-4,
// 2026-10-31); a test pins tierFor to confidence()'s tier. Hand-off: trades.ts can call tierFor itself.
export const STRONG = { bets: 100, days: 365 } as const;
export const MODERATE = { bets: 30, days: 90 } as const;
export const tierFor = (k: number, spanDays: number): Confidence['tier'] =>
  k < MIN_BETS ? 'too-early' : k >= STRONG.bets && spanDays >= STRONG.days ? 'strong' : k >= MODERATE.bets && spanDays >= MODERATE.days ? 'moderate' : 'thin';

export const halfWidth = (iv: Pick<Interval, 'low' | 'high'>): number => (iv.high - iv.low) / 2;
export const tooWide = (iv: Pick<Interval, 'low' | 'high'>): boolean => halfWidth(iv) > TOO_WIDE_HALF_WIDTH;

export const evidenceLabel = (c: Pick<Confidence, 'tier'>): string => `Evidence: ${c.tier === 'too-early' ? 'too early' : c.tier}`;

// The sign the trust line speaks of: the interval the card prints, alone (F-4, 2026-10-31 table: "interval entirely
// above 0" / "entirely below 0"; committee 2026-11-01, Q-S). Positive only when the whole range is above 0, negative
// only when it is wholly below: the exact mirror, so losses read like gains.
export type TrustSign = 'positive' | 'negative' | 'unclear';
// Read on the printed one-decimal values (code review 2026-11-01): a range printed "+0.0% and +2.1%" is not "wholly
// above 0", however small and positive its unrounded low end.
const printed = (x: number) => Number((x * 100).toFixed(1));
export function trustSign(c: Pick<Confidence, 'perTrade'>): TrustSign {
  if (!c.perTrade) return 'unclear';
  if (printed(c.perTrade.low) > 0) return 'positive';
  if (printed(c.perTrade.high) < 0) return 'negative';
  return 'unclear';
}

// Committee round 1, demand 1: one duration per card. The share card's period line and its trust line both print
// spanText(spanBetween(first entry, last close), unit), so they cannot disagree ("1 month" beside "60 days").
// F-4 (2026-11-01): a record's length runs from the first trade to the last close, the same on the card and on the
// profile; days are rounded as the profile's evidence line rounds them (Math.round of confidence().spanDays, the same
// two instants), months are whole calendar months in UTC (floors, so the sample is never overstated), years = whole
// months / 12.
const DAY = 86_400_000;
export type Span = { days: number; months: number; years: number };
export function spanBetween(start: Date, end: Date): Span {
  const days = Math.max(0, Math.round((end.getTime() - start.getTime()) / DAY));
  let months = (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + end.getUTCMonth() - start.getUTCMonth();
  if (end.getUTCDate() < start.getUTCDate()) months--;
  months = Math.max(0, months);
  return { days, months, years: Math.floor(months / 12) };
}
export type SpanUnit = 'days' | 'months' | 'years';
// The owner's table names the unit per tier: thin "D days", moderate "M months", strong "Y years" (2026-11-01: the
// period keeps the trust line's unit). A record with no duration in its trust line (under 5 bets, too early) reads in
// months, as the period line's format has it.
export const spanUnit = (tier: Confidence['tier']): SpanUnit => (tier === 'thin' ? 'days' : tier === 'strong' ? 'years' : 'months');
export function spanText(s: Span, unit: SpanUnit): string {
  if (unit === 'days') return counted(Math.max(1, s.days), 'day');
  if (unit === 'years') return counted(Math.max(1, s.years), 'year');
  return s.months < 1 ? 'under 1 month' : counted(s.months, 'month');
}
// Without a span from the card, the record's own span (first entry to last exit) is measured the same way.
const ownSpan = (c: Pick<Confidence, 'spanDays'>): Span => spanBetween(new Date(0), new Date(c.spanDays * DAY));

// The owner's table of 2026-10-31 (it replaces the 2026-10-22 one): the same words for gains and losses. It describes
// the sample, never the trader (POLICY F3b): no skill, no future outcome; "clear pattern" and "consistent" only when
// the interval lies wholly on one side of 0, losses exactly as gains. N is closed trades in the under-5 and too-early
// rows and independent bets (K) elsewhere. `c.perTrade` is the interval the card prints. null for an empty record.
export function trustLine(c: Pick<Confidence, 'n' | 'k' | 'tier' | 'perTrade' | 'spanDays'>, span: Span = ownSpan(c)): string | null {
  if (c.n === 0) return null;
  if (c.k < MIN_BETS) return `Based on ${counted(c.n, 'trade')}. Too few trades to say much yet.`;
  if (c.tier === 'too-early') return `Based on ${counted(c.n, 'trade')}. The range is still too wide to say much.`;
  const sign = trustSign(c);
  const over = spanText(span, spanUnit(c.tier));
  if (c.tier === 'thin') return `Based on ${counted(c.k, 'separate bet')} over ${over}. Still early, and results could go either way.`;
  const side = sign === 'positive' ? 'gains' : 'losses';
  if (c.tier === 'moderate') {
    return `Based on ${counted(c.k, 'bet')} over ${over}. A fair sample, ${sign === 'unclear' ? 'with no clear pattern yet.' : `with a clear pattern of ${side}.`}`;
  }
  return `Based on ${count(c.k)} bets over ${over}. A long record, ${sign === 'unclear' ? 'with no clear pattern.' : `with consistent ${side}.`}`;
}

// AC5's reader test: words a person with no finance or statistics background should never meet in the trust line.
export const TRUST_BANNED = ['confidence interval', 'standard error', 'p-value', 'alpha', 'Sharpe', 'edge', 'signal', 'skill'] as const;
