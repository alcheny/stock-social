import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { checkRule, ruleAdherence, ruleOutcomes, ruleTrend, rulesByReason, followsRule, signedPct, RULE_KINDS } from './rules.ts';

const chk = (kind: unknown, days: unknown, userId: number | null = 1, clear = false) => checkRule({ userId, kind, days, clear });
const bad = (r: ReturnType<typeof checkRule>) => { assert.equal(r.ok, false); if (!r.ok) assert.equal(r.error, 'Not allowed'); };

test('checkRule: rejections all share one generic error', () => {
  bad(chk('cut_losers', 7, null));
  for (const k of ['x', undefined, 42]) bad(chk(k, 7));
  for (const d of [0, 366, -1, 1.5, 'abc', '', '1e2', ' 7 ', NaN, Infinity, null, undefined, '0.5', '-1']) bad(chk('cut_losers', d));
  bad(chk('x', 7, 1, true));
  bad(chk('cut_losers', null, null, true));
});

test('checkRule: accepts and clears', () => {
  assert.deepEqual(chk('cut_losers', 1), { ok: true, kind: 'cut_losers', days: 1 });
  assert.deepEqual(chk('hold_winners', 365), { ok: true, kind: 'hold_winners', days: 365 });
  assert.deepEqual(chk('hold_winners', '7'), { ok: true, kind: 'hold_winners', days: 7 });
  assert.deepEqual(chk('cut_losers', 'junk', 1, true), { ok: true, kind: 'cut_losers', days: null });
});

const t = (returnPct: number, holdingDays: number) => ({ returnPct, holdingDays });
const rep = (n: number, returnPct: number, holdingDays: number) => Array.from({ length: n }, () => t(returnPct, holdingDays));
const cut = (days: number) => ({ kind: 'cut_losers' as const, days });
const hold = (days: number) => ({ kind: 'hold_winners' as const, days });

test('ruleAdherence: no rules, empty trades', () => {
  assert.deepEqual(ruleAdherence(rep(6, -0.1, 1), []), []);
  const [r] = ruleAdherence([], [cut(7)]);
  assert.equal(r.applicable, 0);
  assert.equal(r.enough, false);
  assert.equal(r.share, null);
  assert.equal(r.takeaway, null);
});

test('ruleAdherence: 4 vs 5 applicable', () => {
  const [a] = ruleAdherence(rep(4, -0.1, 2), [cut(7)]);
  assert.equal(a.enough, false);
  assert.equal(a.share, null);
  assert.equal(a.takeaway, null);
  const [b] = ruleAdherence([...rep(5, -0.1, 2), ...rep(3, 0.1, 2)], [cut(7)]);
  assert.equal(b.enough, true);
  assert.equal(b.applicable, 5);
  assert.equal(b.followed, 5);
  assert.equal(b.share, 1);
  assert.equal(b.takeaway, '5 of 5 losing trades were closed within 7 days');
});

test('ruleAdherence: boundaries are inclusive for both kinds', () => {
  const [c] = ruleAdherence([...rep(5, -0.1, 7), t(-0.1, 7.01)], [cut(7)]);
  assert.equal(c.applicable, 6);
  assert.equal(c.followed, 5);
  const [h] = ruleAdherence([...rep(5, 0.1, 7), t(0.1, 6.99)], [hold(7)]);
  assert.equal(h.applicable, 6);
  assert.equal(h.followed, 5);
});

test('ruleAdherence: return 0 counts for neither; mixed counted per kind; RULE_KINDS order', () => {
  const trades = [...rep(5, 0, 1), ...rep(5, -0.1, 3), ...rep(2, -0.1, 30), ...rep(6, 0.2, 10), ...rep(1, 0.2, 1)];
  const [c, h] = ruleAdherence(trades, [hold(7), cut(7)]);
  assert.equal(c.kind, 'cut_losers');
  assert.equal(c.applicable, 7);
  assert.equal(c.followed, 5);
  assert.equal(h.kind, 'hold_winners');
  assert.equal(h.applicable, 7);
  assert.equal(h.followed, 6);
  assert.equal(h.takeaway, '6 of 7 winning trades were held at least 7 days');
});

