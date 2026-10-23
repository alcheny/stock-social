// Pure trade math. No I/O — everything shown to users is derived here from raw activities,
// so a bug is fixed by recomputing (see docs/DESIGN.md §2.5).

import { count, counted } from './format.ts';

export type Activity = {
  externalId: string;
  accountId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  units: number;
  price: number;
  fee: number;
  executedAt: Date;
  verified: boolean;
};

export type ClosedTrade = {
  sellId: string; // externalId of the closing SELL; stable key for re-attaching theses
  accountId: string;
  symbol: string;
  openedAt: Date;
  closedAt: Date;
  returnPct: number;
  holdingDays: number;
  verified: boolean;
};

type Lot = { units: number; price: number; feePerUnit: number; at: Date; verified: boolean };

const EPS = 1e-9;
const DAY = 86_400_000;

// FIFO, long only. One closed trade per SELL. Sells with no recorded entry are excluded, never guessed.
export function matchTrades(activities: Activity[]): { trades: ClosedTrade[]; excluded: number } {
  const sorted = [...activities].sort((a, b) => a.executedAt.getTime() - b.executedAt.getTime());
  const lots = new Map<string, Lot[]>();
  const trades: ClosedTrade[] = [];
  let excluded = 0;

  for (const a of sorted) {
    const key = `${a.accountId}|${a.symbol}`;
    const open = lots.get(key) ?? [];
    lots.set(key, open);

    if (a.side === 'BUY') {
      open.push({ units: a.units, price: a.price, feePerUnit: a.fee / a.units, at: a.executedAt, verified: a.verified });
      continue;
    }

    let remaining = a.units;
    let cost = 0;
    let entryFees = 0;
    let openedAt: Date | null = null;
    let verified = a.verified;
    while (remaining > EPS && open.length) {
      const lot = open[0];
      const take = Math.min(lot.units, remaining);
      cost += take * lot.price;
      entryFees += take * lot.feePerUnit;
      openedAt ??= lot.at;
      verified &&= lot.verified;
      lot.units -= take;
      remaining -= take;
      if (lot.units <= EPS) open.shift();
    }

    if (remaining > EPS) excluded++;
    const matched = a.units - remaining;
    if (matched <= EPS || !openedAt) continue;

    const exitFee = a.fee * (matched / a.units);
    trades.push({
      sellId: a.externalId,
      accountId: a.accountId,
      symbol: a.symbol,
      openedAt,
      closedAt: a.executedAt,
      returnPct: (matched * a.price - cost - entryFees - exitFee) / cost,
      holdingDays: (a.executedAt.getTime() - openedAt.getTime()) / DAY,
      verified,
    });
  }
  return { trades, excluded };
}

export type Stats = {
  trades: number;
  winRate: number;
  avgReturn: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number | null; // null when there are no losses
  medianHoldingDays: number;
  maxDrawdown: number; // of an equal-weighted per-trade equity curve, NOT account return
};

export type CurvePoint<T> = { trade: T; cumulative: number }; // cumulative: 0.1 = +10% compounded

// Compounded equal-weight series, one step per close (ties keep input order). The chart draws its 0%
// start just before the first point. stats().maxDrawdown reads this same series.
export function equityCurve<T extends { returnPct: number; closedAt: Date }>(trades: T[]): CurvePoint<T>[] {
  let equity = 1;
  return [...trades]
    .sort((a, b) => a.closedAt.getTime() - b.closedAt.getTime())
    .map((trade) => ({ trade, cumulative: (equity *= 1 + trade.returnPct) - 1 }));
}

export function maxDrawdown(curve: { cumulative: number }[]): number {
  let peak = 1, worst = 0;
  for (const { cumulative } of curve) {
    const equity = 1 + cumulative;
    peak = Math.max(peak, equity);
    worst = Math.max(worst, (peak - equity) / peak);
  }
  return worst;
}

// Y range for the chart: always contains 0% and every point, never cropped to flatter the curve.
export function curveDomain(curve: { cumulative: number }[]): { min: number; max: number } {
  const v = curve.map((p) => p.cumulative);
  return { min: Math.min(0, ...v), max: Math.max(0, ...v) };
}

// The two headline numbers (win rate, average return), in one pass. stats() reads them from here, and so does the feed
// pane (lib/pane.ts#paneSummary, F-2 PR-1 fix round 2: it needs only these two, not the sorted holds and drawdown curve),
// so the pane and the profile can never disagree.
export function headline(trades: Pick<ClosedTrade, 'returnPct'>[]): { winRate: number; avgReturn: number } {
  let wins = 0, sum = 0;
  for (const t of trades) { if (t.returnPct > 0) wins++; sum += t.returnPct; }
  return { winRate: trades.length ? wins / trades.length : 0, avgReturn: trades.length ? sum / trades.length : 0 };
}

