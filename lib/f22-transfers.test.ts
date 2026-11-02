// F-22 (owner OD 2.28, 2026-11-02; docs/features/F-22-transfers-as-share-moves.md): a transfer is a share move, not a
// repricing. A transfer in adds one no-basis lot for the moved-in units and leaves older recorded lots priced; a transfer
// out removes units oldest first only where that cannot change a basis, and is always counted; unit-less transfers and
// unknown kinds keep today's taint. The backward window and same-day rule stay (F-32 Part B, vendor MRC2-10). Fictional.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exclusionSum, matchTrades, type Activity, type MatchResult, type SellReason } from './trades.ts';
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
  // Same price and fee, different opening dates (business lead, committee round 1): which share left changes no return,
  // only the holding period, which follows the record's own FIFO order. Shown, from the oldest lot left.
  const dates = accounted([act('BUY', 50, 100, 0), act('BUY', 50, 100, 5), act('SELL', 50, 40, 40)], [transfer(20, -50)]);
  assert.equal(dates.trades.length, 1);
  near(dates.trades[0].returnPct, -0.6);
  assert.equal(dates.trades[0].openedAt.getTime(), at(5).getTime());
  // Same price and date, one lot not verified (demo or unusable): not alike, so tainted.
  const unverified = accounted([act('BUY', 50, 100, 0), act('BUY', 50, 100, 0, { verified: false }), act('SELL', 50, 40, 40)], [transfer(20, -50)]);
  assert.equal(unverified.trades.length, 0);
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

test('Q5 (committee): buy 100, transfer 1 in, sell all 101 at −60% → shown −60% on the 100 recorded shares, and counted as a sell partly from transferred shares', () => {
  const r = accounted([act('BUY', 100, 100, 0), act('SELL', 101, 40, 40, { fee: 1.01 })], [transfer(20, 1)]);
  assert.equal(r.trades.length, 1);
  near(r.trades[0].returnPct, (100 * 40 - 100 * 100 - 1) / (100 * 100)); // the exit fee prorated: 1.01 × 100/101
  assert.equal(r.sellsPartlyTransferred, 1);
  assert.equal(r.excludedTransfer ?? 0, 0);
  // The same at a gain, alike.
  const gain = accounted([act('BUY', 100, 100, 0), act('SELL', 101, 160, 40)], [transfer(20, 1)]);
  near(gain.trades[0].returnPct, 0.6);
  assert.equal(gain.sellsPartlyTransferred, 1);
});

test('moved-in units are drawn last (engineer): buy 100, transfer 1 in, buy 100 at another price, sell 150 → the figure the ledger gives without the transfer', () => {
  const acts = [act('BUY', 100, 100, 0), act('BUY', 100, 60, 30), act('SELL', 150, 50, 40)];
  const r = accounted(acts, [transfer(20, 1)]);
  assert.deepEqual(r.trades, matchTrades(acts).trades);
  assert.equal(r.sellsPartlyTransferred ?? 0, 0);
});

test('property seed 111: a share moved in shortly before a split never makes the split taint the recorded lots', () => {
  const acts = [act('BUY', 10, 100, 0), act('SELL', 20, 40, 50)];
  const r = accounted(acts, [transfer(23, 1), { externalId: 's', accountId: 'A', symbol: 'WX', executedAt: at(26), kind: 'split', ratio: { p: 2, q: 1 } } as CorporateAction]);
  assert.equal(r.trades.length, 1);
  near(r.trades[0].returnPct, (20 * 40 - 1000) / 1000);
  assert.equal(r.sellsPartlyTransferred ?? 0, 0);
});

// Pinned (engineer and business lead, merge hold): if the vendor ever sends a split or reverse split as a transfer row
// (the vendor's MRC2-10 answer is pending), F-22 publishes a wrong figure. These record what happens today, so the
// vendor's answer or the owner's written acceptance decides the merge. ponytail in lib/trades.ts names it.
test('pinned (MRC2-10 risk): a 1-for-2 reverse split sent as a transfer out of 50 → +100% published (true 0%); a 2:1 split sent as a transfer in of 100 → −50% published (true 0%)', () => {
  const reverse = accounted([act('BUY', 100, 10, 0), act('SELL', 50, 20, 40)], [transfer(20, -50)]);
  near(reverse.trades[0].returnPct, 1);
  const split = accounted([act('BUY', 100, 20, 0), act('SELL', 200, 10, 40)], [transfer(20, 100)]);
  near(split.trades[0].returnPct, -0.5);
  assert.equal(split.sellsPartlyTransferred, 1);
});