test('ruleAdherence: singular wording, duplicate kinds, no advice words', () => {
  const [c] = ruleAdherence(rep(5, -0.1, 0.5), [cut(30), cut(1)]);
  assert.equal(c.days, 1);
  assert.equal(c.takeaway, '5 of 5 losing trades were closed within 1 day');
  const [h] = ruleAdherence(rep(5, 0.1, 0.5), [hold(1)]);
  assert.equal(h.followed, 0);
  assert.equal(h.takeaway, '0 of 5 winning trades were held at least 1 day');
  for (const r of [c, h]) assert.doesNotMatch(r.takeaway!, /should|try|consider|improve/i);
  assert.equal(RULE_KINDS.length, 2);
});

test('rules are only imported by the record page and actions', () => {
  const hits: string[] = [];
  const walk = (d: string) => {
    for (const f of readdirSync(d)) {
      if (['node_modules', '.next', '.git'].includes(f)) continue;
      const p = join(d, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(f) && p !== 'lib/rules.ts' && p !== 'lib/rules.test.ts' && /lib\/rules\.ts/.test(readFileSync(p, 'utf8'))) hits.push(p);
    }
  };
  for (const d of ['app', 'lib']) walk(d);
  assert.deepEqual(hits.sort(), ['app/actions.ts', 'app/me/record/page.tsx']);
});

const mk = (n: number, returnPct: number, holdingDays: number) => Array.from({ length: n }, () => ({ returnPct, holdingDays }));

test('followsRule: exactly N days follows for both kinds', () => {
  assert.equal(followsRule('cut_losers', 7, { returnPct: -1, holdingDays: 7 }), true);
  assert.equal(followsRule('cut_losers', 7, { returnPct: -1, holdingDays: 7.01 }), false);
  assert.equal(followsRule('hold_winners', 7, { returnPct: 1, holdingDays: 7 }), true);
  assert.equal(followsRule('hold_winners', 7, { returnPct: 1, holdingDays: 6.99 }), false);
});

test('signedPct: sign, one decimal, negative zero normalised', () => {
  assert.equal(signedPct(4.24), '+4.2%');
  assert.equal(signedPct(-3.11), '-3.1%');
  assert.equal(signedPct(-0.04), '+0.0%');
  assert.equal(signedPct(0), '+0.0%');
});

test('ruleOutcomes: no rules and empty trades', () => {
  assert.deepEqual(ruleOutcomes(mk(6, 5, 9), []), []);
  const [o] = ruleOutcomes([], [{ kind: 'hold_winners', days: 7 }]);
  assert.deepEqual(o, { kind: 'hold_winners', days: 7, applicable: 0, followed: { count: 0, avgReturn: null }, notFollowed: { count: 0, avgReturn: null }, enough: false, takeaway: null });
});

test('ruleOutcomes: one side under 5 suppresses takeaway, keeps counts', () => {
  const [o] = ruleOutcomes([...mk(4, 5, 9), ...mk(6, 2, 1)], [{ kind: 'hold_winners', days: 7 }]);
  assert.equal(o.enough, false);
  assert.equal(o.takeaway, null);
  assert.equal(o.followed.count, 4);
  assert.equal(o.notFollowed.count, 6);
});

test('ruleOutcomes: both sides enough, exact copy, no judgmental words', () => {
  const w = [...mk(5, 4, 7), ...mk(4, 1, 2), { returnPct: 2.2, holdingDays: 3 }, { returnPct: 0, holdingDays: 1 }, { returnPct: -9, holdingDays: 1 }];
  const [o] = ruleOutcomes(w, [{ kind: 'hold_winners', days: 7 }]);
  assert.equal(o.applicable, 10);
  assert.equal(o.enough, true);
  assert.equal(o.followed.avgReturn, 4);
  assert.equal(o.notFollowed.count, 5);
  assert.equal(o.takeaway, 'Among your 10 winning trades: held 7+ days averaged +4.0% (5 trades); held less averaged +1.2% (5 trades).');
  const l = [...mk(5, -2, 1), ...mk(5, -6, 10), ...mk(3, 8, 1)];
  const [c] = ruleOutcomes(l, [{ kind: 'cut_losers', days: 1 }]);
  assert.equal(c.takeaway, 'Among your 10 losing trades: closed within 1 day averaged -2.0% (5 trades); held longer averaged -6.0% (5 trades).');
  for (const t of [o.takeaway!, c.takeaway!]) assert.doesNotMatch(t, /should|better|works|improve/i);
});