export function stats(trades: Pick<ClosedTrade, 'returnPct' | 'holdingDays' | 'closedAt'>[]): Stats {
  const r = trades.map((t) => t.returnPct);
  const wins = r.filter((x) => x > 0);
  const losses = r.filter((x) => x <= 0);
  const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
  const avg = (xs: number[]) => (xs.length ? sum(xs) / xs.length : 0);

  const holds = trades.map((t) => t.holdingDays).sort((a, b) => a - b);
  const mid = holds.length >> 1;
  const median = !holds.length ? 0 : holds.length % 2 ? holds[mid] : (holds[mid - 1] + holds[mid]) / 2;

  const lossSum = Math.abs(sum(losses));
  const { winRate, avgReturn } = headline(trades);
  return {
    trades: r.length,
    winRate,
    avgReturn,
    avgWin: avg(wins),
    avgLoss: avg(losses),
    profitFactor: lossSum ? sum(wins) / lossSum : null,
    medianHoldingDays: median,
    maxDrawdown: maxDrawdown(equityCurve(trades)),
  };
}

// Signed percent. A value that rounds to zero reads "0.0%" (never "-0.0%" or "+0.0%", same as an exact zero). A loss
// short of -100% never rounds to a total loss: it gets up to 4 more digits ("-99.98%"), and past that reads "≈-100.0%".
export function pct(x: number, digits = 1): string {
  const fixed = (d: number) => (x * 100).toFixed(d);
  let s = fixed(digits);
  if (Number(s) === 0) return `${fixed(digits).replace('-', '')}%`;
  if (x > -1 && Number(s) <= -100) {
    for (let d = digits + 1; d <= digits + 4 && Number(s) <= -100; d++) s = fixed(d);
    if (Number(s) <= -100) return `≈${fixed(digits)}%`;
  }
  return `${x > 0 ? '+' : ''}${s}%`;
}

// Chart navigation: arrow keys move the active point, clamped at the ends (no wrap, so the ends are obvious).
export const stepIndex = (i: number, delta: number, n: number) => Math.min(Math.max(i + delta, 0), n - 1);

// Scrubbing snaps to the point whose x is closest to the pointer (first wins on ties).
export function nearestIndex(xs: number[], px: number): number {
  let best = 0;
  for (let i = 1; i < xs.length; i++) if (Math.abs(xs[i] - px) < Math.abs(xs[best] - px)) best = i;
  return best;
}

// Chart range tabs. A range keeps trades closed within `days` of `now` (all trades for ALL) and
// re-compounds them from 0%, so the header reads "return over this range".
export const RANGES = [
  { key: '1W', days: 7, label: 'Past week' },
  { key: '1M', days: 30, label: 'Past month' },
  { key: '3M', days: 91, label: 'Past 3 months' },
  { key: '1Y', days: 365, label: 'Past year' },
  { key: 'ALL', days: null, label: 'All time' },
] as const;
export type RangeKey = (typeof RANGES)[number]['key'];

export function rangeTrades<T extends { closedAt: Date }>(trades: T[], key: RangeKey, now: Date): T[] {
  const days = RANGES.find((r) => r.key === key)!.days;
  if (days === null) return trades;
  const from = now.getTime() - days * 86_400_000;
  return trades.filter((t) => t.closedAt.getTime() >= from);
}

// Cumulative return of the range (0 when empty). Green when it ends at or above its start.
export function rangeReturn(trades: { returnPct: number; closedAt: Date }[], key: RangeKey, now: Date): number {
  const c = equityCurve(rangeTrades(trades, key, now));
  return c.length ? c[c.length - 1].cumulative : 0;
}

// ---- TR-9: how much evidence stands behind the average return (DESIGN Stage 5.2) ----
// ponytail: open positions (TR-4) are deferred; closed trades only until that data exists.

export type ConfidenceInput = Pick<ClosedTrade, 'symbol' | 'openedAt' | 'closedAt' | 'returnPct' | 'holdingDays'>;
export type Tier = 'too-early' | 'thin' | 'moderate' | 'strong';
export type Edge = 'positive' | 'negative' | 'unclear';
export const edgeText = (e: Edge | null) => (e === 'positive' ? 'above zero' : e === 'negative' ? 'below zero' : 'unclear');

export type Interval = { low: number; mid: number; high: number };
export type Confidence = {
  n: number; k: number; spanDays: number;
  tier: Tier; edge: Edge | null;
  perTrade: Interval | null; // simple returns (0.013 = +1.3%)
  pace30: Interval | null; // per 30 days invested
  tradesPerMonth: number;
};

const T95 = [12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201, 2.179, 2.160, 2.145, 2.131,
  2.120, 2.110, 2.101, 2.093, 2.086, 2.080, 2.074, 2.069, 2.064, 2.060, 2.056, 2.052, 2.048, 2.045, 2.042];
// Exact table for df 1..30. Beyond that 1.96 + 2.4/df: 2.040 at df=30 (table: 2.042), tends to 1.96.
export const tCrit95 = (df: number) => (df <= 30 ? T95[Math.max(df, 1) - 1] : 1.96 + 2.4 / df);

type Cluster = { x: number; d: number; n: number };

