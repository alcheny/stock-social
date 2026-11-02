// Fixes cycle 4 (C4-1 ties, C4-2 the gap): an independent reference-model property test for lib/trades.ts#matchTrades.
// The model is written from the rule's semantics (docs/features/logs/fixes-cycle4/, as revised after F-28/F-30 by
// approval council 4), not from the matcher's code. Fictional histories only.
//
// Reference model ("readings"). For a history, a reading is one possible truth the rows allow:
// - the order of the rows is F3-5's: by stamp; at one exact stamp buys before sells, then the vendor id. A date-only
//   same-day short with no evidence on its pair reads as a long round trip: F-30's accepted residual, so the model takes
//   that order as true (no date-only float, no tie groups);
// - for each oversell (a sell needing more units than the reading's long lots hold), a split of the shortfall k into
//   earlier-history shares (gone) and an open short (covered first by later buys of the pair, the surplus opens a lot);
// - nothing held from before the history until an oversell reveals it (TR-1: sells shown earlier stay as priced);
// - a split with a known ratio p:q multiplies every lot's units and the open short by p/q (price and fee per unit by q/p);
//   a 1:1 rename moves the lots and the open short to the new symbol unchanged.
// In a reading, a sell drawn wholly from recorded lots under FIFO has the figure (returnPct, holdingDays, verified), with
// returnPct = (units*price - cost - entryFees - exitFee) / cost; otherwise its figure is unknown.
// Assertions per history: (1) a published figure equals the sell's figure in EVERY reading (1e-9); (1b) after the first
// oversell of a pair, no later sell of that pair (or of the symbol a rename moved it to) is shown, whatever its size or
// timing (the red-team rule of F-30); (2) every SELL is shown or counted exactly once; (3) shuffling the input changes
// neither the shown trades nor either count; (4) all-distinct intraday stamps with no oversell equal plain FIFO (nothing
// over-counted).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchTrades, openLots, type Activity, type MatchResult } from './trades.ts';
import type { CorporateAction } from './corporate-actions.ts';

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 2, 2); // a Monday; fictional
const TOL = 1e-9;
// Distinct (segment, state) pairs explored per chain: readings that reach the same lots and short at a segment boundary
// have the same future, so each is explored once (the reading count itself is computed exactly). Above the cap a history
// is skipped (counted, and the checked share asserted).
const STATE_CAP = 20000;

// ---- seeded RNG (mulberry32) ----
function rngFrom(seed: number) {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { next, int: (lo: number, hi: number) => lo + Math.floor(next() * (hi - lo + 1)), pick: <T>(xs: readonly T[]) => xs[Math.floor(next() * xs.length)] };
}
type Rng = ReturnType<typeof rngFrom>;

// ---- the reference model ----
type Lot = { units: number; price: number; fpu: number; at: number; verified: boolean };
type Seg = { kind: 'day'; at: number; rows: Activity[] } | { kind: 'split'; at: number; p: number; q: number } | { kind: 'rename'; at: number };
// F-36: `l*` is the legacy figure (divided by the purchase cost alone) and `feeMax` the largest entry fee of any reading.
type Fig = { unknown: boolean; rMin: number; rMax: number; lMin: number; lMax: number; feeMax: number; hMin: number; hMax: number; vTrue: boolean; vFalse: boolean };
// `after`: the sells of the chain that come after its first oversell (the same in every reading: nothing branches before it).
type Readings = { figs: Map<string, Fig>; count: number; oversold: boolean; after: string[] };

const isDateOnly = (a: Activity) => a.executedAt.getTime() % DAY === 0;

// F3-5's order of one pair's rows on one day, the only one the model reads as true: by stamp, buys before sells at one
// stamp, then the vendor id.
const idCmp = (x: string, y: string) => (x < y ? -1 : x > y ? 1 : 0);
function canonical(rows: Activity[]): Activity[] {
  return [...rows].sort((a, b) => a.executedAt.getTime() - b.executedAt.getTime() || (a.side === b.side ? 0 : a.side === 'BUY' ? -1 : 1) || idCmp(a.externalId, b.externalId));
}
function dayOrders(rows: Activity[]): Activity[][] {
  return [canonical(rows)];
}

// Shortfall splits: gone shares g in {0, k} and every whole unit between (every half unit when k is fractional: a 1:2
// split can halve a lot).
function shortfallSplits(k: number): number[] {
  const out = [0], step = Math.abs(k - Math.round(k)) < 1e-9 ? 1 : 0.5;
  for (let g = step; g < k - 1e-9; g += step) out.push(g);
  out.push(k);
  return out;
}

