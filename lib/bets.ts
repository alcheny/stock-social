// F-4 (owner decision 2026-10-31): the share card's "likely between" range is a 95% range around the arithmetic
// average per trade, the same average the headline prints, so the headline always sits inside its range. Pure.
// Leaf on purpose: it imports trades.ts and confidence.ts and nothing imports it back but the card, so there is no
// runtime import cycle (confidence.ts stays type-only towards trades.ts).
// Hand-off (lib/trades.ts owners): confidence() builds the same clusters inline; it can call betClusters() and
// confidence.ts#tierFor instead, and the profile can adopt arithmeticRange() so card and profile print one range.
import { tCrit95, type ConfidenceInput } from './trades.ts';
import { MIN_BETS } from './confidence.ts';

// F-33: holdingDays is optional (the card's callers may not pass it); a bet's days are Σ max(holdingDays ?? 1, 1), the
// same per-trade floor of 1 day as confidence()'s clusters. Only the ranking weight (lib/rank-weight.ts) reads `days`.
type BetInput = Pick<ConfidenceInput, 'symbol' | 'openedAt' | 'closedAt' | 'returnPct'> & { holdingDays?: number };
export type Bet = { sum: number; n: number; days: number }; // the bet's summed simple returns, its trade count, its days held

// One bet = same-symbol trades whose holds overlap, the boundary instant included: exactly confidence()'s clusters
// (lib/trades.ts), so K here equals confidence().k (tested on random records).
// ponytail: confidence() in lib/trades.ts builds these clusters a second time, inline — have it call betClusters (the
// property test in lib/bets.test.ts already pins K equal on 1,000 random records).
export function betClusters(trades: BetInput[]): Bet[] {
  const bySymbol = new Map<string, BetInput[]>();
  for (const t of trades) { const g = bySymbol.get(t.symbol); if (g) g.push(t); else bySymbol.set(t.symbol, [t]); }
  const bets: Bet[] = [];
  for (const group of bySymbol.values()) {
    const sorted = [...group].sort((a, b) => a.openedAt.getTime() - b.openedAt.getTime());
    let maxClose = -Infinity;
    let cur: Bet | null = null;
    for (const t of sorted) {
      const d = Math.max(t.holdingDays ?? 1, 1);
      if (cur && t.openedAt.getTime() <= maxClose) { cur.sum += t.returnPct; cur.n++; cur.days += d; }
      else { cur = { sum: t.returnPct, n: 1, days: d }; bets.push(cur); }
      maxClose = Math.max(maxClose, t.closedAt.getTime());
    }
  }
  return bets;
}

// `half`: the unclamped half-width (t · se), which the "too wide" check reads (code review: the -100% stop on the
// printed low end must not make a wide record look narrow).
export type ArithmeticRange = { low: number; mid: number; high: number; k: number; half: number };
// mid = Σr / n (headline().avgReturn, over every trade); se = √(K/(K−1) · Σ_bets (S_b − n_b·mid)²) / n, the
// cluster-robust standard error (bets, not trades, are independent); low/high = mid ∓ t(K−1)·se. se ≥ 0, so
// low ≤ mid ≤ high always. A trade can't lose more than everything, so the low end stops at -100% (QA 2026-11-01:
// a 6-bet record with four -99% trades printed "likely between -211.2% and …"). null below MIN_BETS bets or when any
// value is not finite.
export function arithmeticRange(trades: BetInput[]): ArithmeticRange | null {
  return arithmeticFromBets(betClusters(trades), trades.length);
}
// F-33: the same range on already-clustered bets (n = trades), so the ranking weight clusters once.
export function arithmeticFromBets(bets: readonly Bet[], n: number): ArithmeticRange | null {
  const k = bets.length;
  if (k < MIN_BETS) return null;
  const mid = bets.reduce((a, b) => a + b.sum, 0) / n;
  const se = Math.sqrt((k / (k - 1)) * bets.reduce((a, b) => a + (b.sum - b.n * mid) ** 2, 0)) / n;
  const half = tCrit95(k - 1) * se;
  const r = { low: Math.max(-1, mid - half), mid, high: mid + half, k, half };
  return [r.low, r.mid, r.high].every(Number.isFinite) ? r : null;
}