test('ruleOutcomes: ties and order follow RULE_KINDS', () => {
  const t = [...mk(5, 3, 8), ...mk(5, 3, 2), ...mk(5, -3, 1), ...mk(5, -3, 9)];
  const out = ruleOutcomes(t, [{ kind: 'hold_winners', days: 7 }, { kind: 'cut_losers', days: 1 }]);
  assert.deepEqual(out.map((x) => x.kind), [...RULE_KINDS]);
  assert.equal(out[1].followed.avgReturn, out[1].notFollowed.avgReturn);
});

test('ruleOutcomes: zero-return excluded; no win-rate field', () => {
  const [o] = ruleOutcomes([...mk(5, 0, 9), ...mk(5, 0, 1)], [{ kind: 'hold_winners', days: 7 }]);
  assert.equal(o.applicable, 0);
  assert.deepEqual(Object.keys(o).sort(), ['applicable', 'days', 'enough', 'followed', 'kind', 'notFollowed', 'takeaway']);
  assert.deepEqual(Object.keys(o.followed).sort(), ['avgReturn', 'count']);
});

test('ruleAdherence: unchanged after predicate extraction (hard-coded)', () => {
  const t = [...mk(2, -1, 7), ...mk(2, -1, 7.5), ...mk(1, -1, 1), ...mk(3, 2, 7), ...mk(2, 2, 6.9)];
  const [c] = ruleAdherence(t, [{ kind: 'cut_losers', days: 7 }]);
  assert.deepEqual(c, { kind: 'cut_losers', days: 7, applicable: 5, followed: 3, share: 0.6, enough: true, takeaway: '3 of 5 losing trades were closed within 7 days' });
  const [h] = ruleAdherence(t, [{ kind: 'hold_winners', days: 7 }]);
  assert.deepEqual(h, { kind: 'hold_winners', days: 7, applicable: 5, followed: 3, share: 0.6, enough: true, takeaway: '3 of 5 winning trades were held at least 7 days' });
});

// ruleTrend
type Tm = { returnPct: number; holdingDays: number; closedAt: Date; sellId: string };
const DAY = 86_400_000;
// Trade i closes i days after day 0; sellId is unique and sortable.
const tm = (i: number, returnPct: number, holdingDays: number, closedAt = new Date(i * DAY)): Tm => ({ returnPct, holdingDays, closedAt, sellId: `s${String(i).padStart(3, '0')}` });
// Losers, oldest first. followedAt(i) says whether trade i followed a 7-day cut rule.
const losers = (n: number, followedAt: (i: number) => boolean) => Array.from({ length: n }, (_, i) => tm(i, -5, followedAt(i) ? 3 : 20));
const one = (ts: Tm[], rule: { kind: 'cut_losers' | 'hold_winners'; days: number } = cut(7)) => ruleTrend(ts, [rule])[0];

test('ruleTrend: no trades and no rules', () => {
  assert.deepEqual(ruleTrend([], []), []);
  const r = ruleTrend([], [cut(7), hold(7)]);
  assert.deepEqual(r.map((x) => x.kind), ['cut_losers', 'hold_winners']);
  for (const x of r) {
    assert.equal(x.enough, false);
    assert.equal(x.direction, null);
    assert.equal(x.takeaway, null);
    assert.deepEqual(x.latest, { count: 0, followed: 0, share: null });
    assert.deepEqual(x.earlier, { count: 0, followed: 0, share: null });
  }
});

test('ruleTrend: 14 is not enough, 15 and 20 are', () => {
  const r14 = one(losers(14, () => true));
  assert.equal(r14.latest.count, 10);
  assert.equal(r14.earlier.count, 4);
  assert.equal(r14.enough, false);
  assert.equal(r14.takeaway, null);
  assert.equal(r14.direction, null);
  const r10 = one(losers(10, () => true));
  assert.equal(r10.earlier.count, 0);
  assert.equal(r10.enough, false);
  const r15 = one(losers(15, () => true));
  assert.deepEqual([r15.latest.count, r15.earlier.count, r15.enough], [10, 5, true]);
  assert.ok(r15.takeaway);
  const r20 = one(losers(20, () => true));
  assert.deepEqual([r20.latest.count, r20.earlier.count, r20.enough], [10, 10, true]);
});

