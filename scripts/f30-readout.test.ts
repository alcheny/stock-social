// F-30's residual readout row (docs/features/F-30-same-instant-order-on-date-only-stamps.md, decision 2026-11-01; the
// approval council cycle 5 routed it to the chore lane): a counts-only class count of same-instant open-and-close events
// by stamp pattern (00:00:00Z, other whole hours, intraday), under F-31's limits block, each count under 5 read "<5".
// Pure: the classifier, the sums, the suppression and the placement. scripts/f30-readout.db.test.ts runs the loader.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LIMITS_HEADING, LIMIT_LINES, STAMP_HEADING, STAMP_LINE, STAMP_ROWS, buildReadout, factsHeading, stampClass, stampCounts, stampLines,
  weekWindow, type ReadoutInput,
} from './f15-readout.ts';
import { BASE_NOW, baseInput } from './f31-readout-baseline.test.ts';

const NOW = new Date('2026-11-01T12:00:00Z');
const cellsOf = (line: string | undefined) => (line ?? '').slice(1, -1).split('|').map((c) => c.trim());
const rowLine = (md: string, label: string) => md.split('\n').find((l) => l.startsWith(`| ${label} |`));
const counts = (md: string) => STAMP_ROWS.map(([, label]) => cellsOf(rowLine(md, label))[1]);
const empty = (extra: Partial<ReadoutInput> = {}): ReadoutInput =>
  ({ rollup: [], drops: [], g1: { strict: 0, partial: 0 }, g2: { traders: [], firstDay: null, retentionDays: 120 }, ...extra });

test('F-30 readout: stampClass puts 00:00:00Z, other whole hours and every other stamp in three classes', () => {
  for (const c of ['00:00:00', '00:00:00.000000', '00:00:00.0']) assert.equal(stampClass(c), 'midnight', c);
  for (const c of ['01:00:00.000000', '05:00:00', '23:00:00.000000', '12:00:00.000']) assert.equal(stampClass(c), 'hour', c);
  for (const c of ['00:00:00.000001', '00:00:01.000000', '00:01:00.000000', '00:30:00', '14:37:12.123456', '23:59:59.999999', '05:00:00.5'])
    assert.equal(stampClass(c), 'intraday', c);
  for (const c of ['', '24:00:00', '1:00:00', '00:00', '00:00:00Z', 'AAPL', null, undefined, 0]) assert.equal(stampClass(c), null, String(c));
});

test('F-30 readout: stampCounts sums events per class and skips an unknown clock or a bad count', () => {
  assert.deepEqual(stampCounts([
    { clock: '00:00:00.000000', n: 3 }, { clock: '00:00:00.000000', n: 4 }, { clock: '05:00:00.000000', n: 2 },
    { clock: '14:37:12.123456', n: 9 }, { clock: 'bad', n: 50 }, { clock: '07:00:00.000000', n: -2 }, { clock: '08:00:00.000000', n: Number.NaN },
  ]), { midnight: 7, hour: 2, intraday: 9 });
  assert.deepEqual(stampCounts(undefined), { midnight: 0, hour: 0, intraday: 0 });
});

test('F-30 readout: each class count from 1 to 4 reads "<5" on its own; 0 and 5+ print exactly; no total', () => {
  const md = buildReadout(empty({ stamps: { midnight: 3, hour: 7, intraday: 1_204 } }), NOW);
  assert.deepEqual(counts(md), ['<5', '7', '1,204']);
  assert.deepEqual(counts(buildReadout(empty({ stamps: { midnight: 0, hour: 4, intraday: 5 } }), NOW)), ['0', '<5', '5']);
  assert.deepEqual(counts(buildReadout(empty(), NOW)), ['0', '0', '0'], 'absent reads as zeros');
  const lines = stampLines({ midnight: 1, hour: 2, intraday: 3 }).join('\n').split('\n');
  assert.ok(!lines.some((l) => /total/i.test(l)), 'no total row');
  assert.deepEqual(lines.filter((l) => l.startsWith('| ') && !l.startsWith('| Stamp')).map((l) => cellsOf(l)[1]), ['<5', '<5', '<5']);
});

test('F-30 readout: the row sits under F-31\'s limits block (after its facts lines) and before the first G-row', () => {
  const { mondays } = weekWindow(NOW);
  assert.equal(BASE_NOW.getTime(), NOW.getTime(), 'the baseline run prints the same weeks');
  for (const md of [buildReadout(empty({ stamps: { midnight: 9, hour: 0, intraday: 6 } }), NOW), buildReadout(baseInput(), BASE_NOW), buildReadout({} as ReadoutInput, NOW)]) {
    const limits = md.indexOf(`\n${LIMITS_HEADING}\n`), lastLimit = md.indexOf(`\n${LIMIT_LINES.at(-1)}\n`);
    const facts = md.indexOf(`\n${factsHeading(mondays[7])}\n`), head = md.indexOf(`\n${STAMP_HEADING}\n`), g1 = md.indexOf('\n## G1\n');
    assert.ok(limits > 0 && lastLimit > limits && facts > lastLimit, 'the limits block is unchanged');
    assert.ok(head > facts && head < g1, 'under the limits block, before ## G1');
    assert.ok(md.indexOf(`\n${STAMP_LINE}\n`) > head && md.indexOf(`\n${STAMP_LINE}\n`) < g1);
    for (const [, label] of STAMP_ROWS) { const at = md.indexOf(`\n| ${label} |`); assert.ok(at > head && at < g1, label); }
  }
});

test('F-30 readout: the row names no id, handle or symbol: its only cells are the three fixed labels and counts', () => {
  const lines = stampLines({ midnight: 12, hour: 0, intraday: 40 }).join('\n').split('\n');
  const cells = lines.filter((l) => l.startsWith('|') && !/^\|(-+\|)+$/.test(l)).flatMap(cellsOf);
  assert.deepEqual(cells, ['Stamp pattern', 'Events', '00:00:00Z', '12', 'other whole hours (UTC)', '0', 'intraday', '40']);
  assert.match(STAMP_LINE, /no id, handle or symbol/);
  assert.match(STAMP_LINE, /"<5"/);
});
