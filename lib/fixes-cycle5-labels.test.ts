// FIXES-CYCLE5 WP4 labels: F5-9 (the /me/record win/loss takeaway names both sides; legal committee 2026-11-02 2f),
// F5-10 (month picks titled by sign; 2d) and F5-12 (the chart subline's date never wraps; committee Round 3 item 7).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { insights, MIN_TRADES, type InsightTrade } from './insights.ts';
import { pickTitles } from './recap.ts';
import { chartRestSub } from './chart-sub.ts';
import { FC5 } from './copy.ts';

const D = new Date('2026-10-01T00:00:00Z');
const tr = (returnPct: number, i: number): InsightTrade => ({ symbol: 'ZZQ', returnPct, holdingDays: 3, closedAt: new Date(D.getTime() + i * 3_600_000) });
const book = (...rs: number[]) => rs.map(tr);
const rep = (n: number, r: number) => Array.from({ length: n }, () => r);
const take = (...rs: number[]) => insights(book(...rs)).winLoss.takeaway;

test('F5-9 (B15): 5 wins, 3 losses and 2 flats → the average win and "3 losses, too few to average" (flats on neither side)', () => {
  assert.equal(take(...rep(5, 0.065), ...rep(3, -0.02), 0, 0), 'Your average win was +6.5%; 3 losses, too few to average.');
  const w = insights(book(...rep(5, 0.065), ...rep(3, -0.02), 0, 0)).winLoss;
  assert.equal(w.wins, 5);
  assert.equal(w.losses, 3);
});

test('F5-9: the mirror, 3 wins and 5 losses (with flats)', () => {
  assert.equal(take(...rep(3, 0.02), ...rep(5, -0.04), 0), 'Your average loss was −4.0%; 3 wins, too few to average.');
});

test('F5-9: singular forms and each "no ..." form, exact', () => {
  assert.equal(take(...rep(5, 0.065), -0.01), 'Your average win was +6.5%; 1 loss, too few to average.');
  assert.equal(take(...rep(5, -0.04), 0.01), 'Your average loss was −4.0%; 1 win, too few to average.');
  assert.equal(take(...rep(5, 0.065)), 'Your average win was +6.5%; no losses.');
  assert.equal(take(...rep(5, 0.065), 0, 0), 'Your average win was +6.5%; no losses.', 'flats are not losses');
  assert.equal(take(...rep(5, -0.04)), 'Your average loss was −4.0%; no wins.');
  assert.equal(take(...rep(5, -0.04), 0), 'Your average loss was −4.0%; no wins.', 'flats are not wins');
});

test('F5-9 (B14, B15): the floor is MIN_TRADES; under it on both sides there is no takeaway; at it on both, both averages', () => {
  assert.equal(MIN_TRADES, 5);
  assert.equal(take(...rep(MIN_TRADES - 1, 0.02), ...rep(MIN_TRADES - 1, -0.02)), null);
  assert.equal(take(0.02, 0.02, -0.02, -0.02), null);
  assert.equal(take(), null);
  assert.equal(take(...rep(MIN_TRADES, 0.065), ...rep(MIN_TRADES, -0.04)), 'Your average win was +6.5% and your average loss was −4.0%.');
  // 5W/0L and 0W/5L are the "no ..." forms above; "no" only for exactly 0.
  assert.doesNotMatch(take(...rep(5, 0.065), -0.01)!, /no losses/);
});

test('F5-9: the sentences come from FC5 and never name one side alone', () => {
  const src = readFileSync(new URL('./insights.ts', import.meta.url), 'utf8');
  assert.match(src, /FC5\.winOnly\(signed\(avgWin\), losses\.length\)/);
  assert.match(src, /FC5\.lossOnly\(signed\(avgLoss\), wins\.length\)/);
  assert.doesNotMatch(src, /`Your average win was \$\{pct\(avgWin\)\}\.`/);
  assert.doesNotMatch(src, /`Your average loss was \$\{pct\(avgLoss\)\}\.`/);
});

