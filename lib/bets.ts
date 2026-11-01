// F-4 (owner decision 2026-10-31): the share card's "likely between" range is a 95% range around the arithmetic
// average per trade, the same average the headline prints, so the headline always sits inside its range. Pure.
// Leaf on purpose: it imports trades.ts and confidence.ts and nothing imports it back but the card, so there is no
// runtime import cycle (confidence.ts stays type-only towards trades.ts).
// Hand-off (lib/trades.ts owners): confidence() builds the same clusters inline; it can call betClusters() and
// confidence.ts#tierFor instead, and the profile can adopt arithmeticRange() so card and profile print one range.
import { tCrit95, type ConfidenceInput } from './trades.ts';
import { MIN_BETS } from './confidence.ts';

type BetInput = Pick<ConfidenceInput, 'symbol' | 'openedAt' | 'closedAt' | 'returnPct'>;
export type Bet = { sum: number; n: number }; // the bet's summed simple returns and its trade count

// One bet = same-symbol trades whose holds overlap, the boundary instant included: exactly confidence()'s clusters
// (lib/trades.ts), so K here equals confidence().k (tested on random records).
export function betClusters(trades: BetInput[]): Bet[] {
  const bySymbol = new Map<string, BetInput[]>();
  for (const t of trades) { const g = bySymbol.get(t.symbol); if (g) g.push(t); else bySymbol.set(t.symbol, [t]); }
  const bets: Bet[] = [];
  for (const group of bySymbol.values()) {
    const sorted = [...group].sort((a, b) => a.openedAt.getTime() - b.openedAt.getTime());
    let maxClose = -Infinity;
    let cur: Bet | null = null;
    for (const t of sorted) {
      if (cur && t.openedAt.getTime() <= maxClose) { cur.sum += t.returnPct; cur.n++; }
      else { cur = { sum: t.returnPct, n: 1 }; bets.push(cur); }
      maxClose = Math.max(maxClose, t.closedAt.getTime());
    }
  }
  return bets;
}

export type ArithmeticRange = { low: number; mid: number; high: number; k: number };
// mid = Σr / n (headline().avgReturn, over every trade); se = √(K/(K−1) · Σ_bets (S_b − n_b·mid)²) / n, the
// cluster-robust standard error (bets, not trades, are independent); low/high = mid ∓ t(K−1)·se. se ≥ 0, so
// low ≤ mid ≤ high always. null below MIN_BETS bets or when any value is not finite.
export function arithmeticRange(trades: BetInput[]): ArithmeticRange | null {
  const bets = betClusters(trades);
  const k = bets.length, n = trades.length;
  if (k < MIN_BETS) return null;
  const mid = bets.reduce((a, b) => a + b.sum, 0) / n;
  const se = Math.sqrt((k / (k - 1)) * bets.reduce((a, b) => a + (b.sum - b.n * mid) ** 2, 0)) / n;
  const half = tCrit95(k - 1) * se;
  const r = { low: mid - half, mid, high: mid + half, k };
  return [r.low, r.mid, r.high].every(Number.isFinite) ? r : null;
}
