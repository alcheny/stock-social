// FIXES-LABELS (D-05, code review): the chart's at-rest subline never prints the epoch for a record with no last close.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chartRestSub } from './chart-sub.ts';
import { chartSeries } from './chart-series.ts';

const NOW = new Date('2026-11-01T12:00:00Z');

test('no last close (t1 0, absent, NaN) → the plain range label; a last close → "‹range› · last close ‹date›"', () => {
  for (const t1 of [0, undefined, null, Number.NaN, -1]) assert.equal(chartRestSub('All time', t1, NOW), 'All time');
  assert.equal(chartRestSub('All time', Date.parse('2026-10-20T15:00:00Z'), NOW), 'All time · last close Oct\u00a020' /* FIXES-CYCLE5 (F5-12): the date's spaces are non-breaking */);
  assert.equal(chartRestSub('1 year', Date.parse('2020-05-30T15:00:00Z'), NOW), '1 year · last close May\u00a030,\u00a02020');
  // The series of an empty record: t1 is 0, so the subline is the label, never 1970.
  const empty = chartSeries([], 'ALL', NOW);
  assert.doesNotMatch(chartRestSub('All time', empty.t1, NOW), /1970|last close/);
});

test('the chart renders its at-rest subline through chartRestSub', () => {
  const src = readFileSync(new URL('../app/u/[handle]/chart.tsx', import.meta.url), 'utf8');
  assert.match(src, /chartRestSub\(spec\.label, allT1, now\)/);
  assert.doesNotMatch(src, /FL\.chartSub\(/);
});