test('ruleTrend: only the latest 20 are used', () => {
  const r = one(losers(25, (i) => i < 5)); // the 5 oldest followed, the rest not
  assert.equal(r.applicable, 25);
  assert.equal(r.latest.followed + r.earlier.followed, 0);
  assert.equal(r.latest.count + r.earlier.count, 20);
  assert.equal(r.direction, 'same');
});

test('ruleTrend: tied closedAt is split by sellId and input order does not matter', () => {
  const same = new Date(5 * DAY);
  // Ascending sellId wins ties, so s000..s009 are the latest 10.
  const ts = Array.from({ length: 15 }, (_, i) => tm(i, -5, i < 10 ? 20 : 3, same));
  const a = one(ts);
  assert.deepEqual([a.latest.followed, a.earlier.followed], [0, 5]);
  assert.deepEqual(one([...ts].reverse()), a);
  assert.deepEqual(one([...ts.slice(7), ...ts.slice(0, 7)]), a);
});

test('ruleTrend: exactly-N-days boundary uses followsRule', () => {
  const cutTs = [...Array.from({ length: 10 }, (_, i) => tm(i + 5, -5, 7)), ...Array.from({ length: 5 }, (_, i) => tm(i, -5, 7.01))];
  const c = one(cutTs);
  assert.deepEqual([c.latest.followed, c.earlier.followed], [10, 0]);
  const holdTs = [...Array.from({ length: 10 }, (_, i) => tm(i + 5, 5, 7)), ...Array.from({ length: 5 }, (_, i) => tm(i, 5, 6.99))];
  const h = one(holdTs, hold(7));
  assert.deepEqual([h.latest.followed, h.earlier.followed], [10, 0]);
});

test('ruleTrend: unequal side sizes compare shares, not counts', () => {
  // latest 6 of 10, earlier 4 of 6: 0.6 < 0.667 so down.
  const earlier = Array.from({ length: 6 }, (_, i) => tm(i, -5, i < 4 ? 3 : 20));
  const latest = Array.from({ length: 10 }, (_, i) => tm(i + 6, -5, i < 6 ? 3 : 20));
  const r = one([...earlier, ...latest]);
  assert.equal(r.direction, 'down');
  assert.equal(r.takeaway, 'Followed less often: on 6 of your latest 10 applicable trades, versus 4 of the 6 before.');
  // 5/10 versus 3/6 is exactly equal.
  const e2 = Array.from({ length: 6 }, (_, i) => tm(i, -5, i < 3 ? 3 : 20));
  const l2 = Array.from({ length: 10 }, (_, i) => tm(i + 6, -5, i < 5 ? 3 : 20));
  const s = one([...e2, ...l2]);
  assert.equal(s.direction, 'same');
  assert.equal(s.takeaway, 'Followed equally often: on 5 of your latest 10 applicable trades, versus 3 of the 6 before.');
});

test('ruleTrend: exact wording for up, down, same, with no loaded words', () => {
  const build = (earlierF: number, latestF: number) => [
    ...Array.from({ length: 10 }, (_, i) => tm(i, -5, i < earlierF ? 3 : 20)),
    ...Array.from({ length: 10 }, (_, i) => tm(i + 10, -5, i < latestF ? 3 : 20)),
  ];
  const up = one(build(4, 7));
  const down = one(build(7, 4));
  const same = one(build(5, 5));
  assert.equal(up.takeaway, 'Followed more often: on 7 of your latest 10 applicable trades, versus 4 of the 10 before.');
  assert.equal(down.takeaway, 'Followed less often: on 4 of your latest 10 applicable trades, versus 7 of the 10 before.');
  assert.equal(same.takeaway, 'Followed equally often: on 5 of your latest 10 applicable trades, versus 5 of the 10 before.');
  assert.deepEqual([up.direction, down.direction, same.direction], ['up', 'down', 'same']);
  for (const x of [up, down, same]) assert.doesNotMatch(x.takeaway!, /improv|declin|great|should|↑|↓/i);
});