function readings(chain: Seg[], cap = STATE_CAP): Readings | null {
  const figs = new Map<string, Fig>();
  let oversold = false, aborted = false;
  const memo = new Map<string, number>(); // (segment, state) -> number of readings from there
  const orders = chain.map((s) => (s.kind === 'day' ? dayOrders(s.rows) : []));
  const note = (id: string, f: { r: number; l: number; fees: number; h: number; v: boolean } | null) => {
    let g = figs.get(id);
    if (!g) figs.set(id, (g = { unknown: false, rMin: Infinity, rMax: -Infinity, lMin: Infinity, lMax: -Infinity, feeMax: 0, hMin: Infinity, hMax: -Infinity, vTrue: false, vFalse: false }));
    if (!f) { g.unknown = true; return; }
    g.rMin = Math.min(g.rMin, f.r); g.rMax = Math.max(g.rMax, f.r);
    g.lMin = Math.min(g.lMin, f.l); g.lMax = Math.max(g.lMax, f.l); g.feeMax = Math.max(g.feeMax, f.fees);
    g.hMin = Math.min(g.hMin, f.h); g.hMax = Math.max(g.hMax, f.h);
    if (f.v) g.vTrue = true; else g.vFalse = true;
  };
  // Returns the number of readings from this point (0 once aborted).
  const seg = (si: number, lots: Lot[], short: number): number => {
    if (aborted) return 0;
    if (si === chain.length) return 1;
    const key = `${si}|${short}|${lots.map((l) => `${l.units},${l.price},${l.fpu},${l.at},${l.verified}`).join(';')}`;
    const hit = memo.get(key);
    if (hit !== undefined) return hit;
    if (memo.size >= cap) { aborted = true; return 0; }
    const s = chain[si];
    let n = 0;
    if (s.kind === 'split') {
      const m = s.p / s.q;
      n = seg(si + 1, lots.map((l) => ({ ...l, units: l.units * m, price: l.price / m, fpu: l.fpu / m })), short * m);
    } else if (s.kind === 'rename') n = seg(si + 1, lots, short);
    else for (const order of orders[si]) n += play(si, order, 0, lots, short);
    memo.set(key, n);
    return n;
  };
  const play = (si: number, order: Activity[], j: number, lots: Lot[], short: number): number => {
    if (j === order.length) return seg(si + 1, lots, short);
    const a = order[j];
    if (a.side === 'BUY') {
      const cover = Math.min(short, a.units), rest = a.units - cover;
      const next = rest > 1e-9 ? [...lots, { units: rest, price: a.price, fpu: a.fee / a.units, at: a.executedAt.getTime(), verified: a.verified }] : lots;
      return play(si, order, j + 1, next, short - cover);
    }
    const held = lots.reduce((s, l) => s + l.units, 0);
    if (held + 1e-9 >= a.units) {
      const next = lots.map((l) => ({ ...l }));
      let left = a.units, cost = 0, fees = 0, v = a.verified;
      const openedAt = next[0].at;
      while (left > 1e-9) {
        const l = next[0], take = Math.min(l.units, left);
        cost += take * l.price; fees += take * l.fpu; v &&= l.verified;
        l.units -= take; left -= take;
        if (l.units <= 1e-9) next.shift();
      }
      // F-36: the return divides by the purchase cost plus the purchase fees; the numerator is unchanged. The legacy
      // figure (cost alone) is kept beside it: same sign, never larger in size, and exactly equal with no entry fee.
      const num = a.units * a.price - cost - fees - a.fee, r = num / (cost + fees), l = num / cost;
      if (Math.sign(r) !== Math.sign(l) || Math.abs(r) > Math.abs(l) || (fees === 0 && r !== l)) throw new Error(`F-36 model: ${r} vs legacy ${l} (entry fees ${fees > 0 ? 'yes' : 'no'})`);
      note(a.externalId, { r, l, fees, h: (a.executedAt.getTime() - openedAt) / DAY, v });
      return play(si, order, j + 1, next, short);
    }
    note(a.externalId, null);
    oversold = true;
    const k = a.units - held;
    let n = 0;
    for (const g of shortfallSplits(k)) n += play(si, order, j + 1, [], short + (k - g));
    return n;
  };
  const count = seg(0, [], 0);
  // The first oversell in the order, found on the one path before any branching (no shortfall split precedes it).
  const sellsInOrder = orders.flatMap((o) => (o.length ? o[0] : [])).filter((a) => a.side === 'SELL');
  const first = sellsInOrder.findIndex((a) => figs.get(a.externalId)!.unknown);
  const after = first < 0 ? [] : sellsInOrder.slice(first + 1).map((a) => a.externalId);
  return aborted ? null : { figs, count, oversold, after };
}

