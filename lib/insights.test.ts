import test from 'node:test';
import assert from 'node:assert/strict';
import { habits, insights, MIN_TRADES, sinceLast, visitDecision, VISIT_GAP_MS, type InsightTrade } from './insights.ts';

let seq = 0;
const t = (returnPct: number, holdingDays = 2, symbol = 'AAA', day = ++seq): InsightTrade => ({
  symbol, returnPct, holdingDays, closedAt: new Date(Date.UTC(2025, 0, 1 + day)),
});
const many = (n: number, f: (i: number) => InsightTrade) => Array.from({ length: n }, (_, i) => f(i));

test('empty', () => {
  const r = insights([]);
  assert.equal(r.total, 0);
  assert.equal(r.buckets.length, 4);
  for (const b of r.buckets) assert.deepEqual([b.n, b.enough, b.winRate, b.avgReturn, b.takeaway], [0, false, null, null, null]);
  assert.equal(r.symbols.enough, false);
  assert.equal(r.winLoss.enough, false);
  assert.equal(r.streak.enough, false);
  assert.equal(r.streak.longestLosing, null);
});

test('single trade is suppressed', () => {
  const r = insights([t(0.1, 3)]);
  assert.equal(r.buckets[1].n, 1);
  assert.equal(r.buckets[1].enough, false);
  assert.equal(r.buckets[1].takeaway, null);
  assert.equal(r.buckets[1].avgReturn, null);
});

test('bucket boundaries', () => {
  const key = (d: number) => insights([t(0.1, d)]).buckets.find((b) => b.n === 1)!.key;
  assert.equal(key(0.99), 'lt1');
  assert.equal(key(1), 'd1to7');
  assert.equal(key(6.999), 'd1to7');
  assert.equal(key(7), 'd7to28');
  assert.equal(key(27.999), 'd7to28');
  assert.equal(key(28), 'gte28');
});

test('min sample: 4 suppressed, 5 shown; rates correct; 0% is not a win', () => {
  const four = insights(many(4, () => t(0.1, 10))).buckets[2];
  assert.equal(four.enough, false);
  assert.equal(four.takeaway, null);
  assert.equal(four.n, 4);
  const five = insights([t(0.1, 10), t(0.1, 10), t(-0.05, 10), t(0, 10), t(0.05, 10)]).buckets[2];
  assert.equal(MIN_TRADES, 5);
  assert.equal(five.enough, true);
  assert.equal(five.winRate, 3 / 5);
  assert.ok(Math.abs(five.avgReturn! - 0.04) < 1e-9);
  assert.ok(five.takeaway);
});

test('symbols: tie breaks alphabetically, small symbols ignored, single qualifier', () => {
  const tie = insights([
    ...many(5, () => t(0.05, 2, 'ZZZ')), ...many(5, () => t(0.05, 2, 'BBB')), ...many(4, () => t(0.9, 2, 'MOON')),
  ]).symbols;
  assert.equal(tie.best!.symbol, 'BBB');
  assert.equal(tie.worst!.symbol, 'ZZZ');
  const mixed = insights([...many(5, () => t(0.1, 2, 'UP')), ...many(5, () => t(-0.1, 2, 'DN'))]).symbols;
  assert.equal(mixed.best!.symbol, 'UP');
  assert.equal(mixed.worst!.symbol, 'DN');
  const one = insights(many(5, () => t(0.1, 2, 'ONE'))).symbols;
  assert.equal(one.best!.symbol, 'ONE');
  assert.equal(one.worst, null);
  assert.ok(!/weak/i.test(one.takeaway!));
  assert.equal(insights(many(4, () => t(0.1, 2, 'X'))).symbols.enough, false);
});