test('ruleTrend: both kinds use only their own trades; zero return counts for neither', () => {
  const ts = [
    ...Array.from({ length: 15 }, (_, i) => tm(i, -5, 3)),
    ...Array.from({ length: 15 }, (_, i) => tm(i + 100, 5, 20)),
    ...Array.from({ length: 5 }, (_, i) => tm(i + 200, 0, 1)),
  ];
  const r = ruleTrend(ts, [hold(7), cut(7)]);
  assert.deepEqual(r.map((x) => x.kind), ['cut_losers', 'hold_winners']);
  assert.deepEqual(r.map((x) => x.applicable), [15, 15]);
  assert.ok(r.every((x) => x.enough && x.direction === 'same'));
});

test('ruleTrend: does not mutate input', () => {
  const ts = losers(15, (i) => i % 2 === 0).reverse();
  const before = ts.map((x) => x.sellId);
  one(ts);
  assert.deepEqual(ts.map((x) => x.sellId), before);
});

// ---- rulesByReason ----
type Rsn = 'planned' | 'catalyst' | 'tip' | 'impulse' | 'other';
let sid = 0;
const rt = (returnPct: number, holdingDays: number) => ({ returnPct, holdingDays, sellId: `r${sid++}` });
// n trades with the given return; the first `kept` are held keptDays, the rest brokeDays; tagged with `reason` when given.
function tagged(tags: Map<string, Rsn>, reason: Rsn | null, n: number, kept: number, ret = -5, keptDays = 2, brokeDays = 10) {
  return Array.from({ length: n }, (_, i) => {
    const x = rt(ret, i < kept ? keptDays : brokeDays);
    if (reason) tags.set(x.sellId, reason);
    return x;
  });
}

test('rulesByReason: no rules, and a rule with no trades', () => {
  assert.deepEqual(rulesByReason([], [], new Map()), []);
  assert.deepEqual(rulesByReason([rt(-1, 1)], [], new Map()), []);
  const r = rulesByReason([], [cut(3)], new Map());
  assert.equal(r.length, 1);
  assert.deepEqual([r[0].applicable, r[0].tagged, r[0].cells, r[0].takeaway, r[0].enough], [0, 0, [], null, false]);
});

test('rulesByReason: two reasons with enough trades, exact takeaway, enum order', () => {
  const tags = new Map<string, Rsn>();
  const trades = [...tagged(tags, 'impulse', 6, 4), ...tagged(tags, 'planned', 7, 7)];
  const [r] = rulesByReason(trades, [cut(3)], tags);
  assert.deepEqual(r.cells.map((c) => c.reason), ['planned', 'impulse']);
  assert.deepEqual(r.cells.map((c) => [c.applicable, c.followed, c.enough]), [[7, 7, true], [6, 4, true]]);
  assert.equal(r.cells[0].share, 1);
  assert.equal(r.cells[1].share, 4 / 6);
  assert.equal(r.enough, true);
  assert.equal(r.takeaway, 'You kept the cut-losers rule on 7 of 7 trades tagged Planned setup and 4 of 6 trades tagged Impulse.');
});

test('rulesByReason: hold-winners takeaway wording', () => {
  const tags = new Map<string, Rsn>();
  const [r] = rulesByReason([...tagged(tags, 'planned', 5, 5, 4, 7, 2), ...tagged(tags, 'tip', 5, 2, 4, 7, 2)], [hold(7)], tags);
  assert.equal(r.kind, 'hold_winners');
  assert.equal(r.takeaway, 'You kept the hold-winners rule on 5 of 5 trades tagged Planned setup and 2 of 5 trades tagged Tip from others.');
});

test('rulesByReason: no tags', () => {
  const [r] = rulesByReason(tagged(new Map(), null, 8, 2), [cut(3)], new Map());
  assert.deepEqual([r.applicable, r.tagged, r.cells, r.takeaway, r.enough], [8, 0, [], null, false]);
});

test('rulesByReason: tags for missing trades are ignored; Record input works', () => {
  const tags = new Map<string, Rsn>();
  const trades = tagged(tags, 'planned', 5, 5);
  tags.set('ghost', 'impulse');
  const [r] = rulesByReason(trades, [cut(3)], tags);
  assert.equal(r.tagged, 5);
  assert.deepEqual(r.cells.map((c) => c.reason), ['planned']);
  assert.deepEqual(rulesByReason(trades, [cut(3)], Object.fromEntries(tags)), [r]);
  assert.equal(rulesByReason(trades, [cut(3)], {})[0].tagged, 0);
});

