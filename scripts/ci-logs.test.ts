// The fix task's CI log (scripts/autopilot.ts → tailPerJob): with several failed jobs (e2e shards), each keeps its tail.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tailPerJob } from './autopilot.ts';

test('fix-task logs: the last n lines of every failed job, in job order, not only of the last job', () => {
  const job = (name: string, count: number) => Array.from({ length: count }, (_, i) => `${name}\tRun playwright\tline ${i}`);
  const log = [...job('e2e (1)', 300), ...job('e2e (3)', 5), ...job('check', 3)].join('\n');
  const out = tailPerJob(log, 250).split('\n');
  assert.equal(out.length, 250 + 5 + 3);
  assert.equal(out[0], 'e2e (1)\tRun playwright\tline 50');
  assert.equal(out[249], 'e2e (1)\tRun playwright\tline 299'); // shard 1's failure summary survives
  assert.deepEqual(out.slice(250, 255), job('e2e (3)', 5));
  assert.deepEqual(out.slice(-3), job('check', 3));
});

test('fix-task logs: a log without job prefixes is tailed as one block, and an empty log stays empty', () => {
  assert.equal(tailPerJob(['a', 'b', 'c'].join('\n'), 2), 'b\nc');
  assert.equal(tailPerJob('', 5), '');
});
