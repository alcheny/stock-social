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
// contract or an expiry with cash. Fix round 1: events are often date-only (midnight UTC) on a day with trades, carry
// partial units, and often lack currency, OCC ticker or underlying type; a mini and a standard contract can share a strike.
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
    const strike = pick([50, 123.45]);
    const mini = r() < 0.2;
    const type = r() < 0.08 ? pick(['fut', 'idx', null]) : pick(['cs', 'et', 'ad']);
    const root = r() < 0.06 ? `${underlying.replace('.', '')}1` : underlying;
    const occ = `${root.padEnd(6, ' ')}${expiry.slice(2).replace(/-/g, '')}${right[0]}${String(Math.round(strike * 1000)).padStart(8, '0')}`;
    let t = T0 - 20 * DAY + Math.floor(r() * 10) * DAY;
    const n = 1 + Math.floor(r() * 12);
    for (let i = 0; i < n; i++) {
      if (r() > 0.2) t += Math.floor(r() * 4) * 3_600_000; // 20% share the previous row's instant
      const kind = pick(['BUY', 'BUY', 'SELL', 'SELL', 'OPTIONEXPIRATION', 'OPTIONEXERCISE', 'OPTIONASSIGNMENT'] as const);
      const event = kind !== 'BUY' && kind !== 'SELL';
      const explicit = r() < 0.7;
      const oc = kind === 'BUY' ? (explicit ? pick(['BUY_TO_OPEN', 'BUY_TO_OPEN', 'BUY_TO_CLOSE']) : null)
        : kind === 'SELL' ? (explicit ? pick(['SELL_TO_CLOSE', 'SELL_TO_CLOSE', 'SELL_TO_OPEN']) : null) : null;
      const units = 1 + Math.floor(r() * 4);
      const price = event ? 0 : Math.round((0.05 + r() * 12) * 100) / 100;
      const noContract = event && r() < 0.05;
      const cash = kind === 'OPTIONEXPIRATION' && r() < 0.1 ? 37.5 : kind === 'OPTIONEXPIRATION' ? 0 : null;
      // Half the events are date-only: midnight UTC of the current trading day (they order after that day's trades).
      const at = event && r() < 0.5 ? Math.floor(t / DAY) * DAY : t;
      const bare = event && r() < 0.4; // an event row without currency, OCC ticker or underlying type
      rows.push({
        externalId: `r${String(id++).padStart(4, '0')}`, accountId: account, kind, openClose: oc,
        underlying: noContract ? null : underlying, underlyingType: noContract || bare ? null : type, right: noContract ? null : right,
        expiry: noContract ? null : expiry, strikeMilli: noContract ? null : Math.round(strike * 1000), multiplier: noContract ? null : mini ? 10 : 100,
        occTicker: noContract || bare ? null : occ, units: event && r() < 0.4 ? null : units, price,
        fee: opts.fees === false ? 0 : Math.round(r() * 300) / 100, amount: cash, currency: bare ? null : 'USD', executedAt: new Date(at), verified: r() < 0.9,
      });
    }
  }
  return { rows, asOf: new Date(T0 + Math.floor(r() * 90) * DAY) };
}

