// Corporate actions (POLICY F3c): splits, reverse splits, stock dividends, symbol changes and spin-offs in the FIFO
// matcher, the vendor-row mapping, and property checks. Committee log: docs/features/logs/corporate-actions/.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchTrades, openLots, type Activity } from './trades.ts';
import { actionIndex, actionsFor, chainsOf, fromVendorRows, pairKey, parsePercent, parseRatio, renameRatio, resolveRatio, LATE_POSTING_DAYS, type CorporateAction, type Ratio } from './corporate-actions.ts';

const d = (day: number) => new Date(Date.UTC(2026, 0, day));
let n = 0;
const t = (side: Activity['side'], units: number, price: number, day: number | Date, extra: Partial<Activity> = {}): Activity => ({
  externalId: `t${n++}`, accountId: 'acc', symbol: 'AAA', side, units, price, fee: 0, executedAt: day instanceof Date ? day : d(day), verified: true, ...extra,
});
const base = (day: number | Date, extra: Partial<CorporateAction> = {}) => ({ externalId: `c${n++}`, accountId: 'acc', symbol: 'AAA', executedAt: day instanceof Date ? day : d(day), ...extra });
const split = (day: number | Date, p: number, q: number, extra: Partial<CorporateAction> = {}): CorporateAction => ({ ...base(day, extra), kind: 'split', ratio: { p, q } } as CorporateAction);
const splitUnits = (day: number, units: number, extra: Record<string, unknown> = {}): CorporateAction => ({ ...base(day), kind: 'split', units, ...extra } as CorporateAction);
const rename = (day: number, from: string, to: string, outUnits: number, inUnits = outUnits, extra: Partial<CorporateAction> = {}): CorporateAction =>
  ({ ...base(day, extra), symbol: from, kind: 'symbol-change', newSymbol: to, outUnits, inUnits } as CorporateAction);
