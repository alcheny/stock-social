// F-32 Part A (council cycle 5, C5-1; docs/features/F-32-transfers-named-never-remove-a-closed-trade.md): every sell a
// transfer row excludes is counted under its own reason, `excludedTransfer`, never under the generic corporate count.
// Part A relabels only: every shown figure and every other count is what the matcher gave before. Fictional ledgers only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EXCLUDED_KEYS, exclusionSum, headline, matchTrades, type Activity, type MatchResult, type SellReason } from './trades.ts';
import type { CorporateAction } from './corporate-actions.ts';

const DAY = 86_400_000;
const at = (d: number) => new Date(Date.UTC(2026, 2, 1) + d * DAY); // fictional dates, from Mar 1
let n = 0;
const act = (side: 'BUY' | 'SELL', units: number, price: number, d: number, o: Partial<Activity> = {}): Activity => ({
  externalId: `a${n++}`, accountId: 'A', symbol: 'WX', side, units, price, fee: 0, executedAt: at(d), verified: true, ...o,
});
// A vendor transfer row as the loader passes it (lib/corporate-actions.ts#loadCorporateActions): unpriceable, flagged.
const transfer = (d: number, units: number | undefined, o: Partial<CorporateAction> = {}): CorporateAction =>
  ({ externalId: `x${n++}`, accountId: 'A', symbol: 'WX', executedAt: at(d), kind: 'unpriceable', reason: 'unknown', ...(units === undefined ? {} : { units }), transfer: true, ...o } as CorporateAction);
const unknown = (d: number, units?: number, o: Partial<CorporateAction> = {}): CorporateAction =>
  ({ externalId: `u${n++}`, accountId: 'A', symbol: 'WX', executedAt: at(d), kind: 'unpriceable', reason: 'unknown', ...(units === undefined ? {} : { units }), ...o } as CorporateAction);
const split = (d: number, p: number, q: number, o: Partial<CorporateAction> = {}): CorporateAction =>
  ({ externalId: `s${n++}`, accountId: 'A', symbol: 'WX', executedAt: at(d), kind: 'split', ratio: { p, q }, ...o } as CorporateAction);
const counts = (r: MatchResult) => ({ shown: r.trades.length, excluded: r.excluded, corporate: r.excludedCorporate, transfer: r.excludedTransfer ?? 0, held: r.excludedHeld ?? 0 });
const sells = (xs: Activity[]) => xs.filter((a) => a.side === 'SELL').length;
const accounted = (acts: Activity[], actions: CorporateAction[]) => {
  const r = matchTrades(acts, actions);
  assert.equal(r.trades.length + exclusionSum(r), sells(acts), 'every sell is shown or counted exactly once');
  return r;
};

// The audit's p5 probe: WX bought 100 @100 and sold @40 (−60%); YX bought 100 @100 and sold @140 (+40%).
const p5 = () => [
  act('BUY', 100, 100, 0), act('SELL', 100, 40, 9),
  act('BUY', 100, 100, 0, { symbol: 'YX' }), act('SELL', 100, 140, 9, { symbol: 'YX' }),
];

test('p5 probe: a +1 WX transfer in 12 days after the WX close counts the −60% close under "transfer", with no generic corporate count', () => {
  const r = accounted(p5(), [transfer(21, 1)]);
  assert.deepEqual(r.trades.map((t) => t.symbol), ['YX'], 'Part A names the exclusion; Part B / F-22 keep the close published');
  assert.deepEqual(counts(r), { shown: 1, excluded: 0, corporate: 0, transfer: 1, held: 0 });
});

