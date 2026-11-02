// F-17 "exactly one normaliser" (decisions of cycle 2 and 3; plan docs/features/logs/F-16-F-17/plan.md §6.4, §8 F-17 #9
// and #15). lib/text-safety.ts is the one place that folds text for matching (NFKC, look-alike letters); lib/handles.ts
// (checkHandle, checkDisplayName, built on it and on lib/referral.ts#normalizeHandle) is the one entry for handles and
// names. These tests fail when a caller normalises on its own or a second look-alike map appears.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const read = (f: string) => readFileSync(join(root, f), 'utf8');

function files(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(join(root, dir))) {
    const p = join(dir, name);
    if (statSync(join(root, p)).isDirectory()) out.push(...files(p));
    else if (/\.(ts|tsx)$/.test(name) && !/\.(test|spec)\.tsx?$/.test(name)) out.push(relative('', p));
  }
  return out;
}
const SOURCES = [...files('lib'), ...files('app'), ...files('scripts')];

// `import { a, b } from '<module>'` names, for one module path suffix.
function importsFrom(src: string, mod: RegExp): string[] {
  const names: string[] = [];
  for (const m of src.matchAll(/import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*'([^']+)'/g)) {
    if (mod.test(m[2])) names.push(...m[1].split(',').map((x) => x.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0]).filter(Boolean));
  }
  return names;
}
const HANDLES = /(^|\/)handles\.ts$/;
const TEXT = /(^|\/)text-safety\.ts$/;
const REFERRAL = /(^|\/)referral\.ts$/;
const PARAMS = /(^|\/)params\.ts$/;

