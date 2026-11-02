// F-33: the one ranking weight (DESIGN TR-9's Ranking Must; owner decisions of 2026-11-02: cycle-5 Q3, OD 2.32, OD 2.33).
// Pure. lib/feed.ts#weights() and, through TraderFacts, the suggestions section read it; nothing prints it.
//
// K bets b (lib/bets.ts#betClusters: same-symbol trades whose holds overlap), each with S_b = Σ simple returns,
// D_b = Σ max(hold days, 1), n_b trades; n = Σ n_b.
//   R      = Σ S_b / Σ D_b                                return per day held, on simple returns (OD 2.32)
//   ss     = Σ (S_b − R·D_b)²
//   v      = max(ss / (K−1), SPREAD_FLOOR² · n / K)       per-bet variance; the floor is 1 point per trade (Q3)
//   se     = √(K · v) / Σ D_b
//   pace30 = 30 · (R ∓ t(K−1) · se)                       the likely range of the return per 30 days held
//   weight = max(0, pace30.low, −pace30.high)             near-edge distance from 0 (OD 2.33, method (c))
// The weight is 0 unless the record is at the moderate tier or above (RANK_MIN_BETS bets AND RANK_MIN_DAYS days) and
// its printed per-trade range (the card's arithmetic one, unfloored) is no wider than TOO_WIDE_HALF_WIDTH either side.
// The tier is checked before any arithmetic. Negating every return negates R and every residual, so a record and its
// mirror weigh exactly the same: a loss ranks like a gain of the same size.
// ponytail: closed trades only; losers held open don't lower the weight (OD 2.34) — fix: count each open position as a
// provisional bet at its unrealized percent and days held so far.
import { arithmeticFromBets, betClusters, type Bet } from './bets.ts';
import { RANK_MIN_BETS, RANK_MIN_DAYS, SPREAD_FLOOR, TOO_WIDE_HALF_WIDTH, tierFor } from './confidence.ts';
import { recordSpanDays, tCrit95, type ConfidenceInput, type Interval } from './trades.ts';

export { RANK_FORMULA } from './confidence.ts';

// The pace interval on clustered bets. `floor` = SPREAD_FLOOR for ranking; 0 gives the unfloored interval (tests).
// null below 2 bets (no variance) or when any value is not finite.
export function paceInterval(bets: readonly Bet[], n: number, floor = SPREAD_FLOOR): Interval | null {
  const k = bets.length;
  if (k < 2) return null;
  let sumS = 0, sumD = 0;
  for (const b of bets) { sumS += b.sum; sumD += b.days; }
  const R = sumS / sumD;
  let ss = 0;
  for (const b of bets) ss += (b.sum - R * b.days) ** 2;
  const v = Math.max(ss / (k - 1), floor ** 2 * n / k);
  const half = tCrit95(k - 1) * Math.sqrt(k * v) / sumD;
  const iv = { low: 30 * (R - half), mid: 30 * R, high: 30 * (R + half) };
  return [iv.low, iv.mid, iv.high].every(Number.isFinite) ? iv : null;
}

// Near-edge distance of an interval from 0: the low end when it is wholly above 0, minus the high end when wholly below.
export const nearEdge = (iv: Pick<Interval, 'low' | 'high'>): number => Math.max(0, iv.low, -iv.high);

// The gate alone (no arithmetic): the moderate tier or above. tierFor's moderate tier is exactly
// RANK_MIN_BETS bets AND RANK_MIN_DAYS days (a test pins the two equal).
export const atRankTier = (k: number, spanDays: number): boolean => {
  const tier = tierFor(k, spanDays);
  return (tier === 'moderate' || tier === 'strong') && k >= RANK_MIN_BETS && spanDays >= RANK_MIN_DAYS;
};

export function rankWeight(trades: readonly ConfidenceInput[]): number {
  if (trades.length < RANK_MIN_BETS) return 0; // fewer trades than bets needed: no clustering either
  const bets = betClusters(trades as ConfidenceInput[]);
  if (!atRankTier(bets.length, recordSpanDays(trades))) return 0;
  const printed = arithmeticFromBets(bets, trades.length);
  if (!printed || !Number.isFinite(printed.half) || printed.half > TOO_WIDE_HALF_WIDTH) return 0;
  const pace = paceInterval(bets, trades.length);
  return pace ? nearEdge(pace) : 0;
}
