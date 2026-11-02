// F-21 · Exclusion counts beside the headline: the one sum (lib/exclusions.ts), its guard over every exclusion counter
// the record keeps (committee decision 6, mutation-checked here), the reason lines as data (decision 7, R4) and the copy
// (decision 11, R5, R6). Pure: no database (the stored counters are lib/f21-exclusions.db.test.ts).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { COUNTERS, CAUSE_COUNTER, exclusionReasons, exclusionTotal, lineCount, NOT_EXCLUSIONS, PUBLIC_KINDS, RESULT_DATA, RESULT_KEYS, type ExclusionInput } from './exclusions.ts';
import { CAUSES } from './options.ts';
import { EXCLUDED_KEYS } from './trades.ts';
import { PUBLIC_REASONS } from './public-trades.ts';
import { EXCLUSIONS, OPTIONS, PROFILE, PUBLIC } from './copy.ts';
import type { OptionCounts } from './options-view.ts';

const read = (f: string) => readFileSync(new URL(f, import.meta.url), 'utf8');
type Sources = { trades: string; options: string; optionsSync: string; publicTrades: string; schema: string; writers: string[] };
const real = (): Sources => ({
  trades: read('./trades.ts'), options: read('./options.ts'), optionsSync: read('./options-sync.ts'), publicTrades: read('./public-trades.ts'),
  schema: read('../db/schema.sql'),
  writers: readdirSync(new URL('.', import.meta.url)).filter((f) => f.endsWith('.ts') && !f.includes('.test.')).map((f) => read(`./${f}`)),
});

