// Privacy work (2026-11-01): the cookie table (lib/privacy-cookies.ts) lists exactly the cookies the code sets.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COOKIE_TABLE } from './privacy-cookies.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const sources = (dir: string): string[] => readdirSync(join(root, dir)).flatMap((f) => {
  const p = join(root, dir, f);
  return statSync(p).isDirectory() ? sources(relative(root, p)) : /\.tsx?$/.test(f) && !/\.test\.ts$/.test(f) ? [relative(root, p)] : [];
});
const files = [...sources('app'), ...sources('lib'), ...['instrumentation.ts', 'proxy.ts', 'middleware.ts'].filter((f) => existsSync(join(root, f)))];
const read = (f: string) => readFileSync(join(root, f), 'utf8');

// String constants across the code (`export const X_COOKIE = 'name'`), to resolve a write's first argument.
const constants = new Map<string, string>();
for (const f of files) for (const m of read(f).matchAll(/\bconst\s+([A-Z][A-Z0-9_]*)\s*=\s*'([^']*)'/g)) constants.set(m[1], m[2]);

type Write = { file: string; name: string; maxAge: string | null };
export function cookieWrites(file: string, text: string): Write[] {
  const src = text.replace(/(^|\s)\/\/[^\n]*/g, '$1'); // comments are documentation, not writes
  const out: Write[] = [];
  // Every receiver that holds a cookie store: cookies(), `.cookies` on a response or request, cookieStore, and any
  // variable assigned from cookies() (`const store = await cookies()`).
  const stores = ['jar', ...[...src.matchAll(/\b(?:const|let|var)\s+(\w+)\s*=\s*(?:await\s+)?cookies\(\)/g)].map((m) => m[1])];
  const receiver = `(?:cookies\\(\\)\\)?|\\.cookies|\\bcookieStore|\\b(?:${stores.join('|')}))`;
  for (const m of src.matchAll(new RegExp(`${receiver}\\s*\\.set\\(\\s*([^,)]*)([^;]*)`, 'g'))) {
    const arg = m[1].trim();
    const obj = arg.startsWith('{') ? (m[1] + m[2]).match(/name:\s*(['"`])([^'"`]*)\1/) : null;
    const literal = arg.match(/^(['"`])([^'"`$]*)\1$/);
    const name = obj ? obj[2] : literal ? literal[2] : /^[A-Z][A-Z0-9_]*$/.test(arg) ? constants.get(arg) ?? `<unresolved ${arg}>` : `<unresolved ${arg}>`;
    out.push({ file, name, maxAge: m[2].match(/maxAge:\s*([^,}]+)/)?.[1].trim() ?? null });
  }
  // Raw headers: Set-Cookie: name=..., and document.cookie = 'name=...'
  for (const m of src.matchAll(/set-cookie['"`]?\s*[,:]\s*[`'"]([A-Za-z0-9_-]+)=/gi)) out.push({ file, name: m[1], maxAge: null });
  for (const m of src.matchAll(/document\.cookie\s*=\s*[`'"]([A-Za-z0-9_-]+)=/g)) out.push({ file, name: m[1], maxAge: null });
  // Anything mentioning Set-Cookie or document.cookie that the patterns above could not read is a failure, not a pass.
  if (/set-cookie/i.test(src) && ![...src.matchAll(/set-cookie['"`]?\s*[,:]\s*[`'"]([A-Za-z0-9_-]+)=/gi)].length) out.push({ file, name: '<unreadable Set-Cookie>', maxAge: null });
  if (/document\.cookie\s*=/.test(src) && ![...src.matchAll(/document\.cookie\s*=\s*[`'"]([A-Za-z0-9_-]+)=/g)].length) out.push({ file, name: '<unreadable document.cookie>', maxAge: null });
  return out;
}

const writes = files.flatMap((f) => cookieWrites(f, read(f)));

test('every cookie the code sets is in COOKIE_TABLE, with a purpose and a lifetime, and every row is set somewhere', () => {
  const names = new Set(COOKIE_TABLE.map((r) => r.name));
  assert.deepEqual(writes.filter((w) => !names.has(w.name)).map((w) => `${w.file}: ${w.name}`), []);
  for (const r of COOKIE_TABLE) {
    assert.ok(writes.some((w) => w.name === r.name), `${r.name} is listed but never set`);
    assert.ok(r.purpose.length > 20 && r.lifetime.length > 2 && r.lifetimeSeconds > 0, r.name);
    assert.deepEqual([...new Set(writes.filter((w) => w.name === r.name).map((w) => w.file))].sort(), [...r.setIn].sort(), `${r.name}: setIn`);
  }
  assert.equal(names.size, COOKIE_TABLE.length, 'one row per cookie');
});

test('each write lasts no longer than its row says (or clears the cookie)', () => {
  const lifetimes = new Map(COOKIE_TABLE.map((r) => [r.name, r.lifetimeSeconds]));
  const known: Record<string, number> = { 'SESSION_DAYS * 86_400': 30 * 86_400, '365 * 86_400': 365 * 86_400, EMAIL_COOKIE_SECONDS: 15 * 60, CONNECT_COOKIE_SECONDS: 24 * 3600, '3600': 3600, '600': 600, '0': 0, ATTEST_KEEP_SECONDS: 30 /* FIXES-CYCLE5 (F5-7) */ };
  for (const w of writes) {
    if (w.maxAge === null) continue;
    const expr = w.maxAge.replace(/^email \? (\w+) : 0$/, '$1');
    assert.ok(expr in known, `${w.file}: maxAge ${w.maxAge} is not a known lifetime; add it to this test and to COOKIE_TABLE`);
    assert.ok(known[expr] <= lifetimes.get(w.name)!, `${w.file}: ${w.name} maxAge ${w.maxAge}`);
  }
});

test('the scanner reads every write form and fails on unreadable ones', () => {
  assert.deepEqual(cookieWrites('x', "(await cookies()).set('a', v, { maxAge: 600 }); jar.set(SESSION_COOKIE, v); res.cookies.set(\"b\", v)").map((w) => w.name), ['a', 'sid', 'b']);
  assert.deepEqual(cookieWrites('x', "headers: { 'Set-Cookie': 'c=1; Path=/' }; document.cookie = 'd=1'").map((w) => w.name), ['c', 'd']);
  assert.deepEqual(cookieWrites('x', "h.append('set-cookie', value)").map((w) => w.name), ['<unreadable Set-Cookie>']);
  // Forms the tester found missing (QA 4): another variable, the object form, a variable name, backticks, cookieStore.
  assert.deepEqual(cookieWrites('x', "const store = await cookies(); store.set('t1', v); (await cookies()).set({ name: 't2', value: v }); jar.set(name, v); jar.set(`t3`, v); cookieStore.set('t4', v)").map((w) => w.name),
    ['t1', 't2', '<unresolved name>', 't3', 't4']);
});
