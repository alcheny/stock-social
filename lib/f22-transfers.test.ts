// F-22 (owner OD 2.28, 2026-11-02; docs/features/F-22-transfers-as-share-moves.md): a transfer is a share move, not a
// repricing. A transfer in adds one no-basis lot for the moved-in units and leaves older recorded lots priced; a transfer
// out removes units oldest first only where that cannot change a basis, and is always counted; unit-less transfers and
// unknown kinds keep today's taint. The backward window and same-day rule stay (F-32 Part B, vendor MRC2-10). Fictional.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exclusionSum, matchTrades, type Activity, type MatchResult } from './trades.ts';
import type { CorporateAction } from './corporate-actions.ts';

const DAY = 86_400_000;
const at = (d: number) => new Date(Date.UTC(2026, 2, 1) + d * DAY);
let n = 0;
const act = (side: 'BUY' | 'SELL', units: number, price: number, d: number, o: Partial<Activity> = {}): Activity => ({
  externalId: `a${n++}`, accountId: 'A', symbol: 'WX', side, units, price, fee: 0, executedAt: at(d), verified: true, ...o,
});
const transfer = (d: number, units: number | undefined, o: Partial<CorporateAction> = {}): CorporateAction =>
  ({ externalId: `x${n++}`, accountId: 'A', symbol: 'WX', executedAt: at(d), kind: 'unpriceable', reason: 'unknown', ...(units === undefined ? {} : { units }), transfer: true, ...o } as CorporateAction);