// Chains: a pair's rows by day, its splits, and a rename joining the old pair to the new one (lots move together).
function chainsOf(acts: Activity[], actions: CorporateAction[]): Seg[][] {
  const root = new Map<string, string>();
  for (const ca of actions) if (ca.kind === 'symbol-change') root.set(`${ca.accountId}|${ca.newSymbol}`, `${ca.accountId}|${ca.symbol}`);
  const rootOf = (k: string): string => { let r = k; for (let i = 0; i < 10 && root.has(r); i++) r = root.get(r)!; return r; };
  const chains = new Map<string, { days: Map<number, Activity[]>; acts: Seg[] }>();
  const chain = (k: string) => { let c = chains.get(k); if (!c) chains.set(k, (c = { days: new Map(), acts: [] })); return c; };
  for (const a of acts) {
    const c = chain(rootOf(`${a.accountId}|${a.symbol}`)), d = Math.floor(a.executedAt.getTime() / DAY);
    const g = c.days.get(d); if (g) g.push(a); else c.days.set(d, [a]);
  }
  for (const ca of actions) {
    const c = chain(rootOf(`${ca.accountId}|${ca.symbol}`)), at = ca.executedAt.getTime();
    if (ca.kind === 'split' && ca.ratio) c.acts.push({ kind: 'split', at, p: ca.ratio.p, q: ca.ratio.q });
    else if (ca.kind === 'symbol-change') c.acts.push({ kind: 'rename', at });
    else throw new Error('the model covers known-ratio splits and 1:1 renames only');
  }
  return [...chains.values()].map((c) => [...[...c.days].map(([d, rows]): Seg => ({ kind: 'day', at: d * DAY, rows })), ...c.acts].sort((x, y) => x.at - y.at));
}

// ---- the checks ----
let feeShown = 0; // F-36: shown trades with an entry fee that passed the checks against the legacy figure
type Checked = { afterOversell: number; readings: number; oversold: boolean; tie: boolean; published: number; sells: number; agreedButCounted: number };

const fmt = (a: Activity) => `${a.side} ${a.units}@${a.price}${a.fee ? ` fee ${a.fee}` : ''}${a.verified ? '' : ' unverified'} ${a.accountId}|${a.symbol} ${a.executedAt.toISOString().replace(':00:00.000Z', 'Z')} (${a.externalId})`;
const fmtCa = (ca: CorporateAction) => `${ca.kind}${ca.kind === 'split' ? ` ${ca.ratio?.p}:${ca.ratio?.q}` : ca.kind === 'symbol-change' ? ` -> ${ca.newSymbol} out ${ca.outUnits} in ${ca.inUnits}` : ''} ${ca.accountId}|${ca.symbol} ${ca.executedAt.toISOString()}`;
const sorted = (m: MatchResult) => ({ ...m, trades: [...m.trades].sort((x, y) => (x.sellId < y.sellId ? -1 : x.sellId > y.sellId ? 1 : 0)) });

function hasTie(acts: Activity[]): boolean {
  const days = new Map<string, Activity[]>();
  for (const a of acts) { const k = `${a.accountId}|${a.symbol}|${Math.floor(a.executedAt.getTime() / DAY)}`; const g = days.get(k); if (g) g.push(a); else days.set(k, [a]); }
  return [...days.values()].some((g) => g.length > 1 && (g.some(isDateOnly) || new Set(g.map((a) => a.executedAt.getTime())).size < g.length));
}

