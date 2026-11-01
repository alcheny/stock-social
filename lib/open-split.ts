// F-6 · Open positions in every number (docs/features/F-6-open-positions.md, plan docs/features/logs/F-6/plan.md).
// Pure: a record split into realized (closed trades) and unrealized (open positions at their current unrealized
// percent), and a combined figure that says it includes open positions. Percent only (POLICY P3): the inputs are
// return and unrealized percents, never units, prices or amounts. Every surface that shows the split (profile, feed
// card and pane, stock pages, and the share card) reads it from here, so the numbers agree everywhere.
import { headline } from './trades.ts';

// The sign of the value as printed by pct() (one decimal): "0.0%" is flat, never colored and never called up or
// down, so color and words can't contradict the number shown.
export type Tone = 'up' | 'down' | 'flat';
export function tone(x: number): Tone {
  const shown = Number((x * 100).toFixed(1));
  return shown > 0 ? 'up' : shown < 0 ? 'down' : 'flat';
}
export const toneClass = (t: Tone): string => (t === 'flat' ? '' : t);

// Open positions as a set: each row is one position (one symbol held in two accounts is two), counted up, down and
// flat by tone, and averaged with equal weight (an amount-weighted average would need amounts we never store).
export type OpenSummary = { n: number; up: number; down: number; flat: number; avg: number };
export function openSummary(unrealized: number[]): OpenSummary | null {
  const xs = unrealized.filter(Number.isFinite);
  if (!xs.length) return null;
  let up = 0, down = 0, sum = 0;
  for (const x of xs) { const t = tone(x); if (t === 'up') up++; else if (t === 'down') down++; sum += x; }
  return { n: xs.length, up, down, flat: xs.length - up - down, avg: sum / xs.length };
}

export type Headline = { n: number; winRate: number; avgReturn: number };
export type Split = { realized: Headline | null; open: OpenSummary | null; combined: Headline | null };

// realized: exactly headline() (the profile's and pane's numbers today). open: the summary above. combined: every
// closed trade and every open position counted as one result each, equal weight; a win is a value above 0, the same
// rule as headline(). Combined only when there are both closes and open positions: with no open positions it would
// repeat realized, with no closes it would repeat the open summary.
export function split(closed: number[], unrealized: number[]): Split {
  const realized = closed.length ? { n: closed.length, ...headline(closed.map((returnPct) => ({ returnPct }))) } : null;
  const open = openSummary(unrealized);
  const combined = realized && open
    ? { n: closed.length + open.n, ...headline([...closed, ...unrealized.filter(Number.isFinite)].map((returnPct) => ({ returnPct }))) }
    : null;
  return { realized, open, combined };
}