// ---- Property (seeded): what a transfer in may change (engineer, committee round 1) ----
// Against the same ledger without the transfer in: every sell shown in both has the identical figure (moved-in units are
// drawn last, so a sell within the recorded holding draws what it would without them); a sell shown only with it is a
// sell partly from moved-in units (priced on its recorded units); a sell shown only without it falls in the transfer's
// backward window or on its day (F-32 Part B, vendor MRC2-10). A unit-less transfer only ever removes sells; a transfer
// out leaves every sell before it as it was and is counted once.
// Replay one case: FUZZ_SEED=<n> node --test lib/f22-transfers.test.ts (messages start "seed <n>:").
const prng = (seed: number) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const inWindowOrDay = (closed: Date, tAt: number) => { const c = closed.getTime(); return (c <= tAt && tAt - c <= 14 * DAY) || Math.floor(c / DAY) === Math.floor(tAt / DAY); };

test('property (3,000 seeded cases): a transfer in changes no shown figure: a sell shown with and without it is identical, one shown only with it is partly from moved-in units, one shown only without it is in its window or day; a unit-less transfer only removes sells; a transfer out leaves every earlier sell as it was and is counted once', () => {
  const seeds = process.env.FUZZ_SEED ? [Number(process.env.FUZZ_SEED)] : Array.from({ length: 3000 }, (_, i) => i + 1);
  let partly = 0;
  for (const seed of seeds) {
    const rnd = prng(seed);
    const pick = <X>(xs: X[]) => xs[Math.floor(rnd() * xs.length)];
    const rows: Activity[] = [];
    for (let i = 0, k = 3 + Math.floor(rnd() * 10); i < k; i++) {
      rows.push(act(rnd() < 0.55 ? 'BUY' : 'SELL', pick([5, 10, 20]), pick([40, 100, 140]), Math.floor(rnd() * 60), { externalId: `r${seed}-${i}`, symbol: pick(['WX', 'YX']), fee: pick([0, 0, 1]) }));
    }
    const base: CorporateAction[] = rnd() < 0.3 ? [{ externalId: `s${seed}`, accountId: 'A', symbol: pick(['WX', 'YX']), executedAt: at(Math.floor(rnd() * 60)), kind: 'split', ratio: { p: 2, q: 1 } } as CorporateAction] : [];
    const d = Math.floor(rnd() * 60) + 0.5; // mid-day: never a trade's instant
    const T = transfer(0, pick([1, 10, undefined, -1, -10, -20]), { externalId: `t${seed}`, symbol: pick(['WX', 'YX']), executedAt: new Date(at(0).getTime() + d * DAY) });
    const ctx = `seed ${seed}: ${JSON.stringify({ rows: rows.map((r) => [r.externalId, r.symbol, r.side, r.units, r.price, r.fee, (r.executedAt.getTime() - at(0).getTime()) / DAY]), base, T })}`;
    const whyWithout = new Map<string, SellReason>();
    const without = new Map(matchTrades(rows, base, { reasons: whyWithout }).trades.map((t) => [t.sellId, t]));
    const withT = matchTrades(rows, [...base, T]);
    const shownWith = new Map(withT.trades.map((t) => [t.sellId, t]));
    const u = (T as { units?: number }).units ?? 0;
    const tAt = T.executedAt.getTime();
    if (u > 0) {
      let newlyShown = 0;
      for (const [id, t] of shownWith) {
        if (without.has(id)) assert.deepEqual(t, without.get(id), `${ctx} ${id} shown with and without the transfer: identical`);
        else {
          // Newly shown: the ledger alone could not price it ("no recorded entry": the moved-in units explain shares the
          // history lacked); a sell partly from moved-in units is priced on its recorded units only.
          newlyShown++;
          assert.ok(t.closedAt.getTime() > tAt, `${ctx} ${id} newly shown only after the transfer`);
          assert.equal(whyWithout.get(id), 'excluded', `${ctx} ${id} newly shown only where the ledger alone had no recorded entry`);
        }
      }
      partly += withT.sellsPartlyTransferred ?? 0; void newlyShown;
      // Removed only by the window or day (Part B): the sell's own, or a buy of the pair on the transfer's day it may draw.
      const buyOnDay = rows.some((r) => r.side === 'BUY' && r.symbol === T.symbol && Math.floor(r.executedAt.getTime() / DAY) === Math.floor(tAt / DAY));
      for (const [id, t] of without) if (!shownWith.has(id)) assert.ok(t.symbol === T.symbol && (inWindowOrDay(t.closedAt, tAt) || (buyOnDay && t.closedAt.getTime() > tAt)), `${ctx} ${id} removed only by the window or day`);
    } else if (u === 0) {
      for (const [id, t] of shownWith) assert.deepEqual(t, without.get(id), `${ctx} ${id} a unit-less transfer only removes sells`);
    } else {
      assert.equal(withT.transfersOut, 1, `${ctx} counted once`);
      for (const t of withT.trades) if (t.closedAt.getTime() < tAt) assert.deepEqual(t, without.get(t.sellId), `${ctx} a sell before the transfer is unchanged`);
    }
  }
  if (!process.env.FUZZ_SEED) assert.ok(partly > 0, 'the cases reach a sell partly from moved-in units');
});

