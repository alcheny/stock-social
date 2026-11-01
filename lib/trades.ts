// Pure trade math. No I/O — everything shown to users is derived here from raw activities,
// so a bug is fixed by recomputing (see docs/DESIGN.md §2.5).

import { count, counted, pct } from './format.ts';
import { MIN_BETS, RANK_MIN_BETS, tooWide } from './confidence.ts';
import { LATE_POSTING_DAYS, RATIO_TOLERANCE, renameRatio, resolveRatio, type CorporateAction, type Ratio } from './corporate-actions.ts';

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

type Lot = { units: number; price: number; feePerUnit: number; at: Date; verified: boolean; tainted?: boolean };

const EPS = 1e-9;
const DAY = 86_400_000;
// Unit comparisons are relative to the size involved, so positions grown by splits compare like small ones.
const tiny = (x: number, scale: number) => x <= EPS * Math.max(1, Math.abs(scale));

export type MatchResult = { trades: ClosedTrade[]; excluded: number; excludedCorporate: number };
export type OpenLot = Readonly<Lot> & { accountId: string; symbol: string };

// FIFO, long only. One closed trade per SELL, or one count: every SELL is a shown trade, `excluded` or
// `excludedCorporate`, never dropped silently.
// - `excluded` (no recorded entry): a sell needing more units than the ledger holds, excluded whole (its matched part
//   is not shown either): the history is missing an inflow (a buy before the imported history, a transfer in, an
//   unrecorded split), so its basis is unknown (POLICY F3c). Sells shown earlier were priced from recorded lots and stay
//   (TR-1, orchestrator decision 2026-11-01). The oversell empties the ledger; later buys start fresh lots.
// - `excludedCorporate`: a sell drawing a unit an unpriceable corporate action touched (an oversell included), one
//   dated within LATE_POSTING_DAYS before a repricing action on its pair, or one on the same day as such an action
//   (the vendor may date the row on another day of the event than the trade's prices assume: lib/corporate-actions.ts).
// - Unusable trade rows (fixes cycle 3, F3-1): a vendor BUY/SELL with no usable price, units or date, never dropped. A
//   sell with units and a date consumes its units from the oldest lots and is counted in `excludedCorporate`; a buy with
//   units and a date opens a lot with no basis (a sell drawing it is counted). With no usable units or date, the pair's
//   ledger is unknown from that row on (from the start when undated): its lots and every later lot of the pair are
//   tainted, and a sell is counted. They are not repricing actions (no late-posting window, no same-day rule).
// - Same instant (F3-5): symbol changes, then other corporate actions, then buys, then sells. In a long-only ledger a
//   sell is filled from shares held, so a same-instant buy before it is the only order that can be true when the sell
//   needs it; when older lots cover the sell, FIFO draws them first and the order changes nothing. A sell is never
//   matched to a buy dated after it.
// Corporate actions (lib/corporate-actions.ts) adjust the lots: a split or stock dividend multiplies units by p/q and
// divides price and fee per unit by it (total cost and fees conserved, holding period from the original buy); a symbol
// change moves the lots, FIFO order kept by date; an unpriceable action taints them. At the same instant, actions apply
// before trades (trade dates are often day-only and an action is dated on its effective day).
export function matchTrades(activities: Activity[], actions: CorporateAction[] = []): MatchResult {
  return replay(activities, actions).result;
}

// The lots still open after the history (test and property-check helper; the matcher's own state).
export function openLots(activities: Activity[], actions: CorporateAction[] = []): OpenLot[] {
  const out: OpenLot[] = [];
  for (const [key, book] of replay(activities, actions).books) {
    const [accountId, symbol] = [key.slice(0, key.lastIndexOf('|')), key.slice(key.lastIndexOf('|') + 1)];
    for (const l of book.lots) out.push({ ...l, accountId, symbol });
  }
  return out;
}

type Book = { lots: Lot[] };
type Event = { at: number; order: number; src: number; i: number; act?: Activity; ca?: CorporateAction };
type TradeRow = Extract<CorporateAction, { reason: 'trade' }>;
const isTradeRow = (ca: CorporateAction): ca is TradeRow => ca.kind === 'unpriceable' && ca.reason === 'trade';