const t = (returnPct: number) => ({ returnPct, sellId: String(returnPct) });
const titles = (count: number, best: number, worst: number) => pickTitles({ count, best: t(best), worst: t(worst) }).map((p) => p.title);

test('F5-10: all four sign cases title the picks by what they are', () => {
  assert.deepEqual(titles(5, 0.08, -0.03), ['Best trade', 'Worst trade']);
  assert.deepEqual(titles(5, 0.08, 0.01), ['Best trade', FC5.lowest], 'an all-gain month: never "Worst trade"');
  assert.deepEqual(titles(5, -0.01, -0.09), [FC5.highest, 'Worst trade'], 'an all-loss month: never "Best trade"');
  assert.deepEqual(titles(3, 0, 0), [FC5.highest, FC5.lowest], 'flat: neither best nor worst');
  assert.deepEqual(titles(3, 0.02, 0), ['Best trade', FC5.lowest]);
  assert.deepEqual(titles(3, 0, -0.02), [FC5.highest, 'Worst trade']);
  assert.equal(FC5.highest, 'Highest return');
  assert.equal(FC5.lowest, 'Lowest return');
});

test('F5-10 (B10): one trade is shown once; two trades show no picks (the full list below holds both); the pick is the trade', () => {
  assert.deepEqual(titles(1, 0.02, 0.02), ['Only trade this month']);
  assert.deepEqual(titles(1, -0.02, -0.02), ['Only trade this month']);
  assert.deepEqual(titles(2, 0.05, -0.01), []);
  const best = t(0.04), worst = t(-0.02);
  const p = pickTitles({ count: 7, best, worst });
  assert.equal(p[0].t, best);
  assert.equal(p[1].t, worst);
});

test('F5-10: the month page renders its picks through pickTitles only', () => {
  const page = readFileSync(new URL('../app/u/[handle]/month/[ym]/page.tsx', import.meta.url), 'utf8');
  assert.match(page, /const picks = pickTitles\(m\);/);
  assert.doesNotMatch(page, /title="(Best|Worst) trade"/);
});

const NOW = new Date('2026-11-02T12:00:00Z');
test('F5-12: the subline keeps the date together with non-breaking spaces', () => {
  const s = chartRestSub('All time', Date.parse('2026-11-01T15:00:00Z'), NOW);
  assert.equal(s, 'All time · last close Nov\u00a01');
  assert.ok(s.includes('Nov\u00a01'));
  assert.ok(!s.includes('Nov 1'));
  assert.equal(chartRestSub('1 year', Date.parse('2020-05-30T15:00:00Z'), NOW), '1 year · last close May\u00a030,\u00a02020');
  assert.equal(chartRestSub('All time', 0, NOW), 'All time');
});

test('F5-12 (Round 3 item 7): no literal U+00A0 byte in lib/chart-sub.ts or its tests', () => {
  for (const f of ['./chart-sub.ts', './chart-sub.test.ts', './fixes-cycle5-labels.test.ts']) {
    assert.ok(!readFileSync(new URL(f, import.meta.url), 'utf8').includes(String.fromCharCode(0xa0)), f);
  }
  assert.match(readFileSync(new URL('./chart-sub.ts', import.meta.url), 'utf8'), /\.replace\(\/ \/g, '\\u00a0'\)/);
});

// FIXES-CYCLE5 (legal committee 2026-11-02, B16): the takeaway prints a true minus, never an ASCII hyphen, on every form.
test('F5-9 takeaway: losses print a true minus sign on every form (legal B16)', () => {
  for (const t of [take(...rep(MIN_TRADES, 0.065), ...rep(MIN_TRADES, -0.04)), take(...rep(5, -0.04)), take(...rep(5, -0.04), 0.01)]) {
    assert.ok(t && t.includes('\u2212') && !/-\d/.test(t), `true minus: ${t}`);
  }
});