test('rulesByReason: exact-N-days boundary goes through followsRule', () => {
  const tags = new Map<string, Rsn>();
  const mk = (ret: number, d: number) => { const x = rt(ret, d); tags.set(x.sellId, 'planned'); return x; };
  const [c] = rulesByReason([mk(-1, 3), mk(-1, 3), mk(-1, 3), mk(-1, 3), mk(-1, 3.01)], [cut(3)], tags);
  assert.equal(c.cells[0].followed, 4);
  const [h] = rulesByReason([mk(1, 7), mk(1, 7), mk(1, 7), mk(1, 7), mk(1, 6.99)], [hold(7)], tags);
  assert.equal(h.cells[0].followed, 4);
});

test('rulesByReason: 4 vs 5 applicable suppression edge', () => {
  const t4 = new Map<string, Rsn>();
  const [four] = rulesByReason(tagged(t4, 'planned', 4, 4), [cut(3)], t4);
  assert.deepEqual([four.cells[0].enough, four.cells[0].share], [false, null]);
  const t5 = new Map<string, Rsn>();
  const [five] = rulesByReason(tagged(t5, 'impulse', 5, 5), [cut(3)], t5);
  assert.deepEqual([five.cells[0].enough, five.cells[0].share], [true, 1]);
});

test('rulesByReason: coverage counts untagged applicable trades', () => {
  const tags = new Map<string, Rsn>();
  const [r] = rulesByReason([...tagged(tags, 'planned', 6, 3), ...tagged(tags, null, 2, 1)], [cut(3)], tags);
  assert.deepEqual([r.applicable, r.tagged], [8, 6]);
});

test('rulesByReason: ties pick earliest enum reasons; equal shares keep the wording', () => {
  const tags = new Map<string, Rsn>();
  const trades = [...tagged(tags, 'impulse', 5, 5), ...tagged(tags, 'catalyst', 5, 5), ...tagged(tags, 'planned', 5, 5)];
  const [r] = rulesByReason(trades, [cut(3)], tags);
  assert.equal(r.cells.length, 3);
  assert.equal(r.takeaway, 'You kept the cut-losers rule on 5 of 5 trades tagged Planned setup and 5 of 5 trades tagged News/catalyst.');
});

test('rulesByReason: higher applicable count beats enum order', () => {
  const tags = new Map<string, Rsn>();
  const trades = [...tagged(tags, 'planned', 5, 1), ...tagged(tags, 'tip', 9, 3), ...tagged(tags, 'other', 7, 7)];
  const [r] = rulesByReason(trades, [cut(3)], tags);
  assert.equal(r.takeaway, 'You kept the cut-losers rule on 3 of 9 trades tagged Tip from others and 7 of 7 trades tagged Other.');
});

test('rulesByReason: one enough cell gives no takeaway', () => {
  const tags = new Map<string, Rsn>();
  const [r] = rulesByReason([...tagged(tags, 'planned', 6, 6), ...tagged(tags, 'impulse', 4, 1)], [cut(3)], tags);
  assert.equal(r.enough, false);
  assert.equal(r.takeaway, null);
  assert.equal(r.cells[0].share, 1);
});

test('rulesByReason: winners and zero-return trades never apply to cut_losers', () => {
  const tags = new Map<string, Rsn>();
  const trades = [...tagged(tags, 'planned', 5, 5, 4), ...tagged(tags, 'planned', 5, 5, 0)];
  const [r] = rulesByReason(trades, [cut(3)], tags);
  assert.deepEqual([r.applicable, r.tagged, r.cells], [0, 0, []]);
});

test('rulesByReason: takeaway has no advice wording', () => {
  const tags = new Map<string, Rsn>();
  const [r] = rulesByReason([...tagged(tags, 'planned', 5, 2), ...tagged(tags, 'impulse', 5, 5)], [cut(3)], tags);
  assert.doesNotMatch(r.takeaway!, /should|try|better|worse/i);
});