test('win/loss: each side needs 5', () => {
  const r = insights([...many(5, () => t(0.1)), t(-0.02), t(-0.04)]).winLoss;
  assert.equal(r.enough, true);
  assert.ok(Math.abs(r.avgWin! - 0.1) < 1e-9);
  assert.equal(r.avgLoss, null);
  assert.equal(r.wins, 5);
  assert.equal(r.losses, 2);
  const both = insights([...many(5, () => t(0.06)), ...many(5, () => t(-0.04))]).winLoss;
  assert.ok(Math.abs(both.avgLoss! + 0.04) < 1e-9);
});

test('streak', () => {
  const seqs = [0.1, -0.1, -0.1, -0.1, 0, -0.1, -0.1, 0.1];
  const trades = seqs.map((r, i) => t(r, 2, 'AAA', 100 + i));
  assert.equal(insights(trades).streak.longestLosing, 3);
  assert.equal(insights([...trades].reverse()).streak.longestLosing, 3);
  assert.equal(insights(trades.slice(0, 4)).streak.longestLosing, null);
  assert.equal(insights(many(5, () => t(0.1))).streak.longestLosing, 0);
});

test('no takeaway contains advice words', () => {
  const r = insights([
    ...many(6, (i) => t(i % 2 ? 0.1 : -0.05, 0.5 + i * 10, i % 2 ? 'UP' : 'DN')),
    ...many(6, (i) => t(i % 2 ? 0.1 : -0.05, 40, 'GG')),
  ]);
  const all = [...r.buckets.map((b) => b.takeaway), r.symbols.takeaway, r.winLoss.takeaway, r.streak.takeaway];
  assert.ok(all.filter(Boolean).length >= 3);
  for (const s of all) if (s) assert.doesNotMatch(s, /should|try|avoid|consider|buy|you need to/i);
});

const B = new Date(Date.UTC(2025, 5, 1));
const at = (r: number, ms: number, symbol = 'AAA'): InsightTrade => ({ symbol, returnPct: r, holdingDays: 2, closedAt: new Date(B.getTime() + ms) });
const olds = (n: number, r = 0.1) => many(n, (i) => at(r, -(i + 1) * 1000));

test('sinceLast: empty and null baseline', () => {
  const e = sinceLast([], B);
  assert.deepEqual([e.fresh.length, e.nowN, e.beforeN, e.enough, e.movement, e.takeaway], [0, 0, 0, false, null, null]);
  const n = sinceLast(olds(6), null);
  assert.deepEqual([n.baseline, n.fresh.length, n.beforeN, n.nowN, n.movement, n.takeaway], [null, 0, 0, 6, null, null]);
});

test('sinceLast: no new trades', () => {
  const r = sinceLast(olds(6), B);
  assert.equal(r.fresh.length, 0);
  assert.equal(r.beforeN, 6);
});

test('sinceLast: boundary is already seen; losses are included', () => {
  const r = sinceLast([...olds(5), at(0.1, 0), at(-0.05, 1000)], B);
  assert.equal(r.beforeN, 6);
  assert.equal(r.nowN, 7);
  assert.deepEqual(r.fresh.map((x) => x.returnPct), [-0.05]);
});

test('sinceLast: min sample applies to each side separately', () => {
  const a = sinceLast([...olds(4), ...many(3, (i) => at(-0.1, (i + 1) * 1000))], B); // before 4, now 7
  assert.deepEqual([a.enough, a.movement, a.takeaway], [false, null, null]);
  const b = sinceLast([...olds(5), at(0.1, 1000)], B); // before 5, now 6
  assert.equal(b.enough, true);
  const c = sinceLast([...olds(2), at(0.1, 1000), at(0.1, 2000)], B); // now 4
  assert.deepEqual([c.enough, c.movement], [false, null]);
});

test('sinceLast: movement and copy, from to', () => {
  const before = [...many(3, (i) => at(0.1, -(i + 1) * 1000)), ...many(2, (i) => at(-0.1, -(i + 10) * 1000))];
  const r = sinceLast([...before, at(0.1, 1000), at(0.1, 2000)], B);
  assert.equal(r.enough, true);
  assert.equal(r.movement!.winRate.before, 0.6);
  assert.ok(Math.abs(r.movement!.winRate.now - 5 / 7) < 1e-9);
  assert.equal(r.takeaway, 'Win rate went from 60% to 71% and average return from +2.0% to +4.3%.');
  assert.doesNotMatch(r.takeaway!, /improv|better|worse/i);
});

