// F-1 PR-2b fix round 2 (engineer, Low): the import poll's per-trader minimum interval.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { minInterval } from './rate-limit.ts';

test('minInterval: one call per key per interval; other keys are independent; the map stays bounded', () => {
  const allow = minInterval(1_000, 3);
  assert.equal(allow('u1', 10_000), true);
  assert.equal(allow('u1', 10_500), false);
  assert.equal(allow('u1', 10_999), false);
  assert.equal(allow('u2', 10_999), true); // another trader
  assert.equal(allow('u1', 11_000), true); // a second later
  assert.equal(allow('u1', 11_000), false); // parallel calls in the same instant: one only
  for (let i = 0; i < 50; i++) allow(`k${i}`, 20_000 + i * 2_000);
  assert.equal(allow('k49', 20_000 + 49 * 2_000 + 1), false); // the newest entry survives the pruning
});

test('the step route answers 429 with Retry-After at most once a second per trader, 401 signed out, and no-store on every answer', () => {
  const src = readFileSync(new URL('../app/api/import/step/route.ts', import.meta.url), 'utf8');
  assert.match(src, /const STEP_MIN_MS = 1_000/);
  assert.match(src, /status: 429, headers: \{ \.\.\.noStore, 'retry-after': '1' \}/);
  assert.match(src, /status: 401, headers: noStore/);
  assert.match(src, /\{ headers: noStore \}\);/);
});