test('COUNTED_KEYS and NOT_SUMMED_KEYS name every numeric key of MatchResult (F-21): countedSum gives two units, never one number', async () => {
  const { COUNTED_KEYS, NOT_SUMMED_KEYS, countedSum } = await import('./trades.ts');
  // Adding a numeric key to MatchResult without listing it makes this literal fail the type check.
  const every: Record<Exclude<keyof MatchResult, 'trades'>, true> = { excluded: true, excludedCorporate: true, excludedHeld: true, excludedTransfer: true, transfersOut: true, sellsPartlyTransferred: true };
  assert.deepEqual([...COUNTED_KEYS, ...NOT_SUMMED_KEYS].sort(), Object.keys(every).sort());
  assert.deepEqual(countedSum({ trades: [], excluded: 1, excludedCorporate: 2, excludedHeld: 4, excludedTransfer: 8, transfersOut: 16, sellsPartlyTransferred: 32 }), { sells: 15, transfersOut: 16 });
});

test('property (3,000 seeded cases, engineer round 2): a transfer out (whole, beyond, partial on alike or mixed lots, unit-less _OUT) shows no sell the ledger alone does not, and a sell drawing only lots older than it keeps its return (its holding days change only when alike lots differ in date)', () => {
  const seeds = process.env.FUZZ_SEED ? [Number(process.env.FUZZ_SEED)] : Array.from({ length: 3000 }, (_, i) => i + 1);
  let compared = 0;
  for (const seed of seeds) {
    const rnd = prng(seed + 100_000);
    const pick = <X>(xs: X[]) => xs[Math.floor(rnd() * xs.length)];
    const rows: Activity[] = [];
    for (let i = 0, k = 3 + Math.floor(rnd() * 10); i < k; i++) {
      rows.push(act(rnd() < 0.6 ? 'BUY' : 'SELL', pick([5, 10, 20]), pick([100, 100, 40, 140]), Math.floor(rnd() * 60), { externalId: `o${seed}-${i}`, fee: pick([0, 0, 1]) }));
    }
    const d = Math.floor(rnd() * 60) + 0.5;
    const units = pick([-1, -5, -10, -20, -40, -1000, undefined]);
    const T = transfer(0, units, { externalId: `t${seed}`, executedAt: new Date(at(0).getTime() + d * DAY), ...(units === undefined ? { out: true } : {}) } as Partial<CorporateAction>);
    const tAt = T.executedAt.getTime();
    const ctx = `seed ${seed}: ${JSON.stringify({ rows: rows.map((r) => [r.externalId, r.side, r.units, r.price, r.fee, (r.executedAt.getTime() - at(0).getTime()) / DAY]), T })}`;
    const without = new Map(matchTrades(rows).trades.map((t) => [t.sellId, t]));
    const drawn = new Map<string, number>();
    const withT = matchTrades(rows, [T], { lastDrawn: drawn });
    assert.equal(withT.transfersOut, 1, `${ctx} counted once`);
    const buysBefore = rows.filter((r) => r.side === 'BUY' && r.executedAt.getTime() < tAt);
    const alikeDatesDiffer = buysBefore.some((x) => buysBefore.some((y) => x.price === y.price && x.fee / x.units === y.fee / y.units && x.executedAt.getTime() !== y.executedAt.getTime()));
    for (const t of withT.trades) {
      const w = without.get(t.sellId);
      assert.ok(w, `${ctx} ${t.sellId} shown only with the transfer out`);
      if (drawn.get(t.sellId)! < tAt) {
        compared++;
        assert.ok(Math.abs(t.returnPct - w!.returnPct) < 1e-12, `${ctx} ${t.sellId} drew only older lots: same return`);
        if (!alikeDatesDiffer) assert.equal(t.holdingDays, w!.holdingDays, `${ctx} ${t.sellId} holding days change only when alike lots differ in date`);
      }
    }
  }
  if (!process.env.FUZZ_SEED) assert.ok(compared > 200, `the cases reach sells drawing only older lots (${compared})`);
});