test('sinceLast: unchanged copy', () => {
  const r = sinceLast([...many(5, (i) => at(0.1, -(i + 1) * 1000)), at(0.1, 1000)], B);
  assert.equal(r.takeaway, 'Win rate and average return are unchanged: 100% and +10.0%.');
});

test('sinceLast: ties are ordered newest first, then symbol, then return', () => {
  const r = sinceLast([at(0.2, 1000, 'ZZZ'), at(0.3, 1000, 'AAA'), at(0.1, 1000, 'AAA'), at(0, 5000, 'MMM')], B);
  assert.deepEqual(r.fresh.map((x) => [x.symbol, x.returnPct]), [['MMM', 0], ['AAA', 0.1], ['AAA', 0.3], ['ZZZ', 0.2]]);
});

test('visitDecision', () => {
  const last = new Date(Date.UTC(2025, 0, 1, 12));
  const prev = new Date(Date.UTC(2024, 11, 1));
  const first = new Date(Date.UTC(2024, 10, 1));
  const ms = (n: number) => new Date(last.getTime() + n);
  assert.deepEqual(visitDecision(ms(VISIT_GAP_MS - 1000), last, prev, first), { roll: false, baseline: prev });
  assert.deepEqual(visitDecision(ms(VISIT_GAP_MS), last, prev, first), { roll: true, baseline: last });
  assert.deepEqual(visitDecision(ms(0), null, null, first), { roll: true, baseline: first });
  assert.deepEqual(visitDecision(ms(0), null, null, null), { roll: true, baseline: null });
  const now = ms(VISIT_GAP_MS);
  assert.deepEqual(visitDecision(new Date(now.getTime() + 60_000), now, last, first), { roll: false, baseline: last });
});

// habits(): trades at explicit ms offsets so order is controlled.
const h = (returnPct: number, holdingDays: number, ms: number, symbol = 'AAA'): InsightTrade => ({
  symbol, returnPct, holdingDays, closedAt: new Date(Date.UTC(2025, 0, 1) + ms),
});
const seqOf = (rs: number[], days = 2) => rs.map((r, i) => h(r, days, (i + 1) * 1000));

test('habits: empty', () => {
  const r = habits([]);
  assert.equal(r.total, 0);
  for (const s of [r.hold.winners, r.hold.losers, r.after.win, r.after.loss]) assert.deepEqual([s.n, s.enough], [0, false]);
  assert.equal(r.hold.takeaway, null);
  assert.equal(r.after.takeaway, null);
});

test('habits: single trade', () => {
  const r = habits(seqOf([0.1]));
  assert.equal(r.total, 1);
  assert.deepEqual([r.after.win.n, r.after.loss.n], [0, 0]);
  assert.deepEqual([r.hold.winners.n, r.hold.winners.enough, r.hold.winners.avgDays], [1, false, null]);
  assert.equal(r.hold.losers.n, 0);
});

test('habits: hold side 4 vs 5 boundary', () => {
  const four = habits([...many(5, (i) => h(0.1, 4, i * 1000)), ...many(4, (i) => h(-0.1, 9, 10000 + i * 1000))]);
  assert.equal(four.hold.winners.enough, true);
  assert.equal(four.hold.winners.avgDays, 4);
  assert.deepEqual([four.hold.losers.n, four.hold.losers.enough, four.hold.losers.avgDays], [4, false, null]);
  assert.equal(four.hold.takeaway, null);
  const five = habits([...many(5, (i) => h(0.1, 4.14, i * 1000)), ...many(5, (i) => h(-0.1, 9.25, 10000 + i * 1000))]);
  assert.equal(five.hold.losers.enough, true);
  assert.equal(five.hold.takeaway, 'Your losing trades were held 9.3 days on average and your winning trades 4.1.');
});

