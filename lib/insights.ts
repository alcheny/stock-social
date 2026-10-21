// Private "My record" insights: pure computation on read from closed trades. Percentages only.
import { pct } from './trades.ts';
import type { ClosedTrade } from './trades.ts';

export const MIN_TRADES = 5;

export type InsightTrade = Pick<ClosedTrade, 'symbol' | 'returnPct' | 'holdingDays' | 'closedAt'>;
export type Bucket = {
  key: 'lt1' | 'd1to7' | 'd7to28' | 'gte28'; label: string; n: number; enough: boolean;
  winRate: number | null; avgReturn: number | null; takeaway: string | null;
};
export type SymbolStat = { symbol: string; n: number; avgReturn: number };
export type Insights = {
  total: number;
  buckets: Bucket[];
  symbols: { enough: boolean; best: SymbolStat | null; worst: SymbolStat | null; takeaway: string | null };
  winLoss: { enough: boolean; wins: number; losses: number; avgWin: number | null; avgLoss: number | null; takeaway: string | null };
  streak: { enough: boolean; longestLosing: number | null; takeaway: string | null };
};

const BUCKETS: { key: Bucket['key']; label: string; text: string; lo: number; hi: number }[] = [
  { key: 'lt1', label: 'Under 1 day', text: 'under 1 day', lo: -Infinity, hi: 1 },
  { key: 'd1to7', label: '1 to under 7 days', text: '1 to under 7 days', lo: 1, hi: 7 },
  { key: 'd7to28', label: '7 to under 28 days', text: '7 to under 28 days', lo: 7, hi: 28 },
  { key: 'gte28', label: '28 days or more', text: '28 days or more', lo: 28, hi: Infinity },
];

const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

export function insights(trades: InsightTrade[]): Insights {
  const buckets: Bucket[] = BUCKETS.map((b) => {
    const rs = trades.filter((t) => t.holdingDays >= b.lo && t.holdingDays < b.hi).map((t) => t.returnPct);
    const enough = rs.length >= MIN_TRADES;
    const winRate = enough ? rs.filter((r) => r > 0).length / rs.length : null;
    const avgReturn = enough ? mean(rs) : null;
    return {
      key: b.key, label: b.label, n: rs.length, enough, winRate, avgReturn,
      takeaway: enough ? `Trades held ${b.text} won ${Math.round(winRate! * 100)}% of the time and averaged ${pct(avgReturn!)}.` : null,
    };
  });

  const bySymbol = new Map<string, number[]>();
  for (const t of trades) bySymbol.set(t.symbol, [...(bySymbol.get(t.symbol) ?? []), t.returnPct]);
  const cands: SymbolStat[] = [...bySymbol].filter(([, rs]) => rs.length >= MIN_TRADES)
    .map(([symbol, rs]) => ({ symbol, n: rs.length, avgReturn: mean(rs) }))
    .sort((a, b) => (a.symbol < b.symbol ? -1 : a.symbol > b.symbol ? 1 : 0));
  let symbols: Insights['symbols'] = { enough: false, best: null, worst: null, takeaway: null };
  if (cands.length) {
    let best = cands[0], worst = cands[0];
    for (const c of cands) { if (c.avgReturn > best.avgReturn) best = c; if (c.avgReturn <= worst.avgReturn) worst = c; }
    const desc = (s: SymbolStat) => `${pct(s.avgReturn)} on average over ${s.n} trades`;
    symbols = best === worst
      ? { enough: true, best, worst: null, takeaway: `Your only symbol with enough trades was ${best.symbol} at ${desc(best)}.` }
      : { enough: true, best, worst, takeaway: `Your best symbol was ${best.symbol} at ${desc(best)}; your weakest was ${worst.symbol} at ${pct(worst.avgReturn)} over ${worst.n}.` };
  }

  const wins = trades.filter((t) => t.returnPct > 0).map((t) => t.returnPct);
  const losses = trades.filter((t) => t.returnPct < 0).map((t) => t.returnPct);
  const avgWin = wins.length >= MIN_TRADES ? mean(wins) : null;
  const avgLoss = losses.length >= MIN_TRADES ? mean(losses) : null;
  const winLoss = {
    enough: avgWin !== null || avgLoss !== null, wins: wins.length, losses: losses.length, avgWin, avgLoss,
    takeaway: avgWin !== null && avgLoss !== null ? `Your average win was ${pct(avgWin)} and your average loss was ${pct(avgLoss)}.`
      : avgWin !== null ? `Your average win was ${pct(avgWin)}.`
      : avgLoss !== null ? `Your average loss was ${pct(avgLoss)}.` : null,
  };

  let streak: Insights['streak'] = { enough: false, longestLosing: null, takeaway: null };
  if (trades.length >= MIN_TRADES) {
    const sorted = [...trades].sort((a, b) => a.closedAt.getTime() - b.closedAt.getTime());
    let run = 0, longest = 0;
    for (const t of sorted) { run = t.returnPct < 0 ? run + 1 : 0; if (run > longest) longest = run; }
    streak = { enough: true, longestLosing: longest, takeaway: `Your longest run of losing trades in a row was ${longest}.` };
  }

  return { total: trades.length, buckets, symbols, winLoss, streak };
}