// Null when the history passes; a failure message otherwise; 'skip' when its readings exceed the cap.
function failure(acts: Activity[], actions: CorporateAction[], seed: number, stats?: { out?: Checked }): string | null | 'skip' {
  const rs: Readings[] = [];
  for (const c of chainsOf(acts, actions)) { const r = readings(c); if (!r) return 'skip'; rs.push(r); }
  const figs = new Map<string, Fig>();
  for (const r of rs) for (const [k, v] of r.figs) figs.set(k, v);
  const afterOversell = new Set(rs.flatMap((r) => r.after));
  const m = matchTrades(acts, actions);
  const sells = acts.filter((a) => a.side === 'SELL');
  if (m.trades.length + m.excluded + m.excludedCorporate !== sells.length) return `(2) ${m.trades.length} shown + ${m.excluded} excluded + ${m.excludedCorporate} corporate != ${sells.length} sells`;
  const ids = new Set(sells.map((a) => a.externalId)), seen = new Set<string>();
  for (const t of m.trades) {
    if (!ids.has(t.sellId) || seen.has(t.sellId)) return `(2) trade ${t.sellId} is not a sell or is shown twice`;
    seen.add(t.sellId);
    const f = figs.get(t.sellId)!, s = sells.find((a) => a.externalId === t.sellId)!;
    if (t.accountId !== s.accountId || t.symbol !== s.symbol || t.closedAt.getTime() !== s.executedAt.getTime()) return `(1) ${t.sellId} shown under the wrong pair or date`;
    if (afterOversell.has(t.sellId)) return `(1b) ${t.sellId} shown at ${t.returnPct} after an earlier oversell of its pair`;
    if (f.unknown) return `(1) ${t.sellId} shown at ${t.returnPct} over ${t.holdingDays}d, but some reading can't price it (oversold there); known readings ${f.rMin}..${f.rMax}`;
    if (Math.abs(f.rMin - t.returnPct) > TOL || Math.abs(f.rMax - t.returnPct) > TOL) return `(1) ${t.sellId} shown at return ${t.returnPct}; readings give ${f.rMin}..${f.rMax}`;
    if (Math.abs(f.hMin - t.holdingDays) > TOL || Math.abs(f.hMax - t.holdingDays) > TOL) return `(1) ${t.sellId} shown at ${t.holdingDays} days held; readings give ${f.hMin}..${f.hMax}`;
    if ((t.verified ? f.vFalse : f.vTrue)) return `(1) ${t.sellId} shown verified=${t.verified}; some reading differs`;
    // F-36: against the legacy figure (purchase cost alone): the sign never changes, the size never grows, and a trade
    // with no entry fee in any reading keeps its figure.
    if (Math.abs(f.lMin) > TOL && Math.sign(t.returnPct) !== Math.sign(f.lMin)) return `(F-36) ${t.sellId} shown at ${t.returnPct}; legacy ${f.lMin} has the other sign`;
    if (Math.abs(t.returnPct) > Math.abs(f.lMin) + TOL || Math.abs(t.returnPct) > Math.abs(f.lMax) + TOL) return `(F-36) ${t.sellId} shown at ${t.returnPct}, larger than legacy ${f.lMin}..${f.lMax}`;
    if (f.feeMax === 0 && (Math.abs(f.lMin - t.returnPct) > TOL || Math.abs(f.lMax - t.returnPct) > TOL)) return `(F-36) ${t.sellId} has no entry fee but moved: ${t.returnPct} vs legacy ${f.lMin}..${f.lMax}`;
    if (f.feeMax > 0) feeShown++;
  }
  // (3) the input order says nothing: the same trades shown and the same two counts.
  const want = sorted(m), r = rngFrom(seed ^ 0x5bd1e995);
  for (let i = 0; i < 2; i++) {
    const sa = [...acts], sc = [...actions];
    for (const xs of [sa, sc] as unknown[][]) for (let j = xs.length - 1; j > 0; j--) { const k = r.int(0, j); [xs[j], xs[k]] = [xs[k], xs[j]]; }
    const got = sorted(matchTrades(sa, sc));
    try { assert.deepEqual(got.trades, want.trades); } catch { return `(3) a shuffled input shows different trades`; }
    if (got.excluded !== want.excluded || got.excludedCorporate !== want.excludedCorporate) return `(3) a shuffled input counts ${got.excluded} excluded + ${got.excludedCorporate} corporate, not ${want.excluded} + ${want.excludedCorporate}`;
  }
  if (stats) {
    const agreed = sells.filter((s) => { const f = figs.get(s.externalId)!; return !seen.has(s.externalId) && !f.unknown && f.rMax - f.rMin <= TOL && f.hMax - f.hMin <= TOL && !(f.vTrue && f.vFalse); }).length;
    stats.out = { afterOversell: afterOversell.size, readings: rs.reduce((s, x) => s * x.count, 1), oversold: rs.some((x) => x.oversold), tie: hasTie(acts), published: m.trades.length, sells: sells.length, agreedButCounted: agreed };
  }
  return null;
}

