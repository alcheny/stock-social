// F-2 PR-1 (plan demand A): the pure discovery modules can't read the database, the session or one viewer's data.
// The test walks their import graph. app/page.tsx is not in it (the behavioral guard covers the page's queries).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const ROOTS = ['lib/discovery/diversity.ts', 'lib/discovery/explore.ts', 'lib/discovery/pager.ts',
  // F-2 PR-2: added cases (the hide filter and the owner's weights are pure too).
  'lib/discovery/exclusions.ts', 'lib/discovery/weights.ts',
  // F-2 PR-3: added cases (the suggestions section and the reject swipe's recognizer are pure too).
  'lib/discovery/section.ts', 'lib/discovery/reject.ts'];
// Modules that reach the database, the session cookie or a request's identity.
const FORBIDDEN = new Set(['lib/db.ts', 'lib/session.ts', 'postgres', 'next/headers', 'next/server', 'lib/connections.ts', 'lib/feed.ts']);

function specifiers(src: string): string[] {
  const out: string[] = [];
  for (const m of src.matchAll(/(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|import\s+['"]([^'"]+)['"]/g)) out.push(m[1] ?? m[2] ?? m[3]);
  return out;
}

function graph(start: string): Set<string> {
  const seen = new Set<string>();
  const walk = (file: string) => {
    if (seen.has(file)) return;
    seen.add(file);
    if (!file.startsWith('lib/') && !file.startsWith('app/')) return; // a package: a leaf
    for (const s of specifiers(readFileSync(resolve(root, file), 'utf8'))) {
      if (s.startsWith('.') || s.startsWith('@/')) {
        const abs = s.startsWith('@/') ? resolve(root, s.slice(2)) : resolve(root, dirname(file), s);
        assert.ok(existsSync(abs), `${file} imports ${s}, which does not exist`);
        walk(relative(root, abs));
      } else walk(s.startsWith('node:') ? s : s.split('/').slice(0, s.startsWith('@') ? 2 : s.startsWith('next/') ? 2 : 1).join('/'));
    }
  };
  walk(start);
  return seen;
}

test('the walker sees imports (it finds lib/db.ts behind lib/feed.ts)', () => {
  assert.ok(graph('lib/feed.ts').has('lib/db.ts'));
  assert.ok(graph('lib/feed.ts').has('postgres'));
});

for (const file of ROOTS) {
  test(`${file} imports nothing that reads the database, the session or one viewer's data`, () => {
    assert.ok(existsSync(resolve(root, file)), `${file} exists`);
    const g = graph(file);
    const bad = [...g].filter((m) => FORBIDDEN.has(m));
    assert.deepEqual(bad, [], `${file} reaches ${bad.join(', ')}`);
    // Only other pure discovery modules and node built-ins.
    for (const m of g) assert.ok(m.startsWith('lib/discovery/') || m.startsWith('node:'), `${file} imports ${m}`);
  });
}