// A visit is an owner open at least this long after the previous one; refreshes inside a visit change nothing.
export const VISIT_GAP_MS = 30 * 60 * 1000;

export function visitDecision(now: Date, last: Date | null, prev: Date | null, first: Date | null): { roll: boolean; baseline: Date | null } {
  const roll = last === null || now.getTime() - last.getTime() >= VISIT_GAP_MS;
  return { roll, baseline: roll ? last ?? first : prev };
}

export type Movement = { winRate: { before: number; now: number }; avgReturn: { before: number; now: number } };
export type SinceLast = {
  baseline: Date | null; fresh: InsightTrade[]; nowN: number; beforeN: number;
  enough: boolean; movement: Movement | null; takeaway: string | null;
};

const winRate = (ts: InsightTrade[]) => ts.filter((t) => t.returnPct > 0).length / ts.length;
const avgOf = (ts: InsightTrade[]) => mean(ts.map((t) => t.returnPct));

export function sinceLast(trades: InsightTrade[], baseline: Date | null): SinceLast {
  if (!baseline) return { baseline, fresh: [], nowN: trades.length, beforeN: 0, enough: false, movement: null, takeaway: null };
  const b = baseline.getTime();
  const before = trades.filter((t) => t.closedAt.getTime() <= b);
  const fresh = trades.filter((t) => t.closedAt.getTime() > b).sort((x, y) =>
    y.closedAt.getTime() - x.closedAt.getTime() || (x.symbol < y.symbol ? -1 : x.symbol > y.symbol ? 1 : 0) || x.returnPct - y.returnPct);
  const enough = before.length >= MIN_TRADES && trades.length >= MIN_TRADES;
  if (!enough) return { baseline, fresh, nowN: trades.length, beforeN: before.length, enough, movement: null, takeaway: null };
  const movement: Movement = {
    winRate: { before: winRate(before), now: winRate(trades) },
    avgReturn: { before: avgOf(before), now: avgOf(trades) },
  };
  const w = (x: number) => `${Math.round(x * 100)}%`;
  const { winRate: wr, avgReturn: ar } = movement;
  const same = w(wr.before) === w(wr.now) && pct(ar.before) === pct(ar.now);
  const takeaway = same
    ? `Win rate and average return are unchanged: ${w(wr.now)} and ${pct(ar.now)}.`
    : `Win rate went from ${w(wr.before)} to ${w(wr.now)} and average return from ${pct(ar.before)} to ${pct(ar.now)}.`;
  return { baseline, fresh, nowN: trades.length, beforeN: before.length, enough, movement, takeaway };
}

export type HoldSide = { n: number; enough: boolean; avgDays: number | null };
export type AfterSide = { n: number; enough: boolean; winRate: number | null; avgReturn: number | null };
export type Habits = {
  total: number;
  hold: { winners: HoldSide; losers: HoldSide; takeaway: string | null };
  after: { win: AfterSide; loss: AfterSide; takeaway: string | null };
};

const holdSide = (ts: InsightTrade[]): HoldSide => {
  const enough = ts.length >= MIN_TRADES;
  return { n: ts.length, enough, avgDays: enough ? mean(ts.map((t) => t.holdingDays)) : null };
};
const afterSide = (ts: InsightTrade[]): AfterSide => {
  const enough = ts.length >= MIN_TRADES;
  return { n: ts.length, enough, winRate: enough ? winRate(ts) : null, avgReturn: enough ? avgOf(ts) : null };
};

export function habits(trades: InsightTrade[]): Habits {
  const winners = holdSide(trades.filter((t) => t.returnPct > 0));
  const losers = holdSide(trades.filter((t) => t.returnPct < 0));
  const holdTake = winners.enough && losers.enough
    ? `Your losing trades were held ${losers.avgDays!.toFixed(1)} days on average and your winning trades ${winners.avgDays!.toFixed(1)}.` : null;

  const sorted = [...trades].sort((a, b) => a.closedAt.getTime() - b.closedAt.getTime()
    || (a.symbol < b.symbol ? -1 : a.symbol > b.symbol ? 1 : 0) || a.returnPct - b.returnPct);
  const afterWin: InsightTrade[] = [], afterLoss: InsightTrade[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1].returnPct;
    if (prev > 0) afterWin.push(sorted[i]); else if (prev < 0) afterLoss.push(sorted[i]);
  }
  const win = afterSide(afterWin), loss = afterSide(afterLoss);
  const w = (x: number) => `${Math.round(x * 100)}%`;
  const afterTake = win.enough && loss.enough
    ? `Trades closed right after a loss won ${w(loss.winRate!)} of the time and averaged ${pct(loss.avgReturn!)}; after a win, ${w(win.winRate!)} and ${pct(win.avgReturn!)}.` : null;

  return { total: trades.length, hold: { winners, losers, takeaway: holdTake }, after: { win, loss, takeaway: afterTake } };
}