// A 1:1 rename names the shares the ledger holds (the model's rename moves every lot): its units are set from the rows
// before it, so a history stays valid while the shrinker removes rows.
function matchedRenames(acts: Activity[], actions: CorporateAction[]): CorporateAction[] {
  const out = [...actions].sort((x, y) => x.executedAt.getTime() - y.executedAt.getTime());
  for (let i = 0; i < out.length; i++) {
    const ca = out[i];
    if (ca.kind !== 'symbol-change') continue;
    const t = ca.executedAt.getTime();
    const held = openLots(acts.filter((a) => a.executedAt.getTime() < t), out.slice(0, i))
      .filter((l) => l.accountId === ca.accountId && l.symbol === ca.symbol).reduce((s, l) => s + l.units, 0);
    out[i] = { ...ca, outUnits: held, inUnits: held };
  }
  return out;
}

// Removes rows (then actions) one at a time while the failure persists: the minimal counterexample.
function shrink(acts: Activity[], actions: CorporateAction[], seed: number): { acts: Activity[]; actions: CorporateAction[]; why: string } {
  let cur = { acts, actions };
  let why = failure(acts, actions, seed) as string;
  for (let changed = true; changed;) {
    changed = false;
    for (let i = 0; i < cur.acts.length; i++) {
      const rest = cur.acts.filter((_, j) => j !== i), next = { acts: rest, actions: matchedRenames(rest, cur.actions) };
      const f = failure(next.acts, next.actions, seed);
      if (f && f !== 'skip') { cur = next; why = f; changed = true; break; }
    }
    if (changed) continue;
    for (let i = 0; i < cur.actions.length; i++) {
      const next = { acts: cur.acts, actions: matchedRenames(cur.acts, cur.actions.filter((_, j) => j !== i)) };
      const f = failure(next.acts, next.actions, seed);
      if (f && f !== 'skip') { cur = next; why = f; changed = true; break; }
    }
  }
  return { ...cur, why };
}

function assertPasses(acts: Activity[], actions: CorporateAction[], seed: number, stats: { out?: Checked }): 'ok' | 'skip' {
  const f = failure(acts, actions, seed, stats);
  if (f === 'skip') return 'skip';
  if (f) {
    const s = shrink(acts, actions, seed);
    assert.fail(`seed ${seed}: ${s.why}\nminimal rows:\n  ${[...s.acts.map(fmt), ...s.actions.map(fmtCa)].join('\n  ')}`);
  }
  return 'ok';
}

