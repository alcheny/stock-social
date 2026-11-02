// F-33 AC9: after a deploy (or any code change a long-lived process picks up) no weight from the old formula is served.
// The per-process weight cache's key carries lib/confidence.ts#RANK_FORMULA; no weight is stored anywhere else.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { clearFeedCache, weightCacheGet, weightCacheSet, weightKey } from './feed.ts';
import { RANK_FORMULA } from './confidence.ts';

const p = { n: 40, m: '9001', k: 40 };
const facts = (weight: number) => ({ weight, hold: 2, n: 40 });

test('F-33 AC9: the weight cache key carries the formula; an old-formula entry is never served', () => {
  const id = 990_033;
  try {
    assert.ok(weightKey(id, p).startsWith(`${RANK_FORMULA}|`));
    assert.notEqual(weightKey(id, p, 'f-old'), weightKey(id, p));
    weightCacheSet(weightKey(id, p, 'f-old'), facts(0.299));
    assert.equal(weightCacheGet(weightKey(id, p)), undefined, 'the old formula\'s weight is a miss under the current key');
    weightCacheSet(weightKey(id, p), facts(0.1));
    assert.equal(weightCacheGet(weightKey(id, p))!.weight, 0.1);
    // The same trader with a changed record (one more close) is a new key too.
    assert.equal(weightCacheGet(weightKey(id, { ...p, n: 41 })), undefined);
  } finally {
    clearFeedCache('all');
  }
});

test('F-33 AC9: weights() builds every key through weightKey and computes with rankWeight; no weight is stored in the database', () => {
  const src = readFileSync(new URL('./feed.ts', import.meta.url), 'utf8');
  const body = src.slice(src.indexOf('async function weights('), src.indexOf('export async function feedList('));
  assert.match(body, /weightKey\(id, p\)/);
  assert.match(body, /rankWeight\(ts\)/);
  assert.doesNotMatch(body, /`\$\{id\}:/, 'no hand-built key without the formula');
  assert.doesNotMatch(body, /weightCache\.(get|set)\(/, 'reads and writes go through the keyed helpers');
  assert.doesNotMatch(src, /evidenceWeight/);
  const schema = readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8').replace(/--.*$/gm, '');
  assert.doesNotMatch(schema, /weight/i, 'no stored weight column (comments aside)');
});
