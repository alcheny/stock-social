// OPTIONS acceptance criteria 1–7 (docs/features/logs/options/plan.md): the pure matcher against an independent
// reference model on seeded random ledgers (≥ 1,000 per property), one hand case per D4 rule, hand-computed returns and
// the options summary.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CAUSES, cashScaleFails, contractKey, matchOptions, optionSummary, parseOcc, strikeMilli, unorderedDays, validExpiry, type Cause, type OptionRow } from './options.ts';

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
    // F4-2 (cycle 4): an expiry at the end of its contract's expiry day, or at its stamp if that is later.
    const when = (x: OptionRow) => {
      const t = x.executedAt!.getTime(); const ev = x.kind !== 'BUY' && x.kind !== 'SELL';
      if (x.kind === 'OPTIONEXPIRATION') return Math.max(t, Date.parse(`${x.expiry}T00:00:00Z`) + DAY - 1);
      return ev && t % DAY === 0 ? t + DAY - 1 : t;
    };
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
    // F4-2: a day on which an exercise or assignment with an hour (not midnight UTC) meets a trade of the contract: every
    // row of that day goes through the unknown-basis walk. An unlabelled buy and sell at one instant on a flat position:
    // whichever comes first opens, without a basis.
    const dayOf = (x: OptionRow) => Math.floor(when(x) / DAY);
    const fuzzy = new Set(list.filter((x) => (x.kind === 'OPTIONEXERCISE' || x.kind === 'OPTIONASSIGNMENT') && x.executedAt!.getTime() % DAY !== 0
      && list.some((y) => (y.kind === 'BUY' || y.kind === 'SELL') && dayOf(y) === dayOf(x))).map(dayOf));
    const unlabelled = (x: OptionRow) => (x.kind === 'BUY' || x.kind === 'SELL') && !x.openClose;
    const racing = (x: OptionRow) => unlabelled(x) && list.some((y) => unlabelled(y) && y.kind !== x.kind && when(y) === when(x));
    // F4-2 review: the walk runs on a state and reports through `put`, so a fuzzy day can be tried in two readings.
    type Unit = { c: number; at: Date; v: boolean };
    type St = { pos: number; costs: Unit[]; dirty: boolean };
    type Shown = { r: number; at: Date; v: boolean };
    type Put = (id: string, l: Label, shown?: Shown) => void;
    const walk = (x: OptionRow, st: St, put: Put, forced: boolean) => {
      const q = Math.abs(x.units ?? 0);
      const fee = Math.abs(x.fee ?? 0);
      const set = (l: Label, shown?: Shown) => put(x.externalId, l, shown);
      const spoil = (l: Label, after: number) => { set(l); st.pos = after; st.costs = []; st.dirty = st.pos !== 0; };
      const show = (used: Unit[], value: number) => set('shown', { r: value, at: new Date(Math.min(...used.map((u) => u.at.getTime()))), v: x.verified && used.every((u) => u.v) });
      if (!st.dirty && !forced && st.pos === 0 && racing(x)) { st.pos += x.kind === 'BUY' ? q : -q; set('open'); st.costs = []; st.dirty = st.pos !== 0; return; }
      if (st.dirty || forced) {
        // Unknown basis until flat: buys add, sells subtract, events close toward zero.
        if (x.kind === 'BUY') st.pos += q; else if (x.kind === 'SELL') st.pos -= q;
        else { const k = Math.min(q || Math.abs(st.pos), Math.abs(st.pos)); st.pos += st.pos > 0 ? -k : k; }
        set(x.kind === 'OPTIONASSIGNMENT' ? 'short' : x.openClose === 'BUY_TO_OPEN' || x.openClose === 'SELL_TO_OPEN' ? 'open' : 'contradict');
        st.costs = [];
        st.dirty = st.pos !== 0;
        return;
      }
      const pos = st.pos;
      if (x.kind === 'BUY') {
        const opening = x.openClose ? x.openClose === 'BUY_TO_OPEN' : pos >= 0;
        if (x.openClose && x.openClose !== 'BUY_TO_OPEN' && x.openClose !== 'BUY_TO_CLOSE') spoil('contradict', pos + q);
        else if (opening) {
          if (pos < 0) spoil('contradict', pos + q);
          else { for (let i = 0; i < q; i++) st.costs.push({ c: x.price! * m + fee / q, at: x.executedAt!, v: x.verified }); st.pos += q; set('open'); }
        } else if (pos === 0) set('noOpen');
        else if (pos > 0) spoil('contradict', pos + q);
        else if (q > -pos) spoil('flip', pos + q);
        else { st.pos += q; set('short'); }
      } else if (x.kind === 'SELL') {
        const opening = x.openClose ? x.openClose === 'SELL_TO_OPEN' : pos <= 0;
        if (x.openClose && x.openClose !== 'SELL_TO_OPEN' && x.openClose !== 'SELL_TO_CLOSE') spoil('contradict', pos - q);
        else if (opening) { if (pos > 0) spoil('contradict', pos - q); else { st.pos -= q; set('open'); } }
        else if (pos === 0) set('noOpen');
        else if (pos < 0) spoil('contradict', pos - q);
        else if (q > pos) spoil('flip', pos - q);
        else {
          const used = st.costs.splice(0, q), basis = used.reduce((a, u) => a + u.c, 0);
          st.pos -= q;
          if (bad) set(bad); else show(used, (q * x.price! * m - fee - basis) / basis);
        }
      } else if (x.kind === 'OPTIONEXPIRATION') {
        if (pos > 0) {
          const k = Math.min(q || pos, pos);
          const used = st.costs.splice(0, k), basis = used.reduce((a, u) => a + u.c, 0);
          st.pos -= k;
          if (x.amount) set('expiryCash'); else if (bad) set(bad); else show(used, (-fee - basis) / basis);
        } else if (pos < 0) { st.pos += Math.min(q || -pos, -pos); set('short'); } else set('noOpen');
      } else if (x.kind === 'OPTIONEXERCISE') {
        if (pos > 0) { const k = Math.min(q || pos, pos); st.costs.splice(0, k); st.pos -= k; set('exercise'); }
        else if (pos < 0) spoil('contradict', pos); else set('noOpen');
      } else {
        if (pos > 0) spoil('contradict', pos);
        else { set('short'); if (pos < 0) st.pos += Math.min(q || -pos, -pos); }
      }
    };
    const record: Put = (id, l, shown) => { labels.set(id, l); if (shown) returns.set(id, shown.r); };
    const st: St = { pos: 0, costs: [], dirty: false };
    // F4-2 review (finding 2): a fuzzy day is tried with its stamped exercises and assignments just before the day's first
    // close and just after its last. Same result for every row, and no close meeting a flat position or going past it:
    // the day is walked (early reading). Otherwise, or already dirty: every row of the day takes the unknown-basis walk.
    const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;
    for (let i = 0; i < list.length;) {
      const d = dayOf(list[i]);
      if (!fuzzy.has(d)) { walk(list[i++], st, record, false); continue; }
      const day = list.filter((x) => dayOf(x) === d);
      i += day.length;
      if (st.dirty) { for (const x of day) walk(x, st, record, true); continue; }
      const stamped = (x: OptionRow) => (x.kind === 'OPTIONEXERCISE' || x.kind === 'OPTIONASSIGNMENT') && x.executedAt!.getTime() % DAY !== 0;
      const evs = day.filter(stamped), others = day.filter((x) => !stamped(x));
      const closes = others.map((x, k) => (x.openClose === 'BUY_TO_OPEN' || x.openClose === 'SELL_TO_OPEN' ? -1 : k)).filter((k) => k >= 0);
      if (!closes.length) { for (const x of [...others, ...evs]) walk(x, st, record, false); continue; }
      const lo = closes[0], hi = closes[closes.length - 1] + 1;
      const early = [...others.slice(0, lo), ...evs, ...others.slice(lo)];
      const late = [...others.slice(0, hi), ...evs, ...others.slice(hi)];
      const trial = (seq: OptionRow[]) => {
        const s: St = { pos: st.pos, dirty: st.dirty, costs: st.costs.map((u) => ({ ...u })) };
        const got = new Map<string, { l: Label; shown?: Shown }>();
        for (const x of seq) walk(x, s, (id, l, shown) => got.set(id, { l, shown }), false);
        const off = s.dirty || [...got.values()].some((g) => g.l === 'noOpen' || g.l === 'flip' || g.l === 'contradict');
        return { s, got, off };
      };
      const A = trial(early), B = trial(late);
      const same = !A.off && !B.off && A.s.pos === B.s.pos && A.s.costs.length === B.s.costs.length
        && A.s.costs.every((u, k) => near(u.c, B.s.costs[k].c) && u.at.getTime() === B.s.costs[k].at.getTime() && u.v === B.s.costs[k].v)
        && [...A.got].every(([id, g]) => { const h = B.got.get(id); return !!h && h.l === g.l && (!g.shown || (!!h.shown && near(g.shown.r, h.shown.r) && g.shown.at.getTime() === h.shown.at.getTime() && g.shown.v === h.shown.v)); });
      for (const x of same ? early : day) walk(x, st, record, !same);
    }
    const { pos, dirty } = st;
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