// ---- generators ----
let nid = 0;
const stamp = (day: number, hour: number) => new Date(T0 + day * DAY + hour * 3_600_000);
function rowAt(r: Rng, accountId: string, symbol: string, side: Activity['side'], units: number, at: Date): Activity {
  return { externalId: `p${String(nid++).padStart(6, '0')}`, accountId, symbol, side, units, price: r.int(5, 15), fee: r.next() < 0.2 ? r.int(1, 2) : 0, executedAt: at, verified: r.next() > 0.1 };
}
// One pair's day: 0-3 rows, each date-only (00:00Z) or at a whole hour; exact ties are common.
function dayRows(r: Rng, accountId: string, symbol: string, day: number, sellBias = 0.45, ties = true): Activity[] {
  const n = r.pick([0, 0, 0, 1, 1, 1, 2, 2, 3]);
  const out: Activity[] = [];
  for (let i = 0; i < n; i++) {
    const hour = !ties ? r.int(9, 16) : out.length && r.next() < 0.2 ? -1 : r.next() < 0.35 ? 0 : r.int(9, 16);
    const at = hour === -1 ? out[out.length - 1].executedAt : stamp(day, hour);
    const sell = r.next() < sellBias;
    out.push(rowAt(r, accountId, symbol, sell ? 'SELL' : 'BUY', sell ? r.int(1, 4) : r.int(1, 5), at));
  }
  return out;
}
const PAIRS = [['acc1', 'SYMA'], ['acc2', 'SYMA'], ['acc1', 'SYMB']] as const;
function genPlain(r: Rng, ties = true): Activity[] {
  const pairs = r.next() < 0.5 ? [PAIRS[0]] : r.next() < 0.5 ? [PAIRS[0], PAIRS[1]] : [PAIRS[0], PAIRS[2]];
  const acts: Activity[] = [];
  for (const [acc, sym] of pairs) for (let d = 0; d < 10; d++) acts.push(...dayRows(r, acc, sym, d, ties ? 0.33 : 0.33, ties));
  return acts;
}
// All-distinct intraday stamps per pair and no oversell: plain FIFO.
function genClean(r: Rng): Activity[] {
  const acts: Activity[] = [];
  for (const [acc, sym] of r.next() < 0.5 ? [PAIRS[0]] : [PAIRS[0], PAIRS[2]]) {
    let held = 0;
    for (let d = 0; d < 10; d++) {
      const hours = [9, 10, 11, 12, 13, 14, 15, 16].filter(() => r.next() < 0.2);
      for (const h of hours) {
        const sell = held > 0 && r.next() < 0.5;
        const units = sell ? r.int(1, held) : r.int(1, 5);
        held += sell ? -units : units;
        acts.push(rowAt(r, acc, sym, sell ? 'SELL' : 'BUY', units, stamp(d, h)));
      }
    }
  }
  return acts;
}
// Splits (2:1, 1:2) and 1:1 renames on a day with no trade of the chain, at a whole hour.
function genCorporate(r: Rng): { acts: Activity[]; actions: CorporateAction[] } {
  const acts: Activity[] = [], actions: CorporateAction[] = [];
  const chains = r.next() < 0.7 ? [['acc1', 'SYMA', 'SYMC']] : [['acc1', 'SYMA', 'SYMC'], ['acc2', 'SYMB', 'SYMD']];
  for (const [acc, from, to] of chains) {
    const days = 24;
    const renameDay = r.next() < 0.5 ? r.int(3, days - 4) : -1;
    const splitDays = new Set<number>();
    for (let i = r.int(0, 2); i > 0; i--) splitDays.add(r.int(2, days - 3));
    splitDays.delete(renameDay);
    const chainActs: Activity[] = [];
    for (let d = 0; d < days; d++) {
      const sym = renameDay >= 0 && d > renameDay ? to : from;
      if (d === renameDay) {
        const at = stamp(d, r.int(9, 16));
        actions.push({ externalId: `ca${nid++}`, accountId: acc, symbol: from, executedAt: at, kind: 'symbol-change', newSymbol: to, outUnits: 0, inUnits: 0 });
      } else if (splitDays.has(d)) {
        const p = r.next() < 0.5 ? 2 : 1;
        actions.push({ externalId: `ca${nid++}`, accountId: acc, symbol: sym, executedAt: stamp(d, r.int(9, 16)), kind: 'split', ratio: { p, q: 3 - p } });
      } else if (r.next() < 0.55) chainActs.push(...dayRows(r, acc, sym, d, 0.33));
    }
    acts.push(...chainActs);
  }
  return { acts, actions: matchedRenames(acts, actions) };
}

// ---- tests ----
type Tally = { afterOversell: number; checked: number; skipped: number; oversold: number; tie: number; both: number; published: number; sells: number; agreedButCounted: number; maxReadings: number };
const tally = (): Tally => ({ afterOversell: 0, checked: 0, skipped: 0, oversold: 0, tie: 0, both: 0, published: 0, sells: 0, agreedButCounted: 0, maxReadings: 0 });
function run(seed0: number, n: number, gen: (r: Rng) => { acts: Activity[]; actions: CorporateAction[] }): Tally {
  const t = tally();
  for (let i = 0; i < n; i++) {
    const seed = seed0 + i, { acts, actions } = gen(rngFrom(seed)), stats: { out?: Checked } = {};
    if (assertPasses(acts, actions, seed, stats) === 'skip') { t.skipped++; continue; }
    const s = stats.out!;
    t.checked++; t.published += s.published; t.sells += s.sells; t.agreedButCounted += s.agreedButCounted;
    t.afterOversell += s.afterOversell;
    if (s.oversold) t.oversold++;
    if (s.tie) t.tie++;
    if (s.oversold && s.tie) t.both++;
    t.maxReadings = Math.max(t.maxReadings, s.readings);
  }
  return t;
}

test('C4 reference model: a shown figure is the same in every reading of ties and shortfalls; every sell shown or counted once; order-free', () => {
  const t = run(0xc4_0001, 6000, (r) => ({ acts: genPlain(r), actions: [] }));
  console.log('trades/readings', JSON.stringify(t));
  assert.ok(t.checked >= 5500, `checked ${t.checked} histories (skipped ${t.skipped})`);
  assert.ok(t.oversold >= t.checked * 0.3, `oversells in ${t.oversold} of ${t.checked}`);
  assert.ok(t.tie >= t.checked * 0.3, `ties in ${t.tie} of ${t.checked}`);
  assert.ok(t.both >= t.checked * 0.15, `oversells and ties together in ${t.both} of ${t.checked}`);
  assert.ok(t.afterOversell >= 5000, `${t.afterOversell} sells after a first oversell checked for (1b)`);
  assert.ok(t.published >= t.sells * 0.1, `shown ${t.published} of ${t.sells} sells (the test must exercise shown figures)`);
});