export function confidence(trades: ConfidenceInput[], today: Date): Confidence {
  void today; // reserved for open positions (TR-4)
  const n = trades.length;
  const bySymbol = new Map<string, ConfidenceInput[]>();
  // F-2 PR-1 fix round 1 (load check): push, not copy (a copy per trade was quadratic in a symbol's trade count).
  for (const t of trades) { const g = bySymbol.get(t.symbol); if (g) g.push(t); else bySymbol.set(t.symbol, [t]); }
  // A cluster = same-symbol trades whose holds overlap (inclusive of the boundary instant): one bet.
  const clusters: Cluster[] = [];
  for (const group of bySymbol.values()) {
    group.sort((a, b) => a.openedAt.getTime() - b.openedAt.getTime());
    let maxClose = -Infinity;
    let cur: Cluster | null = null;
    for (const t of group) {
      const x = Math.log(Math.max(1 + t.returnPct, 1e-9));
      const d = Math.max(t.holdingDays, 1);
      if (cur && t.openedAt.getTime() <= maxClose) {
        cur.x += x; cur.d += d; cur.n++;
      } else {
        cur = { x, d, n: 1 };
        clusters.push(cur);
      }
      maxClose = Math.max(maxClose, t.closedAt.getTime());
    }
  }
  const k = clusters.length;
  const spanDays = n ? (Math.max(...trades.map((t) => t.closedAt.getTime())) - Math.min(...trades.map((t) => t.openedAt.getTime()))) / DAY : 0;
  const tradesPerMonth = (n / Math.max(spanDays, 30)) * 30; // display only
  const tier: Tier = k < 10 ? 'too-early' : k >= 100 && spanDays >= 365 ? 'strong' : k >= 30 && spanDays >= 90 ? 'moderate' : 'thin';
  const base = { n, k, spanDays, tradesPerMonth };
  if (tier === 'too-early') return { ...base, tier, edge: null, perTrade: null, pace30: null };

  const t = tCrit95(k - 1);
  const sumX = clusters.reduce((a, c) => a + c.x, 0);
  const sumD = clusters.reduce((a, c) => a + c.d, 0);
  const m = sumX / n;
  const seM = Math.sqrt((k / (k - 1)) * clusters.reduce((a, c) => a + (c.x - c.n * m) ** 2, 0)) / n;
  const R = sumX / sumD;
  const seR = Math.sqrt((k / (k - 1)) * clusters.reduce((a, c) => a + (c.x - R * c.d) ** 2, 0)) / sumD;
  const perTrade = { low: Math.expm1(m - t * seM), mid: Math.expm1(m), high: Math.expm1(m + t * seM) };
  const pace30 = { low: Math.expm1(30 * (R - t * seR)), mid: Math.expm1(30 * R), high: Math.expm1(30 * (R + t * seR)) };
  if (![...Object.values(perTrade), ...Object.values(pace30)].every(Number.isFinite)) {
    return { ...base, tier: 'too-early', edge: null, perTrade: null, pace30: null };
  }
  const edge: Edge = pace30.low > 0 ? 'positive' : pace30.high < 0 ? 'negative' : 'unclear';
  return { ...base, tier, edge, perTrade, pace30 };
}

const plural = (n: number, w: string) => counted(n, w);

// Plain text shared by the profile, the share card and page metadata. Negative edges read the same as positive.
// F-1 PR-3 fix round 4 (UX lead note 3): when trades outnumber bets, the line says why. Same-stock trades whose holds
// overlap (in any account) are one bet, so a trader who scales in and out of a held position, or holds one stock in
// several accounts, has few independent bets however many trades: "2,828 trades in 9 overlapping positions".
export function evidenceLine(c: Confidence): string {
  const grouped = c.n > c.k;
  if (c.tier === 'too-early' || !c.edge) {
    return grouped
      ? `Too early to tell: ${counted(c.n, 'trade')} in ${counted(c.k, 'overlapping position')} (10 independent bets needed)`
      : `Too early to tell (${count(c.k)} of 10 bets)`;
  }
  return `Past results: ${edgeText(c.edge)} · Evidence: ${c.tier} (${plural(c.k, 'bet')}${grouped ? ` from ${counted(c.n, 'trade')}` : ''}, ${plural(Math.round(c.spanDays), 'day')})`;
}

export const rangeText = (c: Confidence): string | null =>
  c.perTrade ? `(${pct(c.perTrade.low)} to ${pct(c.perTrade.high)})` : null;

// TR-7: under 30 days of history or fewer than 10 closed trades.
export function isNewRecord(trades: { openedAt: Date }[], closedCount: number, today: Date): boolean {
  if (!trades.length) return true;
  const first = Math.min(...trades.map((t) => t.openedAt.getTime()));
  return (today.getTime() - first) / DAY < 30 || closedCount < 10;
}

// Feed order: traders with a confident edge first (weight > 0), by weight × score; the rest keep score order.
// weight = log-distance of the pace interval from zero in either direction, so equal losses and gains tie.
export const evidenceWeight = (c: Confidence): number => (c.pace30 ? Math.max(0, Math.log1p(c.pace30.low), -Math.log1p(c.pace30.high)) : 0);

export function rankTraders<T extends { weight: number; score: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    if ((a.weight > 0) !== (b.weight > 0)) return a.weight > 0 ? -1 : 1;
    return b.weight * b.score - a.weight * a.score || b.score - a.score;
  });
}