// ---- F4-2 (cycle 4, C4-7): the matcher counts what its ordering cannot know (docs/direction/cycle4-2026-11-01.md).
test('F4-2 expiry stamp hour: an expiry orders by the contract\'s expiry day, so a 04:00Z stamp gives what a date-only stamp gives (+50% and -100%)', () => {
  const at = (iso: string) => new Date(iso);
  const rows = (expiryStamp: string) => [
    row('1', 'BUY', 'BUY_TO_OPEN', { units: 2, price: 2, executedAt: at('2026-12-10T15:00:00Z') }),
    row('2', 'SELL', 'SELL_TO_CLOSE', { units: 1, price: 3, executedAt: at('2026-12-19T15:00:00Z') }),
    row('3', 'OPTIONEXPIRATION', null, { units: null, price: 0, amount: 0, executedAt: at(expiryStamp) }),
  ];
  for (const stamp of ['2026-12-19T04:00:00Z', '2026-12-19T00:00:00Z', '2026-12-19T15:00:00Z', '2026-12-20T03:00:00Z']) {
    const m = matchOptions(rows(stamp), new Date('2026-12-30'));
    assert.deepEqual(m.trades.map((t) => [t.closeId, t.returnPct]), [['2', 0.5], ['3', -1]], stamp);
    assert.equal(m.counts.noOpen, 0, stamp);
  }
});