test('independent review: one share moved in and one moved out never turns a recorded loss into a count, and a same-instant in and out give the same result in either id order', () => {
  const r = accounted([act('BUY', 100, 100, 0), act('SELL', 100, 40, 40)], [transfer(20, 1), transfer(21, -1)]);
  assert.equal(r.trades.length, 1);
  near(r.trades[0].returnPct, -0.6);
  assert.equal(r.transfersOut, 1);
  const tie = (inId: string, outId: string) => matchTrades([act('BUY', 100, 100, 0, { externalId: 'b' }), act('SELL', 50, 40, 40, { externalId: 's' })],
    [transfer(20, 5, { externalId: inId }), transfer(20, -5, { externalId: outId })]);
  assert.deepEqual(tie('x1', 'x2'), tie('x2', 'x1'));
  assert.equal(tie('x1', 'x2').trades.length, 1);
});

test('tester: a partial transfer out of alike lots with different dates, then a rename merging them with another pair → the merged sell is counted, never priced on a basis the dates chose', () => {
  const rename = { externalId: 'rn', accountId: 'A', symbol: 'WX', executedAt: at(60), kind: 'symbol-change', newSymbol: 'WY', outUnits: 50, inUnits: 50 } as CorporateAction;
  const r = accounted([act('BUY', 50, 100, 0), act('BUY', 50, 60, 10, { symbol: 'WY' }), act('BUY', 50, 100, 20), act('SELL', 50, 90, 90, { symbol: 'WY' })], [transfer(40, -50), rename]);
  assert.equal(r.trades.length, 0);
  assert.equal(r.excludedTransfer, 1);
  // Same dates: nothing is unknown, so it stays priced.
  const same = accounted([act('BUY', 50, 100, 0), act('BUY', 50, 60, 10, { symbol: 'WY' }), act('BUY', 50, 100, 0), act('SELL', 50, 90, 90, { symbol: 'WY' })], [transfer(40, -50), rename]);
  assert.equal(same.trades.length, 1);
});

test('tester: a transfer in and a transfer out at the same instant give the same result in either vendor-id order (the out applies last)', () => {
  const run = (inId: string, outId: string) => matchTrades([act('BUY', 100, 100, 0, { externalId: 'b' }), act('BUY', 10, 50, 30, { externalId: 'b2' }), act('SELL', 10, 100, 40, { externalId: 's' })],
    [transfer(20, 1, { externalId: inId }), transfer(20, -101, { externalId: outId })]);
  assert.deepEqual(run('x1', 'x2'), run('x2', 'x1'));
  assert.equal(run('x1', 'x2').trades.length, 1);
});