test('RT\'s three forms each count under "transfer": a transfer in, a transfer out with 0 held, a transfer row with no units', () => {
  for (const [name, units] of [['in', 1], ['out with 0 held', -1], ['no units', undefined]] as const) {
    const r = accounted(p5(), [transfer(21, units)]);
    assert.equal(r.excludedTransfer, 1, name);
    assert.equal(r.excludedCorporate, 0, name);
    assert.deepEqual(r.trades.map((t) => t.symbol), ['YX'], name);
  }
  // Business lead (round 1): a transfer out with 0 held also leaves the gap, so a later WX sell is "no recorded entry".
  const later = accounted([...p5(), act('BUY', 10, 100, 30), act('SELL', 10, 90, 40)], [transfer(21, -1)]);
  assert.deepEqual(counts(later), { shown: 1, excluded: 1, corporate: 0, transfer: 1, held: 0 });
});

test('the same-day form: a sell on the day of a transfer row is counted under "transfer"', () => {
  const r = accounted([act('BUY', 100, 100, 0), act('SELL', 50, 40, 30), act('BUY', 10, 90, 31, { symbol: 'YX' })], [transfer(30, 1, { symbol: 'WX' })]);
  assert.deepEqual(counts(r), { shown: 0, excluded: 0, corporate: 0, transfer: 1, held: 0 });
});

test('a forward-tainted draw on transferred-in units is counted under "transfer" (an oversell drawing them too)', () => {
  const draw = accounted([act('SELL', 10, 120, 40)], [transfer(1, 10)]);
  assert.deepEqual(counts(draw), { shown: 0, excluded: 0, corporate: 0, transfer: 1, held: 0 });
  const over = accounted([act('SELL', 15, 120, 40), act('SELL', 5, 120, 50)], [transfer(1, 10)]);
  // The oversell draws the transferred-in lot: "transfer". The later sell falls in the gap it leaves: "no recorded entry".
  assert.deepEqual(counts(over), { shown: 0, excluded: 1, corporate: 0, transfer: 1, held: 0 });
});

test('pinned (probe p4, the forward path): a transfer dated BEFORE the sell no longer removes it (F-22, owner OD 2.28, closed it)', () => {
  // Part A pinned this as still excluded and counted under "transfer". F-22's basis rule closed the path: a transfer in
  // taints no recorded lot, so the −60% close is shown. Reason AND count are asserted.
  const r = accounted([act('BUY', 100, 100, 0), act('SELL', 100, 40, 60)], [transfer(20, 1)]);
  assert.equal(r.trades.length, 1);
  assert.equal(r.trades[0].returnPct, -0.6);
  assert.equal(r.excludedTransfer ?? 0, 0);
  assert.equal(r.excludedCorporate, 0);
});

test('a split and a transfer inside the same window: the sell takes the split\'s reason, whichever comes first', () => {
  for (const [ds, dt] of [[13, 16], [16, 13], [14, 14]]) {
    const r = accounted([act('BUY', 100, 100, 0), act('SELL', 50, 40, 9)], [split(ds, 2, 1), transfer(dt, 1)]);
    assert.deepEqual(counts(r), { shown: 0, excluded: 0, corporate: 1, transfer: 0, held: 0 }, `split day ${ds}, transfer day ${dt}`);
  }
  // Same day: a split on the sell's day wins over a transfer that day too.
  const sameDay = accounted([act('BUY', 100, 100, 0), act('SELL', 50, 40, 9)], [split(9, 2, 1), transfer(9, 1)]);
  assert.deepEqual(counts(sameDay), { shown: 0, excluded: 0, corporate: 1, transfer: 0, held: 0 });
});

test('a lot tainted by both a non-transfer action and a transfer gives its sell the corporate reason, in either order', () => {
  for (const [du, dt] of [[20, 25], [25, 20]]) {
    const r = accounted([act('BUY', 100, 100, 0), act('SELL', 100, 40, 60)], [unknown(du), transfer(dt, 1)]);
    assert.deepEqual(counts(r), { shown: 0, excluded: 0, corporate: 1, transfer: 0, held: 0 }, `unknown day ${du}, transfer day ${dt}`);
  }
});