test('C4 reference model: all-distinct intraday stamps and no oversell are plain FIFO (every sell shown, nothing over-counted)', () => {
  let checked = 0, shown = 0;
  for (let i = 0; i < 600; i++) {
    const seed = 0xc4_2000 + i, acts = genClean(rngFrom(seed));
    const m = matchTrades(acts);
    const sells = acts.filter((a) => a.side === 'SELL');
    assert.equal(m.excluded + m.excludedCorporate, 0, `seed ${seed}: nothing counted`);
    assert.equal(m.trades.length, sells.length, `seed ${seed}`);
    for (const c of chainsOf(acts, [])) {
      const rd = readings(c)!;
      assert.equal(rd.count, 1, `seed ${seed}: one reading`);
      assert.equal(rd.oversold, false);
      for (const [id, f] of rd.figs) {
        const t = m.trades.find((x) => x.sellId === id)!;
        assert.ok(t && Math.abs(t.returnPct - f.rMin) <= TOL && Math.abs(t.holdingDays - f.hMin) <= TOL && t.verified === f.vTrue, `seed ${seed}: ${id} is plain FIFO`);
      }
    }
    assert.equal(failure(acts, [], seed), null);
    checked++; shown += sells.length;
  }
  assert.equal(checked, 600);
  assert.ok(shown >= 1000, `${shown} sells shown`);
});

test('C4 reference model: histories from the tie/shortfall generator with distinct intraday stamps and no oversell lose nothing', () => {
  let found = 0;
  for (let i = 0; i < 4000 && found < 200; i++) {
    const seed = 0xc4_3000 + i, acts = genPlain(rngFrom(seed), false);
    if (hasTie(acts) || acts.some(isDateOnly)) continue;
    const rs = chainsOf(acts, []).map((c) => readings(c));
    if (rs.some((x) => !x || x.oversold)) continue;
    found++;
    const m = matchTrades(acts);
    assert.equal(m.excluded + m.excludedCorporate, 0, `seed ${seed}`);
    assert.equal(m.trades.length, acts.filter((a) => a.side === 'SELL').length, `seed ${seed}`);
  }
  assert.ok(found >= 50, `${found} such histories`);
});

test('C4 reference model with splits (2:1, 1:2) and 1:1 renames: shown figures hold in every reading; the gap splits and moves', () => {
  const t = run(0xc4_4000, 3000, genCorporate);
  console.log('corporate/readings', JSON.stringify(t));
  assert.ok(t.checked >= 2700, `checked ${t.checked} histories (skipped ${t.skipped})`);
  assert.ok(t.oversold >= t.checked * 0.3, `oversells in ${t.oversold} of ${t.checked}`);
  assert.ok(t.tie >= t.checked * 0.3, `ties in ${t.tie} of ${t.checked}`);
  assert.ok(t.published >= t.sells * 0.05, `shown ${t.published} of ${t.sells} sells`);
  assert.ok(t.afterOversell >= 3000, `${t.afterOversell} sells after a first oversell checked for (1b)`);
});