const unpriceable = (day: number, extra: Record<string, unknown> = {}): CorporateAction => ({ ...base(day), kind: 'unpriceable', reason: 'spin-off', ...extra } as CorporateAction);
const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≉ ${b}`);
const sells = (acts: Activity[]) => acts.filter((a) => a.side === 'SELL').length;
const accounted = (acts: Activity[], actions: CorporateAction[] = []) => {
  const m = matchTrades(acts, actions);
  assert.equal(m.trades.length + m.excluded + m.excludedCorporate, sells(acts), 'every sell is shown or counted');
  return m;
};

// ---- Examples ----

test('2:1 split mid-position: buy 100 at 100, split, sell 200 at 55 reads +10%; without the split event the sell is excluded, never -45%', () => {
  const acts = [t('BUY', 100, 100, 1), t('SELL', 200, 55, 30)];
  const m = accounted(acts, [split(20, 2, 1)]);
  assert.equal(m.trades.length, 1);
  near(m.trades[0].returnPct, 0.1);
  assert.equal(m.trades[0].holdingDays, 29); // from the original buy
  assert.equal(m.trades[0].openedAt.getTime(), d(1).getTime());
  const without = accounted(acts);
  assert.deepEqual([without.trades.length, without.excluded], [0, 1]);
});

test('1:10 reverse split mid-position: buy 100 at 10 (fee 10), split, sell 10 at 110 (fee 0): +10% less the entry fee, fee per unit scaled', () => {
  const m = accounted([t('BUY', 100, 10, 1, { fee: 10 }), t('SELL', 10, 110, 30)], [split(20, 1, 10)]);
  near(m.trades[0].returnPct, (1100 - 1000 - 10) / 1000);
});

test('split between two partial sells: the first at the old basis, the second at the adjusted basis', () => {
  const m = accounted([t('BUY', 100, 100, 1), t('SELL', 40, 110, 2), t('SELL', 120, 60, 40)], [split(20, 2, 1)]);
  assert.deepEqual(m.trades.map((x) => Math.round(x.returnPct * 1e6) / 1e6), [0.1, 0.2]);
  assert.deepEqual([m.excluded, m.excludedCorporate], [0, 0]);
});

// Orchestrator review (2026-11-01): the vendor may date the row on another day of the event than the trade's prices
// assume, so trades on the action's day are never priced on a guess (this test used to expect +10%).
test('trades on the day of a split are excluded and counted: a sell that day, and a buy that day (its lots tainted)', () => {
  const sellSameDay = accounted([t('BUY', 100, 100, 1), t('SELL', 200, 55, 20)], [split(20, 2, 1)]);
  assert.deepEqual([sellSameDay.trades.length, sellSameDay.excludedCorporate], [0, 1]);
  const preSplitPrice = accounted([t('BUY', 100, 100, 1), t('SELL', 100, 110, new Date(d(20).getTime() + 15 * 3_600_000))], [split(20, 2, 1)]);
  assert.deepEqual([preSplitPrice.trades.length, preSplitPrice.excludedCorporate], [0, 1]); // never +120%
  const buySameDay = accounted([t('BUY', 100, 100, new Date(d(20).getTime() + 3_600_000)), t('SELL', 100, 55, 40)], [split(20, 2, 1)]);
  assert.deepEqual([buySameDay.trades.length, buySameDay.excludedCorporate], [0, 1]); // never -45%
  const reverse = accounted([t('BUY', 100, 10, new Date(d(20).getTime() + 3_600_000)), t('SELL', 10, 110, 40)], [split(20, 1, 10)]);
  assert.deepEqual([reverse.trades.length, reverse.excluded + reverse.excludedCorporate], [0, 1]); // never +1000%
});

test('reverse split with cash in lieu, ratio stated by the vendor: 105 shares 1:10 become 10 (0.5 paid in cash); the fraction is removed, not a trade, not counted; without the stated ratio it is unpriceable', () => {
  const stated = { ratio: { p: 1, q: 10 } };
  const m = accounted([t('BUY', 105, 10, 1), t('SELL', 10, 110, 30)], [splitUnits(20, -95, stated)]);
  assert.equal(m.trades.length, 1);
  near(m.trades[0].returnPct, 0.1);
  assert.deepEqual([m.excluded, m.excludedCorporate], [0, 0]);
  assert.equal(openLots([t('BUY', 105, 10, 1)], [splitUnits(20, -95, stated)]).reduce((s, l) => s + l.units, 0), 10);
  assert.equal(accounted([t('BUY', 105, 10, 1), t('SELL', 10, 110, 30)], [splitUnits(20, -95)]).excludedCorporate, 1); // 1:10 or 10:99
});

test('a reverse split whose shares fit no clean ratio (the broker rounded up) is unpriceable: the next sell is excluded and counted', () => {
  const m = accounted([t('BUY', 1000, 10, 1), t('SELL', 101, 100, 10)], [splitUnits(5, -899)]);
  assert.deepEqual([m.trades.length, m.excluded, m.excludedCorporate], [0, 0, 1]);
});

test('ambiguous vendor units: 200 on 100 held reads 3:1 (change) or 2:1 (total): unpriceable unless the description settles it', () => {
  const acts = [t('BUY', 100, 100, 1), t('SELL', 100, 50, 30)];
  assert.deepEqual(Object.values(accounted(acts, [splitUnits(20, 200)])).slice(1), [0, 1]);
  const settled = accounted([t('BUY', 100, 100, 1), t('SELL', 200, 55, 30)], [splitUnits(20, 200, { ratio: { p: 2, q: 1 } })]);
  near(settled.trades[0].returnPct, 0.1);
});

test('a description ratio that disagrees with the units is unpriceable', () => {
  const m = accounted([t('BUY', 100, 100, 1), t('SELL', 100, 50, 10)], [splitUnits(5, 100, { ratio: { p: 3, q: 1 } })]);
  assert.deepEqual([m.trades.length, m.excludedCorporate], [0, 1]);
});

test('stock dividend of 5%: 100 shares at 105 receive 5; selling all 105 at 110 reads +10% (basis spread over old and new)', () => {
  const sd: CorporateAction = { ...base(20), kind: 'stock-dividend', units: 5, ratio: parsePercent('5% STOCK DIVIDEND')! } as CorporateAction;
  const m = accounted([t('BUY', 100, 105, 1), t('SELL', 105, 110, 30)], [sd]);
  near(m.trades[0].returnPct, (105 * 110 - 100 * 105) / (100 * 105));
});

test('symbol change: lots carry to the new symbol with their date; the close shows the new symbol; a recycled ticker starts fresh', () => {
  const acts = [t('BUY', 100, 100, 1), t('SELL', 100, 120, 10, { symbol: 'BBB' }), t('BUY', 10, 50, 12), t('SELL', 10, 55, 13)];
  const m = accounted(acts, [rename(5, 'AAA', 'BBB', 100)]);
  assert.deepEqual(m.trades.map((x) => [x.symbol, Math.round(x.returnPct * 1e6) / 1e6, x.openedAt.getTime()]), [['BBB', 0.2, d(1).getTime()], ['AAA', 0.1, d(12).getTime()]]);
});

test('symbol change chain A → B → C, with a 2-for-1 share exchange on the second step', () => {
  const acts = [t('BUY', 100, 100, 1), t('SELL', 200, 60, 40, { symbol: 'CCC' })];
  const m = accounted(acts, [rename(5, 'AAA', 'BBB', 100), rename(30, 'BBB', 'CCC', 100, 200)]);
  assert.equal(m.trades[0].symbol, 'CCC');
  near(m.trades[0].returnPct, 0.2);
});

test('a symbol change whose shares do not match the ledger, or carry a leftover, is unpriceable: nothing moves, nothing is guessed', () => {
  const m = accounted([t('BUY', 100, 100, 1), t('SELL', 100, 120, 10, { symbol: 'BBB' }), t('SELL', 100, 90, 11)], [rename(5, 'AAA', 'BBB', 90)]);
  assert.deepEqual([m.trades.length, m.excluded, m.excludedCorporate], [0, 1, 1]); // BBB has no lots; AAA's lots are tainted
  assert.equal(renameRatio(100, 150.5), null);
  assert.deepEqual(renameRatio(100, 50), { p: 1, q: 2 });
});

test('spin-off with no named parent (the default): every open lot in that account is tainted and counted; other accounts and later buys are untouched', () => {
  const acts = [
    t('BUY', 100, 100, 1), t('BUY', 10, 50, 1, { symbol: 'ZZZ' }), t('BUY', 10, 50, 1, { accountId: 'acc2' }),
    t('SELL', 100, 90, 20), t('SELL', 10, 60, 20, { symbol: 'ZZZ' }), t('SELL', 20, 10, 20, { symbol: 'NEW' }),
    t('SELL', 10, 55, 20, { accountId: 'acc2' }), t('BUY', 10, 100, 21), t('SELL', 10, 110, 22),
  ];
  const m = accounted(acts, [unpriceable(5, { symbol: 'NEW', units: 20, scope: 'account' })]);
  assert.equal(m.excludedCorporate, 3);
  assert.deepEqual(m.trades.map((x) => [x.accountId, x.symbol, Math.round(x.returnPct * 1e6) / 1e6]), [['acc2', 'AAA', 0.1], ['acc', 'AAA', 0.1]]);
});

test('spin-off naming its parent taints only the parent pair', () => {
  const acts = [t('BUY', 100, 100, 1), t('BUY', 10, 50, 1, { symbol: 'ZZZ' }), t('SELL', 100, 90, 20), t('SELL', 10, 60, 20, { symbol: 'ZZZ' })];
  const m = accounted(acts, [unpriceable(5, { scope: 'pair' })]);
  assert.deepEqual([m.trades.length, m.trades[0].symbol, m.excludedCorporate], [1, 'ZZZ', 1]);
});

test('late posting: a sell within the window before a split row is excluded and counted; later sells read the adjusted basis', () => {
  const m = accounted([t('BUY', 100, 100, 1), t('SELL', 50, 55, 22), t('SELL', 100, 56, 40)], [split(24, 2, 1)]);
  assert.deepEqual([m.excludedCorporate, m.trades.length], [1, 1]);
  near(m.trades[0].returnPct, 0.12);
  // Outside the window the earlier sell is shown.
  const far = accounted([t('BUY', 100, 100, 1), t('SELL', 50, 110, 1 + 0.5), t('SELL', 100, 56, 20)], [split(1 + 0.5 + LATE_POSTING_DAYS + 1, 2, 1)]);
  assert.equal(far.trades.length, 2);
});

test('mix across accounts: a split in one account leaves the same symbol in another account unadjusted', () => {
  const acts = [t('BUY', 100, 100, 1), t('BUY', 100, 100, 1, { accountId: 'acc2' }), t('SELL', 200, 55, 30), t('SELL', 100, 110, 30, { accountId: 'acc2' })];
  const m = accounted(acts, [split(20, 2, 1)]);
  assert.deepEqual(m.trades.map((x) => [x.accountId, Math.round(x.returnPct * 1e6) / 1e6]), [['acc', 0.1], ['acc2', 0.1]]);
});

// Orchestrator decision under the owner's delegation (2026-11-01), replacing the committee's episode rule: an oversell
// excludes only the oversold sell; sells already priced from recorded lots stay shown (TR-1: no per-trade hiding).
test('an oversold sell is excluded alone; an earlier loss priced from recorded lots stays shown (wins and losses alike)', () => {
  const loss = accounted([t('BUY', 100, 100, 1), t('SELL', 50, 50, 2), t('SELL', 51, 50, 3)]);
  assert.deepEqual([loss.trades.length, loss.excluded], [1, 1]);
  near(loss.trades[0].returnPct, -0.5);
  const win = accounted([t('BUY', 100, 100, 1), t('SELL', 50, 150, 2), t('SELL', 51, 150, 3)]);
  assert.deepEqual([win.trades.length, win.excluded], [1, 1]);
  near(win.trades[0].returnPct, 0.5);
});

test('an oversell drawing lots an unresolved split left unscaled is counted as corporate, not as missing history', () => {
  const m = accounted([t('BUY', 100, 100, 1), t('SELL', 200, 55, 40)], [splitUnits(20, 200)]);
  assert.deepEqual([m.trades.length, m.excluded, m.excludedCorporate], [0, 0, 1]);
});

test('a pair with only actions, or actions on symbols with no lots, never crashes and shows nothing', () => {
  assert.deepEqual(matchTrades([], [split(1, 2, 1), rename(2, 'AAA', 'BBB', 5), unpriceable(3, { units: 4 })]), { trades: [], excluded: 0, excludedCorporate: 0 });
});

// Review fix round 1 (blocking): same-instant actions no longer depend on their ids' order.
test('a rename and a split on the new symbol at the same instant price correctly whichever id sorts first', () => {
  const acts = [t('BUY', 100, 100, 1), t('SELL', 200, 55, 30, { symbol: 'NEW' })];
  const r = rename(20, 'AAA', 'NEW', 100), sp = split(20, 2, 1, { symbol: 'NEW' });
  for (const actions of [[r, sp], [sp, r]]) near(accounted(acts, actions).trades[0].returnPct, 0.1);
});

test('a split on the old symbol at the same instant as its rename is ambiguous: the moved lots are tainted, never shown unadjusted', () => {
  const acts = [t('BUY', 100, 100, 1), t('SELL', 100, 55, 30, { symbol: 'NEW' })];
  for (const actions of [[rename(10, 'AAA', 'NEW', 100), split(10, 2, 1)], [split(10, 2, 1), rename(10, 'AAA', 'NEW', 100)]]) {
    const m = accounted(acts, actions);
    assert.deepEqual([m.trades.length, m.excludedCorporate], [0, 1]);
  }
});

test('a stored rename to the same symbol is unpriceable: the lots stay and are tainted, never dropped', () => {
  const acts = [t('BUY', 100, 100, 1), t('SELL', 100, 120, 30)];
  const m = accounted(acts, [rename(10, 'AAA', 'AAA', 100)]);
  assert.deepEqual([m.trades.length, m.excluded, m.excludedCorporate], [0, 0, 1]);
});

test('an action that empties the lots: a later oversell leaves the earlier trade shown', () => {
  const acts = [t('BUY', 10, 100, 1), t('SELL', 5, 110, 2), t('BUY', 10, 100, 40), t('SELL', 20, 100, 41)];
  const m = accounted(acts, [unpriceable(20, { scope: 'pair', units: -5 })]);
  assert.deepEqual([m.trades.length, m.excluded, m.excludedCorporate], [1, 1, 0]);
  near(m.trades[0].returnPct, 0.1);
});

test('late-posting window boundary: a sell exactly LATE_POSTING_DAYS before the action is excluded, one minute more is shown', () => {
  const at = d(30);
  const edge = new Date(at.getTime() - LATE_POSTING_DAYS * 86_400_000);
  const before = new Date(edge.getTime() - 60_000);
  assert.equal(accounted([t('BUY', 100, 100, 1), t('SELL', 10, 110, edge)], [split(at, 2, 1)]).excludedCorporate, 1);
  assert.equal(accounted([t('BUY', 100, 100, 1), t('SELL', 10, 110, before)], [split(at, 2, 1)]).trades.length, 1);
});

// Tester round 1 (blocking findings), each now excluded and counted instead of shown wrong.
test('cash in lieu never resolves to a wrong exact ratio: 33 → 3 (1:10 with 0.3 in cash, or exactly 1:11) and 3 → 1 are unpriceable', () => {
  assert.equal(resolveRatio(33, { kind: 'split', units: -30 }), null);
  assert.equal(resolveRatio(3, { kind: 'split', units: -2 }), null);
  assert.equal(resolveRatio(33, { kind: 'stock-dividend', units: 1 }), null); // 5% of 33 is 1.65 shares: 1 + cash, or 34:33
  const m = accounted([t('BUY', 33, 10, 1), t('SELL', 3, 100, 30)], [splitUnits(20, -30)]);
  assert.deepEqual([m.trades.length, m.excludedCorporate], [0, 1]);
});

test('a share-moving row with no share count is unpriceable: the pair\'s lots are tainted, the later sell excluded and counted (review round 3)', () => {
  const { actions } = fromVendorRows('acc', [{ id: 'x', type: 'TRANSFER', symbol: { symbol: 'AAA' }, units: null, trade_date: '2026-01-20T00:00:00Z' }]);
  assert.deepEqual(actions.map((a) => [a.kind, a.symbol]), [['unpriceable', 'AAA']]);
  const m = accounted([t('BUY', 100, 100, 1), t('SELL', 50, 110, 40)], actions);
  assert.deepEqual([m.trades.length, m.excludedCorporate], [0, 1]);
});

test('a transfer out of one symbol and a transfer in of another on the same day are not a rename: the sell of the new symbol is excluded', () => {
  const row = (id: string, type: string, symbol: string, units: number) => ({ id, type, symbol: { symbol }, units, trade_date: '2026-01-10T00:00:00Z' });
  const { actions } = fromVendorRows('acc', [row('o', 'TRANSFER', 'AAA', -10), row('i', 'EXTERNAL_ASSET_TRANSFER_IN', 'BBB', 10)]);
  assert.deepEqual(actions.map((a) => a.kind), ['unpriceable', 'unpriceable']);
  const m = accounted([t('BUY', 10, 100, 1), t('SELL', 10, 50, 20, { symbol: 'BBB' })], actions);
  assert.equal(m.trades.length, 0);
});

test('a late-posted 1:1 rename after trades of the new symbol taints the moved lots: no return priced on the old cost', () => {
  const acts = [t('BUY', 10, 100, 1), t('SELL', 10, 120, 11, { symbol: 'BBB' }), t('BUY', 10, 130, 15, { symbol: 'BBB' }), t('SELL', 10, 140, 20, { symbol: 'BBB' })];
  const m = accounted(acts, [rename(13, 'AAA', 'BBB', 10)]);
  assert.equal(m.trades.length, 0);
});

test('a split with a ratio and no units does not scale a buy made inside the window before it (it may already be post-split)', () => {
  const acts = [t('BUY', 10, 100, 1), t('BUY', 10, 50, 12), t('SELL', 30, 50, 20)];
  const m = accounted(acts, [split(15, 2, 1)]);
  assert.deepEqual([m.trades.length, m.excludedCorporate], [0, 1]);
});

test('a lot that arrived through a rename and was opened inside the window before a split is tainted too (reviewer round 2)', () => {
  const acts = [t('BUY', 100, 100, 1), t('BUY', 100, 50, 29), t('SELL', 400, 55, 60, { symbol: 'NEW' })];
  const m = accounted(acts, [rename(32, 'AAA', 'NEW', 200), split(32, 2, 1, { symbol: 'NEW' })]);
  assert.equal(m.trades.length, 0);
});

// Tester round 2: an event whose true ratio is off the candidate grid never resolves to a grid ratio.
test('off-grid ratios are unpriceable: a 10% distribution booked as a split, a 2.5% stock dividend', () => {
  const { actions } = fromVendorRows('acc', [{ id: 'x', type: 'SPLIT', trade_date: '2026-02-01T00:00:00Z', units: 10, description: 'STOCK SPLIT', symbol: { symbol: 'AAA' } }]);
  const m = accounted([t('BUY', 100, 100, 1), t('SELL', 10, 95, 60)], actions);
  assert.deepEqual([m.trades.length, m.excludedCorporate], [0, 1]);
  assert.equal(resolveRatio(150, { kind: 'stock-dividend', units: 3 }), null);
});

test('a split on the new symbol at the instant of a share-exchange rename may be the same event twice: tainted, not applied again', () => {
  const m = accounted([t('BUY', 100, 100, 1), t('SELL', 200, 55, 60, { symbol: 'BBB' })], [rename(30, 'AAA', 'BBB', 100, 200), splitUnits(30, 200, { symbol: 'BBB' })]);
  assert.deepEqual([m.trades.length, m.excludedCorporate], [0, 1]);
});

// ---- Ratio parsing and resolution ----

test('parseRatio reads "2 FOR 1" and "1-for-10"; a bare "n:m" (a time) and anything else is null', () => {
  assert.deepEqual(parseRatio('2 FOR 1 STOCK SPLIT'), { p: 2, q: 1 });
  assert.deepEqual(parseRatio('1-for-10 reverse split'), { p: 1, q: 10 });
  assert.equal(parseRatio('split 3:2'), null);
  assert.equal(parseRatio('SPLIT EFFECTIVE 10:30'), null);
  assert.deepEqual(parseRatio('4 for 2'), { p: 2, q: 1 });
  for (const s of ['stock split', '', null, undefined, '1 for 1', '0 for 3']) assert.equal(parseRatio(s), null);
});

test('resolveRatio: exact fits, leftovers in [0, 1) only, a unique answer or none', () => {
  assert.deepEqual(resolveRatio(100, { kind: 'split', units: 100 }), { ratio: { p: 2, q: 1 }, leftover: 0 });
  assert.deepEqual(resolveRatio(101, { kind: 'split', units: -51, ratio: { p: 1, q: 2 } }), { ratio: { p: 1, q: 2 }, leftover: 0.5 });
  assert.deepEqual(resolveRatio(101, { kind: 'split', units: -51 }), { ratio: { p: 1, q: 2 }, leftover: 0.5 }); // no rival fits
  assert.equal(resolveRatio(105, { kind: 'split', units: -95 }), null); // 1:10 with 0.5 in cash, or 10:99 with 0.06
  assert.equal(resolveRatio(101, { kind: 'split', units: 50 }), null); // 3:2 as a change or 1:2 as a total, each with 0.5 left
  assert.deepEqual(resolveRatio(10_000, { kind: 'split', units: -9_900 }), { ratio: { p: 1, q: 100 }, leftover: 0 });
  assert.equal(resolveRatio(0, { kind: 'split', units: 10 }), null);
  assert.equal(resolveRatio(3, { kind: 'split', units: -3 }), null); // all cashed out: the ratio cannot be inferred
  const cashed = resolveRatio(3, { kind: 'split', units: -3, ratio: { p: 1, q: 10 } }); // with the description: all 0.3 paid in cash
  assert.deepEqual(cashed?.ratio, { p: 1, q: 10 });
  near(cashed!.leftover, 0.3);
  assert.equal(resolveRatio(100, { kind: 'split', units: Number.NaN }), null);
  assert.equal(resolveRatio(100, { kind: 'stock-dividend', units: 2 }), null); // 2%, or 99:97 with cash in lieu
  assert.deepEqual(resolveRatio(100, { kind: 'stock-dividend', units: 2, ratio: { p: 51, q: 50 } }), { ratio: { p: 51, q: 50 }, leftover: 0 });
  assert.deepEqual([parsePercent('5% STOCK DIVIDEND'), parsePercent('2.5 % stock dividend'), parsePercent('no rate'), parsePercent('0%')], [{ p: 21, q: 20 }, { p: 41, q: 40 }, null, null]);
});

// ---- Vendor rows ----

test('fromVendorRows: SPLIT, STOCK_DIVIDEND, REI, a rename pair, a spin-off, lone adjustments; trades, cash rows and options are left alone', () => {
  const row = (id: string, type: string, symbol: string, units: number | null, extra: Record<string, unknown> = {}) => ({ id, type, symbol: { symbol }, units, trade_date: '2026-01-05T00:00:00Z', ...extra });
  const { activities, actions } = fromVendorRows('acc', [
    row('1', 'SPLIT', 'AAA', 100, { description: '2 FOR 1 SPLIT' }),
    row('2', 'STOCK_DIVIDEND', 'BBB', 5),
    row('3', 'REI', 'CCC', 1.5, { price: 40, fee: -0.1 }),
    row('4', 'REI', 'CCC', 1, { price: 0 }),
    row('5', 'ADJUSTMENT', 'OLD', -50, { trade_date: '2026-01-06T00:00:00Z' }),
    row('6', 'ADJUSTMENT', 'NEW', 50, { trade_date: '2026-01-06T00:00:00Z' }),
    row('7', 'STOCK_DIVIDEND', 'KID', 20, { description: 'SPIN-OFF of child shares' }),
    row('8', 'ADJUSTMENT', 'ODD', 3, { trade_date: '2026-01-07T00:00:00Z' }),
    row('9', 'BUY', 'AAA', 1, { price: 1 }), row('10', 'DIVIDEND', 'AAA', null), row('11', 'SPLIT', 'OPT', 1, { option_symbol: {} }),
    { id: '12', type: 'SPLIT', symbol: null, units: 1, trade_date: '2026-01-05' }, row('13', 'SPLIT', 'AAA', 1, { trade_date: 'nope' }),
  ]);
  assert.deepEqual(activities.map((a) => [a.externalId, a.side, a.units, a.price, a.fee]), [['3', 'BUY', 1.5, 40, 0.1]]);
  const brief = actions.map((a) => [a.externalId, a.kind, a.symbol, a.kind === 'split' ? a.ratio : a.kind === 'symbol-change' ? a.newSymbol : a.kind === 'unpriceable' ? a.scope ?? a.reason : a.units]);
  assert.deepEqual(brief, [
    ['1', 'split', 'AAA', { p: 2, q: 1 }], ['2', 'stock-dividend', 'BBB', 5], ['4', 'unpriceable', 'CCC', 'unknown'],
    ['7', 'unpriceable', 'KID', 'account'], ['5', 'symbol-change', 'OLD', 'NEW'], ['8', 'unpriceable', 'ODD', 'unknown'],
  ]);
});

test('chainsOf and actionsFor: renames link pairs per account; account-wide actions reach every pair in that account only', () => {
  const acts = [rename(1, 'A', 'B', 1), rename(2, 'B', 'C', 1), rename(3, 'X', 'Y', 1, 1, { accountId: 'other' }), unpriceable(4, { scope: 'account', symbol: 'K' })];
  const chains = chainsOf(acts);
  assert.deepEqual([...chains].sort(), [['acc|A', 'acc|A'], ['acc|B', 'acc|A'], ['acc|C', 'acc|A'], ['other|X', 'other|X'], ['other|Y', 'other|X']]);
  const mine = actionsFor(acts, new Set([pairKey('acc', 'Z')]));
  assert.deepEqual(mine.map((a) => a.symbol), ['K']);
  assert.equal(actionsFor(acts, new Set(['acc|A', 'acc|B', 'acc|C'])).length, 3);
  const indexed = actionIndex(acts);
  for (const keys of [['acc|Z'], ['acc|A', 'acc|B', 'acc|C'], ['other|X'], ['other|Y'], ['none|Q']]) assert.deepEqual(indexed(new Set(keys)), actionsFor(acts, new Set(keys)));
});

// ---- Property checks (seeded, reproducible) ----

const rng = (seed: number) => () => { seed = (seed * 1664525 + 1013904223) % 2 ** 32; return seed / 2 ** 32; };
const RATIOS: Ratio[] = [{ p: 2, q: 1 }, { p: 3, q: 1 }, { p: 3, q: 2 }, { p: 1, q: 10 }, { p: 1, q: 4 }, { p: 5, q: 4 }];
const HOUR = 3_600_000;
// A random long-only history over two accounts and two symbols, with occasional oversells; distinct timestamps.
function history(r: () => number, size = 60): Activity[] {
  const out: Activity[] = [];
  const held = new Map<string, number>();
  for (let i = 0; i < size; i++) {
    const accountId = r() < 0.5 ? 'p1' : 'p2', symbol = r() < 0.5 ? 'S1' : 'S2', k = `${accountId}|${symbol}`;
    const have = held.get(k) ?? 0;
    const sell = have > 0 && r() < 0.5;
    const units = sell ? (r() < 0.05 ? have + 1 : Math.max(1, Math.floor(have * (0.2 + r() * 0.8)))) : 1 + Math.floor(r() * 40);
    held.set(k, sell ? Math.max(0, have - units) : have + units);
    out.push({ externalId: `h${i}`, accountId, symbol, side: sell ? 'SELL' : 'BUY', units, price: Math.round((10 + r() * 90) * 100) / 100, fee: Math.round(r() * 300) / 100, executedAt: new Date(Date.UTC(2025, 0, 1) + i * 2 * 86_400_000 + HOUR), verified: true });
  }
  return out;
}
const SEEDS = Array.from({ length: 40 }, (_, i) => i + 1);

test('property: every sell is shown or counted, no NaN or infinite return, no lot at or below zero units', () => {
  for (const s of SEEDS) {
    const r = rng(s);
    const acts = history(r);
    const actions = [split(new Date(Date.UTC(2025, 2, 1)), 2, 1, { accountId: 'p1', symbol: 'S1' }), split(new Date(Date.UTC(2025, 4, 1)), 1, 10, { accountId: 'p2', symbol: 'S2' }), unpriceable(0, { executedAt: new Date(Date.UTC(2025, 3, 1)), accountId: 'p1', symbol: 'S2', units: 3 })];
    const m = accounted(acts, actions);
    for (const x of m.trades) assert.ok(Number.isFinite(x.returnPct), `seed ${s}`);
    for (const l of openLots(acts, actions)) assert.ok(l.units > 0 && Number.isFinite(l.units), `seed ${s}`);
  }
});

test('property: a split conserves units × ratio, total cost and total entry fees of the open lots', () => {
  for (const s of SEEDS) {
    const r = rng(s);
    const acts = history(r, 30);
    const ratio = RATIOS[s % RATIOS.length];
    const at = new Date(acts[acts.length - 1].executedAt.getTime() + HOUR);
    const before = openLots(acts).filter((l) => l.accountId === 'p1' && l.symbol === 'S1');
    const after = openLots(acts, [split(at, ratio.p, ratio.q, { accountId: 'p1', symbol: 'S1' })]).filter((l) => l.accountId === 'p1' && l.symbol === 'S1');
    const sum = (ls: typeof before, f: (l: (typeof before)[number]) => number) => ls.reduce((x, l) => x + f(l), 0);
    near(sum(after, (l) => l.units), (sum(before, (l) => l.units) * ratio.p) / ratio.q);
    near(sum(after, (l) => l.units * l.price), sum(before, (l) => l.units * l.price));
    near(sum(after, (l) => l.units * l.feePerUnit), sum(before, (l) => l.units * l.feePerUnit));
  }
});

// Pre-adjusted data: the pair's rows before the split restated in post-split shares (units × r, price ÷ r, fees as is).
function preAdjusted(acts: Activity[], at: Date, key: string, r: Ratio): Activity[] {
  return acts.map((a) => (pairKey(a.accountId, a.symbol) === key && a.executedAt < at ? { ...a, units: (a.units * r.p) / r.q, price: (a.price * r.q) / r.p } : a));
}
const outcome = (m: ReturnType<typeof matchTrades>) => ({ ...m, trades: m.trades.map((x) => ({ ...x, returnPct: Math.round(x.returnPct * 1e9) / 1e9 })) });

test('property: raw rows plus a split equal the same rows pre-adjusted for it (returns, ids, dates, counts)', () => {
  for (const s of SEEDS) {
    const r = rng(s);
    const ratio = RATIOS[s % RATIOS.length];
    const at = new Date(Date.UTC(2025, 3, 1) + 7 * HOUR);
    // No trade of the pair inside the late-posting window (those rules have no pre-adjusted counterpart).
    const acts = history(r).filter((a) => !(a.accountId === 'p1' && a.symbol === 'S1' && a.executedAt < at && at.getTime() - a.executedAt.getTime() <= LATE_POSTING_DAYS * 86_400_000));
    const withSplit = matchTrades(acts, [split(at, ratio.p, ratio.q, { accountId: 'p1', symbol: 'S1' })]);
    assert.deepEqual(outcome(withSplit), outcome(matchTrades(preAdjusted(acts, at, 'p1|S1', ratio))), `seed ${s}`);
  }
});

test('property: split r1 then r2 equals one split of r1 × r2; r then 1/r is the identity', () => {
  for (const s of SEEDS) {
    const at = new Date(Date.UTC(2025, 3, 1) + 7 * HOUR), at2 = new Date(at.getTime() + 60_000);
    const inWindow = (x: Activity) => x.accountId === 'p2' && x.symbol === 'S2' && x.executedAt < at && at.getTime() - x.executedAt.getTime() <= LATE_POSTING_DAYS * 86_400_000;
    const acts = history(rng(s)).filter((x) => !inWindow(x));
    const [a, b] = [RATIOS[s % RATIOS.length], RATIOS[(s + 1) % RATIOS.length]];
    const k = { accountId: 'p2', symbol: 'S2' };
    assert.deepEqual(outcome(matchTrades(acts, [split(at, a.p, a.q, k), split(at2, b.p, b.q, k)])), outcome(matchTrades(acts, [split(at, a.p * b.p, a.q * b.q, k)])), `seed ${s}`);
    assert.deepEqual(outcome(matchTrades(acts, [split(at, a.p, a.q, k), split(at2, a.q, a.p, k)])), outcome(matchTrades(acts)), `seed ${s}`);
  }
});

// An action that ADDS shares (a spin-off's new shares) is left out here: shares it records can explain a later oversell.
test('property: an unpriceable action never adds a shown trade and leaves every trade closed before its window unchanged', () => {
  for (const s of SEEDS) {
    const acts = history(rng(s));
    const at = new Date(Date.UTC(2025, 3, 1) + 7 * HOUR);
    const plain = matchTrades(acts);
    const tainted = matchTrades(acts, [unpriceable(0, { executedAt: at, accountId: 'p1', symbol: 'S1', scope: s % 2 ? 'account' : 'pair', units: -(s % 3) })]);
    const ids = new Set(plain.trades.map((x) => x.sellId));
    for (const x of tainted.trades) assert.ok(ids.has(x.sellId), `seed ${s}`);
    const cut = at.getTime() - LATE_POSTING_DAYS * 86_400_000;
    const early = (m: typeof plain) => m.trades.filter((x) => x.closedAt.getTime() <= cut && !(x.accountId === 'p1'));
    assert.deepEqual(early(tainted), early(plain), `seed ${s}`);
  }
});

test('property: no actions equals the old call; shuffled input (distinct times) gives the same output', () => {
  for (const s of SEEDS) {
    const r = rng(s);
    const acts = history(r);
    assert.deepEqual(matchTrades(acts, []), matchTrades(acts));
    const shuffled = [...acts].sort(() => r() - 0.5);
    const actions = [split(new Date(Date.UTC(2025, 2, 1)), 3, 2, { accountId: 'p1', symbol: 'S2' })];
    assert.deepEqual(matchTrades(shuffled, [...actions].reverse()), matchTrades(acts, actions));
  }
});

test('property: A, then a rename of all shares to B, then B equals all-B data except the symbol labels', () => {
  for (const s of SEEDS) {
    const acts = history(rng(s)).filter((a) => a.accountId === 'p1').map((a) => ({ ...a, symbol: 'S1' }));
    const at = new Date(Date.UTC(2025, 3, 1) + 7 * HOUR);
    const heldAt = openLots(acts.filter((a) => a.executedAt < at)).reduce((x, l) => x + l.units, 0);
    const renamed = acts.map((a) => (a.executedAt > at ? { ...a, symbol: 'S9' } : a));
    const actions = heldAt > 0 ? [rename(0, 'S1', 'S9', heldAt, heldAt, { executedAt: at, accountId: 'p1' })] : [];
    const got = matchTrades(renamed, actions);
    const want = matchTrades(acts.map((a) => ({ ...a, symbol: 'S9' })));
    assert.deepEqual({ ...got, trades: got.trades.map((x) => ({ ...x, symbol: 'S9' })) }, want, `seed ${s}`);
  }
});