test('a split inside the window still taints as today: no transfer, corporate 1', () => {
  const r = accounted([act('BUY', 100, 100, 0), act('SELL', 50, 40, 9)], [split(20, 2, 1)]);
  assert.deepEqual(counts(r), { shown: 0, excluded: 0, corporate: 1, transfer: 0, held: 0 });
  assert.equal('excludedTransfer' in r, false, 'present only when nonzero');
});

test('C5-1 end to end, fictional five-close record: win rate 80% → 100% after a one-share transfer; Part A counts it under "transfer"', () => {
  const wins = ['AA', 'BB', 'CC', 'DD'].flatMap((s, i) => [act('BUY', 10, 100, i, { symbol: s }), act('SELL', 10, 110 + i, 10 + i, { symbol: s })]);
  const acts = [...wins, act('BUY', 100, 100, 0), act('SELL', 100, 40, 9)];
  const before = accounted(acts, []);
  assert.equal(headline(before.trades).winRate, 0.8);
  const after = accounted(acts, [transfer(21, 1)]);
  assert.equal(headline(after.trades).winRate, 1, 'still 100% shown (Part B / F-22 fix that)');
  assert.deepEqual(counts(after), { shown: 4, excluded: 0, corporate: 0, transfer: 1, held: 0 }, 'but counted under its own reason, never generic');
});

test('EXCLUDED_KEYS is every excluded* key of MatchResult (F-21\'s shared sum): leaving one out fails here and in tsc', () => {
  // Adding an `excluded*` key to MatchResult without listing it makes this object literal fail the type check.
  const every: Record<Extract<keyof MatchResult, `excluded${string}`>, true> = { excluded: true, excludedCorporate: true, excludedHeld: true, excludedTransfer: true };
  assert.deepEqual([...EXCLUDED_KEYS].sort(), Object.keys(every).sort());
  assert.equal(exclusionSum({ trades: [], excluded: 1, excludedCorporate: 2, excludedHeld: 4, excludedTransfer: 8 }), 15);
  assert.equal(exclusionSum({ trades: [], excluded: 0, excludedCorporate: 0 }), 0);
});

// ---- Fuzz (seeded, in the style of F-24's): transfers in random fictional ledgers ----
// Replay one case: FUZZ_SEED=<n> node --test lib/f32-transfers.test.ts (every failure message starts "seed <n>:").
const prng = (seed: number) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const unflag = (ca: CorporateAction): CorporateAction => { const { transfer: _t, ...rest } = ca as CorporateAction & { transfer?: true }; return rest as CorporateAction; };
const isFlagged = (ca: CorporateAction) => (ca as { transfer?: true }).transfer === true;

