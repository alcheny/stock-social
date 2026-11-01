// Fix #2 (approval council cycle 2): the route table covers the app tree exactly, every performance screen renders the
// shared Disclaimer, every share image renders DISCLAIMER, and every pending entry names its owner and a ponytail.
// Fix #21: every page exports its own title (metadata or generateMetadata).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ROUTES, routesOf, walkRoutes } from './disclaimer-routes.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const src = (f: string) => readFileSync(`${root}${f}`, 'utf8');

test('every route in app/ is classified, and every entry is a real route', () => {
  const tree = walkRoutes(`${root}app`);
  assert.ok(tree.length > 30, 'walker found the app');
  const table = Object.keys(ROUTES).sort();
  assert.deepEqual(tree.filter((r) => !(r in ROUTES)), [], 'unclassified routes: add each to lib/disclaimer-routes.ts');
  assert.deepEqual(table.filter((r) => !tree.includes(r)), [], 'stale entries: the route is gone or renamed');
});

test('walkRoutes: groups add no segment, private folders and non-route files are skipped', async () => {
  const { mkdtempSync, mkdirSync, writeFileSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const d = mkdtempSync(`${tmpdir()}/routes-`);
  for (const f of ['page.tsx', '(g)/x/page.tsx', '_p/y/page.tsx', '@slot/z/page.tsx', '(.)photo/page.tsx', 'icon.tsx', 'u/[h]/opengraph-image.tsx', 'u/[h]/part.tsx', 'api/route.ts', 'sitemap.ts', 'robots.ts']) {
    mkdirSync(`${d}/${f.split('/').slice(0, -1).join('/')}`, { recursive: true });
    writeFileSync(`${d}/${f}`, '');
  }
  assert.deepEqual(walkRoutes(d), ['/', '/api', '/icon', '/robots.txt', '/sitemap.xml', '/u/[h]/opengraph-image', '/x', '/z']);
});

test('performance screens render the shared disclaimer; their samples are concrete', () => {
  const perf = routesOf('performance');
  assert.ok(perf.length >= 5);
  for (const [p, r] of perf) {
    const s = src(r.file);
    assert.ok(/import \{ Disclaimer \} from '[./]+disclaimer\.tsx'/.test(s) && s.includes('<Disclaimer />') || s.includes('data-disclaimer'), `${p}: ${r.file} renders no Disclaimer`);
    assert.ok(r.sample.startsWith('/') && !r.sample.includes('['), `${p}: sample must be a real URL`);
  }
  assert.match(src('app/disclaimer.tsx'), /data-disclaimer>\{DISCLAIMER\}</);
  assert.match(src('app/disclaimer.tsx'), /import \{ DISCLAIMER \} from '@\/lib\/share\.ts'/);
});

test('share images (passing and pending) render DISCLAIMER from lib/share.ts', () => {
  const images = [...routesOf('image'), ...routesOf('pending').filter(([, r]) => r.image)];
  for (const [p, r] of images) {
    const s = src(r.file);
    assert.match(s, /import \{ DISCLAIMER \} from '@\/lib\/share\.ts'/, `${p}`);
    assert.match(s, /DISCLAIMER\b(?!')/, `${p}`);
  }
});

test('pending entries name their owning build and carry a ponytail note', () => {
  for (const [p, r] of routesOf('pending')) {
    assert.ok(['F-10', 'F-12'].includes(r.owner), p);
    assert.ok(r.ponytail.length > 10, p);
  }
  assert.match(src('lib/disclaimer-routes.ts'), /\/\/ ponytail: .+ — fix: /);
});

test('notPerformance entries give a reason', () => {
  for (const [p, r] of routesOf('notPerformance')) assert.ok(r.reason.length > 2, p);
});

test('fix #21: every page exports its own title', () => {
  const pages = walkRoutes(`${root}app`).filter((r) => {
    try { readFileSync(`${root}app${r === '/' ? '' : r}/page.tsx`); return true; } catch { return false; }
  });
  assert.ok(pages.length > 20);
  const titles = new Map<string, string>();
  for (const r of pages) {
    const s = src(`app${r === '/' ? '' : r}/page.tsx`);
    assert.match(s, /export (const metadata|async function generateMetadata|function generateMetadata)/, `${r} has no metadata`);
    const t = /export const metadata[^=]*=\s*\{\s*title:\s*('[^']+'|`[^`]+`)/.exec(s)?.[1];
    if (t && r !== '/') { assert.ok(!titles.has(t), `${r} repeats the title of ${titles.get(t)}`); titles.set(t, r); }
  }
});