test('F4-2 inferred side: an unlabelled buy and sell at one instant on a flat net are counted (contradict), whichever id comes first', () => {
  const at = new Date('2026-11-12T00:00:00Z');
  for (const [b, s] of [['a', 'b'], ['b', 'a']]) {
    const rows = [row(b, 'BUY', null, { price: 2, executedAt: at }), row(s, 'SELL', null, { price: 3, executedAt: at })];
    assert.deepEqual(only(rows), { shown: 0, contradict: 1 }, `buy id ${b}`);
  }
  // Flat again afterwards: the next labelled pair is shown.
  assert.deepEqual(only([row('1', 'BUY', null, { executedAt: at }), row('2', 'SELL', null, { executedAt: at }), row('3', 'BUY', 'BUY_TO_OPEN'), row('4', 'SELL', 'SELL_TO_CLOSE', { price: 2 })]), { shown: 1, contradict: 1 });
  // Same side at one instant, or different instants: unchanged (the order cannot change the result).
  assert.deepEqual(only([row('1', 'BUY', null, { executedAt: at }), row('2', 'BUY', null, { executedAt: at }), row('3', 'SELL', null, { units: 2, price: 2 })]), { shown: 1 });
  assert.deepEqual(only([row('1', 'BUY', null), row('2', 'SELL', null, { price: 2 })]), { shown: 1 });
});