function ledger(seed: number) {
  const rnd = prng(seed);
  const pick = <X>(xs: X[]) => xs[Math.floor(rnd() * xs.length)];
  const accounts = ['A', 'B'].slice(0, 1 + Math.floor(rnd() * 2)), symbols = ['WX', 'YX'];
  const rows: Activity[] = [];
  for (let i = 0, k = 4 + Math.floor(rnd() * 12); i < k; i++) {
    rows.push(act(rnd() < 0.55 ? 'BUY' : 'SELL', pick([5, 10, 20]), pick([40, 100, 140]), Math.floor(rnd() * 40), { externalId: `r${seed}-${i}`, accountId: pick(accounts), symbol: pick(symbols), ...(rnd() < 0.08 ? { held: true } : {}) }));
  }
  const actions: CorporateAction[] = [];
  for (let i = 0, k = Math.floor(rnd() * 5); i < k; i++) {
    const d = Math.floor(rnd() * 45), o = { externalId: `c${seed}-${i}`, accountId: pick(accounts), symbol: pick(symbols) };
    const kind = rnd();
    if (kind < 0.45) actions.push(transfer(d, pick([1, -1, 10, -10, undefined]), o));
    else if (kind < 0.6) actions.push(split(d, 2, 1, o));
    else if (kind < 0.67) actions.push({ ...o, executedAt: at(d), kind: 'split', units: 3.3 } as CorporateAction); // unresolvable
    else if (kind < 0.75) actions.push(unknown(d, pick([undefined, 5, -5]), o));
    else if (kind < 0.8) actions.push({ ...o, executedAt: at(d), kind: 'unpriceable', reason: 'spin-off', scope: 'account' } as CorporateAction);
    else if (kind < 0.9) { const out = pick([10, 20]); actions.push({ ...o, symbol: 'WX', executedAt: at(d), kind: 'symbol-change', newSymbol: 'YX', outUnits: out, inUnits: pick([out, 2 * out]) } as CorporateAction); }
    else actions.push({ ...o, executedAt: at(d), kind: 'unpriceable', reason: 'trade', side: pick(['BUY', 'SELL'] as const), ...(rnd() < 0.5 ? { units: 5 } : {}) } as CorporateAction);
  }
  return { rows, actions, rnd, ctx: `seed ${seed}: ${JSON.stringify({ rows: rows.map((r) => [r.externalId, r.accountId, r.symbol, r.side, r.units, r.price, (r.executedAt.getTime() - at(0).getTime()) / DAY, !!r.held]), actions })}` };
}

// A non-transfer repricing action (the matcher's own window list: not an unusable trade row, not a 1:1 rename) whose
// window or day reaches the sell, on its pair or account-wide.
const reachedByNonTransfer = (a: Activity, actions: CorporateAction[]) => actions.some((ca) => {
  if (isFlagged(ca) || (ca.kind === 'unpriceable' && ca.reason === 'trade')) return false;
  if (ca.kind === 'symbol-change' && ca.inUnits === ca.outUnits) return false;
  if (ca.accountId !== a.accountId || (ca.symbol !== a.symbol && !(ca.kind === 'unpriceable' && ca.scope === 'account'))) return false;
  const t = a.executedAt.getTime(), c = ca.executedAt.getTime();
  return (c > t && c - t <= 14 * DAY) || Math.floor(c / DAY) === Math.floor(t / DAY);
});