test('F-17 #9/#15: sign-up, rename, display name and reports import the one normaliser', () => {
  // Sign-up and rename (lib/auth/attempts.ts: createUserForAttempt, changeHandle).
  const att = read('lib/auth/attempts.ts');
  for (const n of ['checkHandle', 'checkDisplayName', 'lockHandleSkeleton']) assert.ok(importsFrom(att, HANDLES).includes(n), `attempts.ts imports ${n}`);
  assert.ok(importsFrom(att, TEXT).includes('sanitizeUserText'));
  assert.ok(importsFrom(att, REFERRAL).includes('normalizeHandle'));
  const change = att.slice(att.indexOf('export async function changeHandle'));
  assert.match(change, /normalizeHandle\(raw\)/);
  assert.match(change, /checkHandle\(handle, userId/);
  const create = att.slice(att.indexOf('export async function createUserForAttempt'), att.indexOf('export async function completeAttempt'));
  assert.match(create, /checkDisplayName\(cleaned\)/);
  assert.match(create, /checkHandle\(handle, null/);
  // Dev sign-up (app/actions.ts#login).
  const act = read('app/actions.ts');
  for (const n of ['checkHandle', 'checkDisplayName']) assert.ok(importsFrom(act, HANDLES).includes(n), `app/actions.ts imports ${n}`);
  assert.ok(importsFrom(act, REFERRAL).includes('normalizeHandle'));
  // Display names: checkDisplayName is built on F-9's normaliser.
  const h = read('lib/handles.ts');
  for (const n of ['sanitizeUserText', 'skeleton', 'leet', 'squash']) assert.ok(importsFrom(h, TEXT).includes(n), `handles.ts imports ${n}`);
  assert.ok(importsFrom(h, REFERRAL).includes('normalizeHandle'));
  // Reports: never folds text itself; a handle it takes goes through normalizeHandle or routeHandle.
  const rep = read('lib/reports.ts');
  assert.doesNotMatch(rep, /\.normalize\(|\.toLowerCase\(|LOOKALIKE|skeleton\s*=|const\s+\w*skel\w*\s*=/, 'lib/reports.ts folds text on its own');
  if (/\bhandle\b/.test(rep.replace(/\/\/.*$/gm, ''))) {
    const ok = [...importsFrom(rep, HANDLES), ...importsFrom(rep, REFERRAL), ...importsFrom(rep, PARAMS)].some((n) => ['normalizeHandle', 'routeHandle', 'checkHandle'].includes(n));
    assert.ok(ok, 'lib/reports.ts reads a handle without normalizeHandle/routeHandle');
  }
});

test('F-17 #9/#15: search — there is no user or handle search; /t?q= is a ticker parse, never user text', () => {
  assert.deepEqual(SOURCES.filter((f) => /search/i.test(f)), [], 'a search route would have to import the one normaliser');
  // Main's #85 moved the /t search into SQL (app/t/ticker-sql.ts#tickerIndexPage): the query still goes through the
  // ticker parse (normalizeSymbol), never user text.
  const t = read('app/t/page.tsx');
  assert.ok(importsFrom(t, /(^|\/)ticker-sql\.ts$/).includes('tickerIndexPage'));
  assert.doesNotMatch(t, /\.normalize\(|users\b.*\bq\b/);
  const ts = read('app/t/ticker-sql.ts');
  // FIXES-CYCLE5 (F5-4): the index's search runs on the summary's totals through lib/ticker.ts#filterTickerIndex, whose
  // first step is the same ticker parse.
  assert.match(ts, /filterTickerIndex\(all, q\)/);
  assert.match(read('lib/ticker.ts'), /export function filterTickerIndex\(rows: TickerIndexRow\[\], q: unknown\): FilterResult \{\n  if \(typeof q !== 'string' \|\| !q\.trim\(\)\) return \{ kind: 'all', rows \};\n  const symbol = normalizeSymbol\(q\);/);
  assert.doesNotMatch(ts, /\.normalize\(|from users\b[^`]*\bq\b/);
});

// Outside lib/text-safety.ts, only these may call a compatibility normalisation, each for its stated reason.
const NFK_ALLOW: Record<string, { count: number; why: string }> = {
  'lib/text-safety.ts': { count: 1, why: 'the one normaliser (skeleton)' },
  'lib/handles.ts': { count: 1, why: 'checkDisplayName glyph rule: the skeleton turns pictographs into spaces' },
  'lib/claims.ts': { count: 1, why: 'vendor institution names, not user text' },
  'lib/public-trades.ts': { count: 1, why: 'F-7 slug of a public filer name (public record data, not user text)' },
};

test('F-17 #9: no file normalises with NFKC/NFKD outside the allowlist', () => {
  const found: Record<string, number> = {};
  for (const f of SOURCES) {
    const n = [...read(f).matchAll(/\.normalize\(\s*['"]NFK[CD]['"]\s*\)/g)].length;
    if (n) found[f] = n;
  }
  for (const [f, n] of Object.entries(found)) {
    assert.ok(Object.hasOwn(NFK_ALLOW, f), `${f} normalises text itself; use lib/text-safety.ts or lib/handles.ts`);
    assert.ok(n <= NFK_ALLOW[f].count, `${f}: ${n} NFK normalisations, allowed ${NFK_ALLOW[f].count} (${NFK_ALLOW[f].why})`);
  }
  assert.ok(found['lib/text-safety.ts'] >= 1, 'the one normaliser still normalises');
});

// A look-alike map: three or more Cyrillic or Greek letters used as keys (`а: 'a'`, `'е': 'e'`, `['о', 'o']`).
const MAP_KEY = /(?:^|[{,\s[])['"]?[Ͱ-ϿЀ-ӿԀ-ԯ]['"]?\s*[:,]\s*['"][a-z]['"]/g;
const confusablesMapIn = (src: string): boolean => [...src.matchAll(MAP_KEY)].length >= 3;

test('F-17 #9: the confusables-map detector finds a map and ignores ordinary text', () => {
  assert.equal(confusablesMapIn("const M = { а: 'a', е: 'e', о: 'o' };"), true);
  assert.equal(confusablesMapIn("const M = new Map([['α', 'a'], ['ο', 'o'], ['ρ', 'p']]);"), true);
  assert.equal(confusablesMapIn("const t = 'Привет, мир'; // greeting"), false);
  assert.equal(confusablesMapIn(read('lib/text-safety.ts')), true, 'the one map is found where it lives');
});

test('F-17 #9: there is no second confusables map in lib/, app/ or scripts/, and no confusables dependency', () => {
  const maps = SOURCES.filter((f) => f !== 'lib/text-safety.ts' && confusablesMapIn(read(f)));
  assert.deepEqual(maps, [], 'a second look-alike map; extend lib/text-safety.ts instead');
  const pkg = JSON.parse(read('package.json')) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
  const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
  assert.deepEqual(deps.filter((d) => /confusable|homoglyph|unicode-security|unidecode|skeleton/i.test(d)), []);
});