test('F4-2 exercise or assignment with an hour on a day the contract trades: that day\'s closes are counted (contradict) when the two readings differ or a close meets a flat position, tainted until flat', () => {
  const at = (iso: string) => new Date(iso);
  // Two lots at different costs: with the exercise before the sell, the sell closes the 3.00 lot (-33%); after it, the
  // 1.00 lot (+100%). The exercise's 14:00Z may be the vendor's stamp, so neither close of that day is ordered on it.
  const lots = [row('1', 'BUY', 'BUY_TO_OPEN', { price: 1, executedAt: at('2026-11-10T15:00:00Z') }), row('5', 'BUY', 'BUY_TO_OPEN', { price: 3, executedAt: at('2026-11-11T15:00:00Z') })];
  const sell = row('2', 'SELL', 'SELL_TO_CLOSE', { price: 2, executedAt: at('2026-11-14T15:00:00Z') });
  assert.deepEqual(only([...lots, sell, row('3', 'OPTIONEXERCISE', null, { executedAt: at('2026-11-14T14:00:00Z') })]), { shown: 0, contradict: 2 });
  assert.deepEqual(only([...lots, sell, row('3', 'OPTIONEXERCISE', null, { executedAt: at('2026-11-14T16:00:00Z') })]), { shown: 0, contradict: 2 });
  // Open 2 (one lot), sell 1 and exercise 1 on that day: both readings close the same 1.00 lot, so the sell gives +100%
  // either way and is shown (finding 2: counting it would let the day of an exercise hide a figure). Before the review
  // fix this case was { shown: 0, contradict: 2 }.
  const open2 = row('1', 'BUY', 'BUY_TO_OPEN', { units: 2, executedAt: at('2026-11-10T15:00:00Z') });
  assert.deepEqual(only([open2, sell, row('3', 'OPTIONEXERCISE', null, { executedAt: at('2026-11-14T14:00:00Z') })]), { shown: 1, exercise: 1 });
  assert.deepEqual(only([open2, sell, row('3', 'OPTIONEXERCISE', null, { executedAt: at('2026-11-14T16:00:00Z') })]), { shown: 1, exercise: 1 });
  // One contract held: with the exercise first, the sell would meet a flat position.
  const open1 = row('1', 'BUY', 'BUY_TO_OPEN', { executedAt: at('2026-11-10T15:00:00Z') });
  assert.deepEqual(only([open1, sell, row('3', 'OPTIONEXERCISE', null, { executedAt: at('2026-11-14T16:00:00Z') })]), { shown: 0, contradict: 2 });
  // Date-only (00:00:00Z): it orders at the end of its day, as before.
  assert.deepEqual(only([...lots, sell, row('3', 'OPTIONEXERCISE', null, { executedAt: at('2026-11-14T00:00:00Z') })]), { shown: 1, exercise: 1 });
  // On a day with no trade of the contract: ordered on its stamp, as before.
  assert.deepEqual(only([...lots, sell, row('3', 'OPTIONEXERCISE', null, { executedAt: at('2026-11-13T14:00:00Z') })]), { shown: 1, exercise: 1 });
  // Net left open after a counted day: tainted until flat, so the next close is counted too.
  const lots3 = [lots[0], { ...lots[1], units: 2 }];
  assert.deepEqual(only([...lots3, sell, row('3', 'OPTIONEXERCISE', null, { units: 1, executedAt: at('2026-11-14T14:00:00Z') }), row('4', 'SELL', 'SELL_TO_CLOSE', { price: 2, executedAt: at('2026-11-16T15:00:00Z') })]), { shown: 0, contradict: 3 });
  // An assignment on such a day stays short (D4); the buy-to-close that would meet a flat position is counted under contradict.
  const short1 = row('1', 'SELL', 'SELL_TO_OPEN', { executedAt: at('2026-11-10T15:00:00Z') });
  assert.deepEqual(only([short1, row('2', 'BUY', 'BUY_TO_CLOSE', { executedAt: at('2026-11-14T15:00:00Z') }), row('3', 'OPTIONASSIGNMENT', null, { executedAt: at('2026-11-14T13:00:00Z') })]), { shown: 0, short: 1, contradict: 1 });
});

