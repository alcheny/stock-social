// F-32 Part A: the deploy rebuild's report is counts per reason only (lib/matcher-report.ts).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addMoves, movesLine, noCounts, REPORT_REASONS } from './matcher-report.ts';

test('addMoves sums each record\'s change per reason; the line carries the version and the counts, nothing else', () => {
  const report = noCounts();
  addMoves(report, { shown: 5, excluded: 0, corporate: 1, transfer: 0, held: 0, out: 0, partly: 0 }, { shown: 5, excluded: 0, corporate: 0, transfer: 1, held: 0, out: 1, partly: 0 });
  addMoves(report, { shown: 3, excluded: 1, corporate: 0, transfer: 0, held: 0, out: 0, partly: 0 }, { shown: 2, excluded: 1, corporate: 1, transfer: 0, held: 0, out: 0, partly: 1 });
  assert.deepEqual(report, { shown: -1, excluded: 0, corporate: 0, transfer: 1, held: 0, out: 1, partly: 1 });
  const line = movesLine(3, report);
  assert.equal(line, 'matcher rebuild: moves per reason {"version":3,"shown":-1,"excluded":0,"corporate":0,"transfer":1,"held":0,"out":1,"partly":1}');
  assert.deepEqual(Object.keys(JSON.parse(line.slice(line.indexOf('{')))), ['version', ...REPORT_REASONS]);
});
