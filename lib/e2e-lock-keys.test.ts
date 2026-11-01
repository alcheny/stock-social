// OPTIONS fix round 5 (final review blocking 2): every e2e advisory lock has its own key. Two locks on one key make a
// spec that holds one wait on itself when it takes the other (connect.spec.ts held the vendor lock and its tick() took
// the cron lock on the same key). Reads each lock file's key as declared and checks the keys are distinct.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

test('e2e lock keys are distinct', () => {
  const dir = new URL('../e2e/', import.meta.url);
  const keys = new Map<string, string>();
  for (const f of readdirSync(dir).filter((f) => /-lock\.ts$/.test(f))) {
    const src = readFileSync(new URL(f, dir), 'utf8');
    const decl = [...src.matchAll(/const ([A-Z_]+_LOCK) = ([\d_]+);/g)];
    assert.ok(decl.length >= 1, `${f} declares its key`);
    for (const [, name, n] of decl) {
      const key = String(Number(n.replace(/_/g, '')));
      assert.ok(!keys.has(key), `${f}: ${name} = ${key} is also ${keys.get(key)}`);
      keys.set(key, `${f}#${name}`);
    }
  }
  assert.ok(keys.size >= 3, [...keys.values()].join(', ')); // feed, cron and vendor locks
});

test('the vendor lock uses its own key at run time', async () => {
  const { VENDOR_LOCK } = await import('../e2e/vendor-lock.ts');
  const cron = readFileSync(new URL('../e2e/cron-lock.ts', import.meta.url), 'utf8').match(/const CRON_LOCK = ([\d_]+);/)![1].replace(/_/g, '');
  const feed = readFileSync(new URL('../e2e/feed-lock.ts', import.meta.url), 'utf8').match(/const FEED_LOCK = ([\d_]+);/)![1].replace(/_/g, '');
  assert.ok(![Number(cron), Number(feed)].includes(VENDOR_LOCK));
});
