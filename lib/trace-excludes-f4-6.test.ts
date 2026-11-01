// F4-6 half (1) (cycle 4 fixes, C4-3): keep the repository out of the server functions. lib/moderation.ts imports
// the scanner's word list from scripts/compliance.ts, whose fs reads make the file tracer pull docs/, e2e/, team/ and the
// root Markdown into every route that has a server action (130-160 MB per function). next.config.ts excludes them from
// every trace. (1) pins the exclude set with Next's own matcher and semantics (route keys: picomatch with dot+contains
// against the route path; values: globs joined onto the project root, matched against absolute paths), and (2) checks
// a real build's traces when one exists.
// ponytail: half (2), moving the word list into its own lib/ module so the scanner leaves the server graph, needs the
// owner (scripts/compliance.ts is protected) — then the excludes stay as a backstop.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import config from '../next.config.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(import.meta.url);
const picomatch = require('next/dist/compiled/picomatch');

const excludes = (config.outputFileTracingExcludes ?? {}) as Record<string, string[]>;
// What Next applies to one route (node_modules/next/dist/build/collect-build-traces.js, apply-include-excludes).
function excludedFor(route: string): string[] {
  return Object.keys(excludes).filter((k) => picomatch(k, { dot: true, contains: true })(route)).flatMap((k) => excludes[k]);
}
function isExcluded(route: string, file: string): boolean {
  const globs = excludedFor(route).map((g) => join(ROOT, g));
  return globs.length > 0 && picomatch(globs, { dot: true, contains: true })(join(ROOT, file));
}

const ROUTES = ['/', '/u/[handle]', '/u/[handle]/trade/[sellId]', '/u/[handle]/month/[ym]', '/t/[symbol]', '/me/record',
  '/login/dev', '/review/theses'];

test('F4-6: next.config.ts excludes docs/, e2e/, team/ and the root Markdown from every server route trace', () => {
  assert.ok(Object.keys(excludes).length > 0, 'next.config.ts has no outputFileTracingExcludes');
  for (const route of ROUTES) {
    for (const file of ['docs/POLICY.md', 'docs/direction/cycle4-2026-11-01.md', 'docs/specs/x/y.json', 'e2e/feed.spec.ts',
      'e2e/fixtures/a.json', 'team/engineer.md', 'AGENTS.md', 'CLAUDE.md', 'SECURITY.md', 'README.md']) {
      assert.ok(isExcluded(route, file), `${file} is still traced into ${route}`);
    }
  }
});

test('F4-6: the exclude set is narrow: runtime code, the schema and dependencies stay in the trace', () => {
  for (const route of ROUTES) {
    for (const file of ['lib/moderation.ts', 'lib/copy.ts', 'app/page.tsx', 'app/u/[handle]/page.tsx', 'db/schema.sql',
      'scripts/compliance.ts', 'proxy.ts', 'package.json', '.next/server/app/page.js', 'node_modules/next/package.json',
      'node_modules/next/README.md', 'node_modules/@img/sharp-linux-x64/lib/libvips.so', 'lib/notes.md', 'app/docs/page.tsx']) {
      assert.ok(!isExcluded(route, file), `${file} would be dropped from ${route}'s trace`);
    }
  }
  // Every value is anchored at the project root (no "**/" prefix that would also reach node_modules or lib/).
  for (const globs of Object.values(excludes)) for (const g of globs) assert.match(g, /^\.\/(?!\*\*)/, `unanchored glob ${g}`);
});

// (2) A production build's traces. Runs when `.next` holds a production build at least as new as next.config.ts;
// CI and a local `npm run build` both produce one.
const NEXT = join(ROOT, '.next');
const buildId = join(NEXT, 'BUILD_ID');
const skip = !existsSync(buildId) ? 'no production build in .next (run `npm run build` to check the traces)'
  : statSync(buildId).mtimeMs < statSync(join(ROOT, 'next.config.ts')).mtimeMs ? 'the .next build predates next.config.ts; rebuild to check'
  : false;

function traces(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) traces(p, out); else if (e.name.endsWith('.nft.json')) out.push(p);
  }
  return out;
}

test('F4-6: no built server trace lists a path under docs/, e2e/ or team/ (or the root Markdown)', { skip }, (t) => {
  const files = traces(join(NEXT, 'server'));
  assert.ok(files.length > 0, 'the build has no .nft.json traces');
  const bad: string[] = [];
  const sizes: [string, number][] = [];
  for (const f of files) {
    const listed: string[] = JSON.parse(readFileSync(f, 'utf8')).files;
    let bytes = 0;
    for (const r of listed) {
      const abs = resolve(join(f, '..'), r);
      const rel = relative(ROOT, abs).split(sep).join('/');
      try { bytes += statSync(abs).size; } catch { /* a traced path that is gone counts 0 */ }
      if (/^(docs|e2e|team)\//.test(rel) || /^[^/]+\.md$/.test(rel)) bad.push(`${relative(NEXT, f)}: ${rel}`);
    }
    sizes.push([relative(NEXT, f), bytes]);
  }
  assert.deepEqual(bad.slice(0, 20), [], `${bad.length} repository paths traced into server functions`);
  // ponytail: no size ceiling is asserted (the host's 250 MB unzipped limit is far off once docs/ is out) — add one
  // here if a dependency starts to push a function near it.
  for (const [f, b] of sizes.sort((a, b) => b[1] - a[1]).slice(0, 3)) t.diagnostic(`${f}: ${(b / 1e6).toFixed(1)} MB`);
});