function replay(activities: Activity[], actions: CorporateAction[]): { result: MatchResult; books: Map<string, Book> } {
  // Same-instant order (F3-5): renames, other actions, buys, sells; then actions before activities, then input order.
  const sideOrder = (side: 'BUY' | 'SELL') => (side === 'BUY' ? 2 : 3);
  const events: Event[] = [
    ...actions.map((ca, i) => ({ at: ca.executedAt.getTime(), order: ca.kind === 'symbol-change' ? 0 : isTradeRow(ca) ? sideOrder(ca.side) : 1, src: 0, i, ca })),
    ...activities.map((act, i) => ({ at: act.executedAt.getTime(), order: sideOrder(act.side), src: 1, i, act })),
  ].sort((a, b) => a.at - b.at || a.order - b.order || a.src - b.src || a.i - b.i);
  const books = new Map<string, Book>();
  const book = (key: string) => { let b = books.get(key); if (!b) books.set(key, (b = { lots: [] })); return b; };
  const trades: ClosedTrade[] = [];
  let excluded = 0, excludedCorporate = 0;

  // Repricing actions, for the late-posting window (a rename at 1:1 reprices nothing): their times per pair and, for
  // account-wide ones, per account, sorted once; each sell looks up the first time after it.
  const times = new Map<string, number[]>();
  for (const ca of actions) {
    if (isTradeRow(ca)) continue; // an unusable trade row reprices nothing (F3-1)
    if (ca.kind === 'symbol-change' && Math.abs(ca.inUnits - ca.outUnits) <= RATIO_TOLERANCE * ca.outUnits) continue;
    const k = ca.kind === 'unpriceable' && ca.scope === 'account' ? `${ca.accountId}|` : `${ca.accountId}|${ca.symbol}`;
    const list = times.get(k);
    if (list) list.push(ca.executedAt.getTime()); else times.set(k, [ca.executedAt.getTime()]);
  }
  for (const list of times.values()) list.sort((x, y) => x - y);
  const nextAfter = (list: number[] | undefined, t: number) => {
    if (!list) return Infinity;
    let lo = 0, hi = list.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (list[mid] <= t) lo = mid + 1; else hi = mid; }
    return lo < list.length ? list[lo] : Infinity;
  };
  // Same UTC day as a repricing action on the pair (or an account-wide one): the order within that day is unknown.
  const days = new Map<string, Set<number>>();
  for (const [k, list] of times) days.set(k, new Set(list.map((t) => Math.floor(t / DAY))));
  const sameDayAction = (a: Activity) => {
    const d = Math.floor(a.executedAt.getTime() / DAY);
    return !!(days.get(`${a.accountId}|${a.symbol}`)?.has(d) || days.get(`${a.accountId}|`)?.has(d));
  };
  const latePosted = (a: Activity) => {
    const t = a.executedAt.getTime();
    const next = Math.min(nextAfter(times.get(`${a.accountId}|${a.symbol}`), t), nextAfter(times.get(`${a.accountId}|`), t));
    return next - t <= LATE_POSTING_DAYS * DAY;
  };
  // In-window checks (tester round 1, reviewer round 2): a lot opened within LATE_POSTING_DAYS before a split may
  // already be in post-split shares (the lot's own date, so lots that arrived through a rename count too), and any
  // trade of the new symbol within that window before a rename may already hold the renamed shares. Lots touched that
  // way are tainted, never scaled or moved on a guess.
  const tradesAt = new Map<string, number[]>();
  for (const a of activities) {
    const k = `${a.accountId}|${a.symbol}`, list = tradesAt.get(k);
    if (list) list.push(a.executedAt.getTime()); else tradesAt.set(k, [a.executedAt.getTime()]);
  }
  for (const list of tradesAt.values()) list.sort((x, y) => x - y);
  const inWindowBefore = (list: number[] | undefined, at: number) => nextAfter(list, at - LATE_POSTING_DAYS * DAY - 1) < at;
  const openedInWindow = (lots: Lot[], at: number) => lots.some((l) => l.at.getTime() >= at - LATE_POSTING_DAYS * DAY && l.at.getTime() < at);
  // Pairs a rename emptied, by instant: an action on the old pair at that same instant is ambiguous (before or after the
  // rename?), so it taints the lots where the rename put them, never skips them.
  const movedTo = new Map<string, { at: number; to: string }>();
  // Pairs a rename with a share exchange filled, by instant: a split on that pair at the same instant may be the same
  // event reported twice (tester round 2), so it taints instead of scaling again.
  const exchangedInto = new Map<string, number>();
  // Pairs whose ledger an unusable trade row with no units or date made unknown (F3-1): every later lot is tainted.
  const unknownFrom = new Set<string>();
  const held = (lots: Lot[]) => lots.reduce((s, l) => s + l.units, 0);
  const taint = (lots: Lot[]) => { for (const l of lots) l.tainted = true; };
  // Removes `units` from the oldest lots (a cash-in-lieu fraction, shares removed by an unpriceable action).
  const removeOldest = (lots: Lot[], units: number) => {
    let left = units;
    while (!tiny(left, units) && lots.length) {
      const take = Math.min(lots[0].units, left);
      lots[0].units -= take; left -= take;
      if (tiny(lots[0].units, take)) lots.shift();
    }
  };
  const scale = (lots: Lot[], r: Ratio) => { for (const l of lots) { l.units = (l.units * r.p) / r.q; l.price = (l.price * r.q) / r.p; l.feePerUnit = (l.feePerUnit * r.q) / r.p; } };

  for (const e of events) {
    const ca = e.ca;
    if (ca) {
      const key = `${ca.accountId}|${ca.symbol}`;
      const b = book(key);
      const moved = movedTo.get(key);
      if (isTradeRow(ca)) {
        // F3-1: an unusable vendor trade row (see the header). Counted when it is a sell, never priced.
        if (ca.side === 'SELL') excludedCorporate++;
        if (ca.units !== undefined && !ca.undated) {
          if (ca.side === 'SELL') removeOldest(b.lots, ca.units);
          else b.lots.push({ units: ca.units, price: 0, feePerUnit: 0, at: ca.executedAt, verified: false, tainted: true });
        } else {
          taint(b.lots);
          unknownFrom.add(key);
        }
        continue;
      }
      if (!b.lots.length && moved?.at === e.at && ca.kind !== 'symbol-change') { taint(book(moved.to).lots); }
      if (ca.kind === 'split' || ca.kind === 'stock-dividend') {
        if (exchangedInto.get(key) === e.at) { taint(b.lots); continue; }
        if (!b.lots.length) continue; // nothing recorded to adjust; a later oversell is caught as missing history
        const r = resolveRatio(held(b.lots), ca);
        if (!r) { taint(b.lots); continue; }
        scale(b.lots, r.ratio);
        if (r.leftover > 0) removeOldest(b.lots, r.leftover); // cash in lieu: not a trade, not counted
        if (openedInWindow(b.lots, e.at)) taint(b.lots);
      } else if (ca.kind === 'symbol-change') {
        if (!b.lots.length) continue;
        const h = held(b.lots);
        const r = ca.newSymbol !== ca.symbol && Math.abs(h - ca.outUnits) <= RATIO_TOLERANCE * Math.max(1, h) ? renameRatio(ca.outUnits, ca.inUnits) : null;
        if (!r) { taint(b.lots); continue; }
        scale(b.lots, r);
        const toKey = `${ca.accountId}|${ca.newSymbol}`;
        if (inWindowBefore(tradesAt.get(toKey), e.at) || (r.p !== r.q && openedInWindow(b.lots, e.at))) taint(b.lots);
        const to = book(toKey);
        to.lots = [...to.lots, ...b.lots].sort((x, y) => x.at.getTime() - y.at.getTime());
        books.set(key, { lots: [] }); // a recycled ticker starts fresh lots
        if (unknownFrom.has(key)) unknownFrom.add(toKey); // F3-1: an unknown ledger stays unknown under its new symbol
        movedTo.set(key, { at: e.at, to: `${ca.accountId}|${ca.newSymbol}` });
        if (r.p !== r.q) exchangedInto.set(toKey, e.at);
      } else {
        if (ca.scope === 'account') {
          for (const [k, other] of books) if (k.startsWith(`${ca.accountId}|`)) taint(other.lots);
        } else taint(b.lots);
        const u = ca.units ?? 0;
        if (u > 0) b.lots.push({ units: u, price: 0, feePerUnit: 0, at: ca.executedAt, verified: false, tainted: true });
        else if (u < 0) removeOldest(b.lots, -u);
      }
      continue;
    }

    const a = e.act!;
    const key = `${a.accountId}|${a.symbol}`;
    const b = book(key);
    const open = b.lots;
    if (a.side === 'BUY') {
      // A buy on the day of a repricing action may be at either side of it: tainted, never scaled or left on a guess.
      open.push({ units: a.units, price: a.price, feePerUnit: a.fee / a.units, at: a.executedAt, verified: a.verified, ...(sameDayAction(a) || unknownFrom.has(key) ? { tainted: true } : {}) });
      continue;
    }

    let remaining = a.units;
    let cost = 0;
    let entryFees = 0;
    let openedAt: Date | null = null;
    let verified = a.verified;
    let tainted = false;
    while (!tiny(remaining, a.units) && open.length) {
      const lot = open[0];
      const take = Math.min(lot.units, remaining);
      cost += take * lot.price;
      entryFees += take * lot.feePerUnit;
      openedAt ??= lot.at;
      verified &&= lot.verified;
      tainted ||= !!lot.tainted;
      lot.units -= take;
      remaining -= take;
      if (tiny(lot.units, a.units)) open.shift();
    }

    if (!tiny(remaining, a.units)) {
      // Oversold: this sell only. Drawing a unit a corporate action left unpriced makes it a corporate exclusion.
      if (tainted) excludedCorporate++; else excluded++;
      continue;
    }
    if (tainted || latePosted(a) || sameDayAction(a)) excludedCorporate++;
    else if (openedAt) {
      const exitFee = a.fee;
      const t: ClosedTrade = {
        sellId: a.externalId,
        accountId: a.accountId,
        symbol: a.symbol,
        openedAt,
        closedAt: a.executedAt,
        returnPct: (a.units * a.price - cost - entryFees - exitFee) / cost,
        holdingDays: (a.executedAt.getTime() - openedAt.getTime()) / DAY,
        verified,
      };
      trades.push(t);
    }
  }
  return { result: { trades, excluded, excludedCorporate }, books };
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

