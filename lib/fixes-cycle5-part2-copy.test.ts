// FIXES-CYCLE5 part 2: MK-P6 (the /how history sentence) and C5-41 (the Record tools pitch), with the legal committee's
// conditions (docs/features/logs/fixes-cycle5/legal-committee-2026-11-02.md §3a C1-C3, §3b C4-C7; committee round 2 item 5).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { BILLING, HOW, RECORD_TOOLS } from './copy.ts';
import { MARKS } from '../scripts/compliance.ts';

const ROOT = new URL('..', import.meta.url).pathname;
const read = (f: string) => readFileSync(`${ROOT}${f}`, 'utf8');
const walk = (d: string): string[] => readdirSync(`${ROOT}${d}`, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(`${d}/${e.name}`) : [`${d}/${e.name}`]));
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

const HISTORY = "Trades from before the earliest date the trader's broker provides: they are not imported, so a record can start later than the trader's first trade, and a sell of shares bought before that date is excluded and counted as a sell with no recorded entry.";
const PITCH = "Compare whole public records side by side: closed trades imported from connected accounts, losses and ranges included. Traders can't remove single trades.";
// Every string of a copy object; a builder is called with a date or a number, whichever it takes.
const call = (f: (...a: unknown[]) => unknown): string[] => {
  for (const args of [[2, 3, 4], [new Date(0), 2, 3], ['a', 'b', 'c']]) { try { return strings(f(...args)); } catch { /* try the next */ } }
  return [];
};
const strings = (o: unknown): string[] => (typeof o === 'string' ? [o] : typeof o === 'function' ? call(o as (...a: unknown[]) => unknown) : o && typeof o === 'object' ? Object.values(o).flatMap(strings) : []);

test('MK-P6 C1: the history sentence sits in "What is excluded, and counted", right after the transfers-in item', () => {
  const i = HOW.excluded.findIndex((s) => s.startsWith('Transfers in and out of an account.')); // F-32 Part A's one transfers item
  assert.ok(i >= 0);
  assert.equal(HOW.excluded[i + 1], HISTORY);
  assert.equal(HOW.excluded.filter((s) => s === HISTORY).length, 1);
  assert.equal(HOW.excludedTitle, 'What is excluded, and counted');
});

test('MK-P6 C2: no broker or vendor named, no history length, no completeness claim', () => {
  assert.doesNotMatch(HISTORY, /\d+\s*(day|month|year)s?/i);
  assert.doesNotMatch(HISTORY, /every trade|any broker|full history|complete/i);
  for (const m of MARKS) assert.doesNotMatch(HISTORY, new RegExp(`\\b${m}\\b`, 'i'), m);
  assert.doesNotMatch(HISTORY, /snaptrade/i);
  assert.match(HISTORY, /the earliest date the trader's broker provides/);
});

test('MK-P6 C3: COMPLIANCE §12 records the dated /how change', () => {
  const doc = read('docs/COMPLIANCE.md');
  const s12 = doc.slice(doc.indexOf('## 12.'), doc.indexOf('## 13.'));
  assert.match(s12, /2026-11-02: \/how names trades from before the earliest date the trader's broker provides/);
});

test('C5-41 C4/C6: the pitch is verbatim and whole; "whole" appears nowhere else; no completeness or permanence words', () => {
  assert.equal(RECORD_TOOLS.what, PITCH);
  const others = strings({ ...RECORD_TOOLS, what: '' });
  for (const s of others) assert.doesNotMatch(s, /\bwhole\b/i, s);
  for (const s of [...strings(RECORD_TOOLS), ...strings(BILLING)]) {
    assert.doesNotMatch(s, /every trade|all trades|nothing hidden|\bever\b|permanent|forever/i, s);
  }
  assert.match(PITCH, /^Compare whole public records side by side: /);
});

// C5 (round 2 item 5): "Traders can't remove single trades" stays true. No app file deletes or hides closed_trades rows;
// in lib the deletes are system rebuilds, pinned by file and enclosing function (never by line); thesis updates touch
// only note columns; no server action imports a rebuild.
const REBUILDS: Record<string, string[]> = {
  'lib/sync.ts': ['rebuildTrades'],
  'lib/public-trades.ts': ['rebuildPublicTrades'],
  'lib/options-sync.ts': ['removeOptionPairs', 'rebuildRecord'],
};
const enclosing = (src: string, at: number) => [...src.slice(0, at).matchAll(/^(?:export )?(?:async )?function (\w+)/gm)].pop()?.[1];

test('C5: no route, action or form deletes or hides a single closed trade; lib deletes are system rebuilds only', () => {
  const app = walk('app').filter((f) => /\.tsx?$/.test(f));
  for (const f of app) assert.doesNotMatch(code(read(f)), /delete from closed_trades|update closed_trades/i, f);
  const lib = walk('lib').filter((f) => /\.ts$/.test(f) && !/\.test\.ts$/.test(f));
  const seen: string[] = [];
  for (const f of lib) {
    const src = code(read(f));
    for (const m of src.matchAll(/delete from closed_trades/gi)) {
      const fn = enclosing(src, m.index!);
      assert.ok(REBUILDS[f]?.includes(fn ?? ''), `${f}#${fn} deletes closed_trades rows`);
      seen.push(`${f}#${fn}`);
    }
    for (const m of src.matchAll(/update closed_trades(?: \w+)? set ([\s\S]{0,60})/gi)) {
      const set = m[1];
      assert.match(set, /^(thesis\w*|sell_imported_at|\$\{set\})/, `${f}: update closed_trades set ${set}`);
    }
  }
  for (const [f, fns] of Object.entries(REBUILDS)) for (const fn of fns) assert.ok(seen.includes(`${f}#${fn}`), `${f}#${fn} (the allow-list is current)`);
  // No column on closed_trades hides a single trade.
  const schema = read('db/schema.sql');
  const ct = schema.slice(schema.indexOf('create table if not exists closed_trades'));
  assert.doesNotMatch(ct.slice(0, ct.indexOf(');')), /\bhidden\w*\b|\bdeleted_at\b/);
});

test('C5: no server action imports a rebuild function (whole-profile deletion goes through the users row)', () => {
  const actions = walk('app').filter((f) => /\.tsx?$/.test(f) && /^['"]use server['"]/m.test(read(f)));
  assert.ok(actions.length >= 5, actions.join(', '));
  const names = Object.values(REBUILDS).flat();
  for (const f of actions) {
    const imports = read(f).match(/^import [\s\S]*?from ['"][^'"]+['"];?$/gm) ?? [];
    for (const n of names) assert.ok(!imports.some((i) => new RegExp(`\\b${n}\\b`).test(i)), `${f} imports ${n}`);
  }
});

// C5's DB half (a disconnect freezes the record and keeps its closed trades after syncUser) is asserted by
// lib/sync.test.ts "disconnect after connecting (TR-5): … the record freezes and nothing is deleted": cited, not copied.
test('C5: the existing freeze test still asserts that a disconnect keeps the closed trades', () => {
  const s = read('lib/sync.test.ts');
  const i = s.indexOf("dbTest('disconnect after connecting (TR-5)");
  assert.ok(i >= 0);
  const body = s.slice(i, s.indexOf('\ndbTest(', i + 10));
  assert.match(body, /disconnected_at\);\n\s+assert\.equal\(await count\('activities'\), 2\);\n\s+assert\.equal\(await count\('closed_trades'\), 1\);/);
});