// ---- Independent reference model (fix round 1, QA 6): a plain signed-position walk, written from the plan's words
// without the matcher's helpers. Each contract is a signed position `pos` (+ long, - short) and a queue holding the
// cost of every long contract one by one. Every row gets one label: 'open' (an opening row, never counted), 'shown',
// or the cause it is counted under.
type Label = 'open' | 'shown' | Cause;
type RefOut = { labels: Map<string, Label>; returns: Map<string, number>; dangling: number };
const ALLOW = new Set(['cs', 'et', 'ad', 'ps', 'cef', 'ut']);
function reference(rows: OptionRow[], asOf: Date): RefOut {
  const labels = new Map<string, Label>(), returns = new Map<string, number>();
  let dangling = 0;
  const byContract = new Map<string, OptionRow[]>();
  for (const x of rows) {
    const keyed = x.accountId && x.underlying && x.expiry && (x.right === 'CALL' || x.right === 'PUT') && x.strikeMilli !== null && x.multiplier && x.executedAt;
    if (!keyed) {
      const event = x.kind === 'OPTIONEXPIRATION' || x.kind === 'OPTIONASSIGNMENT' || x.kind === 'OPTIONEXERCISE';
      labels.set(x.externalId, event ? 'noContract' : x.openClose === 'BUY_TO_OPEN' || x.openClose === 'SELL_TO_OPEN' ? 'open' : 'malformed');
      continue;
    }
    const k = `${x.accountId}/${x.underlying}/${x.expiry}/${x.right}/${x.strikeMilli}/${x.multiplier}`;
    byContract.set(k, [...(byContract.get(k) ?? []), x]);
  }
  for (const list of byContract.values()) {
    // Order: time (a midnight event at the end of its day), then opens, inferred, closes, events; then id.
    const when = (x: OptionRow) => { const t = x.executedAt!.getTime(); const ev = x.kind !== 'BUY' && x.kind !== 'SELL'; return ev && t % DAY === 0 ? t + DAY - 1 : t; };
    const tier = (x: OptionRow) => x.openClose === 'BUY_TO_OPEN' || x.openClose === 'SELL_TO_OPEN' ? 0 : x.kind !== 'BUY' && x.kind !== 'SELL' ? 3 : x.openClose ? 2 : 1;
    list.sort((a, b) => when(a) - when(b) || tier(a) - tier(b) || (a.externalId < b.externalId ? -1 : 1));
    // Contract-level exclusion, from the non-null values only.
    const vals = (f: (x: OptionRow) => string | null) => new Set(list.map(f).filter((v) => v));
    const typeSet = vals((x) => x.underlyingType);
    const rootOk = list.every((x) => { if (!x.occTicker) return true; const m = /^(.*?)\s*\d{6}[CP]\d{8}$/.exec(x.occTicker.trim()); return !!m && m[1].replace(/[^A-Z0-9]/g, '') === x.underlying!.replace(/[^A-Z0-9]/g, ''); });
    const badCash = list.some((x) => {
      if ((x.kind !== 'BUY' && x.kind !== 'SELL') || !x.amount || !x.units || !x.price) return false;
      const per = x.units * x.price, a = Math.abs(x.amount);
      return a >= per / 3 && a <= per * 3 && !(a >= (per * x.multiplier!) / 3 && a <= per * x.multiplier! * 3);
    });
    const bad: Cause | null = vals((x) => x.currency).size > 1 ? 'currency'
      : typeSet.size !== 1 || !ALLOW.has([...typeSet][0]!) ? 'underlying' : !rootOk ? 'adjusted' : badCash ? 'cashScale' : null;
    const m = list[0].multiplier!;
    let pos = 0;
    let costs: { c: number; at: Date }[] = [];
    let dirty = false;
    for (const x of list) {
      const q = Math.abs(x.units ?? 0);
      const fee = Math.abs(x.fee ?? 0);
      const set = (l: Label) => labels.set(x.externalId, l);
      const spoil = (l: Label, after: number) => { set(l); pos = after; costs = []; dirty = pos !== 0; };
      if (dirty) {
        // Unknown basis until flat: buys add, sells subtract, events close toward zero.
        if (x.kind === 'BUY') pos += q; else if (x.kind === 'SELL') pos -= q;
        else { const k = Math.min(q || Math.abs(pos), Math.abs(pos)); pos += pos > 0 ? -k : k; }
        set(x.kind === 'OPTIONASSIGNMENT' ? 'short' : x.openClose === 'BUY_TO_OPEN' || x.openClose === 'SELL_TO_OPEN' ? 'open' : 'contradict');
        if (pos === 0) { dirty = false; costs = []; }
        continue;
      }
      if (x.kind === 'BUY') {
        const opening = x.openClose ? x.openClose === 'BUY_TO_OPEN' : pos >= 0;
        if (x.openClose && x.openClose !== 'BUY_TO_OPEN' && x.openClose !== 'BUY_TO_CLOSE') spoil('contradict', pos + q);
        else if (opening) {
          if (pos < 0) spoil('contradict', pos + q);
          else { for (let i = 0; i < q; i++) costs.push({ c: x.price! * m + fee / q, at: x.executedAt! }); pos += q; set('open'); }
        } else if (pos === 0) set('noOpen');
        else if (pos > 0) spoil('contradict', pos + q);
        else if (q > -pos) spoil('flip', pos + q);
        else { pos += q; set('short'); }
      } else if (x.kind === 'SELL') {
        const opening = x.openClose ? x.openClose === 'SELL_TO_OPEN' : pos <= 0;
        if (x.openClose && x.openClose !== 'SELL_TO_OPEN' && x.openClose !== 'SELL_TO_CLOSE') spoil('contradict', pos - q);
        else if (opening) { if (pos > 0) spoil('contradict', pos - q); else { pos -= q; set('open'); } }
        else if (pos === 0) set('noOpen');
        else if (pos < 0) spoil('contradict', pos - q);
        else if (q > pos) spoil('flip', pos - q);
        else {
          const used = costs.splice(0, q), basis = used.reduce((a, u) => a + u.c, 0);
          pos -= q;
          if (bad) set(bad); else { set('shown'); returns.set(x.externalId, (q * x.price! * m - fee - basis) / basis); }
        }
      } else if (x.kind === 'OPTIONEXPIRATION') {
        if (pos > 0) {
          const k = Math.min(q || pos, pos);
          const used = costs.splice(0, k), basis = used.reduce((a, u) => a + u.c, 0);
          pos -= k;
          if (x.amount) set('expiryCash'); else if (bad) set(bad); else { set('shown'); returns.set(x.externalId, (-fee - basis) / basis); }
        } else if (pos < 0) { pos += Math.min(q || -pos, -pos); set('short'); } else set('noOpen');
      } else if (x.kind === 'OPTIONEXERCISE') {
        if (pos > 0) { const k = Math.min(q || pos, pos); costs.splice(0, k); pos -= k; set('exercise'); }
        else if (pos < 0) spoil('contradict', pos); else set('noOpen');
      } else {
        if (pos > 0) spoil('contradict', pos);
        else { set('short'); if (pos < 0) pos += Math.min(q || -pos, -pos); }
      }
    }
    if (!dirty && pos > 0 && Math.floor((asOf.getTime() - Date.parse(`${list[0].expiry}T00:00:00Z`)) / DAY) > 5) dangling++;
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
  for (const c of ['shown', 'short', 'exercise', 'expiryCash', 'noContract', 'contradict', 'flip', 'noOpen', 'dangling', 'adjusted', 'underlying']) assert.ok(seen[c] > 0, `${c}: ${seen[c]}`);
});