const counts = (r: MatchResult) => ({ shown: r.trades.length, excluded: r.excluded, corporate: r.excludedCorporate, transfer: r.excludedTransfer ?? 0, held: r.excludedHeld ?? 0, out: r.transfersOut ?? 0 });
const sells = (xs: Activity[]) => xs.filter((a) => a.side === 'SELL').length;
const accounted = (acts: Activity[], actions: CorporateAction[]) => {
  const r = matchTrades(acts, actions);
  assert.equal(r.trades.length + exclusionSum(r), sells(acts), 'every sell is shown or counted exactly once');
  return r;
};
const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} vs ${b}`);

test('probe 1: buy 100, transfer 1 in, sell the 100 recorded units at −60% → a −60% close is shown; the moved-in unit stays a no-basis lot', () => {
  const r = accounted([act('BUY', 100, 100, 0), act('SELL', 100, 40, 40)], [transfer(20, 1)]);
  assert.equal(r.trades.length, 1);
  near(r.trades[0].returnPct, -0.6);
  // The moved-in unit, sold later, is counted under "transfer" (its basis is unknown).
  const later = accounted([act('BUY', 100, 100, 0), act('SELL', 100, 40, 40), act('SELL', 1, 40, 50)], [transfer(20, 1)]);
  assert.deepEqual(counts(later), { shown: 1, excluded: 0, corporate: 0, transfer: 1, held: 0, out: 0 });
});

test('probe 2: buy 100 (one lot), transfer 1 out, sell 99 at −60% → a −60% close on 99 is shown, and the transfer out is counted', () => {
  const r = accounted([act('BUY', 100, 100, 0), act('SELL', 99, 40, 40)], [transfer(20, -1)]);
  assert.deepEqual(counts(r), { shown: 1, excluded: 0, corporate: 0, transfer: 0, held: 0, out: 1 });
  near(r.trades[0].returnPct, -0.6);
});

test('probe 3: buy 100, transfer 100 out → no trade, and the transfer out is a named count', () => {
  const r = accounted([act('BUY', 100, 100, 0)], [transfer(20, -100)]);
  assert.deepEqual(counts(r), { shown: 0, excluded: 0, corporate: 0, transfer: 0, held: 0, out: 1 });
});

test('the basis rule: two lots with different bases, part of the position transferred out with no lot named → the remaining lots stay tainted and the later sell is counted', () => {
  const r = accounted([act('BUY', 50, 100, 0), act('BUY', 50, 60, 5), act('SELL', 50, 40, 40)], [transfer(20, -50)]);
  assert.deepEqual(counts(r), { shown: 0, excluded: 0, corporate: 0, transfer: 1, held: 0, out: 1 });
  // Same price and fee but different opening dates: oldest-first would choose the shown holding period, so tainted too.
  const dates = accounted([act('BUY', 50, 100, 0), act('BUY', 50, 100, 5), act('SELL', 50, 40, 40)], [transfer(20, -50)]);
  assert.equal(dates.trades.length, 0);
  // The whole position moving out cannot change a basis: a later buy and sell are priced on their own.
  const whole = accounted([act('BUY', 50, 100, 0), act('BUY', 50, 60, 5), act('BUY', 10, 30, 30), act('SELL', 10, 45, 40)], [transfer(20, -100)]);
  assert.deepEqual(counts(whole), { shown: 1, excluded: 0, corporate: 0, transfer: 0, held: 0, out: 1 });
  near(whole.trades[0].returnPct, 0.5);
});

test('a transfer out beyond what is held keeps the gap (later sells "no recorded entry"), and is counted once', () => {
  const r = accounted([act('BUY', 10, 100, 0), act('BUY', 10, 50, 30), act('SELL', 10, 60, 40)], [transfer(20, -15)]);
  assert.deepEqual(counts(r), { shown: 0, excluded: 1, corporate: 0, transfer: 0, held: 0, out: 1 });
});

test('a move between two of the trader\'s own accounts never makes a position vanish from both: a shown trade or a named count', () => {
  // Out of A (whole position), into B; sold in B.
  const r = accounted([act('BUY', 100, 100, 0), act('SELL', 100, 40, 40, { accountId: 'B' })], [transfer(20, -100), transfer(20, 100, { accountId: 'B' })]);
  assert.deepEqual(counts(r), { shown: 0, excluded: 0, corporate: 0, transfer: 1, held: 0, out: 1 });
});

test('a unit-less transfer and an unknown action still taint as today; a split with an unknown ratio still taints', () => {
  const unitless = accounted([act('BUY', 100, 100, 0), act('SELL', 100, 40, 40)], [transfer(20, undefined)]);
  assert.deepEqual(counts(unitless), { shown: 0, excluded: 0, corporate: 0, transfer: 1, held: 0, out: 0 });
  const unknown = accounted([act('BUY', 100, 100, 0), act('SELL', 100, 40, 40)], [{ externalId: 'u1', accountId: 'A', symbol: 'WX', executedAt: at(20), kind: 'unpriceable', reason: 'unknown', units: 1 } as CorporateAction]);
  assert.deepEqual(counts(unknown), { shown: 0, excluded: 0, corporate: 1, transfer: 0, held: 0, out: 0 });
  const split = accounted([act('BUY', 100, 100, 0), act('SELL', 100, 40, 40)], [{ externalId: 's1', accountId: 'A', symbol: 'WX', executedAt: at(20), kind: 'split', units: 3.3 } as CorporateAction]);
  assert.deepEqual(counts(split), { shown: 0, excluded: 0, corporate: 1, transfer: 0, held: 0, out: 0 });
});

test('the backward window and same-day rule are unchanged (F-32 Part B): a sell 12 days before a transfer in is still counted under "transfer"', () => {
  const r = accounted([act('BUY', 100, 100, 0), act('SELL', 100, 40, 9)], [transfer(21, 1)]);
  assert.deepEqual(counts(r), { shown: 0, excluded: 0, corporate: 0, transfer: 1, held: 0, out: 0 });
});

test('rebuilding twice from the same input gives identical results (and in any input order)', () => {
  const acts = [act('BUY', 50, 100, 0), act('BUY', 50, 100, 0), act('SELL', 30, 90, 40), act('SELL', 10, 90, 50, { accountId: 'B' })];
  const actions = [transfer(20, -40), transfer(21, 10, { accountId: 'B' })];
  const r = matchTrades(acts, actions);
  assert.deepEqual(matchTrades(acts, actions), r);
  assert.deepEqual(matchTrades([...acts].reverse(), [...actions].reverse()), r);
});

// ---- Property (seeded): inserting a transfer never invents or changes a shown figure ----
// Replay one case: FUZZ_SEED=<n> node --test lib/f22-transfers.test.ts (messages start "seed <n>:").
const prng = (seed: number) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

test('property (3,000 seeded cases): a transfer in or a unit-less transfer only removes sells (its window or day, or a draw on the moved-in lot), never changes or adds a shown figure; a transfer out leaves every sell before it as it was, and is counted once', () => {
  const seeds = process.env.FUZZ_SEED ? [Number(process.env.FUZZ_SEED)] : Array.from({ length: 3000 }, (_, i) => i + 1);
  let removedByDraw = 0;
  for (const seed of seeds) {
    const rnd = prng(seed);
    const pick = <X>(xs: X[]) => xs[Math.floor(rnd() * xs.length)];
    const rows: Activity[] = [];
    for (let i = 0, k = 3 + Math.floor(rnd() * 10); i < k; i++) {
      rows.push(act(rnd() < 0.55 ? 'BUY' : 'SELL', pick([5, 10, 20]), pick([40, 100, 140]), Math.floor(rnd() * 60), { externalId: `r${seed}-${i}`, symbol: pick(['WX', 'YX']) }));
    }
    const base: CorporateAction[] = rnd() < 0.3 ? [{ externalId: `s${seed}`, accountId: 'A', symbol: pick(['WX', 'YX']), executedAt: at(Math.floor(rnd() * 60)), kind: 'split', ratio: { p: 2, q: 1 } } as CorporateAction] : [];
    const d = Math.floor(rnd() * 60) + 0.5; // mid-day: never a trade's instant
    const T = transfer(0, pick([1, 10, undefined, -1, -10, -20]), { externalId: `t${seed}`, symbol: pick(['WX', 'YX']), executedAt: new Date(at(0).getTime() + d * DAY) });
    const ctx = `seed ${seed}: ${JSON.stringify({ rows: rows.map((r) => [r.externalId, r.symbol, r.side, r.units, r.price, (r.executedAt.getTime() - at(0).getTime()) / DAY]), base, T })}`;
    const without = new Map(matchTrades(rows, base).trades.map((t) => [t.sellId, t]));
    const withT = matchTrades(rows, [...base, T]);
    const u = (T as { units?: number }).units ?? 0;
    const tAt = T.executedAt.getTime();
    if (u >= 0) {
      // A sell whose drawn lots predate the transfer (FIFO: its oldest drawn lot, openedAt, does) is unchanged. Moved-in
      // units dated before the buys are FIFO's oldest units, so sells drawing only later lots may shift: exempt, as the
      // acceptance criterion says ("a sell whose drawn lots predate it").
      for (const t of withT.trades) if (t.openedAt.getTime() < tAt) assert.deepEqual(t, without.get(t.sellId), `${ctx} shown with the transfer, so shown without it at the same figure`);
      const shownWith = new Set(withT.trades.map((t) => t.sellId));
      for (const [id, t] of without) {
        if (shownWith.has(id) || t.symbol !== T.symbol) continue;
        const c = t.closedAt.getTime();
        const windowOrDay = (c <= tAt && tAt - c <= 14 * DAY) || Math.floor(c / DAY) === Math.floor(tAt / DAY);
        assert.ok(windowOrDay || c > tAt, `${ctx} ${id} removed only by its window or day, or by a later draw`);
        if (!windowOrDay) removedByDraw++;
      }
    } else {
      assert.equal(withT.transfersOut, 1, `${ctx} counted once`);
      for (const t of withT.trades) if (t.closedAt.getTime() < tAt) assert.deepEqual(t, without.get(t.sellId), `${ctx} a sell before the transfer is unchanged`);
    }
  }
  if (!process.env.FUZZ_SEED) assert.ok(removedByDraw > 0, 'the cases reach a sell drawing the moved-in lot');
});
