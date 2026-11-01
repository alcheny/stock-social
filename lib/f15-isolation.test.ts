// F-15 · the counts are never an input to ordering and never shown: no app/ page or component and no feed code reads the
// rollup. Only the beacon route (through lib/views-route.ts) writes it; only the owner's readout script reads it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const files = (dir: string): string[] => readdirSync(join(root, dir)).flatMap((f) => {
  const p = join(root, dir, f);
  return statSync(p).isDirectory() ? files(relative(root, p)) : /\.tsx?$/.test(f) ? [relative(root, p)] : [];
});
const TABLES = /\bview_(rollup|drops)\b/;
const COUNTER = /from\s+['"][^'"]*lib\/views(-route)?(\.ts)?['"]|from\s+['"]\.\/views(-route)?\.ts['"]/;

test('F-15: no app/ file names the rollup tables, and only the beacon route imports the counter', () => {
  for (const f of files('app')) {
    const src = readFileSync(join(root, f), 'utf8');
    assert.doesNotMatch(src, TABLES, f);
    if (f !== join('app', 'api', 'views', 'route.ts')) assert.doesNotMatch(src, COUNTER, f);
  }
});

test('F-15: feed and ordering code never reads the rollup', () => {
  for (const f of ['lib/feed.ts', ...files('lib').filter((f) => /^lib\/(feed|rank|similar|follows|discovery|suggest|insights)/.test(f) && !/\.test\.ts$/.test(f))]) {
    const src = readFileSync(join(root, f), 'utf8');
    assert.doesNotMatch(src, TABLES, f);
    assert.doesNotMatch(src, COUNTER, f);
  }
});

test('F-15: outside tests, only the counter, the purge and the owner readout name the rollup tables', () => {
  const allowed = new Set(['lib/views.ts', 'lib/views-shared.ts', 'lib/privacy-purge.ts', 'lib/delete.ts', 'lib/privacy-retention.ts', 'scripts/f15-readout.ts', 'scripts/f15-bot-validation.ts']);
  for (const f of [...files('lib'), ...files('app'), ...files('scripts')].filter((f) => !/\.test\.ts$/.test(f))) {
    if (TABLES.test(readFileSync(join(root, f), 'utf8'))) assert.ok(allowed.has(f), f);
  }
});

test('F-15: the beacon is not mounted in app/layout.tsx before F-13 merges (it lives in app/template.tsx)', () => {
  assert.doesNotMatch(readFileSync(join(root, 'app/layout.tsx'), 'utf8'), /ViewBeacon|view-beacon/);
  assert.match(readFileSync(join(root, 'app/template.tsx'), 'utf8'), /<ViewBeacon \/>/);
});
