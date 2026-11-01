// F-6 · Open positions in every number (docs/features/F-6-open-positions.md, plan docs/features/logs/F-6/plan.md).
// Pure and string-free (copy is OPEN in lib/copy.ts): open positions at their current unrealized percent, summarized
// beside the realized record (closed trades, lib/trades.ts#headline), and one combined average that includes them.
// Percent only (POLICY P3): the inputs are return and unrealized percents, never units, prices or amounts. Every
// surface that shows open positions (profile, feed card and pane, stock pages, share card) reads them from here.

// tone() and Tone live in lib/format.ts (F-19: one home); re-exported here so existing imports keep working.
import { tone, type Tone } from './format.ts';
export { tone, type Tone };

// A11Y-FIXES #23: the colour class for a percent as printed: up or down, and none for flat (it inherits the text
// colour). The word beside it is signWord in lib/copy.ts (this file stays string-free).
export const toneClass = (x: number): 'up' | 'down' | undefined => { const t = tone(x); return t === 'up' || t === 'down' ? t : undefined; }; // lib's twin of app/open-rows.tsx#toneClass (both delegate to lib/format.ts#tone)

// Open positions as a set: each row is one position (one symbol held in two accounts is two), counted up, down and
// flat by tone, averaged with equal weight (an amount-weighted average would need amounts we never store).
export type OpenSummary = { n: number; up: number; down: number; flat: number; avg: number };
export function openSummary(unrealized: number[]): OpenSummary | null {
  const xs = unrealized.filter(Number.isFinite);
  if (!xs.length) return null;
  let up = 0, down = 0, sum = 0;
  for (const x of xs) { const t = tone(x); if (t === 'up') up++; else if (t === 'down') down++; sum += x; }
  return { n: xs.length, up, down, flat: xs.length - up - down, avg: sum / xs.length };
}

// Every closed trade and every open position counted as one result, equal weight: the average return per result,
// open positions at current value. Only when there are both: with no open positions it would repeat the realized
// average, with no closes the open one.
export function combined(closed: number[], unrealized: number[]): { n: number; avg: number } | null {
  const done = closed.filter(Number.isFinite), open = unrealized.filter(Number.isFinite);
  if (!done.length || !open.length) return null;
  let sum = 0;
  for (const x of done) sum += x;
  for (const x of open) sum += x;
  return { n: done.length + open.length, avg: sum / (done.length + open.length) };
}