const keysOf = (body: string) => [...body.matchAll(/(\w+)\??\s*:/g)].map((m) => m[1]);
// Anchored scans: each must find its declaration, and the keys known today, or the guard itself is broken.
function anchored(src: string, re: RegExp, known: string[], what: string): string[] {
  const m = re.exec(src);
  assert.ok(m, `${what}: declaration not found`);
  const keys = keysOf(m[1]);
  for (const k of known) assert.ok(keys.includes(k), `${what}: known key ${k} not found (scan broken)`);
  return keys;
}
// The users columns: the create-table body plus every schema_add_column on it (the parser of lib/privacy-fields.test.ts).
function userColumns(schemaText: string): string[] {
  const schema = schemaText.replace(/--[^\n]*/g, '');
  const body = schema.split(/create table if not exists users \(/)[1].split(/\n\);/)[0];
  const cols = body.split('\n').map((l) => l.trim().match(/^([a-z_]+)\s+(?!key\b)/)?.[1]).filter((c): c is string => !!c && !['primary', 'unique', 'check', 'foreign'].includes(c));
  for (const m of schema.matchAll(/schema_add_column\('users', '([a-z_]+)'/g)) cols.push(m[1]);
  return cols;
}

// ponytail: the writer scan reads only top-level lib/*.ts and the literal `update users set excluded_x =` form, and the
// schema scan sees only users.excluded_* columns — fix: scan lib/**, scripts/** and every `set ... excluded_` assignment
// form, and classify counters on other tables (public_filers.excluded is covered through PUBLIC_REASONS only).
/** Every exclusion key or counter in the sources that lib/exclusions.ts neither sums nor names as left out. */
export function unclassified(s: Sources): string[] {
  const out: string[] = [];
  const counters = COUNTERS as Record<string, unknown>;
  const check = (where: keyof typeof RESULT_KEYS, keys: string[]) => {
    const map = RESULT_KEYS[where] as Record<string, string>, data = RESULT_DATA[where] as readonly string[];
    for (const k of keys) {
      if (data.includes(k)) continue;
      const col = map[k];
      if (!col || (col !== 'public' && !counters[col])) out.push(`${where}.${k}`);
    }
  };
  check('MatchResult', anchored(s.trades, /export type MatchResult = \{([^}]*)\};/, ['trades', ...EXCLUDED_KEYS], 'MatchResult'));
  for (const k of EXCLUDED_KEYS) if (!(k in RESULT_KEYS.MatchResult)) out.push(`MatchResult.${k}`); // #108's runtime list, beside the scan
  check('options', anchored(s.options, /export function matchOptions\(.*?\): \{([^}]*)\}/, ['trades', 'counts', 'short', 'other'], 'matchOptions'));
  check('options', anchored(s.optionsSync, /export async function rebuildOptionTrades\(.*?\): Promise<\{([^}]*)\}>/, ['trades', 'short', 'other', 'counts'], 'rebuildOptionTrades'));
  check('public', anchored(s.publicTrades, /export function matchPublic\(.*?\): \{([^}]*)\}/, ['trades', 'excluded', 'openSymbols'], 'matchPublic'));
  for (const m of s.publicTrades.matchAll(/\bcount\(([^)]*)\)/g)) for (const lit of m[1].matchAll(/'(\w+)'/g)) if (!(lit[1] in PUBLIC_KINDS)) out.push(`public.${lit[1]}`);
  for (const c of userColumns(s.schema)) if (/^excluded_/.test(c) && !counters[c]) out.push(`schema.users.${c}`);
  for (const src of s.writers) for (const w of src.matchAll(/update users set ([^`]*)`/g)) for (const c of w[1].matchAll(/\b(excluded_\w+)\s*=/g)) if (!counters[c[1]]) out.push(`writer.${c[1]}`);
  return [...new Set(out)];
}

test('F-21 guard: every exclusion counter in the sources is summed or named as left out (none unclassified today)', () => {
  assert.deepEqual(unclassified(real()), []);
  // The writer scan is anchored too: it sees the rebuild's own writes, the two F-21 counters included.
  const written = new Set(real().writers.flatMap((src) => [...src.matchAll(/update users set ([^`]*)`/g)].flatMap((w) => [...w[1].matchAll(/\b(excluded_\w+)\s*=/g)].map((c) => c[1]))));
  for (const c of ['excluded_positions', 'excluded_future', 'excluded_future_sells', 'excluded_corporate', 'excluded_held', 'excluded_shared', 'excluded_transfer', 'excluded_options_short', 'excluded_exercise_shares']) assert.ok(written.has(c), `writer scan misses ${c}`);
  for (const c of Object.keys(COUNTERS)) assert.ok(userColumns(real().schema).includes(c), `${c} is not a users column`);
  // Runtime sources: the filing reasons, the option causes and the filing copy's keys.
  for (const r of PUBLIC_REASONS) assert.ok(r in PUBLIC_KINDS, `public reason ${r} unclassified`);
  assert.deepEqual(Object.keys(PUBLIC_KINDS).sort(), [...PUBLIC_REASONS].sort());
  for (const k of Object.keys(PUBLIC.excluded)) assert.ok((PUBLIC_REASONS as readonly string[]).includes(k), `PUBLIC.excluded.${k} is not a reason`);
  for (const c of CAUSES) assert.ok(CAUSE_COUNTER[c] in COUNTERS, `option cause ${c} unclassified`);
  assert.deepEqual(Object.keys(CAUSE_COUNTER).sort(), [...CAUSES].sort());
  for (const why of [...Object.values(COUNTERS).map((k) => k.why), ...Object.values(PUBLIC_KINDS).map((k) => k.why), ...Object.values(NOT_EXCLUSIONS)]) assert.ok(why.length > 10);
});

test('F-21 guard, mutation check: a dummy key in MatchResult, the options result, the public-filing result or the schema each fails', () => {
  const s = real();
  const cases: [string, Sources, string][] = [
    ['MatchResult', { ...s, trades: s.trades.replace('excludedTransfer?: number };', 'excludedTransfer?: number; excludedX: number };') }, 'MatchResult.excludedX'],
    ['options result', { ...s, options: s.options.replace('short: number; other: number } {', 'short: number; other: number; excludedX: number } {') }, 'options.excludedX'],
    ['public-filing result', { ...s, publicTrades: s.publicTrades.replace('openSymbols: string[] } {', 'openSymbols: string[]; excludedX: number } {') }, 'public.excludedX'],
    ['schema', { ...s, schema: `${s.schema}\nselect schema_add_column('users', 'excluded_x', 'int not null default 0');\n` }, 'schema.users.excluded_x'],
  ];
  for (const [what, mutated, dummy] of cases) {
    assert.notEqual(JSON.stringify(mutated), JSON.stringify(s), `${what}: the mutation applied`);
    assert.deepEqual(unclassified(mutated), [dummy], what);
  }
  // A new filing reason literal and a new rebuild writer are caught too.
  assert.deepEqual(unclassified({ ...s, publicTrades: s.publicTrades.replace("count('no_price')", "count('no_price'); count('x_dummy')") }), ['public.x_dummy']);
  assert.deepEqual(unclassified({ ...s, writers: [...s.writers, 'await tx`update users set excluded_y = ${n} where id = ${u}`;'] }), ['writer.excluded_y']);
});

const opts = (o: Partial<OptionCounts> = {}): OptionCounts => ({ shown: 0, short: 0, other: 0, openLong: 0, openShort: 0, openOther: 0, unsupported: 0, exerciseShares: 0, ...o });
const input = (o: Partial<ExclusionInput> = {}): ExclusionInput => ({ excluded_positions: 0, excluded_future_sells: 0, excluded_corporate: 0, excluded_held: 0, excluded_shared: 0, excluded_transfer: 0, public: null, options: opts(), gate: 'closed', ...o });

test('F-21 sum: each summed counter counts once; left-out kinds and open options never count (R2: a long option close counts)', () => {
  assert.equal(exclusionTotal(input()), 0);
  for (const k of ['excluded_positions', 'excluded_future_sells', 'excluded_corporate', 'excluded_held', 'excluded_shared', 'excluded_transfer'] as const) assert.equal(exclusionTotal(input({ [k]: 1 })), 1, k);
  for (const k of ['shown', 'short', 'other', 'exerciseShares'] as const) for (const gate of ['open', 'closed'] as const) assert.equal(exclusionTotal(input({ gate, options: opts({ [k]: 1 }) })), 1, `${k} ${gate}`);
  for (const k of ['openLong', 'openShort', 'openOther', 'unsupported'] as const) assert.equal(exclusionTotal(input({ options: opts({ [k]: 5 }) })), 0, k);
  for (const r of PUBLIC_REASONS) assert.equal(exclusionTotal(input({ public: { [r]: 3 } })), PUBLIC_KINDS[r].summed ? 3 : 0, r);
  assert.equal(exclusionTotal(input({ public: { unknown_kind: 4 } })), 0);
  // Every counter the sum reads is a summed COUNTER.
  const summedCols = Object.entries(COUNTERS).filter(([, k]) => k.summed).map(([c]) => c).sort();
  assert.deepEqual(summedCols, ['excluded_corporate', 'excluded_exercise_shares', 'excluded_future_sells', 'excluded_held', 'excluded_options_other', 'excluded_options_short', 'excluded_positions', 'excluded_shared', 'excluded_transfer']);
  assert.equal(COUNTERS.excluded_future.summed, false);
  // Importing: no line (TR-3).
  assert.equal(lineCount(input({ excluded_corporate: 2 }), 'importing'), 0);
  assert.equal(lineCount(input({ excluded_corporate: 2 }), 'connected'), 2);
});

test('F-21 reasons (R4): the lines\' n values sum to the total in both gate states; each trade once; R1 lines per gate', () => {
  let seed = 7;
  const rnd = (k: number) => { seed = (seed * 48271) % 2147483647; return seed % k; };
  for (let i = 0; i < 500; i++) {
    const c = input({ excluded_positions: rnd(3), excluded_future_sells: rnd(2), excluded_corporate: rnd(3), excluded_held: rnd(2), excluded_shared: rnd(2), excluded_transfer: rnd(3),
      public: rnd(2) ? { no_price: rnd(3), unreconciled: rnd(2), gift: rnd(3), indirect: rnd(2) } : null,
      options: opts({ shown: rnd(3), short: rnd(2), other: rnd(3), openLong: rnd(2), openShort: rnd(2), openOther: rnd(2), exerciseShares: rnd(3) }) });
    for (const gate of ['open', 'closed'] as const) {
      const r = exclusionReasons({ ...c, gate });
      assert.equal(r.reduce((a, x) => a + x.n, 0), exclusionTotal({ ...c, gate }), `${gate} ${JSON.stringify(c)}`);
      assert.equal(new Set(r.map((x) => x.key)).size, r.length);
      // Exercise shares are named once (the technical line's either/or).
      assert.ok(r.filter((x) => /share trade/.test(x.text)).length <= 1);
    }
  }
  const o = opts({ shown: 2, short: 1, other: 3, openLong: 1, openShort: 2, openOther: 1, exerciseShares: 1 });
  // R1, closed: the gated line word for word (closes part only) and the exercise-share line; nothing else about options.
  assert.deepEqual(exclusionReasons(input({ options: o, gate: 'closed' })), [
    { key: 'options.gated', n: 6, text: OPTIONS.gated(6, 4) }, { key: 'options.exerciseShares', n: 1, text: OPTIONS.exerciseShares(1) }]);
  // R1/R3, open: summarized long closes, short (closed counted), technical with the shares, open-other (not counted).
  assert.deepEqual(exclusionReasons(input({ options: o, gate: 'open' })), [
    { key: 'options.summarized', n: 2, text: EXCLUSIONS.optionsSummarized(2) }, { key: 'options.short', n: 1, text: OPTIONS.short(1, 2) },
    { key: 'options.technical', n: 4, text: OPTIONS.technical(3, 1) }, { key: 'options.openOther', n: 0, text: OPTIONS.openOther(1) }]);
  assert.deepEqual(exclusionReasons(input({ options: opts({ exerciseShares: 2 }), gate: 'open' })), [{ key: 'options.exerciseShares', n: 2, text: OPTIONS.exerciseShares(2) }]);
  // Share reasons reuse their constants; held only through PROFILE.excludedHeld (decision 11).
  assert.deepEqual(exclusionReasons(input({ excluded_positions: 1, excluded_future_sells: 2, excluded_corporate: 3, excluded_held: 4, excluded_shared: 5, excluded_transfer: 6, public: { no_price: 1, unreconciled: 2, indirect: 9 } })).map((x) => x.text), [
    PROFILE.excludedPositions(1), PROFILE.excludedFuture(2), PROFILE.excludedCorporate(3), PROFILE.excludedTransfer(6), PROFILE.excludedHeld(4), EXCLUSIONS.excludedShared(5),
    PUBLIC.excluded.no_price(1), PUBLIC.excluded.unreconciled(2)]);
});

test('F-21 copy (decision 11, R5, R6): neutral words, singular forms, no completeness claim', () => {
  assert.equal(EXCLUSIONS.title(1), '1 trade excluded from these figures');
  assert.equal(EXCLUSIONS.title(2), '2 trades excluded from these figures');
  assert.equal(EXCLUSIONS.line(1), '1 trade excluded from these figures · reasons on the profile');
  assert.equal(EXCLUSIONS.line(1_000), '1,000 trades excluded from these figures · reasons on the profile');
  assert.equal(EXCLUSIONS.excludedShared(1), "1 trade excluded: its account is part of another profile's record.");
  assert.equal(EXCLUSIONS.excludedShared(3), "3 trades excluded: their account is part of another profile's record.");
  assert.equal(EXCLUSIONS.optionsSummarized(4), '4 option trades are summarized in their own row, outside these figures.');
  assert.equal(EXCLUSIONS.optionsSummarized(1), '1 option trade is summarized in its own row, outside these figures.');
  for (const n of [1, 2, 1000]) for (const t of [EXCLUSIONS.title(n), EXCLUSIONS.line(n), EXCLUSIONS.excludedShared(n), EXCLUSIONS.optionsSummarized(n)]) {
    assert.doesNotMatch(t, /hidden|removed|\byou\b|\byour\b|fail|missing|error|!|\ball\b|\bevery\b|complete|any broker|fault|wrong|cheat/i, t);
    assert.doesNotMatch(t, /\(s\)/);
  }
  // The new copy is only this block's four entries.
  assert.deepEqual(Object.keys(EXCLUSIONS).sort(), ['excludedShared', 'line', 'optionsSummarized', 'title']);
});
