// F-6 · open positions beside the realized record (lib/open-split.ts, OPEN in lib/copy.ts): acceptance criteria 3, 4,
// 5 and 6 (docs/features/logs/F-6/plan.md §7).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { combined, openSummary, tone } from './open-split.ts';
import { OPEN } from './copy.ts';
import { pct } from './trades.ts';

const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-12, `${a} ≈ ${b}`);
const counts = (o: ReturnType<typeof openSummary>) => o && { n: o.n, up: o.up, down: o.down, flat: o.flat };

test('F-6: no open positions gives no open summary and no combined figure (AC3: realized-only stays as today)', () => {
  assert.equal(openSummary([]), null);
  assert.equal(combined([0.1, -0.2, 0.05], []), null);
  assert.equal(combined([], []), null);
});

test('F-6: all open positions winning', () => {
  const o = openSummary([0.2, 0.04, 0.1])!;
  assert.deepEqual(counts(o), { n: 3, up: 3, down: 0, flat: 0 });
  close(o.avg, 0.34 / 3);
  assert.equal(OPEN.line(o, pct), '3 open positions · 3 up, 0 down · +11.3% avg unrealized');
  const c = combined([0.1, -0.05], [0.2, 0.04, 0.1])!;
  assert.equal(c.n, 5);
  close(c.avg, (0.1 - 0.05 + 0.34) / 5);
});

test('F-6: all open positions losing read down, with "0 up" printed, and pull the combined average below realized (AC4)', () => {
  const open = [-0.3, -0.2, -0.25, -0.15, -0.25];
  const o = openSummary(open)!;
  assert.deepEqual(counts(o), { n: 5, up: 0, down: 5, flat: 0 });
  close(o.avg, -0.23);
  assert.equal(tone(o.avg), 'down');
  assert.equal(OPEN.line(o, pct), '5 open positions · 0 up, 5 down · -23.0% avg unrealized');
  assert.ok(combined([0.1, 0.08, 0.12], open)!.avg < 0);
});

test('F-6: mixed record, hand-computed (20 closes avg +5% and 6 open avg -23% give -1.46% over 26 results)', () => {
  const closed = Array.from({ length: 20 }, (_, i) => (i % 2 ? 0.15 : -0.05));
  const open = [0.04, -0.3, -0.3, -0.3, -0.3, -0.22];
  const o = openSummary(open)!;
  assert.deepEqual(counts(o), { n: 6, up: 1, down: 5, flat: 0 });
  close(o.avg, -0.23);
  const c = combined(closed, open)!;
  assert.equal(c.n, 26);
  close(c.avg, (20 * 0.05 + 6 * -0.23) / 26);
  assert.equal(`${OPEN.combinedLabel} ${pct(c.avg)}${OPEN.combinedTail(c.n)}`, 'Including open positions at current value: -1.5% avg / result (26 results)');
});

test('F-6: open positions and no closes have an open summary but no combined figure', () => {
  const o = openSummary([-0.04])!;
  assert.equal(o.n, 1);
  assert.equal(combined([], [-0.04]), null);
  assert.equal(OPEN.line(o, pct), '1 open position · 0 up, 1 down · -4.0% unrealized');
});

test('F-6: one symbol in two accounts is two positions; a value printed as 0.0% is flat and named', () => {
  const o = openSummary([-0.0004, 0.0004, 0.12, 0.12])!;
  assert.deepEqual(counts(o), { n: 4, up: 2, down: 0, flat: 2 });
  assert.equal(OPEN.line(o, pct), '4 open positions · 2 up, 0 down, 2 flat · +6.0% avg unrealized');
  assert.equal(openSummary([Number.NaN]), null, 'a non-finite value is never a position');
});

test('F-6: tone agrees with the sign pct() prints, over 1,000 seeded values including near -100%', () => {
  let seed = 11;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  const xs = [...Array.from({ length: 900 }, () => (rnd() - 0.5) * (rnd() < 0.5 ? 0.01 : 3)), ...Array.from({ length: 100 }, () => -1 + rnd() * 0.002)];
  for (const x of xs) {
    const s = pct(x);
    const want = s.startsWith('+') ? 'up' : /^≈?-/.test(s) ? 'down' : 'flat';
    assert.equal(tone(x), want, `${x} → ${s}`);
  }
});

test('F-6 (AC5, POLICY P3/F1): open copy is percent and counts only, with no advice words; the module holds no copy', () => {
  const o = { n: 3, up: 1, down: 1, flat: 1, avg: -0.05 };
  const out = [OPEN.line(o, pct), OPEN.positions(o), OPEN.feedCounts(o), OPEN.feedTail(3), OPEN.combinedTail(9), OPEN.tickerTitle('ABC'),
    OPEN.tickerTraders(2), OPEN.compare('x'), OPEN.asOf('Nov 1, 2026'), ...Object.values(OPEN).filter((v) => typeof v === 'string'), ...OPEN.how];
  // lib/copy.test.ts's banned-claims list, plus advice words and amounts.
  const BANNED = [/\bendorse[sd]?\b/i, /\brecommend(ed|s|ation)?\b/i, /\bguarantee[sd]?\b/i, /\bsecure\b/i, /\bsafe\b/i, /\$|\bbuy\b|\bsell\b|\bhold\b|\bsignal|\byet\b|units|price/i];
  for (const s of out) for (const re of BANNED) assert.doesNotMatch(s, re, s);
  const src = readFileSync(new URL('./open-split.ts', import.meta.url), 'utf8').replace(/\/\/.*$/gm, '');
  const literals = [...src.matchAll(/'([^']*)'/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(literals)].sort(), ['down', 'flat', 'up']);
});