test('AC2 (property): no shown trade comes from a short lot; every short close, short assignment and short expiry is in the short count; an assignment of a long lot is not', () => {
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
    // Every assignment the reference finds on a short or flat ledger is in the short count; one on a long lot is not.
    for (const r of rows) if (r.kind === 'OPTIONASSIGNMENT' && contractKey(r) !== null) assert.ok(['short', 'contradict'].includes(ref.labels.get(r.externalId)!), `seed ${s}`);
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
  // Fix round 1 (QA 5): mini and standard contracts on one strike are two ledgers (the sell closes nothing), and a
  // currency mismatch within one contract.
  assert.deepEqual(only([row('1', 'BUY', 'BUY_TO_OPEN'), row('2', 'SELL', 'SELL_TO_CLOSE', { multiplier: 10 })]), { shown: 0, noOpen: 1 });
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

// ---- Fix round 1 (docs/features/logs/options/review-round1.md, qa-round1.md).
test('fix round 1 A (review 1): a date-only expiry orders after the same day\'s trades and closes min(units, net): buy 2 at 1.00, sell 1 at 3.00, 1 expires → +200% and -100%', () => {
  const at = (iso: string) => new Date(iso);
  const rows = [
    row('1', 'BUY', 'BUY_TO_OPEN', { units: 2, price: 1, executedAt: at('2026-12-10T15:00:00Z') }),
    row('2', 'SELL', 'SELL_TO_CLOSE', { units: 1, price: 3, executedAt: at('2026-12-19T15:00:00Z') }),
    row('3', 'OPTIONEXPIRATION', null, { units: 1, price: 0, amount: 0, executedAt: at('2026-12-19T00:00:00Z') }), // date-only
  ];
  const m = matchOptions(rows, new Date('2026-12-30'));
  assert.deepEqual(m.trades.map((t) => [t.closeId, t.returnPct]), [['2', 2], ['3', -1]]);
  // At one instant, an event comes after a sell too.
  const same = matchOptions([rows[0], { ...rows[1], executedAt: at('2026-12-19T15:00:00Z') }, { ...rows[2], executedAt: at('2026-12-19T15:00:00Z') }], new Date('2026-12-30'));
  assert.deepEqual(same.trades.map((t) => t.returnPct), [2, -1]);
  // An expiry with no units closes what is left.
  assert.deepEqual(matchOptions([rows[0], rows[1], { ...rows[2], units: null }], new Date('2026-12-30')).trades.map((t) => t.returnPct), [2, -1]);
});

test('fix round 1 H (QA 4): a missing currency, OCC ticker or underlying type on an event row is no mismatch; an expiry with no currency shows -100%', () => {
  const ev = row('2', 'OPTIONEXPIRATION', null, { price: 0, amount: 0, currency: null, occTicker: null, underlyingType: null });
  assert.deepEqual(only([row('1', 'BUY', 'BUY_TO_OPEN'), ev]), { shown: 1 });
  assert.equal(matchOptions([row('1', 'BUY', 'BUY_TO_OPEN'), ev], new Date('2026-12-30')).trades[0].returnPct, -1);
  // Conflicting non-null values still count.
  assert.deepEqual(only([row('1', 'BUY', 'BUY_TO_OPEN'), { ...ev, currency: 'CAD' }]), { shown: 0, currency: 1 });
  assert.deepEqual(only([row('1', 'BUY', 'BUY_TO_OPEN'), { ...ev, underlyingType: 'et' }]), { shown: 0, underlying: 1 });
});

test('fix round 1 I (QA 5): a mini root with a trailing digit stays counted as adjusted (never guessed)', () => {
  const mini = { multiplier: 10, occTicker: 'XYZ7  261219P00123450' };
  assert.deepEqual(only([row('1', 'BUY', 'BUY_TO_OPEN', mini), row('2', 'SELL', 'SELL_TO_CLOSE', mini)]), { shown: 0, adjusted: 1 });
});

test('fix round 1 J (QA 6): an assignment of a long lot is other (contradict), not short; a short close after a taint stays counted as contradict until flat', () => {
  assert.deepEqual(only([row('1', 'BUY', 'BUY_TO_OPEN'), row('2', 'OPTIONASSIGNMENT', null)]), { shown: 0, contradict: 1 });
  // A contradicting buy-to-open while short taints the contract (net 0 → flat? no: short 2, buy 1 → -1, tainted); the
  // buy-to-close that brings it flat is counted as contradict, not short (its lot's history is unknown).
  assert.deepEqual(only([row('1', 'SELL', 'SELL_TO_OPEN', { units: 2 }), row('2', 'BUY', 'BUY_TO_OPEN'), row('3', 'BUY', 'BUY_TO_CLOSE')]), { shown: 0, contradict: 2 });
  // Flat again: the next short close is short.
  assert.deepEqual(only([row('1', 'SELL', 'SELL_TO_OPEN', { units: 2 }), row('2', 'BUY', 'BUY_TO_OPEN'), row('3', 'BUY', 'BUY_TO_CLOSE'), row('4', 'SELL', 'SELL_TO_OPEN'), row('5', 'BUY', 'BUY_TO_CLOSE')]), { shown: 0, contradict: 2, short: 1 });
});