test('fuzz (2,000 seeded cases): order independence; every sell has exactly one reason and the totals match; a non-transfer action always wins the reason; against the old rule a sell only moves from a corporate count', () => {
  let named = 0, both = 0; // coverage: cases with a transfer count, and with a transfer and a corporate count
  const seeds = process.env.FUZZ_SEED ? [Number(process.env.FUZZ_SEED)] : Array.from({ length: 2000 }, (_, i) => i + 1);
  for (const seed of seeds) {
    const { rows, actions, rnd, ctx } = ledger(seed);
    const reasons = new Map<string, SellReason>();
    const r = matchTrades(rows, actions, { reasons });
    // (a) order independence
    const shuffle = <X>(xs: X[]) => { const s = [...xs]; for (let i = s.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [s[i], s[j]] = [s[j], s[i]]; } return s; };
    const again = new Map<string, SellReason>();
    assert.deepEqual(matchTrades(shuffle(rows), shuffle(actions), { reasons: again }), r, `${ctx} (a)`);
    assert.deepEqual(new Map([...again].sort()), new Map([...reasons].sort()), `${ctx} (a) reasons`);
    // (b) Against the old rule (the transfer flag dropped: every transfer an unpriceable action). Part A only relabelled;
    // F-22 (owner OD 2.28) also publishes sells the old rule counted. Per sell: shown stays shown at the same figure,
    // "no recorded entry" and held keep their reason, and only an old corporate count may become shown, "no recorded
    // entry" (an oversell no longer tainted), corporate or transfer.
    const oldReasons = new Map<string, SellReason>();
    const old = matchTrades(rows, actions.map(unflag), { reasons: oldReasons });
    const fig = new Map(r.trades.map((t) => [t.sellId, t]));
    for (const t of old.trades) assert.deepEqual(fig.get(t.sellId), t, `${ctx} (b) ${t.sellId} shown at the same figure`);
    for (const [id, was] of oldReasons) {
      const now = reasons.get(id);
      if (was === 'excluded' || was === 'held' || was === 'twin' || was === 'shown') assert.equal(now, was, `${ctx} (b) ${id} ${was}`);
      else assert.ok(['shown', 'excluded', 'corporate', 'transfer'].includes(now!), `${ctx} (b) ${id} corporate -> ${now}`);
    }
    assert.equal(old.excludedTransfer, undefined, `${ctx} (b) no transfer flag, no transfer count`);
    // (c) every sell exactly one reason, and the totals are the reasons' counts
    const sellIds = [...rows.filter((a) => a.side === 'SELL').map((a) => a.externalId),
      ...actions.filter((ca) => ca.kind === 'unpriceable' && ca.reason === 'trade' && ca.side === 'SELL').map((ca) => ca.externalId)];
    for (const id of sellIds) assert.ok(reasons.has(id), `${ctx} (c) ${id} has a reason`);
    const tally = (x: SellReason) => [...reasons.values()].filter((v) => v === x).length;
    assert.deepEqual({ shown: tally('shown'), excluded: tally('excluded'), corporate: tally('corporate'), transfer: tally('transfer'), held: tally('held') }, counts(r), `${ctx} (c) totals`);
    if (!rows.some((a) => a.held)) assert.equal(r.trades.length + exclusionSum(r), sellIds.length, `${ctx} (c) partition`);
    // (d) a non-transfer action whose window or day reaches a sell wins its reason
    for (const a of rows) if (reasons.get(a.externalId) === 'transfer') assert.ok(!reachedByNonTransfer(a, actions), `${ctx} (d) ${a.externalId}`);
    // (e) the transfer count is present only when nonzero, and only when a transfer row exists
    if ('excludedTransfer' in r) assert.ok(r.excludedTransfer! > 0 && actions.some(isFlagged), `${ctx} (e)`);
    if (r.excludedTransfer) { named++; if (r.excludedCorporate) both++; }
  }
  if (!process.env.FUZZ_SEED) assert.ok(named >= 200 && both >= 20, `the cases reach the transfer count (${named}) and its meeting with a corporate one (${both})`);
});

test('engineer review: an oversell drawing a transfer-tainted lot inside a split\'s window (or on its day) takes the split\'s reason', () => {
  for (const d of [8, 5]) {
    const r = accounted([act('BUY', 10, 100, 0), act('SELL', 20, 40, 5)], [transfer(1, 5), { externalId: `s${n++}`, accountId: 'A', symbol: 'WX', executedAt: at(d), kind: 'split', units: 3.3 } as CorporateAction]);
    assert.deepEqual(counts(r), { shown: 0, excluded: 0, corporate: 1, transfer: 0, held: 0 }, `split day ${d}`);
  }
});

test('independent review: a transfer in and another action at the same instant: the reason never depends on which vendor id sorts first', () => {
  const run = (xt: string, other: CorporateAction) =>
    counts(accounted([act('BUY', 10, 100, 0), act('SELL', 10, 90, 40), act('SELL', 5, 90, 60)], [transfer(20, 5, { externalId: xt }), other]));
  // An unpriceable action that day taints the lots: it wins the reason in both orders.
  for (const [xt, xa] of [['x1', 'x2'], ['x2', 'x1']]) assert.equal(run(xt, unknown(20, undefined, { externalId: xa })).transfer, 0, `transfer id ${xt}`);
  // A split that day resolves cleanly (it taints nothing); both orders give the same reasons.
  assert.deepEqual(run('x1', split(20, 2, 1, { externalId: 'x2' })), run('x2', split(20, 2, 1, { externalId: 'x1' })));
});