// pct() lives in lib/format.ts (F-19: one home); re-exported here so existing imports keep working.
export { pct };

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
// ponytail: the interval reads closed trades only; open positions (TR-4, stored by F-6 in open_positions) are not bets
// here yet — fix: count each open position as a provisional bet at its unrealized percent.
// ponytail: bets are clustered by symbol, so a position renamed by a corporate action (lib/corporate-actions.ts) whose
// closes straddle the rename counts as two bets (at most one extra per rename: it can move the 5-bet floor and the
// degrees of freedom) — fix: a chain key per closed trade (a closed_trades column set by the rebuild).
// Closed trades only. Open positions exist since F-6 (lib/open-split.ts shows them beside every realized figure), but
// the F-6 decision of 2026-11-01 keeps this range closed-only and says so in words. Including them at their unrealized
// return and days held so far (DESIGN TR-9 inputs; design council D-48) is its own feature: open_positions stores no
// opening date (it needs an additive opened_at, the earliest unmatched FIFO lot), and the change moves feed ranking
// (lib/feed.ts weights). docs/features/F-6-open-positions.md → Open questions.

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
  void today; // reserved for open positions (TR-4, see above)
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
  // F-4: below MIN_BETS (5) independent bets there is no range; from there it is always computed (t with K − 1 df).
  const tier: Tier = k < MIN_BETS ? 'too-early' : k >= 100 && spanDays >= 365 ? 'strong' : k >= 30 && spanDays >= 90 ? 'moderate' : 'thin';
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
  // F-4: "too early" is a model state, not a count. A per-trade range wider than ±10 points keeps its interval (it is
  // shown, widening as the sample thins) but carries no verdict and no ranking weight.
  if (tooWide(perTrade)) return { ...base, tier: 'too-early', edge: null, perTrade, pace30 };
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
    if (c.perTrade) return `Too early to tell: the range is still too wide to say much (${plural(c.k, 'bet')}${grouped ? ` from ${counted(c.n, 'trade')}` : ''})`;
    return grouped
      ? `Too early to tell: ${counted(c.n, 'trade')} in ${counted(c.k, 'overlapping position')} (${MIN_BETS} independent bets needed)`
      : `Too early to tell (${count(c.k)} of ${MIN_BETS} bets)`;
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
// F-4: a too-early record (a range wider than ±10 points) never ranks ahead on its pace interval, and ranking keeps
// its pre-F-4 floor of RANK_MIN_BETS (10) bets: F-4 changes what a record shows, not the feed order.
export const evidenceWeight = (c: Confidence): number =>
  (c.pace30 && c.tier !== 'too-early' && c.k >= RANK_MIN_BETS ? Math.max(0, Math.log1p(c.pace30.low), -Math.log1p(c.pace30.high)) : 0);

export function rankTraders<T extends { weight: number; score: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    if ((a.weight > 0) !== (b.weight > 0)) return a.weight > 0 ? -1 : 1;
    return b.weight * b.score - a.weight * a.score || b.score - a.score;
  });
}
