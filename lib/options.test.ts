// OPTIONS acceptance criteria 1–7 (docs/features/logs/options/plan.md): the pure matcher against an independent
// reference model on seeded random ledgers (≥ 1,000 per property), one hand case per D4 rule, hand-computed returns and
// the options summary.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CAUSES, cashScaleFails, contractKey, matchOptions, optionSummary, parseOcc, strikeMilli, validExpiry, type Cause, type OptionRow } from './options.ts';

// ---- Seeded PRNG (mulberry32), inline so a failing seed reproduces.
const prng = (seed: number) => { let t = seed >>> 0; return () => { t = (t + 0x6d2b79f5) >>> 0; let x = Math.imul(t ^ (t >>> 15), 1 | t); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; };
const RUNS = 1000;
const DAY = 86_400_000;
const T0 = Date.UTC(2026, 0, 5, 15);

type Gen = { rows: OptionRow[]; asOf: Date };
// A random ledger: 1–2 accounts, 1–4 contracts, up to 12 rows each, ties at the same instant, every row kind, missing
// open/close types, contradictions and flips, now and then an excluded underlying, an adjusted root, an event with no
// contract or an expiry with cash.
function ledger(seed: number, opts: { fees?: boolean } = {}): Gen {
  const r = prng(seed);
  const pick = <T>(xs: readonly T[]) => xs[Math.floor(r() * xs.length)];
  const rows: OptionRow[] = [];
  const nContracts = 1 + Math.floor(r() * 4);
  let id = 0;
  for (let c = 0; c < nContracts; c++) {
    const account = pick(['acc-a', 'acc-b']);
    const underlying = pick(['XYZ', 'QRS', 'B.C']);
    const right = pick(['CALL', 'PUT'] as const);
    const expiryMs = T0 + Math.floor(r() * 60) * DAY;
    const expiry = new Date(expiryMs).toISOString().slice(0, 10);
    const strike = pick([50, 123.45, 7.5]);
    const mini = r() < 0.15;
    const type = r() < 0.08 ? pick(['fut', 'idx', null]) : pick(['cs', 'et', 'ad']);
    const root = r() < 0.06 ? `${underlying.replace('.', '')}1` : underlying;
    const occ = `${root.padEnd(6, ' ')}${expiry.slice(2).replace(/-/g, '')}${right[0]}${String(Math.round(strike * 1000)).padStart(8, '0')}`;
    let t = T0 - 20 * DAY + Math.floor(r() * 10) * DAY;
    const n = 1 + Math.floor(r() * 12);
    for (let i = 0; i < n; i++) {
      if (r() > 0.2) t += Math.floor(r() * 4) * 3_600_000; // 20% share the previous row's instant
      const kind = pick(['BUY', 'BUY', 'SELL', 'SELL', 'OPTIONEXPIRATION', 'OPTIONEXERCISE', 'OPTIONASSIGNMENT'] as const);
      const explicit = r() < 0.7;
      const oc = kind === 'BUY' ? (explicit ? pick(['BUY_TO_OPEN', 'BUY_TO_OPEN', 'BUY_TO_CLOSE']) : null)
        : kind === 'SELL' ? (explicit ? pick(['SELL_TO_CLOSE', 'SELL_TO_CLOSE', 'SELL_TO_OPEN']) : null) : null;
      const units = 1 + Math.floor(r() * 4);
      const price = kind === 'BUY' || kind === 'SELL' ? Math.round((0.05 + r() * 12) * 100) / 100 : 0;
      const noContract = (kind === 'OPTIONEXPIRATION' || kind === 'OPTIONASSIGNMENT' || kind === 'OPTIONEXERCISE') && r() < 0.05;
      const cash = kind === 'OPTIONEXPIRATION' && r() < 0.1 ? 37.5 : kind === 'OPTIONEXPIRATION' ? 0 : null;
      rows.push({
        externalId: `r${String(id++).padStart(4, '0')}`, accountId: account, kind, openClose: oc,
        underlying: noContract ? null : underlying, underlyingType: noContract ? null : type, right: noContract ? null : right,
        expiry: noContract ? null : expiry, strikeMilli: noContract ? null : Math.round(strike * 1000), multiplier: noContract ? null : mini ? 10 : 100,
        occTicker: noContract ? null : occ, units: kind === 'OPTIONEXPIRATION' && r() < 0.5 ? null : units, price,
        fee: opts.fees === false ? 0 : Math.round(r() * 300) / 100, amount: cash, currency: 'USD', executedAt: new Date(t), verified: r() < 0.9,
      });
    }
  }
  return { rows, asOf: new Date(T0 + Math.floor(r() * 90) * DAY) };
}

// ---- Independent reference model: a written-out reading of D2–D4 in a different shape (each contract is a list of
// single contracts, each with its own cost; every row gets a label).
type Label = 'open' | 'shown' | Cause;
type RefOut = { labels: Map<string, Label>; returns: Map<string, number>; dangling: number };
function reference(rows: OptionRow[], asOf: Date): RefOut {
  const labels = new Map<string, Label>(), returns = new Map<string, number>();
  let dangling = 0;
  const contracts: Record<string, OptionRow[]> = {};
  for (const x of rows) {
    const complete = x.accountId && x.underlying && x.expiry && (x.right === 'CALL' || x.right === 'PUT') && x.strikeMilli !== null && x.multiplier && x.executedAt;
    if (!complete) {
      const event = x.kind === 'OPTIONEXPIRATION' || x.kind === 'OPTIONASSIGNMENT' || x.kind === 'OPTIONEXERCISE';
      labels.set(x.externalId, event ? 'noContract' : x.openClose === 'BUY_TO_OPEN' || x.openClose === 'SELL_TO_OPEN' ? 'open' : 'malformed');
      continue;
    }
    (contracts[JSON.stringify([x.accountId, x.underlying, x.expiry, x.right, x.strikeMilli])] ??= []).push(x);
  }
  const order = (x: OptionRow) => (x.openClose === 'BUY_TO_OPEN' || x.openClose === 'SELL_TO_OPEN' ? 0 : !x.openClose && (x.kind === 'BUY' || x.kind === 'SELL') ? 1 : 2);
  for (const list of Object.values(contracts)) {
    list.sort((a, b) => a.executedAt!.getTime() - b.executedAt!.getTime() || order(a) - order(b) || a.externalId.localeCompare(b.externalId));
    const mults = new Set(list.map((x) => x.multiplier)), curs = new Set(list.map((x) => x.currency ?? ''));
    const types = new Set(list.map((x) => x.underlyingType));
    const bad: Cause | null = mults.size > 1 ? 'multiplier' : curs.size > 1 ? 'currency'
      : types.size > 1 || !['cs', 'et', 'ad', 'ps', 'cef', 'ut'].includes(list[0].underlyingType ?? '') ? 'underlying'
      : list.some((x) => { const o = parseOcc(x.occTicker); return !o || o.root.replace(/\W/g, '') !== x.underlying!.replace(/\W/g, ''); }) ? 'adjusted'
      : list.some((x) => cashScaleFails(x)) ? 'cashScale' : null;
    const m = list[0].multiplier!;
    let held: { cost: number; at: Date; v: boolean }[] = []; // one entry per long contract
    let shorts = 0; // short contracts
    let dirty = 0; // net while tainted (0 = clean)
    const fee = (x: OptionRow) => Math.abs(x.fee ?? 0);
    const sell = (x: OptionRow, k: number, price: number) => {
      const used = held.splice(0, k);
      const basis = used.reduce((a, u) => a + u.cost, 0);
      if (bad) { labels.set(x.externalId, bad); return; }
      labels.set(x.externalId, 'shown');
      returns.set(x.externalId, (k * price * m - fee(x) - basis) / basis);
    };
    const toDirty = (x: OptionRow, cause: Cause, signed: number) => {
      labels.set(x.externalId, cause);
      dirty = held.length - shorts + signed;
      held = []; shorts = 0;
    };
    for (const x of list) {
      const k = Math.abs(x.units ?? 0);
      if (dirty !== 0) {
        const s = x.kind === 'BUY' ? k : x.kind === 'SELL' ? -k : dirty > 0 ? -Math.min(k || dirty, dirty) : Math.min(k || -dirty, -dirty);
        labels.set(x.externalId, x.kind === 'OPTIONASSIGNMENT' ? 'short' : x.openClose === 'BUY_TO_OPEN' || x.openClose === 'SELL_TO_OPEN' ? 'open' : 'contradict');
        dirty += s;
        continue;
      }
      const net = held.length - shorts;
      if (x.kind === 'BUY') {
        const oc = x.openClose ?? (shorts > 0 ? 'BUY_TO_CLOSE' : 'BUY_TO_OPEN');
        if (oc === 'BUY_TO_OPEN') {
          if (shorts > 0) { toDirty(x, 'contradict', k); continue; }
          for (let i = 0; i < k; i++) held.push({ cost: x.price! * m + fee(x) / k, at: x.executedAt!, v: x.verified });
          labels.set(x.externalId, 'open');
        } else if (net === 0) labels.set(x.externalId, 'noOpen');
        else if (held.length) toDirty(x, 'contradict', k);
        else if (k > shorts) toDirty(x, 'flip', k);
        else { shorts -= k; labels.set(x.externalId, 'short'); }
      } else if (x.kind === 'SELL') {
        const oc = x.openClose ?? (held.length > 0 ? 'SELL_TO_CLOSE' : 'SELL_TO_OPEN');
        if (oc === 'SELL_TO_OPEN') {
          if (held.length) { toDirty(x, 'contradict', -k); continue; }
          shorts += k; labels.set(x.externalId, 'open');
        } else if (net === 0) labels.set(x.externalId, 'noOpen');
        else if (shorts) toDirty(x, 'contradict', -k);
        else if (k > held.length) toDirty(x, 'flip', -k);
        else sell(x, k, x.price!);
      } else if (x.kind === 'OPTIONEXPIRATION') {
        if (held.length) { if (x.amount) { labels.set(x.externalId, 'expiryCash'); held = []; } else sell(x, held.length, 0); }
        else if (shorts) { labels.set(x.externalId, 'short'); shorts = 0; }
        else labels.set(x.externalId, 'noOpen');
      } else if (x.kind === 'OPTIONEXERCISE') {
        if (held.length) { labels.set(x.externalId, 'exercise'); held.splice(0, Math.min(k || held.length, held.length)); }
        else if (shorts) { labels.set(x.externalId, 'contradict'); dirty = -shorts; shorts = 0; }
        else labels.set(x.externalId, 'noOpen');
      } else {
        labels.set(x.externalId, 'short');
        if (shorts) shorts -= Math.min(k || shorts, shorts);
        else if (held.length) { dirty = held.length; held = []; }
      }
    }
    if (dirty === 0 && held.length && Math.floor((asOf.getTime() - Date.parse(`${list[0].expiry}T00:00:00Z`)) / DAY) > 5) dangling++;
  }
  return { labels, returns, dangling };
}

const sumCounts = (c: Record<string, number>) => Object.values(c).reduce((a, b) => a + b, 0);

test('AC1 (property, 1,000 ledgers): shown + every per-cause count = closing rows + dangling contracts; each close shown or counted exactly once, as the reference model says', () => {
  const seen: Record<string, number> = { shown: 0 };
  for (let s = 1; s <= RUNS; s++) {
    const { rows, asOf } = ledger(s);
    const got = matchOptions(rows, asOf);
    seen.shown += got.trades.length;
    for (const [c, n] of Object.entries(got.counts)) seen[c] = (seen[c] ?? 0) + n;
    const ref = reference(rows, asOf);
    const closing = [...ref.labels.values()].filter((l) => l !== 'open').length;
    assert.equal(got.trades.length + sumCounts(got.counts), closing + ref.dangling, `seed ${s}`);
    const shown = [...ref.labels].filter(([, l]) => l === 'shown').map(([id]) => id).sort();
    assert.deepEqual(got.trades.map((t) => t.closeId).sort(), shown, `seed ${s}`);
    assert.equal(new Set(got.trades.map((t) => t.closeId)).size, got.trades.length, `seed ${s}: a close shown twice`);
    for (const c of CAUSES) {
      const want = [...ref.labels.values()].filter((l) => l === c).length + (c === 'dangling' ? ref.dangling : 0);
      assert.equal(got.counts[c], want, `seed ${s} cause ${c}`);
    }
    assert.equal(got.short, got.counts.short);
    assert.equal(got.short + got.other, sumCounts(got.counts));
  }
  // The generator reaches every rule the random ledgers can express (not a vacuous property).
  for (const c of ['shown', 'short', 'exercise', 'expiryCash', 'noContract', 'contradict', 'flip', 'noOpen', 'dangling', 'adjusted', 'multiplier', 'underlying']) assert.ok(seen[c] > 0, `${c}: ${seen[c]}`);
});

test('AC2 (property): no shown trade comes from a short lot; every short close, assignment and short expiry is in the short count', () => {
  for (let s = 1; s <= RUNS; s++) {
    const { rows, asOf } = ledger(s + 10_000);
    const got = matchOptions(rows, asOf);
    const ref = reference(rows, asOf);
    const byId = new Map(rows.map((r) => [r.externalId, r]));
    for (const t of got.trades) {
      const r = byId.get(t.closeId)!;
      assert.ok(r.kind === 'SELL' || r.kind === 'OPTIONEXPIRATION', `seed ${s}: shown ${r.kind}`);
      assert.notEqual(r.openClose, 'BUY_TO_CLOSE');
    }
    assert.equal(got.short, [...ref.labels.values()].filter((l) => l === 'short').length, `seed ${s}`);
    // Every assignment is short, wherever it falls.
    const assignments = rows.filter((r) => r.kind === 'OPTIONASSIGNMENT' && contractKey(r) !== null).length;
    assert.ok(got.short >= assignments, `seed ${s}`);
  }
});

test('AC3 (property): the long return before fees is ≥ -100%; the net return equals the reference; a no-fee worthless expiry is exactly -100%', () => {
  for (let s = 1; s <= RUNS; s++) {
    const noFee = ledger(s + 20_000, { fees: false });
    for (const t of matchOptions(noFee.rows, noFee.asOf).trades) assert.ok(t.returnPct >= -1 - 1e-12, `seed ${s}: ${t.returnPct}`);
    const { rows, asOf } = ledger(s + 30_000);
    const ref = reference(rows, asOf);
    for (const t of matchOptions(rows, asOf).trades) assert.ok(Math.abs(t.returnPct - ref.returns.get(t.closeId)!) < 1e-9, `seed ${s}`);
  }
  const base: OptionRow = { externalId: 'o', accountId: 'a', kind: 'BUY', openClose: 'BUY_TO_OPEN', underlying: 'XYZ', underlyingType: 'cs', right: 'CALL',
    expiry: '2026-12-19', strikeMilli: 50_000, multiplier: 100, occTicker: 'XYZ   261219C00050000', units: 2, price: 1.5, fee: 0, amount: null, currency: 'USD', executedAt: new Date('2026-11-02T15:00:00Z'), verified: true };
  const m = matchOptions([base, { ...base, externalId: 'x', kind: 'OPTIONEXPIRATION', openClose: null, units: null, price: 0, amount: 0, executedAt: new Date('2026-12-19T21:00:00Z') }], new Date('2027-01-10'));
  assert.equal(m.trades.length, 1);
  assert.equal(m.trades[0].returnPct, -1);
});

test('AC4 (property): scaling units and fees together by k > 0 leaves returns unchanged; shuffled input gives the same output', () => {
  for (let s = 1; s <= RUNS; s++) {
    const { rows, asOf } = ledger(s + 40_000);
    const a = matchOptions(rows, asOf);
    const k = [2, 3, 7, 0.5][s % 4];
    const scaled = matchOptions(rows.map((r) => ({ ...r, units: r.units === null ? null : r.units * k, fee: r.fee === null ? null : r.fee * k, amount: r.amount === null ? null : r.amount * k })), asOf);
    assert.equal(scaled.trades.length, a.trades.length, `seed ${s}`);
    const byId = new Map(scaled.trades.map((t) => [t.closeId, t.returnPct]));
    for (const t of a.trades) assert.ok(Math.abs(byId.get(t.closeId)! - t.returnPct) < 1e-9, `seed ${s}`);
    assert.deepEqual(scaled.counts, a.counts, `seed ${s}`);
    const r = prng(s);
    const shuffled = [...rows].sort(() => r() - 0.5);
    const b = matchOptions(shuffled, asOf);
    const key = (x: typeof a) => JSON.stringify({ t: [...x.trades].sort((p, q) => p.closeId.localeCompare(q.closeId)), c: x.counts });
    assert.equal(key(b), key(a), `seed ${s}`);
  }
  // Ties at one instant: the open goes first, then by id (a close stored first would otherwise find nothing).
  const at = new Date('2026-11-02T15:00:00Z');
  const open = { ...row('z-open', 'BUY', 'BUY_TO_OPEN'), executedAt: at };
  const close = { ...row('a-close', 'SELL', 'SELL_TO_CLOSE'), executedAt: at, price: 2 };
  assert.equal(matchOptions([close, open], new Date('2026-11-03')).trades.length, 1);
});

// ---- AC5: one hand case per D4 rule.
function row(id: string, kind: string, oc: string | null, extra: Partial<OptionRow> = {}): OptionRow {
  return { externalId: id, accountId: 'acc', kind, openClose: oc, underlying: 'XYZ', underlyingType: 'cs', right: 'PUT', expiry: '2026-12-19',
    strikeMilli: 123_450, multiplier: 100, occTicker: 'XYZ   261219P00123450', units: 1, price: 1, fee: 0, amount: null, currency: 'USD',
    executedAt: new Date(`2026-11-${String(10 + Number(id.replace(/\D/g, '') || 0)).padStart(2, '0')}T15:00:00Z`), verified: true, ...extra };
}
const only = (rows: OptionRow[], asOf = new Date('2026-11-30')) => { const m = matchOptions(rows, asOf); return { shown: m.trades.length, ...Object.fromEntries(Object.entries(m.counts).filter(([, n]) => n)) }; };

test('AC5: one hand case per D4 rule', () => {
  // Short: a short close, an assignment and the expiry of a short lot.
  assert.deepEqual(only([row('1', 'SELL', 'SELL_TO_OPEN'), row('2', 'BUY', 'BUY_TO_CLOSE')]), { shown: 0, short: 1 });
  assert.deepEqual(only([row('1', 'SELL', 'SELL_TO_OPEN'), row('2', 'OPTIONASSIGNMENT', null)]), { shown: 0, short: 1 });
  assert.deepEqual(only([row('1', 'SELL', 'SELL_TO_OPEN'), row('2', 'OPTIONEXPIRATION', null, { price: 0, amount: 0 })]), { shown: 0, short: 1 });
  // Exercise; an expiry with cash; an event row with no option_symbol.
  assert.deepEqual(only([row('1', 'BUY', 'BUY_TO_OPEN'), row('2', 'OPTIONEXERCISE', null)]), { shown: 0, exercise: 1 });
  assert.deepEqual(only([row('1', 'BUY', 'BUY_TO_OPEN'), row('2', 'OPTIONEXPIRATION', null, { amount: 250 })]), { shown: 0, expiryCash: 1 });
  assert.deepEqual(only([row('1', 'OPTIONEXPIRATION', null, { underlying: null, right: null, expiry: null, strikeMilli: null, multiplier: null, occTicker: null })]), { shown: 0, noContract: 1 });
  // Contradicting type (a buy to open while short), a flip, a close with no open.
  assert.deepEqual(only([row('1', 'SELL', 'SELL_TO_OPEN'), row('2', 'BUY', 'BUY_TO_OPEN'), row('3', 'SELL', 'SELL_TO_CLOSE')]), { shown: 0, contradict: 1, noOpen: 1 });
  assert.deepEqual(only([row('1', 'BUY', 'BUY_TO_OPEN'), row('2', 'SELL', 'SELL_TO_CLOSE', { units: 3 }), row('3', 'BUY', 'BUY_TO_CLOSE', { units: 2 })]), { shown: 0, flip: 1, contradict: 1 });
  assert.deepEqual(only([row('1', 'SELL', 'SELL_TO_CLOSE')]), { shown: 0, noOpen: 1 });
  // The missing-type inference: a sell with no type closes a long, a buy with no type closes a short.
  assert.deepEqual(only([row('1', 'BUY', null), row('2', 'SELL', null, { price: 2 })]), { shown: 1 });
  assert.deepEqual(only([row('1', 'SELL', null), row('2', 'BUY', null)]), { shown: 0, short: 1 });
  // A dangling contract: counted at expiry + 6 days, not at + 5 (injected asOf).
  assert.deepEqual(only([row('1', 'BUY', 'BUY_TO_OPEN')], new Date('2026-12-24T12:00:00Z')), { shown: 0 });
  assert.deepEqual(only([row('1', 'BUY', 'BUY_TO_OPEN')], new Date('2026-12-25T12:00:00Z')), { shown: 0, dangling: 1 });
  // Punctuation in the OCC root matches the underlying; a changed root is an adjusted contract.
  assert.deepEqual(only([row('1', 'BUY', 'BUY_TO_OPEN', { underlying: 'B.C', occTicker: 'BC    261219P00123450' }), row('2', 'SELL', 'SELL_TO_CLOSE', { underlying: 'B.C', occTicker: 'BC    261219P00123450' })]), { shown: 1 });
  assert.deepEqual(only([row('1', 'BUY', 'BUY_TO_OPEN', { occTicker: 'XYZ1  261219P00123450' }), row('2', 'SELL', 'SELL_TO_CLOSE', { occTicker: 'XYZ1  261219P00123450' })]), { shown: 0, adjusted: 1 });
  // Multiplier and currency mismatches within one contract.
  assert.deepEqual(only([row('1', 'BUY', 'BUY_TO_OPEN'), row('2', 'SELL', 'SELL_TO_CLOSE', { multiplier: 10 })]), { shown: 0, multiplier: 1 });
  assert.deepEqual(only([row('1', 'BUY', 'BUY_TO_OPEN'), row('2', 'SELL', 'SELL_TO_CLOSE', { currency: 'CAD' })]), { shown: 0, currency: 1 });
  // Underlying types outside the allowlist, missing or unknown included.
  for (const t of ['fut', null, 'zz']) assert.deepEqual(only([row('1', 'BUY', 'BUY_TO_OPEN', { underlyingType: t }), row('2', 'SELL', 'SELL_TO_CLOSE', { underlyingType: t })]), { shown: 0, underlying: 1 });
  // A malformed row (no price on a sell).
  assert.deepEqual(only([row('1', 'BUY', 'BUY_TO_OPEN'), row('2', 'SELL', 'SELL_TO_CLOSE', { price: null })]), { shown: 0, malformed: 1 });
  assert.deepEqual(only([row('1', 'SELL', 'SELL_TO_CLOSE', { executedAt: null })]), { shown: 0, malformed: 1 });
  // The factor-3 cash check: 1 contract at 2.00 with $2 of cash is per-contract pricing (counted); $200 is per share.
  assert.equal(cashScaleFails({ amount: -2, units: 1, price: 2, multiplier: 100 }), true);
  assert.equal(cashScaleFails({ amount: -200, units: 1, price: 2, multiplier: 100 }), false);
  assert.deepEqual(only([row('1', 'BUY', 'BUY_TO_OPEN', { price: 2, amount: -2 }), row('2', 'SELL', 'SELL_TO_CLOSE', { price: 3, amount: 3 })]), { shown: 0, cashScale: 1 });
  assert.deepEqual(only([row('1', 'BUY', 'BUY_TO_OPEN', { price: 2, amount: -200 }), row('2', 'SELL', 'SELL_TO_CLOSE', { price: 3, amount: 300 })]), { shown: 1 });
  // Opening rows never count, even malformed ones.
  assert.deepEqual(only([row('1', 'BUY', 'BUY_TO_OPEN', { executedAt: null })]), { shown: 0 });
});

test('AC6: a long return hand-computed with fees at ×100 and at ×10; the strike in integer thousandths; the expiry validated', () => {
  // ×100: 2 contracts at 1.50 + $1.30 fee = 301.30; sold at 2.10 less $1.30 = 418.70; (418.70 - 301.30) / 301.30.
  const m = matchOptions([row('1', 'BUY', 'BUY_TO_OPEN', { units: 2, price: 1.5, fee: 1.3 }), row('2', 'SELL', 'SELL_TO_CLOSE', { units: 2, price: 2.1, fee: 1.3 })], new Date('2026-11-30'));
  assert.ok(Math.abs(m.trades[0].returnPct - (418.7 - 301.3) / 301.3) < 1e-12);
  // ×10 (mini): 2 × 1.50 × 10 + 1.30 = 31.30; 2 × 2.10 × 10 - 1.30 = 40.70.
  const mini = matchOptions([row('1', 'BUY', 'BUY_TO_OPEN', { units: 2, price: 1.5, fee: 1.3, multiplier: 10 }), row('2', 'SELL', 'SELL_TO_CLOSE', { units: 2, price: 2.1, fee: 1.3, multiplier: 10 })], new Date('2026-11-30'));
  assert.ok(Math.abs(mini.trades[0].returnPct - (40.7 - 31.3) / 31.3) < 1e-12);
  // Fees can take a worthless long below -100% (no floor is promised).
  const low = matchOptions([row('1', 'BUY', 'BUY_TO_OPEN', { fee: 1 }), row('2', 'OPTIONEXPIRATION', null, { fee: 1, amount: 0 })], new Date('2026-11-30'));
  assert.ok(low.trades[0].returnPct < -1);
  assert.equal(strikeMilli(123.45), 123_450);
  assert.equal(strikeMilli('7.5'), 7_500);
  assert.equal(strikeMilli(0.1 + 0.2), 300);
  assert.equal(strikeMilli(0), null);
  assert.equal(strikeMilli('x'), null);
  assert.equal(validExpiry('2026-12-19T00:00:00Z'), '2026-12-19');
  assert.equal(validExpiry('2026-02-30'), null);
  assert.equal(validExpiry('19/12/2026'), null);
  assert.equal(validExpiry(null), null);
  assert.deepEqual(parseOcc('XYZ   261219P00123450'), { root: 'XYZ', right: 'PUT', strikeMilli: 123_450 });
  assert.equal(parseOcc('XYZ'), null);
});

test('AC7: optionSummary gives the hand-computed example, no range under 5 bets, no division by zero with zero spread, no verdict words', () => {
  const d = (n: number) => new Date(Date.UTC(2026, 0, 1 + n));
  // Five independent bets (different underlyings): returns -0.5, 0.2, -0.1, 0.3, -1.0. avg = -0.22; wins 2/5.
  const rs = [-0.5, 0.2, -0.1, 0.3, -1.0];
  const five = rs.map((r, i) => ({ underlying: `U${i}`, openedAt: d(i), closedAt: d(i + 1), returnPct: r }));
  const s = optionSummary(five)!;
  assert.equal(s.n, 5);
  assert.equal(s.winRate, 0.4);
  assert.ok(Math.abs(s.avg - -0.22) < 1e-12);
  // se = sqrt(5/4 · Σ(r - avg)²) / 5; t(4) = 2.776.
  const se = Math.sqrt((5 / 4) * rs.reduce((a, r) => a + (r + 0.22) ** 2, 0)) / 5;
  assert.ok(Math.abs(s.range!.low - (-0.22 - 2.776 * se)) < 1e-3);
  assert.ok(Math.abs(s.range!.high - (-0.22 + 2.776 * se)) < 1e-3);
  // Four bets (two overlapping holds on one underlying are one bet): no range.
  const four = [...five.slice(0, 4), { underlying: 'U0', openedAt: d(0), closedAt: d(2), returnPct: 0.1 }];
  assert.equal(optionSummary(four)!.range, null);
  // Zero spread: a finite, zero-width range.
  const flat = optionSummary(rs.map((_, i) => ({ underlying: `U${i}`, openedAt: d(i), closedAt: d(i + 1), returnPct: -1 })))!;
  assert.deepEqual(flat.range, { low: -1, high: -1 });
  assert.equal(optionSummary([]), null);
  const src = readFileSync(new URL('./options.ts', import.meta.url), 'utf8').replace(/\/\/[^\n]*/g, '');
  assert.doesNotMatch(src, /'[^']*\b(edge|skill|signal|beat|above zero|below zero|winner)\b[^']*'/i);
});