test('habits: after groups judged independently at 4 vs 5', () => {
  const rs = [0.1, -0.1, 0.1, -0.1, 0.1, -0.1, 0.1, -0.1, 0.1, -0.1, 0.1];
  const r = habits(seqOf(rs));
  assert.deepEqual([r.after.win.n, r.after.loss.n], [5, 5]);
  const r4 = habits(seqOf(rs.slice(0, 10)));
  assert.deepEqual([r4.after.win.n, r4.after.loss.n], [5, 4]);
  assert.equal(r4.after.win.enough, true);
  assert.notEqual(r4.after.win.winRate, null);
  assert.deepEqual([r4.after.loss.enough, r4.after.loss.winRate, r4.after.loss.avgReturn], [false, null, null]);
  assert.equal(r4.after.takeaway, null);
});

test('habits: 0% trades', () => {
  const r = habits(seqOf([0, 0, 0]));
  assert.deepEqual([r.hold.winners.n, r.hold.losers.n, r.after.win.n, r.after.loss.n], [0, 0, 0, 0]);
  const z = habits(seqOf([0.1, 0, 0.2]));
  assert.deepEqual([z.after.win.n, z.after.loss.n], [1, 0]);
  const c = habits(seqOf([-0.1, 0, -0.1, 0, -0.1, 0, -0.1, 0, -0.1, 0, -0.1]));
  assert.equal(c.after.loss.n, 5);
  assert.equal(c.after.loss.winRate, 0);
});

test('habits: deterministic under ties and shuffles', () => {
  const ts = [h(0.2, 1, 1000, 'ZZZ'), h(0.3, 2, 1000, 'AAA'), h(-0.1, 3, 1000, 'AAA'), h(0.1, 4, 2000, 'BBB'), h(-0.2, 5, 2000, 'BBB'),
    h(0.1, 6, 3000), h(-0.1, 7, 3000, 'CCC'), h(0.05, 8, 4000), h(-0.05, 9, 4000, 'DDD'), h(0.4, 1, 5000), h(-0.3, 2, 5000, 'EEE'), h(0.2, 3, 6000)];
  const base = habits(ts);
  assert.deepEqual(habits([...ts].reverse()), base);
  assert.deepEqual(habits([...ts.slice(5), ...ts.slice(0, 5)]), base);
  // order: AAA -0.1, AAA 0.3 (after loss), ZZZ 0.2 (after win)
  const two = habits([h(0.2, 1, 1000, 'ZZZ'), h(0.3, 1, 1000, 'AAA'), h(-0.1, 1, 1000, 'AAA')]);
  assert.deepEqual([two.after.loss.n, two.after.win.n], [1, 1]);
});

test('habits: takeaway formats and no advice words', () => {
  const rs = [-0.1, 0.1, -0.1, 0.1, -0.1, 0.1, -0.1, 0.1, -0.1, 0.1, -0.1, 0.1, -0.1];
  const r = habits(seqOf(rs, 3));
  assert.equal(r.after.win.n, 6);
  assert.equal(r.after.loss.n, 6);
  assert.equal(r.after.takeaway, 'Trades closed right after a loss won 100% of the time and averaged +10.0%; after a win, 0% and -10.0%.');
  assert.equal(r.hold.takeaway, 'Your losing trades were held 3.0 days on average and your winning trades 3.0.');
  for (const s of [r.after.takeaway!, r.hold.takeaway!]) assert.doesNotMatch(s, /should|try|avoid|consider|must|need to|revenge|tilt|you ought/i);
});

test('habits: does not mutate input', () => {
  const ts = [h(0.1, 1, 3000), h(-0.1, 1, 1000), h(0.2, 1, 2000)];
  const copy = [...ts];
  habits(ts);
  assert.deepEqual(ts, copy);
});