test('F4-2 review (finding 2): an exercise cannot hide a loss by its day: buy 10 at 5.00, sell 9 at 2.00 and exercise 1 on one day shows the -60% close, as on another day', () => {
  const at = (iso: string) => new Date(iso);
  const buy = row('1', 'BUY', 'BUY_TO_OPEN', { units: 10, price: 5, executedAt: at('2026-11-10T15:00:00Z') });
  const sell = row('2', 'SELL', 'SELL_TO_CLOSE', { units: 9, price: 2, executedAt: at('2026-11-14T15:00:00Z') });
  for (const stamp of ['2026-11-13T14:00:00Z', '2026-11-14T14:00:00Z', '2026-11-14T16:00:00Z', '2026-11-14T00:00:00Z']) {
    const m = matchOptions([buy, sell, row('3', 'OPTIONEXERCISE', null, { executedAt: at(stamp) })], new Date('2026-11-30'));
    assert.deepEqual(m.trades.map((t) => [t.closeId, Math.round(t.returnPct * 1e9) / 1e9]), [['2', -0.6]], stamp);
    assert.deepEqual(only([buy, sell, row('3', 'OPTIONEXERCISE', null, { executedAt: at(stamp) })]), { shown: 1, exercise: 1 }, stamp);
  }
  // Same for an assignment of a short lot: both readings give the same short counts, so nothing moves to contradict.
  const sto = row('1', 'SELL', 'SELL_TO_OPEN', { units: 2, executedAt: at('2026-11-10T15:00:00Z') });
  assert.deepEqual(only([sto, row('2', 'BUY', 'BUY_TO_CLOSE', { executedAt: at('2026-11-14T15:00:00Z') }), row('3', 'OPTIONASSIGNMENT', null, { executedAt: at('2026-11-14T13:00:00Z') })]), { shown: 0, short: 2 });
});

test('F4-2 an assignment dated before expiry keeps its order: a later trade of the same contract opens and closes normally', () => {
  const at = (iso: string) => new Date(iso);
  const rows = [
    row('1', 'SELL', 'SELL_TO_OPEN', { executedAt: at('2026-11-11T15:00:00Z') }),
    row('2', 'OPTIONASSIGNMENT', null, { executedAt: at('2026-11-13T15:00:00Z') }), // early, well before the 2026-12-19 expiry
    row('3', 'BUY', 'BUY_TO_OPEN', { price: 1, executedAt: at('2026-11-15T15:00:00Z') }),
    row('4', 'SELL', 'SELL_TO_CLOSE', { price: 2, executedAt: at('2026-11-16T15:00:00Z') }),
  ];
  const m = matchOptions(rows, new Date('2026-11-30'));
  assert.deepEqual(m.trades.map((t) => [t.closeId, t.returnPct]), [['4', 1]]);
  assert.deepEqual(only(rows), { shown: 1, short: 1 });
  // Same with a date-only assignment stamp, and with an early exercise of a long lot followed by a new long.
  assert.deepEqual(only([rows[0], { ...rows[1], executedAt: at('2026-11-13T00:00:00Z') }, rows[2], rows[3]]), { shown: 1, short: 1 });
  assert.deepEqual(only([row('1', 'BUY', 'BUY_TO_OPEN', { executedAt: at('2026-11-11T15:00:00Z') }), row('2', 'OPTIONEXERCISE', null, { executedAt: at('2026-11-13T15:00:00Z') }), rows[2], rows[3]]), { shown: 1, exercise: 1 });
});

test('F4-2: the AC1 ledgers reach both new rules (a day the order cannot settle, unlabelled sides racing at one instant), so the property is not vacuous', () => {
  let days = 0, races = 0;
  for (let s = 1; s <= RUNS; s++) {
    const groups = new Map<string, OptionRow[]>();
    for (const r of ledger(s).rows) { const k = contractKey(r); if (k && r.executedAt) groups.set(k, [...(groups.get(k) ?? []), r]); }
    for (const g of groups.values()) {
      days += unorderedDays(g).size;
      const free = g.filter((r) => (r.kind === 'BUY' || r.kind === 'SELL') && !r.openClose);
      if (free.some((a) => free.some((b) => a.kind !== b.kind && a.executedAt!.getTime() === b.executedAt!.getTime()))) races++;
    }
  }
  assert.ok(days > 20, `unordered days: ${days}`);
  assert.ok(races > 20, `racing pairs: ${races}`);
});
