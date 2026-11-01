// lib/test-sweep-lock.ts: test files call the global connection tick only inside `sweeping`, and the lock keeps the
// ticks (shared, overlapping each other) and a test's backdated import (exclusive) apart.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { sweeping, unswept } from './test-sweep-lock.ts';

const hasDb = !!process.env.DATABASE_URL;
const root = new URL('..', import.meta.url).pathname;
after(async () => { if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 }); });

const testFiles = (dir: string): string[] => readdirSync(join(root, dir), { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? (e.name === 'node_modules' || e.name.startsWith('.') ? [] : testFiles(join(dir, e.name)))
    : /\.(test|spec)\.tsx?$/.test(e.name) ? [relative(root, join(root, dir, e.name))] : []);

test('no test file takes the connection tick from lib/connections.ts except through `sweeping`', () => {
  const files = ['lib', 'app', 'scripts', 'e2e'].flatMap(testFiles);
  // The tick named in a destructuring or a named import of the module, or called on the module itself.
  const named = /\{[^}]*\btick\b[^}]*\}\s*(=\s*await\s+import\(\s*['"][./a-z]*connections\.ts['"]\s*\)|from\s+['"][./a-z]*connections\.ts['"])/;
  const called = /connections\.ts['"]\s*\)\s*\)\s*\.tick\(/;
  const callers = files.filter((f) => called.test(readFileSync(join(root, f), 'utf8')));
  assert.ok(callers.includes('lib/connections.test.ts'), 'lib/connections.test.ts calls the tick through its wrapper');
  for (const f of files) {
    const src = readFileSync(join(root, f), 'utf8');
    assert.doesNotMatch(src, named, `${f} takes tick from lib/connections.ts: call it inside sweeping() (lib/test-sweep-lock.ts)`);
    if (called.test(src)) assert.match(src, /sweeping\(async \(\) => \(await import\(['"]\.\/connections\.ts['"]\)\)\.tick\(/, `${f} calls the tick outside sweeping()`);
  }
});

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const gate = () => { let open!: () => void; const p = new Promise<void>((r) => (open = r)); return { p, open }; };

test('the lock: an exclusive holder keeps sweeps out until it ends; sweeps overlap each other and keep an exclusive holder waiting', { skip: !hasDb && 'no DATABASE_URL' }, async () => {
  const order: string[] = [];
  // Exclusive first: a sweep that starts meanwhile waits for it.
  const g1 = gate(), held = gate();
  const ex = unswept(async () => { order.push('exclusive'); held.open(); await g1.p; order.push('exclusive ends'); });
  await held.p;
  const sw = sweeping(async () => { order.push('sweep'); });
  await wait(300);
  assert.deepEqual(order, ['exclusive'], 'the sweep waited');
  g1.open();
  await Promise.all([ex, sw]);
  assert.deepEqual(order, ['exclusive', 'exclusive ends', 'sweep']);

  // Two sweeps at once both run; an exclusive holder that starts meanwhile waits for both to end.
  order.length = 0;
  const g2 = gate(), both = gate();
  let inside = 0;
  const sweep = () => sweeping(async () => { inside++; if (inside === 2) both.open(); await g2.p; order.push('sweep ends'); });
  const s1 = sweep(), s2 = sweep();
  await both.p;
  const ex2 = unswept(async () => { order.push('exclusive'); });
  await wait(300);
  assert.deepEqual(order, [], 'the exclusive holder waited for the sweeps');
  g2.open();
  await Promise.all([s1, s2, ex2]);
  assert.deepEqual(order, ['sweep ends', 'sweep ends', 'exclusive']);

  // A throw inside still releases the lock (the next exclusive holder gets it at once).
  await assert.rejects(unswept(async () => { throw new Error('inside'); }), /inside/);
  await assert.rejects(sweeping(async () => { throw new Error('inside'); }), /inside/);
  assert.equal(await unswept(async () => 'free'), 'free');
});