test('C4 reference model self-check: the model sees every split of a shortfall and reads ties in F3-5 order', () => {
  const r = rngFrom(1);
  const a = (side: Activity['side'], units: number, price: number, at: Date) => ({ ...rowAt(r, 'acc1', 'SYMA', side, units, at), price, fee: 0, verified: true });
  // Oversell of 2, then BUY 2 @10, BUY 2 @20, SELL 2: +x from @10 (gone) or from @20 (short) — two figures.
  const rows = [a('SELL', 2, 15, stamp(0, 10)), a('BUY', 2, 10, stamp(1, 10)), a('BUY', 2, 20, stamp(2, 10)), a('SELL', 2, 22, stamp(3, 10))];
  const rd = readings(chainsOf(rows, [])[0])!;
  assert.equal(rd.count, 3); // g = 0, 1, 2
  const f = rd.figs.get(rows[3].externalId)!;
  assert.ok(Math.abs(f.rMax - 1.2) < 1e-12 && Math.abs(f.rMin - 0.1) < 1e-12);
  assert.deepEqual(rd.after, [rows[3].externalId]);
  assert.equal(failure(rows, [], 1), null);
  // F-30's accepted residual: a date-only sell and buy at one stamp, nothing older, read buy first and shown (+20%).
  const tie = [a('SELL', 1, 12, stamp(0, 0)), a('BUY', 1, 10, stamp(0, 0))];
  const rt = readings(chainsOf(tie, [])[0])!;
  assert.equal(rt.count, 1);
  const ft = rt.figs.get(tie[0].externalId)!;
  assert.ok(!ft.unknown && Math.abs(ft.rMin - 0.2) < 1e-12);
  assert.equal(matchTrades(tie).trades.length, 1);
  assert.equal(failure(tie, [], 1), null);
  // After an oversell, a later sell drawn wholly from one later buy is the same in every reading here, yet still counted.
  const after = [a('SELL', 1, 12, stamp(0, 10)), a('BUY', 5, 10, stamp(1, 10)), a('SELL', 1, 13, stamp(2, 10))];
  const ra = readings(chainsOf(after, [])[0])!;
  assert.ok(!ra.figs.get(after[2].externalId)!.unknown && ra.figs.get(after[2].externalId)!.rMax - ra.figs.get(after[2].externalId)!.rMin < 1e-12);
  const ma = matchTrades(after);
  assert.deepEqual([ma.trades.length, ma.excluded], [0, 2]);
  // A split doubles the open short: SELL 2 (nothing held), split 2:1, BUY 4 @5, BUY 4 @9, SELL 4.
  const sp = [a('SELL', 2, 15, stamp(0, 10)), a('BUY', 4, 5, stamp(3, 10)), a('BUY', 4, 9, stamp(4, 10)), a('SELL', 4, 10, stamp(5, 10))];
  const ca: CorporateAction[] = [{ externalId: 'ca-self', accountId: 'acc1', symbol: 'SYMA', executedAt: stamp(1, 12), kind: 'split', ratio: { p: 2, q: 1 } }];
  const rs = readings(chainsOf(sp, ca)[0])!;
  const fs = rs.figs.get(sp[3].externalId)!;
  assert.ok(Math.abs(fs.rMax - 1) < 1e-12 && Math.abs(fs.rMin - 1 / 9) < 1e-12, `${fs.rMin}..${fs.rMax}`);
});

test('C4 reference model: exactly tied sells land in the same count bucket whatever the input order', () => {
  // Found by the property run before the revision (assertion 3, bucket part): a lot opened within the late-posting window
  // before a 2:1 split is tainted (10 units); two sells at one exact stamp, 4 and 10 units, oversell together. In input
  // order, drawn 4 then 10 put both in excludedCorporate and drawn 10 then 4 put the 4 in `excluded`. Ties now follow the
  // vendor id, so both input orders give the same counts.
  const row = (externalId: string, side: Activity['side'], units: number, at: string): Activity =>
    ({ externalId, accountId: 'acc1', symbol: 'SYMA', side, units, price: side === 'BUY' ? 10 : 12, fee: 0, executedAt: new Date(at), verified: true });
  const buy = row('cx-b', 'BUY', 5, '2026-03-02T10:00:00Z'), s4 = row('cx-s4', 'SELL', 4, '2026-03-30T10:00:00Z'), s10 = row('cx-s10', 'SELL', 10, '2026-03-30T10:00:00Z');
  const split: CorporateAction[] = [{ externalId: 'cx-split', accountId: 'acc1', symbol: 'SYMA', executedAt: new Date('2026-03-06T12:00:00Z'), kind: 'split', ratio: { p: 2, q: 1 } }];
  const a = matchTrades([buy, s4, s10], split), b = matchTrades([buy, s10, s4], split);
  assert.deepEqual(a.trades, b.trades);
  assert.equal(a.excluded + a.excludedCorporate, b.excluded + b.excludedCorporate);
  assert.deepEqual([b.excluded, b.excludedCorporate], [a.excluded, a.excludedCorporate], 'the count bucket must not depend on the input order');
  // Vendor id order: cx-s10 < cx-s4, so the 10 draws the tainted lot whole and the 4 oversells with nothing tainted.
  assert.deepEqual([a.excluded, a.excludedCorporate], [1, 1]);
});

test('F-36: the model divides by purchase cost plus purchase fees; shown fee-bearing trades keep their sign and never grow', () => {
  const was = feeShown;
  const t = run(0xf36_0001, 1500, (r) => ({ acts: genPlain(r), actions: [] }));
  assert.ok(t.checked >= 1300, `checked ${t.checked} histories (skipped ${t.skipped})`);
  assert.ok(feeShown - was >= 200, `${feeShown - was} shown trades with an entry fee checked against the legacy figure`);
});
