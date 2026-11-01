// F-6 · the realized / unrealized / combined split (lib/open-split.ts), acceptance criteria 3, 4, 5 and 6.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openSummary, split, tone, toneClass } from './open-split.ts';
import { headline } from './trades.ts';

const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-12, `${a} ≈ ${b}`);

test('F-6 split: no open positions gives exactly the realized headline and nothing else (AC3)', () => {
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  for (let k = 0; k < 50; k++) {
    const closed = Array.from({ length: 1 + Math.floor(rnd() * 40) }, () => rnd() * 0.6 - 0.3);
    const s = split(closed, []);
    assert.equal(s.open, null);
    assert.equal(s.combined, null);
    assert.deepEqual(s.realized, { n: closed.length, ...headline(closed.map((returnPct) => ({ returnPct }))) });
  }
  assert.deepEqual(split([], []), { realized: null, open: null, combined: null });
});

test('F-6 split: all open positions winning', () => {
  const s = split([0.1, -0.05], [0.2, 0.04, 0.1]);
  assert.deepEqual({ ...s.open!, avg: 0 }, { n: 3, up: 3, down: 0, flat: 0, avg: 0 });
  close(s.open!.avg, 0.34 / 3);
  assert.equal(s.combined!.n, 5);
  close(s.combined!.winRate, 4 / 5);
  close(s.combined!.avgReturn, (0.1 - 0.05 + 0.34) / 5);
});

test('F-6 split: all open positions losing are counted down, with the combined figure pulled below realized (AC4)', () => {
  const closed = [0.1, 0.08, 0.12];
  const s = split(closed, [-0.3, -0.2, -0.25, -0.15, -0.25]);
  assert.deepEqual({ ...s.open!, avg: 0 }, { n: 5, up: 0, down: 5, flat: 0, avg: 0 });
  close(s.open!.avg, -0.23);
  assert.equal(tone(s.open!.avg), 'down');
  assert.equal(toneClass(tone(s.open!.avg)), 'down');
  close(s.realized!.winRate, 1);
  close(s.combined!.winRate, 3 / 8);
  assert.ok(s.combined!.avgReturn < 0 && s.realized!.avgReturn > 0);
});

test('F-6 split: mixed record, hand-computed (20 closes avg +5%, 6 open avg -23% gives -1.46% over 26)', () => {
  const closed = Array.from({ length: 20 }, (_, i) => (i % 2 ? 0.15 : -0.05)); // 10 wins, avg +5%
  const open = [0.04, -0.3, -0.3, -0.3, -0.3, -0.22]; // avg -23%, 1 up
  const s = split(closed, open);
  close(s.realized!.avgReturn, 0.05);
  close(s.realized!.winRate, 0.5);
  close(s.open!.avg, -0.23);
  assert.equal(s.open!.up, 1);
  assert.equal(s.open!.down, 5);
  close(s.combined!.avgReturn, (20 * 0.05 + 6 * -0.23) / 26);
  assert.equal(Math.round(s.combined!.avgReturn * 10000) / 100, -1.46);
  close(s.combined!.winRate, 11 / 26);
});

test('F-6 split: open positions and no closes have no realized and no combined figure', () => {
  const s = split([], [-0.1, 0.05]);
  assert.equal(s.realized, null);
  assert.equal(s.combined, null);
  assert.equal(s.open!.n, 2);
  close(s.open!.avg, -0.025);
});

test('F-6 split: one symbol in two accounts is two positions; a value printed as 0.0% is flat', () => {
  const o = openSummary([-0.0004, 0.0004, 0.12, 0.12])!;
  assert.deepEqual({ ...o, avg: 0 }, { n: 4, up: 2, down: 0, flat: 2, avg: 0 });
  assert.equal(tone(-0.0004), 'flat');
  assert.equal(tone(0.0005), 'up');
  assert.equal(tone(-0.0005), 'down');
  assert.equal(toneClass('flat'), '');
  assert.equal(openSummary([]), null);
  assert.equal(openSummary([Number.NaN]), null, 'a non-finite value is never a position');
});
